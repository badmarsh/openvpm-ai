#!/usr/bin/env node
/**
 * Upstream backport audit — measurement helper for `tasks/upstream-backport-plan.md`.
 *
 * Our history and `evangauer/openvpm`'s history are unrelated (no merge base),
 * so every backport decision has to be made on measured diffs, not on "the plan
 * says phase N is missing". This tool produces those measurements.
 *
 * It needs the upstream remote, which is deliberately not configured in the repo:
 *
 *   git remote add upstream https://github.com/evangauer/openvpm.git
 *   git fetch --no-tags upstream main
 *
 * Commands:
 *   classify <sha...>      files touched by those commits, compared blob-for-blob
 *                          against the upstream tip: identical / differs / missing
 *   candidates <sha...>    lines those commits ADDED that upstream still carries
 *                          but our tree lacks — the only true backport candidates
 *   journal                first migration-journal index where the two repos diverge
 *
 * `pnpm-lock.yaml` is excluded everywhere: it is never taken from upstream
 * (see the plan's rule 8), and it would drown every other number.
 *
 * Optional: UPSTREAM_REF (default `upstream/main`), `--list` to print the lines.
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = process.env.UPSTREAM_REF ?? "upstream/main";
const EXCLUDE = new Set(["pnpm-lock.yaml"]);

const gitRaw = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
/** Same as gitRaw, but for commands whose output is a single token (rev-parse). */
const git = (...args) => gitRaw(...args).trim();
const gitOrNull = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};
/**
 * File contents, so the exact list of lines matters — do not trim the payload.
 * A path that is absent in the given revision is an expected answer here, not an
 * error, so git's "fatal: path ... does not exist" is suppressed.
 */
const contentsOrNull = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
};
const normalise = (s) => s.replace(/\s+/g, " ").trim();

/** Files touched by the given commits (union, unique, lockfile excluded). */
function touchedFiles(shas) {
  const files = new Set();
  for (const sha of shas) {
    for (const line of git("show", "--pretty=format:", "--name-only", sha).split("\n")) {
      const file = line.trim();
      if (file && !EXCLUDE.has(file)) files.add(file);
    }
  }
  return [...files].sort();
}

function classify(shas, { list }) {
  const rows = [];
  for (const file of touchedFiles(shas)) {
    const upstreamBlob = gitOrNull("rev-parse", `${UPSTREAM}:${file}`);
    const oursBlob = gitOrNull("rev-parse", `HEAD:${file}`);
    const kind = !oursBlob
      ? "missing"
      : !upstreamBlob
        ? "upstream-deleted"
        : oursBlob === upstreamBlob
          ? "identical"
          : "differs";
    rows.push({
      file,
      kind,
      oursBytes: oursBlob ? Number(git("cat-file", "-s", oursBlob)) : 0,
      upstreamBytes: upstreamBlob ? Number(git("cat-file", "-s", upstreamBlob)) : 0,
    });
  }
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
  console.log(
    `${rows.length} files (pnpm-lock.yaml excluded) — ` +
      Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "),
  );
  if (list) {
    for (const r of rows.filter((x) => x.kind !== "identical")) {
      console.log(
        `${r.kind.padEnd(16)} ours=${String(r.oursBytes).padStart(7)}  up=${String(r.upstreamBytes).padStart(7)}  ${r.file}`,
      );
    }
  }
  return rows;
}

function candidates(shas, { list }) {
  const added = new Map();
  for (const sha of shas) {
    const diff = git("show", "--pretty=format:", "-U0", "--no-color", sha);
    let file = null;
    for (const raw of diff.split("\n")) {
      if (raw.startsWith("+++ b/")) {
        file = raw.slice(6);
        continue;
      }
      if (raw.startsWith("--- ") || !raw.startsWith("+")) continue;
      if (!file || EXCLUDE.has(file)) continue;
      const line = raw.slice(1).trim();
      if (!line) continue;
      if (!added.has(file)) added.set(file, new Set());
      added.get(file).add(line);
    }
  }

  // A line is a candidate when (a) our file does not carry it (allowing for
  // re-indentation and for the string being wrapped in t("key", "…"), which is
  // how this repo keeps UI text — see RULES §1.3), and (b) upstream's tip still
  // carries it. Lines upstream itself has since replaced cannot be backported.
  const covered = (text, line) => {
    const flat = normalise(text);
    const n = normalise(line);
    if (flat.includes(n)) return true;
    const core = n.replace(/^["'`]|["'`,;)}\]]+$/g, "");
    return core.length > 3 && flat.includes(core);
  };

  let addedTotal = 0;
  let superseded = 0;
  const rows = [];
  for (const [file, lines] of [...added].sort()) {
    addedTotal += lines.size;
    const ours = contentsOrNull("show", `HEAD:${file}`);
    const upstream = contentsOrNull("show", `${UPSTREAM}:${file}`);
    if (ours === null) {
      rows.push({ file, absent: [...lines], superseded: 0, weLackFile: true });
      continue;
    }
    const absentFromOurs = [...lines].filter((line) => !covered(ours, line));
    const stillUpstream = upstream === null
      ? []
      : absentFromOurs.filter((line) => covered(upstream, line));
    superseded += absentFromOurs.length - stillUpstream.length;
    rows.push({ file, absent: stillUpstream, superseded, weLackFile: false });
  }

  const total = rows.reduce((n, r) => n + r.absent.length, 0);
  const missingFiles = rows.filter((r) => r.weLackFile).length;
  console.log(`${added.size} files, ${addedTotal} lines added by these commits`);
  console.log(`candidates: ${total} lines${missingFiles ? ` (${missingFiles} file(s) we lack entirely)` : ""}`);
  console.log(`dropped: ${superseded} lines the phase added but upstream no longer carries`);
  for (const r of rows) {
    if (!r.absent.length) continue;
    console.log(
      `\n${r.weLackFile ? "MISSING FILE " : ""}${r.file} — ${r.absent.length} candidate line(s)` +
        (r.superseded ? ` (+${r.superseded} superseded upstream)` : ""),
    );
    if (list) for (const line of r.absent) console.log(`    - ${line.slice(0, 165)}`);
  }
}

function journal() {
  const read = (ref) =>
    JSON.parse(git("show", `${ref}:packages/db/drizzle/meta/_journal.json`)).entries;
  const ours = read("HEAD");
  const upstream = read(UPSTREAM);
  const diffs = [];
  for (let i = 0; i < Math.min(ours.length, upstream.length); i++) {
    if (ours[i].tag !== upstream[i].tag || ours[i].when !== upstream[i].when) {
      diffs.push({ i, ours: `${ours[i].tag} @${ours[i].when}`, upstream: `${upstream[i].tag} @${upstream[i].when}` });
    }
  }
  console.log(`ours ${ours.length} entries, upstream ${upstream.length} entries`);
  console.log(`first divergence: ${diffs.length ? `idx ${diffs[0].i}` : "none in the common prefix"}`);
  console.log(`mismatching indices in the common prefix: ${diffs.length}`);
  for (const d of diffs) console.log(`  idx ${d.i}: ours=${d.ours} | upstream=${d.upstream}`);
  console.log(`ours tail:      ${ours.slice(-3).map((e) => e.tag).join(", ")}`);
  console.log(`upstream tail:  ${upstream.slice(-3).map((e) => e.tag).join(", ")}`);
}

const [command, ...rest] = process.argv.slice(2);
const list = rest.includes("--list");
const shas = rest.filter((a) => a !== "--list");

if (command === "classify" && shas.length) classify(shas, { list });
else if (command === "candidates" && shas.length) candidates(shas, { list });
else if (command === "journal") journal();
else {
  console.error("usage: upstream-backport-audit.mjs <classify|candidates> <sha...> [--list] | journal");
  process.exit(2);
}
