import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "@/lib/voice/soap-formatter";
import { calculateVhs, getReferenceRangeForBreed } from "@/lib/imaging/vhs-calculator";
import { calculateDose, isFormularyDrugId, FORMULARY, DOSING_WEIGHT_MAX_KG } from "@/lib/dosing";
import {
  buildAiConfirmationAuditTrail,
  generateContentHash,
  resolveSoapSectionalStatus,
  assertAiMayWriteToSoapNote,
  isClinicianConfirmed,
  resolveAiRecordStatus,
} from "@/lib/ai/draft-safety";
import {
  buildSoapDraftPrompt,
  parseSoapDraft,
  SOAP_DRAFT_VISIT_CONTEXT_MAX_LENGTH,
} from "@/lib/ai/soap-draft";
import { SOAP_SECTION_MAX_LENGTH } from "@/lib/records/soap-content";
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

  describe("6. Dosing Fail-Closed Boundaries (Overdose Prevention)", () => {
    it("rejects non-positive and non-finite weights instead of computing a dose", () => {
      for (const weightKg of [0, -4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          calculateDose({ species: "canine", weightKg, drugId: "carprofen" })
        ).toThrow(/Weight must be a positive number/);
      }
    });

    it("rejects implausible weights above 200kg (unit-confusion guard)", () => {
      // 250 "kg" is almost certainly grams entered as kilograms — a 1000x
      // overdose vector. The calculator refuses instead of scaling linearly.
      expect(DOSING_WEIGHT_MAX_KG).toBe(200);
      expect(() =>
        calculateDose({ species: "canine", weightKg: 250, drugId: "carprofen" })
      ).toThrow(/plausible range.*units/);
    });

    it("rejects unknown drug IDs instead of guessing a dose", () => {
      expect(() =>
        calculateDose({ species: "canine", weightKg: 15, drugId: "not-a-real-drug" })
      ).toThrow(/Unknown drug/);
    });

    it("caps feline meloxicam at the maximum single dose with explicit warnings", () => {
      // 5 kg cat at 0.05–0.1 mg/kg would naively yield up to 0.5 mg;
      // repeated NSAID dosing in cats is high-risk, so the formulary caps
      // the single dose at 0.3 mg and says so explicitly.
      const dose = calculateDose({ species: "feline", weightKg: 5, drugId: "meloxicam" });
      expect(dose.cappedByMax).toBe(true);
      expect(dose.doseHighMg).toBe(0.3);
      expect(dose.doseLowMg).toBeLessThanOrEqual(0.3);
      expect(dose.warnings.some((w) => w.includes("maximum single dose of 0.3 mg"))).toBe(true);
      expect(dose.warnings.some((w) => w.includes("Single-dose use"))).toBe(true);
    });

    it("refuses cross-species extrapolation with an explicit do-not-extrapolate message", () => {
      expect(() =>
        calculateDose({ species: "feline", weightKg: 4, drugId: "carprofen" })
      ).toThrow(/Do not extrapolate across species/);
    });
  });

  describe("7. Draft Lifecycle Safety (Fail-Closed Confirmation)", () => {
    it("allows AI writes to open drafts only — finalized/closed/archived notes are immutable", () => {
      expect(() => assertAiMayWriteToSoapNote({ status: "draft" })).not.toThrow();
      for (const status of ["finalized", "closed", "archived", "signed", ""]) {
        expect(() => assertAiMayWriteToSoapNote({ status })).toThrow();
      }
    });

    it("rejects truthy non-confirmations — only explicit true or a valid envelope counts", () => {
      expect(isClinicianConfirmed(true)).toBe(true);
      expect(
        isClinicianConfirmed({ confirmationId: "b3d9f2a1-4c6e-4a8f-9e1d-2b5c7d9f0a12" })
      ).toBe(true);
      for (const bogus of ["yes", "true", 1, {}, { confirmationId: "" }, { confirmationId: "   " }, null, undefined, false]) {
        expect(isClinicianConfirmed(bogus)).toBe(false);
      }
    });

    it("keeps records as drafts unless finalization was explicitly requested AND confirmed", () => {
      expect(resolveAiRecordStatus({})).toBe("draft");
      expect(resolveAiRecordStatus({ requestedStatus: "finalized" })).toBe("draft");
      expect(
        resolveAiRecordStatus({ requestedStatus: "finalized", clinicianConfirmed: "yes" })
      ).toBe("draft");
      expect(
        resolveAiRecordStatus({ requestedStatus: "finalized", clinicianConfirmed: true })
      ).toBe("finalized");
    });
  });

  describe("8. Prompt Construction & Draft Parse Safety", () => {
    const baseContext = {
      patient: { name: "Rex", species: "canine", breed: "Labrador", sex: "M", dob: "2020-01-01" },
      allergies: [],
      activeProblems: [],
      latestVitals: null,
    };

    it("truncates free-form visitContext to the documented 2000-character bound", () => {
      expect(SOAP_DRAFT_VISIT_CONTEXT_MAX_LENGTH).toBe(2000);
      const oversized = "x".repeat(5000) + "INJECTED-INSTRUCTIONS-AT-TAIL";
      const prompt = buildSoapDraftPrompt({ ...baseContext, visitContext: oversized });
      // The tail (where smuggled instructions would sit) must not survive.
      expect(prompt).not.toContain("INJECTED-INSTRUCTIONS-AT-TAIL");
      expect(prompt).toContain("x".repeat(2000));
      expect(prompt.length).toBeLessThan(5000);
    });

    it("returns null for non-JSON and empty model output instead of throwing or hallucinating", () => {
      expect(parseSoapDraft("not json at all")).toBeNull();
      expect(parseSoapDraft("")).toBeNull();
      expect(parseSoapDraft("```json\n{ not valid }\n```")).toBeNull();
      expect(parseSoapDraft(JSON.stringify({ subjective: "", objective: "", assessment: "", plan: "" }))).toBeNull();
      expect(parseSoapDraft(JSON.stringify(["subjective"]))).toBeNull();
    });

    it("tolerates markdown fences but coerces non-string sections to empty (no crash)", () => {
      const draft = parseSoapDraft(
        'Here is the note:\n```json\n' +
          JSON.stringify({
            subjective: "Owner reports vomiting",
            objective: 42,
            assessment: null,
            plan: { nested: "object" },
          }) +
          '\n```\nDone.'
      );
      expect(draft).not.toBeNull();
      expect(draft!.subjective).toBe("Owner reports vomiting");
      expect(draft!.objective).toBe("");
      expect(draft!.assessment).toBe("");
      expect(draft!.plan).toBe("");
    });

    it("truncates overlong sections to SOAP_SECTION_MAX_LENGTH", () => {
      const draft = parseSoapDraft(
        JSON.stringify({
          subjective: "y".repeat(SOAP_SECTION_MAX_LENGTH + 500),
          objective: "ok",
          assessment: "ok",
          plan: "ok",
        })
      );
      expect(draft).not.toBeNull();
      expect(draft!.subjective).toHaveLength(SOAP_SECTION_MAX_LENGTH);
    });
  });
});
