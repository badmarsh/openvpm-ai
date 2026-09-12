import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";
import { appointments } from "./scheduling";

// ---------------------------------------------------------------------------
// Zubný záznam (dental chart) — stav a ošetrenie jednotlivých zubov
// FDI notácia (dvojciferný/štvorciferný kód zuba).
// ---------------------------------------------------------------------------
export const dentalConditionEnum = pgEnum("dental_condition", [
  "HEALTHY",    // Zdravý
  "MISSING",    // Chýbajúci
  "FRACTURED",  // Zlomený
  "DECAYED",    // Kazivý
  "MOBILE",     // Vratký
  "ABRADED",    // Obrúsený
  "CROWNED",    // Korunka
  "OTHER",      // Iné
]);

export const dentalCharts = pgTable(
  "dental_charts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    veterinarianId: uuid("veterinarian_id")
      .notNull()
      .references(() => users.id),

    // FDI notácia zuba, napr. "104" (pravý horný štvrtý zub)
    toothCode: varchar("tooth_code", { length: 16 }).notNull(),
    chartedAt: date("charted_at").notNull(),
    condition: dentalConditionEnum("condition").notNull().default("HEALTHY"),
    treatment: text("treatment"),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("dental_charts_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("dental_charts_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt
    ),
    toothIdx: index("dental_charts_tooth_idx").on(
      table.practiceId,
      table.patientId,
      table.toothCode
    ),
  })
);

export const dentalChartsRelations = relations(dentalCharts, ({ one }) => ({
  practice: one(practices, {
    fields: [dentalCharts.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [dentalCharts.patientId],
    references: [patients.id],
  }),
  veterinarian: one(users, {
    fields: [dentalCharts.veterinarianId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [dentalCharts.appointmentId],
    references: [appointments.id],
  }),
}));
