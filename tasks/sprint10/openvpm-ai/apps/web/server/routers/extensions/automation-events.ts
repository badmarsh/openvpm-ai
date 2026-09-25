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
  practices,
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
  /**
   * Autopilot reminder sweep: scans vaccination records whose *latest* record
   * per patient is past (or nearing) its next due date and emits durable
   * `vaccine_due` events into ext_automation_events for the rules/journey
   * engines. Emission is idempotent — each vaccination record emits at most
   * once via a deterministic dedupeKey.
   *
   * SKILL.md §3 Unconditional Sympathy Gate: deceased patients never receive
   * an event. Instead, every blocked emission is audited in the unified
   * suppression log with reason `deceased_patient`.
   */
  runVaccineSweep: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z
        .object({
          /** 0 = strictly overdue; N>0 also includes vaccines due within N days. */
          lookaheadDays: z.number().int().min(0).max(90).default(0),
          limit: z.number().int().min(1).max(1000).default(500),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const lookaheadDays = input?.lookaheadDays ?? 0;
      const limit = input?.limit ?? 500;

      const result = await ctx.db.execute(sql`
        select
          lv.id as "vaccinationRecordId",
          lv.patient_id as "patientId",
          lv.vaccine_name as "vaccineName",
          lv.next_due_date as "nextDueDate",
          p.status as "patientStatus",
          p.name as "patientName",
          p.client_id as "clientId"
        from (
          select distinct on (vr.patient_id)
            vr.id, vr.patient_id, vr.vaccine_name, vr.next_due_date
          from vaccination_records vr
          where vr.practice_id = ${ctx.practiceId}
            and vr.deleted_at is null
            and vr.next_due_date is not null
          order by vr.patient_id, vr.administered_at desc, vr.created_at desc
        ) lv
        join patients p
          on p.id = lv.patient_id
         and p.practice_id = ${ctx.practiceId}
         and p.deleted_at is null
        where lv.next_due_date <= (current_date + make_interval(days => ${lookaheadDays}))
        order by lv.next_due_date asc
        limit ${limit}
      `);

      const rows = (
        (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? []
      ) as {
        vaccinationRecordId: string;
        patientId: string;
        vaccineName: string;
        nextDueDate: string;
        patientStatus: string;
        patientName: string;
        clientId: string;
      }[];

      let emitted = 0;
      let alreadyQueued = 0;
      let suppressedDeceased = 0;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      for (const row of rows) {
        // ── Sympathy Gate (SKILL.md §3) ──────────────────────────────────
        if (row.patientStatus === "deceased") {
          try {
            await ctx.db
              .insert(extAutomationSuppressionLog)
              .values({
                practiceId: ctx.practiceId,
                clientId: row.clientId,
                patientId: row.patientId,
                suppressionReason: "deceased_patient",
                blockedAction: "sweep:vaccine_due",
                dedupeKey: `${row.clientId}:deceased_patient:vaccine_due_sweep:${row.patientId}:${today}`,
                detail: `Sympathy Gate: vaccine_due event suppressed for deceased patient (${row.patientName ?? "pacient"}). No automated outreach will be sent.`,
              })
              .onConflictDoNothing();
          } catch (err) {
            console.error("[automation] vaccine sweep suppression log failed", err);
          }
          suppressedDeceased++;
          continue;
        }

        try {
          const inserted = await ctx.db
            .insert(extAutomationEvents)
            .values({
              practiceId: ctx.practiceId,
              eventType: "vaccine_due",
              clientId: row.clientId,
              patientId: row.patientId,
              sourceRouter: "automationEvents.runVaccineSweep",
              dedupeKey: `vaccine_due_sweep_${row.vaccinationRecordId}`,
              emittedBy: ctx.user.id,
              status: "pending",
              availableAt: now,
              payload: {
                vaccinationRecordId: row.vaccinationRecordId,
                vaccineName: row.vaccineName,
                nextDueDate: row.nextDueDate,
                lookaheadDays,
                clientId: row.clientId,
                patientId: row.patientId,
              },
            })
            .onConflictDoNothing()
            .returning({ id: extAutomationEvents.id });
          if (inserted.length > 0) {
            emitted++;
          } else {
            alreadyQueued++;
          }
        } catch (err) {
          console.error("[automation] vaccine_due sweep emission failed", err);
        }
      }

      return {
        scanned: rows.length,
        emitted,
        alreadyQueued,
        suppressedDeceased,
        lookaheadDays,
      };
    }),
});
