import { and, eq, gt, isNull } from "drizzle-orm";
import { extClinicianConfirmations } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { assertAgentRole, type AgentUserRole } from "@/lib/authorization";

export class ClinicianConfirmationError extends Error {
  constructor(
    readonly code:
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "EXPIRED"
      | "ALREADY_CONSUMED"
      | "ACTOR_MISMATCH"
      | "ROLE_MISMATCH"
      | "PRACTICE_MISMATCH"
      | "ENTITY_MISMATCH"
      | "ACTION_MISMATCH"
      | "REVISION_MISMATCH"
      | "DRAFT_MISMATCH"
      | "PAYLOAD_MISMATCH"
      | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "ClinicianConfirmationError";
  }
}

export interface IssueConfirmationInput {
  practiceId: string;
  actorId: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  expectedRevision?: number;
  originalDraftHash: string;
  confirmedContentHash: string;
  ttlSeconds?: number; // default 900 (15 minutes)
  correlationId?: string;
}

export interface ConsumeConfirmationInput {
  confirmationId: string;
  practiceId: string;
  actorId: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  expectedRevision: number;
  originalDraftHash: string;
  confirmedContentHash: string;
}

export interface DirectConfirmationInput {
  practiceId: string;
  actorId: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  expectedRevision: number;
  originalDraftHash: string;
  confirmedContentHash: string;
  correlationId?: string;
}

const DEFAULT_TTL_SECONDS = 900; // 15 minutes

/**
 * Issues a time-limited, actor-bound, tenant-bound, payload-bound confirmation envelope.
 * Presented to the clinician during the final review modal.
 */
export async function issueClinicianConfirmation(
  db: Database,
  input: IssueConfirmationInput,
) {
  assertAgentRole(
    { userRole: input.actorRole },
    ["admin", "veterinarian"],
    "Only authorized clinicians may be issued confirmation envelopes.",
  );

  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const [row] = await db
    .insert(extClinicianConfirmations)
    .values({
      practiceId: input.practiceId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      expectedRevision: input.expectedRevision ?? 0,
      originalDraftHash: input.originalDraftHash,
      confirmedContentHash: input.confirmedContentHash,
      status: "PENDING",
      issuedAt: now,
      expiresAt,
      correlationId: input.correlationId ?? null,
    })
    .returning();

  return row!;
}

/**
 * Consumes a pre-issued confirmation envelope within the finalization transaction.
 * Guarantees exactly-one-time consumption and strict binding checks.
 */
export async function consumeClinicianConfirmation(
  tx: Database,
  input: ConsumeConfirmationInput,
) {
  assertAgentRole(
    { userRole: input.actorRole },
    ["admin", "veterinarian"],
    "Only authorized clinicians may consume confirmation envelopes.",
  );

  const now = new Date();

  // Atomic conditional update: status PENDING -> CONSUMED
  const [consumed] = await tx
    .update(extClinicianConfirmations)
    .set({
      status: "CONSUMED",
      consumedAt: now,
      consumedBy: input.actorId,
    })
    .where(
      and(
        eq(extClinicianConfirmations.id, input.confirmationId),
        eq(extClinicianConfirmations.practiceId, input.practiceId),
        eq(extClinicianConfirmations.actorId, input.actorId),
        eq(extClinicianConfirmations.actorRole, input.actorRole),
        eq(extClinicianConfirmations.actionType, input.actionType),
        eq(extClinicianConfirmations.entityType, input.entityType),
        eq(extClinicianConfirmations.entityId, input.entityId),
        eq(extClinicianConfirmations.expectedRevision, input.expectedRevision),
        eq(extClinicianConfirmations.originalDraftHash, input.originalDraftHash),
        eq(
          extClinicianConfirmations.confirmedContentHash,
          input.confirmedContentHash,
        ),
        eq(extClinicianConfirmations.status, "PENDING"),
        gt(extClinicianConfirmations.expiresAt, now),
        isNull(extClinicianConfirmations.deletedAt),
      ),
    )
    .returning();

  if (consumed) {
    return consumed;
  }

  // Diagnostic query to return the exact failure reason
  const [existing] = await tx
    .select()
    .from(extClinicianConfirmations)
    .where(
      and(
        eq(extClinicianConfirmations.id, input.confirmationId),
        isNull(extClinicianConfirmations.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ClinicianConfirmationError(
      "NOT_FOUND",
      "Confirmation token not found.",
    );
  }
  if (existing.practiceId !== input.practiceId) {
    throw new ClinicianConfirmationError(
      "PRACTICE_MISMATCH",
      "Cross-tenant confirmation access denied.",
    );
  }
  if (existing.actorId !== input.actorId) {
    throw new ClinicianConfirmationError(
      "ACTOR_MISMATCH",
      "Confirmation token was issued to a different clinician.",
    );
  }
  if (existing.actorRole !== input.actorRole) {
    throw new ClinicianConfirmationError(
      "ROLE_MISMATCH",
      "Clinician role does not match confirmation envelope.",
    );
  }
  if (existing.actionType !== input.actionType) {
    throw new ClinicianConfirmationError(
      "ACTION_MISMATCH",
      `Confirmation token bound to action "${existing.actionType}", not "${input.actionType}".`,
    );
  }
  if (
    existing.entityType !== input.entityType ||
    existing.entityId !== input.entityId
  ) {
    throw new ClinicianConfirmationError(
      "ENTITY_MISMATCH",
      "Confirmation token is bound to a different clinical entity.",
    );
  }
  if (existing.expectedRevision !== input.expectedRevision) {
    throw new ClinicianConfirmationError(
      "REVISION_MISMATCH",
      `Draft revision (${input.expectedRevision}) does not match confirmed revision (${existing.expectedRevision}).`,
    );
  }
  if (existing.originalDraftHash !== input.originalDraftHash) {
    throw new ClinicianConfirmationError(
      "DRAFT_MISMATCH",
      "Original AI draft content hash mismatch.",
    );
  }
  if (existing.confirmedContentHash !== input.confirmedContentHash) {
    throw new ClinicianConfirmationError(
      "PAYLOAD_MISMATCH",
      "Final clinical content has been modified since confirmation was issued.",
    );
  }
  if (existing.status === "CONSUMED") {
    throw new ClinicianConfirmationError(
      "ALREADY_CONSUMED",
      "Confirmation token has already been consumed (replay attempt rejected).",
    );
  }
  if (existing.expiresAt <= now) {
    throw new ClinicianConfirmationError(
      "EXPIRED",
      "Confirmation token has expired. Clinician review must be renewed.",
    );
  }

  throw new ClinicianConfirmationError(
    "INVALID",
    "Confirmation token validation failed.",
  );
}

/**
 * RESTRICTED — transitional direct confirmation (Option 2).
 *
 * Creates and atomically consumes an inline confirmation envelope inside a
 * single transaction. This MUST NOT be used by standard browser/API finalize
 * paths: those require a pre-issued one-time envelope consumed via
 * `consumeClinicianConfirmation()` (Option 1).
 *
 * The single approved caller is the create-only external AI-scribe hook
 * (`ai.createSoapFromAI`), which has no pre-existing draft entity to bind a
 * pre-issued envelope to. It MUST pass a distinct `correlationId`
 * (`direct:<caller>`) so direct confirmations are auditable, and it MUST rely
 * on lifecycle-level guards (CONFLICT on duplicate) for whole-request replay
 * protection. See docs/confirmation-protocol.md for the deprecation plan.
 */
export async function assertAndConsumeDirectConfirmation(
  tx: Database,
  input: DirectConfirmationInput,
) {
  assertAgentRole(
    { userRole: input.actorRole },
    ["admin", "veterinarian"],
    "Only authorized clinicians may confirm AI-derived clinical content.",
  );

  const now = new Date();
  const [consumed] = await tx
    .insert(extClinicianConfirmations)
    .values({
      practiceId: input.practiceId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      expectedRevision: input.expectedRevision,
      originalDraftHash: input.originalDraftHash,
      confirmedContentHash: input.confirmedContentHash,
      status: "CONSUMED",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + DEFAULT_TTL_SECONDS * 1000),
      consumedAt: now,
      consumedBy: input.actorId,
      correlationId: input.correlationId ?? null,
    })
    .returning();

  return consumed!;
}
