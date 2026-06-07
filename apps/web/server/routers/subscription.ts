import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { practices, locations } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
} from "@/lib/stripe";
import {
  PLANS,
  PLAN_ORDER,
  billingEnforced,
} from "@/lib/billing/plans";
import { usageForPractice, currentPeriodMonth } from "@/lib/billing/usage";

/** Count active locations for a practice (the billed quantity for Cloud). */
async function countLocations(db: Database, practiceId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(locations)
    .where(and(eq(locations.practiceId, practiceId), isNull(locations.deletedAt)));
  return Math.max(1, Number(row?.c ?? 1));
}

const adminProcedure = protectedProcedure.use(requireRole("admin"));

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

/** Whether a tier can be bought self-serve (Stripe price configured). */
function purchasable(tier: keyof typeof PLANS): boolean {
  const env = PLANS[tier].stripePriceEnv;
  return !!(env && process.env[env]);
}

export const subscriptionRouter = createRouter({
  /** Current plan + status, plus the catalog for display. */
  get: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({
        tier: practices.subscriptionTier,
        billingStatus: practices.billingStatus,
        trialEndsAt: practices.trialEndsAt,
        stripeCustomerId: practices.stripeCustomerId,
      })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);

    const enforced = billingEnforced();
    const locationCount = await countLocations(ctx.db, ctx.practiceId);
    const period = currentPeriodMonth();
    const [smsUsed, aiUsed] = enforced
      ? await Promise.all([
          usageForPractice(ctx.practiceId, "sms", period),
          usageForPractice(ctx.practiceId, "ai_run", period),
        ])
      : [0, 0];

    return {
      tier: practice?.tier ?? "free",
      billingStatus: practice?.billingStatus ?? "none",
      trialEndsAt: practice?.trialEndsAt ?? null,
      hasBillingAccount: !!practice?.stripeCustomerId,
      billingEnforced: enforced,
      locationCount,
      usage: { period, sms: smsUsed, aiRuns: aiUsed },
      plans: PLAN_ORDER.map((t) => {
        const p = PLANS[t];
        return {
          tier: p.tier,
          name: p.name,
          priceMonthlyUsd: p.priceMonthlyUsd,
          pricePerLocation: p.pricePerLocation,
          blurb: p.blurb,
          features: p.features,
          seatLimit: p.seatLimit,
          locationLimit: p.locationLimit,
          includedSmsPerMonth: p.includedSmsPerMonth,
          includedAiRunsPerMonth: p.includedAiRunsPerMonth,
          selfServe: p.selfServe,
          purchasable: purchasable(t),
        };
      }),
    };
  }),

  /** Start a Stripe Checkout for the self-serve Cloud plan. */
  createCheckout: adminProcedure
    .input(z.object({ tier: z.enum(["cloud"]).default("cloud") }))
    .mutation(async ({ ctx, input }) => {
      const plan = PLANS[input.tier];
      const priceId = plan.stripePriceEnv
        ? process.env[plan.stripePriceEnv]
        : undefined;
      if (!priceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This plan isn't available for checkout yet.",
        });
      }

      const [practice] = await ctx.db
        .select({
          stripeCustomerId: practices.stripeCustomerId,
          email: practices.email,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      // Cloud is billed per location → Stripe subscription quantity.
      const quantity = plan.pricePerLocation
        ? await countLocations(ctx.db, ctx.practiceId)
        : 1;

      const base = appBaseUrl();
      const result = await createSubscriptionCheckoutSession({
        priceId,
        practiceId: ctx.practiceId,
        customerId: practice?.stripeCustomerId ?? undefined,
        customerEmail: practice?.email ?? ctx.session.user.email,
        quantity,
        successUrl: `${base}/settings?tab=billing&checkout=success`,
        cancelUrl: `${base}/settings?tab=billing&checkout=cancelled`,
      });
      if (!result) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Billing is not configured on this server.",
        });
      }
      return { url: result.url };
    }),

  /** Open the Stripe Billing Portal to manage/cancel an existing subscription. */
  openBillingPortal: adminProcedure.mutation(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ stripeCustomerId: practices.stripeCustomerId })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);

    if (!practice?.stripeCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No billing account yet — start a plan first.",
      });
    }

    const result = await createBillingPortalSession({
      customerId: practice.stripeCustomerId,
      returnUrl: `${appBaseUrl()}/settings?tab=billing`,
    });
    if (!result) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Billing is not configured on this server.",
      });
    }
    return { url: result.url };
  }),
});
