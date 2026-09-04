/**
 * finish-migration.ts
 * Idempotentný runner – spúšťa iba ešte nemigrované fázy.
 * Bezpečné spustiť viackrát (onConflictDoNothing všade).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@openpims/db';
import { runFullV2Migration } from '../lib/import/vetsoftware-v2-pipeline';
import { runDewormingMigration } from '../lib/import/vetsoftware-v2-deworming';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const USER_ID     = 'b1963bb2-ef34-470e-ab2d-a22a250984bb';
const DB_URL      = process.env.DATABASE_URL ?? 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  FINISH-MIGRATION – Kompletná migrácia VetSoftware V2      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const report = await runFullV2Migration(db, PRACTICE_ID, USER_ID, {
    importClients:         false,  // ✅ 2 102 klientov
    importPatients:        false,  // ✅ 2 819 pacientov
    importWeights:         false,  // ✅ váhy
    importVaccinations:    false,  // ✅ 1 325 očkovaní
    importSoapNotes:       false,  // ✅ 6 605 SOAP kariet
    importFinancials:      false,  // ✅ 10 492 faktúr + 1 151 line items
    importLabReports:      false,  // ✅ 5 lab správ + 9 parametrov
    importAttachments:     false,  // ✅ 47 súborov + 47 historical_docs
    importPrescriptions:   true,   // ❌ TAB027/028 → external_prescriptions
    importHospitalizations: true,  // ❌ TAB052 → historical_appointments
    importReceivables:     true,   // ❌ TAB077 → legacy_financial_payments
  });

  console.log('\n=== REPORT ===');
  console.log('Success:           ', report.success);
  console.log('Duration:          ', report.durationMs, 'ms');
  console.log('Prescriptions:     ', report.prescriptions);
  console.log('Hospitalizations:  ', report.hospitalizations);
  console.log('Receivables:       ', report.receivables);
  if (report.errors.length > 0) {
    console.error('\n⚠️  CHYBY:');
    report.errors.forEach(e => console.error(' •', e));
  }

  // Odčervenia – idempotentné (skipped=47 je OK)
  console.log('\n── Odčervenia (TAB019) ──────────────────────────────────────');
  const dewReport = await runDewormingMigration(db, PRACTICE_ID, USER_ID);
  console.log('Deworming inserted:', dewReport.inserted, '/ skipped:', dewReport.skipped);

  // Finálne počty všetkých tabuliek
  const counts = await client`
    SELECT
      (SELECT count(*) FROM clients                     WHERE practice_id = ${PRACTICE_ID})::int AS clients,
      (SELECT count(*) FROM patients                    WHERE practice_id = ${PRACTICE_ID})::int AS patients,
      (SELECT count(*) FROM vaccination_records         WHERE practice_id = ${PRACTICE_ID})::int AS vaccinations,
      (SELECT count(*) FROM soap_notes                  WHERE practice_id = ${PRACTICE_ID} AND imported = true)::int AS soap_notes,
      (SELECT count(*) FROM legacy_financial_documents  WHERE practice_id = ${PRACTICE_ID})::int AS invoices,
      (SELECT count(*) FROM legacy_financial_line_items WHERE practice_id = ${PRACTICE_ID})::int AS line_items,
      (SELECT count(*) FROM legacy_financial_payments   WHERE practice_id = ${PRACTICE_ID})::int AS payments,
      (SELECT count(*) FROM legacy_financial_allocations WHERE practice_id = ${PRACTICE_ID})::int AS allocations,
      (SELECT count(*) FROM external_lab_reports        WHERE practice_id = ${PRACTICE_ID})::int AS lab_reports,
      (SELECT count(*) FROM external_lab_observations   WHERE practice_id = ${PRACTICE_ID})::int AS lab_obs,
      (SELECT count(*) FROM external_prescriptions      WHERE practice_id = ${PRACTICE_ID})::int AS prescriptions,
      (SELECT count(*) FROM historical_appointments     WHERE practice_id = ${PRACTICE_ID})::int AS hospitalizations,
      (SELECT count(*) FROM files                       WHERE practice_id = ${PRACTICE_ID})::int AS files,
      (SELECT count(*) FROM historical_documents        WHERE practice_id = ${PRACTICE_ID})::int AS hist_docs
  `;

  const c = counts[0];
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FINÁLNY STAV DATABÁZY                                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Klienti:                      ${String(c.clients).padStart(5)}                        ║`);
  console.log(`║  Pacienti:                     ${String(c.patients).padStart(5)}                        ║`);
  console.log(`║  Očkovania + odčervenia:       ${String(c.vaccinations).padStart(5)}                        ║`);
  console.log(`║  SOAP karty:                   ${String(c.soap_notes).padStart(5)}                        ║`);
  console.log(`║  Faktúry:                      ${String(c.invoices).padStart(5)}                        ║`);
  console.log(`║  Položky faktúr:               ${String(c.line_items).padStart(5)}                        ║`);
  console.log(`║  Platby (pohľadávky):          ${String(c.payments).padStart(5)} / 102              ║`);
  console.log(`║  Alokácie platieb:             ${String(c.allocations).padStart(5)}                        ║`);
  console.log(`║  Lab správy:                   ${String(c.lab_reports).padStart(5)} / 5                ║`);
  console.log(`║  Lab parametre:                ${String(c.lab_obs).padStart(5)} / 9                ║`);
  console.log(`║  Predpisy (lieky):             ${String(c.prescriptions).padStart(5)} / ~3 893          ║`);
  console.log(`║  Hospitalizácie:               ${String(c.hospitalizations).padStart(5)} / 4                ║`);
  console.log(`║  Súbory (RTG):                 ${String(c.files).padStart(5)} / 47               ║`);
  console.log(`║  Historické dokumenty:         ${String(c.hist_docs).padStart(5)} / 47               ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await client.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
