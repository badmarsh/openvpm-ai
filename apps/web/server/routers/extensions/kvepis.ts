import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extKvepisSubmissions,
  extKvepisCredentials,
  patients,
} from "@openpims/db";
import {
  validateKvepisSubmission,
  type KvepisSubmissionType,
} from "@/lib/kvepis/validator";
import {
  buildKvepisPayload,
  buildReferenceNumber,
  hashPayload,
} from "@/lib/kvepis/builder";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician")
);

/** Počet podaní v daný kalendárny deň pre kliniku + 1 → poradové číslo. */
async function nextSequenceForToday(
  db: typeof import("@openpims/db/client").db,
  practiceId: string
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(extKvepisSubmissions)
    .where(
      and(
        eq(extKvepisSubmissions.practiceId, practiceId),
        isNull(extKvepisSubmissions.deletedAt)
      )
    );
  return (row?.count ?? 0) + 1;
}

export const kvepisRouter = createRouter({
  /** Konfigurácia prístupu kliniky (IČO, KVL ID, ÚPVS schránka, podpis). */
  getCredentials: vetProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.extKvepisCredentials.findFirst({
      where: and(
        eq(extKvepisCredentials.practiceId, ctx.practiceId),
        isNull(extKvepisCredentials.deletedAt)
      ),
    });
    return row ?? null;
  }),

  upsertCredentials: vetProcedure
    .input(
      z.object({
        ico: z.string().min(8).max(8),
        kvlId: z.string().optional(),
        upvsSchranka: z.string().optional(),
        integrationMode: z.enum(["GUIDED", "B2G"]).default("GUIDED"),
        signingPreference: z
          .enum(["NONE", "DSIGNER", "CLOUD_SEAL", "HSM"])
          .default("DSIGNER"),
        certificateBase64: z.string().optional(),
        certificateSerial: z.string().optional(),
        certificateValidUntil: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.extKvepisCredentials.findFirst({
        where: and(
          eq(extKvepisCredentials.practiceId, ctx.practiceId),
          isNull(extKvepisCredentials.deletedAt)
        ),
      });

      const values = {
        ico: input.ico,
        kvlId: input.kvlId ?? null,
        upvsSchranka: input.upvsSchranka ?? null,
        integrationMode: input.integrationMode,
        signingPreference: input.signingPreference,
        certificateBase64: input.certificateBase64 ?? null,
        certificateSerial: input.certificateSerial ?? null,
        certificateValidUntil: input.certificateValidUntil
          ? new Date(input.certificateValidUntil)
          : null,
        isActive: true,
      };

      if (existing) {
        const [updated] = await ctx.db
          .update(extKvepisCredentials)
          .set(values)
          .where(eq(extKvepisCredentials.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(extKvepisCredentials)
        .values({ practiceId: ctx.practiceId, ...values })
        .returning();
      return created;
    }),

  /** Prehľad pripravených podaní z ambulantnej knihy. */
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
          limit: z.number().int().min(1).max(200).default(50),
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
          referenceNumber: extKvepisSubmissions.referenceNumber,
          submissionType: extKvepisSubmissions.submissionType,
          status: extKvepisSubmissions.status,
          farmIco: extKvepisSubmissions.farmIco,
          cehzCode: extKvepisSubmissions.cehzCode,
          earTagNumber: extKvepisSubmissions.earTagNumber,
          transponderNumber: extKvepisSubmissions.transponderNumber,
          kvlNumber: extKvepisSubmissions.kvlNumber,
          payloadHash: extKvepisSubmissions.payloadHash,
          submittedAt: extKvepisSubmissions.submittedAt,
          receiptReceivedAt: extKvepisSubmissions.receiptReceivedAt,
          errorCode: extKvepisSubmissions.errorCode,
          errorMessage: extKvepisSubmissions.errorMessage,
          createdAt: extKvepisSubmissions.createdAt,
          patientId: patients.id,
          patientName: patients.name,
          species: patients.species,
          microchipNumber: patients.microchipNumber,
        })
        .from(extKvepisSubmissions)
        .leftJoin(
          patients,
          and(
            eq(extKvepisSubmissions.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...whereConds))
        .orderBy(desc(extKvepisSubmissions.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(extKvepisSubmissions)
        .where(and(...whereConds));

      return { items: rows, totalCount: countResult?.count ?? 0 };
    }),

  /** Vytvorenie nového podania (DRAFT) s okamžitou validáciou. */
  createSubmission: vetProcedure
    .input(
      z.object({
        submissionType: z.enum([
          "rabies_notification",
          "treatment_diary_batch",
          "animal_movement",
          "infectious_disease_alert",
        ]),
        patientId: z.string().uuid().optional(),
        sourceEntityType: z.string().optional(),
        sourceEntityId: z.string().uuid().optional(),
        farmIco: z.string().optional(),
        cehzCode: z.string().optional(),
        earTagNumber: z.string().optional(),
        transponderNumber: z.string().optional(),
        kvlNumber: z.string().optional(),
        animalSpecies: z.string().optional(),
        diagnosis: z.string().optional(),
        medicationName: z.string().optional(),
        meatWithdrawalDays: z.number().int().min(0).optional(),
        milkWithdrawalDays: z.number().int().min(0).optional(),
        administeredAt: z.string().optional(),
        safeUntil: z.string().optional(),
        incidentDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const seq = await nextSequenceForToday(ctx.db, ctx.practiceId);
      const referenceNumber = buildReferenceNumber(new Date(), seq);

      // Klinické polia sa v DRAFT fáze ukladajú do payloadJson, z ktorého ich
      // číta validačný engine (validateAndBuild). Pri validácii sa potom
      // payloadJson prepíše úplným kanonizovaným payloadom.
      const draftJson: Record<string, unknown> = {
        animalSpecies: input.animalSpecies ?? null,
        diagnosis: input.diagnosis ?? null,
        medicationName: input.medicationName ?? null,
        meatWithdrawalDays: input.meatWithdrawalDays ?? null,
        milkWithdrawalDays: input.milkWithdrawalDays ?? null,
        administeredAt: input.administeredAt ?? null,
        safeUntil: input.safeUntil ?? null,
        incidentDate: input.incidentDate ?? null,
      };

      const [created] = await ctx.db
        .insert(extKvepisSubmissions)
        .values({
          practiceId: ctx.practiceId,
          submissionType: input.submissionType as KvepisSubmissionType,
          referenceNumber,
          patientId: input.patientId ?? null,
          sourceEntityType: input.sourceEntityType ?? null,
          sourceEntityId: input.sourceEntityId ?? null,
          farmIco: input.farmIco ?? null,
          cehzCode: input.cehzCode ?? null,
          earTagNumber: input.earTagNumber ?? null,
          transponderNumber: input.transponderNumber ?? null,
          kvlNumber: input.kvlNumber ?? null,
          payloadJson: draftJson,
          status: "DRAFT",
        })
        .returning();

      return created;
    }),

  /**
   * Validácia existujúceho podania. Vracia zoznam chýb a varovaní; ak je
   * podanie validné, vygeneruje a uloží XML/JSON payload + hash a prejde do
   * stavu VALIDATED.
   */
  validateAndBuild: vetProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.extKvepisSubmissions.findFirst({
        where: and(
          eq(extKvepisSubmissions.id, input.submissionId),
          eq(extKvepisSubmissions.practiceId, ctx.practiceId),
          isNull(extKvepisSubmissions.deletedAt)
        ),
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Podanie nebolo nájdené" });
      }

      const credentials = await ctx.db.query.extKvepisCredentials.findFirst({
        where: and(
          eq(extKvepisCredentials.practiceId, ctx.practiceId),
          isNull(extKvepisCredentials.deletedAt)
        ),
      });

      // Polia, ktoré nie sú na zázname (diagnóza, liečivo, lehoty), prichádzajú
      // z payloadu JSON ak už existuje, inak ich validujeme na dostupných údajoch.
      const previousJson = (submission.payloadJson ?? {}) as Record<string, unknown>;

      const result = validateKvepisSubmission({
        submissionType: submission.submissionType,
        farmIco: submission.farmIco,
        cehzCode: submission.cehzCode,
        earTagNumber: submission.earTagNumber,
        transponderNumber: submission.transponderNumber,
        kvlNumber: submission.kvlNumber ?? credentials?.kvlId,
        animalSpecies: (previousJson.animalSpecies as string) ?? undefined,
        diagnosis: (previousJson.diagnosis as string) ?? undefined,
        medicationName: (previousJson.medicationName as string) ?? undefined,
        meatWithdrawalDays: (previousJson.meatWithdrawalDays as number) ?? undefined,
        milkWithdrawalDays: (previousJson.milkWithdrawalDays as number) ?? undefined,
        administeredAt: (previousJson.administeredAt as string) ?? undefined,
        safeUntil: (previousJson.safeUntil as string) ?? undefined,
        incidentDate: (previousJson.incidentDate as string) ?? undefined,
      });

      if (!result.valid) {
        return { valid: false, issues: result.issues, payload: null };
      }

      const payload = buildKvepisPayload({
        submissionType: submission.submissionType,
        referenceNumber: submission.referenceNumber,
        practiceIco: credentials?.ico ?? "",
        practiceKvlId: credentials?.kvlId ?? null,
        farmIco: submission.farmIco,
        cehzCode: submission.cehzCode,
        earTagNumber: submission.earTagNumber,
        transponderNumber: submission.transponderNumber,
        kvlNumber: submission.kvlNumber ?? credentials?.kvlId,
        animalSpecies: (previousJson.animalSpecies as string) ?? undefined,
        diagnosis: (previousJson.diagnosis as string) ?? undefined,
        medicationName: (previousJson.medicationName as string) ?? undefined,
        meatWithdrawalDays: (previousJson.meatWithdrawalDays as number) ?? undefined,
        milkWithdrawalDays: (previousJson.milkWithdrawalDays as number) ?? undefined,
        administeredAt: (previousJson.administeredAt as string) ?? undefined,
        safeUntil: (previousJson.safeUntil as string) ?? undefined,
        incidentDate: (previousJson.incidentDate as string) ?? undefined,
      });

      await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "VALIDATED",
          payloadXml: payload.xml,
          payloadJson: payload.json,
          payloadHash: payload.hash,
        })
        .where(eq(extKvepisSubmissions.id, submission.id));

      return { valid: true, issues: result.issues, payload };
    }),

  /** Označenie podania ako podpísaného (KEP) — D.Signer / cloudová pečať / HSM. */
  signSubmission: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        signatureMethod: z.enum(["DSIGNER", "CLOUD_SEAL", "HSM"]),
        signaturePayload: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.extKvepisSubmissions.findFirst({
        where: and(
          eq(extKvepisSubmissions.id, input.submissionId),
          eq(extKvepisSubmissions.practiceId, ctx.practiceId),
          isNull(extKvepisSubmissions.deletedAt)
        ),
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Podanie nebolo nájdené" });
      }
      if (!submission.payloadHash) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Podanie musí byť najprv validované (VALIDATED)",
        });
      }

      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "SIGNED",
          signatureMethod: input.signatureMethod,
          signaturePayload: input.signaturePayload ?? {},
          signedBy: ctx.session?.user?.id ?? null,
          signedAt: new Date(),
        })
        .where(eq(extKvepisSubmissions.id, submission.id))
        .returning();

      return updated;
    }),

  /**
   * Odoslanie podania. Vo fáze 1 (GUIDED) zaznamená odoslanie a vytvorí
   * MessageID; skutočný transport cez B2G bránu nadviaže vo fáze 2.
   */
  submitSubmission: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        upvsMessageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.extKvepisSubmissions.findFirst({
        where: and(
          eq(extKvepisSubmissions.id, input.submissionId),
          eq(extKvepisSubmissions.practiceId, ctx.practiceId),
          isNull(extKvepisSubmissions.deletedAt)
        ),
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Podanie nebolo nájdené" });
      }
      if (submission.status !== "SIGNED" && submission.status !== "VALIDATED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Podanie musí byť podpísané (SIGNED) pred odoslaním",
        });
      }

      const realMode = process.env.KVEPIS_REAL_MODE === "true";
      let messageId = input.upvsMessageId ?? `UPVS-${submission.referenceNumber}`;

      if (realMode) {
        // ── Real B2G transport to ÚPVS eDesk ────────────────────────────────
        const upvsEndpoint = process.env.KVEPIS_UPVS_ENDPOINT;
        const upvsApiKey = process.env.KVEPIS_UPVS_API_KEY;

        if (!upvsEndpoint || !upvsApiKey) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "KVEPIS_REAL_MODE=true ale KVEPIS_UPVS_ENDPOINT alebo KVEPIS_UPVS_API_KEY nie sú nastavené.",
          });
        }

        const payload = {
          referenceNumber: submission.referenceNumber,
          practiceId: ctx.practiceId,
          submissionId: submission.id,
          submittedAt: new Date().toISOString(),
          xmlPayload: submission.payloadXml,
        };

        let upvsResponse: Response;
        try {
          upvsResponse = await fetch(upvsEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": upvsApiKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30_000),
          });
        } catch (err) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `ÚPVS endpoint nedostupný: ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        if (!upvsResponse.ok) {
          const body = await upvsResponse.text().catch(() => "(no body)");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `ÚPVS vrátil chybu ${upvsResponse.status}: ${body.slice(0, 300)}`,
          });
        }

        const responseData = (await upvsResponse.json()) as { messageId?: string };
        if (responseData.messageId) {
          messageId = responseData.messageId;
        }
      }

      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "SUBMITTED",
          submittedAt: new Date(),
          upvsMessageId: messageId,
        })
        .where(eq(extKvepisSubmissions.id, submission.id))
        .returning();

      return {
        ...updated,
        /** Indicates to the frontend that this was a simulated (not real) submission. */
        isSimulationMode: !realMode,
      };
    }),

  /**
   * Nahratie doručenky / potvrdenia z ÚPVS a automatické spárovanie so
   * záznamom pacienta (podanie → ACKNOWLEDGED).
   */
  uploadReceipt: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        receiptPayload: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.extKvepisSubmissions.findFirst({
        where: and(
          eq(extKvepisSubmissions.id, input.submissionId),
          eq(extKvepisSubmissions.practiceId, ctx.practiceId),
          isNull(extKvepisSubmissions.deletedAt)
        ),
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Podanie nebolo nájdené" });
      }

      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "ACKNOWLEDGED",
          receiptReceivedAt: new Date(),
          receiptPayload: input.receiptPayload,
          receiptHash: hashPayload(input.receiptPayload),
        })
        .where(eq(extKvepisSubmissions.id, submission.id))
        .returning();

      return updated;
    }),

  /** Označenie zamietnutého podania s chybovým kódom ŠVPS SR. */
  markRejected: vetProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        errorCode: z.string().min(1),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extKvepisSubmissions)
        .set({
          status: "REJECTED",
          errorCode: input.errorCode,
          errorMessage: input.errorMessage ?? null,
        })
        .where(
          and(
            eq(extKvepisSubmissions.id, input.submissionId),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Zaznamenanie elektronického podpisu (D.Signer / KEP) s odtlačkom (kompatibilita pre rýchle akcie).
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
          payloadHash: input.signatureHash,
          signatureMethod: "DSIGNER",
          signedBy: ctx.session?.user?.id ?? null,
          signedAt: new Date(),
        })
        .where(
          and(
            eq(extKvepisSubmissions.id, input.submissionId),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId),
            isNull(extKvepisSubmissions.deletedAt)
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
   * Zaznamenanie doručenky / potvrdenia o prevzatí z ÚPVS (kompatibilita pre rýchle akcie).
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
          receiptReceivedAt: new Date(),
          receiptPayload: { receiptReference: input.receiptReference },
        })
        .where(
          and(
            eq(extKvepisSubmissions.id, input.submissionId),
            eq(extKvepisSubmissions.practiceId, ctx.practiceId),
            isNull(extKvepisSubmissions.deletedAt)
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
});
