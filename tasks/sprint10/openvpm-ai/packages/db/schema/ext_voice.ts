import {
  pgTable,
  pgEnum,
  pgView,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
    revision: integer("revision").notNull().default(0),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // GDPR: audio sa automaticky maže po 24 hodinách
    audioDeletedAt: timestamp("audio_deleted_at", { withTimezone: true }),
    // GDPR: plánovaný čas zmazania surového audia (nastavený pri vytvorení záznamu = now + 24h).
    // Nullable/aditívny stĺpec – staršie záznamy sa čistia podľa completedAt.
    scheduledDeleteAt: timestamp("scheduled_delete_at", { withTimezone: true }),
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

/**
 * `voice_dictations.audio_duration_seconds` is an upstream `text` column (e.g.
 * "45.3"). This extension view exposes it as `numeric` so dashboards can run
 * AVG/SUM without repeating the cast at every call site. The upstream column
 * is never mutated — the view lives only in the extension schema.
 */
export const voiceDictationDurationNumeric = pgView(
  "voice_dictation_duration_view",
).as((qb) =>
  qb
    .select({
      id: voiceDictations.id,
      durationSeconds:
        sql<number>`(${voiceDictations.audioDurationSeconds}::numeric)`.as(
          "duration_seconds",
        ),
    })
    .from(voiceDictations),
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
