DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "files"
    GROUP BY "practice_id", "file_key"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'file recovery migration blocked: duplicate practice/file keys exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "files"
    WHERE "idempotency_key" IS NOT NULL
    GROUP BY "practice_id", "idempotency_key"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'file recovery migration blocked: duplicate practice/idempotency keys exist';
  END IF;
END $$;--> statement-breakpoint
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "file_storage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"practice_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"storage_target" varchar(64) NOT NULL,
	"event_key" varchar(255) NOT NULL,
	"operation_id" uuid NOT NULL,
	"event_kind" varchar(64) NOT NULL,
	"previous_status" varchar(32),
	"next_status" varchar(32) NOT NULL,
	"expected_checksum_sha256" varchar(64),
	"observed_checksum_sha256" varchar(64),
	"expected_file_size_bytes" integer,
	"observed_file_size_bytes" integer,
	"object_etag" varchar(255),
	"object_version_id" varchar(255),
	"failure_code" varchar(64),
	"worker_run_id" uuid,
	CONSTRAINT "file_storage_events_expected_checksum_format_check" CHECK ("file_storage_events"."expected_checksum_sha256" is null or "file_storage_events"."expected_checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "file_storage_events_observed_checksum_format_check" CHECK ("file_storage_events"."observed_checksum_sha256" is null or "file_storage_events"."observed_checksum_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "file_storage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "last_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD COLUMN "last_error_class" varchar(64);--> statement-breakpoint
ALTER TABLE "file_storage_events" ADD CONSTRAINT "file_storage_events_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_storage_events" ADD CONSTRAINT "file_storage_events_file_tenant_fk" FOREIGN KEY ("practice_id","file_id") REFERENCES "public"."files"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_storage_events_event_key_uq" ON "file_storage_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "file_storage_events_file_created_idx" ON "file_storage_events" USING btree ("practice_id","file_id","created_at");--> statement-breakpoint
CREATE INDEX "file_storage_events_operation_idx" ON "file_storage_events" USING btree ("operation_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_tenant_fk" FOREIGN KEY ("practice_id","uploaded_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "file_object_replicas_due_idx" ON "file_object_replicas" USING btree ("status","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_practice_file_key_uq" ON "files" USING btree ("practice_id","file_key");--> statement-breakpoint
CREATE UNIQUE INDEX "files_practice_idempotency_key_uq" ON "files" USING btree ("practice_id","idempotency_key") WHERE "files"."idempotency_key" is not null;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD CONSTRAINT "file_object_replicas_attempt_count_check" CHECK ("file_object_replicas"."attempt_count" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD CONSTRAINT "file_object_replicas_checksum_sha256_format_check" CHECK ("file_object_replicas"."checksum_sha256" is null or "file_object_replicas"."checksum_sha256" ~ '^[0-9a-f]{64}$') NOT VALID;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD CONSTRAINT "file_object_replicas_file_size_bytes_check" CHECK ("file_object_replicas"."file_size_bytes" is null or "file_object_replicas"."file_size_bytes" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD CONSTRAINT "file_object_replicas_available_evidence_check" CHECK ("file_object_replicas"."status" <> 'available' or ("file_object_replicas"."checksum_sha256" is not null and "file_object_replicas"."file_size_bytes" is not null and "file_object_replicas"."replicated_at" is not null and "file_object_replicas"."verified_at" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "file_object_replicas" ADD CONSTRAINT "file_object_replicas_lease_coherence_check" CHECK (("file_object_replicas"."lease_token" is null and "file_object_replicas"."lease_expires_at" is null) or ("file_object_replicas"."lease_token" is not null and "file_object_replicas"."lease_expires_at" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_checksum_sha256_format_check" CHECK ("files"."checksum_sha256" is null or "files"."checksum_sha256" ~ '^[0-9a-f]{64}$') NOT VALID;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_file_size_bytes_check" CHECK ("files"."file_size_bytes" is null or "files"."file_size_bytes" >= 0) NOT VALID;--> statement-breakpoint
UPDATE "files" AS f
SET "patient_id" = f."entity_id"
WHERE f."patient_id" IS NULL
  AND f."entity_type" = 'patient'
  AND EXISTS (
    SELECT 1
    FROM "patients" AS p
    WHERE p."practice_id" = f."practice_id"
      AND p."id" = f."entity_id"
  );--> statement-breakpoint
UPDATE "files" AS f
SET "patient_id" = a."patient_id"
FROM "appointments" AS a
WHERE f."patient_id" IS NULL
  AND f."appointment_id" = a."id"
  AND f."practice_id" = a."practice_id";--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_appointment_requires_patient_check" CHECK ("files"."appointment_id" is null or "files"."patient_id" is not null) NOT VALID;
