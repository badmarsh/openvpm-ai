import postgres from 'postgres';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');

async function main() {
  const rabiesCount = await sql`
    SELECT count(*) FROM vaccination_records 
    WHERE practice_id = ${PRACTICE_ID}
      AND (
        lower(vaccine_name) LIKE '%rab%' 
        OR lower(vaccine_name) LIKE '%besnot%'
        OR lower(vaccine_name) LIKE '%biocan r%'
        OR lower(vaccine_name) LIKE '%rabisin%'
        OR lower(vaccine_name) LIKE '%nobivac r%'
        OR lower(vaccine_name) LIKE '%defensor%'
      )
  `;

  const totalVacs = await sql`SELECT count(*) FROM vaccination_records WHERE practice_id = ${PRACTICE_ID}`;
  const totalSoaps = await sql`SELECT count(*) FROM soap_notes WHERE practice_id = ${PRACTICE_ID}`;
  const totalDeceased = await sql`SELECT count(*) FROM patients WHERE practice_id = ${PRACTICE_ID} AND status = 'deceased'`;

  console.log('Total vaccinations:', totalVacs[0].count);
  console.log('Rabies vaccinations identified:', rabiesCount[0].count);
  console.log('Total clinical SOAP notes:', totalSoaps[0].count);
  console.log('Total deceased/euthanized patients:', totalDeceased[0].count);

  const sampleRabies = await sql`
    SELECT vr.administered_at, vr.vaccine_name, vr.lot_number, vr.next_due_date,
           p.name AS patient_name, p.species, p.microchip_number,
           c.first_name, c.last_name, c.address, c.city, c.phone
    FROM vaccination_records vr
    JOIN patients p ON vr.patient_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE vr.practice_id = ${PRACTICE_ID}
      AND (
        lower(vr.vaccine_name) LIKE '%rab%' 
        OR lower(vr.vaccine_name) LIKE '%besnot%'
        OR lower(vr.vaccine_name) LIKE '%biocan r%'
        OR lower(vr.vaccine_name) LIKE '%rabisin%'
        OR lower(vr.vaccine_name) LIKE '%nobivac r%'
      )
    ORDER BY vr.administered_at DESC
    LIMIT 3
  `;

  console.log('\nSample Rabies Register Entries:');
  console.log(sampleRabies);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
