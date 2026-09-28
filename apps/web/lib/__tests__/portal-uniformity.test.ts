/**
 * Contract for the portal uniformity sweep.
 *
 * `tasks/RULES.md` §3.1 allows one PR to touch many files when it applies the
 * same mechanical edit, on condition that a mechanical contract ships with it.
 * This is that contract for the client portal: the portal keeps its own
 * light-only neutral scale, but it must not invent its own status colours page
 * by page — those come from `components/portal/portal-ui.tsx` and nowhere else.
 *
 * Owner decision 2026-09-28 (sweep exception), PR #78.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const BOUNDARIES = ["apps/web/app/portal", "apps/web/components/portal"];

function runChecker() {
  const args = [
    "scripts/ui/uniformity.mjs",
    ...BOUNDARIES.flatMap((boundary) => ["--boundary", boundary]),
    "--rules",
    "saturated",
  ];
  return spawnSync("node", args, { cwd: repoRoot, encoding: "utf8" });
}

describe("portal uniformity contract", () => {
  it("has no saturated palette utility anywhere in the portal boundary", () => {
    const result = runChecker();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("keeps the status vocabulary in the one shared file", () => {
    const ui = readFileSync("components/portal/portal-ui.tsx", "utf8");
    for (const tone of ["info", "waiting", "progress", "done", "problem", "neutral"]) {
      expect(ui, `tone ${tone} is missing from the shared vocabulary`).toMatch(
        new RegExp(`\\b${tone}:\\s*"`),
      );
    }
    expect(ui).toContain("PORTAL_PILL_CLASS");
    expect(ui).toContain("PORTAL_TEXT_CLASS");
  });

  it("routes every page that renders a status through the shared vocabulary", () => {
    const pagesWithStatus = [
      "app/portal/[token]/appointments/page.tsx",
      "app/portal/[token]/invoices/page.tsx",
      "app/portal/[token]/pets/[petId]/page.tsx",
    ];
    for (const page of pagesWithStatus) {
      const source = readFileSync(page, "utf8");
      expect(source, `${page} does not import the shared kit`).toContain(
        "@/components/portal/portal-ui",
      );
      expect(source, `${page} still renders a literal status colour`).toMatch(
        /PORTAL_(?:TONE|NOTICE|TEXT)_CLASS\./,
      );
    }
  });
});
