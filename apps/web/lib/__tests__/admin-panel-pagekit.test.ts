/**
 * Platform Admin & AI Swarm Hub — UI Kit Harmonization (Arena Sprint 24)
 * ---------------------------------------------------------------------
 * Pins /admin (platform admin) and /admin/ai-swarm (AI swarm hub) to the
 * dashboard UI kit (docs/UIKIT.md):
 *   1. pageShellClass layout rhythm (no bare unstyled root),
 *   2. PageHeader with the ShieldCheck icon and the ADMIN badge on /admin,
 *   3. KpiGrid / KpiCard for the business KPIs and the AI swarm system
 *      health KPIs (active agents, sprints dispatched, arena sessions,
 *      last deploy),
 *   4. DataTableFrame + dense table tokens for the sprint log with
 *      merged / running / failed badges,
 *   5. AI swarm agent roster DataTableFrame with health indicators
 *      (ready / busy / standby),
 *   6. 100% leaf symmetry and complete bilingual coverage for the admin
 *      and aiSwarm namespaces in both dictionaries.
 *
 * The functional contract (role gating, messaging carrier operations,
 * activation recovery, funnels) stays pinned in admin-ui.test.ts and
 * admin-sms-recovery-ui.test.ts; this file only guards the kit adoption
 * and the i18n state of the two pages.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminPage = readFileSync("app/(dashboard)/admin/page.tsx", "utf8");
const swarmPage = readFileSync("app/(dashboard)/admin/ai-swarm/page.tsx", "utf8");
const pageKitSource = readFileSync("components/layout/page-kit.tsx", "utf8");
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));

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

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) =>
      node === null || typeof node !== "object"
        ? node
        : (node as Record<string, unknown>)[key],
    obj);
}

describe("admin panel adopts the dashboard UI kit shell", () => {
  it("imports the kit tokens from @/components/layout/page-kit", () => {
    expect(adminPage).toContain('from "@/components/layout/page-kit"');
    for (const token of [
      "pageShellClass",
      "KpiGrid",
      "KpiCard",
      "DataTableFrame",
      "tableHeadClass",
      "tableCellClass",
      "tableRowClass",
    ]) {
      expect(adminPage).toContain(token);
    }
  });

  it("wraps the page body in pageShellClass (no bare unstyled root)", () => {
    expect(pageKitSource).toContain('export const pageShellClass = "space-y-6"');
    expect(adminPage).toContain("<div className={pageShellClass}>");
    // Ad-hoc sibling spacing retired in favour of the shell rhythm.
    expect(adminPage).not.toContain('<div className="mt-6 rounded-lg');
    expect(adminPage).not.toContain('<div className="mt-8');
  });

  it("uses the canonical PageHeader with the ShieldCheck icon and ADMIN badge", () => {
    expect(adminPage).toContain("icon={ShieldCheck}");
    expect(adminPage).toContain('t("admin.header.badge", "ADMIN")');
    expect(adminPage).toContain('t("admin.header.title", "Platform Admin")');
    expect(adminPage).toContain(
      't("admin.header.subtitle", "Cross-tenant operations overview")',
    );
  });

  it("renders the business KPIs with KpiGrid / KpiCard, not hand-rolled cards", () => {
    expect(adminPage).toContain("<KpiGrid");
    expect(adminPage).toContain("<KpiCard");
    expect(adminPage).not.toContain('mt-2 font-heading text-2xl font-bold">{k.value}');
  });

  it("shows the AI swarm system-health KPI grid (agents, sprints, sessions, deploy)", () => {
    expect(adminPage).toContain(
      "trpc.extensions.aiSwarm.getStatus.useQuery",
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.title", "AI swarm system health")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.activeAgents", "Active agents")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.sprintsDispatched", "Sprints dispatched")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.arenaSessions", "Arena sessions")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.lastDeploy", "Last deploy")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.openHub", "Open AI Swarm hub")',
    );
  });

  it("links operators from the admin overview to the AI Swarm hub", () => {
    expect(adminPage).toContain('href="/admin/ai-swarm"');
  });

  it("renders the sprint log in a DataTableFrame with merged / running / failed badges", () => {
    expect(adminPage).toContain(
      't("admin.systemHealth.sprintLogTitle", "Sprint log")',
    );
    expect(adminPage).toContain(
      't("admin.systemHealth.sprintLogEmpty", "No sprints dispatched yet.")',
    );
    expect(adminPage).toContain("swarmDerived.sessions.map");
    expect(adminPage).toContain('session.status === "COMPLETED"');
    expect(adminPage).toContain('session.status === "RUNNING"');
    expect(adminPage).toContain('session.status === "FAILED"');
    expect(adminPage).toContain('session.status === "PENDING"');
    expect(adminPage).toContain('t("admin.systemHealth.merged", "Merged")');
    expect(adminPage).toContain('t("admin.systemHealth.running", "Running")');
    expect(adminPage).toContain('t("admin.systemHealth.failed", "Failed")');
    expect(adminPage).toContain('t("admin.systemHealth.pending", "Pending")');
  });

  it("derives the last deploy from completed (merged) sprints only", () => {
    expect(adminPage).toContain("swarmDerived.lastDeployAt");
    expect(adminPage).toContain(
      't("admin.systemHealth.noDeployYet", "No merged sprints yet")',
    );
    // Completed sessions are the only merge evidence used for the KPI.
    const derivation = adminPage.slice(
      adminPage.indexOf("swarmDerived = useMemo"),
      adminPage.indexOf("if (error?.data?.code"),
    );
    expect(derivation).toContain('session.status === "COMPLETED"');
  });
});

describe("admin tables use the dense kit tokens", () => {
  it("no hand-rolled table chrome remains on the admin overview", () => {
    expect(adminPage).not.toContain("px-4 py-2.5");
    expect(adminPage).not.toContain('className="w-full text-sm"');
    expect(adminPage).toContain("<DataTableFrame");
  });
});

describe("ai-swarm hub roster shows agent health", () => {
  it("adds a health column with ready / busy / standby indicators", () => {
    expect(swarmPage).toContain('t("admin.aiSwarm.table.health", "Health")');
    expect(swarmPage).toContain("renderAgentHealth(ag.status)");
    expect(swarmPage).toContain("admin.aiSwarm.table.status_${status}");
  });

  it("keeps the kit shell and the SWARM header badge", () => {
    expect(swarmPage).toContain("<div className={pageShellClass}>");
    expect(swarmPage).toContain('t("admin.aiSwarm.badge", "SWARM")');
    expect(swarmPage).toContain("icon={Bot}");
  });

  it("keeps the read-only AgentOS endpoint config untouched", () => {
    expect(swarmPage).toContain("trpc.extensions.aiSwarm.getStatus.useQuery");
    expect(swarmPage).toContain('http://localhost:3007');
    expect(swarmPage).toContain('http://127.0.0.1:7777');
  });
});

describe("bilingual admin / aiSwarm namespace coverage", () => {
  const NEW_KEYS = [
    "admin.header.badge",
    "admin.systemHealth.title",
    "admin.systemHealth.desc",
    "admin.systemHealth.loadError",
    "admin.systemHealth.loading",
    "admin.systemHealth.openHub",
    "admin.systemHealth.activeAgents",
    "admin.systemHealth.sprintsDispatched",
    "admin.systemHealth.arenaSessions",
    "admin.systemHealth.lastDeploy",
    "admin.systemHealth.noDeployYet",
    "admin.systemHealth.sprintsHint",
    "admin.systemHealth.sessionsHint",
    "admin.systemHealth.sprintLogTitle",
    "admin.systemHealth.sprintLogDesc",
    "admin.systemHealth.sprintLogEmpty",
    "admin.systemHealth.sprint",
    "admin.systemHealth.status",
    "admin.systemHealth.progress",
    "admin.systemHealth.started",
    "admin.systemHealth.merged",
    "admin.systemHealth.running",
    "admin.systemHealth.failed",
    "admin.systemHealth.pending",
    "admin.systemHealth.unknown",
    "admin.smsHealth.priority",
    "admin.smsHealth.category",
    "admin.smsHealth.age",
    "admin.smsHealth.reason",
    "admin.smsHealth.clinicLocation",
    "admin.aiSwarm.table.health",
    "admin.aiSwarm.table.status_ready",
    "admin.aiSwarm.table.status_busy",
    "admin.aiSwarm.table.status_standby",
    "admin.aiSwarm.approvals.required",
    "admin.aiSwarm.approvals.auditLog",
    "admin.aiSwarm.approvals.tableId",
  ];

  it("adds every new key to both dictionaries with non-empty values", () => {
    for (const key of NEW_KEYS) {
      const enValue = getPath(en, key);
      const skValue = getPath(sk, key);
      expect(typeof enValue, `en.json key "${key}"`).toBe("string");
      expect(typeof skValue, `sk.json key "${key}"`).toBe("string");
      expect((enValue as string).length).toBeGreaterThan(0);
      expect((skValue as string).length).toBeGreaterThan(0);
    }
  });

  it("keeps the whole admin namespace 100% leaf-symmetric between en/sk", () => {
    const enLeaves = leafKeys(en.admin as Record<string, unknown>, "admin");
    const skLeaves = leafKeys(sk.admin as Record<string, unknown>, "admin");
    const missingInSk = [...enLeaves].filter((k) => !skLeaves.has(k));
    const missingInEn = [...skLeaves].filter((k) => !enLeaves.has(k));
    expect(missingInSk).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("covers the sprint-log badge keys in both languages", () => {
    for (const key of ["merged", "running", "failed", "pending"]) {
      const enValue = getPath(en, `admin.systemHealth.${key}`) as string;
      const skValue = getPath(sk, `admin.systemHealth.${key}`) as string;
      expect(enValue).toBeTruthy();
      expect(skValue).toBeTruthy();
    }
  });
});
