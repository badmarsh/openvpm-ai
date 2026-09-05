import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";
import { appointments } from "./scheduling";

export const dischargeReportStatusEnum = pgEnum("discharge_report_status", [
  "draft",
  "finalized",
]);

export const dischargeReports = pgTable(
  "discharge_reports",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id").references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    petName: text("pet_name").notNull(),
    species: text("species"),
    diagnosis: text("diagnosis").notNull(),
    treatment: text("treatment"),
    followUp: text("follow_up"),

    reportText: text("report_text").notNull(),
    language: text("language").default("sk"),
    modelId: text("model_id"),
    status: dischargeReportStatusEnum("status").notNull().default("draft"),
  },
  (table) => ({
    practiceIdx: index("discharge_reports_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    patientIdx: index("discharge_reports_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt,
    ),
  }),
);

export const dischargeReportsRelations = relations(
  dischargeReports,
  ({ one }) => ({
    practice: one(practices, {
      fields: [dischargeReports.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [dischargeReports.patientId],
      references: [patients.id],
    }),
    appointment: one(appointments, {
      fields: [dischargeReports.appointmentId],
      references: [appointments.id],
    }),
    creator: one(users, {
      fields: [dischargeReports.createdBy],
      references: [users.id],
    }),
  }),
);
