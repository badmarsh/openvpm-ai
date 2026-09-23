import { pgTable, uuid, varchar, numeric, jsonb, uniqueIndex, index, foreignKey } from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { products } from "./billing";

/** Supplier identifiers and tax metadata stay outside upstream products. */
export const extInventoryMetadata = pgTable("ext_inventory_metadata", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  productId: uuid("product_id").notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  supplierCode: varchar("supplier_code", { length: 64 }),
  barcode: varchar("barcode", { length: 64 }),
  activeSubstance: varchar("active_substance", { length: 255 }),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
}, t => ({
  productFk: foreignKey({ columns: [t.practiceId, t.productId], foreignColumns: [products.practiceId, products.id] }),
  productUq: uniqueIndex("ext_inventory_metadata_product_uq").on(t.practiceId, t.productId),
  supplierIdx: index("ext_inventory_metadata_supplier_idx").on(t.practiceId, t.supplierName),
}));

/** Receipt identity prevents duplicate stock additions. Pending OPL is NOT a ledger entry. */
export const extInventoryReceipts = pgTable("ext_inventory_receipts", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  receiptKey: varchar("receipt_key", { length: 64 }).notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  deliveryNoteNumber: varchar("delivery_note_number", { length: 64 }).notNull(),
  // Source references only: never prefill drug, quantity, schedule or unit in the OPL form.
  controlledReview: jsonb("controlled_review").$type<Array<{ name: string; line: number; ledgerId?: string }>>().notNull().default([]),
}, t => ({
  receiptUq: uniqueIndex("ext_inventory_receipts_identity_uq").on(t.practiceId, t.receiptKey),
  practiceIdx: index("ext_inventory_receipts_practice_idx").on(t.practiceId, t.createdAt),
}));
