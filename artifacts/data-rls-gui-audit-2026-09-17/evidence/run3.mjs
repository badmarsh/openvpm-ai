import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const dump = fs.readFileSync('/home/user/audit/schema.sql', 'utf8')
  .split('\n').filter((l) => !/^\\(un)?restrict /.test(l)).join('\n');
const db = await PGlite.create({ debug: 0 });
await db.exec(`SET client_min_messages = warning;\n${dump}`);
await db.exec('SET search_path TO public, pg_catalog;');

const stmts = [
  ['brief F1.1 clients', 'SELECT count(*) FROM clients'],
  ['brief F1.1 patients', 'SELECT count(*) FROM patients'],
  ['brief F1.1 "records"', 'SELECT count(*) FROM records'],
  ['brief F1.1 medical_records', 'SELECT count(*) FROM medical_records'],
  ['brief F1.1 encounters', 'SELECT count(*) FROM encounters'],
  ['brief F1.1 soap_notes', 'SELECT count(*) FROM soap_notes'],
  ['brief F1.2 orphan patients', 'SELECT count(*) FROM patients WHERE client_id IS NULL'],
  ['brief F1.2 orphan records', 'SELECT count(*) FROM records WHERE patient_id NOT IN (SELECT id FROM patients)'],
  ['brief F1.2 orphan appts', 'SELECT count(*) FROM appointments WHERE patient_id NOT IN (SELECT id FROM patients)'],
  ['brief F1.3 rls 29 tables', "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('patients','clients','appointments','records','invoices','products')"],
  ['brief F1.4 practice_id null (patients)', 'SELECT count(*) FROM patients WHERE practice_id IS NULL'],
  ['brief F1.4 practice_id null (records)', 'SELECT count(*) FROM records WHERE practice_id IS NULL'],
  ['appointments today (utc cast)', 'SELECT count(*) FROM appointments WHERE start_time::date = CURRENT_DATE'],
  ['appointments today (tz aware)', "SELECT count(*) FROM appointments WHERE (start_time AT TIME ZONE 'Europe/Bratislava')::date = CURRENT_DATE"],
  ['table named "records" exists?', "SELECT count(*) FROM pg_class WHERE relname='records' AND relnamespace='public'::regnamespace"],
];
const res = [];
for (const [label, sql] of stmts) {
  try { const r = await db.query(sql); res.push([label, 'OK', JSON.stringify(r.rows[0] ?? null)]); }
  catch (e) { res.push([label, 'ERROR', e.message.split('\n')[0]]); }
}
let out = '=== Brief SQL re-executed against the real schema (PG16 / PGlite) ===\n';
for (const [l, s, d] of res) out += `${s.padEnd(5)} | ${l.padEnd(36)} | ${d}\n`;
// FK index coverage count
const idx = await db.query(`
  with fkcols as (
    select cl.relname as child, a.attname as col, c.conrelid
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname='public'
    cross join lateral unnest(c.conkey) with ordinality as x(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = x.attnum
    where c.contype='f' and x.ord = 1
  )
  select count(*) filter (where not exists (select 1 from pg_index i
        where i.indrelid = f.conrelid and i.indkey[0] = f.attnum)) as unindexed,
         count(*) as total_fk
  from (select distinct child, col, conrelid, (select attnum from pg_attribute a
          where a.attrelid=f0.conrelid and a.attname=f0.col) as attnum
        from fkcols f0) f`);
out += `\nFK columns: ${idx.rows[0].total_fk} leading-column FKs, ${idx.rows[0].unindexed} without a supporting index\n`;
console.log(out);
fs.writeFileSync('/home/user/audit/pg/03-brief-sql.txt', out);
