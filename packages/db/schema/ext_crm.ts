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
import { clients } from "./clients";
import { patients } from "./patients";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Segment type: static (manually curated) vs dynamic (rule-based).
 *
 * Static segments: explicit client memberships, e.g. "VIP clients".
 * Dynamic segments: rule-based, e.g. "clients with dogs > 7 years".
 */
export const extCrmSegmentTypeEnum = pgEnum("ext_crm_segment_type", [
  "static",
  "dynamic",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

/**
 * Condition object for dynamic segments.
 *
 * This is a whitelist-compiled JSON object, NOT executable SQL.
 * The rules engine evaluates this against client/patient data.
 */
export type CrmSegmentCondition = {
  /** Filter by patient species: ["dog", "cat", ...] */
  species?: string[];
  /** Filter by patient age: min/max in years. */
  minPatientAgeYears?: number;
  maxPatientAgeYears?: number;
  /** Filter by client attributes. */
  clientTags?: string[];
  /** Filter by wellness enrollment status. */
  hasWellnessEnrollment?: boolean;
  /** Filter by last visit recency (days ago). */
  lastVisitWithinDays?: number;
  lastVisitBeyondDays?: number;
};

// ---------------------------------------------------------------------------
// 2F. ext_crm_segments — CRM segment definitions
// ---------------------------------------------------------------------------

/**
 * Client/patient segments for targeted automation.
 *
 * Segments can be:
 * - Static: manually curated list of clients (ext_crm_segment_memberships)
 * - Dynamic: rule-based, evaluated by the rules engine
 *
 * conditionJson is the source of truth (jsonb, whitelist-compiled);
 * conditionSql is retained as an inert, human-readable rendering that the
 * engine never executes (tenant-isolation hazard — see GUARDRAILS-COMPLIANCE.md §B).
 */
export const extCrmSegments = pgTable(
  "ext_crm_segments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Human-readable segment name, e.g. "Senior Dogs", "VIP Clients". */
    name: text("name").notNull(),
    description: text("description"),
    /** Static (manual) vs dynamic (rule-based). */
    segmentType: extCrmSegmentTypeEnum("segment_type").notNull(),
    /**
     * JSON condition object for dynamic segments (see CrmSegmentCondition).
     * This is the source of truth; conditionSql is derived documentation.
     */
    conditionJson: jsonb("condition_json").$type<CrmSegmentCondition>(),
    /**
     * Human-readable SQL-like rendering of conditionJson for documentation.
     * NEVER executed by the engine (tenant-isolation hazard).
     */
    conditionSql: text("condition_sql"),
    /** Number of clients currently in this segment (cached for UI). */
    clientCount: integer("client_count").notNull().default(0),
    /** When clientCount was last recalculated. */
    clientCountComputedAt: timestamp("client_count_computed_at", {
      withTimezone: true,
    }),
  },
  (t) => ({
    practiceTypeIdx: index("ext_crm_segments_practice_type_idx").on(
      t.practiceId,
      t.segmentType,
    ),
    /** Unique segment name per practice. */
    practiceNameUq: uniqueIndex("ext_crm_segments_practice_name_uq").on(
      t.practiceId,
      t.name,
    ),
    appendOnlyCheck: check(
      "ext_crm_segments_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2G. ext_crm_segment_memberships — static segment memberships
// ---------------------------------------------------------------------------

/**
 * Explicit client memberships in static segments.
 *
 * For dynamic segments, memberships are computed on-the-fly by the rules
 * engine and NOT stored here. This table is ONLY for static segments.
 */
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
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    /** Optional: specific patient that qualified the client for this segment. */
    patientId: uuid("patient_id").references(() => patients.id),
    /** Why this client was added (manual note or rule evaluation result). */
    reason: text("reason"),
  },
  (t) => ({
    segmentIdx: index("ext_crm_memberships_segment_idx").on(
      t.practiceId,
      t.segmentId,
    ),
    clientIdx: index("ext_crm_memberships_client_idx").on(
      t.practiceId,
      t.clientId,
    ),
    /**
     * Unique (segment, client) per practice: prevents duplicate memberships.
     */
    segmentClientUq: uniqueIndex(
      "ext_crm_memberships_practice_segment_client_uq",
    ).on(t.practiceId, t.segmentId, t.clientId),
    appendOnlyCheck: check(
      "ext_crm_memberships_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extCrmSegmentsRelations = relations(
  extCrmSegments,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extCrmSegments.practiceId],
      references: [practices.id],
    }),
    memberships: many(extCrmSegmentMemberships),
  }),
);

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
    patient: one(patients, {
      fields: [extCrmSegmentMemberships.patientId],
      references: [patients.id],
    }),
  }),
);
