/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * Registry access for the vendored `openvpm/schemas` master catalog.
 */

import { CONTRACT_IDS, CONTRACTS, REGISTRY_SOURCE } from "./contracts";
import type {
  ContractDescriptor,
  ContractSummary,
  SchemaContractId,
} from "./types";

export { REGISTRY_SOURCE };

/** Type guard for contract identifiers. */
export function isContractId(value: unknown): value is SchemaContractId {
  return (
    typeof value === "string" &&
    (CONTRACT_IDS as string[]).includes(value)
  );
}

/** Resolve one contract descriptor; throws on unknown ids. */
export function getContract(id: SchemaContractId): ContractDescriptor {
  const contract = CONTRACTS[id];
  if (!contract) {
    throw new Error(`Unknown VPM schema contract: ${String(id)}`);
  }
  return contract;
}

/** All registered contracts, ordered by id. */
export function listContracts(): ContractDescriptor[] {
  return [...CONTRACT_IDS].sort().map((id) => getContract(id));
}

/** Summaries for UI/API surfaces (schema bodies omitted). */
export function listContractSummaries(): ContractSummary[] {
  return listContracts().map(({ schema, ...rest }) => ({
    ...rest,
    schemaBytes: new TextEncoder().encode(JSON.stringify(schema)).length,
  }));
}

/** Number of registered contracts. */
export function contractCount(): number {
  return CONTRACT_IDS.length;
}
