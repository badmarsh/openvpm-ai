import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";

/**
 * Slovak KVEPIS & ÚPVS Submission Hub
 * -----------------------------------
 * KVEPIS (Komplexný veterinárny elektronický program informačného systému) je
 * portál Štátnej veterinárnej a potravinovej správy SR (ŠVPS SR) pre elektronické
 * podávanie zákonných hlásení veterinárnych lekárov:
 *   - hlásenie o očkovaní / pozorovaní proti besnote (RVPS, 3-dňová lehota),
 *   - ambulantná kniha ošetrení hospodárskych zvierat,
 *   - hlásenie o premiestnení zvierat,
 *   - hlásenie podozrenia na nebezpečnú nákazu.
 *
 * Fáza 1 (táto schéma) implementuje "Guided Submission Hub": príprava, validácia,
 * generovanie podpisového XML/JSON balíčka, evidencia podpisu (D.Signer / cloudová
 * pečať / HSM) a párovanie doručenky z ÚPVS so záznamom pacienta. Fáza 2 (priamy
 * B2G konektor cez ÚPVS bránu s mandátnym certifikátom KEP) nadviaže na rovnaký
 * dátový model bez migračných zmien.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const kvepisSubmissionTypeEnum = pgEnum("kvepis_submission_type", [
  "rabies_notification",      // Hlásenie o očkovaní / pozorovaní proti besnote
  "treatment_diary_batch",    // Ambulantná kniha ošetrení (dávka)
  "animal_movement",          // Hlásenie o premiestnení zvieraťa
  "infectious_disease_alert", // Hlásenie podozrenia na nebezpečnú nákazu
]);

export const kvepisSubmissionStatusEnum = pgEnum("kvepis_submission_status", [
  "DRAFT",        // Rozpracované, ešte nevalidované
  "VALIDATED",    // Prešlo validačným enginom, pripravené na podpis
  "SIGNED",       // Podpísané KEP (D.Signer / cloudová pečať / HSM)
  "SUBMITTED",    // Odoslané do ÚPVS / KVEPIS
  "ACKNOWLEDGED", // Prijatá doručenka z ÚPVS
  "REJECTED",     // Zamietnuté ŠVPS SR (error_code uchováva dôvod)
]);

export const kvepisSignatureMethodEnum = pgEnum("kvepis_signature_method", [
  "NONE",        // Nepodpísané (DRAFT / VALIDATED)
  "DSIGNER",     // Klientsky podpis cez D.Signer / Disig Web Signer (eID čítačka)
  "CLOUD_SEAL",  // Cloudová pečať ambulancie
  "HSM",         // Hardwarový bezpečnostný modul
]);

// ---------------------------------------------------------------------------
// Table 1: ext_kvepis_credentials — konfigurácia prístupu kliniky
// ---------------------------------------------------------------------------
export const extKvepisCredentials = pgTable(
  "ext_kvepis_credentials",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    // Obchodno-právne identifikátory kliniky / ambulancie
    ico: text("ico").notNull(), // IČO (8-miestne, bez medzier)
    kvlId: text("kvl_id"), // Registračné číslo veterinárneho lekára v KVL SR

    // ÚPVS identita (elektronická schránka a režim integrácie)
    upvsSchranka: text("upvs_schranka"), // ID elektronickej schránky (napr. ICO/xxxx)
    integrationMode: text("integration_mode").notNull().default("GUIDED"), // GUIDED | B2G

    // Podpisová stratégia (Open Question #1 — KEP)
    signingPreference: kvepisSignatureMethodEnum("signing_preference")
      .notNull()
      .default("DSIGNER"),

    // Klientsky / mandátny certifikát (base64 DER/PEM) a jeho identita
    certificateBase64: text("certificate_base64"),
    certificateSerial: text("certificate_serial"),
    certificateValidUntil: timestamp("certificate_valid_until", {
      withTimezone: true,
    }),

    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    // Jedna aktívna konfigurácia prístupu na kliniku.
    practiceUq: uniqueIndex("ext_kvepis_credentials_practice_uq").on(
      table.practiceId
    ),
  })
);

// ---------------------------------------------------------------------------
// Table 2: ext_kvepis_submissions — KVEPIS podania
// ---------------------------------------------------------------------------
export const extKvepisSubmissions = pgTable(
  "ext_kvepis_submissions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    submissionType: kvepisSubmissionTypeEnum("submission_type").notNull(),
    status: kvepisSubmissionStatusEnum("status").notNull().default("DRAFT"),

    // Číslo podania — formát KVEPIS-YYYYMMDD-NNNN, unikátne v rámci kliniky
    referenceNumber: text("reference_number").notNull(),

    // Väzba na zdrojový záznam v ambulantnej knihe
    sourceEntityType: text("source_entity_type"), // napr. "rabies_observation"
    sourceEntityId: uuid("source_entity_id"),
    patientId: uuid("patient_id").references(() => patients.id),

    // Identifikátory overované validačným enginom
    farmIco: text("farm_ico"), // IČO farmy / chovu
    cehzCode: text("cehz_code"), // CEHZ kód chovu (Centrálna evidencia hospodárskych zvierat)
    earTagNumber: text("ear_tag_number"), // Ušná známka (hospodárske zvieratá)
    transponderNumber: text("transponder_number"), // Transpondér / mikročip (spoločenské zvieratá)
    kvlNumber: text("kvl_number"), // KVL číslo ošetrujúceho lekára

    // Obsah podania: XML (GovBox / XSD ŠVPS SR) + JSON reprezentácia + hash
    payloadXml: text("payload_xml"),
    payloadJson: jsonb("payload_json"),
    payloadHash: text("payload_hash"), // SHA-256 hex digest kanonizovaného payloadu

    // Podpisový balíček (ZEP / ASiC-E / XAdES) a metadáta podpisu
    signatureMethod: kvepisSignatureMethodEnum("signature_method")
      .notNull()
      .default("NONE"),
    signaturePayload: jsonb("signature_payload"), // base64 podpisového kontajnera + metadata
    signedBy: uuid("signed_by").references(() => users.id),
    signedAt: timestamp("signed_at", { withTimezone: true }),

    // Životný cyklus odoslania cez ÚPVS
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    upvsMessageId: text("upvs_message_id"), // MessageID z ÚPVS GovBox / KVEPIS

    // Doručenka z ÚPVS (spárovaná automaticky podľa upvs_message_id)
    receiptReceivedAt: timestamp("receipt_received_at", { withTimezone: true }),
    receiptPayload: jsonb("receipt_payload"), // Doručenka (JSON / XML) z ÚPVS
    receiptHash: text("receipt_hash"),

    // Chybové kódy ŠVPS SR (pri REJECTED)
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("ext_kvepis_submissions_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    practiceStatusIdx: index("ext_kvepis_submissions_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt
    ),
    practiceTypeIdx: index("ext_kvepis_submissions_type_idx").on(
      table.practiceId,
      table.submissionType,
      table.deletedAt
    ),
    patientIdx: index("ext_kvepis_submissions_patient_idx").on(
      table.patientId,
      table.deletedAt
    ),
    sourceIdx: index("ext_kvepis_submissions_source_idx").on(
      table.sourceEntityType,
      table.sourceEntityId
    ),
    referenceNumberUq: uniqueIndex("ext_kvepis_submissions_ref_uq").on(
      table.practiceId,
      table.referenceNumber
    ),
  })
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const extKvepisCredentialsRelations = relations(
  extKvepisCredentials,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extKvepisCredentials.practiceId],
      references: [practices.id],
    }),
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
    signedByUser: one(users, {
      fields: [extKvepisSubmissions.signedBy],
      references: [users.id],
    }),
  })
);
