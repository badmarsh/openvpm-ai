import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  insurancePolicies,
  insuranceClaims,
  patients,
  clients,
  invoices,
  invoiceItems,
  users,
} from "@openpims/db";
import {
  validatePetExpertEligibility,
  buildPetExpertClaimPayload,
  generatePetExpertClaimHtml,
  type PetExpertClaimData,
  type PetExpertInvoiceItem,
} from "@/lib/insurance/petexpert";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician", "front_desk")
);

export const insuranceRouter = createRouter({
  /** Overí nárok a spôsobilosť pacienta na priame preplatenie cez PetExpert */
  checkEligibility: staffProcedure
    .input(
      z.object({
        policyId: z.string().uuid(),
        patientId: z.string().uuid(),
        claimAmount: z.number().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.query.insurancePolicies.findFirst({
        where: and(
          eq(insurancePolicies.id, input.policyId),
          eq(insurancePolicies.practiceId, ctx.practiceId),
          isNull(insurancePolicies.deletedAt)
        ),
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Poistná zmluva sa nenašla.",
        });
      }

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
          message: "Pacient sa nenašiel.",
        });
      }

      return validatePetExpertEligibility(
        {
          policyNumber: policy.policyNumber || "",
          providerName: policy.providerName,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          coveragePercent: policy.coveragePercent,
          deductible: policy.deductible,
          maxAnnualBenefit: policy.maxAnnualBenefit,
        },
        {
          id: patient.id,
          name: patient.name,
          species: patient.species,
          breed: patient.breed,
          microchipNumber: patient.microchipNumber,
          birthDate: patient.dob,
          weightKg: null,
        },
        input.claimAmount
      );
    }),

  /** Vytvorí poistnú udalosť pre PetExpert / Slovenskú poisťovňu z faktúry a návštevy */
  createClaim: staffProcedure
    .input(
      z.object({
        policyId: z.string().uuid(),
        patientId: z.string().uuid(),
        invoiceId: z.string().uuid().optional(),
        claimAmount: z.number().positive(),
        incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        diagnosisText: z.string().min(2, "Diagnóza je povinná"),
        diagnosisCode: z.string().optional(),
        treatmentSummary: z.string().min(5, "Priebeh ošetrenia je povinný"),
        clientConsentForDirectSettlement: z.boolean().default(true),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch Policy & Patient
      const policy = await ctx.db.query.insurancePolicies.findFirst({
        where: and(
          eq(insurancePolicies.id, input.policyId),
          eq(insurancePolicies.practiceId, ctx.practiceId),
          isNull(insurancePolicies.deletedAt)
        ),
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Poistná zmluva sa nenašla.",
        });
      }

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
          message: "Pacient sa nenašiel.",
        });
      }

      // 2. Fetch Client
      const client = await ctx.db.query.clients.findFirst({
        where: and(
          eq(clients.id, policy.clientId),
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt)
        ),
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Majiteľ / poistník sa nenašiel.",
        });
      }

      // 3. Check Eligibility
      const eligibility = validatePetExpertEligibility(
        {
          policyNumber: policy.policyNumber || "",
          providerName: policy.providerName,
          effectiveDate: policy.effectiveDate,
          expirationDate: policy.expirationDate,
          coveragePercent: policy.coveragePercent,
          deductible: policy.deductible,
        },
        {
          id: patient.id,
          name: patient.name,
          species: patient.species,
          breed: patient.breed,
          microchipNumber: patient.microchipNumber,
          birthDate: patient.dob,
        },
        input.claimAmount
      );

      if (!eligibility.eligible) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Nárok na poistné plnenie nemožno uplatniť: ${eligibility.errors.join(", ")}`,
        });
      }

      // 4. Fetch invoice items if provided
      let items: PetExpertInvoiceItem[] = [];
      if (input.invoiceId) {
        const rawItems = await ctx.db.query.invoiceItems.findMany({
          where: and(
            eq(invoiceItems.invoiceId, input.invoiceId),
            isNull(invoiceItems.deletedAt)
          ),
        });

        items = rawItems.map((it) => ({
          name: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          vatRate: 20,
          totalPrice: Number(it.total),
        }));
      }

      if (items.length === 0) {
        items = [
          {
            name: input.diagnosisText,
            quantity: 1,
            unitPrice: input.claimAmount,
            vatRate: 20,
            totalPrice: input.claimAmount,
          },
        ];
      }

      const claimNumber = `PETEXP-${Date.now().toString().slice(-8)}`;

      // 5. Insert Insurance Claim Record
      const [insertedClaim] = await ctx.db
        .insert(insuranceClaims)
        .values({
          practiceId: ctx.practiceId,
          policyId: policy.id,
          invoiceId: input.invoiceId,
          claimNumber,
          status: "submitted",
          claimAmount: input.claimAmount.toFixed(2),
          approvedAmount: eligibility.estimatedInsurerCoverage.toFixed(2),
          submittedAt: new Date(),
          notes: `${input.diagnosisText} | Spoluúčasť klienta: ${eligibility.estimatedCoPay} € | ${input.notes || ""}`,
        })
        .returning();

      // 6. Build Payload and HTML Report
      const claimData: PetExpertClaimData = {
        claimNumber,
        policy: {
          policyNumber: policy.policyNumber || "",
          providerName: policy.providerName,
        },
        patient: {
          id: patient.id,
          name: patient.name,
          species: patient.species,
          breed: patient.breed,
          microchipNumber: patient.microchipNumber,
          birthDate: patient.dob,
          weightKg: null,
        },
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          phone: client.phone,
          email: client.email,
          address: client.address || "",
        },
        veterinarianName: ctx.user?.name || "Veterinárny lekár",
        diagnosisText: input.diagnosisText,
        diagnosisCode: input.diagnosisCode,
        incidentDate: input.incidentDate,
        treatmentSummary: input.treatmentSummary,
        items,
        invoiceTotal: input.claimAmount,
        clientCoPayAmount: eligibility.estimatedCoPay,
        insurerPayoutAmount: eligibility.estimatedInsurerCoverage,
        clientConsentForDirectSettlement: input.clientConsentForDirectSettlement,
      };

      const payload = buildPetExpertClaimPayload(claimData);
      const printableHtml = generatePetExpertClaimHtml(claimData);

      return {
        claim: insertedClaim,
        eligibility,
        payload,
        printableHtml,
      };
    }),

  /** Zoznam poistných udalostí s filtrovaním */
  listClaims: staffProcedure
    .input(
      z.object({
        status: z.enum(["draft", "submitted", "in_review", "approved", "denied", "paid"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(insuranceClaims.practiceId, ctx.practiceId),
        isNull(insuranceClaims.deletedAt),
      ];

      if (input.status) {
        conditions.push(eq(insuranceClaims.status, input.status));
      }

      const claimsList = await ctx.db
        .select({
          id: insuranceClaims.id,
          claimNumber: insuranceClaims.claimNumber,
          status: insuranceClaims.status,
          claimAmount: insuranceClaims.claimAmount,
          approvedAmount: insuranceClaims.approvedAmount,
          submittedAt: insuranceClaims.submittedAt,
          notes: insuranceClaims.notes,
          createdAt: insuranceClaims.createdAt,
          policyId: insuranceClaims.policyId,
          invoiceId: insuranceClaims.invoiceId,
        })
        .from(insuranceClaims)
        .where(and(...conditions))
        .orderBy(desc(insuranceClaims.createdAt))
        .limit(input.limit);

      return claimsList;
    }),
});
