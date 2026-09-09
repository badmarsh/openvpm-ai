import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  index,
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
