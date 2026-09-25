CREATE TYPE "public"."ekasa_payment_method" AS ENUM('CASH', 'CARD', 'TRANSFER');--> statement-breakpoint
CREATE TYPE "public"."ekasa_pokladnica_type" AS ENUM('ORP', 'VRP', 'CLOUD');--> statement-breakpoint
CREATE TYPE "public"."ekasa_receipt_status" AS ENUM('PENDING', 'SENT', 'CONFIRMED', 'FAILED', 'OFFLINE_STORED');--> statement-breakpoint
CREATE TYPE "public"."ekasa_receipt_type" AS ENUM('STANDARD', 'STORNO', 'RETURN', 'DEPOSIT', 'WITHDRAWAL');--> statement-breakpoint
CREATE TYPE "public"."ekasa_vat_rate" AS ENUM('ZERO', 'REDUCED', 'STANDARD', 'REDUCED_5', 'REDUCED_19', 'STANDARD_23');--> statement-breakpoint
CREATE TYPE "public"."ai_imaging_image_type" AS ENUM('xray', 'ct', 'mri', 'ultrasound', 'photo');--> statement-breakpoint
CREATE TYPE "public"."ai_imaging_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."crsz_registration_status" AS ENUM('NOT_REGISTERED', 'PENDING_SUBMISSION', 'REGISTERED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."microchip_location" AS ENUM('LEFT_NECK', 'INTERSCAPULAR', 'RIGHT_NECK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."analyzer_type" AS ENUM('IDEXX', 'FUJI_DRI_CHEM', 'MINDRAY', 'GENERIC_CSV', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."lab_report_status" AS ENUM('UNASSIGNED', 'ATTACHED', 'REVIEWED');--> statement-breakpoint
CREATE TYPE "public"."voice_dictation_status" AS ENUM('RECORDING', 'TRANSCRIBING', 'FORMATTING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."discharge_report_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_channel" AS ENUM('instagram', 'facebook', 'google_business', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_consent_evidence" AS ENUM('signature', 'sms_confirm', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_consent_scope" AS ENUM('photo_social', 'photo_web', 'photo_tv', 'story', 'testimonial', 'marketing_messages');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_content_status" AS ENUM('proposed', 'approved', 'published', 'blocked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_media_kind" AS ENUM('photo', 'brand_graphic', 'video', 'illustration');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'suppressed_quiet', 'suppressed_rate', 'suppressed_no_consent', 'blocked_sympathy');--> statement-breakpoint
CREATE TYPE "public"."ext_marketing_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."ai_audit_entity_type" AS ENUM('soap_note', 'discharge_report', 'imaging_analysis', 'treatment_plan', 'prescription');--> statement-breakpoint
CREATE TYPE "public"."clinician_confirmation_status" AS ENUM('PENDING', 'CONSUMED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "ekasa_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"dic" text NOT NULL,
	"ic_dph" text,
	"pokladnica_id" text NOT NULL,
	"pokladnica_type" "ekasa_pokladnica_type" DEFAULT 'CLOUD' NOT NULL,
	"ekasa_api_url" text DEFAULT 'https://ekasa.financnasprava.sk/oto/api' NOT NULL,
	"cert_base64" text,
	"cert_password" text,
	"offline_mode_enabled" boolean DEFAULT false NOT NULL,
	"cashless_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ekasa_daily_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"closure_number" text NOT NULL,
	"date" text NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" uuid,
	"receipts_count" numeric(8, 0) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"cash_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"card_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"transfer_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"vat_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"okp" text,
	"status" text DEFAULT 'CLOSED' NOT NULL,
	"raw_response" jsonb
);
--> statement-breakpoint
CREATE TABLE "ekasa_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payment_id" uuid,
	"receipt_number" text NOT NULL,
	"uid" text,
	"okp" text,
	"pkp" text,
	"receipt_type" "ekasa_receipt_type" DEFAULT 'STANDARD' NOT NULL,
	"original_receipt_id" uuid,
	"original_uid" text,
	"storno_reason" text,
	"amount_base" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_vat" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_total" numeric(12, 2) NOT NULL,
	"vat_rate" "ekasa_vat_rate" DEFAULT 'STANDARD_23' NOT NULL,
	"tax_breakdown" jsonb,
	"items" jsonb,
	"payment_method" "ekasa_payment_method" DEFAULT 'CARD' NOT NULL,
	"status" "ekasa_receipt_status" DEFAULT 'PENDING' NOT NULL,
	"raw_response" jsonb,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retry_count" numeric(4, 0) DEFAULT '0' NOT NULL,
	"last_retry_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_imaging_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"appointment_id" uuid,
	"requested_by" uuid NOT NULL,
	"model_id" text NOT NULL,
	"image_type" "ai_imaging_image_type" NOT NULL,
	"analysis_type" text DEFAULT 'diagnosis',
	"user_prompt" text,
	"result" text,
	"raw_response" jsonb,
	"status" "ai_imaging_status" DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "microchip_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"veterinarian_id" uuid NOT NULL,
	"microchip_number" varchar(32) NOT NULL,
	"location" "microchip_location" DEFAULT 'LEFT_NECK' NOT NULL,
	"custom_location" text,
	"implanted_at" date NOT NULL,
	"verified_before_implant" varchar(8) DEFAULT 'YES',
	"verified_after_implant" varchar(8) DEFAULT 'YES',
	"vet_kvl_number" varchar(64),
	"crsz_status" "crsz_registration_status" DEFAULT 'NOT_REGISTERED' NOT NULL,
	"crsz_registered_at" timestamp with time zone,
	"crsz_record_id" varchar(128),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pet_passports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"issued_by" uuid NOT NULL,
	"passport_number" varchar(32) NOT NULL,
	"issued_at" date NOT NULL,
	"issuing_clinic_name" text,
	"issuing_vet_name" text,
	"issuing_vet_kvl" varchar(64),
	"rabies_vaccine_name" varchar(128),
	"rabies_batch_number" varchar(64),
	"rabies_administered_at" date,
	"rabies_valid_until" date,
	"travel_eligible_from" date,
	"vaccination_record_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "lab_analyzer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid,
	"client_id" uuid,
	"reviewed_by_id" uuid,
	"analyzer_type" "analyzer_type" DEFAULT 'GENERIC_CSV' NOT NULL,
	"device_model" varchar(128),
	"sample_id" varchar(128),
	"sample_date" timestamp with time zone,
	"species" varchar(32),
	"file_name" varchar(255),
	"raw_content" text,
	"parsed_results" jsonb NOT NULL,
	"abnormal_count" integer DEFAULT 0 NOT NULL,
	"critical_count" integer DEFAULT 0 NOT NULL,
	"status" "lab_report_status" DEFAULT 'UNASSIGNED' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "voice_dictations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"dictated_by" uuid NOT NULL,
	"audio_file_key" text,
	"audio_mime_type" text,
	"audio_duration_seconds" text,
	"model_id" text NOT NULL,
	"raw_transcript" text,
	"language" text DEFAULT 'sk',
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"raw_ai_response" jsonb,
	"formatted_soap" jsonb,
	"soap_note_id" uuid,
	"formatted_at" timestamp with time zone,
	"status" "voice_dictation_status" DEFAULT 'RECORDING' NOT NULL,
	"error_message" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"transcribed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"audio_deleted_at" timestamp with time zone,
	"scheduled_delete_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discharge_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"created_by" uuid NOT NULL,
	"pet_name" text NOT NULL,
	"species" text,
	"diagnosis" text NOT NULL,
	"treatment" text,
	"follow_up" text,
	"report_text" text NOT NULL,
	"language" text DEFAULT 'sk',
	"model_id" text,
	"status" "discharge_report_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"trigger_key" text NOT NULL,
	"timing" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"legal_basis" text DEFAULT 'contract' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_competitor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"query" text NOT NULL,
	"region" text NOT NULL,
	"clinics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text DEFAULT 'gemini-3.6-flash' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_content_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"status" text DEFAULT 'in_review' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"batch_id" uuid,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"channel" "ext_marketing_channel" NOT NULL,
	"status" "ext_marketing_content_status" DEFAULT 'proposed' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"media_asset_id" uuid,
	"validator_verdict" text,
	"validator_findings" jsonb,
	"approved_by" uuid,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_handouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"species" text[],
	"tags" text[],
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_id" uuid,
	"url" text,
	"kind" "ext_marketing_media_kind" NOT NULL,
	"caption" text,
	"patient_name" text,
	"subjects_present" boolean DEFAULT false NOT NULL,
	"tags" text[],
	"alt_text" text DEFAULT '',
	"meta" jsonb,
	"consent_id" uuid,
	CONSTRAINT "ext_mkt_media_consent_required" CHECK (("ext_marketing_media_assets"."subjects_present" = false) OR ("ext_marketing_media_assets"."consent_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_media_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"consent_request_id" uuid,
	"scope" "ext_marketing_consent_scope" NOT NULL,
	"evidence_type" "ext_marketing_consent_evidence" NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"template_id" uuid,
	"template_key" text NOT NULL,
	"template_version" integer NOT NULL,
	"legal_basis" text NOT NULL,
	"channel" text NOT NULL,
	"language" text DEFAULT 'sk' NOT NULL,
	"body_rendered" text NOT NULL,
	"trigger_key" text NOT NULL,
	"status" "ext_marketing_message_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "ext_marketing_message_logs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"key" text NOT NULL,
	"language" text DEFAULT 'sk' NOT NULL,
	"channel" text NOT NULL,
	"body" text NOT NULL,
	"legal_basis" text DEFAULT 'contract' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_operative_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_postop_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"message_log_id" uuid,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"outcome" text NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_recall_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"vaccination_recall_enabled" boolean DEFAULT false NOT NULL,
	"vaccination_recall_lead_days" integer DEFAULT 14 NOT NULL,
	"post_visit_review_enabled" boolean DEFAULT false NOT NULL,
	"post_visit_review_delay_hours" integer DEFAULT 24 NOT NULL,
	"post_visit_handout_enabled" boolean DEFAULT false NOT NULL,
	"inactive_recall_enabled" boolean DEFAULT false NOT NULL,
	"inactive_recall_months" integer DEFAULT 18 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid,
	"client_id" uuid,
	"appointment_id" uuid,
	"platform" text DEFAULT 'google' NOT NULL,
	"external_review_id" text,
	"rating" integer,
	"review_text" text,
	"reviewer_name" text,
	"received_at" timestamp with time zone,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"replied_by" uuid,
	"request_sent_at" timestamp with time zone,
	"request_blocked_reason" text
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_staff_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"kind" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"client_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_tv_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"media_asset_id" uuid,
	"duration_seconds" integer DEFAULT 12 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_marketing_wellness_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"benefit_key" text NOT NULL,
	"redeemed_at" timestamp with time zone NOT NULL,
	"appointment_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_sms_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_record_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_support_session_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"action" varchar(30) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_support_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" varchar(255) NOT NULL,
	"client_id" varchar(255),
	"created_by" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"session_code" text NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_support_sessions_session_code_unique" UNIQUE("session_code")
);
--> statement-breakpoint
CREATE TABLE "ext_carcass_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid,
	"euthanasia_date" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"medication_used" text DEFAULT 'T61 / Pentobarbital' NOT NULL,
	"dose_administered" text,
	"veterinarian_name" text NOT NULL,
	"rendering_plant" text DEFAULT 'VAS s.r.o. Mojšova Lúčka' NOT NULL,
	"disposal_document_number" text,
	"picked_up_at" timestamp with time zone,
	"storage_location" text,
	"client_consent_signed" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_rabies_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"vaccination_record_id" uuid NOT NULL,
	"rvps_notified_at" timestamp,
	"rvps_office_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submission_reference" text
);
--> statement-breakpoint
CREATE TABLE "ext_rabies_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid,
	"bite_date" timestamp with time zone NOT NULL,
	"injured_person_name" text NOT NULL,
	"injured_person_contact" text,
	"incident_location" text,
	"incident_description" text,
	"day1_examined_at" timestamp with time zone,
	"day1_examined_by" text,
	"day1_findings" text,
	"day1_passed" boolean,
	"day5_examined_at" timestamp with time zone,
	"day5_examined_by" text,
	"day5_findings" text,
	"day5_passed" boolean,
	"day14_examined_at" timestamp with time zone,
	"day14_examined_by" text,
	"day14_findings" text,
	"day14_passed" boolean,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"certificate_issued_at" timestamp with time zone,
	"certificate_number" text,
	"rvps_notified" boolean DEFAULT false,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_withdrawal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"medication_name" text NOT NULL,
	"batch_number" text,
	"target_animal_type" text DEFAULT 'companion' NOT NULL,
	"meat_withdrawal_days" integer DEFAULT 0,
	"milk_withdrawal_days" integer DEFAULT 0,
	"administered_at" timestamp DEFAULT now() NOT NULL,
	"safe_until" timestamp NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ext_ai_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"entity_type" "ai_audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"original_draft_hash" text NOT NULL,
	"confirmed_content_hash" text NOT NULL,
	"was_edited_by_clinician" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"confirmed_at" timestamp with time zone NOT NULL,
	"sequence_number" integer,
	"actor_role" text,
	"action_type" text,
	"previous_event_hash" text,
	"event_hash" text,
	"canonicalization_version" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "ext_clinician_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"action_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"expected_revision" integer DEFAULT 0 NOT NULL,
	"original_draft_hash" text NOT NULL,
	"confirmed_content_hash" text NOT NULL,
	"status" "clinician_confirmation_status" DEFAULT 'PENDING' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by" uuid,
	"correlation_id" text
);
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_primary_namespace_check";--> statement-breakpoint
ALTER TABLE "ekasa_config" ADD CONSTRAINT "ekasa_config_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ekasa_daily_closures" ADD CONSTRAINT "ekasa_daily_closures_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ekasa_daily_closures" ADD CONSTRAINT "ekasa_daily_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ekasa_receipts" ADD CONSTRAINT "ekasa_receipts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ekasa_receipts" ADD CONSTRAINT "ekasa_receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ekasa_receipts" ADD CONSTRAINT "ekasa_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_imaging_analyses" ADD CONSTRAINT "ai_imaging_analyses_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_imaging_analyses" ADD CONSTRAINT "ai_imaging_analyses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_imaging_analyses" ADD CONSTRAINT "ai_imaging_analyses_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_imaging_analyses" ADD CONSTRAINT "ai_imaging_analyses_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_imaging_analyses" ADD CONSTRAINT "ai_imaging_analyses_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microchip_registrations" ADD CONSTRAINT "microchip_registrations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microchip_registrations" ADD CONSTRAINT "microchip_registrations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microchip_registrations" ADD CONSTRAINT "microchip_registrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microchip_registrations" ADD CONSTRAINT "microchip_registrations_veterinarian_id_users_id_fk" FOREIGN KEY ("veterinarian_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_passports" ADD CONSTRAINT "pet_passports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_passports" ADD CONSTRAINT "pet_passports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_passports" ADD CONSTRAINT "pet_passports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_passports" ADD CONSTRAINT "pet_passports_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_passports" ADD CONSTRAINT "pet_passports_vaccination_record_id_vaccination_records_id_fk" FOREIGN KEY ("vaccination_record_id") REFERENCES "public"."vaccination_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyzer_reports" ADD CONSTRAINT "lab_analyzer_reports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyzer_reports" ADD CONSTRAINT "lab_analyzer_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyzer_reports" ADD CONSTRAINT "lab_analyzer_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_analyzer_reports" ADD CONSTRAINT "lab_analyzer_reports_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_dictations" ADD CONSTRAINT "voice_dictations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_dictations" ADD CONSTRAINT "voice_dictations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_dictations" ADD CONSTRAINT "voice_dictations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_dictations" ADD CONSTRAINT "voice_dictations_dictated_by_users_id_fk" FOREIGN KEY ("dictated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_reports" ADD CONSTRAINT "discharge_reports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_reports" ADD CONSTRAINT "discharge_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_reports" ADD CONSTRAINT "discharge_reports_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_reports" ADD CONSTRAINT "discharge_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_automation_rules" ADD CONSTRAINT "ext_marketing_automation_rules_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_competitor_snapshots" ADD CONSTRAINT "ext_marketing_competitor_snapshots_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_batches" ADD CONSTRAINT "ext_marketing_content_batches_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_items" ADD CONSTRAINT "ext_marketing_content_items_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_items" ADD CONSTRAINT "ext_marketing_content_items_batch_id_ext_marketing_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ext_marketing_content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_items" ADD CONSTRAINT "ext_marketing_content_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_items" ADD CONSTRAINT "ext_marketing_content_items_media_asset_id_ext_marketing_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."ext_marketing_media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_content_items" ADD CONSTRAINT "ext_marketing_content_items_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_handouts" ADD CONSTRAINT "ext_marketing_handouts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_handouts" ADD CONSTRAINT "ext_marketing_handouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_assets" ADD CONSTRAINT "ext_marketing_media_assets_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_assets" ADD CONSTRAINT "ext_marketing_media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_assets" ADD CONSTRAINT "ext_marketing_media_assets_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_assets" ADD CONSTRAINT "ext_marketing_media_assets_consent_id_ext_marketing_media_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."ext_marketing_media_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_consents" ADD CONSTRAINT "ext_marketing_media_consents_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_consents" ADD CONSTRAINT "ext_marketing_media_consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_consents" ADD CONSTRAINT "ext_marketing_media_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_media_consents" ADD CONSTRAINT "ext_marketing_media_consents_consent_request_id_consent_requests_id_fk" FOREIGN KEY ("consent_request_id") REFERENCES "public"."consent_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_message_logs" ADD CONSTRAINT "ext_marketing_message_logs_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_message_logs" ADD CONSTRAINT "ext_marketing_message_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_message_logs" ADD CONSTRAINT "ext_marketing_message_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_message_logs" ADD CONSTRAINT "ext_marketing_message_logs_template_id_ext_marketing_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ext_marketing_message_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_message_templates" ADD CONSTRAINT "ext_marketing_message_templates_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_operative_scripts" ADD CONSTRAINT "ext_marketing_operative_scripts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_postop_responses" ADD CONSTRAINT "ext_marketing_postop_responses_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_postop_responses" ADD CONSTRAINT "ext_marketing_postop_responses_message_log_id_ext_marketing_message_logs_id_fk" FOREIGN KEY ("message_log_id") REFERENCES "public"."ext_marketing_message_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_postop_responses" ADD CONSTRAINT "ext_marketing_postop_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_postop_responses" ADD CONSTRAINT "ext_marketing_postop_responses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_recall_schedules" ADD CONSTRAINT "ext_marketing_recall_schedules_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_reviews" ADD CONSTRAINT "ext_marketing_reviews_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_staff_tasks" ADD CONSTRAINT "ext_marketing_staff_tasks_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_staff_tasks" ADD CONSTRAINT "ext_marketing_staff_tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_tv_slides" ADD CONSTRAINT "ext_marketing_tv_slides_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_tv_slides" ADD CONSTRAINT "ext_marketing_tv_slides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_tv_slides" ADD CONSTRAINT "ext_marketing_tv_slides_media_asset_id_ext_marketing_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."ext_marketing_media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_wellness_redemptions" ADD CONSTRAINT "ext_marketing_wellness_redemptions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_wellness_redemptions" ADD CONSTRAINT "ext_marketing_wellness_redemptions_enrollment_id_wellness_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."wellness_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_marketing_wellness_redemptions" ADD CONSTRAINT "ext_marketing_wellness_redemptions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_sms_delivery_log" ADD CONSTRAINT "ext_sms_delivery_log_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_sms_delivery_log" ADD CONSTRAINT "ext_sms_delivery_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_support_session_audit" ADD CONSTRAINT "ext_support_session_audit_session_id_ext_support_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ext_support_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_carcass_disposals" ADD CONSTRAINT "ext_carcass_disposals_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_carcass_disposals" ADD CONSTRAINT "ext_carcass_disposals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_carcass_disposals" ADD CONSTRAINT "ext_carcass_disposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_rabies_notifications" ADD CONSTRAINT "ext_rabies_notifications_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_rabies_observations" ADD CONSTRAINT "ext_rabies_observations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_rabies_observations" ADD CONSTRAINT "ext_rabies_observations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_rabies_observations" ADD CONSTRAINT "ext_rabies_observations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD CONSTRAINT "ext_withdrawal_periods_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_withdrawal_periods" ADD CONSTRAINT "ext_withdrawal_periods_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_ai_audit_log" ADD CONSTRAINT "ext_ai_audit_log_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_ai_audit_log" ADD CONSTRAINT "ext_ai_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinician_confirmations" ADD CONSTRAINT "ext_clinician_confirmations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinician_confirmations" ADD CONSTRAINT "ext_clinician_confirmations_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_clinician_confirmations" ADD CONSTRAINT "ext_clinician_confirmations_consumed_by_users_id_fk" FOREIGN KEY ("consumed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ekasa_config_practice_idx" ON "ekasa_config" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ekasa_config_practice_active_uq" ON "ekasa_config" USING btree ("practice_id","is_active");--> statement-breakpoint
CREATE INDEX "ekasa_daily_closures_practice_idx" ON "ekasa_daily_closures" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ekasa_daily_closures_date_practice_uq" ON "ekasa_daily_closures" USING btree ("practice_id","date");--> statement-breakpoint
CREATE INDEX "ekasa_receipts_practice_idx" ON "ekasa_receipts" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ekasa_receipts_payment_idx" ON "ekasa_receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ekasa_receipts_number_practice_uq" ON "ekasa_receipts" USING btree ("practice_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "ekasa_receipts_uid_uq" ON "ekasa_receipts" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "ekasa_receipts_status_idx" ON "ekasa_receipts" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ekasa_receipts_issued_at_idx" ON "ekasa_receipts" USING btree ("practice_id","issued_at","deleted_at");--> statement-breakpoint
CREATE INDEX "ai_imaging_analyses_practice_idx" ON "ai_imaging_analyses" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ai_imaging_analyses_patient_idx" ON "ai_imaging_analyses" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ai_imaging_analyses_status_idx" ON "ai_imaging_analyses" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ai_imaging_analyses_file_idx" ON "ai_imaging_analyses" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "microchip_registrations_practice_idx" ON "microchip_registrations" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "microchip_registrations_patient_idx" ON "microchip_registrations" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "microchip_registrations_chip_idx" ON "microchip_registrations" USING btree ("microchip_number");--> statement-breakpoint
CREATE INDEX "pet_passports_practice_idx" ON "pet_passports" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "pet_passports_patient_idx" ON "pet_passports" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pet_passports_number_uq" ON "pet_passports" USING btree ("passport_number");--> statement-breakpoint
CREATE INDEX "lab_analyzer_reports_practice_idx" ON "lab_analyzer_reports" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "lab_analyzer_reports_patient_idx" ON "lab_analyzer_reports" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "lab_analyzer_reports_status_idx" ON "lab_analyzer_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lab_analyzer_reports_created_at_idx" ON "lab_analyzer_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "voice_dictations_practice_idx" ON "voice_dictations" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "voice_dictations_patient_idx" ON "voice_dictations" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "voice_dictations_status_idx" ON "voice_dictations" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "discharge_reports_practice_idx" ON "discharge_reports" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "discharge_reports_patient_idx" ON "discharge_reports" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_mkt_auto_rule_practice_key_uq" ON "ext_marketing_automation_rules" USING btree ("practice_id","key");--> statement-breakpoint
CREATE INDEX "ext_mkt_competitor_practice_idx" ON "ext_marketing_competitor_snapshots" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_mkt_batches_practice_week_uq" ON "ext_marketing_content_batches" USING btree ("practice_id","week_start");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_practice_idx" ON "ext_marketing_content_items" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_content_schedule_idx" ON "ext_marketing_content_items" USING btree ("practice_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX "ext_mkt_handouts_practice_idx" ON "ext_marketing_handouts" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_mkt_handouts_slug_uq" ON "ext_marketing_handouts" USING btree ("practice_id","slug");--> statement-breakpoint
CREATE INDEX "ext_mkt_media_practice_idx" ON "ext_marketing_media_assets" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_consents_practice_client_idx" ON "ext_marketing_media_consents" USING btree ("practice_id","client_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_consents_practice_patient_idx" ON "ext_marketing_media_consents" USING btree ("practice_id","patient_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_msg_log_client_idx" ON "ext_marketing_message_logs" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_msg_log_practice_idx" ON "ext_marketing_message_logs" USING btree ("practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_mkt_tpl_practice_key_lang_uq" ON "ext_marketing_message_templates" USING btree ("practice_id","key","language");--> statement-breakpoint
CREATE INDEX "ext_mkt_scripts_practice_idx" ON "ext_marketing_operative_scripts" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_postop_practice_idx" ON "ext_marketing_postop_responses" USING btree ("practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_mkt_recall_practice_uq" ON "ext_marketing_recall_schedules" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_practice_idx" ON "ext_marketing_reviews" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_received_idx" ON "ext_marketing_reviews" USING btree ("practice_id","received_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_reviews_platform_idx" ON "ext_marketing_reviews" USING btree ("practice_id","platform");--> statement-breakpoint
CREATE INDEX "ext_mkt_staff_tasks_practice_idx" ON "ext_marketing_staff_tasks" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_mkt_tv_active_idx" ON "ext_marketing_tv_slides" USING btree ("practice_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX "ext_mkt_redemptions_enrollment_idx" ON "ext_marketing_wellness_redemptions" USING btree ("practice_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "ext_sms_delivery_client_idx" ON "ext_sms_delivery_log" USING btree ("client_id","sent_at");--> statement-breakpoint
CREATE INDEX "ext_carcass_disp_practice_idx" ON "ext_carcass_disposals" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_carcass_disp_patient_idx" ON "ext_carcass_disposals" USING btree ("patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_rabies_notifications_practice_idx" ON "ext_rabies_notifications" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_rabies_obs_practice_idx" ON "ext_rabies_observations" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_rabies_obs_patient_idx" ON "ext_rabies_observations" USING btree ("patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_rabies_obs_status_idx" ON "ext_rabies_observations" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_withdrawal_periods_practice_idx" ON "ext_withdrawal_periods" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_withdrawal_periods_patient_idx" ON "ext_withdrawal_periods" USING btree ("patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_ai_audit_log_practice_idx" ON "ext_ai_audit_log" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_ai_audit_log_entity_idx" ON "ext_ai_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ext_ai_audit_log_actor_idx" ON "ext_ai_audit_log" USING btree ("actor_id","confirmed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_ai_audit_log_practice_seq_uniq" ON "ext_ai_audit_log" USING btree ("practice_id","sequence_number");--> statement-breakpoint
CREATE INDEX "ext_clinician_confirmations_practice_idx" ON "ext_clinician_confirmations" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_clinician_confirmations_entity_idx" ON "ext_clinician_confirmations" USING btree ("entity_type","entity_id","status");--> statement-breakpoint
CREATE INDEX "ext_clinician_confirmations_actor_idx" ON "ext_clinician_confirmations" USING btree ("actor_id","status");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_primary_namespace_check" CHECK ("files"."category" in ('patient-photos', 'documents', 'lab-results', 'branding', 'consents', 'imaging') and "files"."file_key" ~ ('^' || "files"."practice_id"::text || '/' || "files"."category" || '/[^/]+$') and "files"."file_url" = '/api/files/' || "files"."file_key");