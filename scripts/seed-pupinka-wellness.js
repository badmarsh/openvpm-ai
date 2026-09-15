const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const PUPINKA_ID = '5821edf5-e13d-4085-85c4-be6b95b29c34';
const CLIENT_ID = '31b42847-ed4b-4fd5-970b-fbc4b489fe3f';

async function seedWellness() {
  console.log('💚 Seeding wellness plan and enrollment for Pupinka...');

  // 1. Create or get wellness plan
  let [plan] = await sql`
    SELECT id FROM wellness_plans
    WHERE practice_id = ${PRACTICE_ID} AND name = 'Mačací senior — Geriatrický skríning'
    LIMIT 1;
  `;

  if (!plan) {
    const planId = crypto.randomUUID();
    const now = new Date();
    await sql`
      INSERT INTO wellness_plans (
        id,
        created_at,
        updated_at,
        practice_id,
        name,
        description,
        billing_interval,
        price,
        active
      ) VALUES (
        ${planId},
        ${now},
        ${now},
        ${PRACTICE_ID},
        'Mačací senior — Geriatrický skríning',
        'Kompletný preventívny balíček pre mačky nad 7 rokov vrátane ročného odberu krvi, ultrazvuku a vakcinácie.',
        'monthly',
        '19.90',
        true
      );
    `;
    plan = { id: planId };
    console.log('✓ Created wellness plan: Mačací senior — Geriatrický skríning (19.90 €/mesiac)');
  }

  // 2. Clear old enrollments for Pupinka
  await sql`
    DELETE FROM wellness_enrollments
    WHERE patient_id = ${PUPINKA_ID};
  `;

  // 3. Create enrollment
  const enrollmentId = crypto.randomUUID();
  const now = new Date();
  const startDateStr = now.toISOString().split('T')[0];
  const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const nextBillingStr = nextBilling.toISOString().split('T')[0];

  await sql`
    INSERT INTO wellness_enrollments (
      id,
      created_at,
      updated_at,
      practice_id,
      plan_id,
      client_id,
      patient_id,
      status,
      start_date,
      next_billing_date
    ) VALUES (
      ${enrollmentId},
      ${now},
      ${now},
      ${PRACTICE_ID},
      ${plan.id},
      ${CLIENT_ID},
      ${PUPINKA_ID},
      'active',
      ${startDateStr},
      ${nextBillingStr}
    );
  `;
  console.log('✓ Enrolled Pupinka into wellness plan:', enrollmentId);

  // 4. Also create redemptions if table exists
  try {
    const redId = crypto.randomUUID();
    await sql`
      INSERT INTO ext_wellness_redemptions (
        id,
        created_at,
        updated_at,
        practice_id,
        enrollment_id,
        benefit_key,
        notes,
        redeemed_at
      ) VALUES (
        ${redId},
        ${now},
        ${now},
        ${PRACTICE_ID},
        ${enrollmentId},
        'Ročná vakcinácia Nobivac Tricat Trio',
        'Uplatnené pri dnešnej návšteve — zľava 100% na vakcínu',
        ${now}
      );
    `;
    console.log('✓ Inserted redeemed benefit for Pupinka');
  } catch (err) {
    console.log('Note on redemptions:', err.message);
  }

  await sql.end();
  console.log('✅ Wellness seeding finished!');
}

seedWellness().catch(e => {
  console.error('❌ Wellness seed error:', e);
  process.exit(1);
});
