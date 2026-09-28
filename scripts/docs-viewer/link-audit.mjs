/**
 * Link audit for the built docs viewer.
 *
 * Walks the generated pages, collects every link the renderer flagged as broken
 * (`.broken`), resolves each target back to a source document, and reports the
 * unique missing targets grouped by the document that references them.
 *
 * Must run after `pnpm docs:build`.
 *
 * Usage: node scripts/docs-viewer/link-audit.mjs
 * Exit code 0 = no broken links, 1 = at least one.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "artifacts/docs-viewer";
const PAGES = join(OUT, "data/pages");

/** Same hash the builder uses for page filenames. */
function sha(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + "-" + Buffer.from(s).length.toString(36);
}

const docs = JSON.parse(readFileSync(join(OUT, "data/index.json"), "utf8"));

/** id -> source path, recovered from the builder's page filename scheme. */
const byHash = new Map(docs.map((d) => [sha(d.id), d.id]));

/** Every <a> the renderer marked as pointing at a non-existent target. */
const LINK_RE = /<a\b[^>]*\bclass="[^"]*\bbroken\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

const findings = new Map(); // target -> Set(source docs)

for (const file of readdirSync(PAGES)) {
  if (!file.endsWith(".html")) continue;
  const hash = file.replace(/\.html$/, "");
  const source = byHash.get(hash) ?? `<unmapped:${hash}>`;
  const html = readFileSync(join(PAGES, file), "utf8");

  for (const m of html.matchAll(LINK_RE)) {
    const target = m[1].replace(/&amp;/g, "&");
    if (!findings.has(target)) findings.set(target, new Set());
    findings.get(target).add(source);
  }
}

const totalLinks = [...findings.values()].reduce((n, s) => n + s.size, 0);
console.log(`UNIKATNYCH_CIELOV: ${findings.size} | VSETNYCH_ODKAZOV: ${totalLinks}`);

for (const [target, sources] of [...findings].sort()) {
  console.log(`\n### ${target}  (${sources.size})`);
  for (const s of sources) console.log(`     <- ${s}`);
}

process.exit(findings.size === 0 ? 0 : 1);
