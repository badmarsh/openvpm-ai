import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Source-contract guards for the e-Kasa fiscal register page-kit adoption.
 * Presentation only: amounts, VAT math, receipt numbering, OKP/PKP signing,
 * storno rules and daily-closure logic stay pinned by
 * statutory-ekasa-consolidation.test.ts and the fiscal suite.
 */

const PAGE = "app/(dashboard)/billing/ekasa/page.tsx";

function source(): string {
  return readFileSync(PAGE, "utf8");
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("billing e-Kasa page-kit adoption", () => {
  it("imports the dashboard page-kit primitives from page-kit", () => {
    const src = source();
    const imports = pageKitImports(src);
    expect(src).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "PageToolbar",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(imports, name).toContain(name);
    }
    expect(src).toContain("className={pageShellClass}");
    expect(src).toContain("className={underlineTabsListClass}");
    expect(src).toContain("className={underlineTabsTriggerClass}");
  });

  it("keeps shadcn Table and Tabs primitives", () => {
    const src = source();
    expect(src).toContain('from "@/components/ui/table"');
    expect(src).toContain('from "@/components/ui/tabs"');
    expect(src).toContain("<Table");
    expect(src).toContain("<Tabs");
    expect(src).toContain("<TabsList");
    expect(src).toContain("<TabsTrigger");
    // Never replace shadcn Tabs with a hand-rolled button group.
    expect(src).not.toMatch(/activeTab === "receipts"\s*\?\s*"bg-background/);
  });

  it("drops the ad hoc table wrapper in favour of DataTableFrame", () => {
    const src = source();
    expect(src).not.toContain(
      "rounded-xl border bg-card shadow-xs overflow-hidden",
    );
    expect(src.match(/<DataTableFrame>/g)?.length).toBe(2);
    expect(src.match(/<\/DataTableFrame>/g)?.length).toBe(2);
  });

  it("does not nest the closures history header inside a div that also contains the table", () => {
    const src = source();
    // Ordering: header closes, then the table frame opens, then <Table.
    expect(src).toMatch(
      /<PageSectionHeader\s+title=\{t\("ekasa\.page\.closures\.history"[\s\S]*?\/>\s*<DataTableFrame>[\s\S]*?<Table/,
    );
    // A wrapping <div> that opens, immediately contains the history header,
    // and later contains <Table is the old nested card. Siblings fail this.
    expect(src).not.toMatch(
      /<div[^>]*>\s*(?:<div[^>]*>\s*)?<PageSectionHeader\s+title=\{t\("ekasa\.page\.closures\.history"[\s\S]*?<Table/,
    );
  });

  it("uses filterControlClass on the accountant month and year selects", () => {
    const src = source();
    expect(src).toContain("filterControlClass");
    expect(src).not.toContain(
      "h-9 rounded-md border border-input bg-background px-3 text-sm",
    );
    expect(src).toMatch(
      /<select[\s\S]*?className=\{filterControlClass\}[\s\S]*?aria-label=\{t\("ekasa\.page\.accountant\.month"/,
    );
    expect(src).toMatch(
      /<select[\s\S]*?className=\{filterControlClass\}[\s\S]*?aria-label=\{t\("ekasa\.page\.accountant\.year"/,
    );
    expect(src).toContain("[2025, 2026, 2027]");
    expect(src).toContain("MONTH_KEYS");
    expect(src).toContain("MONTH_FALLBACKS");
  });

  it("does not add a text search wired to getReceipts", () => {
    const src = source();
    expect(src).not.toContain("SearchField");
    expect(src).toContain(
      "trpc.extensions.ekasa.getReceipts.useQuery({\n    limit: PAGE_SIZE,\n    offset,\n    status: statusFilter,\n  })",
    );
  });
});
