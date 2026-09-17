import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const raw = fs.readFileSync('/home/user/audit/schema.sql', 'utf8');
// psql 16 meta-commands are not understood by PGlite
const sqlDump = raw
  .split('\n')
  .filter((l) => !/^\\(un)?restrict /.test(l))
  .join('\n');

const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

const db = await PGlite.create({ debug: 0 });

// 1) load schema
try {
  await db.exec(`SET client_min_messages = warning; SET row_security = off;`);
  await db.exec(sqlDump);
  log('DDL_LOAD: OK (schema.sql executed without error)');
} catch (e) {
  log('DDL_LOAD: FAILED -> ' + e.message);
}

const q = async (label, sql, params) => {
  try {
    const r = await db.query(sql, params);
    log(`\n### ${label}`);
    if (!r.rows.length) { log('  (0 rows)'); return []; }
    const cols = Object.keys(r.rows[0]);
    log('  ' + cols.join(' | '));
    for (const row of r.rows.slice(0, 40)) log('  ' + cols.map((c) => String(row[c])).join(' | '));
    if (r.rows.length > 40) log(`  ... +${r.rows.length - 40} more`);
    return r.rows;
  } catch (e) {
    log(`\n### ${label}\n  QUERY_ERROR: ${e.message}`);
    return null;
  }
};

// 2) structural summary
await q('schema object counts', `
  select
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r') as tables,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_enabled,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relforcerowsecurity) as rls_forced,
    (select count(*) from pg_policy) as policies,
    (select count(*) from pg_constraint where contype='f') as foreign_keys,
    (select count(*) from pg_indexes where schemaname='public') as indexes,
    (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and t.typtype='e') as enums`);

await q('tables WITHOUT rls', `
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1`);

await q('rls tables with NO policy (deny-all)', `
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid=c.oid) order by 1`);

await q('tenant tables: practice_id nullability / FK / rls', `
  select c.relname as tbl,
         a.attnotnull as not_null,
         exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='f'
                 and k.conkey = array[a.attnum]) as has_fk,
         c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  join pg_attribute a on a.attrelid=c.oid and a.attname='practice_id'
  where n.nspname='public' and c.relkind='r' and a.attnum>0
    and (not a.attnotnull or not exists(select 1 from pg_constraint k
             where k.conrelid=c.oid and k.contype='f' and k.conkey = array[a.attnum])
         or not c.relrowsecurity)
  order by 1`);

await q('FK child columns with NO index (seq-scan / lock risk on parent delete)', `
  with fkcols as (
    select cl.relname as child, pr.relname as parent, a.attname as col, c.conrelid
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_class pr on pr.oid = c.confrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname='public'
    cross join lateral unnest(c.conkey) with ordinality as x(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = x.attnum
    where c.contype='f' and x.ord = 1
  )
  select child, parent, col from fkcols f
  where not exists (
    select 1 from pg_index i
    where i.indrelid = f.conrelid
      and i.indkey[0] = (select attnum from pg_attribute a
                          where a.attrelid=f.conrelid and a.attname=f.col)
  )
  order by child, col`);

log('\n[done]');
fs.writeFileSync('/home/user/audit/pg/01-structure.txt', out.join('\n'));
