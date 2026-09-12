import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

const { GET } = await import("./route");

describe("whiteboard stream route GET", () => {
  it("returns 401 Unauthorized when session is missing", async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/whiteboard/stream");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 200 with text/event-stream headers when authenticated", async () => {
    mocks.getServerSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        practiceId: "practice-123",
      },
    });

    const controller = new AbortController();
    const req = new NextRequest("http://localhost:3000/api/whiteboard/stream", {
      signal: controller.signal,
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");

    // Read initial event
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value);
    expect(text).toContain("event: connected");
    expect(text).toContain("practice-123");

    controller.abort();
  });
});
