/**
 * tRPC router for automation enrollments.
 *
 * Provides enrollment management: list, enroll, pause, resume, cancel.
 */

import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../../trpc";
import { extAutomationEnrollments, extAutomationJourneys } from "@openpims/db";
import { enrollInJourney, pauseJourney, resumeJourney, cancelJourney } from "@/lib/autopilot/journey-engine";

export const automationEnrollmentsRouter = createRouter({
  /**
   * List enrollments for current practice.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(50),
        status: z.enum(["active", "completed", "exited", "paused", "failed"]).optional(),
        clientId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereClauses = [
        eq(extAutomationEnrollments.practiceId, ctx.practiceId),
      ];

      if (input.status) {
        whereClauses.push(eq(extAutomationEnrollments.status, input.status as any));
      }

      if (input.clientId) {
        whereClauses.push(eq(extAutomationEnrollments.clientId, input.clientId));
      }

      const enrollments = await ctx.db
        .select()
        .from(extAutomationEnrollments)
        .where(and(...whereClauses))
        .orderBy(desc(extAutomationEnrollments.createdAt))
        .limit(input.limit);

      return enrollments;
    }),

  /**
   * Enroll a client in a journey.
   */
  enroll: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        journeyKey: z.string(),
        patientId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enrollInJourney(
        ctx.db,
        input.clientId,
        input.journeyKey,
        ctx.practiceId,
        input.patientId
      );

      return { success: true };
    }),

  /**
   * Pause an active enrollment.
   */
  pause: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await pauseJourney(ctx.db, input.enrollmentId, ctx.practiceId);
      return { success: true };
    }),

  /**
   * Resume a paused enrollment.
   */
  resume: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await resumeJourney(ctx.db, input.enrollmentId, ctx.practiceId);
      return { success: true };
    }),

  /**
   * Cancel an enrollment permanently.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await cancelJourney(ctx.db, input.enrollmentId, ctx.practiceId, input.reason);
      return { success: true };
    }),
});
