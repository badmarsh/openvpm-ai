/**
 * Automation worker cron endpoint.
 *
 * Invoked every 60 seconds by Vercel cron to process pending automation events.
 *
 * Security:
 * - Requires CRON_SECRET in Authorization header
 * - Uses withSystem for cross-tenant sweeps
 * - Idempotent: safe to retry if cron fires multiple times
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { pollAndProcess } from "@/lib/autopilot/event-worker";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Verify cron authentication.
 * Returns true if request is authorized, false otherwise.
 */
function cronAuthError(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const xCronSecret = request.headers.get("x-cron-secret");

  // Require CRON_SECRET to be set
  if (!CRON_SECRET) {
    console.warn(
      "[automation-cron] CRON_SECRET not configured — rejecting request"
    );
    return true;
  }

  // Check Authorization header
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return false;
  }

  // Check x-cron-secret header (local dev fallback)
  if (xCronSecret === CRON_SECRET) {
    return false;
  }

  console.warn(
    "[automation-cron] Invalid or missing credentials"
  );
  return true;
}

export async function POST(request: NextRequest) {
  // Authenticate cron request
  if (cronAuthError(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Process pending events
    const processedCount = await pollAndProcess(db);

    // Report success
    return NextResponse.json({
      status: "ok",
      processedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[automation-cron] Worker failed:", error);

    return NextResponse.json(
      {
        error: "Worker failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: "ok",
    service: "automation-worker",
    timestamp: new Date().toISOString(),
  });
}
