# prompts/ — living prompt templates

This folder holds only **reusable, currently valid** prompt templates (target: ≤ 4 files). One-off prompts, executed missions and superseded templates are in [`../tasks/archive/`](../tasks/archive/). Sprint specs are in [`../tasks/sprints/`](../tasks/sprints/). The status of every prompt that ever existed is in [`../tasks/VERIFICATION-LOG.md`](../tasks/VERIFICATION-LOG.md).

| File | Role | State (2026-09-27) |
|---|---|---|
| [`arena-sprint-writer-prompt.md`](arena-sprint-writer-prompt.md) | v2: one session plans, writes, gates (`tasks.mjs check`) and implements one sprint | **Current.** Built on option B below plus the executable workflow in `tasks/WORKFLOW.md`. v1 is archived as `tasks/archive/2026-09-24-arena-sprint-writer-prompt-v1.md`. |

Candidates to bring back here (currently archived):
- `tasks/archive/2026-09-25-arena-final-pass-agno-consolidation.md`: verdict REWRITE. Workstreams A and B are now covered by the verification log; Agno is now deprecated (`.agents/agno/DEPRECATED.md`), so only its D (`:7777` tunnel) part could still matter.
- `tasks/archive/2026-09-14-bug-and-implementation-audit-prompt.md` / `2026-09-17-docs-update-prompt.md`: reusable audit templates. Bring one back only when you schedule a recurring pass, and replace the Windows paths first.

---

## Options for the sprint-writer prompt (decided 2026-09-27)

**Decision:** the owner deprecated the Agno swarm and made one agent session writer, dispatcher and implementer. v2 implements **B**. C is replaced by `scripts/tasks/tasks.mjs lint` plus the `Task specs` CI job, since there is no swarm left to validate. D is folded into v2 §3 (Pick) and §4 (Write). The analysis is kept below for history.

Why it needs work (from the verification): only Sprints 7–10 follow its full 10-section structure. Sprints 11–20 dropped three sections, and Sprints 21–30 were 38-line swarm stubs that skipped its §4 recon. Two of those (25, 29) were built on false "stub 0 lines" premises, and numbers 24 and 26–30 were used twice. The index also said Sprints 15 and 18 were running when they never were.

### Option A: Refresh in place (smallest change)
- Replace the §3 hardcoded snapshot with "read `tasks/SPRINT-INDEX.md` + `tasks/VERIFICATION-LOG.md`; git outranks both."
- Refresh the §5 backlog to what's actually open: Sprint 15 (`/agent/imaging`), Sprint 18 (`/clients/[id]`), GT-001 (P0), GT-006/007/010–017, and the raw `<h1>` leftovers on `encounters/[appointmentId]` and `records/new-soap`.
- Give the §4 recon commands in both bash and PowerShell.
- **Pros:** 30 minutes, low risk. **Cons:** it still depends on whoever runs it following the steps; nothing enforces the structure.

### Option B: Arena-native rewrite (recommended)
- Target the environment that actually runs it: an Arena Agent Mode Linux sandbox with `gh`, often a shallow clone (`git fetch --unshallow` first).
- A mandatory **premise gate**: every size/state claim must come from a command shown in the spec (`wc -l`, `git log -1 -- <file>`, `gh pr list --search <route>`). The word "stub" is forbidden without a measured line count.
- A **numbering guard**: take the next free number from the index and never reuse one.
- A **dedupe guard**: before writing, `gh pr list --state all --search "<route>"` and `git log --since=<spec date> -- <target>`. If the target already moved, write a verification note instead of a spec.
- Keep the 10-section output, and also update `VERIFICATION-LOG.md`.
- **Pros:** fixes every failure mode found in the audit. **Cons:** about 1 hour; the prompt grows to ~15 KB.

### Option C: One contract for humans and the Agno swarm
- Make the sprint-writer's section list the single source of truth: `format_arena_sprint_prompt` / `create_and_dispatch_arena_task` in `.agents/agno/pipeline_tools.py` emit exactly that structure instead of the 4-section short form.
- Add a small `validate_sprint_spec()` (and a pytest) that rejects specs missing the required sections, a measured line count, or a source-contract test name.
- **Pros:** the 38-line-stub problem can't happen again, whoever writes the spec. **Cons:** touches pipeline code and tests (half a day); best done after B.

### Option D: Split into planner + spec-writer
- `sprint-planner.md` (≈3 KB): reads the index, the ledger and open GTs, and picks one target with a justification.
- `sprint-spec-writer.md` (≈8 KB): deep recon and the full spec for that single target.
- **Pros:** smaller prompts suit cheaper models and parallel dispatch. **Cons:** two files to keep in sync; choosing and specifying happen in separate sessions.

**Suggested path:** B now, C next. Choose A only if you just need the next sprint written today.
