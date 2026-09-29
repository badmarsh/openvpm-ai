/**
 * KVEPIS / ÚPVS Submission Validator
 * ----------------------------------
 * Striktný validačný engine spúšťaný PRED odoslaním podania do KVEPIS (ŠVPS SR).
 *
 * Overuje totožnosť a formátovú správnosť polí, ktoré ŠVPS SR / KVL SR kontroluje
 * pri legislatívnej inšpekcii:
 *   - IČO farmy / chovu (8 číslic, kontrolná číslica ako varovanie),
 *   - CEHZ kód chovu (Centrálna evidencia hospodárskych zvierat),
 *   - číslo ušnej známky (SK + 12 číslic) a transpondéra (ISO 11784, 15 číslic),
 *   - KVL číslo ošetrujúceho veterinárneho lekára,
 *   - správnosť ochrannej lehoty (mäso / mlieko) a diagnózy.
 *
 * Návrh API je čisto funkčný (bez DB a bez I/O), aby bol deterministicky
 * testovateľný a použiteľný aj na klientovi pri live-validácii formulára.
 *
 * DÔLEŽITÉ: Tento modul NESMIE byť jediným miestom, ktoré rozhoduje o platnosti
 * pred odoslaním. Server-side procedúra musí validáciu zopakovať na tom istom
 * vstupe (idempotentné) a podpis/odoslanie vždy vyžaduje ľudské potvrdenie
 * veterinára.
 */

export type KvepisSubmissionType =
  | "rabies_notification"
  | "treatment_diary_batch"
  | "animal_movement"
  | "infectious_disease_alert";

export type KvepisValidationSeverity = "error" | "warning";

export interface KvepisValidationIssue {
  /** Machine-readable field path, e.g. "farmIco", "earTagNumber". */
  field: string;
  severity: KvepisValidationSeverity;
  /** Stable machine-readable code, e.g. "ICO_REQUIRED", "EAR_TAG_FORMAT". */
  code: string;
  /** Human-readable Slovak message. */
  message: string;
  expected?: string;
  actual?: string;
}

export interface KvepisValidationResult {
  /** true práve vtedy, keď neexistuje žiadna chyba severity "error". */
  valid: boolean;
  issues: KvepisValidationIssue[];
}

export interface KvepisValidationInput {
  submissionType: KvepisSubmissionType;
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Formátové validátory (exportované pre samostatné použitie aj testovanie)
// ---------------------------------------------------------------------------

const ICO_RE = /^\d{8}$/;
const EAR_TAG_RE = /^SK\d{12}$/i;
const TRANSPONDER_RE = /^\d{15}$/;
const CEHZ_RE = /^[A-Z0-9]{2}[\- ]?\d{6,9}$/i;

/** IČO: presne 8 číslic. */
export function isValidIco(ico: string | null | undefined): boolean {
  return typeof ico === "string" && ICO_RE.test(ico.trim());
}

/**
 * Kontrolná číslica IČO (slovenské IČO): posledná číslica je zvyšok po delení
 * čísla tvoreného prvými 7 číslicami číslom 11. Zvyšok 10 sa v praxi vyskytuje
 * a je evidovaný — preto je táto kontrola len VAROVANIE, nie blokujúca chyba.
 */
export function icoChecksumValid(ico: string | null | undefined): boolean {
  if (!isValidIco(ico)) return false;
  const digits = ico!.trim();
  const head = Number(digits.slice(0, 7));
  const expected = head % 11;
  return expected === Number(digits[7]);
}

/** CEHZ kód chovu: alfanumerický kód evidenčného systému hospodárskych zvierat. */
export function isValidCehzCode(code: string | null | undefined): boolean {
  return typeof code === "string" && CEHZ_RE.test(code.trim());
}

/** Ušná známka: "SK" + 12 číslic (formát EÚ pre hovädzí dobytok a pod.). */
export function isValidEarTagNumber(tag: string | null | undefined): boolean {
  return typeof tag === "string" && EAR_TAG_RE.test(tag.trim());
}

/** Transpondér / mikročip: 15 číslic podľa ISO 11784. */
export function isValidTransponderNumber(
  chip: string | null | undefined
): boolean {
  return typeof chip === "string" && TRANSPONDER_RE.test(chip.trim());
}

/** KVL číslo veterinárneho lekára: neprázdny identifikátor s rozumnou dĺžkou. */
export function isValidKvlNumber(kvl: string | null | undefined): boolean {
  if (typeof kvl !== "string") return false;
  const trimmed = kvl.trim();
  return trimmed.length >= 2 && trimmed.length <= 64;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Pravidlá podľa typu podania
// ---------------------------------------------------------------------------

/**
 * Povinné polia podľa typu podania. Prázdne pole = nevyžaduje sa pre daný typ.
 * `kvlNumber` je povinné vždy — podanie je viazané na konkrétneho lekára.
 */
export const KVEPS_REQUIRED_FIELDS: Record<KvepisSubmissionType, string[]> = {
  rabies_notification: [
    "kvlNumber",
    "transponderNumber",
    "animalSpecies",
    "incidentDate",
  ],
  treatment_diary_batch: [
    "kvlNumber",
    "farmIco",
    "cehzCode",
    "animalSpecies",
    "diagnosis",
    "administeredAt",
  ],
  animal_movement: [
    "kvlNumber",
    "farmIco",
    "earTagNumber",
    "animalSpecies",
  ],
  infectious_disease_alert: [
    "kvlNumber",
    "farmIco",
    "cehzCode",
    "animalSpecies",
    "diagnosis",
  ],
};

function push(
  issues: KvepisValidationIssue[],
  issue: KvepisValidationIssue
): void {
  issues.push(issue);
}

// ---------------------------------------------------------------------------
// Hlavný validačný engine
// ---------------------------------------------------------------------------

export function validateKvepisSubmission(
  input: KvepisValidationInput
): KvepisValidationResult {
  const issues: KvepisValidationIssue[] = [];
  const type = input.submissionType;
  const required = KVEPS_REQUIRED_FIELDS[type] ?? [];

  for (const field of required) {
    const value = input[field as keyof KvepisValidationInput];
    const present =
      typeof value === "number"
        ? Number.isFinite(value)
        : typeof value === "string"
          ? value.trim().length > 0
          : value instanceof Date
            ? !Number.isNaN(value.getTime())
            : value != null;

    if (!present) {
      push(issues, {
        field,
        severity: "error",
        code: `${field.toUpperCase()}_REQUIRED`,
        message: `Pole "${field}" je pre typ podania "${type}" povinné.`,
      });
    }
  }

  // IČO farmy — povinné pre hospodárske zvieratá; formátová kontrola inak.
  if (input.farmIco != null && input.farmIco.trim() !== "") {
    if (!isValidIco(input.farmIco)) {
      push(issues, {
        field: "farmIco",
        severity: "error",
        code: "ICO_FORMAT",
        message: "IČO farmy musí mať presne 8 číslic (bez medzier a pomlčiek).",
        expected: "8 číslic",
        actual: input.farmIco,
      });
    } else if (!icoChecksumValid(input.farmIco)) {
      push(issues, {
        field: "farmIco",
        severity: "warning",
        code: "ICO_CHECKSUM",
        message:
          "Kontrolná číslica IČO nesedí — overte číslo farmy v registri (CEHZ / ORSR).",
        actual: input.farmIco,
      });
    }
  }

  // CEHZ kód chovu
  if (input.cehzCode != null && input.cehzCode.trim() !== "") {
    if (!isValidCehzCode(input.cehzCode)) {
      push(issues, {
        field: "cehzCode",
        severity: "error",
        code: "CEHZ_FORMAT",
        message: "CEHZ kód chovu má nesprávny formát (napr. SK1234567).",
        expected: "SKxxxxxxx",
        actual: input.cehzCode,
      });
    }
  }

  // Ušná známka
  if (input.earTagNumber != null && input.earTagNumber.trim() !== "") {
    if (!isValidEarTagNumber(input.earTagNumber)) {
      push(issues, {
        field: "earTagNumber",
        severity: "error",
        code: "EAR_TAG_FORMAT",
        message: "Číslo ušnej známky musí mať formát SK + 12 číslic (napr. SK000123456789).",
        expected: "SK + 12 číslic",
        actual: input.earTagNumber,
      });
    }
  }

  // Transpondér / mikročip
  if (input.transponderNumber != null && input.transponderNumber.trim() !== "") {
    if (!isValidTransponderNumber(input.transponderNumber)) {
      push(issues, {
        field: "transponderNumber",
        severity: "error",
        code: "TRANSPONDER_FORMAT",
        message: "Číslo transpondéra musí mať presne 15 číslic (ISO 11784).",
        expected: "15 číslic",
        actual: input.transponderNumber,
      });
    }
  }

  // KVL číslo lekára
  if (input.kvlNumber != null && input.kvlNumber.trim() !== "") {
    if (!isValidKvlNumber(input.kvlNumber)) {
      push(issues, {
        field: "kvlNumber",
        severity: "error",
        code: "KVL_FORMAT",
        message: "KVL číslo ošetrujúceho lekára má nesprávny tvar.",
        expected: "2–64 znakov",
        actual: input.kvlNumber,
      });
    }
  }

  // Ochrana lehota (mäso / mlieko) — iba ak bola podaná
  if (input.meatWithdrawalDays != null || input.milkWithdrawalDays != null) {
    for (const [field, days] of [
      ["meatWithdrawalDays", input.meatWithdrawalDays],
      ["milkWithdrawalDays", input.milkWithdrawalDays],
    ] as const) {
      if (days != null && (!Number.isFinite(days) || days < 0)) {
        push(issues, {
          field,
          severity: "error",
          code: `${String(field).toUpperCase()}_NEGATIVE`,
          message: "Ochranná lehota nesmie byť záporná.",
          actual: String(days),
        });
      }
    }

    const administered = asDate(input.administeredAt);
    const safeUntil = asDate(input.safeUntil);
    if (administered && safeUntil && safeUntil < administered) {
      push(issues, {
        field: "safeUntil",
        severity: "error",
        code: "SAFE_UNTIL_BEFORE_ADMINISTERED",
        message: "Koniec ochrannej lehoty nesmie predchádzať dátumu podania liečiva.",
        actual: safeUntil.toISOString(),
      });
    }
  }

  // Pre typ s ochrannou lehotou musí byť vyplnený aj názov liečiva
  if (type === "treatment_diary_batch") {
    const hasWithdrawal =
      (input.meatWithdrawalDays ?? 0) > 0 || (input.milkWithdrawalDays ?? 0) > 0;
    if (hasWithdrawal && !(input.medicationName ?? "").trim()) {
      push(issues, {
        field: "medicationName",
        severity: "error",
        code: "MEDICATION_REQUIRED_FOR_WITHDRAWAL",
        message: "Pri ochrannej lehote je povinný názov podaného liečiva.",
      });
    }
  }

  return {
    valid: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

/** Vráti iba blokujúce chyby (severity "error"). */
export function blockingIssues(
  result: KvepisValidationResult
): KvepisValidationIssue[] {
  return result.issues.filter((i) => i.severity === "error");
}

/** Vráti iba varovania (severity "warning"). */
export function warningIssues(
  result: KvepisValidationResult
): KvepisValidationIssue[] {
  return result.issues.filter((i) => i.severity === "warning");
}
