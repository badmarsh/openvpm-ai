import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extKvepisSubmissions,
  extKvepisCredentials,
  extWithdrawalPeriods,
  vaccinationRecords,
  patients,
  clients,
  users,
} from "@openpims/db";
import {
  validateRabiesNotification,
  validateTreatmentDiaryBatch,
  validateAnimalMovement,
} from "@/lib/kvepis/validator";
import {
  buildRabiesNotificationXml,
  buildTreatmentDiaryBatchXml,
  buildAnimalMovementXml,
} from "@/lib/kvepis/builder";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

export const kvepisRouter = createRouter({
  /**
   * Zoznam všetkých KVEPIS podaní pre kliniku
   */
  listSubmissions: vetProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "DRAFT",
              "VALIDATED",
              "SIGNED",
              "SUBMITTED",
              "ACKNOWLEDGED",
              "REJECTED",
            ])
            .optional(),
          submissionType: z
            .enum([
              "rabies_notification",
              "treatment_diary_batch",
              "animal_movement",
              "infectious_disease_alert",
            ])
            .optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const whereConds = [
        eq(extKvepisSubmissions.practiceId, ctx.practiceId),
        isNull(extKvepisSubmissions.deletedAt),
      ];

      if (input?.status) {
        whereConds.push(eq(extKvepisSubmissions.status, input.status));
      }

      if (input?.submissionType) {
        whereConds.push(
          eq(extKvepisSubmissions.submissionType, input.submissionType)
        );
      }

      const rows = await ctx.db
        .select({
          id: extKvepisSubmissions.id,
          submissionReference: extKvepisSubmissions.submissionReference,
          submissionType: extKvepisSubmissions.submissionType,
          status: extKvepisSubmissions.status,
          receiptReference: extKvepisSubmissions.receiptReference,
          signatureHash: extKvepisSubmissions.signatureHash,
          submittedAt: extKvepisSubmissions.submittedAt,
          acknowledgedAt: extKvepisSubmissions.acknowledgedAt,
          errorCode: extKvepisSubmissions.errorCode,
          errorMessage: extKvepisSubmissions.errorMessage,
          createdAt: extKvepisSubmissions.createdAt,
          patientName: patients.name,
          clientName: sqlConcatClientName(),
        })
        .from(extKvepisSubmissions)
        .leftJoin(patients, eq(extKvepisSubmissions.patientId, patients.id))
        .leftJoin(clients, eq(extKvepisSubmissions.clientId, clients.id))
        .where(and(...whereConds))
        .orderBy(desc(extKvepisSubmissions.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return rows;
    }),

  /**
   * Detail podania vrátane kánonického XML a chýb validácie
   */
  getSubmission: vetProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .select()
        .from(extKvepisSubmissions)
        .where(
          and(
            eq(extKvepisSubmissions.id, input.id),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId),
            isNull(extKvepisSubmissions.deletedAt)
          )
        );

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "KVEPIS podanie nebolo nájdené.",
        });
      }

      return submission;
    }),

  /**
   * Vytvorí KVEPIS podanie pre očkovanie proti besnote z existujúceho záznamu
   */
  createRabiesSubmission: vetProcedure
    .input(
      z.object({
        vaccinationRecordId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [vacRecord] = await ctx.db
        .select({
          id: vaccinationRecords.id,
          patientId: vaccinationRecords.patientId,
          vaccineName: vaccinationRecords.vaccineName,
          lotNumber: vaccinationRecords.lotNumber,
          administeredAt: vaccinationRecords.administeredAt,
          nextDueDate: vaccinationRecords.nextDueDate,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientMicrochip: patients.microchipNumber,
          clientId: clients.id,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientAddress: clients.address,
          clientCity: clients.city,
          clientPhone: clients.phone,
        })
        .from(vaccinationRecords)
        .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
        .innerJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(vaccinationRecords.id, input.vaccinationRecordId),
            eq(vaccinationRecords.practiceId, ctx.practiceId)
          )
        );

      if (!vacRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Záznam o vakcinácii nebol nájdený.",
        });
      }

      // Načítanie KVEPIS registračných údajov ambulancie
      const [creds] = await ctx.db
        .select()
        .from(extKvepisCredentials)
        .where(
          and(
            eq(extKvepisCredentials.practiceId, ctx.practiceId),
            eq(extKvepisCredentials.isActive, true)
          )
        );

      const rvpsCode = creds?.rvpsCode || "SK-RVPS-BA";
      const kvlNumber = creds?.kvlRegistrationNumber || "KVL-SK-DEFAULT";

      const rabiesData = {
        patient: {
          id: vacRecord.patientId,
          name: vacRecord.patientName,
          species: vacRecord.patientSpecies || "canine",
          microchipNumber: vacRecord.patientMicrochip,
        },
        client: {
          name: `${vacRecord.clientFirstName} ${vacRecord.clientLastName}`.trim(),
          address: vacRecord.clientAddress,
          city: vacRecord.clientCity,
          phone: vacRecord.clientPhone,
        },
        vaccination: {
          vaccineName: vacRecord.vaccineName,
          batchNumber: vacRecord.lotNumber || "UNSPECIFIED",
          administeredAt: new Date(vacRecord.administeredAt),
          validUntil: vacRecord.nextDueDate
            ? new Date(vacRecord.nextDueDate)
            : new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
        veterinarian: {
          name: ctx.session?.user?.name || "Veterinárny lekár",
          kvlNumber,
        },
        rvpsCode,
      };

      const validation = validateRabiesNotification(rabiesData);
      const submissionRef = `KVEPIS-BES-${Date.now().toString(36).toUpperCase()}`;
      const { xml, hash } = buildRabiesNotificationXml(submissionRef, rabiesData);

      const [created] = await ctx.db
        .insert(extKvepisSubmissions)
        .values({
          practiceId: ctx.practiceId,
          submissionType: "rabies_notification",
          status: validation.valid ? "VALIDATED" : "DRAFT",
          patientId: vacRecord.patientId,
          clientId: vacRecord.clientId,
          vaccinationRecordId: vacRecord.id,
          submissionReference: submissionRef,
          xmlPayload: xml,
          jsonPayload: JSON.stringify(rabiesData),
          signatureHash: hash,
          validationErrors: validation.errors.length > 0 ? JSON.stringify(validation.errors) : null,
          notes: validation.warnings.length > 0 ? validation.warnings.join("; ") : null,
        })
        .returning();

      return {
        submission: created,
        validation,
      };
    }),

  /**
   * Zaznamenanie elektronického podpisu (D.Signer / KEP)
   */
  recordSignature: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        signatureHash: z.string().min(16),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "SIGNED",
          signatureHash: input.signatureHash,
          signedById: ctx.session?.user?.id,
          signedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(extKvepisSubmissions.id, input.submissionId),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Podanie nebolo nájdené.",
        });
      }

      return updated;
    }),

  /**
   * Zaznamenanie doručenky / potvrdenia o prevzatí z ÚPVS alebo KVEPIS
   */
  recordReceipt: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        receiptReference: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "ACKNOWLEDGED",
          receiptReference: input.receiptReference,
          acknowledgedAt: new Date(),
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(extKvepisSubmissions.id, input.submissionId),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Podanie nebolo nájdené.",
        });
      }

      return updated;
    }),

  /**
   * Získanie konfigurácie KVEPIS pre kliniku
   */
  getCredentials: vetProcedure.query(async ({ ctx }) => {
    const [creds] = await ctx.db
      .select()
      .from(extKvepisCredentials)
      .where(
        and(
          eq(extKvepisCredentials.practiceId, ctx.practiceId),
          isNull(extKvepisCredentials.deletedAt)
        )
      );

    return creds || null;
  }),

  /**
   * Nastavenie alebo úprava KVEPIS poverení
   */
  saveCredentials: vetProcedure
    .input(
      z.object({
        ico: z.string().length(8),
        dic: z.string().optional(),
        kvlRegistrationNumber: z.string().min(2),
        rvpsCode: z.string().min(3),
        upvsBoxId: z.string().optional(),
        apiEndpoint: z.string().url().default("https://portal.svps.sk/kvepis-api/v1"),
        isProduction: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(extKvepisCredentials)
        .where(eq(extKvepisCredentials.practiceId, ctx.practiceId));

      if (existing) {
        const [updated] = await ctx.db
          .update(extKvepisCredentials)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(extKvepisCredentials.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(extKvepisCredentials)
        .values({
          practiceId: ctx.practiceId,
          ...input,
        })
        .returning();

      return created;
    }),
});

function sqlConcatClientName() {
  return clients.lastName;
}
