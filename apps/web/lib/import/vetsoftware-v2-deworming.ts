/**
 * vetsoftware-v2-deworming.ts
 * Importuje odčervenia z TAB019 do vaccination_records s typom 'deworming'.
 * TAB019 má rovnakú štruktúru ako TAB018 (očkovania).
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import { vaccinationRecords, patients } from "@openpims/db";
import {
  fbQuery,
  decodeWin1250,
  readTextBlob,
  withFirebird,
} from "./vetsoftware-v2-extractor";
import { migrationImportFingerprint } from "./fingerprint";

export interface DewormingReport {
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Builds externalId → UUID patient map
 */
async function getPatientMap(
  db: PostgresJsDatabase<any>,
  practiceId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: patients.id, externalId: patients.externalId })
    .from(patients)
    .where(
      and(
        eq(patients.practiceId, practiceId),
        eq(patients.externalSource, "vetsoftware_v2"),
      ),
    );
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.externalId) map.set(r.externalId, r.id);
  }
  return map;
}

export async function runDewormingMigration(
  db: PostgresJsDatabase<any>,
  practiceId: string,
  adminUserId: string,
): Promise<DewormingReport> {
  const report: DewormingReport = { total: 0, inserted: 0, skipped: 0, errors: [] };

  const patientMap = await getPatientMap(db, practiceId);

  await withFirebird(async (fbDb) => {
    let rawRows: any[] = [];
    try {
      rawRows = await fbQuery(
        fbDb,
        // TAB019 real columns: ID_ZAZN, KP4=patientFK, DNE4=date, VAKCI=appliedDate,
        // P_ODCERV=nextDue, POZ4=notes BLOB, KDO=vet, TYP=type, ID_KLIENT=clientFK
        "SELECT ID_ZAZN, KP4, DNE4, VAKCI, P_ODCERV, POZ4, KDO, TYP FROM TAB019 WHERE KP4 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) ORDER BY ID_ZAZN",
      );
    } catch (err: any) {
      if (
        err.message?.includes("Table unknown") ||
        err.message?.includes("TAB019")
      ) {
        report.errors.push("TAB019 nie je dostupná – preskočená.");
        return;
      }
      throw err;
    }

    report.total = rawRows.length;

    const BATCH_SIZE = 200;
    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const chunk = rawRows.slice(i, i + BATCH_SIZE);
      const valuesToInsert: any[] = [];

      for (const r of chunk) {
        const extPatId = String(r.KP4);
        const patientId = patientMap.get(extPatId);
        if (!patientId) continue;

        const extId = `odcervenie_${String(r.ID_ZAZN)}`;
        // TAB019 has no LYSS field – use TYP lookup or generic name
        const vaccineName = "Odčervenie";

        const rawAdminDate = r.VAKCI || r.DNE4;
        const adminDate = rawAdminDate ? new Date(rawAdminDate) : new Date();

        let nextDue: string | null = null;
        if (r.P_ODCERV) {
          const nd = new Date(r.P_ODCERV);
          if (
            !isNaN(nd.getTime()) &&
            nd.getFullYear() > 2000 &&
            nd.getFullYear() < 2100
          ) {
            nextDue = nd.toISOString().slice(0, 10);
          }
        }

        const note = await readTextBlob(r.POZ4, 3000);

        valuesToInsert.push({
          practiceId,
          patientId,
          vaccineName: vaccineName.slice(0, 255),
          administeredAt: adminDate,
          nextDueDate: nextDue,
          lotNumber: note ? note.slice(0, 64) : null,
          administeredBy: adminUserId,
          importFingerprint: migrationImportFingerprint("vaccinations", [
            practiceId,
            "vetsoftware_v2",
            extId,
          ]),
        });
      }

      if (valuesToInsert.length > 0) {
        try {
          const inserted = await db
            .insert(vaccinationRecords)
            .values(valuesToInsert)
            .onConflictDoNothing({
              target: [vaccinationRecords.practiceId, vaccinationRecords.importFingerprint],
              where: sql`import_fingerprint is not null and deleted_at is null`,
            })
            .returning({ id: vaccinationRecords.id });

          report.inserted += inserted.length;
          report.skipped += valuesToInsert.length - inserted.length;
        } catch (chunkErr: any) {
          report.errors.push(
            `Chyba dávka odčervení (${i}-${i + chunk.length}): ${chunkErr.cause?.message || chunkErr.message}`,
          );
        }
      }
    }
  });

  return report;
}
