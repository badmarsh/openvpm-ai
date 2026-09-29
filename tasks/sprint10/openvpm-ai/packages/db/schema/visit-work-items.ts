import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { appointments } from "./scheduling";
import { labResults, procedures, vaccinationRecords } from "./clinical";
import { prescriptions } from "./prescriptions";
import { invoiceItems, invoices } from "./billing";
import { users } from "./users";

export const visitWorkStatusEnum = pgEnum("visit_work_status", [
  "unresolved",
  "charged",
  "no_charge",
  "voided",
]);

/**
 * PII-safe revenue reconciliation for work documented during a visit. The
 * clinical label stays on its source record; this table keeps only durable
 * identities, resolution state, and attribution.
 */
export const visitWorkItems = pgTable(
  "visit_work_items",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    vaccinationRecordId: uuid("vaccination_record_id").references(
      () => vaccinationRecords.id,
    ),
    labResultId: uuid("lab_result_id").references(() => labResults.id),
    procedureId: uuid("procedure_id").references(() => procedures.id),
    prescriptionId: uuid("prescription_id").references(() => prescriptions.id),
    status: visitWorkStatusEnum("status").notNull().default("unresolved"),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    invoiceItemId: uuid("invoice_item_id").references(() => invoiceItems.id),
    noChargeReason: text("no_charge_reason"),
    voidReason: text("void_reason"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    visitStatusIdx: index("visit_work_items_visit_status_idx").on(
      table.practiceId,
      table.appointmentId,
      table.status,
      table.createdAt,
      table.id,
    ),
    unresolvedIdx: index("visit_work_items_unresolved_idx")
      .on(table.practiceId, table.appointmentId, table.createdAt, table.id)
      .where(
        sql`${table.status} = 'unresolved' and ${table.deletedAt} is null`,
      ),
    vaccinationUq: uniqueIndex("visit_work_items_vaccination_uq")
      .on(table.practiceId, table.vaccinationRecordId)
      .where(
        sql`${table.vaccinationRecordId} is not null and ${table.deletedAt} is null`,
      ),
    labResultUq: uniqueIndex("visit_work_items_lab_result_uq")
      .on(table.practiceId, table.labResultId)
      .where(
        sql`${table.labResultId} is not null and ${table.deletedAt} is null`,
      ),
    procedureUq: uniqueIndex("visit_work_items_procedure_uq")
      .on(table.practiceId, table.procedureId)
      .where(
        sql`${table.procedureId} is not null and ${table.deletedAt} is null`,
      ),
    prescriptionUq: uniqueIndex("visit_work_items_prescription_uq")
      .on(table.practiceId, table.prescriptionId)
      .where(
        sql`${table.prescriptionId} is not null and ${table.deletedAt} is null`,
      ),
    invoiceItemUq: uniqueIndex("visit_work_items_invoice_item_uq")
      .on(table.invoiceItemId)
      .where(
        sql`${table.invoiceItemId} is not null and ${table.deletedAt} is null`,
      ),
    appointmentPracticeFk: foreignKey({
      columns: [table.practiceId, table.appointmentId],
      foreignColumns: [appointments.practiceId, appointments.id],
      name: "visit_work_items_practice_appointment_fk",
    }),
    vaccinationSourceFk: foreignKey({
      columns: [
        table.practiceId,
        table.appointmentId,
        table.vaccinationRecordId,
      ],
      foreignColumns: [
        vaccinationRecords.practiceId,
        vaccinationRecords.appointmentId,
        vaccinationRecords.id,
      ],
      name: "visit_work_items_vaccination_source_fk",
    }),
    labResultSourceFk: foreignKey({
      columns: [table.practiceId, table.appointmentId, table.labResultId],
      foreignColumns: [
        labResults.practiceId,
        labResults.appointmentId,
        labResults.id,
      ],
      name: "visit_work_items_lab_result_source_fk",
    }),
    procedureSourceFk: foreignKey({
      columns: [table.practiceId, table.appointmentId, table.procedureId],
      foreignColumns: [
        procedures.practiceId,
        procedures.appointmentId,
        procedures.id,
      ],
      name: "visit_work_items_procedure_source_fk",
    }),
    prescriptionSourceFk: foreignKey({
      columns: [table.practiceId, table.appointmentId, table.prescriptionId],
      foreignColumns: [
        prescriptions.practiceId,
        prescriptions.appointmentId,
        prescriptions.id,
      ],
      name: "visit_work_items_prescription_source_fk",
    }),
    invoiceVisitFk: foreignKey({
      columns: [table.practiceId, table.appointmentId, table.invoiceId],
      foreignColumns: [
        invoices.practiceId,
        invoices.appointmentId,
        invoices.id,
      ],
      name: "visit_work_items_invoice_visit_fk",
    }),
    invoiceItemFk: foreignKey({
      columns: [table.invoiceId, table.invoiceItemId],
      foreignColumns: [invoiceItems.invoiceId, invoiceItems.id],
      name: "visit_work_items_invoice_item_fk",
    }),
    exactlyOneSourceCheck: check(
      "visit_work_items_exactly_one_source_check",
      sql`num_nonnulls(
        ${table.vaccinationRecordId},
        ${table.labResultId},
        ${table.procedureId},
        ${table.prescriptionId}
      ) = 1`,
    ),
    resolutionCheck: check(
      "visit_work_items_resolution_check",
      sql`(
          ${table.status} = 'unresolved'
          and ${table.invoiceId} is null
          and ${table.invoiceItemId} is null
          and ${table.noChargeReason} is null
          and ${table.voidReason} is null
          and ${table.resolvedBy} is null
          and ${table.resolvedAt} is null
        ) or (
          ${table.status} = 'charged'
          and ${table.invoiceId} is not null
          and ${table.invoiceItemId} is not null
          and ${table.noChargeReason} is null
          and ${table.voidReason} is null
          and ${table.resolvedBy} is not null
          and ${table.resolvedAt} is not null
        ) or (
          ${table.status} = 'no_charge'
          and ${table.invoiceId} is null
          and ${table.invoiceItemId} is null
          and length(btrim(coalesce(${table.noChargeReason}, ''))) > 0
          and ${table.voidReason} is null
          and ${table.resolvedBy} is not null
          and ${table.resolvedAt} is not null
        ) or (
          ${table.status} = 'voided'
          and ${table.invoiceId} is null
          and ${table.invoiceItemId} is null
          and ${table.noChargeReason} is null
          and length(btrim(coalesce(${table.voidReason}, ''))) > 0
          and ${table.resolvedBy} is not null
          and ${table.resolvedAt} is not null
        )`,
    ),
  }),
);
