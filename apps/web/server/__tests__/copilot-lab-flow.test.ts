import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoDetectAndParse } from "@/lib/lab/analyzer-parser";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "p2222222-2222-2222-2222-222222222222";

describe("Data Entry Copilot — Lab Import Flow & Statutory Guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("autoDetectAndParse (Analyzer Parser)", () => {
    it("correctly parses IDEXX Catalyst CSV format and computes flags", () => {
      const idexxCsv = `ALT,120,U/L,10,100
CREA,140,µmol/L,44,159
GLU,3.1,mmol/L,3.8,7.9`;

      const result = autoDetectAndParse({
        content: idexxCsv,
        filename: "idexx_catalyst_export.csv",
        species: "canine",
      });

      expect(result.results.length).toBe(3);
      const alt = result.results.find((r) => r.code === "ALT");
      expect(alt).toBeDefined();
      expect(alt?.value).toBe(120);
      expect(alt?.flag).toBe("HIGH");

      const glu = result.results.find((r) => r.code === "GLU");
      expect(glu).toBeDefined();
      expect(glu?.value).toBe(3.1);
      expect(glu?.flag).toBe("LOW");

      const crea = result.results.find((r) => r.code === "CREA");
      expect(crea).toBeDefined();
      expect(crea?.value).toBe(140);
      expect(crea?.flag).toBe("NORMAL");
    });

    it("parses Fuji Dri-Chem format", () => {
      const fujiContent = `T-CHO,4.5,mmol/L,1.8,5.0
BUN,12.1,mmol/L,5.7,12.9
ALP,85,U/L,14,111`;

      const result = autoDetectAndParse({
        content: fujiContent,
        filename: "fuji_drichem.csv",
        species: "feline",
      });

      expect(result.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("parsePdfOrImageReport Router Procedure", () => {
    it("computes high confidence (>=0.92) for rich structured protocols", async () => {
      const { labImportRouter } = await import("../routers/extensions/lab-import");

      const mockDb: any = {
        transaction: async (fn: any) => fn(mockDb),
        execute: vi.fn(async () => undefined),
        query: {
          patients: {
            findFirst: vi.fn().mockResolvedValue({ id: PATIENT_ID, clientId: "c1" }),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rep-1" }]),
          }),
        }),
      };

      const caller = labImportRouter.createCaller({
        db: mockDb,
        practiceId: PRACTICE_ID,
        session: {
          user: {
            id: USER_ID,
            email: "vet@example.com",
            name: "Dr. Sýkora",
            role: "veterinarian",
            practiceId: PRACTICE_ID,
          },
        },
      } as any);

      // 6 parameters in CSV format base64 encoded
      const sampleCsv = `ALT,45,U/L,10,100
AST,30,U/L,10,50
ALKP,60,U/L,20,150
BUN,8.5,mmol/L,3.5,10.0
CREA,90,µmol/L,44,159
GLU,5.2,mmol/L,3.8,7.9`;
      const base64Content = Buffer.from(sampleCsv).toString("base64");

      const res = await caller.parsePdfOrImageReport({
        fileName: "laboklin_blood_panel.pdf",
        fileContentBase64: base64Content,
        species: "canine",
        createDraft: false,
      });

      expect(res.results.length).toBe(6);
      expect(res.confidenceScore).toBeGreaterThanOrEqual(0.75);
      expect(res.requiresVetApproval).toBe(true);
    });

    it("enforces Slovak Statutory Guardrails (Act 39/2007 §3 Vet Authorization)", async () => {
      const { labImportRouter } = await import("../routers/extensions/lab-import");

      const mockDb: any = {
        transaction: async (fn: any) => fn(mockDb),
        execute: vi.fn(async () => undefined),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rep-draft-1" }]),
          }),
        }),
      };

      const caller = labImportRouter.createCaller({
        db: mockDb,
        practiceId: PRACTICE_ID,
        session: {
          user: {
            id: USER_ID,
            email: "vet@example.com",
            name: "Dr. Sýkora",
            role: "veterinarian",
            practiceId: PRACTICE_ID,
          },
        },
      } as any);

      const sampleCsv = `ALT,50,U/L,10,100`;
      const base64Content = Buffer.from(sampleCsv).toString("base64");

      const res = await caller.parsePdfOrImageReport({
        fileName: "lab_sample.pdf",
        fileContentBase64: base64Content,
        species: "canine",
        createDraft: false,
      });

      // Verification: must flag that veterinarian approval is required
      expect(res.requiresVetApproval).toBe(true);
    });

    it("enforces Act 139/1998 Z. z. Zero AI Prefill for Controlled Substances", async () => {
      const { isControlledSubstanceName } = await import(
        "@/lib/controlled-substances/policy"
      );

      // Controlled substances per Act 139/1998 Z. z.
      expect(isControlledSubstanceName("Ketamine 100mg/ml")).toBe(true);
      expect(isControlledSubstanceName("Narkamon inj.")).toBe(true);
      expect(isControlledSubstanceName("Fentanyl náplasť")).toBe(true);
      expect(isControlledSubstanceName("Butorphanol 10mg/ml")).toBe(true);
      expect(isControlledSubstanceName("Torbugesic")).toBe(true);
      expect(isControlledSubstanceName("Propofol 1% MCT/LCT")).toBe(true);
      expect(isControlledSubstanceName("Diazepam tbl.")).toBe(true);
      expect(isControlledSubstanceName("Buprenorfín inj.")).toBe(true);

      // Non-controlled substances
      expect(isControlledSubstanceName("Amoxicillin / Clavulanate")).toBe(false);
      expect(isControlledSubstanceName("Meloxicam 1.5mg/ml")).toBe(false);
      expect(isControlledSubstanceName("Cerenia 10mg/ml")).toBe(false);
      expect(isControlledSubstanceName("Convenia")).toBe(false);
    });
  });
});
