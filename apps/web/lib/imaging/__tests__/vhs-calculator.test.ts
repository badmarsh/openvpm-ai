import { describe, it, expect } from "vitest";
import { calculateVhs } from "../vhs-calculator";

describe("Vertebral Heart Score (VHS) Calculator", () => {
  it("calculates normal canine VHS correctly (8.5 - 10.5 v)", () => {
    // Canine with T4 = 15mm, Long axis = 75mm (5.0v), Short axis = 67.5mm (4.5v) => 9.5v
    const result = calculateVhs({
      longAxisMm: 75,
      shortAxisMm: 67.5,
      t4VertebraLengthMm: 15,
      species: "canine",
    });

    expect(result.vhsScore).toBe(9.5);
    expect(result.status).toBe("normal");
    expect(result.statusLabelSk).toContain("Normálna");
  });

  it("identifies borderline canine cardiomegaly (10.6 - 11.5 v)", () => {
    // Canine with T4 = 15mm, Long = 85mm (5.67v), Short = 78mm (5.2v) => 10.9v
    const result = calculateVhs({
      longAxisMm: 85,
      shortAxisMm: 78,
      t4VertebraLengthMm: 15,
      species: "canine",
    });

    expect(result.vhsScore).toBe(10.9);
    expect(result.status).toBe("borderline");
    expect(result.statusLabelSk).toContain("Mierna");
  });

  it("identifies marked canine cardiomegaly (> 11.5 v)", () => {
    // Canine with T4 = 15mm, Long = 95mm (6.33v), Short = 88mm (5.87v) => 12.2v
    const result = calculateVhs({
      longAxisMm: 95,
      shortAxisMm: 88,
      t4VertebraLengthMm: 15,
      species: "canine",
    });

    expect(result.vhsScore).toBe(12.2);
    expect(result.status).toBe("cardiomegaly");
    expect(result.clinicalInterpretationSk).toContain("kardiomegáliu");
  });

  it("calculates feline VHS correctly with feline reference range (< 8.0 v)", () => {
    // Feline with T4 = 12mm, Long = 48mm (4.0v), Short = 42mm (3.5v) => 7.5v
    const result = calculateVhs({
      longAxisMm: 48,
      shortAxisMm: 42,
      t4VertebraLengthMm: 12,
      species: "feline",
    });

    expect(result.vhsScore).toBe(7.5);
    expect(result.status).toBe("normal");
  });

  it("detects feline cardiomegaly (> 8.5 v) for HCM screening", () => {
    // Feline with T4 = 12mm, Long = 58mm (4.83v), Short = 50mm (4.17v) => 9.0v
    const result = calculateVhs({
      longAxisMm: 58,
      shortAxisMm: 50,
      t4VertebraLengthMm: 12,
      species: "feline",
    });

    expect(result.vhsScore).toBe(9.0);
    expect(result.status).toBe("cardiomegaly");
    expect(result.clinicalInterpretationSk).toContain("zväčšenie srdca u mačky");
  });

  it("applies breed-specific reference intervals for brachycephalic dogs (e.g. Boxer, Bulldog)", () => {
    // Boxer with VHS 11.2v (normal for Boxer: 10.3 - 11.6v, but would be abnormal for standard dog)
    const result = calculateVhs({
      longAxisMm: 85,
      shortAxisMm: 83,
      t4VertebraLengthMm: 15,
      species: "canine",
      breed: "Boxer",
    });

    expect(result.vhsScore).toBe(11.2);
    expect(result.status).toBe("normal");
    expect(result.referenceRange).toContain("Boxer");
  });

  it("applies breed-specific reference intervals for deep-chested dogs (e.g. Doberman)", () => {
    // Doberman with VHS 10.5v (borderline for Doberman: 9.2 - 10.2v)
    const result = calculateVhs({
      longAxisMm: 80,
      shortAxisMm: 77.5,
      t4VertebraLengthMm: 15,
      species: "canine",
      breed: "Doberman",
    });

    expect(result.vhsScore).toBe(10.5);
    expect(result.status).toBe("borderline");
  });

  it("rejects non-positive dimensions with descriptive error", () => {
    expect(() =>
      calculateVhs({
        longAxisMm: 0,
        shortAxisMm: 50,
        t4VertebraLengthMm: 15,
      })
    ).toThrow();

    expect(() =>
      calculateVhs({
        longAxisMm: 70,
        shortAxisMm: 50,
        t4VertebraLengthMm: -5,
      })
    ).toThrow();
  });
});
