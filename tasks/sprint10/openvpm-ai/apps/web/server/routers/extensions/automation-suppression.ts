import { z } from "zod";
import { and, desc, eq, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extAutomationSuppressionLog,
  extAutomationSuppressionReasonEnum,
  clients,
  patients,
} from "@openpims/db";

export const automationSuppressionRouter = createRouter({
  getMetrics: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          reason: extAutomationSuppressionLog.suppressionReason,
          count: count(),
        })
        .from(extAutomationSuppressionLog)
        .where(eq(extAutomationSuppressionLog.practiceId, ctx.practiceId))
        .groupBy(extAutomationSuppressionLog.suppressionReason);

      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        counts[r.reason] = Number(r.count);
        total += Number(r.count);
      }

      return {
        total,
        sympathyBlocks: counts["deceased_patient"] ?? 0,
        quietHours: counts["quiet_hours"] ?? 0,
        rateLimits: counts["frequency_cap"] ?? 0,
        noConsent: (counts["no_consent"] ?? 0) + (counts["opt_out"] ?? 0),
        recoveryHold: counts["recovery_hold"] ?? 0,
        byReason: counts,
      };
    }),

  listLogs: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        reason: z
          .enum([
            "all",
            "deceased_patient",
            "opt_out",
            "no_consent",
            "frequency_cap",
            "quiet_hours",
            "recovery_hold",
            "manual_block",
            "cooldown",
            "sensitivity_period",
            "unknown_contact",
          ])
          .default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(extAutomationSuppressionLog.practiceId, ctx.practiceId),
      ];

      if (input.reason !== "all") {
        conditions.push(
          eq(
            extAutomationSuppressionLog.suppressionReason,
            input.reason as any
          )
        );
      }

      const rows = await ctx.db
        .select({
          id: extAutomationSuppressionLog.id,
          suppressionReason: extAutomationSuppressionLog.suppressionReason,
          blockedAction: extAutomationSuppressionLog.blockedAction,
          channelAttempted: extAutomationSuppressionLog.channelAttempted,
          blockedAt: extAutomationSuppressionLog.blockedAt,
          clearedAt: extAutomationSuppressionLog.clearedAt,
          detail: extAutomationSuppressionLog.detail,
          clientId: extAutomationSuppressionLog.clientId,
          patientId: extAutomationSuppressionLog.patientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientPhone: clients.phone,
          clientEmail: clients.email,
          patientName: patients.name,
          patientSpecies: patients.species,
        })
        .from(extAutomationSuppressionLog)
        .leftJoin(
          clients,
          and(
            eq(extAutomationSuppressionLog.clientId, clients.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        )
        .leftJoin(
          patients,
          and(
            eq(extAutomationSuppressionLog.patientId, patients.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .where(and(...conditions))
        .orderBy(desc(extAutomationSuppressionLog.blockedAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),
});
