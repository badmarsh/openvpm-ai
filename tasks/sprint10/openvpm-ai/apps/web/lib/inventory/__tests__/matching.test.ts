import { describe, expect, it } from "vitest";
import { matchInventoryProduct } from "../matching";
import { priceWithMarkup, priceIncludingVat, CATEGORY_MARKUPS } from "../markup";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import { classifyExpiration } from "../alerts";

describe("safe matching", () => {
  const rows = [{ name: "Obväz 5 cm", sku: "A1" }, { name: "Other", barcode: "1234", supplierCode: "B2" }];
  it("prioritizes identifiers over names", () => {
    expect(matchInventoryProduct({ name: "Obväz 5 cm", ean: "1234" }, rows)).toBe(rows[1]);
    expect(matchInventoryProduct({ name: "Unknown", sku: " b2 " }, rows)).toBe(rows[1]);
  });
  it("normalizes accents and whitespace but not strength or pack size", () => {
    expect(matchInventoryProduct({ name: " OBVAZ  5 CM " }, rows)).toBe(rows[0]);
    expect(matchInventoryProduct({ name: "Obväz 10 cm" }, rows)).toBeNull();
    expect(matchInventoryProduct({ name: "Obväz" }, rows)).toBeNull();
  });
  it("refuses ambiguous matches", () => {
    expect(matchInventoryProduct({ name: rows[0].name, sku: "A1" }, [rows[0], { ...rows[0] }])).toBeNull();
  });
});
describe("VAT-aware retail preview", () => {
  it.each([0, 5, 19, 23])("applies %s%% VAT to net retail without changing net storage", vat => {
    const net = priceWithMarkup("10.00", CATEGORY_MARKUPS.medication)!;
    expect(net).toBe("13.00");
    expect(priceIncludingVat(net, vat)).toBe((13 * (1 + vat / 100)).toFixed(2));
    expect(priceWithMarkup("10.00", CATEGORY_MARKUPS.supply)).toBe("15.00");
  });
  it("rejects invalid amounts", () => {
    expect(priceIncludingVat("garbage", 23)).toBeNull();
    expect(priceIncludingVat("10.00", NaN)).toBeNull();
  });
});
it.each(["Ketamín", "Diazepam", "Butorfanol", "Morfín", "Fentanyl", "Propofol", "Morfín".normalize("NFD")])("detects %s", name => {
  expect(isControlledSubstanceName(name)).toBe(true);
});
it("uses fewer than 30 days for inventory expiry alerts", () => {
  expect(classifyExpiration("2026-10-22", "2026-09-23", 29)).toBe("expiring_soon");
  expect(classifyExpiration("2026-10-23", "2026-09-23", 29)).toBe("ok");
});
