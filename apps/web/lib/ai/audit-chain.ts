import { createHash } from "node:crypto";

/**
 * AI Audit Chain — Canonical Hashing and Chain Integrity
 *
 * Implements application-level tamper-evidence for the ext_ai_audit_log
 * ledger. Each event is cryptographically linked to its predecessor within
 * the same practice chain, so any alteration, deletion, insertion, or
 * reordering of audit records is detectable by verification.
 *
 * IMPORTANT LIMITATIONS (see docs/ai-audit-ledger.md):
 *   - This is NOT WORM storage — a DBA with write access to the database
 *     AND knowledge of this algorithm could recompute hashes after altering
 *     records without detection.
 *   - This does NOT provide independent legal notarization.
 *   - External anchoring (object-storage WORM bucket, RFC 3161 TSA, or
 *     transparency log) is required for stronger forensic claims.
 *
 * Chain scope: PRACTICE-SCOPED — each practiceId maintains an independent
 * monotonically numbered event chain. Events across practices are isolated.
 *
 * Canonicalization version 1: deterministic JSON with alphabetically sorted
 * keys. Mutable human-readable fields (actorName, ipAddress) are intentionally
 * EXCLUDED from the integrity payload — their exclusion keeps the chain stable
 * across legitimate metadata updates (e.g. legal name changes).
 */

/** Current canonicalization algorithm version. Increment if the canonical format changes. */
export const CANONICALIZATION_VERSION = 1;

/** Maximum allowed clock skew for confirmedAt timestamps (5 minutes). */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * The predecessor hash value for the first (genesis) event in each practice
 * chain. Using an explicit sentinel rather than null makes the genesis
 * condition unambiguous in the canonical payload.
 */
export const GENESIS_PREDECESSOR_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Fields included in the canonical integrity payload (alphabetically sorted). */
export interface AuditChainEventPayload {
  actionType: string;
  actorId: string;
  actorRole: string;
  canonicalizationVersion: number;
  confirmedAt: string; // ISO 8601 UTC string — must be stable across serializations
  confirmedContentHash: string;
  entityId: string;
  entityType: string;
  originalDraftHash: string;
  practiceId: string;
  previousEventHash: string | null; // null only for genesis event
  sequenceNumber: number;
  wasEditedByClinician: boolean;
}

export interface AuditChainError {
  type:
    | "ALTERED_EDIT_FLAG"
    | "FUTURE_TIMESTAMP"
    | "HASH_MISMATCH"
    | "INVALID_CANON_VERSION"
    | "MISSING_REQUIRED_FIELD"
    | "PREDECESSOR_MISMATCH"
    | "SEQUENCE_DUPLICATE"
    | "SEQUENCE_GAP";
  sequenceNumber?: number;
  eventId?: string;
  detail: string;
}

export interface PracticeChainResult {
  practiceId: string;
  eventCount: number;
  ok: boolean;
  errors: AuditChainError[];
}

export interface AuditChainVerificationResult {
  ok: boolean;
  totalEvents: number;
  errors: AuditChainError[];
  practiceResults: Record<string, PracticeChainResult>;
}

/** Shape of a raw database row from ext_ai_audit_log. */
export interface AuditLogDbRow {
  id: string;
  practiceId: string;
  sequenceNumber: number | null;
  actorId: string;
  actorRole: string | null;
  entityType: string;
  entityId: string;
  actionType: string | null;
  originalDraftHash: string;
  confirmedContentHash: string;
  wasEditedByClinician: boolean;
  confirmedAt: Date | string;
  previousEventHash: string | null;
  eventHash: string | null;
  canonicalizationVersion: number | null;
}

/**
 * Produces the deterministic canonical JSON string for an audit event.
 *
 * Keys are sorted alphabetically to guarantee determinism regardless of
 * JavaScript object property insertion order. All values must be primitives
 * (string, number, boolean, null) — no Date objects, no undefined.
 */
export function buildCanonicalAiAuditEvent(
  event: AuditChainEventPayload,
): string {
  // Explicit sort: do NOT rely on key insertion order
  const canonical = {
    actionType: event.actionType,
    actorId: event.actorId,
    actorRole: event.actorRole,
    canonicalizationVersion: event.canonicalizationVersion,
    confirmedAt: event.confirmedAt,
    confirmedContentHash: event.confirmedContentHash,
    entityId: event.entityId,
    entityType: event.entityType,
    originalDraftHash: event.originalDraftHash,
    practiceId: event.practiceId,
    previousEventHash: event.previousEventHash,
    sequenceNumber: event.sequenceNumber,
    wasEditedByClinician: event.wasEditedByClinician,
  };
  return JSON.stringify(canonical);
}

/**
 * Computes the SHA-256 hex digest of the canonical event payload.
 * This is the value stored in the `eventHash` column.
 */
export function computeAiAuditEventHash(
  event: AuditChainEventPayload,
): string {
  const canonical = buildCanonicalAiAuditEvent(event);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Converts a DB row's confirmedAt to a stable ISO 8601 UTC string.
 * Ensures consistent serialization whether the DB driver returns a Date
 * object or a string.
 */
function toUtcIsoString(value: Date | string): string {
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return value.toISOString();
}

/**
 * Verifies the integrity of audit event chains for all practices present in
 * the provided event list.
 *
 * Events may be supplied in any order — this function sorts them by
 * (practiceId, sequenceNumber) internally.
 *
 * Detects:
 *   - Hash mismatch (altered fields)
 *   - Sequence gaps (missing events)
 *   - Sequence duplicates (inserted events)
 *   - Predecessor linkage breaks (reordered or forged events)
 *   - Future timestamps beyond clock-skew allowance
 *   - Invalid canonicalization versions
 *   - Altered wasEditedByClinician flags
 *   - Missing required fields (sequenceNumber, actorRole, actionType)
 */
export function verifyAiAuditChain(
  events: AuditLogDbRow[],
  options?: { nowMs?: number },
): AuditChainVerificationResult {
  const nowMs = options?.nowMs ?? Date.now();

  // Group by practice
  const practiceMap = new Map<string, AuditLogDbRow[]>();
  for (const ev of events) {
    const list = practiceMap.get(ev.practiceId) ?? [];
    list.push(ev);
    practiceMap.set(ev.practiceId, list);
  }

  const allErrors: AuditChainError[] = [];
  const practiceResults: Record<string, PracticeChainResult> = {};

  for (const [practiceId, practiceEvents] of practiceMap) {
    const errors: AuditChainError[] = [];

    // Sort ascending by sequenceNumber
    const sorted = [...practiceEvents].sort(
      (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0),
    );

    // Detect duplicate sequence numbers before processing
    const seenSeq = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i]!;
      const seqNum = ev.sequenceNumber;

      // Missing sequenceNumber
      if (seqNum === null || seqNum === undefined) {
        errors.push({
          type: "MISSING_REQUIRED_FIELD",
          eventId: ev.id,
          detail: `Event id=${ev.id}: missing sequenceNumber — chain columns not migrated yet`,
        });
        continue;
      }

      // Duplicate sequence number
      if (seenSeq.has(seqNum)) {
        errors.push({
          type: "SEQUENCE_DUPLICATE",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `Duplicate sequenceNumber=${seqNum} in practice ${practiceId}`,
        });
        continue;
      }
      seenSeq.add(seqNum);

      // Missing required chain fields
      if (!ev.actorRole) {
        errors.push({
          type: "MISSING_REQUIRED_FIELD",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `seq=${seqNum}: missing actorRole`,
        });
      }
      if (!ev.actionType) {
        errors.push({
          type: "MISSING_REQUIRED_FIELD",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `seq=${seqNum}: missing actionType`,
        });
      }

      // Sequence continuity: expected = previous seqNum + 1 (or first)
      const expectedSeq = i === 0 ? seqNum : (sorted[i - 1]!.sequenceNumber ?? 0) + 1;
      if (i > 0 && seqNum !== expectedSeq) {
        errors.push({
          type: "SEQUENCE_GAP",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `Sequence gap: expected seq=${expectedSeq}, got seq=${seqNum}`,
        });
      }

      // Genesis / predecessor linkage
      if (i === 0) {
        // First event: previousEventHash must be null or GENESIS
        if (
          ev.previousEventHash !== null &&
          ev.previousEventHash !== GENESIS_PREDECESSOR_HASH
        ) {
          errors.push({
            type: "PREDECESSOR_MISMATCH",
            sequenceNumber: seqNum,
            eventId: ev.id,
            detail: `Genesis event seq=${seqNum}: unexpected previousEventHash="${ev.previousEventHash}"`,
          });
        }
      } else {
        // Non-genesis: previousEventHash must match the eventHash of the prior event
        const prevStoredHash = sorted[i - 1]!.eventHash;
        if (ev.previousEventHash !== prevStoredHash) {
          errors.push({
            type: "PREDECESSOR_MISMATCH",
            sequenceNumber: seqNum,
            eventId: ev.id,
            detail: `seq=${seqNum}: previousEventHash="${ev.previousEventHash}" does not match prior eventHash="${prevStoredHash}"`,
          });
        }
      }

      // Canonicalization version check
      const canVersion = ev.canonicalizationVersion ?? 1;
      if (canVersion !== CANONICALIZATION_VERSION) {
        errors.push({
          type: "INVALID_CANON_VERSION",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `seq=${seqNum}: unsupported canonicalizationVersion=${canVersion} (supported: ${CANONICALIZATION_VERSION})`,
        });
        // Cannot safely verify hash with an unknown version — skip hash check
        continue;
      }

      // Recalculate event hash and compare with stored value
      if (ev.eventHash !== null && ev.eventHash !== undefined) {
        const confirmedAtStr = toUtcIsoString(ev.confirmedAt);
        const payload: AuditChainEventPayload = {
          actionType: ev.actionType ?? "",
          actorId: ev.actorId,
          actorRole: ev.actorRole ?? "",
          canonicalizationVersion: canVersion,
          confirmedAt: confirmedAtStr,
          confirmedContentHash: ev.confirmedContentHash,
          entityId: ev.entityId,
          entityType: ev.entityType,
          originalDraftHash: ev.originalDraftHash,
          practiceId: ev.practiceId,
          previousEventHash: ev.previousEventHash,
          sequenceNumber: seqNum,
          wasEditedByClinician: ev.wasEditedByClinician,
        };

        const recalculated = computeAiAuditEventHash(payload);
        if (recalculated !== ev.eventHash) {
          errors.push({
            type: "HASH_MISMATCH",
            sequenceNumber: seqNum,
            eventId: ev.id,
            detail: `seq=${seqNum}: stored eventHash="${ev.eventHash}" does not match recalculated="${recalculated}"`,
          });
        }
      }

      // wasEditedByClinician consistency check (independent of hash chain)
      const expectedEdited =
        ev.originalDraftHash !== ev.confirmedContentHash;
      if (ev.wasEditedByClinician !== expectedEdited) {
        errors.push({
          type: "ALTERED_EDIT_FLAG",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `seq=${seqNum}: wasEditedByClinician=${ev.wasEditedByClinician} but hash comparison says edited=${expectedEdited}`,
        });
      }

      // Future timestamp check
      const confirmedAtMs = new Date(
        toUtcIsoString(ev.confirmedAt),
      ).getTime();
      if (confirmedAtMs > nowMs + MAX_CLOCK_SKEW_MS) {
        errors.push({
          type: "FUTURE_TIMESTAMP",
          sequenceNumber: seqNum,
          eventId: ev.id,
          detail: `seq=${seqNum}: confirmedAt is ${Math.round((confirmedAtMs - nowMs) / 1000)}s in the future (max allowance: ${MAX_CLOCK_SKEW_MS / 1000}s)`,
        });
      }
    }

    allErrors.push(...errors);
    practiceResults[practiceId] = {
      practiceId,
      eventCount: sorted.length,
      ok: errors.length === 0,
      errors,
    };
  }

  return {
    ok: allErrors.length === 0,
    totalEvents: events.length,
    errors: allErrors,
    practiceResults,
  };
}

/**
 * External anchor provider interface.
 * Implement this for stronger forensic claims (WORM storage, TSA, transparency log).
 * See docs/ai-audit-ledger.md §5 for details.
 */
export interface AuditAnchorProvider {
  /** Anchors a batch of event hashes to an external verifiable system. Idempotent. */
  anchor(
    practiceId: string,
    eventHashes: string[],
    checkpoint: number,
  ): Promise<void>;
  /** Verifies that previously anchored hashes match the external record. */
  verify(
    practiceId: string,
    checkpoint: number,
  ): Promise<{ ok: boolean; detail?: string }>;
}

/** No-op provider for development — passes all operations without side effects. */
export class NoOpAuditAnchorProvider implements AuditAnchorProvider {
  async anchor(): Promise<void> {
    // no-op
  }
  async verify(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
