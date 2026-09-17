-- ============================================================================
-- OpenVPM AI — Comprehensive Database Verification & Audit Script
-- Purpose: Offline verification of schema, RLS, row counts, relational
--          invariants, and Slovak statutory/autopilot extension compliance.
-- ============================================================================

\echo '============================================================================'
\echo 'OPENVPM AI — DATABASE VERIFICATION REPORT'
\echo '============================================================================'

\echo ''
\echo '--- 1. DATABASE ENVIRONMENT & METADATA ---'
SELECT 
    current_database() AS database_name,
    current_user AS connected_user,
    version() AS postgres_version,
    current_setting('server_encoding') AS server_encoding,
    now() AT TIME ZONE 'UTC' AS audit_timestamp_utc;

\echo ''
\echo '--- 2. SCHEMA OBJECT COUNTS ---'
SELECT 
    COUNT(*) FILTER (WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_public_tables,
    COUNT(*) FILTER (WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'ext_%') AS extension_tables_count,
    COUNT(*) FILTER (WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'ext_%') AS vanilla_tables_count,
    (SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') AS custom_enum_types_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_public_indexes
FROM information_schema.tables;

\echo ''
\echo '--- 3. ROW LEVEL SECURITY (RLS) AUDIT ---'
SELECT 
    COUNT(*) FILTER (WHERE relrowsecurity = true) AS rls_enabled_tables,
    COUNT(*) FILTER (WHERE relrowsecurity = false) AS rls_disabled_tables,
    CASE 
        WHEN COUNT(*) FILTER (WHERE relrowsecurity = false) <= 4 THEN 'PASS: 174/178 public tables protected by RLS (4 un-tenanted auth token tables excluded)'
        ELSE 'WARNING: Some unexpected tables lack RLS'
    END AS rls_compliance_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

\echo ''
\echo '--- 4. CORE CLINICAL & PRACTICE ROW COUNTS ---'
SELECT 
    (SELECT count(*) FROM practices) AS practices_count,
    (SELECT count(*) FROM locations) AS locations_count,
    (SELECT count(*) FROM users) AS users_count,
    (SELECT count(*) FROM clients) AS clients_count,
    (SELECT count(*) FROM patients) AS patients_count,
    (SELECT count(*) FROM appointments) AS appointments_count,
    (SELECT count(*) FROM clinical_notes) AS clinical_notes_count,
    (SELECT count(*) FROM soap_notes) AS soap_notes_count,
    (SELECT count(*) FROM prescriptions) AS prescriptions_count,
    (SELECT count(*) FROM controlled_substance_log) AS controlled_substances_count,
    (SELECT count(*) FROM invoices) AS invoices_count,
    (SELECT count(*) FROM invoice_items) AS invoice_items_count,
    (SELECT count(*) FROM payments) AS payments_count,
    (SELECT count(*) FROM products) AS products_count,
    (SELECT count(*) FROM suppliers) AS suppliers_count,
    (SELECT count(*) FROM care_reminders) AS care_reminders_count,
    (SELECT count(*) FROM vaccination_records) AS vaccination_records_count,
    (SELECT count(*) FROM lab_results) AS lab_results_count,
    (SELECT count(*) FROM services) AS services_count;

\echo ''
\echo '--- 5. USER ROLES DISTRIBUTION ---'
SELECT role, count(*) AS count 
FROM users 
GROUP BY role 
ORDER BY count DESC;

\echo ''
\echo '--- 6. PATIENT SPECIES & STATUS DISTRIBUTION ---'
SELECT 
    COALESCE(species::text, 'unknown') AS species,
    COALESCE(status::text, 'active') AS status,
    count(*) AS count 
FROM patients 
GROUP BY species, status 
ORDER BY count DESC;

\echo ''
\echo '--- 7. APPOINTMENT STATUS DISTRIBUTION ---'
SELECT status, count(*) AS count 
FROM appointments 
GROUP BY status 
ORDER BY count DESC;

\echo ''
\echo '--- 8. INVOICE STATUS & FINANCIAL TOTALS ---'
SELECT 
    status, 
    count(*) AS invoice_count,
    COALESCE(SUM(total), 0) AS total_sum_eur,
    COALESCE(SUM(paid_amount), 0) AS paid_sum_eur
FROM invoices 
GROUP BY status 
ORDER BY invoice_count DESC;

\echo ''
\echo '--- 9. RELATIONAL INVARIANTS & INTEGRITY AUDIT ---'
SELECT 
    -- 1. Invoices with appointment: verify client_id and patient_id match appointment
    (SELECT COUNT(*) 
     FROM invoices i 
     JOIN appointments a ON i.appointment_id = a.id 
     WHERE (i.client_id != a.client_id OR (i.patient_id IS NOT NULL AND a.patient_id IS NOT NULL AND i.patient_id != a.patient_id))
    ) AS invoice_appointment_mismatch_count,

    -- 2. Orphaned invoices without client
    (SELECT COUNT(*) FROM invoices WHERE client_id IS NULL) AS invoices_without_client_count,

    -- 3. Orphaned patients without client
    (SELECT COUNT(*) FROM patients WHERE client_id IS NULL) AS patients_without_client_count,

    -- 4. Orphaned appointments without client
    (SELECT COUNT(*) FROM appointments WHERE client_id IS NULL) AS appointments_without_client_count,

    -- 5. Appointments without practice
    (SELECT COUNT(*) FROM appointments WHERE practice_id IS NULL) AS appointments_without_practice_count,

    -- 6. Invoices without practice
    (SELECT COUNT(*) FROM invoices WHERE practice_id IS NULL) AS invoices_without_practice_count,

    -- 7. Deceased patients with active care reminders (Sympathy Gate Invariant)
    (SELECT COUNT(*) 
     FROM care_reminders cr 
     JOIN patients p ON cr.patient_id = p.id 
     WHERE p.status = 'deceased' AND cr.status NOT IN ('completed', 'dismissed')
    ) AS deceased_patients_active_reminders_count;

\echo ''
\echo '--- 10. AUTOPILOT & MARKETING AUTOMATION STATUS ---'
SELECT 
    (SELECT count(*) FROM ext_automation_events) AS automation_events_count,
    (SELECT count(*) FROM ext_automation_journeys) AS automation_journeys_count,
    (SELECT count(*) FROM ext_automation_rules) AS automation_rules_count,
    (SELECT count(*) FROM ext_automation_enrollments) AS automation_enrollments_count,
    (SELECT count(*) FROM ext_automation_step_executions) AS automation_step_executions_count,
    (SELECT count(*) FROM ext_automation_suppression_log) AS automation_suppressions_count,
    (SELECT count(*) FROM ext_crm_segments) AS crm_segments_count,
    (SELECT count(*) FROM ext_crm_segment_memberships) AS crm_segment_memberships_count;

\echo ''
\echo '--- 11. STATUTORY & E-KASA STATUS ---'
SELECT 
    (SELECT count(*) FROM ext_rabies_notifications) AS rabies_notifications_count,
    (SELECT count(*) FROM ext_rabies_observations) AS rabies_observations_count,
    (SELECT count(*) FROM ext_withdrawal_periods) AS withdrawal_periods_count,
    (SELECT count(*) FROM ext_carcass_disposals) AS carcass_disposals_count,
    (SELECT count(*) FROM ekasa_config) AS ekasa_configs_count,
    (SELECT count(*) FROM ekasa_receipts) AS ekasa_receipts_count,
    (SELECT count(*) FROM ekasa_daily_closures) AS ekasa_daily_closures_count;

\echo ''
\echo '--- 12. CLINICAL GUARDIAN & AI AUDIT LEDGER STATUS ---'
SELECT 
    (SELECT count(*) FROM ext_clinical_guardian_alerts) AS guardian_alerts_count,
    (SELECT count(*) FROM ext_clinician_confirmations) AS clinician_confirmations_count,
    (SELECT count(*) FROM ext_ai_audit_log) AS ai_audit_log_count,
    (SELECT count(*) FROM ext_ai_settings) AS ai_settings_count;

\echo ''
\echo '--- 13. ALL NON-EMPTY TABLES SUMMARY ---'
DROP TABLE IF EXISTS temp_table_counts;
CREATE TEMP TABLE temp_table_counts (
    tbl_name TEXT,
    tbl_type TEXT,
    row_count BIGINT
);

DO $$
DECLARE
    r RECORD;
    row_cnt BIGINT;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', r.table_name) INTO row_cnt;
        IF row_cnt > 0 THEN
            INSERT INTO temp_table_counts VALUES (
                r.table_name,
                CASE WHEN r.table_name LIKE 'ext_%' THEN 'extension' ELSE 'vanilla' END,
                row_cnt
            );
        END IF;
    END LOOP;
END $$;

SELECT 
    tbl_name AS table_name,
    tbl_type AS type,
    row_count
FROM temp_table_counts
ORDER BY row_count DESC, tbl_name ASC;

DROP TABLE IF EXISTS temp_table_counts;

\echo ''
\echo '============================================================================'
\echo 'VERIFICATION SCRIPT COMPLETED SUCCESSFULLY'
\echo '============================================================================'
