const path = require('path');
const crypto = require('crypto');
const postgres = require(path.resolve(__dirname, '../packages/db/node_modules/postgres'));
const sql = postgres(process.env.DATABASE_URL || 'postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai');

async function setupToken() {
  const token = 'test-portal-token-sykora';
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const clientId = '31b42847-ed4b-4fd5-970b-fbc4b489fe3f';
  const expires = new Date(Date.now() + 24 * 3600 * 1000);

  await sql`UPDATE clients SET access_token = ${tokenHash}, portal_access_token_expires_at = ${expires}, portal_access_token_used_at = NULL WHERE id = ${clientId}`;
  console.log('✓ Token set successfully for client:', clientId);
  await sql.end();
}

setupToken().catch(err => {
  console.error(err);
  process.exit(1);
});
