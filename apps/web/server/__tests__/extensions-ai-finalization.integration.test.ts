import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  uploadFile: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
  dispatchDischargeWebhookAfterCommit: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  readPrimaryObject: mocks.readPrimaryObject,
  uploadFile: mocks.uploadFile,
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

vi.mock("@/lib/discharge-webhooks", () => ({
  dispatchDischargeWebhookAfterCommit: mocks.dispatchDischargeWebhookAfterCommit,
  dischargeCreatedWebhookPayload: vi.fn(() => ({})),
}));

const { imagingRouter } = await import("../routers/extensions/imaging");
const { voiceRouter } = await import("../routers/extensions/voice");
const { dischargeRouter } = await import("../routers/extensions/discharge");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const APPOINTMENT_ID = "00000000-0000-0000-0000-000000000003";
const ANALYSIS_ID = "00000000-0000-0000-0000-000000000004";
const DICTATION_ID = "00000000-0000-0000-0000-000000000005";
const REPORT_ID = "00000000-0000-0000-0000-000000000006";

function createMockDb(rowToReturn: unknown) {
  const returnArray = rowToReturn ? [rowToReturn] : [];

  const createSelectChain = () => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const afterWhere = {
          limit: vi.fn(() => {
            const afterLimit = {
              for: vi.fn(async () => returnArray),
              then: (resolve: (v: unknown) => unknown) => Promise.resolve(returnArray).then(resolve),
            };
            return afterLimit;
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => returnArray),
          })),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(returnArray).then(resolve),
        };
        return afterWhere;
      }),
    })),
  });

  const tx: Record<string, unknown> = {
    execute: vi.fn(async () => []),
    select: vi.fn(createSelectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => returnArray),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "mock-id", status: "CONSUMED" }]),
      })),
    })),
  };
  // Support nested savepoint transactions
  tx.transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(tx));

  const db = {
    execute: vi.fn(async () => []),
    select: vi.fn(createSelectChain),
    transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  };

  return { db, tx };
}

function caller<T extends typeof imagingRouter | typeof voiceRouter | typeof dischargeRouter>(
  router: T,
  db: unknown,
  role = "veterinarian",
) {
  const session = {
    user: {
      id: USER_ID,
      email: "doctor@example.com",
      name: "Dr. Veterinarian",
      role,
      practiceId: PRACTICE_ID,
    },
  };
  return router.createCaller({ db, session } as never) as ReturnType<T["createCaller"]>;
}

describe("Extensions AI Finalization — Concurrency & Security Hardening", () => {
  describe("imagingRouter.confirmAnalysis", () => {
    it("denies unprivileged role 'front_desk'", async () => {
      const { db } = createMockDb(null);
      const client = caller(imagingRouter, db, "front_desk");

      await expect(
        client.confirmAnalysis({
          analysisId: ANALYSIS_ID,
          clinicianConfirmed: true,
          finalReport: "Confirmed radiological findings.",
        }),
      ).rejects.toThrow();
    });

    it("denies unprivileged role 'technician'", async () => {
      const { db } = createMockDb(null);
      const client = caller(imagingRouter, db, "technician");

      await expect(
        client.confirmAnalysis({
          analysisId: ANALYSIS_ID,
          clinicianConfirmed: true,
          finalReport: "Confirmed radiological findings.",
        }),
      ).rejects.toThrow();
    });

    it("rejects when analysis is already finalized (status COMPLETED)", async () => {
      const completedRow = {
        id: ANALYSIS_ID,
        practiceId: PRACTICE_ID,
        status: "COMPLETED",
        revision: 1,
        result: "Draft findings",
        imageType: "xray",
      };

      const { db } = createMockDb(completedRow);
      const client = caller(imagingRouter, db, "veterinarian");

      await expect(
        client.confirmAnalysis({
          analysisId: ANALYSIS_ID,
          expectedRevision: 1,
          clinicianConfirmed: true,
          finalReport: "Re-confirm attempt",
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Analysis is already finalized.",
      });
    });

    it("rejects when expectedRevision does not match current analysis revision (optimistic concurrency)", async () => {
      const row = {
        id: ANALYSIS_ID,
        practiceId: PRACTICE_ID,
        status: "PENDING",
        revision: 2, // Current in DB is 2
        result: "Draft findings",
        imageType: "xray",
      };

      const { db } = createMockDb(row);
      const client = caller(imagingRouter, db, "veterinarian");

      // Caller expects revision 1
      await expect(
        client.confirmAnalysis({
          analysisId: ANALYSIS_ID,
          expectedRevision: 1,
          clinicianConfirmed: true,
          finalReport: "Stale edit confirmation",
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("voiceRouter.saveAsSoapNote", () => {
    it("denies unprivileged role 'front_desk'", async () => {
      const { db } = createMockDb(null);
      const client = caller(voiceRouter, db, "front_desk");

      await expect(
        client.saveAsSoapNote({
          dictationId: DICTATION_ID,
          subjective: "S",
          objective: "O",
          assessment: "A",
          plan: "P",
          clinicianConfirmed: true,
        }),
      ).rejects.toThrow();
    });

    it("denies unprivileged role 'technician'", async () => {
      const { db } = createMockDb(null);
      const client = caller(voiceRouter, db, "technician");

      await expect(
        client.saveAsSoapNote({
          dictationId: DICTATION_ID,
          subjective: "S",
          objective: "O",
          assessment: "A",
          plan: "P",
          clinicianConfirmed: true,
        }),
      ).rejects.toThrow();
    });

    it("rejects if voice dictation was already finalized into a SOAP note", async () => {
      const dictationRow = {
        id: DICTATION_ID,
        practiceId: PRACTICE_ID,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        soapNoteId: "00000000-0000-0000-0000-000000000088", // already finalized
        revision: 1,
        subjective: "S",
        objective: "O",
        assessment: "A",
        plan: "P",
      };

      const { db } = createMockDb(dictationRow);
      const client = caller(voiceRouter, db, "veterinarian");

      await expect(
        client.saveAsSoapNote({
          dictationId: DICTATION_ID,
          subjective: "S",
          objective: "O",
          assessment: "A",
          plan: "P",
          clinicianConfirmed: true,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Voice dictation has already been finalized into a SOAP note.",
      });
    });

    it("rejects if expectedRevision does not match locked revision (optimistic concurrency)", async () => {
      const dictationRow = {
        id: DICTATION_ID,
        practiceId: PRACTICE_ID,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        soapNoteId: null,
        revision: 3, // In DB it's 3
        subjective: "S",
        objective: "O",
        assessment: "A",
        plan: "P",
      };

      const { db } = createMockDb(dictationRow);
      const client = caller(voiceRouter, db, "veterinarian");

      await expect(
        client.saveAsSoapNote({
          dictationId: DICTATION_ID,
          expectedRevision: 1, // Stale revision
          subjective: "S",
          objective: "O",
          assessment: "A",
          plan: "P",
          clinicianConfirmed: true,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("dischargeRouter.save", () => {
    it("denies unprivileged role 'front_desk' when finalizing", async () => {
      const { db } = createMockDb(null);
      const client = caller(dischargeRouter, db, "front_desk");

      await expect(
        client.save({
          petName: "Luna",
          diagnosis: "Otitis externa",
          reportText: "Clean ears and apply drops.",
          status: "finalized",
          clinicianConfirmed: true,
        }),
      ).rejects.toThrow();
    });

    it("rejects modifying an already finalized discharge report", async () => {
      const existingReport = {
        id: REPORT_ID,
        practiceId: PRACTICE_ID,
        status: "finalized", // Already finalized
        revision: 1,
        petName: "Luna",
        diagnosis: "Otitis",
      };

      const { db } = createMockDb(existingReport);
      const client = caller(dischargeRouter, db, "veterinarian");

      await expect(
        client.save({
          id: REPORT_ID,
          expectedRevision: 1,
          petName: "Luna",
          diagnosis: "Otitis",
          reportText: "Modified report text",
          clinicianConfirmed: true,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Discharge report is already finalized.",
      });
    });

    it("rejects when expectedRevision does not match current discharge revision", async () => {
      const existingReport = {
        id: REPORT_ID,
        practiceId: PRACTICE_ID,
        status: "draft",
        revision: 4, // DB has revision 4
        petName: "Luna",
        diagnosis: "Otitis",
      };

      const { db } = createMockDb(existingReport);
      const client = caller(dischargeRouter, db, "veterinarian");

      await expect(
        client.save({
          id: REPORT_ID,
          expectedRevision: 2, // Caller expects revision 2
          petName: "Luna",
          diagnosis: "Otitis",
          reportText: "Updated instructions",
          clinicianConfirmed: false,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });
});
