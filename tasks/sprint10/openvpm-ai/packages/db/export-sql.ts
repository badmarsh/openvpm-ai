import postgres from 'postgres';
import fs from 'fs';

const sql = postgres('postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

async function run() {
  const statements: string[] = ['BEGIN;'];

  const tables = [
    { name: 'products', where: sql`sku LIKE 'VET-LA-%'` },
    { name: 'services', where: sql`code LIKE 'HD-%'` },
    { name: 'clients', where: sql`external_source = 'cehz_farm'` },
    { name: 'patients', where: sql`species = 'bovine'` },
    { name: 'appointments', where: sql`origin = 'field'` },
    { name: 'soap_notes', where: sql`subjective LIKE '%Dojnica%'` },
    { name: 'prescriptions', where: sql`medication_name IN ('Ubrolexin intramammárna suspenzia', 'Calciject 40 CM infúzia 500ml')` },
    { name: 'invoices', where: sql`client_id IN (SELECT id FROM clients WHERE external_source = 'cehz_farm')` },
    { name: 'invoice_items', where: sql`invoice_id IN (SELECT id FROM invoices WHERE client_id IN (SELECT id FROM clients WHERE external_source = 'cehz_farm'))` },
    { name: 'ext_kvepis_submissions', where: sql`cehz_code IS NOT NULL AND submission_type = 'treatment_diary_batch'` },
  ];

  for (const t of tables) {
    const rows = await sql`SELECT * FROM ${sql(t.name)} WHERE ${t.where}`;
    console.log(t.name, rows.length);
    for (const r of rows) {
      const cols = Object.keys(r);
      const colNames = cols.map(c => '"' + c + '"').join(', ');
      const vals = cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return 'NULL';
        if (v instanceof Date) return "'" + v.toISOString() + "'";
        if (typeof v === 'object') return "'" + JSON.stringify(v).split("'").join("''") + "'::jsonb";
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return String(v);
        return "'" + String(v).split("'").join("''") + "'";
      }).join(', ');
      statements.push(`INSERT INTO "${t.name}" (${colNames}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
    }
  }

  statements.push('COMMIT;');
  fs.writeFileSync('remote-seed.sql', statements.join('\n'), 'utf8');
  console.log('remote-seed.sql written:', statements.length, 'statements');
  await sql.end();
}
run();

