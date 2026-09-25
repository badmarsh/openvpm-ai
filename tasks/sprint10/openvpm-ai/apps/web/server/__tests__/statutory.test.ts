import { beforeEach, describe, expect, it, vi } from "vitest";

const { statutoryRouter } = await import("../routers/extensions/statutory");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const VAX_ID = "00000000-0000-0000-0000-000000000003";

function createDb(opts?: {
  selectResults?: unknown[][];
  findFirstResults?: unknown[];
  insertedRows?: unknown[];
}) {
  const selectResults = [...(opts?.selectResults ?? [])];
  const findFirstResults = [...(opts?.findFirstResults ?? [])];

  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const afterWhere = {
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn(async () => result),
        })),
      })),
      limit: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    const builder = {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => afterWhere),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn(async () => result),
        })),
      })),
    };
    return builder;
  });

  const insertReturning = vi.fn(async () => opts?.insertedRows ?? []);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const db: Record<string, unknown> = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
    select,
    insert,
    query: {
      patients: {
        findFirst: vi.fn(async () => findFirstResults.shift() ?? null),
      },
      vaccinationRecords: {
        findFirst: vi.fn(async () => findFirstResults.shift() ?? null),
      },
    },
  };
  return db;
}

function callerWithDb(db: Record<string, unknown>) {
  const session = {
    user: {
      id: USER_ID,
      email: "vet@openvpm.sk",
      name: "MVDr. Martin Kováč",
      role: "veterinarian",
      practiceId: PRACTICE_ID,
    },
  };
  return statutoryRouter.createCaller({ db, session } as never);
}

describe("statutoryRouter extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listWithdrawalPeriods returns withdrawal items and total count", async () => {
    const mockRows = [
      {
        id: "with-1",
        medicationName: "Amoxicillin LA",
        batchNumber: "LOT123",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 28,
        milkWithdrawalDays: 7,
        administeredAt: new Date(),
        safeUntil: new Date(Date.now() + 28 * 86400000),
        patientName: "Kravička Malina",
        species: "Bovine",
      },
    ];

    const db = createDb({
      selectResults: [mockRows, [{ count: 1 }]],
    });

    const caller = callerWithDb(db);
    const result = await caller.listWithdrawalPeriods({
      targetAnimalType: "bovine",
      activeOnly: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.medicationName).toBe("Amoxicillin LA");
    expect(result.items[0]?.meatWithdrawalDays).toBe(28);
    expect(result.totalCount).toBe(1);
  });

  it("createWithdrawalPeriod calculates safeUntil based on max withdrawal days and inserts", async () => {
    const adminDate = new Date("2026-09-01T10:00:00.000Z");
    const db = createDb({
      findFirstResults: [{ id: PATIENT_ID, name: "Býk Ferdinand" }],
      insertedRows: [
        {
          id: "with-2",
          practiceId: PRACTICE_ID,
          patientId: PATIENT_ID,
          medicationName: "Dexamethasone",
          meatWithdrawalDays: 21,
          milkWithdrawalDays: 3,
        },
      ],
    });

    const caller = callerWithDb(db);
    const created = await caller.createWithdrawalPeriod({
      patientId: PATIENT_ID,
      medicationName: "Dexamethasone",
      batchNumber: "DEXA-99",
      targetAnimalType: "bovine",
      meatWithdrawalDays: 21,
      milkWithdrawalDays: 3,
      administeredAt: adminDate.toISOString(),
      notes: "Aplikácia po akútnej inflácii",
    });

    expect(created.id).toBe("with-2");
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("recordRabiesNotification records statutory submission to RVPS", async () => {
    const db = createDb({
      findFirstResults: [{ id: VAX_ID, vaccineName: "Nobivac Rabies" }],
      insertedRows: [
        {
          id: "notif-1",
          practiceId: PRACTICE_ID,
          vaccinationRecordId: VAX_ID,
          rvpsOfficeName: "RVPS Bratislava - mesto",
          status: "submitted",
        },
      ],
    });

    const caller = callerWithDb(db);
    const result = await caller.recordRabiesNotification({
      vaccinationRecordId: VAX_ID,
      rvpsOfficeName: "RVPS Bratislava - mesto",
      submissionReference: "RVPS-BA-2026-0042",
      status: "submitted",
    });

    expect(result.id).toBe("notif-1");
    expect(result.rvpsOfficeName).toBe("RVPS Bratislava - mesto");
  });
});
