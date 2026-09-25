/**
 * Automations Hub & CRM Journey Builder — UI Kit Harmonization (Arena Sprint 30)
 * -------------------------------------------------------------------------------
 * Pins `/automations` (the hub) to the dashboard UI kit (docs/UIKIT.md):
 *   1. pageShellClass layout rhythm (no unstyled root div),
 *   2. PageHeader with Zap icon and canonical title "Automatizácie",
 *   3. Underline tab strip (underlineTabsListClass / underlineTabsTriggerClass),
 *   4. KpiGrid: active journeys, enrolled patients, sent this week, sympathy gate,
 *   5. PageToolbar: type filter + status filter + New Journey button,
 *   6. DataTableFrame journey list with active/paused/draft badges, enrollment count,
 *      and rule builder step sequence pipeline,
 *   7. Suppression log panel: read-only DataTableFrame patient, reason, suppressed-at,
 *      and sympathy gate compliance without altering write paths,
 *   8. 100% bilingual leaf symmetry for automations namespace in both dictionaries.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = "app/(dashboard)/automations/page.tsx";

function source(): string {
  return readFileSync(PAGE, "utf8");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

const MESSAGES_DIR = path.join(__dirname, "../../messages");
const en = JSON.parse(readFileSync(path.join(MESSAGES_DIR, "en.json"), "utf8"));
const sk = JSON.parse(readFileSync(path.join(MESSAGES_DIR, "sk.json"), "utf8"));

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

describe("automations hub adopts the dashboard UI kit shell", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    const src = source();
    const imports = pageKitImports(src);
    expect(src).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "filterControlClass",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
      "EmptyState",
    ]) {
      expect(imports, `missing ${token} in page-kit import`).toContain(token);
    }
  });

  it("wraps the page body in pageShellClass (no bare unstyled root div)", () => {
    const src = source();
    expect(src).toContain("<div className={pageShellClass}>");
    expect(src).not.toContain('<div className="space-y-6">');
  });

  it("renders PageHeader with Zap icon and canonical title Automatizácie", () => {
    const src = source();
    expect(src).toContain("<PageHeader");
    expect(src).toContain("icon={Zap}");
    expect(src).toContain('t("automations.pageTitle", "Automatizácie")');
  });

  it("uses underline tabs tokens instead of hand-rolled tab chrome", () => {
    const src = source();
    expect(src).toContain("className={underlineTabsListClass}");
    expect(src).toContain("underlineTabsTriggerClass");
    expect(src).not.toContain("grid w-full grid-cols-3 max-w-xl");
    // Tab sections
    expect(src).toContain('value="journeys"');
    expect(src).toContain('value="suppression"');
    expect(src).toContain('value="clinical"');
    expect(src).toContain('value="ai-agents"');
  });
});

describe("automations hub renders KpiGrid with all 4 required operational metrics", () => {
  it("renders KpiGrid with active journeys, enrolled patients, sent this week, and sympathy gate", () => {
    const src = source();
    expect(src).toContain("<KpiGrid");
    expect(src).toContain("</KpiGrid>");
    // 4 KPI cards
    expect(src).toContain('"automations.kpi.activeJourneys"');
    expect(src).toContain('"automations.kpi.enrolledPatients"');
    expect(src).toContain('"automations.kpi.sentThisWeek"');
    expect(src).toContain('"automations.kpi.suppressedSympathy"');
    // Sympathy gate tone is destructive
    expect(src).toContain('tone="destructive"');
  });
});

describe("automations hub renders PageToolbar with search, filters and action", () => {
  it("wraps journey filters in PageToolbar with SearchField, type filter, status filter, and New Journey button", () => {
    const src = source();
    expect(countOccurrences(src, "<PageToolbar")).toBeGreaterThanOrEqual(1);
    expect(src).toContain("<SearchField");
    expect(src).toContain("filterControlClass");
    expect(src).toContain('"automations.filters.allTypes"');
    expect(src).toContain('"automations.filters.allStatuses"');
    expect(src).toContain('"automations.builder.newJourneyBtn"');
    expect(src).toContain('size="sm"');
  });
});

describe("automations hub renders DataTableFrame journey list with badges and enrollment count", () => {
  it("wraps journey list in DataTableFrame with table tokens and active/paused/draft badges", () => {
    const src = source();
    expect(countOccurrences(src, "<DataTableFrame")).toBeGreaterThanOrEqual(2);
    expect(src).toContain("tableHeadClass");
    expect(src).toContain("tableCellClass");
    expect(src).toContain("tableRowClass");
    // Badges for active, paused, draft
    expect(src).toContain('"automations.status.active"');
    expect(src).toContain('"automations.status.paused"');
    expect(src).toContain('"automations.status.draft"');
    // Tabular numerals for enrollment count and timestamps
    expect(src).toContain("tabular-nums");
    expect(src).toContain("font-mono");
    // Empty state fallback inside frame
    expect(src).toContain("<EmptyState");
  });

  it("includes rule builder sequence step editing", () => {
    const src = source();
    expect(src).toContain("AutomationJourneyStep");
    expect(src).toContain('"automations.builder.stepsTitle"');
    expect(src).toContain('"automations.builder.addStep"');
    expect(src).toContain('"automations.builder.removeStep"');
    expect(src).toContain('"automations.builder.channel"');
    expect(src).toContain('"automations.builder.delayHours"');
    expect(src).toContain('"automations.builder.legalBasis"');
  });
});

describe("automations hub renders read-only suppression log panel with sympathy gate compliance", () => {
  it("renders read-only suppression log with patient, reason, and suppressed-at timestamp", () => {
    const src = source();
    // Suppression table inside DataTableFrame
    expect(src).toContain('"automations.suppression.colPatient"');
    expect(src).toContain('"automations.suppression.colReason"');
    expect(src).toContain('"automations.suppression.colSuppressedAt"');
    expect(src).toContain('"automations.suppression.colAction"');
    expect(src).toContain('"automations.suppression.colStatus"');
    // Sympathy gate indication
    expect(src).toContain("deceased_patient");
    expect(src).toContain('"automations.suppression.reasons.deceased_patient"');
    // Read-only compliance notice
    expect(src).toContain('"automations.suppression.readOnlyNotice"');
  });

  it("preserves sympathy gate suppression write-path independence", () => {
    const src = source();
    // Does NOT write to suppression log from UI
    expect(src).not.toContain("automationSuppression.create");
    expect(src).not.toContain("automationSuppression.update");
    expect(src).not.toContain("automationSuppression.delete");
    // Does NOT alter trigger logic or write paths
    expect(src).not.toContain("automationEvents.trigger");
  });
});

describe("automations hub bilingual i18n leaf symmetry", () => {
  it("keeps 100% leaf symmetry for the automations namespace", () => {
    const enKeys = leafKeys(en.automations, "automations");
    const skKeys = leafKeys(sk.automations, "automations");
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect(enKeys.size).toBeGreaterThanOrEqual(60);
  });
});
