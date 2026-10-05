const fs = require('fs');
const https = require('https');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const res = {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      res[k] = v;
    }
  }
  return res;
}

const localEnv = loadEnvFile('.env');
const envFile = process.argv[2] || '.env.production.local';
const composeId = process.argv[3] || process.env.DOKPLOY_COMPOSE_ID || localEnv.DOKPLOY_COMPOSE_ID;
const dokployHost = process.env.DOKPLOY_HOST || localEnv.DOKPLOY_HOST;
const token = process.env.DOKPLOY_TOKEN || localEnv.DOKPLOY_TOKEN;

if (!composeId) {
  console.error('CHYBA: DOKPLOY_COMPOSE_ID nie je nastaveny v prostredi ani v .env');
  process.exit(1);
}
if (!dokployHost) {
  console.error('CHYBA: DOKPLOY_HOST nie je nastaveny v prostredi ani v .env');
  process.exit(1);
}
if (!token) {
  console.error('CHYBA: DOKPLOY_TOKEN nie je nastaveny v prostredi ani v .env');
  process.exit(1);
}
if (!fs.existsSync(envFile)) {
  console.error('CHYBA: Subor ' + envFile + ' neexistuje.');
  process.exit(1);
}

const envContent = fs.readFileSync(envFile, 'utf8');
const postData = JSON.stringify({ composeId: composeId, env: envContent });

const req = https.request({
  hostname: dokployHost,
  path: '/api/compose.saveEnvironment',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData, 'utf8'),
    'x-api-key': token
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('OK Env synchronizovane s Dokploy.');
      process.exit(0);
    } else {
      console.error('CHYBA: Dokploy API vratilo status ' + res.statusCode + ': ' + body);
      process.exit(1);
    }
  });
});

req.on('error', e => {
  console.error('CHYBA pri volani Dokploy API:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
