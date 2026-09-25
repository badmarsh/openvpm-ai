/**
 * Appointment Scheduler & Calendar — UI Kit Harmonization (Arena Sprint 23)
 * -----------------------------------------------------------------------
 * Pins the /schedule page to the dashboard UI kit (docs/UIKIT.md):
 *   1. pageShellClass layout rhythm (no bare unstyled root div),
 *   2. PageHeader with CalendarDays icon and canonical title "Rozvrh",
 *   3. Underline tabs for the 4 views (Deň, Týždeň, Mesiac, Zoznam),
 *   4. PageToolbar with date navigator, date-range picker, and provider filter,
 *   5. DataTableFrame agenda/list view with appointment status badges and whole-row clicks,
 *   6. 100% leaf symmetry and complete bilingual coverage for schedule namespace.
 *
 * Clinical safety, recurrence rules, and SMS trigger independence stay pinned
 * by schedule-ui.test.ts and related domain suites.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("app/(dashboard)/schedule/page.tsx", "utf8");
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

describe("schedule page adopts the dashboard UI kit shell", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    expect(pageSource).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "DataTableFrame",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(pageSource).toContain(token);
    }
  });

  it("wraps the page body in pageShellClass (no bare unstyled root)", () => {
    expect(pageKitSource).toContain('export const pageShellClass = "space-y-6"');
    expect(pageSource).toContain("<div className={pageShellClass}>");
  });

  it("renders PageHeader with CalendarDays icon and Rozvrh title", () => {
    expect(pageSource).toContain("icon={CalendarDays}");
    expect(pageSource).toContain('t("schedule.title", "Rozvrh")');
    expect(pageSource).toContain("<PageHeader");
  });

  it("uses underline tabs tokens for Day / Week / Month / List views", () => {
    expect(pageSource).toContain("underlineTabsListClass");
    expect(pageSource).toContain("underlineTabsTriggerClass");
    expect(pageSource).toContain('"day"');
    expect(pageSource).toContain('"week"');
    expect(pageSource).toContain('"month"');
    expect(pageSource).toContain('"list"');
    expect(pageSource).toContain('t("schedule.viewDay"');
    expect(pageSource).toContain('t("schedule.viewWeek"');
    expect(pageSource).toContain('t("schedule.viewMonth"');
    expect(pageSource).toContain('t("schedule.viewList"');
  });

  it("harmonizes the filter bar in PageToolbar with date navigator and provider filter", () => {
    expect(countOccurrences(pageSource, "<PageToolbar>")).toBeGreaterThanOrEqual(1);
    expect(pageSource).toContain("prevRangeAria");
    expect(pageSource).toContain("nextRangeAria");
    expect(pageSource).toContain("filterDoctorAria");
    expect(pageSource).toContain("btnNewAppointment");
    expect(pageSource).toContain("</PageToolbar>");
  });

  it("wraps the agenda/list view in DataTableFrame with appointment status badges", () => {
    expect(pageSource).toContain("<DataTableFrame>");
    expect(pageSource).toContain("AppointmentStatusBadge");
    expect(pageSource).toContain("tableHeadClass");
    expect(pageSource).toContain("tableCellClass");
    expect(pageSource).toContain("tableRowClass");
    expect(pageSource).toContain('className={cn(tableRowClass, "cursor-pointer")}');
    expect(pageSource).toContain("stopPropagation");
  });

  it("preserves data-tour spotlight anchors and phone agenda contract", () => {
    expect(pageSource).toContain('data-tour="schedule-calendar"');
    expect(pageSource).toContain("PhoneAgenda");
  });
});

describe("schedule namespace stays 100% bilingual with complete leaf symmetry", () => {
  it("keeps full schedule leaf symmetry between sk.json and en.json", () => {
    const skKeys = leafKeys(sk.schedule, "schedule");
    const enKeys = leafKeys(en.schedule, "schedule");
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
    expect(skKeys.size).toBeGreaterThanOrEqual(150);
  });

  it("defines every new UI kit key in both languages", () => {
    const newKeys = [
      "viewList",
      "rangeStart",
      "rangeEnd",
      "filterDoctorAria",
      "noAppointmentsListTitle",
      "noAppointmentsListDesc",
      "listColTime",
      "listColPatient",
      "listColClient",
      "listColType",
      "listColDoctor",
      "listColLocation",
      "listColStatus",
      "listColActions",
    ];
    for (const key of newKeys) {
      expect(sk.schedule[key], `sk.schedule.${key} must be defined`).toBeDefined();
      expect(en.schedule[key], `en.schedule.${key} must be defined`).toBeDefined();
    }
  });

  it("preserves canonical Slovak translations for views and title", () => {
    expect(sk.schedule.title).toBe("Rozvrh");
    expect(sk.schedule.viewDay).toBe("Deň");
    expect(sk.schedule.viewWeek).toBe("Týždeň");
    expect(sk.schedule.viewMonth).toBe("Mesiac");
    expect(sk.schedule.viewList).toBe("Zoznam");
  });
});
