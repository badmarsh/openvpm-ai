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

import postgres from "postgres";
import {
  verifyAiAuditChain,
  type AuditChainVerificationResult,
  type AuditLogDbRow,
} from "../apps/web/lib/ai/audit-chain";

/**
 * AI Audit Chain Verification Script (v2)
 *
 * Verifies the tamper-evident hash chain integrity of ext_ai_audit_log.
 *
 * IMPORTANT LIMITATION: This is application-level tamper-evidence only.
 * It detects in-database mutations of audit records. It does NOT prevent a
 * privileged DBA from altering records AND recomputing hashes. External
 * anchoring (WORM storage, TSA) is required for stronger forensic claims.
 * See docs/ai-audit-ledger.md for the full threat model.
 *
 * Usage:
 *   pnpm audit:verify-ai                     # Standard chain verification
 *   pnpm audit:verify-ai --allow-empty       # Allow empty table (dev/first-run)
 *   pnpm audit:verify-ai --json              # Machine-readable JSON output
 */

const args = process.argv.slice(2);
const ALLOW_EMPTY = args.includes("--allow-empty");
const JSON_OUTPUT = args.includes("--json");

function log(msg: string): void {
  if (!JSON_OUTPUT) process.stdout.write(msg + "\n");
}
function logErr(msg: string): void {
  if (!JSON_OUTPUT) process.stderr.write(msg + "\n");
}
function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logErr("❌ ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  log("🔍 Verifying ext_ai_audit_log chain integrity...");

  try {
    // 1. Confirm table exists
    const tableCheck = await sql`
      SELECT to_regclass('public.ext_ai_audit_log') AS regclass;
    `;
    if (!tableCheck[0]?.regclass) {
      if (ALLOW_EMPTY) {
        log("ℹ️  Table ext_ai_audit_log does not exist. --allow-empty: OK.");
        if (JSON_OUTPUT) outputJson({ ok: true, note: "table_missing_allow_empty", totalEvents: 0, errors: [], practiceResults: {} });
        await sql.end();
        process.exit(0);
      }
      logErr("❌ Table ext_ai_audit_log does not exist. Run `pnpm db:push` first.");
      await sql.end();
      process.exit(1);
    }

    // 2. Check whether chain columns are present (post-migration)
    const colCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'ext_ai_audit_log'
        AND column_name IN (
          'sequence_number', 'event_hash', 'previous_event_hash',
          'actor_role', 'action_type', 'canonicalization_version'
        )
      ORDER BY column_name;
    `;
    const presentCols = new Set(colCheck.map((r: { column_name: string }) => r.column_name));
    const chainColumnsPresent =
      presentCols.has("sequence_number") && presentCols.has("event_hash");

    if (!chainColumnsPresent) {
      log("⚠️  Chain columns not present — schema not yet migrated. Running legacy format checks only.");
    }

    // 3. Query events in deterministic order: (practice_id, sequence_number, confirmed_at)
    const raw = chainColumnsPresent
      ? await sql`
          SELECT
            id,
            practice_id              AS "practiceId",
            sequence_number          AS "sequenceNumber",
            actor_id                 AS "actorId",
            actor_role               AS "actorRole",
            entity_type              AS "entityType",
            entity_id                AS "entityId",
            action_type              AS "actionType",
            original_draft_hash      AS "originalDraftHash",
            confirmed_content_hash   AS "confirmedContentHash",
            was_edited_by_clinician  AS "wasEditedByClinician",
            confirmed_at             AS "confirmedAt",
            previous_event_hash      AS "previousEventHash",
            event_hash               AS "eventHash",
            canonicalization_version AS "canonicalizationVersion"
          FROM ext_ai_audit_log
          WHERE deleted_at IS NULL
          ORDER BY practice_id ASC, sequence_number ASC NULLS LAST, confirmed_at ASC;
        `
      : await sql`
          SELECT
            id,
            practice_id             AS "practiceId",
            NULL::int               AS "sequenceNumber",
            actor_id                AS "actorId",
            NULL::text              AS "actorRole",
            entity_type             AS "entityType",
            entity_id               AS "entityId",
            NULL::text              AS "actionType",
            original_draft_hash     AS "originalDraftHash",
            confirmed_content_hash  AS "confirmedContentHash",
            was_edited_by_clinician AS "wasEditedByClinician",
            confirmed_at            AS "confirmedAt",
            NULL::text              AS "previousEventHash",
            NULL::text              AS "eventHash",
            1::int                  AS "canonicalizationVersion"
          FROM ext_ai_audit_log
          WHERE deleted_at IS NULL
          ORDER BY confirmed_at ASC;
        `;

    log(`📊 Found ${raw.length} audit record(s).`);

    if (raw.length === 0) {
      if (ALLOW_EMPTY) {
        log("ℹ️  Audit table exists but is empty. --allow-empty: OK.");
        if (JSON_OUTPUT) outputJson({ ok: true, note: "empty_allow_empty", totalEvents: 0, errors: [], practiceResults: {} });
        await sql.end();
        process.exit(0);
      }
      log("⚠️  Audit table is empty (no records to verify).");
    }

    // 4. Legacy-only path: check hash format + edit-flag consistency
    if (!chainColumnsPresent) {
      const sha256Re = /^[a-f0-9]{64}$/i;
      const errors: { type: string; eventId: string; detail: string }[] = [];
      for (const r of raw) {
        if (!sha256Re.test(r.originalDraftHash ?? ""))
          errors.push({ type: "HASH_FORMAT", eventId: r.id, detail: `invalid original_draft_hash format` });
        if (!sha256Re.test(r.confirmedContentHash ?? ""))
          errors.push({ type: "HASH_FORMAT", eventId: r.id, detail: `invalid confirmed_content_hash format` });
        if (!r.actorId || !r.practiceId || !r.entityId)
          errors.push({ type: "MISSING_REQUIRED_FIELD", eventId: r.id, detail: `missing attribution fields` });
        const expectEdited = r.originalDraftHash !== r.confirmedContentHash;
        if (r.wasEditedByClinician !== expectEdited)
          errors.push({ type: "ALTERED_EDIT_FLAG", eventId: r.id, detail: `wasEditedByClinician=${r.wasEditedByClinician} inconsistent with hashes` });
      }
      const result: AuditChainVerificationResult = {
        ok: errors.length === 0,
        totalEvents: raw.length,
        errors: errors as never,
        practiceResults: {},
      };
      await finalize(sql, result, "legacy_format_only");
      return;
    }

    // 5. Full chain verification
    const result = verifyAiAuditChain(raw as unknown as AuditLogDbRow[]);
    await finalize(sql, result, "chain_verified");
  } catch (err) {
    logErr(`❌ Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    await sql.end();
    process.exit(1);
  }
}

async function finalize(
  sql: ReturnType<typeof postgres>,
  result: AuditChainVerificationResult,
  mode: string,
): Promise<void> {
  if (JSON_OUTPUT) {
    // Redact sensitive data — expose only structural integrity information
    outputJson({
      ok: result.ok,
      mode,
      totalEvents: result.totalEvents,
      errorCount: result.errors.length,
      errors: result.errors.map((e) => ({
        type: e.type,
        sequenceNumber: e.sequenceNumber,
        // eventId intentionally omitted — could link to patient records
        detail: e.detail,
      })),
      practiceResults: Object.fromEntries(
        Object.entries(result.practiceResults).map(([pid, pr]) => [
          // Redact full practiceId — show only last 8 chars as a discriminator
          `...${pid.slice(-8)}`,
          { eventCount: pr.eventCount, ok: pr.ok, errorCount: pr.errors.length },
        ]),
      ),
    });
  } else {
    log("\n==================================================");
    log("         AUDIT CHAIN VERIFICATION SUMMARY");
    log("==================================================");
    log(`Mode:                     ${mode}`);
    log(`Total events inspected:   ${result.totalEvents}`);
    log(`Chain integrity:          ${result.ok ? "✅ PASSED" : "❌ FAILED"}`);
    log(`Errors detected:          ${result.errors.length}`);

    if (!result.ok) {
      for (const e of result.errors) {
        logErr(`  ❌ [${e.type}]${e.sequenceNumber !== undefined ? ` seq=${e.sequenceNumber}` : ""} ${e.detail}`);
      }
    }

    const practiceCount = Object.keys(result.practiceResults).length;
    if (practiceCount > 0) {
      log(`Practices verified:       ${practiceCount}`);
      for (const pr of Object.values(result.practiceResults)) {
        const status = pr.ok ? "✅" : `❌ (${pr.errors.length} errors)`;
        // Redact practiceId — show only discriminating suffix
        log(`  Practice ...${pr.practiceId.slice(-8)}: ${pr.eventCount} events ${status}`);
      }
    }
    log("==================================================");
  }

  await sql.end();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
