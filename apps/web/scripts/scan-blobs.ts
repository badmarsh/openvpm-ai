import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  HĹBKOVÝ SKEN VŠETKÝCH BLOB / BINÁRNYCH STĹPCOV VO FIREBIRDE     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  await withFirebird(async (db) => {
    // Firebird katalóg: RDB$FIELD_TYPE 261 = BLOB
    // RDB$FIELD_SUB_TYPE: 0 = Binary, 1 = Text
    const blobFields = await fbQuery<any>(
      db,
      `SELECT
         TRIM(rf.RDB$RELATION_NAME) AS TABLE_NAME,
         TRIM(rf.RDB$FIELD_NAME) AS COLUMN_NAME,
         f.RDB$FIELD_SUB_TYPE AS SUB_TYPE,
         f.RDB$SEGMENT_LENGTH AS SEG_LEN
       FROM RDB$RELATION_FIELDS rf
       JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
       WHERE f.RDB$FIELD_TYPE = 261
         AND rf.RDB$RELATION_NAME NOT STARTING WITH 'RDB$'
         AND rf.RDB$RELATION_NAME NOT STARTING WITH 'MON$'
       ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_NAME`
    );

    console.log(`Nájdených celkovo ${blobFields.length} BLOB stĺpcov vo Firebirde:\n`);

    const results: Array<{
      table: string;
      column: string;
      subType: string;
      rowCountWithData: number;
      totalRows: number;
    }> = [];

    for (const bf of blobFields) {
      const tbl = bf.TABLE_NAME;
      const col = bf.COLUMN_NAME;
      const subTypeStr = bf.SUB_TYPE === 0 ? 'BINARY (Sub-type 0)' : bf.SUB_TYPE === 1 ? 'TEXT (Sub-type 1)' : `OTHER (${bf.SUB_TYPE})`;

      try {
        const countRes = await fbQuery<any>(
          db,
          `SELECT
             COUNT(*) AS TOTAL,
             COUNT(${col}) AS WITH_DATA
           FROM ${tbl}`
        );
        const total = Number(countRes[0]?.TOTAL ?? 0);
        const withData = Number(countRes[0]?.WITH_DATA ?? 0);

        results.push({
          table: tbl,
          column: col,
          subType: subTypeStr,
          rowCountWithData: withData,
          totalRows: total,
        });
      } catch (err: any) {
        console.error(`Chyba pri ${tbl}.${col}:`, err.message);
      }
    }

    console.log('Tabuľka | Stĺpec | Typ BLOBu | Počet záznamov s dátami | Celkovo riadkov');
    console.log('─'.repeat(85));
    for (const r of results) {
      const status = r.rowCountWithData > 0 ? '🟢 DÁTA' : '⚪ PRÁZDNY';
      console.log(
        `${r.table.padEnd(10)} | ${r.column.padEnd(15)} | ${r.subType.padEnd(20)} | ${String(r.rowCountWithData).padStart(6)} (${status}) | ${r.totalRows}`
      );
    }
  });
}

main().catch(console.error);
