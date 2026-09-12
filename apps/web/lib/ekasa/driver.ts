/**
 * OpenVPM AI — Slovak Fiscal Driver Abstraction
 *
 * Supports switching between:
 * 1. EMULATION (Pilot / Dev mode — software HMAC/OKP calculation)
 * 2. FISKALPRO (Certified POS / e-Kasa terminal over TCP/REST, port 8080/8443)
 * 3. VRP2      (Finančná správa SR Virtual Registration Cashier cloud API)
 * 4. ELCOM     (Elcom Euro-50/150 fiscal printers over a POS REST server)
 *
 * Každý produkčný driver vracia okrem UID/OKP/PKP aj `FiscalStatus` — čítanie
 * stavu tlačiarne (papier), pamäte CHDU (fiškálna pamäť) a spojenia s
 * Finančnou správou SR. Toto je nevyhnutné pre 48-hodinový offline núdzový
 * režim podľa Zákona č. 289/2008 Z. z.
 *
 * DÔLEŽITÉ: Drivery komunikujú len s lokálnymi / povolenými endpointmi
 * (LAN adresy terminálov, cloud VRP2 API). SSRF ochrana pre externé URL je
 * v lib/ekasa/fiscal.ts (isAllowedEkasaApiUrl).
 */

import { EkasaReceiptInput, EkasaApiResponse } from "./service";

export type FiscalDriverType =
  | "EMULATION"
  | "FISKALPRO"
  | "VRP2"
  | "ELCOM";

export interface FiscalDriverSettings {
  driverType: FiscalDriverType;
  endpointUrl?: string; // e.g. "http://192.168.1.150:8080/api/v1"
  deviceIdentifier?: string; // Terminal ID / COM port / POS server id
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

/**
 * Stav fiškálneho zariadenia. Všetky polia sú voliteľné — emulácia nemá čo
 * merať, ale produkčné drivery musia reportovať papier, CHDU pamäť a spojenie.
 */
export interface FiscalStatus {
  ok: boolean;
  driverType: FiscalDriverType;
  /** Tlačiareň má papier a je pripravená tlačiť. */
  paperOk?: boolean;
  /** Fiškálna pamäť (CHDU) je funkčná a má voľnú kapacitu. */
  chduMemoryOk?: boolean;
  /** Spojenie s portálom Finančnej správy SR. */
  fsConnection?: boolean;
  message: string;
}

export interface FiscalDriver {
  type: FiscalDriverType;
  printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult>;
  ping(): Promise<{ ok: boolean; status: string }>;
  getStatus(): Promise<FiscalStatus>;
}

/**
 * 1. Emulation Driver (Default Pilot / Software Mock)
 */
export class EmulationDriver implements FiscalDriver {
  type: FiscalDriverType = "EMULATION";

  async ping(): Promise<{ ok: boolean; status: string }> {
    return { ok: true, status: "Emulation driver ready" };
  }

  async getStatus(): Promise<FiscalStatus> {
    return {
      ok: true,
      driverType: "EMULATION",
      paperOk: true,
      chduMemoryOk: true,
      fsConnection: true,
      message: "Emulácia — bez fyzického zariadenia",
    };
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
 * 2. FiskalPRO Driver (TCP/REST API pre FiskalPRO terminály / Android / e-Kasa Box)
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

  private headers(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  async ping(): Promise<{ ok: boolean; status: string }> {
    try {
      const res = await fetch(`${this.endpoint}/status`, {
        headers: this.headers(),
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

  async getStatus(): Promise<FiscalStatus> {
    try {
      const res = await fetch(`${this.endpoint}/status`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return {
          ok: false,
          driverType: "FISKALPRO",
          message: `FiskalPRO returned HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        paper?: boolean;
        chdu?: boolean;
        fs?: boolean;
      };
      return {
        ok: true,
        driverType: "FISKALPRO",
        paperOk: data.paper,
        chduMemoryOk: data.chdu,
        fsConnection: data.fs,
        message: "FiskalPRO terminal connected",
      };
    } catch (err) {
      return {
        ok: false,
        driverType: "FISKALPRO",
        message: `FiskalPRO status failed: ${err instanceof Error ? err.message : "Offline"}`,
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
          ...this.headers(),
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
 * 3. VRP2 Driver — Finančná správa SR "Virtuálna registračná pokladnica 2"
 * Cloudové API FS SR pre e-Kasa klienta bez lokálnej pokladnice.
 */
export class Vrp2Driver implements FiscalDriver {
  type: FiscalDriverType = "VRP2";
  private endpoint: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(settings: FiscalDriverSettings) {
    this.endpoint =
      settings.endpointUrl || "https://ekasa.financnasprava.sk/vrp2/api";
    this.apiKey = settings.apiKey;
    this.timeoutMs = settings.timeoutMs || 10000;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  async ping(): Promise<{ ok: boolean; status: string }> {
    try {
      const res = await fetch(`${this.endpoint}/health`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok
        ? { ok: true, status: "VRP2 cloud service reachable" }
        : { ok: false, status: `VRP2 returned HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        status: `VRP2 connection failed: ${err instanceof Error ? err.message : "Offline"}`,
      };
    }
  }

  async getStatus(): Promise<FiscalStatus> {
    const ping = await this.ping();
    return {
      ok: ping.ok,
      driverType: "VRP2",
      paperOk: undefined, // cloudová pokladnica — tlač rieši lokálna tlačiareň
      chduMemoryOk: undefined,
      fsConnection: ping.ok,
      message: ping.status,
    };
  }

  async printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult> {
    const vrpPayload = {
      dic: payload.dic,
      icDph: undefined,
      pokladnicaId: payload.pokladnicaId,
      receipt: {
        number: payload.receiptNumber,
        issuedAt: payload.issuedAt.toISOString(),
        total: parseFloat(payload.amountTotal),
        base: parseFloat(payload.amountBase),
        vat: parseFloat(payload.amountVat),
        paymentMethod: payload.paymentMethod,
        items: payload.items.map((i) => ({
          name: i.name,
          quantity: i.qty,
          unitPrice: parseFloat(i.unitPrice),
          vatRate: i.vatRate,
        })),
      },
    };

    try {
      const res = await fetch(`${this.endpoint}/receipts`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(vrpPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          driverType: "VRP2",
          receiptNumber: payload.receiptNumber,
          error: `VRP2 error (${res.status}): ${errText}`,
        };
      }

      const data = (await res.json()) as {
        uid?: string;
        okp?: string;
        pkp?: string;
      };
      return {
        success: true,
        driverType: "VRP2",
        receiptNumber: payload.receiptNumber,
        uid: data.uid,
        okp: data.okp,
        pkp: data.pkp,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        driverType: "VRP2",
        receiptNumber: payload.receiptNumber,
        error: `VRP2 communication error: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  }
}

/**
 * 4. Elcom Driver — Elcom Euro-50/150 fiškálne tlačiarne cez POS REST server.
 * POS server beží lokálne (serial-to-REST bridge) a prekláda JSON na protokol
 * Elcom tlačiarne.
 */
export class ElcomDriver implements FiscalDriver {
  type: FiscalDriverType = "ELCOM";
  private endpoint: string;
  private deviceIdentifier?: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(settings: FiscalDriverSettings) {
    this.endpoint = settings.endpointUrl || "http://127.0.0.1:9000/api/v1";
    this.deviceIdentifier = settings.deviceIdentifier;
    this.apiKey = settings.apiKey;
    this.timeoutMs = settings.timeoutMs || 10000;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  async ping(): Promise<{ ok: boolean; status: string }> {
    try {
      const res = await fetch(`${this.endpoint}/status`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok
        ? { ok: true, status: "Elcom POS server connected" }
        : { ok: false, status: `Elcom returned HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        status: `Elcom connection failed: ${err instanceof Error ? err.message : "Offline"}`,
      };
    }
  }

  async getStatus(): Promise<FiscalStatus> {
    try {
      const res = await fetch(`${this.endpoint}/status`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return {
          ok: false,
          driverType: "ELCOM",
          message: `Elcom returned HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        paper?: boolean;
        chdu?: boolean;
        fs?: boolean;
      };
      return {
        ok: true,
        driverType: "ELCOM",
        paperOk: data.paper,
        chduMemoryOk: data.chdu,
        fsConnection: data.fs,
        message: "Elcom Euro-50/150 ready",
      };
    } catch (err) {
      return {
        ok: false,
        driverType: "ELCOM",
        message: `Elcom status failed: ${err instanceof Error ? err.message : "Offline"}`,
      };
    }
  }

  async printReceipt(payload: FiscalReceiptPayload): Promise<FiscalPrintResult> {
    const elcomPayload = {
      device: this.deviceIdentifier,
      operation: "print_fiscal_receipt",
      receiptNumber: payload.receiptNumber,
      dic: payload.dic,
      pokladnicaId: payload.pokladnicaId,
      paymentMethod: payload.paymentMethod,
      totalAmount: parseFloat(payload.amountTotal),
      items: payload.items.map((i) => ({
        name: i.name,
        quantity: i.qty,
        unitPrice: parseFloat(i.unitPrice),
        vatRate: i.vatRate,
      })),
    };

    try {
      const res = await fetch(`${this.endpoint}/receipt`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(elcomPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          driverType: "ELCOM",
          receiptNumber: payload.receiptNumber,
          error: `Elcom error (${res.status}): ${errText}`,
        };
      }

      const data = (await res.json()) as { uid?: string; okp?: string; pkp?: string };
      return {
        success: true,
        driverType: "ELCOM",
        receiptNumber: payload.receiptNumber,
        uid: data.uid,
        okp: data.okp,
        pkp: data.pkp,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        driverType: "ELCOM",
        receiptNumber: payload.receiptNumber,
        error: `Elcom communication timeout or error: ${err instanceof Error ? err.message : "Unknown"}`,
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
  if (settings.driverType === "VRP2") {
    return new Vrp2Driver(settings);
  }
  if (settings.driverType === "ELCOM") {
    return new ElcomDriver(settings);
  }
  // Fallback to emulation for unimplemented hardware
  return new EmulationDriver();
}
