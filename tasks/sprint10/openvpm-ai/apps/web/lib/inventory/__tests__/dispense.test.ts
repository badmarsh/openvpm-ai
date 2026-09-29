import { describe, it, expect } from "vitest";
import { computeStockDeductions } from "../dispense";

describe("computeStockDeductions", () => {
  it("deducts product lines and ignores services", () => {
    const result = computeStockDeductions([
      { itemType: "product", itemId: "p1", quantity: 2 },
      { itemType: "service", itemId: "s1", quantity: 1 },
    ]);
    expect(result).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("aggregates multiple lines of the same product", () => {
    const result = computeStockDeductions([
      { itemType: "product", itemId: "p1", quantity: 2 },
      { itemType: "product", itemId: "p1", quantity: 3 },
      { itemType: "product", itemId: "p2", quantity: 1 },
    ]);
    expect(result).toContainEqual({ productId: "p1", quantity: 5 });
    expect(result).toContainEqual({ productId: "p2", quantity: 1 });
    expect(result).toHaveLength(2);
  });

  it("skips product lines with no linked product id", () => {
    expect(
      computeStockDeductions([{ itemType: "product", itemId: null, quantity: 4 }])
    ).toEqual([]);
  });

  it("skips non-positive or non-finite quantities", () => {
    expect(
      computeStockDeductions([
        { itemType: "product", itemId: "p1", quantity: 0 },
        { itemType: "product", itemId: "p2", quantity: -3 },
        { itemType: "product", itemId: "p3", quantity: Number.NaN },
      ])
    ).toEqual([]);
  });

  it("returns an empty array for no items", () => {
    expect(computeStockDeductions([])).toEqual([]);
  });
});
