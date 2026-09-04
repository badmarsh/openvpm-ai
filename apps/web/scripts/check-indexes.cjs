const postgres = require('postgres');
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai', { max: 1 });

async function run() {
  const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'clients'`;
  console.log(idx);
  await sql.end();
}
run();
