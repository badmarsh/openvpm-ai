import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // Total rows vs unique products
    const total = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB068 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const uniqueZbozi = await fbQuery<any>(db, 'SELECT COUNT(DISTINCT ID_ZBOZI) CNT FROM TAB068 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const uniqueNazev = await fbQuery<any>(db, 'SELECT COUNT(DISTINCT NAZEV_ZBOZI) CNT FROM TAB068 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log(`TAB068: Total rows=${total[0].CNT}, Distinct ID_ZBOZI=${uniqueZbozi[0].CNT}, Distinct NAZEV_ZBOZI=${uniqueNazev[0].CNT}`);

    // Check latest inventory count (ID_SOUPIS)
    const latestSoupis = await fbQuery<any>(db, 'SELECT MAX(ID_SOUPIS) MAX_ID FROM TAB068 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log(`Latest ID_SOUPIS: ${latestSoupis[0].MAX_ID}`);

    // Sample from TAB068 with latest or most recent prices & stock
    const sample = await fbQuery<any>(db, `
      SELECT FIRST 10 ID_ZBOZI, NAZEV_ZBOZI, PRODEJ, NAKUP, FYZ_ZASOBA, ID_SOUPIS
      FROM TAB068
      WHERE (VYMAZ = 0 OR VYMAZ IS NULL) AND TRIM(NAZEV_ZBOZI) <> ''
      ORDER BY ID_SOUPIS DESC, ID_ZBOZI
    `);
    console.log('\nSample items from latest inventory:');
    for (const r of sample) {
      console.log(`[ID ${r.ID_ZBOZI}] ${decodeWin1250(r.NAZEV_ZBOZI)} | Cena: ${r.PRODEJ} € | Nakup: ${r.NAKUP} € | Zásoba: ${r.FYZ_ZASOBA} ks (Soupis: ${r.ID_SOUPIS})`);
    }

    // Check TAB078 (Exspirácie)
    const expTotal = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB078');
    const expSample = await fbQuery<any>(db, 'SELECT FIRST 5 * FROM TAB078');
    console.log(`\nTAB078 Expirations: Total=${expTotal[0].CNT}, sample=`, expSample);
  });
}

main().catch(console.error);
