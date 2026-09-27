CREATE TYPE "public"."dossier_export_format" AS ENUM('pdf', 'print');--> statement-breakpoint
CREATE TYPE "public"."sympathy_transition_reason" AS ENUM('deceased', 'euthanized', 'transferred', 'reactivated');--> statement-breakpoint
CREATE TABLE "ext_patient_dossier_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid,
	"exported_by" uuid,
	"format" "dossier_export_format" DEFAULT 'pdf' NOT NULL,
	"content_hash" text,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ext_patient_sympathy_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid,
	"actor_id" uuid,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"reason" "sympathy_transition_reason" NOT NULL,
	"confirmation_detail" text,
	"suppression_logged" boolean DEFAULT false NOT NULL,
	"transitioned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ext_patient_dossier_exports" ADD CONSTRAINT "ext_patient_dossier_exports_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_dossier_exports" ADD CONSTRAINT "ext_patient_dossier_exports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_dossier_exports" ADD CONSTRAINT "ext_patient_dossier_exports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_dossier_exports" ADD CONSTRAINT "ext_patient_dossier_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_sympathy_transitions" ADD CONSTRAINT "ext_patient_sympathy_transitions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_sympathy_transitions" ADD CONSTRAINT "ext_patient_sympathy_transitions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_sympathy_transitions" ADD CONSTRAINT "ext_patient_sympathy_transitions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_patient_sympathy_transitions" ADD CONSTRAINT "ext_patient_sympathy_transitions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_dossier_practice_patient_idx" ON "ext_patient_dossier_exports" USING btree ("practice_id","patient_id","exported_at");--> statement-breakpoint
CREATE INDEX "ext_dossier_practice_created_idx" ON "ext_patient_dossier_exports" USING btree ("practice_id","exported_at");--> statement-breakpoint
CREATE INDEX "ext_sympathy_practice_patient_idx" ON "ext_patient_sympathy_transitions" USING btree ("practice_id","patient_id","transitioned_at");--> statement-breakpoint
CREATE INDEX "ext_sympathy_practice_reason_idx" ON "ext_patient_sympathy_transitions" USING btree ("practice_id","reason","transitioned_at");