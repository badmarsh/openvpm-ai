import { describe, it, expect } from "vitest";
import {
  evaluateResultFlag,
  parseIdexx,
  parseFujiDriChem,
  parseMindray,
  autoDetectAndParse,
} from "../analyzer-parser";

describe("Lab Analyzer Parser & Reference Ranges", () => {
  describe("evaluateResultFlag", () => {
    it("should correctly flag normal, high, low, and critical canine ALT", () => {
      expect(evaluateResultFlag("ALT", 50, "canine")).toBe("NORMAL"); // Range: 10 - 100
      expect(evaluateResultFlag("ALT", 5, "canine")).toBe("LOW");
      expect(evaluateResultFlag("ALT", 180, "canine")).toBe("HIGH");
      expect(evaluateResultFlag("ALT", 550, "canine")).toBe("CRITICAL"); // >= 500
    });

    it("should correctly flag feline glucose with species specific range", () => {
      // Feline GLU: 3.8 - 8.3 mmol/L
      expect(evaluateResultFlag("GLU", 5.5, "feline")).toBe("NORMAL");
      expect(evaluateResultFlag("GLU", 2.0, "feline")).toBe("CRITICAL"); // <= 2.2
      expect(evaluateResultFlag("GLU", 12.0, "feline")).toBe("HIGH");
      expect(evaluateResultFlag("GLU", 28.0, "feline")).toBe("CRITICAL"); // >= 25.0
    });
  });

  describe("parseIdexx", () => {
    it("should parse IDEXX Catalyst CSV format", () => {
      const sampleIdexx = `
# IDEXX Catalyst One Export
Analyte,Result,Units,Low,High
ALT,45,U/L,10,100
CREA,180,µmol/L,44,159
UREA,8.2,mmol/L,2.5,9.6
GLU,1.8,mmol/L,3.3,6.5
`;
      const results = parseIdexx(sampleIdexx, "canine");
      expect(results.length).toBe(4);

      const alt = results.find((r) => r.code === "ALT");
      expect(alt?.value).toBe(45);
      expect(alt?.flag).toBe("NORMAL");

      const crea = results.find((r) => r.code === "CREA");
      expect(crea?.value).toBe(180);
      expect(crea?.flag).toBe("HIGH");

      const glu = results.find((r) => r.code === "GLU");
      expect(glu?.value).toBe(1.8);
      expect(glu?.flag).toBe("CRITICAL");
    });
  });

  describe("parseFujiDriChem", () => {
    it("should parse Fuji Dri-Chem CSV output", () => {
      const sampleFuji = `
Item,Data,Unit,RefLow,RefHigh
ALT,85,U/L,10,100
AST,30,U/L,0,50
BUN,14.5,mmol/L,2.5,9.6
`;
      const results = parseFujiDriChem(sampleFuji, "canine");
      expect(results.length).toBe(3);

      const bun = results.find((r) => r.code === "BUN");
      expect(bun?.value).toBe(14.5);
      expect(bun?.flag).toBe("HIGH");
    });
  });

  describe("parseMindray", () => {
    it("should parse Mindray BC-Vet hematology output", () => {
      const sampleMindray = `
Mindray BC-5000Vet Hematology Report
Parameter  Result  Unit  Ref Range
WBC        12.4    10^9/L  6.0 - 17.0
RBC        7.15    10^12/L 5.5 - 8.5
HCT        45.2    %       37.0 - 55.0
PLT        25      10^9/L  175 - 500
`;
      const results = parseMindray(sampleMindray, "canine");
      expect(results.length).toBe(4);

      const plt = results.find((r) => r.code === "PLT");
      expect(plt?.value).toBe(25);
      expect(plt?.flag).toBe("CRITICAL"); // < 40
    });
  });

  describe("autoDetectAndParse", () => {
    it("should automatically recognize analyzer type and calculate summary counters", () => {
      const data = `
[IDEXX Catalyst Dx Report]
ALT,600,U/L,10,100
CREA,90,µmol/L,44,159
TP,40,g/L,52,82
`;
      const parsed = autoDetectAndParse({
        content: data,
        filename: "idexx_lab_report.csv",
        species: "canine",
      });

      expect(parsed.analyzerType).toBe("IDEXX");
      expect(parsed.results.length).toBe(3);
      expect(parsed.criticalCount).toBe(1); // ALT 600 >= 500
      expect(parsed.abnormalCount).toBe(2); // ALT critical + TP low
    });
  });
});
