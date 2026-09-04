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
  if (err) {
    console.error('Attach error:', err);
    process.exit(1);
  }

  const query = (sql) => new Promise((resolve, reject) => {
    db.query(sql, (err, res) => err ? reject(err) : resolve(res));
  });

  try {
    const tables = await query('SELECT TRIM(RDB$RELATION_NAME) AS TNAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$RELATION_NAME');
    console.log(`Found ${tables.length} tables in V2DATA.FDB:\n`);

    for (const t of tables) {
      const name = t.TNAME;
      try {
        const countRes = await query(`SELECT COUNT(*) AS CNT FROM ${name}`);
        const cnt = countRes[0].CNT;
        if (cnt > 0) {
          const fields = await query(`SELECT TRIM(RDB$FIELD_NAME) AS FNAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = '${name}' ORDER BY RDB$FIELD_POSITION`);
          const fNames = fields.map(f => f.FNAME).join(', ');
          console.log(`[${name}] rows: ${cnt}\n  fields: ${fNames}\n`);
        }
      } catch (e) {
        console.error(`Error on ${name}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Fatal error:', e);
  } finally {
    db.detach();
  }
});
