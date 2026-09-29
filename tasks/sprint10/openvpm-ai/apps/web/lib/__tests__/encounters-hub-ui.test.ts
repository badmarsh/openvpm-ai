import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const page = read("app/(dashboard)/encounters/page.tsx");

function pageKitImports(source: string): string {
  const match = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("encounters hub page kit contract", () => {
  it("consumes the dashboard page kit primitives", () => {
    const imports = pageKitImports(page);
    expect(page).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "PageToolbar",
      "DataTableFrame",
      "KpiGrid",
      "pageShellClass",
    ]) {
      expect(imports).toContain(name);
    }
    expect(page).toContain("className={pageShellClass}");
  });

  it("formats times with the app locale instead of the browser default", () => {
    expect(page).not.toContain("toLocaleTimeString(");
    expect(page).toContain("formatTimeToDisplay");
  });

  it("uses semantic status tokens instead of raw palette colours", () => {
    expect(page).not.toContain("text-emerald-");
    expect(page).not.toContain("text-amber-");
    expect(page).not.toContain("bg-emerald-");
    expect(page).not.toContain("bg-amber-");
  });

  it("renders the KPI row with KpiGrid/KpiCard, not hand-built Card blocks", () => {
    expect(page).not.toContain("<Card");
    expect(page).toContain("KpiCard");
  });

  it("keeps live statuses on StatusPulseBadge and terminal ones on Badge", () => {
    expect(page).toContain("StatusPulseBadge");
    expect(page).toContain('variant="in_exam"');
    expect(page).toContain('variant="waiting"');
  });

  it("uses underline tabs and the dense page-kit table tokens", () => {
    expect(page).toContain("underlineTabsListClass");
    expect(page).toContain("underlineTabsTriggerClass");
    expect(page).toContain("tableHeadClass");
    expect(page).toContain("tableCellClass");
    expect(page).toContain("tableRowClass");
  });

  it("never renders an empty table: states live inside the frame", () => {
    const start = page.indexOf("<DataTableFrame>");
    const end = page.indexOf("</DataTableFrame>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const frameBody = page.slice(start, end);
    expect(frameBody).toContain("<TableSkeleton");
    expect(frameBody).toContain("<EmptyState");
    const emptyIdx = page.indexOf("filteredAppointments.length === 0");
    expect(emptyIdx).toBeGreaterThan(-1);
    expect(page.slice(emptyIdx, emptyIdx + 400)).toContain("<EmptyState");
  });
});
