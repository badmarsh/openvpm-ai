import { fbQuery, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // Check ONLY BINARY BLOBS (Sub-type 0 or != 1)
    const binaryBlobs = await fbQuery<any>(
      db,
      `SELECT
         TRIM(rf.RDB$RELATION_NAME) AS TABLE_NAME,
         TRIM(rf.RDB$FIELD_NAME) AS COLUMN_NAME,
         f.RDB$FIELD_SUB_TYPE AS SUB_TYPE
       FROM RDB$RELATION_FIELDS rf
       JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
       WHERE f.RDB$FIELD_TYPE = 261
         AND f.RDB$FIELD_SUB_TYPE <> 1
         AND rf.RDB$RELATION_NAME NOT STARTING WITH 'RDB$'
         AND rf.RDB$RELATION_NAME NOT STARTING WITH 'MON$'
       ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_NAME`
    );

    console.log('Všetky BINÁRNE stĺpce (Sub-type <> 1):');
    for (const b of binaryBlobs) {
      const countRes = await fbQuery<any>(db, `SELECT COUNT(*) TOTAL, COUNT(${b.COLUMN_NAME}) WITH_DATA FROM ${b.TABLE_NAME}`);
      console.log(`  ${b.TABLE_NAME}.${b.COLUMN_NAME} (sub-type ${b.SUB_TYPE}): ${countRes[0].WITH_DATA} / ${countRes[0].TOTAL}`);
    }

    // A čo je TAB038?
    // In previous output: TAB038 | PUVODNI | TEXT (Sub-type 1) | 41712 (DÁTA)
    const t38Sample = await fbQuery<any>(db, 'SELECT FIRST 3 * FROM TAB038');
    console.log('\nTAB038 vzorka:', t38Sample);
  });
}

main().catch(console.error);
