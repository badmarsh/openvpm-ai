# @openpims/db

Drizzle ORM schema, PostgreSQL Row-Level Security (RLS) policies, and database migrations for OpenVPM AI.

## Architectural Rules
- **Zero-conflict upstream synchronization:** Never modify vanilla tables (packages/db/schema/*.ts).
- All new features and domain extensions must reside in dedicated extension tables (packages/db/schema/ext_*.ts).
- Run pnpm db:push for local development schema updates.
- Run pnpm db:migrate and pnpm db:rls for production migration runs.

See [\CLAUDE.md\](../../CLAUDE.md) and [\.agents/skills/openvpm-ai/SKILL.md\](../../.agents/skills/openvpm-ai/SKILL.md) for full guardrails.
