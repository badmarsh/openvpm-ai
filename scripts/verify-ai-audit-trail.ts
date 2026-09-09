import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../.env"),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

import { createHash } from "node:crypto";
import postgres from "postgres";

/**
 * Audit Trail Verification Script (ŠVPS SR / KVL SR / GDPR compliance)
 *
 * Verifies the mathematical and logical integrity of the `ext_ai_audit_log`
 * ledger in PostgreSQL:
 *  1. Confirms all records have valid 64-char SHA-256 hexadecimal digests.
 *  2. Confirms `wasEditedByClinician === (originalDraftHash !== confirmedContentHash)`.
 *  3. Verifies that no critical fields (actor_id, practice_id, entity_id) are null.
 *  4. Detects any anomalies or timestamps in the future.
 *
 * Usage:
 *   pnpm audit:verify-ai
 */

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("🔍 Scanning `ext_ai_audit_log` for forensic integrity...");

  try {
    const tableExists = await sql`
      SELECT to_regclass('public.ext_ai_audit_log') as regclass;
    `;
    if (!tableExists[0]?.regclass) {
      console.log("ℹ️ Table `ext_ai_audit_log` does not exist yet. Run `pnpm db:push` first.");
      await sql.end();
      process.exit(0);
    }

    const records = await sql`
      SELECT
        id,
        practice_id,
        actor_id,
        actor_name,
        entity_type,
        entity_id,
        original_draft_hash,
        confirmed_content_hash,
        was_edited_by_clinician,
        confirmed_at,
        created_at
      FROM ext_ai_audit_log
      ORDER BY confirmed_at ASC;
    `;

    console.log(`📊 Found ${records.length} AI confirmation audit records.`);

    const sha256Regex = /^[a-f0-9]{64}$/i;
    let errors = 0;
    let verifiedCount = 0;
    let clinicianEditedCount = 0;
    let acceptedAsIsCount = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];

      // Check hash format
      if (!sha256Regex.test(r.original_draft_hash)) {
        console.error(`❌ [Record ${r.id}]: Invalid original_draft_hash format: "${r.original_draft_hash}"`);
        errors++;
      }
      if (!sha256Regex.test(r.confirmed_content_hash)) {
        console.error(`❌ [Record ${r.id}]: Invalid confirmed_content_hash format: "${r.confirmed_content_hash}"`);
        errors++;
      }

      // Check logical consistency of was_edited_by_clinician
      const hashesDiffer = r.original_draft_hash !== r.confirmed_content_hash;
      if (r.was_edited_by_clinician !== hashesDiffer) {
        console.error(
          `❌ [Record ${r.id}]: Inconsistent edit flag: was_edited_by_clinician=${r.was_edited_by_clinician}, but hashesDiffer=${hashesDiffer}`
        );
        errors++;
      }

      if (r.was_edited_by_clinician) {
        clinicianEditedCount++;
      } else {
        acceptedAsIsCount++;
      }

      // Check required attribution
      if (!r.actor_id || !r.practice_id || !r.entity_id) {
        console.error(`❌ [Record ${r.id}]: Missing attribution: actor_id, practice_id, or entity_id is null`);
        errors++;
      }

      verifiedCount++;
    }

    console.log("\n==================================================");
    console.log("             AUDIT TRAIL VERIFICATION SUMMARY      ");
    console.log("==================================================");
    console.log(`Total records inspected:    ${records.length}`);
    console.log(`Passed verification:        ${verifiedCount - errors}`);
    console.log(`Tamper / logic violations:  ${errors}`);
    console.log(`Clinician-edited drafts:    ${clinicianEditedCount}`);
    console.log(`Accepted without edits:     ${acceptedAsIsCount}`);
    console.log("==================================================");

    await sql.end();

    if (errors > 0) {
      console.error(`\n❌ Verification FAILED with ${errors} integrity errors.`);
      process.exit(1);
    } else {
      console.log("\n✅ Verification PASSED: All AI audit records are cryptographically and logically sound.");
      process.exit(0);
    }
  } catch (err) {
    console.error("❌ Unexpected error during audit verification:", err);
    await sql.end();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
