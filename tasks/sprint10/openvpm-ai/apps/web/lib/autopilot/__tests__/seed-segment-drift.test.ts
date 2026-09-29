import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CRM_SEGMENT_KEYS } from "../segmentation-engine";

/**
 * Seed/spec/engine drift guard for the 12 canonical CRM segments.
 *
 * Regression test for the integration audit finding where three divergent
 * segment sets coexisted: SKILL.md + seed-marketing.ts used one key set while
 * segmentation-engine.ts computed another, producing dead segments that were
 * never recomputed. The engine catalog (CRM_SEGMENT_KEYS) is the single
 * source of truth; the seed and the skill file must stay subsets of it.
 */
function repoFile(relativePath: string): string {
  return fileURLToPath(
    new URL(`../../../../../${relativePath}`, import.meta.url)
  );
}

describe("CRM canonical segments — seed/spec/engine drift guard", () => {
  it("seeds only engine-known segment keys", () => {
    const seed = readFileSync(repoFile("packages/db/seed-marketing.ts"), "utf8");
    const seededKeys = [
      ...seed.matchAll(/segmentKey:\s*"([a-z0-9_]+)"/g),
    ].map((m) => m[1]);

    expect(seededKeys.length).toBeGreaterThan(0);
    for (const key of seededKeys) {
      expect(
        [...CRM_SEGMENT_KEYS],
        `seed-marketing.ts seeds unknown segment "${key}" — add it to CRM_SEGMENT_DEFINITIONS or drop it from the seed`
      ).toContain(key);
    }
  });

  it("documents only engine-known segment keys in SKILL.md", () => {
    const skill = readFileSync(
      repoFile(".agents/skills/openvpm-ai/SKILL.md"),
      "utf8"
    );
    const line = skill
      .split("\n")
      .find((l) => l.includes("Deterministic segmentation"));
    expect(line, "SKILL.md must document the canonical segment set").toBeDefined();
    const documentedKeys = [...line!.matchAll(/`([a-z0-9_]+)`/g)].map(
      (m) => m[1]
    );

    expect(documentedKeys).toHaveLength(12);
    for (const key of documentedKeys) {
      expect(
        [...CRM_SEGMENT_KEYS],
        `SKILL.md documents unknown segment "${key}" — sync with CRM_SEGMENT_DEFINITIONS`
      ).toContain(key);
    }
  });
});
