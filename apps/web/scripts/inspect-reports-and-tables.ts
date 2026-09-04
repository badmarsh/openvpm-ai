import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    for (const t of ['TAB071', 'TAB072', 'TAB074', 'TAB077', 'TAB079', 'TAB080', 'TAB083']) {
      try {
        const rows = await fbQuery<any>(db, `SELECT FIRST 2 * FROM ${t}`);
        console.log(`\n=== ${t} === (${rows.length} sample rows)`);
        if (rows.length > 0) {
          const sample = { ...rows[0] };
          for (const k of Object.keys(sample)) {
            if (typeof sample[k] === 'string') sample[k] = decodeWin1250(sample[k]);
          }
          console.log(JSON.stringify(sample, null, 2));
        }
      } catch (e: any) {
        console.log(`Error in ${t}:`, e.message);
      }
    }
  });
}

main().catch(console.error);
