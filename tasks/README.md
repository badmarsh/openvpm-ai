# Tasks / Golden Tickets

This folder holds the approved task specs (Golden Tickets and Arena sprint assignments) created with the [`new-task`](../.agents/skills/new-task/SKILL.md) skill and the sprint-writer prompt ([`../prompts/arena-sprint-writer-prompt.md`](../prompts/arena-sprint-writer-prompt.md)).

## Layout (reorganised 2026-09-27)

| Path | Contents | Rule |
|---|---|---|
| [`SPRINT-INDEX.md`](SPRINT-INDEX.md) | Status table of numbered sprints | Parsed by the Agno runtime (`_parse_sprint_index`). **git outranks it.** |
| [`VERIFICATION-LOG.md`](VERIFICATION-LOG.md) | Chronological ledger: every prompt/spec checked against git and code | Update it whenever a file's status changes. |
| [`sprints/`](sprints/) | Numbered sprint specs `arena-sprint-<N>-<slug>.md` (1–30) + unnumbered Agno sprint specs | `read_sprint_assignment(N)` reads from here (falls back to `tasks/`). |
| [`proposed/`](proposed/) | **Open** Golden Tickets `gt-0xx-*.md` | When a ticket reaches DONE, move it to `archive/`. |
| [`archive/`](archive/) | Finished or superseded prompts, Agno dispatch copies, Arena responses, PR notes | Read-only history, date-prefixed (`YYYY-MM-DD-name`). **Never dispatch from here.** |

Every file carries a verification header at the top:

```
> **Verification YYYY-MM-DD** · Status: **DONE|PARTIAL|NOT DONE|…** · Verdict: **KEEP|ARCHIVE|REWRITE|DELETE**
> **Evidence:** PR / commit / file:line that proves the status
> **Notes:** caveats, collisions, what is still open
> **Origin:** previous path · first commit
```

Runtime churn written by the Agno swarm (`run-*.json`, `repair-*.md`, `*.patch`, fresh `arena-*.md` dispatch copies) lands in the `tasks/` root. Most of it is git-ignored (see `.gitignore`). Move any dispatch copy you want to keep into `archive/` with a date prefix and a verification header.

## Task lifecycle
1. **[STATUS: PROPOSED]**: the task is drafted and waiting for comments or human approval.
2. **[STATUS: READY_FOR_IMPLEMENTATION]**: acceptance criteria are approved, scope is bounded, ready to code (WIP = 1).
3. **[STATUS: IN_PROGRESS]**: a developer or AI agent is working on it.
4. **[STATUS: IN_REVIEW]**: code is written, acceptance criteria ticked, tests verified.
5. **[STATUS: DONE]**: changes are merged and tested → move the file to `archive/`, and add a row to `VERIFICATION-LOG.md`.

A sprint or ticket is **DONE** only if its target files changed in a commit reachable from `main` (and its named source-contract test exists). A PR title or an existing `.md` file doesn't count as evidence.
