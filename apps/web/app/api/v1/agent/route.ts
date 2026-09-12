import { z } from "zod";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import type { Database } from "@openpims/db/client";
import { users } from "@openpims/db";
import { authenticateApiKey, hasScope } from "@/lib/api-auth";
import { withTenant } from "@/lib/tenant-db";
import {
  withErrorHandling,
  apiError,
  validationError,
} from "@/lib/compat/shared/errors";
import {
  AgentNotConfiguredError,
  AgentBillingAccessError,
  AgentPracticeNotFoundError,
  AgentRateLimitedError,
  AgentRecoveryHoldError,
  runAgent,
} from "@/lib/agent";
import { AGENT_INSTRUCTION_MAX_LENGTH } from "@/lib/agent/policy";
import { readJsonRequestBody } from "@/lib/request-json";
import { assertActivePractice } from "@/lib/compat/shared/active-practice";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  instruction: z.string().trim().min(1).max(AGENT_INSTRUCTION_MAX_LENGTH),
  allow_writes: z.boolean().optional().default(false),
  // Optional human actor for an API-key driven run. Role-gated agent tools
  // (prescriptions, controlled substances, drug safety) are fail-closed and
  // require a real practice user's role — API keys themselves carry no role.
  // Write tools that attribute a human (prescribed_by UUID FK) additionally
  // need this, since "apikey:<id>" is not a valid users.id UUID.
  veterinarian_user_id: z.string().uuid().optional(),
});

/** Roles permitted to act as the signing clinician for API agent runs. */
const ACTOR_ROLES = ["veterinarian", "admin"] as const;

async function resolveActorUser(
  tx: Database,
  practiceId: string,
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.practiceId, practiceId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return (row as { id: string; role: string } | undefined) ?? null;
}

function agentRateLimitHeaders(error: AgentRateLimitedError): HeadersInit {
  return {
    "Retry-After": String(error.retryAfterSeconds),
    "X-RateLimit-Limit": String(error.limit),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": error.resetAt.toISOString(),
  };
}

// POST /api/v1/agent — run the OpenVPM Agent over the API, scoped to the key's
// practice. This is what lets external automations (and an agent-led ops layer)
// drive the practice through one natural-language endpoint.
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "agent:run");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    const body = await readJsonRequestBody(req);
    if (!body.ok) {
      if (body.reason === "too_large") {
        return apiError("Request body too large", 413);
      }
      return apiError("Request body must be valid JSON", 400);
    }

    const parsed = BodySchema.safeParse(body.data);
    if (!parsed.success) return validationError(parsed.error);

    if (parsed.data.allow_writes && !hasScope(auth.ctx.scopes, "agent:write")) {
      return apiError("API key missing required scope: agent:write", 403);
    }

    try {
      const postCommitEffects: Array<(rootDb: typeof db) => Promise<void>> = [];
      const result = await withTenant(db, auth.ctx.practiceId, async (tx) => {
        const activePractice = await assertActivePractice(
          tx,
          auth.ctx.practiceId,
        );
        if (!activePractice.ok) return activePractice.response;

        // Resolve the optional human actor. API keys carry no role, so without
        // this the fail-closed assertAgentRole() tool checks deny every
        // role-gated tool; without a real user UUID the prescription insert
        // also crashes on the prescribed_by UUID foreign key.
        let actor: { id: string; role: string } | null = null;
        if (parsed.data.veterinarian_user_id) {
          actor = await resolveActorUser(
            tx,
            auth.ctx.practiceId,
            parsed.data.veterinarian_user_id,
          );
          if (!actor) {
            return apiError(
              "veterinarian_user_id does not match an active user in this practice",
              403,
            );
          }
          if (!ACTOR_ROLES.includes(actor.role as (typeof ACTOR_ROLES)[number])) {
            return apiError(
              "veterinarian_user_id must reference a veterinarian or administrator",
              403,
            );
          }
        }

        return runAgent({
          instruction: parsed.data.instruction,
          allowWrites: parsed.data.allow_writes,
          apiKeyScopes: auth.ctx.scopes,
          context: {
            db: tx,
            practiceId: auth.ctx.practiceId,
            // Human actor when supplied; otherwise identify the actor by key
            // and leave userRole undefined so role-gated tools fail closed.
            userId: actor ? actor.id : `apikey:${auth.ctx.apiKeyId}`,
            ...(actor ? { userRole: actor.role } : {}),
            postCommitEffect: (effect) => postCommitEffects.push(effect),
          },
        });
      });
      if (result instanceof NextResponse) return result;
      for (const effect of postCommitEffects) {
        try {
          await effect(db);
        } catch {
          console.error("[agent api] post-commit effect failed");
        }
      }
      return NextResponse.json({ data: result });
    } catch (e) {
      if (e instanceof AgentBillingAccessError) {
        return apiError(e.message, 403);
      }
      if (e instanceof AgentNotConfiguredError) {
        return apiError(e.message, 503);
      }
      if (e instanceof AgentRateLimitedError) {
        return NextResponse.json(
          { error: { message: e.message } },
          {
            status: 429,
            headers: agentRateLimitHeaders(e),
          },
        );
      }
      if (e instanceof AgentRecoveryHoldError) {
        return apiError(e.message, 503);
      }
      if (e instanceof AgentPracticeNotFoundError) {
        return apiError(e.message, 404);
      }
      throw e;
    }
  });
}
