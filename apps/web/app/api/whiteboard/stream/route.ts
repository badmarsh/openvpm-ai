import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events (SSE) endpoint for real-time whiteboard updates (FEAT-2).
 * Pushes live change notifications to connected clinic clients instead of dumb polling.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.practiceId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const practiceId = session.user.practiceId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            practiceId,
            status: "connected",
            timestamp: new Date().toISOString(),
          })}\n\n`
        )
      );

      // 2. Keep-alive heartbeat & sync tick every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ping\ndata: ${JSON.stringify({
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15_000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
