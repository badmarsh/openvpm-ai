import { describe, it, expect } from "vitest";
import {
  discountedUnitPrice,
  discountedLineTotal,
  computePosTotals,
} from "../pos-calculations";

describe("discountedUnitPrice", () => {
  it("applies a percent discount and rounds to cents", () => {
    expect(discountedUnitPrice(10, 10)).toBe(9);
    expect(discountedUnitPrice(10, 0)).toBe(10);
    expect(discountedUnitPrice(5.55, 10)).toBe(5.0); // 4.995 -> 5.00
  });

  it("clamps invalid discount values", () => {
    expect(discountedUnitPrice(10, 150)).toBe(0); // clamped to 100%
    expect(discountedUnitPrice(10, -5)).toBe(10); // clamped to 0%
    expect(discountedUnitPrice(10, undefined)).toBe(10);
  });
});

describe("discountedLineTotal", () => {
  it("multiplies net unit price by quantity", () => {
    expect(discountedLineTotal({ unitPrice: 10, quantity: 3, discountPercent: 10 })).toBe(27);
    expect(discountedLineTotal({ unitPrice: 10, quantity: 0, discountPercent: 0 })).toBe(10);
  });
});

describe("computePosTotals", () => {
  it("sums subtotal, discount and net total across lines", () => {
    const totals = computePosTotals([
      { unitPrice: 10, quantity: 2, discountPercent: 0 },
      { unitPrice: 5, quantity: 4, discountPercent: 50 },
    ]);
    expect(totals.subtotal).toBe(40);
    expect(totals.discount).toBe(10);
    expect(totals.total).toBe(30);
  });

  it("returns zero totals for an empty cart", () => {
    expect(computePosTotals([])).toEqual({ subtotal: 0, discount: 0, total: 0 });
  });
});
