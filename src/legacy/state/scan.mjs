/**
 * Sprint 26 — Legacy state binding scanner.
 *
 * Walks the monorepo source surface and applies the rules in `rules.mjs`.
 * Zero runtime dependencies: Node 18+ built-ins only, so it runs in CI without
 * an install step and cannot drift from the app's dependency graph.
 *
 * Usage:
 *   node src/legacy/state/scan.mjs                  # human-readable report
 *   node src/legacy/state/scan.mjs --json           # machine-readable findings
 *   node src/legacy/state/scan.mjs --by-rule        # counts grouped by rule
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { matchFile, matchLine, RULES, ruleById } from "./rules.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const REPO_ROOT = resolve(HERE, "../../..");

/** Directories never scanned. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  ".venv",
  "__pycache__",
]);

/** Extensions treated as source. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/** Never treat a test fixture as a production binding. */
const IGNORED_FILE_PARTS = ["__tests__", ".test.", ".spec.", "__mocks__"];

/**
 * Repo-relative prefixes the scanner must not scan. The audit tool ships the
 * detection patterns as regex literals; scanning itself would report its own
 * rule definitions as findings, which is noise, not signal.
 */
const IGNORED_REL_PREFIXES = ["src/legacy/state/"];

/**
 * @param {string} abs absolute path
 * @returns {string[]} absolute source file paths
 */
export function collectSourceFiles(abs) {
  const out = [];
  const rel = relative(REPO_ROOT, abs).split(sep).join("/");
  if (rel && IGNORED_REL_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) {
    return out;
  }
  const entries = readdirSync(abs, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = join(abs, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const rel = toRepoRelative(full);
    // Match on the whole path, not just the filename: fixture and helper
    // modules live *inside* __tests__/ directories and are never production
    // bindings, but their filenames look ordinary.
    if (IGNORED_FILE_PARTS.some((part) => rel.includes(part))) continue;
    out.push(full);
  }
  return out;
}

/**
 * @param {string} abs absolute file path
 * @returns {string} repo-relative posix path
 */
export function toRepoRelative(abs) {
  return relative(REPO_ROOT, abs).split(sep).join("/");
}

/**
 * @typedef {object} Finding
 * @property {string} ruleId
 * @property {string} file     repo-relative posix path
 * @property {number} line     1-based
 * @property {string} matched  the substring that triggered the rule
 * @property {string} snippet  trimmed source line
 */

/**
 * Scan one file's contents. Exported for tests (no fs access).
 *
 * @param {string} relPath repo-relative posix path
 * @param {string} source  file contents
 * @returns {Finding[]}
 */
export function scanSource(relPath, source) {
  const findings = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    for (const { ruleId, matched } of matchLine(raw, { relPath })) {
      findings.push({
        ruleId,
        file: relPath,
        line: i + 1,
        matched,
        snippet: raw.trim().slice(0, 160),
      });
    }
  }
  for (const { ruleId, matched, line } of matchFile(relPath, source)) {
    findings.push({
      ruleId,
      file: relPath,
      line,
      matched: matched.replace(/\s+/g, " ").trim().slice(0, 80),
      snippet: (lines[line - 1] ?? "").trim().slice(0, 160),
    });
  }
  return findings;
}

/**
 * Scan the whole repo.
 * @param {string} [root] defaults to the repository root
 * @returns {Finding[]}
 */
export function scanRepo(root = REPO_ROOT) {
  const files = collectSourceFiles(root);
  const findings = [];
  for (const abs of files) {
    findings.push(...scanSource(toRepoRelative(abs), readFileSync(abs, "utf8")));
  }
  findings.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)
  );
  return findings;
}

/**
 * @param {Finding[]} findings
 * @returns {Array<{ruleId: string, count: number, title: string, severity: string}>}
 */
export function groupByRule(findings) {
  const counts = new Map();
  for (const f of findings) {
    counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([ruleId, count]) => {
      const rule = ruleById(ruleId);
      return {
        ruleId,
        count,
        title: rule?.title ?? "(unknown rule)",
        severity: rule?.severity ?? "low",
      };
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function renderReport(findings) {
  const out = [];
  out.push("# Legacy state binding scan");
  out.push("");
  out.push(`Repository root: ${REPO_ROOT}`);
  out.push(`Findings: ${findings.length}`);
  out.push(`Rules loaded: ${RULES.length}`);
  out.push("");
  out.push("## By rule");
  out.push("");
  out.push("| Rule | Severity | Count | Title |");
  out.push("| --- | --- | --- | --- |");
  for (const g of groupByRule(findings)) {
    out.push(`| ${g.ruleId} | ${g.severity} | ${g.count} | ${g.title} |`);
  }
  out.push("");
  out.push("## Findings");
  out.push("");
  let currentFile = null;
  for (const f of findings) {
    if (f.file !== currentFile) {
      out.push("");
      out.push(`### ${f.file}`);
      currentFile = f.file;
    }
    out.push(`- L${f.line} [${f.ruleId}] \`${f.matched}\` — ${f.snippet}`);
  }
  return out.join("\n");
}

const args = process.argv.slice(2);

// Only run the CLI when executed directly, so tests can import the functions.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const findings = scanRepo();
  if (args.includes("--json")) {
    process.stdout.write(JSON.stringify(findings, null, 2) + "\n");
  } else if (args.includes("--by-rule")) {
    for (const g of groupByRule(findings)) {
      process.stdout.write(`${g.ruleId}\t${g.severity}\t${g.count}\t${g.title}\n`);
    }
    process.stdout.write(`TOTAL\t-\t${findings.length}\t-\n`);
  } else {
    process.stdout.write(renderReport(findings) + "\n");
  }
}
