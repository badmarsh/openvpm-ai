import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    const suppliers = await fbQuery<any>(db, 'SELECT * FROM TAB064 WHERE VYMAZ = 0 OR VYMAZ IS NULL ORDER BY KOD_FIRMY');
    console.log(`Found ${suppliers.length} active suppliers in TAB064:`);
    for (const s of suppliers) {
      const name = decodeWin1250(s.NAZEV_FIRMY);
      const street = decodeWin1250(s.ULICE_FIRMY);
      const city = decodeWin1250(s.MESTO_FIRMY);
      const psc = decodeWin1250(s.PSC_FIRMY);
      const phone = decodeWin1250(s.TEL_FIRMY) || decodeWin1250(s.MOBIL_FIRMY);
      const email = decodeWin1250(s.EMAIL_FIRMY);
      const ico = decodeWin1250(s.ICO_FIRMY);
      console.log(`[${s.KOD_FIRMY}] ${name} | ${street}, ${city} ${psc} | Tel: ${phone} | Mail: ${email} | ICO: ${ico}`);
    }
  });
}

main().catch(console.error);
