CREATE TYPE "public"."client_contact_kind" AS ENUM('co_owner', 'authorized_contact', 'billing_contact', 'emergency_contact', 'other');--> statement-breakpoint
CREATE TYPE "public"."external_lab_report_status" AS ENUM('ordered', 'partial', 'final', 'corrected', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."external_prescription_status" AS ENUM('active', 'completed', 'cancelled', 'expired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."historical_appointment_status" AS ENUM('completed', 'cancelled', 'no_show', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."historical_document_kind" AS ENUM('patient_record', 'lab_report', 'prescription', 'appointment', 'financial', 'other');--> statement-breakpoint
CREATE TYPE "public"."historical_document_link_status" AS ENUM('linked', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."imported_clinical_review_status" AS ENUM('unreviewed', 'confirmed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."legacy_financial_document_status" AS ENUM('open', 'partial', 'paid', 'void', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."legacy_financial_document_type" AS ENUM('invoice', 'credit_note', 'estimate');--> statement-breakpoint
CREATE TYPE "public"."legacy_financial_payment_type" AS ENUM('payment', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."migration_attribution_status" AS ENUM('matched', 'needs_review');--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'client_contacts';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'historical_appointments';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'external_prescriptions';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'external_prescription_fills';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'external_lab_reports';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'external_lab_observations';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'legacy_financial_documents';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'legacy_financial_line_items';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'legacy_financial_payments';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'legacy_financial_allocations';--> statement-breakpoint
ALTER TYPE "public"."migration_run_mode" ADD VALUE 'historical_documents';--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid,
	"attribution_status" "migration_attribution_status" DEFAULT 'matched' NOT NULL,
	"kind" "client_contact_kind" DEFAULT 'co_owner' NOT NULL,
	"first_name" varchar(128),
	"last_name" varchar(128),
	"email" varchar(255),
	"phone" varchar(32),
	"external_source" varchar(64),
	"external_id" varchar(160),
	"import_fingerprint" varchar(64),
	CONSTRAINT "client_contacts_name_check" CHECK (("client_contacts"."first_name" is null or length(btrim("client_contacts"."first_name")) > 0)
        and ("client_contacts"."last_name" is null or length(btrim("client_contacts"."last_name")) > 0)
        and ("client_contacts"."first_name" is not null or "client_contacts"."last_name" is not null or "client_contacts"."email" is not null or "client_contacts"."phone" is not null)),
	CONSTRAINT "client_contacts_attribution_check" CHECK (("client_contacts"."attribution_status" = 'matched' and "client_contacts"."client_id" is not null)
        or ("client_contacts"."attribution_status" = 'needs_review' and "client_contacts"."client_id" is null)),
	CONSTRAINT "client_contacts_import_identity_check" CHECK (("client_contacts"."external_source" is null and "client_contacts"."external_id" is null and "client_contacts"."import_fingerprint" is null)
        or ("client_contacts"."external_source" is not null and "client_contacts"."external_id" is not null and "client_contacts"."import_fingerprint" is not null)),
	CONSTRAINT "client_contacts_import_source_check" CHECK ("client_contacts"."external_source" is null or "client_contacts"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "client_contacts_import_fingerprint_check" CHECK ("client_contacts"."import_fingerprint" is null or "client_contacts"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "external_lab_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(255) NOT NULL,
	"value" text,
	"unit" varchar(64),
	"reference_range" varchar(255),
	"flag" varchar(64),
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "external_lab_observations_value_check" CHECK ("external_lab_observations"."sort_order" >= 0 and length(btrim("external_lab_observations"."name")) > 0 and ("external_lab_observations"."value" is null or char_length("external_lab_observations"."value") <= 4000)),
	CONSTRAINT "external_lab_observations_source_check" CHECK ("external_lab_observations"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "external_lab_observations_fingerprint_check" CHECK ("external_lab_observations"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "external_lab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid,
	"attribution_status" "migration_attribution_status" DEFAULT 'matched' NOT NULL,
	"ordered_at" timestamp with time zone,
	"resulted_at" timestamp with time zone,
	"status" "external_lab_report_status" DEFAULT 'unknown' NOT NULL,
	"lab_name" varchar(255),
	"order_name" varchar(255),
	"accession_number" varchar(160),
	"summary" text,
	"interpretation" text,
	"review_status" "imported_clinical_review_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "external_lab_reports_review_shape_check" CHECK (("external_lab_reports"."review_status" = 'unreviewed' and "external_lab_reports"."reviewed_at" is null and "external_lab_reports"."reviewed_by" is null)
        or ("external_lab_reports"."review_status" in ('confirmed', 'superseded') and "external_lab_reports"."reviewed_at" is not null and "external_lab_reports"."reviewed_by" is not null)),
	CONSTRAINT "external_lab_reports_attribution_check" CHECK (("external_lab_reports"."attribution_status" = 'matched' and "external_lab_reports"."patient_id" is not null)
        or ("external_lab_reports"."attribution_status" = 'needs_review' and "external_lab_reports"."patient_id" is null)),
	CONSTRAINT "external_lab_reports_date_check" CHECK ("external_lab_reports"."resulted_at" is null or "external_lab_reports"."ordered_at" is null or "external_lab_reports"."resulted_at" >= "external_lab_reports"."ordered_at"),
	CONSTRAINT "external_lab_reports_text_length_check" CHECK (("external_lab_reports"."summary" is null or char_length("external_lab_reports"."summary") <= 12000)
        and ("external_lab_reports"."interpretation" is null or char_length("external_lab_reports"."interpretation") <= 12000)),
	CONSTRAINT "external_lab_reports_source_check" CHECK ("external_lab_reports"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "external_lab_reports_fingerprint_check" CHECK ("external_lab_reports"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "external_prescription_fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"prescription_id" uuid NOT NULL,
	"filled_at" timestamp with time zone,
	"quantity_dispensed" numeric(14, 3),
	"directions" text,
	"source_status" varchar(128),
	"prescriber_display_name" varchar(255),
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "external_prescription_fills_value_check" CHECK (("external_prescription_fills"."quantity_dispensed" is null or "external_prescription_fills"."quantity_dispensed" >= 0)
        and ("external_prescription_fills"."directions" is null or char_length("external_prescription_fills"."directions") <= 12000)),
	CONSTRAINT "external_prescription_fills_source_check" CHECK ("external_prescription_fills"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "external_prescription_fills_fingerprint_check" CHECK ("external_prescription_fills"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "external_prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"medication_name" varchar(255) NOT NULL,
	"directions" text,
	"quantity" numeric(14, 3),
	"refill_count" integer,
	"prescribed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" "external_prescription_status" DEFAULT 'unknown' NOT NULL,
	"is_chronic" boolean DEFAULT false NOT NULL,
	"prescriber_display_name" varchar(255),
	"review_status" "imported_clinical_review_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "external_prescriptions_review_shape_check" CHECK (("external_prescriptions"."review_status" = 'unreviewed' and "external_prescriptions"."reviewed_at" is null and "external_prescriptions"."reviewed_by" is null)
        or ("external_prescriptions"."review_status" in ('confirmed', 'superseded') and "external_prescriptions"."reviewed_at" is not null and "external_prescriptions"."reviewed_by" is not null)),
	CONSTRAINT "external_prescriptions_value_check" CHECK (length(btrim("external_prescriptions"."medication_name")) > 0
        and ("external_prescriptions"."quantity" is null or "external_prescriptions"."quantity" >= 0)
        and ("external_prescriptions"."refill_count" is null or "external_prescriptions"."refill_count" >= 0)
        and ("external_prescriptions"."directions" is null or char_length("external_prescriptions"."directions") <= 12000)
        and ("external_prescriptions"."expires_at" is null or "external_prescriptions"."prescribed_at" is null or "external_prescriptions"."expires_at" >= "external_prescriptions"."prescribed_at")),
	CONSTRAINT "external_prescriptions_source_check" CHECK ("external_prescriptions"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "external_prescriptions_fingerprint_check" CHECK ("external_prescriptions"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "historical_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"status" "historical_appointment_status" DEFAULT 'unknown' NOT NULL,
	"appointment_type" varchar(255),
	"provider_display_name" varchar(255),
	"reason" text,
	"notes" text,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "historical_appointments_time_check" CHECK ("historical_appointments"."started_at" < "historical_appointments"."ended_at"),
	CONSTRAINT "historical_appointments_source_check" CHECK ("historical_appointments"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "historical_appointments_fingerprint_check" CHECK ("historical_appointments"."import_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "historical_appointments_text_length_check" CHECK (("historical_appointments"."reason" is null or char_length("historical_appointments"."reason") <= 4000)
        and ("historical_appointments"."notes" is null or char_length("historical_appointments"."notes") <= 12000))
);
--> statement-breakpoint
CREATE TABLE "historical_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"patient_id" uuid,
	"kind" "historical_document_kind" DEFAULT 'other' NOT NULL,
	"link_status" "historical_document_link_status" DEFAULT 'needs_review' NOT NULL,
	"title" varchar(255) NOT NULL,
	"document_date" date,
	"lab_report_id" uuid,
	"prescription_id" uuid,
	"historical_appointment_id" uuid,
	"financial_document_id" uuid,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "historical_documents_link_shape_check" CHECK (("historical_documents"."link_status" = 'needs_review'
          and "historical_documents"."patient_id" is null
          and "historical_documents"."lab_report_id" is null
          and "historical_documents"."prescription_id" is null
          and "historical_documents"."historical_appointment_id" is null
          and "historical_documents"."financial_document_id" is null)
        or ("historical_documents"."link_status" = 'linked' and "historical_documents"."patient_id" is not null)),
	CONSTRAINT "historical_documents_kind_shape_check" CHECK (("historical_documents"."kind" <> 'lab_report' or "historical_documents"."lab_report_id" is not null)
        and ("historical_documents"."kind" <> 'prescription' or "historical_documents"."prescription_id" is not null)
        and ("historical_documents"."kind" <> 'appointment' or "historical_documents"."historical_appointment_id" is not null)
        and ("historical_documents"."kind" <> 'financial' or "historical_documents"."financial_document_id" is not null)),
	CONSTRAINT "historical_documents_source_check" CHECK ("historical_documents"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "historical_documents_fingerprint_check" CHECK ("historical_documents"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "legacy_financial_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"allocated_at" timestamp with time zone,
	"description" varchar(500),
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "legacy_financial_allocations_amount_check" CHECK ("legacy_financial_allocations"."amount" >= 0),
	CONSTRAINT "legacy_financial_allocations_source_check" CHECK ("legacy_financial_allocations"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "legacy_financial_allocations_fingerprint_check" CHECK ("legacy_financial_allocations"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "legacy_financial_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"document_type" "legacy_financial_document_type" DEFAULT 'invoice' NOT NULL,
	"document_number" varchar(160),
	"issued_at" timestamp with time zone NOT NULL,
	"due_date" date,
	"status" "legacy_financial_document_status" DEFAULT 'unknown' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"source_status" varchar(128),
	"note" text,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "legacy_financial_documents_amount_check" CHECK ("legacy_financial_documents"."subtotal" >= 0 and "legacy_financial_documents"."tax" >= 0 and "legacy_financial_documents"."discount" >= 0
        and "legacy_financial_documents"."total" >= 0 and "legacy_financial_documents"."paid_amount" >= 0 and "legacy_financial_documents"."balance" >= 0),
	CONSTRAINT "legacy_financial_documents_currency_check" CHECK ("legacy_financial_documents"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "legacy_financial_documents_source_check" CHECK ("legacy_financial_documents"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "legacy_financial_documents_fingerprint_check" CHECK ("legacy_financial_documents"."import_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "legacy_financial_documents_note_check" CHECK ("legacy_financial_documents"."note" is null or char_length("legacy_financial_documents"."note") <= 12000)
);
--> statement-breakpoint
CREATE TABLE "legacy_financial_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"patient_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "legacy_financial_line_items_amount_check" CHECK ("legacy_financial_line_items"."sort_order" >= 0 and "legacy_financial_line_items"."quantity" >= 0 and "legacy_financial_line_items"."unit_price" >= 0
        and "legacy_financial_line_items"."subtotal" >= 0 and "legacy_financial_line_items"."tax" >= 0 and "legacy_financial_line_items"."discount" >= 0 and "legacy_financial_line_items"."total" >= 0),
	CONSTRAINT "legacy_financial_line_items_source_check" CHECK ("legacy_financial_line_items"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "legacy_financial_line_items_fingerprint_check" CHECK ("legacy_financial_line_items"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "legacy_financial_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid,
	"attribution_status" "migration_attribution_status" DEFAULT 'matched' NOT NULL,
	"entry_type" "legacy_financial_payment_type" DEFAULT 'payment' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"method" varchar(128),
	"source_status" varchar(128),
	"reference" varchar(255),
	"note" text,
	"external_source" varchar(64) NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"import_fingerprint" varchar(64) NOT NULL,
	CONSTRAINT "legacy_financial_payments_amount_check" CHECK ("legacy_financial_payments"."amount" >= 0),
	CONSTRAINT "legacy_financial_payments_attribution_check" CHECK (("legacy_financial_payments"."attribution_status" = 'matched' and "legacy_financial_payments"."client_id" is not null)
        or ("legacy_financial_payments"."attribution_status" = 'needs_review' and "legacy_financial_payments"."client_id" is null)),
	CONSTRAINT "legacy_financial_payments_note_check" CHECK ("legacy_financial_payments"."note" is null or char_length("legacy_financial_payments"."note") <= 4000),
	CONSTRAINT "legacy_financial_payments_source_check" CHECK ("legacy_financial_payments"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
	CONSTRAINT "legacy_financial_payments_fingerprint_check" CHECK ("legacy_financial_payments"."import_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
-- Composite tenant foreign keys below require their parent uniqueness before
-- PostgreSQL can create the constraints. Drizzle emits indexes after foreign
-- keys by default, so keep these parent indexes deliberately ahead of them.
CREATE UNIQUE INDEX "external_lab_reports_practice_id_uq" ON "external_lab_reports" USING btree ("practice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_prescriptions_practice_id_uq" ON "external_prescriptions" USING btree ("practice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_appointments_practice_id_uq" ON "historical_appointments" USING btree ("practice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_documents_practice_id_uq" ON "legacy_financial_documents" USING btree ("practice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_payments_practice_id_uq" ON "legacy_financial_payments" USING btree ("practice_id","id");--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lab_observations" ADD CONSTRAINT "external_lab_observations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lab_observations" ADD CONSTRAINT "external_lab_observations_report_tenant_fk" FOREIGN KEY ("practice_id","report_id") REFERENCES "public"."external_lab_reports"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lab_reports" ADD CONSTRAINT "external_lab_reports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lab_reports" ADD CONSTRAINT "external_lab_reports_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lab_reports" ADD CONSTRAINT "external_lab_reports_reviewer_tenant_fk" FOREIGN KEY ("practice_id","reviewed_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_prescription_fills" ADD CONSTRAINT "external_prescription_fills_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_prescription_fills" ADD CONSTRAINT "external_prescription_fills_prescription_tenant_fk" FOREIGN KEY ("practice_id","prescription_id") REFERENCES "public"."external_prescriptions"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_prescriptions" ADD CONSTRAINT "external_prescriptions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_prescriptions" ADD CONSTRAINT "external_prescriptions_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_prescriptions" ADD CONSTRAINT "external_prescriptions_reviewer_tenant_fk" FOREIGN KEY ("practice_id","reviewed_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_appointments" ADD CONSTRAINT "historical_appointments_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_appointments" ADD CONSTRAINT "historical_appointments_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_appointments" ADD CONSTRAINT "historical_appointments_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_file_tenant_fk" FOREIGN KEY ("practice_id","file_id") REFERENCES "public"."files"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_lab_tenant_fk" FOREIGN KEY ("practice_id","lab_report_id") REFERENCES "public"."external_lab_reports"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_prescription_tenant_fk" FOREIGN KEY ("practice_id","prescription_id") REFERENCES "public"."external_prescriptions"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_appointment_tenant_fk" FOREIGN KEY ("practice_id","historical_appointment_id") REFERENCES "public"."historical_appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_documents" ADD CONSTRAINT "historical_documents_financial_tenant_fk" FOREIGN KEY ("practice_id","financial_document_id") REFERENCES "public"."legacy_financial_documents"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_allocations" ADD CONSTRAINT "legacy_financial_allocations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_allocations" ADD CONSTRAINT "legacy_financial_allocations_document_tenant_fk" FOREIGN KEY ("practice_id","document_id") REFERENCES "public"."legacy_financial_documents"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_allocations" ADD CONSTRAINT "legacy_financial_allocations_payment_tenant_fk" FOREIGN KEY ("practice_id","payment_id") REFERENCES "public"."legacy_financial_payments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_documents" ADD CONSTRAINT "legacy_financial_documents_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_documents" ADD CONSTRAINT "legacy_financial_documents_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_documents" ADD CONSTRAINT "legacy_financial_documents_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_line_items" ADD CONSTRAINT "legacy_financial_line_items_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_line_items" ADD CONSTRAINT "legacy_financial_line_items_document_tenant_fk" FOREIGN KEY ("practice_id","document_id") REFERENCES "public"."legacy_financial_documents"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_line_items" ADD CONSTRAINT "legacy_financial_line_items_patient_tenant_fk" FOREIGN KEY ("practice_id","patient_id") REFERENCES "public"."patients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_payments" ADD CONSTRAINT "legacy_financial_payments_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_financial_payments" ADD CONSTRAINT "legacy_financial_payments_client_tenant_fk" FOREIGN KEY ("practice_id","client_id") REFERENCES "public"."clients"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_practice_id_uq" ON "client_contacts" USING btree ("practice_id","id");--> statement-breakpoint
CREATE INDEX "client_contacts_client_idx" ON "client_contacts" USING btree ("practice_id","client_id","deleted_at","last_name","first_name");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_external_id_uq" ON "client_contacts" USING btree ("practice_id","external_source","external_id") WHERE "client_contacts"."external_source" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_import_fingerprint_uq" ON "client_contacts" USING btree ("practice_id","import_fingerprint") WHERE "client_contacts"."import_fingerprint" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "external_lab_observations_external_id_uq" ON "external_lab_observations" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_lab_observations_import_fingerprint_uq" ON "external_lab_observations" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "external_lab_observations_report_order_idx" ON "external_lab_observations" USING btree ("practice_id","report_id","sort_order","id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_lab_reports_external_id_uq" ON "external_lab_reports" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_lab_reports_import_fingerprint_uq" ON "external_lab_reports" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "external_lab_reports_patient_timeline_idx" ON "external_lab_reports" USING btree ("practice_id","patient_id","resulted_at","ordered_at","id");--> statement-breakpoint
CREATE INDEX "external_lab_reports_review_idx" ON "external_lab_reports" USING btree ("practice_id","review_status","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_prescription_fills_external_id_uq" ON "external_prescription_fills" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_prescription_fills_import_fingerprint_uq" ON "external_prescription_fills" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "external_prescription_fills_history_idx" ON "external_prescription_fills" USING btree ("practice_id","prescription_id","filled_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_prescriptions_external_id_uq" ON "external_prescriptions" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_prescriptions_import_fingerprint_uq" ON "external_prescriptions" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "external_prescriptions_patient_status_idx" ON "external_prescriptions" USING btree ("practice_id","patient_id","status","prescribed_at","id");--> statement-breakpoint
CREATE INDEX "external_prescriptions_review_idx" ON "external_prescriptions" USING btree ("practice_id","review_status","status","id");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_appointments_external_id_uq" ON "historical_appointments" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_appointments_import_fingerprint_uq" ON "historical_appointments" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "historical_appointments_patient_timeline_idx" ON "historical_appointments" USING btree ("practice_id","patient_id","started_at","id");--> statement-breakpoint
CREATE INDEX "historical_appointments_client_timeline_idx" ON "historical_appointments" USING btree ("practice_id","client_id","started_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_documents_external_id_uq" ON "historical_documents" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_documents_import_fingerprint_uq" ON "historical_documents" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "historical_documents_file_uq" ON "historical_documents" USING btree ("practice_id","file_id");--> statement-breakpoint
CREATE INDEX "historical_documents_patient_timeline_idx" ON "historical_documents" USING btree ("practice_id","patient_id","document_date","id");--> statement-breakpoint
CREATE INDEX "historical_documents_review_idx" ON "historical_documents" USING btree ("practice_id","link_status","kind","id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_allocations_external_id_uq" ON "legacy_financial_allocations" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_allocations_import_fingerprint_uq" ON "legacy_financial_allocations" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "legacy_financial_allocations_document_idx" ON "legacy_financial_allocations" USING btree ("practice_id","document_id","allocated_at","id");--> statement-breakpoint
CREATE INDEX "legacy_financial_allocations_payment_idx" ON "legacy_financial_allocations" USING btree ("practice_id","payment_id","allocated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_documents_external_id_uq" ON "legacy_financial_documents" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_documents_import_fingerprint_uq" ON "legacy_financial_documents" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "legacy_financial_documents_client_timeline_idx" ON "legacy_financial_documents" USING btree ("practice_id","client_id","issued_at","id");--> statement-breakpoint
CREATE INDEX "legacy_financial_documents_open_balance_idx" ON "legacy_financial_documents" USING btree ("practice_id","status","issued_at","id") WHERE "legacy_financial_documents"."status" in ('open', 'partial') and "legacy_financial_documents"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_line_items_external_id_uq" ON "legacy_financial_line_items" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_line_items_import_fingerprint_uq" ON "legacy_financial_line_items" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "legacy_financial_line_items_document_order_idx" ON "legacy_financial_line_items" USING btree ("practice_id","document_id","sort_order","id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_payments_external_id_uq" ON "legacy_financial_payments" USING btree ("practice_id","external_source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_financial_payments_import_fingerprint_uq" ON "legacy_financial_payments" USING btree ("practice_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "legacy_financial_payments_client_timeline_idx" ON "legacy_financial_payments" USING btree ("practice_id","client_id","received_at","id");
--> statement-breakpoint
ALTER TABLE "client_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "client_contacts"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "historical_appointments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "historical_appointments"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "external_prescriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "external_prescriptions"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "external_prescription_fills" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "external_prescription_fills"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "external_lab_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "external_lab_reports"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "external_lab_observations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "external_lab_observations"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "legacy_financial_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "legacy_financial_documents"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "legacy_financial_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "legacy_financial_line_items"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "legacy_financial_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "legacy_financial_payments"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "legacy_financial_allocations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "legacy_financial_allocations"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
--> statement-breakpoint
ALTER TABLE "historical_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "historical_documents"
  USING (app_rls_bypass() OR practice_id = app_current_practice_id())
  WITH CHECK (app_rls_bypass() OR practice_id = app_current_practice_id());
