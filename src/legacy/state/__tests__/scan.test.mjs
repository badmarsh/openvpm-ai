import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  REPO_ROOT,
  collectSourceFiles,
  groupByRule,
  scanRepo,
  scanSource,
  toRepoRelative,
} from "../scan.mjs";
import {
  baselinePath,
  diffAgainstBaseline,
  readBaseline,
  signatureOf,
} from "../audit.mjs";
import { RULES } from "../rules.mjs";

describe("scanSource", () => {
  test("reports 1-based line numbers and the matched substring", () => {
    const findings = scanSource("apps/web/lib/x.ts", [
      "import { useEffect } from 'react';",
      "",
      "export function go() {",
      '  window.location.assign("/records");',
      "}",
      "",
    ].join("\n"));

    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, "LSB-004");
    assert.equal(findings[0].line, 4);
    assert.equal(findings[0].matched, "window.location.assign(");
    assert.equal(findings[0].file, "apps/web/lib/x.ts");
  });

  test("a clean file produces no findings", () => {
    const clean = [
      '"use client";',
      "import { useState } from 'react';",
      "export function Counter() {",
      "  const [n, setN] = useState(0);",
      "  return <button onClick={() => setN(n + 1)}>{n}</button>;",
      "}",
    ].join("\n");
    assert.deepEqual(scanSource("apps/web/components/counter.tsx", clean), []);
  });

  test("line-level and file-level rules can both fire in one file", () => {
    const src = [
      '"use client";',
      "import { useEffect } from 'react';",
      "export default function Stub() {",
      "  const router = useRouter();",
      "  useEffect(() => {",
      '    router.replace("/wellness");',
      "  }, [router]);",
      "  return null;",
      "}",
    ].join("\n");
    const ids = scanSource("apps/web/app/(dashboard)/marketing/wellness/page.tsx", src)
      .map((f) => f.ruleId)
      .sort();
    assert.deepEqual(ids, ["LSB-005"]);
  });

  test("snippets are trimmed and length-capped", () => {
    const long = `  window.location.assign("${"x".repeat(400)}");`;
    const [f] = scanSource("apps/web/lib/x.ts", long);
    assert.equal(f.snippet.startsWith("window.location.assign("), true);
    assert.ok(f.snippet.length <= 160);
  });
});

describe("repo walking", () => {
  test("REPO_ROOT resolves above src/legacy/state", () => {
    assert.equal(REPO_ROOT.endsWith("/src/legacy/state"), false);
    assert.equal(REPO_ROOT.endsWith("src"), false);
  });

  test("collectSourceFiles never returns node_modules or build output", () => {
    const files = collectSourceFiles(REPO_ROOT).map(toRepoRelative);
    assert.ok(files.length > 100, `expected a real walk, got ${files.length}`);
    for (const f of files) {
      assert.equal(f.includes("node_modules/"), false, f);
      assert.equal(f.includes("/.next/"), false, f);
      assert.equal(f.includes("/.git/"), false, f);
    }
  });

  test("the audit tool does not report its own rule definitions", () => {
    const files = collectSourceFiles(REPO_ROOT).map(toRepoRelative);
    assert.deepEqual(
      files.filter((f) => f.startsWith("src/legacy/state/")),
      [],
      "the scanner must exclude its own directory",
    );
  });

  test("test fixtures are not treated as production bindings", () => {
    const files = collectSourceFiles(REPO_ROOT).map(toRepoRelative);
    assert.deepEqual(
      files.filter((f) => f.includes("__tests__") || f.includes(".test.")),
      [],
    );
  });
});

describe("scanRepo over the real repository", () => {
  const findings = scanRepo();

  test("findings are sorted by file then line", () => {
    for (let i = 1; i < findings.length; i += 1) {
      const prev = findings[i - 1];
      const cur = findings[i];
      const ok =
        prev.file < cur.file || (prev.file === cur.file && prev.line <= cur.line);
      assert.ok(ok, `out of order: ${prev.file}:${prev.line} before ${cur.file}:${cur.line}`);
    }
  });

  test("every finding cites a rule that exists", () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const f of findings) {
      assert.ok(ids.has(f.ruleId), `unknown rule ${f.ruleId}`);
    }
  });

  test("every finding points at a source file under apps/ or packages/", () => {
    for (const f of findings) {
      assert.match(
        f.file,
        /^(apps|packages)\//,
        `${f.file} is outside the scanned source surface`,
      );
    }
  });

  test("the known high-severity bindings are still present", () => {
    // Regression anchor: these three are the bindings the audit document
    // singles out. If a future change silently drops them from the scan the
    // rule has regressed, not the codebase.
    const sigs = new Set(findings.map(signatureOf));
    const required = [
      "LSB-008::apps/web/lib/use-unsaved-changes-guard.ts::originalPushState = window.history.pushState",
      "LSB-002::apps/web/app/(dashboard)/patients/[id]/page.tsx::LEGACY_TAB_MAP",
      "LSB-001::apps/web/server/routers/_app.ts::@deprecated",
    ];
    for (const r of required) {
      assert.ok(sigs.has(r), `expected binding missing from scan: ${r}`);
    }
  });

  test("groupByRule counts sum to the finding total", () => {
    const groups = groupByRule(findings);
    const sum = groups.reduce((acc, g) => acc + g.count, 0);
    assert.equal(sum, findings.length);
    assert.equal(groups.length, new Set(findings.map((f) => f.ruleId)).size);
  });
});

describe("baseline gate", () => {
  test("a baseline file is checked in", () => {
    const baseline = readBaseline();
    assert.ok(Array.isArray(baseline.findings));
    assert.equal(baseline.findings.length, baseline.totalFindings);
    assert.equal(typeof baseline.gitCommitSha, "string");
    assert.equal(baselinePath().endsWith("baseline.json"), true);
  });

  test("baseline byRule counts agree with the finding list", () => {
    const baseline = readBaseline();
    const recomputed = groupByRule(baseline.findings);
    for (const g of recomputed) {
      assert.equal(
        baseline.byRule[g.ruleId],
        g.count,
        `byRule drift for ${g.ruleId}`,
      );
    }
  });

  test("the live scan matches the checked-in baseline", () => {
    const baseline = readBaseline();
    const { added, retired } = diffAgainstBaseline(scanRepo(), baseline.findings);
    assert.deepEqual(added, [], "unaudited legacy state bindings appeared");
    assert.deepEqual(retired, [], "audited bindings vanished without a baseline refresh");
  });

  test("signatureOf ignores line numbers", () => {
    const a = { ruleId: "LSB-004", file: "x.ts", line: 1, matched: "window.location.assign(" };
    const b = { ruleId: "LSB-004", file: "x.ts", line: 99, matched: "window.location.assign(" };
    assert.equal(signatureOf(a), signatureOf(b));
  });

  test("diffAgainstBaseline reports additions and retirements", () => {
    const binding = (ruleId, file) => ({ ruleId, file, matched: "m" });
    const { added, retired } = diffAgainstBaseline(
      [binding("LSB-004", "kept.ts"), binding("LSB-004", "new.ts")],
      [binding("LSB-004", "kept.ts"), binding("LSB-004", "gone.ts")],
    );
    assert.deepEqual(added, ["LSB-004::new.ts::m"]);
    assert.deepEqual(retired, ["LSB-004::gone.ts::m"]);
  });

  test("identical input produces an empty diff", () => {
    const bindings = [{ ruleId: "LSB-004", file: "x.ts", matched: "m" }];
    assert.deepEqual(diffAgainstBaseline(bindings, bindings), {
      added: [],
      retired: [],
    });
  });
});
