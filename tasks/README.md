# Tasks

Specs, backlog tickets and their history. **How work flows through this folder is described in [`WORKFLOW.md`](WORKFLOW.md)**, and the rules every spec inherits are in [`RULES.md`](RULES.md). The legacy Agno dev swarm has been deprecated and removed.

## Layout

| Path | Contents | Rule |
|---|---|---|
| [`WORKFLOW.md`](WORKFLOW.md) | Lifecycle: write → gate → implement → close | Start here |
| [`RULES.md`](RULES.md) | Standing rules (codebase non-negotiables, grounding, delivery) | Specs reference them instead of copying them |
| [`TEMPLATE.md`](TEMPLATE.md) | Thin spec template with frontmatter | Copy it for every new sprint |
| [`SPRINT-INDEX.md`](SPRINT-INDEX.md) | Table **generated** from spec frontmatter plus a hand-written collisions note | `node scripts/tasks/tasks.mjs index`. CI checks it's current. **git outranks it.** |
| [`sprints/`](sprints/) | Numbered sprint specs `arena-sprint-<N>-<slug>.md` (`kind: sprint`) | Dispatch only when `tasks.mjs check <N>` says READY |
| [`proposed/`](proposed/) | Backlog tickets `gt-<NNN>-*.md` (`kind: ticket`) | Promote to a sprint (`source: GT-NNN`) before implementing. Archive when done |
| [`archive/`](archive/) | Finished or superseded prompts, dispatch copies, Arena responses, PR notes | Read-only history, date-prefixed (`YYYY-MM-DD-name`). **Never dispatch from here** |
| [`VERIFICATION-LOG.md`](VERIFICATION-LOG.md) | 2026-09-27 audit of all 113 historical prompt/spec files | Historical. Live status lives in frontmatter now |

Specs from before 2026-09-27 also carry a blockquote verification header under their frontmatter (`Verification YYYY-MM-DD · Status · Verdict · Evidence · Origin`). New specs don't need one, because the frontmatter plus `tasks.mjs status` replace it.

Old Agno runtime churn (`run-*.json`, `repair-*.md`, `*.patch`) stays git-ignored (see `.gitignore`).

## Definition of done

A sprint is **done** when its `contract_test` has no `it.fails` left and passes in CI, its target files changed in a commit reachable from `main`, and its frontmatter says `state: done` with `prs:` filled in. A PR title, a table row or an existing `.md` file isn't evidence.
