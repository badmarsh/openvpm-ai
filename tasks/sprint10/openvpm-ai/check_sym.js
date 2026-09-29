const fs = require('fs');
const sk = JSON.parse(fs.readFileSync('apps/web/messages/sk.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('apps/web/messages/en.json', 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    const full = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const skKeys = new Set(getKeys(sk));
const enKeys = new Set(getKeys(en));

const onlySk = [...skKeys].filter(k => !enKeys.has(k));
const onlyEn = [...enKeys].filter(k => !skKeys.has(k));

console.log('Only in SK:', onlySk.length);
console.log('Only in EN:', onlyEn.length);
if (onlySk.length === 0 && onlyEn.length === 0) {
  console.log('✓ 100% Symmetrical!');
}

