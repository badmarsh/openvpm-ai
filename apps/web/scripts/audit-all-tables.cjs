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

Firebird.attach(options, async (err, db) => {
  if (err) { console.error('Attach error:', err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, res) => err ? reject(err) : resolve(res)));

  try {
    const tables = await query('SELECT TRIM(RDB$RELATION_NAME) AS TNAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$RELATION_NAME');
    const lookupMap = new Map();
    try {
      const l = await query('SELECT KOD_TAB, NAZEV_COMBO, NAZEV_DATAB FROM TAB063');
      l.forEach(r => lookupMap.set(r.NAZEV_DATAB.toUpperCase(), r.NAZEV_COMBO));
    } catch(e) {}

    console.log('=== V2DATA.FDB VŠETKY TABUĽKY S DÁTAMI ===\n');
    for (const t of tables) {
      const name = t.TNAME;
      try {
        const countRes = await query(`SELECT COUNT(*) AS CNT FROM ${name}`);
        const cnt = countRes[0].CNT;
        if (cnt > 0) {
          const desc = lookupMap.get(name) || '';
          const fields = await query(`SELECT TRIM(RDB$FIELD_NAME) AS FNAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${name}' ORDER BY RDB$FIELD_POSITION`);
          const fList = fields.map(f => f.FNAME).join(', ');
          console.log(`[${name}] rows: ${cnt} ${desc ? `(${desc})` : ''}\n  polia: ${fList}\n`);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    db.detach();
  }
});
