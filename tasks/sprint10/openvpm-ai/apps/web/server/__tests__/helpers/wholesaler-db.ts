import { vi } from "vitest";
import { extInventoryReceipts } from "@openpims/db";
import { wholesalerImportRouter } from "../../routers/extensions/wholesaler-import";
export const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
export const PRODUCT_ID = "00000000-0000-0000-0000-000000000002";
export const USER_ID = "00000000-0000-0000-0000-000000000001";
export function createImportDb(catalog: any[] = [], duplicateReceipt = false) {
  const writes: Array<{ table: unknown; values: any }> = [];
  const conditions: unknown[] = [];
  const update = vi.fn(() => ({ set: vi.fn((values: any) => ({ where: vi.fn(async (where: unknown) => { conditions.push(where); return []; }) })) }));
  const insert = vi.fn((table: unknown) => ({ values: vi.fn((values: any) => {
    writes.push({ table, values });
    const result = table === extInventoryReceipts ? duplicateReceipt ? [] : [{ id: PRODUCT_ID }] : [];
    const query: any = Promise.resolve(result);
    query.onConflictDoNothing = () => query;
    query.onConflictDoUpdate = () => query;
    query.returning = () => Promise.resolve(result);
    return query;
  }) }));
  const select = vi.fn(() => {
    const query: any = Promise.resolve(catalog);
    query.from = () => query;
    query.leftJoin = () => query;
    query.where = (where: unknown) => { conditions.push(where); return query; };
    query.orderBy = () => query;
    query.limit = () => query;
    query.for = () => query;
    return query;
  });
  const db: any = { execute: vi.fn(async () => []), select, insert, update };
  db.transaction = vi.fn(async (cb: any) => cb(db));
  const caller = (role = "admin") => wholesalerImportRouter.createCaller({
    db, practiceId: PRACTICE_ID,
    session: { user: { id: USER_ID, name: "Test clinician", role, email: "test@example.com", practiceId: PRACTICE_ID } },
  } as never);
  return { db, caller, writes, conditions };
}
