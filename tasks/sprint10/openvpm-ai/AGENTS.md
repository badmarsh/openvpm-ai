# OpenVPM AI — Developer & Agent Guide

Compact operational cheat sheet for OpenCode and AI agents working in this repository.

---

## 1. Environment & Database Targeting

| Target | Host / DB Target | Port | Purpose |
|---|---|---|---|
| **Local Dev** | Local Docker `openvpm-postgres-1` (`-d openvpm_ai`) | App: `3001`, DB: `5434` | Primary active development (`.env` uses `DATABASE_URL` pointing to `openvpm_ai`). |
| **Upstream Baseline** | `../OpenVPM` | App: `3005` | Reference vanilla baseline for inspection before introducing extensions. |
| **Staging / Remote** | Dokploy on `dev.significa.sk` (`openvpm-postgres-cfoqxx`, `-d openpims`) | `https://vet.dev.significa.sk` | Live Dokploy stack. |

### Critical DB Rules:
- **NEVER query `-d openpims` locally.** On local Windows, `openpims` is an unmigrated template. Always specify `-d openvpm_ai`:
  ```bash
  docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai
  ```
- **Remote DB target:**
  ```bash
  docker exec -i $(docker ps -q -f name=openvpm-postgres-cfoqxx) psql -U openpims -d openpims
  ```
- **Dual-Environment Data Sync:** When adding or updating demo/seed data, apply changes to **both** local (`openvpm_ai`) and production (`openpims`) simultaneously.

---

## 2. Essential Commands

Package manager: **pnpm@9.15.0** (Node `>=20`).

### Dev & Build
- `pnpm dev` — Start dev servers via Turborepo (`apps/web` on `http://localhost:3001`)
- `pnpm stop` — Stop background dev processes (`node scripts/stop.mjs`)
- `pnpm build` — Build monorepo (`turbo build`)
- `pnpm clean` — Clean Turbo caches

### Verification Order: Lint -> Typecheck -> Test
1. `pnpm lint` (`turbo lint`)
2. `pnpm typecheck` or `pnpm type-check` (`turbo type-check`)
3. `pnpm test` (`turbo test`)

### Targeted Checks & Single Tests
- **Web app type-check:** `pnpm --filter @openpims/web type-check`
- **DB package type-check:** `pnpm --filter @openpims/db type-check`
- **Run a single test in web:**
  ```bash
  pnpm --filter @openpims/web exec vitest run path/to/file.test.ts
  ```
- **Filter tests by pattern:**
  ```bash
  pnpm --filter @openpims/web exec vitest run -t "test name pattern"
  ```
- **Run E2E tests:** `pnpm test:e2e` (Playwright)

### Database Lifecycle
- **Apply schema changes (dev):** `pnpm db:push` (wraps `drizzle-kit push`).
- **Complete DB init / fresh install:** `pnpm db:setup` (runs `db:bootstrap` + `db:rls` + `db:seed:sk`).
- **Bootstrap triggers & clinical safety layers:** `pnpm db:bootstrap` (never manually edit `packages/db/drizzle/*`).
- **Apply PostgreSQL RLS policies:** `pnpm db:rls`.
- **Preflight & test RLS:** `pnpm db:rls:preflight && pnpm db:rls:test`.

---

## 3. Architecture & Zero-Conflict Upstream Sync

- **Vanilla Schema Immutability:** Never modify upstream schema files in `packages/db/schema/*.ts`.
- **Extension Schemas:** All new tables/enums MUST be created in `packages/db/schema/ext_{name}.ts` and re-exported in `packages/db/schema/index.ts`.
- **Migration Journal Integrity:** Never touch or corrupt `packages/db/drizzle/meta/_journal.json`. Schema sync uses `pnpm db:push` or `pnpm db:bootstrap`.
- **tRPC Mount Point:** All custom extension routers go in `apps/web/server/routers/extensions/` and attach strictly under `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts` (`trpc.extensions.*`).
- **Sidebar & Navigation:** Do NOT hardcode links in `sidebar.tsx`. Add them to `apps/web/config/custom-nav.ts`.
- **Generic Vanilla vs SK/AI Extensions:** Keep changes to vanilla files generic so they can be cleanly backported upstream. Keep Slovak-specific or AI-specific logic in `ext_*` schemas or `extensions/` routers.
- **Dashboard UI kit:** Follow `docs/UIKIT.md`. New list pages use `PageHeader` + `PageToolbar` + `DataTableFrame` / `KpiGrid` from `apps/web/components/layout/page-kit.tsx`. Do not invent per-page table or button chrome.

---

## 4. Strict i18n Rules

- **100% Dictionary Symmetry:** `apps/web/messages/en.json` and `apps/web/messages/sk.json` must have identical nested keys.
- **No URL Locales:** Never add `app/[locale]/...` route prefixes. URLs remain canonical (`/schedule`, `/billing`, `/patients`).
- **Zero Hardcoded JSX Text:** All UI text must go through `useI18n()`:
  ```tsx
  const { t } = useI18n();
  t("section.key", "Fallback text", { param });
  ```
- **Scan hardcoded strings:** `pnpm --filter @openpims/web i18n:scan`.
- **Nested JSON only:** Keys must be structured as objects (`nav: { item: "..." }`), never root dotted keys (`"nav.item"`).
- **Server Errors:** tRPC routers throw errors in English; client handles translation via `useI18n()`.

---

## 5. Clinical Safety & Compliance Gates (Slovak Law)

- **Human-in-the-Loop (Zákon 39/2007 Z. z.):** AI clinical outputs are advisory and must remain in `draft` status until reviewed and confirmed by a licensed vet (`ClinicalDiffConfirmModal`).
- **Controlled Substances Gate (Zákon 139/1998 Z. z.):** Zero AI prefill for opiates, ketamine, propofol, butorphanol, fentanyl. Must require manual entry.
- **Sympathy Gate:** Deceased/euthanized patients must immediately suppress automated outreach (SMS reminders, review requests). Suppression logged to `ext_automation_suppression_log`.
- **Medical Imaging:** Imaging attachments belong under category `"imaging"` — never overwrite `patient.photoUrl`.

---

## 6. Deployment Flow (Dokploy)

- **Git-driven deploys:** Dokploy pulls from remote `origin/main`. Changes must be committed and pushed before triggering deployment.
- **Trigger deployment webhook:** Run `.agents/skills/deploy/scripts/deploy.ps1` or POST to `$DOKPLOY_DEPLOY_WEBHOOK_URL`.
- **Post-Deploy Smoke Check:**
  ```bash
  curl -s https://vet.dev.significa.sk/api/health
  # Expected: {"ok":true,"checks":{"database":{"ok":true},"schema":{"ok":true}}}
  ```
