/**
 * tRPC router for automation journeys.
 *
 * Provides CRUD operations for ext_automation_journeys.
 */

import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../../trpc";
import { extAutomationJourneys } from "@openpims/db";
import type { AutomationJourneyStep } from "@openpims/db";
import { CRM_SEGMENT_KEYS } from "@/lib/autopilot/segmentation-engine";

/**
 * Journey segment targeting: must be canonical keys (empty = all clients).
 * Plain z.enum (not .refine) so the router input keeps full static typing.
 */
const segmentKeyEnum = z.enum(
  CRM_SEGMENT_KEYS as unknown as [string, ...string[]]
);
const targetSegmentKeysSchema = z.array(segmentKeyEnum);

export const automationJourneysRouter = createRouter({
  /**
   * List journeys for current practice.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const journeys = await ctx.db
      .select()
      .from(extAutomationJourneys)
      .where(
        and(
          eq(extAutomationJourneys.practiceId, ctx.practiceId),
          isNull(extAutomationJourneys.deletedAt)
        )
      )
      .orderBy(desc(extAutomationJourneys.createdAt));

    return journeys.map((j) => ({
      ...j,
      enabled: j.isActive,
    }));
  }),

  /**
   * Create a new journey.
   */
  create: protectedProcedure
    .input(
      z.object({
        journeyKey: z.string().max(100),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        triggerEventType: z.string().default("visit_completed"),
        steps: z.array(z.any()).default([]), // AutomationJourneyStep[]
        isActive: z.boolean().default(true),
        enabled: z.boolean().optional(),
        frequencyCapWindowDays: z.number().int().min(1).default(30),
        frequencyCapMaxSteps: z.number().int().min(0).default(4),
        allowReentry: z.boolean().default(false),
        targetSegmentKeys: targetSegmentKeysSchema.default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const active =
        input.enabled !== undefined ? input.enabled : input.isActive;

      const [journey] = await ctx.db
        .insert(extAutomationJourneys)
        .values({
          practiceId: ctx.practiceId,
          journeyKey: input.journeyKey,
          name: input.name,
          description: input.description ?? "",
          triggerEventType: input.triggerEventType as any,
          steps: input.steps as AutomationJourneyStep[],
          version: 1,
          isActive: active,
          frequencyCapWindowDays: input.frequencyCapWindowDays,
          frequencyCapMaxSteps: input.frequencyCapMaxSteps,
          allowReentry: input.allowReentry,
          targetSegmentKeys: input.targetSegmentKeys,
          createdBy: ctx.user?.id ?? null,
        })
        .returning();

      return {
        ...journey,
        enabled: journey.isActive,
      };
    }),

  /**
   * Update an existing journey.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        steps: z.array(z.any()).optional(), // AutomationJourneyStep[]
        isActive: z.boolean().optional(),
        enabled: z.boolean().optional(),
        frequencyCapWindowDays: z.number().int().min(1).optional(),
        frequencyCapMaxSteps: z.number().int().min(0).optional(),
        allowReentry: z.boolean().optional(),
        targetSegmentKeys: targetSegmentKeysSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, enabled, isActive, ...updates } = input;
      const active = enabled !== undefined ? enabled : isActive;

      const updateData: Record<string, any> = {
        ...updates,
      };
      if (active !== undefined) {
        updateData.isActive = active;
      }

      // If steps are being updated, increment version
      if (updates.steps) {
        const [existing] = await ctx.db
          .select({ version: extAutomationJourneys.version })
          .from(extAutomationJourneys)
          .where(eq(extAutomationJourneys.id, id))
          .limit(1);

        if (existing) {
          updateData.version = existing.version + 1;
        }
      }

      const [updatedJourney] = await ctx.db
        .update(extAutomationJourneys)
        .set(updateData)
        .where(
          and(
            eq(extAutomationJourneys.id, id),
            eq(extAutomationJourneys.practiceId, ctx.practiceId),
            isNull(extAutomationJourneys.deletedAt)
          )
        )
        .returning();

      if (!updatedJourney) {
        throw new Error("Journey not found");
      }

      return {
        ...updatedJourney,
        enabled: updatedJourney.isActive,
      };
    }),

  /**
   * Soft-delete a journey. Deactivates it so the rules engine (which only
   * enrolls isActive journeys) stops new enrollments; in-flight enrollments
   * drain naturally against their pinned journey version.
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .update(extAutomationJourneys)
        .set({ deletedAt: new Date(), isActive: false })
        .where(
          and(
            eq(extAutomationJourneys.id, input.id),
            eq(extAutomationJourneys.practiceId, ctx.practiceId),
            isNull(extAutomationJourneys.deletedAt)
          )
        )
        .returning({ id: extAutomationJourneys.id });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Journey not found",
        });
      }

      return { id: deleted.id };
    }),
});
