import crypto from "crypto";
import type { Database } from "@openpims/db/client";
import { ekasaReceipts, ekasaDailyClosures, ekasaConfig } from "@openpims/db";
import { eq, and, isNull, sql, gte, lte } from "drizzle-orm";
import {
  assertEkasaOutboundAllowed,
  pemPrivateKeyFromCert,
} from "@/lib/ekasa/fiscal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as "YYYY-MM-DD HH:MM:SS" in Europe/Bratislava timezone. */
function toSlovakTimestamp(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    fmt.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** Return "YYYY-MM-DD" in Europe/Bratislava timezone. */
function slovakDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EkasaVatRateType =
  | "ZERO"
  | "REDUCED"
  | "STANDARD"
  | "REDUCED_5"
  | "REDUCED_19"
  | "STANDARD_23";

export type EkasaReceiptType =
  | "STANDARD"
  | "STORNO"
  | "RETURN"
  | "DEPOSIT"
  | "WITHDRAWAL";

export function normalizeVatRate(input: string | number | undefined | null): EkasaVatRateType {
  if (!input) return "STANDARD_23";
  const s = String(input).trim().toUpperCase();
  if (s === "23" || s === "23%" || s === "STANDARD_23") return "STANDARD_23";
  if (s === "19" || s === "19%" || s === "REDUCED_19") return "REDUCED_19";
  if (s === "5" || s === "5%" || s === "REDUCED_5") return "REDUCED_5";
  if (s === "10" || s === "10%" || s === "REDUCED") return "REDUCED";
  if (s === "20" || s === "20%" || s === "STANDARD") return "STANDARD";
  if (s === "0" || s === "0%" || s === "ZERO") return "ZERO";
  return "STANDARD_23";
}

export interface MultiVatTaxBucket {
  rate: EkasaVatRateType;
  ratePercent: number;
  base: string;
  vat: string;
  total: string;
}

export interface MultiVatResult {
  amountBase: string;
  amountVat: string;
  amountTotal: string;
  dominantVatRate: EkasaVatRateType;
  taxBreakdown: Record<string, MultiVatTaxBucket>;
}

export function calculateMultiVatReceipt(
  items: Array<{
    name: string;
    qty: number;
    unitPrice: string | number;
    vatRate?: string | number;
  }>,
  defaultRate: EkasaVatRateType = "STANDARD_23"
): MultiVatResult {
  const buckets: Record<
    string,
    { ratePercent: number; base: number; vat: number; total: number }
  > = {
    STANDARD_23: { ratePercent: 0.23, base: 0, vat: 0, total: 0 },
    REDUCED_19: { ratePercent: 0.19, base: 0, vat: 0, total: 0 },
    REDUCED_5: { ratePercent: 0.05, base: 0, vat: 0, total: 0 },
    ZERO: { ratePercent: 0, base: 0, vat: 0, total: 0 },
    REDUCED: { ratePercent: 0.10, base: 0, vat: 0, total: 0 },
    STANDARD: { ratePercent: 0.20, base: 0, vat: 0, total: 0 },
  };

  let grandTotal = 0;
  let grandBase = 0;
  let grandVat = 0;

  for (const item of items) {
    const rateKey = normalizeVatRate(item.vatRate || defaultRate);
    const itemTotal = Math.round(Number(item.unitPrice) * item.qty * 100) / 100;
    const { base, vat } = calculateVatAmounts(itemTotal, rateKey);
    const bNum = Number(base);
    const vNum = Number(vat);

    buckets[rateKey].total += itemTotal;
    buckets[rateKey].base += bNum;
    buckets[rateKey].vat += vNum;

    grandTotal += itemTotal;
    grandBase += bNum;
    grandVat += vNum;
  }

  let dominantRate: EkasaVatRateType = defaultRate;
  let maxTotal = -1;
  for (const [rKey, b] of Object.entries(buckets)) {
    if (b.total > maxTotal) {
      maxTotal = b.total;
      dominantRate = rKey as EkasaVatRateType;
    }
  }

  const taxBreakdown: Record<string, MultiVatTaxBucket> = {};
  for (const [rKey, b] of Object.entries(buckets)) {
    if (b.total > 0) {
      taxBreakdown[rKey] = {
        rate: rKey as EkasaVatRateType,
        ratePercent: b.ratePercent,
        base: b.base.toFixed(2),
        vat: b.vat.toFixed(2),
        total: b.total.toFixed(2),
      };
    }
  }

  return {
    amountBase: grandBase.toFixed(2),
    amountVat: grandVat.toFixed(2),
    amountTotal: grandTotal.toFixed(2),
    dominantVatRate: dominantRate,
    taxBreakdown,
  };
}

export interface EkasaReceiptInput {
  practiceId: string;
  invoiceId?: string;
  paymentId?: string;
  receiptType?: EkasaReceiptType;
  originalReceiptId?: string;
  originalUid?: string;
  stornoReason?: string;
  amountBase: string;
  amountVat: string;
  amountTotal: string;
  vatRate: EkasaVatRateType;
  taxBreakdown?: Record<string, any>;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  items: Array<{
    name: string;
    qty: number;
    unitPrice: string;
    vatRate: string;
  }>;
  issuedAt?: Date;
}

export function calculateVatAmounts(
  amountTotal: number,
  vatRate: EkasaVatRateType
): { base: string; vat: string } {
  let ratePercent = 0.23;
  if (vatRate === "STANDARD_23") ratePercent = 0.23;
  else if (vatRate === "STANDARD") ratePercent = 0.20;
  else if (vatRate === "REDUCED_19") ratePercent = 0.19;
  else if (vatRate === "REDUCED") ratePercent = 0.10;
  else if (vatRate === "REDUCED_5") ratePercent = 0.05;
  else if (vatRate === "ZERO") ratePercent = 0;

  if (ratePercent === 0) {
    return {
      base: amountTotal.toFixed(2),
      vat: "0.00",
    };
  }

  const base = Math.round((amountTotal / (1 + ratePercent)) * 100) / 100;
  const vat = Math.round((amountTotal - base) * 100) / 100;
  return {
    base: base.toFixed(2),
    vat: vat.toFixed(2),
  };
}

export interface EkasaReceiptSigned {
  receiptNumber: string;
  okp: string;
  pkp: string;
}

export interface EkasaApiResponse {
  success: boolean;
  uid?: string;
  message?: string;
  rawResponse?: unknown;
}

// ---------------------------------------------------------------------------
// Receipt Number Generator
// Formát: YYYYMMDD-NNNN (napr. 20260904-0042)
// Atomické — číta MAX(seq) z DB pre daný deň a kliniku
// ---------------------------------------------------------------------------
export async function generateReceiptNumber(db: Database, practiceId: string): Promise<string> {
  const today = new Date();
  const localDate = slovakDateStr(today);
  const datePrefix = localDate.replace(/-/g, ""); // "20260904"

  // Advisory lock prevents concurrent receipt number races within this
  // practice-day.  pg_advisory_xact_lock is released at transaction end.
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${practiceId} || '-ekasa-receipt-' || ${localDate}))`,
  );

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ekasaReceipts)
    .where(
      and(
        eq(ekasaReceipts.practiceId, practiceId),
        isNull(ekasaReceipts.deletedAt),
        sql`date_trunc('day', ${ekasaReceipts.issuedAt} AT TIME ZONE 'Europe/Bratislava')::text = ${localDate}`,
      ),
    );

  const seq = ((result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  return `${datePrefix}-${seq}`;
}

// ---------------------------------------------------------------------------
// OKP — Overovací kód podnikateľa (SHA-1 hash)
// Zákon č. 289/2008 Z. z. § 3a ods. 4
// Vstup: DIC|pokladnicaId|receiptNumber|issuedAt|amountTotal
// ---------------------------------------------------------------------------
export function generateOkp(params: {
  dic: string;
  pokladnicaId: string;
  receiptNumber: string;
  issuedAt: Date;
  amountTotal: string;
}): string {
  const issuedAtStr = toSlovakTimestamp(params.issuedAt);

  const input = [
    params.dic,
    params.pokladnicaId,
    params.receiptNumber,
    issuedAtStr,
    params.amountTotal,
  ].join("|");

  return crypto.createHash("sha1").update(input, "utf8").digest("hex").toUpperCase();
}

// ---------------------------------------------------------------------------
// PKP — Podpisový kód podnikateľa (RSA-SHA256, base64)
// V produkcii: podpisuje sa súkromným kľúčom z certifikátu FR SR
// Tu: HMAC-SHA256 s privátnym kľúčom certifikátu alebo fallback
// ---------------------------------------------------------------------------
export function generatePkp(params: {
  dic: string;
  pokladnicaId: string;
  receiptNumber: string;
  issuedAt: Date;
  amountTotal: string;
  certBase64?: string | null;
}): string | null {
  const pem = pemPrivateKeyFromCert(params.certBase64);
  if (!pem) return null;

  const issuedAtStr = toSlovakTimestamp(params.issuedAt);
  const input = [
    params.dic,
    params.pokladnicaId,
    params.receiptNumber,
    issuedAtStr,
    params.amountTotal,
  ].join("|");

  const sign = crypto.createSign("SHA256");
  sign.update(input, "utf8");
  sign.end();
  return sign.sign(pem, "base64");
}

// ---------------------------------------------------------------------------
// Send to e-Kasa FR SR API
// Zákon č. 384/2025 Z. z. (aktuálna legislatíva)
// ---------------------------------------------------------------------------
export async function sendToEkasaApi(params: {
  apiUrl: string;
  receiptNumber: string;
  dic: string;
  pokladnicaId: string;
  amountTotal: string;
  amountVat: string;
  paymentMethod: string;
  okp: string;
  pkp: string;
  issuedAt: Date;
  items: EkasaReceiptInput["items"];
}): Promise<EkasaApiResponse> {
  const payload = {
    pokladnicaId: params.pokladnicaId,
    dic: params.dic,
    cisloDokladu: params.receiptNumber,
    datumCas: toSlovakTimestamp(params.issuedAt),
    celkovaSuma: params.amountTotal,
    dph: params.amountVat,
    platba: params.paymentMethod,
    okp: params.okp,
    pkp: params.pkp,
    polozky: params.items.map((i) => ({
      nazov: i.name,
      mnozstvo: i.qty,
      jednotkovaCena: i.unitPrice,
      sadzba: i.vatRate,
    })),
  };

  const blocked = assertEkasaOutboundAllowed(params.apiUrl);
  if (blocked) {
    return { success: false, message: blocked };
  }
  if (!params.pkp) {
    return {
      success: false,
      message: "e-Kasa PKP is missing; RSA private key from FR SR is required",
    };
  }

  try {
    const res = await fetch(`${params.apiUrl}/v2/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!res.ok) {
      return {
        success: false,
        message: `FR SR API returned ${res.status}`,
        rawResponse: { status: res.status },
      };
    }

    const data = (await res.json()) as { uid?: string; message?: string };
    if (!data.uid?.trim()) {
      return {
        success: false,
        message: "FR SR response did not include a receipt UID",
        rawResponse: { status: res.status },
      };
    }
    return {
      success: true,
      uid: data.uid.trim(),
      rawResponse: { uidPresent: true },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba siete";
    return {
      success: false,
      message: `Spojenie s FR SR zlyhalo: ${message}`,
      rawResponse: { error: message },
    };
  }
}

// ---------------------------------------------------------------------------
// QR Code Generator
// Formát: SK pokladnica QR (URL enkódovaný link pre overenie dokladu)
// ---------------------------------------------------------------------------
export function generateQrCodeData(params: {
  uid?: string | null;
  dic: string;
  amountTotal: string;
  receiptNumber: string;
}): string {
  if (params.uid?.trim()) {
    return `https://ekasa.financnasprava.sk/mdu/verifikacia?uid=${encodeURIComponent(params.uid.trim())}`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Orchestrovaná funkcia: Vytvor, podpíš a odošli doklad
// ---------------------------------------------------------------------------
export async function processEkasaReceipt(
  db: Database,
  input: EkasaReceiptInput,
  config: {
    dic: string;
    icDph?: string | null;
    pokladnicaId: string;
    ekasaApiUrl: string;
    certBase64?: string | null;
    offlineModeEnabled: boolean;
  }
): Promise<{ receiptId: string; status: string; uid?: string }> {
  const issuedAt = input.issuedAt ?? new Date();
  const receiptNumber = await generateReceiptNumber(db, input.practiceId);

  const okp = generateOkp({
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    receiptNumber,
    issuedAt,
    amountTotal: input.amountTotal,
  });

  const pkp = generatePkp({
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    receiptNumber,
    issuedAt,
    amountTotal: input.amountTotal,
    certBase64: config.certBase64,
  });

  const cannotFiscalize =
    Boolean(assertEkasaOutboundAllowed(config.ekasaApiUrl)) || !pkp;

  const [receipt] = await db
    .insert(ekasaReceipts)
    .values({
      practiceId: input.practiceId,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      receiptNumber,
      receiptType: input.receiptType ?? "STANDARD",
      originalReceiptId: input.originalReceiptId ?? null,
      originalUid: input.originalUid ?? null,
      stornoReason: input.stornoReason ?? null,
      okp,
      pkp: pkp ?? null,
      amountBase: input.amountBase,
      amountVat: input.amountVat,
      amountTotal: input.amountTotal,
      vatRate: input.vatRate,
      taxBreakdown: input.taxBreakdown ?? null,
      items: input.items ?? null,
      paymentMethod: input.paymentMethod,
      status: "PENDING",
      issuedAt,
    })
    .returning({ id: ekasaReceipts.id });

  if (!receipt) throw new Error("Nepodarilo sa uložiť doklad do databázy");

  if (config.offlineModeEnabled || cannotFiscalize) {
    await db
      .update(ekasaReceipts)
      .set({ status: "OFFLINE_STORED" })
      .where(eq(ekasaReceipts.id, receipt.id));
    return { receiptId: receipt.id, status: "OFFLINE_STORED" };
  }

  const apiResult = await sendToEkasaApi({
    apiUrl: config.ekasaApiUrl,
    receiptNumber,
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    amountTotal: input.amountTotal,
    amountVat: input.amountVat,
    paymentMethod: input.paymentMethod,
    okp,
    pkp,
    issuedAt,
    items: input.items,
  });

  const newStatus = apiResult.success ? "CONFIRMED" : "FAILED";

  await db
    .update(ekasaReceipts)
    .set({
      status: newStatus,
      uid: apiResult.uid ?? null,
      rawResponse: apiResult.rawResponse ?? null,
    })
    .where(eq(ekasaReceipts.id, receipt.id));

  return {
    receiptId: receipt.id,
    status: newStatus,
    uid: apiResult.uid,
  };
}

// ---------------------------------------------------------------------------
// Storno a opravné doklady (Zákon č. 289/2008 Z. z. § 8 ods. 2 a 3)
// ---------------------------------------------------------------------------
export async function createCorrectionReceipt(
  db: Database,
  params: {
    practiceId: string;
    originalReceiptId: string;
    reason: string;
    correctionType?: "STORNO" | "RETURN";
    closedBy?: string;
  },
  config: {
    dic: string;
    icDph?: string | null;
    pokladnicaId: string;
    ekasaApiUrl: string;
    certBase64?: string | null;
    offlineModeEnabled: boolean;
  }
): Promise<{
  receiptId: string;
  receiptNumber: string;
  status: string;
  uid?: string;
}> {
  const original = await db.query.ekasaReceipts.findFirst({
    where: and(
      eq(ekasaReceipts.id, params.originalReceiptId),
      eq(ekasaReceipts.practiceId, params.practiceId),
      isNull(ekasaReceipts.deletedAt)
    ),
  });

  if (!original) {
    throw new Error("Pôvodný doklad nebol nájdený");
  }

  if (original.receiptType === "STORNO") {
    throw new Error("Tento doklad je už storno doklad a nemožno ho opätovne stornovať");
  }

  // Skontroluj či k tomuto dokladu už neexistuje vystavené storno
  const existingStorno = await db.query.ekasaReceipts.findFirst({
    where: and(
      eq(ekasaReceipts.originalReceiptId, original.id),
      eq(ekasaReceipts.practiceId, params.practiceId),
      eq(ekasaReceipts.receiptType, "STORNO"),
      isNull(ekasaReceipts.deletedAt)
    ),
  });

  if (existingStorno) {
    throw new Error(
      `K tomuto dokladu už existuje storno doklad (${existingStorno.receiptNumber})`
    );
  }

  const correctionType = params.correctionType ?? "STORNO";
  const issuedAt = new Date();
  const receiptNumber = await generateReceiptNumber(db, params.practiceId);

  // Podľa Zákona č. 289/2008 Z. z. storno neguje tržbu
  const origTotal = Number(original.amountTotal) || 0;
  const origBase = Number(original.amountBase) || 0;
  const origVat = Number(original.amountVat) || 0;

  const amountTotal = (-Math.abs(origTotal)).toFixed(2);
  const amountBase = (-Math.abs(origBase)).toFixed(2);
  const amountVat = (-Math.abs(origVat)).toFixed(2);

  const okp = generateOkp({
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    receiptNumber,
    issuedAt,
    amountTotal,
  });

  const pkp = generatePkp({
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    receiptNumber,
    issuedAt,
    amountTotal,
    certBase64: config.certBase64,
  });

  const cannotFiscalize =
    Boolean(assertEkasaOutboundAllowed(config.ekasaApiUrl)) || !pkp;

  const originalItems = (Array.isArray(original.items) ? original.items : []) as Array<{
    name?: string;
    description?: string;
    qty?: number;
    quantity?: number;
    unitPrice?: string | number;
    vatRate?: string;
  }>;

  const stornoItems =
    originalItems.length > 0
      ? originalItems.map((item) => ({
          name: `[STORNO] ${item.name || item.description || "Položka"}`,
          qty: item.qty ?? item.quantity ?? 1,
          unitPrice: (-Math.abs(Number(item.unitPrice || 0))).toFixed(2),
          vatRate: item.vatRate ?? original.vatRate,
        }))
      : [
          {
            name: `[STORNO] Doklad ${original.receiptNumber}`,
            qty: 1,
            unitPrice: amountTotal,
            vatRate: original.vatRate,
          },
        ];

  const [stornoReceipt] = await db
    .insert(ekasaReceipts)
    .values({
      practiceId: params.practiceId,
      invoiceId: original.invoiceId,
      paymentId: original.paymentId,
      receiptNumber,
      receiptType: correctionType,
      originalReceiptId: original.id,
      originalUid: original.uid ?? original.receiptNumber,
      stornoReason: params.reason,
      okp,
      pkp: pkp ?? null,
      amountBase,
      amountVat,
      amountTotal,
      vatRate: original.vatRate,
      taxBreakdown: original.taxBreakdown,
      items: stornoItems,
      paymentMethod: original.paymentMethod,
      status: "PENDING",
      issuedAt,
    })
    .returning();

  if (!stornoReceipt) {
    throw new Error("Nepodarilo sa uložiť storno doklad do databázy");
  }

  if (config.offlineModeEnabled || cannotFiscalize) {
    await db
      .update(ekasaReceipts)
      .set({ status: "OFFLINE_STORED" })
      .where(eq(ekasaReceipts.id, stornoReceipt.id));
    return {
      receiptId: stornoReceipt.id,
      receiptNumber: stornoReceipt.receiptNumber,
      status: "OFFLINE_STORED",
    };
  }

  const apiResult = await sendToEkasaApi({
    apiUrl: config.ekasaApiUrl,
    receiptNumber,
    dic: config.dic,
    pokladnicaId: config.pokladnicaId,
    amountTotal,
    amountVat,
    paymentMethod: original.paymentMethod,
    okp,
    pkp,
    issuedAt,
    items: stornoItems,
  });

  const newStatus = apiResult.success ? "CONFIRMED" : "FAILED";

  await db
    .update(ekasaReceipts)
    .set({
      status: newStatus,
      uid: apiResult.uid ?? null,
      rawResponse: apiResult.rawResponse ?? null,
    })
    .where(eq(ekasaReceipts.id, stornoReceipt.id));

  return {
    receiptId: stornoReceipt.id,
    receiptNumber: stornoReceipt.receiptNumber,
    status: newStatus,
    uid: apiResult.uid,
  };
}

// ---------------------------------------------------------------------------
// Denné uzávierky (Z-reporty)
// ---------------------------------------------------------------------------

export async function generateClosureNumber(
  db: Database,
  practiceId: string,
  dateStr: string
): Promise<string> {
  const cleanDate = dateStr.replace(/-/g, "");
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ekasaDailyClosures)
    .where(
      and(
        eq(ekasaDailyClosures.practiceId, practiceId),
        isNull(ekasaDailyClosures.deletedAt),
        eq(ekasaDailyClosures.date, dateStr)
      )
    );

  const seq = ((result[0]?.count ?? 0) + 1).toString().padStart(2, "0");
  return `${cleanDate}-Z${seq}`;
}

export interface DailyClosureSummary {
  receiptsCount: number;
  totalAmount: number;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  vatBreakdown: {
    vat23: { base: number; vat: number };
    vat19: { base: number; vat: number };
    vat5: { base: number; vat: number };
    vat0: { base: number; vat: number };
    other: { base: number; vat: number };
  };
}

export async function computeDailySummary(
  db: Database,
  practiceId: string,
  dateStr: string
): Promise<DailyClosureSummary> {
  // Načítaj všetky platné doklady za daný kalendárny deň (Slovak local time)
  const receipts = await db.query.ekasaReceipts.findMany({
    where: and(
      eq(ekasaReceipts.practiceId, practiceId),
      isNull(ekasaReceipts.deletedAt),
      sql`date_trunc('day', ${ekasaReceipts.issuedAt} AT TIME ZONE 'Europe/Bratislava')::text = ${dateStr}`,
    ),
  });

  let totalAmount = 0;
  let cashAmount = 0;
  let cardAmount = 0;
  let transferAmount = 0;

  const vatBreakdown = {
    vat23: { base: 0, vat: 0 },
    vat19: { base: 0, vat: 0 },
    vat5: { base: 0, vat: 0 },
    vat0: { base: 0, vat: 0 },
    other: { base: 0, vat: 0 },
  };

  for (const r of receipts) {
    const total = Number(r.amountTotal) || 0;
    const base = Number(r.amountBase) || 0;
    const vat = Number(r.amountVat) || 0;

    totalAmount += total;
    if (r.paymentMethod === "CASH") cashAmount += total;
    else if (r.paymentMethod === "CARD") cardAmount += total;
    else transferAmount += total;

    if (r.vatRate === "STANDARD_23") {
      vatBreakdown.vat23.base += base;
      vatBreakdown.vat23.vat += vat;
    } else if (r.vatRate === "REDUCED_19") {
      vatBreakdown.vat19.base += base;
      vatBreakdown.vat19.vat += vat;
    } else if (r.vatRate === "REDUCED_5") {
      vatBreakdown.vat5.base += base;
      vatBreakdown.vat5.vat += vat;
    } else if (r.vatRate === "ZERO") {
      vatBreakdown.vat0.base += base;
      vatBreakdown.vat0.vat += vat;
    } else {
      vatBreakdown.other.base += base;
      vatBreakdown.other.vat += vat;
    }
  }

  // Round all numbers to 2 decimals
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    receiptsCount: receipts.length,
    totalAmount: round(totalAmount),
    cashAmount: round(cashAmount),
    cardAmount: round(cardAmount),
    transferAmount: round(transferAmount),
    vatBreakdown: {
      vat23: { base: round(vatBreakdown.vat23.base), vat: round(vatBreakdown.vat23.vat) },
      vat19: { base: round(vatBreakdown.vat19.base), vat: round(vatBreakdown.vat19.vat) },
      vat5: { base: round(vatBreakdown.vat5.base), vat: round(vatBreakdown.vat5.vat) },
      vat0: { base: round(vatBreakdown.vat0.base), vat: round(vatBreakdown.vat0.vat) },
      other: { base: round(vatBreakdown.other.base), vat: round(vatBreakdown.other.vat) },
    },
  };
}

export async function createDailyClosure(db: Database, params: {
  practiceId: string;
  dateStr: string;
  userId?: string;
}) {
  const existing = await db.query.ekasaDailyClosures.findFirst({
    where: and(
      eq(ekasaDailyClosures.practiceId, params.practiceId),
      eq(ekasaDailyClosures.date, params.dateStr),
      isNull(ekasaDailyClosures.deletedAt)
    ),
  });

  if (existing) {
    return existing;
  }

  const summary = await computeDailySummary(db, params.practiceId, params.dateStr);
  const closureNumber = await generateClosureNumber(db, params.practiceId, params.dateStr);

  const [closure] = await db
    .insert(ekasaDailyClosures)
    .values({
      practiceId: params.practiceId,
      closureNumber,
      date: params.dateStr,
      closedBy: params.userId ?? null,
      receiptsCount: summary.receiptsCount.toString(),
      totalAmount: summary.totalAmount.toFixed(2),
      cashAmount: summary.cashAmount.toFixed(2),
      cardAmount: summary.cardAmount.toFixed(2),
      transferAmount: summary.transferAmount.toFixed(2),
      vatBreakdown: summary.vatBreakdown,
      status: "CLOSED",
    })
    .returning();

  return closure;
}
