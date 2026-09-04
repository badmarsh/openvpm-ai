const Firebird = require('node-firebird');
const options = { host: '127.0.0.1', port: 3050, database: '/firebird/data/V2DATA.FDB', user: 'SYSDBA', password: 'masterkey' };

Firebird.attach(options, async (err, db) => {
  if (err) { console.error(err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => {
    db.query(sql, (err, res) => err ? reject(err) : resolve(res));
  });

  for (const t of ['TAB001', 'TAB002', 'TAB003', 'TAB004', 'TAB005']) {
    const fields = await query(`SELECT TRIM(RDB$FIELD_NAME) AS FNAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${t}' ORDER BY RDB$FIELD_POSITION`);
    const countRes = await query(`SELECT COUNT(*) AS CNT FROM ${t}`);
    console.log(`=== ${t} (${countRes[0].CNT} rows) ===`);
    console.log('Fields:', fields.map(f => f.FNAME).join(', '));
    const sample = await query(`SELECT FIRST 2 * FROM ${t}`);
    const row = sample[1] || sample[0];
    const clean = {};
    for (const [k, v] of Object.entries(row || {})) {
      clean[k] = Buffer.isBuffer(v) ? v.toString('utf8').slice(0, 50) : (typeof v === 'function' ? '[BLOB]' : v);
    }
    console.log('Sample:', JSON.stringify(clean));
    console.log('');
  }
  db.detach();
});
