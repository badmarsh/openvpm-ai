import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  uploadFile: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
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

const { voiceRouter } = await import("../routers/extensions/voice");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const DICTATION_ID = "00000000-0000-0000-0000-000000000003";

function createDb(opts?: {
  selectResults?: unknown[][];
  insertedRows?: unknown[];
  updateResults?: unknown[];
}) {
  const selectResults = [...(opts?.selectResults ?? [])];
  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const afterWhere = {
      limit: vi.fn(async () => result),
      for: vi.fn(async () => result),
      groupBy: vi.fn(async () => result),
      orderBy: vi.fn(async () => result),
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
      orderBy: vi.fn(async () => result),
      groupBy: vi.fn(async () => result),
      limit: vi.fn(async () => result),
    };
    return builder;
  });

  const insertReturning = vi.fn(async () => opts?.insertedRows ?? []);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn(async () => opts?.updateResults ?? []);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const db: Record<string, unknown> = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
    select,
    insert,
    update,
  };
  return db;
}

function callerWithDb(db: Record<string, unknown>) {
  const session = {
    user: {
      id: USER_ID,
      email: "vet@example.com",
      name: "Veterinarian",
      role: "veterinarian",
      practiceId: PRACTICE_ID,
    },
  };
  return voiceRouter.createCaller({ db, session } as never);
}

describe("voiceRouter extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuredModel.mockReturnValue("gemini-mock");
  });

  it("formatTextToSoap returns structured SOAP sections from text", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: JSON.stringify({
        subjective: "Surová anamnéza",
        objective: "Klinický nález",
        assessment: "Diagnóza",
        plan: "Terapia",
      }),
    });

    const db = createDb({
      selectResults: [[{ name: "Rex", species: "Canine" }]],
    });

    const caller = callerWithDb(db);
    const result = await caller.formatTextToSoap({
      transcript: "Pes kríva na ľavú labku",
      patientId: PATIENT_ID,
      style: "standard",
    });

    expect(result.subjective).toBe("Surová anamnéza");
    expect(result.objective).toBe("Klinický nález");
    expect(result.assessment).toBe("Diagnóza");
    expect(result.plan).toBe("Terapia");
  });

  it("getAudio returns null if audio was purged by GDPR", async () => {
    const db = createDb({
      selectResults: [
        [
          {
            id: DICTATION_ID,
            audioFileKey: "storage/key.webm",
            audioMimeType: "audio/webm",
            audioDeletedAt: new Date(), // GDPR purged!
            createdAt: new Date(),
          },
        ],
      ],
    });

    const caller = callerWithDb(db);
    const result = await caller.getAudio({ dictationId: DICTATION_ID });

    expect(result).toBeNull();
    expect(mocks.readPrimaryObject).not.toHaveBeenCalled();
  });

  it("getAudio returns data URL if audio is active and within retention", async () => {
    const db = createDb({
      selectResults: [
        [
          {
            id: DICTATION_ID,
            audioFileKey: "storage/audio-active.webm",
            audioMimeType: "audio/webm",
            audioDeletedAt: null,
            createdAt: new Date(),
          },
        ],
      ],
    });

    mocks.readPrimaryObject.mockResolvedValueOnce({
      status: "available",
      body: Buffer.from("fake-audio-bytes"),
    });

    const caller = callerWithDb(db);
    const result = await caller.getAudio({ dictationId: DICTATION_ID });

    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe("audio/webm");
    expect(result?.audioDataUrl).toContain("data:audio/webm;base64,");
  });
});
