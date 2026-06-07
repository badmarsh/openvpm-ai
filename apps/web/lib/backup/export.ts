import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { clients, patients, appointments, invoices, invoiceItems } from "@openpims/db";

/**
 * Full, owned export of a single practice's core data — used by the scheduled
 * backup cron (and reusable elsewhere). Always scoped by practiceId.
 */

/** Object-storage key for a practice's daily backup. Pure (testable). */
export function backupKey(practiceId: string, dateYmd: string): string {
  return `backups/${practiceId}/${dateYmd}.json`;
}

export interface PracticeExport {
  practiceId: string;
  exportedAt: string;
  counts: Record<string, number>;
  clients: unknown[];
  patients: unknown[];
  appointments: unknown[];
  invoices: unknown[];
  invoiceItems: unknown[];
}

export async function exportPracticeData(
  db: Database,
  practiceId: string,
  exportedAt: string
): Promise<PracticeExport> {
  const scope = (table: typeof clients | typeof patients | typeof appointments | typeof invoices) =>
    and(eq(table.practiceId, practiceId), isNull(table.deletedAt));

  const [clientRows, patientRows, appointmentRows, invoiceRows] = await Promise.all([
    db.select().from(clients).where(scope(clients)),
    db.select().from(patients).where(scope(patients)),
    db.select().from(appointments).where(scope(appointments)),
    db.select().from(invoices).where(scope(invoices)),
  ]);

  // Invoice items are scoped via their parent invoice (no practiceId column).
  const invoiceIds = invoiceRows.map((r) => r.id);
  const itemRows =
    invoiceIds.length > 0
      ? (await db.select().from(invoiceItems).where(isNull(invoiceItems.deletedAt))).filter((it) =>
          invoiceIds.includes(it.invoiceId)
        )
      : [];

  return {
    practiceId,
    exportedAt,
    counts: {
      clients: clientRows.length,
      patients: patientRows.length,
      appointments: appointmentRows.length,
      invoices: invoiceRows.length,
      invoiceItems: itemRows.length,
    },
    clients: clientRows,
    patients: patientRows,
    appointments: appointmentRows,
    invoices: invoiceRows,
    invoiceItems: itemRows,
  };
}
