ALTER TYPE "public"."migration_run_mode" ADD VALUE 'services';--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "external_source" varchar(64);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "external_id" varchar(160);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "import_fingerprint" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "services_external_id_uq" ON "services" USING btree ("practice_id","external_source","external_id") WHERE "services"."external_source" is not null and "services"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "services_import_fingerprint_uq" ON "services" USING btree ("practice_id","import_fingerprint") WHERE "services"."import_fingerprint" is not null;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_import_identity_check" CHECK (("services"."external_source" is null and "services"."external_id" is null and "services"."import_fingerprint" is null)
        or ("services"."external_source" is not null and "services"."external_id" is not null and "services"."import_fingerprint" is not null));--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_import_fingerprint_check" CHECK ("services"."import_fingerprint" is null or "services"."import_fingerprint" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_external_source_check" CHECK ("services"."external_source" is null or "services"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$');