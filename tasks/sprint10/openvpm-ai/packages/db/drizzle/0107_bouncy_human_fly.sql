CREATE TYPE "public"."dental_condition" AS ENUM('HEALTHY', 'MISSING', 'FRACTURED', 'DECAYED', 'MOBILE', 'ABRADED', 'CROWNED', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."analyzer_type" ADD VALUE 'LABTECHNIK' BEFORE 'GENERIC_CSV';--> statement-breakpoint
ALTER TYPE "public"."analyzer_type" ADD VALUE 'INLAB' BEFORE 'GENERIC_CSV';--> statement-breakpoint
ALTER TYPE "public"."analyzer_type" ADD VALUE 'QUICKSEAL' BEFORE 'GENERIC_CSV';--> statement-breakpoint
CREATE TABLE "kvl_cr_passports" (
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
	"issuing_vet_kvl_cr" varchar(64),
	"microchip_number" varchar(32),
	"rabies_vaccine_name" varchar(128),
	"rabies_batch_number" varchar(64),
	"rabies_administered_at" date,
	"rabies_valid_until" date,
	"travel_eligible_from" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dental_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"veterinarian_id" uuid NOT NULL,
	"tooth_code" varchar(16) NOT NULL,
	"charted_at" date NOT NULL,
	"condition" "dental_condition" DEFAULT 'HEALTHY' NOT NULL,
	"treatment" text,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "kvl_cr_passports" ADD CONSTRAINT "kvl_cr_passports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvl_cr_passports" ADD CONSTRAINT "kvl_cr_passports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvl_cr_passports" ADD CONSTRAINT "kvl_cr_passports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvl_cr_passports" ADD CONSTRAINT "kvl_cr_passports_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_charts" ADD CONSTRAINT "dental_charts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_charts" ADD CONSTRAINT "dental_charts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_charts" ADD CONSTRAINT "dental_charts_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_charts" ADD CONSTRAINT "dental_charts_veterinarian_id_users_id_fk" FOREIGN KEY ("veterinarian_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kvl_cr_passports_practice_idx" ON "kvl_cr_passports" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "kvl_cr_passports_patient_idx" ON "kvl_cr_passports" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kvl_cr_passports_number_uq" ON "kvl_cr_passports" USING btree ("passport_number");--> statement-breakpoint
CREATE INDEX "dental_charts_practice_idx" ON "dental_charts" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "dental_charts_patient_idx" ON "dental_charts" USING btree ("practice_id","patient_id","deleted_at");--> statement-breakpoint
CREATE INDEX "dental_charts_tooth_idx" ON "dental_charts" USING btree ("practice_id","patient_id","tooth_code");