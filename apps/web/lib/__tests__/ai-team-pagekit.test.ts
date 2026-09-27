import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Sprint 34 contract: /admin/ai-swarm (deprecated Agno dev swarm) becomes
 * /admin/ai-team, the practice's roster of AI models and endpoints
 * (owner decision 2026-09-27).
 * Spec: tasks/sprints/arena-sprint-34-admin-ai-team.md
 *
 * ARMED: every case is `it.fails` until implemented; flip to `it(...)`.
 */

const WEB = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const load = (specifier: string) => import(/* @vite-ignore */ specifier);
const leaf = (obj: unknown, path: string) =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

const PAGE = "app/(dashboard)/admin/ai-team/page.tsx";
const FEATURES = [
  "assistant",
  "imagingRtg",
  "voiceSoap",
  "labParser",
  "imageGeneration",
  "videoGeneration",
  "marketingCopy",
  "deepThinking",
  "invoiceParser",
];

describe("Sprint 34 · AI team roster", () => {
  it.fails("1 · /admin/ai-team renders with the page kit and the roster query", () => {
    const src = read(PAGE);
    expect(src).toContain("@/components/layout/page-kit");
    expect(src).toContain("<PageHeader");
    expect(src).toContain("trpc.extensions.aiTeam.getRoster.useQuery");
    expect(src).toContain('t("admin.aiTeam.title", "AI team")');
  });

  it.fails("2 · no Agno / AgentOS leftovers on the new page", () => {
    const src = read(PAGE);
    for (const banned of ["pipeline_team_os", "AgentOS", "7777", "agent-ui", "aiSwarm", "Arena"]) {
      expect(src, banned).not.toContain(banned);
    }
  });

  it.fails("3 · the old URL keeps working as a redirect", () => {
    const src = read("app/(dashboard)/admin/ai-swarm/page.tsx");
    expect(src).toContain('redirect("/admin/ai-team")');
    expect(src.split("\n").length).toBeLessThan(20);
  });

  it.fails("4 · roster builder covers every AI feature and never exposes keys", async () => {
    const m = await load("../ai/ai-team");
    const roster = m.buildAiTeamRoster({
      config: null,
      resolved: Object.fromEntries(
        FEATURES.map((f) => [f, { provider: "gemini", modelId: "gemini-x", baseUrl: "https://gw.example.com/v1", apiKey: "secret" }]),
      ),
    });
    expect(roster.members.map((r: { key: string }) => r.key).sort()).toEqual([...FEATURES].sort());
    for (const member of roster.members) {
      expect(member).toMatchObject({ provider: "gemini", modelId: "gemini-x", endpointHost: "gw.example.com" });
      expect(JSON.stringify(member)).not.toContain("secret");
      expect(member).not.toHaveProperty("apiKey");
    }
  });

  it.fails("5 · router: admin-only, built on resolveFeatureConfig, registered as aiTeam", () => {
    const router = read("server/routers/extensions/ai-team.ts");
    expect(router).toContain("export const aiTeamRouter");
    expect(router).toContain("resolveFeatureConfig");
    expect(router).toMatch(/requireRole\("admin"\)/);
    const index = read("server/routers/extensions/index.ts");
    expect(index).toMatch(/aiTeam:\s*aiTeamRouter/);
    expect(index).not.toMatch(/aiSwarm:\s*aiSwarmRouter/);
    expect(existsSync(join(WEB, "server/routers/extensions/ai-swarm.ts"))).toBe(false);
  });

  it.fails("6 · navigation and the admin overview point to the AI team", () => {
    const nav = read("config/custom-nav.ts");
    expect(nav).toContain('href: "/admin/ai-team"');
    expect(nav).toContain('i18nKey: "nav.aiTeam"');
    expect(nav).not.toContain('badge: "SWARM"');
    const admin = read("app/(dashboard)/admin/page.tsx");
    expect(admin).toContain("trpc.extensions.aiTeam.getRoster.useQuery");
    expect(admin).toContain('href="/admin/ai-team"');
    expect(admin).not.toContain("aiSwarm");
  });

  it.fails("7 · i18n: aiTeam copy exists in en and sk; aiSwarm keys are gone", () => {
    const en = JSON.parse(read("messages/en.json"));
    const sk = JSON.parse(read("messages/sk.json"));
    for (const key of [
      "nav.aiTeam",
      "admin.aiTeam.title",
      "admin.aiTeam.subtitle",
      "admin.aiTeam.table.feature",
      "admin.aiTeam.table.model",
      "admin.aiTeam.table.provider",
      "admin.aiTeam.table.endpoint",
      "admin.aiTeam.table.health",
      "admin.aiTeam.source_practice",
      "admin.aiTeam.source_default",
      ...FEATURES.map((f) => `admin.aiTeam.feature.${f}`),
    ]) {
      expect(typeof leaf(en, key), `en ${key}`).toBe("string");
      expect(typeof leaf(sk, key), `sk ${key}`).toBe("string");
    }
    expect(leaf(en, "admin.aiSwarm")).toBeUndefined();
    expect(leaf(sk, "admin.aiSwarm")).toBeUndefined();
  });
});
