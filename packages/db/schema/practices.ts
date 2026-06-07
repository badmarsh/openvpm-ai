import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";

export const practices = pgTable("practices", {
  ...baseColumns(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  timezone: varchar("timezone", { length: 64 }).notNull().default("America/New_York"),
  logoUrl: varchar("logo_url", { length: 512 }),
  settings: jsonb("settings").default({}),
  subscriptionTier: varchar("subscription_tier", { length: 32 }).default("free"),
  // Region/locale — gates currency, tax, formatting, and (later) regulatory
  // behavior. Defaults keep existing US practices working unchanged.
  country: varchar("country", { length: 2 }).notNull().default("US"), // ISO 3166-1 alpha-2
  currency: varchar("currency", { length: 3 }).notNull().default("usd"), // ISO 4217, Stripe-style lowercase
  taxRatePercent: numeric("tax_rate_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("8.00"),
  vatNumber: varchar("vat_number", { length: 32 }), // shown on invoices where applicable
});

export const locations = pgTable("locations", {
  ...baseColumns(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 32 }),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const practicesRelations = relations(practices, ({ many }) => ({
  locations: many(locations),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  practice: one(practices, {
    fields: [locations.practiceId],
    references: [practices.id],
  }),
}));
