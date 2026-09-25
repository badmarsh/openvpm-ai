import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { clients } from "./clients";
import { files } from "./files";
import { patients } from "./patients";
import { practices } from "./practices";
import { users } from "./users";

export const clientContactKindEnum = pgEnum("client_contact_kind", [
  "co_owner",
  "authorized_contact",
  "billing_contact",
  "emergency_contact",
  "other",
]);

export const historicalAppointmentStatusEnum = pgEnum(
  "historical_appointment_status",
  ["completed", "cancelled", "no_show", "unknown"],
);

export const externalPrescriptionStatusEnum = pgEnum(
  "external_prescription_status",
  ["active", "completed", "cancelled", "expired", "unknown"],
);

export const importedClinicalReviewStatusEnum = pgEnum(
  "imported_clinical_review_status",
  ["unreviewed", "confirmed", "superseded"],
);

export const migrationAttributionStatusEnum = pgEnum(
  "migration_attribution_status",
  ["matched", "needs_review"],
);

export const externalLabReportStatusEnum = pgEnum(
  "external_lab_report_status",
  ["ordered", "partial", "final", "corrected", "cancelled", "unknown"],
);

export const legacyFinancialDocumentTypeEnum = pgEnum(
  "legacy_financial_document_type",
  ["invoice", "credit_note", "estimate"],
);

export const legacyFinancialDocumentStatusEnum = pgEnum(
  "legacy_financial_document_status",
  ["open", "partial", "paid", "void", "unknown"],
);

export const legacyFinancialPaymentTypeEnum = pgEnum(
  "legacy_financial_payment_type",
  ["payment", "refund", "adjustment"],
);

export const historicalDocumentKindEnum = pgEnum("historical_document_kind", [
  "patient_record",
  "lab_report",
  "prescription",
  "appointment",
  "financial",
  "other",
]);

export const historicalDocumentLinkStatusEnum = pgEnum(
  "historical_document_link_status",
  ["linked", "needs_review"],
);

/**
 * A client-level contact shared by the client's patients. Imported notification
 * preferences are deliberately not actionable consent and therefore are not
 * represented here.
 */
export const clientContacts = pgTable(
  "client_contacts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id"),
    attributionStatus: migrationAttributionStatusEnum("attribution_status")
      .notNull()
      .default("matched"),
    kind: clientContactKindEnum("kind").notNull().default("co_owner"),
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    externalSource: varchar("external_source", { length: 64 }),
    externalId: varchar("external_id", { length: 160 }),
    importFingerprint: varchar("import_fingerprint", { length: 64 }),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("client_contacts_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    clientIdx: index("client_contacts_client_idx").on(
      table.practiceId,
      table.clientId,
      table.deletedAt,
      table.lastName,
      table.firstName,
    ),
    externalIdUq: uniqueIndex("client_contacts_external_id_uq")
      .on(table.practiceId, table.externalSource, table.externalId)
      .where(sql`${table.externalSource} is not null`),
    importFingerprintUq: uniqueIndex("client_contacts_import_fingerprint_uq")
      .on(table.practiceId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "client_contacts_client_tenant_fk",
    }),
    nameCheck: check(
      "client_contacts_name_check",
      sql`(${table.firstName} is null or length(btrim(${table.firstName})) > 0)
        and (${table.lastName} is null or length(btrim(${table.lastName})) > 0)
        and (${table.firstName} is not null or ${table.lastName} is not null or ${table.email} is not null or ${table.phone} is not null)`,
    ),
    attributionCheck: check(
      "client_contacts_attribution_check",
      sql`(${table.attributionStatus} = 'matched' and ${table.clientId} is not null)
        or (${table.attributionStatus} = 'needs_review' and ${table.clientId} is null)`,
    ),
    importIdentityCheck: check(
      "client_contacts_import_identity_check",
      sql`(${table.externalSource} is null and ${table.externalId} is null and ${table.importFingerprint} is null)
        or (${table.externalSource} is not null and ${table.externalId} is not null and ${table.importFingerprint} is not null)`,
    ),
    importSourceCheck: check(
      "client_contacts_import_source_check",
      sql`${table.externalSource} is null or ${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    importFingerprintCheck: check(
      "client_contacts_import_fingerprint_check",
      sql`${table.importFingerprint} is null or ${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

/**
 * Immutable source visit history. These rows never enter the live scheduler,
 * availability, activation, reminder, or visit-closeout workflows.
 */
export const historicalAppointments = pgTable(
  "historical_appointments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id").notNull(),
    clientId: uuid("client_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    status: historicalAppointmentStatusEnum("status")
      .notNull()
      .default("unknown"),
    appointmentType: varchar("appointment_type", { length: 255 }),
    providerDisplayName: varchar("provider_display_name", { length: 255 }),
    reason: text("reason"),
    notes: text("notes"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("historical_appointments_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    externalIdUq: uniqueIndex("historical_appointments_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "historical_appointments_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    patientTimelineIdx: index(
      "historical_appointments_patient_timeline_idx",
    ).on(table.practiceId, table.patientId, table.startedAt, table.id),
    clientTimelineIdx: index(
      "historical_appointments_client_timeline_idx",
    ).on(table.practiceId, table.clientId, table.startedAt, table.id),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "historical_appointments_patient_tenant_fk",
    }),
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "historical_appointments_client_tenant_fk",
    }),
    timeCheck: check(
      "historical_appointments_time_check",
      sql`${table.startedAt} < ${table.endedAt}`,
    ),
    sourceCheck: check(
      "historical_appointments_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "historical_appointments_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    textLengthCheck: check(
      "historical_appointments_text_length_check",
      sql`(${table.reason} is null or char_length(${table.reason}) <= 4000)
        and (${table.notes} is null or char_length(${table.notes}) <= 12000)`,
    ),
  }),
);

/**
 * Source-attributed medication history. It is visible to clinical staff but
 * cannot dispense stock, authorize a refill, or become an active OpenVPM
 * prescription without a separate clinician-authored workflow.
 */
export const externalPrescriptions = pgTable(
  "external_prescriptions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id").notNull(),
    medicationName: varchar("medication_name", { length: 255 }).notNull(),
    directions: text("directions"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }),
    refillCount: integer("refill_count"),
    prescribedAt: timestamp("prescribed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: externalPrescriptionStatusEnum("status")
      .notNull()
      .default("unknown"),
    isChronic: boolean("is_chronic").notNull().default(false),
    prescriberDisplayName: varchar("prescriber_display_name", { length: 255 }),
    reviewStatus: importedClinicalReviewStatusEnum("review_status")
      .notNull()
      .default("unreviewed"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("external_prescriptions_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    externalIdUq: uniqueIndex("external_prescriptions_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "external_prescriptions_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    patientStatusIdx: index("external_prescriptions_patient_status_idx").on(
      table.practiceId,
      table.patientId,
      table.status,
      table.prescribedAt,
      table.id,
    ),
    reviewIdx: index("external_prescriptions_review_idx").on(
      table.practiceId,
      table.reviewStatus,
      table.status,
      table.id,
    ),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "external_prescriptions_patient_tenant_fk",
    }),
    reviewerTenantFk: foreignKey({
      columns: [table.practiceId, table.reviewedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "external_prescriptions_reviewer_tenant_fk",
    }),
    reviewShapeCheck: check(
      "external_prescriptions_review_shape_check",
      sql`(${table.reviewStatus} = 'unreviewed' and ${table.reviewedAt} is null and ${table.reviewedBy} is null)
        or (${table.reviewStatus} in ('confirmed', 'superseded') and ${table.reviewedAt} is not null and ${table.reviewedBy} is not null)`,
    ),
    valueCheck: check(
      "external_prescriptions_value_check",
      sql`length(btrim(${table.medicationName})) > 0
        and (${table.quantity} is null or ${table.quantity} >= 0)
        and (${table.refillCount} is null or ${table.refillCount} >= 0)
        and (${table.directions} is null or char_length(${table.directions}) <= 12000)
        and (${table.expiresAt} is null or ${table.prescribedAt} is null or ${table.expiresAt} >= ${table.prescribedAt})`,
    ),
    sourceCheck: check(
      "external_prescriptions_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "external_prescriptions_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const externalPrescriptionFills = pgTable(
  "external_prescription_fills",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    prescriptionId: uuid("prescription_id").notNull(),
    filledAt: timestamp("filled_at", { withTimezone: true }),
    quantityDispensed: numeric("quantity_dispensed", {
      precision: 14,
      scale: 3,
    }),
    directions: text("directions"),
    sourceStatus: varchar("source_status", { length: 128 }),
    prescriberDisplayName: varchar("prescriber_display_name", { length: 255 }),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    externalIdUq: uniqueIndex("external_prescription_fills_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "external_prescription_fills_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    historyIdx: index("external_prescription_fills_history_idx").on(
      table.practiceId,
      table.prescriptionId,
      table.filledAt,
      table.id,
    ),
    prescriptionTenantFk: foreignKey({
      columns: [table.practiceId, table.prescriptionId],
      foreignColumns: [externalPrescriptions.practiceId, externalPrescriptions.id],
      name: "external_prescription_fills_prescription_tenant_fk",
    }),
    valueCheck: check(
      "external_prescription_fills_value_check",
      sql`(${table.quantityDispensed} is null or ${table.quantityDispensed} >= 0)
        and (${table.directions} is null or char_length(${table.directions}) <= 12000)`,
    ),
    sourceCheck: check(
      "external_prescription_fills_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "external_prescription_fills_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

/** External panel/report evidence, separate from the live lab review inbox. */
export const externalLabReports = pgTable(
  "external_lab_reports",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id"),
    attributionStatus: migrationAttributionStatusEnum("attribution_status")
      .notNull()
      .default("matched"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    resultedAt: timestamp("resulted_at", { withTimezone: true }),
    status: externalLabReportStatusEnum("status")
      .notNull()
      .default("unknown"),
    labName: varchar("lab_name", { length: 255 }),
    orderName: varchar("order_name", { length: 255 }),
    accessionNumber: varchar("accession_number", { length: 160 }),
    summary: text("summary"),
    interpretation: text("interpretation"),
    reviewStatus: importedClinicalReviewStatusEnum("review_status")
      .notNull()
      .default("unreviewed"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("external_lab_reports_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    externalIdUq: uniqueIndex("external_lab_reports_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "external_lab_reports_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    patientTimelineIdx: index("external_lab_reports_patient_timeline_idx").on(
      table.practiceId,
      table.patientId,
      table.resultedAt,
      table.orderedAt,
      table.id,
    ),
    reviewIdx: index("external_lab_reports_review_idx").on(
      table.practiceId,
      table.reviewStatus,
      table.status,
      table.id,
    ),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "external_lab_reports_patient_tenant_fk",
    }),
    reviewerTenantFk: foreignKey({
      columns: [table.practiceId, table.reviewedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "external_lab_reports_reviewer_tenant_fk",
    }),
    reviewShapeCheck: check(
      "external_lab_reports_review_shape_check",
      sql`(${table.reviewStatus} = 'unreviewed' and ${table.reviewedAt} is null and ${table.reviewedBy} is null)
        or (${table.reviewStatus} in ('confirmed', 'superseded') and ${table.reviewedAt} is not null and ${table.reviewedBy} is not null)`,
    ),
    attributionCheck: check(
      "external_lab_reports_attribution_check",
      sql`(${table.attributionStatus} = 'matched' and ${table.patientId} is not null)
        or (${table.attributionStatus} = 'needs_review' and ${table.patientId} is null)`,
    ),
    dateCheck: check(
      "external_lab_reports_date_check",
      sql`${table.resultedAt} is null or ${table.orderedAt} is null or ${table.resultedAt} >= ${table.orderedAt}`,
    ),
    textLengthCheck: check(
      "external_lab_reports_text_length_check",
      sql`(${table.summary} is null or char_length(${table.summary}) <= 12000)
        and (${table.interpretation} is null or char_length(${table.interpretation}) <= 12000)`,
    ),
    sourceCheck: check(
      "external_lab_reports_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "external_lab_reports_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const externalLabObservations = pgTable(
  "external_lab_observations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    reportId: uuid("report_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    name: varchar("name", { length: 255 }).notNull(),
    value: text("value"),
    unit: varchar("unit", { length: 64 }),
    referenceRange: varchar("reference_range", { length: 255 }),
    flag: varchar("flag", { length: 64 }),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    externalIdUq: uniqueIndex("external_lab_observations_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "external_lab_observations_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    reportOrderIdx: index("external_lab_observations_report_order_idx").on(
      table.practiceId,
      table.reportId,
      table.sortOrder,
      table.id,
    ),
    reportTenantFk: foreignKey({
      columns: [table.practiceId, table.reportId],
      foreignColumns: [externalLabReports.practiceId, externalLabReports.id],
      name: "external_lab_observations_report_tenant_fk",
    }),
    valueCheck: check(
      "external_lab_observations_value_check",
      sql`${table.sortOrder} >= 0 and length(btrim(${table.name})) > 0 and (${table.value} is null or char_length(${table.value}) <= 4000)`,
    ),
    sourceCheck: check(
      "external_lab_observations_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "external_lab_observations_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

/**
 * Reference-only invoice/credit history. It is intentionally disjoint from
 * live invoices and cannot alter accounts receivable, checkout, or inventory.
 */
export const legacyFinancialDocuments = pgTable(
  "legacy_financial_documents",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id").notNull(),
    patientId: uuid("patient_id"),
    documentType: legacyFinancialDocumentTypeEnum("document_type")
      .notNull()
      .default("invoice"),
    documentNumber: varchar("document_number", { length: 160 }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    dueDate: date("due_date"),
    status: legacyFinancialDocumentStatusEnum("status")
      .notNull()
      .default("unknown"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    sourceStatus: varchar("source_status", { length: 128 }),
    note: text("note"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("legacy_financial_documents_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    externalIdUq: uniqueIndex("legacy_financial_documents_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "legacy_financial_documents_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    clientTimelineIdx: index(
      "legacy_financial_documents_client_timeline_idx",
    ).on(table.practiceId, table.clientId, table.issuedAt, table.id),
    openBalanceIdx: index("legacy_financial_documents_open_balance_idx")
      .on(table.practiceId, table.status, table.issuedAt, table.id)
      .where(sql`${table.status} in ('open', 'partial') and ${table.deletedAt} is null`),
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "legacy_financial_documents_client_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "legacy_financial_documents_patient_tenant_fk",
    }),
    amountCheck: check(
      "legacy_financial_documents_amount_check",
      sql`${table.subtotal} >= 0 and ${table.tax} >= 0 and ${table.discount} >= 0
        and ${table.total} >= 0 and ${table.paidAmount} >= 0 and ${table.balance} >= 0`,
    ),
    currencyCheck: check(
      "legacy_financial_documents_currency_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    sourceCheck: check(
      "legacy_financial_documents_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "legacy_financial_documents_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    noteCheck: check(
      "legacy_financial_documents_note_check",
      sql`${table.note} is null or char_length(${table.note}) <= 12000`,
    ),
  }),
);

export const legacyFinancialLineItems = pgTable(
  "legacy_financial_line_items",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    documentId: uuid("document_id").notNull(),
    patientId: uuid("patient_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    externalIdUq: uniqueIndex("legacy_financial_line_items_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "legacy_financial_line_items_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    documentOrderIdx: index("legacy_financial_line_items_document_order_idx").on(
      table.practiceId,
      table.documentId,
      table.sortOrder,
      table.id,
    ),
    documentTenantFk: foreignKey({
      columns: [table.practiceId, table.documentId],
      foreignColumns: [
        legacyFinancialDocuments.practiceId,
        legacyFinancialDocuments.id,
      ],
      name: "legacy_financial_line_items_document_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "legacy_financial_line_items_patient_tenant_fk",
    }),
    amountCheck: check(
      "legacy_financial_line_items_amount_check",
      sql`${table.sortOrder} >= 0 and ${table.quantity} >= 0 and ${table.unitPrice} >= 0
        and ${table.subtotal} >= 0 and ${table.tax} >= 0 and ${table.discount} >= 0 and ${table.total} >= 0`,
    ),
    sourceCheck: check(
      "legacy_financial_line_items_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "legacy_financial_line_items_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const legacyFinancialPayments = pgTable(
  "legacy_financial_payments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id"),
    attributionStatus: migrationAttributionStatusEnum("attribution_status")
      .notNull()
      .default("matched"),
    entryType: legacyFinancialPaymentTypeEnum("entry_type")
      .notNull()
      .default("payment"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    method: varchar("method", { length: 128 }),
    sourceStatus: varchar("source_status", { length: 128 }),
    reference: varchar("reference", { length: 255 }),
    note: text("note"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    practiceIdUq: uniqueIndex("legacy_financial_payments_practice_id_uq").on(
      table.practiceId,
      table.id,
    ),
    externalIdUq: uniqueIndex("legacy_financial_payments_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "legacy_financial_payments_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    clientTimelineIdx: index(
      "legacy_financial_payments_client_timeline_idx",
    ).on(table.practiceId, table.clientId, table.receivedAt, table.id),
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "legacy_financial_payments_client_tenant_fk",
    }),
    amountCheck: check(
      "legacy_financial_payments_amount_check",
      sql`${table.amount} >= 0`,
    ),
    attributionCheck: check(
      "legacy_financial_payments_attribution_check",
      sql`(${table.attributionStatus} = 'matched' and ${table.clientId} is not null)
        or (${table.attributionStatus} = 'needs_review' and ${table.clientId} is null)`,
    ),
    noteCheck: check(
      "legacy_financial_payments_note_check",
      sql`${table.note} is null or char_length(${table.note}) <= 4000`,
    ),
    sourceCheck: check(
      "legacy_financial_payments_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "legacy_financial_payments_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const legacyFinancialAllocations = pgTable(
  "legacy_financial_allocations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    documentId: uuid("document_id").notNull(),
    paymentId: uuid("payment_id").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }),
    description: varchar("description", { length: 500 }),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    externalIdUq: uniqueIndex("legacy_financial_allocations_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "legacy_financial_allocations_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    documentIdx: index("legacy_financial_allocations_document_idx").on(
      table.practiceId,
      table.documentId,
      table.allocatedAt,
      table.id,
    ),
    paymentIdx: index("legacy_financial_allocations_payment_idx").on(
      table.practiceId,
      table.paymentId,
      table.allocatedAt,
      table.id,
    ),
    documentTenantFk: foreignKey({
      columns: [table.practiceId, table.documentId],
      foreignColumns: [
        legacyFinancialDocuments.practiceId,
        legacyFinancialDocuments.id,
      ],
      name: "legacy_financial_allocations_document_tenant_fk",
    }),
    paymentTenantFk: foreignKey({
      columns: [table.practiceId, table.paymentId],
      foreignColumns: [
        legacyFinancialPayments.practiceId,
        legacyFinancialPayments.id,
      ],
      name: "legacy_financial_allocations_payment_tenant_fk",
    }),
    amountCheck: check(
      "legacy_financial_allocations_amount_check",
      sql`${table.amount} >= 0`,
    ),
    sourceCheck: check(
      "legacy_financial_allocations_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "legacy_financial_allocations_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

/**
 * A verified managed object plus its typed historical link. An unresolved
 * object remains tenant-private and visible only in migration review; it never
 * guesses a patient or clinical record.
 */
export const historicalDocuments = pgTable(
  "historical_documents",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    fileId: uuid("file_id").notNull(),
    patientId: uuid("patient_id"),
    kind: historicalDocumentKindEnum("kind").notNull().default("other"),
    linkStatus: historicalDocumentLinkStatusEnum("link_status")
      .notNull()
      .default("needs_review"),
    title: varchar("title", { length: 255 }).notNull(),
    documentDate: date("document_date"),
    labReportId: uuid("lab_report_id"),
    prescriptionId: uuid("prescription_id"),
    historicalAppointmentId: uuid("historical_appointment_id"),
    financialDocumentId: uuid("financial_document_id"),
    externalSource: varchar("external_source", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    importFingerprint: varchar("import_fingerprint", { length: 64 }).notNull(),
  },
  (table) => ({
    externalIdUq: uniqueIndex("historical_documents_external_id_uq").on(
      table.practiceId,
      table.externalSource,
      table.externalId,
    ),
    importFingerprintUq: uniqueIndex(
      "historical_documents_import_fingerprint_uq",
    ).on(table.practiceId, table.importFingerprint),
    fileUq: uniqueIndex("historical_documents_file_uq").on(
      table.practiceId,
      table.fileId,
    ),
    patientTimelineIdx: index("historical_documents_patient_timeline_idx").on(
      table.practiceId,
      table.patientId,
      table.documentDate,
      table.id,
    ),
    reviewIdx: index("historical_documents_review_idx").on(
      table.practiceId,
      table.linkStatus,
      table.kind,
      table.id,
    ),
    fileTenantFk: foreignKey({
      columns: [table.practiceId, table.fileId],
      foreignColumns: [files.practiceId, files.id],
      name: "historical_documents_file_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "historical_documents_patient_tenant_fk",
    }),
    labTenantFk: foreignKey({
      columns: [table.practiceId, table.labReportId],
      foreignColumns: [externalLabReports.practiceId, externalLabReports.id],
      name: "historical_documents_lab_tenant_fk",
    }),
    prescriptionTenantFk: foreignKey({
      columns: [table.practiceId, table.prescriptionId],
      foreignColumns: [
        externalPrescriptions.practiceId,
        externalPrescriptions.id,
      ],
      name: "historical_documents_prescription_tenant_fk",
    }),
    appointmentTenantFk: foreignKey({
      columns: [table.practiceId, table.historicalAppointmentId],
      foreignColumns: [
        historicalAppointments.practiceId,
        historicalAppointments.id,
      ],
      name: "historical_documents_appointment_tenant_fk",
    }),
    financialTenantFk: foreignKey({
      columns: [table.practiceId, table.financialDocumentId],
      foreignColumns: [
        legacyFinancialDocuments.practiceId,
        legacyFinancialDocuments.id,
      ],
      name: "historical_documents_financial_tenant_fk",
    }),
    linkShapeCheck: check(
      "historical_documents_link_shape_check",
      sql`(${table.linkStatus} = 'needs_review'
          and ${table.patientId} is null
          and ${table.labReportId} is null
          and ${table.prescriptionId} is null
          and ${table.historicalAppointmentId} is null
          and ${table.financialDocumentId} is null)
        or (${table.linkStatus} = 'linked' and ${table.patientId} is not null)`,
    ),
    kindShapeCheck: check(
      "historical_documents_kind_shape_check",
      sql`(${table.kind} <> 'lab_report' or ${table.labReportId} is not null)
        and (${table.kind} <> 'prescription' or ${table.prescriptionId} is not null)
        and (${table.kind} <> 'appointment' or ${table.historicalAppointmentId} is not null)
        and (${table.kind} <> 'financial' or ${table.financialDocumentId} is not null)`,
    ),
    sourceCheck: check(
      "historical_documents_source_check",
      sql`${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
    fingerprintCheck: check(
      "historical_documents_fingerprint_check",
      sql`${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const clientContactsRelations = relations(clientContacts, ({ one }) => ({
  client: one(clients, {
    fields: [clientContacts.clientId],
    references: [clients.id],
  }),
}));

export const historicalAppointmentsRelations = relations(
  historicalAppointments,
  ({ one, many }) => ({
    patient: one(patients, {
      fields: [historicalAppointments.patientId],
      references: [patients.id],
    }),
    client: one(clients, {
      fields: [historicalAppointments.clientId],
      references: [clients.id],
    }),
    documents: many(historicalDocuments),
  }),
);

export const externalPrescriptionsRelations = relations(
  externalPrescriptions,
  ({ one, many }) => ({
    patient: one(patients, {
      fields: [externalPrescriptions.patientId],
      references: [patients.id],
    }),
    reviewer: one(users, {
      fields: [externalPrescriptions.reviewedBy],
      references: [users.id],
    }),
    fills: many(externalPrescriptionFills),
    documents: many(historicalDocuments),
  }),
);

export const externalPrescriptionFillsRelations = relations(
  externalPrescriptionFills,
  ({ one }) => ({
    prescription: one(externalPrescriptions, {
      fields: [externalPrescriptionFills.prescriptionId],
      references: [externalPrescriptions.id],
    }),
  }),
);

export const externalLabReportsRelations = relations(
  externalLabReports,
  ({ one, many }) => ({
    patient: one(patients, {
      fields: [externalLabReports.patientId],
      references: [patients.id],
    }),
    reviewer: one(users, {
      fields: [externalLabReports.reviewedBy],
      references: [users.id],
    }),
    observations: many(externalLabObservations),
    documents: many(historicalDocuments),
  }),
);

export const externalLabObservationsRelations = relations(
  externalLabObservations,
  ({ one }) => ({
    report: one(externalLabReports, {
      fields: [externalLabObservations.reportId],
      references: [externalLabReports.id],
    }),
  }),
);

export const legacyFinancialDocumentsRelations = relations(
  legacyFinancialDocuments,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [legacyFinancialDocuments.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [legacyFinancialDocuments.patientId],
      references: [patients.id],
    }),
    items: many(legacyFinancialLineItems),
    allocations: many(legacyFinancialAllocations),
    documents: many(historicalDocuments),
  }),
);

export const legacyFinancialPaymentsRelations = relations(
  legacyFinancialPayments,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [legacyFinancialPayments.clientId],
      references: [clients.id],
    }),
    allocations: many(legacyFinancialAllocations),
  }),
);

export const historicalDocumentsRelations = relations(
  historicalDocuments,
  ({ one }) => ({
    file: one(files, {
      fields: [historicalDocuments.fileId],
      references: [files.id],
    }),
    patient: one(patients, {
      fields: [historicalDocuments.patientId],
      references: [patients.id],
    }),
    labReport: one(externalLabReports, {
      fields: [historicalDocuments.labReportId],
      references: [externalLabReports.id],
    }),
    prescription: one(externalPrescriptions, {
      fields: [historicalDocuments.prescriptionId],
      references: [externalPrescriptions.id],
    }),
    appointment: one(historicalAppointments, {
      fields: [historicalDocuments.historicalAppointmentId],
      references: [historicalAppointments.id],
    }),
    financialDocument: one(legacyFinancialDocuments, {
      fields: [historicalDocuments.financialDocumentId],
      references: [legacyFinancialDocuments.id],
    }),
  }),
);
