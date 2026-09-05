import { z } from "zod";
import { eq, and, isNull, desc, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extWithdrawalPeriods,
  extRabiesNotifications,
  vaccinationRecords,
  patients,
  clients,
} from "@openpims/db";

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
          message: "Pacient nebol nájdený",
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
          message: "Záznam o vakcinácii nebol nájdený",
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
});
