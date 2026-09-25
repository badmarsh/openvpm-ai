import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

/**
 * Table: ext_schema_validation_events
 *
 * Sprint 27 — audit trail of VPM input contract validations performed by the
 * schema validation middleware. Stores verdicts and normalized issue codes
 * only (field path + code) — never raw payload values, so the table is
 * PHI-free by construction.
 */
export const extSchemaValidationEvents = pgTable(
  "ext_schema_validation_events",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    contractId: text("contract_id").notNull(), // e.g. 'openvpm.prescription-order'
    schemaVersion: text("schema_version").notNull(), // e.g. '1.0.0'
    result: text("result").notNull(), // 'passed' | 'rejected'
    issueCount: integer("issue_count").notNull().default(0),
    /** Guardrail codes that fired, comma-joined; null when pure schema pass/fail. */
    guardrail: text("guardrail"), // 'ai-draft-only' | 'narcotic-zero-ai-prefill' | 'sympathy-gate'
    /** Normalized issues: [{ field, code }]. No PHI — paths and codes only. */
    issues: jsonb("issues")
      .$type<Array<{ field: string; code: string }>>()
      .notNull()
      .default([]),
    origin: text("origin").notNull().default("api"), // 'api' | 'playground'
    /** Optional reference to the entity the payload belonged to. */
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
  },
  (table) => ({
    practiceIdx: index("ext_schema_val_events_practice_idx").on(
      table.practiceId,
      table.createdAt,
    ),
    contractIdx: index("ext_schema_val_events_contract_idx").on(
      table.practiceId,
      table.contractId,
    ),
  }),
);

export type ExtSchemaValidationEvent =
  typeof extSchemaValidationEvents.$inferSelect;
export type NewExtSchemaValidationEvent =
  typeof extSchemaValidationEvents.$inferInsert;
