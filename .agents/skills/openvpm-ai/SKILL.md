---
name: openvpm-ai
description: Architectural guidelines, zero-conflict upstream sync, strict i18n rules, and Slovak veterinary compliance for OpenVPM AI.
---

# OpenVPM AI — Architecture & Development Guidelines

This skill enforces core architectural guardrails, zero-conflict upstream synchronization, multilingual compatibility, and veterinary clinical safety gates for OpenVPM AI.

Detailed clinical, fiscal, and AI standards are in [references/domain.md](references/domain.md).

---

## 1. Environments

- **Primary Workspace (Local Dev):** `http://localhost:3001`, Docker `openvpm-postgres-1` (port 5434), DB `openvpm_ai`. Local SQL: `docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai`. Never use `-d openpims` locally.
- **Reference Project (Vanilla Upstream):** `../OpenVPM` (`http://localhost:3005`). Inspect vanilla workflows before building custom extensions.
- **Staging / Remote:** Read-only for agents. Server details and credentials reside in `AGENTS.local.md`.

---

## 2. Zero-Conflict Upstream Sync

- **Vanilla Schema Immutability:** Never modify upstream schema files in `packages/db/schema/*.ts`.
- **Extension Schemas:** All new tables/enums live in `packages/db/schema/ext_{name}.ts` and are re-exported in `packages/db/schema/index.ts`.
- **Migration Discipline:**
  - Every schema change MUST ship with its generated migration: run `pnpm db:generate` and commit `NNNN_*.sql`, snapshot, and journal together.
  - Never hand-edit `packages/db/drizzle/*`.
  - `pnpm db:push` is for local rapid prototyping only.
- **tRPC Extension Mount:** Extension routers live in `apps/web/server/routers/extensions/` and mount strictly under `extensions: extensionsRouter` in `_app.ts`.
- **Custom Navigation:** Add sidebar items to `apps/web/config/custom-nav.ts`; do not hardcode links in `sidebar.tsx`.
- **Generic Upstream Backports:** Write changes in vanilla files generically so they can be cherry-picked upstream (`evangauer/openvpm`). Keep Slovak and AI logic in `ext_*` schemas or `extensions/` routers.

---

## 3. Strict Multilingual Compatibility (i18n)

- **100% Key Symmetry:** `apps/web/messages/en.json` and `sk.json` must have identical nested JSON keys (over 9,500 keys).
- **No Route Rewriting:** Do NOT add `app/[locale]/...` URL prefixes. URLs remain canonical (`/schedule`, `/billing`, `/patients`).
- **Zero Hardcoded JSX Text:** All natural language UI text must go through `useI18n()`:
  ```tsx
  const { t } = useI18n();
  t("section.key", "Fallback text", { param });
  ```
- **Independent Translation Quality:** Write EN and SK independently with natural veterinary terminology. Slovak terms: "Kniha ošetrení", "ochranná lehota", "očkovací preukaz".
- **Server Errors:** tRPC routers throw English errors; client handles translation.

---

## 4. Clinical Safety & Slovak Veterinary Law

- **Human-in-the-Loop (Zákon 39/2007 Z. z. §3):** AI drafts stay in `draft` status until confirmed by a licensed vet via `ClinicalDiffConfirmModal`.
- **Controlled Substances (Zákon 139/1998 Z. z.):** Zero AI prefill for opiates, ketamine, propofol, butorphanol, fentanyl. Must require manual entry.
- **Sympathy Gate:** Deceased or euthanized patients immediately suppress automated reminders and marketing outreach. Logged to `ext_automation_suppression_log`.
- **Medical Imaging:** Attachments use category `"imaging"` — never overwrite `patient.photoUrl`.

---

## 5. Next.js 15 & React 19 Runtime Rules

- `optimizePackageImports` in `next.config.js` is production-only (causes dev HMR crashes).
- Service workers never register on `localhost`.
- Theme-dependent rendering must use a `mounted` state guard to prevent hydration mismatch.
- All `<table>` elements must be wrapped in `<div className="overflow-x-auto">` or `<TableScroll>`.
