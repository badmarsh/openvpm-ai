CREATE TYPE "public"."visit_work_status" AS ENUM('unresolved', 'charged', 'no_charge', 'voided');--> statement-breakpoint
CREATE TABLE "visit_work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"vaccination_record_id" uuid,
	"lab_result_id" uuid,
	"procedure_id" uuid,
	"prescription_id" uuid,
	"status" "visit_work_status" DEFAULT 'unresolved' NOT NULL,
	"invoice_id" uuid,
	"invoice_item_id" uuid,
	"no_charge_reason" text,
	"void_reason" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "visit_work_items_exactly_one_source_check" CHECK (num_nonnulls(
        "visit_work_items"."vaccination_record_id",
        "visit_work_items"."lab_result_id",
        "visit_work_items"."procedure_id",
        "visit_work_items"."prescription_id"
      ) = 1),
	CONSTRAINT "visit_work_items_resolution_check" CHECK ((
          "visit_work_items"."status" = 'unresolved'
          and "visit_work_items"."invoice_id" is null
          and "visit_work_items"."invoice_item_id" is null
          and "visit_work_items"."no_charge_reason" is null
          and "visit_work_items"."void_reason" is null
          and "visit_work_items"."resolved_by" is null
          and "visit_work_items"."resolved_at" is null
        ) or (
          "visit_work_items"."status" = 'charged'
          and "visit_work_items"."invoice_id" is not null
          and "visit_work_items"."invoice_item_id" is not null
          and "visit_work_items"."no_charge_reason" is null
          and "visit_work_items"."void_reason" is null
          and "visit_work_items"."resolved_by" is not null
          and "visit_work_items"."resolved_at" is not null
        ) or (
          "visit_work_items"."status" = 'no_charge'
          and "visit_work_items"."invoice_id" is null
          and "visit_work_items"."invoice_item_id" is null
          and length(btrim(coalesce("visit_work_items"."no_charge_reason", ''))) > 0
          and "visit_work_items"."void_reason" is null
          and "visit_work_items"."resolved_by" is not null
          and "visit_work_items"."resolved_at" is not null
        ) or (
          "visit_work_items"."status" = 'voided'
          and "visit_work_items"."invoice_id" is null
          and "visit_work_items"."invoice_item_id" is null
          and "visit_work_items"."no_charge_reason" is null
          and length(btrim(coalesce("visit_work_items"."void_reason", ''))) > 0
          and "visit_work_items"."resolved_by" is not null
          and "visit_work_items"."resolved_at" is not null
        ))
);
--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "appointment_id" uuid;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lr.practice_id, lr.appointment_id FROM lab_results lr
      WHERE lr.appointment_id IS NOT NULL
      UNION ALL
      SELECT p.practice_id, p.appointment_id FROM procedures p
      WHERE p.appointment_id IS NOT NULL
      UNION ALL
      SELECT rx.practice_id, rx.appointment_id FROM prescriptions rx
      WHERE rx.appointment_id IS NOT NULL
    ) source
    LEFT JOIN appointments a
      ON a.id = source.appointment_id
      AND a.practice_id = source.practice_id
    WHERE a.id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot install visit work ledger: a visit-linked clinical record targets an appointment outside its practice.',
      HINT = 'Reconcile cross-practice appointment links before retrying migration 0045.';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_practice_id_uq" ON "appointments" USING btree ("practice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_results_visit_source_uq" ON "lab_results" USING btree ("practice_id","appointment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "procedures_visit_source_uq" ON "procedures" USING btree ("practice_id","appointment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "vaccination_records_visit_source_uq" ON "vaccination_records" USING btree ("practice_id","appointment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_visit_source_uq" ON "prescriptions" USING btree ("practice_id","appointment_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_invoice_item_target_uq" ON "invoice_items" USING btree ("invoice_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_visit_target_uq" ON "invoices" USING btree ("practice_id","appointment_id","id");--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_vaccination_record_id_vaccination_records_id_fk" FOREIGN KEY ("vaccination_record_id") REFERENCES "public"."vaccination_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_lab_result_id_lab_results_id_fk" FOREIGN KEY ("lab_result_id") REFERENCES "public"."lab_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_practice_appointment_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_vaccination_source_fk" FOREIGN KEY ("practice_id","appointment_id","vaccination_record_id") REFERENCES "public"."vaccination_records"("practice_id","appointment_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_lab_result_source_fk" FOREIGN KEY ("practice_id","appointment_id","lab_result_id") REFERENCES "public"."lab_results"("practice_id","appointment_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_procedure_source_fk" FOREIGN KEY ("practice_id","appointment_id","procedure_id") REFERENCES "public"."procedures"("practice_id","appointment_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_prescription_source_fk" FOREIGN KEY ("practice_id","appointment_id","prescription_id") REFERENCES "public"."prescriptions"("practice_id","appointment_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_invoice_visit_fk" FOREIGN KEY ("practice_id","appointment_id","invoice_id") REFERENCES "public"."invoices"("practice_id","appointment_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_invoice_item_fk" FOREIGN KEY ("invoice_id","invoice_item_id") REFERENCES "public"."invoice_items"("invoice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_work_items_visit_status_idx" ON "visit_work_items" USING btree ("practice_id","appointment_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "visit_work_items_unresolved_idx" ON "visit_work_items" USING btree ("practice_id","appointment_id","created_at","id") WHERE "visit_work_items"."status" = 'unresolved' and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_work_items_vaccination_uq" ON "visit_work_items" USING btree ("practice_id","vaccination_record_id") WHERE "visit_work_items"."vaccination_record_id" is not null and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_work_items_lab_result_uq" ON "visit_work_items" USING btree ("practice_id","lab_result_id") WHERE "visit_work_items"."lab_result_id" is not null and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_work_items_procedure_uq" ON "visit_work_items" USING btree ("practice_id","procedure_id") WHERE "visit_work_items"."procedure_id" is not null and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_work_items_prescription_uq" ON "visit_work_items" USING btree ("practice_id","prescription_id") WHERE "visit_work_items"."prescription_id" is not null and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_work_items_invoice_item_uq" ON "visit_work_items" USING btree ("invoice_item_id") WHERE "visit_work_items"."invoice_item_id" is not null and "visit_work_items"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_practice_appointment_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_practice_appointment_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_practice_appointment_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_practice_appointment_fk" FOREIGN KEY ("practice_id","appointment_id") REFERENCES "public"."appointments"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_results_appointment_idx" ON "lab_results" USING btree ("practice_id","appointment_id","deleted_at");--> statement-breakpoint
CREATE INDEX "procedures_appointment_idx" ON "procedures" USING btree ("practice_id","appointment_id","deleted_at");--> statement-breakpoint
CREATE INDEX "vaccination_records_appointment_idx" ON "vaccination_records" USING btree ("practice_id","appointment_id","deleted_at");--> statement-breakpoint
INSERT INTO visit_work_items (practice_id, appointment_id, vaccination_record_id)
SELECT vr.practice_id, vr.appointment_id, vr.id
FROM vaccination_records vr
INNER JOIN appointments a
  ON a.practice_id = vr.practice_id
  AND a.id = vr.appointment_id
WHERE vr.appointment_id IS NOT NULL
  AND vr.deleted_at IS NULL
  AND a.deleted_at IS NULL
  AND a.status IN ('checked_in', 'in_exam')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO visit_work_items (practice_id, appointment_id, lab_result_id)
SELECT lr.practice_id, lr.appointment_id, lr.id
FROM lab_results lr
INNER JOIN appointments a
  ON a.practice_id = lr.practice_id
  AND a.id = lr.appointment_id
WHERE lr.appointment_id IS NOT NULL
  AND lr.deleted_at IS NULL
  AND a.deleted_at IS NULL
  AND a.status IN ('checked_in', 'in_exam')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO visit_work_items (practice_id, appointment_id, procedure_id)
SELECT p.practice_id, p.appointment_id, p.id
FROM procedures p
INNER JOIN appointments a
  ON a.practice_id = p.practice_id
  AND a.id = p.appointment_id
WHERE p.appointment_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND a.deleted_at IS NULL
  AND a.status IN ('checked_in', 'in_exam')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO visit_work_items (practice_id, appointment_id, prescription_id)
SELECT rx.practice_id, rx.appointment_id, rx.id
FROM prescriptions rx
INNER JOIN appointments a
  ON a.practice_id = rx.practice_id
  AND a.id = rx.appointment_id
WHERE rx.appointment_id IS NOT NULL
  AND rx.deleted_at IS NULL
  AND a.deleted_at IS NULL
  AND a.status IN ('checked_in', 'in_exam')
ON CONFLICT DO NOTHING;
