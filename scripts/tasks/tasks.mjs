#!/usr/bin/env node
// Task-spec tooling: status, dispatch gate, generated sprint index.
//
//   node scripts/tasks/tasks.mjs status            table of every spec + computed status
//   node scripts/tasks/tasks.mjs check <id>        dispatch gate: premises + contract test (exit 1 = do not start)
//   node scripts/tasks/tasks.mjs next              the highest-priority READY spec
//   node scripts/tasks/tasks.mjs lint              schema errors (exit 1 on error)
//   node scripts/tasks/tasks.mjs index [--check]   regenerate the generated block of tasks/SPRINT-INDEX.md
//
// The spec format and the lifecycle are documented in tasks/WORKFLOW.md.
// Zero dependencies on purpose: runs before `pnpm install`.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "./frontmatter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(process.env.TASKS_ROOT ?? join(HERE, "..", ".."));
const SPEC_DIRS = ["tasks/sprints", "tasks/proposed"];
const INDEX = "tasks/SPRINT-INDEX.md";
const BEGIN = "<!-- BEGIN GENERATED: node scripts/tasks/tasks.mjs index -->";
const END = "<!-- END GENERATED -->";

export const STATES = ["open", "partial", "done", "dropped", "reference"];
export const KINDS = ["sprint", "ticket", "meta"];
const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };

// ---------------------------------------------------------------- loading

export function loadSpecs(root = ROOT) {
  const specs = [];
  for (const dir of SPEC_DIRS) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).sort()) {
      if (!name.endsWith(".md") || name === "README.md") continue;
      const file = join(dir, name);
      const text = readFileSync(join(root, file), "utf8");
      let data = null;
      let error = null;
      try {
        data = splitFrontmatter(text).data;
      } catch (e) {
        error = e.message;
      }
      specs.push({ file, name, data, error });
    }
  }
  return specs;
}

const asList = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);

// ---------------------------------------------------------------- premises

/**
 * Premises are declarative facts the spec was written against. Grammar:
 *   "exists: <path>"            file or directory exists
 *   "missing: <path>"           does not exist
 *   "contains: <path> | <text>" file contains the literal text
 *   "lacks: <path> | <text>"    file does not contain the literal text
 *   "lines: <path> | <min>..<max>"  line count in range (either bound optional)
 * No shell execution by design: premises must be safe to evaluate anywhere.
 */
export function evalPremise(premise, root = ROOT) {
  const m = /^(exists|missing|contains|lacks|lines):\s*(.+)$/.exec(String(premise).trim());
  if (!m) return { ok: false, premise, detail: "unparseable premise" };
  const [, op, rest] = m;
  const [pathPart, arg] = rest.split(/\s+\|\s+/, 2);
  const p = join(root, pathPart.trim());
  const present = existsSync(p);
  const read = () => readFileSync(p, "utf8");
  switch (op) {
    case "exists":
      return { ok: present, premise, detail: present ? "present" : "not found" };
    case "missing":
      return { ok: !present, premise, detail: present ? "now exists" : "absent" };
    case "contains":
    case "lacks": {
      if (!present) return { ok: false, premise, detail: "file not found" };
      const has = read().includes(arg ?? "");
      const ok = op === "contains" ? has : !has;
      return { ok, premise, detail: has ? "text present" : "text absent" };
    }
    case "lines": {
      if (!present) return { ok: false, premise, detail: "file not found" };
      const n = read().split("\n").length - (read().endsWith("\n") ? 1 : 0);
      const [lo, hi] = (arg ?? "..").split("..").map((x) => (x.trim() === "" ? null : Number(x)));
      const ok = (lo === null || n >= lo) && (hi === null || n <= hi);
      return { ok, premise, detail: `${n} lines` };
    }
  }
  return { ok: false, premise, detail: "unknown op" };
}

// ---------------------------------------------------------------- git helpers

function git(args, root) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function lastCommit(path, root) {
  const out = git(["log", "-1", "--format=%ct %h", "--", path], root);
  if (!out) return null;
  const [t, sha] = out.split(" ");
  return { time: Number(t), sha };
}

// ---------------------------------------------------------------- status

/** Contract test state: none | missing | armed (it.fails present) | live. */
export function contractState(path, root = ROOT) {
  if (!path) return "none";
  const p = join(root, path);
  if (!existsSync(p)) return "missing";
  return /\b(it|test)\.fails\s*\(/.test(readFileSync(p, "utf8")) ? "armed" : "live";
}

export function computeStatus(spec, root = ROOT, { withGit = true, withPremises = true } = {}) {
  const d = spec.data;
  if (!d) return { status: "NO-FRONTMATTER", notes: [spec.error ?? "no frontmatter"], premises: [] };
  const state = d.state;
  const premises = withPremises ? asList(d.premises).map((p) => evalPremise(p, root)) : [];
  const contract = contractState(d.contract_test, root);
  const notes = [];

  if (state === "done") {
    if (contract === "missing") notes.push(`declared contract test ${d.contract_test} is missing`);
    if (contract === "armed") notes.push("contract test still uses .fails: not actually done");
    return { status: contract === "armed" ? "DONE?" : "DONE", notes, premises, contract };
  }
  if (state === "dropped" || state === "reference") {
    return { status: state.toUpperCase(), notes, premises, contract };
  }

  // open / partial
  if (withGit) {
    const specCommit = lastCommit(spec.file, root);
    if (specCommit) {
      for (const t of asList(d.targets)) {
        const tc = lastCommit(t, root);
        if (tc && tc.time > specCommit.time) notes.push(`${t} changed after spec (${tc.sha})`);
      }
    }
  }
  const failed = premises.filter((p) => !p.ok);
  if (failed.length) {
    return {
      status: "STALE",
      notes: [...failed.map((p) => `premise failed: ${p.premise} (${p.detail})`), ...notes],
      premises,
      contract,
    };
  }
  if (contract === "live") {
    return { status: "LIKELY-DONE", notes: ["contract test is live: flip state to done", ...notes], premises, contract };
  }
  if (contract === "armed") return { status: "READY", notes, premises, contract };
  if (d.kind === "ticket") {
    return { status: "BACKLOG", notes: ["promote to a numbered sprint spec before dispatch", ...notes], premises, contract };
  }
  return {
    status: "NEEDS-CONTRACT",
    notes: [contract === "missing" ? `contract test ${d.contract_test} not written yet` : "no contract_test declared", ...notes],
    premises,
    contract,
  };
}

// ---------------------------------------------------------------- lint

export function lintSpecs(specs, root = ROOT) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  for (const s of specs) {
    const where = s.file;
    if (!s.data) {
      errors.push(`${where}: ${s.error ?? "missing frontmatter"}`);
      continue;
    }
    const d = s.data;
    for (const k of ["id", "kind", "title", "state"]) if (d[k] === undefined || d[k] === null) errors.push(`${where}: missing "${k}"`);
    if (d.kind && !KINDS.includes(d.kind)) errors.push(`${where}: kind must be one of ${KINDS.join("|")}`);
    if (d.state && !STATES.includes(d.state)) errors.push(`${where}: state must be one of ${STATES.join("|")}`);
    if (d.priority && !(d.priority in PRIORITY_RANK)) errors.push(`${where}: priority must be P0..P3`);
    const key = String(d.id);
    if (seen.has(key)) errors.push(`${where}: duplicate id ${key} (also ${seen.get(key)})`);
    seen.set(key, where);
    if (d.kind === "sprint") {
      if (typeof d.id !== "number") errors.push(`${where}: sprint id must be a number`);
      const m = /^arena-sprint-(\d+)-/.exec(s.name);
      if (!m || Number(m[1]) !== d.id) errors.push(`${where}: file name must be arena-sprint-${d.id}-<slug>.md`);
    }
    // Tickets are backlog (problem statements). Only sprints are dispatchable,
    // so only sprints must pin targets, premises and a contract test.
    if (d.kind === "sprint" && (d.state === "open" || d.state === "partial")) {
      const targets = asList(d.targets);
      if (!targets.length) errors.push(`${where}: open specs need targets`);
      const creates = new Set(asList(d.creates));
      for (const t of targets) if (!creates.has(t) && !existsSync(join(root, t))) errors.push(`${where}: target ${t} does not exist (list it under creates: if new)`);
      if (!d.contract_test) warnings.push(`${where}: open spec without contract_test`);
      for (const p of asList(d.premises)) {
        if (!/^(exists|missing|contains|lacks|lines):\s*\S/.test(String(p))) errors.push(`${where}: bad premise "${p}"`);
      }
    }
    if (d.state === "done" && d.kind !== "meta" && !asList(d.prs).length && !d.delivered_by) {
      warnings.push(`${where}: done without prs or delivered_by`);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------- index

function prList(d) {
  const prs = asList(d.prs).map((n) => `#${n}`);
  if (d.delivered_by) prs.push(String(d.delivered_by));
  return prs.join(", ");
}

function cell(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderIndex(specs, root = ROOT) {
  const withData = specs.filter((s) => s.data);
  const rowStatus = (s) => {
    const d = s.data;
    // No git and no premises here: the committed index must not flip just
    // because an unrelated PR touched a target file. `check` is the gate.
    const c = computeStatus(s, root, { withGit: false, withPremises: false });
    const prs = prList(d);
    const base =
      d.state === "done" ? `merged (${prs || "?"})` :
      d.state === "partial" ? `PARTIAL${prs ? ` (${prs})` : ""}` :
      d.state === "open" ? `OPEN · ${c.status}` :
      d.state.toUpperCase();
    return d.note ? `${base} — ${d.note}` : base;
  };
  const sprints = withData.filter((s) => s.data.kind === "sprint").sort((a, b) => a.data.id - b.data.id);
  const tickets = withData.filter((s) => s.data.kind === "ticket").sort((a, b) => String(a.data.id).localeCompare(String(b.data.id)));
  const meta = withData.filter((s) => s.data.kind === "meta");
  const lines = [];
  lines.push(BEGIN);
  lines.push("");
  lines.push("| # | Sprint file | Title / target | Status |");
  lines.push("|---|-------------|----------------|--------|");
  for (const s of sprints) lines.push(`| ${s.data.id} | ${s.name} | ${cell(s.data.title)} | ${cell(rowStatus(s))} |`);
  const max = sprints.reduce((m, s) => Math.max(m, s.data.id), 0);
  const reserved = [31];
  let next = max + 1;
  while (reserved.includes(next)) next++;
  lines.push("");
  lines.push(`**Next free sprint number: ${next}.** (31 is reserved: commit \`fcfc18e\` used it informally, no spec.)`);
  lines.push("");
  lines.push("### Tickets (`tasks/proposed/`)");
  lines.push("");
  lines.push("| Id | File | Priority | Title | Status |");
  lines.push("|----|------|----------|-------|--------|");
  for (const s of tickets) lines.push(`| ${s.data.id} | ${s.name} | ${s.data.priority ?? ""} | ${cell(s.data.title)} | ${cell(rowStatus(s))} |`);
  if (meta.length) {
    lines.push("");
    lines.push("### Meta specs (tooling, not product sprints)");
    lines.push("");
    lines.push("| Id | File | Status |");
    lines.push("|----|------|--------|");
    for (const s of meta) lines.push(`| ${s.data.id} | ${s.name} | ${cell(rowStatus(s))} |`);
  }
  lines.push("");
  lines.push(END);
  return lines.join("\n");
}

export function spliceIndex(current, generated) {
  const b = current.indexOf(BEGIN);
  const e = current.indexOf(END);
  if (b === -1 || e === -1) throw new Error(`${INDEX}: generated markers not found`);
  return current.slice(0, b) + generated + current.slice(e + END.length);
}

// ---------------------------------------------------------------- CLI

function findSpec(specs, id) {
  const want = String(id).toLowerCase();
  return specs.find((s) => s.data && String(s.data.id).toLowerCase() === want);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

export function main(argv = process.argv.slice(2), root = ROOT, log = console.log) {
  const [cmd = "status", ...rest] = argv;
  const specs = loadSpecs(root);

  if (cmd === "lint") {
    const { errors, warnings } = lintSpecs(specs, root);
    warnings.forEach((w) => log(`warn  ${w}`));
    errors.forEach((e) => log(`error ${e}`));
    log(`${specs.length} specs · ${errors.length} errors · ${warnings.length} warnings`);
    return errors.length ? 1 : 0;
  }

  if (cmd === "status") {
    const showAll = rest.includes("--all");
    for (const s of specs) {
      const c = computeStatus(s, root);
      if (!showAll && ["DONE", "DROPPED", "REFERENCE"].includes(c.status)) continue;
      const id = s.data ? s.data.id : "?";
      log(`${pad(id, 8)} ${pad(c.status, 15)} ${pad(s.data?.priority ?? "", 3)} ${s.data?.title ?? s.file}`);
      for (const n of c.notes) log(`${" ".repeat(28)}- ${n}`);
    }
    return 0;
  }

  if (cmd === "check") {
    const s = findSpec(specs, rest[0]);
    if (!s) {
      log(`no spec with id ${rest[0]}`);
      return 2;
    }
    const c = computeStatus(s, root);
    log(`${s.data.id} · ${s.file}`);
    log(`status: ${c.status} · contract: ${c.contract ?? "none"}`);
    for (const p of c.premises) log(`  ${p.ok ? "ok  " : "FAIL"} ${p.premise} (${p.detail})`);
    for (const n of c.notes) log(`  - ${n}`);
    return c.status === "READY" ? 0 : 1;
  }

  if (cmd === "next") {
    const ready = specs
      .map((s) => ({ s, c: computeStatus(s, root) }))
      .filter(({ c }) => c.status === "READY")
      .sort((a, b) => (PRIORITY_RANK[a.s.data.priority] ?? 9) - (PRIORITY_RANK[b.s.data.priority] ?? 9) || String(a.s.data.id).localeCompare(String(b.s.data.id), undefined, { numeric: true }));
    if (!ready.length) {
      log("nothing READY (write a contract test for an open spec first)");
      return 1;
    }
    const { s } = ready[0];
    log(`${s.data.id} ${s.data.priority ?? ""} ${s.data.title} · ${s.file}`);
    return 0;
  }

  if (cmd === "index") {
    const path = join(root, INDEX);
    const current = readFileSync(path, "utf8");
    const updated = spliceIndex(current, renderIndex(specs, root));
    if (rest.includes("--check")) {
      if (updated !== current) {
        log(`${INDEX} is out of date: run node scripts/tasks/tasks.mjs index`);
        return 1;
      }
      log(`${INDEX} is up to date`);
      return 0;
    }
    if (updated !== current) writeFileSync(path, updated);
    log(`${relative(root, path)} ${updated !== current ? "updated" : "unchanged"}`);
    return 0;
  }

  log("usage: tasks.mjs status [--all] | check <id> | next | lint | index [--check]");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
