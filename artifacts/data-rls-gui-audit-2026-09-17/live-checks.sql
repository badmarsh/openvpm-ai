-- ============================================================================
-- OpenVPM AI — LIVE overenie auditu (spustiť na dev.significa.sk:5434)
-- Dátum: 2026-09-17 | cieľ: DVK pilotnej kliniky MVDr. M. Sýkoru
-- pilotná klinika: 5c4ebbbc-90e1-457a-87a7-7895f560317d
--
-- Použitie:
--   PGPASSWORD=... psql "postgresql://openpims@dev.significa.sk:5434/openvpm_ai" \
--        -f live-checks.sql -o live-checks.out
--
-- Všetky dotazy sú offline-overené voči skutočnej schéme (schema.sql) v reálnom
-- PostgreSQL 16 (PGlite/WASM). Pôvodné dotazy zo zadania používali tabuľky
-- `records`, `medical_records`, `encounters`, ktoré v schéme NEEXISTUJÚ —
-- klinické záznamy sú v `soap_notes`.
-- ============================================================================

\set ON_ERROR_STOP off
\t on

-- ─── 0. PROVENIENCIA / KTO SPOJA ───────────────────────────────────────────
-- Ak je current_user vlastník tabuliek, RLS je na tejto konekcii VYPNUTÉ.
select
  current_database()                                   as db,
  current_user                                         as usr,
  (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls,
  (select rolsuper     from pg_roles where rolname = current_user) as superuser,
  exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname='public' and c.relname='patients' and c.relowner =
             (select oid from pg_roles where rolname = current_user)) as owns_tables,
  current_setting('server_version')                     as pg_version,
  now() at time zone 'UTC'                              as utc_now,
  now() at time zone 'Europe/Bratislava'                as bratislava_now;

-- ─── 1. OBJEM DÁT (očakávanie zadania: 2185 / 2952 / 6664) ────────────────
select 'clients'      as tbl, count(*) from clients      union all
select 'patients'     as tbl, count(*) from patients     union all
select 'soap_notes'   as tbl, count(*) from soap_notes   union all
select 'appointments' as tbl, count(*) from appointments union all
select 'invoices'     as tbl, count(*) from invoices     union all
select 'products'     as tbl, count(*) from products     union all
select 'clinical_notes (legacy, čaká sa 0)' as tbl, count(*) from clinical_notes
order by 1;

-- ─── 2. DNEŠNÉ VYŠETRENIA —správne poňatie (lokálny deň kliniky) ──────────
-- 2a) mriežka podľa stavov pre DNEŠNOK v časovom pásme kliniky
with day as (
  select p.id as practice_id,
         p.timezone,
         date_trunc('day', now() at time zone coalesce(p.timezone,'Europe/Bratislava')) as local_day
  from practices p
  where p.deleted_at is null
)
select d.practice_id, d.timezone, d.local_day,
       count(a.id)                                                   as total_today,
       count(a.id) filter (where a.status = 'checked_in')           as checked_in,
       count(a.id) filter (where a.status = 'in_exam')             as in_exam,
       count(a.id) filter (where a.status = 'checked_out')         as checked_out,
       count(a.id) filter (where a.status = 'confirmed')           as confirmed,
       count(a.id) filter (where a.status = 'scheduled')          as scheduled_only,
       count(a.id) filter (where a.patient_id is null)            as today_without_patient
from day d
left join appointments a
       on a.practice_id = d.practice_id
      and a.deleted_at is null
      and a.start_time >= d.local_day
      and a.start_time <  d.local_day + interval '1 day'
group by 1,2,3
order by 4 desc;

-- 2b) DÔKAZ o posune UTC vs. lokálny deň: koľko záznamov "zmizne" pri naívnom
--     `start_time::date = CURRENT_DATE` (to je cesta, ktorou sa uberá GUI, ak
--     practices.timezone je nastavené chybe).
select
  count(*) filter (
    where (a.start_time at time zone coalesce(p.timezone,'UTC'))::date =
          (now() at time zone coalesce(p.timezone,'UTC'))::date
  ) as local_day_rows,
  count(*) filter (where a.start_time::date = current_date) as utc_cast_rows,
  count(*) filter (
    where (a.start_time at time zone coalesce(p.timezone,'UTC'))::date =
          (now() at time zone coalesce(p.timezone,'UTC'))::date
  ) - count(*) filter (where a.start_time::date = current_date) as lost_by_utc_cast
from appointments a
join practices p on p.id = a.practice_id and p.deleted_at is null
where a.deleted_at is null;

-- ─── 3. SIROTSKÉ ZÁZNAMY (skutočné ohrozenia, nie tie schémou vylúčené) ───
-- 3a) pacienti bez majiteľa: vylúčené schémou (patients.client_id NOT NULL + FK)
select 'patients.client_id IS NULL (vždy 0 — NOT NULL)' as check_name,
       count(*) as n from patients where client_id is null
union all
-- 3b) reálne ohrozenie: termíny bez pacienta (patient_id je NULLABLE)
select 'appointments.patient_id IS NULL (walk-in/no-patient)', count(*)
  from appointments where patient_id is null
union all
select 'appointments.client_id IS NULL', count(*)
  from appointments where client_id is null
union all
-- 3c) cross-tenant parentovstvo (chýba zložený FK — overené execuciou)
select 'patients ↔ clients mimo rovnakej kliniky', count(*)
  from patients pt
  join clients c on c.id = pt.client_id
 where c.practice_id <> pt.practice_id
union all
select 'appointments ↔ patients mimo kliniky', count(*)
  from appointments a
  join patients pt on pt.id = a.patient_id
 where pt.practice_id <> a.practice_id
union all
select 'soap_notes ↔ patients mimo kliniky', count(*)
  from soap_notes s
  join patients pt on pt.id = s.patient_id
 where pt.practice_id <> s.practice_id
union all
select 'invoices.appointment_id mimo kliniky', count(*)
  from invoices i
  join appointments a on a.id = i.appointment_id
 where a.practice_id <> i.practice_id
union all
select 'SOAP bez appointment_id (voľiteľné)', count(*)
  from soap_notes where appointment_id is null and deleted_at is null;

-- ─── 4. RLS STAV (zadanie očakávalo "29 kritických tabuliek"; reálne 174) ──
select c.relname as table_name,
       c.relrowsecurity        as rls_enabled,
       c.relforcerowsecurity   as rls_forced,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
       (select bool_or(pg_get_expr(q.polqual, c.oid) ilike '%app_current_practice_id%'
                         or pg_get_expr(q.polwithcheck, c.oid) ilike '%app_current_practice_id%')
          from pg_policy q where q.polrelid = c.oid) as tenant_expr
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('patients','clients','appointments','soap_notes','invoices',
                     'products','users','controlled_substance_log','vaccination_records',
                     'prescriptions','files','lab_results','communications','payments',
                     'invoice_items','locations','rooms','practices','care_reminders',
                     'ext_ai_settings','ext_clinical_guardian_alerts','ext_kvepis_submissions',
                     'ekasa_receipts','ekasa_config','sms_consent_events')
 order by rls_enabled, policies, c.relname;

-- 4b) zoznam tabuliek BEZ RLS (očkávane: 4)
select c.relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
 order by 1;

-- ─── 5. TENANT INTEGRITA: practice_id ──────────────────────────────────────
-- 5a) NULL practice_id v tabuľkách, kde je stĺpec nullable (tieto riadky sú pre
--     VŠETKY tenanty neviditeľné — RLS je fail-closed)
select 'audit_log' as tbl, count(*) as null_practice from audit_log where practice_id is null
union all select 'funnel_events', count(*) from funnel_events where practice_id is null
union all select 'stripe_events', count(*) from stripe_events where practice_id is null
union all select 'sms_provider_events', count(*) from sms_provider_events where practice_id is null
union all select 'sms_delivery_event_history', count(*) from sms_delivery_event_history where practice_id is null
union all select 'sms_provider_event_resolutions', count(*) from sms_provider_event_resolutions where practice_id is null
order by 2 desc;

-- 5b) NOT NULL practice_id, ale bez FK na practices → možné dangling reference
with cand as (
  select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'practice_id'
   where n.nspname='public' and c.relkind='r' and a.attnum > 0
     and not exists (select 1 from pg_constraint k
                      where k.conrelid = c.oid and k.contype='f' and k.conkey = array[a.attnum])
)
select tbl,
       format('select %L as tbl, count(*) from %I where practice_id not in (select id from practices)', tbl, tbl)::text as verify_sql
  from cand order by 1;
-- vykonaj vrátane: ext_support_sessions, visit_treatment_plan_revisions,
-- visit_treatment_plan_revision_lines, visit_treatment_plan_responses,
-- visit_treatment_plan_response_lines, visit_treatment_plan_presentations

-- 5c) rozdelenie dát podľa kliniky + kontrola pilotnej praktiky
select p.id, p.name, p.timezone, p.country, p.currency, p.tax_rate_percent,
       p.subscription_tier, p.billing_status,
       (select count(*) from clients c      where c.practice_id = p.id) as clients,
       (select count(*) from patients pt    where pt.practice_id = p.id) as patients,
       (select count(*) from appointments a where a.practice_id = p.id) as appointments,
       (select count(*) from soap_notes s   where s.practice_id = p.id) as soap_notes,
       (select count(*) from locations l    where l.practice_id = p.id and l.deleted_at is null) as locations
  from practices p
 where p.deleted_at is null
 order by clients desc;

-- 5d) KLÚČOVÁ inšpekcia nastavenia pilotnej kliniky (pozri nález P1-D/„TZ")
select id, name, timezone, country, currency, tax_rate_percent,
       (timezone <> 'Europe/Bratislava')  as timezone_wrong_for_sk,
       (upper(country) <> 'SK')            as country_not_sk,
       (lower(currency) <> 'eur')          as currency_not_eur,
       (tax_rate_percent not in (20, 23))  as vat_suspicious_for_sk_2026
  from practices
 where deleted_at is null
 order by 1;

-- ─── 6. AUTO-SEEDY, KTORE CHÝBAJÚ (bez dát je funkcia inertná) ─────────────
select 'drug_interactions (interakčný checker Clinical Guardian)' as feature,
       count(*) as rows, '0 = Guardian nikdy nevygeneruje alert' as consequence
  from drug_interactions
union all
select 'ext_clinical_guardian_alerts', count(*), '0 = widget na dashboarde bude prázdny'
  from ext_clinical_guardian_alerts
union all
select 'ext_clinician_confirmations', count(*), '0 = E-Sign reťazec nebol nikdy použitý'
  from ext_clinician_confirmations
union all
select 'ext_ai_audit_log', count(*), '0 = chýba legislatívny audit AI zásahov'
  from ext_ai_audit_log
union all
select 'ext_rabies_notifications', count(*), '0 = kniha besnoty prázdna'
  from ext_rabies_notifications
union all
select 'ext_rabies_observations', count(*), '0 = karanténne pozorovania chýbajú'
  from ext_rabies_observations
union all
select 'ext_withdrawal_periods', count(*), '0 = ochranné lehoty nikde'
  from ext_withdrawal_periods
union all
select 'ext_automation_events', count(*), '0 = event bus sa nikde neplní'
  from ext_automation_events
union all
select 'ext_crm_segment_memberships', count(*), '0 = segmenty sú prázdne'
  from ext_crm_segment_memberships;

-- 6b) koľko očkovaní proti besnote reálne existuje vs. koľko ich "kniha besnoty"
--     zachytí LIKE heuristicou v reports.rabiesRegister
select count(*)                                                            as rabies_like_rows,
       count(*) filter (where lower(vaccine_name) like '%rab%')           as like_rab,
       count(*) filter (where lower(vaccine_name) like '%besnot%')        as like_besnot,
       count(*) filter (where lower(vaccine_name) like '%biocan r%')      as like_biocan,
       count(*) filter (where lower(vaccine_name) like '%rabisin%')        as like_rabisin,
       count(*) filter (where lower(vaccine_name) like '%nobivac r%')      as like_nobivac,
       count(*) filter (where lower(vaccine_name) like '%defensor%')      as like_defensor,
       count(*) filter (where rabies_tag_number is not null)              as with_tag_number
  from vaccination_records
 where deleted_at is null
   and (lower(coalesce(vaccine_name,'')) ~ '(rabies|besnota|rabi[ds]|antirab)'
     or lower(coalesce(product_name,''))  ~ '(rabies|besnota|rabisin|nobivac|defensor|eurican r|imrab)');

-- 6c) vakcíny, ktoré KNHA/zoznam obsahuje, ale heuristika v rabiesRegister prepáli
select distinct vaccine_name, count(*) as n
  from vaccination_records
 where deleted_at is null
 group by 1 order by 2 desc limit 40;

-- ─── 7. SYMPATHY GATE — overenie invariantu (0 zosnulých s aktívnou pripomienkou)
select count(*) as deceased_with_active_reminders
  from care_reminders cr
  join patients pt on pt.id = cr.patient_id
 where pt.status = 'deceased'
   and cr.deleted_at is null
   and cr.status = 'open';                       -- enum: open|completed|dismissed

-- ─── 8. BLOKUJÚCE DÁTOVÉ STAVY PRE OBJEDNÁVKY (trigger guard) ──────────────
-- Bez aspoň jednej lokality nemožno vytvoriť žiadny termín
-- (public.assign_appointment_scheduling_location → RAISE).
select p.id, p.name,
       (select count(*) from locations l
         where l.practice_id = p.id and l.deleted_at is null) as active_locations,
       (select count(*) from rooms r
         where r.practice_id = p.id and r.deleted_at is null) as active_rooms
  from practices p
 where p.deleted_at is null
   and not exists (select 1 from locations l
                    where l.practice_id = p.id and l.deleted_at is null);

-- ─── 9. VÝKON: FK stĺpce bez indexu (193 z 438 — nález P2) ─────────────────
with fkcols as (
  select cl.relname as child, a.attname as col, c.conrelid
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname='public'
    cross join lateral unnest(c.conkey) with ordinality as x(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = x.attnum
   where c.contype='f' and x.ord = 1
)
select count(*) filter (where not exists (
         select 1 from pg_index i
          where i.indrelid = f.conrelid
            and i.indkey[0] = (select attnum from pg_attribute a
                                where a.attrelid=f.conrelid and a.attname=f.col)
       )) as fk_columns_without_index,
       count(*) as fk_columns_total
  from (select distinct child, col, conrelid from fkcols) f;

-- ─── 10. SÚHRN: 116 tabuliek by malo byť neprázdnych (porovnaj s artifacts) ─
select count(*) as non_empty_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 cross join lateral (select reltuples::bigint as est
                       from pg_class where oid = c.oid) e
 where n.nspname='public' and c.relkind='r' and e.est > 0;
