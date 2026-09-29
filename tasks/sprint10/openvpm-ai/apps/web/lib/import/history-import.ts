import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  clientContacts,
  clients,
  externalLabObservations,
  externalLabReports,
  externalPrescriptionFills,
  externalPrescriptions,
  historicalAppointments,
  legacyFinancialAllocations,
  legacyFinancialDocuments,
  legacyFinancialLineItems,
  legacyFinancialPayments,
  migrationRuns,
  patients,
  practices,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { migrationImportFingerprint } from "./fingerprint";
import type {
  ClientContactImportRecord,
  ExternalLabObservationImportRecord,
  ExternalLabReportImportRecord,
  ExternalPrescriptionFillImportRecord,
  ExternalPrescriptionImportRecord,
  HistoricalAppointmentImportRecord,
  LegacyFinancialAllocationImportRecord,
  LegacyFinancialDocumentImportRecord,
  LegacyFinancialLineItemImportRecord,
  LegacyFinancialPaymentImportRecord,
  ShepherdHistoryAdaptation,
} from "./shepherd-history-adapter";

export const HISTORY_IMPORT_PLAN_VERSION = "history-v1";

type HistoryDomain =
  | "client_contacts"
  | "historical_appointments"
  | "external_prescriptions"
  | "external_prescription_fills"
  | "external_lab_reports"
  | "external_lab_observations"
  | "legacy_financial_documents"
  | "legacy_financial_line_items"
  | "legacy_financial_payments"
  | "legacy_financial_allocations";

type HistoryInput = Pick<
  ShepherdHistoryAdaptation,
  | "clientContacts"
  | "historicalAppointments"
  | "externalPrescriptions"
  | "externalPrescriptionFills"
  | "externalLabReports"
  | "externalLabObservations"
  | "legacyFinancialDocuments"
  | "legacyFinancialLineItems"
  | "legacyFinancialPayments"
  | "legacyFinancialAllocations"
>;

export interface HistoryImportError {
  domain: HistoryDomain;
  rowIndex: number;
  code:
    | "missing_client"
    | "missing_patient"
    | "missing_parent"
    | "source_identity_conflict"
    | "fingerprint_conflict"
    | "existing_record_deleted";
}

interface PlannedDomain {
  mode: HistoryDomain;
  sourceRows: number;
  rows: Record<string, unknown>[];
  duplicateCount: number;
  unmatchedCount: number;
  errors: HistoryImportError[];
  sourcePayloadHash: string;
  sourcePayloadSizeBytes: number;
}

export interface HistoricalImportPlan {
  version: typeof HISTORY_IMPORT_PLAN_VERSION;
  practiceId: string;
  source: string;
  planHash: string;
  ready: boolean;
  totals: {
    sourceRows: number;
    plannedInsertCount: number;
    duplicateCount: number;
    unmatchedCount: number;
    errorCount: number;
  };
  domains: Array<{
    mode: HistoryDomain;
    sourceRows: number;
    plannedInsertCount: number;
    duplicateCount: number;
    unmatchedCount: number;
    errorCount: number;
    sourcePayloadHash: string;
  }>;
  errors: HistoryImportError[];
  /** Internal insert plan. Never serialize this property into shared evidence. */
  _domains: PlannedDomain[];
}

export interface HistoricalImportCommitResult {
  planHash: string;
  alreadyCommitted: boolean;
  importedCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  byDomain: Record<HistoryDomain, number>;
}

export class HistoricalImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalImportError";
  }
}

type ExistingIdentity = {
  id: string;
  externalId: string;
  importFingerprint: string;
  deletedAt: Date | null;
};

type IdentityState = {
  byExternalId: Map<string, ExistingIdentity>;
  byFingerprint: Map<string, ExistingIdentity>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalPayload(records: readonly unknown[]): {
  hash: string;
  size: number;
} {
  const payload = JSON.stringify(records);
  return {
    hash: sha256(payload),
    size: Math.max(1, Buffer.byteLength(payload, "utf8")),
  };
}

function value(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function recordFingerprint(
  mode: HistoryDomain,
  source: string,
  externalId: string,
  fields: readonly unknown[],
): string {
  return migrationImportFingerprint(mode, [
    source,
    externalId,
    ...fields.map(value),
  ]);
}

async function existingIdentityState(
  db: Database,
  table: any,
  practiceId: string,
  source: string,
): Promise<IdentityState> {
  const rows = (await db
    .select({
      id: table.id,
      externalId: table.externalId,
      importFingerprint: table.importFingerprint,
      deletedAt: table.deletedAt,
    })
    .from(table)
    .where(
      and(eq(table.practiceId, practiceId), eq(table.externalSource, source)),
    )) as ExistingIdentity[];
  return {
    byExternalId: new Map(rows.map((row) => [row.externalId, row])),
    byFingerprint: new Map(rows.map((row) => [row.importFingerprint, row])),
  };
}

function classifyIdentity(
  domain: HistoryDomain,
  rowIndex: number,
  externalId: string,
  fingerprint: string,
  state: IdentityState,
  errors: HistoryImportError[],
): "insert" | "duplicate" | "error" {
  const external = state.byExternalId.get(externalId);
  if (external) {
    if (external.deletedAt) {
      errors.push({ domain, rowIndex, code: "existing_record_deleted" });
      return "error";
    }
    if (external.importFingerprint === fingerprint) return "duplicate";
    errors.push({ domain, rowIndex, code: "source_identity_conflict" });
    return "error";
  }
  const samePayload = state.byFingerprint.get(fingerprint);
  if (samePayload) {
    if (samePayload.deletedAt) {
      errors.push({ domain, rowIndex, code: "existing_record_deleted" });
      return "error";
    }
    errors.push({ domain, rowIndex, code: "fingerprint_conflict" });
    return "error";
  }
  return "insert";
}

function addPlannedIdentity(
  state: IdentityState,
  id: string,
  externalId: string,
  fingerprint: string,
) {
  const row = { id, externalId, importFingerprint: fingerprint, deletedAt: null };
  state.byExternalId.set(externalId, row);
  state.byFingerprint.set(fingerprint, row);
}

async function importedOwnerMap(
  db: Database,
  table: any,
  practiceId: string,
  source: string,
): Promise<Map<string, string>> {
  const rows = (await db
    .select({ id: table.id, externalId: table.externalId })
    .from(table)
    .where(
      and(
        eq(table.practiceId, practiceId),
        eq(table.externalSource, source),
        isNull(table.deletedAt),
      ),
    )) as Array<{ id: string; externalId: string | null }>;
  return new Map(
    rows
      .filter((row): row is { id: string; externalId: string } => !!row.externalId)
      .map((row) => [row.externalId, row.id]),
  );
}

function domainPlan(
  mode: HistoryDomain,
  sourceRecords: readonly unknown[],
): PlannedDomain {
  const payload = canonicalPayload(sourceRecords);
  return {
    mode,
    sourceRows: sourceRecords.length,
    rows: [],
    duplicateCount: 0,
    unmatchedCount: 0,
    errors: [],
    sourcePayloadHash: payload.hash,
    sourcePayloadSizeBytes: payload.size,
  };
}

function date(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

function checkedId(
  map: Map<string, string>,
  externalId: string | undefined,
): string | null {
  return externalId ? (map.get(externalId) ?? null) : null;
}

function planHashFor(domains: PlannedDomain[], practiceId: string, source: string) {
  return sha256(
    JSON.stringify({
      version: HISTORY_IMPORT_PLAN_VERSION,
      practiceId,
      source,
      domains: domains.map((domain) => ({
        mode: domain.mode,
        sourceRows: domain.sourceRows,
        unmatched: domain.unmatchedCount,
        errors: domain.errors.map((error) => ({
          rowIndex: error.rowIndex,
          code: error.code,
        })),
        sourcePayloadHash: domain.sourcePayloadHash,
      })),
    }),
  );
}

export async function planHistoricalImport(
  db: Database,
  input: {
    practiceId: string;
    source: string;
    records: HistoryInput;
  },
): Promise<HistoricalImportPlan> {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(input.source)) {
    throw new HistoricalImportError("Migration source is invalid.");
  }

  const clientIds = await importedOwnerMap(
    db,
    clients,
    input.practiceId,
    input.source,
  );
  const patientIds = await importedOwnerMap(
    db,
    patients,
    input.practiceId,
    input.source,
  );

  const contacts = domainPlan("client_contacts", input.records.clientContacts);
  const contactState = await existingIdentityState(
    db,
    clientContacts,
    input.practiceId,
    input.source,
  );
  input.records.clientContacts.forEach(
    (record: ClientContactImportRecord, rowIndex) => {
      const clientId = checkedId(clientIds, record.externalClientId);
      const unmatched = record.attributionStatus === "needs_review";
      if (unmatched) contacts.unmatchedCount++;
      if (!unmatched && !clientId) {
        contacts.errors.push({
          domain: contacts.mode,
          rowIndex,
          code: "missing_client",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        contacts.mode,
        input.source,
        record.externalContactId,
        [
          record.externalClientId,
          record.attributionStatus,
          record.kind,
          record.firstName,
          record.lastName,
          record.email?.toLowerCase(),
          record.phone,
        ],
      );
      const action = classifyIdentity(
        contacts.mode,
        rowIndex,
        record.externalContactId,
        fingerprint,
        contactState,
        contacts.errors,
      );
      if (action === "duplicate") {
        contacts.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      contacts.rows.push({
        id,
        practiceId: input.practiceId,
        clientId,
        attributionStatus: unmatched ? "needs_review" : "matched",
        kind: record.kind,
        firstName: record.firstName ?? null,
        lastName: record.lastName ?? null,
        email: record.email ?? null,
        phone: record.phone ?? null,
        externalSource: input.source,
        externalId: record.externalContactId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(contactState, id, record.externalContactId, fingerprint);
    },
  );

  const appointmentsPlan = domainPlan(
    "historical_appointments",
    input.records.historicalAppointments,
  );
  const appointmentState = await existingIdentityState(
    db,
    historicalAppointments,
    input.practiceId,
    input.source,
  );
  input.records.historicalAppointments.forEach(
    (record: HistoricalAppointmentImportRecord, rowIndex) => {
      const clientId = checkedId(clientIds, record.externalClientId);
      const patientId = checkedId(patientIds, record.externalPatientId);
      if (!clientId || !patientId) {
        appointmentsPlan.errors.push({
          domain: appointmentsPlan.mode,
          rowIndex,
          code: clientId ? "missing_patient" : "missing_client",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        appointmentsPlan.mode,
        input.source,
        record.externalAppointmentId,
        [
          record.externalClientId,
          record.externalPatientId,
          record.startedAt,
          record.endedAt,
          record.status,
          record.appointmentType,
          record.reason,
          record.notes,
        ],
      );
      const action = classifyIdentity(
        appointmentsPlan.mode,
        rowIndex,
        record.externalAppointmentId,
        fingerprint,
        appointmentState,
        appointmentsPlan.errors,
      );
      if (action === "duplicate") {
        appointmentsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      appointmentsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        patientId,
        clientId,
        startedAt: new Date(record.startedAt),
        endedAt: new Date(record.endedAt),
        status: record.status,
        appointmentType: record.appointmentType ?? null,
        reason: record.reason ?? null,
        notes: record.notes ?? null,
        externalSource: input.source,
        externalId: record.externalAppointmentId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(
        appointmentState,
        id,
        record.externalAppointmentId,
        fingerprint,
      );
    },
  );

  const prescriptionsPlan = domainPlan(
    "external_prescriptions",
    input.records.externalPrescriptions,
  );
  const prescriptionState = await existingIdentityState(
    db,
    externalPrescriptions,
    input.practiceId,
    input.source,
  );
  const prescriptionIds = new Map(
    [...prescriptionState.byExternalId].map(([externalId, row]) => [
      externalId,
      row.id,
    ]),
  );
  input.records.externalPrescriptions.forEach(
    (record: ExternalPrescriptionImportRecord, rowIndex) => {
      const patientId = checkedId(patientIds, record.externalPatientId);
      if (!patientId) {
        prescriptionsPlan.errors.push({
          domain: prescriptionsPlan.mode,
          rowIndex,
          code: "missing_patient",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        prescriptionsPlan.mode,
        input.source,
        record.externalPrescriptionId,
        [
          record.externalPatientId,
          record.medicationName,
          record.directions,
          record.quantity,
          record.refillCount,
          record.prescribedAt,
          record.expiresAt,
          record.status,
          record.isChronic,
        ],
      );
      const action = classifyIdentity(
        prescriptionsPlan.mode,
        rowIndex,
        record.externalPrescriptionId,
        fingerprint,
        prescriptionState,
        prescriptionsPlan.errors,
      );
      if (action === "duplicate") {
        prescriptionsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      prescriptionsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        patientId,
        medicationName: record.medicationName,
        directions: record.directions ?? null,
        quantity: record.quantity ?? null,
        refillCount: record.refillCount ?? null,
        prescribedAt: date(record.prescribedAt),
        expiresAt: date(record.expiresAt),
        status: record.status,
        isChronic: record.isChronic,
        reviewStatus: "unreviewed",
        externalSource: input.source,
        externalId: record.externalPrescriptionId,
        importFingerprint: fingerprint,
      });
      prescriptionIds.set(record.externalPrescriptionId, id);
      addPlannedIdentity(
        prescriptionState,
        id,
        record.externalPrescriptionId,
        fingerprint,
      );
    },
  );

  const fillsPlan = domainPlan(
    "external_prescription_fills",
    input.records.externalPrescriptionFills,
  );
  const fillState = await existingIdentityState(
    db,
    externalPrescriptionFills,
    input.practiceId,
    input.source,
  );
  input.records.externalPrescriptionFills.forEach(
    (record: ExternalPrescriptionFillImportRecord, rowIndex) => {
      const prescriptionId = prescriptionIds.get(record.externalPrescriptionId);
      if (!prescriptionId) {
        fillsPlan.errors.push({
          domain: fillsPlan.mode,
          rowIndex,
          code: "missing_parent",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        fillsPlan.mode,
        input.source,
        record.externalFillId,
        [
          record.externalPrescriptionId,
          record.filledAt,
          record.quantityDispensed,
          record.directions,
          record.sourceStatus,
        ],
      );
      const action = classifyIdentity(
        fillsPlan.mode,
        rowIndex,
        record.externalFillId,
        fingerprint,
        fillState,
        fillsPlan.errors,
      );
      if (action === "duplicate") {
        fillsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      fillsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        prescriptionId,
        filledAt: date(record.filledAt),
        quantityDispensed: record.quantityDispensed ?? null,
        directions: record.directions ?? null,
        sourceStatus: record.sourceStatus ?? null,
        externalSource: input.source,
        externalId: record.externalFillId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(fillState, id, record.externalFillId, fingerprint);
    },
  );

  const labReportsPlan = domainPlan(
    "external_lab_reports",
    input.records.externalLabReports,
  );
  const labReportState = await existingIdentityState(
    db,
    externalLabReports,
    input.practiceId,
    input.source,
  );
  const labReportIds = new Map(
    [...labReportState.byExternalId].map(([externalId, row]) => [
      externalId,
      row.id,
    ]),
  );
  input.records.externalLabReports.forEach(
    (record: ExternalLabReportImportRecord, rowIndex) => {
      const patientId = checkedId(patientIds, record.externalPatientId);
      const unmatched = record.attributionStatus === "needs_review";
      if (unmatched) labReportsPlan.unmatchedCount++;
      if (!unmatched && !patientId) {
        labReportsPlan.errors.push({
          domain: labReportsPlan.mode,
          rowIndex,
          code: "missing_patient",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        labReportsPlan.mode,
        input.source,
        record.externalLabReportId,
        [
          record.externalPatientId,
          record.attributionStatus,
          record.orderedAt,
          record.resultedAt,
          record.status,
          record.orderName,
          record.accessionNumber,
          record.summary,
        ],
      );
      const action = classifyIdentity(
        labReportsPlan.mode,
        rowIndex,
        record.externalLabReportId,
        fingerprint,
        labReportState,
        labReportsPlan.errors,
      );
      if (action === "duplicate") {
        labReportsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      labReportsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        patientId,
        attributionStatus: unmatched ? "needs_review" : "matched",
        orderedAt: date(record.orderedAt),
        resultedAt: date(record.resultedAt),
        status: record.status,
        orderName: record.orderName ?? null,
        accessionNumber: record.accessionNumber ?? null,
        summary: record.summary ?? null,
        reviewStatus: "unreviewed",
        externalSource: input.source,
        externalId: record.externalLabReportId,
        importFingerprint: fingerprint,
      });
      labReportIds.set(record.externalLabReportId, id);
      addPlannedIdentity(
        labReportState,
        id,
        record.externalLabReportId,
        fingerprint,
      );
    },
  );

  const observationsPlan = domainPlan(
    "external_lab_observations",
    input.records.externalLabObservations,
  );
  const observationState = await existingIdentityState(
    db,
    externalLabObservations,
    input.practiceId,
    input.source,
  );
  input.records.externalLabObservations.forEach(
    (record: ExternalLabObservationImportRecord, rowIndex) => {
      const reportId = labReportIds.get(record.externalLabReportId);
      if (!reportId) {
        observationsPlan.errors.push({
          domain: observationsPlan.mode,
          rowIndex,
          code: "missing_parent",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        observationsPlan.mode,
        input.source,
        record.externalObservationId,
        [
          record.externalLabReportId,
          record.sortOrder,
          record.name,
          record.value,
          record.unit,
          record.referenceRange,
          record.flag,
        ],
      );
      const action = classifyIdentity(
        observationsPlan.mode,
        rowIndex,
        record.externalObservationId,
        fingerprint,
        observationState,
        observationsPlan.errors,
      );
      if (action === "duplicate") {
        observationsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      observationsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        reportId,
        sortOrder: record.sortOrder,
        name: record.name,
        value: record.value ?? null,
        unit: record.unit ?? null,
        referenceRange: record.referenceRange ?? null,
        flag: record.flag ?? null,
        externalSource: input.source,
        externalId: record.externalObservationId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(
        observationState,
        id,
        record.externalObservationId,
        fingerprint,
      );
    },
  );

  const documentsPlan = domainPlan(
    "legacy_financial_documents",
    input.records.legacyFinancialDocuments,
  );
  const documentState = await existingIdentityState(
    db,
    legacyFinancialDocuments,
    input.practiceId,
    input.source,
  );
  const documentIds = new Map(
    [...documentState.byExternalId].map(([externalId, row]) => [
      externalId,
      row.id,
    ]),
  );
  input.records.legacyFinancialDocuments.forEach(
    (record: LegacyFinancialDocumentImportRecord, rowIndex) => {
      const clientId = checkedId(clientIds, record.externalClientId);
      const patientId = checkedId(patientIds, record.externalPatientId);
      if (!clientId || (record.externalPatientId && !patientId)) {
        documentsPlan.errors.push({
          domain: documentsPlan.mode,
          rowIndex,
          code: clientId ? "missing_patient" : "missing_client",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        documentsPlan.mode,
        input.source,
        record.externalDocumentId,
        [
          record.externalClientId,
          record.externalPatientId,
          record.documentType,
          record.documentNumber,
          record.issuedAt,
          record.status,
          record.subtotal,
          record.tax,
          record.discount,
          record.total,
          record.paidAmount,
          record.balance,
          record.sourceStatus,
        ],
      );
      const action = classifyIdentity(
        documentsPlan.mode,
        rowIndex,
        record.externalDocumentId,
        fingerprint,
        documentState,
        documentsPlan.errors,
      );
      if (action === "duplicate") {
        documentsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      documentsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        clientId,
        patientId,
        documentType: record.documentType,
        documentNumber: record.documentNumber ?? null,
        issuedAt: new Date(record.issuedAt),
        status: record.status,
        subtotal: record.subtotal,
        tax: record.tax,
        discount: record.discount,
        total: record.total,
        paidAmount: record.paidAmount,
        balance: record.balance,
        sourceStatus: record.sourceStatus ?? null,
        externalSource: input.source,
        externalId: record.externalDocumentId,
        importFingerprint: fingerprint,
      });
      documentIds.set(record.externalDocumentId, id);
      addPlannedIdentity(
        documentState,
        id,
        record.externalDocumentId,
        fingerprint,
      );
    },
  );

  const lineItemsPlan = domainPlan(
    "legacy_financial_line_items",
    input.records.legacyFinancialLineItems,
  );
  const lineItemState = await existingIdentityState(
    db,
    legacyFinancialLineItems,
    input.practiceId,
    input.source,
  );
  input.records.legacyFinancialLineItems.forEach(
    (record: LegacyFinancialLineItemImportRecord, rowIndex) => {
      const documentId = documentIds.get(record.externalDocumentId);
      const patientId = checkedId(patientIds, record.externalPatientId);
      if (!documentId || (record.externalPatientId && !patientId)) {
        lineItemsPlan.errors.push({
          domain: lineItemsPlan.mode,
          rowIndex,
          code: documentId ? "missing_patient" : "missing_parent",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        lineItemsPlan.mode,
        input.source,
        record.externalLineItemId,
        [
          record.externalDocumentId,
          record.externalPatientId,
          record.sortOrder,
          record.description,
          record.quantity,
          record.unitPrice,
          record.subtotal,
          record.tax,
          record.discount,
          record.total,
        ],
      );
      const action = classifyIdentity(
        lineItemsPlan.mode,
        rowIndex,
        record.externalLineItemId,
        fingerprint,
        lineItemState,
        lineItemsPlan.errors,
      );
      if (action === "duplicate") {
        lineItemsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      lineItemsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        documentId,
        patientId,
        sortOrder: record.sortOrder,
        description: record.description,
        quantity: record.quantity,
        unitPrice: record.unitPrice,
        subtotal: record.subtotal,
        tax: record.tax,
        discount: record.discount,
        total: record.total,
        externalSource: input.source,
        externalId: record.externalLineItemId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(
        lineItemState,
        id,
        record.externalLineItemId,
        fingerprint,
      );
    },
  );

  const paymentsPlan = domainPlan(
    "legacy_financial_payments",
    input.records.legacyFinancialPayments,
  );
  const paymentState = await existingIdentityState(
    db,
    legacyFinancialPayments,
    input.practiceId,
    input.source,
  );
  const paymentIds = new Map(
    [...paymentState.byExternalId].map(([externalId, row]) => [
      externalId,
      row.id,
    ]),
  );
  input.records.legacyFinancialPayments.forEach(
    (record: LegacyFinancialPaymentImportRecord, rowIndex) => {
      const clientId = checkedId(clientIds, record.externalClientId);
      const unmatched = record.attributionStatus === "needs_review";
      if (unmatched) paymentsPlan.unmatchedCount++;
      if (!unmatched && !clientId) {
        paymentsPlan.errors.push({
          domain: paymentsPlan.mode,
          rowIndex,
          code: "missing_client",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        paymentsPlan.mode,
        input.source,
        record.externalPaymentId,
        [
          record.externalClientId,
          record.attributionStatus,
          record.entryType,
          record.amount,
          record.receivedAt,
          record.method,
          record.sourceStatus,
          record.reference,
          record.note,
        ],
      );
      const action = classifyIdentity(
        paymentsPlan.mode,
        rowIndex,
        record.externalPaymentId,
        fingerprint,
        paymentState,
        paymentsPlan.errors,
      );
      if (action === "duplicate") {
        paymentsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      paymentsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        clientId,
        attributionStatus: unmatched ? "needs_review" : "matched",
        entryType: record.entryType,
        amount: record.amount,
        receivedAt: new Date(record.receivedAt),
        method: record.method ?? null,
        sourceStatus: record.sourceStatus ?? null,
        reference: record.reference ?? null,
        note: record.note ?? null,
        externalSource: input.source,
        externalId: record.externalPaymentId,
        importFingerprint: fingerprint,
      });
      paymentIds.set(record.externalPaymentId, id);
      addPlannedIdentity(
        paymentState,
        id,
        record.externalPaymentId,
        fingerprint,
      );
    },
  );

  const allocationsPlan = domainPlan(
    "legacy_financial_allocations",
    input.records.legacyFinancialAllocations,
  );
  const allocationState = await existingIdentityState(
    db,
    legacyFinancialAllocations,
    input.practiceId,
    input.source,
  );
  input.records.legacyFinancialAllocations.forEach(
    (record: LegacyFinancialAllocationImportRecord, rowIndex) => {
      const documentId = documentIds.get(record.externalDocumentId);
      const paymentId = paymentIds.get(record.externalPaymentId);
      if (!documentId || !paymentId) {
        allocationsPlan.errors.push({
          domain: allocationsPlan.mode,
          rowIndex,
          code: "missing_parent",
        });
        return;
      }
      const fingerprint = recordFingerprint(
        allocationsPlan.mode,
        input.source,
        record.externalAllocationId,
        [
          record.externalDocumentId,
          record.externalPaymentId,
          record.amount,
          record.allocatedAt,
          record.description,
        ],
      );
      const action = classifyIdentity(
        allocationsPlan.mode,
        rowIndex,
        record.externalAllocationId,
        fingerprint,
        allocationState,
        allocationsPlan.errors,
      );
      if (action === "duplicate") {
        allocationsPlan.duplicateCount++;
        return;
      }
      if (action === "error") return;
      const id = randomUUID();
      allocationsPlan.rows.push({
        id,
        practiceId: input.practiceId,
        documentId,
        paymentId,
        amount: record.amount,
        allocatedAt: date(record.allocatedAt),
        description: record.description ?? null,
        externalSource: input.source,
        externalId: record.externalAllocationId,
        importFingerprint: fingerprint,
      });
      addPlannedIdentity(
        allocationState,
        id,
        record.externalAllocationId,
        fingerprint,
      );
    },
  );

  const domains = [
    contacts,
    appointmentsPlan,
    prescriptionsPlan,
    fillsPlan,
    labReportsPlan,
    observationsPlan,
    documentsPlan,
    lineItemsPlan,
    paymentsPlan,
    allocationsPlan,
  ];
  const errors = domains.flatMap((domain) => domain.errors);
  const totals = domains.reduce(
    (result, domain) => ({
      sourceRows: result.sourceRows + domain.sourceRows,
      plannedInsertCount: result.plannedInsertCount + domain.rows.length,
      duplicateCount: result.duplicateCount + domain.duplicateCount,
      unmatchedCount: result.unmatchedCount + domain.unmatchedCount,
      errorCount: result.errorCount + domain.errors.length,
    }),
    {
      sourceRows: 0,
      plannedInsertCount: 0,
      duplicateCount: 0,
      unmatchedCount: 0,
      errorCount: 0,
    },
  );
  return {
    version: HISTORY_IMPORT_PLAN_VERSION,
    practiceId: input.practiceId,
    source: input.source,
    planHash: planHashFor(domains, input.practiceId, input.source),
    ready: errors.length === 0,
    totals,
    domains: domains.map((domain) => ({
      mode: domain.mode,
      sourceRows: domain.sourceRows,
      plannedInsertCount: domain.rows.length,
      duplicateCount: domain.duplicateCount,
      unmatchedCount: domain.unmatchedCount,
      errorCount: domain.errors.length,
      sourcePayloadHash: domain.sourcePayloadHash,
    })),
    errors,
    _domains: domains,
  };
}

const TABLE_BY_DOMAIN: Record<HistoryDomain, any> = {
  client_contacts: clientContacts,
  historical_appointments: historicalAppointments,
  external_prescriptions: externalPrescriptions,
  external_prescription_fills: externalPrescriptionFills,
  external_lab_reports: externalLabReports,
  external_lab_observations: externalLabObservations,
  legacy_financial_documents: legacyFinancialDocuments,
  legacy_financial_line_items: legacyFinancialLineItems,
  legacy_financial_payments: legacyFinancialPayments,
  legacy_financial_allocations: legacyFinancialAllocations,
};

async function insertChunks(
  db: Database,
  table: any,
  rows: Record<string, unknown>[],
) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    await db.insert(table).values(rows.slice(offset, offset + 500) as any);
  }
}

/**
 * Commit the exact reviewed plan under the practice recovery hold. This path
 * never mutates live scheduling, accounts receivable, inventory, consent, or
 * provider state; it only appends source-attributed archive records.
 */
export async function commitHistoricalImport(
  db: Database,
  input: {
    practiceId: string;
    actorId: string;
    source: string;
    expectedPlanHash: string;
    records: HistoryInput;
  },
): Promise<HistoricalImportCommitResult> {
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const [practice] = await database
      .select({ id: practices.id, recoveryHold: practices.recoveryHold })
      .from(practices)
      .where(
        and(eq(practices.id, input.practiceId), isNull(practices.deletedAt)),
      )
      .limit(1)
      .for("update");
    if (!practice) throw new HistoricalImportError("Practice not found.");
    if (!practice.recoveryHold) {
      throw new HistoricalImportError(
        "Historical migration requires an active practice recovery hold.",
      );
    }

    const plan = await planHistoricalImport(database, input);
    if (!plan.ready) {
      throw new HistoricalImportError(
        "Historical migration plan contains unresolved structural errors.",
      );
    }
    if (plan.planHash !== input.expectedPlanHash) {
      throw new HistoricalImportError(
        "Historical migration plan changed after review.",
      );
    }

    const byDomain = Object.fromEntries(
      plan._domains.map((domain) => [domain.mode, 0]),
    ) as Record<HistoryDomain, number>;
    const now = new Date();
    let alreadyCommitted = true;

    for (const domain of plan._domains) {
      if (domain.sourceRows === 0) continue;
      const [prior] = await database
        .select({ id: migrationRuns.id })
        .from(migrationRuns)
        .where(
          and(
            eq(migrationRuns.practiceId, input.practiceId),
            eq(migrationRuns.mode, domain.mode),
            eq(migrationRuns.source, input.source),
            eq(migrationRuns.fileHash, domain.sourcePayloadHash),
            eq(migrationRuns.status, "committed"),
            isNull(migrationRuns.deletedAt),
          ),
        )
        .limit(1);
      if (prior) {
        if (domain.rows.length !== 0) {
          throw new HistoricalImportError(
            "Committed migration evidence does not match current archive rows.",
          );
        }
        continue;
      }

      alreadyCommitted = false;
      await insertChunks(database, TABLE_BY_DOMAIN[domain.mode], domain.rows);
      byDomain[domain.mode] = domain.rows.length;
      await database.insert(migrationRuns).values({
        id: randomUUID(),
        practiceId: input.practiceId,
        createdBy: input.actorId,
        committedBy: input.actorId,
        mode: domain.mode,
        source: input.source,
        fileHash: domain.sourcePayloadHash,
        reviewedPlanHash: plan.planHash,
        fileSizeBytes: domain.sourcePayloadSizeBytes,
        status: "committed",
        sourceRowCount: domain.sourceRows,
        plannedInsertCount: domain.rows.length,
        duplicateCount: domain.duplicateCount,
        unmatchedCount: domain.unmatchedCount,
        errorCount: domain.errors.length,
        importedCount: domain.rows.length,
        previewExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        committedAt: now,
      });
    }

    return {
      planHash: plan.planHash,
      alreadyCommitted,
      importedCount: Object.values(byDomain).reduce(
        (sum, count) => sum + count,
        0,
      ),
      duplicateCount: plan.totals.duplicateCount,
      unmatchedCount: plan.totals.unmatchedCount,
      byDomain,
    };
  });
}
