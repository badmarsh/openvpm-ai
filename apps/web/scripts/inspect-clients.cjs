const Firebird = require('node-firebird');
const iconv = require('iconv-lite');
const options = { host: '127.0.0.1', port: 3050, database: '/firebird/data/V2DATA.FDB', user: 'SYSDBA', password: 'masterkey' };

Firebird.attach(options, async (err, db) => {
  if (err) { console.error(err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, res) => err ? reject(err) : resolve(res)));
  const dec = (v) => Buffer.isBuffer(v) ? iconv.decode(v, 'win1250').trim() : (v ? String(v).trim() : '');

  const clients = await query('SELECT FIRST 10 KOD_KADO, TITUL, NAZEV_KADO, POZNAMKA_KADO, MESTO_K, BANKA_K, TELEFON, MOBIL, EMAIL, VYMAZ FROM TAB005 WHERE KOD_KADO > 0 ORDER BY KOD_KADO');
  for (const c of clients) {
    console.log(`Client #${c.KOD_KADO}: ${dec(c.TITUL)} ${dec(c.POZNAMKA_KADO)} ${dec(c.NAZEV_KADO)} | Addr: ${dec(c.MESTO_K)}, ${dec(c.BANKA_K)} | Tel: ${dec(c.TELEFON)} | Mob: ${dec(c.MOBIL)} | Email: ${dec(c.EMAIL)} | Vymaz: ${c.VYMAZ}`);
  }
  const delCnt = await query('SELECT VYMAZ, COUNT(*) AS CNT FROM TAB005 GROUP BY VYMAZ');
  console.log('\nClient deletion breakdown:', delCnt);

  const patCnt = await query('SELECT VYMAZ, COUNT(*) AS CNT FROM TAB006 GROUP BY VYMAZ');
  console.log('Patient deletion breakdown:', patCnt);

  const visitCnt = await query('SELECT VYMAZ, COUNT(*) AS CNT FROM TAB010 GROUP BY VYMAZ');
  console.log('Visit deletion breakdown:', visitCnt);

  const vacCnt = await query('SELECT VYMAZ, COUNT(*) AS CNT FROM TAB018 GROUP BY VYMAZ');
  console.log('Vaccination deletion breakdown:', vacCnt);

  db.detach();
});
