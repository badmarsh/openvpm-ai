import postgres from 'postgres';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');

async function main() {
  console.log('=== TEST ZÁKONNÝCH ZOSTÁV A FORMULÁROV ===\n');

  // 1. Consent forms test
  const forms = await sql`
    SELECT id, slug, title, sort_order, is_active 
    FROM consent_forms 
    WHERE practice_id = ${PRACTICE_ID} AND deleted_at IS NULL
    ORDER BY sort_order
  `;
  console.log(`[1] Tlačové formuláre (consent_forms) - počet: ${forms.length}`);
  forms.forEach((f) => console.log(`    ${f.sort_order}. [${f.slug}] ${f.title}`));

  // 2. Rabies register test
  const rabiesRows = await sql`
    SELECT vr.administered_at, vr.vaccine_name, vr.next_due_date,
           p.name AS patient, p.species, p.microchip_number,
           c.first_name, c.last_name, c.phone
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
    LIMIT 5
  `;
  console.log(`\n[2] Register očkovania proti besnote - vzorka 5 z najnovších:`);
  rabiesRows.forEach((r, i) => {
    console.log(
      `    ${i + 1}. ${new Date(r.administered_at).toLocaleDateString('sk-SK')}: ${r.patient} (${r.species}, čip: ${r.microchip_number || 'N/A'}) - majiteľ: ${r.first_name} ${r.last_name}, vakcína: ${r.vaccine_name}, revakcinácia: ${r.next_due_date ? new Date(r.next_due_date).toLocaleDateString('sk-SK') : 'N/A'}`
    );
  });

  // 3. Treatment diary test
  const diaryCount = await sql`
    SELECT count(*) FROM soap_notes 
    WHERE practice_id = ${PRACTICE_ID} AND deleted_at IS NULL
  `;
  console.log(`\n[3] Denník ošetrených zvierat (SOAP karty) - celkový počet: ${diaryCount[0].count}`);

  // 4. Euthanasia register test
  const deceasedRows = await sql`
    SELECT p.name AS patient, p.species, p.breed, p.microchip_number, p.updated_at,
           c.first_name, c.last_name, c.city
    FROM patients p
    JOIN clients c ON p.client_id = c.id
    WHERE p.practice_id = ${PRACTICE_ID} AND p.status = 'deceased' AND p.deleted_at IS NULL
    ORDER BY p.updated_at DESC
    LIMIT 3
  `;
  console.log(`\n[4] Register eutanázií a asanácií - vzorka uhynutých pacientov:`);
  deceasedRows.forEach((d, i) => {
    console.log(`    ${i + 1}. ${d.patient} (${d.species}, ${d.breed || 'kríženec'}) - majiteľ: ${d.first_name} ${d.last_name} (${d.city || 'N/A'})`);
  });

  // 5. Legacy Financial Summary
  const finSummary = await sql`
    SELECT count(*) AS docs, coalesce(sum(total::numeric), 0) AS total 
    FROM legacy_financial_documents 
    WHERE practice_id = ${PRACTICE_ID} AND deleted_at IS NULL
  `;
  console.log(`\n[5] Finančný prehľad z VetSoftware V2:`);
  console.log(`    Počet dokladov: ${finSummary[0].docs}, Celková suma: ${Number(finSummary[0].total).toFixed(2)} €`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
