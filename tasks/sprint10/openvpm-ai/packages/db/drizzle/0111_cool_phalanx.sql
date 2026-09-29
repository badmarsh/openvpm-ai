CREATE TABLE "ext_inventory_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"supplier_code" varchar(64),
	"barcode" varchar(64),
	"active_substance" varchar(255),
	"vat_rate" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "ext_inventory_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"receipt_key" varchar(64) NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"delivery_note_number" varchar(64) NOT NULL,
	"controlled_review" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ext_inventory_metadata" ADD CONSTRAINT "ext_inventory_metadata_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_inventory_metadata" ADD CONSTRAINT "ext_inventory_metadata_practice_id_product_id_products_practice_id_id_fk" FOREIGN KEY ("practice_id","product_id") REFERENCES "public"."products"("practice_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_inventory_receipts" ADD CONSTRAINT "ext_inventory_receipts_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ext_inventory_metadata_product_uq" ON "ext_inventory_metadata" USING btree ("practice_id","product_id");--> statement-breakpoint
CREATE INDEX "ext_inventory_metadata_supplier_idx" ON "ext_inventory_metadata" USING btree ("practice_id","supplier_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_inventory_receipts_identity_uq" ON "ext_inventory_receipts" USING btree ("practice_id","receipt_key");--> statement-breakpoint
CREATE INDEX "ext_inventory_receipts_practice_idx" ON "ext_inventory_receipts" USING btree ("practice_id","created_at");