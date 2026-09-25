/**
 * Sprint 27 — Schema Validation Middleware.
 *
 * tRPC middleware adapter. Compose it on a procedure that must honour a VPM
 * input contract:
 *
 * ```ts
 * protectedProcedure
 *   .use(requireRole("admin", "veterinarian"))
 *   .use(withSchemaValidation("openvpm.prescription-order"))
 *   .input(...)
 * ```
 *
 * The middleware validates the raw procedure input against the contract's
 * JSON schema plus clinical guardrails, persists a best-effort audit event
 * and rejects invalid input with `BAD_REQUEST` before the resolver runs.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { extSchemaValidationEvents } from "@openpims/db";
import type { TRPCContext } from "@/server/trpc";
import { isContractId } from "./registry";
import { summarizeOutcome, validateContract } from "./validator";
import type { SchemaContractId, ValidationOutcome } from "./types";

/**
 * Local tRPC instance used only to shape middleware objects. The context type
 * matches `@/server/trpc`, so the produced middlewares compose with the app's
 * procedure builders.
 */
const t = initTRPC.context<TRPCContext>().create();

/**
 * Persist a validation event for auditability. Best effort — an audit write
 * failure must never mask the validation verdict itself.
 */
async function recordValidationEvent(
  ctx: TRPCContext,
  outcome: ValidationOutcome,
  origin: "api" | "playground",
): Promise<void> {
  const practiceId = ctx.session?.user?.practiceId;
  if (!ctx.db || !practiceId) return;
  try {
    await ctx.db.insert(extSchemaValidationEvents).values({
      practiceId,
      contractId: outcome.contractId,
      schemaVersion: outcome.schemaVersion,
      result: outcome.result,
      issueCount: outcome.issues.length,
      guardrail:
        outcome.triggeredGuardrails.length > 0
          ? outcome.triggeredGuardrails.join(", ")
          : null,
      issues: outcome.issues.map(({ field, code }) => ({ field, code })),
      origin,
      actorUserId: ctx.session?.user?.id ?? null,
    });
  } catch {
    // Audit persistence is secondary to enforcement; never throw here.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extract the first raw input value from tRPC's `getRawInput()` result. */
function firstRawInput(rawInput: unknown): unknown {
  if (Array.isArray(rawInput)) return rawInput[0];
  return rawInput;
}

/**
 * Build a tRPC middleware enforcing one VPM input contract.
 * Throws `TRPCError(BAD_REQUEST)` with a compact summary when the payload
 * fails the schema or any clinical guardrail.
 */
export function withSchemaValidation(contractId: SchemaContractId) {
  if (!isContractId(contractId)) {
    throw new Error(`Unknown VPM schema contract: ${String(contractId)}`);
  }

  return t.middleware(async ({ ctx, next, getRawInput }) => {
    const rawInput = await getRawInput().catch(() => []);
    const payload = firstRawInput(rawInput);
    const outcome = validateContract(contractId, payload);

    await recordValidationEvent(ctx, outcome, "api");

    if (!outcome.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: summarizeOutcome(outcome),
      });
    }

    return next();
  });
}

/**
 * Build a tRPC middleware for envelope-shaped procedures whose raw input is
 * `{ contractId, payload }` (e.g. generic contract-ingestion endpoints).
 * The contract id is resolved from the input itself; when it is missing or
 * unknown the middleware defers to the procedure's own input parser.
 */
export function withSchemaValidationFromInput() {
  return t.middleware(async ({ ctx, next, getRawInput }) => {
    const rawInput = await getRawInput().catch(() => []);
    const envelope = firstRawInput(rawInput);

    if (!isRecord(envelope) || !isContractId(envelope.contractId)) {
      // Not our envelope shape — let zod/the resolver produce the verdict.
      return next();
    }

    const contractId = envelope.contractId;
    const payload = "payload" in envelope ? envelope.payload : envelope;
    const outcome = validateContract(contractId, payload);

    await recordValidationEvent(ctx, outcome, "api");

    if (!outcome.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: summarizeOutcome(outcome),
      });
    }

    return next();
  });
}
