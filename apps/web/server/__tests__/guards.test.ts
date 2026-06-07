import { describe, it, expect } from "vitest";
import { appRouter } from "../routers/_app";

// Build a tRPC caller with a fake session. The db is a throwing proxy: any
// resolver that reaches the database fails loudly — so a passing query proves
// the guard let it through to a db-free path, and a FORBIDDEN proves the guard
// short-circuited before the resolver.
function callerFor(role: string) {
  const session = {
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "u@example.com",
      name: "U",
      role,
      practiceId: "00000000-0000-0000-0000-0000000000aa",
    },
  };
  return appRouter.createCaller({ db: {} as never, session } as never);
}

describe("viewer read-only guard", () => {
  it("allows queries for a viewer", async () => {
    const caller = callerFor("viewer");
    // dosing.formulary is a query with no DB access.
    const res = await caller.dosing.formulary();
    expect(res.drugs.length).toBeGreaterThan(0);
  });

  it("blocks mutations for a viewer with FORBIDDEN (before the resolver)", async () => {
    const caller = callerFor("viewer");
    await expect(
      caller.clients.create({ firstName: "A", lastName: "B" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not block queries for non-viewer roles", async () => {
    const caller = callerFor("front_desk");
    const res = await caller.dosing.formulary();
    expect(res.drugs.length).toBeGreaterThan(0);
  });
});
