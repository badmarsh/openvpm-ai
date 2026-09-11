import { describe, it, expect, vi } from "vitest";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { appendAiAuditEvent } from "@/lib/ai/audit-ledger";
import {
  issueClinicianConfirmation,
  consumeClinicianConfirmation,
} from "@/lib/ai/clinician-confirmation";
import { generateContentHash } from "@/lib/ai/draft-safety";

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

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const VET_USER_ID = "00000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "00000000-0000-0000-0000-000000000002";
const PATIENT_ID = "00000000-0000-0000-0000-000000000003";
const APPOINTMENT_ID = "00000000-0000-0000-0000-000000000004";
const DICTATION_ID = "00000000-0000-0000-0000-000000000005";
const REPORT_ID = "00000000-0000-0000-0000-000000000006";

/**
 * Service-level simulation of the pilot clinical flow (agent tools +
 * confirmation envelopes + audit ledger) against an in-memory simulated
 * database. This is NOT a browser E2E test and NOT a database integration
 * test: it proves service-layer protocol behavior (issue/consume/replay/
 * chain-linking logic) with synthetic fixtures only. Real PostgreSQL
 * behavior is proven by `ai-clinical-finalization.integration.test.ts`
 * and the real browser pilot flow lives in /e2e (Playwright).
 */
describe("Deterministic Synthetic Pilot Clinical Flow — Service Simulation", () => {
  // Shared state across the chronological flow
  const ledger: Array<{
    sequenceNumber: number;
    eventHash: string;
    previousEventHash: string | null;
    actionType: string;
    entityId: string;
  }> = [];

  const confirmations: Map<string, {
    id: string;
    status: string;
    expectedRevision: number;
    originalDraftHash: string;
    confirmedContentHash: string;
    expiresAt: Date;
  }> = new Map();

  function createSimulatedDb() {
    const tx = {
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  patientId: PATIENT_ID,
                  name: "Bary",
                  species: "canine",
                  breed: "German Shepherd",
                  status: "active",
                  owner: { firstName: "Ján", lastName: "Novák", phone: "+421901234567" },
                },
              ]),
            })),
          })),
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const latest = ledger[ledger.length - 1];
              return latest ? [latest] : [];
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => {
                const latest = ledger[ledger.length - 1];
                return latest ? [latest] : [];
              }),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => ({
          returning: vi.fn(async () => {
            if ("sequenceNumber" in values) {
              const row = {
                id: `audit-${values.sequenceNumber}`,
                ...values,
              };
              ledger.push({
                sequenceNumber: values.sequenceNumber as number,
                eventHash: values.eventHash as string,
                previousEventHash: (values.previousEventHash as string) ?? null,
                actionType: values.actionType as string,
                entityId: values.entityId as string,
              });
              return [row];
            }
            if ("status" in values && values.status === "PENDING") {
              const confId = `conf-${confirmations.size + 1}`;
              const confRow = {
                id: confId,
                status: "PENDING",
                expectedRevision: values.expectedRevision as number,
                originalDraftHash: values.originalDraftHash as string,
                confirmedContentHash: values.confirmedContentHash as string,
                expiresAt: values.expiresAt as Date,
                ...values,
              };
              confirmations.set(confId, confRow);
              return [confRow];
            }
            return [{ id: "mock-row", ...values }];
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setValues: Record<string, unknown>) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              const conf = confirmations.get("conf-1");
              if (conf && conf.status === "PENDING") {
                conf.status = "CONSUMED";
                return [{ ...conf, status: "CONSUMED", ...setValues }];
              }
              // If already consumed, 0 rows are updated!
              return [];
            }),
          })),
        })),
      })),
    };

    const db = {
      ...tx,
      transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };

    return { db, tx };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Reception Check-in & Search
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 1: Receptionist can look up patient and appointments", async () => {
    const findPatientTool = AGENT_TOOLS.find((t) => t.name === "find_patient")!;
    const { db } = createSimulatedDb();

    const receptionCtx = {
      db: db as never,
      practiceId: PRACTICE_ID,
      userId: RECEPTIONIST_ID,
      userRole: "front_desk",
    };

    const searchResult = await findPatientTool.execute({ query: "Bary" }, receptionCtx);
    expect(searchResult).toBeDefined();
    expect(Array.isArray(searchResult)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Unauthorized Prescription Attempt Blocked
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 2: Receptionist attempting to create a prescription is blocked (fail-closed)", async () => {
    const createPrescriptionTool = AGENT_TOOLS.find((t) => t.name === "create_prescription")!;

    const receptionCtx = {
      db: {} as never,
      practiceId: PRACTICE_ID,
      userId: RECEPTIONIST_ID,
      userRole: "front_desk",
    };

    await expect(
      createPrescriptionTool.execute(
        {
          patientId: PATIENT_ID,
          medicationName: "Amoxicillin 250mg",
          dosage: "1 tablet",
          frequency: "BID",
        },
        receptionCtx,
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: Clinician Prepares Confirmation Envelope for SOAP Draft
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 3: Veterinarian prepares replay-safe confirmation envelope for AI SOAP draft", async () => {
    const { db } = createSimulatedDb();

    const originalAiDraft = {
      subjective: "Majiteľ uvádza kašeľ 3 dni.",
      objective: "Vezikulárne dýchanie, teplota 38.8 C.",
      assessment: "Akútna bronchitída.",
      plan: "Amoxicillin 250mg 1 tbl BID p.o., kľudový režim.",
    };
    const clinicianEditedContent = {
      ...originalAiDraft,
      plan: "Amoxicillin 250mg 1 tbl BID p.o. počas 7 dní, kontrola o týždeň.",
    };

    const originalDraftHash = generateContentHash(originalAiDraft);
    const confirmedContentHash = generateContentHash(clinicianEditedContent);

    const envelope = await issueClinicianConfirmation(db as never, {
      practiceId: PRACTICE_ID,
      actorId: VET_USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: DICTATION_ID,
      expectedRevision: 0,
      originalDraftHash,
      confirmedContentHash,
    });

    expect(envelope.id).toMatch(/^conf-/);
    expect(envelope.status).toBe("PENDING");
    expect(envelope.originalDraftHash).toBe(originalDraftHash);
    expect(envelope.confirmedContentHash).toBe(confirmedContentHash);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Clinician Finalizes SOAP Note & Appends to Ledger (Genesis Event)
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 4: Veterinarian finalizes SOAP note; confirmation consumed and audit logged as sequence 1", async () => {
    const { db, tx } = createSimulatedDb();

    const originalAiDraft = {
      subjective: "Majiteľ uvádza kašeľ 3 dni.",
      objective: "Vezikulárne dýchanie, teplota 38.8 C.",
      assessment: "Akútna bronchitída.",
      plan: "Amoxicillin 250mg 1 tbl BID p.o., kľudový režim.",
    };
    const clinicianEditedContent = {
      ...originalAiDraft,
      plan: "Amoxicillin 250mg 1 tbl BID p.o. počas 7 dní, kontrola o týždeň.",
    };

    const originalDraftHash = generateContentHash(originalAiDraft);
    const confirmedContentHash = generateContentHash(clinicianEditedContent);

    // Consume the confirmation envelope
    const consumed = await consumeClinicianConfirmation(tx as never, {
      confirmationId: "conf-1",
      practiceId: PRACTICE_ID,
      actorId: VET_USER_ID,
      actorRole: "veterinarian",
      actionType: "soap_note_finalized",
      entityType: "soap_note",
      entityId: DICTATION_ID,
      expectedRevision: 0,
      originalDraftHash,
      confirmedContentHash,
    });

    expect(consumed.status).toBe("CONSUMED");

    // Append to audit ledger inside same transaction
    const auditResult = await appendAiAuditEvent(tx as never, {
      practiceId: PRACTICE_ID,
      actorId: VET_USER_ID,
      actorName: "Dr. MVDr. Kováč",
      actorRole: "veterinarian",
      entityType: "soap_note",
      entityId: DICTATION_ID,
      actionType: "soap_note_finalized",
      originalDraftHash,
      confirmedContentHash,
      wasEditedByClinician: true,
    });

    expect(auditResult.sequenceNumber).toBe(1);
    expect(auditResult.previousEventHash).toBeNull();
    expect(ledger.length).toBe(1);
    expect(ledger[0].sequenceNumber).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 5: Replay Attack on Consumed Token Rejected
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 5: Replay attack on consumed confirmation token is rejected (ALREADY_CONSUMED)", async () => {
    const { tx } = createSimulatedDb();

    // Mark envelope as CONSUMED
    confirmations.set("conf-1", {
      ...confirmations.get("conf-1")!,
      status: "CONSUMED",
    });

    // Mock select returning the consumed token
    tx.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [confirmations.get("conf-1")]),
        })),
      })),
    } as never);

    await expect(
      consumeClinicianConfirmation(tx as never, {
        confirmationId: "conf-1",
        practiceId: PRACTICE_ID,
        actorId: VET_USER_ID,
        actorRole: "veterinarian",
        actionType: "soap_note_finalized",
        entityType: "soap_note",
        entityId: DICTATION_ID,
        expectedRevision: 0,
        originalDraftHash: confirmations.get("conf-1")!.originalDraftHash,
        confirmedContentHash: confirmations.get("conf-1")!.confirmedContentHash,
      }),
    ).rejects.toMatchObject({
      code: "ALREADY_CONSUMED",
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 6: Authorized Prescription Creation
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 6: Veterinarian successfully creates prescription (authorized role)", async () => {
    const createPrescriptionTool = AGENT_TOOLS.find((t) => t.name === "create_prescription")!;

    const vetCtx = {
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: PATIENT_ID, practiceId: PRACTICE_ID }]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [
              {
                id: "rx-1",
                patientId: PATIENT_ID,
                medicationName: "Amoxicillin 250mg",
                dosage: "1 tableta",
                frequency: "2x denne",
                status: "active",
              },
            ]),
          })),
        })),
      } as never,
      practiceId: PRACTICE_ID,
      userId: VET_USER_ID,
      userRole: "veterinarian",
    };

    const rxResult = await createPrescriptionTool.execute(
      {
        patientId: PATIENT_ID,
        medicationName: "Amoxicillin 250mg",
        dosage: "1 tableta",
        frequency: "2x denne",
      },
      vetCtx,
    );

    expect(rxResult).toMatchObject({
      medicationName: "Amoxicillin 250mg",
      status: "active",
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 7: Discharge Finalization & Audit Chain Continuation
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 7: Discharge report finalization chains cryptographically to sequence 2", async () => {
    const { tx } = createSimulatedDb();

    const originalAiDraft = "Pacient prepustený v stabilizovanom stave.";
    const confirmedDischarge = "Pacient prepustený v stabilizovanom stave. Podávať lieky s krmivom.";

    const originalDraftHash = generateContentHash(originalAiDraft);
    const confirmedContentHash = generateContentHash(confirmedDischarge);

    const auditResult = await appendAiAuditEvent(tx as never, {
      practiceId: PRACTICE_ID,
      actorId: VET_USER_ID,
      actorName: "Dr. MVDr. Kováč",
      actorRole: "veterinarian",
      entityType: "discharge_report",
      entityId: REPORT_ID,
      actionType: "discharge.saved",
      originalDraftHash,
      confirmedContentHash,
      wasEditedByClinician: true,
    });

    expect(auditResult.sequenceNumber).toBe(2);
    expect(auditResult.previousEventHash).toBe(ledger[0].eventHash);
    expect(ledger.length).toBe(2);
    expect(ledger[1].previousEventHash).toBe(ledger[0].eventHash);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 8: Chain Integrity Verification
  // ──────────────────────────────────────────────────────────────────────────
  it("Step 8: Verifies cryptographic continuity of the end-to-end pilot audit ledger", () => {
    expect(ledger.length).toBe(2);
    expect(ledger[0].sequenceNumber).toBe(1);
    expect(ledger[0].previousEventHash).toBeNull();
    expect(ledger[1].sequenceNumber).toBe(2);
    expect(ledger[1].previousEventHash).toBe(ledger[0].eventHash);
  });
});
