/**
 * Practice Settings Master Hub — UI Kit harmonization (Arena Sprint 21)
 * ---------------------------------------------------------------------
 * Pins `/settings` (the master hub) to the dashboard UI kit (docs/UIKIT.md):
 *   pageShellClass, PageHeader icon=Settings title=Nastavenia, underline tab
 *   strip (underlineTabsListClass / underlineTabsTriggerClass), one
 *   DataTableFrame + dense table tokens per list panel, shared
 *   SettingsPanelHeader cards, and the i18n sweep across the settings
 *   namespace in both dictionaries.
 *
 * The functional contract (access gating, per-tab error surfaces, billing
 * redirect safety, backup/import flows) stays pinned in
 * `settings-ui-states.test.ts`; this file only guards the kit adoption,
 * the scanner-clean i18n state and the lazy-chunk posture.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("app/(dashboard)/settings/page.tsx", "utf8");
const pageKitSource = readFileSync("components/layout/page-kit.tsx", "utf8");
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

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

describe("settings master hub adopts the dashboard UI kit shell", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    expect(pageSource).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "PageHeader",
      "DataTableFrame",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(pageSource).toContain(token);
    }
  });

  it("wraps the page body in pageShellClass (no ad-hoc overflow wrapper)", () => {
    expect(pageKitSource).toContain('export const pageShellClass = "space-y-6"');
    expect(pageSource).toContain("<div className={pageShellClass}>");
    expect(pageSource).not.toContain(
      '<div className="min-w-0 w-full max-w-full space-y-6 overflow-hidden">',
    );
  });

  it("keeps the canonical PageHeader with the Settings icon and page title", () => {
    expect(pageSource).toContain("<PageHeader");
    expect(pageSource).toContain("icon={Settings}");
    expect(pageSource).toContain('t("settings.header.title", "Nastavenia")');
    expect(pageSource).toContain('"settings.header.subtitle"');
    // Guides entry point offered by the welcome tour stays reachable.
    expect(pageSource).toContain('data-tour="settings-guides"');
  });

  it("renders the section nav as underline tabs instead of a button sidebar", () => {
    expect(pageSource).toContain("<Tabs");
    expect(pageSource).toContain("cn(\n              underlineTabsListClass,");
    expect(pageSource).toContain("className={underlineTabsTriggerClass}");
    expect(pageSource).toContain("<TabsTrigger");
    // Retired hand-rolled nav chrome.
    expect(pageSource).not.toContain("lg:flex-col");
    expect(pageSource).not.toContain("custom-scrollbar -mb-px flex");
    expect(pageSource).not.toContain(
      '"bg-primary text-primary-foreground shadow-xs font-semibold"',
    );
    // Tab bodies stay conditionally mounted (one panel at a time).
    expect(pageSource).toContain("{activeTab === \"practice\" && <PracticeInfoTab />}");
  });
});

describe("settings master hub uses one DataTableFrame per settings panel", () => {
  it("frames all seven list panels and closes every frame", () => {
    expect(countOccurrences(pageSource, "<DataTableFrame>")).toBe(7);
    expect(countOccurrences(pageSource, "</DataTableFrame>")).toBe(7);
    expect(pageSource).not.toContain(
      'className="overflow-x-auto rounded-lg border border-border"',
    );
    expect(pageSource).not.toContain('<table className="w-full text-sm">');
  });

  it("renders dense tables through the shared table tokens", () => {
    expect(pageKitSource).toContain('"h-9 px-3 py-2 text-left align-middle text-[11px]');
    expect(countOccurrences(pageSource, "tableHeadClass")).toBeGreaterThanOrEqual(33);
    expect(countOccurrences(pageSource, "tableCellClass")).toBeGreaterThanOrEqual(40);
    expect(countOccurrences(pageSource, "tableRowClass")).toBeGreaterThanOrEqual(6);
    // No leftover px-4/py-3 list-table cells or text-sm tables.
    expect(pageSource).not.toContain('<td className="px-4');
    expect(pageSource).not.toContain('<th className="px-4');
    expect(pageSource).toContain('className="w-full min-w-[880px] text-xs"');
  });

  it("keeps whole-row navigation on the template list and empty states inside frames", () => {
    expect(pageSource).toContain(
      'className={cn(tableRowClass, "cursor-pointer")}',
    );
    expect(countOccurrences(pageSource, '<td colSpan={')).toBeGreaterThanOrEqual(7);
    expect(countOccurrences(pageSource, "<EmptyState")).toBeGreaterThanOrEqual(7);
    expect(pageSource).toContain(
      'import { EmptyState } from "@/components/common/empty-state"',
    );
  });

  it("gives every list panel the shared SettingsPanelHeader card", () => {
    expect(countOccurrences(pageSource, "<SettingsPanelHeader")).toBe(6);
    expect(pageSource).toContain('t("settings.locations.title"');
    expect(pageSource).toContain('t("settings.staff.title"');
    expect(pageSource).toContain('t("settings.appointmentTypes.title"');
    expect(pageSource).toContain('t("settings.rooms.title"');
    expect(pageSource).toContain('t("settings.wellness.scheduledBilling"');
    expect(pageSource).toContain('t("settings.templates.title"');
  });

  it("leaves the credential and upload flows on their managed-upload path", () => {
    expect(pageSource).toContain('body.append("category", "branding")');
    expect(pageSource).toContain("selectManagedUploadFile(");
    expect(pageSource).toContain("settleManagedUploadAttempt(");
    expect(pageSource).toContain('accept="image/png,image/jpeg,image/webp"');
    // Logo input stays accessible without hardcoded copy.
    expect(pageSource).not.toContain('alt="Practice logo"');
    expect(pageSource).toContain('t("settings.branding.logoAlt", "Practice logo")');
  });
});

describe("settings master hub stays scanner-clean and lazily chunked", () => {
  it("has no raw hardcoded copy left in the settings page", () => {
    // i18n:scan findings that used to live here (Arena Sprint 21 sweep).
    expect(pageSource).not.toContain('title="Practice settings unavailable"');
    expect(pageSource).not.toContain('placeholder="owner@example.com"');
    expect(pageSource).not.toContain('placeholder="Qty"');
    expect(pageSource).not.toContain('alt="Practice logo"');
    for (const raw of [
      'toast.success("Location retired")',
      'toast.success("Staff member added")',
      'toast.success("Staff member deactivated")',
      'toast.success("Invite sent")',
      'toast.error("Backup has invalid restore data")',
      'toast.success("Backup verified")',
      'toast.success("Vaccination CSV checked")',
      'toast.success("Account deletion request sent")',
      'toast.success("Sample data removed")',
      'toast.success("Sample data added")',
      'toast.success("Room deleted")',
      '? "Wellness plan reactivated"',
      ': "Wellness plan deactivated"',
      'location.phone || "No phone"',
      '?.name ?? "Unassigned"',
      "Check again\n",
      "Expected columns:{\" \"}",
      "Selected file:{\" \"}",
    ]) {
      expect(pageSource, `raw copy still present: ${raw}`).not.toContain(raw);
    }
  });

  it("keeps every settings tab bundle lazily imported (next/dynamic)", () => {
    expect(pageSource).toContain('from "next/dynamic"');
    expect(countOccurrences(pageSource, "dynamic(")).toBe(9);
    // No top-level heavy PDF/table/chart import may creep into the hub.
    expect(pageSource).not.toMatch(/from\s+["']@\/lib\/pdf["']/);
    expect(pageSource).not.toMatch(/from\s+["']jspdf["']/);
    expect(pageSource).not.toMatch(/from\s+["']pdf-parse["']/);
    expect(pageSource).not.toMatch(/from\s+["']recharts["']/);
  });

  it("keeps the settings page free of explicit any", () => {
    expect(pageSource).not.toMatch(/:\s*any\b/);
    expect(pageSource).not.toMatch(/as any\b/);
  });
});

describe("settings master hub stays 100% bilingual for the kit keys", () => {
  it("keeps full settings leaf symmetry between sk.json and en.json", () => {
    const skKeys = leafKeys(sk.settings, "settings");
    const enKeys = leafKeys(en.settings, "settings");
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
    expect(skKeys.size).toBeGreaterThanOrEqual(760);
  });

  it("defines every key added by the settings UI kit sweep in both languages", () => {
    const newKeys = [
      "settings.branding.logoAlt",
      "settings.locations.retired",
      "settings.locations.noPhone",
      "settings.locations.primaryBadge",
      "settings.staff.title",
      "settings.staff.description",
      "settings.staff.memberAdded",
      "settings.staff.memberDeactivated",
      "settings.staff.inviteSent",
      "settings.staff.inviteDescription",
      "settings.staff.inviteLinkHint",
      "settings.staff.providerLabel",
      "settings.appointmentTypes.title",
      "settings.appointmentTypes.description",
      "settings.rooms.title",
      "settings.rooms.description",
      "settings.rooms.unassigned",
      "settings.rooms.deleted",
      "settings.wellness.reactivated",
      "settings.wellness.deactivated",
      "settings.templates.title",
      "settings.templates.description",
      "settings.templates.itemQuantityPlaceholder",
      "settings.templates.categories.surgery",
      "settings.templates.categories.wellness",
      "settings.templates.categories.dental",
      "settings.templates.categories.preventive",
      "settings.templates.categories.emergency",
      "settings.templates.categories.other",
      "settings.data.checkAgain",
      "settings.data.expectedColumns",
      "settings.data.selectedFile",
      "settings.data.deletionContactEmailPlaceholder",
      "settings.data.backupInvalidRestoreData",
      "settings.data.backupVerified",
      "settings.data.vaccinationCsvChecked",
      "settings.data.deletionRequestSent",
      "settings.data.sampleDataRemoved",
      "settings.data.sampleDataAdded",
      "settings.billing.checkoutCanceledDetail",
      "settings.billing.continueToCheckout",
      "settings.billing.pastDueNotice",
    ];
    for (const key of newKeys) {
      const segments = key.split(".").slice(1);
      const resolve = (dict: Record<string, unknown>) =>
        segments.reduce<unknown>(
          (node, segment) =>
            node && typeof node === "object"
              ? (node as Record<string, unknown>)[segment]
              : undefined,
          dict,
        );
      expect(resolve(sk.settings), `missing sk: ${key}`).toEqual(
        expect.any(String),
      );
      expect(resolve(en.settings), `missing en: ${key}`).toEqual(
        expect.any(String),
      );
    }
  });

  it("keeps the localized replacements wired into the page", () => {
    for (const key of [
      "settings.locations.retired",
      "settings.staff.memberAdded",
      "settings.staff.memberDeactivated",
      "settings.staff.inviteSent",
      "settings.staff.providerLabel",
      "settings.rooms.unassigned",
      "settings.rooms.deleted",
      "settings.wellness.reactivated",
      "settings.wellness.deactivated",
      "settings.templates.itemQuantityPlaceholder",
      "settings.data.checkAgain",
      "settings.data.backupVerified",
      "settings.data.restoredRows",
      "settings.billing.continueToCheckout",
    ]) {
      expect(pageSource, `page does not use ${key}`).toContain(`"${key}"`);
    }
  });
});
