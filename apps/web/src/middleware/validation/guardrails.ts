/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Clinical guardrails enforced on top of plain JSON schema validation:
 *
 * 1. `ai-draft-only` (Zákon 39/2007 Z. z. o veterinárnej starostlivosti):
 *    AI-generated content must remain in draft state until a veterinarian
 *    signs it. Any AI-originated payload that already carries a signed /
 *    final lifecycle state is rejected.
 *
 * 2. `narcotic-zero-ai-prefill` (Zákon 139/1998 Z. z. o omamných látkach):
 *    ZERO AI prefill for ketamine, opioids and propofol. These substances
 *    accept manual entry only; the UI must surface them with a ShieldAlert.
 *
 * 3. `sympathy-gate`: when the patient is deceased, automated reminders and
 *    outreach are suppressed — no care-reminder automation may be scheduled
 *    and no AI reminder suggestion may be produced.
 */

import type {
  ContractDescriptor,
  GuardrailCode,
  ValidationIssue,
} from "./types";

/** Origin sources that count as machine-generated. */
const AI_ORIGIN_SOURCES = new Set([
  "ai",
  "ai-prefill",
  "ai_prefill",
  "aiprefill",
  "copilot",
  "autofill",
  "auto-fill",
]);

/** Lifecycle states that mean "already signed/final" — forbidden for AI content. */
const SIGNED_STATES = new Set([
  "signed",
  "final",
  "approved",
  "issued",
  "active",
  "completed",
]);

/**
 * Canonical narcotic groups and their SK/EN aliases (Zákon 139/1998 Z. z.).
 * Matching is diacritic- and case-insensitive on word boundaries.
 */
export const NARCOTIC_ALIAS_GROUPS: ReadonlyArray<{
  group: "ketamine" | "opioids" | "propofol";
  aliases: readonly string[];
}> = [
  { group: "ketamine", aliases: ["ketamine", "ketamin", "ketamín"] },
  { group: "propofol", aliases: ["propofol"] },
  {
    group: "opioids",
    aliases: [
      "morphine",
      "morfin",
      "morfín",
      "fentanyl",
      "sufentanil",
      "remifentanil",
      "alfentanil",
      "methadone",
      "metadon",
      "metadón",
      "pethidine",
      "petidin",
      "petidín",
      "meperidine",
      "buprenorphine",
      "buprenorfin",
      "buprenorfín",
      "tramadol",
      "oxycodone",
      "oxikodon",
      "oxikodón",
      "hydromorphone",
      "hydromorfon",
      "codeine",
      "kodein",
      "codeín",
      "hydrocodone",
      "hydrokodon",
      "piritramide",
      "tapentadol",
      "butorphanol",
      "nalbuphine",
    ],
  },
];

/** Fold diacritics so `ketamín` matches `ketamin`. */
export function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Escape a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect narcotic substance names inside free text. Returns the canonical
 * group names found (deduplicated). Word-boundary matching prevents false
 * positives such as "ketaminol-like" substrings.
 */
export function findNarcoticMatches(text: string): string[] {
  const folded = foldDiacritics(text.toLowerCase());
  const found = new Set<string>();
  for (const { group, aliases } of NARCOTIC_ALIAS_GROUPS) {
    for (const alias of aliases) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(foldDiacritics(alias.toLowerCase()))}([^a-z0-9]|$)`);
      if (re.test(folded)) {
        found.add(group);
        break;
      }
    }
  }
  return Array.from(found);
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Depth-first walk over every string reachable from `value`. */
export function deepScanStrings(
  value: unknown,
  visit: (text: string, path: string) => void,
  path = "",
  depth = 0,
): void {
  if (depth > 12) return; // defensive bound against cyclic/hostile payloads
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      deepScanStrings(item, visit, `${path}${path ? "." : ""}${index}`, depth + 1),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      deepScanStrings(item, visit, `${path}${path ? "." : ""}${key}`, depth + 1);
    }
  }
}

/** Collect every `origin.source` value reachable from the payload. */
function collectOriginSources(value: unknown, depth = 0): string[] {
  if (depth > 12 || value === null || typeof value !== "object") return [];
  const sources: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) sources.push(...collectOriginSources(item, depth + 1));
    return sources;
  }
  const record = value as UnknownRecord;
  const origin = record.origin;
  if (isRecord(origin) && typeof origin.source === "string") {
    sources.push(origin.source.toLowerCase());
  }
  for (const [key, item] of Object.entries(record)) {
    if (key === "origin") continue;
    if (typeof item === "object" && item !== null) {
      sources.push(...collectOriginSources(item, depth + 1));
    }
  }
  return sources;
}

/** True when any origin marker in the payload identifies machine generation. */
export function hasAiOrigin(payload: unknown): boolean {
  return collectOriginSources(payload).some((source) =>
    AI_ORIGIN_SOURCES.has(source),
  );
}

/** True when the payload declares the patient as deceased. */
export function isPatientDeceased(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    typeof payload.patientStatus === "string" &&
    payload.patientStatus.toLowerCase() === "deceased"
  );
}

function fieldFor(payload: unknown, preferred: string): string {
  if (isRecord(payload) && preferred in payload) return preferred;
  return preferred;
}

/**
 * Evaluate all guardrails declared by `contract` against `payload`.
 * Returns normalized issues; an empty array means all guardrails passed.
 */
export function evaluateGuardrails(
  contract: ContractDescriptor,
  payload: unknown,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const declared = new Set<GuardrailCode>(contract.guardrails);

  if (declared.has("ai-draft-only") && hasAiOrigin(payload)) {
    if (isRecord(payload)) {
      const status =
        typeof payload.status === "string"
          ? payload.status.toLowerCase()
          : undefined;
      if (status && SIGNED_STATES.has(status)) {
        issues.push({
          field: fieldFor(payload, "status"),
          code: "guardrail.ai_draft_only",
          messageKey: "schemaValidation.error.aiDraftOnly",
          params: { contract: contract.id, status },
          guardrail: "ai-draft-only",
        });
      }
    }
  }

  if (declared.has("narcotic-zero-ai-prefill") && hasAiOrigin(payload)) {
    const groups = new Set<string>();
    deepScanStrings(payload, (text) => {
      for (const group of findNarcoticMatches(text)) groups.add(group);
    });
    if (groups.size > 0) {
      issues.push({
        field: "origin.source",
        code: "guardrail.narcotic_ai_prefill",
        messageKey: "schemaValidation.error.narcoticAiPrefill",
        params: { substances: Array.from(groups).join(", ") },
        guardrail: "narcotic-zero-ai-prefill",
      });
    }
  }

  if (declared.has("sympathy-gate") && isPatientDeceased(payload)) {
    if (isRecord(payload)) {
      const automated = payload.automated === true;
      const channels = Array.isArray(payload.channels)
        ? (payload.channels as unknown[]).length > 0
        : false;
      const isReminderSuggestion =
        typeof payload.suggestionType === "string" &&
        payload.suggestionType === "care_reminder";

      if (automated || channels || isReminderSuggestion) {
        issues.push({
          field: "patientStatus",
          code: "guardrail.sympathy_gate",
          messageKey: "schemaValidation.error.sympathyGate",
          params: { contract: contract.id },
          guardrail: "sympathy-gate",
        });
      }
    }
  }

  return issues;
}
