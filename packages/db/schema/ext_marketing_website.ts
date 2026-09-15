import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";

/**
 * Dedicated website configuration table for clinic drag-and-drop website builder.
 * Stores draft sections, published sections, and publication status.
 */
export const extMarketingWebsiteConfig = pgTable(
  "ext_marketing_website_config",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    sectionsDraft: jsonb("sections_draft").notNull().default([]),
    sectionsPublished: jsonb("sections_published"),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    practiceIdIdx: uniqueIndex("ext_marketing_website_config_practice_id_unique").on(t.practiceId),
  })
);

export const extMarketingWebsiteConfigRelations = relations(
  extMarketingWebsiteConfig,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extMarketingWebsiteConfig.practiceId],
      references: [practices.id],
    }),
  })
);

/**
 * Persisted visitor inquiries from the public website contact form.
 * Linked to a practice and optionally to a matched or created client lead.
 */
export const extMarketingWebsiteInquiries = pgTable(
  "ext_marketing_website_inquiries",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"), // new | in_progress | resolved | archived
    source: text("source").notNull().default("website_contact"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    practiceIdx: index("ext_mkt_web_inquiries_practice_idx").on(
      t.practiceId,
      t.deletedAt
    ),
    createdAtIdx: index("ext_mkt_web_inquiries_created_idx").on(
      t.practiceId,
      t.createdAt
    ),
  })
);

export const extMarketingWebsiteInquiriesRelations = relations(
  extMarketingWebsiteInquiries,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extMarketingWebsiteInquiries.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [extMarketingWebsiteInquiries.clientId],
      references: [clients.id],
    }),
  })
);
