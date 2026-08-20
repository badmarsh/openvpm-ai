import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { snapshotlessMigrationReasons } from "../../../../packages/db/baseline";

type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

type Journal = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

type Snapshot = {
  id: string;
  prevId: string;
};

type MigrationFixture = {
  journal: Journal;
  sqlFiles: string[];
  snapshots: Record<string, Snapshot>;
};

const repoRoot = resolve(process.cwd(), "../..");
const migrationDirectory = resolve(repoRoot, "packages/db/drizzle");
const metadataDirectory = resolve(migrationDirectory, "meta");
const journalPath = resolve(metadataDirectory, "_journal.json");
const zeroSnapshotId = "00000000-0000-0000-0000-000000000000";

// There are currently no SQL/journal bijection exceptions. This named,
// reviewed allowlist prevents a future exception from being smuggled in as an
// unexplained filtering rule.
const sqlBijectionExceptions = new Set<string>();

function migrationPrefix(tag: string): string {
  const match = /^(\d{4})_[a-z0-9_]+$/.exec(tag);
  if (!match) throw new Error(`invalid migration tag ${tag}`);
  return match[1]!;
}

function loadFixture(): MigrationFixture {
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const sqlFiles = readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const snapshots = Object.fromEntries(
    readdirSync(metadataDirectory)
      .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
      .sort()
      .map((name) => [
        name,
        JSON.parse(
          readFileSync(resolve(metadataDirectory, name), "utf8"),
        ) as Snapshot,
      ]),
  );
  return { journal, sqlFiles, snapshots };
}

function cloneFixture(fixture: MigrationFixture): MigrationFixture {
  return structuredClone(fixture);
}

function validateJournal(journal: Journal): void {
  if (journal.entries.length === 0) throw new Error("journal is empty");

  const indexes = new Set<number>();
  const tags = new Set<string>();
  for (const [position, entry] of journal.entries.entries()) {
    if (indexes.has(entry.idx)) {
      throw new Error(`duplicate journal index ${entry.idx}`);
    }
    indexes.add(entry.idx);
    if (entry.idx !== position) {
      throw new Error(
        `journal indexes must be contiguous from 0: position ${position} has ${entry.idx}`,
      );
    }

    if (tags.has(entry.tag))
      throw new Error(`duplicate journal tag ${entry.tag}`);
    tags.add(entry.tag);

    const prefix = migrationPrefix(entry.tag);
    if (prefix !== String(entry.idx).padStart(4, "0")) {
      throw new Error(
        `journal tag ${entry.tag} does not match index ${entry.idx}`,
      );
    }

    const previous = journal.entries[position - 1];
    if (previous && entry.when <= previous.when) {
      throw new Error(
        `journal timestamps must strictly increase: ${entry.tag} (${entry.when}) follows ${previous.tag} (${previous.when})`,
      );
    }
  }
}

function validateSqlBijection(fixture: MigrationFixture): void {
  const journalTags = fixture.journal.entries
    .map((entry) => entry.tag)
    .filter((tag) => !sqlBijectionExceptions.has(tag));
  const sqlTags = fixture.sqlFiles
    .map((name) => name.replace(/\.sql$/, ""))
    .filter((tag) => !sqlBijectionExceptions.has(tag));

  for (const tag of journalTags) {
    const matches = sqlTags.filter((candidate) => candidate === tag).length;
    if (matches !== 1) {
      throw new Error(
        `journal migration ${tag} must map to exactly one SQL file; found ${matches}`,
      );
    }
  }

  const journalTagSet = new Set(journalTags);
  for (const tag of sqlTags) {
    if (!journalTagSet.has(tag)) {
      throw new Error(`orphan SQL migration ${tag}.sql is not in the journal`);
    }
  }
}

function validateSnapshotLineage(fixture: MigrationFixture): void {
  const entriesByPrefix = new Map(
    fixture.journal.entries.map((entry) => [migrationPrefix(entry.tag), entry]),
  );
  const expectedSnapshotNames = fixture.journal.entries
    .filter((entry) => snapshotlessMigrationReasons[entry.tag] === undefined)
    .map((entry) => `${migrationPrefix(entry.tag)}_snapshot.json`);
  const actualSnapshotNames = Object.keys(fixture.snapshots).sort();

  for (const entry of fixture.journal.entries) {
    const snapshotName = `${migrationPrefix(entry.tag)}_snapshot.json`;
    const snapshotExists = fixture.snapshots[snapshotName] !== undefined;
    const approvedReason = snapshotlessMigrationReasons[entry.tag];
    if (approvedReason && snapshotExists) {
      throw new Error(
        `approved snapshotless migration ${entry.tag} unexpectedly has ${snapshotName}`,
      );
    }
    if (!approvedReason && !snapshotExists) {
      throw new Error(`missing snapshot ${snapshotName} for ${entry.tag}`);
    }
  }

  for (const snapshotName of actualSnapshotNames) {
    const prefix = snapshotName.slice(0, 4);
    if (!entriesByPrefix.has(prefix)) {
      throw new Error(
        `orphan snapshot ${snapshotName} does not map to a journal prefix`,
      );
    }
  }

  if (actualSnapshotNames.join("\n") !== expectedSnapshotNames.join("\n")) {
    throw new Error(
      "snapshot files do not map to the expected migration prefixes",
    );
  }

  let expectedPrevId = zeroSnapshotId;
  const ids = new Set<string>();
  for (const name of expectedSnapshotNames) {
    const snapshot = fixture.snapshots[name]!;
    if (ids.has(snapshot.id)) {
      throw new Error(`duplicate snapshot id ${snapshot.id} in ${name}`);
    }
    ids.add(snapshot.id);
    if (snapshot.prevId !== expectedPrevId) {
      throw new Error(
        `broken snapshot lineage at ${name}: expected prevId ${expectedPrevId}, received ${snapshot.prevId}`,
      );
    }
    expectedPrevId = snapshot.id;
  }
}

function validateIntegrity(fixture: MigrationFixture): void {
  validateJournal(fixture.journal);
  validateSqlBijection(fixture);
  validateSnapshotLineage(fixture);
}

function stripSqlCommentsAndStrings(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, "$$");
}

function assertDataOnlySql(tag: string, sql: string): void {
  const ddlKeyword = stripSqlCommentsAndStrings(sql).match(
    /\b(?:create|alter|drop|truncate|rename|grant|revoke|comment|reindex|cluster)\b/i,
  );
  if (ddlKeyword) {
    throw new Error(
      `${tag} is allowlisted as data-only but contains DDL keyword ${ddlKeyword[0]}`,
    );
  }
}

type RawJournalSegments = {
  prefix: string;
  entries: string[];
  suffix: string;
};

/** Split journal entries without normalizing a byte of the existing objects. */
function rawJournalSegments(raw: string): RawJournalSegments {
  const entriesKey = raw.indexOf('"entries"');
  const arrayStart = raw.indexOf("[", entriesKey);
  if (entriesKey === -1 || arrayStart === -1) {
    throw new Error("journal does not contain an entries array");
  }

  const entries: string[] = [];
  let arrayDepth = 1;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;
  let segmentStart = arrayStart + 1;
  let arrayEnd = -1;

  for (let index = arrayStart + 1; index < raw.length; index++) {
    const character = raw[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "[") arrayDepth++;
    else if (character === "]") {
      arrayDepth--;
      if (arrayDepth === 0) {
        arrayEnd = index;
        break;
      }
    } else if (character === "{") objectDepth++;
    else if (character === "}") {
      objectDepth--;
      if (objectDepth === 0) {
        entries.push(raw.slice(segmentStart, index + 1));
        segmentStart = index + 1;
      }
    }
  }

  if (arrayEnd === -1) throw new Error("journal entries array is not closed");
  return {
    prefix: raw.slice(0, arrayStart + 1),
    entries,
    suffix: raw.slice(arrayEnd),
  };
}

function gitText(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

type MigrationIntegrityCiContext = {
  eventName?: string;
  pullRequestBaseSha?: string;
  pushBeforeSha?: string;
};

function validCommitSha(value: string | undefined, source: string): string {
  const sha = value?.trim();
  if (!sha) {
    throw new Error(
      `Migration integrity base is missing; expected ${source}. Refusing to compare HEAD to itself.`,
    );
  }
  if (/^0{40}$/.test(sha)) {
    throw new Error(
      `Migration integrity base from ${source} is all zeroes. Refusing to compare HEAD to itself; rerun from an event with a real pre-change commit.`,
    );
  }
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error(
      `Migration integrity base from ${source} is not a full commit SHA: ${sha}.`,
    );
  }
  return sha;
}

function selectCiMigrationBaseRef({
  eventName,
  pullRequestBaseSha,
  pushBeforeSha,
}: MigrationIntegrityCiContext): string {
  if (eventName === "pull_request") {
    return validCommitSha(
      pullRequestBaseSha,
      "github.event.pull_request.base.sha",
    );
  }
  if (eventName === "push") {
    return validCommitSha(pushBeforeSha, "github.event.before");
  }
  throw new Error(
    `Migration integrity does not support GitHub event ${eventName ?? "(missing)"}; expected pull_request or push.`,
  );
}

function configuredMigrationBaseRef(): string | undefined {
  const eventName = process.env.MIGRATION_INTEGRITY_EVENT_NAME?.trim();
  if (eventName) {
    return selectCiMigrationBaseRef({
      eventName,
      pullRequestBaseSha: process.env.MIGRATION_INTEGRITY_PR_BASE_SHA,
      pushBeforeSha: process.env.MIGRATION_INTEGRITY_PUSH_BEFORE_SHA,
    });
  }
  return process.env.MIGRATION_INTEGRITY_BASE_REF?.trim() || undefined;
}

const hasConfiguredMigrationBase = Boolean(
  process.env.MIGRATION_INTEGRITY_EVENT_NAME?.trim() ||
  process.env.MIGRATION_INTEGRITY_BASE_REF?.trim(),
);

describe("Drizzle migration journal integrity", () => {
  it("keeps journal, SQL, and snapshot history deterministic and bijective", () => {
    validateIntegrity(loadFixture());
    expect([...sqlBijectionExceptions]).toEqual([]);
    expect(snapshotlessMigrationReasons).toEqual({
      "0052_booking_page_request_types":
        "intentional data-only migration; it changes rows without changing schema",
    });

    const pullRequestBase = "1".repeat(40);
    const pushBefore = "2".repeat(40);
    expect(
      selectCiMigrationBaseRef({
        eventName: "pull_request",
        pullRequestBaseSha: pullRequestBase,
        pushBeforeSha: pushBefore,
      }),
    ).toBe(pullRequestBase);
    expect(
      selectCiMigrationBaseRef({
        eventName: "push",
        pullRequestBaseSha: pullRequestBase,
        pushBeforeSha: pushBefore,
      }),
    ).toBe(pushBefore);
    expect(() => selectCiMigrationBaseRef({ eventName: "push" })).toThrow(
      "expected github.event.before",
    );
    expect(() =>
      selectCiMigrationBaseRef({
        eventName: "push",
        pushBeforeSha: "0".repeat(40),
      }),
    ).toThrow("github.event.before is all zeroes");
  });

  it("keeps intentional migration 0052 data-only and DDL-free", () => {
    const tag = "0052_booking_page_request_types";
    const sql = readFileSync(resolve(migrationDirectory, `${tag}.sql`), "utf8");
    expect(() => assertDataOnlySql(tag, sql)).not.toThrow();
    expect(sql).toMatch(/\bUPDATE\s+booking_pages\b/i);
  });

  it("rejects a duplicate journal index", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.journal.entries[1]!.idx = fixture.journal.entries[0]!.idx;
    expect(() => validateIntegrity(fixture)).toThrow("duplicate journal index");
  });

  it("rejects a duplicate journal tag", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.journal.entries[1]!.tag = fixture.journal.entries[0]!.tag;
    expect(() => validateIntegrity(fixture)).toThrow("duplicate journal tag");
  });

  it("rejects a journal timestamp regression", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.journal.entries[1]!.when = fixture.journal.entries[0]!.when;
    expect(() => validateIntegrity(fixture)).toThrow(
      "journal timestamps must strictly increase",
    );
  });

  it("rejects a missing SQL migration", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.sqlFiles = fixture.sqlFiles.filter(
      (name) => name !== "0052_booking_page_request_types.sql",
    );
    expect(() => validateIntegrity(fixture)).toThrow(
      "0052_booking_page_request_types must map to exactly one SQL file; found 0",
    );
  });

  it("rejects an orphan SQL migration", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.sqlFiles.push("0091_orphan_fixture.sql");
    expect(() => validateIntegrity(fixture)).toThrow(
      "orphan SQL migration 0091_orphan_fixture.sql",
    );
  });

  it("rejects broken snapshot lineage", () => {
    const fixture = cloneFixture(loadFixture());
    fixture.snapshots["0053_snapshot.json"]!.prevId = zeroSnapshotId;
    expect(() => validateIntegrity(fixture)).toThrow(
      "broken snapshot lineage at 0053_snapshot.json",
    );
  });

  it.skipIf(!hasConfiguredMigrationBase)(
    "preserves merge-base migration artifacts byte-for-byte and adds only at the tail",
    () => {
      const baseRef = configuredMigrationBaseRef()!;
      try {
        gitText("cat-file", "-e", `${baseRef}^{commit}`);
      } catch {
        throw new Error(
          `Migration integrity base ${baseRef} is unavailable in the checkout. Keep actions/checkout fetch-depth at 0 and verify the event SHA exists.`,
        );
      }
      const mergeBase = gitText("merge-base", "HEAD", baseRef);
      const artifactChanges = gitText(
        "diff",
        "--name-status",
        "--no-renames",
        mergeBase,
        "--",
        "packages/db/drizzle",
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [status, path] = line.split("\t");
          return { status: status!, path: path! };
        });
      const changedExistingArtifacts = artifactChanges.filter(
        ({ status, path }) =>
          status !== "A" &&
          (/^packages\/db\/drizzle\/\d{4}_.+\.sql$/.test(path) ||
            /^packages\/db\/drizzle\/meta\/\d{4}_snapshot\.json$/.test(path)),
      );
      expect(
        changedExistingArtifacts,
        "merge-base SQL and snapshots must remain byte-for-byte identical",
      ).toEqual([]);

      const baseJournalRaw = execFileSync(
        "git",
        ["show", `${mergeBase}:packages/db/drizzle/meta/_journal.json`],
        { cwd: repoRoot, encoding: "utf8" },
      );
      const addedArtifacts = artifactChanges.filter(
        ({ status, path }) =>
          status === "A" &&
          (/^packages\/db\/drizzle\/\d{4}_.+\.sql$/.test(path) ||
            /^packages\/db\/drizzle\/meta\/\d{4}_snapshot\.json$/.test(path)),
      );
      for (const { path } of addedArtifacts) {
        expect(readFileSync(resolve(repoRoot, path)).length).toBeGreaterThan(0);
      }

      const currentJournalRaw = readFileSync(journalPath, "utf8");
      const baseSegments = rawJournalSegments(baseJournalRaw);
      const currentSegments = rawJournalSegments(currentJournalRaw);
      const baseJournal = JSON.parse(baseJournalRaw) as Journal;
      const currentJournal = JSON.parse(currentJournalRaw) as Journal;

      expect(currentSegments.prefix).toBe(baseSegments.prefix);
      expect(currentSegments.suffix).toBe(baseSegments.suffix);
      expect(currentSegments.entries.length).toBeGreaterThanOrEqual(
        baseSegments.entries.length,
      );
      expect(
        currentSegments.entries.slice(0, baseSegments.entries.length),
      ).toEqual(baseSegments.entries);
      expect(
        currentJournal.entries.slice(0, baseJournal.entries.length),
      ).toEqual(baseJournal.entries);

      const baseTail = baseJournal.entries.at(-1)!;
      const additions = currentJournal.entries.slice(
        baseJournal.entries.length,
      );
      expect(additions.every((entry) => entry.idx > baseTail.idx)).toBe(true);

      for (const { path } of addedArtifacts) {
        const name = path.split("/").at(-1)!;
        const prefix = Number(name.slice(0, 4));
        expect(
          prefix,
          `${path} was not added after merge-base tail`,
        ).toBeGreaterThan(baseTail.idx);
      }
    },
  );
});
