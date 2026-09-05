import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";

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
