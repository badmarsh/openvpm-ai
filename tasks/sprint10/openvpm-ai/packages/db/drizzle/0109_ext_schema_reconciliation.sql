CREATE TABLE "ext_ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"openai_base_url" text,
	"openai_api_key_encrypted" text,
	"openai_is_active" boolean DEFAULT false NOT NULL,
	"openai_cached_models" jsonb DEFAULT '[]'::jsonb,
	"openai_last_tested_at" timestamp with time zone,
	"openai_last_status" text,
	"openai_last_status_message" text,
	"gemini_base_url" text,
	"gemini_api_key_encrypted" text,
	"gemini_is_active" boolean DEFAULT false NOT NULL,
	"gemini_cached_models" jsonb DEFAULT '[]'::jsonb,
	"gemini_last_tested_at" timestamp with time zone,
	"gemini_last_status" text,
	"gemini_last_status_message" text,
	"alibaba_mode" text DEFAULT 'aliproxy_local',
	"alibaba_base_url" text DEFAULT 'http://127.0.0.1:8080/v1',
	"alibaba_api_key_encrypted" text,
	"alibaba_is_active" boolean DEFAULT false NOT NULL,
	"alibaba_cached_models" jsonb DEFAULT '[]'::jsonb,
	"alibaba_last_tested_at" timestamp with time zone,
	"alibaba_last_status" text,
	"alibaba_last_status_message" text,
	"feature_mappings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_clinical_guardian_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid,
	"encounter_id" uuid,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"suggested_action" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ekasa_receipts" ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "ext_support_session_audit" ADD COLUMN IF NOT EXISTS "practice_id" uuid;--> statement-breakpoint
UPDATE "ext_support_session_audit" a SET "practice_id" = s."practice_id"::uuid FROM "ext_support_sessions" s WHERE a."session_id" = s."id" AND a."practice_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ext_support_session_audit" ALTER COLUMN "practice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ext_ai_settings" ADD CONSTRAINT "ext_ai_settings_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinical_guardian_alerts" ADD CONSTRAINT "ext_clinical_guardian_alerts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinical_guardian_alerts" ADD CONSTRAINT "ext_clinical_guardian_alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinical_guardian_alerts" ADD CONSTRAINT "ext_clinical_guardian_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_ai_settings_practice_idx" ON "ext_ai_settings" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_ai_settings_practice_active_uq" ON "ext_ai_settings" USING btree ("practice_id","is_active");--> statement-breakpoint
CREATE INDEX "ext_cg_alerts_practice_idx" ON "ext_clinical_guardian_alerts" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_cg_alerts_patient_idx" ON "ext_clinical_guardian_alerts" USING btree ("patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_cg_alerts_status_idx" ON "ext_clinical_guardian_alerts" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_cg_alerts_category_idx" ON "ext_clinical_guardian_alerts" USING btree ("practice_id","category","deleted_at");--> statement-breakpoint
ALTER TABLE "ext_support_session_audit" ADD CONSTRAINT "ext_support_session_audit_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ekasa_receipts_idempotency_uq" ON "ekasa_receipts" USING btree ("practice_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ext_support_audit_practice_idx" ON "ext_support_session_audit" USING btree ("practice_id");--> statement-breakpoint
ALTER TABLE "controlled_substance_log" ADD CONSTRAINT "cs_log_witness_required_check" CHECK ("controlled_substance_log"."action" NOT IN ('administered', 'wasted') OR "controlled_substance_log"."witnessed_by" IS NOT NULL) NOT VALID;--> statement-breakpoint
CREATE OR REPLACE VIEW "public"."voice_dictation_duration_view" AS (select "id", ("audio_duration_seconds"::numeric) as "duration_seconds" from "voice_dictations");