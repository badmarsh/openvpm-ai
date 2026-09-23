import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@openpims/db";
import { wholesalerImportRouter } from "../routers/extensions/wholesaler-import";
import { inventoryRouter } from "../routers/inventory";
import { controlledSubstancesRouter } from "../routers/controlled-substances";

const enabled = process.env.INVENTORY_IMPORT_DB_INTEGRATION === "1";
describe.skipIf(!enabled)("inventory import PostgreSQL contract", () => {
  it("receives once, persists metadata, filters across pages, blocks OPL, and links a manually entered ledger receipt", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.pathname !== "/openvpm_ai" || url.port !== "5434" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Use local openvpm_ai on port 5434 only");
    const client = postgres(url.toString(), { max: 4 });
    const db = drizzle(client, { schema });
    try {
      const [practice] = await db.insert(schema.practices).values({ name: "Synthetic inventory test", timezone: "Europe/Bratislava" }).returning();
      const [user] = await db.insert(schema.users).values({ name: "Synthetic vet", email: `${randomUUID()}@example.com`, passwordHash: "not-a-login", role: "veterinarian", practiceId: practice.id }).returning();
      const context = { db, session: { user: { ...user, role: "veterinarian" } }, practiceId: practice.id } as never;
      const caller = wholesalerImportRouter.createCaller(context);
      const regular = { name: "Test bandage", sku: "B1", barcode: "859001", activeSubstance: "cotton", category: "supply", costPrice: "10.00", retailPrice: "15.00", vatRate: 23, quantity: 2, action: "create_product" as const };
      const receipt = { deliveryNoteNumber: "TEST-1", supplierName: "Synthetic supplier", items: [regular, { name: "Morfín", quantity: 1, action: "skip" as const }] };
      const result = await caller.confirmImport(receipt);
      expect(result).toMatchObject({ createdCount: 1, skippedCount: 1 });
      await expect(caller.confirmImport(receipt)).rejects.toMatchObject({ code: "CONFLICT" });
      const rows = await db.select().from(schema.products).where(eq(schema.products.practiceId, practice.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].stockQuantity).toBe(2);
      const list = inventoryRouter.createCaller(context);
      for (const search of ["859001", "cotton"]) {
        const found = await list.list({ search, supplierName: receipt.supplierName, category: "supply", belowMinimum: true, expiryWindowDays: 29, limit: 1, offset: 0 });
        expect(found.total).toBe(1);
        expect(found.items[0].id).toBe(rows[0].id);
      }
      expect((await list.list({ supplierName: "Other", limit: 50, offset: 0 })).total).toBe(0);
      for (const endpoint of ["confirmImport", "applyDeliveryNote"] as const) {
        await expect(caller[endpoint]({ ...receipt, deliveryNoteNumber: "TEST-BLOCK", items: [{ ...regular, name: "Propofol" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      const pending = await caller.pendingControlledReviews();
      expect(pending).toHaveLength(1);
      expect(pending[0].controlledReview).toEqual([{ name: "Morfín", line: 2 }]);
      expect(await db.select().from(schema.controlledSubstanceLog).where(eq(schema.controlledSubstanceLog.practiceId, practice.id))).toHaveLength(0);
      const entry = await controlledSubstancesRouter.createCaller(context).create({ drugName: "Morfín", quantity: "1", unit: "vial", deaSchedule: "OMAMNA_II", action: "received" });
      await caller.linkControlledReview({ receiptId: pending[0].id, line: 2, entryId: entry.id });
      expect(await caller.pendingControlledReviews()).toHaveLength(0);
      // A second tenant cannot select or mutate the first tenant's stock even on the owner connection.
      const [other] = await db.insert(schema.practices).values({ name: "Synthetic other tenant" }).returning();
      const otherCaller = wholesalerImportRouter.createCaller({ ...context as any, session: { user: { ...user, practiceId: other.id } } });
      await expect(otherCaller.confirmImport({ ...receipt, deliveryNoteNumber: "FOREIGN", items: [{ ...regular, action: "update_stock", productId: rows[0].id }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await db.select().from(schema.products).where(and(eq(schema.products.id, rows[0].id), eq(schema.products.practiceId, practice.id))))[0].stockQuantity).toBe(2);
    } finally { await client.end(); }
  }, 30000);
});
