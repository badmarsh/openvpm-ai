import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // Check prices and stock ranges in TAB068
    const stats = await fbQuery<any>(db, `
      SELECT
        MIN(PRODEJ) MIN_P, MAX(PRODEJ) MAX_P,
        MIN(NAKUP) MIN_N, MAX(NAKUP) MAX_N,
        MIN(FYZ_ZASOBA) MIN_S, MAX(FYZ_ZASOBA) MAX_S
      FROM TAB068
      WHERE (VYMAZ = 0 OR VYMAZ IS NULL)
    `);
    console.log('TAB068 stats:', stats[0]);

    // Check grouping by ID_ZBOZI to get the latest record for each product
    const latestItems = await fbQuery<any>(db, `
      SELECT
        ID_ZBOZI,
        NAZEV_ZBOZI,
        PRODEJ,
        NAKUP,
        FYZ_ZASOBA,
        ID_SOUPIS
      FROM TAB068 t1
      WHERE (t1.VYMAZ = 0 OR t1.VYMAZ IS NULL)
        AND t1.ID_SOUPIS = (
          SELECT MAX(t2.ID_SOUPIS)
          FROM TAB068 t2
          WHERE t2.ID_ZBOZI = t1.ID_ZBOZI
            AND (t2.VYMAZ = 0 OR t2.VYMAZ IS NULL)
        )
      ORDER BY ID_ZBOZI
    `);
    console.log(`Unique latest products by ID_ZBOZI: ${latestItems.length}`);
  });
}

main().catch(console.error);
