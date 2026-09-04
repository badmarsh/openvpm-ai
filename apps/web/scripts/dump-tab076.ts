import { fbQuery, decodeWin1250, readTextBlob, withFirebird } from '../lib/import/vetsoftware-v2-extractor';
import * as fs from 'fs';

async function main() {
  await withFirebird(async (db) => {
    const rows = await fbQuery<any>(db, 'SELECT * FROM TAB076 ORDER BY ID');
    const results = [];
    for (const r of rows) {
      results.push({
        id: r.ID,
        name: decodeWin1250(r.NAME),
        reportFile: r.REPORT_FILE ? decodeWin1250(r.REPORT_FILE) : null,
        panelClassName: r.PANEL_CLASS_NAME ? decodeWin1250(r.PANEL_CLASS_NAME) : null,
        prefix: r.FILE_PREFIX_TARGET ? decodeWin1250(r.FILE_PREFIX_TARGET) : null,
        text1: r.TEXT1 ? await readTextBlob(r.TEXT1, 5000) : null,
        text2: r.TEXT2 ? await readTextBlob(r.TEXT2, 5000) : null,
        text3: r.TEXT3 ? await readTextBlob(r.TEXT3, 5000) : null,
        text4: r.TEXT4 ? await readTextBlob(r.TEXT4, 5000) : null,
        text5: r.TEXT5 ? await readTextBlob(r.TEXT5, 5000) : null,
      });
    }
    fs.writeFileSync('scripts/tab076_dump.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Saved tab076_dump.json with', results.length, 'records.');
  });
}

main().catch(console.error);
