import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { patients } from "@openpims/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { withErrorHandling, notFound } from "@/lib/compat/shared/errors";
import { toApiPatient } from "@/lib/compat/openvpm";

export const dynamic = "force-dynamic";

// GET /api/v1/patients/:id — fetch a single patient scoped to the practice.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiKey(req, "patients:read");
  if (!auth.ok) return auth.response;

  return withErrorHandling(async () => {
    const [row] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, params.id),
          eq(patients.practiceId, auth.ctx.practiceId),
          isNull(patients.deletedAt)
        )
      )
      .limit(1);

    if (!row) return notFound("Patient");
    return NextResponse.json({ data: toApiPatient(row) });
  });
}
