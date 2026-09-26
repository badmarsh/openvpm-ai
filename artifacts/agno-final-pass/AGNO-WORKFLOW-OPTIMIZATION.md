# AGNO-WORKFLOW-OPTIMIZATION.md — Agno OS Workflow Optimization (Workstream C)

**Generated:** 2026-09-26
**Agent:** Arena Final Pass Consolidation Agent
**File changed:** `.agents/agno/pipeline_team_os.py` (only file edited in this workstream)
**Verification:** `python3 -m py_compile` PASS; 4/4 logic smoke tests PASS (harness executed the
extracted real code); baseline vitest suites re-run PASS (see end).

---

## Implemented Changes (verified in working tree)

### Change 1 — Team-level run history disabled ✅ APPLIED
**Where:** §13 `openvpm_dev_team = Team(...)` (lines ~1604-1605)

```diff
     store_member_responses=True,
     show_members_responses=True,
-    add_history_to_context=True,
-    num_history_runs=2,  # znizene z 5: menej historickeho sumu, nova uloha ma vzdy prednost
+    add_history_to_context=False,  # Team delegates to members; no run history on team
+    num_history_runs=0,
```

**Rationale:** the team already gets durable context through `enable_session_summaries=True`
+ `add_session_summary_to_context=True` and agentic memory; raw run history on the
coordinator duplicated member transcripts and competed with the new task. The coordinator's
own instruction "POZOR NA HISTORIU: … neopakuj úlohy z predchádzajúcich runov" existed to
fight exactly this pollution — the root cause is now removed instead of instructed around.

**Correction to the draft version of this artifact:** the earlier draft claimed
`arena_dispatcher` had an inconsistent `add_history_to_context=True, num_history_runs=0`.
**False — verified:** the dispatcher was already `add_history_to_context=False,
num_history_runs=0` (stateless) in the base tree. Only a trailing comment was tidied.
Worker agents (`arena_watcher`, `github_manager`, `qwen_implementer`, `prompt_manager`)
keep their history settings (True / 3 / default) — intentional, they are stateful workers.

### Change 2 — Opt-in internal-service-token rotation ✅ APPLIED
**Where:** §0 config (lines ~228-283), invoked in §15 before AgentOS construction.

- New `TOKEN_ROTATION_HOURS` (**default 0 = rotation OFF** — behaviour-preserving; the
  draft proposed default 24 h, deliberately changed: rotating a token invalidates all
  in-flight signed callbacks, so auto-on would violate "minimal, reversible").
- `rotate_internal_service_token_if_expired()`:
  - never rotates an explicit `OPENVPM_INTERNAL_SERVICE_TOKEN` (operator-managed);
  - rotates only tokens the runtime itself generated (token file exists);
  - age source: `internal_service_token_meta.json` (`created_at_epoch`), falling back to
    file mtime;
  - persists the new token (chmod 0600) + meta, **fail-safe skip** on any I/O error;
  - rebinding happens via `global` so the scheduler/approval signer sees the new token.
- Invocation placement matters and is commented in code: AgentOS receives
  `internal_service_token` **once at construction (module import)**, so rotation runs in
  §15 immediately *before* `agent_os = AgentOS(...)` — not in `lifespan`, where it would
  be a no-op for the running OS.

**Smoke-tested (extracted real code):** default-off returns False; opt-in with expired
mtime rotates once and writes meta; second call is a no-op; explicit env token is never
rotated. 4/4 PASS.

### Change 3 — CORS origins overridable via env ✅ APPLIED
**Where:** §15, new `_cors_allowed_origins()`; constructor now
`cors_allowed_origins=_cors_allowed_origins()`.

- **Unset `OPENVPM_CORS_ORIGINS` → byte-identical default list** (localhost/127.0.0.1
  ports 3000-3008, LAN `192.168.0.100`, `https://os.agno.com`,
  `https://agentos-tunnel.significa.sk`). Zero behaviour change for Marek's setup.
- Set → comma-separated list fully replaces defaults; empty/garbled value falls back
  to defaults (fail-safe).
- Removes the need to edit Python to add a deployment origin (e.g. a new tunnel domain).

---

## Evaluated but NOT implemented (with reasons)

### Scheduler `seed_schedules()` idempotency — NO CODE CHANGE
Draft proposed adding an `idempotency_key=` kwarg plus `manager.get(key)` lookups to
`ScheduleManager.create(...)`. **Rejected as unverifiable:** the `agno` package is not
installed in this sandbox, so the 3.0.11 `ScheduleManager` signature could not be
inspected — inventing kwargs risks a boot-time crash of the whole OS. Existing code
already passes `if_exists="update"` on both schedules, which re-seeds by name instead of
duplicating on restart (name-based dedup semantics of `if_exists` in Agno 3.0.11:
**UNVERIFIED — needs check** against the installed agno version). The upgrade path when
verifiable: confirm `if_exists` semantics, then consider a startup log line
`logger.info("Schedules seeded (update-on-conflict)")` — no behavioural change needed.

### Post-shutdown loopback health check in `lifespan` — NO CODE CHANGE
Draft (in TUNNEL-7777-RCA.md) proposed an `aiohttp` self-probe after `yield`.
Rejected: `aiohttp` availability in the WSL venv is UNVERIFIED (new dependency), the
probe would run *after* the server stops accepting requests (post-`yield`), and
`start-agno.bat` step [4/4] plus the scheduler poll already verify loopback health.
Revisit only if a runtime-side (pre-serve) readiness gate is ever required — stdlib
`urllib.request` would be the dependency-free option.

### `pipeline_tools.py` changes — NONE
All 118 tools reviewed at the contract level during the audit; no defect found that
warranted a source edit under the "minimal, reversible" constraint.

---

## Deferred follow-ups (out of scope, no source edits)
- [ ] Verify Agno 3.0.11 `ScheduleManager.if_exists` semantics on a machine with the venv
- [ ] Optional CLI: `python pipeline_team_os.py --rotate-token` (manual rotation path)
- [ ] Structured (JSON) logging for scheduler runs
- [ ] Grace-shutdown drain for in-flight HITL approvals

---

## Verification Commands (all re-run in-session)

```bash
python3 -m py_compile .agents/agno/pipeline_team_os.py   # → OK
pnpm --filter @openpims/web exec vitest run lib/__tests__/admin-panel-pagekit.test.ts
# → 15 passed
pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts
# → 3 passed
git diff --stat -- .agents/agno/pipeline_team_os.py      # single file, reversible hunks
```

**Artifact Status:** ✅ Complete — implemented changes verified in working tree; non-implemented items documented with reasons.
