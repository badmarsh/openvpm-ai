import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POS checkout UI & contract (Sprint 9)", () => {
  const source = readFileSync("app/(dashboard)/billing/pos/page.tsx", "utf8");

  it("harmonizes with the dashboard page kit and UI tokens", () => {
    expect(source).toContain("pageShellClass");
    expect(source).toContain("formatCurrency");
    expect(source).toContain("ActionConfirmationDialog");
    expect(source).toContain("SearchField");
    expect(source).toContain("ShoppingCart");
    expect(source).toContain("tabular-nums");
  });

  it("enforces role gating matching the e-Kasa server procedure", () => {
    expect(source).toContain("canAccessPosRole");
    expect(source).toContain('"admin"');
    expect(source).toContain('"veterinarian"');
    expect(source).toContain('"front_desk"');
    expect(source).toContain("session?.user?.role");
    expect(source).not.toContain("const { data: session } = useSession();\n\n  const [search");
  });

  it("eliminates any casts and unformatted currency strings", () => {
    expect(source).not.toContain(": any");
    expect(source).not.toContain("as any");
    expect(source).not.toContain(".toFixed(2)");
  });

  it("does not contain raw toast string literals", () => {
    expect(source).not.toMatch(/toast\.(success|error)\(\s*["'`]/);
  });

  it("protects checkout with client-side invalid-line guard", () => {
    expect(source).toContain("isBillingCurrencyAmountInputValid");
    expect(source).toContain("isCartValid");
    expect(source).toMatch(/disabled=\{!isCartValid \|\| createPosSale\.isPending\}/);
  });

  it("maintains the exact e-Kasa fiscal payload contract", () => {
    const mutationMatch = source.match(/createPosSale\.mutate\(\{([\s\S]*?)\}\);/);
    expect(mutationMatch).toBeTruthy();
    const payloadBody = mutationMatch![1];
    expect(payloadBody).toContain("items");
    expect(payloadBody).toContain("paymentMethod");
    expect(payloadBody).toContain("clientId");
    expect(payloadBody).toContain("paperWidth");
  });
});
