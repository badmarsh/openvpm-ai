import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quantityLineTotalCents } from "../quantity";
import { moneyToCents, centsToMoney } from "../billing/invoice-balance";
import { tryCalculateInvoiceTaxTotals } from "../billing/invoice-tax";

describe("billing/new UI & consistency contract (Sprint 9)", () => {
  const source = readFileSync("app/(dashboard)/billing/new/page.tsx", "utf8");

  it("does not use imprecise float multiplication for line totals", () => {
    expect(source).not.toContain("item.quantity * parseFloat");
    expect(source).toContain(
      "centsToMoney(quantityLineTotalCents(moneyToCents(item.unitPrice), item.quantity))"
    );
  });

  it("associates labels with inputs via htmlFor", () => {
    expect(source).toContain('htmlFor="client-search"');
    expect(source).toContain('htmlFor="patient-select"');
    expect(source).toContain('htmlFor="line-description"');
    expect(source).toContain('htmlFor="line-quantity"');
    expect(source).toContain('htmlFor="line-unit-price"');
    expect(source).toContain('htmlFor="estimate-toggle"');
    expect(source).toContain('htmlFor="due-date"');
  });

  it("uses theme border tokens and avoids raw border-gray- classes", () => {
    expect(source).not.toContain("border-gray-");
  });

  it("routes error messages through i18n instead of raw template literals", () => {
    expect(source).not.toContain("`Unable to load billing services. ${");
    expect(source).not.toContain("`Unable to load client patients. ${");
  });

  it("preserves InlineQueryMessage definition and contract", () => {
    expect(source).toContain("function InlineQueryMessage");
  });

  it("verifies line totals calculated via cents helpers always add up exactly to the subtotal", () => {
    const testCases = [
      { unitPrice: "10.50", quantity: 1 },
      { unitPrice: "3.33", quantity: 0.125 },
      { unitPrice: "45.00", quantity: 2.5 },
      { unitPrice: "0.99", quantity: 100 },
      { unitPrice: "123.45", quantity: 0.001 },
      { unitPrice: "19.99", quantity: 3.333 },
      { unitPrice: "0.05", quantity: 10.005 },
    ];

    const lineCents = testCases.map((item) =>
      quantityLineTotalCents(moneyToCents(item.unitPrice), item.quantity)
    );
    const sumLineCents = lineCents.reduce((acc, c) => acc + c, 0);

    const totals = tryCalculateInvoiceTaxTotals(
      testCases.map((item) => ({
        lineTotalCents: quantityLineTotalCents(
          moneyToCents(item.unitPrice),
          item.quantity
        ),
        taxable: true,
      })),
      "23.00"
    );

    expect(totals).not.toBeNull();
    expect(totals!.subtotalCents).toBe(sumLineCents);

    // Summing formatted money strings converted back to cents matches subtotal
    const displayedSum = lineCents
      .map((c) => moneyToCents(centsToMoney(c)))
      .reduce((a, b) => a + b, 0);
    expect(displayedSum).toBe(totals!.subtotalCents);
  });
});
