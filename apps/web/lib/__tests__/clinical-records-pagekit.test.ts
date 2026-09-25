import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = "app/(dashboard)/records/page.tsx";
const PAGE_KIT = "components/layout/page-kit.tsx";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<string, unknown>;
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8")) as Record<string, unknown>;

function resolveLeaf(dict: Record<string, unknown>, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("clinical records page-kit adoption", () => {
  const src = source(PAGE);
  const kitSrc = source(PAGE_KIT);
  const imports = pageKitImports(src);

  it("imports the dashboard page-kit primitives and uses pageShellClass rhythm", () => {
    expect(src).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "filterControlClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
    expect(src).toContain("className={pageShellClass}");
    expect(kitSrc).toContain('export const pageShellClass = "space-y-6"');
  });

  it("uses PageHeader with BookOpen icon and Klinicke zaznamy title", () => {
    expect(src).toContain("icon={BookOpen}");
    expect(src).toContain('from "lucide-react"');
    // Title fallback must be Klinicke zaznamy per sprint scope
    expect(src).toContain('t("records.title"');
    expect(src).toContain("Klinicke zaznamy");
    expect(src).toContain("<PageHeader");
  });

  it("renders KpiGrid with total visits avg duration open diagnoses", () => {
    expect(src).toContain("<KpiGrid>");
    expect(src).toContain("<KpiCard");
    // Check for KPI labels
    expect(src).toContain('t("records.kpi.totalVisits"');
    expect(src).toContain('t("records.kpi.avgDuration"');
    expect(src).toContain('t("records.kpi.openDiagnoses"');
    // Ensure at least 3 KpiCards
    expect((src.match(/<KpiCard/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("wraps filter rows in PageToolbar with SearchField and species filter chip", () => {
    expect(src).toContain("<PageToolbar>");
    expect(src).toContain("<SearchField");
    expect(src).toContain("filterControlClass");
    // Species filter chip
    expect(src).toContain('t("records.speciesFilter.label"');
    expect(src).toContain('t("records.speciesFilter.all"');
    expect(src).toContain("speciesFilter");
  });

  it("uses DataTableFrame for visit list with dense table tokens", () => {
    expect(src.match(/<DataTableFrame>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(src).toContain("tableHeadClass");
    expect(src).toContain("tableCellClass");
    expect(src).toContain("tableRowClass");
    expect(src).toContain("</DataTableFrame>");
  });

  it("uses underline tabs for SOAP sections: SOAP / Zaznamy / Historia / Prilohy", () => {
    expect(src).toContain("underlineTabsListClass");
    expect(src).toContain("underlineTabsTriggerClass");
    expect(src).toContain('className={underlineTabsListClass}');
    expect(src).toContain('className={underlineTabsTriggerClass}');
    // Check for 4 tabs with Slovak labels
    for (const key of [
      "records.tabs.soap",
      "records.tabs.zaznamy",
      "records.tabs.historia",
      "records.tabs.prilohy",
    ]) {
      expect(src).toContain(key);
    }
    // Ensure fallback labels are present
    expect(src).toContain('"SOAP"');
    expect(src).toContain('"Zaznamy"');
    expect(src).toContain('"Historia"');
    expect(src).toContain('"Prilohy"');
  });

  it("preserves clinical safety: controlled-substance warning and correction controls", () => {
    // Controlled substance warning must stay
    expect(src).toContain("controlledSubstanceWarning");
    expect(src).toContain("ClinicalCorrectionControl");
    // Ensure prescription safety panel still exists
    expect(src).toContain("PrescriptionSafetyPanel");
    expect(src).toContain("checkPrescriptionSafety");
  });

  it("keeps dynamic PDF lazy loading without top-level import", () => {
    expect(src).toContain('import("@/lib/pdf")');
    expect(src).toContain("generatePrescriptionLabelPdf");
    expect(src).not.toMatch(/from ["']@\/lib\/pdf["']/);
  });

  it("never renders an empty table: EmptyState lives inside DataTableFrame", () => {
    const frameStart = src.indexOf("<DataTableFrame>");
    const frameEnd = src.indexOf("</DataTableFrame>");
    expect(frameStart).toBeGreaterThanOrEqual(0);
    expect(frameEnd).toBeGreaterThan(frameStart);
    // At least one EmptyState inside a frame
    expect(src).toContain("<EmptyState");
    expect(src).toContain("TableSkeleton");
  });
});

describe("clinical records i18n leaf symmetry for new keys", () => {
  const newKeys = [
    "records.kpi.totalVisits",
    "records.kpi.avgDuration",
    "records.kpi.openDiagnoses",
    "records.kpi.totalPatients",
    "records.tabs.soap",
    "records.tabs.zaznamy",
    "records.tabs.historia",
    "records.tabs.prilohy",
    "records.speciesFilter.label",
    "records.speciesFilter.all",
    "records.selectedPatient",
    "soap.tabs.soap",
    "soap.tabs.zaznamy",
    "soap.tabs.historia",
    "soap.tabs.prilohy",
    "soap.kpi.totalVisits",
    "soap.kpi.avgDuration",
    "soap.kpi.openDiagnoses",
    "soap.kpi.totalPatients",
  ];

  it.each(newKeys)("%s exists in both en.json and sk.json", (key) => {
    const enValue = resolveLeaf(en, key);
    const skValue = resolveLeaf(sk, key);
    expect(typeof enValue, `missing in en.json: ${key}`).toBe("string");
    expect(typeof skValue, `missing in sk.json: ${key}`).toBe("string");
    expect((enValue as string).length).toBeGreaterThan(0);
    expect((skValue as string).length).toBeGreaterThan(0);
  });

  it("keeps full records leaf symmetry between sk.json and en.json", () => {
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
    const skKeys = leafKeys((sk as any).records, "records");
    const enKeys = leafKeys((en as any).records, "records");
    expect([...skKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !skKeys.has(k))).toEqual([]);
  });
});
