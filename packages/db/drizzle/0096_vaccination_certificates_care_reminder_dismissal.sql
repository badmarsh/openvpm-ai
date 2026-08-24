CREATE TYPE "public"."vaccination_dose_type" AS ENUM('initial', 'booster');--> statement-breakpoint
ALTER TABLE "care_reminders" DROP CONSTRAINT "care_reminders_state_check";--> statement-breakpoint
ALTER TABLE "care_reminders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
CREATE TYPE "public"."care_reminder_status_v2" AS ENUM('open', 'completed', 'dismissed');--> statement-breakpoint
ALTER TABLE "care_reminders" ALTER COLUMN "status" TYPE "public"."care_reminder_status_v2" USING "status"::text::"public"."care_reminder_status_v2";--> statement-breakpoint
DROP TYPE "public"."care_reminder_status";--> statement-breakpoint
ALTER TYPE "public"."care_reminder_status_v2" RENAME TO "care_reminder_status";--> statement-breakpoint
ALTER TABLE "care_reminders" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "product_expiration_date" date;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "dose_type" "vaccination_dose_type";--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "licensed_duration_months" integer;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "rabies_tag_number" varchar(64);--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "supervising_veterinarian_id" uuid;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD COLUMN "dismissed_by" uuid;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD COLUMN "dismissal_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_supervising_veterinarian_id_users_id_fk" FOREIGN KEY ("supervising_veterinarian_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_supervisor_practice_fk" FOREIGN KEY ("practice_id","supervising_veterinarian_id") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_dismisser_tenant_fk" FOREIGN KEY ("practice_id","dismissed_by") REFERENCES "public"."users"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_licensed_duration_check" CHECK ("vaccination_records"."licensed_duration_months" is null or "vaccination_records"."licensed_duration_months" between 1 and 120);--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_dismissal_reason_check" CHECK ("care_reminders"."dismissal_reason" is null or char_length(btrim("care_reminders"."dismissal_reason")) between 3 and 500);--> statement-breakpoint
ALTER TABLE "care_reminders" ADD CONSTRAINT "care_reminders_state_check" CHECK ((
          "care_reminders"."status" = 'open'
          and "care_reminders"."completed_at" is null
          and "care_reminders"."completed_by" is null
          and "care_reminders"."dismissed_at" is null
          and "care_reminders"."dismissed_by" is null
          and "care_reminders"."dismissal_reason" is null
        ) or (
          "care_reminders"."status" = 'completed'
          and "care_reminders"."completed_at" is not null
          and "care_reminders"."completed_by" is not null
          and "care_reminders"."dismissed_at" is null
          and "care_reminders"."dismissed_by" is null
          and "care_reminders"."dismissal_reason" is null
        ) or (
          "care_reminders"."status" = 'dismissed'
          and "care_reminders"."completed_at" is null
          and "care_reminders"."completed_by" is null
          and "care_reminders"."dismissed_at" is not null
          and "care_reminders"."dismissed_by" is not null
          and char_length(btrim("care_reminders"."dismissal_reason")) between 3 and 500
        ));
