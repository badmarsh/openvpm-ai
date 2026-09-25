import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../../trpc";
import { dentalCharts, patients } from "@openpims/db";
import { isValidToothCode, normalizeToothCode } from "@/lib/records/dental";

const staffProcedure = protectedProcedure.use(
  requireRole("admin", "veterinarian", "technician")
);

export const dentalRouter = createRouter({
  /** Zoznam zubných záznamov pacienta */
  list: staffProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.dentalCharts.findMany({
        where: and(
          eq(dentalCharts.practiceId, ctx.practiceId),
          eq(dentalCharts.patientId, input.patientId),
          isNull(dentalCharts.deletedAt)
        ),
        orderBy: [desc(dentalCharts.chartedAt), desc(dentalCharts.createdAt)],
        limit: input.limit,
        with: { veterinarian: true },
      });
      return items;
    }),

  /** Pridá zubný záznam */
  create: staffProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        toothCode: z.string().min(1, "Kód zuba je povinný").max(16),
        chartedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        condition: z
          .enum([
            "HEALTHY",
            "MISSING",
            "FRACTURED",
            "DECAYED",
            "MOBILE",
            "ABRADED",
            "CROWNED",
            "OTHER",
          ])
          .default("HEALTHY"),
        treatment: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.query.patients.findFirst({
        where: and(
          eq(patients.id, input.patientId),
          eq(patients.practiceId, ctx.practiceId)
        ),
      });
      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const toothCode = normalizeToothCode(input.toothCode);
      if (!isValidToothCode(toothCode)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid tooth code (FDI notation)",
        });
      }

      const [entry] = await ctx.db
        .insert(dentalCharts)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          appointmentId: input.appointmentId ?? null,
          veterinarianId: ctx.user.id,
          toothCode,
          chartedAt: input.chartedAt,
          condition: input.condition,
          treatment: input.treatment ?? null,
          notes: input.notes ?? null,
        })
        .returning();

      return entry;
    }),

  /** Aktualizuje zubný záznam */
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        condition: z
          .enum([
            "HEALTHY",
            "MISSING",
            "FRACTURED",
            "DECAYED",
            "MOBILE",
            "ABRADED",
            "CROWNED",
            "OTHER",
          ])
          .optional(),
        treatment: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.dentalCharts.findFirst({
        where: and(
          eq(dentalCharts.id, input.id),
          eq(dentalCharts.practiceId, ctx.practiceId),
          isNull(dentalCharts.deletedAt)
        ),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dental entry not found" });
      }

      const [entry] = await ctx.db
        .update(dentalCharts)
        .set({
          condition: input.condition ?? existing.condition,
          treatment: input.treatment ?? existing.treatment,
          notes: input.notes ?? existing.notes,
        })
        .where(and(eq(dentalCharts.id, input.id), eq(dentalCharts.practiceId, ctx.practiceId)))
        .returning();

      return entry;
    }),

  /** Odstráni zubný záznam (soft delete) */
  remove: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.dentalCharts.findFirst({
        where: and(
          eq(dentalCharts.id, input.id),
          eq(dentalCharts.practiceId, ctx.practiceId),
          isNull(dentalCharts.deletedAt)
        ),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dental entry not found" });
      }

      await ctx.db
        .update(dentalCharts)
        .set({ deletedAt: new Date() })
        .where(and(eq(dentalCharts.id, input.id), eq(dentalCharts.practiceId, ctx.practiceId)));

      return { success: true };
    }),
});
