const postgres = require('postgres');
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai', { max: 1 });

async function run() {
  try {
    const fp = 'a'.repeat(64);
    await sql`INSERT INTO clients (practice_id, first_name, last_name, external_source, external_id, import_fingerprint)
              VALUES ('5c4ebbbc-90e1-457a-87a7-7895f560317d', 'Eva', 'Ibošová', 'vetsoftware_v2', '1', ${fp})`;
    console.log('SUCCESS: Inserted client into PostgreSQL!');
    // delete test row
    await sql`DELETE FROM clients WHERE external_source = 'vetsoftware_v2' AND external_id = '1'`;
  } catch(e) {
    console.log('PG ERROR:', e.message, 'CODE:', e.code, 'CONSTRAINT:', e.constraint_name);
  } finally {
    await sql.end();
  }
}
run();
