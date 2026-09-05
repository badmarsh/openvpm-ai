import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import {
  createRouter,
  protectedProcedure,
  requireRole,
  requireFeature,
} from "../../trpc";
import { aiImagingAnalyses, files } from "@openpims/db";
import { configuredModel } from "@/lib/agent/runner";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { readPrimaryObject } from "@/lib/s3";

const MEDICAL_IMAGING_SYSTEM_PROMPT = `You are a veterinary radiology AI assistant integrated into OpenVPM, an open-source veterinary practice management system.

Your role is to analyze medical images (X-rays, CT scans, MRI, ultrasound, clinical photos) and provide structured, clinically useful observations.

Guidelines:
- Describe what you see objectively — list findings, never give a definitive diagnosis.
- Always include a disclaimer that this is AI-assisted analysis and must be reviewed by a licensed veterinarian.
- Use the SOAP (Subjective, Objective, Assessment, Plan) framework when appropriate.
- Note any visible abnormalities, artifacts, positioning issues, or limitations.
- If the image quality is poor, state that clearly.
- Answer in the same language as the user's prompt (Slovak or English).
- For Slovak responses, use official Slovak veterinary terminology (ŠVPS SR, KVL SR).
- Be concise but thorough.`;

const analyzeInput = z.object({
  fileId: z.string().uuid(),
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  imageType: z.enum(["xray", "ct", "mri", "ultrasound", "photo"]),
  userPrompt: z.string().max(2000).optional(),
});

const listByPatientInput = z.object({
  patientId: z.string().uuid(),
});

const getInput = z.object({
  id: z.string().uuid(),
});

const imagingProcedure = protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(requireFeature("agent"));

export const imagingRouter = createRouter({
  /** Spustí AI analýzu medicínskeho obrazu */
  analyze: imagingProcedure
    .input(analyzeInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Načíta file z DB
      const [file] = await ctx.db
        .select({
          id: files.id,
          fileKey: files.fileKey,
          mimeType: files.mimeType,
          fileName: files.fileName,
        })
        .from(files)
        .where(
          and(
            eq(files.id, input.fileId),
            eq(files.practiceId, ctx.practiceId),
            isNull(files.deletedAt),
          ),
        )
        .limit(1);

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Súbor sa nenašiel",
        });
      }

      // 2. Vytvorí záznam analýzy so statusom PENDING
      const [analysis] = await ctx.db
        .insert(aiImagingAnalyses)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          fileId: input.fileId,
          appointmentId: input.appointmentId ?? null,
          requestedBy: ctx.user.id,
          modelId: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
          imageType: input.imageType,
          userPrompt: input.userPrompt ?? null,
          status: "PENDING",
        })
        .returning();

      if (!analysis) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nepodarilo sa vytvoriť záznam analýzy",
        });
      }

      try {
        // 3. Načíta obraz z objektového úložiska (priamo, bez HTTP round-trip)
        const object = await readPrimaryObject(file.fileKey, {
          maxBytes: 16 * 1024 * 1024,
        });
        if (object.status !== "available") {
          throw new Error(
            object.status === "missing"
              ? "Obraz sa v úložisku nenašiel"
              : "Obraz sa nepodarilo načítať z úložiska",
          );
        }

        const base64Image = Buffer.from(object.body).toString("base64");
        const mimeType = file.mimeType ?? object.contentType ?? "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // 4. Zavolá AI model
        const promptText = input.userPrompt
          ? `Analyzuj tento medicínsky obraz (${input.imageType}). Otázka lekára: ${input.userPrompt}`
          : `Analyzuj tento medicínsky obraz (${input.imageType}). Poskytni štruktúrovaný popis nálezov.`;

        const model = configuredModel();

        const result = await generateText({
          model,
          system: MEDICAL_IMAGING_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image", image: dataUrl },
              ],
            },
          ],
        });

        const resultText = result.text.trim();

        // 5. Uloží výsledok
        const [updated] = await ctx.db
          .update(aiImagingAnalyses)
          .set({
            status: "COMPLETED",
            result: resultText,
            rawResponse: { text: resultText, finishReason: result.finishReason },
            completedAt: new Date(),
          })
          .where(eq(aiImagingAnalyses.id, analysis.id))
          .returning();

        return updated;
      } catch (error) {
        // 6. Označí ako FAILED
        const errorMessage =
          error instanceof Error ? error.message : "Neznáma chyba";

        await ctx.db
          .update(aiImagingAnalyses)
          .set({
            status: "FAILED",
            errorMessage,
            completedAt: new Date(),
          })
          .where(eq(aiImagingAnalyses.id, analysis.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Analýza zlyhala: ${errorMessage}`,
        });
      }
    }),

  /** Vráti všetky analýzy pre daného pacienta */
  listByPatient: imagingProcedure
    .input(listByPatientInput)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            eq(aiImagingAnalyses.patientId, input.patientId),
            isNull(aiImagingAnalyses.deletedAt),
          ),
        )
        .orderBy(desc(aiImagingAnalyses.createdAt));
    }),

  /** Vráti detail jednej analýzy */
  get: imagingProcedure
    .input(getInput)
    .query(async ({ ctx, input }) => {
      const [analysis] = await ctx.db
        .select()
        .from(aiImagingAnalyses)
        .where(
          and(
            eq(aiImagingAnalyses.id, input.id),
            eq(aiImagingAnalyses.practiceId, ctx.practiceId),
            isNull(aiImagingAnalyses.deletedAt),
          ),
        )
        .limit(1);

      if (!analysis) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Analýza sa nenašla",
        });
      }

      return analysis;
    }),
});