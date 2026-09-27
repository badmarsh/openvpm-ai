# DEPRECATED: Agno dev swarm (`.agents/agno/`)

**Status:** deprecated on 2026-09-27 by the repository owner. Don't start `pipeline_team_os.py`, don't dispatch work through `arena-dispatcher.ts` / `create_and_dispatch_arena_task`, and don't add features here.

**Replacement:** a single agent session acts as writer, dispatcher and implementer, following [`tasks/WORKFLOW.md`](../../tasks/WORKFLOW.md). Spec status is computed by `scripts/tasks/tasks.mjs` from spec frontmatter and contract tests, not parsed out of `SPRINT-INDEX.md` by `_parse_sprint_index`.

## Why

The 2026-09-27 audit (`tasks/VERIFICATION-LOG.md`) traced most spec failures to the swarm path:

- Sprints 21–30 were emitted as 38-line, 4-section stubs that skipped the recon step. Two of them (25, 29) claimed "stub 0 lines" for pages that had 5,409 and 2,055 lines.
- It reused sprint numbers 24 and 26–30 for generic tickets (`arena-1790325424-*`), which then landed unreviewed and bundled in PR #67. G-28 was never implemented.
- The index said Sprints 15 and 18 were "dispatched/running", but no PR was ever opened for either.
- It had no premise check or executable definition of done, so a spec could be "merged" without its test existing (Sprint 29).

## What still references it (intentionally left in place)

| Place | What | Suggested follow-up |
|---|---|---|
| `apps/web/app/(dashboard)/admin/ai-swarm/page.tsx`, `server/routers/extensions/ai-swarm.ts` | Admin telemetry page probing AgentOS on `:7777` (`AGENT_OS_URL`) | **Decided 2026-09-27:** rename it to *AI team*, a roster of the practice's models and endpoints. Specified as Sprint 34 (`tasks/sprints/arena-sprint-34-admin-ai-team.md`) |
| `CLOUDFLARE_TUNNEL.md` | Tunnel runbook for the AgentOS port | Archive once the admin page is gone |
| `package.json` → `agent-ui` | Starts the Agno agent UI | Remove together with the admin page |
| `.agents/skills/agno/` | Agno framework reference skill | Harmless. Keep it only while code here is maintained |
| `tests/` here | `test_prompt_templates.py` and `test_pipeline_tools.py` still pass (43 tests, 2026-09-27) | Delete together with the code |

The code stays in the tree so history and the tests keep working. Deleting it is a separate, reviewable PR.
