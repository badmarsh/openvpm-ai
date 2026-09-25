CREATE TYPE "public"."ext_bridge_contract_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_direction" AS ENUM('v1_to_v2', 'v2_to_v1');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_endpoint_status" AS ENUM('active', 'paused', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_event_type" AS ENUM('endpoint_registered', 'endpoint_updated', 'key_registered', 'key_rotated', 'key_revoked', 'contract_updated', 'envelope_received', 'signature_verified', 'signature_invalid', 'decrypted', 'decryption_failed', 'schema_validated', 'schema_rejected', 'safety_gate_blocked', 'quarantined', 'dispatched', 'acknowledged', 'suppression_forwarded');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_key_status" AS ENUM('active', 'rotated', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_message_status" AS ENUM('received', 'validated', 'quarantined', 'processed', 'acknowledged', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ext_bridge_runtime" AS ENUM('v1', 'v2');--> statement-breakpoint
CREATE TABLE "ext_schema_validation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"contract_id" text NOT NULL,
	"schema_version" text NOT NULL,
	"result" text NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"guardrail" text,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" text DEFAULT 'api' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"actor_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ext_bridge_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"message_type" varchar(64) NOT NULL,
	"schema_version" varchar(16) DEFAULT '1.0' NOT NULL,
	"direction" "ext_bridge_direction" NOT NULL,
	"strict" boolean DEFAULT true NOT NULL,
	"status" "ext_bridge_contract_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ext_bridge_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"runtime" "ext_bridge_runtime" NOT NULL,
	"direction" "ext_bridge_direction" NOT NULL,
	"base_url" varchar(255) NOT NULL,
	"protocol_version" varchar(64) DEFAULT '2026-09-bridge-v1' NOT NULL,
	"status" "ext_bridge_endpoint_status" DEFAULT 'active' NOT NULL,
	"active_key_id" varchar(160),
	"allowed_message_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_failure_code" varchar(64),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ext_bridge_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"endpoint_id" uuid,
	"message_id" uuid,
	"event_type" "ext_bridge_event_type" NOT NULL,
	"severity" "ext_bridge_event_severity" DEFAULT 'info' NOT NULL,
	"actor" varchar(80) DEFAULT 'system' NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "ext_bridge_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"runtime" "ext_bridge_runtime" NOT NULL,
	"key_id" varchar(160) NOT NULL,
	"algorithm" varchar(32) DEFAULT 'aes-256-gcm' NOT NULL,
	"fingerprint" varchar(80) NOT NULL,
	"salt" varchar(120) NOT NULL,
	"secret_ref" varchar(160) NOT NULL,
	"status" "ext_bridge_key_status" DEFAULT 'active' NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ext_bridge_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"endpoint_id" uuid,
	"direction" "ext_bridge_direction" NOT NULL,
	"source_runtime" "ext_bridge_runtime" NOT NULL,
	"message_type" varchar(64) NOT NULL,
	"schema_version" varchar(16) DEFAULT '1.0' NOT NULL,
	"status" "ext_bridge_message_status" NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"message_id" varchar(160) NOT NULL,
	"correlation_id" varchar(160),
	"nonce" varchar(128) NOT NULL,
	"key_id" varchar(160),
	"algorithm" varchar(32),
	"iv" varchar(64),
	"auth_tag" varchar(64),
	"ciphertext" text,
	"payload_hash" varchar(64),
	"signature_verified" boolean DEFAULT false NOT NULL,
	"payload_byte_size" integer DEFAULT 0 NOT NULL,
	"failure_code" varchar(64),
	"validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload_summary" jsonb,
	"patient_id" uuid,
	"clinical_draft" boolean DEFAULT false NOT NULL,
	"requires_vet_signoff" boolean DEFAULT false NOT NULL,
	"controlled_substance" boolean DEFAULT false NOT NULL,
	"sympathy_suppressed" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ext_schema_validation_events" ADD CONSTRAINT "ext_schema_validation_events_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_schema_validation_events" ADD CONSTRAINT "ext_schema_validation_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_contracts" ADD CONSTRAINT "ext_bridge_contracts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_contracts" ADD CONSTRAINT "ext_bridge_contracts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_endpoints" ADD CONSTRAINT "ext_bridge_endpoints_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_endpoints" ADD CONSTRAINT "ext_bridge_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_events" ADD CONSTRAINT "ext_bridge_events_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_events" ADD CONSTRAINT "ext_bridge_events_endpoint_id_ext_bridge_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."ext_bridge_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_events" ADD CONSTRAINT "ext_bridge_events_message_id_ext_bridge_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ext_bridge_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_keys" ADD CONSTRAINT "ext_bridge_keys_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_keys" ADD CONSTRAINT "ext_bridge_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_messages" ADD CONSTRAINT "ext_bridge_messages_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_messages" ADD CONSTRAINT "ext_bridge_messages_endpoint_id_ext_bridge_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."ext_bridge_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_bridge_messages" ADD CONSTRAINT "ext_bridge_messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_schema_val_events_practice_idx" ON "ext_schema_validation_events" USING btree ("practice_id","created_at");--> statement-breakpoint
CREATE INDEX "ext_schema_val_events_contract_idx" ON "ext_schema_validation_events" USING btree ("practice_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_bridge_contracts_uq" ON "ext_bridge_contracts" USING btree ("practice_id","message_type","schema_version","direction");--> statement-breakpoint
CREATE INDEX "ext_bridge_contracts_status_idx" ON "ext_bridge_contracts" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_bridge_endpoints_runtime_uq" ON "ext_bridge_endpoints" USING btree ("practice_id","runtime");--> statement-breakpoint
CREATE INDEX "ext_bridge_endpoints_status_idx" ON "ext_bridge_endpoints" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "ext_bridge_events_practice_idx" ON "ext_bridge_events" USING btree ("practice_id","created_at");--> statement-breakpoint
CREATE INDEX "ext_bridge_events_message_idx" ON "ext_bridge_events" USING btree ("message_id","created_at");--> statement-breakpoint
CREATE INDEX "ext_bridge_events_severity_idx" ON "ext_bridge_events" USING btree ("practice_id","severity","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_bridge_keys_key_uq" ON "ext_bridge_keys" USING btree ("practice_id","key_id");--> statement-breakpoint
CREATE INDEX "ext_bridge_keys_active_idx" ON "ext_bridge_keys" USING btree ("practice_id","runtime","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_bridge_messages_message_uq" ON "ext_bridge_messages" USING btree ("practice_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_bridge_messages_nonce_uq" ON "ext_bridge_messages" USING btree ("practice_id","nonce");--> statement-breakpoint
CREATE INDEX "ext_bridge_messages_status_idx" ON "ext_bridge_messages" USING btree ("practice_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ext_bridge_messages_type_idx" ON "ext_bridge_messages" USING btree ("practice_id","message_type","created_at");--> statement-breakpoint
CREATE INDEX "ext_bridge_messages_external_idx" ON "ext_bridge_messages" USING btree ("practice_id","external_id");