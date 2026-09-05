import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Clinical AI human-in-the-loop safety suite.
 *
 * Guarantees that no AI surface (voice transcription, imaging evaluation,
 * SOAP drafting, discharge report, external scribe) can autonomously:
 *   a) promote AI output past "draft" without an explicit clinician
 *      confirmation event;
 *   b) sign / finalize a record on a clinician's behalf;
 *   c) trigger owner communications (recall / marketing / post-op) for a
 *      deceased patient — the sympathy gate must win.
 *
 * Tests run against the real routers with a scripted database double. No
 * router logic is mocked; only the DB, storage, and model providers are.
 */

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  uploadFile: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
  recordUsage: vi.fn(async () => undefined),
  dispatchWebhookEvent: vi.fn(async () => undefined),
  schedulePostopCheckIn: vi.fn(async () => undefined),
  applySympathyGate: vi.fn(async () => ({ blocked: 0 })),
  detectAndTriggerDentalRecall: vi.fn(async () => true),
  checkAndTriggerSeniorMilestone: vi.fn(async () => true),
  recordAuditLog: vi.fn(async () => undefined),
  rateLimit: vi.fn(async () => ({
    success: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 60_000),
  })),
  lockPracticeForExternalSideEffects: vi.fn(async () => true),
  readHostedAiAccess: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/s3", () => ({
  readPrimaryObject: mocks.readPrimaryObject,
  uploadFile: mocks.uploadFile,
}));
vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: mocks.recordUsage }));
vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: mocks.dispatchWebhookEvent,
}));
vi.mock("@/lib/marketing/messaging", () => ({
  schedulePostopCheckIn: mocks.schedulePostopCheckIn,
  applySympathyGate: mocks.applySympathyGate,
  detectAndTriggerDentalRecall: mocks.detectAndTriggerDentalRecall,
  checkAndTriggerSeniorMilestone: mocks.checkAndTriggerSeniorMilestone,
}));
vi.mock("@/lib/audit", () => ({ recordAuditLog: mocks.recordAuditLog }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/recovery-hold", () => ({
  lockPracticeForExternalSideEffects: mocks.lockPracticeForExternalSideEffects,
  RECOVERY_HOLD_BLOCK_MESSAGE: "recovery hold",
}));
vi.mock("@/lib/billing/ai-access", () => ({
  readHostedAiAccess: mocks.readHostedAiAccess,
}));

const { voiceRouter } = await import("../routers/extensions/voice");
const { imagingRouter } = await import("../routers/extensions/imaging");
const { dischargeRouter } = await import("../routers/extensions/discharge");
const { aiRouter } = await import("../routers/ai");
const {
  resolveAiRecordStatus,
  assertClinicianConfirmed,
  assertAiMayWriteToSoapNote,
  AiDraftSafetyError,
} = await import("@/lib/ai/draft-safety");
const { SoapNoteCreateSchema } = await import("@/lib/compat/openvpm/schema");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const APPOINTMENT_ID = "00000000-0000-0000-0000-000000000003";
const DICTATION_ID = "00000000-0000-0000-0000-000000000004";
const ANALYSIS_ID = "00000000-0000-0000-0000-000000000005";
const NOTE_ID = "00000000-0000-0000-0000-000000000006";
const CLIENT_ID = "00000000-0000-0000-0000-000000000007";
const REPORT_ID = "00000000-0000-0000-0000-000000000008";

const IN_EXAM_APPOINTMENT = {
  id: APPOINTMENT_ID,
  doctorId: USER_ID,
  status: "in_exam",
};

type Db = Record<string, unknown>;

function createDb(opts?: {
  selectResults?: unknown[][];
  insertedRows?: unknown[];
  updateResults?: unknown[];
}) {
  const selectResults = [...(opts?.selectResults ?? [])];
  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const afterOrderBy = {
      limit: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    const afterWhere = {
      limit: vi.fn(async () => result),
      for: vi.fn(async () => result),
      orderBy: vi.fn(() => afterOrderBy),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    const afterLimit = {
      for: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    afterWhere.limit = vi.fn(() => afterLimit) as never;
    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => afterWhere),
      orderBy: vi.fn(async () => result),
      limit: vi.fn(async () => result),
    };
    return builder;
  });

  const insertReturning = vi.fn(async () => opts?.insertedRows ?? []);
  const insertOnConflict = vi.fn(() => ({ returning: insertReturning }));
  const insertValues = vi.fn(() => ({
    returning: insertReturning,
    onConflictDoNothing: insertOnConflict,
  }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn(async () => opts?.updateResults ?? []);
  const updateWhere = vi.fn(() => ({
    returning: updateReturning,
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) => Promise.resolve(opts?.updateResults ?? []).then(resolve, reject),
  }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const db: Db = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
    select,
    insert,
    update,
  };
  return { db, select, insert, insertValues, update, updateSet };
}

function session(role = "veterinarian") {
  return {
    user: {
      id: USER_ID,
      email: "doctor@example.com",
      name: "MVDr. Test",
      role,
      practiceId: PRACTICE_ID,
    },
  };
}

const voice = (db: Db) =>
  voiceRouter.createCaller({ db, session: session() } as never);
const imaging = (db: Db) =>
  imagingRouter.createCaller({ db, session: session() } as never);
const discharge = (db: Db) =>
  dischargeRouter.createCaller({ db, session: session() } as never);
const ai = (db: Db) =>
  aiRouter.createCaller({ db, session: session() } as never);

beforeEach(() => {
  process.env.HOSTED_BILLING_ENABLED = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("draft-safety contract primitives", () => {
  it("never resolves to finalized without an explicit true confirmation", () => {
    expect(resolveAiRecordStatus({ requestedStatus: "finalized" })).toBe(
      "draft",
    );
    expect(
      resolveAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: false,
      }),
    ).toBe("draft");
    expect(
      resolveAiRecordStatus({
        requestedStatus: "draft",
        clinicianConfirmed: true,
      }),
    ).toBe("draft");
    expect(
      resolveAiRecordStatus({
        requestedStatus: "finalized",
        clinicianConfirmed: true,
      }),
    ).toBe("finalized");
  });

  it("rejects truthy-but-not-true confirmations", () => {
    for (const value of [undefined, null, false, "true", 1, {}]) {
      expect(() => assertClinicianConfirmed(value)).toThrow(
        AiDraftSafetyError,
      );
    }
    expect(() => assertClinicianConfirmed(true)).not.toThrow();
  });

  it("only lets AI write to open drafts", () => {
    expect(() => assertAiMayWriteToSoapNote({ status: "draft" })).not.toThrow();
    expect(() =>
      assertAiMayWriteToSoapNote({ status: "finalized" }),
    ).toThrowError(/cannot modify a finalized clinical record/);
  });
});

describe("a) unapproved AI drafts remain in draft status", () => {
  it("voice.saveAsSoapNote without confirmation persists a draft through the SOAP lifecycle", async () => {
    const draftRow = {
      id: NOTE_ID,
      status: "draft",
      revision: 1,
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    };
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: DICTATION_ID, patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID }],
        [IN_EXAM_APPOINTMENT], // lockOpenVisitForClinicalAppend
        [], // visit closeout
        [], // existing draft (for update)
        [], // existing finalized
      ],
      insertedRows: [draftRow],
    });

    const result = await voice(db).saveAsSoapNote({
      dictationId: DICTATION_ID,
      subjective: "Majiteľ hlási zníženú chuť do jedla",
      objective: "",
      assessment: "",
      plan: "",
    });

    expect(result.status).toBe("draft");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        finalizedAt: null,
        finalizedBy: null,
        finalizerName: null,
        practiceId: PRACTICE_ID,
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    );
    expect(insertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalized" }),
    );
  });

  it("voice.saveAsSoapNote with clinicianConfirmed: false still saves a draft", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: DICTATION_ID, patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID }],
        [IN_EXAM_APPOINTMENT],
        [],
        [],
        [],
      ],
      insertedRows: [{ id: NOTE_ID, status: "draft", revision: 1 }],
    });

    const result = await voice(db).saveAsSoapNote({
      dictationId: DICTATION_ID,
      subjective: "S",
      objective: "",
      assessment: "",
      plan: "",
      clinicianConfirmed: false,
    });

    expect(result.status).toBe("draft");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("imaging.injectFindingsIntoSoap creates a draft, never a finalized note", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            imageType: "xray",
            result: "Fraktúra radius",
          },
        ],
        [], // no existing SOAP note on the appointment
        [IN_EXAM_APPOINTMENT],
        [], // closeout
        [], // existing draft
        [], // existing finalized
      ],
      insertedRows: [{ id: NOTE_ID, status: "draft", revision: 1 }],
    });

    const result = await imaging(db).injectFindingsIntoSoap({
      analysisId: ANALYSIS_ID,
      appointmentId: APPOINTMENT_ID,
    });

    expect(result.status).toBe("draft");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        finalizedAt: null,
        finalizedBy: null,
        objective: expect.stringContaining("návrh na overenie lekárom"),
      }),
    );
  });

  it("imaging.injectFindingsIntoSoap appends to an existing draft with optimistic revision", async () => {
    const existingDraft = {
      id: NOTE_ID,
      status: "draft",
      revision: 2,
      practiceId: PRACTICE_ID,
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      subjective: "S",
      objective: "Existing objective",
      assessment: null,
      plan: null,
    };
    const { db, updateSet, insertValues } = createDb({
      selectResults: [
        [{ id: ANALYSIS_ID, patientId: PATIENT_ID, imageType: "ct", result: "Nález" }],
        [existingDraft],
        [IN_EXAM_APPOINTMENT],
        [],
        [existingDraft], // for update lock
      ],
      updateResults: [{ ...existingDraft, revision: 3 }],
    });

    const result = await imaging(db).injectFindingsIntoSoap({
      analysisId: ANALYSIS_ID,
      appointmentId: APPOINTMENT_ID,
    });

    expect(result.status).toBe("draft");
    expect(insertValues).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 3,
        objective: expect.stringContaining("Existing objective"),
      }),
    );
    expect(updateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalized" }),
    );
  });

  it("discharge.save defaults to draft and emits no webhook or communication", async () => {
    const { db, insertValues } = createDb({
      selectResults: [[{ clientId: CLIENT_ID, status: "active" }]],
      insertedRows: [{ id: REPORT_ID, status: "draft", patientId: PATIENT_ID }],
    });

    const saved = await discharge(db).save({
      patientId: PATIENT_ID,
      petName: "Rex",
      diagnosis: "Zubný kameň",
      reportText: "# Správa",
    });

    expect(saved.status).toBe("draft");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" }),
    );
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.schedulePostopCheckIn).not.toHaveBeenCalled();
    expect(mocks.detectAndTriggerDentalRecall).not.toHaveBeenCalled();
    expect(mocks.checkAndTriggerSeniorMilestone).not.toHaveBeenCalled();
  });

  it("discharge.save with status finalized but no confirmation is rejected before any DB work", async () => {
    const { db, select, insertValues } = createDb();

    await expect(
      discharge(db).save({
        patientId: PATIENT_ID,
        petName: "Rex",
        diagnosis: "Dx",
        reportText: "# Správa",
        status: "finalized",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      discharge(db).save({
        patientId: PATIENT_ID,
        petName: "Rex",
        diagnosis: "Dx",
        reportText: "# Správa",
        status: "finalized",
        clinicianConfirmed: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(select).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("ai.draftSoapNote returns a draft to the editor and never writes soap_notes", async () => {
    mocks.configuredModel.mockReturnValue({});
    mocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        subjective: "Owner reports lethargy",
        objective: "T 38.5",
        assessment: "Suspect GI upset",
        plan: "Bland diet",
      }),
    });
    const { db, insert, update } = createDb({
      selectResults: [
        [{ id: PRACTICE_ID }], // assertActivePractice
        [{ id: PATIENT_ID }], // assertPatientBelongsToPractice
        [{ name: "Rex", species: "dog", breed: null, sex: null, dob: null }],
        [], // allergies
        [], // problems
        [], // vitals
      ],
    });

    const draft = await ai(db).draftSoapNote({ patientId: PATIENT_ID });

    // The AI draft is returned to the editor for human review only.
    expect(draft).toMatchObject({
      subjective: "Owner reports lethargy",
      plan: "Bland diet",
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("b) AI cannot sign or finalize a record on behalf of a doctor", () => {
  it("ai.createSoapFromAI rejects requests without clinicianConfirmed before any DB work", async () => {
    const { db, select, insertValues } = createDb();

    await expect(
      ai(db).createSoapFromAI({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        subjective: "Eating well",
        source: "scribe",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      ai(db).createSoapFromAI({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        subjective: "Eating well",
        source: "scribe",
        clinicianConfirmed: false,
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(select).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("ai.createSoapFromAI finalizes only under the signed-in clinician's identity", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: PRACTICE_ID }],
        [{ id: PATIENT_ID }],
        [IN_EXAM_APPOINTMENT],
        [],
        [IN_EXAM_APPOINTMENT],
        [],
        [],
        [],
      ],
      insertedRows: [{ id: NOTE_ID, patientId: PATIENT_ID }],
    });

    await ai(db).createSoapFromAI({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      subjective: "Eating well",
      source: "scribe",
      clinicianConfirmed: true,
    });

    const values = (insertValues.mock.calls as unknown[][])[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(values.status).toBe("finalized");
    // The finalizer is the authenticated human, never the AI source.
    expect(values.finalizedBy).toBe(USER_ID);
    expect(values.authorId).toBe(USER_ID);
    expect(values.finalizerName).toBe("MVDr. Test");
    expect(JSON.stringify(values)).not.toContain("scribe");
  });

  it("voice.saveAsSoapNote finalizes only with clinicianConfirmed: true and attributes the human", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: DICTATION_ID, patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID }],
        [IN_EXAM_APPOINTMENT],
        [],
        [], // no draft
        [], // no finalized
      ],
      insertedRows: [{ id: NOTE_ID, status: "finalized" }],
    });

    const result = await voice(db).saveAsSoapNote({
      dictationId: DICTATION_ID,
      subjective: "S",
      objective: "O",
      assessment: "A",
      plan: "P",
      clinicianConfirmed: true,
    });

    expect(result.status).toBe("finalized");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "finalized",
        finalizedBy: USER_ID,
        finalizerName: "MVDr. Test",
        authorId: USER_ID,
      }),
    );
  });

  it("voice.saveAsSoapNote cannot finalize a dictation with no encounter to sign", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: DICTATION_ID, patientId: PATIENT_ID, appointmentId: null }],
      ],
    });

    await expect(
      voice(db).saveAsSoapNote({
        dictationId: DICTATION_ID,
        subjective: "S",
        objective: "",
        assessment: "",
        plan: "",
        clinicianConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("voice.saveAsSoapNote cannot finalize outside an open in-exam visit", async () => {
    const { db, insertValues } = createDb({
      selectResults: [
        [{ id: DICTATION_ID, patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID }],
        [{ ...IN_EXAM_APPOINTMENT, status: "completed" }],
        [],
      ],
    });

    await expect(
      voice(db).saveAsSoapNote({
        dictationId: DICTATION_ID,
        subjective: "S",
        objective: "",
        assessment: "",
        plan: "",
        clinicianConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("imaging.injectFindingsIntoSoap refuses to touch a finalized note", async () => {
    const { db, update, insertValues } = createDb({
      selectResults: [
        [{ id: ANALYSIS_ID, patientId: PATIENT_ID, imageType: "xray", result: "Nález" }],
        [
          {
            id: NOTE_ID,
            status: "finalized",
            revision: 1,
            objective: "Signed objective",
            finalizedBy: USER_ID,
          },
        ],
      ],
    });

    await expect(
      imaging(db).injectFindingsIntoSoap({
        analysisId: ANALYSIS_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(update).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("the REST scribe schema requires clinician_confirmed: true", () => {
    const base = {
      patient_id: PATIENT_ID,
      appointment_id: APPOINTMENT_ID,
      subjective: "S",
      source: "scribenote",
    };
    expect(SoapNoteCreateSchema.safeParse(base).success).toBe(false);
    expect(
      SoapNoteCreateSchema.safeParse({ ...base, clinician_confirmed: false })
        .success,
    ).toBe(false);
    expect(
      SoapNoteCreateSchema.safeParse({ ...base, clinician_confirmed: true })
        .success,
    ).toBe(true);
  });

  it("no AI router bypasses the SOAP lifecycle with a direct finalized insert", () => {
    const files = [
      "../routers/extensions/voice.ts",
      "../routers/extensions/imaging.ts",
      "../routers/extensions/discharge.ts",
      "../routers/ai.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(
        fileURLToPath(new URL(rel, import.meta.url)),
        "utf8",
      );
      // Direct writes to soap_notes must go through the lifecycle module.
      expect(src, rel).not.toMatch(/\.insert\(soapNotes\)/);
      expect(src, rel).not.toMatch(/\.update\(soapNotes\)/);
      // No AI surface may write finalization attribution itself.
      expect(src, rel).not.toMatch(/finalizedBy:\s*ctx\.user\.id/);
      expect(src, rel).not.toMatch(/finalizedAt:\s*new Date\(\)/);
    }
  });

  it("the agent tool surface exposes no tool that signs or finalizes clinical records", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../lib/agent/tools.ts", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/\.insert\(soapNotes\)/);
    expect(src).not.toMatch(/\.update\(soapNotes\)/);
    expect(src).not.toMatch(/status:\s*"finalized"/);
    expect(src).not.toMatch(/finalizedBy/);
    // The discharge summary tool is read-only: it returns markdown for review.
    const dischargeTool = src.slice(
      src.indexOf('name: "create_discharge_summary"'),
      src.indexOf('name: "generate_rvps_report"'),
    );
    expect(dischargeTool).toContain("readOnly: true");
    expect(dischargeTool).not.toContain(".insert(");
  });
});

describe("c) deceased-patient sympathy gate blocks AI recall/marketing triggers", () => {
  it("a confirmed discharge for a deceased patient applies the sympathy gate and schedules nothing", async () => {
    const { db } = createDb({
      selectResults: [[{ clientId: CLIENT_ID, status: "deceased" }]],
      insertedRows: [
        { id: REPORT_ID, status: "finalized", patientId: PATIENT_ID, diagnosis: "Zubný kameň", treatment: null, reportText: "tartar" },
      ],
    });

    const saved = await discharge(db).save({
      patientId: PATIENT_ID,
      petName: "Rex",
      diagnosis: "Zubný kameň",
      reportText: "tartar",
      status: "finalized",
      clinicianConfirmed: true,
    });

    expect(saved.status).toBe("finalized");
    expect(mocks.applySympathyGate).toHaveBeenCalledWith(
      db,
      PRACTICE_ID,
      CLIENT_ID,
      PATIENT_ID,
      "discharge_sympathy_gate",
    );
    expect(mocks.schedulePostopCheckIn).not.toHaveBeenCalled();
    expect(mocks.detectAndTriggerDentalRecall).not.toHaveBeenCalled();
    expect(mocks.checkAndTriggerSeniorMilestone).not.toHaveBeenCalled();
  });

  it("a confirmed discharge for a living patient may schedule recall but only after confirmation", async () => {
    const { db } = createDb({
      selectResults: [[{ clientId: CLIENT_ID, status: "active" }]],
      insertedRows: [
        { id: REPORT_ID, status: "finalized", patientId: PATIENT_ID, diagnosis: "Zubný kameň", treatment: null, reportText: "tartar" },
      ],
    });

    await discharge(db).save({
      patientId: PATIENT_ID,
      petName: "Rex",
      diagnosis: "Zubný kameň",
      reportText: "tartar",
      status: "finalized",
      clinicianConfirmed: true,
    });

    expect(mocks.applySympathyGate).not.toHaveBeenCalled();
    expect(mocks.schedulePostopCheckIn).toHaveBeenCalledTimes(1);
    expect(mocks.detectAndTriggerDentalRecall).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledWith(
      PRACTICE_ID,
      "discharge_report.finalized",
      expect.objectContaining({ reportId: REPORT_ID }),
    );
  });

  it("discharge.save rejects patients outside the tenant before writing", async () => {
    const { db, insertValues } = createDb({ selectResults: [[]] });

    await expect(
      discharge(db).save({
        patientId: PATIENT_ID,
        petName: "Rex",
        diagnosis: "Dx",
        reportText: "x",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("every marketing trigger helper hard-blocks deceased patients in source", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL("../../lib/marketing/messaging.ts", import.meta.url),
      ),
      "utf8",
    );
    for (const fn of [
      "createMessagesForTrigger",
      "schedulePostopCheckIn",
      "detectAndTriggerDentalRecall",
      "checkAndTriggerSeniorMilestone",
    ]) {
      const start = src.indexOf(`export async function ${fn}(`);
      expect(start, fn).toBeGreaterThanOrEqual(0);
      const next = src.indexOf("export async function", start + 1);
      const body = src.slice(start, next === -1 ? undefined : next);
      expect(body, fn).toMatch(/status === "deceased"/);
    }
    // processQueue re-checks at send time too (belt and braces).
    const queue = src.slice(src.indexOf("export async function processQueue("));
    expect(queue).toContain('"blocked_sympathy"');
    expect(queue).toMatch(/deceased/);
  });
});
