import { describe, expect, it, vi } from "vitest";
import { duplicateShieldRouter } from "../routers/extensions/duplicate-shield";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function createCaller(db: Record<string, unknown>, role = "admin") {
  const session = {
    user: {
      id: USER_ID,
      email: `${role}@example.com`,
      name: "Veterinarian",
      role,
      practiceId: PRACTICE_ID,
    },
  };
  return duplicateShieldRouter.createCaller({ db, session, practiceId: PRACTICE_ID } as never);
}

describe("duplicateShieldRouter", () => {
  it("checkClient returns duplicate match when phone matches", async () => {
    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "client-1",
                firstName: "Martin",
                lastName: "Kováč",
                phone: "+421905123456",
                email: "kovac@example.com",
              },
            ]),
          })),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const result = await caller.checkClient({
      phone: "0905 123 456",
    });

    expect(result.found).toBe(true);
    expect(result.client).not.toBeNull();
    expect(result.client?.id).toBe("client-1");
  });

  it("checkClient returns false when no match found", async () => {
    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const result = await caller.checkClient({
      phone: "0911 999 888",
    });

    expect(result.found).toBe(false);
    expect(result.client).toBeNull();
  });

  it("checkPatient returns duplicate match with patient details and owner name", async () => {
    const mockDb: Record<string, unknown> = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: "pat-99",
                  name: "Dunčo",
                  species: "canine",
                  microchipNumber: "900182000123456",
                  clientId: "client-1",
                  ownerFirstName: "Martin",
                  ownerLastName: "Kováč",
                },
              ]),
            })),
          })),
        })),
      })),
    };

    const caller = createCaller(mockDb);
    const result = await caller.checkPatient({
      microchipNumber: "900 182 000 123 456",
    });

    expect(result.found).toBe(true);
    expect(result.patient).not.toBeNull();
    expect(result.patient?.name).toBe("Dunčo");
    expect(result.patient?.ownerName).toBe("Martin Kováč");
  });
});
