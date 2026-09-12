import { z } from "zod";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extAiAuditLog,
  practices,
  users,
} from "@openpims/db";

const vetProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician")
);

export const auditExportRouter = createRouter({
  /**
   * Získanie histórie auditných záznamov pre konkrétnu entitu (záznam, recept, snímok)
   */
  getEntityHistory: vetProcedure
    .input(
      z.object({
        entityType: z.enum([
          "soap_note",
          "discharge_report",
          "imaging_analysis",
          "treatment_plan",
          "prescription",
        ]),
        entityId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: extAiAuditLog.id,
          sequenceNumber: extAiAuditLog.sequenceNumber,
          actorId: extAiAuditLog.actorId,
          actorName: extAiAuditLog.actorName,
          actorRole: extAiAuditLog.actorRole,
          actionType: extAiAuditLog.actionType,
          entityType: extAiAuditLog.entityType,
          entityId: extAiAuditLog.entityId,
          wasEditedByClinician: extAiAuditLog.wasEditedByClinician,
          confirmedAt: extAiAuditLog.confirmedAt,
          eventHash: extAiAuditLog.eventHash,
          previousEventHash: extAiAuditLog.previousEventHash,
          ipAddress: extAiAuditLog.ipAddress,
        })
        .from(extAiAuditLog)
        .where(
          and(
            eq(extAiAuditLog.practiceId, ctx.practiceId),
            eq(extAiAuditLog.entityType, input.entityType),
            eq(extAiAuditLog.entityId, input.entityId),
            isNull(extAiAuditLog.deletedAt)
          )
        )
        .orderBy(asc(extAiAuditLog.confirmedAt));

      return rows;
    }),

  /**
   * Vygenerovanie certifikovaného inšpekčného protokolu pre ŠVPS SR / KVL SR
   */
  generateInspectionReport: vetProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const [practice] = await ctx.db
        .select()
        .from(practices)
        .where(eq(practices.id, ctx.practiceId));

      const logs = await ctx.db
        .select()
        .from(extAiAuditLog)
        .where(
          and(
            eq(extAiAuditLog.practiceId, ctx.practiceId),
            isNull(extAiAuditLog.deletedAt)
          )
        )
        .orderBy(desc(extAiAuditLog.confirmedAt))
        .limit(input.limit);

      const generatedAt = new Date().toISOString();
      let isChainIntact = true;

      // Overenie kontinuity reťazca
      for (let i = 0; i < logs.length - 1; i++) {
        if (
          logs[i].previousEventHash &&
          logs[i + 1].eventHash &&
          logs[i].previousEventHash !== logs[i + 1].eventHash
        ) {
          isChainIntact = false;
          break;
        }
      }

      return {
        practiceName: practice?.name || "Veterinárna ambulancia",
        generatedAt,
        totalEvents: logs.length,
        isChainIntact,
        events: logs.map((log) => ({
          seq: log.sequenceNumber,
          date: log.confirmedAt,
          actor: `${log.actorName} (${log.actorRole || "vet"})`,
          type: log.entityType,
          action: log.actionType || "confirmed",
          edited: log.wasEditedByClinician ? "Áno" : "Nie (Prijatý draft)",
          hash: log.eventHash ? log.eventHash.substring(0, 16) + "..." : "—",
        })),
      };
    }),
});
