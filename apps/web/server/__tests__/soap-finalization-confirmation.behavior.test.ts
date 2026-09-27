import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Sprint 33 behavioural tests (spec §4): the vet's final confirmation click
 * on AI-assisted SOAP notes.
 * Spec: tasks/sprints/arena-sprint-33-soap-ai-vet-confirmation.md
 *
 * Real routers and the real SOAP lifecycle run against a scripted database
 * double (the soap-ai-provenance.behavior.test.ts pattern), extended to also
 * record every UPDATE's WHERE clause so the envelope bindings are asserted.
 * Only the DB, providers, webhooks and the ledger append itself are doubled.
 */

const mocks = vi.hoisted(() => ({
  appendAiAuditEvent: vi.fn(async () => ({
    row: { id: "00000000-0000-4000-8000-0000000000e1" },
  })),
  dispatchWebhookEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ai/audit-ledger", () => ({
  appendAiAuditEvent: mocks.appendAiAuditEvent,
}));
vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhookEvent: mocks.dispatchWebhookEvent,
}));

const { recordsRouter } = await import("../routers/records");
const {
  extClinicianConfirmations,
  extSoapAiProvenance,
  soapNotes,
} = await import("@openpims/db");
const provenance = await import("@/lib/records/soap-ai-provenance");
const { SOAP_AI_CONFIRMATION_REQUIRED_MESSAGE } = await import(
  "@/lib/records/soap-lifecycle"
);

const PRACTICE_ID = "00000000-0000-4000-8000-0000000000aa";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const PATIENT_ID = "00000000-0000-4000-8000-000000000002";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000003";
const NOTE_ID = "00000000-0000-4000-8000-000000000004";
const RECEIPT_ID = "00000000-0000-4000-8000-000000000005";
const CONFIRMATION_ID = "00000000-0000-4000-8000-0000000000c1";
const AUDIT_EVENT_ID = "00000000-0000-4000-8000-0000000000e1";

const IN_EXAM = { id: APPOINTMENT_ID, doctorId: USER_ID, status: "in_exam" };

const AI_DRAFT = {
  subjective: "Majiteľ hlási kašeľ 3 dni",
  objective: "T 39,2 °C",
  assessment: "Tracheobronchitída",
  plan: "Kontrola o 5 dní",
};

type SelectCall = { table: unknown; where: SQL | undefined };
type UpdateCall = { table: unknown; set: unknown; where: SQL | undefined };

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
  const updateCalls: UpdateCall[] = [];

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
        const call: UpdateCall = { table, set, where: undefined };
        updateCalls.push(call);
        return {
          where: vi.fn((where: SQL) => {
            call.where = where;
            const rows = updates.shift() ?? [];
            return { returning: vi.fn(async () => rows), ...thenable(rows) };
          }),
        };
      },
      ),
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
    revision: 2,
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

function receipt() {
  return {
    id: RECEIPT_ID,
    source: "soap_draft" as const,
    ...provenance.soapAiReceiptHashes(AI_DRAFT),
  };
}

function envelopeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONFIRMATION_ID,
    createdAt: new Date("2026-09-27T08:06:00.000Z"),
    updatedAt: new Date("2026-09-27T08:06:00.000Z"),
    deletedAt: null,
    practiceId: PRACTICE_ID,
    actorId: USER_ID,
    actorRole: "veterinarian",
    actionType: "soap_note_finalized",
    entityType: "soap_note",
    entityId: NOTE_ID,
    expectedRevision: 2,
    originalDraftHash: receipt().draftHash,
    confirmedContentHash: provenance.hashSoapDraft(AI_DRAFT),
    status: "PENDING",
    issuedAt: new Date("2026-09-27T08:06:00.000Z"),
    expiresAt: new Date("2026-09-27T08:21:00.000Z"),
    consumedAt: null,
    consumedBy: null,
    correlationId: null,
    ...overrides,
  };
}

const dialect = new PgDialect();
const renderWhere = (where: SQL | undefined) =>
  where ? dialect.sqlToQuery(where) : { sql: "", params: [] as unknown[] };

const finalizeInput = {
  patientId: PATIENT_ID,
  appointmentId: APPOINTMENT_ID,
  noteId: NOTE_ID,
  expectedRevision: 2,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("Sprint 33 · vet confirmation gate for AI-assisted SOAP (behaviour)", () => {
  it("scenario 1 · AI-assisted draft without an envelope fails closed and writes nothing", async () => {
    const saved = note({ revision: 2, ...AI_DRAFT });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt()]],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    await expect(
      records(fin.db).finalizeSoapNote(finalizeInput),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: SOAP_AI_CONFIRMATION_REQUIRED_MESSAGE,
    });
    // Nothing written: no ledger event, no envelope or receipt consumption.
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extClinicianConfirmations),
    ).toBe(false);
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 1b · a bare clinicianConfirmed: true is rejected like a missing envelope", async () => {
    const saved = note({ revision: 2, ...AI_DRAFT });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt()]],
      updates: [[note({ ...saved, status: "finalized" })]],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...finalizeInput,
        clinicianConfirmed: true,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: SOAP_AI_CONFIRMATION_REQUIRED_MESSAGE,
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
  });

  it("scenario 2 · prepare then finalize consumes exactly one envelope and appends one ledger row", async () => {
    const saved = note({ revision: 2, ...AI_DRAFT });
    const issued = envelopeRow();

    // --- prepare: issue the envelope bound to note, revision and content --
    const prep = scriptedDb({
      selects: [[saved], [receipt()]],
      inserted: [[issued]],
    });
    const prepared = await records(prep.db).prepareSoapFinalization({
      ...finalizeInput,
    });
    expect(prepared).toMatchObject({
      required: true,
      confirmationId: CONFIRMATION_ID,
      // Per-section provenance for the dialog; never any draft text.
      sections: {
        subjective: "ai_verbatim",
        objective: "ai_verbatim",
        assessment: "ai_verbatim",
        plan: "ai_verbatim",
      },
    });
    expect(JSON.stringify(prepared)).not.toContain(AI_DRAFT.subjective);
    const envelopeWrite = prep.insertCalls.find(
      (c) => c.table === extClinicianConfirmations,
    );
    expect(envelopeWrite?.values).toMatchObject({
      practiceId: PRACTICE_ID,
      actorId: USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: NOTE_ID,
      expectedRevision: 2,
      status: "PENDING",
      originalDraftHash: receipt().draftHash,
      confirmedContentHash: provenance.hashSoapDraft(AI_DRAFT),
    });

    // --- finalize with the envelope ----------------------------------------
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt()]],
      updates: [
        [note({ ...saved, status: "finalized" })],
        [{ id: CONFIRMATION_ID, status: "CONSUMED" }],
        [],
      ],
    });
    const result = await records(fin.db).finalizeSoapNote({
      ...finalizeInput,
      clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
    });
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });

    // Exactly one consumed envelope, with every binding in the WHERE.
    const consume = fin.updateCalls.find(
      (c) => c.table === extClinicianConfirmations,
    );
    expect(consume?.set).toMatchObject({
      status: "CONSUMED",
      consumedBy: USER_ID,
    });
    const { sql, params } = renderWhere(consume?.where);
    expect(sql).toContain('"practice_id" = $');
    expect(sql).toContain('"actor_id" = $');
    expect(sql).toContain('"actor_role" = $');
    expect(sql).toContain('"action_type" = $');
    expect(sql).toContain('"entity_id" = $');
    expect(sql).toContain('"expected_revision" = $');
    expect(sql).toContain('"original_draft_hash" = $');
    expect(sql).toContain('"confirmed_content_hash" = $');
    expect(sql).toContain('"status" = $');
    expect(sql).toContain('"expires_at" > $');
    expect(params).toEqual(
      expect.arrayContaining([
        CONFIRMATION_ID,
        PRACTICE_ID,
        USER_ID,
        "veterinarian",
        "soap_note_finalized",
        "soap_note",
        NOTE_ID,
        2,
        receipt().draftHash,
        provenance.hashSoapDraft(AI_DRAFT),
        "PENDING",
      ]),
    );

    // Exactly one ledger row, appended after the envelope consumption.
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
        originalDraftHash: receipt().draftHash,
        confirmedContentHash: provenance.hashSoapDraft(AI_DRAFT),
      }),
    );
    // The receipts are consumed exactly once, linked to the ledger event.
    const consumeReceipts = fin.updateCalls.filter(
      (c) => c.table === extSoapAiProvenance,
    );
    expect(consumeReceipts).toHaveLength(1);
    expect(consumeReceipts[0]?.set).toEqual({
      consumedAt: expect.any(Date),
      auditEventId: AUDIT_EVENT_ID,
    });
  });

  it("scenario 3 · replaying the same confirmationId fails with CONFLICT", async () => {
    const saved = note({ revision: 2, ...AI_DRAFT });
    // The conditional consume matches nothing (already CONSUMED), then the
    // diagnostic select reports the consumed envelope.
    const fin = scriptedDb({
      selects: [
        [IN_EXAM],
        [],
        [saved],
        [receipt()],
        [envelopeRow({ status: "CONSUMED", consumedAt: new Date() })],
      ],
      updates: [[note({ ...saved, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...finalizeInput,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "Confirmation token has already been consumed (replay attempt rejected).",
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("scenario 3b · an expired envelope fails with CONFLICT", async () => {
    const saved = note({ revision: 2, ...AI_DRAFT });
    const expired = envelopeRow({
      expiresAt: new Date("2026-09-27T07:50:00.000Z"),
    });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt()], [expired]],
      updates: [[note({ ...saved, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...finalizeInput,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Confirmation token has expired. Clinician review must be renewed.",
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
  });

  it("scenario 4 · content edited after prepare fails with PRECONDITION_FAILED (hash mismatch)", async () => {
    // The vet edited the plan after the envelope was issued. The note stays
    // on the same revision in this scenario; only the content hash differs.
    const edited = { ...AI_DRAFT, plan: "Kontrola o 3 dni, RTG hrudníka" };
    const saved = note({ revision: 2, ...edited });
    const staleEnvelope = envelopeRow({
      confirmedContentHash: provenance.hashSoapDraft(AI_DRAFT),
    });
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [saved], [receipt()], [staleEnvelope]],
      updates: [[note({ ...saved, status: "finalized" })], []],
    });
    await expect(
      records(fin.db).finalizeSoapNote({
        ...finalizeInput,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Final clinical content has been modified since confirmation was issued.",
    });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
  });

  it("scenario 5 · a manual note finalizes without prepare, envelope or ledger row", async () => {
    // prepare reports no envelope is needed ...
    const manual = note({ revision: 2, subjective: "Manuálny zápis" });
    const prep = scriptedDb({ selects: [[manual], []] });
    await expect(
      records(prep.db).prepareSoapFinalization(finalizeInput),
    ).resolves.toEqual({ required: false });
    expect(
      prep.insertCalls.some((c) => c.table === extClinicianConfirmations),
    ).toBe(false);

    // ... and finalize works exactly as before Sprint 33.
    const fin = scriptedDb({
      selects: [[IN_EXAM], [], [manual], []],
      updates: [[note({ ...manual, status: "finalized" })]],
    });
    const result = await records(fin.db).finalizeSoapNote(finalizeInput);
    expect(result).toMatchObject({ outcome: "finalized", transitioned: true });
    expect(mocks.appendAiAuditEvent).not.toHaveBeenCalled();
    expect(
      fin.updateCalls.some((c) => c.table === extClinicianConfirmations),
    ).toBe(false);
    expect(
      fin.updateCalls.some((c) => c.table === extSoapAiProvenance),
    ).toBe(false);
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it("getSoapDraft reports aiAssisted from the linked unconsumed receipts", async () => {
    const draft = note({ revision: 2, ...AI_DRAFT });
    const withReceipt = scriptedDb({ selects: [[draft], [{ id: RECEIPT_ID }]] });
    await expect(
      records(withReceipt.db).getSoapDraft({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    ).resolves.toMatchObject({ id: NOTE_ID, aiAssisted: true });

    const withoutReceipt = scriptedDb({ selects: [[draft], []] });
    await expect(
      records(withoutReceipt.db).getSoapDraft({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    ).resolves.toMatchObject({ id: NOTE_ID, aiAssisted: false });

    const noDraft = scriptedDb({ selects: [[]] });
    await expect(
      records(noDraft.db).getSoapDraft({
        patientId: PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    ).resolves.toBeNull();
  });

  it("role gate · front_desk can neither prepare nor finalize", async () => {
    const prep = scriptedDb({ selects: [] });
    await expect(
      records(prep.db, "front_desk").prepareSoapFinalization(finalizeInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const fin = scriptedDb({ selects: [] });
    await expect(
      records(fin.db, "front_desk").finalizeSoapNote({
        ...finalizeInput,
        clinicianConfirmed: { confirmationId: CONFIRMATION_ID },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
