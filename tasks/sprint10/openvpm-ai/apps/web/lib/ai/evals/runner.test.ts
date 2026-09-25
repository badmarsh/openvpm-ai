import { describe, expect, it } from "vitest";
import dataset from "./dataset.json";
import {
  computeMetrics,
  gradeCase,
  assertMetricsWithinTargets,
  EVAL_TARGETS,
  extractNumbers,
  type EvalCase,
} from "./metrics";

const REQUIRED_CATEGORIES = [
  "species_toxicity",
  "withdrawal",
  "dosing",
  "rabies_escalation",
  "red_team",
  "hard_boundary",
] as const;

function loadCases(): EvalCase[] {
  return dataset.cases as EvalCase[];
}

describe("Clinical AI Eval Dataset — integrita benchmarku", () => {
  const cases = loadCases();

  it("contains at least 100 benchmark cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  it("covers every required category", () => {
    const present = new Set(cases.map((c) => c.category));
    for (const category of REQUIRED_CATEGORIES) {
      expect(present.has(category)).toBe(true);
    }
  });

  it("has unique ids and complete core fields", () => {
    const ids = new Set<string>();
    for (const c of cases) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.scenario.length).toBeGreaterThan(0);
      expect(c.expectedVerdict).toBeTruthy();
      expect(Array.isArray(c.requiredTerms)).toBe(true);
      expect(Array.isArray(c.forbiddenTerms)).toBe(true);
      expect(Array.isArray(c.citations)).toBe(true);
    }
  });

  it("keeps withdrawal and dosing numeric expectations non-negative", () => {
    for (const c of cases) {
      if (c.category === "withdrawal") {
        expect((c.expectedMeatDays ?? 0) >= 0).toBe(true);
        expect((c.expectedMilkDays ?? 0) >= 0).toBe(true);
      }
      if (c.category === "dosing") {
        expect((c.expectedDoseMgKg ?? 0) > 0).toBe(true);
        expect((c.weightKg ?? 0) > 0).toBe(true);
      }
    }
  });

  it("marks every species-toxicity case as block", () => {
    const toxicity = cases.filter((c) => c.category === "species_toxicity");
    expect(toxicity.length).toBeGreaterThanOrEqual(30);
    for (const c of toxicity) {
      expect(c.expectedVerdict).toBe("block");
    }
  });
});

describe("Clinical AI Eval Runner — golden baseline", () => {
  const cases = loadCases();

  it("achieves 100% contraindication recall on the reference answers", () => {
    const metrics = computeMetrics(cases);
    expect(metrics.contraindicationRecall).toBe(EVAL_TARGETS.contraindicationRecall);
    expect(() => assertMetricsWithinTargets(metrics)).not.toThrow();
  });

  it("achieves 0% hallucination rate on dosing and legal deadlines", () => {
    const metrics = computeMetrics(cases);
    expect(metrics.hallucinationRate).toBe(EVAL_TARGETS.hallucinationRate);
  });

  it("achieves 100% citation precision", () => {
    const metrics = computeMetrics(cases);
    expect(metrics.citationPrecision).toBe(EVAL_TARGETS.citationPrecision);
  });

  it("has zero failures across the whole benchmark", () => {
    const metrics = computeMetrics(cases);
    expect(metrics.failures).toHaveLength(0);
  });
});

describe("Clinical AI Eval Runner — sensitivity (failure detection)", () => {
  const cases = loadCases();

  it("penalizes a candidate that ignores a species contraindication", () => {
    const mutated = cases.map((c) =>
      c.category === "species_toxicity" && c.id.endsWith("001")
        ? { ...c, candidate: "Táto látka je pre toto zviera úplne bezpečná." }
        : c
    );
    const metrics = computeMetrics(mutated);
    expect(metrics.contraindicationRecall).toBeLessThan(1);
    expect(metrics.failures.some((f) => f.id.endsWith("001"))).toBe(true);
  });

  it("penalizes a hallucinated dose", () => {
    const mutated = cases.map((c) =>
      c.category === "dosing" && c.id.endsWith("001")
        ? { ...c, candidate: "Odporúčaná dávka: 900 mg pre 25 kg." }
        : c
    );
    const metrics = computeMetrics(mutated);
    expect(metrics.hallucinationRate).toBeGreaterThan(0);
    expect(metrics.failures.some((f) => f.id.endsWith("001"))).toBe(true);
  });

  it("penalizes a missing citation", () => {
    const mutated = cases.map((c) =>
      c.category === "withdrawal" && c.id.endsWith("001")
        ? { ...c, candidate: "Ochranná lehota: mäso 7 dní, mlieko 3 dní." }
        : c
    );
    const metrics = computeMetrics(mutated);
    expect(metrics.citationPrecision).toBeLessThan(1);
  });

  it("grades a refusal to a red-team attempt as compliant", () => {
    const case_ = cases.find((c) => c.category === "red_team")!;
    const verdict = gradeCase(case_);
    expect(verdict.pass).toBe(true);
  });

  it("extracts numbers robustly (comma and dot decimals)", () => {
    expect(extractNumbers("dávka 2,5 mg")).toContain(2.5);
    expect(extractNumbers("dávka 2.5 mg")).toContain(2.5);
    expect(extractNumbers("mäso 7 dní, mlieko 3 dní")).toEqual([7, 3]);
  });
});
