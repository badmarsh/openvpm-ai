/**
 * EVENT-BUS-CLAIM-1 — regression probe for the automation event-bus claim step.
 *
 * `claimPendingEvents()` documents a "SELECT ... FOR UPDATE SKIP LOCKED" claim
 * pattern, but implements SELECT -> UPDATE ... WHERE status='pending' -> SELECT
 * ... WHERE locked_by = POD_ID. The final re-fetch selects by *pod identity*,
 * not by *rows this call actually flipped*, so two overlapping worker runs that
 * share a POD_ID (same Vercel function id, or two invocations inside one warm
 * process) both receive the same events and both process them.
 *
 * The fake database below models Postgres row semantics faithfully:
 *   - the UPDATE honours its `status = 'pending'` guard (a row already claimed
 *     by someone else is not re-flipped), and
 *   - the SELECT is not wrapped in a transaction and takes no row locks, so it
 *     returns whatever the table currently holds.
 * That is exactly the behaviour the production code relies on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Column, Param, SQL, is } from "drizzle-orm";

vi.mock("../rules-engine", () => ({
  evaluateRules: vi.fn(async () => []),
}));

const advanceJourney = vi.fn(
  async (_db: unknown, _clientId?: string, _practiceId?: string) => undefined,
);
vi.mock("../journey-engine", () => ({
  advanceJourney: (db: unknown, clientId?: string, practiceId?: string) =>
    advanceJourney(db, clientId, practiceId),
}));

// eslint-disable-next-line import/first
import { pollAndProcess } from "../event-worker";

// ---------------------------------------------------------------------------
// Minimal drizzle `SQL` interpreter — enough for eq / and / inArray / lt / lte
// / isNull, which is all event-worker.ts builds.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const isSql = (v: unknown): v is { queryChunks: unknown[] } =>
  is(v, SQL);

const isColumn = (v: unknown): v is { config: { name: string } } =>
  is(v, Column);

const isRaw = (v: unknown): v is { value: string[] } =>
  typeof v === "object" &&
  v !== null &&
  Array.isArray((v as { value?: unknown }).value);

/** Unwrap drizzle's `Param` wrapper down to the bound value. */
const unwrapParam = (v: unknown): unknown => (is(v, Param) ? v.value : v);

const toNumber = (v: unknown): number =>
  v instanceof Date ? v.getTime() : Number(v);

function evaluateCondition(node: unknown, row: Row): boolean {
  if (!isSql(node)) {
    throw new Error(`unsupported SQL node in test harness: ${String(node)}`);
  }
  let column: string | null = null;
  let operator: string | null = null;
  const operands: boolean[] = [];
  const operators: string[] = [];

  const apply = (value: unknown) => {
    if (column === null || operator === null) {
      throw new Error(
        `test harness could not bind value ${String(value)} (col=${column}, op=${operator})`,
      );
    }
    const left = row[column];
    switch (operator) {
      case "=":
        operands.push(left === value);
        break;
      case "<":
        operands.push(
          left === null || left === undefined
            ? false
            : toNumber(left) < toNumber(value),
        );
        break;
      case "<=":
        operands.push(
          left === null || left === undefined
            ? false
            : toNumber(left) <= toNumber(value),
        );
        break;
      case "in":
        // drizzle wraps every list element in a `Param`.
        operands.push(
          (value as unknown[]).map(unwrapParam).includes(left),
        );
        break;
      case "is null":
        operands.push(left === null || left === undefined);
        break;
      default:
        throw new Error(`unsupported operator in test harness: ${operator}`);
    }
    column = null;
    operator = null;
  };

  for (const chunk of node.queryChunks) {
    if (isSql(chunk)) {
      operands.push(evaluateCondition(chunk, row));
      continue;
    }
    if (isColumn(chunk)) {
      column = chunk.config.name;
      continue;
    }
    if (isRaw(chunk)) {
      const text = chunk.value.join("").trim().toLowerCase();
      if (text === "" || text === "(" || text === ")") continue;
      if (text === "and" || text === "or") {
        operators.push(text);
        continue;
      }
      operator = text; // "=", "<", "<=", "in", "is null"
      continue;
    }
    apply(unwrapParam(chunk));
  }

  if (operands.length === 0) return true;
  let acc = operands[0]!;
  operators.forEach((op, i) => {
    const right = operands[i + 1]!;
    acc = op === "and" ? acc && right : acc || right;
  });
  return acc;
}

// ---------------------------------------------------------------------------
// Fake Postgres: single shared table, no implicit locking across statements.
// ---------------------------------------------------------------------------

function createFakeDb(initialRows: Row[]) {
  const rows = initialRows.map((r) => ({ ...r }));
  const updates: Array<{ set: Row; matched: number }> = [];

  const db = {
    __rows: rows,
    __updates: updates,
    select: (_projection?: unknown) => {
      let predicate: unknown = null;
      let orderByCol: string | null = null;
      let limitN: number | null = null;
      const builder: Record<string, unknown> = {
        from: () => builder,
        where: (cond: unknown) => {
          predicate = cond;
          return builder;
        },
        orderBy: (col: unknown) => {
          orderByCol = isColumn(col) ? col.config.name : null;
          return builder;
        },
        limit: (n: number) => {
          limitN = n;
          return builder;
        },
        then: (
          resolve: (rows: Row[]) => unknown,
          reject?: (e: unknown) => unknown,
        ) => {
          let out = rows.filter((r) =>
            predicate === null ? true : evaluateCondition(predicate, r),
          );
          if (orderByCol) {
            const key = orderByCol;
            out = [...out].sort((a, b) =>
              (a[key] as Date) < (b[key] as Date) ? -1 : 1,
            );
          }
          if (limitN !== null) out = out.slice(0, limitN);
          return Promise.resolve(out.map((r) => ({ ...r }))).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
    update: (_table: unknown) => {
      let setClause: Row | null = null;
      let predicate: unknown = null;
      let wantsReturning = false;
      const builder: Record<string, unknown> = {
        set: (patch: Row) => {
          setClause = patch;
          return builder;
        },
        where: (cond: unknown) => {
          predicate = cond;
          return builder;
        },
        returning: () => {
          wantsReturning = true;
          return builder;
        },
        then: (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) => {
          if (!setClause) throw new Error("update without set");
          // Drizzle `.set()` receives JS camelCase keys; the WHERE clauses read
          // the snake_case column names. Mirror both onto the row so the fake
          // stays consistent with what Postgres would persist.
          const normalised: Row = {};
          for (const [key, value] of Object.entries(setClause)) {
            normalised[key] = value;
            normalised[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] =
              value;
          }
          let matched = 0;
          const returning: Row[] = [];
          for (const row of rows) {
            if (predicate !== null && !evaluateCondition(predicate, row)) {
              continue;
            }
            Object.assign(row, normalised);
            matched += 1;
            returning.push({ ...row });
          }
          updates.push({ set: { ...setClause }, matched });
          return Promise.resolve(wantsReturning ? returning : undefined).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
  };

  return db;
}

const PRACTICE_ID = "00000000-0000-0000-0000-00000000000a";
const CLIENT_ID = "00000000-0000-0000-0000-00000000000b";

function pendingRow(id: string, availableAt: Date): Row {
  return {
    id,
    practice_id: PRACTICE_ID,
    practiceId: PRACTICE_ID,
    client_id: CLIENT_ID,
    clientId: CLIENT_ID,
    event_type: "appointment_completed",
    eventType: "appointment_completed",
    status: "pending",
    available_at: availableAt,
    availableAt,
    locked_at: null,
    lockedAt: null,
    locked_by: null,
    lockedBy: null,
    deleted_at: null,
    deletedAt: null,
    retry_count: 0,
    retryCount: 0,
  };
}

describe("EVENT-BUS-CLAIM-1: automation event claim is not exclusive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hands the same pending event to two overlapping workers that share a POD_ID", async () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const db = createFakeDb([pendingRow("evt-1", now)]);

    // Same process => identical POD_ID (`worker_${Date.now()}` or a shared
    // VERCEL_FUNCTION_ID). Both runs overlap, as two cron invocations do.
    const [a, b] = await Promise.all([
      pollAndProcess(db as never),
      pollAndProcess(db as never),
    ]);

    const totalProcessed = a + b;

    // Exactly one event exists. An exclusive claim must process it once.
    expect(totalProcessed).toBe(1);
  });

  it("advances the client's journeys once per event, not once per delivery", async () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const db = createFakeDb([pendingRow("evt-1", now)]);

    await Promise.all([
      pollAndProcess(db as never),
      pollAndProcess(db as never),
    ]);

    // advanceJourney emits client communications; duplicate calls mean the
    // client receives the same journey step twice.
    expect(advanceJourney).toHaveBeenCalledTimes(1);
  });

  it("proves the claim with RETURNING instead of re-selecting on a shared pod id", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("lib/autopilot/event-worker.ts", "utf8");

    // The claim must be proven by the UPDATE's own RETURNING clause ...
    expect(source).toMatch(/\.returning\(\)/);
    // ... and must not fall back to re-selecting rows by pod identity, which
    // is shared by every concurrent run inside one warm instance.
    expect(source).not.toMatch(
      /eq\(\s*extAutomationEvents\.lockedBy\s*,\s*POD_ID\s*\)/,
    );
    // The comment must not advertise a locking strategy the code lacks.
    expect(source).not.toContain("FOR UPDATE SKIP LOCKED");
  });
});
