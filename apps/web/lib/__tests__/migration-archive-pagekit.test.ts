import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("../../app/(dashboard)/migration-archive/page.tsx", import.meta.url),
  "utf8",
);

const importV2Page = readFileSync(
  new URL("../../app/(dashboard)/settings/import-v2/page.tsx", import.meta.url),
  "utf8",
);

describe("migration archive page-kit harmonization", () => {
  it("uses pageShellClass and DataTableFrame", () => {
    expect(page).toContain("pageShellClass");
    expect(page).toContain("DataTableFrame");
    expect(page).toContain("PageToolbar");
    expect(page).toContain("SearchField");
    expect(page).toContain("underlineTabsListClass");
    expect(page).toContain("underlineTabsTriggerClass");
  });

  it("preserves all safety and accessibility contracts from migration-archive-ui.test.ts", () => {
    expect(page).toContain("Source-attributed history from a prior system");
    expect(page).toContain("do not silently create live");
    expect(page).toContain('role="tablist"');
    expect(page).toContain('role="tab"');
    expect(page).toContain("aria-selected={section === item.id}");
    expect(page).toContain("Search ${activeSection.label.toLowerCase()}");
    expect(page).toContain("Previous");
    expect(page).toContain("Next");
    expect(page).toContain("href={`/patients/${item.patientId}`}");
    expect(page).toContain("href={`/clients/${item.clientId}`}");
    expect(page).toContain("href={item.fileUrl}");
    expect(page).toContain("Open document");
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain("Needs review");
    expect(page).toContain("Never restored automatically");
    expect(page).toContain("messaging consent");
    expect(page).toContain("stock counts require a fresh");
  });

  it("wraps wide billing ledgers in DataTableFrame and prevents horizontal clipping", () => {
    // DataTableFrame internally uses TableScroll for overflow-x-auto
    expect(page).toContain("DataTableFrame");
    // Ensure dense padding and right-aligned amounts are present
    expect(page).toContain("px-3 py-2");
    expect(page).toContain("text-right");
    expect(page).toContain("tabular-nums");
  });

  it("validates external attachment URLs and keeps rel noopener noreferrer", () => {
    expect(page).toContain("isSafeExternalUrl");
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain("href={item.fileUrl}");
  });

  it("provides informative empty state guidance for zero-record sections", () => {
    expect(page).toContain("noSectionAdded");
    expect(page).toContain("emptyGuidance");
  });

  it("applies UI kit harmonization to import-v2 page and handles CSV encoding safely", () => {
    expect(importV2Page).toContain("pageShellClass");
    expect(importV2Page).toContain("DataTableFrame");
    expect(importV2Page).toContain("PageToolbar");
    expect(importV2Page).toContain("SearchField");
    expect(importV2Page).toContain("underlineTabsListClass");
    expect(importV2Page).toContain("underlineTabsTriggerClass");
    expect(importV2Page).toContain("role=\"tablist\"");
    expect(importV2Page).toContain("role=\"tab\"");
    expect(importV2Page).toContain("decodeBufferSafely");
    expect(importV2Page).toContain("windows-1250");
    expect(importV2Page).toContain("parseCsvSafely");
  });
});
