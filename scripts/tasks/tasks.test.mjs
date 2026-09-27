// Run: node --test scripts/tasks/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter, splitFrontmatter, stringifyFrontmatter } from "./frontmatter.mjs";
import { computeStatus, contractState, evalPremise, lintSpecs, loadSpecs, main, renderIndex, spliceIndex } from "./tasks.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "tasks-"));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), content);
  }
  return root;
}

const spec = (fm, body = "# body\n") => `---\n${fm}\n---\n${body}`;

test("parses scalars, flow lists, block lists and comments", () => {
  const d = parseFrontmatter(
    [
      "id: 32",
      "kind: sprint # trailing comment",
      'title: "Quoted: with colon"',
      "prs: [12, 13]",
      "targets:",
      "  - apps/web/app/(dashboard)/x/page.tsx",
      '  - "lacks: a | b"',
      "done: false",
      "note: ~",
      "empty: []",
    ].join("\n"),
  );
  assert.deepEqual(d, {
    id: 32,
    kind: "sprint",
    title: "Quoted: with colon",
    prs: [12, 13],
    targets: ["apps/web/app/(dashboard)/x/page.tsx", "lacks: a | b"],
    done: false,
    note: null,
    empty: [],
  });
});

test("stringify round-trips through parse", () => {
  const data = { id: 7, kind: "sprint", title: "a: b", prs: [1, 2], premises: ["exists: x", "lacks: y | z"], note: "#hash" };
  const { data: back } = splitFrontmatter(stringifyFrontmatter(data) + "body");
  assert.deepEqual(back, data);
});

test("files without frontmatter return null data", () => {
  assert.equal(splitFrontmatter("# just markdown\n").data, null);
  assert.throws(() => splitFrontmatter("---\nid: 1\n"), /missing closing/);
});

test("premises: exists, missing, contains, lacks, lines", () => {
  const root = fixture({ "a.txt": "one\ntwo\nthree\n" });
  assert.equal(evalPremise("exists: a.txt", root).ok, true);
  assert.equal(evalPremise("missing: a.txt", root).ok, false);
  assert.equal(evalPremise("contains: a.txt | two", root).ok, true);
  assert.equal(evalPremise("lacks: a.txt | two", root).ok, false);
  assert.equal(evalPremise("lines: a.txt | 3..3", root).ok, true);
  assert.equal(evalPremise("lines: a.txt | 4..", root).ok, false);
  assert.equal(evalPremise("rm -rf /", root).ok, false);
});

test("contract state: none, missing, armed, live", () => {
  const root = fixture({
    "armed.test.ts": 'it.fails("x", () => {});',
    "live.test.ts": 'it("x", () => {});',
  });
  assert.equal(contractState(null, root), "none");
  assert.equal(contractState("nope.test.ts", root), "missing");
  assert.equal(contractState("armed.test.ts", root), "armed");
  assert.equal(contractState("live.test.ts", root), "live");
});

test("status: READY, STALE, NEEDS-CONTRACT, LIKELY-DONE, BACKLOG", () => {
  const root = fixture({
    "page.tsx": "export default 1\n",
    "c.test.ts": 'it.fails("x", () => {})',
    "l.test.ts": 'it("x", () => {})',
  });
  const mk = (fm) => ({ file: "x.md", name: "x.md", data: parseFrontmatter(fm) });
  const base = "id: 1\nkind: sprint\ntitle: t\nstate: open\ntargets: [page.tsx]\n";
  assert.equal(computeStatus(mk(base + "contract_test: c.test.ts\npremises:\n  - \"lacks: page.tsx | page-kit\""), root, { withGit: false }).status, "READY");
  assert.equal(computeStatus(mk(base + "contract_test: c.test.ts\npremises:\n  - \"contains: page.tsx | page-kit\""), root, { withGit: false }).status, "STALE");
  assert.equal(computeStatus(mk(base + "contract_test: nope.test.ts"), root, { withGit: false }).status, "NEEDS-CONTRACT");
  assert.equal(computeStatus(mk(base + "contract_test: l.test.ts"), root, { withGit: false }).status, "LIKELY-DONE");
  assert.equal(computeStatus(mk("id: GT-1\nkind: ticket\ntitle: t\nstate: open"), root, { withGit: false }).status, "BACKLOG");
  assert.equal(computeStatus(mk("id: 2\nkind: sprint\ntitle: t\nstate: done\nprs: [1]\ncontract_test: c.test.ts"), root, { withGit: false }).status, "DONE?");
});

test("lint catches schema errors", () => {
  const root = fixture({
    "tasks/sprints/arena-sprint-3-x.md": spec("id: 4\nkind: sprint\ntitle: t\nstate: open\ntargets: [missing.tsx]"),
    "tasks/sprints/arena-sprint-5-y.md": spec("id: 5\nkind: nope\ntitle: t\nstate: done"),
    "tasks/proposed/gt-001-z.md": "# no frontmatter\n",
  });
  const { errors } = lintSpecs(loadSpecs(root), root);
  const text = errors.join("\n");
  assert.match(text, /file name must be arena-sprint-4/);
  assert.match(text, /target missing.tsx does not exist/);
  assert.match(text, /kind must be one of/);
  assert.match(text, /gt-001-z.md: missing frontmatter/);
});

test("index is generated between markers and next number skips 31", () => {
  const root = fixture({
    "tasks/sprints/arena-sprint-30-a.md": spec("id: 30\nkind: sprint\ntitle: A\nstate: done\nprs: [64]"),
    "tasks/proposed/gt-001-b.md": spec("id: GT-001\nkind: ticket\ntitle: B\nstate: open\npriority: P0"),
    "tasks/SPRINT-INDEX.md": "# head\n<!-- BEGIN GENERATED: node scripts/tasks/tasks.mjs index -->\nold\n<!-- END GENERATED -->\n# tail\n",
  });
  const out = spliceIndex(readFileSync(join(root, "tasks/SPRINT-INDEX.md"), "utf8"), renderIndex(loadSpecs(root), root));
  assert.match(out, /^# head/);
  assert.match(out, /# tail\n$/);
  assert.match(out, /\| 30 \| arena-sprint-30-a.md \| A \| merged \(#64\) \|/);
  assert.match(out, /Next free sprint number: 32/);
  assert.match(out, /\| GT-001 \| gt-001-b.md \| P0 \| B \| OPEN · BACKLOG \|/);
  const logs = [];
  assert.equal(main(["index", "--check"], root, (l) => logs.push(l)), 1);
  assert.equal(main(["index"], root, () => {}), 0);
  assert.equal(main(["index", "--check"], root, () => {}), 0);
});

test("check exits 0 only for READY specs", () => {
  const root = fixture({
    "page.tsx": "x\n",
    "c.test.ts": 'it.fails("x", () => {})',
    "tasks/sprints/arena-sprint-32-a.md": spec('id: 32\nkind: sprint\ntitle: A\nstate: open\ntargets: [page.tsx]\ncontract_test: c.test.ts\npremises:\n  - "exists: page.tsx"'),
    "tasks/sprints/arena-sprint-33-b.md": spec('id: 33\nkind: sprint\ntitle: B\nstate: open\ntargets: [page.tsx]\ncontract_test: c.test.ts\npremises:\n  - "missing: page.tsx"'),
  });
  assert.equal(main(["check", "32"], root, () => {}), 0);
  assert.equal(main(["check", "33"], root, () => {}), 1);
  assert.equal(main(["check", "99"], root, () => {}), 2);
  const logs = [];
  assert.equal(main(["next"], root, (l) => logs.push(l)), 0);
  assert.match(logs[0], /^32 /);
});
