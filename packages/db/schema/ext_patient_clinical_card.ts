import { pgTable, pgEnum, uuid, text, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";
import { clients } from "./clients";

/**
 * Clinical Card & Patient Detail Revamp (Sprint 31)
 * Slovak compliance: Zákon 39/2007 Z. z. (Human-in-the-Loop), Zákon 139/1998 Z. z. (controlled substances),
 * GDPR Sympathy Gate. Stores audit for dossier prints and sympathy transitions.
 */

export const dossierExportFormatEnum = pgEnum("dossier_export_format", ["pdf", "print"]);

export const extPatientDossierExports = pgTable(
  "ext_patient_dossier_exports",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    exportedBy: uuid("exported_by").references(() => users.id),
    format: dossierExportFormatEnum("format").notNull().default("pdf"),
    // snapshot hash for audit integrity
    contentHash: text("content_hash"),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    practicePatientIdx: index("ext_dossier_practice_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.exportedAt
    ),
    practiceCreatedIdx: index("ext_dossier_practice_created_idx").on(
      table.practiceId,
      table.exportedAt
    ),
  })
);

export const sympathyTransitionReasonEnum = pgEnum("sympathy_transition_reason", [
  "deceased",
  "euthanized",
  "transferred",
  "reactivated",
]);

export const extPatientSympathyTransitions = pgTable(
  "ext_patient_sympathy_transitions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    actorId: uuid("actor_id").references(() => users.id),
    previousStatus: text("previous_status").notNull(),
    newStatus: text("new_status").notNull(),
    reason: sympathyTransitionReasonEnum("reason").notNull(),
    // free-text confirmation detail (e.g. typed "POTVRDIŤ")
    confirmationDetail: text("confirmation_detail"),
    // whether suppression log was written (ext_automation_suppression_log)
    suppressionLogged: boolean("suppression_logged").notNull().default(false),
    transitionedAt: timestamp("transitioned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    practicePatientIdx: index("ext_sympathy_practice_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.transitionedAt
    ),
    practiceReasonIdx: index("ext_sympathy_practice_reason_idx").on(
      table.practiceId,
      table.reason,
      table.transitionedAt
    ),
    previousStatusCheck: sql`char_length(btrim(${table.previousStatus})) between 2 and 32`,
    newStatusCheck: sql`char_length(btrim(${table.newStatus})) between 2 and 32`,
  })
);
