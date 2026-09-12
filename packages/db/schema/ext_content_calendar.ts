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
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { extMarketingContentItems, extMarketingMediaAssets } from "./ext_marketing";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Content pillar categories for organizing the content calendar.
 *
 * These align with the marketing strategy pillars defined in the brief.
 */
export const extContentPillarTypeEnum = pgEnum("ext_content_pillar_type", [
  "educational",
  "promotional",
  "community",
  "seasonal",
  "clinical_update",
  "patient_story",
  "staff_spotlight",
  "product_launch",
]);

/**
 * Content brief status workflow.
 *
 * draft → in_review → approved → published | blocked | archived
 */
export const extContentBriefStatusEnum = pgEnum("ext_content_brief_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "blocked",
  "archived",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

export type ContentBriefClinicalGate = {
  /** Whether this brief contains clinical claims requiring vet approval. */
  hasClinicalClaims: boolean;
  /** Specific clinical claims made (for approval audit). */
  clinicalClaims?: string[];
  /** Whether medical terminology is used. */
  hasMedicalTerminology: boolean;
  /** Whether before/after images are included. */
  hasBeforeAfterImages: boolean;
  /** Drug/product names mentioned (for compliance check). */
  drugNames?: string[];
  /** Procedure names mentioned. */
  procedureNames?: string[];
  /** Whether the content makes guarantees about outcomes. */
  makesOutcomeGuarantees: boolean;
};

export type ContentBriefCompliance = {
  /** GDPR considerations (e.g. client/patient identifiable content). */
  gdprReviewRequired: boolean;
  /** Consent IDs for any identifiable patients/clients. */
  consentIds?: string[];
  /** Whether AI was used to generate draft content. */
  aiGenerated: boolean;
  /** AI model used for generation. */
  aiModel?: string;
  /** AI prompt hash for audit. */
  aiPromptHash?: string;
  /** AI output hash for audit. */
  aiOutputHash?: string;
  /** Human reviewer who approved AI content. */
  aiReviewerId?: string;
};

// ---------------------------------------------------------------------------
// 2I. ext_content_pillars — content pillar definitions
// ---------------------------------------------------------------------------

/**
 * Content pillars organize the marketing calendar into strategic themes.
 *
 * Each practice can define their own pillars (e.g. "Preventive Care",
 * "Success Stories", "Seasonal Tips") to guide content creation.
 */
export const extContentPillars = pgTable(
  "ext_content_pillars",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Human-readable pillar name, e.g. "Preventive Care Education". */
    name: text("name").notNull(),
    description: text("description"),
    /** Pillar type category. */
    pillarType: extContentPillarTypeEnum("pillar_type").notNull(),
    /**
     * Target frequency: how often content from this pillar should be published.
     * E.g. "2x per week", "1x per month" — stored as JSON for flexibility.
     */
    targetFrequency: jsonb("target_frequency"),
    /** Priority within the content calendar (lower = higher priority). */
    priority: integer("priority").notNull().default(100),
    /** Whether this pillar is currently active. */
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => ({
    practiceTypeIdx: index("ext_content_pillars_practice_type_idx").on(
      t.practiceId,
      t.pillarType,
    ),
    /** Unique pillar name per practice. */
    practiceNameUq: uniqueIndex("ext_content_pillars_practice_name_uq").on(
      t.practiceId,
      t.name,
    ),
    appendOnlyCheck: check(
      "ext_content_pillars_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2J. ext_content_briefs — content briefs with clinical gate
// ---------------------------------------------------------------------------

/**
 * Content briefs define what content should be created, with clinical
 * and compliance gating before publication.
 *
 * This table implements the "clinical gate" from GUARDRAILS-COMPLIANCE.md:
 * any content making clinical claims MUST be reviewed and approved by a
 * veterinarian before publication.
 */
export const extContentBriefs = pgTable(
  "ext_content_briefs",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    pillarId: uuid("pillar_id").references(() => extContentPillars.id),
    /** Human-readable brief title. */
    title: text("title").notNull(),
    /** Detailed brief description and requirements. */
    brief: text("brief").notNull(),
    /** Target channel(s) for this content. */
    targetChannels: text("target_channels").array(),
    /**
     * Content status workflow: draft → in_review → approved → published | blocked | archived
     */
    status: extContentBriefStatusEnum("status")
      .notNull()
      .default("draft"),
    /**
     * Clinical gate: JSON object documenting clinical claims and compliance.
     * MUST be reviewed when hasClinicalClaims=true before approval.
     */
    clinicalGate: jsonb("clinical_gate").$type<ContentBriefClinicalGate>(),
    /** Compliance audit fields (GDPR, AI usage, consent). */
    compliance: jsonb("compliance").$type<ContentBriefCompliance>(),
    /** Media assets linked to this brief. */
    mediaAssetIds: uuid("media_asset_ids").array(),
    /** When the brief was approved for publication. */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Veterinarian who approved clinical content. */
    approvedBy: uuid("approved_by").references(() => users.id),
    /** When the content was actually published. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Why the brief was blocked (if applicable). */
    blockedReason: text("blocked_reason"),
    /** AI-generated draft content (for reviewer reference). */
    aiDraft: text("ai_draft"),
    /** Final approved content (may differ from AI draft). */
    finalContent: text("final_content"),
  },
  (t) => ({
    practiceStatusIdx: index("ext_content_briefs_practice_status_idx").on(
      t.practiceId,
      t.status,
    ),
    pillarIdx: index("ext_content_briefs_pillar_idx").on(
      t.practiceId,
      t.pillarId,
    ),
    /** Index for finding briefs requiring clinical review. */
    clinicalReviewIdx: index("ext_content_briefs_clinical_review_idx").on(
      t.practiceId,
      t.status,
    ),
    appendOnlyCheck: check(
      "ext_content_briefs_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
    /**
     * CHECK: if clinicalGate.hasClinicalClaims = true, then
     * approvedBy and approvedAt must be NOT NULL when status = 'approved' | 'published'.
     * This is enforced at application level; DB check would be complex.
     */
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extContentPillarsRelations = relations(
  extContentPillars,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extContentPillars.practiceId],
      references: [practices.id],
    }),
    briefs: many(extContentBriefs),
  }),
);

export const extContentBriefsRelations = relations(
  extContentBriefs,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extContentBriefs.practiceId],
      references: [practices.id],
    }),
    pillar: one(extContentPillars, {
      fields: [extContentBriefs.pillarId],
      references: [extContentPillars.id],
    }),
    approver: one(users, {
      fields: [extContentBriefs.approvedBy],
      references: [users.id],
    }),
  }),
);
