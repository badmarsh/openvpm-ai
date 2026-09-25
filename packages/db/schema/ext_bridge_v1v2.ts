/**
 * Secure Interop Bridge v1 → v2 — extension schema (Sprint 30).
 * -------------------------------------------------------------
 * Isolated `ext_*` tables so the bridge never touches the vanilla upstream
 * schema (`packages/db/schema/*.ts` are read-only for this repository).
 *
 * Storage rules that follow from `security/policies/bridge.md`:
 *
 *   • **No secrets in the database.** `ext_bridge_keys` stores a public
 *     fingerprint, an HKDF salt and a *reference* to the deployment secret
 *     (`secret_ref`), never the secret material itself.
 *   • **Ciphertext only.** `ext_bridge_messages` persists the sealed envelope
 *     plus a redacted payload summary — never a plaintext clinical record.
 *   • **Evidence first.** Rejected and quarantined envelopes are stored with
 *     their validation issues and failure code, so a misbehaving peer is
 *     diagnosable after the fact.
 *   • **Sympathy Gate.** A suppressed outreach is written to the canonical
 *     `ext_automation_suppression_log`, and mirrored here for the interop
 *     audit trail.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Which VPM generation an endpoint, key or message belongs to. */
export const extBridgeRuntimeEnum = pgEnum("ext_bridge_runtime", ["v1", "v2"]);

/** Traffic direction. v1 → v2 mirrors data; v2 → v1 answers control plane. */
export const extBridgeDirectionEnum = pgEnum("ext_bridge_direction", [
  "v1_to_v2",
  "v2_to_v1",
]);

export const extBridgeEndpointStatusEnum = pgEnum(
  "ext_bridge_endpoint_status",
  ["active", "paused", "revoked"],
);

/**
 * Message lifecycle. `rejected` = the peer sent something structurally wrong
 * (fixable, no key was touched); `quarantined` = authentication or a statutory
 * gate failed. Both are terminal until an operator re-drives the message.
 */
export const extBridgeMessageStatusEnum = pgEnum("ext_bridge_message_status", [
  "received",
  "validated",
  "quarantined",
  "processed",
  "acknowledged",
  "failed",
  "rejected",
]);

export const extBridgeKeyStatusEnum = pgEnum("ext_bridge_key_status", [
  "active",
  "rotated",
  "revoked",
]);

export const extBridgeContractStatusEnum = pgEnum(
  "ext_bridge_contract_status",
  ["active", "disabled"],
);

/** Audit vocabulary for `ext_bridge_events`. */
export const extBridgeEventTypeEnum = pgEnum("ext_bridge_event_type", [
  "endpoint_registered",
  "endpoint_updated",
  "key_registered",
  "key_rotated",
  "key_revoked",
  "contract_updated",
  "envelope_received",
  "signature_verified",
  "signature_invalid",
  "decrypted",
  "decryption_failed",
  "schema_validated",
  "schema_rejected",
  "safety_gate_blocked",
  "quarantined",
  "dispatched",
  "acknowledged",
  "suppression_forwarded",
]);

export const extBridgeEventSeverityEnum = pgEnum(
  "ext_bridge_event_severity",
  ["info", "warning", "critical"],
);

// ---------------------------------------------------------------------------
// 1. Endpoints — one registered peer runtime per practice
// ---------------------------------------------------------------------------

export const extBridgeEndpoints = pgTable(
  "ext_bridge_endpoints",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Operator-facing label, e.g. "Klinika v1 (Firebird)". */
    name: varchar("name", { length: 120 }).notNull(),
    runtime: extBridgeRuntimeEnum("runtime").notNull(),
    direction: extBridgeDirectionEnum("direction").notNull(),
    /** HTTPS only — enforced in the router, recorded here for the audit. */
    baseUrl: varchar("base_url", { length: 255 }).notNull(),
    protocolVersion: varchar("protocol_version", { length: 64 })
      .notNull()
      .default("2026-09-bridge-v1"),
    status: extBridgeEndpointStatusEnum("status").notNull().default("active"),
    /** Key id currently expected on envelopes from/to this endpoint. */
    activeKeyId: varchar("active_key_id", { length: 160 }),
    /** Message types this endpoint may exchange (empty = catalogue default). */
    allowedMessageTypes: jsonb("allowed_message_types")
      .$type<string[]>()
      .notNull()
      .default([]),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastFailureCode: varchar("last_failure_code", { length: 64 }),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    endpointUq: uniqueIndex("ext_bridge_endpoints_runtime_uq").on(
      table.practiceId,
      table.runtime,
    ),
    endpointStatusIdx: index("ext_bridge_endpoints_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2. Key registry — fingerprints and references only
// ---------------------------------------------------------------------------

export const extBridgeKeys = pgTable(
  "ext_bridge_keys",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    runtime: extBridgeRuntimeEnum("runtime").notNull(),
    /** Public key identifier carried in every envelope header. */
    keyId: varchar("key_id", { length: 160 }).notNull(),
    algorithm: varchar("algorithm", { length: 32 })
      .notNull()
      .default("aes-256-gcm"),
    /** `sha256:<hex>` of the secret — proves which secret is provisioned. */
    fingerprint: varchar("fingerprint", { length: 80 }).notNull(),
    /** Non-secret HKDF salt; the derived key never leaves process memory. */
    salt: varchar("salt", { length: 120 }).notNull(),
    /** Deployment secret reference (env var / secret-store path). NEVER a secret. */
    secretRef: varchar("secret_ref", { length: 160 }).notNull(),
    status: extBridgeKeyStatusEnum("status").notNull().default("active"),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    keyUq: uniqueIndex("ext_bridge_keys_key_uq").on(
      table.practiceId,
      table.keyId,
    ),
    activeKeyIdx: index("ext_bridge_keys_active_idx").on(
      table.practiceId,
      table.runtime,
      table.status,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 3. Contract registry — which payload schema each peer has agreed to
// ---------------------------------------------------------------------------

export const extBridgeContracts = pgTable(
  "ext_bridge_contracts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    messageType: varchar("message_type", { length: 64 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 16 })
      .notNull()
      .default("1.0"),
    direction: extBridgeDirectionEnum("direction").notNull(),
    /** Strict contracts reject unknown payload fields (fail-closed). */
    strict: boolean("strict").notNull().default(true),
    status: extBridgeContractStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => ({
    contractUq: uniqueIndex("ext_bridge_contracts_uq").on(
      table.practiceId,
      table.messageType,
      table.schemaVersion,
      table.direction,
    ),
    contractStatusIdx: index("ext_bridge_contracts_status_idx").on(
      table.practiceId,
      table.status,
      table.deletedAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 4. Message log — sealed envelopes and their validation outcome
// ---------------------------------------------------------------------------

export const extBridgeMessages = pgTable(
  "ext_bridge_messages",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    endpointId: uuid("endpoint_id").references(() => extBridgeEndpoints.id),
    direction: extBridgeDirectionEnum("direction").notNull(),
    /** Emitting runtime (derived from the direction, stored for filtering). */
    sourceRuntime: extBridgeRuntimeEnum("source_runtime").notNull(),
    messageType: varchar("message_type", { length: 64 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 16 })
      .notNull()
      .default("1.0"),
    status: extBridgeMessageStatusEnum("status").notNull(),
    /** Peer-side identifier of the business record (idempotency key). */
    externalId: varchar("external_id", { length: 160 }).notNull(),
    messageId: varchar("message_id", { length: 160 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }),
    nonce: varchar("nonce", { length: 128 }).notNull(),
    keyId: varchar("key_id", { length: 160 }),
    algorithm: varchar("algorithm", { length: 32 }),
    iv: varchar("iv", { length: 64 }),
    authTag: varchar("auth_tag", { length: 64 }),
    ciphertext: text("ciphertext"),
    payloadHash: varchar("payload_hash", { length: 64 }),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    payloadByteSize: integer("payload_byte_size").notNull().default(0),
    failureCode: varchar("failure_code", { length: 64 }),
    /** Zod issues per field — the operator sees exactly what was refused. */
    validationIssues: jsonb("validation_issues")
      .$type<
        Array<{ path: string; code: string; message: string }>
      >()
      .notNull()
      .default([]),
    /** Redacted payload copy (free text masked) — never full PHI. */
    payloadSummary: jsonb("payload_summary").$type<unknown>(),
    patientId: uuid("patient_id").references(() => patients.id),
    /** Clinical content arrived as draft and still needs a vet signature. */
    clinicalDraft: boolean("clinical_draft").notNull().default(false),
    requiresVetSignoff: boolean("requires_vet_signoff").notNull().default(false),
    controlledSubstance: boolean("controlled_substance").notNull().default(false),
    /** Sympathy Gate applied: automated outreach withheld for this patient. */
    sympathySuppressed: boolean("sympathy_suppressed").notNull().default(false),
    attempt: integer("attempt").notNull().default(1),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (table) => ({
    messageUq: uniqueIndex("ext_bridge_messages_message_uq").on(
      table.practiceId,
      table.messageId,
    ),
    // Replay protection: a nonce may be consumed exactly once per practice.
    nonceUq: uniqueIndex("ext_bridge_messages_nonce_uq").on(
      table.practiceId,
      table.nonce,
    ),
    statusIdx: index("ext_bridge_messages_status_idx").on(
      table.practiceId,
      table.status,
      table.createdAt,
    ),
    typeIdx: index("ext_bridge_messages_type_idx").on(
      table.practiceId,
      table.messageType,
      table.createdAt,
    ),
    externalIdx: index("ext_bridge_messages_external_idx").on(
      table.practiceId,
      table.externalId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 5. Event trail — security-relevant actions around the bridge
// ---------------------------------------------------------------------------

export const extBridgeEvents = pgTable(
  "ext_bridge_events",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    endpointId: uuid("endpoint_id").references(() => extBridgeEndpoints.id),
    messageId: uuid("message_id").references(() => extBridgeMessages.id),
    eventType: extBridgeEventTypeEnum("event_type").notNull(),
    severity: extBridgeEventSeverityEnum("severity")
      .notNull()
      .default("info"),
    /** `user:<uuid>`, `system`, or `bridge:v1`. Never PHI. */
    actor: varchar("actor", { length: 80 }).notNull().default("system"),
    detail: text("detail"),
  },
  (table) => ({
    eventIdx: index("ext_bridge_events_practice_idx").on(
      table.practiceId,
      table.createdAt,
    ),
    eventMessageIdx: index("ext_bridge_events_message_idx").on(
      table.messageId,
      table.createdAt,
    ),
    eventSeverityIdx: index("ext_bridge_events_severity_idx").on(
      table.practiceId,
      table.severity,
      table.createdAt,
    ),
  }),
);

export type ExtBridgeEndpoint = typeof extBridgeEndpoints.$inferSelect;
export type NewExtBridgeEndpoint = typeof extBridgeEndpoints.$inferInsert;
export type ExtBridgeKey = typeof extBridgeKeys.$inferSelect;
export type NewExtBridgeKey = typeof extBridgeKeys.$inferInsert;
export type ExtBridgeContract = typeof extBridgeContracts.$inferSelect;
export type NewExtBridgeContract = typeof extBridgeContracts.$inferInsert;
export type ExtBridgeMessage = typeof extBridgeMessages.$inferSelect;
export type NewExtBridgeMessage = typeof extBridgeMessages.$inferInsert;
export type ExtBridgeEvent = typeof extBridgeEvents.$inferSelect;
export type NewExtBridgeEvent = typeof extBridgeEvents.$inferInsert;
