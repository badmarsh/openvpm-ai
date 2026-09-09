import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "@/lib/voice/soap-formatter";
import { calculateVhs, getReferenceRangeForBreed } from "@/lib/imaging/vhs-calculator";
import { calculateDose, isFormularyDrugId, FORMULARY } from "@/lib/dosing";
import {
  buildAiConfirmationAuditTrail,
  generateContentHash,
  resolveSoapSectionalStatus,
} from "@/lib/ai/draft-safety";
import { getTool } from "@/lib/agent/tools";

describe("Clinical AI Evaluation Harness (Deterministic Benchmarks)", () => {
  describe("1. SOAP Formatter Style Differentiation", () => {
    it("differentiates concise style with telegraphic rules and veterinary abbreviations", () => {
      const concisePrompt = getSystemPrompt("concise");
      expect(concisePrompt).toContain("CONCISE");
      expect(concisePrompt).toContain("s.c.");
      expect(concisePrompt).toContain("bpn.");
      expect(concisePrompt).toContain("clientSummary");
    });

    it("differentiates detailed style with differential diagnosis and anatomical review", () => {
      const detailedPrompt = getSystemPrompt("detailed");
      expect(detailedPrompt).toContain("DETAILED");
      expect(detailedPrompt).toContain("diferenciálne diagnózy");
      expect(detailedPrompt).toContain("orgánových sústav");
    });

    it("differentiates standard clinical record format", () => {
      const standardPrompt = getSystemPrompt("standard");
      expect(standardPrompt).toContain("Štandardný klinický záznam");
      expect(standardPrompt).toContain("subjective");
      expect(standardPrompt).toContain("objective");
      expect(standardPrompt).toContain("assessment");
      expect(standardPrompt).toContain("plan");
    });
  });

  describe("2. Breed-Specific VHS (Vertebral Heart Score) Clinical Governance", () => {
    it("accurately classifies Boxer with VHS 11.4 as normal (brachycephalic threshold)", () => {
      // Standard canine limit is 10.5; Boxer threshold is up to 11.6
      const boxerRange = getReferenceRangeForBreed("Boxer");
      expect(boxerRange.max).toBe(11.6);

      // A Boxer with longAxis=80, shortAxis=56.8, t4=12 => vhsScore = (80+56.8)/12 = 11.4
      const result = calculateVhs({
        longAxisMm: 80,
        shortAxisMm: 56.8,
        t4VertebraLengthMm: 12,
        species: "canine",
        breed: "Boxer",
      });

      expect(result.status).toBe("normal");
      expect(result.clinicalInterpretationSk).toContain("Boxer");
      expect(result.clinicalInterpretationSk).toContain("bez rádiologických známok kardiomegálie");
    });

    it("classifies standard canine with VHS 11.4 as borderline cardiomegaly", () => {
      const result = calculateVhs({
        longAxisMm: 80,
        shortAxisMm: 56.8,
        t4VertebraLengthMm: 12,
        species: "canine",
      });

      expect(result.status).toBe("borderline");
      expect(result.clinicalInterpretationSk).toContain("ECHO a kontrola NT-proBNP");
    });

    it("evaluates Doberman with narrow threshold (max 10.2)", () => {
      const dobermanRange = getReferenceRangeForBreed("Doberman Pinscher");
      expect(dobermanRange.max).toBe(10.2);

      const result = calculateVhs({
        longAxisMm: 75,
        shortAxisMm: 51,
        t4VertebraLengthMm: 12, // 126 / 12 = 10.5
        species: "canine",
        breed: "Doberman",
      });

      expect(result.status).toBe("borderline");
    });
  });

  describe("3. Veterinary Pharmacology & Reference Range Dosing", () => {
    it("calculates carprofen reference range for canine safely", () => {
      const dose = calculateDose({
        species: "canine",
        weightKg: 15,
        drugId: "carprofen",
      });
      expect(dose.drug.name).toContain("Carprofen");
      expect(dose.doseLowMg).toBeGreaterThan(0);
      expect(dose.doseHighMg).toBeGreaterThanOrEqual(dose.doseLowMg);
      expect(dose.disclaimer).toContain("Reference ranges only");
    });

    it("rejects contraindicated feline carprofen dosing", () => {
      expect(() =>
        calculateDose({
          species: "feline",
          weightKg: 4.5,
          drugId: "carprofen",
        })
      ).toThrow(/No reference dose for Carprofen.*in feline/);
    });

    it("verifies formulary drug ID mapping for standard veterinary medications", () => {
      expect(isFormularyDrugId("carprofen")).toBe(true);
      expect(isFormularyDrugId("meloxicam")).toBe(true);
      expect(isFormularyDrugId("gabapentin")).toBe(true);
      expect(isFormularyDrugId("amoxicillin-clavulanate")).toBe(true);
      expect(isFormularyDrugId("maropitant")).toBe(true);
    });
  });

  describe("4. Human-In-The-Loop AI Audit Trail Integrity", () => {
    it("computes reproducible content hashes and detects tamper/modifications", () => {
      const originalDraft = {
        subjective: "Majiteľ uvádza zvracanie 2 dni",
        objective: "TT 38.6°C, brucho mäkké",
        assessment: "Akútna gastroenteritída",
        plan: "Cerenia 1mg/kg s.c., diéta Royal Canin Gastrointestinal",
      };

      const finalContent = {
        ...originalDraft,
        plan: "Cerenia 1mg/kg s.c., diéta Royal Canin Gastrointestinal, kontrola o 24 hodín",
      };

      const originalHash = generateContentHash(originalDraft);
      const finalHash = generateContentHash(finalContent);

      expect(originalHash).not.toBe(finalHash);

      const audit = buildAiConfirmationAuditTrail({
        actorId: "00000000-0000-0000-0000-000000000001",
        actorName: "MVDr. Martin Sýkora",
        entityType: "soap_note",
        entityId: "soap-uuid-1",
        originalAiDraft: originalDraft,
        finalClinicianContent: finalContent,
      });

      expect(audit.wasEditedByClinician).toBe(true);
      expect(audit.originalDraftHash).toBe(originalHash);
      expect(audit.confirmedContentHash).toBe(finalHash);
    });

    it("correctly handles sectional approvals", () => {
      const partial = resolveSoapSectionalStatus({
        subjective: true,
        objective: true,
        assessment: false,
        plan: false,
      });

      expect(partial.isFullyFinalized).toBe(false);
      expect(partial.isPartiallyApproved).toBe(true);
      expect(partial.finalizedSections).toEqual(["subjective", "objective"]);
      expect(partial.draftSections).toEqual(["assessment", "plan"]);
    });
  });

  describe("5. Role-Based Security in Agent Tools", () => {
    it("denies controlled substances log tool to non-veterinarians", async () => {
      const tool = getTool("get_controlled_substances_log");
      expect(tool).toBeDefined();

      const mockCtx: any = {
        db: {},
        practiceId: "00000000-0000-0000-0000-000000000001",
        userId: "user-123",
        userRole: "front_desk",
      };

      // assertAgentRole produces an English-first message including the Slovak
      // resource description. Verify both the FORBIDDEN code and Slovak text.
      let thrown: unknown;
      try {
        await tool!.execute({ limit: 10 }, mockCtx);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect((thrown as { code?: string }).code).toBe("FORBIDDEN");
      expect((thrown as Error).message).toMatch(/Kniha omamných/);
    });

    it("denies prescription creation tool to front desk and nurses", async () => {
      const tool = getTool("create_prescription");
      expect(tool).toBeDefined();

      const mockCtx: any = {
        db: {},
        practiceId: "00000000-0000-0000-0000-000000000001",
        userId: "user-123",
        userRole: "front_desk",
      };

      // assertAgentRole produces an English-first message including the Slovak
      // resource description. Verify both the FORBIDDEN code and Slovak text.
      let thrown: unknown;
      try {
        await tool!.execute(
          {
            patientId: "00000000-0000-0000-0000-000000000002",
            medicationName: "Amoxicillin",
            dosage: "250mg",
            frequency: "2x denne",
          },
          mockCtx,
        );
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect((thrown as { code?: string }).code).toBe("FORBIDDEN");
      expect((thrown as Error).message).toMatch(/Recepty môže vystavovať/);
    });
  });
});
