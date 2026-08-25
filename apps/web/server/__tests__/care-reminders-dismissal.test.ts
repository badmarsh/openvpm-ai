import { afterEach, describe, expect, it, vi } from "vitest";
import { careRemindersRouter } from "../routers/care-reminders";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const REMINDER_ID = "00000000-0000-0000-0000-000000000002";
const SECOND_REMINDER_ID = "00000000-0000-0000-0000-000000000003";
const UPDATED_AT = new Date("2026-08-24T16:00:00.000Z");

function callerWithDb(db: Record<string, unknown>) {
  return careRemindersRouter.createCaller({
    db,
    session: {
      user: {
        id: USER_ID,
        email: "doctor@example.test",
        name: "Dr. Rivera",
        role: "veterinarian",
        practiceId: PRACTICE_ID,
      },
    },
  } as never);
}

function createDb(options?: {
  current?: Array<{ id: string; status: string; updatedAt: Date }>;
  updated?: Array<{ id: string }>;
}) {
  const selectResults: unknown[][] = [
    [{ id: PRACTICE_ID, timezone: "America/New_York" }],
    options?.current ?? [],
  ];
  const select = vi.fn(() => {
    const result = selectResults.shift() ?? [];
    const afterWhere = {
      limit: vi.fn(async () => result),
      orderBy: vi.fn(() => afterWhere),
      for: vi.fn(async () => result),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    const builder = {
      from: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      where: vi.fn(() => afterWhere),
    };
    return builder;
  });
  const updateReturning = vi.fn(async () => options?.updated ?? []);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const db: Record<string, unknown> = {
    execute: vi.fn(async () => undefined),
    select,
    update,
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db, select, updateSet };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("care reminder dismissal", () => {
  it("requires an explanatory reason and unique bounded targets before DB work", async () => {
    const { db, select } = createDb();
    const caller = callerWithDb(db);

    await expect(
      caller.setDismissed({
        dismissed: true,
        reason: "x",
        items: [
          { id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.setDismissed({
        dismissed: true,
        reason: "Duplicate import",
        items: [
          { id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() },
          { id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(select).not.toHaveBeenCalled();
  });

  it("atomically dismisses all selected open reminders with attribution", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T18:30:00.000Z"));
    const { db, updateSet } = createDb({
      current: [
        { id: REMINDER_ID, status: "open", updatedAt: UPDATED_AT },
        { id: SECOND_REMINDER_ID, status: "open", updatedAt: UPDATED_AT },
      ],
      updated: [{ id: REMINDER_ID }, { id: SECOND_REMINDER_ID }],
    });

    await expect(
      callerWithDb(db).setDismissed({
        dismissed: true,
        reason: "Duplicate reminders from legacy import",
        items: [
          { id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() },
          {
            id: SECOND_REMINDER_ID,
            expectedUpdatedAt: UPDATED_AT.toISOString(),
          },
        ],
      }),
    ).resolves.toEqual({
      id: REMINDER_ID,
      ids: [REMINDER_ID, SECOND_REMINDER_ID],
    });

    expect(updateSet).toHaveBeenCalledWith({
      status: "dismissed",
      dismissedAt: new Date("2026-08-24T18:30:00.000Z"),
      dismissedBy: USER_ID,
      dismissalReason: "Duplicate reminders from legacy import",
      completedAt: null,
      completedBy: null,
      updatedAt: new Date("2026-08-24T18:30:00.000Z"),
    });
  });

  it("fails the whole batch on a stale timestamp or non-open source", async () => {
    const { db, updateSet } = createDb({
      current: [
        {
          id: REMINDER_ID,
          status: "completed",
          updatedAt: UPDATED_AT,
        },
      ],
    });

    await expect(
      callerWithDb(db).setDismissed({
        dismissed: true,
        reason: "Duplicate reminder",
        items: [
          { id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() },
        ],
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "One or more reminders changed. Refresh before updating them.",
    });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("restores only an unchanged dismissed reminder and clears dismissal evidence", async () => {
    const { db, updateSet } = createDb({
      current: [
        { id: REMINDER_ID, status: "dismissed", updatedAt: UPDATED_AT },
      ],
      updated: [{ id: REMINDER_ID }],
    });

    await callerWithDb(db).setDismissed({
      dismissed: false,
      items: [{ id: REMINDER_ID, expectedUpdatedAt: UPDATED_AT.toISOString() }],
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        dismissedAt: null,
        dismissedBy: null,
        dismissalReason: null,
        completedAt: null,
        completedBy: null,
      }),
    );
  });
});
