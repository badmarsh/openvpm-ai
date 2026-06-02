import { describe, it, expect } from "vitest";
import { calculateDose } from "../calculator";
import { FORMULARY, findDrug } from "../formulary";

describe("calculateDose — core math", () => {
  it("computes a weight-based mg range", () => {
    // carprofen canine 2.2–4.4 mg/kg, 10kg dog
    const r = calculateDose({ drugId: "carprofen", species: "canine", weightKg: 10 });
    expect(r.doseLowMg).toBe(22);
    expect(r.doseHighMg).toBe(44);
    expect(r.route).toBe("PO");
  });

  it("computes injectable volume when concentration is given", () => {
    // maropitant canine 1–2 mg/kg, 5kg, 10 mg/mL
    const r = calculateDose({
      drugId: "maropitant",
      species: "canine",
      weightKg: 5,
      concentrationMgPerMl: 10,
    });
    expect(r.doseLowMg).toBe(5);
    expect(r.doseHighMg).toBe(10);
    expect(r.volumeLowMl).toBe(0.5);
    expect(r.volumeHighMl).toBe(1);
  });

  it("rounds to 2 decimal places", () => {
    // gabapentin 5–10 mg/kg, 3.3kg -> 16.5 / 33
    const r = calculateDose({ drugId: "gabapentin", species: "feline", weightKg: 3.3 });
    expect(r.doseLowMg).toBe(16.5);
    expect(r.doseHighMg).toBe(33);
  });
});

describe("calculateDose — max single dose cap", () => {
  it("caps the dose and flags it", () => {
    // feline meloxicam capped at 0.3 mg single dose; 10kg * 0.1 = 1.0 > 0.3
    const r = calculateDose({ drugId: "meloxicam", species: "feline", weightKg: 10 });
    expect(r.doseHighMg).toBe(0.3);
    expect(r.cappedByMax).toBe(true);
    expect(r.warnings.some((w) => w.includes("capped"))).toBe(true);
  });
});

describe("calculateDose — tablet suggestions", () => {
  it("suggests practical tablet splits at the midpoint", () => {
    // metronidazole 10–15 mg/kg, 20kg -> 200–300mg, mid 250. 250mg tab -> 1 tablet
    const r = calculateDose({ drugId: "metronidazole", species: "canine", weightKg: 20 });
    const tab250 = r.tabletSuggestions?.find((t) => t.strengthMg === 250);
    expect(tab250?.tabletsPerDose).toBe(1);
  });

  it("omits impractical tablet strengths (>4 or <0.25 tablets)", () => {
    // famotidine 0.5–1 mg/kg, 5kg -> 2.5–5mg, mid 3.75. 40mg tab -> ~0.09 -> dropped
    const r = calculateDose({ drugId: "famotidine", species: "canine", weightKg: 5 });
    expect(r.tabletSuggestions?.some((t) => t.strengthMg === 40)).toBe(false);
  });
});

describe("calculateDose — guard rails", () => {
  it("rejects non-positive weight", () => {
    expect(() => calculateDose({ drugId: "carprofen", species: "canine", weightKg: 0 })).toThrow(
      /positive/
    );
  });

  it("rejects implausibly large weight", () => {
    expect(() =>
      calculateDose({ drugId: "carprofen", species: "canine", weightKg: 500 })
    ).toThrow(/plausible/);
  });

  it("rejects an unknown drug", () => {
    expect(() =>
      calculateDose({ drugId: "nope", species: "canine", weightKg: 10 })
    ).toThrow(/Unknown drug/);
  });

  it("refuses to extrapolate across species (carprofen has no feline dose)", () => {
    expect(() =>
      calculateDose({ drugId: "carprofen", species: "feline", weightKg: 4 })
    ).toThrow(/No reference dose/);
  });

  it("rejects an invalid concentration", () => {
    expect(() =>
      calculateDose({
        drugId: "maropitant",
        species: "canine",
        weightKg: 5,
        concentrationMgPerMl: 0,
      })
    ).toThrow(/Concentration/);
  });

  it("surfaces drug-level warnings (carprofen not for cats note lives on the drug)", () => {
    const r = calculateDose({ drugId: "carprofen", species: "canine", weightKg: 10 });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/Verify every dose/);
  });
});

describe("formulary integrity", () => {
  it("every dose has low <= high and a positive range", () => {
    for (const drug of FORMULARY) {
      for (const d of drug.doses) {
        expect(d.mgPerKgLow).toBeGreaterThan(0);
        expect(d.mgPerKgHigh).toBeGreaterThanOrEqual(d.mgPerKgLow);
      }
    }
  });

  it("findDrug returns undefined for unknown ids", () => {
    expect(findDrug("does-not-exist")).toBeUndefined();
  });
});
