import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

/**
 * AI Confirmation Audit Log (ext_ai_audit_log)
 *
 * Immutable audit trail for every clinician confirmation of AI-generated
 * clinical content. Required for ŠVPS SR / KVL SR inspections and GDPR
 * accountability under Zákon č. 18/2018 Z. z.
 *
 * Each row is written when a clinician calls any mutation that sets
 * clinicianConfirmed=true (imaging analysis, voice SOAP, discharge letter,
 * treatment plan, prescription). The SHA-256 hashes prove whether the
 * clinician accepted or edited the raw AI draft.
 *
 * Rows MUST NOT be soft-deleted or mutated after creation — this is an
 * append-only ledger. The `deletedAt` column from baseColumns() is inherited
 * but must never be set by application code.
 */

export const aiAuditEntityTypeEnum = pgEnum("ai_audit_entity_type", [
  "soap_note",
  "discharge_report",
  "imaging_analysis",
  "treatment_plan",
  "prescription",
]);

export const extAiAuditLog = pgTable(
  "ext_ai_audit_log",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    /** Clinician who confirmed the AI content. */
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),

    actorName: text("actor_name").notNull(),

    /** Which type of clinical record was confirmed. */
    entityType: aiAuditEntityTypeEnum("entity_type").notNull(),

    /** UUID of the confirmed record (soap_note.id, discharge_report.id, …). */
    entityId: uuid("entity_id").notNull(),

    /**
     * SHA-256 hex digest of the raw AI draft at the moment the clinician
     * received it. Used to prove what the model originally produced.
     */
    originalDraftHash: text("original_draft_hash").notNull(),

    /**
     * SHA-256 hex digest of the content the clinician ultimately confirmed.
     * If equal to originalDraftHash, the clinician accepted without editing.
     */
    confirmedContentHash: text("confirmed_content_hash").notNull(),

    /**
     * True when originalDraftHash !== confirmedContentHash, i.e. the clinician
     * manually edited the AI output before finalizing it.
     */
    wasEditedByClinician: boolean("was_edited_by_clinician")
      .notNull()
      .default(false),

    /** Request IP for forensic traceability. Nullable — may be absent in tests. */
    ipAddress: text("ip_address"),

    /** Wall-clock time of clinician confirmation (not DB insert time). */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),

    // ── Chain Integrity Columns (v2, added 2026-09-09) ───────────────────────
    // These columns implement the tamper-evident hash chain described in
    // docs/ai-audit-ledger.md. All are nullable to allow safe migration of
    // existing rows; new rows must always supply all chain fields.

    /**
     * Monotonically increasing sequence number per practiceId chain.
     * Gaps or duplicates indicate a missing or inserted event.
     */
    sequenceNumber: integer("sequence_number"),

    /**
     * Role of the actor at the time of confirmation.
     * Included in the integrity hash — excluded from actorName to keep
     * the chain stable across legitimate name changes.
     */
    actorRole: text("actor_role"),

    /**
     * Stable machine-readable action identifier.
     * e.g. "soap_note_finalized", "imaging_confirmed", "discharge_finalized".
     */
    actionType: text("action_type"),

    /**
     * SHA-256 hex digest of the previous event's `eventHash` in the same
     * practice chain. NULL only for the genesis (first) event.
     * Breaks in this linkage indicate inserted, deleted, or reordered events.
     */
    previousEventHash: text("previous_event_hash"),

    /**
     * SHA-256 hex digest of this event's canonical payload.
     * Computed by `computeAiAuditEventHash()` in lib/ai/audit-chain.ts.
     * Any alteration to the bound fields causes a recalculation mismatch.
     */
    eventHash: text("event_hash"),

    /**
     * Version of the canonical serialization algorithm used to compute
     * `eventHash`. Currently always 1. Increment if the canonical format
     * changes to allow the verifier to apply the correct algorithm.
     */
    canonicalizationVersion: integer("canonicalization_version").default(1),
  },
  (table) => ({
    practiceIdx: index("ext_ai_audit_log_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    entityIdx: index("ext_ai_audit_log_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    actorIdx: index("ext_ai_audit_log_actor_idx").on(
      table.actorId,
      table.confirmedAt,
    ),
    /**
     * Unique constraint on (practiceId, sequenceNumber) enforces monotonic
     * sequence integrity at the database level. NULLS are excluded from the
     * unique constraint, allowing legacy rows without sequenceNumber.
     */
    practiceSeqUniq: uniqueIndex("ext_ai_audit_log_practice_seq_uniq").on(
      table.practiceId,
      table.sequenceNumber,
    ),
  }),
);

export const extAiAuditLogRelations = relations(extAiAuditLog, ({ one }) => ({
  practice: one(practices, {
    fields: [extAiAuditLog.practiceId],
    references: [practices.id],
  }),
  actor: one(users, {
    fields: [extAiAuditLog.actorId],
    references: [users.id],
  }),
}));
