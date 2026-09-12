CREATE TYPE "public"."kvepis_signature_method" AS ENUM('NONE', 'DSIGNER', 'CLOUD_SEAL', 'HSM');--> statement-breakpoint
CREATE TYPE "public"."kvepis_submission_status" AS ENUM('DRAFT', 'VALIDATED', 'SIGNED', 'SUBMITTED', 'ACKNOWLEDGED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."kvepis_submission_type" AS ENUM('rabies_notification', 'treatment_diary_batch', 'animal_movement', 'infectious_disease_alert');--> statement-breakpoint
CREATE TABLE "ext_kvepis_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"ico" text NOT NULL,
	"kvl_id" text,
	"upvs_schranka" text,
	"integration_mode" text DEFAULT 'GUIDED' NOT NULL,
	"signing_preference" "kvepis_signature_method" DEFAULT 'DSIGNER' NOT NULL,
	"certificate_base64" text,
	"certificate_serial" text,
	"certificate_valid_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_kvepis_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"submission_type" "kvepis_submission_type" NOT NULL,
	"status" "kvepis_submission_status" DEFAULT 'DRAFT' NOT NULL,
	"reference_number" text NOT NULL,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"patient_id" uuid,
	"farm_ico" text,
	"cehz_code" text,
	"ear_tag_number" text,
	"transponder_number" text,
	"kvl_number" text,
	"payload_xml" text,
	"payload_json" jsonb,
	"payload_hash" text,
	"signature_method" "kvepis_signature_method" DEFAULT 'NONE' NOT NULL,
	"signature_payload" jsonb,
	"signed_by" uuid,
	"signed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"upvs_message_id" text,
	"receipt_received_at" timestamp with time zone,
	"receipt_payload" jsonb,
	"receipt_hash" text,
	"error_code" text,
	"error_message" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "ext_kvepis_credentials" ADD CONSTRAINT "ext_kvepis_credentials_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_kvepis_submissions" ADD CONSTRAINT "ext_kvepis_submissions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_kvepis_submissions" ADD CONSTRAINT "ext_kvepis_submissions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_kvepis_submissions" ADD CONSTRAINT "ext_kvepis_submissions_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_kvepis_credentials_practice_uq" ON "ext_kvepis_credentials" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "ext_kvepis_submissions_practice_idx" ON "ext_kvepis_submissions" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_kvepis_submissions_status_idx" ON "ext_kvepis_submissions" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_kvepis_submissions_type_idx" ON "ext_kvepis_submissions" USING btree ("practice_id","submission_type","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_kvepis_submissions_patient_idx" ON "ext_kvepis_submissions" USING btree ("patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_kvepis_submissions_source_idx" ON "ext_kvepis_submissions" USING btree ("source_entity_type","source_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_kvepis_submissions_ref_uq" ON "ext_kvepis_submissions" USING btree ("practice_id","reference_number");