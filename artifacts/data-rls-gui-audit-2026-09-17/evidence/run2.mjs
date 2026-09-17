import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const raw = fs.readFileSync('/home/user/audit/schema.sql', 'utf8');
const dump = raw.split('\n').filter((l) => !/^\\(un)?restrict /.test(l)).join('\n');

const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const PASS = [], FAIL = [], WARN = [];
const check = (id, ok, label, detail = '') => {
  (ok ? PASS : FAIL).push(`${id}: ${label}${detail ? ' — ' + detail : ''}`);
  log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${label}${detail ? '\n        ' + detail : ''}`);
};

process.on('uncaughtException', e => { console.log('FATAL: ' + (e.message||'').split('\n')[0]); process.exit(1); });
const db = await PGlite.create({ debug: 0 });
await db.exec(`SET client_min_messages = warning;\n${dump}`);
await db.exec('SET search_path TO public, pg_catalog; SET row_security = on;');

// ---- role topology mirroring packages/db/rls/enable-rls.sql --------------
await db.exec(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='openpims') THEN CREATE ROLE openpims; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='openpims_app') THEN CREATE ROLE openpims_app; END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO openpims, openpims_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openpims_app;
  DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO openpims', r.tablename);
    END LOOP;
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
      EXECUTE format('ALTER SEQUENCE public.%I OWNER TO openpims', r.sequencename);
    END LOOP;
    FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
             WHERE n.nspname='public' AND t.typtype='e' LOOP
      EXECUTE format('ALTER TYPE public.%I OWNER TO openpims', r.typname);
    END LOOP;
  END $$;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openpims_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO openpims_app;
`);
log('# roles: openpims = table OWNER (RLS bypassed), openpims_app = least-privilege (RLS enforced)');

const asOwner = async (sql) => { await db.exec('RESET ROLE; SET row_security = off;'); return db.query(sql); };
const asApp = async (sql, ctx = {}) => {
  let pre = ["SET ROLE openpims_app;", "SET row_security = on;", "SELECT set_config(\'app.current_practice_id\',\'\',false);", "SELECT set_config(\'app.rls_bypass\',\'\',false);", ""].join(String.fromCharCode(10));
  if (ctx.practice) pre += `SET app.current_practice_id = '${ctx.practice}';\n`;
  if (ctx.bypass) pre += `SET app.rls_bypass = 'on';\n`;
  await db.exec(pre);
  try { return await db.query(sql); } finally { await db.exec('RESET ROLE;'); }
};

const P1 = '5c4ebbbc-90e1-457a-87a7-7895f560317d';   // MVDr. Sykora (pilot, from the brief)
const P2 = '00000000-0000-4000-8000-000000000002';   // attacker/other clinic
const U1 = '11111111-1111-4111-8111-111111111111';
const CL1 = '22222222-2222-4222-8222-222222222222';
const CL2 = '22222222-2222-4222-8222-222222222299';
const PT1 = '33333333-3333-4333-8333-333333333333';
const PT2 = '33333333-3333-4333-8333-333333333399';
const AP1 = '44444444-4444-4444-8444-444444444444';
const SN1 = '55555555-5555-4555-8555-555555555555';

await db.exec('RESET ROLE; SET ROLE openpims;');
await db.exec(`
INSERT INTO practices (id, name, timezone, country, currency) VALUES
  ('${P1}','Klinika MVDr. Sykora','Europe/Bratislava','SK','eur'),
  ('${P2}','Sutazna Klinika s.r.o.','Europe/Bratislava','SK','eur');
INSERT INTO locations (id, practice_id, name, is_primary) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','${P1}','Rimavská Sobota',true),
  ('aaaaaaaa-0000-4000-8000-000000000002','${P2}','Pobocna',true);
INSERT INTO users (id, email, password_hash, name, role, practice_id, location_id, is_veterinarian) VALUES
  ('${U1}','admin@vetsykora.sk','x','MVDr. Martin Sykora','veterinarian','${P1}','aaaaaaaa-0000-4000-8000-000000000001',true);
INSERT INTO clients (id, practice_id, first_name, last_name, email, phone, sms_consent) VALUES
  ('${CL1}','${P1}','Janko','Mrkvicka','j@x.sk','0901000000',true),
  ('${CL2}','${P2}','Fuzo','Kapusta','f@y.sk','0902000000',false);
INSERT INTO patients (id, practice_id, client_id, name, species, status) VALUES
  ('${PT1}','${P1}','${CL1}','Rex','canine','active'),
  ('${PT2}','${P2}','${CL2}','Micka','feline','deceased');
INSERT INTO appointments (id, practice_id, start_time, end_time, patient_id, client_id, doctor_id, status) VALUES
  ('${AP1}','${P1}', date_trunc('day', now()) + interval '8 hours', date_trunc('day', now()) + interval '9 hours',
     '${PT1}', '${CL1}', '${U1}', 'in_exam');
INSERT INTO soap_notes (id, practice_id, patient_id, appointment_id, author_id, author_name,
                        subjective, status) VALUES
  ('${SN1}','${P1}','${PT1}','${AP1}','${U1}','MVDr. Sykora','pes kaśle','finalized');
INSERT INTO invoices (practice_id, client_id, patient_id, appointment_id, status, total)
  VALUES ('${P1}','${CL1}','${PT1}','${AP1}','draft', 50.00);
`);
await db.exec('RESET ROLE;');
log('# seed: 2 practices × (client, patient, appointment, soap note, invoice)\n');

// practice with NO location row -> appointment insert must fail (trigger guard)
let noLoc;
await db.exec(`SET ROLE openpims;
INSERT INTO practices (id, name, timezone) VALUES ('${'bbbbbbbb-bbbb-4bbb-8bbb-000000000003'}','Klinika bez lokality','Europe/Bratislava');`);
try {
  await db.exec(`INSERT INTO appointments (practice_id, start_time, end_time, status)
                 VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003', now(), now()+interval '30 min','scheduled');`);
  noLoc = 'ACCEPTED';
} catch (e) { noLoc = 'REJECTED: ' + e.message.split('\n')[0]; }
await db.exec(`DELETE FROM practices WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-000000000003'; RESET ROLE;`);
check('INT-0', noLoc.startsWith('REJECTED'), 'appointments cannot be scheduled for a practice with 0 locations (hard trigger error)', noLoc);

// =============================== RLS behaviour =============================
log('--- RLS / tenant isolation (as openpims_app) ---');

let r = await asApp('SELECT count(*)::int AS n FROM patients');
check('RLS-1', r.rows[0].n === 0, 'deny-by-default when app.current_practice_id is unset', `patients visible = ${r.rows[0].n}`);

r = await asApp('SELECT count(*)::int AS n FROM patients', { practice: P1 });
check('RLS-2', r.rows[0].n === 1, 'tenant sees exactly its own rows', `n=${r.rows[0].n}`);

r = await asApp('SELECT count(*)::int AS n FROM clients JOIN patients p ON p.client_id=clients.id', { practice: P1 });
check('RLS-3', r.rows[0].n === 1, 'tenant join patients↔clients intact', `n=${r.rows[0].n}`);

r = await asApp('SELECT count(*)::int AS n FROM soap_notes', { practice: P2 });
check('RLS-4', r.rows[0].n === 0, 'other tenant cannot read clinical notes', `n=${r.rows[0].n}`);

try {
  r = await asApp(`UPDATE patients SET name='HACKED' WHERE id='${PT2}'`, { practice: P1 });
  r = await asApp(`SELECT count(*)::int AS n FROM patients WHERE id='${PT2}' AND name='HACKED'`, { practice: P2 });
  check('RLS-5', r.rows[0].n === 0, 'cross-tenant UPDATE silently matches 0 rows (no leak)', 'blocked');
} catch (e) { check('RLS-5', true, 'cross-tenant UPDATE rejected', e.message.slice(0, 90)); }

try {
  r = await asApp(`INSERT INTO patients (practice_id, client_id, name, species) VALUES ('${P2}','${CL2}','INTRUDER','canine')`, { practice: P1 });
  check('RLS-6', false, 'cross-tenant INSERT accepted (WITH CHECK not enforced!)', 'new row created under P2 while GUC=P1');
} catch (e) {
  check('RLS-6', /row-level security policy/.test(e.message), 'cross-tenant INSERT rejected by WITH CHECK', e.message.split('\n')[0].slice(0, 90));
}

r = await asApp('SELECT count(*)::int AS n FROM patients', { bypass: true });
check('RLS-7', r.rows[0].n === 2, 'app.rls_bypass=on exposes ALL tenants (pool-leak blast radius)', `n=${r.rows[0].n}`);

await db.exec('SET ROLE openpims;');
r = await db.query('SELECT count(*)::int AS n FROM patients');
await db.exec('RESET ROLE;');
check('RLS-8', r.rows[0].n === 2, 'OWNER role (openpims) sees every tenant — RLS inert on owner connections', `n=${r.rows[0].n}`);

r = await asApp(`SELECT count(*)::int AS n FROM users`, { practice: P1 });
check('RLS-9', true, `users table under tenant RLS: readable rows for tenant ctx = ${r.rows[0].n} (0 = login/user lookups must use withSystem)`);

r = await asApp('SELECT count(*)::int AS n FROM practices', { practice: P1 });
check('RLS-10', r.rows[0].n === 1, 'practices policy = self only', `n=${r.rows[0].n}`);

// ============================ integrity constraints ========================
log('\n--- Referential integrity (what the brief asked to SELECT) ---');
const err = async (label, sqlText) => {
  try { await db.exec(`SET ROLE openpims; ${String(sqlText).trim().replace(/;\s*$/,'')}; RESET ROLE;`); return { ok: true }; }
  catch (e) { await db.exec('RESET ROLE;'); return { ok: false, msg: e.message.split('\n')[0] }; }
};
let x = await err('', `INSERT INTO patients (practice_id, client_id, name, species) VALUES ('${P1}', NULL, 'orphan', 'canine')`);
check('INT-1', !x.ok && /not-null|null value/i.test(x.msg), 'patients.client_id IS NULL impossible (NOT NULL)', x.msg || 'ACCEPTED — orphans possible');
x = await err('', `INSERT INTO patients (practice_id, client_id, name, species) VALUES ('${P1}', '00000000-0000-4000-8000-00000000dead', 'orphan', 'canine')`);
check('INT-2', !x.ok, 'patients → missing client rejected by FK', x.msg || 'accepted');
x = await err('', `INSERT INTO soap_notes (practice_id, patient_id, author_id, author_name) VALUES ('${P1}','00000000-0000-4000-8000-00000000dead','${U1}','x')`);
check('INT-3', !x.ok, 'soap_notes → missing patient rejected by FK', x.msg || 'accepted');
x = await err('', `INSERT INTO appointments (practice_id, start_time, end_time, patient_id) VALUES ('${P1}', now(), now()+interval '30 min','00000000-0000-4000-8000-00000000dead')`);
check('INT-4', !x.ok, 'appointments → missing patient rejected by FK', x.msg || 'accepted');
x = await err('', `INSERT INTO appointments (practice_id, start_time, end_time) VALUES ('${P1}', now(), now()+interval '30 min')`);
check('INT-5', x.ok, 'appointments WITHOUT patient_id allowed (patient_id NULLABLE — walk-in/no-show rows)', x.ok ? 'NULL patient accepted' : x.msg);

// soft delete + cross-practice mix
x = await err('', `INSERT INTO patients (practice_id, client_id, name, species) VALUES ('${P2}','${CL1}','mix', 'canine')`);
check('INT-6', !x.ok, 'cross-practice FK (patient of P2 owned by P1 client) rejected',
  x.ok ? 'ACCEPTED — no composite (id, client_id, practice_id) FK ⇒ cross-tenant mis-parenting possible' : x.msg);

// ON DELETE behaviour
let del;
try { await db.exec(`SET ROLE openpims; DELETE FROM patients WHERE id='${PT1}'; RESET ROLE;`); del='deleted'; }
catch(e){ await db.exec('RESET ROLE;'); del='REJECTED: '+e.message.split('\n')[0]; }
r = await asOwner(`SELECT count(*)::int AS n FROM appointments WHERE id='${AP1}'`); await db.exec('RESET ROLE;');
const apn = r.rows[0].n;
r = await asOwner(`SELECT count(*)::int AS n FROM soap_notes WHERE id='${SN1}'`); await db.exec('RESET ROLE;');
const snn = r.rows[0].n;
log(`  hard DELETE of a patient with clinical history -> ${del}`);
log(`  after that: appointments rows=${apn}, soap_notes rows=${snn}`);
check('INT-7', true, `patient hard-delete outcome recorded (appointments=${apn}, soap_notes=${snn})`);

// ============================ today / timezone =============================
log('\n--- getToday date-window semantics (Europe/Bratislava vs UTC) ---');
await db.exec(`SET ROLE openpims;
INSERT INTO appointments (practice_id, start_time, end_time, status) VALUES
  ('${P1}', ('2026-09-17 00:20+02')::timestamptz, ('2026-09-17 00:50+02')::timestamptz, 'checked_out'),
  ('${P1}', ('2026-09-17 23:30+02')::timestamptz, ('2026-09-18 00:10+02')::timestamptz, 'scheduled');
RESET ROLE;`);
r = await asOwner(`
  select
    (select count(*) from appointments where start_time::date = date '2026-09-17') as utc_cast_date,
    (select count(*) from appointments where start_time >= '2026-09-17 00:00+02' and start_time < '2026-09-18 00:00+02') as bratislava_window,
    (select count(*) from appointments where (start_time at time zone 'Europe/Bratislava')::date = date '2026-09-17') as tz_local_date`);
await db.exec('RESET ROLE;');
log(`  naive "start_time::date = CURRENT_DATE" → ${r.rows[0].utc_cast_date} rows | ` +
    `+02 window → ${r.rows[0].bratislava_window} rows | at time zone Europe/Bratislava → ${r.rows[0].tz_local_date} rows`);
check('TZ-1', Number(r.rows[0].utc_cast_date) !== Number(r.rows[0].bratislava_window),
  'UTC-cast date window differs from Bratislava local day window (skew exists in schema semantics)',
  `utc=${r.rows[0].utc_cast_date} local=${r.rows[0].bratislava_window}`);

fs.writeFileSync('/home/user/audit/pg/02-rls.txt', out.join('\n'));
log('\n================ SUMMARY ================');
log(`PASS ${PASS.length}  FAIL ${FAIL.length}`);
FAIL.forEach((f) => log('  ! ' + f));
