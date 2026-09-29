const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const PUPINKA_ID = '5821edf5-e13d-4085-85c4-be6b95b29c34';
const DR_SYKORA_ID = 'b1963bb2-ef34-470e-ab2d-a22a250984bb';

async function seed() {
  console.log('🧪 Seeding realistic abnormal and normal lab results for Pupinka...');

  // Get Pupinka appointment if exists
  const appts = await sql`
    SELECT id FROM appointments
    WHERE patient_id = ${PUPINKA_ID}
    ORDER BY start_time DESC
    LIMIT 1;
  `;
  const appointmentId = appts.length > 0 ? appts[0].id : null;

  // Clear existing lab results for Pupinka
  await sql`
    DELETE FROM lab_results
    WHERE patient_id = ${PUPINKA_ID};
  `;

  const labItems = [
    {
      test_name: 'Kreatinín (S-Crea)',
      result_value: '225',
      unit: 'µmol/l',
      reference_range_low: 71,
      reference_range_high: 159,
      result_flag: 'abnormal',
      status: 'completed',
      follow_up_status: 'open',
      follow_up_note: 'Kontrola renálnych hodnôt o 14 dní + kontrolné sono obličiek',
    },
    {
      test_name: 'Močovina / Urea (BUN)',
      result_value: '18.4',
      unit: 'mmol/l',
      reference_range_low: 5.7,
      reference_range_high: 12.9,
      result_flag: 'abnormal',
      status: 'completed',
      follow_up_status: 'open',
      follow_up_note: 'Mierne zvýšená azotémia, odporúčaná rehydratácia a renálna diéta',
    },
    {
      test_name: 'ALT (Alanínaminotransferáza)',
      result_value: '42',
      unit: 'U/l',
      reference_range_low: 12,
      reference_range_high: 130,
      result_flag: 'normal',
      status: 'reviewed',
      follow_up_status: 'not_required',
      follow_up_note: null,
    },
    {
      test_name: 'Glukóza (Glu)',
      result_value: '5.2',
      unit: 'mmol/l',
      reference_range_low: 3.9,
      reference_range_high: 8.3,
      result_flag: 'normal',
      status: 'reviewed',
      follow_up_status: 'not_required',
      follow_up_note: null,
    },
    {
      test_name: 'Hematokrit (HCT)',
      result_value: '27.5',
      unit: '%',
      reference_range_low: 30.0,
      reference_range_high: 45.0,
      result_flag: 'abnormal',
      status: 'completed',
      follow_up_status: 'open',
      follow_up_note: 'Mierna anémia, doplniť retikulocyty',
    },
    {
      test_name: 'Leukocyty (WBC)',
      result_value: '11.8',
      unit: '10^9/l',
      reference_range_low: 5.5,
      reference_range_high: 19.5,
      result_flag: 'normal',
      status: 'reviewed',
      follow_up_status: 'not_required',
      follow_up_note: null,
    },
    {
      test_name: 'Fosfor anorganický (P)',
      result_value: '2.15',
      unit: 'mmol/l',
      reference_range_low: 1.0,
      reference_range_high: 1.9,
      result_flag: 'abnormal',
      status: 'completed',
      follow_up_status: 'open',
      follow_up_note: 'Pridať viazač fosfátov do krmiva',
    },
  ];

  const now = new Date();
  const followUpDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  for (const item of labItems) {
    const id = crypto.randomUUID();
    const opId = crypto.randomUUID();
    await sql`
      INSERT INTO lab_results (
        id,
        created_at,
        updated_at,
        practice_id,
        patient_id,
        appointment_id,
        test_name,
        result_value,
        unit,
        reference_range_low,
        reference_range_high,
        status,
        ordered_by,
        reviewed_by,
        creation_operation_id,
        result_flag,
        completed_at,
        reviewed_at,
        follow_up_status,
        follow_up_assigned_to,
        follow_up_due_at,
        follow_up_note
      ) VALUES (
        ${id},
        ${now},
        ${now},
        ${PRACTICE_ID},
        ${PUPINKA_ID},
        ${appointmentId},
        ${item.test_name},
        ${item.result_value},
        ${item.unit},
        ${item.reference_range_low},
        ${item.reference_range_high},
        ${item.status},
        ${DR_SYKORA_ID},
        ${item.status === 'reviewed' ? DR_SYKORA_ID : null},
        ${opId},
        ${item.result_flag},
        ${now},
        ${item.status === 'reviewed' ? now : null},
        ${item.follow_up_status},
        ${item.follow_up_status === 'open' ? DR_SYKORA_ID : null},
        ${item.follow_up_status === 'open' ? followUpDue : null},
        ${item.follow_up_note}
      );
    `;
    console.log(`✓ Added lab result: ${item.test_name} = ${item.result_value} ${item.unit} [${item.result_flag}]`);
  }

  await sql.end();
  console.log('✅ Seeding Pupinka lab results completed successfully!');
}

seed().catch((err) => {
  console.error('❌ Failed to seed lab results:', err);
  process.exit(1);
});
