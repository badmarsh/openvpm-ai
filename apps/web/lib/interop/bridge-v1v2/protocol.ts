/**
 * Secure Interop Bridge v1 → v2 — protocol contract (Sprint 30).
 * -------------------------------------------------------------
 * A VPM v1 runtime (legacy Firebird clinic) and a VPM v2 runtime
 * (OpenVPM AI PostgreSQL clinic) exchange clinical and administrative
 * messages through this bridge. Every message is:
 *
 *   1. structurally typed      — {@link BRIDGE_MESSAGE_TYPES} contract,
 *   2. schema validated        — see `validation.ts` (Zod payload contracts),
 *   3. encrypted               — AES-256-GCM, see `crypto.ts`,
 *   4. signed                  — HMAC-SHA256 over the canonical envelope,
 *   5. replay protected        — nonce + bounded clock skew,
 *   6. safety gated            — see `safety.ts` (Zákon 39/2007, 139/1998,
 *                                Sympathy Gate).
 *
 * Pure module: no I/O, no database, deterministically testable. The tRPC
 * router (`apps/web/server/routers/extensions/bridge-v1v2.ts`) and the
 * operator console (`app/(dashboard)/admin/interop-bridge/page.tsx`) are thin
 * shells over these functions.
 */

/** Wire protocol revision. Peers negotiate this value before first exchange. */
export const BRIDGE_PROTOCOL_VERSION = "2026-09-bridge-v1";

/** Payload schema versions the bridge can validate on either direction. */
export const BRIDGE_SCHEMA_VERSIONS = ["1.0"] as const;
export type BridgeSchemaVersion = (typeof BRIDGE_SCHEMA_VERSIONS)[number];
export const BRIDGE_DEFAULT_SCHEMA_VERSION: BridgeSchemaVersion = "1.0";

/** Hard ceiling on a single decrypted payload (uncompressed JSON, UTF-8). */
export const BRIDGE_MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KiB

/** Maximum accepted clock skew between peers before a message is stale. */
export const BRIDGE_REPLAY_WINDOW_MS = 5 * 60_000; // ±5 minutes

/** Refuse envelopes whose timestamp is further in the future than this. */
export const BRIDGE_MAX_FUTURE_SKEW_MS = 60_000; // +1 minute

export const BRIDGE_ENCRYPTION_ALGORITHM = "aes-256-gcm" as const;
export const BRIDGE_SIGNATURE_ALGORITHM = "hmac-sha256" as const;
export const BRIDGE_KEY_BYTES = 32; // AES-256 / HMAC-SHA256 key length
export const BRIDGE_IV_BYTES = 12; // GCM nonce
export const BRIDGE_AUTH_TAG_BYTES = 16;
export const BRIDGE_NONCE_BYTES = 16;

export type BridgeEncryptionAlgorithm = typeof BRIDGE_ENCRYPTION_ALGORITHM;

/** The two runtime generations the bridge connects. */
export type BridgeRuntime = "v1" | "v2";

/** Allowed traffic direction — the bridge never fans out to third parties. */
export type BridgeDirection = "v1_to_v2" | "v2_to_v1";

export type BridgeEndpointStatus = "active" | "paused" | "revoked";

export type BridgeMessageStatus =
  | "received"
  | "validated"
  | "quarantined"
  | "processed"
  | "acknowledged"
  | "failed"
  | "rejected";

/**
 * Message catalogue. `patient.*`, `clinical.*`, `prescription.*` and
 * `controlled_substance.*` are clinically significant and additionally pass
 * through the statutory safety gates in `safety.ts`.
 */
export const BRIDGE_MESSAGE_TYPES = [
  // Identity & administrative mirror
  "patient.created",
  "patient.updated",
  "client.created",
  "client.updated",
  "appointment.created",
  "invoice.created",
  "inventory.movement",
  "attachment.linked",
  // Clinical
  "clinical.soap_note.drafted",
  "clinical.soap_note.signed",
  "prescription.created",
  "controlled_substance.dispense",
  // Automation & safety
  "automation.suppression.request",
  // Control plane
  "bridge.heartbeat",
  "bridge.schema_negotiation",
] as const;

export type BridgeMessageType = (typeof BRIDGE_MESSAGE_TYPES)[number];

const MESSAGE_TYPE_SET: ReadonlySet<string> = new Set(BRIDGE_MESSAGE_TYPES);

export function isBridgeMessageType(value: unknown): value is BridgeMessageType {
  return typeof value === "string" && MESSAGE_TYPE_SET.has(value);
}

/** Clinical message types: AI drafts stay `draft` until a vet signs. */
export const BRIDGE_CLINICAL_MESSAGE_TYPES: ReadonlySet<BridgeMessageType> =
  new Set([
    "clinical.soap_note.drafted",
    "clinical.soap_note.signed",
    "prescription.created",
    "controlled_substance.dispense",
  ]);

/** Message types whose payload may carry an automated patient outreach. */
export const BRIDGE_OUTREACH_MESSAGE_TYPES: ReadonlySet<BridgeMessageType> =
  new Set([
    "automation.suppression.request",
    "appointment.created",
    "invoice.created",
  ]);

export function isClinicalMessageType(type: BridgeMessageType): boolean {
  return BRIDGE_CLINICAL_MESSAGE_TYPES.has(type);
}

/** The unique direction for a source → target runtime pair. */
export function bridgeDirectionFor(
  source: BridgeRuntime,
  target: BridgeRuntime,
): BridgeDirection | null {
  if (source === target) return null;
  return source === "v1" ? "v1_to_v2" : "v2_to_v1";
}

export function bridgeDirectionMatches(
  direction: BridgeDirection,
  source: BridgeRuntime,
  target: BridgeRuntime,
): boolean {
  return bridgeDirectionFor(source, target) === direction;
}

/** Runtime that emits on a direction, and the runtime that receives. */
export function bridgeSourceRuntime(direction: BridgeDirection): BridgeRuntime {
  return direction === "v1_to_v2" ? "v1" : "v2";
}

export function bridgeTargetRuntime(direction: BridgeDirection): BridgeRuntime {
  return direction === "v1_to_v2" ? "v2" : "v1";
}

/**
 * Message types each direction is allowed to carry. v1 → v2 is the migration
 * path (v1 is the system of record, v2 mirrors it); v2 → v1 only answers
 * control-plane chatter, because v2 is never authoritative for v1 data.
 * Heartbeat and schema negotiation are liveness/version pings, so they are
 * allowed on both directions.
 */
export const BRIDGE_ALLOWED_MESSAGE_TYPES: Record<
  BridgeDirection,
  readonly BridgeMessageType[]
> = {
  v1_to_v2: [
    "patient.created",
    "patient.updated",
    "client.created",
    "client.updated",
    "appointment.created",
    "invoice.created",
    "inventory.movement",
    "attachment.linked",
    "clinical.soap_note.drafted",
    "clinical.soap_note.signed",
    "prescription.created",
    "controlled_substance.dispense",
    "bridge.heartbeat",
    "bridge.schema_negotiation",
  ],
  v2_to_v1: [
    "automation.suppression.request",
    "bridge.heartbeat",
    "bridge.schema_negotiation",
  ],
};

export function isBridgeMessageTypeAllowed(
  direction: BridgeDirection,
  type: BridgeMessageType,
): boolean {
  return BRIDGE_ALLOWED_MESSAGE_TYPES[direction].includes(type);
}

/**
 * Deterministic JSON: object keys sorted recursively, `undefined` dropped,
 * `Date` normalised to ISO-8601. Hashing or signing raw `JSON.stringify`
 * output is not safe — key order would change the digest and break every
 * signature check after a harmless refactor.
 */
export function canonicalBridgeJson(value: unknown): string {
  return JSON.stringify(sortBridgeValue(value));
}

function sortBridgeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    if (typeof value === "undefined") return null;
    return value;
  }
  if (Array.isArray(value)) return value.map(sortBridgeValue);
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const entry = source[key];
    if (typeof entry === "undefined") continue;
    out[key] = sortBridgeValue(entry);
  }
  return out;
}

/** UTF-8 byte length of a payload once canonicalised. */
export function bridgePayloadByteSize(payload: unknown): number {
  return Buffer.byteLength(canonicalBridgeJson(payload), "utf8");
}

/** Header fields a peer must confirm before the body is trusted. */
export interface BridgeEnvelopeHeader {
  protocolVersion: string;
  messageId: string;
  correlationId: string;
  externalId: string;
  direction: BridgeDirection;
  sourceRuntime: BridgeRuntime;
  targetRuntime: BridgeRuntime;
  messageType: BridgeMessageType;
  schemaVersion: string;
  sentAt: string;
  nonce: string;
  keyId: string;
}

/**
 * Additional authenticated data for AES-256-GCM and for the HMAC signature.
 * Binding the header to the ciphertext makes envelope swapping (moving a
 * valid ciphertext under a different message type, direction or key id)
 * fail authentication instead of silently re-labelling clinical data.
 */
export function bridgeEnvelopeAad(header: BridgeEnvelopeHeader): string {
  return canonicalBridgeJson({
    protocolVersion: header.protocolVersion,
    messageId: header.messageId,
    correlationId: header.correlationId,
    externalId: header.externalId,
    direction: header.direction,
    sourceRuntime: header.sourceRuntime,
    targetRuntime: header.targetRuntime,
    messageType: header.messageType,
    schemaVersion: header.schemaVersion,
    sentAt: header.sentAt,
    nonce: header.nonce,
    keyId: header.keyId,
  });
}

/** Encrypted body as it travels on the wire. */
export interface BridgeEncryptedPayload {
  algorithm: BridgeEncryptionAlgorithm;
  keyId: string;
  iv: string; // base64url
  authTag: string; // base64url
  ciphertext: string; // base64url
  byteSize: number; // plaintext byte size (for limit checks before decrypt)
}

/** Full wire envelope. `payload` is only present after decryption. */
export interface BridgeEnvelope<T = unknown> {
  header: BridgeEnvelopeHeader;
  payloadHash: string; // sha256 hex of canonical payload
  signature: string; // base64url HMAC-SHA256 over header + payloadHash
  encryption: BridgeEncryptedPayload;
  payload?: T;
}

/**
 * True while the peer clock is inside the accepted skew window. `now` is
 * injected so tests are deterministic and the caller controls the clock.
 */
export function isWithinBridgeReplayWindow(
  sentAt: string | Date,
  now: Date = new Date(),
  windowMs: number = BRIDGE_REPLAY_WINDOW_MS,
): boolean {
  const sent = sentAt instanceof Date ? sentAt : new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return false;
  const delta = now.getTime() - sent.getTime();
  if (delta < -BRIDGE_MAX_FUTURE_SKEW_MS) return false; // far-future timestamp
  return Math.abs(delta) <= windowMs;
}

/** Human-readable reason a message landed outside the replay window. */
export function bridgeClockSkewMs(
  sentAt: string | Date,
  now: Date = new Date(),
): number | null {
  const sent = sentAt instanceof Date ? sentAt : new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return null;
  return now.getTime() - sent.getTime();
}

/** Success rate over terminal messages, used by the operator KPI cards. */
export function bridgeSuccessRate(counts: {
  validated: number;
  processed: number;
  quarantined: number;
  rejected: number;
  failed?: number;
}): number {
  const processed = counts.processed + counts.validated;
  const total =
    processed +
    counts.quarantined +
    counts.rejected +
    (counts.failed ?? 0);
  if (total === 0) return 0;
  return Math.round((processed / total) * 1000) / 10;
}

/** Age of the active key in whole days — drives the rotation reminder. */
export function bridgeKeyAgeDays(
  createdAt: string | Date,
  now: Date = new Date(),
): number {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - created.getTime()) / 86_400_000),
  );
}

/** Rotation policy: 90 days, reviewed by the practice administrator. */
export const BRIDGE_KEY_ROTATION_DAYS = 90;

export function isBridgeKeyRotationDue(
  createdAt: string | Date,
  now: Date = new Date(),
): boolean {
  return bridgeKeyAgeDays(createdAt, now) >= BRIDGE_KEY_ROTATION_DAYS;
}

/**
 * Redacts a payload for the operator console: identifiers are truncated and
 * free-text clinical fields replaced by a placeholder, so the audit view can
 * be shown without copying PHI out of the bridge.
 */
export function redactBridgePayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") {
    return typeof payload === "string" ? redactBridgeString(payload) : payload;
  }
  if (Array.isArray(payload)) return payload.map(redactBridgePayload);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FREE_TEXT_FIELDS.has(key)) {
      out[key] = typeof value === "string" && value.length > 0 ? "•••" : value;
      continue;
    }
    out[key] = redactBridgePayload(value);
  }
  return out;
}

const FREE_TEXT_FIELDS = new Set([
  "subjective",
  "objective",
  "assessment",
  "plan",
  "notes",
  "note",
  "message",
  "reason",
  "detail",
]);

function redactBridgeString(value: string): string {
  return value.length <= 4 ? "•••" : `${value.slice(0, 2)}•••`;
}

/** Deterministic short label for the message list (never PHI). */
export function bridgeMessageLabel(
  type: BridgeMessageType,
  externalId: string,
): string {
  return `${type}#${externalId.slice(0, 12)}`;
}
