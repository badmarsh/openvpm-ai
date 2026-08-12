ALTER TYPE "public"."migration_run_mode" ADD VALUE 'products' BEFORE 'client_contacts';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "inventory_tracked" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_source" varchar(64);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_id" varchar(160);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "import_fingerprint" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "products_external_id_uq" ON "products" USING btree ("practice_id","external_source","external_id") WHERE "products"."external_source" is not null and "products"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_import_fingerprint_uq" ON "products" USING btree ("practice_id","import_fingerprint") WHERE "products"."import_fingerprint" is not null;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_import_identity_check" CHECK (("products"."external_source" is null and "products"."external_id" is null and "products"."import_fingerprint" is null)
        or ("products"."external_source" is not null and "products"."external_id" is not null and "products"."import_fingerprint" is not null));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_import_fingerprint_check" CHECK ("products"."import_fingerprint" is null or "products"."import_fingerprint" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_external_source_check" CHECK ("products"."external_source" is null or "products"."external_source" ~ '^[a-z0-9][a-z0-9_-]{0,63}$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_tracking_check" CHECK ("products"."inventory_tracked" or (
        "products"."stock_quantity" = 0
        and "products"."reorder_point" is null
        and "products"."lot_number" is null
        and "products"."expiration_date" is null
      ));