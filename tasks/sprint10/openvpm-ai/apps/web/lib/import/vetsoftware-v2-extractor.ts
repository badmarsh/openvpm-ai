import * as FirebirdModule from "node-firebird";
import iconv from "iconv-lite";
import {
  normalizeSlovakSex,
  normalizeSlovakSpecies,
} from "./vetsoftware-v2-adapter";

const Firebird = (FirebirdModule as any).default || FirebirdModule;

export interface FirebirdOptions {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  pageSize?: number;
  lowercase_keys?: boolean;
  role?: string;
  blob_as_text?: boolean;
  charset?: string;
}

export interface FirebirdDatabase {
  detach(callback?: (err: any) => void): void;
  query(sql: string, params: any[], callback: (err: any, result: any[]) => void): void;
  query(sql: string, callback: (err: any, result: any[]) => void): void;
}

export const DEFAULT_FIREBIRD_OPTIONS: FirebirdOptions = {
  host: process.env.V2_FIREBIRD_HOST || "127.0.0.1",
  port: Number(process.env.V2_FIREBIRD_PORT) || 3050,
  database: process.env.V2_FIREBIRD_DATABASE || "/firebird/data/V2DATA.FDB",
  user: process.env.V2_FIREBIRD_USER || "SYSDBA",
  password: process.env.V2_FIREBIRD_PASSWORD || "masterkey",
  pageSize: 4096,
  lowercase_keys: false,
  charset: "WIN1250",
};

/**
 * Decodes Windows-1250 bytes or strings to trimmed UTF-8 string
 */
export function decodeWin1250(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Buffer.isBuffer(val)) {
    return iconv.decode(val, "win1250").trim();
  }
  if (typeof val === "string") {
    return val.trim();
  }
  return String(val).trim();
}

/**
 * Safely reads a Firebird TEXT BLOB via event emitter stream with timeout protection
 */
export function readTextBlob(blob: unknown, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    if (!blob || typeof blob !== "function") {
      return resolve(decodeWin1250(blob));
    }
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve("");
      }
    }, timeoutMs);

    try {
      (blob as any)((err: unknown, _name: unknown, emitter: any) => {
        if (err || !emitter) {
          clearTimeout(timer);
          finished = true;
          return resolve("");
        }
        const chunks: Buffer[] = [];
        emitter.on("data", (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        emitter.on("end", () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            const full = Buffer.concat(chunks);
            resolve(iconv.decode(full, "win1250").trim());
          }
        });
        emitter.on("error", () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve("");
          }
        });
      });
    } catch {
      clearTimeout(timer);
      finished = true;
      resolve("");
    }
  });
}

/**
 * Safely reads a Firebird BINARY BLOB (image/document) with timeout protection
 */
export function readBinaryBlob(blob: unknown, timeoutMs = 20000): Promise<Buffer | null> {
  return new Promise((resolve) => {
    if (!blob || typeof blob !== "function") {
      if (Buffer.isBuffer(blob)) return resolve(blob);
      return resolve(null);
    }
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      (blob as any)((err: unknown, _name: unknown, emitter: any) => {
        if (err || !emitter) {
          clearTimeout(timer);
          finished = true;
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        emitter.on("data", (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        emitter.on("end", () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
          }
        });
        emitter.on("error", () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve(null);
          }
        });
      });
    } catch {
      clearTimeout(timer);
      finished = true;
      resolve(null);
    }
  });
}

/**
 * Bulletproof Sympathy Gate check:
 * - Checks VYRAZEN === 'A' with trimming
 * - Checks ZEMREL != null with isNaN protection and sentinel year 2999 check (< 2100)
 */
export function isPatientDeceased(row: {
  ZEMREL?: Date | string | null;
  VYRAZEN?: string | null;
}): boolean {
  if (row.VYRAZEN && String(row.VYRAZEN).trim() === "A") {
    return true;
  }
  if (!row.ZEMREL) {
    return false;
  }
  const d = new Date(row.ZEMREL);
  const year = d.getFullYear();
  if (isNaN(year)) {
    return false;
  }
  return year < 2100;
}

/**
 * Parses VetSoftware address fields (MESTO_K = street, BANKA_K = city + zip)
 */
export function parseBankaK(raw: string): { city: string; zip: string | null } {
  const cleaned = raw.trim();
  if (!cleaned) return { city: "", zip: null };

  // Example: "979 01" (ZIP only)
  const zipOnly = cleaned.match(/^(\d{3}\s?\d{2})$/);
  if (zipOnly) {
    return {
      city: "",
      zip: zipOnly[1].replace(/\s+/g, ""),
    };
  }

  // Example: "979 01 Rimavská Sobota" or "97901 Rimavská Sobota"
  const zipFirst = cleaned.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  if (zipFirst) {
    return {
      zip: zipFirst[1].replace(/\s+/g, ""),
      city: zipFirst[2].trim(),
    };
  }

  // Example: "Rimavská Sobota 979 01" or "Rimavská Sobota 97901"
  const zipLast = cleaned.match(/^(.+?)\s+(\d{3}\s?\d{2})$/);
  if (zipLast) {
    return {
      city: zipLast[1].trim(),
      zip: zipLast[2].replace(/\s+/g, ""),
    };
  }

  return { city: cleaned, zip: null };
}

export interface V2SourceStats {
  connected: boolean;
  databasePath: string;
  clientsCount: number;
  patientsCount: number;
  deceasedPatientsCount: number;
  activePatientsCount: number;
  vaccinationsCount: number;
  soapNotesCount: number;
  attachmentsCount: number;
  financialDocsCount: number;
  error?: string;
}

/**
 * Attaches to Firebird and executes a query, detaching cleanly
 */
export function withFirebird<T>(
  action: (db: FirebirdDatabase) => Promise<T>,
  customOptions?: FirebirdOptions,
): Promise<T> {
  const opts = customOptions || DEFAULT_FIREBIRD_OPTIONS;
  return new Promise<T>((resolve, reject) => {
    Firebird.attach(opts, async (err: any, db: any) => {
      if (err) return reject(err);
      try {
        const result = await action(db);
        db.detach();
        resolve(result);
      } catch (actionErr) {
        db.detach();
        reject(actionErr);
      }
    });
  });
}

/**
 * Query helper returning a typed array
 */
export function fbQuery<T = any>(db: FirebirdDatabase, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.query(sql, params, (err: any, res: any) => {
      if (err) return reject(err);
      resolve((res || []) as T[]);
    });
  });
}

/**
 * Fetches stats across all 7 data categories from V2DATA.FDB
 */
export async function getV2DatabaseStats(customOptions?: FirebirdOptions): Promise<V2SourceStats> {
  try {
    return await withFirebird(async (db) => {
      const clientRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB005 WHERE KOD_KADO > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)");
      const patientRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)");
      const deceasedRows = await fbQuery(
        db,
        "SELECT COUNT(*) AS CNT FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) AND ((ZEMREL IS NOT NULL AND EXTRACT(YEAR FROM ZEMREL) < 2100) OR VYRAZEN = 'A')",
      );
      const vacRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB018 WHERE KP42 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)");
      const visitRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)");
      const attRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB058 WHERE VYMAZ = 0 OR VYMAZ IS NULL");
      const finRows = await fbQuery(db, "SELECT COUNT(*) AS CNT FROM TAB060 WHERE (VYMAZ = 0 OR VYMAZ IS NULL)");

      const totalPatients = patientRows[0]?.CNT ?? 0;
      const deceased = deceasedRows[0]?.CNT ?? 0;

      return {
        connected: true,
        databasePath: customOptions?.database || DEFAULT_FIREBIRD_OPTIONS.database || "/firebird/data/V2DATA.FDB",
        clientsCount: clientRows[0]?.CNT ?? 0,
        patientsCount: totalPatients,
        deceasedPatientsCount: deceased,
        activePatientsCount: totalPatients - deceased,
        vaccinationsCount: vacRows[0]?.CNT ?? 0,
        soapNotesCount: visitRows[0]?.CNT ?? 0,
        attachmentsCount: attRows[0]?.CNT ?? 0,
        financialDocsCount: finRows[0]?.CNT ?? 0,
      };
    }, customOptions);
  } catch (err: any) {
    return {
      connected: false,
      databasePath: customOptions?.database || DEFAULT_FIREBIRD_OPTIONS.database || "/firebird/data/V2DATA.FDB",
      clientsCount: 0,
      patientsCount: 0,
      deceasedPatientsCount: 0,
      activePatientsCount: 0,
      vaccinationsCount: 0,
      soapNotesCount: 0,
      attachmentsCount: 0,
      financialDocsCount: 0,
      error: err?.message || String(err),
    };
  }
}

/**
 * Loads lookup dictionaries: species, sexes, breeds, vaccine types
 */
export async function loadV2Lookups(db: FirebirdDatabase) {
  const speciesRaw = await fbQuery<{ ID_ZVIRE: number; NAZEV: any }>(db, "SELECT ID_ZVIRE, NAZEV FROM TAB008");
  const sexRaw = await fbQuery<{ ID_POHLAVI: number; NAZEV: any }>(db, "SELECT ID_POHLAVI, NAZEV FROM TAB007");
  const breedRaw = await fbQuery<{ ID_RASA: number; NAZEV: any }>(db, "SELECT ID_RASA, NAZEV FROM TAB009");
  const vacTypesRaw = await fbQuery<{ KOD_VAKCIN: number; NAZEV_VAKCIN: any }>(db, "SELECT KOD_VAKCIN, NAZEV_VAKCIN FROM TAB033");

  const speciesMap = new Map<number, string>();
  speciesRaw.forEach((r) => speciesMap.set(r.ID_ZVIRE, decodeWin1250(r.NAZEV)));

  const sexMap = new Map<number, string>();
  sexRaw.forEach((r) => sexMap.set(r.ID_POHLAVI, decodeWin1250(r.NAZEV)));

  const breedMap = new Map<number, string>();
  breedRaw.forEach((r) => breedMap.set(r.ID_RASA, decodeWin1250(r.NAZEV)));

  const vacTypeMap = new Map<number, string>();
  vacTypesRaw.forEach((r) => vacTypeMap.set(r.KOD_VAKCIN, decodeWin1250(r.NAZEV_VAKCIN)));

  return { speciesMap, sexMap, breedMap, vacTypeMap };
}
