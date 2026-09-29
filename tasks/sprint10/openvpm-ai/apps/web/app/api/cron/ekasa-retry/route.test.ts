import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@openpims/db/client", () => ({ db: { query: {} } }));
vi.mock("@/lib/ekasa/service", () => ({ sendToEkasaApi: vi.fn() }));

const { GET } = await import("./route");

describe("ekasa-retry cron auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated callers when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(new Request("http://localhost/api/cron/ekasa-retry"));
    expect(response.status).toBe(401);
  });

  it("rejects a missing bearer when CRON_SECRET is set", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const response = await GET(new Request("http://localhost/api/cron/ekasa-retry"));
    expect(response.status).toBe(401);
  });
});
