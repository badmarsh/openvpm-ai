import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";

/**
 * Slovak Statutory Compliance: Kniha ošetrení hospodárskych zvierat
 * a evidencia ochranných lehôt (mäso, mlieko, vajcia)
 * podľa Zákona č. 39/2007 Z. z. a Zákona č. 139/1998 Z. z.
 */
export const extWithdrawalPeriods = pgTable(
  "ext_withdrawal_periods",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    visitId: uuid("visit_id"),
    medicationName: text("medication_name").notNull(),
    batchNumber: text("batch_number"),
    targetAnimalType: text("target_animal_type").notNull().default("companion"), // bovine, porcine, ovine, equine, poultry, companion
    meatWithdrawalDays: integer("meat_withdrawal_days").default(0),
    milkWithdrawalDays: integer("milk_withdrawal_days").default(0),
    administeredAt: timestamp("administered_at").notNull().defaultNow(),
    safeUntil: timestamp("safe_until").notNull(),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("ext_withdrawal_periods_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("ext_withdrawal_periods_patient_idx").on(
      table.patientId,
      table.deletedAt
    ),
  })
);

/**
 * Slovak Statutory Compliance: Notifikácia o očkovaní proti besnote na RVPS
 * Lehota na nahlásenie: 3 dni od vakcinácie (Zákon č. 39/2007 Z. z.)
 */
export const extRabiesNotifications = pgTable(
  "ext_rabies_notifications",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    vaccinationRecordId: uuid("vaccination_record_id").notNull(),
    rvpsNotifiedAt: timestamp("rvps_notified_at"),
    rvpsOfficeName: text("rvps_office_name"), // napr. "RVPS Bratislava", "RVPS Nitra"
    status: text("status").notNull().default("pending"), // pending | submitted | confirmed
    submissionReference: text("submission_reference"),
  },
  (table) => ({
    practiceIdx: index("ext_rabies_notifications_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/**
 * Slovak Statutory Compliance: 14-dňové klinické pozorovanie zvieraťa na besnotu
 * po poranení / pohryznutí človeka (Zákon č. 39/2007 Z. z. § 19).
 * Vyšetrenia: 1. deň, 5. deň a 14. deň po pohryznutí.
 */
export const extRabiesObservations = pgTable(
  "ext_rabies_observations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    // Údaje o incidente
    biteDate: timestamp("bite_date", { withTimezone: true }).notNull(),
    injuredPersonName: text("injured_person_name").notNull(),
    injuredPersonContact: text("injured_person_contact"),
    incidentLocation: text("incident_location"),
    incidentDescription: text("incident_description"),
    // 1. Vyšetrenie (1. deň)
    day1ExaminedAt: timestamp("day1_examined_at", { withTimezone: true }),
    day1ExaminedBy: text("day1_examined_by"),
    day1Findings: text("day1_findings"),
    day1Passed: boolean("day1_passed"),
    // 2. Vyšetrenie (5. deň)
    day5ExaminedAt: timestamp("day5_examined_at", { withTimezone: true }),
    day5ExaminedBy: text("day5_examined_by"),
    day5Findings: text("day5_findings"),
    day5Passed: boolean("day5_passed"),
    // 3. Vyšetrenie (14. deň — záverečné)
    day14ExaminedAt: timestamp("day14_examined_at", { withTimezone: true }),
    day14ExaminedBy: text("day14_examined_by"),
    day14Findings: text("day14_findings"),
    day14Passed: boolean("day14_passed"),
    // Status pozorovania: IN_PROGRESS | COMPLETED_HEALTHY | SUSPICIOUS | DIED | EUTHANIZED
    status: text("status").notNull().default("IN_PROGRESS"),
    certificateIssuedAt: timestamp("certificate_issued_at", { withTimezone: true }),
    certificateNumber: text("certificate_number"),
    rvpsNotified: boolean("rvps_notified").default(false),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("ext_rabies_obs_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("ext_rabies_obs_patient_idx").on(
      table.patientId,
      table.deletedAt
    ),
    statusIdx: index("ext_rabies_obs_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt
    ),
  })
);

/**
 * Slovak Statutory Compliance: Register eutanázií a odvozu kadáverov kafilériou
 * (Zákon č. 39/2007 Z. z. § 29 a vyhláška ŠVPS SR).
 */
export const extCarcassDisposals = pgTable(
  "ext_carcass_disposals",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    euthanasiaDate: timestamp("euthanasia_date", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason").notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).notNull(),
    medicationUsed: text("medication_used").notNull().default("T61 / Pentobarbital"),
    doseAdministered: text("dose_administered"),
    veterinarianName: text("veterinarian_name").notNull(),
    // Kafiléria
    renderingPlant: text("rendering_plant").notNull().default("VAS s.r.o. Mojšova Lúčka"),
    disposalDocumentNumber: text("disposal_document_number"), // Číslo zberného listu
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    storageLocation: text("storage_location"), // Box č. 1, mraziak
    clientConsentSigned: boolean("client_consent_signed").notNull().default(true),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("ext_carcass_disp_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("ext_carcass_disp_patient_idx").on(
      table.patientId,
      table.deletedAt
    ),
  })
);
