import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  protectedProcedure,
  requireRole,
  requireFeature,
} from "../../trpc";
import { voiceDictations, soapNotes, patients } from "@openpims/db";
import { transcribeAudio } from "@/lib/voice/transcription";
import { formatTranscriptToSoap } from "@/lib/voice/soap-formatter";

const voiceProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("agent"));

const DEFAULT_MODEL = "gemini-3.7-flash";

function activeModelId(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

export const voiceRouter = createRouter({
  /** Vytvorí záznam o diktovaní po úspešnom audiu uploade. */
  start: voiceProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        audioFileKey: z.string().min(1),
        audioMimeType: z.string().default("audio/webm"),
        audioDurationSeconds: z.string().optional(),
        language: z.string().default("sk"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Overí, že pacient patrí do praxe
      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt),
          ),
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pacient sa nenašiel",
        });
      }

      const [dictation] = await ctx.db
        .insert(voiceDictations)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          appointmentId: input.appointmentId ?? null,
          dictatedBy: ctx.user.id,
          audioFileKey: input.audioFileKey,
          audioMimeType: input.audioMimeType,
          audioDurationSeconds: input.audioDurationSeconds ?? null,
          language: input.language,
          modelId: activeModelId(),
          status: "RECORDING",
        })
        .returning();

      if (!dictation) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa vytvoriť záznam diktovania",
        });
      }

      return dictation;
    }),

  /** Spustí transkripciu + SOAP formátovanie pre existujúce diktovanie. */
  process: voiceProcedure
    .input(z.object({ dictationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [dictation] = await ctx.db
        .select()
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.id, input.dictationId),
            eq(voiceDictations.practiceId, ctx.practiceId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .limit(1);

      if (!dictation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diktovanie sa nenašlo",
        });
      }

      if (!dictation.audioFileKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Diktovanie nemá priradený audio súbor",
        });
      }

      // 1. Transkripcia
      await ctx.db
        .update(voiceDictations)
        .set({ status: "TRANSCRIBING" })
        .where(eq(voiceDictations.id, dictation.id));

      let transcript: string;
      try {
        transcript = await transcribeAudio(dictation.audioFileKey);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transkripcia zlyhala";
        await ctx.db
          .update(voiceDictations)
          .set({ status: "FAILED", errorMessage: message })
          .where(eq(voiceDictations.id, dictation.id));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Transkripcia zlyhala: ${message}`,
        });
      }

      await ctx.db
        .update(voiceDictations)
        .set({
          rawTranscript: transcript,
          transcribedAt: new Date(),
          status: "FORMATTING",
        })
        .where(eq(voiceDictations.id, dictation.id));

      // 2. SOAP formátovanie
      try {
        const soap = await formatTranscriptToSoap(transcript);
        const [updated] = await ctx.db
          .update(voiceDictations)
          .set({
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
            rawAiResponse: {
              transcript,
              soap,
              model: dictation.modelId,
            },
            status: "COMPLETED",
            completedAt: new Date(),
          })
          .where(eq(voiceDictations.id, dictation.id))
          .returning();

        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Formátovanie SOAP zlyhalo";
        await ctx.db
          .update(voiceDictations)
          .set({ status: "FAILED", errorMessage: message })
          .where(eq(voiceDictations.id, dictation.id));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Formátovanie SOAP zlyhalo: ${message}`,
        });
      }
    }),

  /** Vráti detail diktovania. */
  get: voiceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [dictation] = await ctx.db
        .select()
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.id, input.id),
            eq(voiceDictations.practiceId, ctx.practiceId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .limit(1);

      if (!dictation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diktovanie sa nenašlo",
        });
      }

      return dictation;
    }),

  /** Zoznam diktovaní pre pacienta. */
  listByPatient: voiceProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.practiceId, ctx.practiceId),
            eq(voiceDictations.patientId, input.patientId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .orderBy(desc(voiceDictations.createdAt));
    }),

  /** Uloží potvrdený SOAP note do klinických záznamov (vanilla soapNotes). */
  saveAsSoapNote: voiceProcedure
    .input(
      z.object({
        dictationId: z.string().uuid(),
        subjective: z.string(),
        objective: z.string(),
        assessment: z.string(),
        plan: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [dictation] = await ctx.db
        .select()
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.id, input.dictationId),
            eq(voiceDictations.practiceId, ctx.practiceId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .limit(1);

      if (!dictation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diktovanie sa nenašlo",
        });
      }

      // Vytvorí SOAP note vo vanilla tabuľke
      const [note] = await ctx.db
        .insert(soapNotes)
        .values({
          practiceId: ctx.practiceId,
          patientId: dictation.patientId,
          appointmentId: dictation.appointmentId,
          authorId: ctx.user.id,
          authorName: ctx.user.name ?? ctx.user.email,
          status: "finalized",
          finalizedAt: new Date(),
          finalizedBy: ctx.user.id,
          finalizerName: ctx.user.name ?? ctx.user.email,
          subjective: input.subjective || null,
          objective: input.objective || null,
          assessment: input.assessment || null,
          plan: input.plan || null,
        })
        .returning();

      return note;
    }),

  /** Soft-delete diktovania. */
  delete: voiceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [dictation] = await ctx.db
        .select({ id: voiceDictations.id })
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.id, input.id),
            eq(voiceDictations.practiceId, ctx.practiceId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .limit(1);

      if (!dictation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Diktovanie sa nenašlo",
        });
      }

      await ctx.db
        .update(voiceDictations)
        .set({ deletedAt: new Date() })
        .where(eq(voiceDictations.id, input.id));

      return { success: true };
    }),
});
