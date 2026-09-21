import { afterEach, describe, expect, it, vi } from "vitest";

const confirmationMocks = vi.hoisted(() => {
  class MockClinicianConfirmationError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "ClinicianConfirmationError";
    }
  }
  return {
    MockClinicianConfirmationError,
    issue: vi.fn(),
    consume: vi.fn(),
  };
});

vi.mock("@/lib/ai/clinician-confirmation", () => ({
  ClinicianConfirmationError: confirmationMocks.MockClinicianConfirmationError,
  issueClinicianConfirmation: confirmationMocks.issue,
  consumeClinicianConfirmation: confirmationMocks.consume,
}));

const auditMocks = vi.hoisted(() => ({ append: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/audit-ledger", () => ({
  appendAiAuditEvent: auditMocks.append,
}));

import {
  CONTROLLED_SUBSTANCE_AGENT_BLOCKED_MESSAGE,
  PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
  PrescriptionProposalError,
  assertMedicationAllowedThroughAgent,
  createConfirmedPrescription,
  preparePrescriptionProposal,
  prescriptionDraftHash,
} from "../prescription-proposal";

const PRACTICE_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000003";
const DOCTOR_ID = "00000000-0000-0000-0000-000000000004";

const draft = {
  patientId: PATIENT_ID,
  medicationName: "Meloxicam",
  dosage: "0.1mg/kg",
  frequency: "1x daily",
  instructions: null,
  startDate: "2026-09-21",
};

function proposalDb(selectRows: unknown[][]) {
  const rows = [...selectRows];
  const select = vi.fn(() => {
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      limit: vi.fn(async () => rows.shift() ?? []),
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve([]).then(resolve),
    };
    return builder;
  });
  const insertReturning = vi.fn(async () => [
    { ...draft, id: "unused", status: "active" },
  ]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  return {
    db: { select, insert } as never,
    insert,
    insertValues,
    insertReturning,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("prescription proposal — controlled substances", () => {
  it("refuses controlled substances with a bilingual clinician message", () => {
    expect(() => assertMedicationAllowedThroughAgent("Ketamín 10%")).toThrow(
      PrescriptionProposalError,
    );
    try {
      assertMedicationAllowedThroughAgent("Fentanyl 0.05mg/ml");
    } catch (error) {
      expect((error as PrescriptionProposalError).code).toBe("FORBIDDEN");
      expect((error as Error).message).toBe(
        CONTROLLED_SUBSTANCE_AGENT_BLOCKED_MESSAGE,
      );
    }
  });

  it("never issues an envelope (and never inserts) for controlled substances", async () => {
    const { db, insert } = proposalDb([[{ id: PATIENT_ID }]]);

    await expect(
      preparePrescriptionProposal(db, {
        practiceId: PRACTICE_ID,
        actorId: DOCTOR_ID,
        actorRole: "veterinarian",
        draft: { ...draft, medicationName: "Propofol 10mg/ml" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(confirmationMocks.issue).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("re-checks controlled substances at write time (defence in depth)", async () => {
    const { db, insert } = proposalDb([[{ id: PATIENT_ID }]]);

    await expect(
      createConfirmedPrescription(db, {
        practiceId: PRACTICE_ID,
        actorId: DOCTOR_ID,
        actorName: "MVDr. Novák",
        actorRole: "veterinarian",
        confirmationId: "11111111-1111-4111-8111-111111111111",
        prescriptionId: "22222222-2222-4222-8222-222222222222",
        draft: { ...draft, medicationName: "Fentanyl" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(confirmationMocks.consume).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("prescription proposal — roles", () => {
  it("denies technicians and front desk staff", async () => {
    for (const role of ["technician", "front_desk", "viewer", ""]) {
      const { db } = proposalDb([[{ id: PATIENT_ID }]]);
      await expect(
        preparePrescriptionProposal(db, {
          practiceId: PRACTICE_ID,
          actorId: DOCTOR_ID,
          actorRole: role,
          draft,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(confirmationMocks.issue).not.toHaveBeenCalled();
  });
});

describe("prescription proposal — two-phase flow", () => {
  it("prepares a proposal bound to a pre-generated id and content hash", async () => {
    const { db, insert } = proposalDb([[{ id: PATIENT_ID }]]);
    confirmationMocks.issue.mockResolvedValueOnce({
      id: "33333333-3333-4333-8333-333333333333",
      expiresAt: new Date("2026-09-21T12:15:00.000Z"),
    });

    const proposal = await preparePrescriptionProposal(db, {
      practiceId: PRACTICE_ID,
      actorId: DOCTOR_ID,
      actorRole: "veterinarian",
      draft,
    });

    expect(proposal.status).toBe("pending_confirmation");
    expect(proposal.requiresClinicianReview).toBe(true);
    expect(proposal.prescriptionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // The proposal is never written to the prescriptions table.
    expect(insert).not.toHaveBeenCalled();

    const issueArgs = confirmationMocks.issue.mock.calls[0][1];
    expect(issueArgs).toMatchObject({
      actionType: PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
      entityType: "prescription",
      entityId: proposal.prescriptionId,
      expectedRevision: 0,
      correlationId: "agent:create_prescription",
    });
    expect(issueArgs.originalDraftHash).toBe(
      prescriptionDraftHash(proposal.prescriptionId, draft),
    );
    expect(issueArgs.confirmedContentHash).toBe(issueArgs.originalDraftHash);
  });

  it("consumes the envelope, inserts once and appends the AI audit event", async () => {
    const { db, insert, insertValues } = proposalDb([[{ id: PATIENT_ID }]]);
    confirmationMocks.consume.mockResolvedValueOnce({ id: "consumed" });

    const prescriptionId = "44444444-4444-4444-8444-444444444444";
    const created = await createConfirmedPrescription(db, {
      practiceId: PRACTICE_ID,
      actorId: DOCTOR_ID,
      actorName: "MVDr. Novák",
      actorRole: "veterinarian",
      confirmationId: "55555555-5555-4555-8555-555555555555",
      prescriptionId,
      draft,
    });

    expect(confirmationMocks.consume).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: prescriptionId,
        practiceId: PRACTICE_ID,
        patientId: PATIENT_ID,
        prescribedBy: DOCTOR_ID,
        status: "active",
      }),
    );
    expect(auditMocks.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "prescription",
        entityId: prescriptionId,
        actionType: PRESCRIPTION_CONFIRMATION_ACTION_TYPE,
        wasEditedByClinician: false,
      }),
    );
    expect(created).toBeDefined();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("fails closed and never inserts when the envelope cannot be consumed", async () => {
    const { db, insert } = proposalDb([[{ id: PATIENT_ID }]]);
    confirmationMocks.consume.mockRejectedValueOnce(
      new confirmationMocks.MockClinicianConfirmationError(
        "ALREADY_CONSUMED",
        "Confirmation token has already been consumed (replay attempt rejected).",
      ),
    );

    await expect(
      createConfirmedPrescription(db, {
        practiceId: PRACTICE_ID,
        actorId: DOCTOR_ID,
        actorName: "MVDr. Novák",
        actorRole: "veterinarian",
        confirmationId: "66666666-6666-4666-8666-666666666666",
        prescriptionId: "77777777-7777-4777-8777-777777777777",
        draft,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(insert).not.toHaveBeenCalled();
    expect(auditMocks.append).not.toHaveBeenCalled();
  });

  it("reports a missing patient as NOT_FOUND without issuing an envelope", async () => {
    const { db } = proposalDb([[]]);

    await expect(
      preparePrescriptionProposal(db, {
        practiceId: PRACTICE_ID,
        actorId: DOCTOR_ID,
        actorRole: "veterinarian",
        draft,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(confirmationMocks.issue).not.toHaveBeenCalled();
  });
});
