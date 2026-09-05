import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("liveness probe", () => {
  it("returns 200 without depending on the database", async () => {
    const response = GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      probe: "live",
      service: "openvpm-web",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});
