/**
 * check-line-items.ts – diagnoses why only 1151/3647 TAB066 rows matched invoices
 */
import { fbQuery, withFirebird } from '../lib/import/vetsoftware-v2-extractor';
import postgres from 'postgres';

const DB_URL = 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';
const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const client = postgres(DB_URL);

async function main() {
  await withFirebird(async (db) => {
    // How many unique CIS_UCTU values in TAB066?
    const uniqueInvoices = await fbQuery<any>(db,
      'SELECT COUNT(DISTINCT CIS_UCTU) CNT FROM TAB066 WHERE VYMAZ = 0 OR VYMAZ IS NULL'
    );
    console.log('Unique CIS_UCTU in TAB066:', uniqueInvoices[0]?.CNT);

    // Sample CIS_UCTU values from TAB066
    const sample066 = await fbQuery<any>(db,
      'SELECT FIRST 5 CIS_UCTU FROM TAB066 ORDER BY CIS_UCTU'
    );
    console.log('Sample TAB066 CIS_UCTU:', sample066.map((r:any) => r.CIS_UCTU));

    // Sample ID_UCET from TAB060
    const sample060 = await fbQuery<any>(db,
      'SELECT FIRST 5 ID_UCET FROM TAB060 ORDER BY ID_UCET'
    );
    console.log('Sample TAB060 ID_UCET:', sample060.map((r:any) => r.ID_UCET));

    // Check overlap: how many TAB066.CIS_UCTU exist in TAB060.ID_UCET?
    const overlap = await fbQuery<any>(db,
      'SELECT COUNT(*) CNT FROM TAB066 t66 WHERE (t66.VYMAZ = 0 OR t66.VYMAZ IS NULL) AND EXISTS (SELECT 1 FROM TAB060 t60 WHERE t60.ID_UCET = t66.CIS_UCTU AND (t60.VYMAZ = 0 OR t60.VYMAZ IS NULL))'
    );
    console.log('TAB066 rows with matching TAB060 invoice (all):', overlap[0]?.CNT);
  });

  // How many invoices do we have in Postgres?
  const pgInvoices = await client`SELECT count(*) FROM legacy_financial_documents WHERE practice_id = ${PRACTICE_ID}`;
  console.log('Postgres legacy_financial_documents:', pgInvoices[0].count);

  // Sample external_id values
  const pgSample = await client`SELECT external_id FROM legacy_financial_documents WHERE practice_id = ${PRACTICE_ID} ORDER BY external_id::int LIMIT 5`;
  console.log('Sample Postgres external_ids:', pgSample.map((r:any) => r.external_id));

  await client.end();
}

main().catch(console.error);
