import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seedSource = readFileSync("../../packages/db/seed.ts", "utf8");
const medicationSeed = seedSource.match(
  /\/\/ Medications(?<medications>[\s\S]*?)\/\/ Preventives/,
)?.groups?.medications;

describe("seed medication inventory units", () => {
  it("prices and stocks medication in the same individual dispensing unit", () => {
    expect(medicationSeed).toBeTruthy();
    expect(medicationSeed).not.toMatch(/\(\d+ct\)/i);
    expect(medicationSeed).toContain('name: "Rimadyl 75mg tablet"');
    expect(medicationSeed).toContain('unitPrice: "1.42"');
    expect(medicationSeed).toContain("stockQuantity: 2700");
    expect(medicationSeed).toContain(
      'name: "Metacam 1.5mg/mL oral suspension — per mL"',
    );
    expect(medicationSeed).not.toContain('unitPrice: "85.00"');
  });
});
