import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * UI Kit harmonization guards for the statutory hub (/statutory) and the
 * KVEPIS submission hub (/statutory/kvepis).
 *
 * Source-level assertions pin the page-kit contract: pageShellClass rhythm,
 * DataTableFrame table chrome (never a raw overflow-x-auto wrapper), the
 * underline tab tokens for the register tab strip, and the PageToolbar /
 * SearchField / filterControlClass filter bar. Complements the frozen
 * PageHeader / shadcn Table pinning in statutory-ekasa-consolidation.test.ts.
 */

const STATUTORY = "app/(dashboard)/statutory/page.tsx";
const KVEPIS = "app/(dashboard)/statutory/kvepis/page.tsx";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

/** Collapses whitespace so JSX re-indentation never breaks an assertion. */
function normalized(path: string): string {
  return source(path).replace(/\s+/g, " ");
}

describe("statutory hub — UI kit harmonization", () => {
  it("wraps every register table in DataTableFrame (no raw overflow-x-auto)", () => {
    for (const path of [STATUTORY, KVEPIS]) {
      const src = source(path);
      expect(src, path).not.toContain('<div className="overflow-x-auto">');
      expect(src, path).toContain("DataTableFrame");
      expect(src, path).toContain('from "@/components/layout/page-kit"');
    }
  });

  it("keeps the dense px-3 py-2.5 table contract on both surfaces", () => {
    for (const path of [STATUTORY, KVEPIS]) {
      const src = source(path);
      expect(src, path).toContain("px-3 py-2.5");
      expect(src, path).toContain('from "@/components/ui/table"');
    }
  });

  it("uses the pageShellClass rhythm on both statutory surfaces", () => {
    for (const path of [STATUTORY, KVEPIS]) {
      const src = normalized(path);
      expect(src, path).toContain("pageShellClass");
    }
  });

  it("styles the statutory register tab strip with the underline tokens", () => {
    const src = normalized(STATUTORY);
    // The page-level 8-tab strip must be the underline list (not a pill).
    expect(src).toContain("<TabsList className={underlineTabsListClass}>");
    // One underline trigger per register tab (rabies..kvepis).
    expect((src.match(/underlineTabsTriggerClass/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("harmonizes the register filter bars with PageToolbar, SearchField and filterControlClass", () => {
    const statutory = source(STATUTORY);
    expect(statutory).toContain("PageToolbar");
    expect(statutory).toContain("SearchField");
    expect(statutory).toContain("filterControlClass");

    const kvepis = source(KVEPIS);
    expect(kvepis).toContain("PageToolbar");
    expect(kvepis).toContain("filterControlClass");
  });

  it("guards the register search queries against invalid date parameters", () => {
    const src = normalized(STATUTORY);
    expect(src).toContain("safeDateParam(");
    expect(src).not.toContain("startDate: startDate || undefined");
    expect(src).not.toContain("endDate: endDate || undefined");
  });

  it("keeps the KVEPIS status vocabulary on the submission hub", () => {
    const src = normalized(KVEPIS);
    for (const key of [
      "statutory.kvepis.statusDraft",
      "statutory.kvepis.statusValidated",
      "statutory.kvepis.statusSigned",
      "statutory.kvepis.statusSubmitted",
      "statutory.kvepis.statusAcknowledged",
      "statutory.kvepis.statusRejected",
      "statutory.kvepis.sendStateSent",
      "statutory.kvepis.sendStateAwaiting",
      "statutory.kvepis.sendStateError",
    ]) {
      expect(src, key).toContain(key);
    }
  });

  it("shows loading indicators on the KVEPIS batch actions while tRPC is in flight", () => {
    const src = normalized(KVEPIS);
    // Per-row pending state drives the spinners on validate/xml/sign/submit/receipt.
    expect(src).toContain("withPending(");
    expect((src.match(/animate-spin/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("validates the 15-digit ISO 11784 microchip display on the KVEPIS hub", () => {
    const src = normalized(KVEPIS);
    expect(src).toContain("luhnChecksumValid(");
    expect(src).toContain("statutory.kvepis.chipLuhn");
    expect(src).toContain("statutory.kvepis.chipSlovakPrefix");
  });

  it("surfaces failed KVEPIS transmissions with failure codes and retry instructions", () => {
    const src = normalized(KVEPIS);
    expect(src).toContain("statutory.kvepis.errorTitle");
    expect(src).toContain("statutory.kvepis.failureCode");
    expect(src).toContain("statutory.kvepis.retryHint");
  });
});
