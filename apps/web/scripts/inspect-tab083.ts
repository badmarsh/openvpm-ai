import { fbQuery, decodeWin1250, readTextBlob, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    const rows = await fbQuery<any>(db, 'SELECT * FROM TAB083');
    console.log('TAB083 count:', rows.length);
    for (const r of rows) {
      const copy: any = { ...r };
      for (const k of Object.keys(copy)) {
        if (typeof copy[k] === 'string') copy[k] = decodeWin1250(copy[k]);
        if (copy[k] && typeof copy[k] === 'function') {
          // blob
          try {
            copy[k] = await readTextBlob(copy[k], 2000);
          } catch(e) {}
        }
      }
      console.log(copy);
    }
  });
}

main().catch(console.error);
