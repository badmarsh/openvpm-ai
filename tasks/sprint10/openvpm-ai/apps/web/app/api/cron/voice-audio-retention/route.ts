import { NextResponse } from "next/server";
import { purgeExpiredAudio } from "@/lib/voice/retention";
import { cronAuthError } from "@/lib/cron-auth";
import { alertOps } from "@/lib/alerts";
import { reportCronHeartbeat } from "@/lib/cron-heartbeat";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authError = cronAuthError(request);
  if (authError) return authError;

  try {
    const result = await purgeExpiredAudio();
    await reportCronHeartbeat({
      job: "voice-audio-retention",
      status: result.errors > 0 ? "degraded" : "ok",
      detail: `Purged ${result.deleted}/${result.processed} expired audio files${
        result.errors > 0 ? ` (${result.errors} errors)` : ""
      }`,
      metrics: {
        processed: result.processed,
        deleted: result.deleted,
        errors: result.errors,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void alertOps("Voice audio retention purge failed", message);
    await reportCronHeartbeat({
      job: "voice-audio-retention",
      status: "failed",
      detail: message,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
