import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // TAB014
    const t14Cols = await fbQuery<any>(db, "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB014' ORDER BY r.RDB$FIELD_POSITION");
    const t14Sample = await fbQuery<any>(db, "SELECT FIRST 2 * FROM TAB014");
    console.log('TAB014 Columns:', t14Cols.map((c: any) => String(Object.values(c)[0]).trim()).join(', '));
    console.log('TAB014 Sample:', t14Sample);

    // TAB020
    const t20Cols = await fbQuery<any>(db, "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB020' ORDER BY r.RDB$FIELD_POSITION");
    const t20Sample = await fbQuery<any>(db, "SELECT FIRST 2 * FROM TAB020");
    console.log('\nTAB020 Columns:', t20Cols.map((c: any) => String(Object.values(c)[0]).trim()).join(', '));
    console.log('TAB020 Sample:', t20Sample);
  });
}

main().catch(console.error);
