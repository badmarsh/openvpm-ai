import { z } from "zod";
import { eq, and, isNull, asc, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { treatmentPlans, treatmentPlanItems } from "@openpims/db";
import { summarizePlanProgress, type PlanItemStatus } from "@/lib/treatment-plans/progress";

const clinicalRole = requireRole("admin", "veterinarian", "technician");
const itemStatuses = ["pending", "in_progress", "done", "skipped"] as const;

export const treatmentPlansRouter = createRouter({
  /** Plans for a patient, each with its items and a progress summary. */
  listByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db
        .select()
        .from(treatmentPlans)
        .where(
          and(
            eq(treatmentPlans.patientId, input.patientId),
            eq(treatmentPlans.practiceId, ctx.practiceId),
            isNull(treatmentPlans.deletedAt)
          )
        )
        .orderBy(desc(treatmentPlans.createdAt));

      if (plans.length === 0) return [];

      const items = await ctx.db
        .select()
        .from(treatmentPlanItems)
        .where(
          and(
            inArray(
              treatmentPlanItems.planId,
              plans.map((p) => p.id)
            ),
            isNull(treatmentPlanItems.deletedAt)
          )
        )
        .orderBy(asc(treatmentPlanItems.sortOrder));

      return plans.map((plan) => {
        const planItems = items.filter((i) => i.planId === plan.id);
        return {
          ...plan,
          items: planItems,
          progress: summarizePlanProgress(
            planItems.map((i) => ({ status: i.status as PlanItemStatus }))
          ),
        };
      });
    }),

  create: protectedProcedure
    .use(clinicalRole)
    .input(
      z.object({
        patientId: z.string().uuid(),
        problemId: z.string().uuid().optional(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        startDate: z.string().optional(),
        items: z
          .array(
            z.object({
              description: z.string().min(1).max(500),
              instructions: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .insert(treatmentPlans)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          problemId: input.problemId ?? null,
          title: input.title,
          description: input.description ?? null,
          startDate: input.startDate ?? null,
          createdBy: ctx.user.id,
        })
        .returning();

      if (input.items.length > 0) {
        await ctx.db.insert(treatmentPlanItems).values(
          input.items.map((item, i) => ({
            planId: plan!.id,
            description: item.description,
            instructions: item.instructions ?? null,
            sortOrder: i,
          }))
        );
      }

      return plan!;
    }),

  updateStatus: protectedProcedure
    .use(clinicalRole)
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["active", "completed", "discontinued"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(treatmentPlans)
        .set({ status: input.status })
        .where(
          and(
            eq(treatmentPlans.id, input.id),
            eq(treatmentPlans.practiceId, ctx.practiceId),
            isNull(treatmentPlans.deletedAt)
          )
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      return updated;
    }),

  updateItemStatus: protectedProcedure
    .use(clinicalRole)
    .input(
      z.object({
        itemId: z.string().uuid(),
        status: z.enum(itemStatuses),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the item's plan belongs to this practice before mutating.
      const [row] = await ctx.db
        .select({ planId: treatmentPlanItems.planId })
        .from(treatmentPlanItems)
        .innerJoin(treatmentPlans, eq(treatmentPlanItems.planId, treatmentPlans.id))
        .where(
          and(
            eq(treatmentPlanItems.id, input.itemId),
            eq(treatmentPlans.practiceId, ctx.practiceId),
            isNull(treatmentPlanItems.deletedAt)
          )
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });

      const [updated] = await ctx.db
        .update(treatmentPlanItems)
        .set({ status: input.status })
        .where(eq(treatmentPlanItems.id, input.itemId))
        .returning();
      return updated!;
    }),
});
