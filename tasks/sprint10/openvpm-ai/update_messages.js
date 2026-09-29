const fs = require('fs');
const sk = JSON.parse(fs.readFileSync('apps/web/messages/sk.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('apps/web/messages/en.json', 'utf8'));

sk.nav = sk.nav || {};
en.nav = en.nav || {};

sk.nav.fieldVisits = 'Terénna prax & Farmy';
en.nav.fieldVisits = 'Field Visits & Farms';

fs.writeFileSync('apps/web/messages/sk.json', JSON.stringify(sk, null, 2), 'utf8');
fs.writeFileSync('apps/web/messages/en.json', JSON.stringify(en, null, 2), 'utf8');
console.log('Successfully updated messages with nav.fieldVisits');

