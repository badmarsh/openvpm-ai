import { describe, expect, it } from "vitest";
import { products } from "@openpims/db";
import { createImportDb, PRODUCT_ID } from "./helpers/wholesaler-db";

describe("delivery-note preview", () => {
  it("matches SKU before names, flags controlled substances and keeps lot/expiry", async () => {
    const { caller } = createImportDb([{ id: PRODUCT_ID, name: "Amoksiklav", sku: "CYM-1", stockQuantity: 15 }]);
    const result = await caller().parse({ filename: "cymedica.csv", content: [
      "Kod;Nazov;Sarza;Expiracia;Mnozstvo;MJ;CenaBezDPH;DPH",
      "CYM-1;Amoksiklav 100 ml;LOT1;31.12.2027;10;ks;14,50;5",
      "CYM-2;Ketamín;LOT2;31.12.2027;1;ks;10;5",
    ].join("\n") });
    expect(result.items[0]).toMatchObject({ suggestedAction: "update_stock", batchNumber: "LOT1", expirationDate: "2027-12-31", matchedProduct: { id: PRODUCT_ID } });
    expect(result.items[1]).toMatchObject({ isControlledSubstance: true, suggestedAction: "skip" });
  });
  it("applies legacy notes through the same safe transaction", async () => {
    const { caller, db, writes } = createImportDb([{ id: PRODUCT_ID, name: "Amoksiklav", stockQuantity: 0 }]);
    const result = await caller().applyDeliveryNote({ deliveryNoteNumber: "DL1", supplierName: "Supplier", items: [
      { action: "update_stock", productId: PRODUCT_ID, name: "Amoksiklav", quantity: 2 },
      { action: "create_product", name: "Bandage", quantity: 1, costPrice: "2.50" },
      { action: "skip", name: "Ignored", quantity: 1 },
    ] });
    expect(result).toMatchObject({ updatedCount: 1, createdCount: 1, skippedCount: 1 });
    expect(db.transaction).toHaveBeenCalled();
    expect(writes.filter(w => w.table === products)).toHaveLength(1);
  });
  it("gives a no-items error rather than a success toast for an empty extraction", async () => {
    await expect(createImportDb().caller().parse({ content: "unrecognized text" })).rejects.toMatchObject({ message: "IMPORT_NO_ITEMS" });
  });
});
