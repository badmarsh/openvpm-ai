import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

/**
 * Clinician Confirmation Status
 *
 * PENDING: Token/Envelope issued and awaiting one-time clinician finalization.
 * CONSUMED: Atomically consumed during successful clinical finalization.
 * EXPIRED: TTL elapsed without consumption.
 * CANCELLED: Superseded by newer draft edits.
 */
export const confirmationStatusEnum = pgEnum("clinician_confirmation_status", [
  "PENDING",
  "CONSUMED",
  "EXPIRED",
  "CANCELLED",
]);

/**
 * Clinician Confirmation Ledger (ext_clinician_confirmations)
 *
 * Implements one-time, expiring, actor-bound, tenant-bound, revision-bound,
 * and payload-bound confirmation envelopes for sensitive clinical AI finalizations.
 * Prevents double-submit, replay attacks, cross-tenant or role elevation attacks,
 * and stale draft overwrites.
 */
export const extClinicianConfirmations = pgTable(
  "ext_clinician_confirmations",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    /** The authenticated clinician who was presented the review and authorized it. */
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),

    /** Clinician's authenticated role at the time of confirmation issuance. */
    actorRole: text("actor_role").notNull(),

    /** Stable machine-readable action identifier (e.g. "imaging_confirmed", "soap_note_finalized"). */
    actionType: text("action_type").notNull(),

    /** Entity type being confirmed (e.g. "imaging_analysis", "soap_note", "discharge_report"). */
    entityType: text("entity_type").notNull(),

    /** Entity UUID being confirmed. */
    entityId: uuid("entity_id").notNull(),

    /** Expected version/revision of the record being finalized. */
    expectedRevision: integer("expected_revision").notNull().default(0),

    /** SHA-256 hash of the original AI draft presented to the clinician. */
    originalDraftHash: text("original_draft_hash").notNull(),

    /** SHA-256 hash of the exact reviewed/edited content being confirmed. */
    confirmedContentHash: text("confirmed_content_hash").notNull(),

    /** Lifecycle status of this confirmation envelope. */
    status: confirmationStatusEnum("status").notNull().default("PENDING"),

    /** Timestamp when the confirmation was issued. */
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Short expiration window (default 15 minutes). Once expired, cannot be consumed. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Timestamp when this confirmation was consumed in a finalization transaction. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    /** Actor who consumed the confirmation (must match actorId). */
    consumedBy: uuid("consumed_by").references(() => users.id),

    /** Optional correlation ID for tracing. */
    correlationId: text("correlation_id"),
  },
  (table) => ({
    practiceIdx: index("ext_clinician_confirmations_practice_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
    entityIdx: index("ext_clinician_confirmations_entity_idx").on(
      table.entityType,
      table.entityId,
      table.status,
    ),
    actorIdx: index("ext_clinician_confirmations_actor_idx").on(
      table.actorId,
      table.status,
    ),
  }),
);

export const extClinicianConfirmationsRelations = relations(
  extClinicianConfirmations,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extClinicianConfirmations.practiceId],
      references: [practices.id],
    }),
    actor: one(users, {
      fields: [extClinicianConfirmations.actorId],
      references: [users.id],
    }),
  }),
);
