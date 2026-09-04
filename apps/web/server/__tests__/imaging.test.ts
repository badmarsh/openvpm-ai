import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readPrimaryObject: vi.fn(),
  configuredModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  readPrimaryObject: mocks.readPrimaryObject,
}));

vi.mock("@/lib/agent/runner", () => ({
  configuredModel: mocks.configuredModel,
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}));

const { imagingRouter } = await import("../routers/extensions/imaging");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const PATIENT_ID = "00000000-0000-0000-0000-000000000002";
const FILE_ID = "00000000-0000-0000-0000-000000000003";
const ANALYSIS_ID = "00000000-0000-0000-0000-000000000004";

function callerWithDb(db: Record<string, unknown>) {
  const session = {
    user: {
      id: USER_ID,
      email: "doctor@example.com",
      name: "Doctor",
      role: "veterinarian",
      practiceId: PRACTICE_ID,
    },
  };
  return imagingRouter.createCaller({ db, session } as never);
}

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

  return { db, select, insertValues, insertReturning, updateSet, updateWhere, updateReturning };
}

beforeEach(() => {
  mocks.readPrimaryObject.mockReset();
  mocks.configuredModel.mockReset();
  mocks.generateText.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Imaging router", () => {
  describe("analyze mutation", () => {
    it("rejects invalid fileId format", async () => {
      const { db, select, insertValues } = createDb();

      await expect(
        callerWithDb(db).analyze({
          fileId: "not-a-uuid",
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(select).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it("rejects invalid imageType", async () => {
      const { db, select, insertValues } = createDb();

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "invalid" as any,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(select).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it("rejects oversized userPrompt", async () => {
      const { db, select, insertValues } = createDb();

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
          userPrompt: "a".repeat(2001),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(select).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when file does not exist", async () => {
      const { db, insertValues } = createDb({
        selectResults: [[]], // file not found
      });

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Súbor sa nenašiel",
      });

      expect(insertValues).not.toHaveBeenCalled();
    });

    it("creates PENDING analysis before AI call", async () => {
      const { db, insertValues, insertReturning } = createDb({
        selectResults: [
          [{ id: FILE_ID, fileKey: "practice/file.jpg", mimeType: "image/jpeg" }],
        ],
        insertedRows: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "PENDING",
          },
        ],
      });

      // Mock will fail on AI call, but we just want to verify PENDING was created
      mocks.readPrimaryObject.mockRejectedValue(new Error("Test stop"));

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toThrow();

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: PATIENT_ID,
          fileId: FILE_ID,
          practiceId: PRACTICE_ID,
          requestedBy: USER_ID,
          status: "PENDING",
        }),
      );
    });

    it("reads image from object storage, not HTTP", async () => {
      const { db, insertValues } = createDb({
        selectResults: [
          [{ id: FILE_ID, fileKey: "practice/file.jpg", mimeType: "image/jpeg" }],
        ],
        insertedRows: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "PENDING",
          },
        ],
      });

      mocks.readPrimaryObject.mockResolvedValue({
        status: "available",
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG magic bytes
        contentType: "image/jpeg",
      });

      mocks.configuredModel.mockReturnValue({} as any);
      mocks.generateText.mockRejectedValue(new Error("Test stop"));

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toThrow();

      expect(mocks.readPrimaryObject).toHaveBeenCalledWith("practice/file.jpg", {
        maxBytes: 16 * 1024 * 1024,
      });
    });

    it("updates analysis to COMPLETED on success", async () => {
      const { db, updateSet, updateWhere, updateReturning } = createDb({
        selectResults: [
          [{ id: FILE_ID, fileKey: "practice/file.jpg", mimeType: "image/jpeg" }],
        ],
        insertedRows: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "PENDING",
          },
        ],
        updateResults: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "COMPLETED",
            result: "AI analysis result",
            completedAt: new Date(),
          },
        ],
      });

      mocks.readPrimaryObject.mockResolvedValue({
        status: "available",
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        contentType: "image/jpeg",
      });

      mocks.configuredModel.mockReturnValue({} as any);
      mocks.generateText.mockResolvedValue({
        text: "AI analysis result",
        finishReason: "stop",
      });

      const result = await callerWithDb(db).analyze({
        fileId: FILE_ID,
        patientId: PATIENT_ID,
        imageType: "xray",
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.result).toBe("AI analysis result");

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "COMPLETED",
          result: "AI analysis result",
        }),
      );
    });

    it("updates analysis to FAILED when image is missing from storage", async () => {
      const { db, updateSet, updateWhere } = createDb({
        selectResults: [
          [{ id: FILE_ID, fileKey: "practice/file.jpg", mimeType: "image/jpeg" }],
        ],
        insertedRows: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "PENDING",
          },
        ],
      });

      mocks.readPrimaryObject.mockResolvedValue({
        status: "missing",
      });

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringContaining("Obraz sa v úložisku nenašiel"),
      });

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
          errorMessage: "Obraz sa v úložisku nenašiel",
        }),
      );
    });

    it("updates analysis to FAILED when AI call fails", async () => {
      const { db, updateSet } = createDb({
        selectResults: [
          [{ id: FILE_ID, fileKey: "practice/file.jpg", mimeType: "image/jpeg" }],
        ],
        insertedRows: [
          {
            id: ANALYSIS_ID,
            patientId: PATIENT_ID,
            fileId: FILE_ID,
            practiceId: PRACTICE_ID,
            requestedBy: USER_ID,
            modelId: "gemini-3.5-flash",
            imageType: "xray",
            userPrompt: null,
            status: "PENDING",
          },
        ],
      });

      mocks.readPrimaryObject.mockResolvedValue({
        status: "available",
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        contentType: "image/jpeg",
      });

      mocks.configuredModel.mockReturnValue({} as any);
      mocks.generateText.mockRejectedValue(new Error("AI service unavailable"));

      await expect(
        callerWithDb(db).analyze({
          fileId: FILE_ID,
          patientId: PATIENT_ID,
          imageType: "xray",
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringContaining("AI service unavailable"),
      });

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
          errorMessage: "AI service unavailable",
        }),
      );
    });
  });

  describe("listByPatient query", () => {
    it("returns all analyses for a patient", async () => {
      const analyses = [
        {
          id: ANALYSIS_ID,
          patientId: PATIENT_ID,
          fileId: FILE_ID,
          status: "COMPLETED",
          result: "Analysis 1",
        },
        {
          id: "00000000-0000-0000-0000-000000000005",
          patientId: PATIENT_ID,
          fileId: FILE_ID,
          status: "PENDING",
          result: null,
        },
      ];

      const { db } = createDb({
        selectResults: [analyses],
      });

      const result = await callerWithDb(db).listByPatient({
        patientId: PATIENT_ID,
      });

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("COMPLETED");
      expect(result[1].status).toBe("PENDING");
    });

    it("rejects invalid patientId", async () => {
      const { db, select } = createDb();

      await expect(
        callerWithDb(db).listByPatient({
          patientId: "not-a-uuid",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(select).not.toHaveBeenCalled();
    });
  });

  describe("get query", () => {
    it("returns a single analysis", async () => {
      const analysis = {
        id: ANALYSIS_ID,
        patientId: PATIENT_ID,
        fileId: FILE_ID,
        status: "COMPLETED",
        result: "Analysis result",
      };

      const { db } = createDb({
        selectResults: [[analysis]],
      });

      const result = await callerWithDb(db).get({
        id: ANALYSIS_ID,
      });

      expect(result.id).toBe(ANALYSIS_ID);
      expect(result.status).toBe("COMPLETED");
    });

    it("returns NOT_FOUND when analysis does not exist", async () => {
      const { db } = createDb({
        selectResults: [[]],
      });

      await expect(
        callerWithDb(db).get({
          id: ANALYSIS_ID,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Analýza sa nenašla",
      });
    });

    it("rejects invalid id", async () => {
      const { db, select } = createDb();

      await expect(
        callerWithDb(db).get({
          id: "not-a-uuid",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(select).not.toHaveBeenCalled();
    });
  });
});