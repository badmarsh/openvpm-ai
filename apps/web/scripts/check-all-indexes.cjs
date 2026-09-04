const postgres = require('postgres');
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai', { max: 1 });

async function run() {
  for (const t of ['patients', 'vaccination_records', 'soap_notes', 'legacy_financial_documents', 'files']) {
    const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = ${t} AND indexdef LIKE '%UNIQUE%'`;
    console.log(`=== UNIQUE INDEXES ON ${t} ===`);
    idx.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));
    console.log('');
  }
  await sql.end();
}
run();
