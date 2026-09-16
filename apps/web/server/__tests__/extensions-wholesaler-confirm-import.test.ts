import { describe, expect, it, vi } from "vitest";
import { products, extAutomationEvents } from "@openpims/db";
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

/**
 * Builds the chainable drizzle mock used by confirmImport:
 * - select → from → where → (orderBy →) limit
 * - update → set → where
 * - insert → values → onConflictDoNothing (async)
 *
 * Note: the post-commit inventory_delivery_received event emission also goes
 * through insertFn (arg = extAutomationEvents), so product-specific
 * assertions filter calls by the table argument.
 */
function createConfirmDb(opts?: { duplicates?: { id: string }[] }) {
  const duplicates = opts?.duplicates ?? [];
  const setFn = vi.fn(() => ({
    where: vi.fn(async () => []),
  }));
  const updateFn = vi.fn(() => ({ set: setFn }));
  const valuesFn = vi.fn(() => ({
    onConflictDoNothing: vi.fn(async () => []),
  }));
  const insertFn = vi.fn(() => ({ values: valuesFn }));
  const selectFn = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => duplicates),
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => duplicates),
        })),
      })),
    })),
  }));
  const mockDb: Record<string, unknown> = {
    execute: vi.fn(async () => undefined),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
    update: updateFn,
    insert: insertFn,
    select: selectFn,
  };
  const insertCalls = () => insertFn.mock.calls as unknown[][];
  const setCalls = () => setFn.mock.calls as unknown[][];
  const valuesCalls = () => valuesFn.mock.calls as unknown[][];
  const productInserts = () =>
    insertCalls().filter(([table]) => table === products);
  const eventInserts = () =>
    insertCalls().filter(([table]) => table === extAutomationEvents);
  return { mockDb, updateFn, setFn, insertFn, valuesFn, setCalls, valuesCalls, productInserts, eventInserts };
}

describe("wholesalerImportRouter.confirmImport", () => {
  it("updates matched stock with retail price, batch and expiry", async () => {
    const { mockDb, updateFn, setCalls, productInserts, eventInserts } = createConfirmDb();
    const caller = createCaller(mockDb);

    const result = await caller.confirmImport({
      deliveryNoteNumber: "DL-2026-77",
      supplierName: "Cymedica SK",
      wholesaler: "CYMEDICA",
      items: [
        {
          action: "update_stock",
          productId: PRODUCT_ID,
          name: "Amoksiklav 100ml",
          costPrice: "14.50",
          retailPrice: "20.30",
          vatRate: 10,
          lotNumber: "BATCH123",
          expirationDate: "31.12.2027",
          quantity: 10,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.createdCount).toBe(0);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(setCalls()[0]?.[0]).toMatchObject({
      unitPrice: "20.30",
      costPrice: "14.50",
      lotNumber: "BATCH123",
      expirationDate: "2027-12-31",
    });
    // No product row was created — only the durable event was inserted.
    expect(productInserts()).toHaveLength(0);
    expect(eventInserts().length).toBeGreaterThanOrEqual(1);
  });

  it("creates new products with the confirmed markup retail price", async () => {
    const { mockDb, valuesCalls, productInserts } = createConfirmDb();
    const caller = createCaller(mockDb);

    const result = await caller.confirmImport({
      deliveryNoteNumber: "DL-2026-78",
      supplierName: "Samohýl SK",
      items: [
        {
          action: "create_product",
          name: "Nový obväz 5cm",
          sku: "NEW-002",
          costPrice: "2.50",
          retailPrice: "3.75",
          vatRate: 23,
          lotNumber: "LOT456",
          quantity: 5,
        },
      ],
    });

    expect(result.createdCount).toBe(1);
    expect(productInserts()).toHaveLength(1);
    expect(valuesCalls()[0]?.[0]).toMatchObject({
      practiceId: PRACTICE_ID,
      name: "Nový obväz 5cm",
      sku: "NEW-002",
      unitPrice: "3.75",
      costPrice: "2.50",
      lotNumber: "LOT456",
      externalSource: "wholesaler:Samohýl SK",
      externalId: "DL-2026-78",
    });
  });

  it("upgrades duplicate create lines to stock updates (idempotent re-confirm)", async () => {
    const { mockDb, updateFn, productInserts } = createConfirmDb({
      duplicates: [{ id: PRODUCT_ID }],
    });
    const caller = createCaller(mockDb);

    const result = await caller.confirmImport({
      deliveryNoteNumber: "DL-2026-78",
      supplierName: "Samohýl SK",
      items: [
        {
          action: "create_product",
          name: "Nový obväz 5cm",
          sku: "NEW-002",
          costPrice: "2.50",
          quantity: 5,
        },
      ],
    });

    expect(result.createdCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(productInserts()).toHaveLength(0);
  });

  it("accepts decimal-comma Slovak prices and skips 'skip' lines", async () => {
    const { mockDb } = createConfirmDb();
    const caller = createCaller(mockDb);

    const result = await caller.confirmImport({
      deliveryNoteNumber: "DL-2026-79",
      supplierName: "Pharmos a.s.",
      items: [
        {
          action: "create_product",
          name: "Dezinfekcia 1L",
          costPrice: "4,90",
          retailPrice: "7,35",
          quantity: 2,
        },
        {
          action: "skip",
          name: "Ignorovaná položka",
          quantity: 1,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it("rejects invalid price formats", async () => {
    const { mockDb } = createConfirmDb();
    const caller = createCaller(mockDb);

    await expect(
      caller.confirmImport({
        deliveryNoteNumber: "DL-2026-80",
        supplierName: "Pharmos a.s.",
        items: [
          {
            action: "create_product",
            name: "Dezinfekcia 1L",
            costPrice: "abc",
            quantity: 2,
          },
        ],
      })
    ).rejects.toThrow();
  });
});

describe("wholesalerImportRouter.searchProducts", () => {
  it("returns catalog matches for manual linking", async () => {
    const rows = [
      {
        id: PRODUCT_ID,
        name: "Amoksiklav 100ml",
        sku: "CYM-001",
        stockQuantity: 15,
        unitPrice: "18.85",
        lotNumber: "B1",
        expirationDate: "2027-12-31",
      },
    ];
    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => rows),
            })),
          })),
        })),
      })),
    };
    mockDb.transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb));

    const caller = createCaller(mockDb, "front_desk");
    const result = await caller.searchProducts({ query: "amoxi", limit: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(PRODUCT_ID);
  });
});
