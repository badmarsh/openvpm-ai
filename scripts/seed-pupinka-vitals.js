const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const PUPINKA_ID = '5821edf5-e13d-4085-85c4-be6b95b29c34';
const DR_SYKORA_ID = 'b1963bb2-ef34-470e-ab2d-a22a250984bb';

async function seedVitals() {
  console.log('💓 Seeding vital signs and weight trend for Pupinka...');

  // Delete previous test vitals
  await sql`
    DELETE FROM vital_signs
    WHERE patient_id = ${PUPINKA_ID};
  `;

  const vitalsRecords = [
    {
      date: new Date('2026-01-15T09:30:00Z'),
      temp: 38.4,
      hr: 140,
      rr: 24,
      weight: 3.85,
      bcs: 5,
      pain: 0,
      crt: 1.5,
      mm: 'ružové, vlhké',
      notes: 'Vstupné vyšetrenie, celkový stav pokojný, výživový stav optimálny',
    },
    {
      date: new Date('2026-04-12T10:15:00Z'),
      temp: 38.6,
      hr: 155,
      rr: 28,
      weight: 4.10,
      bcs: 5,
      pain: 0,
      crt: 1.0,
      mm: 'ružové',
      notes: 'Predvakcinačná prehliadka, mierny stres z prepravky',
    },
    {
      date: new Date('2026-05-20T14:30:00Z'),
      temp: 38.5,
      hr: 148,
      rr: 26,
      weight: 4.20,
      bcs: 5,
      pain: 0,
      crt: 1.2,
      mm: 'ružové, lesklé',
      notes: 'Kontrolné váženie a FeLV vakcinácia, stabilná kondícia',
    },
  ];

  for (const v of vitalsRecords) {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO vital_signs (
        id,
        created_at,
        updated_at,
        practice_id,
        patient_id,
        recorded_by,
        recorded_at,
        temperature_c,
        heart_rate_bpm,
        respiratory_rate_bpm,
        weight_kg,
        body_condition_score,
        body_condition_scale,
        pain_score,
        mucous_membrane,
        capillary_refill_sec,
        notes
      ) VALUES (
        ${id},
        ${v.date},
        ${v.date},
        ${PRACTICE_ID},
        ${PUPINKA_ID},
        ${DR_SYKORA_ID},
        ${v.date},
        ${v.temp},
        ${v.hr},
        ${v.rr},
        ${v.weight},
        ${v.bcs},
        9,
        ${v.pain},
        ${v.mm},
        ${v.crt},
        ${v.notes}
      );
    `;
    console.log(`✓ Inserted vital sign: ${v.date.toISOString().split('T')[0]} - ${v.weight} kg, ${v.temp} °C`);
  }

  await sql.end();
  console.log('✅ Vital signs seeded successfully!');
}

seedVitals().catch(e => {
  console.error('❌ Error seeding vitals:', e);
  process.exit(1);
});
