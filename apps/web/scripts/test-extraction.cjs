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

function dec(val) {
  if (!val) return '';
  if (Buffer.isBuffer(val)) {
    return iconv.decode(val, 'win1250').trim();
  }
  return String(val).trim();
}

function readBlob(blob) {
  return new Promise((resolve) => {
    if (!blob || typeof blob !== 'function') {
      return resolve(blob ? dec(blob) : '');
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
  if (err) { console.error('Attach error:', err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, res) => err ? reject(err) : resolve(res)));

  try {
    console.log('Extracting lookups...');
    const speciesRaw = await query('SELECT ID_ZVIRE, NAZEV FROM TAB008');
    const speciesMap = new Map();
    speciesRaw.forEach(r => speciesMap.set(r.ID_ZVIRE, dec(r.NAZEV)));

    const sexRaw = await query('SELECT ID_POHLAVI, NAZEV FROM TAB007');
    const sexMap = new Map();
    sexRaw.forEach(r => sexMap.set(r.ID_POHLAVI, dec(r.NAZEV)));

    const breedRaw = await query('SELECT ID_RASA, NAZEV FROM TAB009');
    const breedMap = new Map();
    breedRaw.forEach(r => breedMap.set(r.ID_RASA, dec(r.NAZEV)));

    const vacTypesRaw = await query('SELECT KOD_VAKCIN, NAZEV_VAKCIN FROM TAB033');
    const vacTypeMap = new Map();
    vacTypesRaw.forEach(r => vacTypeMap.set(r.KOD_VAKCIN, dec(r.NAZEV_VAKCIN)));

    console.log(`Lookups loaded: ${speciesMap.size} species, ${sexMap.size} sexes, ${breedMap.size} breeds, ${vacTypeMap.size} vacTypes`);

    console.log('Counting active records...');
    const clientRows = await query('SELECT COUNT(*) AS CNT FROM TAB005 WHERE KOD_KADO > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const patientRows = await query('SELECT COUNT(*) AS CNT FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const deceasedRows = await query("SELECT COUNT(*) AS CNT FROM TAB006 WHERE ID_PACIENTA > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL) AND ((ZEMREL IS NOT NULL AND EXTRACT(YEAR FROM ZEMREL) < 2100) OR VYRAZEN = 'A')");
    const vacRows = await query('SELECT COUNT(*) AS CNT FROM TAB018 WHERE KP42 > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');
    const visitRows = await query('SELECT COUNT(*) AS CNT FROM TAB010 WHERE KP > 0 AND (VYMAZ = 0 OR VYMAZ IS NULL)');

    console.log('\n--- V2DATA.FDB Extraction Summary ---');
    console.log(`Active Clients:            ${clientRows[0].CNT}`);
    console.log(`Active Patients:           ${patientRows[0].CNT}`);
    console.log(`  - Of which Deceased:     ${deceasedRows[0].CNT}`);
    console.log(`  - Of which Alive:        ${patientRows[0].CNT - deceasedRows[0].CNT}`);
    console.log(`Vaccination Records:       ${vacRows[0].CNT}`);
    console.log(`Clinical Visits (SOAP):    ${visitRows[0].CNT}`);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    db.detach();
  }
});
