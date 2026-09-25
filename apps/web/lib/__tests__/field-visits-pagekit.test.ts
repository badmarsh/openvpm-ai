/**
 * Field Visits — UI Kit Harmonization (Arena Sprint 14)
 * -----------------------------------------------------
 * Pins the /field-visits page to the dashboard UI kit (docs/UIKIT.md):
 * pageShellClass, PageToolbar + SearchField, DataTableFrame, underline tabs,
 * EmptyState — plus the ambulatory hardening fixes:
 *   1. neutral-gray rendering of expired withdrawal rows (no active-warning red),
 *   2. per-row withdrawal status (no duplicated badges across records),
 *   3. non-clipping action column (DataTableFrame horizontal scroll + nowrap),
 *   4. CEHZ ear-tag paste guard,
 *   5. immediate persistent controlled-substance banner (Zákon 139/1998 Z. z.).
 *
 * The statutory literals stay pinned in field-visits-ui.test.ts — this file
 * only guards the UI kit adoption and the field-workflow hardening.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("app/(dashboard)/field-visits/page.tsx", "utf8");
const pageKitSource = readFileSync("components/layout/page-kit.tsx", "utf8");
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

function leafKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const kp = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      for (const sub of leafKeys(v as Record<string, unknown>, kp)) out.add(sub);
    } else {
      out.add(kp);
    }
  }
  return out;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("field visits adopts the dashboard UI kit shell", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    expect(pageSource).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(pageSource).toContain(token);
    }
  });

  it("wraps the page body in pageShellClass (no hardcoded space-y-6 root)", () => {
    expect(pageKitSource).toContain('export const pageShellClass = "space-y-6"');
    expect(pageSource).toContain("<div className={pageShellClass}>");
    expect(pageSource).not.toContain('<div className="space-y-6">');
  });

  it("wraps the CEHZ search bar in PageToolbar + SearchField", () => {
    expect(countOccurrences(pageSource, "<PageToolbar")).toBeGreaterThanOrEqual(1);
    expect(pageSource).toContain("<SearchField");
    // Kanonický i18n titulok vyhľadávania zostáva v toolbaru.
    const toolbarIdx = pageSource.indexOf("<PageToolbar");
    const titleIdx = pageSource.indexOf('t("fieldVisits.earTagSearch.title"');
    expect(titleIdx).toBeGreaterThan(toolbarIdx);
    // SearchField drží 44px dotykový cieľ pre rukavice v maštali.
    expect(pageSource).toContain('inputClassName="min-h-[44px] font-mono text-sm"');
  });

  it("wraps every data table in DataTableFrame (cattle, visits log, stock, withdrawal watch)", () => {
    expect(countOccurrences(pageSource, "<DataTableFrame>")).toBeGreaterThanOrEqual(4);
    // Žiadne holé overflow-x-auto wrappery mimo kitu.
    expect(pageSource).not.toContain('className="overflow-x-auto rounded-md border"');
  });

  it("uses underline tabs tokens instead of hand-rolled tab chrome", () => {
    expect(pageSource).toContain("cn(underlineTabsListClass");
    expect(countOccurrences(pageSource, "cn(underlineTabsTriggerClass")).toBe(4);
    expect(pageSource).not.toContain("grid h-auto w-full max-w-2xl grid-cols-4 rounded-none border-b");
  });

  it("renders EmptyState for empty visits, stock and withdrawal lists", () => {
    expect(countOccurrences(pageSource, "<EmptyState")).toBeGreaterThanOrEqual(3);
  });
});

describe("field visits keeps ambulatory craft pins", () => {
  it("keeps 44px touch targets on primary field buttons", () => {
    expect(countOccurrences(pageSource, "min-h-[44px]")).toBeGreaterThanOrEqual(5);
  });

  it("keeps dense table cells (py-2.5 px-3) and tabular numerals", () => {
    expect(countOccurrences(pageSource, "py-2.5 px-3")).toBeGreaterThanOrEqual(10);
    expect(pageSource).toContain("tabular-nums");
  });

  it("keeps the withdrawal-watch testid and the canonical page header", () => {
    expect(pageSource).toContain('data-testid="withdrawal-watch"');
    expect(pageSource).toContain('t("fieldVisits.title", "Terénna prax & Farmy")');
    expect(pageSource).toContain("PageHeader");
  });
});

describe("field visits hardening fixes", () => {
  it("renders expired withdrawal rows in neutral gray, clamped to 0 days", () => {
    // Status sa počíta per riadok (žiadne duplicitné badgety z iných podaní kravy).
    expect(pageSource).toContain("withdrawalWatchRows.map(({ row: w, status })");
    expect(pageSource).not.toContain("withdrawalStatusesForCow(w.patientId)");
    // Vypršaný kanál/stav → neutrálny chip, nie červené aktívne varovanie.
    expect(pageSource).toContain('"fieldVisits.withdrawalWatch.expiredChip"');
    expect(pageSource).toContain('"fieldVisits.withdrawalWatch.expiredNote"');
    // Aktívny stav si zachováva zákonné červené varovanie.
    expect(pageSource).toContain('"fieldVisits.withdrawalWatch.activeWarning"');
  });

  it("guards CEHZ ear-tag inputs against illegal pasted characters", () => {
    expect(pageSource).toContain("function sanitizeEarTagInput");
    // Paste guard je pripojený na vyhľadávanie aj dialóg novej kravy.
    expect(countOccurrences(pageSource, "sanitizeEarTagInput(")).toBeGreaterThanOrEqual(3);
    expect(pageSource).toContain("setEarTagQuery(sanitizeEarTagInput(v))");
    expect(pageSource).toContain("setNewCowEarTag(sanitizeEarTagInput(e.target.value))");
  });

  it("shows an immediate persistent controlled-substance banner (Zákon 139/1998)", () => {
    expect(pageSource).toContain('data-testid="controlled-substance-warning"');
    expect(pageSource).toContain('"fieldVisits.form.controlledBanner"');
    // Blokovanie zostáva: konflikt nikdy nezapíše product do formulára.
    expect(pageSource).toContain("setControlledConflict(conflict);");
    expect(pageSource).toContain("role=\"alert\"");
  });

  it("keeps the cattle-table action column unclipped via scroll + nowrap", () => {
    expect(pageSource).toContain('t("fieldVisits.farms.colActions", "Akcie")');
    expect(pageSource).toContain('t("fieldVisits.farms.rowNewVisit", "Výjazd")');
    expect(pageSource).toContain("min-w-[620px]");
    expect(pageSource).toContain("whitespace-nowrap");
  });
});

describe("field visits stays 100% bilingual for the new kit keys", () => {
  it("keeps full fieldVisits leaf symmetry between sk.json and en.json", () => {
    const skKeys = leafKeys(sk.fieldVisits, "fieldVisits");
    const enKeys = leafKeys(en.fieldVisits, "fieldVisits");
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
    expect(skKeys.size).toBeGreaterThanOrEqual(180);
  });

  it("defines every new UI kit key in both languages", () => {
    const newKeys = [
      "fieldVisits.withdrawalWatch.colAnimal",
      "fieldVisits.withdrawalWatch.colFarm",
      "fieldVisits.withdrawalWatch.colAdministered",
      "fieldVisits.withdrawalWatch.colMilk",
      "fieldVisits.withdrawalWatch.colMeat",
      "fieldVisits.withdrawalWatch.colStatus",
      "fieldVisits.withdrawalWatch.activeChip",
      "fieldVisits.withdrawalWatch.expiredChip",
      "fieldVisits.withdrawalWatch.expiredNote",
      "fieldVisits.visits.emptyTitle",
      "fieldVisits.visits.colDate",
      "fieldVisits.visits.colFarm",
      "fieldVisits.visits.colAnimal",
      "fieldVisits.visits.colNotes",
      "fieldVisits.visits.colEvidence",
      "fieldVisits.farms.colActions",
      "fieldVisits.farms.rowNewVisit",
      "fieldVisits.stock.emptyTitle",
      "fieldVisits.stock.emptyDesc",
      "fieldVisits.form.controlledBanner",
    ];
    for (const key of newKeys) {
      const seg = key.split(".");
      expect(sk.fieldVisits[seg[1]][seg[2]]).toBeDefined();
      expect(en.fieldVisits[seg[1]][seg[2]]).toBeDefined();
    }
  });

  it("leaves the UI kit source untouched (tokens still exported)", () => {
    expect(pageKitSource).toContain("export function DataTableFrame");
    expect(pageKitSource).toContain("export function PageToolbar");
    expect(pageKitSource).toContain("export function SearchField");
    expect(pageKitSource).toContain("export const underlineTabsListClass");
    expect(pageKitSource).toContain("export const underlineTabsTriggerClass");
  });
});
