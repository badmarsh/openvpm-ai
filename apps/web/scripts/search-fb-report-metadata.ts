import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // 1. Search all columns across all Firebird tables matching keywords
    const cols = await fbQuery<any>(
      db,
      `SELECT TRIM(r.RDB$RELATION_NAME) AS TAB_NAME,
              TRIM(r.RDB$FIELD_NAME) AS COL_NAME
       FROM RDB$RELATION_FIELDS r
       WHERE r.RDB$SYSTEM_FLAG = 0
         AND (
           UPPER(r.RDB$FIELD_NAME) LIKE '%REP%'
           OR UPPER(r.RDB$FIELD_NAME) LIKE '%TISK%'
           OR UPPER(r.RDB$FIELD_NAME) LIKE '%ZOST%'
           OR UPPER(r.RDB$FIELD_NAME) LIKE '%FORM%'
           OR UPPER(r.RDB$FIELD_NAME) LIKE '%SABL%'
           OR UPPER(r.RDB$FIELD_NAME) LIKE '%DOKL%'
         )
       ORDER BY TAB_NAME, COL_NAME`
    );

    console.log('=== STĹPCE TÝKAJÚCE SA REPORT/TLAČ/ZOSTAVY VO FIREBIRD ===');
    const byTable: Record<string, string[]> = {};
    for (const c of cols) {
      if (!byTable[c.TAB_NAME]) byTable[c.TAB_NAME] = [];
      byTable[c.TAB_NAME].push(c.COL_NAME);
    }
    console.log(JSON.stringify(byTable, null, 2));

    // 2. Also check TAB076 in full again to see all columns
    const tab076Cols = await fbQuery<any>(
      db,
      `SELECT TRIM(r.RDB$FIELD_NAME) AS COL_NAME
       FROM RDB$RELATION_FIELDS r
       WHERE r.RDB$RELATION_NAME = 'TAB076'
       ORDER BY r.RDB$FIELD_POSITION`
    );
    console.log('\n=== TAB076 VŠETKY STĹPCE ===');
    console.log(tab076Cols.map((c: any) => c.COL_NAME));
  });
}

main().catch(console.error);
