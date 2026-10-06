# CLAUDE.md

Instructions for Claude Code agents working in this repository.

See [@AGENTS.md](./AGENTS.md) for master architecture, database targeting, migration rules, i18n, clinical gates, and environment details.

## Claude Code Specifics
- **Settings & Tool Hooks:** Configured in `.claude/settings.json` (pre-tool safety hooks guard against destructive production actions, unauthorized schema edits, and sensitive file staging).
- **Subagents:** Specialized reviewer subagents reside in `.claude/agents/` (e.g. `clinical-reviewer.md` for clinical, billing, and sympathy gate changes).
- **Skills Mirroring:** First-party skills are maintained in `.agents/skills/` and synchronized to `.claude/skills/` via `pnpm skills:sync`.
- **Session Continuity:** mem0 MCP rules (app_id, handoff) are in `AGENTS.md` section 10.
