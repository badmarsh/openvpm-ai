import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { extMarketingContentItems } from "./ext_marketing";
import { extAutomationEvents } from "./ext_automation";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const extContentBriefStatusEnum = pgEnum("ext_content_brief_status", [
  "pending",
  "generating",
  "review",
  "approved",
  "rejected",
  "archived",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

/**
 * Any clinical assertion inside a generated brief that a veterinarian must
 * approve before the content may be published.
 *
 * SKILL.md §3: medical/clinical decisions must never be auto-committed without
 * human confirmation. A brief with a non-empty clinical_claims array therefore
 * cannot reach status 'approved' without reviewed_by set — enforced by the
 * `clinicalApprovalCheck` constraint below.
 */
export type ContentClinicalClaim = {
  /** The exact sentence or phrase as it appears in the brief. */
  claim: string;
  kind: "dosage" | "diagnosis" | "prognosis" | "lab_interpretation" | "prevention_efficacy" | "other";
  /** Where it came from, e.g. "visit_closeouts.discharge_instructions". */
  sourceRef?: string;
  verdict?: "approved" | "rejected" | "edited";
  reviewerNote?: string;
};

export type ContentBriefSource = {
  eventType?: string;
  eventId?: string;
  /** Deliberately de-identified: never store client/patient identifiers here. */
  patientSpecies?: string;
  visitType?: string;
  seasonHint?: string;
};

// ---------------------------------------------------------------------------
// 2I. ext_content_pillars — content calendar pillar library
// ---------------------------------------------------------------------------

export const extContentPillars = pgTable(
  "ext_content_pillars",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** e.g. "vaccination", "dental", "parasite_seasonal". */
    pillarKey: text("pillar_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** patients.species values this pillar speaks to. Empty = all species. */
    species: text("species").array().notNull().default([]),
    /** Calendar months 1-12. Empty = year-round. */
    seasonMonths: integer("season_months").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Tone/subject-matter guidance injected into the generation prompt. */
    voiceGuidance: text("voice_guidance").notNull().default(""),
  },
  (table) => ({
    practiceKeyUq: uniqueIndex("ext_content_pillars_practice_key_uq")
      .on(table.practiceId, table.pillarKey)
      .where(sql`${table.deletedAt} is null`),
    practiceIdx: index("ext_content_pillars_practice_idx").on(
      table.practiceId,
      table.deletedAt,
      table.isActive,
      table.sortOrder,
    ),
    pillarKeyFormatCheck: check(
      "ext_content_pillars_key_format_check",
      sql`${table.pillarKey} ~ '^[a-z][a-z0-9_]{1,62}$'`,
    ),
    sortOrderCheck: check(
      "ext_content_pillars_sort_check",
      sql`${table.sortOrder} >= 0`,
    ),
    /**
     * Season months must all fall in 1..12.
     *
     * Postgres forbids subqueries inside CHECK constraints, which rules out the
     * obvious `NOT EXISTS (SELECT 1 FROM unnest(...))`. Array containment (`<@`)
     * against a literal 1..12 array works instead.
     *
     * VERIFIED against PostgreSQL 18.4 via drizzle-kit push. The first attempt
     * used `int4range(1, 13, '[]')::int[]` and FAILED with SQLSTATE 42846
     * "cannot cast type int4range to integer[]" — that cast does not exist.
     * Do not reintroduce it.
     *
     * The router must still validate with zod:
     * `z.array(z.number().int().min(1).max(12))`.
     */
    seasonMonthsRangeCheck: check(
      "ext_content_pillars_season_months_check",
      sql`${table.seasonMonths} <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2J. ext_content_briefs — AI-generated content brief queue
// ---------------------------------------------------------------------------

export const extContentBriefs = pgTable(
  "ext_content_briefs",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    pillarId: uuid("pillar_id").references(() => extContentPillars.id),
    triggerEventId: uuid("trigger_event_id").references(
      () => extAutomationEvents.id,
    ),
    /** The instruction handed to the content model. */
    briefText: text("brief_text").notNull(),
    /**
     * Target surfaces. Deliberately text[] rather than ext_marketing_channel:
     * a brief fans out to several channels, and the enum currently lacks
     * youtube / newsletter / tv (see §A enum extension note).
     */
    targetChannels: text("target_channels").array().notNull().default([]),
    targetAudience: text("target_audience").notNull().default(""),
    clinicalClaims: jsonb("clinical_claims")
      .$type<ContentClinicalClaim[]>()
      .notNull()
      .default([]),
    brandVoiceOverride: text("brand_voice_override"),
    status: extContentBriefStatusEnum("status").notNull().default("pending"),
    /** Model name, mirroring ext_marketing_competitor_snapshots.model. */
    generatedBy: text("generated_by"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    /** 0..1 self-reported or validator-assigned confidence. */
    confidence: integer("confidence"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    /** Set once the brief has been turned into a publishable content item. */
    contentItemId: uuid("content_item_id").references(
      () => extMarketingContentItems.id,
    ),
    source: jsonb("source").$type<ContentBriefSource>().notNull().default({}),
  },
  (table) => ({
    reviewerTenantFk: foreignKey({
      columns: [table.practiceId, table.reviewedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_content_briefs_reviewer_tenant_fk",
    }),
    /** The approval queue: "what is waiting for a human". */
    practiceStatusIdx: index("ext_content_briefs_status_idx").on(
      table.practiceId,
      table.status,
      table.createdAt,
    ),
    practicePillarIdx: index("ext_content_briefs_pillar_idx").on(
      table.practiceId,
      table.pillarId,
      table.status,
    ),
    practiceDeletedIdx: index("ext_content_briefs_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    /** One generated content item per brief. */
    contentItemUq: uniqueIndex("ext_content_briefs_content_item_uq")
      .on(table.practiceId, table.contentItemId)
      .where(sql`${table.contentItemId} is not null`),
    /**
     * SKILL.md §3 human-in-the-loop gate, enforced at the database level:
     * a brief carrying clinical claims cannot be 'approved' without a named
     * human reviewer and a review timestamp.
     */
    clinicalApprovalCheck: check(
      "ext_content_briefs_clinical_approval_check",
      sql`(${table.status} <> 'approved')
        or (jsonb_array_length(${table.clinicalClaims}) = 0)
        or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`,
    ),
    reviewStateCheck: check(
      "ext_content_briefs_review_state_check",
      sql`(${table.status} in ('pending', 'generating', 'review'))
        or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`,
    ),
    confidenceRangeCheck: check(
      "ext_content_briefs_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 100`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extContentPillarsRelations = relations(extContentPillars, ({ one, many }) => ({
  practice: one(practices, {
    fields: [extContentPillars.practiceId],
    references: [practices.id],
  }),
  briefs: many(extContentBriefs),
}));

export const extContentBriefsRelations = relations(extContentBriefs, ({ one }) => ({
  practice: one(practices, {
    fields: [extContentBriefs.practiceId],
    references: [practices.id],
  }),
  pillar: one(extContentPillars, {
    fields: [extContentBriefs.pillarId],
    references: [extContentPillars.id],
  }),
  triggerEvent: one(extAutomationEvents, {
    fields: [extContentBriefs.triggerEventId],
    references: [extAutomationEvents.id],
  }),
  reviewer: one(users, {
    fields: [extContentBriefs.reviewedBy],
    references: [users.id],
  }),
  contentItem: one(extMarketingContentItems, {
    fields: [extContentBriefs.contentItemId],
    references: [extMarketingContentItems.id],
  }),
}));