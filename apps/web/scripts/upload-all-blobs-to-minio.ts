/**
 * upload-all-blobs-to-minio.ts
 *
 * Načíta všetkých 47 binárnych RTG / obrazových príloh z Firebirdu (TAB059.IMAGE_DATA)
 * a nahrá ich priamo do MinIO (S3) úložiska.
 * Následne aktualizuje status v tabuľke files na 'available' s overeným storageVerifiedAt.
 */

import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "@openpims/db";
import { files } from "@openpims/db";
import {
  fbQuery,
  decodeWin1250,
  readBinaryBlob,
  readTextBlob,
  withFirebird,
} from "../lib/import/vetsoftware-v2-extractor";
import { uploadManagedFile, readPrimaryObject } from "../lib/s3";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://openpims:openpims@localhost:5434/openvpm_ai";

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  UPLOAD BINÁRNYCH RTG PRÍLOH Z FIREBIRDU DO MinIO (S3) ÚLOŽISKA  ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log(`MinIO Endpoint: ${process.env.S3_ENDPOINT}`);
  console.log(`MinIO Bucket:   ${process.env.S3_BUCKET}\n`);

  await withFirebird(async (fbDb) => {
    const rawFiles = await fbQuery<any>(
      fbDb,
      `SELECT o.ID_OBR, o.ID_PAC, o.NAZEV, o.POPIS, o.DNE, p.FILE_NAME, p.IMAGE_DATA
       FROM TAB058 o
       JOIN TAB059 p ON o.ID_OBR = p.ID_RADKU
       WHERE (o.VYMAZ = 0 OR o.VYMAZ IS NULL)
       ORDER BY o.ID_OBR`
    );

    console.log(`Nájdených ${rawFiles.length} príloh v TAB058/TAB059.\n`);

    let uploadedCount = 0;
    let failedCount = 0;

    for (const r of rawFiles) {
      const extId = String(r.ID_OBR);
      const rawFileName = await readTextBlob(r.FILE_NAME, 3000);
      const cleanBaseName = rawFileName
        ? rawFileName.split(/[\\/]/).pop()?.trim()
        : null;
      const origName = cleanBaseName || `rtg_${extId}.jpg`;
      const safeBaseName = origName.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
      const fileKey = `${PRACTICE_ID}/documents/v2_${extId}_${safeBaseName}`.replace(
        /\s+/g,
        "_"
      );
      const mimeType = origName.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";

      try {
        const buf = await readBinaryBlob(r.IMAGE_DATA, 5000);
        if (!buf || buf.length === 0) {
          console.warn(`  ⚠️  Súbor #${extId} (${origName}): BLOB je prázdny, preskakujem.`);
          continue;
        }

        const sizeBytes = buf.length;
        const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

        // 1. Nahráme do MinIO S3
        await uploadManagedFile(fileKey, buf, mimeType, sha256);

        // 2. Aktualizujeme záznam vo files tabuľke
        await db
          .update(files)
          .set({
            storageStatus: "available",
            storageVerifiedAt: new Date(),
            fileSizeBytes: sizeBytes,
            checksumSha256: sha256,
            mimeType,
            updatedAt: new Date(),
          })
          .where(and(eq(files.practiceId, PRACTICE_ID), eq(files.fileKey, fileKey)));

        uploadedCount++;
        console.log(
          `  ✓ [${uploadedCount}/${rawFiles.length}] Nahrané: v2_${extId}_${safeBaseName} (${(sizeBytes / 1024).toFixed(1)} KB) -> MinIO OK`
        );
      } catch (err: any) {
        failedCount++;
        console.error(`  ❌ Chyba pri nahrávaní #${extId} (${origName}):`, err.message);
      }
    }

    console.log(`\nHotovo: Úspešne nahraných ${uploadedCount} súborov (chyby: ${failedCount}).\n`);
  });

  // Test overenia pre konkrétny súbor, ktorý používateľ hľadal
  console.log("── Test overenia pre súbor malusova.JPG ──────────────────────────");
  const testKey = `${PRACTICE_ID}/documents/v2_48_malusova.JPG`;
  const readTest = await readPrimaryObject(testKey);
  console.log(`Výsledok overenia pre ${testKey}:`, readTest.status);
  if (readTest.status === "available") {
    console.log(`✓ Súbor je prístupný v MinIO! Veľkosť: ${readTest.body.byteLength} bajtov, Typ: ${readTest.contentType}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
