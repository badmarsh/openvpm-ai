/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Ajv-backed validation engine for VPM input contracts. Compiles every
 * contract from the vendored `openvpm/schemas` master catalog exactly once,
 * normalizes Ajv errors into i18n-ready issue descriptors and layers the
 * clinical guardrails on top.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import { evaluateGuardrails } from "./guardrails";
import { getContract } from "./registry";
import type {
  GuardrailCode,
  SchemaContractId,
  ValidationIssue,
  ValidationOutcome,
} from "./types";

let ajvInstance: Ajv | null = null;
const compiledValidators = new Map<string, ValidateFunction>();

/** Shared Ajv instance (draft-07 + formats), created lazily and cached. */
export function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      strict: true,
      // Lab values are legitimately `string | number` in the master registry.
      allowUnionTypes: true,
      validateFormats: true,
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

/** Compile (once) and cache the validator for a contract. */
export function getCompiledValidator(
  contractId: SchemaContractId,
): ValidateFunction {
  const cached = compiledValidators.get(contractId);
  if (cached) return cached;
  const contract = getContract(contractId);
  const validator = getAjv().compile(contract.schema);
  compiledValidators.set(contractId, validator);
  return validator;
}

/** Convert an Ajv JSON pointer (`/items/0/dosage`) to a dotted path. */
export function pointerToPath(pointer: string): string {
  return pointer
    .replace(/^\//, "")
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  required: "schemaValidation.error.required",
  type: "schemaValidation.error.type",
  enum: "schemaValidation.error.enum",
  format: "schemaValidation.error.format",
  pattern: "schemaValidation.error.pattern",
  minLength: "schemaValidation.error.minLength",
  maxLength: "schemaValidation.error.maxLength",
  minimum: "schemaValidation.error.minimum",
  maximum: "schemaValidation.error.maximum",
  exclusiveMinimum: "schemaValidation.error.exclusiveMinimum",
  exclusiveMaximum: "schemaValidation.error.exclusiveMaximum",
  minItems: "schemaValidation.error.minItems",
  maxItems: "schemaValidation.error.maxItems",
  additionalProperties: "schemaValidation.error.additionalProperties",
  const: "schemaValidation.error.const",
};

/** Normalize one Ajv error into an i18n-ready issue descriptor. */
export function normalizeAjvError(error: ErrorObject): ValidationIssue {
  const base = pointerToPath(error.instancePath ?? "");
  const params: Record<string, string | number> = {};

  switch (error.keyword) {
    case "required": {
      const missing = String(
        (error.params as { missingProperty?: string }).missingProperty ?? "",
      );
      return {
        field: base ? `${base}.${missing}` : missing,
        code: "required",
        messageKey: ERROR_MESSAGE_KEYS.required,
        params: { field: missing },
      };
    }
    case "type":
      params.expected = String(
        (error.params as { type?: string }).type ?? "unknown",
      );
      break;
    case "enum": {
      const allowed = (error.params as { allowedValues?: unknown[] })
        .allowedValues;
      params.allowed = Array.isArray(allowed)
        ? allowed.slice(0, 6).map(String).join(", ")
        : "";
      break;
    }
    case "format":
      params.format = String((error.params as { format?: string }).format ?? "");
      break;
    case "minLength":
    case "maxLength":
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
    case "minItems":
    case "maxItems": {
      const limit = (error.params as { limit?: number }).limit;
      if (typeof limit === "number") params.limit = limit;
      break;
    }
    case "additionalProperties": {
      const property = String(
        (error.params as { additionalProperty?: string }).additionalProperty ??
          "",
      );
      params.property = property;
      // Point the issue at the offending property itself, not its parent.
      return {
        field: base ? `${base}.${property}` : property,
        code: "additionalProperties",
        messageKey: ERROR_MESSAGE_KEYS.additionalProperties,
        params,
      };
    }
    default:
      break;
  }

  return {
    field: base || "(root)",
    code: error.keyword,
    messageKey:
      ERROR_MESSAGE_KEYS[error.keyword] ?? "schemaValidation.error.invalid",
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

/**
 * Validate `payload` against the contract identified by `contractId`.
 *
 * The outcome merges plain JSON schema errors with clinical guardrail blocks;
 * `ok` is true only when both layers produced zero issues.
 */
export function validateContract(
  contractId: SchemaContractId,
  payload: unknown,
): ValidationOutcome {
  const contract = getContract(contractId);
  const validator = getCompiledValidator(contractId);

  const schemaValid = validator(payload);
  const issues: ValidationIssue[] = schemaValid
    ? []
    : (validator.errors ?? []).map(normalizeAjvError);

  // Guardrails run even when the schema fails, so API consumers see the full
  // clinical picture in one pass (e.g. AI-prefilled ketamine with a missing
  // field must still surface the narcotic block).
  issues.push(...evaluateGuardrails(contract, payload));

  const triggeredGuardrails = Array.from(
    new Set<GuardrailCode>(
      issues
        .map((issue) => issue.guardrail)
        .filter((guardrail): guardrail is GuardrailCode => Boolean(guardrail)),
    ),
  );

  return {
    ok: issues.length === 0,
    contractId,
    schemaVersion: contract.version,
    result: issues.length === 0 ? "passed" : "rejected",
    issues,
    triggeredGuardrails,
    validatedAt: Date.now(),
  };
}

/** Compact, log-safe summary of an outcome (no PHI — fields and codes only). */
export function summarizeOutcome(outcome: ValidationOutcome): string {
  if (outcome.ok) return `${outcome.contractId}: passed`;
  const detail = outcome.issues
    .slice(0, 8)
    .map((issue) => `${issue.field} ${issue.code}`)
    .join("; ");
  return `${outcome.contractId}: rejected (${detail})`;
}
