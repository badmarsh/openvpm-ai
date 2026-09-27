import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";
import { soapNotes } from "./clinical";
import { appointments } from "./scheduling";
import { extAiAuditLog } from "./ext_ai_audit_log";

/**
 * SOAP AI provenance receipts (ext_soap_ai_provenance), Sprint 32 / GT-001.
 *
 * A receipt is issued server-side whenever AI content is handed to a SOAP
 * draft: `ai.draftSoapNote` (in-app "Draft with AI") and
 * `imaging.injectFindingsIntoSoap`. It is linked to the persisted draft on
 * save and consumed on finalization, when `records.finalizeSoapNote` appends a
 * `soap_note_finalized` event to `ext_ai_audit_log` and stores that event's id
 * here.
 *
 * HASHES ONLY. This table never stores draft text: the clinical text already
 * lives in `soap_notes`, and duplicating it would widen the GDPR surface.
 * `section_hashes` holds the sha256 of each section's plain text as the model
 * produced it (see apps/web/lib/records/soap-ai-provenance.ts), which lets the
 * finalizer classify each section as verbatim, edited, removed or manual.
 */

export const soapAiSourceEnum = pgEnum("soap_ai_source", [
  "soap_draft",
  "imaging_findings",
]);

export type SoapAiSectionHashes = {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

export const extSoapAiProvenance = pgTable(
  "ext_soap_ai_provenance",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),

    /** Null until the receipt is linked to a persisted draft on save. */
    soapNoteId: uuid("soap_note_id").references(() => soapNotes.id),

    appointmentId: uuid("appointment_id").references(() => appointments.id),

    /** The clinician the AI output was handed to. Only they may link it. */
    issuedTo: uuid("issued_to")
      .notNull()
      .references(() => users.id),

    source: soapAiSourceEnum("source").notNull(),

    /** e.g. the ai_imaging_analyses.id for `imaging_findings`. */
    sourceEntityId: uuid("source_entity_id"),

    modelId: text("model_id"),
    provider: text("provider"),

    /** AI feature key, e.g. `soap_draft` or `imaging`. */
    featureKey: text("feature_key").notNull(),

    /** sha256 over the canonical plain-text draft (all four sections). */
    draftHash: text("draft_hash").notNull(),

    /** Per-section sha256 of the plain text (null = section left empty). */
    sectionHashes: jsonb("section_hashes")
      .$type<SoapAiSectionHashes>()
      .notNull()
      .default({}),

    /** Set when finalization wrote the ledger event for this receipt. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    auditEventId: uuid("audit_event_id").references(() => extAiAuditLog.id),
  },
  (table) => ({
    practiceNoteIdx: index("ext_soap_ai_prov_practice_note_idx").on(
      table.practiceId,
      table.soapNoteId,
    ),
    practiceIssuedIdx: index("ext_soap_ai_prov_practice_issued_idx").on(
      table.practiceId,
      table.patientId,
      table.issuedTo,
      table.createdAt,
    ),
  }),
);

export type SoapAiProvenanceReceipt = typeof extSoapAiProvenance.$inferSelect;
