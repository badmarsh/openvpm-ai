/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * JSON schema validation layer for VPM input contracts. Ajv-backed, aligned
 * with the `openvpm/schemas` master registry, with clinical guardrails:
 *
 * - Zákon 39/2007 Z. z. — AI suggestions stay draft until veterinarian sign-off.
 * - Zákon 139/1998 Z. z. — zero AI prefill for ketamine, opioids, propofol.
 * - Sympathy Gate — automated reminders suppressed for deceased patients.
 */

export {
  CONTRACTS,
  CONTRACT_IDS,
  REGISTRY_SOURCE,
  SCHEMA_DIALECT,
} from "./contracts";
export {
  contractCount,
  getContract,
  isContractId,
  listContracts,
  listContractSummaries,
} from "./registry";
export {
  evaluateGuardrails,
  findNarcoticMatches,
  hasAiOrigin,
  isPatientDeceased,
  NARCOTIC_ALIAS_GROUPS,
} from "./guardrails";
export {
  getAjv,
  getCompiledValidator,
  normalizeAjvError,
  pointerToPath,
  summarizeOutcome,
  validateContract,
} from "./validator";
export {
  withSchemaValidation,
  withSchemaValidationFromInput,
} from "./middleware";
export type {
  ContractDescriptor,
  ContractSummary,
  GuardrailCode,
  JsonSchema,
  SchemaContractId,
  ValidationIssue,
  ValidationOrigin,
  ValidationOutcome,
  ValidationResult,
} from "./types";
