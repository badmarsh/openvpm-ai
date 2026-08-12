import { createHash } from "node:crypto";

export type ImportFingerprintMode =
  | "clients"
  | "patients"
  | "vaccinations"
  | "soap_notes"
  | "care_reminders"
  | "services"
  | "products"
  | "client_contacts"
  | "historical_appointments"
  | "external_prescriptions"
  | "external_prescription_fills"
  | "external_lab_reports"
  | "external_lab_observations"
  | "legacy_financial_documents"
  | "legacy_financial_line_items"
  | "legacy_financial_payments"
  | "legacy_financial_allocations"
  | "historical_documents";

const IMPORT_FINGERPRINT_SCHEMA_VERSION = 1;

/**
 * Privacy-minimized, deterministic identity for rows created by migration.
 * Only the digest is persisted. The versioned JSON envelope avoids delimiter
 * ambiguity and permits an intentional future identity-policy migration.
 */
export function migrationImportFingerprint(
  mode: ImportFingerprintMode,
  identityParts: readonly (string | null)[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: IMPORT_FINGERPRINT_SCHEMA_VERSION,
        mode,
        identityParts,
      }),
      "utf8",
    )
    .digest("hex");
}
