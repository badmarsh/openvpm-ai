import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(dashboard)/billing/page.tsx", "utf8");

function pageKitImports(source: string): string {
  const match = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("billing ledger page kit contract", () => {
  it("consumes the dashboard page kit primitives", () => {
    const imports = pageKitImports(page);
    expect(page).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "PageToolbar",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "pageShellClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "filterControlClass",
    ]) {
      expect(imports).toContain(name);
    }
    expect(page).toContain("className={pageShellClass}");
  });

  it("keeps one vertical rhythm: no local mt-4/mt-6 against the shell", () => {
    expect(page).not.toMatch(/\bmt-[46]\b/);
  });

  it("renders the AR KPIs through KpiGrid/KpiCard", () => {
    expect(page).toContain('<KpiGrid className="sm:grid-cols-3">');
    expect(page).not.toContain("font-heading text-2xl");
    expect(page.match(/<KpiCard/g)).toHaveLength(3);
    expect(page).toContain('"—"'); // error fallback
    expect(page).toContain("animate-pulse"); // loading placeholder
    expect(page).toContain('Number(arSummary.data.overdue) > 0'); // overdue guard
  });

  it("uses underline status tabs with the shared tokens", () => {
    expect(page).toContain("underlineTabsListClass");
    expect(page).toContain("underlineTabsTriggerClass");
    expect(page).toContain("t(`billing.status_${tTab.key}`, tTab.label)");
  });

  it("keeps the toolbar search-free and drives the list controls", () => {
    const start = page.indexOf("<PageToolbar>");
    const end = page.indexOf("</PageToolbar>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const body = page.slice(start, end);
    // No text search input: billing.listInvoices has no search parameter.
    expect(body).not.toContain("<Input");
    expect(body).not.toContain("SearchField");
    expect(body).not.toContain("placeholder=");
    // Result count + page size + refresh.
    expect(body).toContain("billing.page.showingPagination");
    expect(body).toContain("billing.page.pageSizeLabel");
    expect(body).toContain("filterControlClass");
    expect(body).toContain('t("common.refresh", "Refresh")');
  });

  it("frames the dense invoice table and keeps states inside the frame", () => {
    const start = page.indexOf("<DataTableFrame>");
    const end = page.indexOf("</DataTableFrame>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const frameBody = page.slice(start, end);
    expect(frameBody).toContain("<TableSkeleton");
    expect(frameBody).toContain("<EmptyState");
    expect(frameBody).toContain("data.items.map");
    expect(page).toContain('<table className="w-full text-xs">');
    expect(page).not.toMatch(/<table[^>]*text-sm/);
  });

  it("uses dense table tokens with mono numeric columns", () => {
    expect(page).toContain("tableHeadClass");
    expect(page).toContain("tableCellClass");
    expect(page).toContain("tableRowClass");
    expect(page).toContain("text-right tabular-nums font-mono");
  });

  it("uses semantic status tokens instead of raw palette colours", () => {
    expect(page).not.toMatch(
      /(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/,
    );
    expect(page).toContain("border-primary/40 bg-primary-muted");
  });

  it("never sticks headers", () => {
    expect(page).not.toContain("sticky");
    expect(page).not.toContain("top-0");
  });

  it("keeps the invoice-detail tour anchor on the expanded invoice row", () => {
    expect(page).toMatch(/<td[^>]*data-tour="invoice-detail"/);
  });

  it("keeps the list error ternary exclusive and before the empty state", () => {
    expect(page.indexOf("listError || billingListMissing")).toBeLessThan(
      page.indexOf("No invoices yet"),
    );
    expect(page).toContain("{listError || billingListMissing ? (");
    expect(page).toContain(") : isListLoading ? (");
  });

  it("unifies the side panels on the section card chrome", () => {
    expect(page).toContain(
      '<section className="rounded-lg border border-border bg-card">',
    );
    expect(page).toContain(
      '<div className="rounded-lg border border-border bg-card">',
    );
  });

  it("gives every header action the unified sm size", () => {
    const start = page.indexOf("<PageHeader");
    const end = page.indexOf("<DispenseChargeQueuePanel");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const header = page.slice(start, end);
    const buttons = header.match(/<Button[\s\S]*?<\/Button>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      expect(button).toContain('size="sm"');
    }
  });
});
