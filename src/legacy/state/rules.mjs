/**
 * Sprint 26 — Audit Legacy State Bindings.
 *
 * Detection rules for *legacy state bindings*: client- or server-side state
 * that is still reachable in production but is no longer the sanctioned way to
 * hold that state. "Legacy" here does not mean "broken" — every rule below
 * describes a binding that works today and that a future sprint must be able to
 * retire without a user-visible regression.
 *
 * This module is deliberately pure (no fs, no path resolution, no I/O) so the
 * matching semantics can be unit-tested in isolation. See `scan.mjs` for the
 * walker that feeds lines into `matchLine`.
 *
 * Every rule carries the migration target that retires it. The audit document
 * (docs/migration/sprint-26-legacy-state-bindings-audit.md) cites these ids.
 */

/**
 * @typedef {"low" | "medium" | "high"} Severity
 *
 * @typedef {object} Rule
 * @property {string} id            Stable id, cited by the audit document.
 * @property {string} title         One-line human description.
 * @property {Severity} severity    Retire-first ordering hint.
 * @property {string} category      Grouping used by the audit tables.
 * @property {RegExp} pattern       Applied per source line, or per file when
 *                                  `fileLevel` is set.
 * @property {string[]} scope       Repo-relative path prefixes the rule runs in.
 * @property {boolean} [skipComments] Ignore `//`, `/*` and `*` lead-in lines.
 * @property {boolean} [fileLevel]  Match once per file instead of per line.
 * @property {string} why           Why the binding is legacy.
 * @property {string} migration     The sanctioned replacement.
 */

/** Rules that only apply inside the Next.js app package. */
const WEB = ["apps/web/"];

/** Rules that apply to the whole monorepo source surface. */
const ALL = ["apps/web/", "packages/"];

/**
 * Line prefixes that mean "this line is a comment, not executable state".
 * Mirrors the comment heuristic in apps/web/scripts/scan-hardcoded-i18n.js.
 * @type {RegExp}
 */
export const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\s*\/\*)/;

/** @type {Rule[]} */
export const RULES = [
  {
    id: "LSB-001",
    title: "Deprecated exported symbol kept live",
    severity: "high",
    category: "deprecated-api",
    // The one rule that intentionally fires *on* a comment: `@deprecated` is
    // the machine-readable retirement marker for a symbol that is still wired up.
    pattern: /@deprecated\b/,
    scope: ALL,
    skipComments: false,
    why: "The symbol is still exported and still callable; the JSDoc tag is the only thing telling callers to stop.",
    migration:
      "Delete the deprecated export once its last caller is migrated; where an external contract forbids deletion, gate it behind an explicit compatibility router instead of a JSDoc hint.",
  },
  {
    id: "LSB-002",
    title: "Backwards-compatible query-param map",
    severity: "medium",
    category: "legacy-url-state",
    pattern: /\bLEGACY_[A-Z0-9_]*MAP\b/,
    scope: WEB,
    skipComments: true,
    why: "Bookmarked `?tab=` values from the previous information architecture are translated through a hardcoded map, so the URL contract has two shapes.",
    migration:
      "Serve old links through a server-side redirect at the route boundary so the client only ever sees canonical state.",
  },
  {
    id: "LSB-003",
    title: "Direct History API write",
    severity: "high",
    category: "legacy-url-state",
    pattern: /(?:window\.)?history\.(?:replaceState|pushState)\s*\(/,
    scope: WEB,
    skipComments: true,
    why: "Writing the URL behind the Next.js router desynchronises the router's internal state from the address bar; the router no longer owns navigation.",
    migration:
      "Use `router.replace`/`router.push` (or a server redirect) so the router remains the single owner of URL state.",
  },
  {
    id: "LSB-004",
    title: "Hard navigation resets client state",
    severity: "medium",
    category: "legacy-url-state",
    pattern:
      /window\.location\.(?:href\s*=[^=]|assign\s*\(|replace\s*\(|reload\s*\()/,
    scope: WEB,
    skipComments: true,
    why: "A full document load throws away the React tree, the tRPC cache and every in-flight query — state is rebuilt from scratch rather than transitioned.",
    migration:
      "Use client-side navigation; reserve full loads for genuine cross-origin handoffs (checkout, e-sign) and document why each one needs it.",
  },
  {
    id: "LSB-005",
    title: "Client-side legacy route redirect stub",
    severity: "medium",
    category: "legacy-route",
    // File-level rule. A plain `router.replace("/x")` line is legitimate
    // (post-login redirect, URL state sync); what is legacy is a whole page
    // whose only behaviour is to move the visitor somewhere else. That shape is
    // an effect whose *first* statement is the redirect, so match the file, not
    // the line — otherwise every ordinary `router.replace` becomes noise.
    fileLevel: true,
    pattern: /useEffect\(\s*\(\)\s*=>\s*\{\s*router\.replace\s*\(/,
    scope: WEB,
    why: "A superseded route is kept alive as a client component that boots, hydrates, and only then redirects — paying a full bundle + hydration round-trip to move one URL, and rendering untranslated copy while it does.",
    migration:
      "Move the redirect into `next.config.js` `redirects` or a server `redirect()` so no client bundle ships for the dead route.",
  },
  {
    id: "LSB-006",
    title: "Browser-storage state binding",
    severity: "medium",
    category: "legacy-browser-state",
    pattern: /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(/,
    scope: WEB,
    skipComments: true,
    why: "User preference state lives in per-browser storage instead of the account, so it is invisible to the server, un-migratable and lost on device change.",
    migration:
      "Read the persisted preference server-side (session/profile) and keep storage only as a pre-hydration hint with the server value winning.",
  },
  {
    id: "LSB-007",
    title: "Untyped window global access",
    severity: "low",
    category: "legacy-browser-state",
    pattern: /\(window as any\)\.\w+|window\.__\w+/,
    scope: WEB,
    skipComments: true,
    why: "State read through an `any`-cast window escape hatch has no type contract and silently degrades to `undefined` on browsers that lack the API.",
    migration:
      "Declare a typed capability probe in one module and feature-detect once, exporting a narrow typed helper.",
  },
  {
    id: "LSB-008",
    title: "Platform API monkey-patch",
    severity: "high",
    category: "legacy-browser-state",
    // Assigning over a platform method is a document-lifetime global mutation.
    // Two families are covered: History (pushState/replaceState) and
    // navigator.mediaDevices.getUserMedia. `\s*(?<![=!<>])=(?!=)` accepts a
    // space before `=` while keeping `===`/`!==` comparisons against these
    // properties from matching.
    pattern:
      /(?:window\.history\.(?:pushState|replaceState)|navigator\.mediaDevices\.getUserMedia)\s*(?<![=!<>])=(?!=)|original\w+\s*=\s*(?:window\.history\.\w+|navigator\.mediaDevices\.getUserMedia)/,
    scope: WEB,
    skipComments: true,
    why: "Replacing a platform method is a module-level global mutation whose lifetime is the document, not the component; every later call site flows through it whether or not the owning component is mounted.",
    migration:
      "Replace the patch with a declarative mechanism the caller can query (blocking navigation intent, or an injectable media source) rather than intercepting the platform API.",
  },
  {
    id: "LSB-009",
    title: "Legacy data-shape flag in state",
    severity: "medium",
    category: "legacy-data-state",
    pattern:
      /\blegacyReview\b|\blegacyBusinessStageRows\b|status\s*===\s*["']legacy["']|===\s*["']legacy["']\s*\)/,
    scope: WEB,
    skipComments: true,
    why: "The UI branches on a marker that exists only because pre-migration rows never got the newer attribution columns, so legacy handling is compiled into live render paths.",
    migration:
      "Backfill the missing attribution in a data migration, then delete the branch; keep the read-only acknowledgement path only while unmigrated rows remain.",
  },
  {
    id: "LSB-010",
    title: "Module-level mutable singleton",
    severity: "low",
    category: "legacy-browser-state",
    pattern: /^let\s+\w+\s*(:[^=]*)?=\s*(?:null|false|true|0|new Map\b)/,
    // Excluded: apps/web/scripts are one-shot Node CLIs where a top-level
    // counter is the normal shape, not state that outlives a component.
    scope: ["apps/web/app/", "apps/web/components/", "apps/web/lib/", "apps/web/server/"],
    skipComments: true,
    why: "Top-level `let` state is shared by every component instance for the lifetime of the module and survives route transitions, so its value depends on navigation history.",
    migration:
      "Move per-session state into a context/provider or a keyed store so its lifetime is explicit and testable.",
  },
];

/**
 * Should this rule be evaluated for this repo-relative path?
 * @param {Rule} rule
 * @param {string} relPath posix-style repo-relative path
 * @returns {boolean}
 */
export function ruleAppliesToPath(rule, relPath) {
  return rule.scope.some((prefix) => relPath.startsWith(prefix));
}

/**
 * @param {string} line raw source line, no trailing newline
 * @returns {boolean} true when the line is a comment lead-in
 */
export function isCommentLine(line) {
  return COMMENT_LINE.test(line);
}

/**
 * Match a single source line against every in-scope line-level rule.
 *
 * @param {string} line          raw source line
 * @param {object} opts
 * @param {string} opts.relPath  posix-style repo-relative path (drives scoping)
 * @returns {Array<{ruleId: string, matched: string}>}
 */
export function matchLine(line, { relPath }) {
  const out = [];
  for (const rule of RULES) {
    if (rule.fileLevel) continue;
    if (!ruleAppliesToPath(rule, relPath)) continue;
    if (rule.skipComments && isCommentLine(line)) continue;
    const m = rule.pattern.exec(line);
    if (m) {
      out.push({ ruleId: rule.id, matched: m[0] });
    }
  }
  return out;
}

/**
 * Match a whole file against every in-scope file-level rule. File-level rules
 * report at most one finding per file, at the line where the pattern starts.
 *
 * @param {string} relPath posix-style repo-relative path
 * @param {string} source  full file contents
 * @returns {Array<{ruleId: string, matched: string, line: number}>}
 */
export function matchFile(relPath, source) {
  const out = [];
  for (const rule of RULES) {
    if (!rule.fileLevel) continue;
    if (!ruleAppliesToPath(rule, relPath)) continue;
    const m = rule.pattern.exec(source);
    if (!m) continue;
    const line = source.slice(0, m.index).split("\n").length;
    out.push({ ruleId: rule.id, matched: m[0], line });
  }
  return out;
}

/**
 * @param {string} ruleId
 * @returns {Rule | undefined}
 */
export function ruleById(ruleId) {
  return RULES.find((r) => r.id === ruleId);
}
