/**
 * scan-all-tables.ts
 * Skenuje VŠETKY TAB001–TAB083 a nájde, čo ešte nebolo spomínané
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

// Čo sme už migrovali alebo spomínali
const KNOWN = new Set([
  'TAB003','TAB004','TAB005','TAB006','TAB007','TAB008','TAB009',
  'TAB010','TAB016','TAB017','TAB018','TAB019','TAB022',
  'TAB023','TAB024','TAB025','TAB026','TAB027','TAB028','TAB029',
  'TAB030','TAB031','TAB033','TAB034','TAB036',
  'TAB040','TAB042','TAB043','TAB045','TAB047',
  'TAB050','TAB052','TAB058','TAB059','TAB060','TAB063','TAB066','TAB077',
]);

async function main() {
  await withFirebird(async (db) => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  KOMPLETNÝ SKEN VŠETKÝCH FB TABULIEK – NOVÉ NÁLEZY');
    console.log('═══════════════════════════════════════════════════════════\n');

    const newTables: Array<{ tbl: string; count: number; cols: string; sample: any }> = [];
    const emptyTables: string[] = [];

    for (let i = 1; i <= 83; i++) {
      const tbl = `TAB${String(i).padStart(3, '0')}`;
      try {
        const cnt = await fbQuery<any>(db, `SELECT COUNT(*) CNT FROM ${tbl}`);
        const count = Number(cnt[0]?.CNT ?? 0);
        if (count === 0) {
          emptyTables.push(tbl);
          continue;
        }
        if (KNOWN.has(tbl)) continue; // already covered

        const cols = await fbQuery<any>(db,
          `SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = '${tbl}' ORDER BY r.RDB$FIELD_POSITION`
        );
        const colNames = cols.map((r: any) => String(Object.values(r)[0]).trim()).join(', ');
        const sample = await fbQuery<any>(db, `SELECT FIRST 1 * FROM ${tbl}`);
        // decode strings
        const decoded: Record<string, any> = {};
        for (const [k, v] of Object.entries(sample[0] ?? {})) {
          decoded[k] = typeof v === 'string' ? decodeWin1250(v) : v;
        }
        newTables.push({ tbl, count, cols: colNames, sample: decoded });
      } catch {
        // table doesn't exist
      }
    }

    console.log('══ NOVÉ TABUĽKY (s dátami, ešte nespomínané) ══\n');
    for (const t of newTables) {
      console.log(`▶ ${t.tbl} – ${t.count} záznamov`);
      console.log(`  Stĺpce: ${t.cols}`);
      console.log(`  Ukážka: ${JSON.stringify(t.sample)}`);
      console.log();
    }

    console.log(`\n══ PRÁZDNE TABUĽKY (${emptyTables.length}x) ══`);
    console.log(emptyTables.join(', '));
  });
}

main().catch(console.error);
