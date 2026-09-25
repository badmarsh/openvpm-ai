# `src/legacy/state/` — Legacy State Binding Auditor

Sprint 26 tooling. Zero runtime dependencies (Node 18+ built-ins only), so it
runs in CI without an install step and cannot drift from the app's dependency
graph.

> **Why this path.** The Sprint 26 ticket names `src/legacy/state/` as the
> directory holding the deprecated bindings. No such directory — and no
> root-level `src/` at all — existed in this repository: the web app lives in
> `apps/web`. The ticket lists the path as a *permitted target*, so it was
> created here as the canonical home for the audit tooling. The bindings
> themselves are in `apps/web/` and `packages/`; see the
> [audit document](../../docs/migration/sprint-26-legacy-state-bindings-audit.md)
> §0 for the full reconciliation.

## Files

| File | Purpose |
| --- | --- |
| `rules.mjs` | The 10 detection rules (`LSB-001` … `LSB-010`). Pure — no fs, no I/O. |
| `scan.mjs` | Repository walker. Applies the rules, emits findings. |
| `audit.mjs` | Baseline gate. Compares a live scan against `baseline.json`. |
| `baseline.json` | Generated. The audited inventory (102 findings at `8a1b335`). |
| `__tests__/` | 56 tests covering rule semantics and the gate. |

## Usage

```bash
node src/legacy/state/scan.mjs            # human-readable file:line report
node src/legacy/state/scan.mjs --by-rule  # counts grouped by rule
node src/legacy/state/scan.mjs --json     # machine-readable findings

node src/legacy/state/audit.mjs           # gate: exit 1 on unaudited bindings
node src/legacy/state/audit.mjs --json    # baseline diff as JSON
node src/legacy/state/audit.mjs --update  # refresh baseline.json

node --test src/legacy/state/__tests__/rules.test.mjs \
            src/legacy/state/__tests__/scan.test.mjs
```

## The ratchet

`audit.mjs` treats `baseline.json` as a floor, not a snapshot:

- an **unaudited** binding appearing → **exit 1**, with the offending
  `ruleId::file::matched` signatures listed
- an audited binding **disappearing** → exit 0, with the retirement reported so
  you refresh the baseline deliberately

So the count can only fall through a reviewed diff. Signatures deliberately
exclude line numbers, so unrelated edits above a binding do not invalidate the
audit; a new or retired binding always does.

## Adding a rule

1. Add the rule to `RULES` in `rules.mjs`. Every rule needs `id`, `title`,
   `severity`, `category`, `pattern`, `scope`, `why` and `migration` — the test
   suite enforces all of them, including that `pattern` is **not** `/g` (a
   global regex carries `lastIndex` between `exec` calls and would silently skip
   matches).
2. Add positive cases **and** the false-positive cases you checked to
   `__tests__/rules.test.mjs`. Both of the bugs found while building this were
   false-negative/false-positive shaped, not crash shaped.
3. Run `node src/legacy/state/audit.mjs --update` and commit the baseline diff
   with the rule.

Set `fileLevel: true` for a rule that describes a whole file rather than a line
(see `LSB-005`, which must not fire on an ordinary `router.replace`).

## Known limitations

Regex-based and line-oriented. It finds the binding *shapes* described by the
rules and trades recall for precision: commented-out code is skipped, a
`router.replace` inside an event handler is not a redirect stub, and a `===`
comparison against `window.history.pushState` is not a monkey-patch. It will not
find a deprecated binding expressed in a shape no rule describes.

The scanner excludes `src/legacy/state/` from its own walk, because the rule
patterns are stored here as regex literals and would otherwise report
themselves.
