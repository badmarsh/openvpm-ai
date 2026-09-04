const Firebird = require('node-firebird');
const iconv = require('iconv-lite');

const options = {
  host: '127.0.0.1',
  port: 3050,
  database: '/firebird/data/V2DATA.FDB',
  user: 'SYSDBA',
  password: 'masterkey',
  pageSize: 4096
};

function decodeStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Buffer.isBuffer(val)) {
    return iconv.decode(val, 'win1250').trim();
  }
  return String(val).trim();
}

function readBlob(blob) {
  return new Promise((resolve) => {
    if (!blob || typeof blob !== 'function') {
      return resolve(blob ? decodeStr(blob) : '');
    }
    blob((err, name, e) => {
      if (err) return resolve('');
      const chunks = [];
      e.on('data', chunk => chunks.push(chunk));
      e.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(iconv.decode(buf, 'win1250').trim());
      });
      e.on('error', () => resolve(''));
    });
  });
}

Firebird.attach(options, async (err, db) => {
  if (err) { console.error(err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => {
    db.query(sql, (err, res) => err ? reject(err) : resolve(res));
  });

  try {
    console.log('--- SPECIES (TAB008) ---');
    const species = await query('SELECT * FROM TAB008');
    species.forEach(s => console.log(`ID: ${s.ID_ZVIRE} -> ${decodeStr(s.NAZEV)} (${decodeStr(s.NAZEVL)})`));

    console.log('\n--- SEX (TAB007) ---');
    const sexes = await query('SELECT * FROM TAB007');
    sexes.forEach(s => console.log(`ID: ${s.ID_POHLAVI} -> ${decodeStr(s.NAZEV)} (${decodeStr(s.NAZEVL)})`));

    console.log('\n--- PATIENTS WITH ZEMREL / VYRAZEN (TAB006) ---');
    const deceased = await query("SELECT FIRST 5 ID_PACIENTA, JMENOP, ZEMREL, VYRAZEN, VYRAZEN_KDY, CIP FROM TAB006 WHERE ZEMREL IS NOT NULL OR VYRAZEN = 'A'");
    for (const p of deceased) {
      console.log(`Patient ${p.ID_PACIENTA}: ${decodeStr(p.JMENOP)} | Zemrel: ${p.ZEMREL} | Vyradeny: ${p.VYRAZEN} (${p.VYRAZEN_KDY}) | Chip: ${decodeStr(p.CIP)}`);
    }

    console.log('\n--- ACTIVE PATIENTS SAMPLE (TAB006) ---');
    const active = await query("SELECT FIRST 5 ID_PACIENTA, JMENOP, ID_MAJITELE, ID_ZVIRE, ID_POHLAVI, ID_RASA, NAROZEN, CIP, VA FROM TAB006 WHERE ID_PACIENTA > 0 AND (ZEMREL IS NULL AND (VYRAZEN IS NULL OR VYRAZEN != 'A'))");
    for (const p of active) {
      console.log(`Patient ${p.ID_PACIENTA}: ${decodeStr(p.JMENOP)} | Owner: ${p.ID_MAJITELE} | Species: ${p.ID_ZVIRE} | Sex: ${p.ID_POHLAVI} | Breed: ${p.ID_RASA} | Born: ${p.NAROZEN} | Chip: ${decodeStr(p.CIP)} | Weight: ${p.VA}`);
    }

    console.log('\n--- VACCINATIONS SAMPLE (TAB018) ---');
    const vacs = await query("SELECT FIRST 5 * FROM TAB018 WHERE KP42 > 0");
    for (const v of vacs) {
      const note = await readBlob(v.POZ42);
      console.log(`Vaccination ${v.ID_ZAZN}: Patient ${v.KP42} | Date: ${v.DNE42} | Next: ${v.P_OCKOV} | Lyss: ${decodeStr(v.LYSS)} | Note: ${note}`);
    }

    console.log('\n--- MEDICAL RECORD (TAB010) BLOB SAMPLE ---');
    const records = await query("SELECT FIRST 2 * FROM TAB010 WHERE KP > 0 AND ID_KLIENT > 0");
    for (const r of records) {
      const a = await readBlob(r.A);
      const kv = await readBlob(r.KV);
      const pozn = await readBlob(r.POZN);
      console.log(`Visit ${r.ID_KARTY} for Patient ${r.KP} on ${r.DT} by ${decodeStr(r.KDO)}:`);
      console.log(`  Anamneza: ${a}`);
      console.log(`  Klinicke vys: ${kv}`);
      console.log(`  Poznamka: ${pozn}`);
    }

  } catch (e) {
    console.error('Query error:', e);
  } finally {
    db.detach();
  }
});
