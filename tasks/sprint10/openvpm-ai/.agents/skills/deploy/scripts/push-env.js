
const fs = require('fs');
const https = require('https');

const envFile = process.argv[2] || '.env.production.local';
const composeId = process.argv[3] || 'pvdhIxlCIhYTKvnmrZ8Mk';

let token = process.env.DOKPLOY_TOKEN;
if (!token && fs.existsSync('.env')) {
  const envLines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
  const tokenLine = envLines.find(l => l.startsWith('DOKPLOY_TOKEN='));
  if (tokenLine) {
    token = tokenLine.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

if (!token) {
  console.error('CHYBA: DOKPLOY_TOKEN nie je nastaveny.');
  process.exit(1);
}

if (!fs.existsSync(envFile)) {
  console.error('CHYBA: Súbor ' + envFile + ' neexistuje.');
  process.exit(1);
}

const envContent = fs.readFileSync(envFile, 'utf8');
const postData = JSON.stringify({
  composeId: composeId,
  env: envContent
});

const req = https.request({
  hostname: 'dev.significa.sk',
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

