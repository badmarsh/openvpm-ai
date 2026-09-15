const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const DR_SYKORA_ID = 'b1963bb2-ef34-470e-ab2d-a22a250984bb';

async function seedEkasa() {
  console.log('🧾 Seeding e-Kasa receipts and daily closure data...');

  // Delete previous test receipts for this practice to avoid duplicates
  await sql`
    DELETE FROM ekasa_receipts
    WHERE practice_id = ${PRACTICE_ID};
  `;

  // Delete previous closures
  await sql`
    DELETE FROM ekasa_daily_closures
    WHERE practice_id = ${PRACTICE_ID};
  `;

  const now = new Date();
  const receiptId = crypto.randomUUID();

  const items = [
    { name: "Klinické vyšetrenie mačky (Pupinka)", quantity: 1, unitPrice: 25.0, vatRate: "STANDARD_20", total: 25.0 },
    { name: "Nobivac Tricat Trio inj. sicc. (šarža A312B01)", quantity: 1, unitPrice: 18.5, vatRate: "STANDARD_20", total: 18.5 },
    { name: "Subkutánna aplikácia liečiva", quantity: 1, unitPrice: 5.0, vatRate: "STANDARD_20", total: 5.0 }
  ];

  await sql`
    INSERT INTO ekasa_receipts (
      id,
      created_at,
      updated_at,
      practice_id,
      receipt_number,
      uid,
      okp,
      pkp,
      receipt_type,
      amount_base,
      amount_vat,
      amount_total,
      vat_rate,
      tax_breakdown,
      items,
      payment_method,
      status,
      issued_at
    ) VALUES (
      ${receiptId},
      ${now},
      ${now},
      ${PRACTICE_ID},
      '20260914-0042',
      'O-8881234567890001-20260914-0042',
      '4a7b2c9e-1f8d-4e5a-9321-7890abcdef12',
      'MEQCIA1e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0aAiBx8z7y6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g==',
      'STANDARD',
      40.42,
      8.08,
      48.50,
      'STANDARD',
      ${sql.json({ "STANDARD": { base: 40.42, vat: 8.08, total: 48.50 } })},
      ${sql.json(items)},
      'CASH',
      'CONFIRMED',
      ${now}
    );
  `;
  console.log('✓ Inserted CONFIRMED receipt for Pupinka: 48.50 € (Cash)');

  // Also insert a second receipt for variety (Card)
  const receipt2Id = crypto.randomUUID();
  const items2 = [
    { name: "Preventívna prehliadka psa (Rex)", quantity: 1, unitPrice: 30.0, vatRate: "STANDARD_20", total: 30.0 },
    { name: "NexGard Spectra 7.5-15kg tbl.", quantity: 1, unitPrice: 22.0, vatRate: "STANDARD_20", total: 22.0 }
  ];

  await sql`
    INSERT INTO ekasa_receipts (
      id,
      created_at,
      updated_at,
      practice_id,
      receipt_number,
      uid,
      okp,
      pkp,
      receipt_type,
      amount_base,
      amount_vat,
      amount_total,
      vat_rate,
      tax_breakdown,
      items,
      payment_method,
      status,
      issued_at
    ) VALUES (
      ${receipt2Id},
      ${now},
      ${now},
      ${PRACTICE_ID},
      '20260914-0041',
      'O-8881234567890001-20260914-0041',
      '8f9e0a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b',
      'MEQCIH3k2j1i0h9g8f7e6d5c4b3a2a1b0c9d8e7f6a5b4c3dAiAn7m6l5k4j3i2h1g0f9e8d7c6b5a4a3b2c1d0e9f==',
      'STANDARD',
      43.33,
      8.67,
      52.00,
      'STANDARD',
      ${sql.json({ "STANDARD": { base: 43.33, vat: 8.67, total: 52.00 } })},
      ${sql.json(items2)},
      'CARD',
      'CONFIRMED',
      ${new Date(now.getTime() - 45 * 60 * 1000)}
    );
  `;
  console.log('✓ Inserted CONFIRMED receipt for Rex: 52.00 € (Card)');

  // Insert a daily closure
  const closureId = crypto.randomUUID();
  const todayStr = now.toISOString().split('T')[0];
  await sql`
    INSERT INTO ekasa_daily_closures (
      id,
      created_at,
      updated_at,
      practice_id,
      closure_number,
      date,
      closed_at,
      closed_by,
      receipts_count,
      total_amount,
      cash_amount,
      card_amount,
      transfer_amount,
      vat_breakdown,
      okp,
      status
    ) VALUES (
      ${closureId},
      ${now},
      ${now},
      ${PRACTICE_ID},
      ${todayStr.replace(/-/g, '') + '-Z01'},
      ${todayStr},
      ${now},
      ${DR_SYKORA_ID},
      2,
      100.50,
      48.50,
      52.00,
      0.00,
      ${sql.json({
        "STANDARD_20": { base: 83.75, vat: 16.75, total: 100.50 }
      })},
      'd4e5f6a7-b8c9-0e1f-2a3b-4c5d6e7f8a9b',
      'CLOSED'
    );
  `;
  console.log('✓ Inserted Daily Closure for today:', todayStr, 'Total: 100.50 €');

  await sql.end();
  console.log('✅ e-Kasa seeding finished!');
}

seedEkasa().catch(e => {
  console.error('❌ e-Kasa seed error:', e);
  process.exit(1);
});
