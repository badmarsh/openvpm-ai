\set ON_ERROR_STOP on

-- Synthetic, disposable pilot data for PILOT_E2E=1 (e2e/ai-finalization-pilot.spec.ts).
-- Self-contained: creates its own practice, veterinarian, location, client,
-- patient, in-exam appointment, and one COMPLETED voice dictation carrying
-- an AI draft ready for prepare -> finalize.
--
-- Setup (isolated throwaway database only):
--   CREATE DATABASE openpims_pilot_<suffix>;
--   DATABASE_URL=... pnpm db:migrate && pnpm db:rls
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f e2e/fixtures/ai-finalization-pilot.sql
--
-- The veterinarian password is 'PilotSmoke123!' (bcrypt, cost 10) — synthetic
-- credential for the disposable pilot database only.
DO $$
BEGIN
  IF current_database() !~ '^openpims_pilot_[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Refusing pilot fixture on non-disposable database: %',
      current_database();
  END IF;
END
$$;

INSERT INTO practices (id, name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Synthetic Pilot Clinic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, practice_id, email, password_hash, name, role, email_verified_at) VALUES
  ('20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001',
   'pilot.vet@example.test',
   '$2a$10$9WUKnK/nXYPCAOuW4jn5Zu9ecTmmkgdVJrMGIgraMTCLty94QlInW',
   'Synthetic Pilot Vet',
   'veterinarian',
   now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (id, practice_id, name, is_primary) VALUES
  ('20000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000001',
   'Synthetic Pilot Exam Room',
   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (id, practice_id, first_name, last_name, email) VALUES
  ('20000000-0000-0000-0000-000000000004',
   '20000000-0000-0000-0000-000000000001',
   'Pilot',
   'Owner',
   'pilot.owner@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patients (id, practice_id, client_id, name, species, breed, sex) VALUES
  ('20000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000004',
   'Pilot Patient',
   'canine',
   'Labrador',
   'male')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, practice_id, location_id, patient_id, client_id, doctor_id, start_time, end_time, status) VALUES
  ('20000000-0000-0000-0000-000000000006',
   '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000004',
   '20000000-0000-0000-0000-000000000002',
   now(),
   now() + interval '30 minutes',
   'in_exam')
ON CONFLICT (id) DO NOTHING;

-- One COMPLETED dictation: the AI draft the pilot finalizes via
-- prepareConfirmation -> saveAsSoapNote. revision 0, no soapNoteId yet.
INSERT INTO voice_dictations (
  id, practice_id, patient_id, appointment_id, dictated_by,
  model_id, raw_transcript, language,
  subjective, objective, assessment, plan,
  status, revision, transcribed_at, completed_at
) VALUES
  ('20000000-0000-0000-0000-000000000007',
   '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000006',
   '20000000-0000-0000-0000-000000000002',
   'pilot-fixture',
   'Synthetic transcript: owner reports vomiting for two days, dog is lethargic.',
   'en',
   'Owner reports vomiting for two days.',
   'Lethargic, abdomen soft.',
   'Acute gastroenteritis.',
   'Antiemetic, bland diet, recheck in 24 hours.',
   'COMPLETED',
   0,
   now(),
   now())
ON CONFLICT (id) DO NOTHING;
