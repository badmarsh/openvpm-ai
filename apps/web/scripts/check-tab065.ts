import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';
import postgres from 'postgres';

const DB_URL = 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';
const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const client = postgres(DB_URL);

async function main() {
  await withFirebird(async (db) => {
    // Check TAB065
    const total = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB065 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log('TAB065 total valid purchase invoices:', total[0].CNT);

    // Sample TAB065
    const sample = await fbQuery<any>(db, 'SELECT FIRST 5 ID_UCET, DAT_VYSTAV, CAS_VYSTAV, CELSDPH, ID_FIRMY, CIS_DOK FROM TAB065 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log('TAB065 sample:', sample);

    // Check how many have matching supplier in TAB064
    const withSupplier = await fbQuery<any>(db, `
      SELECT t65.ID_FIRMY, t64.NAZEV_FIRMY, COUNT(*) CNT, SUM(t65.CELSDPH) SUM_EUR
      FROM TAB065 t65
      LEFT JOIN TAB064 t64 ON t64.KOD_FIRMY = t65.ID_FIRMY
      WHERE (t65.VYMAZ = 0 OR t65.VYMAZ IS NULL)
      GROUP BY t65.ID_FIRMY, t64.NAZEV_FIRMY
      ORDER BY 3 DESC
    `);
    console.log('\nBreakdown by supplier:');
    for (const s of withSupplier) {
      console.log(`  Firma ID ${s.ID_FIRMY} (${decodeWin1250(s.NAZEV_FIRMY || 'Neznámy')}): ${s.CNT} faktúr, spolu: ${Number(s.SUM_EUR || 0).toFixed(2)} €`);
    }
  });
  await client.end();
}

main().catch(console.error);
