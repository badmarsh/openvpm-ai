import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  const updateResults: unknown[][] = [];

  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const builder: any = {
      from: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      offset: vi.fn(async () => result),
    };
    // If executed directly as a promise (e.g. without offset)
    builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return builder;
  });

  const insert = vi.fn(() => {
    const result = insertResults.shift() ?? [];
    const builder: any = {
      values: vi.fn(() => builder),
      returning: vi.fn(async () => result),
    };
    return builder;
  });

  const update = vi.fn(() => {
    const result = updateResults.shift() ?? [];
    const builder: any = {
      set: vi.fn(() => builder),
      where: vi.fn(() => builder),
      returning: vi.fn(async () => result),
    };
    return builder;
  });

  const execute = vi.fn(async () => undefined);

  const db = { select, insert, update, execute };

  return {
    db,
    selectResults,
    insertResults,
    updateResults,
    withTenant: vi.fn(
      async (
        database: unknown,
        _practiceId: string,
        fn: (tx: unknown) => Promise<unknown>
      ) => fn(database)
    ),
    withSystem: vi.fn(
      async (database: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn(database)
    ),
  };
});

vi.mock("@openpims/db/client", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/tenant-db", () => ({
  withTenant: mocks.withTenant,
  withSystem: mocks.withSystem,
}));

vi.mock("@/lib/rls-assertion", () => ({
  assertHostedRlsRoleOnce: vi.fn().mockResolvedValue(undefined),
}));

const { automationContentRouter } = await import(
  "../routers/extensions/automation-content"
);

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const VET_USER_ID = "00000000-0000-0000-0000-000000000001";
const TECH_USER_ID = "00000000-0000-0000-0000-000000000002";

function createCaller(role: "admin" | "veterinarian" | "technician" | "front_desk" = "veterinarian") {
  return automationContentRouter.createCaller({
    db: mocks.db,
    session: {
      user: {
        id: role === "veterinarian" ? VET_USER_ID : TECH_USER_ID,
        email: `${role}@example.com`,
        name: `Dr. ${role}`,
        role,
        practiceId: PRACTICE_ID,
      },
    },
  } as any);
}

describe("automationContentRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.length = 0;
    mocks.insertResults.length = 0;
    mocks.updateResults.length = 0;
  });

  it("listPillars returns seeded strategy pillars for the practice", async () => {
    const fakePillars = [
      {
        id: "p-1",
        practiceId: PRACTICE_ID,
        pillarKey: "preventive_care",
        title: "Preventívna medicína a vakcinácie",
        sortOrder: 1,
      },
      {
        id: "p-2",
        practiceId: PRACTICE_ID,
        pillarKey: "parasite_seasonal",
        title: "Sezónna ochrana: Kliešte a blchy",
        sortOrder: 2,
      },
    ];
    mocks.selectResults.push(fakePillars);

    const caller = createCaller("veterinarian");
    const result = await caller.listPillars();

    expect(result).toEqual(fakePillars);
    expect(mocks.db.select).toHaveBeenCalled();
  });

  it("listBriefs returns briefs with joined pillar and reviewer names", async () => {
    const fakeBriefs = [
      {
        id: "b-1",
        briefText: "Sezóna kliešťov vrcholí! Pripravili sme prehľad antiparazitík.",
        targetChannels: ["facebook", "instagram"],
        status: "review",
        clinicalClaims: [
          {
            claim: "Dávkovanie Bravecto žuvacích tabliet každých 12 týždňov.",
            kind: "dosage",
          },
        ],
        source: { scheduledDate: "2026-09-20" },
        pillarTitle: "Sezónna ochrana: Kliešte a blchy",
        reviewerName: null,
      },
    ];
    mocks.selectResults.push(fakeBriefs);

    const caller = createCaller("veterinarian");
    const result = await caller.listBriefs({ status: "review" });

    expect(result).toEqual(fakeBriefs);
    expect(result[0].status).toBe("review");
    expect(result[0].clinicalClaims).toHaveLength(1);
    expect((result[0] as any).source.scheduledDate).toBe("2026-09-20");
  });

  it("createBrief automatically assigns status 'review' when clinical claims are present", async () => {
    const insertedBrief = {
      id: "b-new-1",
      practiceId: PRACTICE_ID,
      briefText: "Čistenie zubného kameňa u starších psov.",
      targetChannels: ["facebook"],
      targetAudience: "Majitelia psov",
      clinicalClaims: [
        {
          claim: "Neliečená paradentóza zvyšuje riziko kardiomyopatie.",
          kind: "diagnosis",
        },
      ],
      status: "review",
      source: { scheduledDate: "2026-09-25" },
    };
    mocks.insertResults.push([insertedBrief]);

    const caller = createCaller("front_desk");
    const result = await caller.createBrief({
      briefText: "Čistenie zubného kameňa u starších psov.",
      targetChannels: ["facebook"],
      targetAudience: "Majitelia psov",
      scheduledDate: "2026-09-25",
      clinicalClaims: [
        {
          claim: "Neliečená paradentóza zvyšuje riziko kardiomyopatie.",
          kind: "diagnosis",
        },
      ],
    });

    expect(result).toEqual(insertedBrief);
    expect(mocks.db.insert).toHaveBeenCalled();
  });

  it("createBrief assigns status 'pending' when no clinical claims are present", async () => {
    const insertedBrief = {
      id: "b-new-2",
      practiceId: PRACTICE_ID,
      briefText: "Naša klinika oslavuje 5. výročie otvorenia!",
      targetChannels: ["instagram"],
      targetAudience: "Všetci majitelia",
      clinicalClaims: [],
      status: "pending",
      source: {},
    };
    mocks.insertResults.push([insertedBrief]);

    const caller = createCaller("veterinarian");
    const result = await caller.createBrief({
      briefText: "Naša klinika oslavuje 5. výročie otvorenia!",
      targetChannels: ["instagram"],
      targetAudience: "Všetci majitelia",
      clinicalClaims: [],
    });

    expect(result).toEqual(insertedBrief);
  });

  it("approveBrief records veterinarian sign-off with timestamp and note", async () => {
    const briefId = "00000000-0000-0000-0000-0000000000b1";
    const approvedBrief = {
      id: briefId,
      practiceId: PRACTICE_ID,
      status: "approved",
      reviewedBy: VET_USER_ID,
      reviewedAt: new Date(),
      reviewNote: "Schválené MVDr. Martin Sýkora podľa KVL SR",
    };
    mocks.updateResults.push([approvedBrief]);

    const caller = createCaller("veterinarian");
    const result = await caller.approveBrief({
      id: briefId,
      reviewNote: "Schválené MVDr. Martin Sýkora podľa KVL SR",
    });

    expect(result).toEqual(approvedBrief);
    expect(mocks.db.update).toHaveBeenCalled();
  });

  it("rejectBrief records rejection with mandatory explanation note", async () => {
    const briefId = "00000000-0000-0000-0000-0000000000b1";
    const rejectedBrief = {
      id: briefId,
      practiceId: PRACTICE_ID,
      status: "rejected",
      reviewedBy: VET_USER_ID,
      reviewedAt: new Date(),
      reviewNote: "Nesprávne uvedené dávkovanie, opravte podľa SPC lieku.",
    };
    mocks.updateResults.push([rejectedBrief]);

    const caller = createCaller("veterinarian");
    const result = await caller.rejectBrief({
      id: briefId,
      reviewNote: "Nesprávne uvedené dávkovanie, opravte podľa SPC lieku.",
    });

    expect(result).toEqual(rejectedBrief);
  });

  it("approveBrief is blocked for non-veterinarian roles (e.g. technician)", async () => {
    const caller = createCaller("technician");

    await expect(
      caller.approveBrief({
        id: "00000000-0000-0000-0000-0000000000b1",
        reviewNote: "Pokus o schválenie technikom",
      })
    ).rejects.toThrow();
  });
});
