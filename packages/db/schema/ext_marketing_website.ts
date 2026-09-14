import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";

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
