import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  selectLimit: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  deleteFile: mocks.deleteFile,
}));

vi.mock("@openpims/db/client", () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.updateWhere,
      })),
    })),
  };
  return { db };
});

import { purgeExpiredAudio } from "../retention";

describe("purgeExpiredAudio (GDPR 24h retention)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeros when no expired audio records exist", async () => {
    mocks.selectLimit.mockResolvedValueOnce([]);

    const result = await purgeExpiredAudio();

    expect(result).toEqual({ processed: 0, deleted: 0, errors: 0 });
    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(mocks.updateWhere).not.toHaveBeenCalled();
  });

  it("purges raw audio files from S3 and marks audioDeletedAt in DB", async () => {
    const expiredRows = [
      { id: "dict-1", audioFileKey: "practices/p1/audio/1.webm" },
      { id: "dict-2", audioFileKey: "practices/p1/audio/2.webm" },
    ];
    mocks.selectLimit.mockResolvedValueOnce(expiredRows);
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.updateWhere.mockResolvedValue(undefined);

    const result = await purgeExpiredAudio();

    expect(result).toEqual({ processed: 2, deleted: 2, errors: 0 });
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenNthCalledWith(1, "practices/p1/audio/1.webm");
    expect(mocks.deleteFile).toHaveBeenNthCalledWith(2, "practices/p1/audio/2.webm");
    expect(mocks.updateWhere).toHaveBeenCalledTimes(2);
  });

  it("handles S3 deletion errors gracefully without aborting remaining batch", async () => {
    const expiredRows = [
      { id: "dict-1", audioFileKey: "practices/p1/audio/fail.webm" },
      { id: "dict-2", audioFileKey: "practices/p1/audio/success.webm" },
    ];
    mocks.selectLimit.mockResolvedValueOnce(expiredRows);
    mocks.deleteFile
      .mockRejectedValueOnce(new Error("S3 Access Denied"))
      .mockResolvedValueOnce(undefined);
    mocks.updateWhere.mockResolvedValue(undefined);

    const result = await purgeExpiredAudio();

    expect(result).toEqual({ processed: 2, deleted: 1, errors: 1 });
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
  });
});
