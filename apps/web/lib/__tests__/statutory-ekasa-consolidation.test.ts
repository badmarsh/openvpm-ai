import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * UI-craft consolidation guards for the three statutory/financial modules:
 *  1. Kniha omamných a psychotropných látok (Zákon 139/1998 Z. z.)
 *  2. Zákonné veterinárne registre (Zákon 39/2007 Z. z.)
 *  3. Pokladňa a e-Kasa doklady (Zákon 289/2008 Z. z.)
 *
 * The assertions are source-level on purpose: they pin the canonical
 * PageHeader / shadcn Table / EmptyState contract so a future edit cannot
 * silently regress heading hierarchy, row density, tabular numerals or the
 * chromatic movement taxonomy required by the statutory registers.
 */

const FILES = {
  controlledSubstances: "app/(dashboard)/controlled-substances/page.tsx",
  statutory: "app/(dashboard)/statutory/page.tsx",
  kvepisPage: "app/(dashboard)/statutory/kvepis/page.tsx",
  ekasa: "app/(dashboard)/billing/ekasa/page.tsx",
  kvepisPanel: "components/statutory/kvepis-panel.tsx",
  ekasaDrawer: "components/ekasa/thermal-receipt-drawer.tsx",
} as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

/** Collapses whitespace so JSX re-indentation never breaks an assertion. */
function normalized(path: string): string {
  return source(path).replace(/\s+/g, " ");
}

describe("statutory & e-Kasa GUI consolidation", () => {
  it("routes every module heading through the canonical PageHeader", () => {
    for (const path of [
      FILES.controlledSubstances,
      FILES.statutory,
      FILES.kvepisPage,
      FILES.ekasa,
    ]) {
      const src = source(path);
      expect(src, path).toContain("<PageHeader");
      expect(src, path).toContain('from "@/components/layout/page-header"');
      // No hand-rolled page-level <h1>/<h2> typography left in these pages.
      expect(src, path).not.toMatch(/<h1\s+className="text-(lg|xl|2xl|3xl)/);
    }
  });

  it("labels the controlled-substance register as the OPK ledger of record", () => {
    const src = normalized(FILES.controlledSubstances);
    expect(src).toContain(
      't("controlledSubstances.title", "Kniha omamných látok (OPK)")'
    );
    // Zákon 139/1998 Z. z. mandates date, patient, veterinarian, batch,
    // received/issued quantity and the resulting balance per movement.
    for (const column of [
      "controlledSubstances.table.dateTime",
      "controlledSubstances.table.patient",
      "controlledSubstances.table.performedBy",
      "controlledSubstances.table.lotNumber",
      "controlledSubstances.table.received",
      "controlledSubstances.table.issued",
      "controlledSubstances.table.balance",
    ]) {
      expect(src, column).toContain(column);
    }
    expect(src).toContain("formatControlledSubstanceDateTime( entry.performedAt, verifiedLogPayload.settings.timezone, locale");
  });

  it("keeps controlled-substance movements chromatically distinct", () => {
    const src = source(FILES.controlledSubstances);
    // Príjem (dodací list) = green, Výdaj = violet/blue, Likvidácia = red.
    expect(src).toMatch(/received:\s*\n?\s*"(?:border-emerald|border-success)/);
    expect(src).toMatch(/administered:\s*\n?\s*"border-violet/);
    expect(src).toMatch(/wasted:\s*\n?\s*"(?:border-red|border-destructive)/);
    // Movement kinds (income / issue / disposal) are resolved per action.
    expect(src).toContain("controlledSubstances.movementKinds.${movementKind}");
    expect(src).toMatch(/received:\s*"income"/);
    expect(src).toMatch(/wasted:\s*"disposal"/);
  });

  it("docks the dense table contract onto shadcn Table primitives", () => {
    for (const path of [
      FILES.controlledSubstances,
      FILES.statutory,
      FILES.ekasa,
      FILES.kvepisPanel,
    ]) {
      const src = source(path);
      expect(src, path).toContain('from "@/components/ui/table"');
      // Dense rows (4/8px grid) instead of the default p-3 cells.
      expect(src, path).toContain("px-3 py-2.5");
    }
    // Raw JSX <table> markup must not return to the statutory hub or registers.
    for (const path of [FILES.statutory, FILES.kvepisPage]) {
      const src = source(path);
      expect(src, path).not.toContain('<div className="overflow-x-auto">');
    }
  });

  it("pins the statutory send-state filter and register categories", () => {
    const panel = normalized(FILES.kvepisPanel);
    for (const key of [
      "statutory.kvepis.sendStateSent",
      "statutory.kvepis.sendStateAwaiting",
      "statutory.kvepis.sendStateError",
      "statutory.kvepis.reportDateFrom",
      "statutory.kvepis.reportDateTo",
    ]) {
      expect(panel, key).toContain(key);
    }

    const statutory = normalized(FILES.statutory);
    // The three register categories jump to KVEPIS / CRSZ / infectious diseases.
    expect(statutory).toContain('"statutory.tabs.crszChip"');
    expect(statutory).toContain('"statutory.tabs.infectious"');
    expect(statutory).toContain('"statutory.tabs.kvepis"');
  });

  it("renders e-Kasa verification badges in the statutory vocabulary", () => {
    const src = normalized(FILES.ekasa);
    // Verification labels are resolved from the receipt + fiscal status.
    expect(src).toContain("ekasa.page.verification.${verification}");
    expect(src).toMatch(/case "CONFIRMED":\s*\n?\s*return "valid"/);
    expect(src).toMatch(/case "OFFLINE_STORED":\s*\n?\s*return "offline"/);
    expect(src).toContain('"ekasa.page.verification.storno"');
    // Amounts are formatted through the shared currency helper, right aligned.
    expect(src).toContain("useCurrencyFormatter");
    expect(src).toContain("formatAmount(r.amountTotal)");
    expect(src).toMatch(/text-right[^"]*tabular-nums/);
    // Tabs are shadcn Tabs, never hand-rolled button groups.
    expect(src).toContain('from "@/components/ui/tabs"');
    expect(src).not.toMatch(/activeTab === "receipts"\s*\?\s*"bg-background/);

    // Every status pulse must carry a localized label (never the default copy),
    // in the register table as well as inside the thermal receipt drawer.
    for (const path of [FILES.ekasa, FILES.ekasaDrawer]) {
      const file = normalized(path);
      const badges = file.match(/<StatusPulseBadge/g) ?? [];
      const labelled = file.match(/<StatusPulseBadge[^>]*label=\{t\(/g) ?? [];
      expect(badges.length, path).toBeGreaterThan(0);
      expect(labelled.length, path).toBe(badges.length);
      // Drawer amounts flow through the shared region-aware currency helper.
      expect(file, path).toContain("useCurrencyFormatter");
    }
  });

  it("uses the canonical EmptyState with a localized CTA in every register", () => {
    for (const path of [
      FILES.controlledSubstances,
      FILES.statutory,
      FILES.ekasa,
      FILES.kvepisPanel,
    ]) {
      const src = normalized(path);
      expect(src, path).toContain("<EmptyState");
      expect(src, path).toContain("action={{");
    }
    expect(normalized(FILES.controlledSubstances)).toContain(
      '"controlledSubstances.empty.logFirst", "Zaznamenať príjem omamnej látky"'
    );
    expect(normalized(FILES.kvepisPanel)).toContain(
      '"statutory.kvepis.emptyCta", "Vytvoriť export KVEPIS"'
    );
  });

  it("never hardcodes a formatting locale at these call sites", () => {
    for (const path of Object.values(FILES)) {
      const src = source(path);
      expect(src, path).not.toContain('toLocaleString("sk-SK"');
      expect(src, path).not.toContain('toLocaleDateString("sk-SK"');
      expect(src, path).not.toContain('toLocaleString("en-US"');
      expect(src, path).not.toContain('toLocaleDateString("en-US"');
    }
    // Locale tags are resolved centrally from the active UI language.
    expect(source("lib/locale/format.ts")).toContain("localeTagForLanguage");
    expect(source("lib/locale/format.ts")).toContain("export function formatDateTime");
  });
});
