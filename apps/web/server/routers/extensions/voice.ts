import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  protectedProcedure,
  requireRole,
  requireFeature,
} from "../../trpc";
import { voiceDictations, patients } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { transcribeAudio } from "@/lib/voice/transcription";
import {
  createFinalizedAppointmentSoapNote,
  saveAppointmentSoapDraft,
  SoapLifecycleError,
} from "@/lib/records/soap-lifecycle";
import { hasSoapContent, SOAP_SECTION_MAX_LENGTH } from "@/lib/records/soap-content";
import {
  AiDraftSafetyError,
  assertClinicianConfirmed,
  optionalClinicianConfirmationInput,
  resolveAiRecordStatus,
} from "@/lib/ai/draft-safety";
import { formatTranscriptToSoap, type SoapStyle } from "@/lib/voice/soap-formatter";
import { uploadFile, readPrimaryObject } from "@/lib/s3";

const voiceProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("agent"));

import { DEFAULT_AI_MODEL } from "@/lib/ai-models";

const DEFAULT_MODEL = DEFAULT_AI_MODEL;

function activeModelId(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

export const voiceRouter = createRouter({
  /** Kompletný upload audia, Gemini STT a SOAP formátovanie v jedinom kroku */
  uploadAndProcess: voiceProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        audioBase64: z.string().min(1).max(26_214_400, "Audio súbor je príliš veľký (max 25 MB)"),
        audioMimeType: z.string().default("audio/webm"),
        audioDurationSeconds: z.string().optional(),
        language: z.string().default("sk"),
        style: z.enum(["standard", "detailed", "concise"]).default("standard"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Overenie pacienta
      const [patient] = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
        })
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

      // 2. Spracovanie a uloženie audia do objektového úložiska
      let base64Clean = input.audioBase64.trim();
      if (base64Clean.includes(",")) {
        base64Clean = base64Clean.split(",")[1] ?? base64Clean;
      }
      const audioBuffer = Buffer.from(base64Clean, "base64");
      const audioKey = `${ctx.practiceId}/voice/${randomUUID()}.webm`;

      try {
        await uploadFile(audioKey, audioBuffer, input.audioMimeType);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa uložiť audio súbor",
        });
      }

      // 3. Vytvorenie záznamu v tabuľke voiceDictations
      const [dictation] = await ctx.db
        .insert(voiceDictations)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          appointmentId: input.appointmentId ?? null,
          dictatedBy: ctx.user.id,
          audioFileKey: audioKey,
          audioMimeType: input.audioMimeType,
          audioDurationSeconds: input.audioDurationSeconds ?? null,
          language: input.language,
          modelId: activeModelId(),
          status: "TRANSCRIBING",
        })
        .returning();

      if (!dictation) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa vytvoriť záznam diktovania",
        });
      }

      // 4. Transkripcia cez Gemini STT
      let transcript: string;
      try {
        transcript = await transcribeAudio(audioKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transkripcia zlyhala";
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

      // 5. SOAP formátovanie
      try {
        const soap = await formatTranscriptToSoap(transcript, {
          style: input.style as SoapStyle,
          patientName: patient.name,
          species: patient.species,
        });

        const [completed] = await ctx.db
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
              style: input.style,
            },
            status: "COMPLETED",
            completedAt: new Date(),
          })
          .where(eq(voiceDictations.id, dictation.id))
          .returning();

        return completed ?? dictation;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Formátovanie SOAP zlyhalo";
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

      if (!input.audioFileKey.startsWith(`${ctx.practiceId}/`)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "audioFileKey musí byť v rámci adresára praktiky",
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
        .orderBy(desc(voiceDictations.createdAt))
        .limit(50);
    }),

  /** Preformátuje existujúcu alebo upravenú transkripciu do SOAP štruktúry */
  formatTextToSoap: voiceProcedure
    .input(
      z.object({
        transcript: z.string().min(1),
        patientId: z.string().uuid().optional(),
        dictationId: z.string().uuid().optional(),
        style: z.enum(["standard", "detailed", "concise"]).default("standard"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let patientName: string | undefined;
      let species: string | null = null;

      if (input.patientId) {
        const [patient] = await ctx.db
          .select({ name: patients.name, species: patients.species })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt),
            ),
          )
          .limit(1);

        if (patient) {
          patientName = patient.name;
          species = patient.species;
        }
      }

      const soap = await formatTranscriptToSoap(input.transcript, {
        style: input.style as SoapStyle,
        patientName,
        species,
      });

      if (input.dictationId) {
        await ctx.db
          .update(voiceDictations)
          .set({
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
          })
          .where(
            and(
              eq(voiceDictations.id, input.dictationId),
              eq(voiceDictations.practiceId, ctx.practiceId),
              isNull(voiceDictations.deletedAt),
            ),
          );
      }

      return soap;
    }),

  /** Vráti audio Data URL pre prehrávanie v prehliadači (do 24h GDPR skartácie) */
  getAudio: voiceProcedure
    .input(z.object({ dictationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [dictation] = await ctx.db
        .select({
          id: voiceDictations.id,
          audioFileKey: voiceDictations.audioFileKey,
          audioMimeType: voiceDictations.audioMimeType,
          audioDeletedAt: voiceDictations.audioDeletedAt,
          createdAt: voiceDictations.createdAt,
        })
        .from(voiceDictations)
        .where(
          and(
            eq(voiceDictations.id, input.dictationId),
            eq(voiceDictations.practiceId, ctx.practiceId),
            isNull(voiceDictations.deletedAt),
          ),
        )
        .limit(1);

      if (!dictation || !dictation.audioFileKey || dictation.audioDeletedAt) {
        return null;
      }

      try {
        const obj = await readPrimaryObject(dictation.audioFileKey, { maxBytes: 26_214_400 });
        if (obj.status !== "available") return null;

        const base64 = Buffer.from(obj.body).toString("base64");
        const mimeType = dictation.audioMimeType || "audio/webm";

        return {
          audioDataUrl: `data:${mimeType};base64,${base64}`,
          mimeType,
        };
      } catch {
        return null;
      }
    }),

  /**
   * Uloží SOAP note z diktovania do klinických záznamov (vanilla soapNotes).
   *
   * Human-in-the-loop: AI transcription never finalizes a record on its own.
   *  - Without `clinicianConfirmed: true` the note is saved as an editable
   *    *draft* on the open encounter.
   *  - Only an explicit `clinicianConfirmed: true` finalizes it, and even then
   *    the write goes through the shared SOAP lifecycle (open in-exam visit
   *    lock, no duplicate drafts, immutable finalized notes).
   *  - Dictations without an appointment can never be finalized: there is no
   *    encounter to sign.
   */
  saveAsSoapNote: voiceProcedure
    .input(
      z.object({
        dictationId: z.string().uuid(),
        subjective: z.string().max(SOAP_SECTION_MAX_LENGTH),
        objective: z.string().max(SOAP_SECTION_MAX_LENGTH),
        assessment: z.string().max(SOAP_SECTION_MAX_LENGTH),
        plan: z.string().max(SOAP_SECTION_MAX_LENGTH),
        clinicianConfirmed: optionalClinicianConfirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sections = {
        subjective: input.subjective || null,
        objective: input.objective || null,
        assessment: input.assessment || null,
        plan: input.plan || null,
      };
      if (!hasSoapContent(sections)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SOAP note must include at least one section.",
        });
      }

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

      if (!dictation.appointmentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Diktovanie nie je priradené k otvorenej vizite. Priraďte ho k vizite pred uložením do kartotéky.",
        });
      }
      const appointmentId = dictation.appointmentId;

      const status = resolveAiRecordStatus({
        requestedStatus: input.clinicianConfirmed ? "finalized" : "draft",
        clinicianConfirmed: input.clinicianConfirmed,
      });
      const actor = { id: ctx.user.id, name: ctx.user.name ?? ctx.user.email };

      try {
        if (status === "finalized") {
          assertClinicianConfirmed(input.clinicianConfirmed);
          const note = await ctx.db.transaction((tx) =>
            createFinalizedAppointmentSoapNote(tx as unknown as Database, {
              practiceId: ctx.practiceId,
              patientId: dictation.patientId,
              appointmentId,
              actor,
              sections,
            }),
          );
          await ctx.db
            .update(voiceDictations)
            .set({ soapNoteId: note.id })
            .where(eq(voiceDictations.id, dictation.id));
          return { ...note, patientId: dictation.patientId, status };
        }

        const result = await ctx.db.transaction((tx) =>
          saveAppointmentSoapDraft(tx as unknown as Database, {
            practiceId: ctx.practiceId,
            patientId: dictation.patientId,
            appointmentId,
            expectedRevision: 0,
            actor,
            sections,
          }),
        );
        if (result.outcome === "already_finalized") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This encounter already has finalized SOAP documentation.",
          });
        }
        if (result.outcome === "conflict") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A SOAP draft already exists for this encounter. Resume it in the chart instead.",
          });
        }
        await ctx.db
          .update(voiceDictations)
          .set({ soapNoteId: result.draft.id })
          .where(eq(voiceDictations.id, dictation.id));
        return { ...result.draft, patientId: dictation.patientId, status };
      } catch (error) {
        if (error instanceof SoapLifecycleError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }
        if (error instanceof AiDraftSafetyError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }
        throw error;
      }
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
