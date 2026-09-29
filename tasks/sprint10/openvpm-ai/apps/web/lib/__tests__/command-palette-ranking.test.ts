import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Sprint: command palette smart ranking, cross-lingual (SK/EN) matching and
 * route-aware contextual actions.
 */
describe("command palette smart ranking", () => {
  const source = readFileSync("components/common/command-search.tsx", "utf8");
  const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
  const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));

  it("keeps quick actions and navigation searchable while typing", () => {
    // Matching runs in JS against the resolved labels, not through cmdk's own
    // filter, because filtering is disabled as soon as a query is present.
    expect(source).toContain("const matchingActions = useMemo");
    expect(source).toContain("if (!hasQuery) return [];");
    expect(source).toContain("const { sk, en } = resolveI18nLabels(");
    expect(source).toContain("scoreActionMatch(item, queryNorm, [");
    expect(source).toContain("normalizeSearchText(debouncedSearch)");
    expect(source).toContain("visibleQuickActionItems.map");
    expect(source).toContain("visibleNavigationItems.map");

    // Rendered above the live patient/client results.
    expect(source).toContain("Matching quick actions & navigation ABOVE DB results");
    expect(source.indexOf("headingMatchedActions")).toBeLessThan(
      source.indexOf("headingPatients"),
    );

    // Capped so the palette stays clean.
    expect(source).toContain("const MATCHED_ACTION_LIMIT = 5;");
    expect(source).toContain(".slice(0, MATCHED_ACTION_LIMIT)");
  });

  it("matches case- and diacritic-insensitively across Slovak and English", () => {
    expect(source).toContain("function normalizeSearchText(str: string): string");
    expect(source).toContain('.replace(/[\\u0300-\\u036f]/g, "")');
    expect(source).toContain('.toLowerCase()');

    // Both dictionaries are consulted, so either language resolves the item.
    expect(source).toContain("function resolveI18nLabels(");
    expect(source).toContain("skMessages.commandSearch");
    expect(source).toContain("enMessages.commandSearch");

    // Commonly typed Slovak terms are searchable, with and without diacritics.
    for (const alias of [
      '"návšteva"',
      '"objednať"',
      '"termín"',
      '"vyšetrenie"',
      '"faktúra"',
      '"pokladňa"',
      '"recept"',
    ]) {
      expect(source, `alias ${alias}`).toContain(alias);
    }
  });

  it("boosts contextual quick actions for the active route", () => {
    expect(source).toContain("usePathname()");
    expect(source).toContain("const ROUTE_QUICK_ACTION_BOOSTS");
    expect(source).toContain("function isWithinSection(pathname: string, section: string): boolean");
    expect(source).toContain("function boostQuickActionsForRoute(");
    expect(source).toContain("boostQuickActionsForRoute(");

    const boostTable = source.slice(
      source.indexOf("const ROUTE_QUICK_ACTION_BOOSTS"),
      source.indexOf("function isWithinSection"),
    );
    // Patients / clients -> register a patient or a client.
    expect(boostTable).toContain('paths: ["/patients", "/clients"]');
    expect(boostTable).toContain('"commandSearch.newPatient", "commandSearch.newClient"');
    // Schedule / encounters -> book the next visit.
    expect(boostTable).toContain('paths: ["/schedule", "/encounters"]');
    expect(boostTable).toContain('"commandSearch.newAppointment"');
    // Billing (incl. the POS register) -> take payment / raise an invoice.
    expect(boostTable).toContain('paths: ["/billing", "/billing/pos"]');
    expect(boostTable).toContain('"commandSearch.openPos", "commandSearch.newInvoice"');
    // Inventory -> receive goods or register a product.
    expect(boostTable).toContain('paths: ["/inventory"]');
    expect(boostTable).toContain('"commandSearch.goodsReceipt", "commandSearch.newProduct"');

    // Booking is also boosted on a client record, where it is the next step.
    expect(source).toContain('clientId ? ["commandSearch.newAppointment"] : []');
  });

  it("exposes POS register, goods receipt and new product as quick actions", () => {
    expect(source).toContain('labelKey: "commandSearch.openPos"');
    expect(source).toContain('href: "/billing/pos"');
    expect(source).toContain('labelKey: "commandSearch.goodsReceipt"');
    expect(source).toContain('href: "/inventory?import=1"');
    expect(source).toContain('labelKey: "commandSearch.newProduct"');
    expect(source).toContain('href: "/inventory?new=1"');

    // The inventory page honours those deep links instead of showing a bare list.
    const inventoryPage = readFileSync("app/(dashboard)/inventory/page.tsx", "utf8");
    expect(inventoryPage).toContain('searchParams.get("new") === "1"');
    expect(inventoryPage).toContain('searchParams.get("import") === "1"');
    expect(inventoryPage).toContain("setShowAddProduct(true)");
    expect(inventoryPage).toContain("setShowImportDialog(true)");
  });

  it("keeps every new dictionary key symmetric across en and sk", () => {
    const requiredKeys = [
      "openPos",
      "goodsReceipt",
      "newProduct",
      "navPrescriptions",
      "headingMatchedActions",
    ];

    for (const key of requiredKeys) {
      expect(en.commandSearch[key], `en.commandSearch.${key}`).toBeDefined();
      expect(sk.commandSearch[key], `sk.commandSearch.${key}`).toBeDefined();
      expect(typeof en.commandSearch[key]).toBe("string");
      expect(typeof sk.commandSearch[key]).toBe("string");
      expect(en.commandSearch[key].length).toBeGreaterThan(0);
      expect(sk.commandSearch[key].length).toBeGreaterThan(0);
    }

    // Shared heading label used by the matched-actions group.
    expect(en.nav.actions).toBe("Actions");
    expect(sk.nav.actions).toBe("Akcie");

    const enKeys = Object.keys(en.commandSearch).sort();
    const skKeys = Object.keys(sk.commandSearch).sort();
    expect(enKeys).toEqual(skKeys);
    const enNavKeys = Object.keys(en.nav).sort();
    const skNavKeys = Object.keys(sk.nav).sort();
    expect(enNavKeys).toEqual(skNavKeys);
  });
});
