import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    const tables = await fbQuery<any>(
      db,
      `SELECT TRIM(r.RDB$RELATION_NAME) AS TAB_NAME
       FROM RDB$RELATIONS r
       WHERE r.RDB$SYSTEM_FLAG = 0
         AND r.RDB$RELATION_NAME NOT STARTING WITH 'RDB$'
         AND r.RDB$RELATION_NAME NOT STARTING WITH 'MON$'
       ORDER BY r.RDB$RELATION_NAME`
    );

    const report: Array<{ name: string; count: number }> = [];

    for (const t of tables) {
      const name = t.TAB_NAME;
      try {
        const cnt = await fbQuery<any>(db, `SELECT COUNT(*) CNT FROM ${name}`);
        report.push({ name, count: Number(cnt[0]?.CNT ?? 0) });
      } catch (err: any) {
        report.push({ name, count: -1 });
      }
    }

    console.log(JSON.stringify(report, null, 2));
  });
}

main().catch(console.error);
