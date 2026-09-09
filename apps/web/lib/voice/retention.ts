import { and, eq, isNull, lt, isNotNull, or } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { voiceDictations } from "@openpims/db";
import { deleteFile } from "@/lib/s3";

export const AUDIO_RETENTION_HOURS = 24;
/** GDPR: raw voice audio must be purged 24 h after it was captured. */
export const VOICE_AUDIO_RETENTION_MS = AUDIO_RETENTION_HOURS * 60 * 60 * 1000;

/**
 * Purge raw audio files older than the retention window.
 * Transcripts and SOAP sections are clinical records and are retained;
 * only the source audio blob is deleted for GDPR compliance.
 *
 * A dictation is eligible when EITHER
 *  - its `scheduledDeleteAt` (set to upload time + 24 h on insert) has passed, OR
 *  - it was completed more than 24 h ago (legacy rows without `scheduledDeleteAt`).
 * Using the scheduled timestamp guarantees that abandoned/failed recordings
 * (never completed) are still purged 24 h after capture.
 */
export async function purgeExpiredAudio(): Promise<{
  processed: number;
  deleted: number;
  errors: number;
}> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - VOICE_AUDIO_RETENTION_MS);

  const candidates = await db
    .select({
      id: voiceDictations.id,
      audioFileKey: voiceDictations.audioFileKey,
    })
    .from(voiceDictations)
    .where(
      and(
        isNotNull(voiceDictations.audioFileKey),
        isNull(voiceDictations.audioDeletedAt),
        isNull(voiceDictations.deletedAt),
        or(
          lt(voiceDictations.scheduledDeleteAt, now),
          and(
            isNotNull(voiceDictations.completedAt),
            lt(voiceDictations.completedAt, cutoff),
          ),
        ),
      ),
    )
    .limit(1000);

  let deleted = 0;
  let errors = 0;

  for (const row of candidates) {
    if (!row.audioFileKey) continue;
    try {
      await deleteFile(row.audioFileKey);
      await db
        .update(voiceDictations)
        .set({
          audioFileKey: null,
          audioDeletedAt: new Date(),
        })
        .where(eq(voiceDictations.id, row.id));
      deleted++;
    } catch (err) {
      console.error(
        `[voice-retention] Failed to purge audio for dictation ${row.id}:`,
        err,
      );
      errors++;
    }
  }

  return { processed: candidates.length, deleted, errors };
}
