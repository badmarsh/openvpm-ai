import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";

/**
 * Table: ext_clinical_guardian_alerts
 * Clinical Guardian alerts: medication safety, contraindications, statutory deadlines, vet intelligence.
 */
export const extClinicalGuardianAlerts = pgTable(
  "ext_clinical_guardian_alerts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .references(() => patients.id),
    encounterId: uuid("encounter_id"),
    category: text("category").notNull(), // 'medication_safety' | 'statutory_deadline' | 'vet_intelligence'
    severity: text("severity").notNull(), // 'critical' | 'warning' | 'info'
    title: text("title").notNull(),
    message: text("message").notNull(),
    suggestedAction: text("suggested_action"),
    status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'dismissed'
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    practiceIdx: index("ext_cg_alerts_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    patientIdx: index("ext_cg_alerts_patient_idx").on(
      table.patientId,
      table.deletedAt,
    ),
    statusIdx: index("ext_cg_alerts_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
    categoryIdx: index("ext_cg_alerts_category_idx").on(
      table.practiceId,
      table.category,
      table.deletedAt,
    ),
  }),
);

export type ExtClinicalGuardianAlert = typeof extClinicalGuardianAlerts.$inferSelect;
export type NewExtClinicalGuardianAlert = typeof extClinicalGuardianAlerts.$inferInsert;
