import { pgTable, pgEnum, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { files } from "./files";
import { users } from "./users";
import { appointments } from "./scheduling";

export const aiImagingStatusEnum = pgEnum("ai_imaging_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
]);

export const aiImagingImageTypeEnum = pgEnum("ai_imaging_image_type", [
  "xray",
  "ct",
  "mri",
  "ultrasound",
  "photo",
]);

export const aiImagingAnalyses = pgTable(
  "ai_imaging_analyses",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),

    modelId: text("model_id").notNull(),
    imageType: aiImagingImageTypeEnum("image_type").notNull(),
    analysisType: text("analysis_type").default("diagnosis"),
    userPrompt: text("user_prompt"),
    result: text("result"),
    rawResponse: jsonb("raw_response"),
    status: aiImagingStatusEnum("status").notNull().default("PENDING"),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    practiceIdx: index("ai_imaging_analyses_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    patientIdx: index("ai_imaging_analyses_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt,
    ),
    statusIdx: index("ai_imaging_analyses_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
    fileIdx: index("ai_imaging_analyses_file_idx").on(table.fileId),
  }),
);

export const aiImagingAnalysesRelations = relations(
  aiImagingAnalyses,
  ({ one }) => ({
    practice: one(practices, {
      fields: [aiImagingAnalyses.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [aiImagingAnalyses.patientId],
      references: [patients.id],
    }),
    file: one(files, {
      fields: [aiImagingAnalyses.fileId],
      references: [files.id],
    }),
    appointment: one(appointments, {
      fields: [aiImagingAnalyses.appointmentId],
      references: [appointments.id],
    }),
    requester: one(users, {
      fields: [aiImagingAnalyses.requestedBy],
      references: [users.id],
    }),
  }),
);