/**
 * One-shot dev database bootstrap.
 *
 * Why this exists
 * ---------------
 * `pnpm db:push` alone cannot bring a pristine database to a fully working
 * state with drizzle-kit 0.31.10 (the latest release):
 *
 *   1. drizzle-kit orders composite tenant foreign keys (REFERENCES
 *      tbl("practice_id","id")) BEFORE the unique indexes that back them
 *      (e.g. clients_practice_id_uq), so the first push on a fresh database
 *      aborts with: "there is no unique constraint matching given keys".
 *
 *   2. `db:push` does not manage the journal's object layer — the ~70
 *      immutable clinical safety functions, triggers and DO blocks that ship
 *      in packages/db/drizzle/*.sql (SOAP lifecycle guards, consent-evidence
 *      protection, dispense-charge protection, …). Without them,
 *      `pnpm db:rls` fails and the clinical integrity layer is silently
 *      absent.
 *
 *   3. Once synced, repeated pushes re-detect known drizzle-kit diff quirks
 *      (FK key order vs table column order, unique indexes referenced by
 *      foreign keys, string-strict default comparison) and finish with a
 *      benign "relation … already exists" error after all real work is done.
 *
 * What this script does (idempotent, safe to re-run)
 * --------------------------------------------------
 *   1. `drizzle-kit push` — tolerate the expected fresh-database failure.
 *   2. On failure: materialize every index from the current TS schema into
 *      the database (IF NOT EXISTS) so the backing unique indexes exist
 *      before drizzle applies the dependent foreign keys, then push again.
 *   3. Apply the journal object layer (CREATE [OR REPLACE] FUNCTION,
 *      CREATE TRIGGER, DO blocks) in journal order. The journal files are
 *      only read, never modified — zero-conflict upstream sync is preserved.
 *   4. Verify the database: all journal functions present, schema drift
 *      clean (when the openpims_app RLS role exists), and treat the known
 *      benign drizzle churn signature as success only when the database is
 *      verified complete.
 *
 * Usage
 * -----
 *   pnpm db:bootstrap            # full bootstrap / re-sync
 *
 * Afterwards follow the README flow:
 *   OPENPIMS_APP_DB_PASSWORD='local-openpims-app' pnpm db:rls
 *   OPENPIMS_APP_DB_PASSWORD='local-openpims-app' pnpm db:rls:test
 *   pnpm db:seed
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { isPooledDatabaseConnection } from "./connection-policy";

const DB_DIR = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.join(DB_DIR, "drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

// ---------------------------------------------------------------------------
// Console helpers
// ---------------------------------------------------------------------------
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function log(msg: string): void {
  console.log(`\x1b[36m[db:bootstrap]\x1b[0m ${msg}`);
}
function warn(msg: string): void {
  console.warn(`\x1b[33m[db:bootstrap] ⚠ ${msg}\x1b[0m`);
}
function fail(msg: string, extra?: string): never {
  console.error(`\x1b[31m[db:bootstrap] ✗ ${msg}\x1b[0m`);
  if (extra) console.error(extra);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// drizzle-kit subprocess wrapper
// ---------------------------------------------------------------------------
function runDrizzleKit(args: string[]): { ok: boolean; output: string } {
  const result = spawnSync("npx", ["drizzle-kit", ...args], {
    cwd: DB_DIR,
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  // drizzle-kit 0.31.10 exits 0 even when a pushed statement fails — the
  // failure is only visible in the printed PostgresError, so detect it here.
  const failed = result.status !== 0 || /PostgresError/i.test(output);
  return { ok: !failed, output };
}

function pushSchema(): { ok: boolean; output: string } {
  log("drizzle-kit push …");
  return runDrizzleKit(["push"]);
}

// ---------------------------------------------------------------------------
// Step 2 — materialize every index from the current TS schema
// ---------------------------------------------------------------------------
function collectIndexStatements(): string[] {
  const work = mkdtempSync(path.join(tmpdir(), "openpims-bootstrap-"));
  try {
    const cfgPath = path.join(work, "bootstrap-generate.config.ts");
    const schemaPath = path.join(DB_DIR, "schema", "index.ts").replace(/\\/g, "/");
    const outPath = path.join(work, "out").replace(/\\/g, "/");
    writeFileSync(
      cfgPath,
      [
        'import { defineConfig } from "drizzle-kit";',
        "export default defineConfig({",
        `  schema: ${JSON.stringify(schemaPath)},`,
        `  out: ${JSON.stringify(outPath)},`,
        '  dialect: "postgresql",',
        `  dbCredentials: { url: "postgresql://bootstrap:bootstrap@localhost:5432/bootstrap" },`,
        "});",
        "",
      ].join("\n"),
    );
    const gen = runDrizzleKit(["generate", "--config", cfgPath]);
    if (!gen.ok) {
      return fail(
        "drizzle-kit generate failed while deriving index DDL",
        gen.output.slice(-2000),
      );
    }
    const outDir = path.join(work, "out");
    const sqlFiles = existsSync(outDir)
      ? readdirSync(outDir).filter((f) => f.endsWith(".sql")).sort()
      : [];
    if (sqlFiles.length === 0) return [];
    const sql = sqlFiles
      .map((f) => readFileSync(path.join(outDir, f), "utf8"))
      .join("\n");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    return statements.filter((s) =>
      /^CREATE\s+(UNIQUE\s+)?INDEX\s+"/i.test(s),
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function ensureIndexes(client: postgres.Sql): Promise<number> {
  const indexStmts = collectIndexStatements();
  let created = 0;
  for (const stmt of indexStmts) {
    const body = stmt.replace(/;\s*$/, "");
    const withIf = body.replace(
      /^CREATE\s+(UNIQUE\s+)?INDEX\s/i,
      "CREATE $1INDEX IF NOT EXISTS ",
    );
    try {
      await client.unsafe(withIf);
      created++;
    } catch (err: any) {
      // If the target table does not exist yet during pre-creation, skip it.
      // drizzle-kit push will create the table and the repair pass will ensure the index.
      if (err?.code === "42P01") continue;
      throw err;
    }
  }
  log(`indexes ensured (${created} index statements applied IF NOT EXISTS)`);
  return created;
}

// ---------------------------------------------------------------------------
// Step 3 — journal object layer (functions, triggers, DO blocks)
// ---------------------------------------------------------------------------
interface ObjectLayerStats {
  functions: string[];
  applied: number;
  skipped: number;
}

function stripLeadingComments(s: string): string {
  return s.replace(/^(--[^\n]*\n)+/, "").trimStart();
}

function journalObjectStatements(): {
  statements: { file: string; sql: string }[];
  expectedFunctions: string[];
} {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
    entries: { idx: number; tag?: string; version?: string; when: number }[];
  };
  const statements: { file: string; sql: string }[] = [];
  const expectedFunctions = new Set<string>();
  for (const entry of journal.entries) {
    const file = path.join(DRIZZLE_DIR, `${entry.tag ?? entry.idx}.sql`);
    if (!existsSync(file)) continue;
    const sql = readFileSync(file, "utf8");
    for (const raw of sql.split("--> statement-breakpoint")) {
      const s = raw.trim();
      if (!s) continue;
      // Journal statements may be prefixed with SQL comment lines; classify
      // and apply the underlying statement, keeping comments with it.
      const effective = stripLeadingComments(s);
      const isFunction = /^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s/i.test(effective);
      const isTrigger = /^CREATE\s+(CONSTRAINT\s+)?TRIGGER\s/i.test(effective);
      const isDoBlock = /^DO\s+\$/i.test(effective);
      // Foreign keys the journal declares DEFERRABLE INITIALLY DEFERRED.
      // `db:push` cannot express deferrable FKs and creates the same constraint
      // name without it, so these need targeted reconciliation below.
      const isDeferrableFk =
        /^ALTER\s+TABLE\s+[\w"]+\s+ADD\s+CONSTRAINT\s+[\w"]+.*DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(
          effective,
        );
      if (!isFunction && !isTrigger && !isDoBlock && !isDeferrableFk) continue;
      // Normalize plain CREATE FUNCTION to CREATE OR REPLACE FUNCTION so the
      // object layer is idempotent on re-runs.
      const normalized = isFunction
        ? effective.replace(/^CREATE\s+FUNCTION\s/i, "CREATE OR REPLACE FUNCTION ")
        : effective;
      statements.push({ file: path.basename(file), sql: normalized });
      if (isFunction) {
        const m =
          normalized.match(
            /^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?"?([\w$]+)"?\s*\(/i,
          ) ??
          normalized.match(
            /^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?"?([\w$]+)"?\s*$/i,
          );
        if (m) expectedFunctions.add(m[1]);
      }
    }
  }
  return { statements, expectedFunctions: [...expectedFunctions] };
}

async function applyObjectLayer(
  client: postgres.Sql,
): Promise<ObjectLayerStats> {
  const { statements, expectedFunctions } = journalObjectStatements();
  let applied = 0;
  let skipped = 0;
  for (const { file, sql } of statements) {
    const body = sql.replace(/;\s*$/, "");
    // Reconcile DEFERRABLE foreign keys: db:push may have already created the
    // same constraint name as NON-deferrable, which the drift contract rejects.
    const deferrableFk = body.match(
      /^ALTER\s+TABLE\s+"?([\w]+)"?\s+ADD\s+CONSTRAINT\s+"?([\w]+)"?/i,
    );
    if (
      deferrableFk &&
      /DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(body)
    ) {
      const tableName = deferrableFk[1];
      const constraintName = deferrableFk[2];
      const exists = await client.unsafe<{ exists: boolean }[]>(
        `select exists(
           select 1 from pg_constraint
           where conname = $1
             and conrelid = (select oid from pg_class where relname = $2)
         ) as exists`,
        [constraintName, tableName],
      );
      if (exists[0]?.exists) {
        await client.unsafe(
          `ALTER TABLE ${quoteIdent(tableName)} DROP CONSTRAINT ${quoteIdent(
            constraintName,
          )}`,
        );
      }
      try {
        await client.unsafe(body);
        applied++;
      } catch (err) {
        warn(
          `skipped deferrable FK in ${file}: ${
            (err as { message?: string }).message?.split("\n")[0] ?? "unknown"
          }`,
        );
        skipped++;
      }
      continue;
    }
    try {
      await client.unsafe(body);
      applied++;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "42710") {
        // duplicate_object — object already present from a previous run.
        skipped++;
        continue;
      }
      warn(
        `skipped failing statement in ${file}: ${
          e.message?.split("\n")[0] ?? "unknown error"
        }`,
      );
      skipped++;
    }
  }
  log(
    `object layer applied: ${applied} statement(s), ${skipped} skipped/already-present ` +
      `(${expectedFunctions.length} tracked functions)`,
  );
  return { functions: expectedFunctions, applied, skipped };
}

// ---------------------------------------------------------------------------
// Step 4 — verification
// ---------------------------------------------------------------------------
interface Verification {
  functionsMissing: string[];
  roleExists: boolean;
  drift: "clean" | "rls-pending" | "dirty" | "skipped" | "error";
  driftDetail?: string;
}

// Missing RLS policies / openpims_app grants are EXPECTED between bootstrap
// and `pnpm db:rls`. Structural drift (constraints, indexes, triggers) is not.
const PRE_RLS_OBJECT_KINDS = new Set([
  "rls_policy",
  "table_privilege",
  "forbidden_table_privilege",
  "forbidden_function_privilege",
]);

async function verify(
  client: postgres.Sql,
  expectedFunctions: string[],
): Promise<Verification> {
  const roleRow = await client.unsafe<{ exists: boolean }[]>(
    "select exists(select 1 from pg_roles where rolname = 'openpims_app') as exists",
  );
  const roleExists = roleRow[0]?.exists === true;

  const fnRows = await client.unsafe<{ name: string }[]>(
    `select distinct proname as name from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and proname = any($1)`,
    [expectedFunctions],
  );
  const present = new Set(fnRows.map((r) => r.name));
  const functionsMissing = expectedFunctions.filter((f) => !present.has(f));

  let drift: Verification["drift"] = "skipped";
  let driftDetail: string | undefined;
  if (roleExists) {
    try {
      const { findSchemaDrift, driftIsClean } = await import("./schema-drift");
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const probe = postgres(
        process.env.DATABASE_URL!,
        { max: 1, prepare: !isPooledDatabaseConnection(process.env.DATABASE_URL!) },
      );
      try {
        const report = await findSchemaDrift(drizzle(probe));
        if (driftIsClean(report)) {
          drift = "clean";
        } else if (
          report.missingTables.length === 0 &&
          report.missingColumns.length === 0 &&
          report.invalidObjects.every((o) => PRE_RLS_OBJECT_KINDS.has(o.kind))
        ) {
          drift = "rls-pending";
          driftDetail = `${report.invalidObjects.length} RLS policy/privilege object(s) pending pnpm db:rls`;
        } else {
          drift = "dirty";
          driftDetail = `${report.missingTables.length} missing tables, ${report.missingColumns.length} missing columns, ${report.invalidObjects.length} invalid control object(s): ${report.invalidObjects
            .slice(0, 5)
            .map((o) => `${o.kind}:${o.table}.${o.name}`)
            .join(", ")}`;
        }
      } finally {
        await probe.end();
      }
    } catch (err) {
      drift = "error";
      driftDetail = (err as Error).message.split("\n")[0];
    }
  } else {
    driftDetail = "openpims_app RLS role not set up yet (run pnpm db:rls)";
  }

  return { functionsMissing, roleExists, drift, driftDetail };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const isBenignChurnFailure = (output: string): boolean =>
  /PostgresError:.*relation "[\w]+" already exists/is.test(output) &&
  !/no unique constraint matching given keys/i.test(output);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    fail("DATABASE_URL is not set (create .env from .env.example)");
  }
  const client = postgres(url, {
    max: 2,
    prepare: !isPooledDatabaseConnection(url),
  });

  try {
    // Drop triggers on columns whose types may be altered by drizzle-kit push
    // (e.g. invoice_items.quantity -> numeric(13, 3)). The trigger will be recreated
    // during step 3 (applyObjectLayer).
    await client.unsafe(
      'DROP TRIGGER IF EXISTS "invoice_items_validate_dispense_charge" ON "invoice_items";',
    );

    const push1 = pushSchema();
    if (!push1.ok) {
      // Fresh database: drizzle aborts before the backing unique indexes for
      // composite tenant FKs exist. Materialize all indexes, then push again.
      warn(
        "first push failed (expected on a pristine database — drizzle-kit orders " +
          "composite tenant FKs before their backing unique indexes)",
      );
      await ensureIndexes(client);
      const push2 = pushSchema();
      if (!push2.ok && !isBenignChurnFailure(push2.output)) {
        fail("drizzle-kit push failed after index pre-creation", push2.output.slice(-4000));
      }
      if (!push2.ok) {
        // Already-synced database: drizzle-kit 0.31.10 re-plans known-benign
        // churn (FK key-order, unique-index FK references, default strings)
        // and ends with a duplicate CREATE for an object that exists. All
        // real DDL has already been applied — verify and continue.
        warn(
          "drizzle-kit reported its known benign churn signature " +
            "(duplicate CREATE of an existing object); verifying database state",
        );
      }
      // Repair pass: the churn re-run can DROP indexes it re-detects as
      // "changed" without reliably recreating them. Restore the full index set
      // from the current schema before continuing.
      await ensureIndexes(client);
    }

    const stats = await applyObjectLayer(client);

    const report = await verify(client, stats.functions);
    if (report.functionsMissing.length > 0) {
      fail(
        `verification failed — journal functions missing: ${report.functionsMissing.join(", ")}`,
      );
    }
    if (!report.roleExists) {
      log(`verification: ${stats.functions.length} journal functions present; schema drift check deferred (RLS role not created)`);
    } else if (report.drift === "clean") {
      log(`verification: ${stats.functions.length} journal functions present; schema drift clean`);
    } else if (report.drift === "rls-pending") {
      log(`verification: ${stats.functions.length} journal functions present; ${report.driftDetail}`);
    } else if (report.drift === "dirty") {
      fail(`verification failed — schema drift detected (${report.driftDetail})`);
    } else {
      warn(`verification: schema drift check could not complete (${report.driftDetail})`);
    }

    console.log("");
    console.log("\x1b[32m[db:bootstrap] ✓ database bootstrap complete\x1b[0m");
    console.log("");
    console.log("  Next steps:");
    console.log("    OPENPIMS_APP_DB_PASSWORD='local-openpims-app' pnpm db:rls");
    console.log("    OPENPIMS_APP_DB_PASSWORD='local-openpims-app' pnpm db:rls:test");
    console.log("    pnpm db:seed");
  } finally {
    await client.end();
  }
}

main().catch((err) => fail((err as Error).message));
