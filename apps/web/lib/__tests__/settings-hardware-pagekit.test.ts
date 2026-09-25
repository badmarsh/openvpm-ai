import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const EKASA_PAGE = "app/(dashboard)/settings/ekasa/page.tsx";
const AI_PAGE = "app/(dashboard)/settings/ai/page.tsx";
const SIMULATION_PAGE = "app/(dashboard)/settings/simulation/page.tsx";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function complianceItemBlock(src: string, key: string): string {
  const itemsStart = src.indexOf("const COMPLIANCE_ITEMS");
  const itemStart = src.indexOf(`key: "${key}"`, itemsStart);
  const itemEnd = src.indexOf("\n    },", itemStart);

  expect(itemsStart, "COMPLIANCE_ITEMS should be declared").toBeGreaterThan(-1);
  expect(itemStart, `missing compliance item: ${key}`).toBeGreaterThan(-1);
  expect(itemEnd, `could not find the end of compliance item: ${key}`).toBeGreaterThan(itemStart);

  return src.slice(itemStart, itemEnd);
}

describe("settings hardware pages — UI Kit and i18n contract", () => {
  it("uses the shared page-shell rhythm on e-Kasa, AI, and simulation settings", () => {
    for (const path of [EKASA_PAGE, AI_PAGE, SIMULATION_PAGE]) {
      const src = source(path);
      expect(src, path).toContain('from "@/components/layout/page-kit"');
      expect(src, path).toContain("pageShellClass");
      expect(src, path).toContain("className={pageShellClass}");
    }
  });

  it("localizes the label and description of every e-Kasa compliance item", () => {
    const src = source(EKASA_PAGE);

    for (const key of ["dic", "pokladnicaId", "apiUrl", "certUploaded", "dphConfig"]) {
      const item = complianceItemBlock(src, key);
      expect(item, `${key} label must use t()`).toMatch(/label:\s*t\(/);
      expect(item, `${key} description must use t()`).toMatch(/description:\s*t\(/);
      expect(item).toContain(`settings.ekasa.compliance.items.${key}.label`);
      expect(item).toContain(`settings.ekasa.compliance.items.${key}.description`);
    }
  });
});
