import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { practices } from "@openpims/db";
import {
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
} from "@/lib/stripe";
import {
  PLANS,
  PLAN_ORDER,
  billingEnforced,
} from "@/lib/billing/plans";

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

    return {
      tier: practice?.tier ?? "free",
      billingStatus: practice?.billingStatus ?? "none",
      trialEndsAt: practice?.trialEndsAt ?? null,
      hasBillingAccount: !!practice?.stripeCustomerId,
      billingEnforced: billingEnforced(),
      plans: PLAN_ORDER.map((t) => {
        const p = PLANS[t];
        return {
          tier: p.tier,
          name: p.name,
          priceMonthlyUsd: p.priceMonthlyUsd,
          blurb: p.blurb,
          features: p.features,
          seatLimit: p.seatLimit,
          locationLimit: p.locationLimit,
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

      const base = appBaseUrl();
      const result = await createSubscriptionCheckoutSession({
        priceId,
        practiceId: ctx.practiceId,
        customerId: practice?.stripeCustomerId ?? undefined,
        customerEmail: practice?.email ?? ctx.session.user.email,
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
