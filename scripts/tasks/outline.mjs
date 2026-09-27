#!/usr/bin/env node
// Outline bridge for the task workflow. Outline is the *front door* and the
// *read-only dashboard*; the repo (tasks/*.md frontmatter) stays the source of truth.
//
//   node scripts/tasks/outline.mjs tracker [--out <file>]       render the "Stav úloh" page (markdown)
//   node scripts/tasks/outline.mjs import <file.md> [--dry-run]  Outline ticket (template docs/wiki/templates/tiket.md) → tasks/proposed/gt-NNN-*.md
//   node scripts/tasks/outline.mjs import --doc <id> [--dry-run] same, fetched via the API
//   node scripts/tasks/outline.mjs publish-tracker [--dry-run]   overwrite the tracker page in Outline
//   node scripts/tasks/outline.mjs create-template [--dry-run]   create the ticket template in Outline
//
// Network commands read OUTLINE_URL (default https://outline.dev.significa.sk),
// OUTLINE_API_KEY, OUTLINE_TRACKER_DOC_ID, OUTLINE_COLLECTION_ID from the environment.
// Never commit a key. See tasks/WORKFLOW.md § Outline.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringifyFrontmatter } from "./frontmatter.mjs";
import { ROOT, computeStatus, loadSpecs } from "./tasks.mjs";

const REPO_URL = "https://github.com/badmarsh/openvpm-ai/blob/main";
const TEMPLATE = "docs/wiki/templates/tiket.md";
const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
const byPriority = (a, b) =>
  (PRIORITY_RANK[a.data.priority] ?? 9) - (PRIORITY_RANK[b.data.priority] ?? 9) ||
  String(a.data.id).localeCompare(String(b.data.id), undefined, { numeric: true });

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const link = (s) => `[${s.name}](${REPO_URL}/${s.file.split("/").map(encodeURIComponent).join("/")})`;

// ---------------------------------------------------------------- tracker

export function renderTracker(specs, { root = ROOT, now = new Date() } = {}) {
  const rows = specs
    .filter((s) => s.data)
    .map((s) => ({ ...s, c: computeStatus(s, root, { withGit: false, specs }) }));
  const sprints = rows.filter((s) => s.data.kind === "sprint");
  const tickets = rows.filter((s) => s.data.kind === "ticket");
  const ready = sprints.filter((s) => s.c.status === "READY").sort(byPriority);
  const blocked = sprints
    .filter((s) => ["STALE", "NEEDS-CONTRACT", "LIKELY-DONE", "BLOCKED"].includes(s.c.status))
    .sort(byPriority);
  const backlog = tickets.filter((s) => ["BACKLOG", "PROMOTED"].includes(s.c.status) || s.data.state === "partial").sort(byPriority);
  const done = sprints.filter((s) => s.data.state === "done").sort((a, b) => b.data.id - a.data.id);
  const why = {
    STALE: "kód sa zmenil, zadanie treba prepísať",
    "NEEDS-CONTRACT": "chýba kontraktový test",
    "LIKELY-DONE": "test prechádza, overiť a uzavrieť",
  };
  const reason = (s) => (s.c.status === "BLOCKED" ? `čaká na sprint ${[].concat(s.data.depends_on).join(", ")}` : why[s.c.status]);

  const out = [];
  out.push("> ⚠️ **Generovaná stránka. Needitovať.** Zdroj pravdy je repozitár (`tasks/`). Stránku prepisuje `node scripts/tasks/outline.mjs publish-tracker`. Nový problém nahlás cez šablónu **Tiket**.");
  out.push("");
  out.push(`Aktualizované: **${now.toISOString().slice(0, 16).replace("T", " ")} UTC** · pripravené: **${ready.length}** · blokované: **${blocked.length}** · backlog: **${backlog.length}** · dokončené sprinty: **${done.length}**`);
  out.push("");
  out.push("## Pripravené na implementáciu");
  out.push("");
  if (ready.length) {
    out.push("| Sprint | Priorita | Názov | Zdroj | Zadanie |");
    out.push("|---|---|---|---|---|");
    for (const s of ready) out.push(`| ${s.data.id} | ${s.data.priority ?? ""} | ${cell(s.data.title)} | ${cell(s.data.source ?? "")} | ${link(s)} |`);
  } else out.push("_Nič. Najbližší krok je dopísať kontraktový test k niektorému otvorenému sprintu._");
  out.push("");
  out.push("## Otvorené, ale blokované");
  out.push("");
  if (blocked.length) {
    out.push("| Sprint | Priorita | Názov | Prečo čaká | Zadanie |");
    out.push("|---|---|---|---|---|");
    for (const s of blocked) out.push(`| ${s.data.id} | ${s.data.priority ?? ""} | ${cell(s.data.title)} | ${reason(s)} | ${link(s)} |`);
  } else out.push("_Nič._");
  out.push("");
  out.push("## Backlog (tikety)");
  out.push("");
  if (backlog.length) {
    out.push("| Tiket | Priorita | Názov | Stav | Súbor |");
    out.push("|---|---|---|---|---|");
    for (const s of backlog) {
      const st = s.c.status === "PROMOTED" ? `rieši sa v sprinte ${s.data.promoted_to}` : s.data.state === "partial" ? "čiastočne hotové" : "čaká na naplánovanie";
      out.push(`| ${s.data.id} | ${s.data.priority ?? ""} | ${cell(s.data.title)} | ${st} | ${link(s)} |`);
    }
  } else out.push("_Prázdny._");
  out.push("");
  out.push("## Naposledy dokončené");
  out.push("");
  out.push("| Sprint | Názov | PR |");
  out.push("|---|---|---|");
  for (const s of done.slice(0, 10)) {
    const prs = (Array.isArray(s.data.prs) ? s.data.prs : []).map((n) => `[#${n}](https://github.com/badmarsh/openvpm-ai/pull/${n})`).join(", ");
    out.push(`| ${s.data.id} | ${cell(s.data.title)} | ${prs || cell(s.data.delivered_by ?? "")} |`);
  }
  out.push("");
  out.push(`Úplný zoznam: [tasks/SPRINT-INDEX.md](${REPO_URL}/tasks/SPRINT-INDEX.md) · postup: [tasks/WORKFLOW.md](${REPO_URL}/tasks/WORKFLOW.md)`);
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------- import

const FIELD_KEYS = {
  priorita: "priority",
  typ: "type",
  "obrazovka / modul": "area",
  nahlásil: "reporter",
  dátum: "date",
  stav: "status",
  gt: "gt",
};

const cleanValue = (v) =>
  v
    .replace(/\\$/, "") // Outline hard break
    .replace(/\\([\\`*_{}\[\]()#+\-.!/|])/g, "$1") // markdown escapes added on export
    .replace(/^`(.*)`$/, "$1")
    .trim();

/**
 * Field block of a ticket. Current template: a list of `- **Priorita:** P1` lines
 * (Outline may export `**Priorita**: P1` or drop the bullet). Tickets filled from
 * the first template version use a `| Priorita | P1 |` table; both are accepted.
 * Table rows are read first and the first occurrence of a field wins, so the
 * bold help text in the legend can't override a real value.
 */
function parseFields(block) {
  const fields = {};
  const put = (label, value) => {
    const key = FIELD_KEYS[label.trim().replace(/:$/, "").trim().toLowerCase()];
    if (key && !(key in fields)) fields[key] = cleanValue(value);
  };
  for (const m of block.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|\s*$/gm)) put(m[1], m[2]);
  for (const m of block.matchAll(/^[ \t]*(?:[-*+][ \t]+)?\*\*([^*\n]+?)\*\*[ \t]*:?[ \t]*(.*)$/gm)) put(m[1], m[2]);
  return fields;
}

/** Parse a ticket written from docs/wiki/templates/tiket.md (markdown as exported by Outline). */
export function parseIntake(markdown, { title } = {}) {
  const text = markdown.replace(/\r\n/g, "\n");
  const h1 = /^#\s+(.+)$/m.exec(text);
  let t = (title ?? (h1 ? h1[1] : "")).trim().replace(/^Tiket:\s*/i, "");
  const sections = {};
  const parts = text.split(/^##\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const head = (nl === -1 ? p : p.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : p.slice(nl + 1)).trim();
    sections[head] = body;
  }
  const fields = parseFields(sections["Základné údaje"] ?? text);
  const priority = /^P[0-3]$/.test(fields.priority ?? "") ? fields.priority : null;
  const errors = [];
  if (!t || /<krátky názov/.test(t)) errors.push("missing title (replace '<krátky názov problému>')");
  if (!priority) errors.push(`priority must be P0..P3 (got "${fields.priority ?? ""}")`);
  if (!sections["Problém"] || /^Čo sa deje a čo by sa malo diať/.test(sections["Problém"])) errors.push("section 'Problém' is empty");
  const criteria = (sections["Hotovo, keď"] ?? "").split("\n").filter((l) => /^\s*[-*]\s*\[[ xX]\]/.test(l) && !/Overiteľná podmienka/.test(l));
  if (!criteria.length) errors.push("section 'Hotovo, keď' needs at least one real checkbox");
  return { title: t, fields, sections, priority, criteria, errors };
}

export function nextGtNumber(root = ROOT) {
  let max = 0;
  for (const dir of ["tasks/proposed", "tasks/archive"]) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const m = /(?:^|-)gt-(\d{3})-/.exec(f);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return max + 1;
}

export function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
}

export function intakeToTicket(intake, { number, outlineUrl = null, today = new Date() }) {
  const id = `GT-${String(number).padStart(3, "0")}`;
  const file = `tasks/proposed/gt-${String(number).padStart(3, "0")}-${slugify(intake.title)}.md`;
  const fm = stringifyFrontmatter(
    {
      id,
      kind: "ticket",
      title: intake.title,
      state: "open",
      priority: intake.priority,
      area: intake.fields.area || undefined,
      reporter: intake.fields.reporter || undefined,
      outline: outlineUrl || undefined,
    },
    ["id", "kind", "title", "state", "priority"],
  );
  const s = intake.sections;
  const body = [
    `# TASK: ${intake.title}`,
    `**[STATUS: PROPOSED]** · Priorita **${intake.priority}** · Typ ${intake.fields.type || "?"} · Nahlásené ${intake.fields.date || today.toISOString().slice(0, 10)} cez Outline`,
    "",
    "## 1. Problém",
    s["Problém"] || "",
    "",
    "## 2. Ako to zopakovať",
    s["Ako to zopakovať"] || "_neuvedené_",
    "",
    "## 3. Dopad",
    s["Dopad"] || "_neuvedené_",
    "",
    "## 4. Hotovo, keď (akceptačné kritériá)",
    intake.criteria.join("\n"),
    "",
    "## 5. Dôkazy",
    s["Dôkazy"] || "_žiadne_",
    "",
    "## 6. Poznámky",
    s["Poznámky"] || "_žiadne_",
    "",
    "> Triáž (agent): pred implementáciou povýšiť na sprint podľa `tasks/WORKFLOW.md` (premisy + `it.fails` kontrakt).",
    "",
  ].join("\n");
  return { id, file, content: fm + "\n" + body };
}

// ---------------------------------------------------------------- Outline API

function env(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && !v) throw new Error(`${name} is not set`);
  return v;
}

async function outline(method, body) {
  const base = (process.env.OUTLINE_URL || "https://outline.dev.significa.sk").replace(/\/$/, "");
  const res = await fetch(`${base}/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OUTLINE_API_KEY")}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(`Outline ${method} failed: ${res.status} ${json.error ?? json.message ?? ""}`.trim());
    err.status = res.status;
    throw err;
  }
  return json.data;
}

// ---------------------------------------------------------------- CLI

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

export async function main(argv = process.argv.slice(2), root = ROOT, log = console.log) {
  const [cmd, ...rest] = argv;
  const dry = rest.includes("--dry-run");

  if (cmd === "tracker") {
    const md = renderTracker(loadSpecs(root), { root });
    const out = arg(rest, "--out");
    if (out) writeFileSync(resolve(out), md);
    else log(md);
    return 0;
  }

  if (cmd === "import") {
    let markdown;
    let title;
    let url = null;
    const docId = arg(rest, "--doc");
    if (docId) {
      const doc = await outline("documents.info", { id: docId });
      markdown = doc.text;
      title = doc.title;
      url = doc.url ? `${(process.env.OUTLINE_URL || "https://outline.dev.significa.sk").replace(/\/$/, "")}${doc.url}` : null;
    } else {
      const file = rest.find((a) => !a.startsWith("--"));
      if (!file) {
        log("usage: outline.mjs import <file.md> | --doc <id> [--dry-run]");
        return 2;
      }
      markdown = readFileSync(resolve(file), "utf8");
    }
    const intake = parseIntake(markdown, { title });
    if (intake.errors.length) {
      intake.errors.forEach((e) => log(`error ${e}`));
      return 1;
    }
    const ticket = intakeToTicket(intake, { number: nextGtNumber(root), outlineUrl: url });
    if (dry) {
      log(`would write ${ticket.file}\n`);
      log(ticket.content);
      return 0;
    }
    writeFileSync(join(root, ticket.file), ticket.content);
    log(`${ticket.id} → ${ticket.file}`);
    log("next: node scripts/tasks/tasks.mjs index, then set 'GT' and 'Stav: Prevzaté' in the Outline page");
    return 0;
  }

  if (cmd === "publish-tracker") {
    const text = renderTracker(loadSpecs(root), { root });
    if (dry) {
      log(text);
      return 0;
    }
    const id = env("OUTLINE_TRACKER_DOC_ID");
    await outline("documents.update", { id, title: "Stav úloh", text, publish: true });
    log(`published tracker to Outline document ${id}`);
    return 0;
  }

  if (cmd === "create-template") {
    const text = readFileSync(join(root, TEMPLATE), "utf8");
    const title = "Tiket";
    const body = text.replace(/^#\s+.+\n+/, ""); // Outline keeps the title separately
    const collectionId = env("OUTLINE_COLLECTION_ID", { required: false });
    if (dry) {
      log(`would create template "${title}"${collectionId ? ` in collection ${collectionId}` : " (workspace-wide)"}\n`);
      log(body);
      return 0;
    }
    // Markdown goes through documents.create, which Outline parses server-side
    // (tables, notices, checklists). templates.create only takes ProseMirror JSON
    // and would drop a `text` field silently.
    const draft = await outline("documents.create", { title, text: body, ...(collectionId ? { collectionId } : {}), publish: false });
    try {
      const t = await outline("documents.templatize", { id: draft.id, collectionId: collectionId ?? null, publish: true });
      log(`template created: ${t.id}${collectionId ? ` (collection ${collectionId})` : " (workspace-wide)"}`);
    } catch (e) {
      if (e.status !== 404 && e.status !== 400) throw e;
      // Very old Outline without documents.templatize: templates are documents with template: true.
      if (!collectionId) throw new Error("this Outline version needs OUTLINE_COLLECTION_ID to create a template");
      const d = await outline("documents.create", { title, text: body, collectionId, template: true, publish: true });
      log(`template created (legacy documents API): ${d.id}`);
    } finally {
      await outline("documents.delete", { id: draft.id }).catch(() => {});
    }
    return 0;
  }

  log("usage: outline.mjs tracker [--out f] | import <file.md>|--doc <id> [--dry-run] | publish-tracker [--dry-run] | create-template [--dry-run]");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => (process.exitCode = code),
    (e) => {
      console.error(e.message);
      process.exitCode = 1;
    },
  );
}
