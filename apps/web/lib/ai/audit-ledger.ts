import { sql, eq, and, isNull, desc } from "drizzle-orm";
import { extAiAuditLog } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  CANONICALIZATION_VERSION,
  computeAiAuditEventHash,
  type AuditChainEventPayload,
} from "./audit-chain";
import { assertAgentRole, type AgentUserRole } from "@/lib/authorization";

export class AuditLedgerError extends Error {
  constructor(
    readonly code:
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "CHAIN_BROKEN"
      | "CONCURRENCY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "AuditLedgerError";
  }
}

export interface AppendAiAuditEventInput {
  practiceId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  entityType:
    | "soap_note"
    | "discharge_report"
    | "imaging_analysis"
    | "treatment_plan"
    | "prescription";
  entityId: string;
  actionType: string;
  originalDraftHash: string;
  confirmedContentHash: string;
  wasEditedByClinician?: boolean;
  confirmedAt?: Date;
  ipAddress?: string | null;
}

const HEX_SHA256_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Authoritative, centralized, transaction-bound AI audit event append service.
 *
 * Requirements (Sprint 9.3):
 * 1. Atomically appends within the caller's database transaction (`tx`).
 * 2. Serializes chain operations per practiceId using PostgreSQL transaction-scoped
 *    advisory locks: `pg_advisory_xact_lock(hashtextextended('ai_audit_chain:' || practiceId, 0))`.
 * 3. Atomically allocates monotonically increasing `sequenceNumber` per practice.
 * 4. Retrieves the exact prior `eventHash` and links it as `previousEventHash`.
 * 5. Computes canonical SHA-256 `eventHash` using `computeAiAuditEventHash()`.
 * 6. Validates fail-closed clinician role (`veterinarian` | `admin`).
 * 7. Fails closed: if this throws, the caller's enclosing transaction aborts.
 */
export async function appendAiAuditEvent(
  tx: Database,
  input: AppendAiAuditEventInput,
) {
  // 1. Fail-closed role enforcement
  assertAgentRole(
    { userRole: input.actorRole },
    ["admin", "veterinarian"],
    "Audit logging of AI confirmation requires an authorized clinical role.",
  );

  // 2. Validate input parameters
  if (!input.practiceId || input.practiceId.trim() === "") {
    throw new AuditLedgerError("BAD_REQUEST", "practiceId is required");
  }
  if (!input.actorId || input.actorId.trim() === "") {
    throw new AuditLedgerError("BAD_REQUEST", "actorId is required");
  }
  if (!input.entityId || input.entityId.trim() === "") {
    throw new AuditLedgerError("BAD_REQUEST", "entityId is required");
  }
  if (!input.actionType || input.actionType.trim() === "") {
    throw new AuditLedgerError("BAD_REQUEST", "actionType is required");
  }
  if (!HEX_SHA256_REGEX.test(input.originalDraftHash)) {
    throw new AuditLedgerError(
      "BAD_REQUEST",
      "originalDraftHash must be a 64-character SHA-256 hex string",
    );
  }
  if (!HEX_SHA256_REGEX.test(input.confirmedContentHash)) {
    throw new AuditLedgerError(
      "BAD_REQUEST",
      "confirmedContentHash must be a 64-character SHA-256 hex string",
    );
  }

  // 3. Acquire practice-scoped advisory transaction lock
  // Released automatically at COMMIT or ROLLBACK.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ai_audit_chain:${input.practiceId}`}, 0))`,
  );

  // 4. Query the latest audit record for this practice
  const [latest] = await tx
    .select({
      sequenceNumber: extAiAuditLog.sequenceNumber,
      eventHash: extAiAuditLog.eventHash,
    })
    .from(extAiAuditLog)
    .where(
      and(
        eq(extAiAuditLog.practiceId, input.practiceId),
        isNull(extAiAuditLog.deletedAt),
      ),
    )
    .orderBy(
      desc(extAiAuditLog.sequenceNumber),
      desc(extAiAuditLog.confirmedAt),
    )
    .limit(1);

  let sequenceNumber = 1;
  let previousEventHash: string | null = null;

  if (!latest) {
    // Empty ledger for this practice: genesis event. (Whether a genesis may
    // be minted when legacy v1 rows exist is governed by the cutover policy
    // in docs/audit-chain-cutover-and-backfill.md — the v1/v2 boundary is a
    // deployment/release decision, not a silent runtime fallback.)
    sequenceNumber = 1;
    previousEventHash = null;
  } else {
    // Any existing row MUST carry a usable v2 sequence allocation and a
    // verifiable predecessor hash. Fail closed — never silently fork the
    // chain, never re-mint sequence 1 over existing rows.
    if (
      latest.sequenceNumber === null ||
      latest.sequenceNumber === undefined
    ) {
      throw new AuditLedgerError(
        "CHAIN_BROKEN",
        "Existing audit log rows for this practice lack v2 sequence allocation. Run backfill before appending new chain events.",
      );
    }
    if (
      !latest.eventHash ||
      !HEX_SHA256_REGEX.test(latest.eventHash)
    ) {
      throw new AuditLedgerError(
        "CHAIN_BROKEN",
        "Latest audit event for this practice has a missing or invalid event hash; the predecessor cannot be verified. Halt appends and investigate before continuing the chain.",
      );
    }
    sequenceNumber = latest.sequenceNumber + 1;
    previousEventHash = latest.eventHash;
  }

  const confirmedAt = input.confirmedAt ?? new Date();
  const confirmedAtIso = confirmedAt.toISOString();
  const wasEditedByClinician =
    input.wasEditedByClinician ??
    input.originalDraftHash !== input.confirmedContentHash;

  // 5. Build canonical event payload
  const payload: AuditChainEventPayload = {
    actionType: input.actionType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    confirmedAt: confirmedAtIso,
    confirmedContentHash: input.confirmedContentHash,
    entityId: input.entityId,
    entityType: input.entityType,
    originalDraftHash: input.originalDraftHash,
    practiceId: input.practiceId,
    previousEventHash,
    sequenceNumber,
    wasEditedByClinician,
  };

  const eventHash = computeAiAuditEventHash(payload);

  // 6. Insert audit row
  const [inserted] = await tx
    .insert(extAiAuditLog)
    .values({
      practiceId: input.practiceId,
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      entityType: input.entityType,
      entityId: input.entityId,
      actionType: input.actionType,
      originalDraftHash: input.originalDraftHash,
      confirmedContentHash: input.confirmedContentHash,
      wasEditedByClinician,
      confirmedAt,
      ipAddress: input.ipAddress ?? null,
      sequenceNumber,
      previousEventHash,
      eventHash,
      canonicalizationVersion: CANONICALIZATION_VERSION,
    })
    .returning();

  return {
    row: inserted!,
    payload,
    eventHash,
    sequenceNumber,
    previousEventHash,
  };
}
