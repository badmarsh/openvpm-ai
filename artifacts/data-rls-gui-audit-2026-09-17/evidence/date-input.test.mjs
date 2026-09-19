// Executable check of apps/web/lib/date-input.ts (the module every "today"
// query in the app relies on). Container reality: process TZ = UTC.
process.env.TZ = 'UTC';
const m = await import('./out/date-input.js');

const iso = (d) => new Date(d).toISOString();
let pass = 0, fail = 0;
const expect = (id, got, want, note = '') => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(46)} got=${got} want=${want}${note ? '  (' + note + ')' : ''}`);
};

// 1) normal summer day, practice TZ = Europe/Bratislava (CEST, +02:00)
let inst = Date.UTC(2026, 8, 17, 10, 0); // 12:00 Bratislava
let r = m.dateInputUtcRangeForTimeZone(new Date(inst), 'Europe/Bratislava');
expect('SK summer day window start', iso(r.start), '2026-09-16T22:00:00.000Z');
expect('SK summer day window end', iso(r.end), '2026-09-17T22:00:00.000Z');
expect('SK summer day label', r.date, '2026-09-17');

// 2) the same instant, but practice TZ left at the schema default (US)
r = m.dateInputUtcRangeForTimeZone(new Date(inst), 'America/New_York');
expect('US-default TZ shifts the clinic day (start)', iso(r.start), '2026-09-17T04:00:00.000Z',
  'a Bratislava morning appointment is silently outside this window');

// 3) NULL timezone (practice row without timezone) -> runtime-local = UTC
r = m.dateInputUtcRangeForTimeZone(new Date(inst), null);
expect('NULL tz -> UTC day boundary (start)', iso(r.start), '2026-09-17T00:00:00.000Z');
expect('NULL tz -> UTC day boundary (end)', iso(r.end), '2026-09-18T00:00:00.000Z');

// 4) invalid timezone string must not throw (Intl guard)
try {
  r = m.dateInputUtcRangeForTimeZone(new Date(inst), 'Europe/Krakovany');
  expect('invalid tz does not throw', 'no-throw', 'no-throw');
  expect('invalid tz falls back to UTC day', iso(r.start), '2026-09-17T00:00:00.000Z',
    'silent server-local fallback = the exact bug class the brief asks about');
} catch (e) {
  expect('invalid tz does not throw', 'throw:' + e.message, 'no-throw');
}

// 5) late-night SK appointment vs UTC day: 00:30 in Bratislava on the 17th
const preMidnightUtc = Date.UTC(2026, 8, 16, 22, 30); // 00:30 +02:00 on 17 Sep
expect('17.9. 00:30 SK, formatted with SK tz', m.formatDateInputForTimeZone(new Date(preMidnightUtc), 'Europe/Bratislava'), '2026-09-17');
expect('17.9. 00:30 SK, formatted with UTC tz ', m.formatDateInputForTimeZone(new Date(preMidnightUtc), 'UTC'), '2026-09-16');

// 6) DST spring-forward 2026-03-29 (SK): local day is 23 h
r = m.dateInputDayUtcRange('2026-03-29', 'Europe/Bratislava');
const hours = (r.end - r.start) / 3.6e6;
expect('DST spring day length (h)', String(hours), '23');
expect('DST spring window start', iso(r.start), '2026-03-28T23:00:00.000Z');

// 7) DST fall-back 2026-10-25 (SK): local day is 25 h
r = m.dateInputDayUtcRange('2026-10-25', 'Europe/Bratislava');
expect('DST autumn day length (h)', String((r.end - r.start) / 3.6e6), '25');
expect('DST autumn window start', iso(r.start), '2026-10-24T22:00:00.000Z');

// 8) datetime-local parsing uses clinic wall time, not browser time
const parsed = m.dateTimeLocalInputUtcInstant('2026-09-17T08:00', 'Europe/Bratislava');
expect('clinic wall time 08:00 -> UTC', iso(parsed), '2026-09-17T06:00:00.000Z');
const parsedNoTz = m.dateTimeLocalInputUtcInstant('2026-09-17T08:00', null);
expect('no tz -> browser/runtime local (UTC)', iso(parsedNoTz), '2026-09-17T08:00:00.000Z');

// 9) non-existent local time during spring-forward gap must be rejected, not silently shifted
const gap = m.dateTimeLocalInputUtcInstant('2026-03-29T02:30', 'Europe/Bratislava');
expect('29.3.2026 02:30 SK (gap) rejected', String(gap), 'null');

// 10) round-trip formatting
expect('format back from UTC instant', m.formatDateTimeLocalInputForTimeZone(new Date('2026-09-17T06:00:00Z'), 'Europe/Bratislava'), '2026-09-17T08:00');
expect('format back w/o tz returns ""', m.formatDateTimeLocalInputForTimeZone(new Date('2026-09-17T06:00:00Z'), null), '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
