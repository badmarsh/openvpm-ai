# OpenVPM AI — Agent Guide

Canonical instructions for every coding agent in this repository (Codex, Claude Code, Gemini, OpenCode).
`CLAUDE.md` and `GEMINI.md` only point here. Nested `AGENTS.md` files in `apps/web`, `packages/db` and `e2e`
add rules for those areas. Private infrastructure details (hosts, ids, container names, runbooks for the
live server) are in the gitignored `AGENTS.local.md`; the template is `docs/agents/AGENTS.local.example.md`.
This repository is public: never write infrastructure identifiers, credentials or PII into tracked files.

## 1. Environments

| Target | Where | Notes |
|---|---|---|
| Local dev | `http://localhost:3001`, Docker `openvpm-postgres-1` (host port 5434), DB `openvpm_ai` | Primary workspace. `.env` `DATABASE_URL` points to `openvpm_ai`. |
| Upstream baseline | `../OpenVPM`, `http://localhost:3005` | Vanilla reference; inspect it before extending a workflow. |
| Remote staging (Dokploy) | see `AGENTS.local.md` | Read-only for agents unless the user says otherwise (section 4). |

Local SQL: `docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai`.
Never use `-d openpims` locally: that database is an unmigrated template.

## 2. Commands

Package manager `pnpm@9.15.0`, Node >= 20.

- `pnpm dev` / `pnpm stop` / `pnpm build`
- `pnpm verify`: the pre-push gate (guard, secret scan, lint, type-check, i18n scan, tests). Run it before reporting work as done.
- Targeted: `pnpm --filter @openpims/web type-check`, `pnpm --filter @openpims/web exec vitest run path/to/file.test.ts` (add `-t "name"` to filter), `pnpm --filter @openpims/db type-check`
- `pnpm test:e2e` (Playwright, needs a migrated DB and running app)
- Repo hygiene: `pnpm guard` (agent docs, skills sync, forbidden dirs), `pnpm secret-scan`, `pnpm verify:oss-release`
- Hooks: `pnpm hooks:install` enables `.githooks/pre-commit` (secret scan, guard, i18n symmetry)
- Task specs: `pnpm tasks lint`, `pnpm test:tasks`

## 3. Database and migrations

- Never edit vanilla schemas in `packages/db/schema/*.ts` or hand-edit anything under `packages/db/drizzle/`.
- New tables and enums live in `packages/db/schema/ext_{name}.ts`, re-exported from `packages/db/schema/index.ts`.
- **Every schema change ships with its generated migration**: run `pnpm db:generate`, commit the new `NNNN_*.sql`, snapshot and the journal entry together. A second `db:generate` must report no changes. CI (`migration-integrity`, `rls`) enforces this; PR #72 broke `main` by skipping it. The journal is append-only: never rewrite or reorder existing entries.
- `pnpm db:push` is a local convenience for experiments; it is never a substitute for the migration.
- `pnpm db:bootstrap` brings a database to a verified state (push + clinical safety triggers). `pnpm db:setup` = bootstrap + RLS + Slovak seed. RLS: `pnpm db:rls`, `pnpm db:rls:preflight && pnpm db:rls:test`.

## 4. Production write policy

- Agents treat staging/production as read-only: logs, `SELECT`, health checks are fine.
- A write (SQL, `ssh` + `docker exec`, env push, restart) needs an explicit instruction in the current user message that names the target. Show the statement first, run it in a transaction, verify counts afterwards.
- Demo and seed data go into idempotent seed scripts (`packages/db/seed-*.ts`; `db-init` runs them on deploy) and are applied to the local DB. Do not mirror them to production by hand.
- Deploys go through the `deploy` skill. It pushes `origin/main`, so commit and push first. Config for it comes from `.env` / `AGENTS.local.md`.
- Raw audio and PII never leave the environment they were created in. Production dumps never enter the repo.

## 5. Architecture (zero-conflict upstream sync)

- Custom tRPC routers: `apps/web/server/routers/extensions/`, mounted only through `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts` (`trpc.extensions.*`).
- Navigation: add items to `apps/web/config/custom-nav.ts`; do not hardcode links in `sidebar.tsx`.
- Keep edits in vanilla files generic so they can be sent upstream (`evangauer/openvpm`); Slovak-specific or AI-specific logic goes in `ext_*` schemas or `extensions/` routers. Upstream fixes must be self-contained commits without OpenVPM AI dependencies.
- After an upstream merge: vanilla schemas untouched, i18n symmetric, `pnpm --filter @openpims/web type-check` green.
- UI follows `docs/UIKIT.md`: list pages use `PageHeader` + `PageToolbar` + `DataTableFrame` / `KpiGrid` from `apps/web/components/layout/page-kit.tsx`. Every `<table>` sits in `overflow-x-auto` or `<TableScroll>`.
- Runtime: `optimizePackageImports` is production only; service workers never register on localhost; theme-dependent rendering uses a `mounted` guard.

## 6. i18n

- `apps/web/messages/en.json` and `sk.json` keep identical nested keys (objects, never dotted root keys).
- All UI text goes through `const { t } = useI18n(); t("section.key", "Fallback", { param })`. Find violations with `pnpm --filter @openpims/web i18n:scan`.
- No `app/[locale]/...` route prefixes; URLs stay canonical.
- tRPC routers throw English errors; the client translates.
- Write EN and SK independently, each natural for a vet in that language, in the same commit. Slovak terms: "Kniha ošetrení", "ochranná lehota", "očkovací preukaz". The `prelozit` skill covers deep translation passes.

## 7. Clinical and compliance gates (Slovak law)

- Human in the loop (Zákon 39/2007 Z. z. §3): AI output stays `draft` until a licensed vet confirms it through `ClinicalDiffConfirmModal`.
- Controlled substances (Zákon 139/1998 Z. z.): opiates, ketamine, propofol, butorphanol, fentanyl get no AI prefill; require manual authenticated entry.
- Sympathy gate: deceased or euthanized patients immediately suppress automated outreach; log to `ext_automation_suppression_log` (reasons `sympathy_gate`, `quiet_hours`, `sms_rate_limit`, `opt_out`, `frequency_cap`).
- Clinical claims in marketing need `clinicalApprovalCheck` and the approving vet's UUID.
- Imaging attachments use category `"imaging"` and never overwrite `patient.photoUrl`.
- GDPR: raw voice audio is deleted within 24 hours; legal basis `contract` for transactional reminders, `consent` or `legitimate_interest` for campaigns.

## 8. Secrets, PII and commits

- Secrets only in `.env` (gitignored) or environment variables; code reads `process.env.NAME`. New variables get an empty placeholder with a comment in `.env.example`.
- OAuth tokens in `ext_channel_accounts` are encrypted at rest and never exposed through tRPC.
- Never commit: PII (client names, patient UUIDs, phones, real emails), `.env*`, `.mcp.json`, `AGENTS.local.md`, one-off scripts in `apps/web/scripts/`, dumps, screenshots with real data, sensitive `console.log`.
- Before committing, review `git diff --staged`; the pre-commit hook and `pnpm secret-scan` check the obvious patterns.
- Commit and PR text: English, framed by the technical or clinical problem solved (`fix(billing): correct VAT rounding on invoice export`). No customer, partner or colleague names, no deal details, no production log ids or private URLs.

## 9. Skills, memory, MCP

- Task skills in `.agents/skills/` (mirrored to `.claude/skills/` by `pnpm skills:sync`): `openvpm-ai` (architecture index), `add-ext-schema`, `add-trpc-extension`, `i18n-pair`, `clinical-safety-review`, `deploy`, `prelozit`, `new-task`, `make-screenshot`. `impeccable` and `web-design-guidelines` are third-party and pinned in `skills-lock.json`.
- Reviewer subagent: `.claude/agents/clinical-reviewer.md`, for changes that touch clinical, billing or messaging paths.
- MCP servers are configured per developer in the gitignored `.mcp.json`; `.mcp.json.example` lists the ones this repo expects. Shared memory rules (mem0 MCP) are in section 10.
- Claude Code permissions and safety hooks live in `.claude/settings.json` (they block production `psql`, `git add` of `.env*`, and edits to `packages/db/drizzle/`).

## 10. Shared memory (mem0 MCP)

mem0 is the shared memory of all agents (Claude, Codex, Antigravity, Qwen) and the continuity layer across quota cutoffs and account switches.

- Scope: `app_id` = `openvpm-ai`, `user_id` = `marek` (pass both explicitly in mem0 tool calls).
- Start of every session/task: call `mem0_get_context` (query = the task, `app_id=openvpm-ai`). It returns this project's memories plus global ones. Use `mem0_search` for specifics before re-researching or re-deciding something.
- Save as you go, not only at the end, with `mem0_remember`: user rules/preferences/constraints, decisions with the reason, non-obvious solutions, verified findings. One atomic, dated fact per record; mark VERIFIED / UNVERIFIED where relevant. Set `app_id=openvpm-ai` for project-specific facts; omit `app_id` for global rules. Leave `agent_id` empty (the MCP fills it from `MEM0_AGENT_ID`).
- Fix stale facts with `mem0_update_memory` instead of adding contradicting duplicates. Never delete memories without explicit user approval.
- Never store secrets: API keys, passwords, tokens, webhook URLs, `.env*` contents.
- Handoff: before a quota cutoff or account switch, and after a major milestone, save one `[HANDOFF][openvpm-ai][YYYY-MM-DD HH:MM]` record with GOAL / DONE / DECISIONS / FINDINGS / STATE (branch, git status) / OPEN / NEXT. When resuming, call `mem0_get_context` with query `[HANDOFF][openvpm-ai]` and compare STATE with `git status` before continuing.
- If mem0 is unreachable (`mem0_status` fails), continue the task and print the summary in chat instead.