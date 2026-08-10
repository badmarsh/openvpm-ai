-- Expand-only recovery hold and durable consent-signature staging.
-- Existing rows are checked by the 0083 owner-visible preflight before these
-- constraints are validated. NOT VALID still enforces every new write.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "recovery_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "recovery_hold_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "recovery_hold_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "recovery_hold_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD COLUMN "signature_png_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "consent_requests" ADD COLUMN "signature_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_recovery_hold_evidence_check" CHECK (not "practices"."recovery_hold" or ("practices"."recovery_hold_set_at" is not null and "practices"."recovery_hold_reason" is not null and "practices"."recovery_hold_reason" ~ '[^[:space:]]')) NOT VALID;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_signature_evidence_pair_check" CHECK (("consent_requests"."signature_png_bytes" is null and "consent_requests"."signature_sha256" is null) or ("consent_requests"."signature_png_bytes" is not null and "consent_requests"."signature_sha256" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_signature_evidence_size_check" CHECK ("consent_requests"."signature_png_bytes" is null or octet_length("consent_requests"."signature_png_bytes") between 1 and 500000) NOT VALID;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_signature_evidence_hash_check" CHECK ("consent_requests"."signature_sha256" is null or ("consent_requests"."signature_sha256" ~ '^[0-9a-f]{64}$' and "consent_requests"."signature_sha256" = pg_catalog.encode(pg_catalog.sha256("consent_requests"."signature_png_bytes"), 'hex'))) NOT VALID;--> statement-breakpoint
-- Keep the already-validated 0081 constraint in place until 0083 validates
-- this stronger replacement. That preserves the live drift contract during
-- the expand/validate release split.
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_signing_signature_evidence_check" CHECK (("consent_requests"."status" = 'pending' and "consent_requests"."signer_name" is null and "consent_requests"."signed_at" is null and "consent_requests"."file_id" is null and "consent_requests"."signature_png_bytes" is null and "consent_requests"."signature_sha256" is null) or ("consent_requests"."status" = 'signing' and "consent_requests"."signer_name" is not null and "consent_requests"."signed_at" is not null and "consent_requests"."signature_png_bytes" is not null and "consent_requests"."signature_sha256" is not null) or ("consent_requests"."status" = 'signed' and "consent_requests"."signer_name" is not null and "consent_requests"."signed_at" is not null and "consent_requests"."file_id" is not null)) NOT VALID;
