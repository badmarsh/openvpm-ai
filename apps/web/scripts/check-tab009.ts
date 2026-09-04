import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    const raw = await fbQuery<any>(db, "SELECT NAZEV, NAZEVL, ID_RASA, ID_ZVIRE FROM TAB009 WHERE VYMAZ = 0 AND TRIM(NAZEV) <> ''");
    console.log(`TAB009: Found ${raw.length} valid items:`);
    for (const r of raw.slice(0, 15)) {
      console.log(`  - ${decodeWin1250(r.NAZEV)} (latinsky: ${decodeWin1250(r.NAZEVL)}) | zviera=${r.ID_ZVIRE}`);
    }
  });
}

main().catch(console.error);
