import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';
import postgres from 'postgres';

const DB_URL = 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';
const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const client = postgres(DB_URL);

async function main() {
  await withFirebird(async (db) => {
    const orders = await fbQuery<any>(db, 'SELECT * FROM TAB029 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log('TAB029 active appointments:', orders.length);
    for (const o of orders) {
      console.log(`ID_OBJ: ${o.ID_OBJ}, Pacient FB ID: ${o.ID_PACIENTA}, Klient FB ID: ${o.ID_KLIENT}, Dátum: ${o.DATUMO?.toISOString?.()?.slice(0,10)}, Od: ${o.CASO}, Do: ${o.CASD}, Lekár: ${decodeWin1250(o.ORDINOVAL)}, Dôvod: ${o.ID_DUVOD}, Poznámka: ${decodeWin1250(o.POZNAMKA)}`);

      // Check if patient exists in PG
      const pgPat = await client`SELECT id, name FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_id = ${String(o.ID_PACIENTA)}`;
      console.log(`  -> Match v PG:`, pgPat[0] ?? 'NENÁJDENÝ');
    }
  });
  await client.end();
}

main().catch(console.error);
