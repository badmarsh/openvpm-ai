CREATE TYPE "public"."soap_ai_source" AS ENUM('soap_draft', 'imaging_findings');--> statement-breakpoint
CREATE TABLE "ext_soap_ai_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"soap_note_id" uuid,
	"appointment_id" uuid,
	"issued_to" uuid NOT NULL,
	"source" "soap_ai_source" NOT NULL,
	"source_entity_id" uuid,
	"model_id" text,
	"provider" text,
	"feature_key" text NOT NULL,
	"draft_hash" text NOT NULL,
	"section_hashes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consumed_at" timestamp with time zone,
	"audit_event_id" uuid
);
--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_soap_note_id_soap_notes_id_fk" FOREIGN KEY ("soap_note_id") REFERENCES "public"."soap_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_issued_to_users_id_fk" FOREIGN KEY ("issued_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_soap_ai_provenance" ADD CONSTRAINT "ext_soap_ai_provenance_audit_event_id_ext_ai_audit_log_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."ext_ai_audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_soap_ai_prov_practice_note_idx" ON "ext_soap_ai_provenance" USING btree ("practice_id","soap_note_id");--> statement-breakpoint
CREATE INDEX "ext_soap_ai_prov_practice_issued_idx" ON "ext_soap_ai_provenance" USING btree ("practice_id","patient_id","issued_to","created_at");