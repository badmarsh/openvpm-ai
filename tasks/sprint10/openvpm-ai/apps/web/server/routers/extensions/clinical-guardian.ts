import { z } from "zod";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import {
  extClinicalGuardianAlerts,
  patients,
  users,
} from "@openpims/db";
import {
  checkEncounterMedications,
  syncStatutoryAlertsToDb,
  auditStatutoryDeadlines,
} from "@/lib/ai/clinical-guardian";

const clinicalProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician"),
);

export const clinicalGuardianRouter = createRouter({
  /**
   * Zoznam otvorených a nedávnych upozornení klinického strážcu pre prax
   */
  listAlerts: clinicalProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "resolved", "dismissed", "all"]).default("open"),
          category: z.enum(["medication_safety", "statutory_deadline", "vet_intelligence", "all"]).default("all"),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const statusFilter = input?.status ?? "open";
      const categoryFilter = input?.category ?? "all";
      const limit = input?.limit ?? 50;

      const conditions = [
        eq(extClinicalGuardianAlerts.practiceId, ctx.practiceId),
        isNull(extClinicalGuardianAlerts.deletedAt),
      ];

      if (statusFilter !== "all") {
        conditions.push(eq(extClinicalGuardianAlerts.status, statusFilter));
      }

      if (categoryFilter !== "all") {
        conditions.push(eq(extClinicalGuardianAlerts.category, categoryFilter));
      }

      const rows = await ctx.db
        .select({
          id: extClinicalGuardianAlerts.id,
          practiceId: extClinicalGuardianAlerts.practiceId,
          patientId: extClinicalGuardianAlerts.patientId,
          encounterId: extClinicalGuardianAlerts.encounterId,
          category: extClinicalGuardianAlerts.category,
          severity: extClinicalGuardianAlerts.severity,
          title: extClinicalGuardianAlerts.title,
          message: extClinicalGuardianAlerts.message,
          suggestedAction: extClinicalGuardianAlerts.suggestedAction,
          status: extClinicalGuardianAlerts.status,
          resolvedAt: extClinicalGuardianAlerts.resolvedAt,
          createdAt: extClinicalGuardianAlerts.createdAt,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientBreed: patients.breed,
        })
        .from(extClinicalGuardianAlerts)
        .leftJoin(
          patients,
          and(
            eq(patients.id, extClinicalGuardianAlerts.patientId),
            isNull(patients.deletedAt),
          ),
        )
        .where(and(...conditions))
        .orderBy(
          // Sort by severity (critical first) then createdAt desc
          sql`CASE 
            WHEN ${extClinicalGuardianAlerts.severity} = 'critical' THEN 1 
            WHEN ${extClinicalGuardianAlerts.severity} = 'warning' THEN 2 
            ELSE 3 
          END ASC`,
          desc(extClinicalGuardianAlerts.createdAt),
        )
        .limit(limit);

      return rows;
    }),

  /**
   * Real-time kontrola liekových kontraindikácií a rizík (používaná pri ukladaní SOAPu/vyšetrenia)
   */
  checkMedications: clinicalProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        encounterId: z.string().uuid().optional(),
        medications: z.array(
          z.object({
            name: z.string().min(1),
            dose: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return checkEncounterMedications(
        ctx.db,
        ctx.practiceId,
        input.patientId,
        input.medications,
        input.encounterId,
      );
    }),

  /**
   * Zaznamenanie zistených alertov do DB (napr. keď lekár zvolí 'Viem o tom, pokračovať' alebo systém deteguje kritické riziko)
   */
  recordAlerts: clinicalProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        encounterId: z.string().uuid().optional(),
        alerts: z.array(
          z.object({
            category: z.enum(["medication_safety", "statutory_deadline", "vet_intelligence"]),
            severity: z.enum(["critical", "warning", "info"]),
            title: z.string(),
            message: z.string(),
            suggestedAction: z.string().optional(),
            acknowledged: z.boolean().default(false),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const recordsToInsert = input.alerts.map((a) => ({
        practiceId: ctx.practiceId,
        patientId: input.patientId ?? null,
        encounterId: input.encounterId ?? null,
        category: a.category,
        severity: a.severity,
        title: a.title,
        message: a.message,
        suggestedAction: a.suggestedAction ?? null,
        status: a.acknowledged ? "dismissed" : "open",
        resolvedBy: a.acknowledged ? ctx.user.id : null,
        resolvedAt: a.acknowledged ? new Date() : null,
      }));

      if (recordsToInsert.length > 0) {
        await ctx.db.insert(extClinicalGuardianAlerts).values(recordsToInsert);
      }

      return { success: true, count: recordsToInsert.length };
    }),

  /**
   * Označenie alertu za vyriešený
   */
  resolveAlert: clinicalProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extClinicalGuardianAlerts)
        .set({
          status: "resolved",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(extClinicalGuardianAlerts.id, input.id),
            eq(extClinicalGuardianAlerts.practiceId, ctx.practiceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert not found",
        });
      }

      return updated;
    }),

  /**
   * Odmietnutie / vzatie na vedomie alertu
   */
  dismissAlert: clinicalProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(extClinicalGuardianAlerts)
        .set({
          status: "dismissed",
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(extClinicalGuardianAlerts.id, input.id),
            eq(extClinicalGuardianAlerts.practiceId, ctx.practiceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Alert not found",
        });
      }

      return updated;
    }),

  /**
   * Okamžité spustenie auditu zákonných lehôt (besnota, ochranné lehoty, CRSZ čipy)
   */
  runAuditNow: clinicalProcedure.mutation(async ({ ctx }) => {
    const result = await syncStatutoryAlertsToDb(ctx.db, ctx.practiceId);
    return {
      success: true,
      count: result.count,
    };
  }),

  /**
   * Rýchly súhrn pre hlavný dashboard widget (počty otvorených kritických a zákonných alertov)
   */
  getSummary: clinicalProcedure.query(async ({ ctx }) => {
    const alerts = await ctx.db
      .select({
        id: extClinicalGuardianAlerts.id,
        category: extClinicalGuardianAlerts.category,
        severity: extClinicalGuardianAlerts.severity,
        title: extClinicalGuardianAlerts.title,
        message: extClinicalGuardianAlerts.message,
        suggestedAction: extClinicalGuardianAlerts.suggestedAction,
        createdAt: extClinicalGuardianAlerts.createdAt,
        patientId: extClinicalGuardianAlerts.patientId,
        patientName: patients.name,
      })
      .from(extClinicalGuardianAlerts)
      .leftJoin(
        patients,
        and(
          eq(patients.id, extClinicalGuardianAlerts.patientId),
          isNull(patients.deletedAt),
        ),
      )
      .where(
        and(
          eq(extClinicalGuardianAlerts.practiceId, ctx.practiceId),
          eq(extClinicalGuardianAlerts.status, "open"),
          isNull(extClinicalGuardianAlerts.deletedAt),
        ),
      )
      .orderBy(
        sql`CASE 
          WHEN ${extClinicalGuardianAlerts.severity} = 'critical' THEN 1 
          WHEN ${extClinicalGuardianAlerts.severity} = 'warning' THEN 2 
          ELSE 3 
        END ASC`,
        desc(extClinicalGuardianAlerts.createdAt),
      )
      .limit(10);

    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const statutoryCount = alerts.filter((a) => a.category === "statutory_deadline").length;
    const totalOpen = alerts.length;

    return {
      alerts,
      criticalCount,
      statutoryCount,
      totalOpen,
    };
  }),
});
