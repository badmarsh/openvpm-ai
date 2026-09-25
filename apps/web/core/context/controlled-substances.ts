/**
 * VPM Context Layer — Controlled Substances Gate (Zákon 139/1998 Z. z.).
 *
 * ZERO AI prefill for ketamine, opioids, propofol and related Schedule
 * substances. Detection is pure and shared so every AI surface (voice,
 * SOAP draft, prescriptions, field visits) evaluates the same patterns.
 *
 * Re-exports / mirrors the canonical regex from
 * `@/lib/controlled-substances/policy` so the context layer stays the
 * single cross-module entry point without creating a circular dependency
 * on React hooks.
 */

/**
 * Slovak Statutory Compliance: Zákon č. 139/1998 Z. z.
 * Pattern source kept in lock-step with
 * `apps/web/lib/controlled-substances/policy.ts`.
 */
export const VPM_CONTROLLED_SUBSTANCES_PATTERN_SOURCE =
  "ketam[ií]n|ketamidor|ketalar|narkamon|calypsol|fentan[yí]l|buprenorf[ií]n|temgesic|vetergesic|bupredyne|butorfanol|butorphanol|torbugesic|dolorex|metad[oó]n|methadon|metisedive|comfortion|diazepam|apauvi|seduxen|fenobarbital|phenobarbital|phenoleptil|propofol|morfin|morphin";

export const VPM_CONTROLLED_SUBSTANCES_REGEX = new RegExp(
  VPM_CONTROLLED_SUBSTANCES_PATTERN_SOURCE,
  "i",
);

/** i18n key for the ShieldAlert banner when AI prefill is blocked. */
export const VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY =
  "vpmContext.gates.controlledSubstanceZeroPrefill";

/**
 * Normalize drug names before regex match (strip combining marks / ZWSP).
 * Mirrors `isControlledSubstanceName` in policy.ts.
 */
export function normalizeDrugNameForMatch(drugName: string): string {
  return drugName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .trim();
}

export function isVpmControlledSubstanceName(drugName: string): boolean {
  if (!drugName) return false;
  return VPM_CONTROLLED_SUBSTANCES_REGEX.test(
    normalizeDrugNameForMatch(drugName),
  );
}

/**
 * Scan free-text or discrete medication fields for controlled substances.
 * Returns the original snippets that matched (for UI banners).
 */
export function detectControlledSubstancesInText(
  ...parts: Array<string | null | undefined>
): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (typeof part !== "string") continue;
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Split on common separators so multi-drug plans are scanned piece-wise.
    const tokens = trimmed.split(/[,;\n|/]+/).map((t) => t.trim()).filter(Boolean);
    const candidates = tokens.length > 0 ? tokens : [trimmed];

    for (const candidate of candidates) {
      if (!isVpmControlledSubstanceName(candidate)) continue;
      const key = normalizeDrugNameForMatch(candidate).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(candidate);
    }

    // Also test the whole string (e.g. "podaný ketamín 5 mg/kg").
    if (isVpmControlledSubstanceName(trimmed)) {
      const key = normalizeDrugNameForMatch(trimmed).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        hits.push(trimmed.slice(0, 120));
      }
    }
  }

  return hits;
}

/**
 * AI prefill policy: when any controlled substance is detected, the
 * proposed value must be blanked and the clinician enters it manually
 * (ShieldAlert UI). Returns null when prefill is forbidden.
 */
export function applyZeroAiPrefillForControlledSubstance<T>(
  proposed: T,
  drugNameOrText: string | null | undefined,
): T | null {
  if (typeof drugNameOrText === "string" && isVpmControlledSubstanceName(drugNameOrText)) {
    return null;
  }
  return proposed;
}

/**
 * Filter a list of AI-proposed medication lines, dropping any that match
 * the controlled-substance gate. Surviving lines keep their original shape.
 */
export function stripControlledSubstancePrefills<T extends { name?: string | null; medicationName?: string | null; text?: string | null }>(
  items: readonly T[],
): { safe: T[]; blocked: T[] } {
  const safe: T[] = [];
  const blocked: T[] = [];
  for (const item of items) {
    const label = item.name ?? item.medicationName ?? item.text ?? "";
    if (isVpmControlledSubstanceName(label)) {
      blocked.push(item);
    } else {
      safe.push(item);
    }
  }
  return { safe, blocked };
}
