#!/usr/bin/env node
/**
 * Technical documentation viewer.
 *
 * Pre-renders every technical markdown in the repo into a static, self-contained
 * browser: sidebar tree, full-text search, per-page table of contents, and a
 * dark mode that reuses the app's own design tokens from
 * `apps/web/styles/globals.css` (so it reads as part of the product rather than
 * a foreign tool).
 *
 *   node scripts/docs-viewer.mjs            # build only
 *   node scripts/docs-viewer.mjs --serve    # build, then serve on :4173
 *   node scripts/docs-viewer.mjs --port 5000
 *
 * The shell and its assets live in scripts/docs-viewer/ as real files, not as
 * template literals: a backslash inside a template literal is an escape, and
 * `\s` quietly became `s` at one point, breaking search at runtime.
 *
 * Output goes to artifacts/docs-viewer/ and is a build product, not source.
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "artifacts", "docs-viewer");
const require = createRequire(import.meta.url);

// marked ships as a transitive dependency. Try the normal resolution first,
// then fall back to whatever version the pnpm store currently holds, so a
// dependency bump does not silently break the docs build.
function loadMarked() {
  const candidates = ["marked"];
  try {
    return require(candidates[0]);
  } catch { /* fall through */ }
  const store = join(ROOT, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const entry of readdirSync(store)) {
      if (entry.startsWith("marked@")) candidates.push(join(ROOT, "node_modules", ".pnpm", entry, "node_modules", "marked"));
    }
  }
  for (const c of candidates) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error(
    "Could not resolve `marked`. Run `pnpm install` (it is a transitive dependency of the workspace).",
  );
}

const { Marked } = loadMarked();

/* ------------------------------------------------------------------ *
 * Source selection
 * ------------------------------------------------------------------ */

/** Reference docs live in docs/. Root + tasks/ carry the process docs. */
const ROOT_DOCS = [
  "README.md",
  "ROADMAP.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
  "CLOUDFLARE_TUNNEL.md",
  "DESIGN-SYSTEM-MIGRATION.md",
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && extname(entry.name) === ".md") out.push(full);
  }
  return out;
}

function collect() {
  const files = [];
  for (const rel of ROOT_DOCS) {
    if (existsSync(join(ROOT, rel))) files.push(join(ROOT, rel));
  }
  files.push(...walk(join(ROOT, "docs")));
  // tasks/ holds the process specs (RULES, WORKFLOW, templates, the backport plan).
  try {
    files.push(...readdirSync(join(ROOT, "tasks")).map((f) => join(ROOT, "tasks", f))
      .filter((f) => f.endsWith(".md")));
  } catch { /* tasks/ optional */ }

  const seen = new Set();
  const docs = [];
  for (const file of files) {
    const id = relative(ROOT, file).split(sep).join("/");
    if (seen.has(id)) continue;
    seen.add(id);
    docs.push({ id, file });
  }
  return docs.sort((a, b) => a.id.localeCompare(b.id, "sk"));
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "section";
}

/** Strip the things marked will not sanitise on its own. */
function harden(html) {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

function firstTitle(markdown) {
  const m = /^#\s+(.+)$/m.exec(markdown);
  return m ? m[1].trim() : null;
}

/** Frontmatter title beats the first H1 when present. */
function frontmatterTitle(markdown) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!m) return null;
  const t = /^title:\s*(.+)$/m.exec(m[1]);
  return t ? t[1].trim().replace(/^["']|["']$/g, "") : null;
}

function buildRenderer(byId, currentId, assets) {
  const md = new Marked({ gfm: true, breaks: false, pedantic: false });
  const used = new Map();

  md.use({
    renderer: {
      heading(token) {
        const text = this.parser.parseInline(token.tokens);
        const plain = token.text.replace(/[`*_]/g, "").trim();
        let id = slugify(plain);
        // Two sections can slug to the same id (e.g. "Setup" twice).
        const n = (used.get(id) ?? 0) + 1;
        used.set(id, n);
        if (n > 1) id = `${id}-${n}`;
        return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
      },
      link(token) {
        const href = token.href ?? "";
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : "";
        const text = this.parser.parseInline(token.tokens);

        if (/^(https?:|mailto:)/i.test(href)) {
          return `<a href="${escapeAttr(href)}"${title} target="_blank" rel="noopener noreferrer" class="ext">${text}</a>`;
        }
        if (href.startsWith("#")) return `<a href="${escapeAttr(href)}"${title}>${text}</a>`;

        // Repo-relative link: rewrite to the viewer when it is another doc,
        // and flag it when the target does not exist so stale docs are visible.
        // hrefs are URL-encoded (spaces, diacritics) and HTML-escaped (&amp;),
        // so decode both before touching the filesystem — otherwise every
        // percent-encoded wiki link reads as broken.
        const cleaned = unescapeHref(href.split("#")[0]);
        if (!cleaned) return `<a href="${escapeAttr(href)}"${title}>${text}</a>`;

        const resolved = resolve(dirname(join(ROOT, currentId)), cleaned);
        const rel = relative(ROOT, resolved).split(sep).join("/");

        if (extname(cleaned) === ".md") {
          // Three outcomes, and conflating them is how a docs audit goes wrong:
          // indexed in the viewer, present on disk but not indexed, or missing.
          if (byId.has(rel)) return `<a href="#/${rel}"${title} class="doc">${text}</a>`;
          if (existsSync(resolved)) {
            return `<span class="codelink" title="On disk, not indexed by the viewer: ${escapeAttr(rel)}">${text}</span>`;
          }
          return `<a href="${escapeAttr(href)}"${title} class="broken" title="Target not found: ${escapeAttr(rel)}">${text}</a>`;
        }
        if (existsSync(resolved)) {
          return `<span class="codelink" title="${escapeAttr(rel)}">${text}</span>`;
        }
        return `<a href="${escapeAttr(href)}"${title} class="broken" title="Target not found: ${escapeAttr(rel)}">${text}</a>`;
      },
      image(token) {
        const src = unescapeHref(token.href ?? "");
        const alt = escapeAttr(token.text ?? "");
        if (/^(https?:|data:)/i.test(src)) {
          return `<img src="${escapeAttr(src)}" alt="${alt}" loading="lazy">`;
        }
        const resolved = resolve(dirname(join(ROOT, currentId)), src);
        if (!existsSync(resolved)) return `<span class="broken">[missing image: ${escapeAttr(src)}]</span>`;
        // Flat, collision-free name, extension kept so the server sends the
        // right MIME type. Mirroring the tree would let a doc's `../../`
        // reference escape the output directory.
        const name = sha(relative(ROOT, resolved).split(sep).join("/")) + extname(resolved).toLowerCase();
        assets.set(name, resolved);
        return `<img src="./files/${name}" alt="${alt}" loading="lazy">`;
      },
      // marked renders inline code as `codespan` and fenced blocks as `code`.
      // Overriding `code` hijacks fenced blocks and destroys the <pre> wrapper,
      // so only touch the inline variant here.
      codespan(token) {
        return `<code class="inline-code">${escapeHtml(token.text)}</code>`;
      },
    },
  });

  return md;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;

/**
 * Turn a markdown href into a real filesystem path: reverse the HTML entity
 * escape, then percent-decoding. A malformed escape sequence is left as-is
 * rather than throwing mid-build.
 */
function unescapeHref(href) {
  const unescaped = href.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  try {
    return decodeURIComponent(unescaped);
  } catch {
    return unescaped;
  }
}

function headingsOf(html) {
  const out = [];
  const re = /<h([1-4])\s+id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ depth: Number(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, "") });
  }
  return out;
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*|=\s]+/gm, " ")
    .replace(/[|*_~#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupOf(id) {
  if (id.startsWith("docs/")) {
    const rest = id.slice("docs/".length);
    const slash = rest.indexOf("/");
    return slash === -1 ? "docs (root)" : `docs/${rest.slice(0, slash)}`;
  }
  if (id.startsWith("tasks/")) return "tasks (process)";
  return "root";
}

/** Natural sort so "10. Foo" lands after "9. Foo". */
const collator = new Intl.Collator("sk", { numeric: true, sensitivity: "base" });

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

function build() {
  const sources = collect();
  const byId = new Map(sources.map((d) => [d.id, d]));

  const pages = [];
  const assets = new Map();
  for (const { id, file } of sources) {
    const raw = readFileSync(file, "utf8");
    const md = buildRenderer(byId, id, assets);
    let html = harden(md.parse(raw));
    const headings = headingsOf(html);
    const title = frontmatterTitle(raw) ?? firstTitle(raw) ?? id.split("/").pop().replace(/\.md$/, "");
    const words = plainText(raw).split(/\s+/).filter(Boolean).length;

    pages.push({
      id,
      group: groupOf(id),
      title,
      headings,
      words,
      minutes: Math.max(1, Math.round(words / 220)),
      html,
      text: plainText(raw).slice(0, 20000),
    });
  }

  pages.sort((a, b) => collator.compare(a.group, b.group) || collator.compare(a.id, b.id));

  const index = pages.map(({ id, group, title, headings, words, minutes }) => ({
    id, group, title, words, minutes,
    headings: headings.map((h) => ({ depth: h.depth, id: h.id, text: h.text })),
  }));
  const search = pages.map(({ id, title, group, text, headings }) => ({
    id, title, group, text,
    h: headings.map((h) => h.text).join(" "),
  }));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "data"), { recursive: true });
  mkdirSync(join(OUT, "data", "pages"), { recursive: true });
  mkdirSync(join(OUT, "assets"), { recursive: true });

  writeFileSync(join(OUT, "data", "index.json"), JSON.stringify(index));
  writeFileSync(join(OUT, "data", "search.json"), JSON.stringify(search));
  for (const p of pages) {
    writeFileSync(join(OUT, "data", "pages", `${sha(p.id)}.html`), p.html);
  }

  // Copy referenced images under flat, hashed names.
  mkdirSync(join(OUT, "files"), { recursive: true });
  for (const [name, src] of assets) {
    writeFileSync(join(OUT, "files", name), readFileSync(src));
  }

  // Assets live as real files next to this script. Embedding them in template
  // literals silently ate backslashes (\s -> s), which broke regexes at runtime.
  const assetDir = join(ROOT, "scripts", "docs-viewer");
  writeFileSync(join(OUT, "index.html"), readFileSync(join(assetDir, "index.html"), "utf8"));
  writeFileSync(join(OUT, "assets", "styles.css"), readFileSync(join(assetDir, "styles.css"), "utf8"));
  writeFileSync(join(OUT, "assets", "app.js"), readFileSync(join(assetDir, "app.js"), "utf8"));

  return { count: pages.length, groups: new Set(pages.map((p) => p.group)).size, copied: assets.size };
}

function sha(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + "-" + Buffer.from(s).length.toString(36);
}

/* ------------------------------------------------------------------ *
 * Serve
 * ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svgz": "image/svg+xml",
};

function serve(port) {
  createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || p === "") p = "/index.html";
    const file = join(OUT, p);
    if (!file.startsWith(OUT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(readFileSync(file));
  }).listen(port, "0.0.0.0", () => {
    console.log(`\n  Docs viewer  ->  http://localhost:${port}\n`);
  });
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */



const argv = process.argv.slice(2);
const wantServe = argv.includes("--serve");
const portIdx = argv.indexOf("--port");
const port = portIdx !== -1 ? Number(argv[portIdx + 1]) : 4173;

const t0 = Date.now();
const { count, groups, copied } = build();
console.log(`  ${count} dokumentov · ${groups} skupín · ${copied} obrázkov · ${Date.now() - t0} ms`);
console.log(`  → ${relative(ROOT, OUT)}`);
if (wantServe) serve(port);
