import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extContentBriefs,
  extContentPillars,
  extContentBriefStatusEnum,
  users,
} from "@openpims/db";

export const automationContentRouter = createRouter({
  listPillars: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(extContentPillars)
        .where(
          and(
            eq(extContentPillars.practiceId, ctx.practiceId),
            isNull(extContentPillars.deletedAt)
          )
        )
        .orderBy(extContentPillars.sortOrder);
    }),

  listBriefs: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        status: z
          .enum([
            "all",
            "pending",
            "generating",
            "review",
            "approved",
            "rejected",
            "archived",
          ])
          .default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extContentBriefs.practiceId, ctx.practiceId),
        isNull(extContentBriefs.deletedAt),
      ];

      if (input.status !== "all") {
        conditions.push(
          eq(extContentBriefs.status, input.status as any)
        );
      }

      const rows = await ctx.db
        .select({
          id: extContentBriefs.id,
          pillarId: extContentBriefs.pillarId,
          briefText: extContentBriefs.briefText,
          targetChannels: extContentBriefs.targetChannels,
          targetAudience: extContentBriefs.targetAudience,
          clinicalClaims: extContentBriefs.clinicalClaims,
          brandVoiceOverride: extContentBriefs.brandVoiceOverride,
          status: extContentBriefs.status,
          generatedBy: extContentBriefs.generatedBy,
          generatedAt: extContentBriefs.generatedAt,
          confidence: extContentBriefs.confidence,
          reviewedBy: extContentBriefs.reviewedBy,
          reviewedAt: extContentBriefs.reviewedAt,
          reviewNote: extContentBriefs.reviewNote,
          createdAt: extContentBriefs.createdAt,
          source: extContentBriefs.source,
          pillarTitle: extContentPillars.title,
          pillarKey: extContentPillars.pillarKey,
          reviewerName: users.name,
        })
        .from(extContentBriefs)
        .leftJoin(
          extContentPillars,
          eq(extContentBriefs.pillarId, extContentPillars.id)
        )
        .leftJoin(
          users,
          eq(extContentBriefs.reviewedBy, users.id)
        )
        .where(and(...conditions))
        .orderBy(desc(extContentBriefs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  createBrief: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        pillarId: z.string().uuid().optional(),
        briefText: z.string().min(5).max(2000),
        targetChannels: z.array(z.string()).default(["facebook", "instagram"]),
        targetAudience: z.string().max(255).default("Všetci majitelia zvierat"),
        scheduledDate: z.string().optional(),
        clinicalClaims: z
          .array(
            z.object({
              claim: z.string(),
              kind: z.enum([
                "dosage",
                "diagnosis",
                "prognosis",
                "lab_interpretation",
                "prevention_efficacy",
                "other",
              ]),
              sourceRef: z.string().optional(),
              verdict: z.enum(["approved", "rejected", "edited"]).optional(),
              reviewerNote: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sourcePayload: Record<string, unknown> = {};
      if (input.scheduledDate) {
        sourcePayload.scheduledDate = input.scheduledDate;
      }

      const [created] = await ctx.db
        .insert(extContentBriefs)
        .values({
          practiceId: ctx.practiceId,
          pillarId: input.pillarId ?? null,
          briefText: input.briefText,
          targetChannels: input.targetChannels,
          targetAudience: input.targetAudience,
          clinicalClaims: input.clinicalClaims,
          status: input.clinicalClaims.length > 0 ? "review" : "pending",
          source: sourcePayload,
        })
        .returning();

      return created;
    }),

  approveBrief: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        reviewNote: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [updated] = await ctx.db
        .update(extContentBriefs)
        .set({
          status: "approved",
          reviewedBy: ctx.user.id,
          reviewedAt: now,
          reviewNote: input.reviewNote ?? "Schválené veterinárom",
        })
        .where(
          and(
            eq(extContentBriefs.id, input.id),
            eq(extContentBriefs.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content brief not found",
        });
      }

      return updated;
    }),

  rejectBrief: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        reviewNote: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [updated] = await ctx.db
        .update(extContentBriefs)
        .set({
          status: "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: now,
          reviewNote: input.reviewNote,
        })
        .where(
          and(
            eq(extContentBriefs.id, input.id),
            eq(extContentBriefs.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content brief not found",
        });
      }

      return updated;
    }),
});
