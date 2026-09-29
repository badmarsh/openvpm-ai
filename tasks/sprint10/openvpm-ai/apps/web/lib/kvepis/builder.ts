/**
 * KVEPIS / ÚPVS Submission Builder
 * --------------------------------
 * Generátor zákonného elektronického formulára pre KVEPIS (ŠVPS SR) a ÚPVS
 * GovBox. Vytvára deterministický XML dokument (obálka v štýle GovBox + payload
 * podľa XSD ŠVPS SR) a zodpovedajúcu JSON reprezentáciu, aby sa k podaniu dal
 * vypočítať SHA-256 odtlačok pre integritu (payloadHash v ext_kvepis_submissions).
 *
 * POZNÁMKA KU XSD: Oficiálne XSD ŠVPS SR / ÚPVS sa verzuje. Tento modul generuje
 * štruktúru zdokumentovanú v `docs/slovak-integration-catalog.md` a v
 * `docs/enterprise-trust/*`. Pred produkčným spustením je potrebné pripnúť
 * konkrétnu verziu XSD a prípadne prispôsobiť menný priestor. Metódy tu NEVOLAJÚ
 * sieť a nikdy nepodpisujú — podpis zabezpečuje samostatný krok (D.Signer /
 * cloudová pečať / HSM).
 */

import { createHash } from "node:crypto";
import type { KvepisSubmissionType } from "./validator";

export const KVEPS_NAMESPACE =
  "https://www.svps.sk/kvepis/schemas/submission/v1";

export interface KvepisSubmissionData {
  submissionType: KvepisSubmissionType;
  referenceNumber: string;
  practiceIco: string;
  practiceKvlId?: string | null;
  farmIco?: string | null;
  cehzCode?: string | null;
  earTagNumber?: string | null;
  transponderNumber?: string | null;
  kvlNumber?: string | null;
  animalSpecies?: string | null;
  diagnosis?: string | null;
  medicationName?: string | null;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  administeredAt?: Date | string | null;
  safeUntil?: Date | string | null;
  incidentDate?: Date | string | null;
  incidentDescription?: string | null;
  notes?: string | null;
  /** Extra páry, ktoré sa zapíšu do payloadu tak, ako prídu. */
  extra?: Record<string, unknown>;
}

export interface KvepisBuiltPayload {
  xml: string;
  json: Record<string, unknown>;
  /** SHA-256 hex digest kanonizovaného JSON payloadu. */
  hash: string;
}

// ---------------------------------------------------------------------------
// Pomocné funkcie
// ---------------------------------------------------------------------------

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

/**
 * Kanonizovaný JSON: kľúče zoradené abecedne, dátumy ako ISO 8601 UTC reťazce,
 * null hodnoty vynechané. Slúži ako stabilný vstup pre payloadHash.
 */
export function canonicalJson(data: unknown): string {
  if (data == null) return "null";
  if (typeof data === "string") return JSON.stringify(data);
  if (typeof data === "number" || typeof data === "boolean")
    return JSON.stringify(data);
  if (data instanceof Date) return JSON.stringify(data.toISOString());
  if (Array.isArray(data))
    return `[${data.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(data));
}

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

/** Referenčné číslo podania: KVEPIS-YYYYMMDD-NNNN. */
export function buildReferenceNumber(date: Date, sequence: number): string {
  const iso = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `KVEPIS-${iso}-${String(sequence).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// JSON payload
// ---------------------------------------------------------------------------

export function buildJsonPayload(data: KvepisSubmissionData): Record<string, unknown> {
  const json: Record<string, unknown> = {
    schemaVersion: "1.0",
    submissionType: data.submissionType,
    referenceNumber: data.referenceNumber,
    practice: {
      ico: data.practiceIco,
      kvlId: data.practiceKvlId ?? null,
    },
    subject: {
      farmIco: data.farmIco ?? null,
      cehzCode: data.cehzCode ?? null,
      earTagNumber: data.earTagNumber ?? null,
      transponderNumber: data.transponderNumber ?? null,
      animalSpecies: data.animalSpecies ?? null,
    },
    veterinarian: {
      kvlNumber: data.kvlNumber ?? null,
    },
    clinical: {
      diagnosis: data.diagnosis ?? null,
      medicationName: data.medicationName ?? null,
      meatWithdrawalDays: data.meatWithdrawalDays ?? null,
      milkWithdrawalDays: data.milkWithdrawalDays ?? null,
      administeredAt: toIso(data.administeredAt),
      safeUntil: toIso(data.safeUntil),
    },
    incident: {
      incidentDate: toIso(data.incidentDate),
      incidentDescription: data.incidentDescription ?? null,
    },
    notes: data.notes ?? null,
    ...(data.extra ?? {}),
  };
  return json;
}

// ---------------------------------------------------------------------------
// XML payload (GovBox-style obálka + KVEPIS payload)
// ---------------------------------------------------------------------------

export function buildXmlPayload(data: KvepisSubmissionData): string {
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<kvepis:submission xmlns:kvepis="${KVEPS_NAMESPACE}" ` +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `schemaVersion="1.0" submissionType="${xmlEscape(data.submissionType)}">`
  );

  lines.push(`  <kvepis:header>`);
  lines.push(`    <kvepis:referenceNumber>${xmlEscape(data.referenceNumber)}</kvepis:referenceNumber>`);
  lines.push(`    <kvepis:practiceIco>${xmlEscape(data.practiceIco)}</kvepis:practiceIco>`);
  if (data.practiceKvlId) {
    lines.push(`    <kvepis:practiceKvlId>${xmlEscape(data.practiceKvlId)}</kvepis:practiceKvlId>`);
  }
  lines.push(`  </kvepis:header>`);

  lines.push(`  <kvepis:subject>`);
  if (data.farmIco) lines.push(`    <kvepis:farmIco>${xmlEscape(data.farmIco)}</kvepis:farmIco>`);
  if (data.cehzCode) lines.push(`    <kvepis:cehzCode>${xmlEscape(data.cehzCode)}</kvepis:cehzCode>`);
  if (data.earTagNumber) lines.push(`    <kvepis:earTagNumber>${xmlEscape(data.earTagNumber)}</kvepis:earTagNumber>`);
  if (data.transponderNumber) lines.push(`    <kvepis:transponderNumber>${xmlEscape(data.transponderNumber)}</kvepis:transponderNumber>`);
  if (data.animalSpecies) lines.push(`    <kvepis:animalSpecies>${xmlEscape(data.animalSpecies)}</kvepis:animalSpecies>`);
  lines.push(`  </kvepis:subject>`);

  lines.push(`  <kvepis:veterinarian>`);
  if (data.kvlNumber) lines.push(`    <kvepis:kvlNumber>${xmlEscape(data.kvlNumber)}</kvepis:kvlNumber>`);
  lines.push(`  </kvepis:veterinarian>`);

  lines.push(`  <kvepis:clinical>`);
  if (data.diagnosis) lines.push(`    <kvepis:diagnosis>${xmlEscape(data.diagnosis)}</kvepis:diagnosis>`);
  if (data.medicationName) lines.push(`    <kvepis:medicationName>${xmlEscape(data.medicationName)}</kvepis:medicationName>`);
  if (data.meatWithdrawalDays != null) lines.push(`    <kvepis:meatWithdrawalDays>${data.meatWithdrawalDays}</kvepis:meatWithdrawalDays>`);
  if (data.milkWithdrawalDays != null) lines.push(`    <kvepis:milkWithdrawalDays>${data.milkWithdrawalDays}</kvepis:milkWithdrawalDays>`);
  const administeredAt = toIso(data.administeredAt);
  const safeUntil = toIso(data.safeUntil);
  if (administeredAt) lines.push(`    <kvepis:administeredAt>${xmlEscape(administeredAt)}</kvepis:administeredAt>`);
  if (safeUntil) lines.push(`    <kvepis:safeUntil>${xmlEscape(safeUntil)}</kvepis:safeUntil>`);
  lines.push(`  </kvepis:clinical>`);

  const incidentDate = toDateOnly(data.incidentDate);
  if (incidentDate || data.incidentDescription) {
    lines.push(`  <kvepis:incident>`);
    if (incidentDate) lines.push(`    <kvepis:incidentDate>${xmlEscape(incidentDate)}</kvepis:incidentDate>`);
    if (data.incidentDescription) lines.push(`    <kvepis:incidentDescription>${xmlEscape(data.incidentDescription)}</kvepis:incidentDescription>`);
    lines.push(`  </kvepis:incident>`);
  }

  if (data.notes) {
    lines.push(`  <kvepis:notes>${xmlEscape(data.notes)}</kvepis:notes>`);
  }

  lines.push(`</kvepis:submission>`);
  return lines.join("\n");
}

/** Zostaví kompletný podpisový balíček: XML + JSON + SHA-256 hash. */
export function buildKvepisPayload(
  data: KvepisSubmissionData
): KvepisBuiltPayload {
  const json = buildJsonPayload(data);
  const xml = buildXmlPayload(data);
  return {
    xml,
    json,
    hash: hashPayload(json),
  };
}
