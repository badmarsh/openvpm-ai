import { z } from "zod";
import { eq, and, isNull, desc, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extWithdrawalPeriods,
  extRabiesNotifications,
  extRabiesObservations,
  extCarcassDisposals,
  vaccinationRecords,
  patients,
  clients,
} from "@openpims/db";
import { applySympathyGate } from "@/lib/marketing/messaging";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician")
);

export const statutoryRouter = createRouter({
  /**
   * Zoznam ochranných lehôt (mäso, mlieko) pre hospodárske a potravinové zvieratá
   * v zmysle Zákona č. 39/2007 Z. z. a Zákona č. 139/1998 Z. z.
   */
  listWithdrawalPeriods: vetProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          activeOnly: z.boolean().default(false),
          targetAnimalType: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(extWithdrawalPeriods.practiceId, ctx.practiceId),
        isNull(extWithdrawalPeriods.deletedAt),
      ];

      if (input?.patientId) {
        whereConds.push(eq(extWithdrawalPeriods.patientId, input.patientId));
      }

      if (input?.activeOnly) {
        whereConds.push(gte(extWithdrawalPeriods.safeUntil, new Date()));
      }

      if (input?.targetAnimalType) {
        whereConds.push(
          eq(extWithdrawalPeriods.targetAnimalType, input.targetAnimalType)
        );
      }

      const rows = await ctx.db
        .select({
          id: extWithdrawalPeriods.id,
          medicationName: extWithdrawalPeriods.medicationName,
          batchNumber: extWithdrawalPeriods.batchNumber,
          targetAnimalType: extWithdrawalPeriods.targetAnimalType,
          meatWithdrawalDays: extWithdrawalPeriods.meatWithdrawalDays,
          milkWithdrawalDays: extWithdrawalPeriods.milkWithdrawalDays,
          administeredAt: extWithdrawalPeriods.administeredAt,
          safeUntil: extWithdrawalPeriods.safeUntil,
          notes: extWithdrawalPeriods.notes,
          patientId: patients.id,
          patientName: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
        })
        .from(extWithdrawalPeriods)
        .innerJoin(
          patients,
          and(
            eq(extWithdrawalPeriods.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .leftJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(desc(extWithdrawalPeriods.administeredAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(extWithdrawalPeriods)
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: countResult?.count ?? 0,
      };
    }),

  /**
   * Zaevidovanie ochrannej lehoty po podaní liečiva potravinovému zvieraťu
   */
  createWithdrawalPeriod: vetProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        medicationName: z.string().min(1, "Názov liečiva je povinný"),
        batchNumber: z.string().optional(),
        targetAnimalType: z
          .enum(["bovine", "porcine", "ovine", "equine", "poultry", "companion"])
          .default("companion"),
        meatWithdrawalDays: z.number().int().min(0).default(0),
        milkWithdrawalDays: z.number().int().min(0).default(0),
        administeredAt: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        ),
      });

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      const adminDate = input.administeredAt
        ? new Date(input.administeredAt)
        : new Date();
      const maxDays = Math.max(
        input.meatWithdrawalDays,
        input.milkWithdrawalDays
      );
      const safeUntil = new Date(
        adminDate.getTime() + maxDays * 24 * 60 * 60 * 1000
      );

      const [created] = await ctx.db
        .insert(extWithdrawalPeriods)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          medicationName: input.medicationName,
          batchNumber: input.batchNumber ?? null,
          targetAnimalType: input.targetAnimalType,
          meatWithdrawalDays: input.meatWithdrawalDays,
          milkWithdrawalDays: input.milkWithdrawalDays,
          administeredAt: adminDate,
          safeUntil,
          notes: input.notes ?? null,
        })
        .returning();

      return created;
    }),

  /**
   * Prehľad RVPS hlásení vakcinácie proti besnote (§ 19 zákona č. 39/2007 Z. z.)
   */
  listRabiesNotifications: vetProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "submitted", "confirmed"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(extRabiesNotifications.practiceId, ctx.practiceId),
        isNull(extRabiesNotifications.deletedAt),
      ];

      if (input?.status) {
        whereConds.push(eq(extRabiesNotifications.status, input.status));
      }

      const rows = await ctx.db
        .select({
          id: extRabiesNotifications.id,
          vaccinationRecordId: extRabiesNotifications.vaccinationRecordId,
          rvpsOfficeName: extRabiesNotifications.rvpsOfficeName,
          rvpsNotifiedAt: extRabiesNotifications.rvpsNotifiedAt,
          status: extRabiesNotifications.status,
          submissionReference: extRabiesNotifications.submissionReference,
          administeredAt: vaccinationRecords.administeredAt,
          vaccineName: vaccinationRecords.vaccineName,
          lotNumber: vaccinationRecords.lotNumber,
          patientName: patients.name,
          microchipNumber: patients.microchipNumber,
          clientLastName: clients.lastName,
        })
        .from(extRabiesNotifications)
        .innerJoin(
          vaccinationRecords,
          and(
            eq(extRabiesNotifications.vaccinationRecordId, vaccinationRecords.id),
            eq(vaccinationRecords.practiceId, ctx.practiceId)
          )
        )
        .innerJoin(
          patients,
          and(
            eq(vaccinationRecords.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .leftJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(desc(extRabiesNotifications.createdAt))
        .limit(input?.limit ?? 50);

      return rows;
    }),

  /**
   * Zaznamenanie odoslania hlásenia na príslušnú RVPS
   */
  recordRabiesNotification: vetProcedure
    .input(
      z.object({
        vaccinationRecordId: z.string().uuid(),
        rvpsOfficeName: z.string().min(1, "Názov RVPS je povinný"),
        submissionReference: z.string().optional(),
        status: z.enum(["submitted", "confirmed"]).default("submitted"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Overenie existencie očkovania
      const record = await ctx.db.query.vaccinationRecords.findFirst({
        where: and(
          eq(vaccinationRecords.id, input.vaccinationRecordId),
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt)
        ),
      });

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vaccination record not found",
        });
      }

      const [notification] = await ctx.db
        .insert(extRabiesNotifications)
        .values({
          practiceId: ctx.practiceId,
          vaccinationRecordId: input.vaccinationRecordId,
          rvpsOfficeName: input.rvpsOfficeName,
          submissionReference: input.submissionReference ?? null,
          status: input.status,
          rvpsNotifiedAt: new Date(),
        })
        .returning();

      return notification;
    }),

  /**
   * Zoznam 14-dňových pozorovaní na besnotu (Zákon č. 39/2007 Z. z. § 19)
   */
  listRabiesObservations: vetProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          status: z
            .enum(["IN_PROGRESS", "COMPLETED_HEALTHY", "SUSPICIOUS", "DIED", "EUTHANIZED"])
            .optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(extRabiesObservations.practiceId, ctx.practiceId),
        isNull(extRabiesObservations.deletedAt),
      ];

      if (input?.patientId) {
        whereConds.push(eq(extRabiesObservations.patientId, input.patientId));
      }

      if (input?.status) {
        whereConds.push(eq(extRabiesObservations.status, input.status));
      }

      const rows = await ctx.db
        .select({
          id: extRabiesObservations.id,
          patientId: extRabiesObservations.patientId,
          clientId: extRabiesObservations.clientId,
          biteDate: extRabiesObservations.biteDate,
          injuredPersonName: extRabiesObservations.injuredPersonName,
          injuredPersonContact: extRabiesObservations.injuredPersonContact,
          incidentLocation: extRabiesObservations.incidentLocation,
          incidentDescription: extRabiesObservations.incidentDescription,
          day1ExaminedAt: extRabiesObservations.day1ExaminedAt,
          day1ExaminedBy: extRabiesObservations.day1ExaminedBy,
          day1Findings: extRabiesObservations.day1Findings,
          day1Passed: extRabiesObservations.day1Passed,
          day5ExaminedAt: extRabiesObservations.day5ExaminedAt,
          day5ExaminedBy: extRabiesObservations.day5ExaminedBy,
          day5Findings: extRabiesObservations.day5Findings,
          day5Passed: extRabiesObservations.day5Passed,
          day14ExaminedAt: extRabiesObservations.day14ExaminedAt,
          day14ExaminedBy: extRabiesObservations.day14ExaminedBy,
          day14Findings: extRabiesObservations.day14Findings,
          day14Passed: extRabiesObservations.day14Passed,
          status: extRabiesObservations.status,
          certificateIssuedAt: extRabiesObservations.certificateIssuedAt,
          certificateNumber: extRabiesObservations.certificateNumber,
          rvpsNotified: extRabiesObservations.rvpsNotified,
          notes: extRabiesObservations.notes,
          createdAt: extRabiesObservations.createdAt,
          patientName: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
        })
        .from(extRabiesObservations)
        .innerJoin(
          patients,
          and(
            eq(extRabiesObservations.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .leftJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(desc(extRabiesObservations.biteDate))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(extRabiesObservations)
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: countResult?.count ?? 0,
      };
    }),

  /**
   * Zaevidovanie nového prípadu poranenia človeka zvieraťom a spustenie 14-dňového pozorovania
   */
  createRabiesObservation: vetProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid().optional(),
        biteDate: z.string(),
        injuredPersonName: z.string().min(1, "Meno poranenej osoby je povinné"),
        injuredPersonContact: z.string().optional(),
        incidentLocation: z.string().optional(),
        incidentDescription: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        ),
      });

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Zviera nebolo nájdené",
        });
      }

      const biteDate = new Date(input.biteDate);

      const [created] = await ctx.db
        .insert(extRabiesObservations)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId: input.clientId ?? patient.clientId ?? null,
          biteDate,
          injuredPersonName: input.injuredPersonName,
          injuredPersonContact: input.injuredPersonContact ?? null,
          incidentLocation: input.incidentLocation ?? null,
          incidentDescription: input.incidentDescription ?? null,
          status: "IN_PROGRESS",
          notes: input.notes ?? null,
        })
        .returning();

      return created;
    }),

  /**
   * Záznam kontrolného klinického vyšetrenia (1., 5. alebo 14. deň pozorovania)
   */
  recordRabiesCheckpoint: vetProcedure
    .input(
      z.object({
        observationId: z.string().uuid(),
        checkpoint: z.enum(["day1", "day5", "day14"]),
        examinedAt: z.string().optional(),
        examinedBy: z.string().min(1, "Meno vyšetrujúceho lekára je povinné"),
        findings: z.string().min(1, "Klinický nález je povinný"),
        passed: z.boolean(),
        statusOverride: z
          .enum(["IN_PROGRESS", "COMPLETED_HEALTHY", "SUSPICIOUS", "DIED", "EUTHANIZED"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const obs = await ctx.db.query.extRabiesObservations.findFirst({
        where: and(
          eq(extRabiesObservations.id, input.observationId),
          eq(extRabiesObservations.practiceId, ctx.practiceId),
          isNull(extRabiesObservations.deletedAt)
        ),
      });

      if (!obs) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Záznam pozorovania nebol nájdený",
        });
      }

      const examTime = input.examinedAt ? new Date(input.examinedAt) : new Date();
      const updateData: Record<string, any> = {};

      if (input.checkpoint === "day1") {
        updateData.day1ExaminedAt = examTime;
        updateData.day1ExaminedBy = input.examinedBy;
        updateData.day1Findings = input.findings;
        updateData.day1Passed = input.passed;
      } else if (input.checkpoint === "day5") {
        updateData.day5ExaminedAt = examTime;
        updateData.day5ExaminedBy = input.examinedBy;
        updateData.day5Findings = input.findings;
        updateData.day5Passed = input.passed;
      } else if (input.checkpoint === "day14") {
        updateData.day14ExaminedAt = examTime;
        updateData.day14ExaminedBy = input.examinedBy;
        updateData.day14Findings = input.findings;
        updateData.day14Passed = input.passed;

        if (input.passed) {
          updateData.status = "COMPLETED_HEALTHY";
          updateData.certificateIssuedAt = new Date();
          const year = examTime.getFullYear();
          const seq = Math.floor(1000 + Math.random() * 9000);
          updateData.certificateNumber = `BES-${year}-${seq}`;
        }
      }

      if (!input.passed) {
        updateData.status = input.statusOverride ?? "SUSPICIOUS";
      } else if (input.statusOverride) {
        updateData.status = input.statusOverride;
      }

      const [updated] = await ctx.db
        .update(extRabiesObservations)
        .set(updateData)
        .where(eq(extRabiesObservations.id, obs.id))
        .returning();

      return updated;
    }),

  /**
   * Zoznam eutanázií a záznamov o odvoze kadáverov kafilériou (Zákon č. 39/2007 Z. z. § 29)
   */
  listCarcassDisposals: vetProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(extCarcassDisposals.practiceId, ctx.practiceId),
        isNull(extCarcassDisposals.deletedAt),
      ];

      if (input?.patientId) {
        whereConds.push(eq(extCarcassDisposals.patientId, input.patientId));
      }

      const rows = await ctx.db
        .select({
          id: extCarcassDisposals.id,
          patientId: extCarcassDisposals.patientId,
          clientId: extCarcassDisposals.clientId,
          euthanasiaDate: extCarcassDisposals.euthanasiaDate,
          reason: extCarcassDisposals.reason,
          weightKg: extCarcassDisposals.weightKg,
          medicationUsed: extCarcassDisposals.medicationUsed,
          doseAdministered: extCarcassDisposals.doseAdministered,
          veterinarianName: extCarcassDisposals.veterinarianName,
          renderingPlant: extCarcassDisposals.renderingPlant,
          disposalDocumentNumber: extCarcassDisposals.disposalDocumentNumber,
          pickedUpAt: extCarcassDisposals.pickedUpAt,
          storageLocation: extCarcassDisposals.storageLocation,
          clientConsentSigned: extCarcassDisposals.clientConsentSigned,
          notes: extCarcassDisposals.notes,
          createdAt: extCarcassDisposals.createdAt,
          patientName: patients.name,
          species: patients.species,
          breed: patients.breed,
          microchipNumber: patients.microchipNumber,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
        })
        .from(extCarcassDisposals)
        .innerJoin(
          patients,
          and(
            eq(extCarcassDisposals.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .leftJoin(
          clients,
          and(
            eq(patients.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(desc(extCarcassDisposals.euthanasiaDate))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(extCarcassDisposals)
        .where(and(...whereConds));

      return {
        items: rows,
        totalCount: countResult?.count ?? 0,
      };
    }),

  /**
   * Záznam eutanázie a odovzdania kadáveru kafilérii
   * Automaticky označí pacienta ako deceased a aplikuje Clinical Sympathy Gate.
   */
  recordCarcassDisposal: vetProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid().optional(),
        euthanasiaDate: z.string().optional(),
        reason: z.string().min(1, "Indikácia eutanázie je povinná"),
        weightKg: z.string().regex(/^\d+(\.\d{1,2})?$/, "Neplatná hmotnosť (napr. 12.50)"),
        medicationUsed: z.string().default("T61 / Pentobarbital"),
        doseAdministered: z.string().optional(),
        veterinarianName: z.string().min(1, "Meno ošetrujúceho lekára je povinné"),
        renderingPlant: z.string().default("VAS s.r.o. Mojšova Lúčka"),
        disposalDocumentNumber: z.string().optional(),
        storageLocation: z.string().optional(),
        clientConsentSigned: z.boolean().default(true),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        ),
      });

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pacient nebol nájdený",
        });
      }

      const euthDate = input.euthanasiaDate ? new Date(input.euthanasiaDate) : new Date();
      const resolvedClientId = input.clientId ?? patient.clientId;

      const [record] = await ctx.db
        .insert(extCarcassDisposals)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId: resolvedClientId ?? null,
          euthanasiaDate: euthDate,
          reason: input.reason,
          weightKg: input.weightKg,
          medicationUsed: input.medicationUsed,
          doseAdministered: input.doseAdministered ?? null,
          veterinarianName: input.veterinarianName,
          renderingPlant: input.renderingPlant,
          disposalDocumentNumber: input.disposalDocumentNumber ?? null,
          storageLocation: input.storageLocation ?? null,
          clientConsentSigned: input.clientConsentSigned,
          notes: input.notes ?? null,
        })
        .returning();

      // Clinical Sympathy Gate Protocol:
      // 1. Mark patient as deceased in core database
      await ctx.db
        .update(patients)
        .set({
          status: "deceased",
        })
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.practiceId, ctx.practiceId)
          )
        );

      // 2. Dismiss care reminders and block marketing campaigns
      if (resolvedClientId) {
        try {
          await applySympathyGate(
            ctx.db,
            ctx.practiceId,
            resolvedClientId,
            input.patientId,
            "euthanasia_carcass_disposal"
          );
        } catch {
          // Non-blocking sympathy safety fallback
        }
      }

      return record;
    }),
});
