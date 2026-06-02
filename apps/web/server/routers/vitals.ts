import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { vitalSigns } from "@openpims/db";

const recordRole = requireRole("admin", "veterinarian", "technician");

export const vitalsRouter = createRouter({
  /** Vital-sign history for a patient, newest first. */
  listByPatient: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(vitalSigns)
        .where(
          and(
            eq(vitalSigns.patientId, input.patientId),
            eq(vitalSigns.practiceId, ctx.practiceId),
            isNull(vitalSigns.deletedAt)
          )
        )
        .orderBy(desc(vitalSigns.recordedAt))
        .limit(input.limit);
    }),

  record: protectedProcedure
    .use(recordRole)
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        // Numerics travel as strings into Drizzle numeric columns.
        temperatureC: z.number().min(20).max(45).optional(),
        heartRateBpm: z.number().int().min(0).max(400).optional(),
        respiratoryRateBpm: z.number().int().min(0).max(300).optional(),
        weightKg: z.number().positive().max(200).optional(),
        bodyConditionScore: z.number().int().min(1).max(9).optional(),
        painScore: z.number().int().min(0).max(10).optional(),
        mucousMembrane: z.string().max(64).optional(),
        capillaryRefillSec: z.number().min(0).max(10).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { temperatureC, weightKg, capillaryRefillSec, ...rest } = input;
      const [row] = await ctx.db
        .insert(vitalSigns)
        .values({
          ...rest,
          practiceId: ctx.practiceId,
          recordedBy: ctx.user.id,
          temperatureC: temperatureC?.toString(),
          weightKg: weightKg?.toString(),
          capillaryRefillSec: capillaryRefillSec?.toString(),
        })
        .returning();
      return row!;
    }),
});
