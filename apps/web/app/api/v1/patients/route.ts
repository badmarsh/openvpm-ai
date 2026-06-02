import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { patients } from "@openpims/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { withErrorHandling } from "@/lib/compat/shared/errors";
import { parsePagination, paginated } from "@/lib/compat/shared/pagination";
import { toApiPatient } from "@/lib/compat/openvpm";

export const dynamic = "force-dynamic";

// GET /api/v1/patients — list patients, optionally filtered by ?client_id=.
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "patients:read");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePagination(searchParams);
    const clientId = searchParams.get("client_id");

    const conditions = [
      eq(patients.practiceId, auth.ctx.practiceId),
      isNull(patients.deletedAt),
    ];
    if (clientId) conditions.push(eq(patients.clientId, clientId));
    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(patients)
        .where(where)
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(patients).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return NextResponse.json(
      paginated(rows.map(toApiPatient), { limit, offset }, total)
    );
  });
}
