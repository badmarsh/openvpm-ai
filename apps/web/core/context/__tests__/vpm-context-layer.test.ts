import { describe, expect, it } from "vitest";
import { AI_DRAFT_STATUS } from "@/lib/ai/draft-safety";
import {
  EMPTY_VPM_WORKSPACE_CONTEXT,
  VPM_AI_DRAFT_STATUS,
  VPM_AI_FINALIZED_STATUS,
  VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY,
  VPM_SYMPATHY_SUPPRESS_REASON_KEY,
  applyZeroAiPrefillForControlledSubstance,
  assertVpmAiMayWriteRecord,
  assertVpmClinicianConfirmed,
  buildVpmPatientContext,
  clearVpmClinicalScope,
  createEmptyVpmWorkspaceContext,
  detectControlledSubstancesInText,
  evaluateSympathyGate,
  evaluateVpmAiSafety,
  hasVpmActivePatient,
  hasVpmPracticeScope,
  isVpmClinicianConfirmed,
  isVpmControlledSubstanceName,
  isVpmPatientDeceased,
  maySendAutomatedOutreach,
  patchVpmWorkspace,
  resolveVpmAiRecordStatus,
  setVpmActor,
  setVpmPatientFromStatus,
  stripControlledSubstancePrefills,
} from "@/core/context";

/**
 * Sprint 24 — Finalize VPM Context Layer
 * Ensures openvpm/context-flow safety gates stay deterministic.
 */

describe("VPM controlled substances gate (Zákon 139/1998 Z. z.)", () => {
  it("detects ketamine, opioids, and propofol (ZERO AI prefill)", () => {
    expect(isVpmControlledSubstanceName("Ketamín 10%")).toBe(true);
    expect(isVpmControlledSubstanceName("ketamine")).toBe(true);
    expect(isVpmControlledSubstanceName("Fentanyl citrate")).toBe(true);
    expect(isVpmControlledSubstanceName("Propofol Lipuro")).toBe(true);
    expect(isVpmControlledSubstanceName("Butorfanol 10 mg")).toBe(true);
    expect(isVpmControlledSubstanceName("Meloxicam 0.2 mg/kg")).toBe(false);
    expect(isVpmControlledSubstanceName("")).toBe(false);
  });

  it("blanks AI prefill for controlled substance labels", () => {
    expect(
      applyZeroAiPrefillForControlledSubstance(
        { dose: "5 mg/kg" },
        "Ketamidor",
      ),
    ).toBeNull();
    expect(
      applyZeroAiPrefillForControlledSubstance(
        { dose: "0.1 mg/kg" },
        "Meloxicam",
      ),
    ).toEqual({ dose: "0.1 mg/kg" });
  });

  it("strips controlled lines from AI medication proposals", () => {
    const { safe, blocked } = stripControlledSubstancePrefills([
      { name: "Amoxicillin" },
      { name: "Propofol" },
      { medicationName: "Metacam" },
      { text: "fentanyl bolus" },
    ]);
    expect(safe.map((i) => i.name ?? i.medicationName)).toEqual([
      "Amoxicillin",
      "Metacam",
    ]);
    expect(blocked).toHaveLength(2);
  });

  it("scans multi-drug free text", () => {
    const hits = detectControlledSubstancesInText(
      "Plan: meloxicam 0.1 mg/kg; ketamín 5 mg/kg IV",
      "propofol induction",
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

describe("VPM Sympathy Gate", () => {
  it("flags deceased and euthanized statuses", () => {
    expect(isVpmPatientDeceased("deceased")).toBe(true);
    expect(isVpmPatientDeceased("euthanized")).toBe(true);
    expect(isVpmPatientDeceased("EUTHANISED")).toBe(true);
    expect(isVpmPatientDeceased("active")).toBe(false);
    expect(isVpmPatientDeceased(null)).toBe(false);
  });

  it("suppresses automated outreach for deceased patients", () => {
    const decision = evaluateSympathyGate({
      patientStatus: "deceased",
      patientId: "p-1",
      outreachKind: "vaccination_reminder",
    });
    expect(decision.suppress).toBe(true);
    expect(decision.reasonKey).toBe(VPM_SYMPATHY_SUPPRESS_REASON_KEY);
    expect(maySendAutomatedOutreach({
      patientStatus: "deceased",
      outreachKind: "review_request",
    })).toBe(false);
    expect(maySendAutomatedOutreach({
      patientStatus: "active",
      outreachKind: "care_reminder",
    })).toBe(true);
  });

  it("builds patient context with isDeceased derived from status", () => {
    const living = buildVpmPatientContext({
      patientId: "p1",
      name: "Dunčo",
      status: "active",
    });
    expect(living.isDeceased).toBe(false);
    const dead = buildVpmPatientContext({
      patientId: "p2",
      status: "deceased",
    });
    expect(dead.isDeceased).toBe(true);
  });
});

describe("VPM AI safety (Zákon 39/2007 Z. z. — draft until signed)", () => {
  it("keeps AI output in draft without clinician confirmation", () => {
    expect(
      resolveVpmAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: false,
      }),
    ).toBe(VPM_AI_DRAFT_STATUS);
    expect(
      resolveVpmAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: undefined,
      }),
    ).toBe(VPM_AI_DRAFT_STATUS);
    expect(
      resolveVpmAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: true,
      }),
    ).toBe(VPM_AI_FINALIZED_STATUS);
    expect(
      resolveVpmAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: { confirmationId: "00000000-0000-0000-0000-000000000099" },
      }),
    ).toBe(VPM_AI_FINALIZED_STATUS);
  });

  it("aligns draft constant with lib/ai draft-safety", () => {
    expect(VPM_AI_DRAFT_STATUS).toBe(AI_DRAFT_STATUS);
  });

  it("evaluateVpmAiSafety composes all three gates", () => {
    const decision = evaluateVpmAiSafety({
      requestedStatus: "finalized",
      clinicianConfirmed: false,
      proposedTexts: ["Induce with propofol 4 mg/kg"],
      patientStatus: "deceased",
    });
    expect(decision.recordStatus).toBe("draft");
    expect(decision.clinicianConfirmed).toBe(false);
    expect(decision.blocksControlledSubstancePrefill).toBe(true);
    expect(decision.sympathyGateActive).toBe(true);
    expect(decision.reasonKeys).toContain(VPM_CONTROLLED_SUBSTANCE_BLOCK_REASON_KEY);
    expect(decision.reasonKeys).toContain(VPM_SYMPATHY_SUPPRESS_REASON_KEY);
    expect(decision.allowed).toBe(true);
  });

  it("assertVpmClinicianConfirmed and draft-only write guard", () => {
    expect(() => assertVpmClinicianConfirmed(true)).not.toThrow();
    expect(() => assertVpmClinicianConfirmed(false)).toThrow(/clinician must explicitly confirm/i);
    expect(() => assertVpmAiMayWriteRecord({ status: "draft" })).not.toThrow();
    expect(() => assertVpmAiMayWriteRecord({ status: "finalized" })).toThrow(/finalized clinical record/i);
  });

  it("isVpmClinicianConfirmed rejects loose truthy values", () => {
    expect(isVpmClinicianConfirmed("true")).toBe(false);
    expect(isVpmClinicianConfirmed(1)).toBe(false);
    expect(isVpmClinicianConfirmed({ confirmationId: "  " })).toBe(false);
  });
});

describe("VPM workspace context reducers", () => {
  it("starts empty and accepts actor + patient patches", () => {
    let ctx = createEmptyVpmWorkspaceContext();
    expect(hasVpmPracticeScope(ctx)).toBe(false);
    expect(ctx.patient).toBeNull();

    ctx = setVpmActor(ctx, {
      userId: "u1",
      practiceId: "pr1",
      role: "veterinarian",
      displayName: "MVDr. Test",
    });
    expect(hasVpmPracticeScope(ctx)).toBe(true);

    ctx = setVpmPatientFromStatus(ctx, {
      patientId: "p1",
      name: "Micka",
      status: "active",
      species: "feline",
    });
    expect(hasVpmActivePatient(ctx)).toBe(true);
    expect(ctx.patient?.isDeceased).toBe(false);

    ctx = setVpmPatientFromStatus(ctx, {
      patientId: "p1",
      status: "deceased",
    });
    expect(hasVpmActivePatient(ctx)).toBe(false);
    expect(ctx.patient?.isDeceased).toBe(true);

    ctx = clearVpmClinicalScope(ctx);
    expect(ctx.patient).toBeNull();
    expect(ctx.actor?.practiceId).toBe("pr1");
  });

  it("patchVpmWorkspace treats null as clear and undefined as keep", () => {
    let ctx = patchVpmWorkspace(EMPTY_VPM_WORKSPACE_CONTEXT, {
      actor: { userId: "u", practiceId: "p", role: "admin" },
      client: { clientId: "c1", displayName: "Novák" },
    });
    ctx = patchVpmWorkspace(ctx, { client: null });
    expect(ctx.client).toBeNull();
    expect(ctx.actor?.userId).toBe("u");
  });
});
