# Task workflow (since 2026-09-27)

One agent session plays three roles in order: **writer → dispatcher → implementer**. The owner reviews and merges PRs. The Agno swarm that used to write and dispatch specs is **deprecated** (see [`.agents/agno/DEPRECATED.md`](../.agents/agno/DEPRECATED.md)). This file replaces its lifecycle.

Three things make the system trustworthy, so none of them can be skipped:

1. **Status is computed, not typed.** Each spec carries YAML frontmatter. `node scripts/tasks/tasks.mjs index` generates the table in `SPRINT-INDEX.md`, and CI fails if the table is stale.
2. **Premises are re-checked at dispatch.** A spec records the measured facts it was written against, such as line counts or "page-kit not imported yet". If one no longer holds, the spec is STALE and nobody implements it until it's rewritten.
3. **Done means an executable contract passes.** The writer commits the contract test with every case as `it.fails(...)`, which keeps CI green. The implementer flips the cases to `it(...)` and makes them pass. "Merged" in a table is never evidence.

## Layout

| Path | What |
|---|---|
| `tasks/sprints/arena-sprint-<N>-<slug>.md` | Dispatchable specs (`kind: sprint`) |
| `tasks/proposed/gt-<NNN>-<slug>.md` | Backlog tickets (`kind: ticket`): problem statements, not dispatchable |
| `tasks/archive/` | Read-only history. Never dispatch from here |
| `tasks/RULES.md` | Standing rules every spec inherits |
| `tasks/TEMPLATE.md` | Thin spec template with frontmatter |
| `tasks/SPRINT-INDEX.md` | Generated table plus a hand-written collisions note |
| `tasks/VERIFICATION-LOG.md` | One-off 2026-09-27 audit of all 113 historical prompt files |
| `scripts/tasks/tasks.mjs` | Tooling (zero dependencies; runs before `pnpm install`) |

## Frontmatter

```yaml
---
id: 32                      # number for sprints, GT-NNN for tickets
kind: sprint                # sprint | ticket | meta
title: "AI provenance on SOAP finalization"
state: open                 # open | partial | done | dropped | reference
priority: P0                # P0..P3
source: GT-001              # optional (sprints)
promoted_to: 32             # tickets only: the sprint that implements it
prs: [74]                   # once merged (or delivered_by: "<sha> in #61")
targets: [...]              # files the implementer may change (sprints: required while open)
creates: [...]              # targets that don't exist yet
contract_test: apps/web/...test.ts
premises:                   # declarative, no shell. Evaluated by `check`
  - "exists: <path>"
  - "missing: <path>"
  - "contains: <path> | <literal>"
  - "lacks: <path> | <literal>"
  - "lines: <path> | <min>..<max>"
note: "free text shown in the index"
---
```

## Computed status

| Status | Meaning | Next action |
|---|---|---|
| `BACKLOG` | Ticket, not yet a sprint | Promote it: write a sprint spec with `source: GT-NNN`, then set `promoted_to: <N>` on the ticket |
| `PROMOTED` | Ticket that has a sprint (`promoted_to`) | Track the sprint. Archive the ticket when the sprint is done |
| `NEEDS-CONTRACT` | Sprint without an armed contract test | The writer commits the `it.fails` contract test |
| `READY` | Premises hold and the contract is armed | Dispatch or implement |
| `STALE` | A premise failed: the code moved under the spec | Re-measure and rewrite the spec, or drop it |
| `LIKELY-DONE` | The contract test is live (no `.fails`) but the state is still open | Verify it, set `state: done` and `prs:` |
| `DONE` / `DONE?` | Declared done (`?` = the contract still has `.fails`) | Nothing, or investigate `?` |

## The loop

1. **Pick.** Run `node scripts/tasks/tasks.mjs status`. Priority order: red CI on `main` beats everything, then P0 tickets, then READY sprints by priority, then promoting P1 tickets. Every third sprint at most may be cosmetic.
2. **Write** (writer). Copy `TEMPLATE.md` to `sprints/arena-sprint-<next>-<slug>.md` and measure each premise with a command (`wc -l`, `grep -c`, `git log -1 --`). Grep the tests for source-contract literals on the targets. Write the contract test with `it.fails` cases. Commit `docs(tasks): sprint N spec + armed contract`.
3. **Gate** (dispatcher). `node scripts/tasks/tasks.mjs check <N>` must exit 0 (READY). If not, go back to step 2.
4. **Implement** (implementer). Change only `targets` and `creates`. Flip `it.fails` to `it` case by case. Run the pinned tests plus `type-check`, `lint` and `i18n:scan` for anything the change touches.
5. **Close.** Set `state: done` and `prs: [N]`, run `node scripts/tasks/tasks.mjs index`, then commit and open the PR. One sprint per PR (RULES §3).

## Commands

```bash
node scripts/tasks/tasks.mjs status          # open work with computed status (--all for everything)
node scripts/tasks/tasks.mjs check 32        # dispatch gate; exit 0 only when READY
node scripts/tasks/tasks.mjs next            # highest-priority READY spec
node scripts/tasks/tasks.mjs lint            # schema check (CI)
node scripts/tasks/tasks.mjs index [--check] # regenerate / verify SPRINT-INDEX (CI)
node --test scripts/tasks/tasks.test.mjs     # tooling tests (CI)
```

## Outline (front door and dashboard, not the source of truth)

The owner and the clinic work in Outline (`outline.dev.significa.sk`), and the agent works in the repo. The bridge is `scripts/tasks/outline.mjs`:

| Direction | What | How |
|---|---|---|
| Outline → repo | New problem | Fill in a page from the **Tiket** template ([`docs/wiki/templates/tiket.md`](../docs/wiki/templates/tiket.md)) and set *Stav: Na triáž*. The agent runs `outline.mjs import --doc <id>` (or `import <exported.md>`), which validates the page and writes `tasks/proposed/gt-NNN-*.md` with frontmatter. Then write *GT-NNN / Prevzaté* back on the page |
| repo → Outline | Status | `outline.mjs publish-tracker` overwrites the **Stav úloh** page (READY / blocked / backlog / recently done, with links to the specs and PRs). The `Tasks → Outline` workflow does this on every push to `main` once the secrets exist |

Why not track the tickets themselves in Outline: pages have no computed state, so status there would be hand-typed and drift. That is exactly the failure the 2026-09-27 audit found in `SPRINT-INDEX.md` (Sprints 15 and 18 "running" for days). Outline gets the *intake* and a *generated view*, and it never gets the authority.

Setup (once): create an API key in Outline → Settings → API with scopes `documents.*` and `templates.*`. Store it as the repo secret `OUTLINE_API_KEY`, along with `OUTLINE_TRACKER_DOC_ID` (an empty page named *Stav úloh*) and optionally `OUTLINE_COLLECTION_ID`. Then run `OUTLINE_API_KEY=… OUTLINE_COLLECTION_ID=… node scripts/tasks/outline.mjs create-template` once. **Never commit a key.**

## Numbering

Take the next free number from the generated index. **31 is reserved** (commit `fcfc18e` used it informally). Numbers are never reused. The `G-24`, `G-26…30` collisions from the Agno swarm are recorded by hand in `SPRINT-INDEX.md`.
