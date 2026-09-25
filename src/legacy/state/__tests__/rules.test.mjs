import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  RULES,
  isCommentLine,
  matchFile,
  matchLine,
  ruleAppliesToPath,
  ruleById,
} from "../rules.mjs";

/** Shorthand: which rule ids fire on one line of a given file? */
function idsFor(line, relPath = "apps/web/app/page.tsx") {
  return matchLine(line, { relPath }).map((f) => f.ruleId);
}

describe("rule table invariants", () => {
  test("every rule id is unique", () => {
    const ids = RULES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate rule id");
  });

  test("every rule carries the metadata the audit document cites", () => {
    for (const rule of RULES) {
      assert.match(rule.id, /^LSB-\d{3}$/, `${rule.id}: bad id shape`);
      assert.ok(rule.title?.length > 3, `${rule.id}: title missing`);
      assert.ok(
        ["low", "medium", "high"].includes(rule.severity),
        `${rule.id}: severity must be low|medium|high`,
      );
      assert.ok(rule.category?.length > 3, `${rule.id}: category missing`);
      assert.ok(rule.why?.length > 20, `${rule.id}: 'why' missing`);
      assert.ok(rule.migration?.length > 20, `${rule.id}: migration target missing`);
      assert.ok(
        Array.isArray(rule.scope) && rule.scope.length > 0,
        `${rule.id}: scope must be a non-empty prefix list`,
      );
      for (const prefix of rule.scope) {
        assert.ok(
          prefix.endsWith("/"),
          `${rule.id}: scope prefix "${prefix}" must end with "/"`,
        );
      }
    }
  });

  test("no rule pattern is global (exec would carry lastIndex across lines)", () => {
    for (const rule of RULES) {
      assert.equal(
        rule.pattern.global,
        false,
        `${rule.id}: pattern must not use the /g flag`,
      );
    }
  });

  test("ruleById resolves every id", () => {
    for (const rule of RULES) {
      assert.equal(ruleById(rule.id), rule);
    }
    assert.equal(ruleById("LSB-999"), undefined);
  });
});

describe("path scoping", () => {
  test("web-scoped rules ignore packages/", () => {
    const line = "window.history.replaceState(null, \"\", url);";
    assert.deepEqual(idsFor(line, "apps/web/app/x/page.tsx"), ["LSB-003"]);
    assert.deepEqual(idsFor(line, "packages/db/schema/x.ts"), []);
  });

  test("deprecated-symbol rules cover the whole monorepo", () => {
    const line = "/** @deprecated use the new one */";
    for (const relPath of ["apps/web/lib/x.ts", "packages/api/x.ts"]) {
      assert.deepEqual(idsFor(line, relPath), ["LSB-001"], relPath);
    }
  });

  test("module-level singleton rule skips one-shot CLI scripts", () => {
    const line = "let added = 0;";
    assert.deepEqual(idsFor(line, "apps/web/lib/x.ts"), ["LSB-010"]);
    assert.deepEqual(idsFor(line, "apps/web/scripts/i18n-add-keys.mjs"), []);
  });

  test("ruleAppliesToPath matches on prefix, not substring", () => {
    const webRule = ruleById("LSB-003");
    assert.equal(ruleAppliesToPath(webRule, "apps/web/app/page.tsx"), true);
    assert.equal(ruleAppliesToPath(webRule, "apps/docs/readme.tsx"), false);
  });
});

describe("comment handling", () => {
  test("isCommentLine recognises the four lead-in shapes", () => {
    assert.equal(isCommentLine("// window.location.assign(\"/x\")"), true);
    assert.equal(isCommentLine("  /* window.location.assign(\"/x\") */"), true);
    assert.equal(isCommentLine(" * window.location.assign(\"/x\")"), true);
    assert.equal(isCommentLine("  {/* window.location.assign(\"/x\") */}"), true);
    assert.equal(isCommentLine("window.location.assign(\"/x\")"), false);
  });

  test("executable-state rules do not fire on commented-out code", () => {
    // The i18n scanner has this exact bug class: a commented example must not
    // be reported as a live binding.
    assert.deepEqual(
      idsFor("// history.replaceState(null, \"\", url) — old approach"),
      [],
    );
    assert.deepEqual(idsFor("  // window.location.href = data.url"), []);
  });

  test("LSB-001 is the documented exception and fires inside a comment", () => {
    assert.deepEqual(idsFor("/** @deprecated Use treatmentEstimates instead */"), [
      "LSB-001",
    ]);
  });
});

describe("line-level detection", () => {
  const cases = [
    ["LSB-002", "const LEGACY_TAB_MAP: Record<string, Tab> = {"],
    ["LSB-003", "window.history.replaceState(window.history.state, \"\", url);"],
    ["LSB-003", "history.replaceState(null, \"\", url.toString());"],
    ["LSB-003", "window.history.pushState({ tab }, \"\", url);"],
    ["LSB-004", "window.location.href = data.checkoutUrl;"],
    ["LSB-004", "window.location.assign(\"/schedule\");"],
    ["LSB-004", "window.location.replace(\"/\");"],
    ["LSB-006", "const saved = localStorage.getItem(\"openvpm_locale\");"],
    ["LSB-006", "window.localStorage.setItem(storageKey(userId), payload);"],
    ["LSB-007", "(window as any).SpeechRecognition ||"],
    ["LSB-008", "originalPushState = window.history.pushState;"],
    ["LSB-008", "navigator.mediaDevices.getUserMedia = async (constraints) => {"],
    ["LSB-008", "navigator.mediaDevices.getUserMedia = originalGetUserMedia;"],
    [
      "LSB-008",
      "originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);",
    ],
    ["LSB-009", "if (source.legacyReview && !input.acknowledgeLegacyReview) {"],
    ["LSB-009", "data.billingSyncStatus.status === \"legacy\");"],
    ["LSB-010", "let listenersAttached = false;"],
    ["LSB-010", "let resend: Resend | null = null;"],
  ];

  for (const [ruleId, line] of cases) {
    test(`${ruleId} fires on: ${line.slice(0, 52)}`, () => {
      assert.ok(
        idsFor(line).includes(ruleId),
        `expected ${ruleId} to fire, got ${JSON.stringify(idsFor(line))}`,
      );
    });
  }

  test("non-matching code produces no findings", () => {
    const clean = [
      "const router = useRouter();",
      "const [tab, setTab] = useState<Tab>(\"overview\");",
      "router.replace(`/records?${params.toString()}`);",
      "const url = new URL(window.location.href);",
      "export function useUnsavedChangesGuard(dirty: boolean) {",
      "let resend = createResendClient();",
    ];
    for (const line of clean) {
      assert.deepEqual(idsFor(line), [], `unexpected finding for: ${line}`);
    }
  });

  test("a URL read is not a URL write", () => {
    // `new URL(window.location.href)` reads the location; it must not be
    // reported as a hard navigation.
    assert.deepEqual(
      idsFor("const url = new URL(window.location.href);"),
      [],
    );
  });

  test("comparing against a platform API is not patching it", () => {
    // The `=(?!=)` guard with a lookbehind exists for exactly these lines.
    const reads = [
      "if (navigator.mediaDevices.getUserMedia === originalGetUserMedia) return;",
      "assert.equal(window.history.pushState === original, true);",
      "const current = navigator.mediaDevices.getUserMedia;",
      "if (window.history.pushState !== originalPushState) {",
    ];
    for (const line of reads) {
      assert.deepEqual(
        idsFor(line).filter((id) => id === "LSB-008"),
        [],
        `LSB-008 must not fire on a comparison: ${line}`,
      );
    }
  });
});

describe("file-level detection (LSB-005 redirect stubs)", () => {
  const stub = `"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WellnessRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/wellness");
  }, [router]);

  return <div>Redirecting</div>;
}
`;

  test("a redirect-only page is reported once, at the effect", () => {
    const hits = matchFile("apps/web/app/(dashboard)/marketing/wellness/page.tsx", stub);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].ruleId, "LSB-005");
    assert.equal(hits[0].line, 9, "must point at the useEffect, not the import");
  });

  test("an ordinary router.replace is not a redirect stub", () => {
    const ordinary = `export function Page() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    router.replace(\`/marketing?\${params.toString()}\`, { scroll: false });
  }, [activeTab, router]);
  return null;
}
`;
    assert.deepEqual(
      matchFile("apps/web/app/(dashboard)/marketing/page.tsx", ordinary),
      [],
    );
  });

  test("an onClick router.replace is not a redirect stub", () => {
    const onClick = `export function Back() {
  return <Button onClick={() => { resetForms(); router.replace("/records"); }}>Back</Button>;
}
`;
    assert.deepEqual(matchFile("apps/web/app/(dashboard)/records/page.tsx", onClick), []);
  });

  test("file-level rules never leak into line matching", () => {
    assert.deepEqual(
      idsFor("useEffect(() => { router.replace(\"/wellness\"); }, [router]);"),
      [],
    );
  });

  test("file-level rules respect path scoping", () => {
    assert.deepEqual(matchFile("packages/db/schema/x.ts", stub), []);
  });
});
