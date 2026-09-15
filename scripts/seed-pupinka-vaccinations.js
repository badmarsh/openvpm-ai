const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const PUPINKA_ID = '5821edf5-e13d-4085-85c4-be6b95b29c34';
const DR_SYKORA_ID = 'b1963bb2-ef34-470e-ab2d-a22a250984bb';

async function seed() {
  console.log('Seeding vaccinations for Pupinka...');

  // Clean any old demo records for Pupinka
  await sql`
    DELETE FROM vaccination_records
    WHERE patient_id = ${PUPINKA_ID};
  `;

  const vaccines = [
    {
      id: crypto.randomUUID(),
      vaccine_name: 'Nobivac Tricat Trio (RCP)',
      lot_number: 'A312B01',
      manufacturer: 'MSD Animal Health',
      product_name: 'Nobivac Tricat Trio inj. sicc.',
      product_expiration_date: '2027-10-31',
      administered_at: new Date('2026-04-12T10:15:00Z'),
      next_due_date: '2027-04-12',
      dose_type: 'booster',
      licensed_duration_months: 12,
      rabies_tag_number: null,
    },
    {
      id: crypto.randomUUID(),
      vaccine_name: 'Nobivac Rabies (Besnota)',
      lot_number: 'B902A02',
      manufacturer: 'MSD Animal Health',
      product_name: 'Nobivac Rabies inj.',
      product_expiration_date: '2028-06-30',
      administered_at: new Date('2026-04-12T10:15:00Z'),
      next_due_date: '2028-04-12',
      dose_type: 'booster',
      licensed_duration_months: 24,
      rabies_tag_number: 'SK-BA-2026-4412',
    },
    {
      id: crypto.randomUUID(),
      vaccine_name: 'Purevax FeLV (Leukémia)',
      lot_number: 'L489211',
      manufacturer: 'Boehringer Ingelheim',
      product_name: 'Purevax FeLV inj. susp.',
      product_expiration_date: '2027-08-15',
      administered_at: new Date('2026-05-20T14:30:00Z'),
      next_due_date: '2027-05-20',
      dose_type: 'booster',
      licensed_duration_months: 12,
      rabies_tag_number: null,
    },
  ];

  for (const v of vaccines) {
    await sql`
      INSERT INTO vaccination_records (
        id,
        created_at,
        updated_at,
        practice_id,
        patient_id,
        vaccine_name,
        lot_number,
        manufacturer,
        administered_by,
        administered_at,
        next_due_date,
        product_name,
        product_expiration_date,
        dose_type,
        licensed_duration_months,
        rabies_tag_number
      ) VALUES (
        ${v.id},
        NOW(),
        NOW(),
        ${PRACTICE_ID},
        ${PUPINKA_ID},
        ${v.vaccine_name},
        ${v.lot_number},
        ${v.manufacturer},
        ${DR_SYKORA_ID},
        ${v.administered_at},
        ${v.next_due_date},
        ${v.product_name},
        ${v.product_expiration_date},
        ${v.dose_type},
        ${v.licensed_duration_months},
        ${v.rabies_tag_number}
      );
    `;
    console.log(`✓ Inserted vaccine: ${v.vaccine_name}`);
  }

  // Also check weights for Pupinka so weight tab has nice data
  const weights = await sql`SELECT count(*) FROM patient_weights WHERE patient_id = ${PUPINKA_ID}`;
  console.log(`Pupinka weights count: ${weights[0].count}`);
  if (parseInt(weights[0].count, 10) === 0) {
    await sql`
      INSERT INTO patient_weights (id, created_at, updated_at, patient_id, weight_kg, recorded_at, recorded_by)
      VALUES 
        (${crypto.randomUUID()}, NOW(), NOW(), ${PUPINKA_ID}, 3.85, '2026-01-15T09:00:00Z', ${DR_SYKORA_ID}),
        (${crypto.randomUUID()}, NOW(), NOW(), ${PUPINKA_ID}, 4.10, '2026-04-12T10:15:00Z', ${DR_SYKORA_ID}),
        (${crypto.randomUUID()}, NOW(), NOW(), ${PUPINKA_ID}, 4.20, '2026-05-20T14:30:00Z', ${DR_SYKORA_ID});
    `;
    console.log('✓ Added 3 weight history points for Pupinka');
  }

  await sql.end();
  console.log('Done!');
}

seed().catch(e => { console.error(e); process.exit(1); });
