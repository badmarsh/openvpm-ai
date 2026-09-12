/**
 * tRPC router for automation journeys.
 *
 * Provides CRUD operations for ext_automation_journeys.
 */

import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extAutomationJourneys } from "@openpims/db";
import type { AutomationJourneyStep } from "@openpims/db";

export const automationJourneysRouter = createRouter({
  /**
   * List journeys for current practice.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const journeys = await ctx.db
      .select()
      .from(extAutomationJourneys)
      .where(eq(extAutomationJourneys.practiceId, ctx.practiceId))
      .orderBy(desc(extAutomationJourneys.createdAt));

    return journeys;
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
        steps: z.array(z.any()), // AutomationJourneyStep[]
        enabled: z.boolean().default(true),
        maxEnrollmentsPerClient: z.number().int().min(1).optional(),
        enrollmentCapWindowDays: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [journey] = await ctx.db
        .insert(extAutomationJourneys)
        .values({
          practiceId: ctx.practiceId,
          journeyKey: input.journeyKey,
          name: input.name,
          description: input.description,
          steps: input.steps as AutomationJourneyStep[],
          version: 1,
          enabled: input.enabled,
          maxEnrollmentsPerClient: input.maxEnrollmentsPerClient,
          enrollmentCapWindowDays: input.enrollmentCapWindowDays,
        })
        .returning();

      return journey;
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
        enabled: z.boolean().optional(),
        maxEnrollmentsPerClient: z.number().int().min(1).optional(),
        enrollmentCapWindowDays: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // If steps are being updated, increment version
      if (updates.steps) {
        const [existing] = await ctx.db
          .select({ version: extAutomationJourneys.version })
          .from(extAutomationJourneys)
          .where(eq(extAutomationJourneys.id, id))
          .limit(1);

        if (existing) {
          (updates as any).version = existing.version + 1;
        }
      }

      const [updatedJourney] = await ctx.db
        .update(extAutomationJourneys)
        .set(updates)
        .where(
          and(
            eq(extAutomationJourneys.id, id),
            eq(extAutomationJourneys.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updatedJourney;
    }),
});
