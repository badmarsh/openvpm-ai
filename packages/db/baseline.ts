/**
 * One-time migration baseline.
 *
 * Environments built with `drizzle-kit push` have no migration ledger, so
 * `drizzle-kit migrate` would try to replay every migration from 0000 against a
 * database that already has the schema. Without a ledger there is also no way
 * to ask a database what it has applied, which is how a deploy shipped ahead of
 * production and stayed broken until a customer noticed.
 *
 * This writes the ledger drizzle-kit expects and marks migrations as already
 * applied, so `pnpm db:migrate` becomes the normal way to move any environment
 * forward from here on.
 *
 * Usage:
 *   pnpm db:baseline --through 0030            # dry run, prints the plan
 *   pnpm db:baseline --through 0030 --apply    # write the ledger
 *
 * Pick --through by checking what the database actually has first:
 *   pnpm db:drift
 *
 * Anything after --through is left for `pnpm db:migrate` to apply normally.
 */
import { config } from "dotenv";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import postgres, { type Sql } from "postgres";
import { isPooledDatabaseConnection } from "./connection-policy";
import { describeDrift, driftIsClean, type SchemaDrift } from "./schema-drift";

export type JournalEntry = { idx: number; tag: string; when: number };
type SnapshotTable = {
  name: string;
  schema: string;
  columns: Record<string, { name: string }>;
};
type MigrationSnapshot = { tables: Record<string, SnapshotTable> };

const here = dirname(fileURLToPath(import.meta.url));
const journalPath = join(here, "drizzle", "meta", "_journal.json");

/**
 * Drizzle snapshots describe schema state, so a deliberately data-only SQL
 * migration does not need to generate one. Keep every such exception explicit:
 * an unrecognized gap is an integrity error, not a file-system accident.
 */
export const snapshotlessMigrationReasons: Readonly<Record<string, string>> = {
  "0052_booking_page_request_types":
    "intentional data-only migration; it changes rows without changing schema",
};

export type SnapshotlessMigrationPostcondition = {
  /** Held until commit so the verified rows cannot change before ledger writes. */
  lockSql: string;
  /** Must return exactly one row with a non-negative integer `violations`. */
  violationCountSql: string;
  violationLabel: string;
};

/**
 * A schema snapshot cannot prove a data-only migration ran. Each approved
 * snapshotless migration therefore needs a live, PHI-free postcondition and a
 * table lock that makes the apply-time proof atomic with the ledger write.
 */
export const snapshotlessMigrationPostconditions: Readonly<
  Record<string, SnapshotlessMigrationPostcondition>
> = {
  "0052_booking_page_request_types": {
    lockSql: "lock table booking_pages, appointment_types in share mode",
    violationCountSql: `
      select count(*)::int as violations
      from booking_pages bp
      where bp.deleted_at is null
        and (
          jsonb_typeof(bp.config -> 'bookableTypeIds') is distinct from 'array'
          or exists (
            select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(bp.config -> 'bookableTypeIds') = 'array'
                  then bp.config -> 'bookableTypeIds'
                else '[]'::jsonb
              end
            ) selected(value)
            where jsonb_typeof(selected.value) is distinct from 'string'
              or (selected.value #>> '{}') !~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          )
          or (
            bp.published
            and not exists (
              select 1
              from jsonb_array_elements(
                case
                  when jsonb_typeof(bp.config -> 'bookableTypeIds') = 'array'
                    then bp.config -> 'bookableTypeIds'
                  else '[]'::jsonb
                end
              ) selected(value)
              join appointment_types at
                on at.id::text = selected.value #>> '{}'
                and at.practice_id = bp.practice_id
                and at.deleted_at is null
            )
          )
        )
    `,
    violationLabel:
      "active booking page rows with an invalid requestable-type list or a published list that has no active same-practice appointment type",
  },
};

type SnapshotlessPostconditionReader = (
  entry: JournalEntry,
  contract: SnapshotlessMigrationPostcondition,
) => Promise<number>;

/** Verify every data-only migration at or before the selected cutoff. */
export async function assertSnapshotlessMigrationPostconditions(
  entries: readonly JournalEntry[],
  cutoff: number,
  readViolations: SnapshotlessPostconditionReader,
): Promise<void> {
  const target = entries[cutoff];
  if (!target) throw new Error(`Invalid migration journal cutoff ${cutoff}.`);

  for (const entry of entries.slice(0, cutoff + 1)) {
    if (!snapshotlessMigrationReasons[entry.tag]) continue;

    const contract = snapshotlessMigrationPostconditions[entry.tag];
    if (!contract) {
      throw new Error(
        `Cannot baseline through ${target.tag}: approved snapshotless migration ${entry.tag} has no live data postcondition.`,
      );
    }

    const violations = await readViolations(entry, contract);
    if (!Number.isSafeInteger(violations) || violations < 0) {
      throw new Error(
        `Cannot baseline through ${target.tag}: data postcondition for ${entry.tag} returned invalid violation count ${String(violations)}.`,
      );
    }
    if (violations > 0) {
      throw new Error(
        `Cannot baseline through ${target.tag}: data-only migration ${entry.tag} has ${violations} ${contract.violationLabel}. Apply or verify that migration's data repair before writing a baseline ledger.`,
      );
    }
  }
}

export type BaselineSnapshotSelection = {
  target: JournalEntry;
  snapshot: JournalEntry;
  explanation?: string;
};

export function selectBaselineSnapshot(
  entries: readonly JournalEntry[],
  cutoff: number,
  hasSnapshot: (entry: JournalEntry) => boolean,
): BaselineSnapshotSelection {
  const target = entries[cutoff];
  if (!target) throw new Error(`Invalid migration journal cutoff ${cutoff}.`);

  const skipped: Array<{ entry: JournalEntry; reason: string }> = [];
  for (let index = cutoff; index >= 0; index--) {
    const candidate = entries[index]!;
    if (hasSnapshot(candidate)) {
      return {
        target,
        snapshot: candidate,
        explanation:
          skipped.length === 0
            ? undefined
            : `Migration ${target.tag} has no snapshot because it is an ${skipped[0]!.reason}; validating schema against preceding snapshot ${candidate.tag} while marking through ${target.tag}.`,
      };
    }

    const reason = snapshotlessMigrationReasons[candidate.tag];
    if (!reason) {
      const prefix = candidate.tag.split("_", 1)[0];
      throw new Error(
        `Cannot baseline through ${target.tag}: expected snapshot ${prefix}_snapshot.json for ${candidate.tag}, but it is missing and is not an approved snapshotless migration.`,
      );
    }
    skipped.push({ entry: candidate, reason });
  }

  throw new Error(
    `Cannot baseline through ${target.tag}: no schema snapshot exists at or before the selected migration.`,
  );
}

function snapshotPath(entry: JournalEntry): string {
  const prefix = entry.tag.split("_", 1)[0];
  return join(here, "drizzle", "meta", `${prefix}_snapshot.json`);
}

/** Verify the live database contains every table/column at the chosen cutoff. */
type BaselineSql = Pick<Sql, "unsafe">;

async function findBaselineDrift(
  client: BaselineSql,
  entry: JournalEntry,
): Promise<SchemaDrift> {
  const snapshot = JSON.parse(
    readFileSync(snapshotPath(entry), "utf8"),
  ) as MigrationSnapshot;
  const expected = new Map<string, Set<string>>();

  for (const table of Object.values(snapshot.tables)) {
    if (table.schema && table.schema !== "public") continue;
    expected.set(
      table.name,
      new Set(Object.values(table.columns).map((column) => column.name)),
    );
  }

  const rows = await client.unsafe<
    { table_name: string; column_name: string }[]
  >(`select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'`);
  const live = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = live.get(row.table_name);
    if (columns) columns.add(row.column_name);
    else live.set(row.table_name, new Set([row.column_name]));
  }

  const missingTables: string[] = [];
  const missingColumns: SchemaDrift["missingColumns"] = [];
  for (const [table, columns] of expected) {
    const liveColumns = live.get(table);
    if (!liveColumns) {
      missingTables.push(table);
      continue;
    }
    for (const column of columns) {
      if (!liveColumns.has(column)) missingColumns.push({ table, column });
    }
  }

  missingTables.sort();
  missingColumns.sort((a, b) =>
    a.table === b.table
      ? a.column.localeCompare(b.column)
      : a.table.localeCompare(b.table),
  );
  // Baseline adoption predates application-managed constraints and policies;
  // the full post-migration contract is enforced by `db:drift`.
  return { missingTables, missingColumns, invalidObjects: [] };
}

// drizzle-kit identifies an applied migration by the SHA-256 of the migration
// file's contents, so the ledger has to be written with the same hash it will
// compute on the next `migrate` run.
function migrationHash(tag: string): string {
  const sql = readFileSync(join(here, "drizzle", `${tag}.sql`), "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

function safeTarget(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function assertNoMigrationLedger(client: BaselineSql): Promise<void> {
  const existing = await client.unsafe<{ n: number }[]>(`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
  `);
  if (existing[0]?.n <= 0) return;

  const applied = await client.unsafe<{ n: number }[]>(`
    select count(*)::int as n from drizzle."__drizzle_migrations"
  `);
  throw new Error(
    `A migration ledger already exists with ${applied[0]?.n ?? 0} row(s). Baselining is a one-time operation; use \`pnpm db:migrate\` instead.`,
  );
}

async function assertBaselineState(
  client: BaselineSql,
  entries: readonly JournalEntry[],
  cutoff: number,
  selection: BaselineSnapshotSelection,
  lockPostconditionTables: boolean,
): Promise<void> {
  const drift = await findBaselineDrift(client, selection.snapshot);
  if (!driftIsClean(drift)) {
    throw new Error(
      `Cannot baseline through ${selection.target.tag}: the live database does not match snapshot ${selection.snapshot.tag}.\n${describeDrift(drift)}\nApply the missing schema changes, then run the baseline again.`,
    );
  }

  await assertSnapshotlessMigrationPostconditions(
    entries,
    cutoff,
    async (_entry, contract) => {
      if (lockPostconditionTables) await client.unsafe(contract.lockSql);
      const rows = await client.unsafe<{ violations: number }[]>(
        contract.violationCountSql,
      );
      return Number(rows[0]?.violations);
    },
  );
}

export type BaselineRunOptions = {
  url: string;
  through: string;
  apply: boolean;
  log?: (message: string) => void;
};

/** Run a dry-run or atomic one-time baseline against an explicit database. */
export async function runBaseline({
  url,
  through,
  apply,
  log = console.log,
}: BaselineRunOptions): Promise<void> {
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };
  const cutoff = journal.entries.findIndex((entry) =>
    entry.tag.startsWith(through),
  );
  if (cutoff === -1) {
    throw new Error(
      `No migration in the journal starts with "${through}".\n` +
        `Known tags: ${journal.entries.map((entry) => entry.tag).join(", ")}`,
    );
  }

  const toMark = journal.entries.slice(0, cutoff + 1);
  const remaining = journal.entries.slice(cutoff + 1);
  const selection = selectBaselineSnapshot(journal.entries, cutoff, (entry) =>
    existsSync(snapshotPath(entry)),
  );

  const pooled = isPooledDatabaseConnection(url);
  const client = postgres(url, { max: 1, prepare: !pooled });
  log(`Target: ${safeTarget(url)}`);

  const printPlan = () => {
    if (selection.explanation) log(selection.explanation);
    log(`\nWill mark ${toMark.length} migration(s) as already applied:`);
    for (const entry of toMark) log(`  ✓ ${entry.tag}`);

    if (remaining.length > 0) {
      log(
        `\nWill leave ${remaining.length} migration(s) for \`pnpm db:migrate\`:`,
      );
      for (const entry of remaining) log(`  → ${entry.tag}`);
    } else {
      log("\nNo migrations left over — the selected snapshot is current.");
    }
  };

  try {
    if (!apply) {
      await assertNoMigrationLedger(client);
      await assertBaselineState(
        client,
        journal.entries,
        cutoff,
        selection,
        false,
      );
      printPlan();
      log("\nDry run. Re-run with --apply to write the ledger.");
      return;
    }

    await client.begin(async (tx) => {
      // Serialize baseline operators, then re-check every condition inside the
      // same transaction that writes the ledger. Data-table locks are held
      // through commit so a verified postcondition cannot change underneath us.
      await tx.unsafe(`select pg_advisory_xact_lock(
        hashtext('openpims'), hashtext('db:baseline')
      )`);
      await assertNoMigrationLedger(tx);
      await assertBaselineState(tx, journal.entries, cutoff, selection, true);
      printPlan();

      await tx.unsafe("create schema if not exists drizzle");
      await tx.unsafe(`
        create table if not exists drizzle."__drizzle_migrations" (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
      `);
      for (const entry of toMark) {
        await tx.unsafe(
          `insert into drizzle."__drizzle_migrations" (hash, created_at)
           values ($1, $2)`,
          [migrationHash(entry.tag), entry.when],
        );
      }
    });

    log(`\nBaseline written. ${toMark.length} migration(s) recorded.`);
    log("Run `pnpm db:migrate` to apply anything outstanding.");
  } finally {
    await client.end();
  }
}

async function main() {
  config({ path: "../../.env" });

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const throughArg = args[args.indexOf("--through") + 1];

  if (
    !args.includes("--through") ||
    !throughArg ||
    throughArg.startsWith("--")
  ) {
    console.error(
      "Usage: pnpm db:baseline --through <migration-prefix> [--apply]\n" +
        "Example: pnpm db:baseline --through 0030 --apply",
    );
    return 1;
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL not set");
    return 1;
  }

  try {
    await runBaseline({ url, through: throughArg, apply });
    return 0;
  } catch (err) {
    console.error("Baseline failed:", err instanceof Error ? err.message : err);
    return 1;
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().then((code) => process.exit(code));
}
