import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { patients } from "@openpims/db";
import type { Database } from "@openpims/db/client";

/**
 * Sympathy-flow safety gate (Skill §3 — Clinical & Safety Gates):
 * hard-blocks automated outreach (marketing posts, owner SMS, recall /
 * post-op check-ins) for a deceased / euthanized patient before any work is
 * performed. Single shared implementation used by the marketing and
 * discharge extension routers. When no patient is resolved the gate is a
 * no-op so free-form manual entries (no linked record) remain usable.
 *
 * Server error messages stay in English per Skill §2; all user-facing
 * localization happens on the client via useI18n().
 */
export async function assertPatientNotDeceased(
  db: Database,
  patientId: string | undefined,
): Promise<void> {
  if (!patientId) return;
  const [p] = await db
    .select({ status: patients.status })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (p?.status === "deceased") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Sympathy Gate: Blocked for deceased patient.",
    });
  }
}
