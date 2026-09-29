CREATE TABLE "ext_whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"communication_id" uuid,
	"client_id" uuid,
	"from_wa_id" varchar(32) NOT NULL,
	"to_wa_id" varchar(32) NOT NULL,
	"profile_name" varchar(255),
	"body" text,
	"twilio_sid" varchar(64),
	"num_media" varchar(8),
	"media_content_type_0" varchar(128),
	"media_url_0" varchar(1024)
);
--> statement-breakpoint
ALTER TABLE "ext_whatsapp_messages" ADD CONSTRAINT "ext_whatsapp_messages_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_whatsapp_messages" ADD CONSTRAINT "ext_whatsapp_messages_communication_id_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."communications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ext_whatsapp_messages" ADD CONSTRAINT "ext_whatsapp_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ext_whatsapp_messages_practice_idx" ON "ext_whatsapp_messages" USING btree ("practice_id","deleted_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_whatsapp_messages_comm_uq" ON "ext_whatsapp_messages" USING btree ("communication_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_whatsapp_messages_twilio_sid_uq" ON "ext_whatsapp_messages" USING btree ("twilio_sid");