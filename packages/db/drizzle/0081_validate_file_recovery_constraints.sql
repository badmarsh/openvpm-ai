-- This migration must ship only after 0077-0080 are live and the count-only
-- file recovery preflight is clean in production and demo.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
SET LOCAL statement_timeout = '5min';--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_uploader_tenant_fk";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_checksum_sha256_format_check";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_file_size_bytes_check";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_appointment_requires_patient_check";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_available_evidence_check";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_primary_namespace_check";--> statement-breakpoint
ALTER TABLE "files" VALIDATE CONSTRAINT "files_patient_entity_consistency_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_attempt_count_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_checksum_sha256_format_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_file_size_bytes_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_available_evidence_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_lease_coherence_check";--> statement-breakpoint
ALTER TABLE "file_object_replicas" VALIDATE CONSTRAINT "file_object_replicas_independent_object_key_check";--> statement-breakpoint
ALTER TABLE "file_storage_events" VALIDATE CONSTRAINT "file_storage_events_expected_file_size_bytes_check";--> statement-breakpoint
ALTER TABLE "file_storage_events" VALIDATE CONSTRAINT "file_storage_events_observed_file_size_bytes_check";--> statement-breakpoint
ALTER TABLE "capture_sessions" VALIDATE CONSTRAINT "capture_sessions_patient_tenant_fk";--> statement-breakpoint
ALTER TABLE "capture_sessions" VALIDATE CONSTRAINT "capture_sessions_creator_tenant_fk";--> statement-breakpoint
ALTER TABLE "capture_sessions" VALIDATE CONSTRAINT "capture_sessions_appointment_patient_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_patient_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_creator_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_appointment_patient_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_form_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_file_tenant_fk";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_status_check";--> statement-breakpoint
ALTER TABLE "consent_requests" VALIDATE CONSTRAINT "consent_requests_signing_evidence_check";
