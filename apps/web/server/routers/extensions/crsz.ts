import { z } from "zod";
import { eq, and, isNull, desc, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  microchipRegistrations,
  petPassports,
  patients,
  clients,
  practices,
  users,
} from "@openpims/db";
import {
  validateMicrochipNumber,
  calculateTravelEligibility,
  generateMicrochipCertificateHtml,
} from "@/lib/crsz/microchip";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

export const crszRouter = createRouter({
  /** Overí formát 15-miestneho mikročipu podľa ISO 11784/11785 */
  validateChip: vetProcedure
    .input(z.object({ microchipNumber: z.string().min(1) }))
    .query(({ input }) => {
      return validateMicrochipNumber(input.microchipNumber);
    }),

  /** Zaregistruje aplikáciu mikročipu zvieraťu a vygeneruje potvrdenie */
  registerMicrochip: vetProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid().optional(),
        microchipNumber: z.string().min(1),
        location: z
          .enum(["LEFT_NECK", "INTERSCAPULAR", "RIGHT_NECK", "OTHER"])
          .default("LEFT_NECK"),
        customLocation: z.string().optional(),
        implantedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        verifiedBeforeImplant: z.enum(["YES", "NO"]).default("YES"),
        verifiedAfterImplant: z.enum(["YES", "NO"]).default("YES"),
        vetKvlNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Validuj číslo čipu
      const validation = validateMicrochipNumber(input.microchipNumber);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.error || "Neplatné číslo mikročipu",
        });
      }

      // Over pacienta a zisti clientId
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId)
        ),
      });
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pacient nebol nájdený",
        });
      }
      const clientId = input.clientId || patient.clientId;

      // 2. Vlož záznam o čipovaní
      const [registration] = await ctx.db
        .insert(microchipRegistrations)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId,
          veterinarianId: ctx.user.id,
          microchipNumber: validation.code,
          location: input.location,
          customLocation: input.customLocation ?? null,
          implantedAt: input.implantedAt,
          verifiedBeforeImplant: input.verifiedBeforeImplant,
          verifiedAfterImplant: input.verifiedAfterImplant,
          vetKvlNumber: input.vetKvlNumber ?? null,
          crszStatus: "PENDING_SUBMISSION",
          notes: input.notes ?? null,
        })
        .returning();

      // 3. Aktualizuj kartu pacienta s novým číslom čipu
      await ctx.db
        .update(patients)
        .set({
          microchipNumber: validation.code,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.practiceId, ctx.practiceId)
          )
        );

      // 4. Načítaj údaje pre certifikát
      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });
      const client = await ctx.db.query.clients.findFirst({
        where: eq(clients.id, clientId),
      });

      const certificateHtml = generateMicrochipCertificateHtml({
        clinicName: practice?.name ?? "Veterinárna ambulancia",
        clinicAddress: practice?.address ?? null,
        clinicPhone: practice?.phone ?? null,
        vetName: ctx.user.name ?? "Veterinárny lekár",
        vetKvlNumber: input.vetKvlNumber ?? null,
        patientName: patient?.name ?? "Pacient",
        species: patient?.species ?? "Zviera",
        breed: patient?.breed ?? null,
        sex: patient?.sex ?? null,
        dob: patient?.dob ?? null,
        color: (patient as any)?.color ?? null,
        ownerName: `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim(),
        ownerAddress: client?.address ?? null,
        ownerPhone: client?.phone ?? null,
        microchipNumber: validation.code,
        implantedAt: input.implantedAt,
        location: input.location,
        verifiedBefore: input.verifiedBeforeImplant === "YES" ? "Áno (funkčný)" : "Nie",
        verifiedAfter: input.verifiedAfterImplant === "YES" ? "Áno (funkčný)" : "Nie",
      });

      return {
        registration,
        certificateHtml,
      };
    }),

  /** Zoznam registrácií čipov */
  listMicrochips: vetProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          search: z.string().optional(),
          status: z.enum(["NOT_REGISTERED", "PENDING_SUBMISSION", "REGISTERED", "REJECTED"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(microchipRegistrations.practiceId, ctx.practiceId),
        isNull(microchipRegistrations.deletedAt),
      ];

      if (input?.patientId) {
        conditions.push(eq(microchipRegistrations.patientId, input.patientId));
      }
      if (input?.status) {
        conditions.push(eq(microchipRegistrations.crszStatus, input.status));
      }
      if (input?.search) {
        conditions.push(
          ilike(microchipRegistrations.microchipNumber, `%${input.search}%`)
        );
      }

      const items = await ctx.db.query.microchipRegistrations.findMany({
        where: and(...conditions),
        orderBy: [desc(microchipRegistrations.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        with: {
          patient: true,
          client: true,
          veterinarian: true,
        },
      });

      return items;
    }),

  /** Vystavenie pasu spoločenského zvieraťa (PetPass EÚ) */
  issuePetPassport: vetProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid().optional(),
        passportNumber: z.string().min(1, "Číslo pasu je povinné"),
        issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        issuingVetName: z.string().optional(),
        issuingVetKvl: z.string().optional(),
        rabiesVaccineName: z.string().optional(),
        rabiesBatchNumber: z.string().optional(),
        rabiesAdministeredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        rabiesValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        isRevaccination: z.boolean().default(false),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId)
        ),
      });

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pacient nebol nájdený",
        });
      }

      const clientId = input.clientId || patient.clientId;

      // Vypočítaj spôsobilosť na cestovanie
      let travelEligibleFrom: string | null = null;
      let travelInfo: any = null;

      if (input.rabiesAdministeredAt) {
        const microchipDate = patient.createdAt ? new Date(patient.createdAt).toISOString().slice(0, 10) : input.issuedAt;
        travelInfo = calculateTravelEligibility({
          microchipDate,
          rabiesDate: input.rabiesAdministeredAt,
          isRevaccination: input.isRevaccination,
        });
        travelEligibleFrom = travelInfo.eligibleFrom;
      }

      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      const [passport] = await ctx.db
        .insert(petPassports)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId,
          issuedBy: ctx.user.id,
          passportNumber: input.passportNumber.trim(),
          issuedAt: input.issuedAt,
          issuingClinicName: practice?.name ?? "Veterinárna ambulancia",
          issuingVetName: input.issuingVetName ?? ctx.user.name ?? "Veterinárny lekár",
          issuingVetKvl: input.issuingVetKvl ?? null,
          rabiesVaccineName: input.rabiesVaccineName ?? null,
          rabiesBatchNumber: input.rabiesBatchNumber ?? null,
          rabiesAdministeredAt: input.rabiesAdministeredAt ?? null,
          rabiesValidUntil: input.rabiesValidUntil ?? null,
          travelEligibleFrom,
          notes: input.notes ?? null,
        })
        .returning();

      return {
        passport,
        travelInfo,
      };
    }),

  /** Zoznam vystavených pasov */
  listPassports: vetProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(petPassports.practiceId, ctx.practiceId),
        isNull(petPassports.deletedAt),
      ];

      if (input?.patientId) {
        conditions.push(eq(petPassports.patientId, input.patientId));
      }
      if (input?.search) {
        conditions.push(
          ilike(petPassports.passportNumber, `%${input.search}%`)
        );
      }

      const items = await ctx.db.query.petPassports.findMany({
        where: and(...conditions),
        orderBy: [desc(petPassports.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        with: {
          patient: true,
          client: true,
          issuer: true,
        },
      });

      return items;
    }),

  /** Získanie HTML certifikátu pre opätovnú tlač */
  getCertificateHtml: vetProcedure
    .input(z.object({ registrationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const reg = await ctx.db.query.microchipRegistrations.findFirst({
        where: and(
          eq(microchipRegistrations.id, input.registrationId),
          eq(microchipRegistrations.practiceId, ctx.practiceId)
        ),
        with: {
          patient: true,
          client: true,
          veterinarian: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Záznam o čipovaní nebol nájdený",
        });
      }

      const practice = await ctx.db.query.practices.findFirst({
        where: eq(practices.id, ctx.practiceId),
      });

      return generateMicrochipCertificateHtml({
        clinicName: practice?.name ?? "Veterinárna ambulancia",
        clinicAddress: practice?.address ?? null,
        clinicPhone: practice?.phone ?? null,
        vetName: reg.veterinarian?.name ?? "Veterinárny lekár",
        vetKvlNumber: reg.vetKvlNumber,
        patientName: reg.patient?.name ?? "Pacient",
        species: reg.patient?.species ?? "Zviera",
        breed: reg.patient?.breed ?? null,
        sex: reg.patient?.sex ?? null,
        dob: reg.patient?.dob ?? null,
        color: (reg.patient as any)?.color ?? null,
        ownerName: `${reg.client?.firstName ?? ""} ${reg.client?.lastName ?? ""}`.trim(),
        ownerAddress: reg.client?.address ?? null,
        ownerPhone: reg.client?.phone ?? null,
        microchipNumber: reg.microchipNumber,
        implantedAt: reg.implantedAt,
        location: reg.location,
        verifiedBefore: reg.verifiedBeforeImplant === "YES" ? "Áno" : "Nie",
        verifiedAfter: reg.verifiedAfterImplant === "YES" ? "Áno" : "Nie",
        crszRecordId: reg.crszRecordId,
      });
    }),
});
