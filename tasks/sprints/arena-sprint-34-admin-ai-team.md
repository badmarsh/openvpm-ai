---
id: 34
kind: sprint
title: "AI team: replace /admin/ai-swarm with the practice's model & endpoint roster"
state: open
priority: P1
targets:
  - apps/web/app/(dashboard)/admin/ai-team/page.tsx
  - apps/web/app/(dashboard)/admin/ai-swarm/page.tsx
  - apps/web/app/(dashboard)/admin/page.tsx
  - apps/web/lib/ai/ai-team.ts
  - apps/web/server/routers/extensions/ai-team.ts
  - apps/web/server/routers/extensions/ai-swarm.ts
  - apps/web/server/routers/extensions/index.ts
  - apps/web/config/custom-nav.ts
  - apps/web/messages/en.json
  - apps/web/messages/sk.json
  - apps/web/lib/__tests__/admin-panel-pagekit.test.ts
  - .agents/agno/DEPRECATED.md
creates:
  - apps/web/app/(dashboard)/admin/ai-team/page.tsx
  - apps/web/lib/ai/ai-team.ts
  - apps/web/server/routers/extensions/ai-team.ts
contract_test: apps/web/lib/__tests__/ai-team-pagekit.test.ts
premises:
  - "lines: apps/web/app/(dashboard)/admin/ai-swarm/page.tsx | 1000..1200"
  - "contains: apps/web/server/routers/extensions/ai-swarm.ts | const STATIC_FLEET: SwarmAgentInfo[] = ["
  - "contains: apps/web/server/routers/extensions/ai-swarm.ts | resolveApproval: protectedProcedure"
  - "contains: apps/web/config/custom-nav.ts | href: \"/admin/ai-swarm\","
  - "contains: apps/web/app/(dashboard)/admin/page.tsx | trpc.extensions.aiSwarm.getStatus.useQuery"
  - "contains: apps/web/lib/ai/ai-config-resolver.ts | export async function resolveFeatureConfig("
  - "contains: apps/web/lib/ai/ai-presets.ts | export const DEFAULT_PRACTICE_FEATURE_MAPPINGS"
  - "missing: apps/web/app/(dashboard)/admin/ai-team/page.tsx"
note: "owner decision 2026-09-27: rename to AI team (multiple models and endpoints); removes Agno UI"
---

# Sprint 34: AI team, replacing `/admin/ai-swarm` with the practice's model and endpoint roster

**Why now:** the Agno dev swarm is deprecated. The owner decided on 2026-09-27 to keep the page but make it the **AI team**, because the practice runs several models across several endpoints. Today the page (1,108 lines) shows a hard-coded roster of *developer* agents ("Qwen Implementer", "Arena Dispatcher", …), pings AgentOS on `:7777`, reads `arena_sessions.json` from the server's filesystem, and copies `python .agents/agno/pipeline_team_os.py` to the clipboard. None of it describes the clinic's actual AI.
**Also a security fix:** every `aiSwarm` procedure is a plain `protectedProcedure`, so **any logged-in role**, including front desk, can call `getStatus`, which reads repo files and probes internal hosts, and the mutation `resolveApproval`, which POSTs to the AgentOS approvals endpoint. Deleting the router closes this.
**Rules:** [`tasks/RULES.md`](../RULES.md).

## 1. Current state (measured 2026-09-27)

- `app/(dashboard)/admin/ai-swarm/page.tsx`: 1,108 lines. It has the tabs `fleet · sessions · approvals · agent-ui · guardrails`, the header `t("admin.aiSwarm.title", "AI Swarm & AgentOS Centrála")` with the badge `SWARM`, and queries `aiSwarm.getStatus`, `getApprovals` and `resolveApproval`.
- `server/routers/extensions/ai-swarm.ts`: 462 lines, with `STATIC_FLEET`, `STATIC_TEAMS`, `STATIC_WORKFLOWS`, `checkAgentOsHealth` and `loadArenaSessions(repoRoot)`. It's registered as `aiSwarm: aiSwarmRouter` in `extensions/index.ts` (L34, L76, L112).
- `app/(dashboard)/admin/page.tsx` ≈L239 uses `trpc.extensions.aiSwarm.getStatus.useQuery` for a "system health" card (fleet, sessions, last deploy) and ≈L406 links to `href="/admin/ai-swarm"` ("Open AI Swarm hub").
- `config/custom-nav.ts` ≈L121: `{ href: "/admin/ai-swarm", label: "AI Swarm & AgentOS", i18nKey: "nav.aiSwarm", roles: ["admin"], badge: "SWARM" }`.
- The real AI configuration lives in these places:
  - `lib/ai/ai-config-resolver.ts`: `AiFeatureKey` has 9 features (`assistant, imagingRtg, voiceSoap, labParser, imageGeneration, videoGeneration, marketingCopy, deepThinking, invoiceParser`). `resolveFeatureConfig(db, practiceId, feature)` returns `{provider, modelId, baseUrl?, apiKey?, temperature?, maxTokens?, …}`, falling back to system defaults.
  - `ext_ai_settings`: per-provider `*IsActive`, `*BaseUrl`, `*LastTestedAt`, `*LastStatus`, `*LastStatusMessage`, plus `featureMappings`.
  - `lib/ai/ai-presets.ts`: `DEFAULT_PRACTICE_FEATURE_MAPPINGS`.
- `lib/__tests__/admin-panel-pagekit.test.ts` pins the old page, e.g. `t("admin.aiSwarm.badge", "SWARM")`, `admin.aiSwarm.table.status_${status}` and `href="/admin/ai-swarm"`. It must be rewritten for the new page, not deleted.

## 2. Change

**2A. Pure builder** `lib/ai/ai-team.ts`: `buildAiTeamRoster({ config, resolved })`.
- Input: `config` is the `ext_ai_settings` row or null; `resolved` is `Record<AiFeatureKey, ResolvedModelConfig>`.
- Output: `{ members, providers }`.
  - `members`: one entry per feature, `{ key, provider, modelId, endpointHost, source: "practice" | "default", health: "ok" | "error" | "untested", lastTestedAt }`. `endpointHost` is the hostname of `baseUrl`, or the provider's public default. `source` is `"practice"` when a practice mapping exists and isn't `default`. Health comes from `<provider>LastStatus`.
  - `providers`: `openai | gemini | alibaba`, each with `{ active, endpointHost, health, lastStatusMessage }`.
- **Never copy `apiKey`** and never return a full URL with credentials or a query string.

**2B. Router** `server/routers/extensions/ai-team.ts`: `aiTeamRouter` with `getRoster: protectedProcedure.use(requireRole("admin"))`. It calls `getPracticeAiConfig` plus `resolveFeatureConfig` for each feature, then `buildAiTeamRoster`. Register it as `aiTeam` in `extensions/index.ts`. **Delete** `ai-swarm.ts` and its registrations.

**2C. Page** `app/(dashboard)/admin/ai-team/page.tsx`, following page-kit and UIKIT:
- `PageHeader` with `t("admin.aiTeam.title", "AI team")` / sk "AI tím" and a subtitle.
- `KpiGrid`: features on a practice mapping vs on defaults, providers online, and the last connection test.
- A `DataTableFrame` table with columns feature (`admin.aiTeam.feature.<key>`), model, provider, endpoint (host only), source badge, and health.
- A provider panel.
- The **Guardrails** section moves over from the old page (human-in-the-loop, controlled substances, sympathy gate, AI audit ledger link) as static info.
- A link to `/settings/ai` for changes. The page is read-only and has no editing.

**2D. Redirect:** `admin/ai-swarm/page.tsx` becomes a ≤ 20-line server component that runs `redirect("/admin/ai-team")`.

**2E. Admin overview** `admin/page.tsx`: replace the swarm health card with an "AI team" card (member count, providers online, any `error` health), link to `href="/admin/ai-team"`, and remove every `aiSwarm` reference.

**2F. Nav:** `{ href: "/admin/ai-team", label: "AI tím", i18nKey: "nav.aiTeam", icon: Bot, roles: ["admin"], section: "admin" }`, with no badge.

**2G. i18n** (en + sk, nested): add `nav.aiTeam` and `admin.aiTeam.*` (title, subtitle, kpi.*, table.{feature, model, provider, endpoint, source, health}, `source_practice`, `source_default`, `health_ok`, `health_error`, `health_untested`, `feature.<9 keys>`, `guardrails.*`, `openSettings`). **Remove** `admin.aiSwarm.*`, `nav.aiSwarm`, and the swarm-only `admin.systemHealth.*` strings that go unused.

**2H. Tests and docs:**
- Rewrite `admin-panel-pagekit.test.ts` so it pins `/admin` against the new card and link, and drop the swarm-specific cases (the new contract covers the page).
- Add a router test: a `front_desk` user gets `FORBIDDEN`, and the payload has no `apiKey`.
- In `.agents/agno/DEPRECATED.md`, mark the admin-page row resolved (Sprint 34).

Presentation-only? No: this removes a router and changes access control. Clinical logic is untouched.

## 3. Frozen (DO NOT TOUCH)

- `server/routers/extensions/ai-settings.ts`, the `/settings/ai` page, `lib/ai/ai-crypto.ts`, and `resolveFeatureConfig` / `resolvePracticeLanguageModel` behaviour. The page reads them and never writes.
- Everything else on `admin/page.tsx`: the hosted SMS diagnostics, messaging queue and platform-admin panels, plus their pinned literals in `admin-panel-pagekit.test.ts` (keep every non-swarm assertion).
- `.agents/agno/` code. Deleting it is a separate PR (see DEPRECATED.md).

## 4. Contract

`apps/web/lib/__tests__/ai-team-pagekit.test.ts` has 7 armed cases. Also required to pass:

```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/ai-team-pagekit.test.ts lib/__tests__/admin-panel-pagekit.test.ts lib/__tests__/i18n-structure.test.ts lib/__tests__/heavy-client-imports.test.ts
pnpm --filter @openpims/web type-check && pnpm --filter @openpims/web lint && pnpm --filter @openpims/web i18n:scan
```

## 5. Follow-ups (report only)

- `CLOUDFLARE_TUNNEL.md` and the `AGENT_OS_URL` / `AGENT_UI_URL` env vars become unused. Archive the runbook and drop them from `.env.example` in the Agno-removal PR.
- An "AI team" member could also show a 30-day usage count (`recordUsage`) and ledger events per feature. Do this after GT-012 makes feature mapping authoritative everywhere.
- GT-012 (feature mapping must be honoured by every AI call): this page will make any non-honouring feature visible. Link the two.
