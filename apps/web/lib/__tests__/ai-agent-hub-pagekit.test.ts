import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(dashboard)/agent/page.tsx", "utf8");
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

function pageKitImports(source: string): string {
  const match = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "@\/components\/layout\/page-kit"/,
  );
  return match?.[1] ?? "";
}

describe("AI agent hub page kit contract (/agent)", () => {
  it("consumes dashboard page kit layout primitives and tokens", () => {
    const imports = pageKitImports(page);
    expect(page).toContain('from "@/components/layout/page-kit"');
    for (const name of [
      "pageShellClass",
      "PageHeader",
      "PageToolbar",
      "SearchField",
      "DataTableFrame",
      "KpiGrid",
      "KpiCard",
      "EmptyState",
      "filterControlClass",
      "underlineTabsListClass",
      "underlineTabsTriggerClass",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(imports, `missing ${name} in page-kit import`).toContain(name);
    }
    expect(page).toContain("className={pageShellClass}");
  });

  it("uses PageHeader with icon=Bot and AI BETA badge", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("icon={Bot}");
    expect(page).toContain("AI BETA");
    expect(page).not.toContain("<h1");
  });

  it("renders KpiGrid with active sessions, completed today, avg response time, and SOAP drafts pending", () => {
    const start = page.indexOf("<KpiGrid>");
    const end = page.indexOf("</KpiGrid>");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const kpiSection = page.slice(start, end);

    expect(kpiSection.match(/<KpiCard/g)?.length).toBe(4);
    expect(kpiSection).toContain("agent.kpi.activeSessions");
    expect(kpiSection).toContain("agent.kpi.completedToday");
    expect(kpiSection).toContain("agent.kpi.avgResponseTime");
    expect(kpiSection).toContain("agent.kpi.soapDraftsPending");
  });

  it("features navigation cards to Voice / Imaging / Discharge with live status indicators", () => {
    expect(page).toContain('href: "/agent/voice"');
    expect(page).toContain('href: "/agent/imaging"');
    expect(page).toContain('href: "/agent/discharge"');
    expect(page).toContain("<StatusPulseBadge");
    expect(page).toContain("agent.subagents.title");
    expect(page).toContain("agent.subagents.voiceTitle");
    expect(page).toContain("agent.subagents.imagingTitle");
    expect(page).toContain("agent.subagents.dischargeTitle");
    expect(page).toContain("agent.subagents.openAgent");
  });

  it("displays prominent advisory banner that all AI outputs require vet confirmation", () => {
    expect(page).toContain('role="alert"');
    expect(page).toContain("agent.advisory.banner");
    expect(page).toContain("39/2007");
  });

  it("frames recent AI sessions in DataTableFrame with type badge, duration, and draft/confirmed/expired status", () => {
    expect(page).toContain("<DataTableFrame>");
    expect(page).toContain("</DataTableFrame>");
    expect(page).toContain("agent.recentSessions.title");
    expect(page).toContain("agent.recentSessions.colId");
    expect(page).toContain("agent.recentSessions.colType");
    expect(page).toContain("agent.recentSessions.colDuration");
    expect(page).toContain("agent.recentSessions.colStatus");
    expect(page).toContain("agent.recentSessions.statusDraft");
    expect(page).toContain("agent.recentSessions.statusConfirmed");
    expect(page).toContain("agent.recentSessions.statusExpired");
    expect(page).toContain("tableHeadClass");
    expect(page).toContain("tableCellClass");
    expect(page).toContain("tableRowClass");
  });

  it("maintains role restriction and AgentOS session independence", () => {
    expect(page).toContain("canRunAgentRole");
    expect(page).toContain('role === "admin" || role === "veterinarian"');
    expect(page).toContain("trpc.agent.status.useQuery");
    expect(page).toContain("trpc.agent.run.useMutation");
  });
});

describe("AI agent hub i18n leaf symmetry for agent.* namespace", () => {
  const newKeys = [
    "agent.kpi.activeSessions",
    "agent.kpi.completedToday",
    "agent.kpi.avgResponseTime",
    "agent.kpi.soapDraftsPending",
    "agent.subagents.title",
    "agent.subagents.voiceTitle",
    "agent.subagents.voiceDesc",
    "agent.subagents.imagingTitle",
    "agent.subagents.imagingDesc",
    "agent.subagents.dischargeTitle",
    "agent.subagents.dischargeDesc",
    "agent.subagents.statusLive",
    "agent.subagents.statusStandby",
    "agent.subagents.openAgent",
    "agent.advisory.banner",
    "agent.recentSessions.title",
    "agent.recentSessions.colId",
    "agent.recentSessions.colType",
    "agent.recentSessions.colDuration",
    "agent.recentSessions.colStatus",
    "agent.recentSessions.colTimestamp",
    "agent.recentSessions.colAction",
    "agent.recentSessions.statusDraft",
    "agent.recentSessions.statusConfirmed",
    "agent.recentSessions.statusExpired",
    "agent.recentSessions.emptyTitle",
    "agent.recentSessions.emptyDescription",
    "agent.recentSessions.typeVoice",
    "agent.recentSessions.typeImaging",
    "agent.recentSessions.typeDischarge",
    "agent.recentSessions.typeChat",
  ];

  it.each(newKeys)("%s exists in both en.json and sk.json", (key) => {
    const enVal = resolveLeaf(en, key);
    const skVal = resolveLeaf(sk, key);
    expect(typeof enVal, `missing in en.json: ${key}`).toBe("string");
    expect(typeof skVal, `missing in sk.json: ${key}`).toBe("string");
    expect((enVal as string).length).toBeGreaterThan(0);
    expect((skVal as string).length).toBeGreaterThan(0);
  });

  it("advisory banner explicitly cites Zákon 39/2007 Z. z.", () => {
    expect(resolveLeaf(sk, "agent.advisory.banner")).toContain("39/2007");
    expect(resolveLeaf(en, "agent.advisory.banner")).toContain("39/2007");
  });
});
