import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { apiKeys } from "@openpims/db";
import { rateLimit } from "@/lib/rate-limit";

/** Public prefix for every issued key. Also used as the human-visible label. */
export const API_KEY_PREFIX = "ovpm_";
/** Length of the stored, indexed lookup prefix (e.g. "ovpm_AbC1234"). */
const LOOKUP_PREFIX_LEN = 12;
/** Per-key request budget. In-memory + per-instance — see docs/api/README.md. */
const RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60_000;

export interface ApiKeyContext {
  practiceId: string;
  apiKeyId: string;
  scopes: string[];
}

export type AuthResult =
  | { ok: true; ctx: ApiKeyContext }
  | { ok: false; response: NextResponse };

/**
 * Generate a new API key. Returns the raw key (shown to the user exactly once),
 * the indexed lookup prefix, and the bcrypt hash to persist. The raw key is
 * never stored.
 */
export async function generateApiKey(): Promise<{
  raw: string;
  prefix: string;
  hash: string;
}> {
  const raw = API_KEY_PREFIX + randomBytes(24).toString("base64url");
  const prefix = raw.slice(0, LOOKUP_PREFIX_LEN);
  const hash = await bcrypt.hash(raw, 10);
  return { raw, prefix, hash };
}

/** Extract the raw key from `Authorization: Bearer` (preferred) or `X-API-Key`. */
export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const headerKey = headers.get("x-api-key");
  if (headerKey) return headerKey.trim();
  return null;
}

/** `*` grants everything; otherwise the exact scope must be present. */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes("*") || scopes.includes(required);
}

function err(message: string, status: number): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json({ error: { message } }, { status }),
  };
}

/**
 * Authenticate a request via API key and assert it carries `requiredScope`.
 *
 * Flow: parse header → narrow candidates by indexed prefix → constant-time
 * bcrypt compare → enforce per-key rate limit → return tenant context. The
 * caller MUST still scope every query by `ctx.practiceId`.
 */
export async function authenticateApiKey(
  req: Request,
  requiredScope: string
): Promise<AuthResult> {
  const raw = extractApiKey(req.headers);
  if (!raw) {
    return err("Missing API key. Send 'Authorization: Bearer <key>' or 'X-API-Key'.", 401);
  }

  const prefix = raw.slice(0, LOOKUP_PREFIX_LEN);

  let candidates;
  try {
    candidates = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.deletedAt)));
  } catch (e) {
    console.error("[api-auth] key lookup failed:", e);
    return err("Internal error", 500);
  }

  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if (await bcrypt.compare(raw, candidate.keyHash)) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    return err("Invalid API key.", 401);
  }

  const scopes = Array.isArray(matched.scopes) ? (matched.scopes as string[]) : [];
  if (!hasScope(scopes, requiredScope)) {
    return err(`API key missing required scope: ${requiredScope}`, 403);
  }

  const { success, remaining } = rateLimit({
    key: `apikey:${matched.id}`,
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { message: "Rate limit exceeded." } },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  // Audit trail — non-blocking, never fail the request on this.
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, matched.id))
    .catch((e) => console.error("[api-auth] lastUsedAt update failed:", e));

  return {
    ok: true,
    ctx: { practiceId: matched.practiceId, apiKeyId: matched.id, scopes },
  };
}

/** Scopes a practice admin can grant to an API key. */
export const API_SCOPES = [
  "clients:read",
  "patients:read",
  "appointments:read",
  "appointments:write",
  "agent:run",
  "*",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
