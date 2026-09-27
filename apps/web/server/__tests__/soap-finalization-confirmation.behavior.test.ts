import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Sprint 33 behavioural tests: the vet's final confirmation click on
 * AI-assisted SOAP notes (owner decision 2026-09-27).
 * Spec: tasks/sprints/arena-sprint-33-soap-ai-vet-confirmation.md §4
 *
 * Real routers and the real SOAP lifecycle run against a scripted database
 * double (the soap-ai-provenance.behavior.test.ts pattern). Only the DB,
 * providers, webhooks and the ledger append itself are doubled.
 */

const mocks = vi.hoisted(() => ({
  appendAiAuditEvent: vi.fn(async () => ({
    row: { id: "00000000-0000-4000-8000-0000000000e1" },
  })),
  dispatchWebhookEvent: vi.fn(async () => undefined),
  readPrimaryObject: vi.fn(),
  uploadFile: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/audit-ledger", () => ({
  appendAiAuditEvent: mocks.appendAiAuditEvent,
}));
vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: mocks.dispatchWebhookEvent,
}));
vi.mock("@/lib/s3", () => ({
  readPrimaryObject: mocks.readPrimaryObject,
  uploadFile: mocks.uploadFile,
}));
vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));
vi.mock("ai", () => ({ generateText: mocks.generateText }));

const { recordsRouter } = await import("../routers/records");
const { extClinicianConfirmations, extSoapAiProvenance, soapNotes } =
  await import("@openpims/db");
const provenance = await import("@/lib/records/soap-ai-provenance");

const PRACTICE_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PATIENT_ID = "00000000-0000-4000-8000-000000000002";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000003";
const NOTE_ID = "00000000-0000-4000-8000-000000000004";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000005";
const CONFIRMATION_ID = "00000000-0000-4000-8000-000000000007";

const GATE_MESSAGE =
  "This SOAP note contains AI-generated content. Review it and confirm as the responsible veterinarian before finalizing.";

const IN_EXAM = { id: APPOINTMENT_ID, doctorId: USER_ID, status: "in_exam" };

/**
 * Scripted DB: each select() consumes the next scripted result; each update()
 * returning() consumes the next scripted update result; each insert()
 * returning() consumes the next scripted insert result.
 */
function scriptedDb(opts: {
  selects: unknown[][];
  updates?: unknown[][];
  inserted?: unknown[][];
}) {
  const selects = [...opts.selects];
  const updates = [...(opts.updates ?? [])];
  const inserted = [...(opts.inserted ?? [])];
  const insertCalls: Array<{ table: unknown; values: unknown }> = [];
  const updateCalls: Array<{ table: unknown; set: unknown }> = [];

  const thenable = (rows: unknown[]) => ({
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
  });

  const db: Record<string, unknown> = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => {
      const rows = selects.shift() ?? [];
      const builder: Record<string, unknown> = {
        from: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        leftJoin: vi.fn(() => builder),
        where: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        for: vi.fn(async () => rows),
        ...thenable(rows),
      };
      return builder;
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        insertCalls.push({ table, values });
        const rows = inserted.shift() ?? [];
        return {
          returning: vi.fn(async () => rows),
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => rows),
          })),
          ...thenable(rows),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: unknown) => {
        updateCalls.push({ table, set });
        return {
          where: vi.fn(() => {
            const rows = updates.shift() ?? [];
            return { returning: vi.fn(async () => rows), ...thenable(rows) };
          }),
        };
      }),
    })),
  };
  return { db, insertCalls, updateCalls };
}

function session(role = "veterinarian", id = USER_ID) {
  return {
    user: {
      id,
      email: "doctor@example.com",
      name: "MVDr. Test",
      role,
      practiceId: PRACTICE_ID,
    },
  };
}

const records = (db: unknown, role?: string) =>
  recordsRouter.createCaller({ db, session: session(role) } as never);

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    createdAt: new Date("2026-09-27T08:00:00.000Z"),
    updatedAt: new Date("2026-09-27T08:05:00.000Z"),
    deletedAt: null,
    practiceId: PRACTICE_ID,
    patientId: PATIENT_ID,
    appointmentId: APPOINTMENT_ID,
    authorId: USER_ID,
    authorName: "MVDr. Test",
    status: "draft",
    revision: 1,
    finalizedAt: null,
    finalizedBy: null,
    finalizerName: null,
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    imported: false,
    importFingerprint: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

const AI_DRAFT = {
  subjective: "Majiteľ hlási kašeľ 3 dni",
  objective: "T 39,2 °C",
  assessment: "Tracheobronchitída",
  plan: "Kontrola o 5 dní",
};

// The editor stores HTML; the vet edits the objective only.
const EDITED = {
  subjective: `<p>${AI_DRAFT.subjective}</p>`,
  objective: "<p>T 39,4 °C, auskultácia bez vedľajších zvukov</p>",
  assessment: `<p>${AI_DRAFT.assessment}</p>`,
  plan: `<p>${AI_DRAFT.plan}</p>`,
};

const EXPECTED_SECTIONS = {
  subjective: "ai_verbatim",
  objective: "ai_edited",
  assessment: "ai_verbatim",
  plan: "ai_verbatim",
};

function aiReceipt() {
  return {
    id: RECEIPT_ID,
    source: "soap_draft" as const,
    ...provenance.soapAiReceiptHashes(AI_DRAFT),
  };
}

const FINALIZE_INPUT = {
  patientId: PATIENT_ID,
  appointmentId: APPOINTMENT_ID,
  noteId: NOTE_ID,
  expectedRevision: 2,
};

describe("Sprint 33 · vet confirmation gate for AI-assisted SOAP (behaviour)", () => {
  it("scenario 1 · AI-assisted draft finalized without an envelope fails closed and writes nothing", async () => {
    const saved = note({ revision: 2, ...EDITED });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [aiReceipt()]],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    await expect(records(fin.db).finalizeSoapNote(FINALIZE_INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: GATE_MESSAGE,
    });

    // The status update above already happened in the same transaction, so
    // the throw rolls the whole finalization back: no ledger row, no
    // envelope or receipt consume, no webhook.
    expect(
      fin.updateCalls.find((c) => c.table === soapNotes)?.set,
    ).toMatchObject({ status: "finalized" });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extClinicianConfirmations),
    ).toBe(false);
    expect(fin.updateCalls.some((c) => c.table === extSoapAiProvenance)).toBe(
      false,
    );
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 1b · a bare clinicianConfirmed:true is rejected like a missing envelope (protocol §2.3)", async () => {
    const saved = note({ revision: 2, ...EDITED });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [aiReceipt()]],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...FINALIZE_INPUT,
        clinicianConfirmed: true,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: GATE_MESSAGE,
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
  });

  it("scenario 2 · prepare → finalize consumes one envelope and writes one ledger row", async () => {
    const receipt = aiReceipt();
    const saved = note({ revision: 2, ...EDITED });

    // --- prepare: the UI flushed the autosave, then asks for an envelope --
    const prep = scriptedDb({
      selects: [[saved], [receipt]],
      inserted: [
        [{ id: CONFIRMATION_ID, expiresAt: new Date("2026-09-27T09:00:00.000Z") }],
      ],
    });
    const prepared = await records(prep.db).prepareSoapFinalization({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 2,
    });
    expect(prepared).toMatchObject({
      required: true,
      confirmationId: CONFIRMATION_ID,
      sections: EXPECTED_SECTIONS,
    });
    expect(prepared.expiresAt).toBeInstanceOf(Date);
    // Hashes only: no draft text may leave the server in this response.
    expect(JSON.stringify(prepared)).not.toContain("kašeľ");
    const issue = prep.insertCalls.find(
      (c) => c.table === extClinicianConfirmations,
    );
    expect(issue?.values).toMatchObject({
      practiceId: PRACTICE_ID,
      actorId: USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: NOTE_ID,
      expectedRevision: 2,
      originalDraftHash: receipt.draftHash,
      confirmedContentHash: provenance.hashSoapDraft(EDITED),
      status: "PENDING",
    });

    // --- getSoapDraft tells the UI the draft is AI-assisted ---------------
    const flag = scriptedDb({ selects: [[saved], [receipt]] });
    const draft = await records(flag.db).getSoapDraft({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });
    expect(draft).toMatchObject({ id: NOTE_ID, aiAssisted: true });

    // --- finalize with the envelope --------------------------------------
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt]],
      updates: [
        [note({ ...saved, status: "finalized" })],
        [{ id: CONFIRMATION_ID, status: "CONSUMED" }],
        [],
      ],
    });
    const result = await records(fin.db).finalizeSoapNote({
      ...FINALIZE_INPUT,
      clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
    });
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });

    const consumes = fin.updateCalls.filter(
      (c) => c.table === extClinicianConfirmations,
    );
    expect(consumes).toHaveLength(1);
    expect(consumes[0]?.set).toMatchObject({
      status: "CONSUMED",
      consumedBy: USER_ID,
    });
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledWith(
      fin.db,
      expect.objectContaining({
        actionType: "soap_note_finalized",
        originalDraftHash: receipt.draftHash,
        confirmedContentHash: provenance.hashSoapDraft(EDITED),
        wasEditedByClinician: true,
      }),
    );
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(true);
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it("scenario 3 · replaying the same confirmationId fails with CONFLICT", async () => {
    const receipt = aiReceipt();
    const saved = note({ revision: 2, ...EDITED });
    // The atomic consume finds no PENDING row; the diagnostic row shows the
    // envelope was already consumed with otherwise matching bindings.
    const consumedRow = {
      id: CONFIRMATION_ID,
      practiceId: PRACTICE_ID,
      actorId: USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: NOTE_ID,
      expectedRevision: 2,
      originalDraftHash: receipt.draftHash,
      confirmedContentHash: provenance.hashSoapDraft(EDITED),
      status: "CONSUMED",
      expiresAt: new Date("2026-09-27T09:00:00.000Z"),
    };
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt], [consumedRow]],
      updates: [[note({ ...saved, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...FINALIZE_INPUT,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("already been consumed"),
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(fin.updateCalls.some((c) => c.table === extSoapAiProvenance)).toBe(
      false,
    );
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 4 · content changed after prepare (hash mismatch) fails with PRECONDITION_FAILED", async () => {
    const receipt = aiReceipt();
    // Same revision the envelope binds, but different content: the confirmed
    // hash no longer matches what the vet reviewed.
    const changed = note({
      revision: 2,
      ...EDITED,
      objective: "<p>T 39,9 °C, zmenené po príprave</p>",
    });
    const pendingRow = {
      id: CONFIRMATION_ID,
      practiceId: PRACTICE_ID,
      actorId: USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: NOTE_ID,
      expectedRevision: 2,
      originalDraftHash: receipt.draftHash,
      confirmedContentHash: provenance.hashSoapDraft(EDITED),
      status: "PENDING",
      expiresAt: new Date("2026-09-27T09:00:00.000Z"),
    };
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [changed], [receipt], [pendingRow]],
      updates: [[note({ ...changed, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...FINALIZE_INPUT,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("modified since confirmation"),
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(fin.updateCalls.some((c) => c.table === extSoapAiProvenance)).toBe(
      false,
    );
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 4b · re-saving after prepare (revision mismatch) fails with CONFLICT", async () => {
    const receipt = aiReceipt();
    const resaved = note({ revision: 3, ...EDITED });
    const staleRow = {
      id: CONFIRMATION_ID,
      practiceId: PRACTICE_ID,
      actorId: USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: NOTE_ID,
      expectedRevision: 2,
      originalDraftHash: receipt.draftHash,
      confirmedContentHash: provenance.hashSoapDraft(EDITED),
      status: "PENDING",
      expiresAt: new Date("2026-09-27T09:00:00.000Z"),
    };
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [resaved], [receipt], [staleRow]],
      updates: [[note({ ...resaved, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...FINALIZE_INPUT,
        expectedRevision: 3,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 5 · a manual note finalizes without prepare, exactly as before", async () => {
    const saved = note({ revision: 2, subjective: "Manuálny zápis" });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], []],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    const result = await records(fin.db).finalizeSoapNote(FINALIZE_INPUT);
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extClinicianConfirmations),
    ).toBe(false);
    expect(fin.updateCalls.some((c) => c.table === extSoapAiProvenance)).toBe(
      false,
    );
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledTimes(1);

    const flag = scriptedDb({ selects: [[saved], []] });
    const draft = await records(flag.db).getSoapDraft({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });
    expect(draft).toMatchObject({ id: NOTE_ID, aiAssisted: false });
  });

  it("prepare · a manual note returns required:false and issues no envelope", async () => {
    const saved = note({ revision: 2, subjective: "Manuálny zápis" });
    const prep = scriptedDb({ selects: [[saved], []] });
    await expect(
      records(prep.db).prepareSoapFinalization({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 2,
      }),
    ).resolves.toEqual({ required: false });
    expect(prep.insertCalls).toHaveLength(0);
  });

  it("prepare · a stale revision fails with CONFLICT before any envelope work", async () => {
    const prep = scriptedDb({ selects: [[note({ revision: 3 })]] });
    await expect(
      records(prep.db).prepareSoapFinalization({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prep.insertCalls).toHaveLength(0);
  });

  it("prepare · a missing draft fails with NOT_FOUND", async () => {
    const prep = scriptedDb({ selects: [[]] });
    await expect(
      records(prep.db).prepareSoapFinalization({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prep.insertCalls).toHaveLength(0);
  });

  it("prepare · an already-finalized note returns required:false (finalize stays idempotent)", async () => {
    const prep = scriptedDb({
      selects: [[note({ revision: 2, status: "finalized" })]],
    });
    await expect(
      records(prep.db).prepareSoapFinalization({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 2,
      }),
    ).resolves.toEqual({ required: false });
    expect(prep.insertCalls).toHaveLength(0);
  });
});
