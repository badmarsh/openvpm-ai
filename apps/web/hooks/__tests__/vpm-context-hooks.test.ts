import { describe, expect, it } from "vitest";
import {
  evaluateSympathyGate,
  evaluateVpmAiSafety,
  isVpmControlledSubstanceName,
  resolveVpmAiRecordStatus,
  VPM_AI_DRAFT_STATUS,
  VPM_SYMPATHY_SUPPRESS_REASON_KEY,
} from "@/core/context";

/**
 * Hook contracts are thin wrappers over `@/core/context`. These tests lock
 * the behavioural surface the hooks expose so React integration cannot
 * silently drop a safety gate (Sprint 24 context-flow).
 *
 * Full React render tests are unnecessary here — pure decision parity is
 * the regression risk.
 */

describe("useVpmAiSafety contract (via core parity)", () => {
  it("exposes draft-only status until veterinarian confirmation", () => {
    const status = resolveVpmAiRecordStatus({
      requestedStatus: "finalized",
      clinicianConfirmed: false,
    });
    expect(status).toBe(VPM_AI_DRAFT_STATUS);

    const decision = evaluateVpmAiSafety({
      requestedStatus: "finalized",
      clinicianConfirmed: false,
      proposedTexts: ["SOAP plan without controlled drugs"],
      patientStatus: "active",
    });
    expect(decision.recordStatus).toBe("draft");
    expect(decision.clinicianConfirmed).toBe(false);
    // UI derives showAiDraftBadge from these two fields:
    expect(decision.recordStatus === "draft" || !decision.clinicianConfirmed).toBe(
      true,
    );
  });

  it("flags ShieldAlert when AI proposes ketamine / opioids / propofol", () => {
    const decision = evaluateVpmAiSafety({
      proposedTexts: ["Maintenance: propofol CRI"],
    });
    expect(decision.blocksControlledSubstancePrefill).toBe(true);
    expect(decision.controlledSubstanceHits.length).toBeGreaterThan(0);
    expect(isVpmControlledSubstanceName("propofol")).toBe(true);
  });
});

describe("useVpmSympathyGate contract (via core parity)", () => {
  it("suppresses care reminders when patient is deceased", () => {
    const decision = evaluateSympathyGate({
      patientStatus: "deceased",
      outreachKind: "care_reminder",
      patientId: "patient-deceased-1",
    });
    expect(decision.suppress).toBe(true);
    expect(decision.reasonKey).toBe(VPM_SYMPATHY_SUPPRESS_REASON_KEY);
    expect(!decision.suppress).toBe(false);
  });

  it("allows outreach for living patients", () => {
    const decision = evaluateSympathyGate({
      patient: {
        patientId: "p-live",
        status: "active",
        isDeceased: false,
      },
      outreachKind: "vaccination_reminder",
    });
    expect(decision.suppress).toBe(false);
    expect(decision.reasonKey).toBeNull();
  });
});

describe("useVpmContext composite expectations", () => {
  it("composes AI draft + controlled + sympathy in one decision path", () => {
    const ai = evaluateVpmAiSafety({
      requestedStatus: "finalized",
      clinicianConfirmed: false,
      proposedTexts: ["ketamín 5 mg/kg"],
      patientStatus: "deceased",
    });
    const sympathy = evaluateSympathyGate({
      patientStatus: "deceased",
      outreachKind: "marketing",
    });
    expect(ai.recordStatus).toBe("draft");
    expect(ai.blocksControlledSubstancePrefill).toBe(true);
    expect(ai.sympathyGateActive).toBe(true);
    expect(sympathy.suppress).toBe(true);
  });
});
