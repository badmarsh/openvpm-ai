import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: the Node process can serve HTTP. Does not query the database.
 * Readiness (safe to take traffic) is GET /api/health and GET /api/health/ready.
 */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      probe: "live",
      service: "openvpm-web",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
