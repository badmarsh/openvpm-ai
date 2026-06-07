/**
 * Hosted plan model + entitlements.
 *
 * Open-source posture: the OSS / self-host edition is NEVER crippled. Billing is
 * OFF by default (`HOSTED_BILLING_ENABLED` unset) — self-host gets the full
 * product. We monetize hosting + scale (locations) + heavy usage, not by locking
 * the open core.
 *
 * Pricing (managed Cloud): ONE simple self-serve tier — $99/mo per location,
 * ALL features included (feature parity with self-host), with metered overage
 * for SMS / AI usage beyond generous monthly allowances. Enterprise = custom.
 */

export type PlanTier = "free" | "cloud" | "enterprise";

/**
 * Legacy tier strings (from the earlier starter/pro model) map onto `cloud`, so
 * existing practice rows and any old Stripe prices keep resolving cleanly.
 */
const LEGACY_CLOUD_TIERS = new Set(["starter", "pro"]);

/** Capabilities. With feature parity these are unlocked on every paid tier. */
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

/** Env vars holding Stripe Price IDs for metered overage (hosted only, PRIVATE). */
export const STRIPE_PRICE_SMS_OVERAGE_ENV = "STRIPE_PRICE_SMS_OVERAGE";
export const STRIPE_PRICE_AI_OVERAGE_ENV = "STRIPE_PRICE_AI_OVERAGE";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  /** Monthly price in USD (per location for `cloud`). null = custom / contact sales. */
  priceMonthlyUsd: number | null;
  /** Whether the monthly price is charged per location (Stripe subscription quantity). */
  pricePerLocation: boolean;
  blurb: string;
  /** Max staff seats. null = unlimited. */
  seatLimit: number | null;
  /** Max locations. null = unlimited (billed by quantity). */
  locationLimit: number | null;
  /** Premium features included in this tier. */
  features: Feature[];
  /** Included monthly SMS before metered overage. null = unlimited/custom. */
  includedSmsPerMonth: number | null;
  /** Included monthly AI agent runs before metered overage. null = unlimited/custom. */
  includedAiRunsPerMonth: number | null;
  /** Env var holding the Stripe Price ID for this tier (hosted only). */
  stripePriceEnv?: string;
  /** Whether this tier is self-serve purchasable (vs. contact sales). */
  selfServe: boolean;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    // Self-host (free, full product) gets everything via billingEnforced()=false,
    // NOT via this feature list. On hosted, `free` is also the lapsed/unpaid
    // fallback tier — so its entitlements MUST be empty to gate non-payers.
    tier: "free",
    name: "Free (self-host)",
    priceMonthlyUsd: 0,
    pricePerLocation: false,
    blurb: "The full product, on your own infrastructure. Free forever, no lock-in.",
    seatLimit: null,
    locationLimit: null,
    features: [],
    includedSmsPerMonth: 0,
    includedAiRunsPerMonth: 0,
    selfServe: true,
  },
  cloud: {
    tier: "cloud",
    name: "Cloud",
    priceMonthlyUsd: 99,
    pricePerLocation: true,
    blurb:
      "We host it: the full PIMS, managed, with every feature — agent, SMS, reporting, API, multi-location, integrations. $99/mo per location.",
    seatLimit: null, // unlimited staff included
    locationLimit: null, // billed by quantity, not capped
    features: [...ALL_FEATURES],
    includedSmsPerMonth: 500,
    includedAiRunsPerMonth: 200,
    stripePriceEnv: "STRIPE_PRICE_CLOUD",
    selfServe: true,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    priceMonthlyUsd: null,
    pricePerLocation: false,
    blurb:
      "Dedicated or in-region instance, SSO, BAA/DPA compliance, white-glove migration, and priority support.",
    seatLimit: null,
    locationLimit: null,
    features: [...ALL_FEATURES],
    includedSmsPerMonth: null,
    includedAiRunsPerMonth: null,
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanTier[] = ["free", "cloud", "enterprise"];

export function getPlan(tier?: string | null): PlanDefinition {
  const t = tier ?? "free";
  if (LEGACY_CLOUD_TIERS.has(t)) return PLANS.cloud;
  return PLANS[t as PlanTier] ?? PLANS.free;
}

/** Map a Stripe Price ID back to a plan tier (via the configured env vars). */
export function tierForStripePrice(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  for (const t of PLAN_ORDER) {
    const env = PLANS[t].stripePriceEnv;
    if (env && process.env[env] === priceId) return t;
  }
  return null;
}

/** Normalize a Stripe subscription status to our billingStatus values. */
export function normalizeBillingStatus(status: string | null | undefined): string {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return status ?? "none";
  }
}

/** Pure: does this tier include this feature? (With parity, every paid tier does.) */
export function planHasFeature(tier: string | null | undefined, feature: Feature): boolean {
  return getPlan(tier).features.includes(feature);
}

/** Length of the new-practice free trial on the hosted service. */
export const TRIAL_DAYS = 14;

/** Whether a practice is in an unexpired trial window. */
export function isTrialActive(
  billingStatus: string | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (billingStatus !== "trialing" || !trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > now.getTime();
}

/**
 * The tier whose entitlements actually apply right now. An active trial grants
 * full Cloud access; once it lapses we fall back to the stored tier.
 */
export function effectiveTier(
  tier: string | null | undefined,
  billingStatus: string | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): PlanTier {
  if (isTrialActive(billingStatus, trialEndsAt, now)) return "cloud";
  const t = tier ?? "free";
  if (LEGACY_CLOUD_TIERS.has(t)) return "cloud";
  return (PLANS[t as PlanTier] ? (t as PlanTier) : "free");
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
