/**
 * Secure Interop Bridge v1 → v2 — statutory safety gates (Sprint 30).
 * -------------------------------------------------------------------
 * Every message that crosses the bridge passes these gates before it is
 * stored as `validated` or accepted for dispatch. They are the same
 * human-in-the-loop rules the rest of OpenVPM AI enforces in the UI:
 *
 *   1. **Zákon č. 39/2007 Z. z. (veterinárna starostlivosť)** — clinical
 *      content arriving over the bridge stays `draft`. The bridge can neither
 *      fabricate nor accept a veterinarian signature; signing happens inside
 *      OpenVPM through the confirmation protocol.
 *
 *   2. **Zákon č. 139/1998 Z. z. (omamné a psychotropné látky)** — zero AI
 *      prefill for ketamín, opioidy and propofol (and every other controlled
 *      substance). Such a record must be entered manually and, for
 *      administration/disposal, witnessed. Any payload that arrives with an
 *      AI prefill flag for a controlled substance is quarantined outright.
 *
 *   3. **Sympathy Gate** — a deceased or euthanized patient suppresses all
 *      automated outreach immediately. The bridge never forwards an automated
 *      reminder for such a patient; it records the suppression instead.
 *
 * Pure functions: the tRPC router persists whatever this returns.
 */
import { controlledSubstanceWitnessError } from "@/lib/controlled-substances/policy";
import {
  CONTROLLED_SUBSTANCES_PATTERN_SOURCE,
} from "@/lib/controlled-substances/policy";
import {
  BRIDGE_OUTREACH_MESSAGE_TYPES,
  type BridgeMessageType,
  isClinicalMessageType,
} from "./protocol";
import {
  type BridgePatientStatus,
  isBridgePatientDeceased,
} from "./validation";

export const STATUTORY_CLINICAL_DRAFT_REFERENCE = "Zákon č. 39/2007 Z. z.";
export const STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE =
  "Zákon č. 139/1998 Z. z.";
export const STATUTORY_SYMPATHY_GATE_REFERENCE =
  "OpenVPM Sympathy Gate (deceased / euthanized patients)";

export type BridgeSafetyBlockCode =
  | "clinical_draft_required"
  | "clinical_signoff_missing"
  | "controlled_substance_ai_prefill_forbidden"
  | "controlled_substance_manual_entry_required"
  | "controlled_substance_witness_required"
  | "sympathy_suppression_required"
  | "imaging_photo_url_forbidden";

export interface BridgeSafetyIssue {
  code: BridgeSafetyBlockCode | "sympathy_suppression_recorded";
  path: string;
  message: string;
  statutoryReference: string;
}

export interface BridgeSafetyGateResult {
  /** True when the message must not proceed (quarantine / refuse dispatch). */
  blocked: boolean;
  blockCode: BridgeSafetyBlockCode | null;
  issues: BridgeSafetyIssue[];
  /** Clinical message — the draft/sign-off rules applied. */
  clinical: boolean;
  /** A controlled substance (or controlled-substance ledger entry) is involved. */
  controlledSubstance: boolean;
  /** Matched controlled-substance terms, for the audit trail. */
  controlledSubstanceTerms: string[];
  /** The receiving side must obtain a veterinarian signature before use. */
  requiresVetSignoff: boolean;
  /** Automated outreach must be withheld for this patient (Sympathy Gate). */
  sympathySuppressed: boolean;
  statutoryReferences: string[];
}

/** Fields that would let a peer pre-sign or auto-finalize clinical content. */
const CLINICAL_AUTOMATION_FLAGS = [
  "autoSign",
  "autoSigned",
  "autoFinalize",
  "autoFinalized",
  "aiSignature",
  "signedByAi",
  "skipVetReview",
  "skipSignoff",
  "veterinarianSignature",
] as const;

/** Free-text keys whose automation intent changes the Sympathy Gate result. */
const AUTOMATION_INTENT_KEYS = [
  "automated",
  "automatedReminder",
  "sendReminder",
  "requestReview",
  "sendReviewRequest",
  "outreach",
] as const;

/**
 * Controlled-substance scanner. Built from the shared clinical vocabulary
 * (`@/lib/controlled-substances/policy`) so the bridge cannot drift from the
 * prescription guard, plus an explicit bridge-level floor for the three
 * substance classes the ticket names: ketamín, opioidy, propofol.
 */
const BRIDGE_CONTROLLED_SUBSTANCE_PATTERN = new RegExp(
  `(?:^|[^a-z0-9])(?:${CONTROLLED_SUBSTANCES_PATTERN_SOURCE}|opioid[a-z]*|opiat[a-z]*|narkotik[a-z]*|propofol[a-z]*)[a-z]*`,
  "i",
);

function stripDiacritics(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, "");
}

/** Every controlled-substance term found anywhere in a payload's strings. */
export function scanBridgeControlledSubstanceTerms(payload: unknown): string[] {
  const found = new Set<string>();

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      const normalised = stripDiacritics(value).toLowerCase();
      const matches = normalised.match(
        new RegExp(BRIDGE_CONTROLLED_SUBSTANCE_PATTERN.source, "gi"),
      );
      for (const match of matches ?? []) {
        found.add(match.trim());
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (value && typeof value === "object") {
      for (const entry of Object.values(value as Record<string, unknown>)) {
        walk(entry);
      }
    }
  };

  walk(payload);
  return [...found];
}

function readFlag(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}

function readOptionalStatus(
  payload: Record<string, unknown>,
): BridgePatientStatus | null {
  for (const key of ["status", "patientStatus"]) {
    const value = payload[key];
    if (typeof value === "string") return value as BridgePatientStatus;
  }
  return null;
}

export interface BridgeSafetyGateInput {
  messageType: BridgeMessageType;
  payload: Record<string, unknown>;
  /** Authoritative patient status resolved from the local database. */
  patientStatus?: BridgePatientStatus | null;
  now?: Date;
}

/**
 * Applies all three statutory gates. Returns a decision object; it never
 * throws and never mutates the payload.
 */
export function applyBridgeSafetyGates(
  input: BridgeSafetyGateInput,
): BridgeSafetyGateResult {
  const { messageType, payload } = input;
  const issues: BridgeSafetyIssue[] = [];
  const statutoryReferences = new Set<string>();

  const clinical = isClinicalMessageType(messageType);
  const controlledTerms = scanBridgeControlledSubstanceTerms(payload);
  const controlledSubstance =
    messageType === "controlled_substance.dispense" || controlledTerms.length > 0;
  let requiresVetSignoff = false;
  let blocked = false;
  let blockCode: BridgeSafetyBlockCode | null = null;

  const block = (code: BridgeSafetyBlockCode) => {
    blocked = true;
    blockCode = blockCode ?? code;
  };

  // ── 1. Clinical draft / veterinarian sign-off (Zákon 39/2007) ────────────
  if (clinical) {
    statutoryReferences.add(STATUTORY_CLINICAL_DRAFT_REFERENCE);
    for (const flag of CLINICAL_AUTOMATION_FLAGS) {
      if (readFlag(payload, flag)) {
        issues.push({
          code: "clinical_draft_required",
          path: flag,
          message: `"${flag}" is not accepted over the bridge: clinical content stays in draft until a veterinarian signs it in OpenVPM.`,
          statutoryReference: STATUTORY_CLINICAL_DRAFT_REFERENCE,
        });
        block("clinical_draft_required");
      }
    }

    const status = typeof payload.status === "string" ? payload.status : null;
    if (status === "signed" && !payload.signedByVetId) {
      issues.push({
        code: "clinical_signoff_missing",
        path: "status",
        message:
          "A signed clinical record is only accepted when it carries the signing veterinarian; the bridge never fabricates a signature.",
        statutoryReference: STATUTORY_CLINICAL_DRAFT_REFERENCE,
      });
      block("clinical_signoff_missing");
    }
    if (
      status === "signed" &&
      typeof payload.signedByVetId === "string" &&
      /^(ai|system|bridge|automation)\b/i.test(payload.signedByVetId)
    ) {
      issues.push({
        code: "clinical_signoff_missing",
        path: "signedByVetId",
        message:
          "A non-human actor cannot sign a clinical record; the signature must belong to a licensed veterinarian.",
        statutoryReference: STATUTORY_CLINICAL_DRAFT_REFERENCE,
      });
      block("clinical_signoff_missing");
    }

    requiresVetSignoff =
      (payload.author === "ai" && payload.status === "draft") ||
      payload.aiAssisted === true ||
      (controlledSubstance && status !== "signed");
  }

  // ── 2. Controlled substances — zero AI prefill (Zákon 139/1998) ──────────
  if (controlledSubstance) {
    statutoryReferences.add(STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE);
    if (readFlag(payload, "aiPrefill")) {
      issues.push({
        code: "controlled_substance_ai_prefill_forbidden",
        path: "aiPrefill",
        message:
          "AI prefill is forbidden for controlled substances — ketamín, opioidy, propofol and every other OPL entry must be written manually.",
        statutoryReference: STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE,
      });
      block("controlled_substance_ai_prefill_forbidden");
    }
    if (messageType === "prescription.created" && payload.manualEntry !== true) {
      issues.push({
        code: "controlled_substance_manual_entry_required",
        path: "manualEntry",
        message:
          "A prescription containing a controlled substance must arrive with manualEntry: true — the bridge refuses automated entry.",
        statutoryReference: STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE,
      });
      block("controlled_substance_manual_entry_required");
    }
    if (messageType === "controlled_substance.dispense") {
      const witnessError = controlledSubstanceWitnessError({
        action: payload.action as "received" | "administered" | "wasted" | "returned",
        witnessedBy:
          typeof payload.witnessedBy === "string" ? payload.witnessedBy : null,
      });
      if (witnessError) {
        issues.push({
          code: "controlled_substance_witness_required",
          path: "witnessedBy",
          message: witnessError,
          statutoryReference: STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE,
        });
        block("controlled_substance_witness_required");
      }
      if (payload.manualEntry !== true) {
        issues.push({
          code: "controlled_substance_manual_entry_required",
          path: "manualEntry",
          message:
            "OPL ledger entries must be written manually (manualEntry: true).",
          statutoryReference: STATUTORY_CONTROLLED_SUBSTANCES_REFERENCE,
        });
        block("controlled_substance_manual_entry_required");
      }
    }
  }

  // ── 3. Sympathy Gate — no outreach for deceased patients ────────────────
  const resolvedStatus =
    input.patientStatus ?? readOptionalStatus(payload) ?? null;
  const deceased = isBridgePatientDeceased(resolvedStatus);
  let sympathySuppressed = deceased;
  if (deceased) {
    statutoryReferences.add(STATUTORY_SYMPATHY_GATE_REFERENCE);
    const carriesAutomationIntent =
      BRIDGE_OUTREACH_MESSAGE_TYPES.has(messageType) ||
      AUTOMATION_INTENT_KEYS.some((key) => readFlag(payload, key));
    if (messageType === "automation.suppression.request") {
      issues.push({
        code: "sympathy_suppression_recorded",
        path: "reason",
        message:
          "Suppression recorded: automated outreach is withheld for this patient and written to the suppression log.",
        statutoryReference: STATUTORY_SYMPATHY_GATE_REFERENCE,
      });
    } else if (carriesAutomationIntent) {
      issues.push({
        code: "sympathy_suppression_required",
        path: "patientId",
        message:
          "Automated outreach for a deceased patient is refused; the reminder is suppressed and logged instead.",
        statutoryReference: STATUTORY_SYMPATHY_GATE_REFERENCE,
      });
      sympathySuppressed = true;
      block("sympathy_suppression_required");
    } else {
      sympathySuppressed = true;
      issues.push({
        code: "sympathy_suppression_recorded",
        path: "patientId",
        message:
          "Patient is marked deceased — every automated reminder or review request derived from this record is suppressed.",
        statutoryReference: STATUTORY_SYMPATHY_GATE_REFERENCE,
      });
    }
  }

  // ── 4. Medical imaging never overwrites the patient photo ──────────────
  if (messageType === "attachment.linked") {
    for (const forbidden of ["photoUrl", "avatarUrl", "imageUrl"]) {
      if (forbidden in payload) {
        issues.push({
          code: "imaging_photo_url_forbidden",
          path: forbidden,
          message:
            "Imaging attachments live in their own category and never overwrite patient.photoUrl.",
          statutoryReference: STATUTORY_CLINICAL_DRAFT_REFERENCE,
        });
        block("imaging_photo_url_forbidden");
      }
    }
  }

  return {
    blocked,
    blockCode,
    issues,
    clinical,
    controlledSubstance,
    controlledSubstanceTerms: controlledTerms,
    requiresVetSignoff,
    sympathySuppressed,
    statutoryReferences: [...statutoryReferences],
  };
}

/** Convenience predicate used by the router's quarantine branch. */
export function isBridgeGateBlocked(result: BridgeSafetyGateResult): boolean {
  return result.blocked;
}
