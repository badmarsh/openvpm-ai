CREATE TYPE "public"."ext_reputation_escalation" AS ENUM('none', 'pending', 'escalated', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."ext_reputation_sentiment" AS ENUM('positive', 'neutral', 'negative', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."ext_reputation_severity" AS ENUM('critical', 'high', 'medium', 'low', 'none');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_enrollment_status" AS ENUM('active', 'completed', 'exited', 'paused', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_event_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_event_type" AS ENUM('appointment_booked', 'appointment_reminder', 'appointment_no_show', 'appointment_completed', 'visit_completed', 'visit_closeout', 'vaccine_due', 'inactive_recall', 'annual_checkup_due', 'senior_milestone', 'senior_screening', 'surgery_completed', 'wellness_enrolled', 'dental_detected', 'payment_failed', 'patient_deceased', 'lab_result_received', 'treatment_plan_created', 'prescription_issued', 'review_received', 'review_reply_published', 'content_brief_approved', 'content_published', 'consent_revoked', 'client_created', 'patient_created', 'patient_reactivated', 'inventory_delivery_received');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_rule_action" AS ENUM('create_journey', 'send_communication', 'create_task', 'create_content_brief');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_step_status" AS ENUM('scheduled', 'executing', 'done', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ext_automation_suppression_reason" AS ENUM('deceased_patient', 'opt_out', 'no_consent', 'frequency_cap', 'quiet_hours', 'recovery_hold', 'manual_block', 'cooldown', 'sensitivity_period', 'sms_rate_limit', 'unknown_contact');--> statement-breakpoint
CREATE TYPE "public"."ext_crm_refresh_strategy" AS ENUM('event_driven', 'scheduled', 'manual');--> statement-breakpoint
CREATE TYPE "public"."ext_content_brief_status" AS ENUM('pending', 'generating', 'review', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ext_channel_account_status" AS ENUM('connected', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."ext_channel_provider" AS ENUM('google_business', 'facebook', 'instagram', 'youtube');--> statement-breakpoint
ALTER TYPE "public"."ai_audit_entity_type" ADD VALUE 'marketing_content';--> statement-breakpoint
ALTER TYPE "public"."ai_audit_entity_type" ADD VALUE 'marketing_media';--> statement-breakpoint
CREATE TABLE "ext_pilot_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"reported_by_id" uuid,
	"reported_by_name" text,
	"incident_date" timestamp with time zone DEFAULT now() NOT NULL,
	"module_workflow" text NOT NULL,
	"vet_software_reference" text,
	"description" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_automation_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"journey_version" integer DEFAULT 1 NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"trigger_event_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone,
	"exit_reason" text,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"status" "ext_automation_enrollment_status" DEFAULT 'active' NOT NULL,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"last_step_executed_at" timestamp with time zone,
	CONSTRAINT "ext_auto_enroll_state_check" CHECK (("ext_automation_enrollments"."status" in ('active', 'paused') and "ext_automation_enrollments"."exited_at" is null)
        or ("ext_automation_enrollments"."status" in ('completed', 'exited', 'failed') and "ext_automation_enrollments"."exited_at" is not null)),
	CONSTRAINT "ext_auto_enroll_pause_check" CHECK (("ext_automation_enrollments"."status" = 'paused') = ("ext_automation_enrollments"."paused_at" is not null)),
	CONSTRAINT "ext_auto_enroll_step_index_check" CHECK ("ext_automation_enrollments"."current_step_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ext_automation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"event_type" "ext_automation_event_type" NOT NULL,
	"event_subtype" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"patient_id" uuid,
	"appointment_id" uuid,
	"visit_closeout_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_router" text,
	"dedupe_key" text,
	"emitted_by" uuid,
	"status" "ext_automation_event_status" DEFAULT 'pending' NOT NULL,
	"processed_reason" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ext_auto_events_retry_count_check" CHECK ("ext_automation_events"."retry_count" >= 0),
	CONSTRAINT "ext_auto_events_terminal_state_check" CHECK ("ext_automation_events"."processed_at" is null or "ext_automation_events"."failed_at" is null),
	CONSTRAINT "ext_auto_events_status_timestamp_check" CHECK (("ext_automation_events"."status" = 'processed') = ("ext_automation_events"."processed_at" is not null)
        and ("ext_automation_events"."status" = 'failed') = ("ext_automation_events"."failed_at" is not null)),
	CONSTRAINT "ext_auto_events_reason_required_check" CHECK ("ext_automation_events"."status" not in ('skipped', 'failed')
        or char_length(btrim(coalesce("ext_automation_events"."processed_reason", ''))) >= 3)
);
--> statement-breakpoint
CREATE TABLE "ext_automation_journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"journey_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"trigger_event_type" "ext_automation_event_type" NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"frequency_cap_window_days" integer DEFAULT 30 NOT NULL,
	"frequency_cap_max_steps" integer DEFAULT 4 NOT NULL,
	"allow_reentry" boolean DEFAULT false NOT NULL,
	"target_segment_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	CONSTRAINT "ext_auto_journeys_version_check" CHECK ("ext_automation_journeys"."version" >= 1),
	CONSTRAINT "ext_auto_journeys_frequency_cap_check" CHECK ("ext_automation_journeys"."frequency_cap_window_days" >= 1 and "ext_automation_journeys"."frequency_cap_max_steps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ext_automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"rule_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"trigger_event_type" "ext_automation_event_type" NOT NULL,
	"condition_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"action_type" "ext_automation_rule_action" NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"legal_basis" text DEFAULT 'contract' NOT NULL,
	"requires_consent_scope" text,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"migrated_from_key" text,
	"created_by" uuid,
	CONSTRAINT "ext_auto_rules_delay_check" CHECK ("ext_automation_rules"."delay_hours" >= 0),
	CONSTRAINT "ext_auto_rules_priority_check" CHECK ("ext_automation_rules"."priority" >= 0),
	CONSTRAINT "ext_auto_rules_validity_check" CHECK ("ext_automation_rules"."valid_from" is null or "ext_automation_rules"."valid_to" is null or "ext_automation_rules"."valid_from" <= "ext_automation_rules"."valid_to")
);
--> statement-breakpoint
CREATE TABLE "ext_automation_step_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"skip_reason" text,
	"channel_used" "ext_marketing_channel",
	"message_log_id" uuid,
	"communication_id" uuid,
	"content_item_id" uuid,
	"staff_task_id" uuid,
	"care_reminder_id" uuid,
	"status" "ext_automation_step_status" DEFAULT 'scheduled' NOT NULL,
	"failure_reason" text,
	CONSTRAINT "ext_auto_steps_step_index_check" CHECK ("ext_automation_step_executions"."step_index" >= 0),
	CONSTRAINT "ext_auto_steps_terminal_check" CHECK (("ext_automation_step_executions"."status" = 'done') = ("ext_automation_step_executions"."executed_at" is not null)
        and ("ext_automation_step_executions"."status" = 'skipped') = ("ext_automation_step_executions"."skipped_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "ext_automation_suppression_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"suppression_reason" "ext_automation_suppression_reason" NOT NULL,
	"blocked_action" text NOT NULL,
	"channel_attempted" "ext_marketing_channel",
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"enrollment_id" uuid,
	"rule_id" uuid,
	"journey_id" uuid,
	"event_id" uuid,
	"dedupe_key" text,
	"detail" text,
	CONSTRAINT "ext_auto_suppression_blocked_action_check" CHECK (char_length(btrim("ext_automation_suppression_log"."blocked_action")) between 3 and 200)
);
--> statement-breakpoint
CREATE TABLE "ext_crm_segment_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"enrollment_reason" text,
	"trigger_event_id" uuid,
	"is_manually_excluded" boolean DEFAULT false NOT NULL,
	"excluded_by" uuid,
	"excluded_at" timestamp with time zone,
	"segment_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ext_crm_membership_exclusion_check" CHECK (("ext_crm_segment_memberships"."is_manually_excluded" = false)
        or ("ext_crm_segment_memberships"."excluded_by" is not null and "ext_crm_segment_memberships"."excluded_at" is not null)),
	CONSTRAINT "ext_crm_membership_expiry_window_check" CHECK ("ext_crm_segment_memberships"."expires_at" is null or "ext_crm_segment_memberships"."expires_at" > "ext_crm_segment_memberships"."enrolled_at")
);
--> statement-breakpoint
CREATE TABLE "ext_crm_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"segment_key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"condition_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condition_sql" text,
	"refresh_strategy" "ext_crm_refresh_strategy" DEFAULT 'event_driven' NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"member_count_cache" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	CONSTRAINT "ext_crm_segments_key_format_check" CHECK ("ext_crm_segments"."segment_key" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "ext_crm_segments_version_check" CHECK ("ext_crm_segments"."version" >= 1),
	CONSTRAINT "ext_crm_segments_member_count_check" CHECK ("ext_crm_segments"."member_count_cache" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ext_content_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"pillar_id" uuid,
	"trigger_event_id" uuid,
	"brief_text" text NOT NULL,
	"target_channels" text[] DEFAULT '{}' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"clinical_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_voice_override" text,
	"status" "ext_content_brief_status" DEFAULT 'pending' NOT NULL,
	"generated_by" text,
	"generated_at" timestamp with time zone,
	"confidence" integer,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"content_item_id" uuid,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "ext_content_briefs_clinical_approval_check" CHECK (("ext_content_briefs"."status" <> 'approved')
        or (jsonb_array_length("ext_content_briefs"."clinical_claims") = 0)
        or ("ext_content_briefs"."reviewed_by" is not null and "ext_content_briefs"."reviewed_at" is not null)),
	CONSTRAINT "ext_content_briefs_review_state_check" CHECK (("ext_content_briefs"."status" in ('pending', 'generating', 'review'))
        or ("ext_content_briefs"."reviewed_by" is not null and "ext_content_briefs"."reviewed_at" is not null)),
	CONSTRAINT "ext_content_briefs_confidence_check" CHECK ("ext_content_briefs"."confidence" is null or "ext_content_briefs"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "ext_content_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"pillar_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"species" text[] DEFAULT '{}' NOT NULL,
	"season_months" integer[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"voice_guidance" text DEFAULT '' NOT NULL,
	CONSTRAINT "ext_content_pillars_key_format_check" CHECK ("ext_content_pillars"."pillar_key" ~ '^[a-z][a-z0-9_]{1,62}$'),
	CONSTRAINT "ext_content_pillars_sort_check" CHECK ("ext_content_pillars"."sort_order" >= 0),
	CONSTRAINT "ext_content_pillars_season_months_check" CHECK ("ext_content_pillars"."season_months" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
);
--> statement-breakpoint
CREATE TABLE "ext_channel_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"provider" "ext_channel_provider" NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text,
	"scopes_granted" text[] DEFAULT '{}' NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"token_refreshed_at" timestamp with time zone,
	"connected_by" uuid,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"status" "ext_channel_account_status" DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"publishing_quota_remaining" integer,
	"publishing_quota_fetched_at" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "ext_channel_accounts_disconnect_state_check" CHECK (("ext_channel_accounts"."status" = 'revoked') = ("ext_channel_accounts"."disconnected_at" is not null)),
	CONSTRAINT "ext_channel_accounts_quota_check" CHECK ("ext_channel_accounts"."publishing_quota_remaining" is null
        or "ext_channel_accounts"."publishing_quota_remaining" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_website_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"sections_draft" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections_published" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_website_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'website_contact' NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "prescriptions" ALTER COLUMN "quantity" SET DATA TYPE numeric(13, 3);--> statement-breakpoint
ALTER TABLE "prescription_events" ALTER COLUMN "quantity" SET DATA TYPE numeric(13, 3);--> statement-breakpoint
DROP TRIGGER IF EXISTS "invoice_items_validate_dispense_charge" ON "invoice_items";--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(13, 3);--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "quantity" SET DEFAULT 1;--> statement-breakpoint
CREATE TRIGGER invoice_items_validate_dispense_charge
  BEFORE INSERT OR UPDATE OF source_dispense_charge_id, invoice_id, item_type, item_id, quantity, unit_price, description, deleted_at
  ON public.invoice_items
  FOR EACH ROW
  WHEN (NEW.source_dispense_charge_id IS NOT NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION validate_dispense_charge_invoice_line();--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stock_quantity" SET DATA TYPE numeric(13, 3);--> statement-breakpoint
ALTER TABLE "dispense_charge_queue" ALTER COLUMN "quantity" SET DATA TYPE numeric(13, 3);--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "sentiment_score" integer;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "sentiment_label" "ext_reputation_sentiment";--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "sentiment_model" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "severity" "ext_reputation_severity" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "classifier_confidence" integer;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "escalation_status" "ext_reputation_escalation" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "escalated_to" uuid;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "escalation_reason" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "internal_ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "ai_reply_draft" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "response_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "response_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "response_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "response_channel" "ext_marketing_channel";--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "response_external_id" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "is_auto_pilot_eligible" boolean;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "platform_account_id" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "review_url" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "reviewer_language" text DEFAULT 'sk' NOT NULL;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "external_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD COLUMN "ingest_source" text;--> statement-breakpoint
ALTER TABLE "ext_marketing_staff_tasks" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD COLUMN "egg_withdrawal_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD COLUMN "meat_safe_until" timestamp;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD COLUMN "milk_safe_until" timestamp;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD COLUMN "eggs_safe_until" timestamp;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD COLUMN "is_cascade_applied" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ext_pilot_feedback" ADD CONSTRAINT "ext_pilot_feedback_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_pilot_feedback" ADD CONSTRAINT "ext_pilot_feedback_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_automation_enrollments_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_automation_enrollments_journey_id_ext_automation_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."ext_automation_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_automation_enrollments_trigger_event_id_ext_automation_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."ext_automation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_auto_enrollments_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_auto_enrollments_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_enrollments" ADD CONSTRAINT "ext_auto_enrollments_journey_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."ext_automation_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_automation_events_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_automation_events_visit_closeout_id_visit_closeouts_id_fk" FOREIGN KEY ("visit_closeout_id") REFERENCES "public"."visit_closeouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_automation_events_emitted_by_users_id_fk" FOREIGN KEY ("emitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_auto_events_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_auto_events_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_events" ADD CONSTRAINT "ext_auto_events_appointment_tenant_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_journeys" ADD CONSTRAINT "ext_automation_journeys_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_journeys" ADD CONSTRAINT "ext_automation_journeys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_journeys" ADD CONSTRAINT "ext_auto_journeys_creator_tenant_fk" FOREIGN KEY ("practice_id","created_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_rules" ADD CONSTRAINT "ext_automation_rules_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_rules" ADD CONSTRAINT "ext_automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_rules" ADD CONSTRAINT "ext_auto_rules_creator_tenant_fk" FOREIGN KEY ("practice_id","created_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_enrollment_id_ext_automation_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."ext_automation_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_message_log_id_ext_marketing_message_logs_id_fk" FOREIGN KEY ("message_log_id") REFERENCES "public"."ext_marketing_message_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_content_item_id_ext_marketing_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."ext_marketing_content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_staff_task_id_ext_marketing_staff_tasks_id_fk" FOREIGN KEY ("staff_task_id") REFERENCES "public"."ext_marketing_staff_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_automation_step_executions_care_reminder_id_care_reminders_id_fk" FOREIGN KEY ("care_reminder_id") REFERENCES "public"."care_reminders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_step_executions" ADD CONSTRAINT "ext_auto_steps_communication_tenant_fk" FOREIGN KEY ("practice_id","communication_id") REFERENCES "public"."communications"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_automation_suppression_log_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_automation_suppression_log_enrollment_id_ext_automation_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."ext_automation_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_automation_suppression_log_rule_id_ext_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."ext_automation_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_automation_suppression_log_journey_id_ext_automation_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."ext_automation_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_automation_suppression_log_event_id_ext_automation_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ext_automation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_auto_suppression_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_automation_suppression_log" ADD CONSTRAINT "ext_auto_suppression_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_segment_memberships_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_segment_memberships_segment_id_ext_crm_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."ext_crm_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_segment_memberships_trigger_event_id_ext_automation_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."ext_automation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_segment_memberships_excluded_by_users_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_memberships_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segment_memberships" ADD CONSTRAINT "ext_crm_memberships_excluder_tenant_fk" FOREIGN KEY ("practice_id","excluded_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segments" ADD CONSTRAINT "ext_crm_segments_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segments" ADD CONSTRAINT "ext_crm_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_crm_segments" ADD CONSTRAINT "ext_crm_segments_creator_tenant_fk" FOREIGN KEY ("practice_id","created_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_pillar_id_ext_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."ext_content_pillars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_trigger_event_id_ext_automation_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."ext_automation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_content_item_id_ext_marketing_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."ext_marketing_content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_briefs" ADD CONSTRAINT "ext_content_briefs_reviewer_tenant_fk" FOREIGN KEY ("practice_id","reviewed_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_content_pillars" ADD CONSTRAINT "ext_content_pillars_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_channel_accounts" ADD CONSTRAINT "ext_channel_accounts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_channel_accounts" ADD CONSTRAINT "ext_channel_accounts_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_channel_accounts" ADD CONSTRAINT "ext_channel_accounts_connector_tenant_fk" FOREIGN KEY ("practice_id","connected_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_website_config" ADD CONSTRAINT "ext_marketing_website_config_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_website_inquiries" ADD CONSTRAINT "ext_marketing_website_inquiries_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_website_inquiries" ADD CONSTRAINT "ext_marketing_website_inquiries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_pilot_feedback_practice_idx" ON "ext_pilot_feedback" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_pilot_feedback_incident_date_idx" ON "ext_pilot_feedback" USING btree ("practice_id","incident_date");--> statement-breakpoint
CREATE INDEX "ext_auto_enroll_client_status_idx" ON "ext_automation_enrollments" USING btree ("practice_id","client_id","status");--> statement-breakpoint
CREATE INDEX "ext_auto_enroll_journey_status_idx" ON "ext_automation_enrollments" USING btree ("practice_id","journey_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_enroll_dedupe_uq" ON "ext_automation_enrollments" USING btree ("practice_id","journey_id","client_id","trigger_event_id");--> statement-breakpoint
CREATE INDEX "ext_auto_events_type_processed_idx" ON "ext_automation_events" USING btree ("practice_id","event_type","processed_at");--> statement-breakpoint
CREATE INDEX "ext_auto_events_practice_client_idx" ON "ext_automation_events" USING btree ("practice_id","client_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ext_auto_events_queue_idx" ON "ext_automation_events" USING btree ("status","available_at","id") WHERE "ext_automation_events"."status" = 'pending' and "ext_automation_events"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_auto_events_stuck_idx" ON "ext_automation_events" USING btree ("locked_at") WHERE "ext_automation_events"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "ext_auto_events_appointment_idx" ON "ext_automation_events" USING btree ("practice_id","appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_events_emission_uq" ON "ext_automation_events" USING btree ("practice_id","event_type","dedupe_key") WHERE "ext_automation_events"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_journeys_practice_key_uq" ON "ext_automation_journeys" USING btree ("practice_id","journey_key") WHERE "ext_automation_journeys"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_auto_journeys_trigger_idx" ON "ext_automation_journeys" USING btree ("practice_id","trigger_event_type","id") WHERE "ext_automation_journeys"."is_active" = true and "ext_automation_journeys"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_rules_practice_key_uq" ON "ext_automation_rules" USING btree ("practice_id","rule_key") WHERE "ext_automation_rules"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_auto_rules_trigger_idx" ON "ext_automation_rules" USING btree ("practice_id","trigger_event_type","priority","id") WHERE "ext_automation_rules"."is_active" = true and "ext_automation_rules"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_auto_rules_practice_idx" ON "ext_automation_rules" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_auto_steps_due_idx" ON "ext_automation_step_executions" USING btree ("scheduled_at","id") WHERE "ext_automation_step_executions"."status" = 'scheduled' and "ext_automation_step_executions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_auto_steps_enrollment_idx" ON "ext_automation_step_executions" USING btree ("practice_id","enrollment_id","step_index");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_steps_enrollment_step_uq" ON "ext_automation_step_executions" USING btree ("enrollment_id","step_index");--> statement-breakpoint
CREATE INDEX "ext_auto_steps_status_idx" ON "ext_automation_step_executions" USING btree ("practice_id","status","executed_at");--> statement-breakpoint
CREATE INDEX "ext_auto_suppression_client_idx" ON "ext_automation_suppression_log" USING btree ("practice_id","client_id","blocked_at");--> statement-breakpoint
CREATE INDEX "ext_auto_suppression_reason_idx" ON "ext_automation_suppression_log" USING btree ("practice_id","suppression_reason","blocked_at");--> statement-breakpoint
CREATE INDEX "ext_auto_suppression_patient_idx" ON "ext_automation_suppression_log" USING btree ("practice_id","patient_id","blocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_auto_suppression_dedupe_uq" ON "ext_automation_suppression_log" USING btree ("practice_id","dedupe_key") WHERE "ext_automation_suppression_log"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_crm_membership_uq" ON "ext_crm_segment_memberships" USING btree ("practice_id","segment_id","client_id") WHERE "ext_crm_segment_memberships"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_crm_membership_client_idx" ON "ext_crm_segment_memberships" USING btree ("practice_id","client_id","is_manually_excluded");--> statement-breakpoint
CREATE INDEX "ext_crm_membership_segment_idx" ON "ext_crm_segment_memberships" USING btree ("practice_id","segment_id","is_manually_excluded","expires_at");--> statement-breakpoint
CREATE INDEX "ext_crm_membership_expiry_idx" ON "ext_crm_segment_memberships" USING btree ("expires_at") WHERE "ext_crm_segment_memberships"."expires_at" is not null and "ext_crm_segment_memberships"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_crm_segments_practice_key_uq" ON "ext_crm_segments" USING btree ("practice_id","segment_key") WHERE "ext_crm_segments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_crm_segments_practice_idx" ON "ext_crm_segments" USING btree ("practice_id","deleted_at","is_active");--> statement-breakpoint
CREATE INDEX "ext_crm_segments_refresh_due_idx" ON "ext_crm_segments" USING btree ("practice_id","last_refreshed_at") WHERE "ext_crm_segments"."refresh_strategy" = 'scheduled' and "ext_crm_segments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_content_briefs_status_idx" ON "ext_content_briefs" USING btree ("practice_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ext_content_briefs_pillar_idx" ON "ext_content_briefs" USING btree ("practice_id","pillar_id","status");--> statement-breakpoint
CREATE INDEX "ext_content_briefs_practice_idx" ON "ext_content_briefs" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_content_briefs_content_item_uq" ON "ext_content_briefs" USING btree ("practice_id","content_item_id") WHERE "ext_content_briefs"."content_item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_content_pillars_practice_key_uq" ON "ext_content_pillars" USING btree ("practice_id","pillar_key") WHERE "ext_content_pillars"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_content_pillars_practice_idx" ON "ext_content_pillars" USING btree ("practice_id","deleted_at","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_channel_accounts_practice_provider_account_uq" ON "ext_channel_accounts" USING btree ("practice_id","provider","external_account_id") WHERE "ext_channel_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_channel_accounts_provider_status_idx" ON "ext_channel_accounts" USING btree ("practice_id","provider","status") WHERE "ext_channel_accounts"."disconnected_at" is null and "ext_channel_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_channel_accounts_token_expiry_idx" ON "ext_channel_accounts" USING btree ("token_expires_at") WHERE "ext_channel_accounts"."token_expires_at" is not null and "ext_channel_accounts"."disconnected_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_marketing_website_config_practice_id_unique" ON "ext_marketing_website_config" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_web_inquiries_practice_idx" ON "ext_marketing_website_inquiries" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_web_inquiries_created_idx" ON "ext_marketing_website_inquiries" USING btree ("practice_id","created_at");--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_response_approved_by_users_id_fk" FOREIGN KEY ("response_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ekasa_daily_closures_closed_by_idx" ON "ekasa_daily_closures" USING btree ("closed_by");--> statement-breakpoint
CREATE INDEX "ekasa_receipts_invoice_idx" ON "ekasa_receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "kvl_cr_passports_client_idx" ON "kvl_cr_passports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "kvl_cr_passports_issued_by_idx" ON "kvl_cr_passports" USING btree ("issued_by");--> statement-breakpoint
CREATE INDEX "microchip_registrations_client_idx" ON "microchip_registrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "microchip_registrations_vet_idx" ON "microchip_registrations" USING btree ("veterinarian_id");--> statement-breakpoint
CREATE INDEX "pet_passports_client_idx" ON "pet_passports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "pet_passports_issued_by_idx" ON "pet_passports" USING btree ("issued_by");--> statement-breakpoint
CREATE INDEX "pet_passports_vaccination_record_idx" ON "pet_passports" USING btree ("vaccination_record_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_auto_rule_practice_idx" ON "ext_marketing_automation_rules" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_batches_practice_idx" ON "ext_marketing_content_batches" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_batch_idx" ON "ext_marketing_content_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_created_by_idx" ON "ext_marketing_content_items" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_media_idx" ON "ext_marketing_content_items" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_approved_by_idx" ON "ext_marketing_content_items" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_handouts_created_by_idx" ON "ext_marketing_handouts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_media_uploaded_idx" ON "ext_marketing_media_assets" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_media_file_idx" ON "ext_marketing_media_assets" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_media_consent_idx" ON "ext_marketing_media_assets" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_consents_req_idx" ON "ext_marketing_media_consents" USING btree ("consent_request_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_msg_log_patient_idx" ON "ext_marketing_message_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_msg_log_template_idx" ON "ext_marketing_message_logs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_tpl_practice_idx" ON "ext_marketing_message_templates" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_postop_msg_log_idx" ON "ext_marketing_postop_responses" USING btree ("message_log_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_postop_client_idx" ON "ext_marketing_postop_responses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_postop_patient_idx" ON "ext_marketing_postop_responses" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_patient_idx" ON "ext_marketing_reviews" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_client_idx" ON "ext_marketing_reviews" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_appt_idx" ON "ext_marketing_reviews" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_replied_by_idx" ON "ext_marketing_reviews" USING btree ("replied_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_escalated_to_idx" ON "ext_marketing_reviews" USING btree ("escalated_to");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_resp_approved_by_idx" ON "ext_marketing_reviews" USING btree ("response_approved_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_inbox_idx" ON "ext_marketing_reviews" USING btree ("practice_id","escalation_status","received_at") WHERE "ext_marketing_reviews"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_sentiment_idx" ON "ext_marketing_reviews" USING btree ("practice_id","sentiment_label","severity");--> statement-breakpoint
CREATE INDEX "ext_mkt_staff_tasks_client_idx" ON "ext_marketing_staff_tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_staff_tasks_due_at_idx" ON "ext_marketing_staff_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_tv_created_by_idx" ON "ext_marketing_tv_slides" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "ext_mkt_tv_media_idx" ON "ext_marketing_tv_slides" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_redemptions_appt_idx" ON "ext_marketing_wellness_redemptions" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "ext_sms_delivery_practice_idx" ON "ext_sms_delivery_log" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_support_audit_session_idx" ON "ext_support_session_audit" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ext_support_audit_user_idx" ON "ext_support_session_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ext_support_sessions_practice_idx" ON "ext_support_sessions" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_support_sessions_client_idx" ON "ext_support_sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ext_support_sessions_created_by_idx" ON "ext_support_sessions" USING btree ("created_by");