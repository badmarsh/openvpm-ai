import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE_PATH = "app/(dashboard)/encounters/[appointmentId]/page.tsx";

function source(): string {
  return readFileSync(PAGE_PATH, "utf8");
}

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<
  string,
  unknown
>;
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8")) as Record<
  string,
  unknown
>;

function resolveLeaf(dict: Record<string, unknown>, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function pageKitImports(src: string): string {
  const match = src.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("encounter detail & SOAP editor page-kit adoption", () => {
  it("consumes the dashboard page-kit primitives and uses pageShellClass", () => {
    const src = source();
    const imports = pageKitImports(src);
    expect(src).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
    expect(src).toContain("pageShellClass");
  });

  it("renders the 5 canonical underline tabs (SOAP, Vitálne, Lieky, Prílohy, Prepustenie)", () => {
    const src = source();
    expect(src).toContain('from "@/components/ui/tabs"');
    expect(src).toContain("<Tabs");
    expect(src).toContain("className={underlineTabsListClass}");
    expect(src).toContain('data-testid="encounter-tabs-list"');

    // 5 tabs triggers and contents
    for (const tab of ["soap", "vitals", "medications", "attachments", "discharge"]) {
      expect(src).toContain(`value="${tab}"`);
      expect(src).toContain(`data-testid="tab-trigger-${tab}"`);
    }
    expect(src).toContain("underlineTabsTriggerClass");
  });
});

describe("encounter detail patient banner", () => {
  it("renders a dedicated patient banner with name, species, breed, owner, last visit, and chip", () => {
    const src = source();
    expect(src).toContain('data-testid="encounter-patient-banner"');
    expect(src).toContain('data-testid="patient-banner-name"');
    expect(src).toContain('data-testid="patient-banner-species"');
    expect(src).toContain('data-testid="patient-banner-breed"');
    expect(src).toContain('data-testid="patient-banner-owner"');
    expect(src).toContain('data-testid="patient-banner-last-visit"');
    expect(src).toContain('data-testid="patient-banner-chip"');
  });

  it("handles both microchipped and unchipped patients gracefully", () => {
    const src = source();
    expect(src).toContain("patient?.microchipNumber");
    expect(src).toContain("encounters.banner.noChip");
    expect(src).toContain("encounters.banner.chipLabel");
  });
});

describe("AI draft panel & Human-in-the-Loop clinical safety gates", () => {
  it("incorporates ClinicalDiffConfirmModal for statutory vet authorization", () => {
    const src = source();
    expect(src).toContain(
      'import { ClinicalDiffConfirmModal } from "@/components/copilot/clinical-diff-confirm-modal"',
    );
    expect(src).toContain("<ClinicalDiffConfirmModal");
    expect(src).toContain("isDiffModalOpen");
    expect(src).toContain("setIsDiffModalOpen");
  });

  it("displays advisory badge citing Zákon 39/2007 Z. z. §3", () => {
    const src = source();
    expect(src).toContain('data-testid="encounter-ai-advisory-badge"');
    expect(src).toContain("encounters.aiDraft.advisoryBadge");
    expect(src).toContain("encounters.aiDraft.statutoryNote");
    expect(src).toContain("39/2007");
  });

  it("implements draft-to-confirmed workflow with statutory state transitions", () => {
    const src = source();
    expect(src).toContain('data-testid="encounter-ai-draft-btn"');
    expect(src).toContain('data-testid="encounter-ai-draft-badge"');
    expect(src).toContain('data-testid="encounter-ai-confirmed-badge"');
    expect(src).toContain('data-testid="encounter-ai-review-diff-btn"');
    expect(src).toContain("aiDraftStatus");
    expect(src).toContain('setAiDraftStatus("confirmed")');
  });
});

describe("medication plan & controlled substances zero-prefill (Zákon 139/1998 Z. z.)", () => {
  it("imports and enforces controlled substances detection", () => {
    const src = source();
    expect(src).toContain(
      'from "@/lib/controlled-substances/policy"',
    );
    expect(src).toContain("isControlledSubstanceName");
  });

  it("displays statutory warning banner for controlled substances", () => {
    const src = source();
    expect(src).toContain('data-testid="encounter-controlled-substance-warning"');
    expect(src).toContain("encounters.medicationPlan.controlledWarningTitle");
    expect(src).toContain("encounters.medicationPlan.controlledWarningDescription");
    expect(src).toContain("139/1998");
  });

  it("renders controlled substance badge and zero-prefill enforcement in AI draft and medication list", () => {
    const src = source();
    expect(src).toContain('data-testid="controlled-substance-badge"');
    expect(src).toContain('data-testid="encounter-ai-controlled-warning"');
    expect(src).toContain("isControlledSubstance: isControlledSubstanceName(aiDraft.plan)");
  });

  it("maintains the bounded treatment plan composer and prescription linking", () => {
    const src = source();
    expect(src).toContain("<TreatmentPlanComposer");
    expect(src).toContain("tab=prescriptions&new=1");
  });
});

describe("discharge summary agent deep-link", () => {
  it("links to /agent/discharge with patient and appointment context", () => {
    const src = source();
    expect(src).toContain('data-testid="encounter-discharge-agent-link"');
    expect(src).toContain('href={`/agent/discharge?patientId=${appointment.patientId}&appointmentId=${appointmentId}`}');
    expect(src).toContain("encounters.workspace.openDischargeAgent");
  });
});

describe("encounter detail i18n leaf symmetry", () => {
  const newKeys = [
    "encounters.tabs.soap",
    "encounters.tabs.vitals",
    "encounters.tabs.medications",
    "encounters.tabs.attachments",
    "encounters.tabs.discharge",
    "encounters.banner.title",
    "encounters.banner.lastVisit",
    "encounters.banner.noChip",
    "encounters.banner.chipLabel",
    "encounters.banner.attachPatient",
    "encounters.banner.unassigned",
    "encounters.aiDraft.title",
    "encounters.aiDraft.advisoryBadge",
    "encounters.aiDraft.statutoryNote",
    "encounters.aiDraft.generateButton",
    "encounters.aiDraft.generating",
    "encounters.aiDraft.reviewDiffButton",
    "encounters.aiDraft.draftBadge",
    "encounters.aiDraft.confirmedBadge",
    "encounters.aiDraft.sourceTitle",
    "encounters.aiDraft.confirmedSuccessToast",
    "encounters.aiDraft.controlledWarning",
    "encounters.aiDraft.draftSuccess",
    "encounters.aiDraft.draftError",
    "encounters.medicationPlan.title",
    "encounters.medicationPlan.description",
    "encounters.medicationPlan.controlledWarningTitle",
    "encounters.medicationPlan.controlledWarningDescription",
    "encounters.medicationPlan.prescribeButton",
    "encounters.medicationPlan.noMedications",
    "encounters.medicationPlan.controlledBadge",
    "encounters.medicationPlan.dosage",
    "encounters.medicationPlan.frequency",
    "encounters.medicationPlan.status",
    "encounters.discharge.title",
    "encounters.discharge.agentLink",
    "encounters.discharge.agentDesc",
    "encounters.workspace.openDischargeAgent",
  ];

  it.each(newKeys)("%s exists in both en.json and sk.json", (key) => {
    const enVal = resolveLeaf(en, key);
    const skVal = resolveLeaf(sk, key);
    expect(typeof enVal, `missing in en.json: ${key}`).toBe("string");
    expect(typeof skVal, `missing in sk.json: ${key}`).toBe("string");
    expect((enVal as string).length).toBeGreaterThan(0);
    expect((skVal as string).length).toBeGreaterThan(0);
  });

  it("cites Slovak veterinary legislation correctly in dictionary entries", () => {
    expect(resolveLeaf(sk, "encounters.aiDraft.advisoryBadge")).toContain("39/2007");
    expect(resolveLeaf(en, "encounters.aiDraft.advisoryBadge")).toContain("39/2007");
    expect(resolveLeaf(sk, "encounters.medicationPlan.controlledWarningTitle")).toContain("139/1998");
    expect(resolveLeaf(en, "encounters.medicationPlan.controlledWarningTitle")).toContain("139/1998");
  });
});
