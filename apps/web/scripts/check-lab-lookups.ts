import { withFirebird, fbQuery, decodeWin1250 } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // Check TAB024 (units / indicators) and TAB023
    const t24 = await fbQuery(db, 'SELECT FIRST 10 * FROM TAB024');
    console.log('TAB024 sample:');
    console.log(t24.map((r: any) => ({ ...r, NAZEV: decodeWin1250(r.NAZEV), JEDN: decodeWin1250(r.JEDN) })));

    const t23 = await fbQuery(db, 'SELECT FIRST 10 * FROM TAB023');
    console.log('\nTAB023 sample:');
    console.log(t23.map((r: any) => ({ ...r, NAZEV: decodeWin1250(r.NAZEV), JEDNOTKA: decodeWin1250(r.JEDNOTKA) })));
  });
}

main();
