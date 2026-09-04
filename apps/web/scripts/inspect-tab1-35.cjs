const Firebird = require('node-firebird');

const options = {
  host: '127.0.0.1',
  port: 3050,
  database: '/firebird/data/V2DATA.FDB',
  user: 'SYSDBA',
  password: 'masterkey',
  pageSize: 4096
};

Firebird.attach(options, async (err, db) => {
  if (err) { console.error(err); process.exit(1); }

  const query = (sql) => new Promise((resolve, reject) => {
    db.query(sql, (err, res) => err ? reject(err) : resolve(res));
  });

  try {
    for (let i = 1; i <= 35; i++) {
      const pad = String(i).padStart(3, '0');
      const tname = `TAB${pad}`;
      try {
        const countRes = await query(`SELECT COUNT(*) AS CNT FROM ${tname}`);
        const cnt = countRes[0].CNT;
        const fields = await query(`SELECT TRIM(RDB$FIELD_NAME) AS FNAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${tname}' ORDER BY RDB$FIELD_POSITION`);
        const fNames = fields.map(f => f.FNAME).join(', ');
        console.log(`=== [${tname}] count: ${cnt} ===`);
        console.log(`Fields: ${fNames}`);
        if (cnt > 0) {
          const sample = await query(`SELECT FIRST 1 * FROM ${tname}`);
          // convert buffers to strings or omit long fields
          const clean = {};
          for (const [k, v] of Object.entries(sample[0] || {})) {
            if (Buffer.isBuffer(v)) {
              clean[k] = v.toString('utf8').slice(0, 50);
            } else if (typeof v === 'function') {
              clean[k] = '[BLOB/FUNCTION]';
            } else {
              clean[k] = v;
            }
          }
          console.log(`Sample:`, JSON.stringify(clean).slice(0, 300));
        }
        console.log('');
      } catch (e) {
        // Table might not exist or be named TABxxxX
      }
    }
  } catch (e) {
    console.error('Fatal:', e);
  } finally {
    db.detach();
  }
});
