import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Sprint 32 behavioural tests (GT-001 scenarios) for SOAP AI provenance.
 * Spec: tasks/sprints/arena-sprint-32-soap-ai-provenance-ledger.md §4
 *
 * Real routers and the real SOAP lifecycle run against a scripted database
 * double (the ai-draft-safety.test.ts pattern). Only the DB, providers,
 * webhooks and the ledger append itself are doubled; the ledger's own
 * hashing/locking is covered by lib/ai/__tests__/audit-ledger.test.ts.
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
const { imagingRouter } = await import("../routers/extensions/imaging");
const { extClinicianConfirmations, extSoapAiProvenance, soapNotes } =
  await import("@openpims/db");
const provenance = await import("@/lib/records/soap-ai-provenance");

const PRACTICE_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PATIENT_ID = "00000000-0000-4000-8000-000000000002";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000003";
const NOTE_ID = "00000000-0000-4000-8000-000000000004";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000005";
const ANALYSIS_ID = "00000000-0000-4000-8000-000000000006";
const AUDIT_EVENT_ID = "00000000-0000-4000-8000-0000000000e1";
// Sprint 33: AI-assisted finalization consumes a confirmation envelope.
const CONFIRMATION_ID = "00000000-0000-4000-8000-0000000000c1";
const clinicianConfirmed = { confirmationId: CONFIRMATION_ID };
const CONSUMED_ENVELOPE = [{ id: CONFIRMATION_ID, status: "CONSUMED" }];

const IN_EXAM = { id: APPOINTMENT_ID, doctorId: USER_ID, status: "in_exam" };

type SelectCall = { table: unknown; where: SQL | undefined };

/**
 * Scripted DB: each select() consumes the next scripted result; each update()
 * returning() consumes the next scripted update result. Records the table and
 * WHERE of every select plus every insert/update for assertions.
 */
function scriptedDb(opts: {
  selects: unknown[][];
  updates?: unknown[][];
  inserted?: unknown[][];
}) {
  const selects = [...opts.selects];
  const updates = [...(opts.updates ?? [])];
  const inserted = [...(opts.inserted ?? [])];
  const selectCalls: SelectCall[] = [];
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
      const call: SelectCall = { table: undefined, where: undefined };
      selectCalls.push(call);
      const builder: Record<string, unknown> = {
        from: vi.fn((table: unknown) => {
          call.table = table;
          return builder;
        }),
        innerJoin: vi.fn(() => builder),
        leftJoin: vi.fn(() => builder),
        where: vi.fn((where: SQL) => {
          call.where = where;
          return builder;
        }),
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
  return { db, selectCalls, insertCalls, updateCalls };
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
const imaging = (db: unknown) =>
  imagingRouter.createCaller({ db, session: session() } as never);

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

const dialect = new PgDialect();
const renderWhere = (where: SQL | undefined) =>
  where ? dialect.sqlToQuery(where) : { sql: "", params: [] as unknown[] };

afterEach(() => {
  vi.clearAllMocks();
});

const AI_DRAFT = {
  subjective: "Majiteľ hlási kašeľ 3 dni",
  objective: "T 39,2 °C",
  assessment: "Tracheobronchitída",
  plan: "Kontrola o 5 dní",
};

describe("Sprint 32 · SOAP AI provenance (behaviour)", () => {
  it("scenario 1 · AI draft → save with receipt → finalize appends exactly one soap_note_finalized event and consumes the receipt", async () => {
    // --- save: link the receipt to the saved draft ---------------------------
    const existing = note({ revision: 1, subjective: "x" });
    // The editor stores HTML; the vet edits the objective only.
    const edited = {
      subjective: `<p>${AI_DRAFT.subjective}</p>`,
      objective: "<p>T 39,4 °C, auskultácia bez vedľajších zvukov</p>",
      assessment: `<p>${AI_DRAFT.assessment}</p>`,
      plan: `<p>${AI_DRAFT.plan}</p>`,
    };
    const saved = note({ revision: 2, ...edited });
    const save = scriptedDb({
      selects: [[IN_EXAM], [], [existing], [{ id: RECEIPT_ID }]],
      updates: [[saved], []],
    });
    const saveResult = await records(save.db).saveSoapDraft({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 1,
      aiProvenanceReceiptId: RECEIPT_ID,
      ...edited,
    });
    expect(saveResult).toMatchObject({ outcome: "saved" });
    const link = save.updateCalls.find((c) => c.table === extSoapAiProvenance);
    expect(link?.set).toEqual({
      soapNoteId: NOTE_ID,
      appointmentId: APPOINTMENT_ID,
    });
    // The receipt id never leaks into the soap_notes write.
    const noteWrite = save.updateCalls.find((c) => c.table === soapNotes);
    expect(noteWrite?.set).not.toHaveProperty("aiProvenanceReceiptId");

    // --- finalize: ledger event + consume, in the same transaction ----------
    const receipt = {
      id: RECEIPT_ID,
      source: "soap_draft" as const,
      ...provenance.soapAiReceiptHashes(AI_DRAFT),
    };
    const finalized = note({ ...saved, status: "finalized" });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt]],
      updates: [[finalized], CONSUMED_ENVELOPE, []],
    });
    const result = await records(fin.db).finalizeSoapNote({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 2,
      clinicianConfirmed,
    });
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });

    // Sprint 33: the envelope is consumed in the same transaction, before
    // the ledger append below.
    const consumeEnvelope = fin.updateCalls.find(
      (c) => c.table === extClinicianConfirmations,
    );
    expect(consumeEnvelope?.set).toMatchObject({
      status: "CONSUMED",
      consumedBy: USER_ID,
    });
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledWith(
      fin.db,
      expect.objectContaining({
        practiceId: PRACTICE_ID,
        actorId: USER_ID,
        actorRole: "veterinarian",
        entityType: "soap_note",
        entityId: NOTE_ID,
        actionType: "soap_note_finalized",
        originalDraftHash: receipt.draftHash,
        confirmedContentHash: provenance.hashSoapDraft(edited),
        wasEditedByClinician: true,
      }),
    );
    const consume = fin.updateCalls.find((c) => c.table === extSoapAiProvenance);
    expect(consume?.set).toEqual({
      consumedAt: expect.any(Date),
      auditEventId: AUDIT_EVENT_ID,
    });
    // Per-section provenance for this note.
    expect(
      provenance.buildSoapAiFinalizationEvent([receipt], edited)?.sections,
    ).toEqual({
      subjective: "ai_verbatim",
      objective: "ai_edited",
      assessment: "ai_verbatim",
      plan: "ai_verbatim",
    });
    // Webhook still fires after the lifecycle, once.
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it("scenario 1b · an untouched AI draft finalizes with wasEditedByClinician=false", async () => {
    const receipt = {
      id: RECEIPT_ID,
      source: "soap_draft" as const,
      ...provenance.soapAiReceiptHashes(AI_DRAFT),
    };
    const html = Object.fromEntries(
      Object.entries(AI_DRAFT).map(([k, v]) => [k, `<p>${v}</p>`]),
    );
    const saved = note({ revision: 2, ...html });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt]],
      updates: [[note({ ...saved, status: "finalized" })], CONSUMED_ENVELOPE, []],
    });
    await records(fin.db).finalizeSoapNote({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 2,
      clinicianConfirmed,
    });
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledWith(
      fin.db,
      expect.objectContaining({
        wasEditedByClinician: false,
        originalDraftHash: receipt.draftHash,
        confirmedContentHash: receipt.draftHash,
      }),
    );
  });

  it("scenario 2 · imaging inject → finalize writes one event and objective is AI-attributed", async () => {
    const existing = note({ revision: 1, objective: "Palpácia bez nálezu" });
    const inject = scriptedDb({
      selects: [
        [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            imageType: "xray",
            result: "Fraktúra radius",
            modelId: "gemini-2.5-pro",
          },
        ],
        [existing],
        [IN_EXAM],
        [],
        [existing],
      ],
      updates: [[note({ ...existing, revision: 2, objective: "set-below" })]],
    });
    await imaging(inject.db).injectFindingsIntoSoap({
      analysisId: ANALYSIS_ID,
      appointmentId: APPOINTMENT_ID,
    });
    const receiptWrite = inject.insertCalls.find(
      (c) => c.table === extSoapAiProvenance,
    );
    expect(receiptWrite?.values).toMatchObject({
      source: "imaging_findings",
      sourceEntityId: ANALYSIS_ID,
      modelId: "gemini-2.5-pro",
      soapNoteId: NOTE_ID,
      issuedTo: USER_ID,
      featureKey: "imaging",
    });
    const values = receiptWrite!.values as {
      draftHash: string;
      sectionHashes: Record<string, string | null>;
    };
    // Hashes only: the finding text is never stored in the receipt.
    expect(JSON.stringify(values)).not.toContain("Fraktúra");
    expect(Object.keys(values.sectionHashes)).toEqual(["objective"]);

    const noteWrite = inject.updateCalls.find((c) => c.table === soapNotes);
    const objective = (noteWrite?.set as { objective: string }).objective;
    const saved = note({ revision: 2, objective });
    const receipt = { id: RECEIPT_ID, source: "imaging_findings" as const, ...values };
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt]],
      updates: [[note({ ...saved, status: "finalized" })], CONSUMED_ENVELOPE, []],
    });
    await records(fin.db).finalizeSoapNote({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 2,
      clinicianConfirmed,
    });
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.appendAiAuditEvent).toHaveBeenCalledWith(
      fin.db,
      expect.objectContaining({ actionType: "soap_note_finalized" }),
    );
    const event = provenance.buildSoapAiFinalizationEvent([receipt], saved);
    expect(["ai_verbatim", "ai_edited"]).toContain(event?.sections.objective);
  });

  it("scenario 3 · a manual note finalizes without any ledger call or receipt write", async () => {
    const saved = note({ revision: 2, subjective: "Manuálny zápis" });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], []],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    const result = await records(fin.db).finalizeSoapNote({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 2,
    });
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
  });

  it("negative · a receipt issued to another user or for another patient is rejected on save", async () => {
    const existing = note({ revision: 1, subjective: "x" });
    const save = scriptedDb({
      // The receipt lookup finds nothing: its WHERE binds the session user,
      // the patient, the practice, unconsumed and fresh (asserted below).
      selects: [[IN_EXAM], [], [existing], []],
      updates: [[note({ revision: 2, subjective: "y" })]],
    });
    await expect(
      records(save.db).saveSoapDraft({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 1,
        aiProvenanceReceiptId: RECEIPT_ID,
        subjective: "y",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "AI draft receipt is not valid for this note.",
    });

    const lookup = save.selectCalls.find((c) => c.table === extSoapAiProvenance);
    const { sql, params } = renderWhere(lookup?.where);
    expect(sql).toContain('"issued_to" = $');
    expect(sql).toContain('"patient_id" = $');
    expect(sql).toContain('"practice_id" = $');
    expect(sql).toContain('"consumed_at" is null');
    expect(sql).toContain('"created_at" >= $');
    expect(params).toEqual(
      expect.arrayContaining([RECEIPT_ID, PRACTICE_ID, PATIENT_ID, USER_ID]),
    );
    // No link write happened.
    expect(
      save.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
  });

  it("negative · a save that does not persist (conflict) never links the receipt", async () => {
    const existing = note({ revision: 3, subjective: "x" });
    const save = scriptedDb({ selects: [[IN_EXAM], [], [existing]] });
    const result = await records(save.db).saveSoapDraft({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      noteId: NOTE_ID,
      expectedRevision: 1,
      aiProvenanceReceiptId: RECEIPT_ID,
      subjective: "y",
    });
    expect(result).toMatchObject({ outcome: "conflict" });
    expect(save.selectCalls.some((c) => c.table === extSoapAiProvenance)).toBe(
      false,
    );
  });

  it("fail closed · if the ledger append throws, finalization throws and receipts stay unconsumed", async () => {
    mocks.appendAiAuditEvent.mockRejectedValueOnce(new Error("chain broken"));
    const receipt = {
      id: RECEIPT_ID,
      source: "soap_draft" as const,
      ...provenance.soapAiReceiptHashes(AI_DRAFT),
    };
    const saved = note({ revision: 2, ...AI_DRAFT });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt]],
      updates: [[note({ ...saved, status: "finalized" })], CONSUMED_ENVELOPE],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        noteId: NOTE_ID,
        expectedRevision: 2,
        clinicianConfirmed,
      }),
    ).rejects.toThrow();
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });
});
