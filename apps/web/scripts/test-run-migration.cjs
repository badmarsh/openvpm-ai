const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const schema = require('@openpims/db');
const { runFullV2Migration } = require('../lib/import/vetsoftware-v2-pipeline');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d'; // MVDr. Martin Sýkora
const USER_ID = 'b1963bb2-ef34-470e-ab2d-a22a250984bb'; // MVDr. Martin Sýkora

const connectionString = process.env.DATABASE_URL || 'postgresql://openpims:openpims@localhost:5434/openvpm_ai';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function main() {
  console.log('Spúšťam skúšobnú migráciu pre prax MVDr. Martin Sýkora...');
  console.log('Practice ID:', PRACTICE_ID);
  console.log('User ID:', USER_ID);

  const report = await runFullV2Migration(db, PRACTICE_ID, USER_ID, {
    importClients: true,
    importPatients: true,
    importVaccinations: true,
    importSoapNotes: true,
    importFinancials: true,
    importAttachments: true,
  });

  console.log('\n=== VÝSLEDNÝ REPORT MIGRÁCIE ===');
  console.log('Success:', report.success);
  console.log('Duration:', report.durationMs, 'ms');
  console.log('Clients:', report.clients);
  console.log('Patients:', report.patients);
  console.log('Vaccinations:', report.vaccinations);
  console.log('SoapNotes:', report.soapNotes);
  console.log('Financials:', report.financials);
  console.log('Attachments:', report.attachments);
  if (report.errors.length > 0) {
    console.log('CHYBY (všetky):', JSON.stringify(report.errors, null, 2));
  }

  // Overenie v databáze
  const clientCount = await client`SELECT count(*) FROM clients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
  const patientCount = await client`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
  const deceasedCount = await client`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2' AND status = 'deceased'`;
  const vacCount = await client`SELECT count(*) FROM vaccination_records WHERE practice_id = ${PRACTICE_ID}`;
  const soapCount = await client`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID} AND imported = true`;
  const finCount = await client`SELECT count(*) FROM legacy_financial_documents WHERE practice_id = ${PRACTICE_ID}`;
  const fileCount = await client`SELECT count(*) FROM files WHERE practice_id = ${PRACTICE_ID}`;

  console.log('\n=== STAV V POSTGRESQL (openvpm_ai) ===');
  console.log('Klienti v DB:          ', clientCount[0].count);
  console.log('Pacienti v DB:         ', patientCount[0].count);
  console.log('  - z toho uhynutí:    ', deceasedCount[0].count);
  console.log('Očkovania v DB:        ', vacCount[0].count);
  console.log('Klinické karty (SOAP): ', soapCount[0].count);
  console.log('Faktúry v DB:          ', finCount[0].count);
  console.log('Súbory/RTG v DB:       ', fileCount[0].count);

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
