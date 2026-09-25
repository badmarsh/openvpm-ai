import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";
import { communications } from "./communications";

/**
 * WhatsApp-specific metadata for inbound and outbound messages stored
 * alongside the generic `communications` row (channel = "sms",
 * dedupeKey prefixed "wa:").
 *
 * Separation from the vanilla communications table keeps upstream sync clean
 * while exposing full WhatsApp context (profile name, WA-ID, media) for
 * the inbox thread view.
 */
export const extWhatsappMessages = pgTable(
  "ext_whatsapp_messages",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    communicationId: uuid("communication_id").references(
      () => communications.id,
    ),
    clientId: uuid("client_id").references(() => clients.id),
    // The WhatsApp number in E.164 (without the "whatsapp:" prefix Twilio adds)
    fromWaId: varchar("from_wa_id", { length: 32 }).notNull(),
    toWaId: varchar("to_wa_id", { length: 32 }).notNull(),
    // Display name from WhatsApp profile (if Twilio provides it)
    profileName: varchar("profile_name", { length: 255 }),
    body: text("body"),
    // Twilio SID is the providerMessageId stored on communications
    twilioSid: varchar("twilio_sid", { length: 64 }),
    // For media messages (images, documents, audio)
    numMedia: varchar("num_media", { length: 8 }),
    mediaContentType0: varchar("media_content_type_0", { length: 128 }),
    mediaUrl0: varchar("media_url_0", { length: 1024 }),
  },
  (table) => ({
    practiceIdx: index("ext_whatsapp_messages_practice_idx").on(
      table.practiceId,
      table.deletedAt,
      table.createdAt,
    ),
    commIdx: uniqueIndex("ext_whatsapp_messages_comm_uq").on(
      table.communicationId,
    ),
    twilioSidIdx: uniqueIndex("ext_whatsapp_messages_twilio_sid_uq").on(
      table.twilioSid,
    ),
  }),
);
