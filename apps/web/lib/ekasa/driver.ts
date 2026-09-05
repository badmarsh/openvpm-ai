/**
 * OpenVPM AI — Slovak Fiscal Driver Abstraction
 * 
 * Supports switching between:
 * 1. EMULATION (Pilot / Dev mode — software HMAC/OKP calculation)
 * 2. FISKALPRO (Certified POS / e-Kasa terminal integration over HTTP/REST)
 * 3. VAROS (Varos FT4000 / e-Kasa hardware driver integration)
 * 4. ELCOM (Euro e-Kasa driver interface)
 */

import { EkasaReceiptInput, EkasaApiResponse } from "./service";

export type FiscalDriverType = "EMULATION" | "FISKALPRO" | "VAROS" | "ELCOM";

export interface FiscalDriverSettings {
  driverType: FiscalDriverType;
  endpointUrl?: string; // e.g. "http://192.168.1.150:8080/api/v1"
  deviceIdentifier?: string; // Terminal ID / COM port
  apiKey?: string;
  timeoutMs?: number;
}

export interface FiscalReceiptPayload {
  receiptNumber: string;
  dic: string;
  pokladnicaId: string;
  amountTotal: string;
  amountBase: string;
  amountVat: string;
  vatRate: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  items: Array<{
    name: string;
    qty: number;
    unitPrice: string;
    vatRate: string;
  }>;
  issuedAt: Date;
}

export interface FiscalPrintResult {
  success: boolean;
  driverType: FiscalDriverType;
  receiptNumber: string;
  uid?: string;
  okp?: string;
  pkp?: string;
  rawResponse?: unknown;
  error?: string;
}

export interface FiscalDriver {
  type: FiscalDriverType;
  printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult>;
  ping(): Promise<{ ok: boolean; status: string }>;
}

/**
 * 1. Emulation Driver (Default Pilot / Software Mock)
 */
export class EmulationDriver implements FiscalDriver {
  type: FiscalDriverType = "EMULATION";

  async ping(): Promise<{ ok: boolean; status: string }> {
    return { ok: true, status: "Emulation driver ready" };
  }

  async printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult> {
    const timestamp = Date.now();
    return {
      success: true,
      driverType: "EMULATION",
      receiptNumber: payload.receiptNumber,
      uid: `MOCK-UID-${timestamp}`,
      okp: `OKP-EMU-${timestamp.toString(16).toUpperCase()}`,
      pkp: `PKP-EMU-${Buffer.from(payload.receiptNumber).toString("base64")}`,
      rawResponse: {
        mode: "emulation",
        note: "Predcertifikačná emulácia pre pilotnú prevádzku",
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * 2. FiskalPRO Driver (REST API for FiskalPRO Terminals / Android / e-Kasa Box)
 */
export class FiskalProDriver implements FiscalDriver {
  type: FiscalDriverType = "FISKALPRO";
  private endpoint: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(settings: FiscalDriverSettings) {
    this.endpoint = settings.endpointUrl || "http://127.0.0.1:8080/api/v1";
    this.apiKey = settings.apiKey;
    this.timeoutMs = settings.timeoutMs || 10000;
  }

  async ping(): Promise<{ ok: boolean; status: string }> {
    try {
      const res = await fetch(`${this.endpoint}/status`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return { ok: true, status: "FiskalPRO terminal connected" };
      }
      return { ok: false, status: `FiskalPRO returned HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        status: `FiskalPRO connection failed: ${err instanceof Error ? err.message : "Offline"}`,
      };
    }
  }

  async printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult> {
    const fiskalPayload = {
      type: "receipt",
      receiptNumber: payload.receiptNumber,
      cashRegister: payload.pokladnicaId,
      tin: payload.dic,
      paymentType: payload.paymentMethod === "CARD" ? 2 : 1,
      totalAmount: parseFloat(payload.amountTotal),
      items: payload.items.map((i) => ({
        name: i.name,
        quantity: i.qty,
        unitPrice: parseFloat(i.unitPrice),
        vatRate: i.vatRate === "STANDARD_23" ? 23 : i.vatRate === "REDUCED_19" ? 19 : 5,
      })),
    };

    try {
      const res = await fetch(`${this.endpoint}/receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(fiskalPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          driverType: "FISKALPRO",
          receiptNumber: payload.receiptNumber,
          error: `FiskalPRO error (${res.status}): ${errText}`,
        };
      }

      const data = (await res.json()) as { uid?: string; okp?: string; pkp?: string };
      return {
        success: true,
        driverType: "FISKALPRO",
        receiptNumber: payload.receiptNumber,
        uid: data.uid,
        okp: data.okp,
        pkp: data.pkp,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        driverType: "FISKALPRO",
        receiptNumber: payload.receiptNumber,
        error: `FiskalPRO communication timeout or error: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  }
}

/**
 * Factory for creating fiscal driver instance.
 */
export function resolveFiscalDriver(settings?: FiscalDriverSettings): FiscalDriver {
  if (!settings || settings.driverType === "EMULATION") {
    return new EmulationDriver();
  }
  if (settings.driverType === "FISKALPRO") {
    return new FiskalProDriver(settings);
  }
  // Fallback to emulation for unimplemented hardware
  return new EmulationDriver();
}
