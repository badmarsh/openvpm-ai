import { randomBytes, createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { authTokens } from "@openpims/db";
import { withSystem } from "@/lib/tenant-db";

export type AuthTokenType = "email_verify" | "password_reset";

const TTL_MS: Record<AuthTokenType, number> = {
  email_verify: 24 * 60 * 60 * 1000, // 24h
  password_reset: 60 * 60 * 1000, // 1h
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use token. Returns the RAW token (emailed to the user); only
 * its hash is persisted. Pre-tenant flow → system context.
 */
export async function createAuthToken(opts: {
  userId: string;
  email: string;
  type: AuthTokenType;
  now?: Date;
}): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const now = opts.now ?? new Date();
  await withSystem(db, (tx) =>
    tx.insert(authTokens).values({
      userId: opts.userId,
      email: opts.email.toLowerCase(),
      tokenHash: hashToken(raw),
      type: opts.type,
      expiresAt: new Date(now.getTime() + TTL_MS[opts.type]),
    })
  );
  return raw;
}

/**
 * Validate + consume a token. Returns the matching record (userId/email) if it's
 * the right type, unused, and unexpired — and marks it used. Otherwise null.
 */
export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType,
  now: Date = new Date()
): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashToken(raw);
  return withSystem(db, async (tx) => {
    const [row] = await tx
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, type),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now)
        )
      )
      .limit(1);
    if (!row) return null;
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(eq(authTokens.id, row.id));
    return { userId: row.userId, email: row.email };
  });
}
