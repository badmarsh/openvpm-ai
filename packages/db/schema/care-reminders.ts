import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { patients } from "./patients";
import { practices } from "./practices";
import { users } from "./users";

export const careReminderStatusEnum = pgEnum("care_reminder_status", [
  "open",
  "completed",
  "dismissed",
]);

/**
 * General patient follow-up work that is not necessarily an appointment or a
 * vaccination recall. A reminder is an internal clinic task only: inserting a
 * row never sends email or SMS and never creates client consent evidence.
 *
 * Imported reminders retain source-scoped identity and a payload fingerprint
 * so retries converge without attributing historical work to an OpenVPM user.
 */
export const careReminders = pgTable(
  "care_reminders",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    notes: text("notes"),
    dueDate: date("due_date").notNull(),
    status: careReminderStatusEnum("status").notNull().default("open"),
    createdBy: uuid("created_by"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissedBy: uuid("dismissed_by"),
    dismissalReason: varchar("dismissal_reason", { length: 500 }),
    externalSource: varchar("external_source", { length: 64 }),
    externalId: varchar("external_id", { length: 160 }),
    importFingerprint: varchar("import_fingerprint", { length: 64 }),
  },
  (table) => ({
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "care_reminders_patient_tenant_fk",
    }),
    creatorTenantFk: foreignKey({
      columns: [table.practiceId, table.createdBy],
      foreignColumns: [users.practiceId, users.id],
      name: "care_reminders_creator_tenant_fk",
    }),
    completerTenantFk: foreignKey({
      columns: [table.practiceId, table.completedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "care_reminders_completer_tenant_fk",
    }),
    dismisserTenantFk: foreignKey({
      columns: [table.practiceId, table.dismissedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "care_reminders_dismisser_tenant_fk",
    }),
    externalIdUq: uniqueIndex("care_reminders_external_id_uq")
      .on(table.practiceId, table.externalSource, table.externalId)
      .where(
        sql`${table.externalSource} is not null and ${table.externalId} is not null`,
      ),
    importFingerprintUq: uniqueIndex("care_reminders_import_fingerprint_uq")
      .on(table.practiceId, table.importFingerprint)
      .where(sql`${table.importFingerprint} is not null`),
    openDueIdx: index("care_reminders_open_due_idx")
      .on(table.practiceId, table.dueDate, table.id)
      .where(sql`${table.status} = 'open' and ${table.deletedAt} is null`),
    patientTimelineIdx: index("care_reminders_patient_timeline_idx").on(
      table.practiceId,
      table.patientId,
      table.dueDate,
      table.id,
    ),
    notesLengthCheck: check(
      "care_reminders_notes_length_check",
      sql`${table.notes} is null or char_length(${table.notes}) <= 4000`,
    ),
    stateCheck: check(
      "care_reminders_state_check",
      sql`(
          ${table.status} = 'open'
          and ${table.completedAt} is null
          and ${table.completedBy} is null
          and ${table.dismissedAt} is null
          and ${table.dismissedBy} is null
          and ${table.dismissalReason} is null
        ) or (
          ${table.status} = 'completed'
          and ${table.completedAt} is not null
          and ${table.completedBy} is not null
          and ${table.dismissedAt} is null
          and ${table.dismissedBy} is null
          and ${table.dismissalReason} is null
        ) or (
          ${table.status} = 'dismissed'
          and ${table.completedAt} is null
          and ${table.completedBy} is null
          and ${table.dismissedAt} is not null
          and ${table.dismissedBy} is not null
          and char_length(btrim(${table.dismissalReason})) between 3 and 500
        )`,
    ),
    dismissalReasonCheck: check(
      "care_reminders_dismissal_reason_check",
      sql`${table.dismissalReason} is null or char_length(btrim(${table.dismissalReason})) between 3 and 500`,
    ),
    externalIdentityPairCheck: check(
      "care_reminders_external_identity_pair_check",
      sql`(${table.externalSource} is null) = (${table.externalId} is null)`,
    ),
    importIdentityCheck: check(
      "care_reminders_import_identity_check",
      sql`(
          ${table.externalSource} is null
          and ${table.externalId} is null
          and ${table.importFingerprint} is null
          and ${table.createdBy} is not null
        ) or (
          ${table.externalSource} is not null
          and ${table.externalId} is not null
          and ${table.importFingerprint} is not null
        )`,
    ),
    importFingerprintCheck: check(
      "care_reminders_import_fingerprint_check",
      sql`${table.importFingerprint} is null or ${table.importFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    externalSourceCheck: check(
      "care_reminders_external_source_check",
      sql`${table.externalSource} is null or ${table.externalSource} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`,
    ),
  }),
);

export const careRemindersRelations = relations(careReminders, ({ one }) => ({
  practice: one(practices, {
    fields: [careReminders.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [careReminders.patientId],
    references: [patients.id],
  }),
  creator: one(users, {
    fields: [careReminders.createdBy],
    references: [users.id],
    relationName: "careReminderCreator",
  }),
  completer: one(users, {
    fields: [careReminders.completedBy],
    references: [users.id],
    relationName: "careReminderCompleter",
  }),
  dismisser: one(users, {
    fields: [careReminders.dismissedBy],
    references: [users.id],
    relationName: "careReminderDismisser",
  }),
}));
