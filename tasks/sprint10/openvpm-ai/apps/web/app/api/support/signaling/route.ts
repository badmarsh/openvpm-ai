import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasBlankConfiguredNextAuthSecret } from "@/lib/auth-secret";

/**
 * WebSocket signaling is not implemented on this Next.js route.
 * Require an authenticated staff session so the URL is not an unauthenticated
 * probe surface, then return 501 until a dedicated signaling service exists.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (hasBlankConfiguredNextAuthSecret()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upgrade = req.headers.get("upgrade")?.toLowerCase();
  if (upgrade !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  return new Response(
    "WebSocket signaling requires a dedicated server. Use an external WS server or LiveKit.",
    { status: 501 },
  );
}
