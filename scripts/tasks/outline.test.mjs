// Run: node --test scripts/tasks/outline.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { intakeToTicket, main, nextGtNumber, parseIntake, renderTracker, slugify } from "./outline.mjs";
import { splitFrontmatter } from "./frontmatter.mjs";
import { lintSpecs, loadSpecs } from "./tasks.mjs";

const TEMPLATE = readFileSync(fileURLToPath(new URL("../../docs/wiki/templates/tiket.md", import.meta.url)), "utf8");

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "outline-"));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), content);
  }
  return root;
}

const filled = TEMPLATE.replace("<krátky názov problému>", "Faktúra sa neuloží pri zľave 100 %")
  .replace("- **Priorita:** P2", "- **Priorita:** P1")
  .replace("Čo sa deje a čo by sa malo diať namiesto toho.", "Pri zľave 100 % tlačidlo Uložiť nič nespraví.")
  .replace("- [ ] Overiteľná podmienka 1\n- [ ] Overiteľná podmienka 2", "- [ ] Faktúra so zľavou 100 % sa uloží s sumou 0,00 €");

test("the unfilled template is rejected with actionable errors", () => {
  const r = parseIntake(TEMPLATE);
  assert.match(r.errors.join("\n"), /missing title/);
  assert.match(r.errors.join("\n"), /'Problém' is empty/);
  assert.match(r.errors.join("\n"), /at least one real checkbox/);
});

test("a filled template parses into fields, sections and criteria", () => {
  const r = parseIntake(filled);
  assert.deepEqual(r.errors, []);
  assert.equal(r.title, "Faktúra sa neuloží pri zľave 100 %");
  assert.equal(r.priority, "P1");
  assert.equal(r.fields.area, "/records/new-soap");
  assert.equal(r.criteria.length, 1);
  assert.match(r.sections["Problém"], /nič nespraví/);
});

test("Outline API text (title separate, no H1) is accepted", () => {
  const body = filled.replace(/^# .+\n+/, "");
  const r = parseIntake(body, { title: "Tiket: Iný názov" });
  assert.equal(r.title, "Iný názov");
  assert.deepEqual(r.errors, []);
});

test("ticket file has valid frontmatter, next GT number and a slug", () => {
  const root = fixture({ "tasks/proposed/gt-016-a.md": "x", "tasks/archive/2026-09-21-gt-017-b.md": "x" });
  assert.equal(nextGtNumber(root), 18);
  const t = intakeToTicket(parseIntake(filled), { number: 18, outlineUrl: "https://outline.example/doc/x" });
  assert.equal(t.id, "GT-018");
  assert.equal(t.file, "tasks/proposed/gt-018-faktura-sa-neulozi-pri-zlave-100.md");
  const { data, body } = splitFrontmatter(t.content);
  assert.equal(data.id, "GT-018");
  assert.equal(data.priority, "P1");
  assert.equal(data.outline, "https://outline.example/doc/x");
  assert.match(body, /## 4\. Hotovo, keď/);
  writeFileSync(join(root, t.file), t.content);
  assert.deepEqual(lintSpecs(loadSpecs(root), root).errors.filter((e) => e.includes("gt-018")), []);
});

test("fields come from the list block, not from the priority legend", () => {
  const r = parseIntake(TEMPLATE.replace("- **Priorita:** P2", "- **Priorita:** P0"));
  assert.equal(r.priority, "P0");
  assert.equal(r.fields.type, "chyba");
  assert.equal(r.fields.status, "Nový");
});

test("Outline export variants of the field list are accepted", () => {
  const exported = filled
    .replace("- **Priorita:** P1", "* **Priorita**: `P1`")
    .replace("- **Obrazovka / modul:** /records/new-soap", "- **Obrazovka / modul:** /records/new\\-soap\\");
  const r = parseIntake(exported);
  assert.deepEqual(r.errors, []);
  assert.equal(r.priority, "P1");
  assert.equal(r.fields.area, "/records/new-soap");
});

test("tickets filled from the old table template still import", () => {
  const legacy = filled.replace(
    /## Základné údaje\n\n[\s\S]*?\n\n(?=:::tip)/,
    "| Pole | Hodnota |\n|---|---|\n| Priorita | P1 |\n| Obrazovka / modul | /billing |\n\n",
  );
  assert.doesNotMatch(legacy, /\*\*Priorita:\*\* P1/);
  const r = parseIntake(legacy);
  assert.equal(r.priority, "P1");
  assert.equal(r.fields.area, "/billing");
});

test("slugify strips Slovak diacritics", () => {
  assert.equal(slugify("Kontrola roly — kniha OPL"), "kontrola-roly-kniha-opl");
});

test("tracker groups READY, blocked, backlog and done", () => {
  const spec = (fm) => `---\n${fm}\n---\nbody\n`;
  const root = fixture({
    "p.tsx": "x\n",
    "c.test.ts": 'it.fails("x", () => {})',
    "tasks/sprints/arena-sprint-30-a.md": spec("id: 30\nkind: sprint\ntitle: Done one\nstate: done\nprs: [64]"),
    "tasks/sprints/arena-sprint-32-b.md": spec("id: 32\nkind: sprint\ntitle: Ready one\nstate: open\npriority: P0\nsource: GT-001\ntargets: [p.tsx]\ncontract_test: c.test.ts"),
    "tasks/sprints/arena-sprint-33-c.md": spec("id: 33\nkind: sprint\ntitle: Needs test\nstate: open\npriority: P2\ntargets: [p.tsx]\ncontract_test: nope.test.ts"),
    "tasks/proposed/gt-001-x.md": spec("id: GT-001\nkind: ticket\ntitle: Promoted\nstate: open\npriority: P0\npromoted_to: 32"),
    "tasks/proposed/gt-007-y.md": spec("id: GT-007\nkind: ticket\ntitle: Waiting\nstate: open\npriority: P1"),
  });
  const md = renderTracker(loadSpecs(root), { root, now: new Date("2026-09-27T10:00:00Z") });
  assert.match(md, /Generovaná stránka/);
  assert.match(md, /pripravené: \*\*1\*\* · blokované: \*\*1\*\* · backlog: \*\*2\*\* · dokončené sprinty: \*\*1\*\*/);
  assert.match(md, /\| 32 \| P0 \| Ready one \| GT-001 \|/);
  assert.match(md, /\| 33 \| P2 \| Needs test \| chýba kontraktový test \|/);
  assert.match(md, /\| GT-001 \| P0 \| Promoted \| rieši sa v sprinte 32 \|/);
  assert.match(md, /\[#64\]\(https:\/\/github.com\/badmarsh\/openvpm-ai\/pull\/64\)/);
});

test("import CLI writes the ticket; dry-run writes nothing", async () => {
  const root = fixture({ "tasks/proposed/gt-016-a.md": "x", "intake.md": filled });
  const logs = [];
  assert.equal(await main(["import", join(root, "intake.md"), "--dry-run"], root, (l) => logs.push(l)), 0);
  assert.match(logs[0], /would write tasks\/proposed\/gt-017-/);
  assert.equal(loadSpecs(root).length, 1);
  assert.equal(await main(["import", join(root, "intake.md")], root, () => {}), 0);
  assert.equal(loadSpecs(root).length, 2);
  writeFileSync(join(root, "bad.md"), TEMPLATE);
  assert.equal(await main(["import", join(root, "bad.md")], root, () => {}), 1);
});
