CREATE TYPE "public"."data_sensitivity_level" AS ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'STRICTLY_CONFIDENTIAL');--> statement-breakpoint

ALTER TABLE "clients"
  ADD COLUMN "data_sensitivity_level" "data_sensitivity_level" DEFAULT 'CONFIDENTIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients"
  ADD COLUMN "data_sensitivity_level" "data_sensitivity_level" DEFAULT 'STRICTLY_CONFIDENTIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments"
  ADD COLUMN "data_sensitivity_level" "data_sensitivity_level" DEFAULT 'STRICTLY_CONFIDENTIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "soap_notes"
  ADD COLUMN "data_sensitivity_level" "data_sensitivity_level" DEFAULT 'STRICTLY_CONFIDENTIAL' NOT NULL;--> statement-breakpoint

COMMENT ON COLUMN "clients"."data_sensitivity_level" IS
  'Owner/client contact data classification. Default CONFIDENTIAL; never use this field as an authorization boundary.';--> statement-breakpoint
COMMENT ON COLUMN "patients"."data_sensitivity_level" IS
  'Animal identity and health data classification. Default STRICTLY_CONFIDENTIAL.';--> statement-breakpoint
COMMENT ON COLUMN "appointments"."data_sensitivity_level" IS
  'Encounter header classification. OpenVPM currently models encounter headers as appointments.';--> statement-breakpoint
COMMENT ON COLUMN "soap_notes"."data_sensitivity_level" IS
  'Encounter clinical detail classification, including drafts. Default STRICTLY_CONFIDENTIAL.';--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.prevent_data_sensitivity_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  old_rank integer;
  new_rank integer;
BEGIN
  IF OLD.data_sensitivity_level = NEW.data_sensitivity_level THEN
    RETURN NEW;
  END IF;

  old_rank := CASE OLD.data_sensitivity_level
    WHEN 'PUBLIC' THEN 0
    WHEN 'INTERNAL' THEN 1
    WHEN 'CONFIDENTIAL' THEN 2
    WHEN 'STRICTLY_CONFIDENTIAL' THEN 3
  END;
  new_rank := CASE NEW.data_sensitivity_level
    WHEN 'PUBLIC' THEN 0
    WHEN 'INTERNAL' THEN 1
    WHEN 'CONFIDENTIAL' THEN 2
    WHEN 'STRICTLY_CONFIDENTIAL' THEN 3
  END;

  -- The hosted application role may tighten a label, but may not silently
  -- weaken it. Intentional downgrades require an owner-controlled migration
  -- or reviewed maintenance procedure outside the request path.
  IF new_rank < old_rank AND session_user = 'openpims_app' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Data sensitivity downgrade requires owner-controlled maintenance';
  END IF;

  RETURN NEW;
END;
$fn$;--> statement-breakpoint

CREATE TRIGGER "clients_data_sensitivity_guard"
  BEFORE UPDATE OF "data_sensitivity_level" ON "clients"
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_data_sensitivity_downgrade();--> statement-breakpoint
CREATE TRIGGER "patients_data_sensitivity_guard"
  BEFORE UPDATE OF "data_sensitivity_level" ON "patients"
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_data_sensitivity_downgrade();--> statement-breakpoint
CREATE TRIGGER "appointments_data_sensitivity_guard"
  BEFORE UPDATE OF "data_sensitivity_level" ON "appointments"
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_data_sensitivity_downgrade();--> statement-breakpoint
CREATE TRIGGER "soap_notes_data_sensitivity_guard"
  BEFORE UPDATE OF "data_sensitivity_level" ON "soap_notes"
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_data_sensitivity_downgrade();--> statement-breakpoint
