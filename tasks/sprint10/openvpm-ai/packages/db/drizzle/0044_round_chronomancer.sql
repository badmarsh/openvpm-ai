ALTER TABLE "migration_runs" ADD COLUMN "reviewed_plan_hash" varchar(64);--> statement-breakpoint
UPDATE "migration_runs" SET "reviewed_plan_hash" = "file_hash" WHERE "reviewed_plan_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "migration_runs" ALTER COLUMN "reviewed_plan_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_reviewed_plan_hash_check" CHECK ("migration_runs"."reviewed_plan_hash" ~ '^[0-9a-f]{64}$');
