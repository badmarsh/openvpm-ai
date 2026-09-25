import { describe, expect, it } from "vitest";
import { products, extInventoryReceipts, extInventoryMetadata } from "@openpims/db";
import { createImportDb, PRODUCT_ID, PRACTICE_ID } from "./helpers/wholesaler-db";

const receipt = { deliveryNoteNumber: "DL-2026-78", supplierName: "Test supplier" };
const regular = { action: "create_product" as const, name: "Obväz 5 cm", sku: "NEW-1", costPrice: "2.50", retailPrice: "3.75", quantity: 5, vatRate: 23 };

describe("wholesaler import confirmation", () => {
  it("creates stock with net retail and separate supplier / VAT metadata, without violating migration identity constraints", async () => {
    const { caller, writes } = createImportDb();
    expect(await caller().confirmImport({ ...receipt, items: [regular] })).toMatchObject({ createdCount: 1 });
    const product = writes.find(w => w.table === products)?.values;
    expect(product).toMatchObject({ practiceId: PRACTICE_ID, unitPrice: "3.75", stockQuantity: 5 });
    expect(product.externalSource).toBeUndefined();
    expect(product.externalId).toBeUndefined();
    expect(writes.find(w => w.table === extInventoryMetadata)?.values).toMatchObject({ supplierName: receipt.supplierName, supplierCode: "NEW-1", vatRate: "23" });
  });
  it("updates a tenant catalog target with reviewed prices and fractional stock", async () => {
    const { caller, db } = createImportDb([{ id: PRODUCT_ID, name: regular.name, sku: regular.sku, stockQuantity: 0 }]);
    const result = await caller().confirmImport({ ...receipt, items: [{ ...regular, action: "update_stock", productId: PRODUCT_ID, quantity: 1.5, lotNumber: "LOT1", expirationDate: "31.12.2027" }] });
    expect(result.updatedCount).toBe(1);
    expect(db.update).toHaveBeenCalledOnce();
  });
  it("rejects a replay instead of adding stock a second time", async () => {
    const { caller, db, writes } = createImportDb([], true);
    await expect(caller().confirmImport({ ...receipt, items: [regular] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.update).not.toHaveBeenCalled();
    expect(writes.some(w => w.table === products)).toBe(false);
  });
  it.each(["Ketamín", "Diazepam", "Butorfanol", "Morfín", "Fentanyl", "Propofol"])("blocks %s on BOTH import endpoints", async name => {
    for (const endpoint of ["confirmImport", "applyDeliveryNote"] as const) {
      const { caller, db } = createImportDb();
      await expect(caller()[endpoint]({ ...receipt, items: [{ ...regular, name }] })).rejects.toMatchObject({ code: "FORBIDDEN", message: "CONTROLLED_IMPORT_BLOCKED" });
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    }
  });
  it("does not trust a harmless client name for a controlled catalog product", async () => {
    const { caller, db } = createImportDb([{ id: PRODUCT_ID, name: "Morfín", sku: regular.sku }]);
    await expect(caller().confirmImport({ ...receipt, items: [{ ...regular, action: "update_stock", productId: PRODUCT_ID }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("saves a pending reference for skipped controlled lines, NOT stock or an auto-filled ledger", async () => {
    const { caller, writes, db } = createImportDb();
    const result = await caller().confirmImport({ ...receipt, items: [{ action: "skip", name: "Ketamín", quantity: 1 }] });
    expect(result.skippedCount).toBe(1);
    expect(db.update).not.toHaveBeenCalled();
    expect(writes.some(w => w.table === products)).toBe(false);
    expect(writes.find(w => w.table === extInventoryReceipts)?.values.controlledReview).toEqual([{ name: "Ketamín", line: 1 }]);
  });
  it("fails closed for nonexistent/cross-tenant product IDs", async () => {
    const { caller, db } = createImportDb();
    await expect(caller().confirmImport({ ...receipt, items: [{ ...regular, action: "update_stock", productId: PRODUCT_ID }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("accepts decimal-comma money, rejects invalid price and quantity", async () => {
    const { caller } = createImportDb();
    await expect(caller().confirmImport({ ...receipt, items: [{ ...regular, costPrice: "2,50", retailPrice: "3,75" }] })).resolves.toMatchObject({ createdCount: 1 });
    for (const patch of [{ costPrice: "abc" }, { quantity: -1 }, { quantity: 0 }, { quantity: 10001 }]) {
      await expect(caller().confirmImport({ ...receipt, items: [{ ...regular, ...patch }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
  it.each(["technician", "front_desk", "viewer"])("keeps controlled review restricted for %s", async role => {
    const { caller } = createImportDb();
    await expect(caller(role).pendingControlledReviews()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(role).linkControlledReview({ receiptId: PRODUCT_ID, entryId: PRODUCT_ID, line: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
