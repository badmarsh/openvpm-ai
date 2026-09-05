import { and, eq, isNull, lt, isNotNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { voiceDictations } from "@openpims/db";
import { deleteFile } from "@/lib/s3";

const AUDIO_RETENTION_HOURS = 24;

/**
 * Purge raw audio files older than the retention window.
 * Transcripts and SOAP sections are clinical records and are retained;
 * only the source audio blob is deleted for GDPR compliance.
 */
export async function purgeExpiredAudio(): Promise<{
  processed: number;
  deleted: number;
  errors: number;
}> {
  const cutoff = new Date(Date.now() - AUDIO_RETENTION_HOURS * 60 * 60 * 1000);

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
        isNotNull(voiceDictations.completedAt),
        lt(voiceDictations.completedAt, cutoff),
        isNull(voiceDictations.deletedAt),
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
