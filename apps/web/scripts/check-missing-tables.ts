/**
 * check-missing-tables.ts – overí stĺpce TAB027, TAB028, TAB052, TAB077
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    for (const tbl of ['TAB027', 'TAB028', 'TAB052', 'TAB077']) {
      const cols = await fbQuery<any>(db,
        `SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = '${tbl}' ORDER BY r.RDB$FIELD_POSITION`
      );
      console.log(`\n── ${tbl} columns ──`);
      console.log(cols.map((r: any) => Object.values(r)[0]).join(', '));

      const sample = await fbQuery<any>(db, `SELECT FIRST 2 * FROM ${tbl}`);
      console.log('Sample:', JSON.stringify(sample, null, 2));
    }
  });
}

main().catch(console.error);
