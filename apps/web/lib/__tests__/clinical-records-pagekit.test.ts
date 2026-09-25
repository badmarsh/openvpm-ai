import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Sprint 22 — Clinical Records and SOAP workspace (/records).
 *
 * Pins the dashboard UI-kit adoption of the clinical records hub: page shell,
 * underline section tabs (SOAP / Records / History / Attachments), the
 * DataTableFrame register with species filter chips, the per-patient KPI strip
 * and SK/EN i18n coverage — while guarding the clinical safety surfaces that
 * this sprint must not touch.
 */

const PAGE = "app/(dashboard)/records/page.tsx";
const MESSAGES_DIR = path.join(__dirname, "../../messages");

function source(): string {
  return readFileSync(PAGE, "utf8");
}

function loadMessages(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, name), "utf8"));
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

/** Resolve a dotted key the way lib/i18n does (root flat key, then nested). */
function resolveKey(dict: Record<string, unknown>, key: string): unknown {
  if (typeof dict[key] === "string") return dict[key];
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const NEW_KEYS = [
  "records.hub.sectionsAria",
  "records.hub.recordTypesAria",
  "records.hub.patientCount",
  "records.hub.speciesFilterAria",
  "records.hub.selectedPatientAria",
  "records.sections.soap",
  "records.sections.records",
  "records.sections.history",
  "records.sections.attachments",
  "records.kpi.totalVisits",
  "records.kpi.avgDuration",
  "records.kpi.avgDurationValue",
  "records.kpi.openDiagnoses",
  "records.history.colDate",
  "records.history.colType",
  "records.history.colRecord",
  "records.history.colAuthor",
  "records.history.colStatus",
  "records.history.open",
  "records.history.emptyTitle",
  "records.history.emptyDescription",
  "records.history.loadError",
  "records.history.current",
  "soap.vitals.temperature",
  "soap.vitals.heartRate",
  "soap.vitals.respiratoryRate",
  "soap.vitals.weight",
  "soap.vitals.bodyCondition",
];

describe("clinical records hub page-kit adoption", () => {
  it("imports the dashboard page-kit primitives", () => {
    const imports = pageKitImports(source());
    for (const name of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
    expect(source()).not.toContain('from "@/components/layout/page-header"');
    // EmptyState is the same component page-kit re-exports.
    expect(source()).toContain('import { EmptyState } from "@/components/common/empty-state"');
  });

  it("uses pageShellClass rhythm and a BookOpen PageHeader titled Clinical records", () => {
    const src = source();
    expect(src).toContain("<div className={pageShellClass}>");
    expect(src).toContain("icon={BookOpen}");
    expect(src).toContain('t("records.title", "Clinical records")');
    // No mixed sibling offsets on top-level blocks.
    expect(src).not.toMatch(/className="mt-6[" ]/);
    expect(src).not.toContain('<TabsContent value="soap" className="mt-6">');
    // Header actions follow the size="sm" contract.
    expect(src).toMatch(/actions=\{\s*<Button variant="outline" size="sm"/);
  });

  it("renders SOAP / Records / History / Attachments as underline section tabs", () => {
    const src = source();
    expect(src).toContain('type Section = "soap" | "records" | "history" | "attachments";');
    const order = ['{ id: "soap", icon: FileText }', '{ id: "records", icon: ClipboardList }', '{ id: "history", icon: History }', '{ id: "attachments", icon: Paperclip }'];
    let last = -1;
    for (const entry of order) {
      const at = src.indexOf(entry);
      expect(at, entry).toBeGreaterThan(last);
      last = at;
    }
    expect(src).toContain("className={underlineTabsListClass}");
    expect(src).toContain("cn(underlineTabsTriggerClass");
    for (const section of ["soap", "records", "history", "attachments"]) {
      expect(src).toContain(`<TabsContent value="${section}" className="mt-0">`);
      expect(src).toContain(`t("records.sections.${section}"`);
    }
    // The hand-rolled trigger chrome is gone.
    expect(src).not.toContain("relative flex min-h-11 shrink-0 items-center gap-2 rounded-none border-b-2");
  });

  it("keeps every legacy ?tab= deep link addressable inside the Records section", () => {
    const src = source();
    for (const tab of ["vaccinations", "prescriptions", "problems", "labResults", "procedures", "dental"]) {
      expect(src).toContain(`<TabsContent value="${tab}" className="mt-0">`);
    }
    expect(src).toContain('return tab === "soap" ? "soap" : "records";');
    expect(src).toContain("setActiveSection(sectionForTab(linkedTab));");
    // The inner record Tabs is driven by the role-clamped currentTab.
    expect(src).toContain("const currentTab = visibleTabs.some(");
    expect(src).toContain("value={currentTab}");
    expect(src).toContain("value={currentSection}");
    expect(src).toContain("} else if (isSection(linkedTab)) {");
    // Lab amend and SOAP hash deep links still land in the right section.
    expect(src).toMatch(/setActiveTab\("labResults"\);\s*setActiveSection\("records"\);/);
    expect(src).toMatch(/setActiveTab\("soap"\);\s*setActiveSection\("soap"\);/);
    // Encounter "new record" deep links still open the forms.
    expect(src).toContain('if (linkedTab === "prescriptions") setShowPrescriptionForm(true);');
  });

  it("preserves front-desk restrictions for tabs, sections and history", () => {
    const src = source();
    expect(src).toContain(
      'const frontDeskRestrictedTabs: Tab[] = ["soap", "prescriptions", "labResults", "procedures", "dental"];',
    );
    expect(src).toContain('const frontDeskRestrictedSections: Section[] = ["soap"];');
    expect(src).toContain("!frontDeskRestrictedTabs.includes(tab.id)");
    expect(src).toContain("!frontDeskRestrictedSections.includes(section.id)");
    // History only lists record types the role may open.
    expect(src).toContain('if (allowed.has("soap")) {');
    expect(src).toContain('if (allowed.has("labResults")) {');
  });

  it("frames every clinical table in DataTableFrame with shared table tokens", () => {
    const src = source();
    // vaccinations, prescriptions, labs, procedures, history, patient register
    expect(src.match(/<DataTableFrame>/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(src.match(/<\/DataTableFrame>/g)?.length ?? 0).toBe(
      src.match(/<DataTableFrame>/g)?.length ?? 0,
    );
    expect(src).not.toContain('<div className="overflow-x-auto rounded-lg border border-border">');
    expect(src).not.toContain(
      '<th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">',
    );
    expect(src).not.toMatch(/<td className="px-3 py-2/);
    expect(src).toContain("<th className={tableHeadClass}>");
    expect(src).toContain("<td className={tableCellClass}>");
    expect(src).toContain("className={tableRowClass}");
  });

  it("filters the patient register with species chips backed by the server query", () => {
    const src = source();
    expect(src).toContain('useState<PatientSpecies | "">("")');
    expect(src).toContain("{ limit: 25, species: speciesFilter || undefined }");
    expect(src).toContain("PATIENT_SPECIES_OPTIONS.map((option) => (");
    expect(src).toContain("aria-pressed={speciesFilter === option.value}");
    expect(src).toContain('aria-pressed={speciesFilter === ""}');
    expect(src).toContain('t("records.hub.speciesFilterAria"');
    expect(src).toContain('t("records.hub.patientCount"');
    // Whole-row click with stopPropagation on the inner action.
    expect(src).toContain("onClick={() => selectPatient(patient)}");
    expect(src).toMatch(/event\.stopPropagation\(\);\s*selectPatient\(patient\);/);
    expect(src).toContain("<PageToolbar>");
  });

  it("shows total visits, average visit duration and open diagnoses in a KpiGrid", () => {
    const src = source();
    expect(src).toContain('<KpiGrid className="sm:grid-cols-3">');
    expect(src.match(/<KpiCard/g)?.length ?? 0).toBe(3);
    for (const key of ["totalVisits", "avgDuration", "openDiagnoses"]) {
      expect(src).toContain(`t("records.kpi.${key}"`);
    }
    expect(src).toContain("trpc.appointments.listByPatient.useQuery(");
    expect(src).toContain('new Set(["cancelled", "no_show"])');
    expect(src).toContain('(problem) => problem.status !== "resolved"');
    expect(src).toContain('onClick={() => openRecordTab("problems")}');
  });

  it("lazy-loads the attachments section and keeps heavy chunks dynamic", () => {
    const src = source();
    expect(src).toContain('import("@/components/patients/sections/documents-tab")');
    expect(src).not.toMatch(/from ["']@\/components\/patients\/sections(\/documents-tab)?["']/);
    expect(src).toContain('currentSection === "attachments" ? (');
    expect(src).toContain('import("@/components/patients/patient-trend-charts")');
    expect(src).not.toMatch(/from ["']@\/lib\/pdf["']/);
  });
});

describe("clinical safety surfaces stay untouched", () => {
  it("keeps the AI-draft status heuristic, correction controls and SOAP resume flow", () => {
    const src = source();
    expect(src).toContain('? "ai_draft"');
    expect(src).toContain('note.status === "finalized"');
    expect(src).toContain("<ClinicalCorrectionControl");
    expect(src).toContain("Entered in error");
    expect(src).toContain("/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=");
    expect(src).not.toContain("ClinicalDiffConfirmModal");
  });
});

describe("clinical records i18n", () => {
  const en = loadMessages("en.json");
  const sk = loadMessages("sk.json");

  it("defines every sprint key in both SK and EN", () => {
    for (const key of NEW_KEYS) {
      const enValue = resolveKey(en, key);
      const skValue = resolveKey(sk, key);
      expect(typeof enValue, `en ${key}`).toBe("string");
      expect(typeof skValue, `sk ${key}`).toBe("string");
      expect((enValue as string).trim().length, `en ${key}`).toBeGreaterThan(0);
      expect((skValue as string).trim().length, `sk ${key}`).toBeGreaterThan(0);
    }
  });

  it("uses the Slovak clinical section vocabulary", () => {
    expect(resolveKey(sk, "records.title")).toBe("Klinické záznamy");
    expect(resolveKey(sk, "records.sections.soap")).toBe("SOAP");
    expect(resolveKey(sk, "records.sections.records")).toBe("Záznamy");
    expect(resolveKey(sk, "records.sections.history")).toBe("História");
    expect(resolveKey(sk, "records.sections.attachments")).toBe("Prílohy");
    expect(resolveKey(en, "records.title")).toBe("Clinical records");
  });

  it("resolves every records.* and soap.* key the page uses in both locales", () => {
    const src = source();
    const keys = [
      ...new Set(
        [...src.matchAll(/\bt\(\s*["'`]((?:records|soap)\.[a-zA-Z0-9_.]+)["'`]/g)].map(
          (match) => match[1]!,
        ),
      ),
    ];
    expect(keys.length).toBeGreaterThan(200);
    const missing = keys.filter(
      (key) =>
        typeof resolveKey(en, key) !== "string" ||
        typeof resolveKey(sk, key) !== "string",
    );
    expect(missing).toEqual([]);
  });

  it("has no raw vitals labels left in the SOAP vitals strip", () => {
    const src = source();
    for (const raw of ["Temp", "Heart Rate", "Resp. Rate", "Weight", "BCS Score"]) {
      expect(src).not.toContain(`font-sans font-medium">${raw}</p>`);
    }
  });
});
