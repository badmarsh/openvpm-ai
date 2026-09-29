import { and, eq, isNull } from "drizzle-orm";
import { files, historicalDocuments, practices, users } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  finalizeManagedUploadManifest,
  markManagedUploadCorrupt,
  putAndVerifyManagedUpload,
  queueManagedUploadReplication,
  reserveManagedUpload,
} from "@/lib/managed-file-upload";
import { checksumSha256Hex } from "@/lib/file-replication";
import { UPLOAD_FILE_MAX_BYTES } from "@/lib/upload-limits";
import { migrationImportFingerprint } from "./fingerprint";
import { withSystem } from "@/lib/tenant-db";

const ALLOWED_MIGRATION_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

export interface HistoricalDocumentImportInput {
  practiceId: string;
  uploadedBy: string;
  source: string;
  externalId: string;
  idempotencyKey: string;
  fileName: string;
  title: string;
  mimeType: string;
  body: Buffer;
}

export interface HistoricalDocumentImportResult {
  historicalDocumentId: string;
  fileId: string;
  replayed: boolean;
}

export class HistoricalDocumentImportError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "storage_unavailable"
      | "storage_corrupt"
      | "invalid_input"
      | "state_conflict" = "state_conflict",
  ) {
    super(message);
    this.name = "HistoricalDocumentImportError";
  }
}

function validateInput(input: HistoricalDocumentImportInput) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(input.source)) {
    throw new HistoricalDocumentImportError(
      "Migration source is invalid.",
      "invalid_input",
    );
  }
  if (!/^[0-9a-f]{64}$/.test(input.externalId)) {
    throw new HistoricalDocumentImportError(
      "Migration document identity must be an opaque SHA-256 digest.",
      "invalid_input",
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input.idempotencyKey,
    )
  ) {
    throw new HistoricalDocumentImportError(
      "Idempotency key is invalid.",
      "invalid_input",
    );
  }
  if (
    input.fileName.length === 0 ||
    input.fileName.length > 255 ||
    /[\\/\0-\x1f\x7f]/.test(input.fileName)
  ) {
    throw new HistoricalDocumentImportError(
      "Document filename is invalid.",
      "invalid_input",
    );
  }
  if (input.title.trim().length === 0 || input.title.length > 255) {
    throw new HistoricalDocumentImportError(
      "Document title is invalid.",
      "invalid_input",
    );
  }
  if (!ALLOWED_MIGRATION_DOCUMENT_MIME_TYPES.has(input.mimeType)) {
    throw new HistoricalDocumentImportError(
      "Document type is not supported.",
      "invalid_input",
    );
  }
  if (
    input.body.byteLength <= 0 ||
    input.body.byteLength > UPLOAD_FILE_MAX_BYTES
  ) {
    throw new HistoricalDocumentImportError(
      "Document size is not supported.",
      "invalid_input",
    );
  }
}

/**
 * Import one checksum-verified file into the tenant-private migration archive.
 * The file is deliberately unlinked until an exact patient/record relationship
 * is proven; upload retries converge through the deterministic reservation.
 */
export async function importHistoricalDocument(
  db: Database,
  input: HistoricalDocumentImportInput,
): Promise<HistoricalDocumentImportResult> {
  validateInput(input);
  const checksum = checksumSha256Hex(input.body);
  const fingerprint = migrationImportFingerprint("historical_documents", [
    input.source,
    input.externalId,
    checksum,
    String(input.body.byteLength),
    input.mimeType,
    input.title,
  ]);

  const reservation = await withSystem(db, async (tx) => {
    const [practice] = await tx
      .select({ id: practices.id, recoveryHold: practices.recoveryHold })
      .from(practices)
      .where(
        and(eq(practices.id, input.practiceId), isNull(practices.deletedAt)),
      )
      .limit(1)
      .for("share");
    if (!practice)
      throw new HistoricalDocumentImportError("Practice not found.");
    if (!practice.recoveryHold) {
      throw new HistoricalDocumentImportError(
        "Historical documents require an active practice recovery hold.",
      );
    }
    const [uploader] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.uploadedBy),
          eq(users.practiceId, input.practiceId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!uploader) {
      throw new HistoricalDocumentImportError(
        "Migration uploader is unavailable.",
      );
    }
    return reserveManagedUpload(tx, {
      practiceId: input.practiceId,
      uploadedBy: input.uploadedBy,
      idempotencyKey: input.idempotencyKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.body.byteLength,
      checksumSha256: checksum,
      category: "documents",
      source: `migration:${input.source}`,
      entityType: "practice",
      entityId: input.practiceId,
    });
  });

  const write = await putAndVerifyManagedUpload({
    reservation,
    body: input.body,
  });
  if (write.status === "corrupt") {
    await withSystem(db, async (tx) => {
      await markManagedUploadCorrupt(tx, reservation);
    });
    throw new HistoricalDocumentImportError(
      "Document storage verification found different bytes.",
      "storage_corrupt",
    );
  }
  if (write.status === "unavailable") {
    throw new HistoricalDocumentImportError(
      "Document storage could not be verified; the reservation remains retryable.",
      "storage_unavailable",
    );
  }

  const linked = await withSystem(db, async (tx) => {
    const [practice] = await tx
      .select({ id: practices.id, recoveryHold: practices.recoveryHold })
      .from(practices)
      .where(
        and(eq(practices.id, input.practiceId), isNull(practices.deletedAt)),
      )
      .limit(1)
      .for("share");
    if (!practice?.recoveryHold) {
      throw new HistoricalDocumentImportError(
        "Practice recovery hold changed before document finalization.",
      );
    }
    const finalized = await finalizeManagedUploadManifest(
      tx,
      reservation,
      write.evidence,
    );
    if (!finalized) {
      throw new HistoricalDocumentImportError(
        "Document manifest changed before finalization.",
      );
    }
    await tx
      .update(files)
      .set({
        title: input.title,
        documentType: "migration-archive",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(files.id, reservation.id),
          eq(files.practiceId, input.practiceId),
          eq(files.storageStatus, "available"),
          isNull(files.deletedAt),
        ),
      );

    const [inserted] = await tx
      .insert(historicalDocuments)
      .values({
        practiceId: input.practiceId,
        fileId: reservation.id,
        kind: "other",
        linkStatus: "needs_review",
        title: input.title,
        externalSource: input.source,
        externalId: input.externalId,
        importFingerprint: fingerprint,
      })
      .onConflictDoNothing()
      .returning({ id: historicalDocuments.id });
    if (inserted) return { id: inserted.id, replayed: false };

    const [existing] = await tx
      .select({
        id: historicalDocuments.id,
        fileId: historicalDocuments.fileId,
        importFingerprint: historicalDocuments.importFingerprint,
        deletedAt: historicalDocuments.deletedAt,
      })
      .from(historicalDocuments)
      .where(
        and(
          eq(historicalDocuments.practiceId, input.practiceId),
          eq(historicalDocuments.externalSource, input.source),
          eq(historicalDocuments.externalId, input.externalId),
        ),
      )
      .limit(1)
      .for("update");
    if (
      !existing ||
      existing.deletedAt !== null ||
      existing.fileId !== reservation.id ||
      existing.importFingerprint !== fingerprint
    ) {
      throw new HistoricalDocumentImportError(
        "Document source identity conflicts with an existing archive row.",
      );
    }
    return { id: existing.id, replayed: true };
  });

  await queueManagedUploadReplication(reservation, write.evidence);
  return {
    historicalDocumentId: linked.id,
    fileId: reservation.id,
    replayed: linked.replayed,
  };
}
