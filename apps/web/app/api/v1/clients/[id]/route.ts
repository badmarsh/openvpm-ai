import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { clients } from "@openpims/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { withErrorHandling, notFound } from "@/lib/compat/shared/errors";
import { toApiClient } from "@/lib/compat/openvpm";

export const dynamic = "force-dynamic";

// GET /api/v1/clients/:id — fetch a single client scoped to the practice.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiKey(req, "clients:read");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    const [row] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, params.id),
          eq(clients.practiceId, auth.ctx.practiceId),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);

    if (!row) return notFound("Client");
    return NextResponse.json({ data: toApiClient(row) });
  });
}
