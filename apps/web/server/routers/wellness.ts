import { z } from "zod";
import { eq, and, isNull, lte, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { wellnessPlans, wellnessEnrollments, clients, patients } from "@openpims/db";
import { computeNextBillingDate } from "@/lib/wellness/billing";

const manageRole = requireRole("admin", "front_desk");
const today = () => new Date().toISOString().slice(0, 10);

export const wellnessRouter = createRouter({
  listPlans: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(wellnessPlans)
      .where(
        and(eq(wellnessPlans.practiceId, ctx.practiceId), isNull(wellnessPlans.deletedAt))
      )
      .orderBy(desc(wellnessPlans.createdAt));
  }),

  createPlan: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        price: z.number().nonnegative(),
        billingInterval: z.enum(["monthly", "annual"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .insert(wellnessPlans)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          description: input.description ?? null,
          price: input.price.toFixed(2),
          billingInterval: input.billingInterval,
        })
        .returning();
      return plan!;
    }),

  enroll: protectedProcedure
    .use(manageRole)
    .input(
      z.object({
        planId: z.string().uuid(),
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        startDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .select({ id: wellnessPlans.id })
        .from(wellnessPlans)
        .where(
          and(
            eq(wellnessPlans.id, input.planId),
            eq(wellnessPlans.practiceId, ctx.practiceId),
            isNull(wellnessPlans.deletedAt)
          )
        )
        .limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const startDate = input.startDate ?? today();
      const [enrollment] = await ctx.db
        .insert(wellnessEnrollments)
        .values({
          practiceId: ctx.practiceId,
          planId: input.planId,
          clientId: input.clientId,
          patientId: input.patientId ?? null,
          startDate,
          // First charge is due at enrollment; staff bill it and advance.
          nextBillingDate: startDate,
        })
        .returning();
      return enrollment!;
    }),

  /** Active enrollments due for billing on or before `asOf` (default today). */
  listDue: protectedProcedure
    .use(manageRole)
    .input(z.object({ asOf: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const asOf = input?.asOf ?? today();
      return ctx.db
        .select({
          enrollmentId: wellnessEnrollments.id,
          nextBillingDate: wellnessEnrollments.nextBillingDate,
          planName: wellnessPlans.name,
          price: wellnessPlans.price,
          billingInterval: wellnessPlans.billingInterval,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          patientName: patients.name,
        })
        .from(wellnessEnrollments)
        .innerJoin(wellnessPlans, eq(wellnessEnrollments.planId, wellnessPlans.id))
        .innerJoin(clients, eq(wellnessEnrollments.clientId, clients.id))
        .leftJoin(patients, eq(wellnessEnrollments.patientId, patients.id))
        .where(
          and(
            eq(wellnessEnrollments.practiceId, ctx.practiceId),
            eq(wellnessEnrollments.status, "active"),
            isNull(wellnessEnrollments.deletedAt),
            lte(wellnessEnrollments.nextBillingDate, asOf)
          )
        )
        .orderBy(wellnessEnrollments.nextBillingDate);
    }),

  /**
   * Mark an enrollment billed: advance its nextBillingDate by one interval.
   * Actual charge capture (invoice/Stripe) is deferred until a payment
   * processor is wired.
   */
  markBilled: protectedProcedure
    .use(manageRole)
    .input(z.object({ enrollmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: wellnessEnrollments.id,
          nextBillingDate: wellnessEnrollments.nextBillingDate,
          interval: wellnessPlans.billingInterval,
        })
        .from(wellnessEnrollments)
        .innerJoin(wellnessPlans, eq(wellnessEnrollments.planId, wellnessPlans.id))
        .where(
          and(
            eq(wellnessEnrollments.id, input.enrollmentId),
            eq(wellnessEnrollments.practiceId, ctx.practiceId),
            isNull(wellnessEnrollments.deletedAt)
          )
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });

      const next = computeNextBillingDate(row.nextBillingDate, row.interval);
      const [updated] = await ctx.db
        .update(wellnessEnrollments)
        .set({ nextBillingDate: next })
        .where(eq(wellnessEnrollments.id, input.enrollmentId))
        .returning();
      return updated!;
    }),

  cancel: protectedProcedure
    .use(manageRole)
    .input(z.object({ enrollmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(wellnessEnrollments)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(
          and(
            eq(wellnessEnrollments.id, input.enrollmentId),
            eq(wellnessEnrollments.practiceId, ctx.practiceId),
            isNull(wellnessEnrollments.deletedAt)
          )
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
      return updated;
    }),
});
