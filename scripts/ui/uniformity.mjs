#!/usr/bin/env node
/**
 * UI uniformity check — the mechanical contract for visual sweeps.
 *
 * `tasks/RULES.md` §3.1 allows one PR to touch many files when it is the same
 * mechanical edit, on the condition that a mechanical contract ships with it.
 * For a "raw palette utility → shared token file" sweep this is that contract:
 * it fails when a palette utility or a hardcoded hex colour appears under a
 * boundary, so the sweep is verifiable instead of eyeballed.
 *
 *   node scripts/ui/uniformity.mjs                                  # report only
 *   node scripts/ui/uniformity.mjs --boundary apps/web/app/portal   # exit 1 on any hit
 *   node scripts/ui/uniformity.mjs --boundary a --boundary b --max 3
 *
 * Rule sets (`--rules`):
 *   palette    (default) every palette utility + hardcoded hex — the dashboard rule
 *   saturated  only the saturated hues (red/amber/green/blue/violet/…) + hex.
 *              Used for the client portal, which deliberately keeps its own
 *              light-only neutral scale (text-gray-900, border-gray-200); what it
 *              must not do is invent its own status colours page by page.
 *
 * Boundaries are path prefixes relative to the repo root. `--max N` sets how
 * many hits the boundary tolerates (default 0).
 *
 * Deliberate exceptions live in ALLOWLIST below, one line each with a reason:
 * a sweep must be able to name its own definition point, not silence the check.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Files where palette colours are the point, not a violation. Keep it to a minimum. */
const ALLOWLIST = [
  // The single definition point for the portal's status colours (portal sweep).
  "apps/web/components/portal/portal-ui.tsx",
  // UIKIT prescribes these colours for diagnostic modality badges.
  "apps/web/components/imaging/modality-badge.tsx",
];

const VARIANTS =
  "(?:(?:hover|focus|focus-visible|active|disabled|group-hover|group-focus|dark|sm|md|lg|xl|2xl|motion-safe|motion-reduce|first|last|odd|even|print):)*";
const UTILITY_PREFIX = "(?:bg|text|border|ring|divide|from|to|fill|stroke|decoration|outline|shadow)";
const NEUTRAL = "gray|slate|zinc|neutral|stone";
const SATURATED = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const SHADE = "-[0-9]{2,3}(?:\/[0-9]{1,3})?";
const PALETTE = new RegExp(`\\b${VARIANTS}(${UTILITY_PREFIX}-(?:${NEUTRAL}|${SATURATED})${SHADE})`, "g");
const SATURATED_ONLY = new RegExp(`\\b${VARIANTS}(${UTILITY_PREFIX}-(?:${SATURATED})${SHADE})`, "g");
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1,5})?\b/g;

const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist", "build", "coverage"]);
const SCAN_EXT = /\.(?:tsx?|jsx?)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (SCAN_EXT.test(entry.name) && statSync(path).isFile()) out.push(path);
  }
  return out;
}

const allow = new Set(ALLOWLIST.map((p) => join(ROOT, p)));

/** @returns {Array<{file: string, hits: Array<{line: number, token: string, text: string}>}>} */
export function scanUniformity(dir, { rules = "palette" } = {}) {
  const pattern = rules === "saturated" ? SATURATED_ONLY : PALETTE;
  const results = [];
  for (const file of walk(dir)) {
    if (allow.has(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    const hits = [];
    lines.forEach((text, index) => {
      for (const match of text.matchAll(pattern)) hits.push({ line: index + 1, token: match[1], text: text.trim().slice(0, 110) });
      for (const match of text.matchAll(HEX)) hits.push({ line: index + 1, token: match[0], text: text.trim().slice(0, 110) });
    });
    if (hits.length) results.push({ file: relative(ROOT, file), hits });
  }
  return results.sort((a, b) => b.hits.length - a.hits.length);
}

function main(argv) {
  const boundaries = [];
  let max = 0;
  let rules = "palette";
  let dir = join(ROOT, "apps/web");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--boundary") boundaries.push(argv[++i]);
    else if (argv[i] === "--max") max = Number(argv[++i]);
    else if (argv[i] === "--rules") rules = argv[++i];
    else if (argv[i] === "--dir") dir = join(ROOT, argv[++i]);
  }
  if (!["palette", "saturated"].includes(rules)) {
    console.error(`unknown --rules ${rules} (palette | saturated)`);
    return 2;
  }

  if (!boundaries.length) {
    const results = scanUniformity(dir, { rules });
    const total = results.reduce((n, r) => n + r.hits.length, 0);
    console.log(`uniformity report (${relative(ROOT, dir)}) — ${total} hits in ${results.length} files`);
    for (const r of results.slice(0, 25)) console.log(`${String(r.hits.length).padStart(4)}  ${r.file}`);
    if (results.length > 25) console.log(`  … and ${results.length - 25} more files`);
    console.log("\nreport only — pass --boundary <path> to make it fail on hits");
    return 0;
  }

  let failed = false;
  for (const boundary of boundaries) {
    const results = scanUniformity(join(ROOT, boundary), { rules });
    const hits = results.reduce((n, r) => n + r.hits.length, 0);
    const ok = hits <= max;
    console.log(`${ok ? "OK  " : "FAIL"} ${boundary} — ${hits} hit(s), ${results.length} file(s), rules=${rules}${max ? `, allowed ${max}` : ""}`);
    for (const r of results) {
      for (const h of r.hits.slice(0, 8)) console.log(`       ${r.file}:${h.line}  ${h.token}`);
      if (r.hits.length > 8) console.log(`       ${r.file} … +${r.hits.length - 8} more`);
    }
    if (!ok) failed = true;
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exit(main(process.argv.slice(2)));
