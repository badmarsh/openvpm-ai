import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@openpims/db/client", () => ({ db: { query: {} } }));
vi.mock("@/lib/ekasa/service", () => ({ createDailyClosure: vi.fn() }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: vi.fn() }));

const { GET } = await import("./route");

describe("ekasa-daily-closure cron auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated callers when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(
      new Request("http://localhost/api/cron/ekasa-daily-closure"),
    );
    expect(response.status).toBe(401);
  });
});
