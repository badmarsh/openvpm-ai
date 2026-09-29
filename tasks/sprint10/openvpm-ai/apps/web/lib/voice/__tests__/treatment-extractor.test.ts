import { describe, it, expect } from "vitest";
import { extractBillableItemsFromSoap } from "../treatment-extractor";

describe("Voice Treatment & Medication Extractor for Billing", () => {
  it("extracts medications and services from clinical plan text", async () => {
    const plan = `
1. Klinické vyšetrenie zvieraťa (afebrilný, dehydratácia 5%).
2. Podaná Cerenia 1 ml s.c. proti zvracaniu.
3. Aplikovaný Melovem 0.5 ml s.c. proti bolesti a zápalu.
4. Vydaný Synulox 50mg 10 tbl na domáce užívanie (1 tbl 2x denne).
`;

    const items = await extractBillableItemsFromSoap({ plan });

    expect(items.length).toBeGreaterThanOrEqual(3);

    const cerenia = items.find((i) => /cerenia/i.test(i.name));
    expect(cerenia).toBeDefined();
    expect(cerenia?.category).toBe("medication");
    expect(cerenia?.quantity).toBe(1);
    expect(cerenia?.unit).toBe("ml");

    const melovem = items.find((i) => /melovem/i.test(i.name));
    expect(melovem).toBeDefined();
    expect(melovem?.quantity).toBe(0.5);

    const synulox = items.find((i) => /synulox/i.test(i.name));
    expect(synulox).toBeDefined();
    expect(synulox?.quantity).toBe(10);
    expect(synulox?.unit).toBe("tbl");

    const vysetrenie = items.find((i) => /vyšetrenie/i.test(i.name));
    expect(vysetrenie).toBeDefined();
    expect(vysetrenie?.category).toBe("service");
  });

  it("calculates item total price and assigns proper VAT rates", async () => {
    const plan = "Aplikovaný Betamox 2 ml s.c., vykonané RTG vyšetrenie hrudníka.";
    const items = await extractBillableItemsFromSoap({ plan });

    expect(items.length).toBeGreaterThanOrEqual(2);

    for (const item of items) {
      expect(item.unitPrice).toBeGreaterThan(0);
      expect(item.totalPrice).toBe(Math.round(item.quantity * item.unitPrice * 100) / 100);
      expect([19, 23]).toContain(item.vatRate);
    }
  });

  it("provides fallback clinical examination when plan is empty or generic", async () => {
    const items = await extractBillableItemsFromSoap({ plan: "Kontrola stavu bez ďalších zákrokov." });
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
