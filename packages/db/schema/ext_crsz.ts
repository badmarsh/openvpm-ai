import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums (Slovak CRSZ & PetPass Legislation - Law 39/2007 Z. z.)
// ---------------------------------------------------------------------------
export const crszRegistrationStatusEnum = pgEnum("crsz_registration_status", [
  "NOT_REGISTERED",
  "PENDING_SUBMISSION",
  "REGISTERED",
  "REJECTED",
]);

export const microchipLocationEnum = pgEnum("microchip_location", [
  "LEFT_NECK",        // Ľavá strana krku (štandard v SR a EÚ)
  "INTERSCAPULAR",    // Medzilopatkový priestor
  "RIGHT_NECK",       // Pravá strana krku
  "OTHER",            // Iné miesto
]);

// ---------------------------------------------------------------------------
// Evidencia označenia zvieraťa transpondérom a registrácie do CRSZ
// ---------------------------------------------------------------------------
export const microchipRegistrations = pgTable(
  "microchip_registrations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    veterinarianId: uuid("veterinarian_id")
      .notNull()
      .references(() => users.id),

    // 15-miestny kód transpondéra podľa ISO 11784/11785
    microchipNumber: varchar("microchip_number", { length: 32 }).notNull(),
    location: microchipLocationEnum("location").notNull().default("LEFT_NECK"),
    customLocation: text("custom_location"),
    implantedAt: date("implanted_at").notNull(),

    // Overenie odčítania čipu pred a po aplikácii (požiadavka KVL SR)
    verifiedBeforeImplant: varchar("verified_before_implant", { length: 8 }).default("YES"),
    verifiedAfterImplant: varchar("verified_after_implant", { length: 8 }).default("YES"),

    // Veterinárna komora / KVL registrácia lekára
    vetKvlNumber: varchar("vet_kvl_number", { length: 64 }),

    // Registrácia v Centrálnom registri spoločenských zvierat (CRSZ)
    crszStatus: crszRegistrationStatusEnum("crsz_status").notNull().default("NOT_REGISTERED"),
    crszRegisteredAt: timestamp("crsz_registered_at", { withTimezone: true }),
    crszRecordId: varchar("crsz_record_id", { length: 128 }),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("microchip_registrations_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("microchip_registrations_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt
    ),
    microchipIdx: index("microchip_registrations_chip_idx").on(
      table.microchipNumber
    ),
  })
);

// ---------------------------------------------------------------------------
// Evidencia pasov spoločenských zvierat (PetPass EÚ)
// ---------------------------------------------------------------------------
export const petPassports = pgTable(
  "pet_passports",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    issuedBy: uuid("issued_by")
      .notNull()
      .references(() => users.id),

    // Číslo pasu v tvare napr. "SK 0123456"
    passportNumber: varchar("passport_number", { length: 32 }).notNull(),
    issuedAt: date("issued_at").notNull(),
    issuingClinicName: text("issuing_clinic_name"),
    issuingVetName: text("issuing_vet_name"),
    issuingVetKvl: varchar("issuing_vet_kvl", { length: 64 }),

    // Aktuálna platnosť očkovania proti besnote pre cestovanie
    rabiesVaccineName: varchar("rabies_vaccine_name", { length: 128 }),
    rabiesBatchNumber: varchar("rabies_batch_number", { length: 64 }),
    rabiesAdministeredAt: date("rabies_administered_at"),
    rabiesValidUntil: date("rabies_valid_until"),
    // Dátum, od kedy je zviera spôsobilé na cestovanie (21 dní po primovakcinácii)
    travelEligibleFrom: date("travel_eligible_from"),

    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("pet_passports_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("pet_passports_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.deletedAt
    ),
    passportNumberIdx: uniqueIndex("pet_passports_number_uq").on(
      table.passportNumber
    ),
  })
);

export const microchipRegistrationsRelations = relations(
  microchipRegistrations,
  ({ one }) => ({
    practice: one(practices, {
      fields: [microchipRegistrations.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [microchipRegistrations.patientId],
      references: [patients.id],
    }),
    client: one(clients, {
      fields: [microchipRegistrations.clientId],
      references: [clients.id],
    }),
    veterinarian: one(users, {
      fields: [microchipRegistrations.veterinarianId],
      references: [users.id],
    }),
  })
);

export const petPassportsRelations = relations(petPassports, ({ one }) => ({
  practice: one(practices, {
    fields: [petPassports.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [petPassports.patientId],
    references: [patients.id],
  }),
  client: one(clients, {
    fields: [petPassports.clientId],
    references: [clients.id],
  }),
  issuer: one(users, {
    fields: [petPassports.issuedBy],
    references: [users.id],
  }),
}));
