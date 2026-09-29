-- ============================================================================
-- add-missing-indexes.sql — hot-path indexes for the consolidation sprint
--
-- Applied idempotently (all statements use IF NOT EXISTS / guarded DO blocks).
-- Run via `pnpm db:bootstrap` (wired into bootstrap-db.ts) or directly:
--
--   docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai \
--     < packages/db/drizzle/bootstrap/add-missing-indexes.sql
--
-- Schema rule compliance (AGENTS.md §3):
--   * No upstream schema files (packages/db/schema/*.ts) are modified.
--   * packages/db/drizzle/meta/_journal.json is NOT touched.
--   * These are bootstrap-level indexes, safe to apply directly.
--
-- NOTE on appointments_patient_status_idx (practice_id, patient_id, status,
-- deleted_at): already materialized from the TS schema by drizzle-kit
-- (scheduling.ts patientStatusIdx) — intentionally NOT duplicated here.
-- ============================================================================

-- ── 3A: care reminders — open-status dashboard scan -------------------------
CREATE INDEX IF NOT EXISTS care_reminders_open_idx
  ON care_reminders (practice_id, status, deleted_at)
  WHERE status = 'open';

-- ── 3A: ext_marketing_content_items — content calendar by status ------------
CREATE INDEX IF NOT EXISTS ext_content_items_practice_status_idx
  ON ext_marketing_content_items (practice_id, status, deleted_at);

-- ── 3A: ext_crm_segment_memberships — segment lookup for automations --------
CREATE INDEX IF NOT EXISTS ext_crm_memberships_segment_idx
  ON ext_crm_segment_memberships (practice_id, segment_id, deleted_at);

-- ── 3A: voice dictations — encounter-detail lookup by appointment -----------
CREATE INDEX IF NOT EXISTS voice_dictations_appt_idx
  ON voice_dictations (practice_id, appointment_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ── 3C: audit_log — practice-scoped audit queries (nullable practice_id) ----
CREATE INDEX IF NOT EXISTS audit_log_practice_action_idx
  ON audit_log (practice_id, action, created_at DESC)
  WHERE practice_id IS NOT NULL;

-- ── 3D: ext_marketing_reviews — sentiment filter ----------------------------
-- The upstream column is `sentiment_label` (ext_reputation_sentiment enum),
-- not `sentiment` — index adapted to the real column name.
CREATE INDEX IF NOT EXISTS ext_reviews_practice_sentiment_idx
  ON ext_marketing_reviews (practice_id, sentiment_label, deleted_at);

-- ── 3E: appointments — recurring series lookup -------------------------------
CREATE INDEX IF NOT EXISTS appointments_recurring_series_idx
  ON appointments (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;

-- ── 3G: clients — ILIKE search trigram support -------------------------------
-- The clients router searches with `concat_ws(' ', first_name, last_name)`
-- ILIKE '%q%' (see apps/web/server/routers/clients.ts). The expression below
-- matches that exact shape so the planner can use it; a `first_name || ' ' ||
-- last_name || ' ' || coalesce(email, '')` composite would NOT be selected
-- for those predicates.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_trgm not available — skipping clients_search_trgm_idx';
END
$$;

CREATE INDEX IF NOT EXISTS clients_search_trgm_idx
  ON clients USING gin ((first_name || ' ' || last_name) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ── 3H: ext_automation_events — pending/processing work queue ---------------
CREATE INDEX IF NOT EXISTS ext_automation_events_pending_idx
  ON ext_automation_events (practice_id, status, created_at)
  WHERE status IN ('pending', 'processing');
