import { describe, expect, it } from "vitest";
import { createAuthToken } from "../auth-tokens";

describe("createAuthToken", () => {
  it("can write through a provided DB handle for signup transactions", async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const fakeDb = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          insertedRows.push(row);
        },
      }),
    };

    const raw = await createAuthToken({
      db: fakeDb as never,
      userId: "00000000-0000-0000-0000-000000000001",
      email: "Owner@Clinic.test",
      type: "email_verify",
      now: new Date("2026-06-12T00:00:00Z"),
    });

    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    const row = insertedRows[0];
    if (!row) throw new Error("Expected token row to be inserted");
    expect(row).toMatchObject({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "owner@clinic.test",
      type: "email_verify",
    });
    expect(row.tokenHash).not.toBe(raw);
    expect(row.expiresAt).toEqual(new Date("2026-06-13T00:00:00Z"));
  });
});
