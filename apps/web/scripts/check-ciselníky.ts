/**
 * check-ciselníky.ts
 * Preskúma všetky číselníky a zostavy z VetSoftware V2
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {

    // ─── Základné číselníky ────────────────────────────────────────────
    const tables: Record<string, string> = {
      'TAB003': 'Druhy zvierat (species)',
      'TAB004': 'Plemená (breeds)',
      'TAB007': 'Liečivá / sklad – master katalóg',
      'TAB008': 'Číselník diagnóz (ICD kódy)',
      'TAB009': 'Číselník úkonov / výkonov',
      'TAB023': 'Referenčné rozsahy lab. parametrov',
      'TAB024': 'Referenčné rozsahy (druhý číselník)',
      'TAB025': 'Mená lab. ukazovateľov (ID_UKAZ)',
      'TAB026': 'Cenník / sadzobník',
      'TAB029': 'Skupiny zvierat',
      'TAB030': 'Skupiny diagnóz',
      'TAB031': 'Skupiny úkonov / výkonov',
      'TAB033': 'DPH sadzby',
      'TAB036': 'Zásoby / pohyby skladu',
      'TAB040': 'Zostavy / reporty',
      'TAB042': 'Šablóny tlače',
      'TAB043': 'Nastavenia praxe / ordinácie',
      'TAB063': 'Slovník názvov tabuliek',
    };

    for (const [tbl, desc] of Object.entries(tables)) {
      try {
        const cnt = await fbQuery<any>(db, `SELECT COUNT(*) CNT FROM ${tbl}`);
        const count = Number(cnt[0]?.CNT ?? 0);
        if (count > 0) {
          // Zobraziť stĺpce
          const cols = await fbQuery<any>(db,
            `SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = '${tbl}' ORDER BY r.RDB$FIELD_POSITION`
          );
          const colNames = cols.map((r: any) => String(Object.values(r)[0]).trim()).join(', ');
          // Ukážka prvého záznamu
          const sample = await fbQuery<any>(db, `SELECT FIRST 2 * FROM ${tbl}`);
          console.log(`\n── ${tbl} (${desc}) – ${count} záznamov ──`);
          console.log(`   Stĺpce: ${colNames}`);
          console.log(`   Ukážka:`, JSON.stringify(sample[0]));
        } else {
          console.log(`   ${tbl} (${desc}): PRÁZDNA`);
        }
      } catch (e: any) {
        console.log(`   ${tbl}: ERROR – ${e.message?.slice(0, 80)}`);
      }
    }
  });
}

main().catch(console.error);
