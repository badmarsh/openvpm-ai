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

export const voiceDictationStatusEnum = pgEnum("voice_dictation_status", [
  "RECORDING",
  "TRANSCRIBING",
  "FORMATTING",
  "COMPLETED",
  "FAILED",
]);

export const voiceDictations = pgTable(
  "voice_dictations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    dictatedBy: uuid("dictated_by")
      .notNull()
      .references(() => users.id),

    // Audio
    audioFileKey: text("audio_file_key"),
    audioMimeType: text("audio_mime_type"),
    audioDurationSeconds: text("audio_duration_seconds"),

    // Transkripcia
    modelId: text("model_id").notNull(),
    rawTranscript: text("raw_transcript"),
    language: text("language").default("sk"),

    // SOAP výstup
    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),
    rawAiResponse: jsonb("raw_ai_response"),
    formattedSoap: jsonb("formatted_soap"),
    soapNoteId: uuid("soap_note_id"),
    formattedAt: timestamp("formatted_at", { withTimezone: true }),

    // Stav
    status: voiceDictationStatusEnum("status").notNull().default("RECORDING"),
    errorMessage: text("error_message"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // GDPR: audio sa automaticky maže po 24 hodinách
    audioDeletedAt: timestamp("audio_deleted_at", { withTimezone: true }),
  },
  (table) => ({
    practiceIdx: index("voice_dictations_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    patientIdx: index("voice_dictations_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt,
    ),
    statusIdx: index("voice_dictations_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
  }),
);

export const voiceDictationsRelations = relations(
  voiceDictations,
  ({ one }) => ({
    practice: one(practices, {
      fields: [voiceDictations.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [voiceDictations.patientId],
      references: [patients.id],
    }),
    appointment: one(appointments, {
      fields: [voiceDictations.appointmentId],
      references: [appointments.id],
    }),
    dictator: one(users, {
      fields: [voiceDictations.dictatedBy],
      references: [users.id],
    }),
  }),
);
