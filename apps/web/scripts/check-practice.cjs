const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@localhost:5434/openvpm_ai');

async function main() {
  const practices = await sql`SELECT id, name FROM practices`;
  console.log('Practices in openvpm_ai:', practices);
  const userRows = await sql`SELECT id, name, email, role, practice_id FROM users`;
  console.log('Users in openvpm_ai:', userRows);
  await sql.end();
}

main().catch(console.error);
