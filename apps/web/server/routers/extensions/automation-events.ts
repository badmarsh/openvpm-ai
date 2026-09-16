/**
 * tRPC router for automation events.
 *
 * Provides CRUD and query operations for ext_automation_events.
 */

import { z } from "zod";
import { eq, and, desc, sql, count, lt, isNull } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extAutomationEvents,
  extAutomationSuppressionLog,
  patients,
} from "@openpims/db";
import { pollAndProcess } from "@/lib/autopilot/event-worker";
import { evaluateRules } from "@/lib/autopilot/rules-engine";

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

  /**
   * Queue metrics: counts of pending, processing, processed, failed, skipped, and stuck claims.
   */
  getQueueMetrics: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const statusCounts = await ctx.db
      .select({
        status: extAutomationEvents.status,
        count: count(),
      })
      .from(extAutomationEvents)
      .where(
        and(
          eq(extAutomationEvents.practiceId, ctx.practiceId),
          isNull(extAutomationEvents.deletedAt)
        )
      )
      .groupBy(extAutomationEvents.status);

    const stuckClaims = await ctx.db
      .select({
        count: count(),
      })
      .from(extAutomationEvents)
      .where(
        and(
          eq(extAutomationEvents.practiceId, ctx.practiceId),
          eq(extAutomationEvents.status, "processing"),
          lt(extAutomationEvents.lockedAt, fiveMinutesAgo),
          isNull(extAutomationEvents.deletedAt)
        )
      );

    const map: Record<string, number> = {};
    for (const row of statusCounts) {
      map[row.status] = Number(row.count);
    }

    const pending = map["pending"] ?? 0;
    const processing = map["processing"] ?? 0;
    const processed = map["processed"] ?? 0;
    const failed = map["failed"] ?? 0;
    const skipped = map["skipped"] ?? 0;
    const stuck = Number(stuckClaims[0]?.count ?? 0);
    const total = pending + processing + processed + failed + skipped;

    return {
      pending,
      processing,
      processed,
      failed,
      skipped,
      stuck,
      total,
    };
  }),

  /**
   * Run background queue processing immediately.
   * Gated for role: admin, veterinarian.
   */
  processQueueNow: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .mutation(async ({ ctx }) => {
      try {
        const processedCount = await pollAndProcess(ctx.db);
        return { success: true, processedCount };
      } catch (err: any) {
        console.error("[processQueueNow] Queue processing error:", err);
        throw new Error(err.message || "Chyba pri spracovaní fronty");
      }
    }),

  /**
   * Simulate a domain event with immediate evaluation and sympathy gate compliance.
   * Gated for role: admin, veterinarian.
   */
  simulateEvent: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        eventType: z.enum([
          "appointment_no_show",
          "vaccine_due",
          "post_operative_care",
          "wellness_enrolled",
          "visit_completed",
          "appointment_booked",
          "surgery_completed",
          "patient_deceased",
        ]),
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        payload: z.record(z.unknown()).default({}),
        processImmediately: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let resolvedClientId = input.clientId;
      let isPatientDeceased = false;
      let patientName = "Pacient";

      if (input.patientId) {
        const [p] = await ctx.db
          .select({
            id: patients.id,
            clientId: patients.clientId,
            status: patients.status,
            name: patients.name,
          })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId)
            )
          )
          .limit(1);

        if (p) {
          resolvedClientId = resolvedClientId ?? p.clientId;
          patientName = p.name;
          if (p.status === "deceased" || input.eventType === "patient_deceased") {
            isPatientDeceased = true;
          }
        }
      }

      // Unconditional Sympathy Gate: Deceased patient blocks automated outreach
      if (isPatientDeceased && resolvedClientId) {
        // Insert suppressed audit log
        await ctx.db.insert(extAutomationSuppressionLog).values({
          practiceId: ctx.practiceId,
          clientId: resolvedClientId,
          patientId: input.patientId ?? null,
          suppressionReason: "deceased_patient",
          blockedAction: `simulation:${input.eventType}`,
          detail: `Sympathy Gate: Pacient ${patientName} je evidovaný ako zosnulý. Automatické správy zablokované.`,
          dedupeKey: `sim_sympathy_${Date.now()}_${input.patientId}`,
        });

        // Record event as skipped
        const [event] = await ctx.db
          .insert(extAutomationEvents)
          .values({
            practiceId: ctx.practiceId,
            eventType: input.eventType as any,
            patientId: input.patientId ?? null,
            clientId: resolvedClientId ?? null,
            payload: input.payload,
            sourceRouter: "simulation",
            dedupeKey: `sim_${Date.now()}_${crypto.randomUUID()}`,
            emittedBy: ctx.user.id,
            status: "skipped",
            processedReason: `Sympathy Gate: Pacient ${patientName} je zosnulý. Zablokované (GDPR/KVL).`,
          })
          .returning();

        return {
          eventId: event.id,
          eventType: event.eventType,
          status: "skipped",
          suppressed: true,
          suppressionReason: "deceased_patient",
          matchedRulesCount: 0,
          matchedRules: [],
          processedCount: 0,
          message: `Sympathy Gate aktívna: Udalosť bola potlačená kvôli úmrtiu pacienta.`,
        };
      }

      // Normal active simulation event
      const [event] = await ctx.db
        .insert(extAutomationEvents)
        .values({
          practiceId: ctx.practiceId,
          eventType: input.eventType as any,
          patientId: input.patientId ?? null,
          clientId: resolvedClientId ?? null,
          payload: input.payload,
          sourceRouter: "simulation",
          dedupeKey: `sim_${Date.now()}_${crypto.randomUUID()}`,
          emittedBy: ctx.user.id,
          status: "pending",
        })
        .returning();

      // Evaluate rules against this event
      const ruleMatches = await evaluateRules(ctx.db, event);

      let processedCount = 0;
      if (input.processImmediately) {
        processedCount = await pollAndProcess(ctx.db);
      }

      return {
        eventId: event.id,
        eventType: event.eventType,
        status: input.processImmediately ? "processed" : "pending",
        suppressed: false,
        matchedRulesCount: ruleMatches.length,
        matchedRules: ruleMatches.map((m) => ({
          id: m.rule.id,
          name: m.rule.name,
          actionType: m.rule.actionType,
          score: m.score,
        })),
        processedCount,
        message: `Udalosť úspešne nasimulovaná. Nájdených ${ruleMatches.length} pravidiel.`,
      };
    }),
});
