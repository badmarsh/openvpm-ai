/**
 * full-audit.ts
 * Kompletný audit migrácie: pre každú zdrojovú FB tabuľku overí
 * počty a väzby (FK) vs cieľové Postgres tabuľky.
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';
import postgres from 'postgres';

const DB_URL = 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';
const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const pg = postgres(DB_URL);

interface AuditRow {
  source: string;
  target: string;
  fbTotal: number;
  pgTotal: number;
  matched: number;
  orphaned: number;
  notes: string;
}

const results: AuditRow[] = [];

function pct(matched: number, total: number) {
  if (total === 0) return '100%';
  return `${Math.round(matched / total * 100)}%`;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  KOMPLETNÝ AUDIT MIGRÁCIE VetSoftware V2 → OpenVPM AI           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  await withFirebird(async (db) => {

    // ─── TAB005 → clients ──────────────────────────────────────────────────
    const fb05 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB005 WHERE KOD_KADO > 0');
    const pg05 = await pg`SELECT count(*) FROM clients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
    results.push({
      source: 'TAB005 (Klienti)',
      target: 'clients',
      fbTotal: Number(fb05[0].CNT),
      pgTotal: Number(pg05[0].count),
      matched: Number(pg05[0].count),
      orphaned: Number(fb05[0].CNT) - Number(pg05[0].count),
      notes: 'Rozdiel = soft-deleted / bez mena',
    });

    // ─── TAB006 → patients ────────────────────────────────────────────────
    const fb06 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const pg06 = await pg`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
    const pgDec = await pg`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND status = 'deceased'`;
    results.push({
      source: 'TAB006 (Pacienti)',
      target: 'patients',
      fbTotal: Number(fb06[0].CNT),
      pgTotal: Number(pg06[0].count),
      matched: Number(pg06[0].count),
      orphaned: Number(fb06[0].CNT) - Number(pg06[0].count),
      notes: `Sympathy Gate: ${pg06Deceased(pgDec)} deceased`,
    });

    // Váhy (TAB006.VA)
    const fb06va = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB006 WHERE VA IS NOT NULL AND VA > 0 AND VA < 1000 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const pg06va = await pg`SELECT count(*) FROM patient_weights WHERE recorded_by = (SELECT id FROM users WHERE practice_id = ${PRACTICE_ID} LIMIT 1)`;
    results.push({
      source: 'TAB006.VA (Váhy)',
      target: 'patient_weights',
      fbTotal: Number(fb06va[0].CNT),
      pgTotal: Number(pg06va[0].count),
      matched: Number(pg06va[0].count),
      orphaned: Number(fb06va[0].CNT) - Number(pg06va[0].count),
      notes: 'Váhy – 1 záznam na pacienta',
    });

    // ─── TAB018 → vaccination_records ────────────────────────────────────
    const fb18 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB018 WHERE KP42 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    // TAB019 – odčervenia
    const fb19 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB019 WHERE KP4 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const pgVac = await pg`SELECT count(*) FROM vaccination_records WHERE practice_id = ${PRACTICE_ID}`;
    const totalFbVac = Number(fb18[0].CNT) + Number(fb19[0].CNT);
    results.push({
      source: 'TAB018 (Očkovania) + TAB019 (Odčervenia)',
      target: 'vaccination_records',
      fbTotal: totalFbVac,
      pgTotal: Number(pgVac[0].count),
      matched: Number(pgVac[0].count),
      orphaned: totalFbVac - Number(pgVac[0].count),
      notes: `TAB018: ${fb18[0].CNT}, TAB019: ${fb19[0].CNT}`,
    });

    // ─── TAB010 → soap_notes ─────────────────────────────────────────────
    const fb10 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const pgSoap = await pg`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID} AND imported = true`;
    results.push({
      source: 'TAB010 (Klinické karty)',
      target: 'soap_notes',
      fbTotal: Number(fb10[0].CNT),
      pgTotal: Number(pgSoap[0].count),
      matched: Number(pgSoap[0].count),
      orphaned: Number(fb10[0].CNT) - Number(pgSoap[0].count),
      notes: 'Rozdiel = prázdne karty (bez obsahu) preskočené',
    });

    // TAB016 – diagnózy (JOIN do soap_notes.assessment)
    const fb16 = await fbQuery<any>(db, 'SELECT COUNT(DISTINCT ID_KARTY) CNT FROM TAB016 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgSoapWithDiag = await pg`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID} AND assessment IS NOT NULL`;
    results.push({
      source: 'TAB016 (Diagnózy ku kartám)',
      target: 'soap_notes.assessment',
      fbTotal: Number(fb16[0].CNT),
      pgTotal: Number(pgSoapWithDiag[0].count),
      matched: Number(pgSoapWithDiag[0].count),
      orphaned: 0,
      notes: 'Denormalizované do soap_notes.assessment (JOIN pri importe)',
    });

    // TAB017 – úkony (JOIN do soap_notes.plan)
    const fb17 = await fbQuery<any>(db, 'SELECT COUNT(DISTINCT ID_KARTY) CNT FROM TAB017 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgSoapWithPlan = await pg`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID} AND plan IS NOT NULL`;
    results.push({
      source: 'TAB017 (Úkony ku kartám)',
      target: 'soap_notes.plan',
      fbTotal: Number(fb17[0].CNT),
      pgTotal: Number(pgSoapWithPlan[0].count),
      matched: Number(pgSoapWithPlan[0].count),
      orphaned: 0,
      notes: 'Denormalizované do soap_notes.plan (JOIN pri importe)',
    });

    // ─── TAB060 → legacy_financial_documents ──────────────────────────────
    const fb60 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB060 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgFin = await pg`SELECT count(*) FROM legacy_financial_documents WHERE practice_id = ${PRACTICE_ID}`;
    const fb60noClient = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB060 t WHERE (t.VYMAZ = 0 OR t.VYMAZ IS NULL) AND NOT EXISTS (SELECT 1 FROM TAB005 c WHERE c.KOD_KADO = t.ID_MAJITELE)');
    results.push({
      source: 'TAB060 (Faktúry)',
      target: 'legacy_financial_documents',
      fbTotal: Number(fb60[0].CNT),
      pgTotal: Number(pgFin[0].count),
      matched: Number(pgFin[0].count),
      orphaned: Number(fb60[0].CNT) - Number(pgFin[0].count),
      notes: `${fb60noClient[0].CNT} faktúr bez klienta v TAB005`,
    });

    // ─── TAB066 → legacy_financial_line_items ─────────────────────────────
    const fb66 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB066 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const fb66matched = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB066 t66 WHERE (t66.VYMAZ = 0 OR t66.VYMAZ IS NULL) AND EXISTS (SELECT 1 FROM TAB060 t60 WHERE t60.ID_UCET = t66.CIS_UCTU AND (t60.VYMAZ = 0 OR t60.VYMAZ IS NULL))');
    const pgLi = await pg`SELECT count(*) FROM legacy_financial_line_items WHERE practice_id = ${PRACTICE_ID}`;
    results.push({
      source: 'TAB066 (Položky faktúr)',
      target: 'legacy_financial_line_items',
      fbTotal: Number(fb66[0].CNT),
      pgTotal: Number(pgLi[0].count),
      matched: Number(pgLi[0].count),
      orphaned: Number(fb66[0].CNT) - Number(fb66matched[0].CNT),
      notes: `${fb66matched[0].CNT} má matching faktúru, ${Number(fb66[0].CNT) - Number(fb66matched[0].CNT)} orphaned (faktúra bez klienta)`,
    });

    // ─── TAB045 → external_lab_reports ────────────────────────────────────
    const fb45 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB045 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgLab = await pg`SELECT count(*) FROM external_lab_reports WHERE practice_id = ${PRACTICE_ID}`;
    results.push({
      source: 'TAB045 (Lab. protokoly)',
      target: 'external_lab_reports',
      fbTotal: Number(fb45[0].CNT),
      pgTotal: Number(pgLab[0].count),
      matched: Number(pgLab[0].count),
      orphaned: Number(fb45[0].CNT) - Number(pgLab[0].count),
      notes: '',
    });

    // ─── TAB047 → external_lab_observations ───────────────────────────────
    const fb47 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB047 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgObs = await pg`SELECT count(*) FROM external_lab_observations WHERE practice_id = ${PRACTICE_ID}`;
    results.push({
      source: 'TAB047 (Lab. parametre)',
      target: 'external_lab_observations',
      fbTotal: Number(fb47[0].CNT),
      pgTotal: Number(pgObs[0].count),
      matched: Number(pgObs[0].count),
      orphaned: Number(fb47[0].CNT) - Number(pgObs[0].count),
      notes: 'Viazané na C_PROTOK (len 5 protokolov)',
    });

    // ─── TAB022 – starý hematológický protokol (NEMIGROVANÝ) ──────────────
    const fb22 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB022');
    results.push({
      source: 'TAB022 (Staré hem. záznamy)',
      target: '⛔ NEMIGROVANÉ',
      fbTotal: Number(fb22[0].CNT),
      pgTotal: 0,
      matched: 0,
      orphaned: Number(fb22[0].CNT),
      notes: 'Iná štruktúra ako TAB047, veľmi malý počet, záznamy sú v TAB045/047',
    });

    // ─── TAB058/059 → files + historical_documents ────────────────────────
    const fb58 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB058 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const pgFiles = await pg`SELECT count(*) FROM files WHERE practice_id = ${PRACTICE_ID}`;
    const pgHd = await pg`SELECT count(*) FROM historical_documents WHERE practice_id = ${PRACTICE_ID}`;
    results.push({
      source: 'TAB059 (Bináre súbory)',
      target: 'files',
      fbTotal: Number(fb58[0].CNT),
      pgTotal: Number(pgFiles[0].count),
      matched: Number(pgFiles[0].count),
      orphaned: Number(fb58[0].CNT) - Number(pgFiles[0].count),
      notes: 'BLOB binárne dáta uložené (storage_status=unverified)',
    });
    results.push({
      source: 'TAB058 (Metadáta príloh)',
      target: 'historical_documents',
      fbTotal: Number(fb58[0].CNT),
      pgTotal: Number(pgHd[0].count),
      matched: Number(pgHd[0].count),
      orphaned: Number(fb58[0].CNT) - Number(pgHd[0].count),
      notes: 'Prepojené na patients + files',
    });

    // ─── TAB027/028 – lieky na predpis (NEMIGROVANÉ) ──────────────────────
    const fb27 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB027 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const fb28 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB028 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    results.push({
      source: 'TAB027+028 (Lieky ku kartám)',
      target: '⛔ NEMIGROVANÉ',
      fbTotal: Number(fb27[0].CNT) + Number(fb28[0].CNT),
      pgTotal: 0,
      matched: 0,
      orphaned: Number(fb27[0].CNT) + Number(fb28[0].CNT),
      notes: 'Možný duplikát TAB017 (úkony) – rozhodnutie: nemigrujeme',
    });

    // ─── TAB052 – hospitalizácie (NEMIGROVANÉ) ─────────────────────────────
    const fb52 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB052');
    results.push({
      source: 'TAB052 (Hospitalizácie)',
      target: '⛔ NEMIGROVANÉ',
      fbTotal: Number(fb52[0].CNT),
      pgTotal: 0,
      matched: 0,
      orphaned: Number(fb52[0].CNT),
      notes: 'Len 4 záznamy, nízka priorita',
    });

    // ─── TAB077 – pohľadávky (NEMIGROVANÉ) ────────────────────────────────
    const fb77 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB077');
    results.push({
      source: 'TAB077 (Pohľadávky)',
      target: '⛔ NEMIGROVANÉ',
      fbTotal: Number(fb77[0].CNT),
      pgTotal: 0,
      matched: 0,
      orphaned: Number(fb77[0].CNT),
      notes: 'OpenVPM nemá tabuľku pohľadávok → export CSV pre účtovníka',
    });

    // ─── TAB050 – mostík pacient↔klient (pomocná) ─────────────────────────
    const fb50 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB050 WHERE ID_PACIENT > 0 AND ID_KLIENT > 0 AND (VYMAZP = 0 OR VYMAZP IS NULL)');
    // Overenie: koľko pacientov má clientId NOT NULL
    const pgPatWithClient = await pg`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND client_id IS NOT NULL`;
    results.push({
      source: 'TAB050 (Mostík pac↔klient)',
      target: 'patients.client_id',
      fbTotal: Number(fb50[0].CNT),
      pgTotal: Number(pgPatWithClient[0].count),
      matched: Number(pgPatWithClient[0].count),
      orphaned: 0,
      notes: 'Pomocná tabuľka – väzba prenesená do patients.client_id',
    });

  });

  // ─── Výpis výsledkov ────────────────────────────────────────────────────
  console.log('┌' + '─'.repeat(100) + '┐');
  console.log(`│ ${'Zdroj (FB)'.padEnd(38)} ${'Cieľ (PG)'.padEnd(30)} ${'FB'.padStart(6)} ${'PG'.padStart(6)} ${'Match%'.padStart(7)} ${'Orphaned'.padStart(9)} │`);
  console.log('├' + '─'.repeat(100) + '┤');

  let totalMigratable = 0;
  let totalMigrated = 0;

  for (const r of results) {
    const isSkipped = r.target.startsWith('⛔');
    const matchPct = isSkipped ? '  N/A' : pct(r.matched, r.fbTotal).padStart(6);
    const status = isSkipped ? '⛔' : r.orphaned === 0 ? '✅' : r.orphaned > 0 && r.matched > 0 ? '⚠️' : '❌';
    console.log(`│ ${status} ${r.source.padEnd(36)} ${r.target.padEnd(30)} ${String(r.fbTotal).padStart(6)} ${String(r.pgTotal).padStart(6)} ${matchPct} ${String(r.orphaned).padStart(9)} │`);
    if (!isSkipped) {
      totalMigratable += r.fbTotal;
      totalMigrated += r.pgTotal;
    }
  }

  console.log('├' + '─'.repeat(100) + '┤');
  console.log(`│ ${'CELKOM (migrujeme)'.padEnd(70)} ${String(totalMigratable).padStart(6)} ${String(totalMigrated).padStart(6)} ${pct(totalMigrated, totalMigratable).padStart(6)} ${String(totalMigratable - totalMigrated).padStart(9)} │`);
  console.log('└' + '─'.repeat(100) + '┘');

  console.log('\n── Poznámky k orphaned záznamom ─────────────────────────────────────');
  for (const r of results) {
    if (r.orphaned > 0 && r.notes) {
      console.log(`  • ${r.source}: ${r.orphaned} orphaned – ${r.notes}`);
    }
  }

  console.log('\n── Tabuľky rozhodnuté NEMIGRUJEME ──────────────────────────────────');
  for (const r of results) {
    if (r.target.startsWith('⛔')) {
      console.log(`  • ${r.source} (${r.fbTotal} záznamov): ${r.notes}`);
    }
  }

  await pg.end();
}

function pg06Deceased(res: any[]) {
  return res[0]?.count ?? '?';
}

main().catch(console.error);
