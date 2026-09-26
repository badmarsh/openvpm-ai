# FINAL-PASS-PROMPT.md — Consolidated Prompt for the Next Orchestration Run

**Generated:** 2026-09-26
**Source artifacts:** SPRINT-AUDIT-30.md · PROMPT-LIBRARY-AUDIT.md · AGNO-WORKFLOW-OPTIMIZATION.md · TUNNEL-7777-RCA.md (all in `artifacts/agno-final-pass/`)
**Everything below was verified in-session; UNVERIFIED items are explicitly tagged.**

---

## Mission

You are the OpenVPM AI orchestration agent. Execute the consolidated state below.
**Repository:** `badmarsh/openvpm-ai`, work branch `arena/01a0df16-openvpm-ai`.
**Frozen:** fiscal/e-Kasa presentation, controlled-substances logic, clinical-safety
logic, `packages/db/schema/*.ts`, `packages/db/drive/meta/_journal.json` (drizzle journal),
statutory print surfaces. **Zero new ESLint warnings.** All i18n in both trees
(en.json + sk.json, 100 % leaf symmetry).

---

## 1. Sprint State (authoritative snapshot 2026-09-26)

| State | Count | Sprints |
|---|---|---|
| Merged (per SPRINT-INDEX.md; per-sprint git check pending) | 16 | 1–14, 16, 17 |
| Dispatched to Arena, no PR yet | 8 | 15, 18, 19, 20, 21, 22, 23, 25 |
| Written, not dispatched | 6 | 24, 26, 27, 28, 29, 30 |

Rules for the next run:
1. **Before dispatching anything**, re-check state: `git log` (highest authority) →
   `tasks/SPRINT-INDEX.md` → seeded entity memory (team instruction order, keep).
2. **Dispatch only canonical files** `tasks/arena-sprint-N-*.md`. Never dispatch
   `arena-<epoch>-*` timestamped duplicates or the abandoned `arena-1790325424-*`
   numbering batch (different content than canonical 24–30).
3. **Collision watch:** sprints 21+20 both touch `/settings`; 22+25 share SOAP/encounter
   components; 18+25 share client context. Sequence rather than parallelize overlapping
   pairs, or isolate in worktrees.
4. **Priority queue after in-flight sprints land:** sprints 24, 26–30 (written), then
   Golden Tickets: gt-003 (OPL prescription wrapper, P0 — Zákon 139/1998), gt-001
   (AI provenance ledger for SOAP finalization), gt-002 (booking untrusted text →
   prompt injection), gt-008 (imaging timeout/hygiene).

## 2. Source-Contract Traps (never break)

| Literal | Where | Pinned by |
|---|---|---|
| `http://127.0.0.1:7777` | `apps/web/app/(dashboard)/admin/ai-swarm/page.tsx` fallback | `admin-panel-pagekit.test.ts` (15 tests) |
| `bindPort: 7777`, `uiPort: 3007` | `apps/web/server/routers/extensions/ai-swarm.ts` | literal returns |
| `admin.aiSwarm.*` strings (port label, connection info, offline notice) | i18n en/sk trees | same test file |
| `0.0.0.0` = BIND only | `pipeline_team_os.py` `serve(host=…)` | CLOUDFLARE_TUNNEL.md contract |
| `http://127.0.0.1:7777` = DIAL | cloudflared ingress `service:`, `OPENVPM_AGENTOS_INTERNAL_URL` | same |

Baseline that must stay green:
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/admin-panel-pagekit.test.ts  # 15 pass
pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts       # 3 pass
```

## 3. Agno Runtime — What Changed This Pass (already applied)

`.agents/agno/pipeline_team_os.py`, three minimal reversible hunks:
1. **Team run history off** (`add_history_to_context=False, num_history_runs=0`) —
   session summaries + agentic memory carry context; coordinator no longer re-reads
   raw member transcripts. Workers unchanged (dispatcher was already stateless).
2. **Opt-in token rotation** — `OPENVPM_TOKEN_ROTATION_HOURS > 0` enables TTL-based
   rotation of the auto-generated internal service token at startup, *before* AgentOS
   construction. Default OFF (rotation invalidates in-flight signed callbacks).
   Explicit env token is never rotated. Fail-safe on I/O errors.
3. **CORS env override** — `OPENVPM_CORS_ORIGINS` (comma-separated) replaces the
   default origin list; unset → byte-identical defaults.

Not changed on purpose: `seed_schedules()` keeps `if_exists="update"` (Agno
`ScheduleManager` semantics **UNVERIFIED — needs check** before any kwarg changes);
`pipeline_tools.py` untouched.

## 4. Tunnel :7777 — Standing Diagnosis

Tunnel "healthy" + public 502 ⇒ ingress `service:` dials `0.0.0.0:7777` instead of
`http://127.0.0.1:7777`. Fix lives in **tunnel config** (Zero Trust dashboard Service
field, or local YAML `service:`), never in `serve(host=…)`. Split test:
`loopback 200 + tunnel 502` = wrong dial target. Full ladder: TUNNEL-7777-RCA.md.

## 5. Prompt Library Hygiene (execute in next housekeeping run)

1. Create `tasks/archive/`; move there: 12 `arena-<epoch>-*` files, 6 legacy prompts
   (`arena-consolidation-sprint`, `arena-next-sprint`, `ui-consolidation-prompt`,
   `ui-phase2-headings`, `command-palette-ranking-plan`, `deer-flow-test-runner-prompt`),
   6 `arena-response-*` artifacts, 3 legacy `SprintNN.md`, `pr_sprint10.md` +
   `openvpm-sprint5-prescriptions-pr/`.
2. Update SPRINT-INDEX.md only after `git log` confirms each merge (index PR numbers
   not independently verified — shallow clone).
3. Sprint stubs 20–30 (1.8–2.1 KB) must be expanded to the full writer-prompt format
   (DO-NOT-TOUCH lists, verification commands, i18n plan, source-contract traps) before
   their dispatch turn.

## 6. Non-negotiable Compliance (unchanged)

- Zákon 39/2007 Z. z. — HITL: AI clinical output stays draft until veterinarian
  authorization (`ApprovalType.required` gates: git push, PR merge, deploy).
- Zákon 139/1998 Z. z. (OPL) — manual signature only; automation records audit trail
  (`opl_prescription_signoff`, `ApprovalType.audit`).
- Sympathy gate — death/euthanasia suppresses automated communication.
- Vanilla schemas immutable; extensions via `ext_*` + extensionsRouter only.

---

**Artifact Status:** ✅ Complete — consolidated from the four verified artifacts.
