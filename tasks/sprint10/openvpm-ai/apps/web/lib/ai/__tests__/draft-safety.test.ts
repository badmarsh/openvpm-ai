import { describe, expect, it } from "vitest";
import {
  assertClinicianConfirmed,
  resolveAiRecordStatus,
  assertAiMayWriteToSoapNote,
  buildAiConfirmationAuditTrail,
  generateContentHash,
  resolveSoapSectionalStatus,
  AiDraftSafetyError,
} from "../draft-safety";

describe("draft-safety Human-in-the-loop contract", () => {
  it("assertClinicianConfirmed passes only for true", () => {
    expect(() => assertClinicianConfirmed(true)).not.toThrow();
    expect(() => assertClinicianConfirmed(false)).toThrow(AiDraftSafetyError);
    expect(() => assertClinicianConfirmed(undefined)).toThrow(AiDraftSafetyError);
    expect(() => assertClinicianConfirmed(null)).toThrow(AiDraftSafetyError);
    expect(() => assertClinicianConfirmed("true")).toThrow(AiDraftSafetyError);
  });

  it("resolveAiRecordStatus stays draft unless explicitly confirmed", () => {
    expect(resolveAiRecordStatus({ requestedStatus: "finalized", clinicianConfirmed: false })).toBe("draft");
    expect(resolveAiRecordStatus({ requestedStatus: "finalized", clinicianConfirmed: undefined })).toBe("draft");
    expect(resolveAiRecordStatus({ requestedStatus: "finalized", clinicianConfirmed: true })).toBe("finalized");
    expect(resolveAiRecordStatus({ requestedStatus: "draft", clinicianConfirmed: true })).toBe("draft");
  });

  it("assertAiMayWriteToSoapNote blocks writes to finalized records", () => {
    expect(() => assertAiMayWriteToSoapNote({ status: "draft" })).not.toThrow();
    expect(() => assertAiMayWriteToSoapNote({ status: "finalized" })).toThrow(AiDraftSafetyError);
  });
});

describe("draft-safety Audit Trail & Sectional Approval", () => {
  it("generates deterministic SHA-256 hash for content", () => {
    const hash1 = generateContentHash("Sample SOAP note text");
    const hash2 = generateContentHash("Sample SOAP note text");
    const hash3 = generateContentHash("Different text");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });

  it("builds audit trail and detects whether clinician modified the draft", () => {
    const auditUnmodified = buildAiConfirmationAuditTrail({
      actorId: "00000000-0000-0000-0000-000000000001",
      actorName: "Dr. Veterinarian",
      entityType: "soap_note",
      entityId: "soap-123",
      originalAiDraft: "Initial AI Subjective & Objective",
      finalClinicianContent: "Initial AI Subjective & Objective",
    });
    expect(auditUnmodified.wasEditedByClinician).toBe(false);

    const auditModified = buildAiConfirmationAuditTrail({
      actorId: "00000000-0000-0000-0000-000000000001",
      actorName: "Dr. Veterinarian",
      entityType: "soap_note",
      entityId: "soap-123",
      originalAiDraft: "Initial AI Subjective",
      finalClinicianContent: "Edited Subjective with manual corrections",
    });
    expect(auditModified.wasEditedByClinician).toBe(true);
  });

  it("resolves sectional status for partial vs full approvals", () => {
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

    const full = resolveSoapSectionalStatus({
      subjective: true,
      objective: true,
      assessment: true,
      plan: true,
    });
    expect(full.isFullyFinalized).toBe(true);
    expect(full.isPartiallyApproved).toBe(false);
    expect(full.draftSections).toEqual([]);
  });
});
