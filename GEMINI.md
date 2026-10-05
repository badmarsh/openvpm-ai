# GEMINI.md

Instructions for Gemini / Antigravity agents working in this repository.

See [AGENTS.md](./AGENTS.md) for master architecture, database targets, migration rules, i18n, clinical safety gates, and environment details.

## Agent Specifics
- Project skills live in `.agents/skills/` (architectural guidance in `.agents/skills/openvpm-ai/SKILL.md`).
- Pre-push verification: run `pnpm verify` before reporting completed work.
- Session Continuity: the `mem0-session-handoff` skill is optional; use it when preserving context across quota cutoffs or account switches.
