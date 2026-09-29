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
  CANONICALIZATION_VERSION,
  computeAiAuditEventHash,
  toUtcIsoString,
  verifyAiAuditChain,
  type AuditChainEventPayload,
  type AuditLogDbRow,
} from "../apps/web/lib/ai/audit-chain";

/**
 * AI Audit Chain Backfill (one-way cutover for pre-chain rows).
 *
 * Rows inserted without chain data (sequence_number IS NULL — pre-chain app
 * versions, manual inserts) fail verification as LEGACY_ROW. This script
 * integrates them into their practice chain:
 *
 *   - deterministic order per practice: (confirmed_at ASC, id ASC)
 *   - sequences continue after the practice's existing max (chained rows are
 *     NEVER rewritten — rewriting history would destroy evidence)
 *   - hashes computed with the production canonicalizer (single implementation)
 *   - missing actorRole/actionType resolved explicitly (row → users.role →
 *     required CLI default); nothing is silently invented
 *
 * Usage:
 *   DATABASE_URL=... pnpm audit:backfill-ai -- --dry-run \
 *     --default-action-type=soap_note_finalized --default-actor-role=veterinarian
 *   DATABASE_URL=... pnpm audit:backfill-ai -- --apply \
 *     --default-action-type=soap_note_finalized --default-actor-role=veterinarian
 *
 * --dry-run (default) prints the plan and changes nothing. --apply runs in a
 * single transaction as the table owner via the documented ledger-maintenance
 * procedure (SET LOCAL app.ledger_maintenance='on'); any failure rolls back.
 * Take a pre-cutover backup first — the backfill is one-way (rollback =
 * restore). Afterwards run `pnpm audit:verify-ai`.
 */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function flagValue(name: string): string | null {
  const prefix = `${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() || null : null;
}

function log(msg: string): void {
  process.stdout.write(msg + "\n");
}
function logErr(msg: string): void {
  process.stderr.write(msg + "\n");
}

interface LegacyRow {
  id: string;
  practiceId: string;
  actorId: string;
  actorRole: string | null;
  entityType: string;
  entityId: string;
  actionType: string | null;
  originalDraftHash: string;
  confirmedContentHash: string;
  wasEditedByClinician: boolean;
  confirmedAt: Date | string;
  deletedAt: Date | string | null;
}

interface ChainTip {
  practiceId: string;
  maxSequence: number;
  tipHash: string | null;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logErr("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }
  const defaultActionType = flagValue("--default-action-type");
  const defaultActorRole = flagValue("--default-actor-role");
  if (!defaultActionType || !defaultActorRole) {
    logErr(
      "ERROR: --default-action-type and --default-actor-role are required. " +
        "Legacy rows without attribution must be steward-attested explicitly; " +
        "this script invents nothing silently.",
    );
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    // 0. Table + columns present?
    const tableCheck = await sql`
      SELECT to_regclass('public.ext_ai_audit_log') AS regclass;`;
    if (!tableCheck[0]?.regclass) {
      logErr("ERROR: table ext_ai_audit_log does not exist.");
      await sql.end();
      process.exit(1);
    }

    // 1. Ownership gate. RLS hides ledger rows from non-owners, so without an
    // up-front check an --apply as the wrong user would misleadingly report
    // "Nothing to do". Refuse --apply unless connected as the table owner;
    // dry-runs warn that the plan may be incomplete.
    const [ownerRow] = (await sql`
      SELECT pg_catalog.pg_get_userbyid(c.relowner) AS owner
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'ext_ai_audit_log';
    `) as unknown as Array<{ owner: string }>;
    const [meRow] = (await sql`SELECT current_user AS user;`) as unknown as Array<{
      user: string;
    }>;
    const isOwner = !!ownerRow && meRow?.user === ownerRow.owner;
    if (APPLY && !isOwner) {
      logErr(
        `ERROR: refusing --apply: connected as '${meRow?.user ?? "?"}' but table owner is ` +
          `'${ownerRow?.owner ?? "?"}'. Backfill must run as the owner via the ` +
          "documented ledger-maintenance procedure.",
      );
      await sql.end();
      process.exit(1);
    }
    if (!APPLY && !isOwner) {
      log(
        `WARNING: connected as non-owner '${meRow?.user ?? "?"}' — RLS may hide ` +
          "rows, so this dry-run plan may be incomplete. Run as the table owner.",
      );
    }

    // 2. Refuse partial-chain states: a sequenced row without a hash means a
    // previous cutover was interrupted or history was tampered with — a
    // steward must investigate before any further chaining.
    const partial = await sql`
      SELECT count(*)::int AS count
      FROM ext_ai_audit_log
      WHERE sequence_number IS NOT NULL AND event_hash IS NULL;`;
    if ((partial[0]?.count ?? 0) > 0) {
      logErr(
        `ERROR: ${partial[0].count} row(s) have sequence_number but no event_hash. ` +
          "Refusing to backfill over a partial chain state — investigate first.",
      );
      await sql.end();
      process.exit(1);
    }

    // 2. Load legacy rows + per-practice chain tips.
    const legacy = (await sql`
      SELECT
        id, practice_id AS "practiceId", actor_id AS "actorId",
        actor_role AS "actorRole", entity_type AS "entityType",
        entity_id AS "entityId", action_type AS "actionType",
        original_draft_hash AS "originalDraftHash",
        confirmed_content_hash AS "confirmedContentHash",
        was_edited_by_clinician AS "wasEditedByClinician",
        confirmed_at AS "confirmedAt", deleted_at AS "deletedAt"
      FROM ext_ai_audit_log
      WHERE sequence_number IS NULL
      ORDER BY practice_id ASC, confirmed_at ASC, id ASC;
    `) as unknown as LegacyRow[];

    if (legacy.length === 0) {
      log("No legacy rows (sequence_number IS NULL). Nothing to do.");
      await sql.end();
      process.exit(0);
    }

    const tips = (await sql`
      SELECT practice_id AS "practiceId",
             max(sequence_number)::int AS "maxSequence"
      FROM ext_ai_audit_log
      WHERE sequence_number IS NOT NULL
      GROUP BY practice_id;
    `) as unknown as ChainTip[];
    const tipByPractice = new Map<string, { seq: number; hash: string | null }>();
    for (const t of tips) {
      const [tipRow] = (await sql`
        SELECT event_hash AS "hash"
        FROM ext_ai_audit_log
        WHERE practice_id = ${t.practiceId}
          AND sequence_number = ${t.maxSequence}
        LIMIT 1;
      `) as unknown as Array<{ hash: string | null }>;
      tipByPractice.set(t.practiceId, {
        seq: t.maxSequence,
        hash: tipRow?.hash ?? null,
      });
    }

    // Actor roles for attribution fallback (documented approximation: the
    // role is read as-of backfill time, not as-of confirmation).
    const actorIds = [...new Set(legacy.map((r) => r.actorId))];
    const roleRows = (
      actorIds.length > 0
        ? await sql`
          SELECT id, role FROM users WHERE id = ANY(${actorIds});`
        : []
    ) as unknown as Array<{ id: string; role: string }>;
    const roleByActor = new Map(roleRows.map((r) => [r.id, r.role]));

    // 3. Build the plan (pure computation — no writes yet).
    interface PlannedRow extends LegacyRow {
      sequenceNumber: number;
      resolvedActorRole: string;
      resolvedActionType: string;
      previousEventHash: string | null;
      eventHash: string;
    }
    const plan: PlannedRow[] = [];
    const cursor = new Map<string, { seq: number; hash: string | null }>();
    for (const row of legacy) {
      let cur = cursor.get(row.practiceId);
      if (!cur) {
        const tip = tipByPractice.get(row.practiceId);
        cur = { seq: tip?.seq ?? 0, hash: tip?.hash ?? null };
        cursor.set(row.practiceId, cur);
      }
      const sequenceNumber = cur.seq + 1;
      const resolvedActorRole =
        row.actorRole ?? roleByActor.get(row.actorId) ?? defaultActorRole;
      const resolvedActionType = row.actionType ?? defaultActionType;
      const payload: AuditChainEventPayload = {
        actionType: resolvedActionType,
        actorId: row.actorId,
        actorRole: resolvedActorRole,
        canonicalizationVersion: CANONICALIZATION_VERSION,
        confirmedAt: toUtcIsoString(row.confirmedAt),
        confirmedContentHash: row.confirmedContentHash,
        entityId: row.entityId,
        entityType: row.entityType,
        originalDraftHash: row.originalDraftHash,
        practiceId: row.practiceId,
        previousEventHash: cur.hash,
        sequenceNumber,
        wasEditedByClinician: row.wasEditedByClinician,
      };
      const eventHash = computeAiAuditEventHash(payload);
      plan.push({
        ...row,
        sequenceNumber,
        resolvedActorRole,
        resolvedActionType,
        previousEventHash: cur.hash,
        eventHash,
      });
      cur.seq = sequenceNumber;
      cur.hash = eventHash;
    }

    // 4. Report the plan (counts + sequences only — no UUIDs in output).
    const perPractice = new Map<string, { count: number; from: number; to: number; deleted: number }>();
    for (const p of plan) {
      const key = `...${p.practiceId.slice(-8)}`;
      const agg = perPractice.get(key) ?? {
        count: 0,
        from: p.sequenceNumber,
        to: p.sequenceNumber,
        deleted: 0,
      };
      agg.count += 1;
      agg.to = p.sequenceNumber;
      if (p.deletedAt) agg.deleted += 1;
      perPractice.set(key, agg);
    }
    log(
      `${APPLY ? "Applying" : "DRY-RUN — no writes"}: ${plan.length} legacy row(s) ` +
        `across ${perPractice.size} practice(s).`,
    );
    for (const [key, agg] of perPractice) {
      log(
        `  practice ${key}: ${agg.count} row(s), seq ${agg.from}..${agg.to}` +
          (agg.deleted > 0 ? ` (incl. ${agg.deleted} soft-deleted — kept flagged)` : ""),
      );
    }

    if (!APPLY) {
      log("Dry run complete. Re-run with --apply to write (owner connection required).");
      await sql.end();
      process.exit(0);
    }

    // 5. Apply: single transaction, owner-only, maintenance bypass scoped
    // with SET LOCAL (automatically reset at COMMIT/ROLLBACK).
    await sql.begin(async (tx) => {
      // Ownership was gated up-front on this same (max:1) connection.
      await tx.unsafe(`SET LOCAL app.ledger_maintenance = 'on'`);
      for (const p of plan) {
        await tx`
          UPDATE ext_ai_audit_log
          SET sequence_number = ${p.sequenceNumber},
              actor_role = ${p.resolvedActorRole},
              action_type = ${p.resolvedActionType},
              previous_event_hash = ${p.previousEventHash},
              event_hash = ${p.eventHash},
              canonicalization_version = ${CANONICALIZATION_VERSION}
          WHERE id = ${p.id} AND sequence_number IS NULL;`;
      }
    });
    log(`Applied ${plan.length} row(s). Verifying...`);

    // 6. Post-apply verification (same checks as the ops verifier).
    const rows = (await sql`
      SELECT
        id, practice_id AS "practiceId", sequence_number AS "sequenceNumber",
        actor_id AS "actorId", actor_role AS "actorRole",
        entity_type AS "entityType", entity_id AS "entityId",
        action_type AS "actionType",
        original_draft_hash AS "originalDraftHash",
        confirmed_content_hash AS "confirmedContentHash",
        was_edited_by_clinician AS "wasEditedByClinician",
        confirmed_at AS "confirmedAt",
        previous_event_hash AS "previousEventHash",
        event_hash AS "eventHash",
        canonicalization_version AS "canonicalizationVersion",
        created_at AS "createdAt", updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM ext_ai_audit_log
      ORDER BY practice_id ASC, sequence_number ASC NULLS LAST, confirmed_at ASC;
    `) as unknown as AuditLogDbRow[];
    const result = verifyAiAuditChain(rows);
    const fatal = result.errors.filter((e) =>
      [
        "HASH_MISMATCH",
        "PREDECESSOR_MISMATCH",
        "SEQUENCE_GAP",
        "SEQUENCE_DUPLICATE",
        "LEGACY_ROW",
      ].includes(e.type),
    );
    const warnings = result.errors.filter((e) => !fatal.includes(e));
    for (const e of [...fatal, ...warnings]) {
      log(
        `  ${fatal.includes(e) ? "FATAL" : "warn"} [${e.type}]` +
          (e.sequenceNumber !== undefined ? ` seq=${e.sequenceNumber}` : ""),
      );
    }
    await sql.end();
    if (fatal.length > 0) {
      logErr(
        `BACKFILL VERIFICATION FAILED with ${fatal.length} chain error(s). ` +
          "Restore from the pre-cutover backup and investigate — do not run --apply again.",
      );
      process.exit(1);
    }
    log(
      `Backfill verified: chain intact, no legacy rows remain` +
        (warnings.length > 0 ? ` (${warnings.length} non-chain warning(s) — see above).` : "."),
    );
    process.exit(0);
  } catch (err) {
    logErr(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    await sql.end();
    process.exit(1);
  }
}

main();
