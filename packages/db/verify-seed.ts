/**
 * Seed completeness verification.
 *
 * Run after the documented seed flow:
 *   pnpm db:seed
 *   pnpm db:seed:marketing   # demo legacy content + canonical automation layer
 *
 * Asserts the database actually contains the demo dataset every feature page
 * expects (automation journeys/rules, the 12 canonical CRM segments, content
 * pillars/briefs, channel accounts, marketing content). Exits non-zero on any
 * gap so CI and local setup catch a half-applied seed immediately.
 *
 * Run with: pnpm db:seed:verify
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import { db } from "./client";
import { and, eq, isNull } from "drizzle-orm";
import {
  practices,
  users,
  extAutomationJourneys,
  extAutomationRules,
  extChannelAccounts,
  extContentBriefs,
  extContentPillars,
  extCrmSegments,
  extMarketingHandouts,
  extMarketingReviews,
  extMarketingTvSlides,
} from "./schema/index";

/** Must stay identical to CRM_SEGMENT_DEFINITIONS keys (drift-guard test enforces the seed side). */
const CANONICAL_SEGMENT_KEYS = [
  "puppy_kitten",
  "senior_pet",
  "chronic_patient",
  "vip_clients",
  "churn_risk",
  "unvaccinated_overdue",
  "wellness_enrolled",
  "dental_attention",
  "post_op_recovery",
  "frequent_flyer",
  "weight_management",
  "lapsed_inactive",
] as const;

const CANONICAL_JOURNEY_KEYS = [
  "welcome_new_client",
  "post_visit_followup",
  "vaccine_reminder_journey",
  "post_operative_care",
  "patient_reactivation",
] as const;

type Failure = { check: string; detail: string };
const failures: Failure[] = [];

function expect(check: string, ok: boolean, detail: string) {
  if (ok) {
    console.log(`  ✓ ${check} — ${detail}`);
  } else {
    failures.push({ check, detail });
    console.error(`  ✗ ${check} — ${detail}`);
  }
}

async function main() {
  console.log("Verifying seeded demo dataset...\n");

  const practiceRows = await db
    .select({ id: practices.id })
    .from(practices)
    .where(isNull(practices.deletedAt));
  expect("practices", practiceRows.length >= 1, `${practiceRows.length} live practice(s)`);

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.deletedAt));
  expect("users", userRows.length >= 1, `${userRows.length} live user(s)`);

  const journeys = await db
    .select({ journeyKey: extAutomationJourneys.journeyKey })
    .from(extAutomationJourneys)
    .where(isNull(extAutomationJourneys.deletedAt));
  const journeyKeys = new Set(journeys.map((j) => j.journeyKey));
  const missingJourneys = CANONICAL_JOURNEY_KEYS.filter((k) => !journeyKeys.has(k));
  expect(
    "automation journeys",
    missingJourneys.length === 0,
    missingJourneys.length === 0
      ? `${journeys.length} journey(s), all 5 canonical keys present`
      : `missing: ${missingJourneys.join(", ")} (have ${journeys.length})`
  );

  const rules = await db
    .select({ id: extAutomationRules.id })
    .from(extAutomationRules)
    .where(
      and(
        isNull(extAutomationRules.deletedAt),
        eq(extAutomationRules.isActive, true)
      )
    );
  expect("automation rules", rules.length >= 1, `${rules.length} active rule(s)`);

  const segments = await db
    .select({ segmentKey: extCrmSegments.segmentKey })
    .from(extCrmSegments)
    .where(isNull(extCrmSegments.deletedAt));
  const segmentKeys = segments.map((s) => s.segmentKey);
  const missingSegments = CANONICAL_SEGMENT_KEYS.filter(
    (k) => !segmentKeys.includes(k as string)
  );
  const unknownSystemSegments = segmentKeys.filter(
    (k) => !(CANONICAL_SEGMENT_KEYS as readonly string[]).includes(k)
  );
  expect(
    "CRM segments",
    missingSegments.length === 0 && unknownSystemSegments.length === 0,
    missingSegments.length === 0 && unknownSystemSegments.length === 0
      ? `${segments.length} live segment(s), canonical set complete`
      : `missing: [${missingSegments.join(", ")}] unknown: [${unknownSystemSegments.join(", ")}]`
  );

  const pillars = await db
    .select({ id: extContentPillars.id })
    .from(extContentPillars)
    .where(isNull(extContentPillars.deletedAt));
  expect("content pillars", pillars.length >= 5, `${pillars.length} pillar(s)`);

  const briefs = await db
    .select({ id: extContentBriefs.id })
    .from(extContentBriefs)
    .where(isNull(extContentBriefs.deletedAt));
  expect("content briefs", briefs.length >= 1, `${briefs.length} brief(s)`);

  const channels = await db
    .select({ id: extChannelAccounts.id })
    .from(extChannelAccounts)
    .where(isNull(extChannelAccounts.deletedAt));
  expect("channel accounts", channels.length >= 1, `${channels.length} account(s)`);

  const reviews = await db
    .select({ id: extMarketingReviews.id })
    .from(extMarketingReviews)
    .where(isNull(extMarketingReviews.deletedAt));
  expect("reviews", reviews.length >= 1, `${reviews.length} review(s)`);

  const slides = await db
    .select({ id: extMarketingTvSlides.id })
    .from(extMarketingTvSlides)
    .where(isNull(extMarketingTvSlides.deletedAt));
  expect("TV slides", slides.length >= 1, `${slides.length} slide(s)`);

  const handouts = await db
    .select({ id: extMarketingHandouts.id })
    .from(extMarketingHandouts)
    .where(isNull(extMarketingHandouts.deletedAt));
  expect("handouts", handouts.length >= 1, `${handouts.length} handout(s)`);

  console.log("");
  if (failures.length > 0) {
    console.error(
      `Seed verification FAILED (${failures.length} gap(s)). Re-run the documented seed flow:\n` +
        `  pnpm db:seed && pnpm db:seed:marketing\n`
    );
    process.exit(1);
  }
  console.log("✓ Seed verification passed — demo dataset is complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed verification crashed:", err);
    process.exit(1);
  });
