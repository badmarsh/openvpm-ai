import { eq, isNull, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import { practices, users, clients, patients } from "@openpims/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getPlan, type PlanTier } from "@/lib/billing/plans";

/**
 * Platform-operator only. Crosses tenant boundaries deliberately, so it is
 * gated by the PLATFORM_ADMIN_EMAILS allowlist (not the practice "admin" role).
 */
const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isPlatformAdmin(ctx.session?.user?.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access only." });
  }
  return next();
});

export const adminRouter = createRouter({
  /** Am I a platform admin? (drives whether the /admin nav shows.) */
  isPlatformAdmin: protectedProcedure.query(({ ctx }) => {
    return isPlatformAdmin(ctx.session?.user?.email);
  }),

  /** Cross-tenant operations overview: practices, plans, status, usage, MRR. */
  overview: platformAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: practices.id,
        name: practices.name,
        tier: practices.subscriptionTier,
        billingStatus: practices.billingStatus,
        trialEndsAt: practices.trialEndsAt,
        country: practices.country,
        createdAt: practices.createdAt,
      })
      .from(practices)
      .where(isNull(practices.deletedAt))
      .orderBy(desc(practices.createdAt));

    const countBy = async (
      table: typeof users | typeof clients | typeof patients
    ) => {
      const res = await ctx.db
        .select({
          practiceId: table.practiceId,
          c: sql<number>`count(*)::int`,
        })
        .from(table)
        .where(isNull(table.deletedAt))
        .groupBy(table.practiceId);
      return new Map(res.map((r) => [r.practiceId, Number(r.c)]));
    };

    const [userCounts, clientCounts, patientCounts] = await Promise.all([
      countBy(users),
      countBy(clients),
      countBy(patients),
    ]);

    const practiceRows = rows.map((p) => ({
      ...p,
      userCount: userCounts.get(p.id) ?? 0,
      clientCount: clientCounts.get(p.id) ?? 0,
      patientCount: patientCounts.get(p.id) ?? 0,
    }));

    // MRR: sum list price of practices on a paid, active subscription.
    const estimatedMrr = practiceRows
      .filter((p) => p.billingStatus === "active")
      .reduce((sum, p) => sum + (getPlan(p.tier).priceMonthlyUsd ?? 0), 0);

    const byTier: Record<PlanTier, number> = {
      free: 0,
      starter: 0,
      pro: 0,
      enterprise: 0,
    };
    for (const p of practiceRows) {
      const t = getPlan(p.tier).tier;
      byTier[t] += 1;
    }

    return {
      practices: practiceRows,
      totals: {
        practices: practiceRows.length,
        estimatedMrr,
        byTier,
        trialing: practiceRows.filter((p) => p.billingStatus === "trialing").length,
        active: practiceRows.filter((p) => p.billingStatus === "active").length,
        pastDue: practiceRows.filter((p) => p.billingStatus === "past_due").length,
      },
    };
  }),
});
