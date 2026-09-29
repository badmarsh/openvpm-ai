const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

async function resetRateLimits() {
  await sql`DELETE FROM rate_limit_buckets`;
  console.log('✓ Cleared rate_limit_buckets successfully!');
  await sql.end();
}

resetRateLimits().catch(console.error);
