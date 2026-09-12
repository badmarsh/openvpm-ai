import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";

/**
 * KVEPIS (Komplexný veterinárny elektronický pas a informačný systém)
 * a ÚPVS (slovensko.sk) integrácia podľa Zákona č. 39/2007 Z. z. o veterinárnej starostlivosti.
 * 
 * Pokrýva:
 * 1. Ambulantnú knihu a záznamy o liečbe hospodárskych zvierat
 * 2. Oznámenia o očkovaní a podozrení na nákazy (besnota a i.)
 * 3. Procesy premiestňovania zvierat a sprievodné doklady
 */

export const kvepisSubmissionTypeEnum = pgEnum("kvepis_submission_type", [
  "rabies_notification",         // Hlásenie vakcinácie proti besnote na RVPS (lehota 3 dni)
  "treatment_diary_batch",       // Dávka záznamov z knihy ošetrení s ochrannými lehotami
  "animal_movement",             // Sprievodný doklad na premiestnenie / bitúnok
  "infectious_disease_alert",    // Hlásenie podozrenia na nebezpečnú nákazu
]);

export const kvepisSubmissionStatusEnum = pgEnum("kvepis_submission_status", [
  "DRAFT",                       // Rozpracované podanie
  "VALIDATED",                   // Úspešne skontrolované voči schéme ŠVPS
  "SIGNED",                      // Podpísané KEP (mandátny certifikát veterinára)
  "SUBMITTED",                   // Odoslané do elektronickej schránky / KVEPIS API
  "ACKNOWLEDGED",                // Prijaté ŠVPS, potvrdená doručenka
  "REJECTED",                    // Odmietnuté ŠVPS (validačná chyba alebo neplatný KEP)
]);

export const extKvepisSubmissions = pgTable(
  "ext_kvepis_submissions",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    submissionType: kvepisSubmissionTypeEnum("submission_type").notNull(),
    status: kvepisSubmissionStatusEnum("status").notNull().default("DRAFT"),

    patientId: uuid("patient_id").references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    visitId: uuid("visit_id"),
    vaccinationRecordId: uuid("vaccination_record_id"),
    statutoryRecordId: uuid("statutory_record_id"),

    /** Jedinečný identifikátor podania generovaný ambulanciou */
    submissionReference: varchar("submission_reference", { length: 64 }).notNull(),

    /** Evidenčné číslo / doručenka z ÚPVS alebo KVEPIS */
    receiptReference: varchar("receipt_reference", { length: 128 }),

    /** Kánonický XML payload určený na KEP podpisovanie */
    xmlPayload: text("xml_payload"),

    /** Štruktúrovaná JSON reprezentácia pre rýchle náhľady */
    jsonPayload: text("json_payload"),

    /** Kryptografický odtlačok (SHA-256) podpísaného formulára */
    signatureHash: varchar("signature_hash", { length: 128 }),

    signedById: uuid("signed_by_id").references(() => users.id),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    validationErrors: text("validation_errors"), // JSON string pole chýb
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("ext_kvepis_sub_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    statusIdx: index("ext_kvepis_sub_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt
    ),
    referenceIdx: index("ext_kvepis_sub_ref_idx").on(
      table.submissionReference
    ),
    typeIdx: index("ext_kvepis_sub_type_idx").on(
      table.practiceId,
      table.submissionType,
      table.deletedAt
    ),
  })
);

export const extKvepisCredentials = pgTable(
  "ext_kvepis_credentials",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    ico: varchar("ico", { length: 16 }).notNull(),
    dic: varchar("dic", { length: 16 }),
    kvlRegistrationNumber: varchar("kvl_registration_number", { length: 32 }).notNull(),
    rvpsCode: varchar("rvps_code", { length: 32 }).notNull(), // napr. "SK-RVPS-BA"
    upvsBoxId: varchar("upvs_box_id", { length: 64 }),        // Identifikátor schránky na slovensko.sk

    apiEndpoint: text("api_endpoint").notNull().default("https://portal.svps.sk/kvepis-api/v1"),
    isProduction: boolean("is_production").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    practiceIdx: index("ext_kvepis_cred_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

export const extKvepisSubmissionsRelations = relations(
  extKvepisSubmissions,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extKvepisSubmissions.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [extKvepisSubmissions.patientId],
      references: [patients.id],
    }),
    client: one(clients, {
      fields: [extKvepisSubmissions.clientId],
      references: [clients.id],
    }),
    signedBy: one(users, {
      fields: [extKvepisSubmissions.signedById],
      references: [users.id],
    }),
  })
);

export const extKvepisCredentialsRelations = relations(
  extKvepisCredentials,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extKvepisCredentials.practiceId],
      references: [practices.id],
    }),
  })
);
