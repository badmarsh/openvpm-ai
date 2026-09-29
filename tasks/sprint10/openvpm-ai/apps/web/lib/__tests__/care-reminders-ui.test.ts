import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const page = read("app/(dashboard)/care-reminders/page.tsx");

function pageKitImports(source: string): string {
  const match = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

function firstFrameBody(source: string): string {
  const start = source.indexOf("<DataTableFrame>");
  const end = source.indexOf("</DataTableFrame>");
  if (start < 0 || end <= start) return "";
  return source.slice(start, end);
}

describe("care reminders page kit contract", () => {
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

  it("drops the per-page list-table chrome", () => {
    expect(page).not.toContain("min-w-[800px]");
    expect(page).not.toMatch(/<table[^>]*text-sm/);
    expect(page).toContain('<table className="w-full text-xs">');
  });

  it("renders loading and empty states inside the table frame", () => {
    const frameBody = firstFrameBody(page);
    expect(frameBody).not.toBe("");
    expect(frameBody).toContain("<TableSkeleton");
    expect(frameBody).toContain("<EmptyState");
    expect(page).toContain("EmptyState");
  });

  it("uses underline status tabs and page-kit table tokens", () => {
    expect(page).toContain("underlineTabsListClass");
    expect(page).toContain("underlineTabsTriggerClass");
    expect(page).toContain("tableHeadClass");
    expect(page).toContain("tableCellClass");
    expect(page).toContain("tableRowClass");
  });

  it("keeps the dismissal reason input within the 100-char server limit", () => {
    expect(page).toContain("maxLength={100}");
    expect(page).toContain("setDismissed");
  });
});
