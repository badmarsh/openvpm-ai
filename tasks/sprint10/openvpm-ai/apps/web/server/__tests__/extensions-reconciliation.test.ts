import { describe, expect, it, vi } from "vitest";
import { reconciliationRouter } from "../routers/extensions/reconciliation";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function createCaller(db: Record<string, unknown>, role = "admin") {
  const session = {
    user: {
      id: USER_ID,
      email: `${role}@example.com`,
      name: "Veterinarian",
      role,
      practiceId: PRACTICE_ID,
    },
  };
  return reconciliationRouter.createCaller({ db, session, practiceId: PRACTICE_ID } as never);
}

describe("reconciliationRouter", () => {
  it("getDailyParitySummary computes counts and totals correctly", async () => {
    let callCount = 0;
    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => {
            callCount++;
            if (callCount === 4) return [{ total: "150.50" }];
            if (callCount === 5) return [{ totalAmount: "0.00" }];
            return [{ value: 3 }];
          }),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const summary = await caller.getDailyParitySummary({
      date: "2026-09-13",
    });

    expect(summary.date).toBe("2026-09-13");
    expect(summary.clientsCreated).toBe(3);
    expect(summary.patientsCreated).toBe(3);
    expect(summary.completedVisits).toBe(3);
    expect(summary.totalTurnover).toBe(150.5);
    expect(summary.inventoryMovements).toBe(3);
  });

  it("getPendingClinicalDrafts fetches unsigned draft clinical records", async () => {
    const mockDrafts = [
      {
        id: "rec-1",
        patientId: "pat-1",
        patientName: "Blesk",
        authorName: "Dr. Martin Sýkora",
        createdAt: new Date("2026-09-13T10:00:00Z"),
        revision: 1,
        appointmentId: null,
        subjective: "AI navrhnutý popis",
        assessment: "Suspektná gastroenteritída",
      },
    ];

    const chain: Record<string, any> = {
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => mockDrafts),
    };

    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => chain),
      })),
    };

    const caller = createCaller(mockDb);
    const drafts = await caller.getPendingClinicalDrafts();

    expect(drafts.draftSoaps).toHaveLength(1);
    expect(drafts.draftSoaps[0].id).toBe("rec-1");
    expect(drafts.draftSoaps[0].patientName).toBe("Blesk");
    expect(drafts.draftSoaps[0].authorName).toBe("Dr. Martin Sýkora");
  });

  it("reportDiscrepancy inserts feedback into ext_pilot_feedback", async () => {
    const insertFn = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [
          {
            id: "fb-123",
            moduleWorkflow: "billing",
            description: "Chýba 12 EUR na faktúre oproti VetSoftware",
            severity: "critical",
            status: "open",
          },
        ]),
      })),
    }));

    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      insert: insertFn,
    };

    const caller = createCaller(mockDb);
    const result = await caller.reportDiscrepancy({
      moduleWorkflow: "billing",
      description: "Chýba 12 EUR na faktúre oproti VetSoftware",
      severity: "critical",
    });

    expect(result.success).toBe(true);
    expect(result.feedbackId).toBe("fb-123");
    expect(insertFn).toHaveBeenCalled();
  });
});
