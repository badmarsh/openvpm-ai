-- OpenVPM — Postgres Row-Level Security (defense-in-depth multi-tenant isolation)
-- ============================================================================
-- These policies are a SECOND guard behind the app-layer practiceId filters.
-- They key off the `app.current_practice_id` GUC the app sets per request
-- (see apps/web/lib/tenant-db.ts: withTenant / withSystem).
--
-- The table OWNER bypasses RLS (we do NOT use FORCE), so:
--   • Migrations + dev/self-host on the owner connection are unaffected.
--   • Enforcement activates when the app connects as the least-privilege role
--     `openpims_app`, which you point the hosted DATABASE_URL at.
--
-- Apply with: pnpm db:rls   (idempotent — safe to re-run after schema changes)
--
-- ROLE CREATION: this file contains NO credentials. The `openpims_app` role is
-- created/managed by the apply script (packages/db/apply-rls.ts) using the
-- OPENPIMS_APP_DB_PASSWORD env var, or you create the role yourself beforehand.
-- The grants below assume the role already exists.
-- ============================================================================

-- 1) Grants for the least-privilege application role (must already exist).
GRANT USAGE ON SCHEMA public TO openpims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openpims_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO openpims_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openpims_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO openpims_app;

-- 2) Context helpers (NULL/false when the GUC is unset → deny by default).
CREATE OR REPLACE FUNCTION app_current_practice_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$fn$ SELECT nullif(current_setting('app.current_practice_id', true), '')::uuid $fn$;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
  LANGUAGE sql STABLE AS
$fn$ SELECT coalesce(current_setting('app.rls_bypass', true), '') = 'on' $fn$;

-- 3) The practices root table is keyed on its own id.
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON practices;
CREATE POLICY tenant_isolation ON practices
  USING (app_rls_bypass() OR id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR id = app_current_practice_id());

-- 4) Every practice_id-scoped table gets the same policy.
DO $$
DECLARE
  t text;
  tbls text[] := array[
    'api_keys','appointment_types','appointment_waitlist','appointments','audit_log',
    'cases','clients','clinical_notes','communications','controlled_substance_log',
    'files','insurance_claims','insurance_policies','invoices','lab_results','locations',
    'patients','prescriptions','problem_list','procedures','products','purchase_orders',
    'recurring_series','rooms','services','soap_notes','staff_schedules','suppliers',
    'treatment_plans','treatment_templates','usage_records','users','vaccination_records',
    'vital_signs','webhooks','wellness_enrollments','wellness_plans'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING (app_rls_bypass() OR practice_id = app_current_practice_id()) '
      'WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id())',
      t
    );
  END LOOP;
END$$;
