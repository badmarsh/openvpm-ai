/**
 * tRPC router for automation events.
 *
 * Provides CRUD and query operations for ext_automation_events.
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extAutomationEvents } from "@openpims/db";

export const automationEventsRouter = createRouter({
  /**
   * List events for current practice.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(50),
        status: z.enum(["pending", "processing", "processed", "failed", "skipped"]).optional(),
        eventType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereClauses = [
        eq(extAutomationEvents.practiceId, ctx.practiceId),
      ];

      if (input.status) {
        whereClauses.push(eq(extAutomationEvents.status, input.status as any));
      }

      if (input.eventType) {
        whereClauses.push(eq(extAutomationEvents.eventType, input.eventType as any));
      }

      const events = await ctx.db
        .select()
        .from(extAutomationEvents)
        .where(and(...whereClauses))
        .orderBy(desc(extAutomationEvents.createdAt))
        .limit(input.limit);

      return events;
    }),

  /**
   * Get single event by ID.
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .select()
        .from(extAutomationEvents)
        .where(
          and(
            eq(extAutomationEvents.id, input.id),
            eq(extAutomationEvents.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!event) {
        throw new Error("Event not found");
      }

      return event;
    }),

  /**
   * Cancel a pending event.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .select({ status: extAutomationEvents.status })
        .from(extAutomationEvents)
        .where(
          and(
            eq(extAutomationEvents.id, input.id),
            eq(extAutomationEvents.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!event) {
        throw new Error("Event not found");
      }

      if (event.status !== "pending") {
        throw new Error(`Cannot cancel event with status ${event.status}`);
      }

      await ctx.db
        .update(extAutomationEvents)
        .set({
          status: "skipped",
          processedReason: `Manually cancelled: ${input.reason}`,
        })
        .where(eq(extAutomationEvents.id, input.id));

      return { success: true };
    }),
});
