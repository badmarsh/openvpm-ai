/**
 * Hosted plan tiers + feature entitlements.
 *
 * IMPORTANT — open-source posture: the OSS / self-host edition is NEVER
 * crippled. Feature gating only applies to our managed hosted service, and is
 * OFF by default (`HOSTED_BILLING_ENABLED` unset). When billing is not
 * enforced, every feature is entitled — self-host gets the full product. We
 * monetize hosting, support, and usage, not by locking the open core.
 */

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

/** Premium capabilities that the hosted tiers gate. */
export type Feature =
  | "agent" // OpenVPM Agent (AI)
  | "sms" // SMS sending
  | "advancedReporting"
  | "apiAccess" // public /api/v1 + webhooks
  | "multiLocation"
  | "integrations";

export const ALL_FEATURES: Feature[] = [
  "agent",
  "sms",
  "advancedReporting",
  "apiAccess",
  "multiLocation",
  "integrations",
];

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  /** Monthly price in USD. null = custom / contact sales. */
  priceMonthlyUsd: number | null;
  blurb: string;
  /** Max staff seats. null = unlimited. */
  seatLimit: number | null;
  /** Max locations. null = unlimited. */
  locationLimit: number | null;
  /** Premium features included in this tier. */
  features: Feature[];
  /** Env var holding the Stripe Price ID for this tier (hosted only). */
  stripePriceEnv?: string;
  /** Whether this tier is self-serve purchasable (vs. contact sales). */
  selfServe: boolean;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    blurb: "Core PIMS for trying it out. Self-host is free forever.",
    seatLimit: 2,
    locationLimit: 1,
    features: [],
    selfServe: true,
  },
  starter: {
    tier: "starter",
    name: "Starter",
    priceMonthlyUsd: 29,
    blurb:
      "Managed hosting, the full PIMS, email reminders, client portal, and data export.",
    seatLimit: 5,
    locationLimit: 1,
    features: [],
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    selfServe: true,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceMonthlyUsd: 99,
    blurb:
      "Adds the OpenVPM Agent, SMS, advanced reporting, API access + webhooks, multi-location, and integrations.",
    seatLimit: 25,
    locationLimit: null,
    features: [...ALL_FEATURES],
    stripePriceEnv: "STRIPE_PRICE_PRO",
    selfServe: true,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    priceMonthlyUsd: null,
    blurb:
      "Single-tenant or in-region dedicated instance, SSO, DPA/compliance, and priority support.",
    seatLimit: null,
    locationLimit: null,
    features: [...ALL_FEATURES],
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanTier[] = ["free", "starter", "pro", "enterprise"];

export function getPlan(tier?: string | null): PlanDefinition {
  const t = (tier ?? "free") as PlanTier;
  return PLANS[t] ?? PLANS.free;
}

/** Pure: does this tier include this premium feature? */
export function planHasFeature(tier: string | null | undefined, feature: Feature): boolean {
  return getPlan(tier).features.includes(feature);
}

/**
 * Whether hosted billing is enforced (i.e. we're the managed service). Off by
 * default so self-host / OSS runs with everything unlocked.
 */
export function billingEnforced(): boolean {
  return process.env.HOSTED_BILLING_ENABLED === "true";
}

/**
 * Effective entitlement check. When billing is not enforced (self-host), every
 * feature is entitled. `enforced` is injectable for testing.
 */
export function isEntitled(
  tier: string | null | undefined,
  feature: Feature,
  enforced: boolean = billingEnforced()
): boolean {
  if (!enforced) return true;
  return planHasFeature(tier, feature);
}

/** Seat-limit check. Unlimited (null) or self-host (not enforced) always passes. */
export function withinSeatLimit(
  tier: string | null | undefined,
  currentSeats: number,
  enforced: boolean = billingEnforced()
): boolean {
  if (!enforced) return true;
  const limit = getPlan(tier).seatLimit;
  return limit === null || currentSeats < limit;
}

/** Location-limit check. Unlimited (null) or self-host (not enforced) always passes. */
export function withinLocationLimit(
  tier: string | null | undefined,
  currentLocations: number,
  enforced: boolean = billingEnforced()
): boolean {
  if (!enforced) return true;
  const limit = getPlan(tier).locationLimit;
  return limit === null || currentLocations < limit;
}
