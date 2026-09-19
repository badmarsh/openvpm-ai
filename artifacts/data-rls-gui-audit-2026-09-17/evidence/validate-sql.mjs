import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const dump = fs.readFileSync('/home/user/audit/schema.sql', 'utf8')
  .split('\n').filter((l) => !/^\\(un)?restrict /.test(l)).join('\n');
const target = process.argv[2];
const raw = fs.readFileSync(target, 'utf8');
// strip psql meta-commands, keep SQL
const body = raw.split('\n').filter((l) => !/^\\/.test(l)).join('\n');

const db = await PGlite.create({ debug: 0 });
await db.exec(`SET client_min_messages = warning;\n${dump}`);
await db.exec('SET search_path TO public, pg_catalog; SET row_security = off;');

// split on top-level ; respecting $$ quotes and comments
const stmts = [];
let cur = '', dollarTag = null, inLine = false, inBlock = false;
for (let i = 0; i < body.length; i++) {
  const c = body[i];
  if (inLine) { cur += c; if (c === '\n') inLine = false; continue; }
  if (inBlock) { cur += c; if (c === '*' && body[i + 1] === '/') { cur += '/'; i++; inBlock = false; } continue; }
  if (c === '-' && body[i + 1] === '-') { inLine = true; cur += c; continue; }
  if (c === '/' && body[i + 1] === '*') { inBlock = true; cur += c; continue; }
  if (c === "'" || c === '`') { const q = c; cur += c; i++; while (i < body.length && body[i] !== q) { cur += body[i]; i++; } cur += q; continue; }
  if (dollarTag) {
    if (body.startsWith(dollarTag, i)) { cur += dollarTag; i += dollarTag.length - 1; dollarTag = null; }
    else cur += c;
    continue;
  }
  if (c === '$') { const m = /^\$\w*\$/.exec(body.slice(i)); if (m) { dollarTag = m[0]; cur += dollarTag; i += dollarTag.length - 1; continue; } }
  if (c === ';') { if (cur.trim()) stmts.push(cur); cur = ''; continue; }
  cur += c;
}
if (cur.trim()) stmts.push(cur);

let ok = 0, bad = 0;
for (const [n, st] of stmts.entries()) {
  const label = st.trim().split('\n').filter((l) => l.trim() && !l.trim().startsWith('--'))[0]?.slice(0, 72) ?? '?';
  try {
    const r = await db.query(st);
    const rows = r.rows?.length ?? 0;
    console.log(`OK   [${String(n + 1).padStart(2)}] rows=${String(rows).padStart(3)}  ${label}`);
    ok++;
  } catch (e) {
    console.log(`FAIL [${String(n + 1).padStart(2)}] ${e.message.split('\n')[0]}\n      stmt: ${label}`);
    bad++;
  }
}
console.log(`\n${ok} statements OK, ${bad} failed`);
fs.writeFileSync('/home/user/openvpm-ai/artifacts/data-rls-gui-audit-2026-09-17/evidence/07-live-checks-validation.txt',
  `${ok} statements OK, ${bad} failed\n`);
process.exitCode = bad ? 1 : 0;
