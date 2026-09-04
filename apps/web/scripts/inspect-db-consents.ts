import postgres from 'postgres';

const PRACTICE_ID = '5c4ebbbc-90e1-457a-87a7-7895f560317d';
const sql = postgres('postgresql://openpims:openpims@localhost:5434/openvpm_ai');

async function main() {
  const rows = await sql`SELECT id, slug, title, is_active, sort_order FROM consent_forms WHERE practice_id = ${PRACTICE_ID} ORDER BY sort_order`;
  console.log('Consent forms in PostgreSQL count:', rows.length);
  for (const r of rows) {
    console.log(`- [${r.slug}] ${r.title} (active: ${r.is_active})`);
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
