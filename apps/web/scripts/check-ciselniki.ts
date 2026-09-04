/**
 * check-ciselniki.ts
 * Preskuma vsetky ciselníky a zostavy z VetSoftware V2
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {

    const tables: Array<[string, string]> = [
      ['TAB003', 'Druhy zvierat (species)'],
      ['TAB004', 'Plamena (breeds)'],
      ['TAB007', 'Lieky / sklad – master katalog'],
      ['TAB008', 'Cisielnik diagnoz (ICD kody)'],
      ['TAB009', 'Cisielnik ukonov / vykonov'],
      ['TAB023', 'Referencne rozsahy lab. parametrov'],
      ['TAB024', 'Referencne rozsahy (druhy cisielnik)'],
      ['TAB025', 'Mena lab. ukazovatelov (ID_UKAZ)'],
      ['TAB026', 'Cennik / sadzobnok'],
      ['TAB029', 'Skupiny zvierat'],
      ['TAB030', 'Skupiny diagnoz'],
      ['TAB031', 'Skupiny ukonov'],
      ['TAB033', 'DPH sadzby'],
      ['TAB036', 'Zasoby / pohyby skladu'],
      ['TAB040', 'Zostavy / reporty'],
      ['TAB042', 'Sablony tlace'],
      ['TAB043', 'Nastavenia praxe'],
      ['TAB063', 'Slovnik nazvov tabuliek'],
    ];

    for (const [tbl, desc] of tables) {
      try {
        const cnt = await fbQuery<any>(db, `SELECT COUNT(*) CNT FROM ${tbl}`);
        const count = Number(cnt[0]?.CNT ?? 0);
        if (count > 0) {
          const cols = await fbQuery<any>(db,
            `SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = '${tbl}' ORDER BY r.RDB$FIELD_POSITION`
          );
          const colNames = cols.map((r: any) => String(Object.values(r)[0]).trim()).join(', ');
          const sample = await fbQuery<any>(db, `SELECT FIRST 2 * FROM ${tbl}`);
          console.log(`\n── ${tbl} (${desc}) – ${count} zaznamov ──`);
          console.log(`   Stlpce: ${colNames}`);
          // decode strings in sample
          const decoded: any = {};
          for (const [k, v] of Object.entries(sample[0] ?? {})) {
            decoded[k] = typeof v === 'string' ? decodeWin1250(v) : v;
          }
          console.log(`   Ukazka:`, JSON.stringify(decoded));
        } else {
          console.log(`\n   ${tbl} (${desc}): PRAZDNA`);
        }
      } catch (e: any) {
        console.log(`\n   ${tbl}: ERROR – ${e.message?.slice(0, 80)}`);
      }
    }
  });
}

main().catch(console.error);
