const Firebird = require('node-firebird');
const iconv = require('iconv-lite');
const options = { host: '127.0.0.1', port: 3050, database: '/firebird/data/V2DATA.FDB', user: 'SYSDBA', password: 'masterkey' };

Firebird.attach(options, async (err, db) => {
  if (err) { console.error(err); process.exit(1); }
  const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, res) => err ? reject(err) : resolve(res)));
  const dec = (v) => Buffer.isBuffer(v) ? iconv.decode(v, 'win1250').trim() : (v ? String(v).trim() : '');

  const docs = await query('SELECT FIRST 15 o.ID_OBR, o.ID_PAC, o.NAZEV, o.POPIS, o.DNE, p.FILE_NAME FROM TAB058 o LEFT JOIN TAB059 p ON o.ID_OBR = p.ID_RADKU');
  console.log('Document / Image attachments in database:');
  for (const d of docs) {
    console.log(`Doc #${d.ID_OBR} for Patient ${d.ID_PAC}: ${dec(d.NAZEV)} | File: ${dec(d.FILE_NAME)} | Desc: ${dec(d.POPIS)} | Date: ${d.DNE}`);
  }

  const labs = await query('SELECT FIRST 10 C_PROTOK, ID_PACI, DATO, PROTOKOL, POZNAMKA FROM TAB045');
  console.log('\nLab reports (TAB045):');
  for (const l of labs) {
    console.log(`Lab #${l.C_PROTOK} for Patient ${l.ID_PACI}: Date: ${l.DATO} | Protocol: ${l.PROTOKOL} | Note: ${dec(l.POZNAMKA)}`);
  }

  const financialDocs = await query('SELECT COUNT(*) AS CNT FROM TAB060');
  console.log(`\nTotal Invoices / Financial receipts in TAB060: ${financialDocs[0].CNT}`);

  db.detach();
});
