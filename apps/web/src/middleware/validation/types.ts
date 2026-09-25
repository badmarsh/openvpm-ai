/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Shared types for the JSON schema validation layer that guards VPM input
 * contracts. The layer is aligned with the `openvpm/schemas` master registry
 * (vendored snapshot in `contracts.ts`) and is enforced through the tRPC
 * middleware exported from `middleware.ts`.
 */

/** Result of a single contract validation run. */
export type ValidationResult = "passed" | "rejected";

/**
 * Clinical/legal guardrails enforced on top of plain JSON schema checks.
 *
 * - `ai-draft-only` — Zákon 39/2007 Z. z.: AI-generated clinical content must
 *   stay in draft state until a veterinarian signs it.
 * - `narcotic-zero-ai-prefill` — Zákon 139/1998 Z. z.: ZERO AI prefill for
 *   ketamine, opioids and propofol; only manual entry is accepted.
 * - `sympathy-gate` — automated reminders/outreach are suppressed when the
 *   patient is deceased.
 */
export type GuardrailCode =
  | "ai-draft-only"
  | "narcotic-zero-ai-prefill"
  | "sympathy-gate";

/** A single normalized validation issue (schema error or guardrail block). */
export interface ValidationIssue {
  /** Dotted field path, e.g. `patient.name` or `items.0.dosage`. */
  field: string;
  /** Machine-readable error code (`required`, `type`, `enum`, …). */
  code: string;
  /**
   * i18n message key resolved on the UI surface. Never rendered with raw
   * hardcoded copy on the server.
   */
  messageKey: string;
  /** Interpolation parameters for `messageKey`. */
  params?: Record<string, string | number>;
  /** Set when the issue originates from a clinical guardrail. */
  guardrail?: GuardrailCode;
}

/** Outcome of validating one payload against one contract. */
export interface ValidationOutcome {
  ok: boolean;
  contractId: SchemaContractId;
  schemaVersion: string;
  result: ValidationResult;
  issues: ValidationIssue[];
  /** Guardrails that produced at least one issue. */
  triggeredGuardrails: GuardrailCode[];
  /** Unix epoch milliseconds. */
  validatedAt: number;
}

/**
 * VPM input contract identifiers, mirrored 1:1 from the `openvpm/schemas`
 * master registry.
 */
export type SchemaContractId =
  | "openvpm.client-registration"
  | "openvpm.patient-registration"
  | "openvpm.vaccination-record"
  | "openvpm.prescription-order"
  | "openvpm.controlled-substance-record"
  | "openvpm.lab-result-import"
  | "openvpm.care-reminder"
  | "openvpm.ai-clinical-suggestion";

/** JSON Schema (draft-07) document body. Kept structural on purpose. */
export type JsonSchema = Record<string, unknown>;

/** Descriptor of one registered VPM input contract. */
export interface ContractDescriptor {
  id: SchemaContractId;
  version: string;
  title: string;
  description: string;
  /** Registry the schema is mirrored from. */
  source: string;
  /** Risk classification of the contract surface. */
  riskClass: "low" | "medium" | "high";
  /** Slovak legal basis when a guardrail is mandated by law. */
  legalBasis?: string;
  /** Guardrails applied to this contract. */
  guardrails: GuardrailCode[];
  schema: JsonSchema;
}

/** Public summary of a contract (schema body omitted). */
export type ContractSummary = Omit<ContractDescriptor, "schema"> & {
  schemaBytes: number;
};

/** Origin of a validation event for auditing. */
export type ValidationOrigin = "api" | "playground";
