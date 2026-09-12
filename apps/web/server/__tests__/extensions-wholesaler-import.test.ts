import { describe, expect, it, vi } from "vitest";
import { wholesalerImportRouter } from "../routers/extensions/wholesaler-import";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PRODUCT_ID = "00000000-0000-0000-0000-000000000002";

function createCaller(db: Record<string, unknown>, role = "admin") {
  const session = {
    user: {
      id: USER_ID,
      email: `${role}@example.com`,
      name: "Veterinarian",
      role,
      practiceId: PRACTICE_ID,
    },
  };
  return wholesalerImportRouter.createCaller({ db, session, practiceId: PRACTICE_ID } as never);
}

describe("wholesalerImportRouter", () => {
  it("parses delivery note and matches existing product by SKU", async () => {
    const csvContent = [
      "Kod;Nazov;Sarza;Expiracia;Mnozstvo;MJ;CenaBezDPH;DPH;SpoluBezDPH",
      "CYM-001;Amoksiklav 100ml;BATCH123;31.12.2027;10;ks;14,50;10;145,00",
      "NEW-002;Nový obväz 5cm;LOT456;30.06.2028;5;ks;2,50;20;12,50",
    ].join("\n");

    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              id: PRODUCT_ID,
              name: "Amoksiklav 100ml",
              sku: "CYM-001",
              stockQuantity: 15,
              lotNumber: "OLD_BATCH",
              expirationDate: "2026-05-01",
              unitPrice: "18.85",
              costPrice: "14.50",
            },
          ]),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const result = await caller.parse({
      content: csvContent,
      filename: "cymedica_dl_2026.csv",
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("Amoksiklav 100ml");
    expect(result.items[0].matchedProduct).not.toBeNull();
    expect(result.items[0].matchedProduct?.id).toBe(PRODUCT_ID);
    expect(result.items[0].suggestedAction).toBe("update_stock");

    expect(result.items[1].name).toBe("Nový obväz 5cm");
    expect(result.items[1].matchedProduct).toBeNull();
    expect(result.items[1].suggestedAction).toBe("create_product");
  });

  it("applies delivery note updates within a database transaction", async () => {
    const updateFn = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    }));
    const insertFn = vi.fn(() => ({
      values: vi.fn(async () => []),
    }));

    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      update: updateFn,
      insert: insertFn,
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
    };

    const caller = createCaller(mockDb);
    const result = await caller.applyDeliveryNote({
      deliveryNoteNumber: "DL-2026-001",
      supplierName: "Cymedica SK",
      items: [
        {
          action: "update_stock",
          productId: PRODUCT_ID,
          name: "Amoksiklav 100ml",
          lotNumber: "BATCH123",
          expirationDate: "2027-12-31",
          quantity: 10,
        },
        {
          action: "create_product",
          name: "Nový obväz 5cm",
          sku: "NEW-002",
          costPrice: "2.50",
          lotNumber: "LOT456",
          expirationDate: "2028-06-30",
          quantity: 5,
        },
        {
          action: "skip",
          name: "Ignorovaná položka",
          quantity: 1,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(insertFn).toHaveBeenCalledTimes(1);
  });
});
