CREATE TYPE "public"."care_reminder_status" AS ENUM('open', 'completed');--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'care_reminders';--> statement-breakpoint
CREATE TABLE "care_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"notes" text,
	"due_date" date NOT NULL,
	"status" "care_reminder_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"external_source" varchar(64),
	"external_id" varchar(160),
	"import_fingerprint" varchar(64),
	CONSTRAINT "care_reminders_notes_length_check" CHECK ("care_reminders"."notes" is null or char_length("care_reminders"."notes") <= 4000),
	CONSTRAINT "care_reminders_state_check" CHECK ((
          "care_reminders"."status" = 'open'
          and "care_reminders"."completed_at" is null
          and "care_reminders"."completed_by" is null
        ) or (
          "care_reminders"."status" = 'completed'
          and "care_reminders"."completed_at" is not null
          and "care_reminders"."completed_by" is not null
        )),
	CONSTRAINT "care_reminders_external_identity_pair_check" CHECK (("care_reminders"."external_source" is null) = ("care_reminders"."external_id" is null)),
	CONSTRAINT "care_reminders_import_identity_check" CHECK ((
          "care_reminders"."external_source" is null
          and "care_reminders"."external_id" is null
          and "care_reminders"."import_fingerprint" is null
          and "care_reminders"."created_by" is not null
        ) or (
          "care_reminders"."external_source" is not null
          and "care_reminders"."external_id" is not null
          and "care_reminders"."import_fingerprint" is not null
        )),
	CONSTRAINT "care_reminders_import_fingerprint_check" CHECK ("care_reminders"."import_fingerprint" is null or "care_reminders"."import_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "care_reminders_external_source_check" CHECK ("care_reminders"."external_source" is null or "care_reminders"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
);
--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_creator_tenant_fk" FOREIGN KEY ("practice_id","created_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_completer_tenant_fk" FOREIGN KEY ("practice_id","completed_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_reminders_external_id_uq" ON "care_reminders" USING btree ("practice_id","external_source","external_id") WHERE "care_reminders"."external_source" is not null and "care_reminders"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "care_reminders_import_fingerprint_uq" ON "care_reminders" USING btree ("practice_id","import_fingerprint") WHERE "care_reminders"."import_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "care_reminders_open_due_idx" ON "care_reminders" USING btree ("practice_id","due_date","id") WHERE "care_reminders"."status" = 'open' and "care_reminders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "care_reminders_patient_timeline_idx" ON "care_reminders" USING btree ("practice_id","patient_id","due_date","id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_practice_id() RETURNS uuid
  LANGUAGE sql STABLE
  SET search_path = ''
  AS
$fn$ SELECT nullif(current_setting('app.current_practice_id', true), '')::uuid $fn$;--> statement-breakpoint
ALTER TABLE "care_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "care_reminders"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
