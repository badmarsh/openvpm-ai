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
import { clients } from "./clients";
import { users } from "./users";
import { extAutomationEvents } from "./ext_automation";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * How a segment's membership is recomputed.
 *
 * `event_driven`  — membership changes when a matching event is processed.
 * `scheduled`     — a nightly/weekly sweep re-evaluates conditionJson.
 * `manual`        — staff add/remove clients by hand.
 */
export const extCrmRefreshStrategyEnum = pgEnum("ext_crm_refresh_strategy", [
  "event_driven",
  "scheduled",
  "manual",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

/**
 * The ONLY machine-evaluated segment definition. Compiled by a whitelisted
 * query builder into a parameterised, practice-scoped WHERE fragment.
 *
 * Never execute this SQL directly — it's for human readability only.
 * The engine uses conditionJson for evaluation.
 */
export type CrmSegmentCondition = {
  /** patients.species values, e.g. ["canine", "feline"]. */
  species?: string[];
  /** Patients with no visit in the last N days. */
  inactiveDays?: number;
  /** Patients with a visit in the last N days. */
  activeWithinDays?: number;
  /** Appointment types that qualify, e.g. ["surgery", "dental"]. */
  visitTypes?: string[];
  /** Days since the last visit of one of those types. */
  visitTypeWithinDays?: number;
  /** Require at least one patient with this status. */
  patientStatus?: "active" | "inactive";
  /** Minimum age in years of any active patient. */
  minAgeYears?: number;
  maxAgeYears?: number;
  /** Require a live consent for this ext_marketing_consent_scope value. */
  requireConsentScope?: string;
  /** Clients with no consent record at all are excluded by default. */
  excludeUncontactable?: boolean;
  /** Other segment keys that must also match (AND). */
  allOfSegmentKeys?: string[];
  /** Other segment keys that must NOT match (AND NOT). */
  noneOfSegmentKeys?: string[];
};

// ---------------------------------------------------------------------------
// 2F. ext_crm_segments — named client segments
// ---------------------------------------------------------------------------

/**
 * The 12 canonical segments from the vision are seeded with
 * `is_system = true` so they cannot be deleted, only deactivated.
 */
export const extCrmSegments = pgTable(
  "ext_crm_segments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    name: text("name").notNull(),
    /**
     * Stable machine key, e.g. "churn_risk", "post_op_recovery",
     * "unvaccinated_overdue". Referenced by ext_automation_rules.condition_json
     * (segmentKeys / excludeSegmentKeys), so it must never be renamed in place.
     * The canonical 12 keys live in CRM_SEGMENT_DEFINITIONS
     * (apps/web/lib/autopilot/segmentation-engine.ts).
     */
    segmentKey: text("segment_key").notNull(),
    description: text("description").notNull().default(""),
    /** System segments ship with the product and cannot be deleted. */
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * Inert audit shadow of the segment definition (mirrors
     * CRM_SEGMENT_DEFINITIONS[].condition). Membership is computed by the
     * hardcoded branches in lib/autopilot/segmentation-engine.ts — this JSON
     * is never executed, only stored for the audit trail.
     */
    conditionJson: jsonb("condition_json")
      .$type<CrmSegmentCondition>()
      .notNull()
      .default({}),
    /**
     * SECURITY NOTE — see SCHEMA-DESIGN.md §A.2F.
     *
     * This column is a rendered, human-readable rendering of conditionJson for
     * staff review and for the audit trail. It MUST NOT be executed. The
     * segment engine reads conditionJson only. Enforced by convention here and
     * by a code-level lint rule; there is no DB-level way to stop a query from
     * interpolating it, which is exactly why it must stay inert.
     */
    conditionSql: text("condition_sql"),
    refreshStrategy: extCrmRefreshStrategyEnum("refresh_strategy")
      .notNull()
      .default("event_driven"),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    /** Denormalised for list rendering; refreshed by the segment engine. */
    memberCountCache: integer("member_count_cache").notNull().default(0),
    /** Bumped when conditionJson changes so stale memberships can be detected. */
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    creatorTenantFk: foreignKey({
      columns: [table.practiceId, table.createdBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_crm_segments_creator_tenant_fk",
    }),
    practiceKeyUq: uniqueIndex("ext_crm_segments_practice_key_uq")
      .on(table.practiceId, table.segmentKey)
      .where(sql`${table.deletedAt} is null`),
    practiceIdx: index("ext_crm_segments_practice_idx").on(
      table.practiceId,
      table.deletedAt,
      table.isActive,
    ),
    refreshDueIdx: index("ext_crm_segments_refresh_due_idx")
      .on(table.practiceId, table.lastRefreshedAt)
      .where(
        sql`${table.refreshStrategy} = 'scheduled' and ${table.deletedAt} is null`,
      ),
    /** segment_key is a machine identifier: no whitespace, no uppercase. */
    segmentKeyFormatCheck: check(
      "ext_crm_segments_key_format_check",
      sql`${table.segmentKey} ~ '^[a-z][a-z0-9_]{1,62}$'`,
    ),
    versionCheck: check(
      "ext_crm_segments_version_check",
      sql`${table.version} >= 1`,
    ),
    memberCountCheck: check(
      "ext_crm_segments_member_count_check",
      sql`${table.memberCountCache} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2G. ext_crm_segment_memberships — which clients are in which segment
// ---------------------------------------------------------------------------

export const extCrmSegmentMemberships = pgTable(
  "ext_crm_segment_memberships",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => extCrmSegments.id),
    clientId: uuid("client_id").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * When membership lapses on its own (e.g. "post_op_recovery" expires 30
     * days after discharge). Null = open-ended.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Human-readable why, e.g. "visit_closeout 2026-09-10 (surgery)". */
    enrollmentReason: text("enrollment_reason"),
    triggerEventId: uuid("trigger_event_id").references(
      () => extAutomationEvents.id,
    ),
    /**
     * Staff opt-out of a specific segment for a specific client. Distinct from
     * a global marketing opt-out: the client still receives everything else.
     * Supersedes any automated re-enrollment.
     */
    isManuallyExcluded: boolean("is_manually_excluded")
      .notNull()
      .default(false),
    excludedBy: uuid("excluded_by").references(() => users.id),
    excludedAt: timestamp("excluded_at", { withTimezone: true }),
    /** Segment definition version at enrollment time. */
    segmentVersion: integer("segment_version").notNull().default(1),
  },
  (table) => ({
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "ext_crm_memberships_client_tenant_fk",
    }),
    excluderTenantFk: foreignKey({
      columns: [table.practiceId, table.excludedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_crm_memberships_excluder_tenant_fk",
    }),
    /** A client is in a segment at most once. Non-negotiable. */
    membershipUq: uniqueIndex("ext_crm_membership_uq")
      .on(table.practiceId, table.segmentId, table.clientId)
      .where(sql`${table.deletedAt} is null`),
    /** "Which segments is this client in right now?" — the hot read path. */
    practiceClientIdx: index("ext_crm_membership_client_idx").on(
      table.practiceId,
      table.clientId,
      table.isManuallyExcluded,
    ),
    /** "Who is in this segment, unexpired?" — campaign targeting. */
    practiceSegmentIdx: index("ext_crm_membership_segment_idx").on(
      table.practiceId,
      table.segmentId,
      table.isManuallyExcluded,
      table.expiresAt,
    ),
    /** Expiry sweeper. */
    expiryIdx: index("ext_crm_membership_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} is not null and ${table.deletedAt} is null`),
    exclusionCheck: check(
      "ext_crm_membership_exclusion_check",
      sql`(${table.isManuallyExcluded} = false)
        or (${table.excludedBy} is not null and ${table.excludedAt} is not null)`,
    ),
    expiryCheck: check(
      "ext_crm_membership_expiry_window_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.enrolledAt}`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extCrmSegmentsRelations = relations(extCrmSegments, ({ one, many }) => ({
  practice: one(practices, {
    fields: [extCrmSegments.practiceId],
    references: [practices.id],
  }),
  createdByUser: one(users, {
    fields: [extCrmSegments.createdBy],
    references: [users.id],
  }),
  memberships: many(extCrmSegmentMemberships),
}));

export const extCrmSegmentMembershipsRelations = relations(
  extCrmSegmentMemberships,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extCrmSegmentMemberships.practiceId],
      references: [practices.id],
    }),
    segment: one(extCrmSegments, {
      fields: [extCrmSegmentMemberships.segmentId],
      references: [extCrmSegments.id],
    }),
    client: one(clients, {
      fields: [extCrmSegmentMemberships.clientId],
      references: [clients.id],
    }),
    triggerEvent: one(extAutomationEvents, {
      fields: [extCrmSegmentMemberships.triggerEventId],
      references: [extAutomationEvents.id],
    }),
    excludedByUser: one(users, {
      fields: [extCrmSegmentMemberships.excludedBy],
      references: [users.id],
    }),
  }),
);