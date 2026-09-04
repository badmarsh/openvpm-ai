import { fbQuery, decodeWin1250, readTextBlob, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    console.log('=== TAB076 (Tlačové zostavy a formuláre vo VetSoftware) ===');
    const reports = await fbQuery<any>(db, 'SELECT * FROM TAB076 ORDER BY ID');
    for (const r of reports) {
      console.log(`\n[ID ${r.ID}] ${decodeWin1250(r.NAME)}`);
      console.log(`  Report súbor: ${r.REPORT_FILE}, Panel: ${r.PANEL_CLASS_NAME}, Prefix: ${r.FILE_PREFIX_TARGET}`);
      if (r.TEXT1) console.log(`  TEXT1: ${await readTextBlob(r.TEXT1, 500)}`);
      if (r.TEXT2) console.log(`  TEXT2: ${await readTextBlob(r.TEXT2, 500)}`);
      if (r.TEXT3) console.log(`  TEXT3: ${await readTextBlob(r.TEXT3, 500)}`);
      if (r.TEXT4) console.log(`  TEXT4: ${await readTextBlob(r.TEXT4, 500)}`);
      if (r.TEXT5) console.log(`  TEXT5: ${await readTextBlob(r.TEXT5, 500)}`);
    }
  });
}

main().catch(console.error);
