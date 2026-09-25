import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sprint 11 source contracts for the reports and wellness pages: UI Kit
 * (page-kit) adoption, presentation-only NaN guards, i18n coverage, and the
 * heavy-client / export contracts that the page-kit refactor must not break.
 */

const WEB_ROOT = path.join(__dirname, "../..");
const REPORTS_PAGE = "app/(dashboard)/reports/page.tsx";
const WELLNESS_PAGE = "app/(dashboard)/wellness/page.tsx";
const PAGE_KIT = "@/components/layout/page-kit";

type Dict = Record<string, unknown>;

function read(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), "utf8");
}

/** Value bindings of every `import { … } from "<moduleName>"` (type-only specifiers skipped). */
function namedImports(source: string, moduleName: string): Set<string> {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const importRe = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["']`,
    "g"
  );
  const names = new Set<string>();
  for (const match of source.matchAll(importRe)) {
    for (const specifier of match[1].split(",")) {
      const trimmed = specifier.trim();
      if (!trimmed || trimmed.startsWith("type ")) continue;
      names.add(trimmed.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

/** Every literal key passed as the first argument of `t("…")`. */
function translationKeys(source: string): string[] {
  return [
    ...new Set(
      [...source.matchAll(/\bt\(\s*["']([A-Za-z0-9_.]+)["']/g)].map(
        (match) => match[1]
      )
    ),
  ];
}

function resolveKey(dict: Dict, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Dict)[part]
          : undefined,
      dict
    );
}

function leafKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Dict)
    .flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const reports = read(REPORTS_PAGE);
const wellness = read(WELLNESS_PAGE);
const en = JSON.parse(read("messages/en.json")) as Dict;
const sk = JSON.parse(read("messages/sk.json")) as Dict;

describe("reports page — page-kit harmonization", () => {
  const kit = namedImports(reports, PAGE_KIT);

  it("imports KpiGrid, pageShellClass and underlineTabsListClass from page-kit", () => {
    for (const name of [
      "KpiGrid",
      "KpiCard",
      "pageShellClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "DataTableFrame",
      "PageToolbar",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(kit.has(name), `${name} must be imported from ${PAGE_KIT}`).toBe(true);
    }
  });

  it("drops the hand-rolled KpiCard, pill tabs and ad-hoc spacing", () => {
    expect(reports).not.toMatch(/function KpiCard\b/);
    expect(reports).toContain("<div className={pageShellClass}>");
    expect(reports).toContain("className={cn(underlineTabsListClass");
    expect(reports).toContain("className={underlineTabsTriggerClass}");
    expect(reports).not.toContain('className="w-full flex"');
    expect(reports).not.toContain('className="mt-6"');
    expect(reports).not.toContain('"mt-4 rounded-lg');
    // Raw palettes were replaced by semantic tokens (primary / warning / destructive).
    expect(reports).not.toMatch(/\b(?:bg|text|border)-(?:teal|amber|red|orange)-\d/);
  });

  it("labels every report tab through t() with Slovak fallbacks", () => {
    expect(reports).toContain('t("reports.tabs.revenue", "Tržby")');
    expect(reports).toContain('t("reports.tabs.appointments", "Objednávky")');
    expect(reports).toContain('t("reports.tabs.services", "Výkony")');
    expect(reports).toContain('t("reports.tabs.inventory", "Sklad")');
    expect(reports).not.toMatch(/label: "(?:Revenue|Appointments|Services|Inventory)"/);
    // Labels stay visible (and accessible) on narrow screens.
    expect(reports).not.toContain("hidden sm:inline");
  });

  it("renders tabular report data inside DataTableFrame with kit table tokens", () => {
    // Doctor breakdown, service details and the shared inventory alert section.
    expect(countOccurrences(reports, "<DataTableFrame>")).toBeGreaterThanOrEqual(3);
    expect(reports).not.toContain('<div className="overflow-x-auto">');
    expect(reports).not.toContain('className="pb-2 font-medium');
  });

  it("guards displayed ratios so 0-invoice / 0-appointment periods never show NaN", () => {
    expect(reports).toMatch(/whole <= 0\)\s*\{\s*return 0;\s*\}/);
    expect(reports).toContain("percentOf(doc.completed, doc.total)");
    expect(reports).toContain("clampPercent(data.fillRate)");
    expect(reports).toContain("Number.isFinite(rawDiff)");
    expect(reports).toContain('if (!Number.isFinite(value)) return "—";');
    // The router zero-fills the daily series, so emptiness is "no non-zero day".
    expect(reports).toContain("hasRevenueActivity ? (");
    expect(reports).not.toContain("data.daily.length > 0 ?");
  });

  it("formats on-screen money through useCurrencyFormatter only", () => {
    expect(reports).toContain("const formatAmount = useCurrencyFormatter()");
    expect(reports).not.toContain("toFixed(2)");
    expect(reports).not.toContain("€");
  });

  it("localizes date-range validation instead of echoing raw English", () => {
    expect(reports).toContain("localizeReportMessage(dateRangeInputError, t)");
    expect(reports).toContain("localizeReportMessage(message, t)");
    expect(reports).toContain("`Report date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`");
  });
});

describe("wellness page — page-kit harmonization", () => {
  const kit = namedImports(wellness, PAGE_KIT);

  it("imports pageShellClass, PageToolbar, filterControlClass and DataTableFrame from page-kit", () => {
    for (const name of [
      "pageShellClass",
      "DataTableFrame",
      "PageToolbar",
      "filterControlClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(kit.has(name), `${name} must be imported from ${PAGE_KIT}`).toBe(true);
    }
  });

  it("uses the kit shell, toolbar and table frames instead of ad-hoc markup", () => {
    expect(wellness).toContain("<div className={pageShellClass}>");
    expect(wellness).not.toContain('<div className="space-y-6">');
    expect(wellness).toContain("<PageToolbar>");
    expect(wellness).toContain("className={filterControlClass}");
    // Enrollment list + benefit redemption history.
    expect(countOccurrences(wellness, "<DataTableFrame>")).toBe(2);
    expect(wellness).not.toContain("divide-y");
    expect(wellness).not.toMatch(/\b(?:bg|text)-emerald-\d/);
  });

  it("routes toasts and validation alerts through t()", () => {
    expect(wellness).not.toMatch(/toast\.(?:success|error)\(\s*["'`]/);
    expect(wellness).not.toContain('err.message || "');
    const keys = translationKeys(wellness);
    for (const key of [
      "marketing.wellness.toast.redeemSuccess",
      "marketing.wellness.toast.redeemError",
      "marketing.wellness.toast.deceasedBlocked",
      "marketing.wellness.validation.benefitRequired",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("formats dates by practice timezone / UI language instead of hardcoded sk-SK", () => {
    expect(wellness).not.toContain("toLocaleDateString(");
    expect(wellness).toContain("formatDateYmdToDisplay(en.startDate)");
    expect(wellness).toContain("formatDateTime(redemption.redeemedAt");
  });

  it("guards the active-share KPI against a practice with 0 enrolled patients", () => {
    expect(wellness).toMatch(/whole <= 0\)\s*\{\s*return null;\s*\}/);
    expect(wellness).toContain("shareOf(activeCount, enrollments.length)");
  });

  it("mirrors the redeemWellnessBenefit input limits in the form", () => {
    expect(wellness).toContain("const BENEFIT_KEY_MAX_LENGTH = 100;");
    expect(wellness).toContain("const BENEFIT_NOTES_MAX_LENGTH = 500;");
    expect(wellness).toContain("maxLength={BENEFIT_KEY_MAX_LENGTH}");
    expect(wellness).toContain("maxLength={BENEFIT_NOTES_MAX_LENGTH}");
  });

  it("invalidates the redeemed enrollment, not whichever row is selected later", () => {
    expect(wellness).toContain("onSuccess: (_redemption, variables) =>");
    expect(wellness).toContain("enrollmentId: variables.enrollmentId");
  });
});

describe("reports & wellness translations", () => {
  it.each([
    [REPORTS_PAGE, reports, "reports."],
    [WELLNESS_PAGE, wellness, "marketing.wellness."],
  ])("resolves every t() key in %s in both en.json and sk.json", (_file, source, namespace) => {
    const keys = translationKeys(source);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !key.startsWith(namespace))).toEqual([]);

    const missing = keys.flatMap((key) =>
      (
        [
          ["en", en],
          ["sk", sk],
        ] as const
      )
        .filter(([, dict]) => typeof resolveKey(dict, key) !== "string")
        .map(([lang]) => `${lang}:${key}`)
    );
    expect(missing).toEqual([]);
  });

  it("keeps the reports.* and marketing.wellness.* subtrees leaf-symmetric", () => {
    for (const root of ["reports", "marketing.wellness"]) {
      const enLeaves = leafKeys(resolveKey(en, root));
      expect(enLeaves.length).toBeGreaterThan(0);
      expect(leafKeys(resolveKey(sk, root))).toEqual(enLeaves);
    }
  });
});

describe("companion contracts (heavy-client-imports / reports-export-ui) stay intact", () => {
  it("keeps both report charts in the lazy chunk with the shared placeholder", () => {
    expect(reports).toContain('from "next/dynamic"');
    expect(countOccurrences(reports, 'import("@/components/reports/report-charts")')).toBe(2);
    expect(countOccurrences(reports, "loading: ReportChartChunkLoading")).toBe(2);
    expect(reports).toContain("function ReportChartChunkLoading()");
    expect(reports).not.toMatch(/from ["']recharts["']/);
  });

  it("keeps PDF generation lazy and the export payload literals unchanged", () => {
    expect(reports).not.toMatch(/from ["']@\/lib\/pdf["']/);
    expect(reports).toContain('import("@/lib/pdf")');
    for (const literal of [
      'title: "Revenue Report"',
      'title: "Appointments Report"',
      'title: "Services Report"',
      'title: "Inventory Alerts Report"',
      'filename: reportFilename("revenue", data.range, "pdf")',
      'filename: reportFilename("services", data.range, "pdf")',
      'filename: reportFilename("inventory", undefined, "pdf")',
      'emptyMessage: "No revenue data for this period."',
      '["section", "product", "sku", "stock", "reorder_point", "expiration_date"]',
    ]) {
      expect(reports).toContain(literal);
    }
  });

  it("keeps the pinned empty-state and tab-gating snippets verbatim", () => {
    for (const snippet of [
      'import { EmptyState } from "@/components/common/empty-state"',
      'title="No revenue data for this period"',
      'title="No doctor breakdown available"',
      'title="All stock levels OK"',
      'title="Could not load report data"',
      "hasValidDateRange && dateRange ? (\n            <AppointmentsTab dateRange={dateRange} />",
      "settingsMissingData ? (\n          <ReportMissingData onRetry={() => settingsQuery.refetch()} />",
      "onChange(reportPresetDateRange(preset, new Date(), timeZone))",
      'id="reports-date-range-error"',
    ]) {
      expect(reports).toContain(snippet);
    }
  });
});
