import postgres from 'postgres';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const client = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');

async function main() {
  const clients = await client`SELECT count(*) FROM clients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
  const patients = await client`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2'`;
  const deceased = await client`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2' AND status = 'deceased'`;
  const vacs = await client`SELECT count(*) FROM vaccination_records WHERE practice_id = ${PRACTICE_ID}`;
  const soaps = await client`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID} AND imported = true`;
  const fins = await client`SELECT count(*) FROM legacy_financial_documents WHERE practice_id = ${PRACTICE_ID}`;
  const files = await client`SELECT count(*) FROM files WHERE practice_id = ${PRACTICE_ID}`;

  console.log('\n=== FINÁLNE OVERENIE PRE PRAX MVDr. MARTIN SÝKORA ===');
  console.log('Klienti (V2):          ', clients[0].count);
  console.log('Pacienti (V2):         ', patients[0].count);
  console.log('  - Sympathy Gate (uhynutí):', deceased[0].count);
  console.log('Očkovacie preukazy:    ', vacs[0].count);
  console.log('Klinické karty (SOAP): ', soaps[0].count);
  console.log('Faktúry/Účtenky (EUR): ', fins[0].count);
  console.log('RTG a obrazové prílohy:', files[0].count);

  const samplePatients = await client`
    SELECT name, species, breed, microchip_number, status 
    FROM patients 
    WHERE practice_id = ${PRACTICE_ID} AND external_source = 'vetsoftware_v2' AND microchip_number IS NOT NULL 
    LIMIT 3
  `;
  console.log('\nUkážka pacientov:');
  console.log(samplePatients);

  const sampleSoap = await client`
    SELECT author_name, subjective, objective, assessment, plan 
    FROM soap_notes 
    WHERE practice_id = ${PRACTICE_ID} AND imported = true AND subjective IS NOT NULL 
    LIMIT 2
  `;
  console.log('\nUkážka SOAP kariet s diakritikou:');
  console.log(sampleSoap);

  const sampleFiles = await client`
    SELECT file_name, file_size_bytes, storage_status, checksum_sha256 
    FROM files 
    WHERE practice_id = ${PRACTICE_ID} 
    LIMIT 3
  `;
  console.log('\nUkážka RTG súborov:');
  console.log(sampleFiles);

  await client.end();
}

main();
