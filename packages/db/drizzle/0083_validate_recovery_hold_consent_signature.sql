-- Validation-only follow-up after the owner-visible 0083 preflight reports
-- zero violations. Validate every staged guard before replacing the weaker
-- canonical signing-state constraint retained by 0082.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
SET LOCAL statement_timeout = '5min';--> statement-breakpoint
ALTER TABLE "practices" VALIDATE CONSTRAINT "practices_recovery_hold_evidence_check";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_signature_evidence_pair_check";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_signature_evidence_size_check";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_signature_evidence_hash_check";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_signing_signature_evidence_check";--> statement-breakpoint
ALTER TABLE "consent_requests" DROP CONSTRAINT "consent_requests_signing_evidence_check";--> statement-breakpoint
ALTER TABLE "consent_requests" RENAME CONSTRAINT "consent_requests_signing_signature_evidence_check" TO "consent_requests_signing_evidence_check";
