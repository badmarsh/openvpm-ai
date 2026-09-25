# Arena Final Pass — Agno OS Audit, Tunnel Repair & Prompt Consolidation

> **How to use:** paste this whole file into an Arena Agent session opened on `badmarsh/openvpm-ai`. Add one line at the end, e.g. *"Run the final pass."* The agent executes four workstreams in order (A → B → C → D), writes five artifacts, makes the minimal code changes required by Workstream C and D, and stops. It does **not** start new feature sprints.

---

## 0. Mission for Arena Agent

You are the **final-pass consolidation agent** for OpenVPM AI — a production veterinary PIMS (Next.js 14 App Router, tRPC, Drizzle/PostgreSQL, pnpm monorepo, Slovak statutory compliance, SK/EN i18n). The autonomous development loop has run many sprints; the orchestration layer that drove them (`Agno` + `AgentOS`) has drifted from reality and its remote access is broken.

You must complete **four workstreams, in this order**, and produce **five artifacts**:

| # | Workstream | Output |
|---|---|---|
| A | Audit the last ~30 sprints: what was written vs dispatched vs implemented vs actually merged | `artifacts/agno-final-pass/SPRINT-AUDIT-30.md` |
| B | Audit the previous ~30 prompt files: what still earns its place, what contradicts the codebase | `artifacts/agno-final-pass/PROMPT-LIBRARY-AUDIT.md` |
| C | Optimize / tune the Agno OS orchestration workflow (stale memory, history leakage, scheduler, token lifecycle) | `artifacts/agno-final-pass/AGNO-WORKFLOW-OPTIMIZATION.md` + code |
| D | Repair the AgentOS `:7777` / Cloudflare tunnel connection (regression — it worked before) | `artifacts/agno-final-pass/TUNNEL-7777-RCA.md` + code |
| E | Distil the above into one consolidated **final-pass prompt** for the next orchestration run | `artifacts/agno-final-pass/FINAL-PASS-PROMPT.md` |

**State note — already done for you on this branch, verify but do not redo:**
- `tasks/` has been **restored** (118 files) from commit `e9627504`, i.e. the version *before* the `497e8ff` stub overwrite. It includes the 30 sprint prompts, the four Agno platform prompts, the legacy consolidation prompts, `SPRINT-INDEX.md`, and 17 Golden Tickets (`tasks/proposed/gt-001…gt-017`).
- A `.gitignore` contract now covers the runtime churn (`tasks/run-*.json`, `tasks/*.patch`, `tasks/repair-*.md`, `arena_sessions.json`) while keeping the prompt library versioned.
- Read §5.1 and **§5.1a** before workstream C — §5.1a records which recovered Agno work is already implemented versus still open. Re-proposing finished work wastes the run.

**Scope discipline:**
- This is an **infrastructure + orchestration audit**, not a UI sprint. There is **no UI scope**: do not restyle pages, do not touch `page-kit`, do not add i18n keys unless Workstream D forces a user-visible string change (see §2 trap list).
- Money, fiscal (e-Kasa), controlled-substance and clinical-safety logic are **frozen**. Do not change amounts, statuses, mutations or routers.
- Zero **new** ESLint warnings (the baseline already contains pre-existing warnings — reduce or hold, never add).
- Every claim in every artifact must be **verified in this session** by reading a file or running a command. Unverified ⇒ write `UNVERIFIED — needs check` instead of asserting. Wrong counts and invented APIs destroy the value of this whole exercise.
- Workstreams C and D are the only places you may edit source. Keep those edits **minimal, reversible and separately committed**.

**Independence:** do not touch anything under `packages/db/schema/*.ts` (vanilla upstream schema), `packages/db/drizzle/meta/_journal.json`, statutory print surfaces, or the fiscal/e-Kasa presentation layer.

---

## 1. Preflight (run before anything else)

```bash
git status --short
git branch --show-current                      # must be arena/<session-id>-openvpm-ai
git log --oneline -60
node -v && pnpm -v

# This checkout may be SHALLOW (a single-commit clone). Workstream A needs real
# history, so deepen it first — otherwise `git log` will silently under-report merges.
git rev-parse --is-shallow-repository
git fetch --deepen=12 origin main

# Confirm the restored ground truth is present before you trust any sprint status.
find tasks -type f | wc -l                     # → 118
head -8 tasks/SPRINT-INDEX.md                  # → real table, not the "30/30" stub
```

Reading list — read these **before** writing a single line of any artifact:

| Path | Why |
|---|---|
| `.agents/agno/pipeline_team_os.py` (1518 lines) | The AgentOS runtime, agents, team, scheduler, CORS, serve() call |
| `.agents/agno/pipeline_tools.py` (3641 lines, ~118 tools) | What the swarm can actually do |
| `.agents/agno/arena-dispatcher.ts` (324 lines) | Browser automation protocol (CDP 9222 → Arena.ai) |
| `CLOUDFLARE_TUNNEL.md` | The tunnel contract — read the `0.0.0.0` line carefully |
| `start-agno.bat` | How the runtime is actually launched (WSL tmux, not the repo) |
| `apps/web/server/routers/extensions/ai-swarm.ts` | How the web app probes AgentOS health |
| `apps/web/app/(dashboard)/admin/ai-swarm/page.tsx` | The operator-facing surface and its pinned fallback URL |
| `AGENTS.md`, `CLAUDE.md` | Repo agent conventions |
| `prompts/arena-sprint-writer-prompt.md` | The meta-prompt that generated the sprint backlog |

Baseline test run **before** any edit, so you can prove you broke nothing:

```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/admin-panel-pagekit.test.ts
pnpm --filter @openpims/web exec vitest run lib/__tests__/i18n-structure.test.ts
```

Record both results verbatim in every artifact's preflight section.

---

## 2. DO NOT TOUCH / Already Completed

### 2.1 Repo-wide non-negotiables

- `packages/db/schema/*.ts`, `packages/db/drizzle/meta/_journal.json` — extensions only via `packages/db/schema/ext_*.ts`.
- `ClinicalDiffConfirmModal`, controlled-substance zero-prefill, sympathy-gate suppression — never modify.
- Fiscal/e-Kasa, statutory print surfaces, money logic — presentation-only, frozen.
- 100 % i18n: every UI string via `useI18n()`; `apps/web/messages/en.json` and `sk.json` must stay **leaf-symmetric** (guard: `lib/__tests__/i18n-structure.test.ts`).
- Nested JSON only — no flat dot-keys.

### 2.2 Source-contract traps (tests read page source with `readFileSync` and assert literals)

These are the traps that silently break a "harmless" cleanup. Copy them into your artifacts' constraints section and keep them green:

- `apps/web/lib/__tests__/admin-panel-pagekit.test.ts` asserts the AI-swarm page **contains the literal** `http://127.0.0.1:7777` (page fallback is at `page.tsx:74`). A Workstream-D "fix" that rewrites this fallback **will fail this test**. If you must change it, change the test in the same commit and justify why in the artifact.
- `apps/web/messages/en.json` / `sk.json` keys under `admin.aiSwarm.*` (≈ lines 416–462) pin the strings `FastAPI port 7777`, `Local Next.js port: 3007 → AgentOS REST: http://localhost:7777` and the offline notice *"AgentOS is not running on port 7777…"*. Leaf symmetry is enforced.
- `ai-swarm.ts` returns `bindPort: 7777` and `uiPort: 3007` as literals — telemetry consumers may rely on them.

### 2.3 Out of scope — report only

Anything you find that is not Workstream C/D infrastructure: record it as a `FOLLOW-UP` line in the relevant artifact. Do not fix it.

---

## 3. Workstream A — Audit the last ~30 sprints

**Goal:** an evidence-based table that replaces guesswork. The orchestration layer's memory of "what is merged" is provably out of date (see §5.1), so this artifact becomes the new source of truth.

### 3.1 Build the authoritative sprint list

Gather from all of these, then reconcile:

```bash
git log --oneline -200 | grep -iE "sprint|feat\(|fix\(" 
gh pr list --state all --limit 60 --json number,title,state,mergedAt,headRefName --jq 'sort_by(.number)'
```

Also inspect the runtime's own list: the `list_arena_sprints` tool in `.agents/agno/pipeline_tools.py`, and the seeded entity memory in `.agents/agno/pipeline_team_os.py` (`seed_sprint_entities()`).

Cross-check against `tasks/SPRINT-INDEX.md` — **restored on this branch** from `e9627504`, i.e. the real 20-row table, not the 5-line *"30/30 merged"* stub that replaced it at `497e8ff`. Treat it as the best *written* record of dispatch state, **not** as merge evidence: it is dated 2026-09-25 and already lags reality (it still shows sprint 15 as *"dispatched — no PR yet"* although `/agent/imaging` and `components/imaging/dicom-viewer.tsx` now exist). Reconcile every row against git per §3.2. Recovery recipe: §5.1.

**Also reconcile against the tool that was supposed to track this:** `list_arena_sprints()` in `.agents/agno/pipeline_tools.py` reads that same file, and while `tasks/` was deleted it returned only the string *"Chyba: Súbor tasks/SPRINT-INDEX.md nebol nájdený."* It works again now that the folder is restored — but the failure was **silent**, so audit the toolchain's error handling as part of Workstream C (§5.1), not here.

**Note on scope:** for several sprints (notably 15 and 24–30) the index lags reality — the work landed later than the table records. Classify from git, never from the table. Where the table and git disagree, git wins and the discrepancy itself is a finding (it means the index was not maintained after dispatch).

### 3.2 Classify each sprint with a hard status

For **every** sprint in the last ~30, output exactly one status, and attach the evidence:

| Status | Evidence required (no exceptions) |
|---|---|
| `MERGED` | The sprint's target files actually changed in a commit reachable from `main`, or a merged PR exists. Cite SHA + PR. |
| `IMPLEMENTED-UNMERGED` | A branch/PR exists with the change but `main` does not contain it. Cite branch + PR state. |
| `DISPATCHED-NO-CODE` | An Arena session/prompt exists (see Workstream B) but no diff exists anywhere. |
| `WRITTEN-NOT-DISPATCHED` | Prompt/sprint file exists, never dispatched. |
| `ABANDONED` | Started, superseded or reverted. Cite the revert SHA. |

**A sprint is merged only if its target files moved in a commit.** A sprint `.md` existing is not evidence. This is the single most important rule of Workstream A.

### 3.3 Per-sprint row

`# · Title · Module/route · Status · Evidence (SHA/PR) · Files touched · Verification result (pkg commands green?) · Regressions introduced · Still-open follow-ups`

### 3.4 Aggregate metrics (put them in a summary table at the top)

- Sprints per status.
- **Merge ratio** = merged / dispatched.
- **Rework rate** — sprints whose files were touched again by a later "fix" commit within 72 h.
- **Recurring failure classes** — group the audit into themes (e.g. "UI-kit harmonization repeatedly breaks source-contract tests", "dispatch without lock → conflicting branches", "prompt size exceeds agent budget"). Name each with 2+ concrete instances.
- **Conflict clusters** — files touched by 3+ separate sprints (these are your parallelisation hazards).

Then state, in ≤ 10 lines, **what the orchestration layer got wrong** — specifically where its memory of sprint state diverged from git. That conclusion feeds Workstream C.

---

## 4. Workstream B — Audit the previous ~30 prompts

### 4.1 Inventory

**The `tasks/` prompt library is restored on this branch** (118 files) — read it here, no history recovery needed. It contains the sprint prompts (sprints 1–30), the four Agno platform prompts, legacy consolidation prompts, and **17 Golden Tickets** under `tasks/proposed/gt-001…gt-017`.

```bash
ls -1 artifacts/audit-prompts/ .agents/prompts/ prompts/ tasks/ 2>/dev/null
wc -l artifacts/audit-prompts/*.md .agents/prompts/*.md prompts/*.md tasks/*.md tasks/proposed/*.md
```

Read **all** of them. These are the previous generation of operator prompts (`arena-megaprompt-*`, `arena-mission-*`, `dokploy-audit`, `arena-24h-audit`, `ai-audit-prompt`, `bug-and-implementation-audit-prompt`, the `*-consolidation*` family, `docs-update-prompt-*`, `i18n-translation-audit-prompt`, and the flagship `prompts/arena-sprint-writer-prompt.md`).

### 4.2 Score each prompt against reality

For each file, produce one row:

`File · Lines · Purpose · Still accurate? (Y/N/PARTIAL) · Stale claims (quote + counter-evidence) · Overlapping with which other prompt · Duplicate instructions · Contradictions with AGENTS.md / UIKIT.md / git state · Verdict`

**Verdict vocabulary — use only these four:**
- `KEEP` — accurate and uniquely useful.
- `MERGE` — useful but overlaps; name the surviving file.
- `REWRITE` — right intent, stale facts (list every stale fact).
- `ARCHIVE` — superseded; name the superseding file.

### 4.3 Hunt for the failure modes that waste agent runs

Extract and quantify, with quotes and file:line references:

1. **Stale snapshot claims** — prompts asserting "Sprint N is not implemented" when git says otherwise. This is the #1 generator of duplicated work.
2. **Contradictions between prompts** — two files prescribing different branch names, different verification commands, different conventions.
3. **Unverifiable instructions** — commands that cannot run in the agent's environment (Windows PowerShell paths, `C:\Users\marek\…`, `Desktop Commander`, `-LiteralPath` guidance) inside prompts now executed on Linux/WSL.
4. **Missing guardrails** — prompts that do not carry the source-contract trap list, so a restyle silently breaks pinned tests.
5. **Length/attention budget** — prompts so long the actionable core is buried; note the point where the instruction count exceeds what a run can honour.
6. **Duplicated non-negotiables** — the same DO-NOT-TOUCH block repeated in 5+ files with 5 slightly different wordings (drift risk: which one is true?).

### 4.4 Output

A single consolidated recommendation table, plus one paragraph titled **"What the prompt library should look like going forward"** — a proposed minimal set (target ≤ 4 living files), the role of each, and which existing files they replace.

### 4.5 The `tasks/` prompt family — a special case

The `tasks/` prompts are the largest single body of previous prompts and the one with the most structural lessons. Treat them as a cohort, not as ~50 independent files. Read at minimum: sprints 1, 5, 10, 15, 20, 25, 30; all four `arena-sprint-agno-*.md` / `arena-sprint-prompt-engineering-audit.md`; and a sample of `tasks/proposed/gt-0xx-*.md`.

1. **Measure the shape drift** — line counts, and whether each carries a DO NOT TOUCH section, a verification-command block, and a source-contract trap list. Table it by sprint number so the trend is visible. (Note the striking size spread: sprint 21 is ~1.8 KB while sprint 9 is ~22 KB — evidence of format drift over time.)
2. **Compare against their own generator** (`prompts/arena-sprint-writer-prompt.md`, ~12.8 KB, which mandates a 10-section structure) — where did the emitted prompts drift from the template, and does the drift correlate with sprints that came back needing repair?
3. **Score the four Agno prompts as their own group** — they are the direct ancestors of this final pass, and §5.1a already establishes that one was implemented and three were not. The most valuable question you can answer here is *why a written Agno prompt was never executed*: was it never dispatched, or dispatched and lost?
4. **Note the redundancy cost** — `tasks/sprint10/openvpm-ai/apps/web/…` was a committed duplicate snapshot of app source (2535 of the 2656 files in that commit). State plainly that sprint working directories must never be committed, and connect it to the `.gitignore` contract now in place (§5.1).
5. **Recommend the fate of the cohort** — which prompts are worth keeping as versioned ground truth, which are pure history, and whether the survivor set belongs in `artifacts/` rather than `tasks/`. Note that `pipeline_tools.py` reads `tasks/` by literal path, so moving the library has a code cost — quantify it.

---

## 5. Workstream C — Analyze & optimise the Agno OS workflow

Read `.agents/agno/pipeline_team_os.py` end to end, then verify each hypothesis below **in code** and confirm or refute it. Do not assume — this repo has already been burned by prompts that assert unverified facts.

### 5.1 The disarmed sprint tooling — restored, but the contract is still your job (HIGHEST SEVERITY — verify first)

**Pre-verified in this session. Reproduce it, then finish the job.**

The directory the entire sprint toolchain reads from was **deleted from `main`** and has since been **restored on this branch** (see the recovery block below). The forensic history matters, because it explains why the orchestrator's state is unreliable:

| Commit | Effect |
|---|---|
| `497e8ff` *"Archive tasks folder and update SPRINT-INDEX.md"* | Added `tasks-ARCHIVED-20260925.tgz` — **29 bytes**, an empty/broken archive that restores nothing. Same commit overwrote `tasks/SPRINT-INDEX.md` (**+6/−36**), replacing the real 20-row status table with a 5-line stub claiming *"30/30 sprints implemented, 30/30 merged into main"*. |
| `dab4d05` *"remove task artifacts accidentally committed to main"* | Deleted **300 files**: the tarball, every `tasks/arena-sprint-*.md` (1–30), `SPRINT-INDEX.md`, both `.patch` files (2553 + 2247 lines), and a committed duplicate snapshot of app source under `tasks/sprint10/openvpm-ai/apps/web/…` (incl. a 5409-line `encounters/[appointmentId]/page.tsx`). |
| **This branch** | `tasks/` restored (**118 files, 1.4 MB**) from `e9627504` — *before* the stub overwrite — minus the junk snapshot and binaries. A `.gitignore` contract added: the prompt library stays versioned, runtime churn is ignored. |

Confirm the restoration:

```bash
find tasks -type f | wc -l                                   # → 118
head -8 tasks/SPRINT-INDEX.md                                # → the real table, not the "30/30" stub
git check-ignore --no-index -v tasks/run-*.json tasks/*.patch  # → ignored (runtime)
git check-ignore --no-index -v tasks/*.md                      # → NOT ignored (ground truth)
```

**Why this mattered — `.agents/agno/pipeline_tools.py` is built on `tasks/`.** While the folder was missing, these returned error strings instead of data; now they work again, but **nothing in the code prevents the same silent failure**:

| Tool (~line) | Behaviour while `tasks/` was deleted |
|---|---|
| `list_arena_sprints()` (~312–321) | Returned the literal **"Chyba: Súbor tasks/SPRINT-INDEX.md nebol nájdený."** |
| `read_sprint_assignment()` (~324) | Globs `tasks/arena-sprint-<N>-*.md` → **"Sprint N nebol nájdený v tasks/."** |
| `format_arena_sprint_prompt()` (~343) | Delegated to the above — no prompt could be formatted. |
| `list_active_arena_sessions()` (~381) | Reads `tasks/` + `arena_sessions.json` — **the latter still does not exist anywhere**. |
| `create_and_dispatch_arena_task()` (~1129) | `os.makedirs(tasks_dir, exist_ok=True)` — **silently recreated** `tasks/` on every dispatch. |
| `apply_arena_patch()` (~1216–1244, ~2591) | Looks for `.patch` files in `tasks/`. |
| `evaluate_verification_and_repair()` (~1441) | Writes `tasks/repair-{task_id}.md`. |

Meanwhile the team instruction and the seeded compliance decision still assert the opposite of the new reality in one respect: they name `SPRINT-INDEX.md` as authority, but the restored index records **dispatch state as of 2026-09-25**, not merge state — and it currently says things like sprint 15 *"dispatched — no PR yet"* for work that has since landed (`agent/imaging/page.tsx`, `components/imaging/dicom-viewer.tsx` both exist). The index is **stale-but-still-the-best-written-record**; git is authoritative. State that hierarchy explicitly in the artifact and in the final-pass prompt.

**Required work in this subsection (do all of it):**

1. **Harden the readers** — replace the bare error-string returns with a real fallback (derive from `git log` / `gh pr list`, or return an explicit `UNKNOWN — regenerate index` marker). A silent `"Chyba: …"` string is indistinguishable from data to an LLM caller; that is the actual defect.
2. **Harden the writers** — `os.makedirs(tasks_dir, exist_ok=True)` guarantees the folder reappears after any deletion. Confirm the `.gitignore` contract covers every path these tools write, and add any that are still uncovered (`tasks/repair-*.md`, `tasks/run-*.json`, `arena_sessions.json` — check `list_active_arena_sessions`' actual filename).
3. **Verify the churn cannot recur** — `git status --short` after a simulated dispatch must show **no** new tracked files. State the command you used.
4. **`CONTRACT DECISION` block** — where sprint ground truth lives, who writes it, whether it is versioned, who refreshes `SPRINT-INDEX.md` and when. Document the hierarchy: **git > SPRINT-INDEX.md > seeded entity memory**.
5. **Reconcile references** — `.agents/skills/new-task/SKILL.md:99` still writes to `tasks/<slug>.md` (or `artifacts/tasks/<slug>.md`), and `AGENTS.md`/`CLAUDE.md` may reference the folder. Every reference must agree with the contract.

**Recovery procedure (already executed on this branch; keep it in the artifact as the reproducible recipe):**

```bash
git fetch --deepen=12 origin main          # this checkout is shallow; history is required
git checkout e9627504 -- tasks/            # commit BEFORE the stub overwrite
rm -rf tasks/sprint10                      # 2535-file duplicate app snapshot — never restore
rm -f tasks/web-test.json tasks/workspace-*.zip tasks-ARCHIVED-*.tgz
```

Do **not** report the stub's 30/30 claim as fact, and do **not** report dispatched-but-later-merged work as missing. Reconcile per §3.2 — git wins.

#### 5.1a The un-implemented Agno backlog that `tasks/` just revealed

Restoring the folder surfaced **four Agno prompts that were written and never implemented**. Your audit must not reinvent them — confirm each is still open, then fold it into the plan:

| Recovered prompt | Status in code (verified this session) |
|---|---|
| `tasks/arena-sprint-prompt-engineering-audit.md` | **NOT IMPLEMENTED.** Requires `sanitize_golden_ticket_prompt(...)` — **missing**. `# GOLDEN TICKET` is emitted by *both* `format_arena_sprint_prompt` (`pipeline_tools.py:351`) and `create_and_dispatch_arena_task` (`:1065`), so a re-dispatched sprint gets **duplicate headers** (`# GOLDEN TICKET`, `# 1. Context / Why`, Scope In/Out, DoD) — prompt bloat that degrades model attention. Also requires `export NODE_OPTIONS="--max-old-space-size=3500"` guidance, which appears **nowhere** in the file. |
| `tasks/arena-sprint-prompt-engineering-audit.md` → `test_prompt_templates.py` | **MISSING.** Only `test_pipeline_tools.py` (27 KB) and `test_dev_orchestrator_and_security.py` exist. |
| `tasks/arena-sprint-agno-pipeline-hardening.md` | **Implemented.** All five diagnosed bugs are fixed: `DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS = 900` (`:1474`, was 15–180 s), strict tab resolution via `_resolve_collect_target(...)`, real dispatch through `send_prompt_to_arena_browser` (`:3452`), upstream-aware `audit_architectural_boundaries` (`:3592`), and unified-diff validation (`:1258`, `:1942`). **Do not redo this work** — verify and record it as done. |
| `tasks/arena-sprint-agno-pipeline-audit-phase2.md` | **Partially open.** `repair_prompt_targets_the_stored_session`, `select_arena_tab`, `find_tab_by_session_id` are all **missing**, so the Phase-2 concurrency/repair-budget scope (4–5 simultaneous Arena tabs, `arena_sessions.json` locking, retry budget, repair targeting the *same* session) is still unbuilt. Cross-check before assuming. |
| `tasks/arena-sprint-agno-enterprise-specs.md` | Specification for the 12 Agno 3.0.11 enterprise capabilities (learning, memories, profiles, entity memory, session context, decision logs, memory manager, knowledge, metrics, evals, approvals, scheduler). Treat as reference for what the runtime *should* expose; note that `pipeline_team_os.py` already uses several (§5.2–§5.7). |

**The one-line rule for this whole subsection:** an audit prompt that asserts work is missing, when it is actually done, wastes a run — and this repo has already paid for that twice. Verify the table above before proposing any of it.

### 5.2 Stale sprint memory (confirmed-by-inspection: verify and quantify)

`seed_sprint_entities()` seeds only **sprints 1, 2, 3, 4 and 7** as `MERGED` into `EntityMemoryStore`, and the team instruction hardcodes:

> *"Sprinty 1, 2, 3, 4 a 7 sú už dokončené a zlúčené v main."*

Meanwhile `main` carries sprint-21 → sprint-30 work (see `git log`). Consequences to confirm: the leader can dispatch already-merged work, and the `sprint-7` note is the closest thing to a live index. **Answer explicitly:** is there any code path that re-seeds from `git log` or `SPRINT-INDEX.md`, or is the seed list frozen? Then propose a fix that derives merged-sprint status from a real source of truth at boot rather than a literal tuple.

### 5.3 History leakage & instruction conflict

`Team(num_history_runs=2)` was already tuned down (comment: *"znizene z 5: menej historickeho sumu"*), and the team instructions carry an explicit warning not to re-execute tasks listed in prior runs. Assess whether `add_history_to_context=True` + `store_member_responses=True` + `show_members_responses=True` + `enable_session_summaries/add_session_summary_to_context` still over-feeds the leader. Propose concrete tuning (values, not adjectives) and state the trade-off.

### 5.4 Scheduler self-dependency (high-value finding — verify)

The `AgentOS(...)` call passes:

```python
scheduler=True,
scheduler_poll_interval=15,
scheduler_base_url=AGENTOS_BASE_URL,     # ← defaults to http://127.0.0.1:7777, overridden by env to the PUBLIC TUNNEL URL
internal_service_token=INTERNAL_SERVICE_TOKEN,
```

If `OPENVPM_AGENTOS_BASE_URL` is set to `https://agentos-tunnel.significa.sk` (as `CLOUDFLARE_TUNNEL.md` instructs for both local `.env` and Dokploy), the scheduler makes its own callbacks **out through the public internet and back through Cloudflare** instead of hitting loopback. Quantify the consequence: tunnel down ⇒ scheduler dies; Cloudflare hiccup ⇒ missed cron; added latency on a 15 s poll. Propose an internal-vs-external base-URL split (loopback for scheduler, public URL only for the web app), and note which env var names to introduce.

### 5.5 Internal service token lifecycle (verify)

```python
INTERNAL_SERVICE_TOKEN = os.getenv("OPENVPM_INTERNAL_SERVICE_TOKEN", "")
if not INTERNAL_SERVICE_TOKEN or INTERNAL_SERVICE_TOKEN == "openvpm-service-secret":
    INTERNAL_SERVICE_TOKEN = os.getenv("OPENVPM_INTERNAL_SERVICE_TOKEN_FALLBACK") or secrets.token_urlsafe(32)
    logger.warning(...)
```

The fail-safe is good (it removed a hardcoded secret), but a **random token per boot** means every restart invalidates in-flight signed callbacks (scheduler triggers, HITL approvals). Confirm whether the token is persisted anywhere and whether restarts during a sprint are routine. Recommend persistence or a documented rotation contract.

### 5.6 Runtime drift: the repo is not what runs (verify — this one matters)

`start-agno.bat` launches, inside WSL:

```
tmux new-session -d -s agno 'cd /home/ubuntu/agno && .venv/bin/python pipeline_team_os.py 2>&1 | tee /tmp/agno_os.log'
```

That is `/home/ubuntu/agno/pipeline_team_os.py` — a **separate copy** from this repo's `.agents/agno/pipeline_team_os.py`, and the runtime also adds `/home/ubuntu/agno` to `sys.path`. Commit `deae63e` ("chore(agno): sync pipeline_tools.py …") is evidence that drift has already occurred. Determine:

- Which file is authoritative, and how a repo patch reaches the running process today.
- Whether the running WSL copy can be diffed from here (if not reachable, list the exact command the owner must run to diff it, and mark the finding `UNVERIFIED — owner action`).
- Also note `.agents/agno/fix-agno-config.patch` is **0 bytes** — a dead artifact. Recommend archive or delete.

Propose a one-command deploy path (symlink, `rsync`, or an explicit sync step in `start-agno.bat`) so "repo = runtime" becomes structurally true.

### 5.7 CORS, observability, checkpointing (assess, don't over-engineer)

- `cors_allowed_origins` lists loopback ports 3000/3001/3007/3008, `192.168.0.100:*`, `http://192.168.0.100:7777` and `https://os.agno.com` — but **not** `https://agentos-tunnel.significa.sk` and **not** the production web origin. State whether any browser-initiated call crosses that boundary (server-side tRPC fetches are CORS-exempt; only browser fetches are affected). Do not add origins speculatively.
- `checkpoint="tool-batch"` on SQLite with `PRAGMA journal_mode=WAL` and `OPENVPM_SQLITE_BUSY_TIMEOUT_MS=30000`: assess behaviour under a long tool batch, and note what happens to approvals if the process is killed mid-batch.
- Metrics/evals: the team's `post_hooks=[collect_run_metrics, make_uikit_adherence_judge(), make_report_quality_judge()]` — verify the judges exist and fail soft if a model call fails, because a throwing post-hook would fail an otherwise good run.

### 5.8 Deliverable

`AGNO-WORKFLOW-OPTIMIZATION.md` containing: a findings table (`ID · Finding · Evidence file:line · Severity · Fix · Risk of fix · Verified?`), then a prioritised change list, then the **exact diff you applied** (or a fenced `diff` block if you deliberately chose not to apply a change). Mark every unverified item clearly.

---

## 6. Workstream D — Fix the AgentOS `:7777` / Cloudflare tunnel regression

**Symptom:** the Agno AgentOS connection over the Cloudflare tunnel worked before and is now broken. Target: `https://agentos-tunnel.significa.sk` → local AgentOS on port 7777.

### 6.1 The prime suspect — read this carefully

There are **two different addresses** in play and they are being confused:

- `.agents/agno/pipeline_team_os.py:1516` — `host=os.getenv("OPENVPM_AGENTOS_HOST", "0.0.0.0")`. **Correct.** A server must bind the wildcard address to accept connections from other interfaces/tunnels.
- `CLOUDFLARE_TUNNEL.md:10` — *"**Local AgentOS**: http://0.0.0.0:7777"*. **This is the bug.** `0.0.0.0` is a **bind-only** wildcard, not a valid **dial** destination. A tunnel ingress configured with `service: http://0.0.0.0:7777` asks cloudflared (a Go binary) to *connect to* `0.0.0.0:7777`, which on Windows fails (`WSAEADDRNOTAVAIL` / no route) — the tunnel comes up, the DNS name resolves, and every request 502s. Cloudflared's ingress must dial **`http://127.0.0.1:7777`** (or `localhost`).

The documented value is the value the owner copied into `C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml`. That is the regression: the doc records a bind address where a dial address belongs.

**Verify before you fix** — the config lives on the owner's Windows machine and is *not* in this repo. So:
1. Confirm the repo-side facts (`serve()` bind host, the doc line, the env vars).
2. Write the exact PowerShell command the owner must run to inspect the real ingress (`cloudflared tunnel ingress validate` / read the YAML), and the exact expected/incorrect values.
3. Only mark the root cause `CONFIRMED` once the owner's output is available; until then state it as `RANK-1 HYPOTHESIS (high confidence, config not in repo)`.

### 6.2 Differential diagnosis — test every row, report the result

Do not stop at the first plausible cause. Produce a table with `Cause · How to test · Expected if true · Verdict (CONFIRMED/RULED OUT/UNVERIFIED)` for at least:

| # | Candidate cause | Test |
|---|---|---|
| 1 | Ingress dials `0.0.0.0:7777` (invalid dial target) | Read `agentos-tunnel.yml` on the owner's machine; validate ingress; test with `127.0.0.1` |
| 2 | Runtime not running in WSL (`tmux` session `agno` dead) | `wsl -d Ubuntu -e tmux ls`; `wsl -d Ubuntu -e tail -50 /tmp/agno_os.log` |
| 3 | Bound to loopback only in the running copy | `wsl -d Ubuntu -e ss -lntp \| grep 7777` — must show `0.0.0.0:7777` or `*:7777`, not `127.0.0.1:7777` |
| 4 | Tunnel process not running / not persistent (doc says it needs manual start) | `Get-Process cloudflared`; check whether it is installed as a Windows service |
| 5 | `/health` path mismatch (root `/` vs `/health`) | `curl -sv https://agentos-tunnel.significa.sk/health`; compare with loopback |
| 6 | Wrong app/port behind the ingress after a config edit | Compare `docker ps`/process list with the ingress `service:` target |
| 7 | Cloudflare-side: DNS record, tunnel credentials, `cert.pem` expiry, account mismatch | `cloudflared tunnel info agentos-tunnel`; `cloudflared tunnel list` |
| 8 | WSL↔Windows networking (WSL2 localhost forwarding off) | Test from Windows: `Test-NetConnection 127.0.0.1 -Port 7777` |
| 9 | Firewall/WSL firewall rule blocking the Windows→WSL hop | Windows Firewall log / temporary rule test |
| 10 | Host header / WAF / tunnel requires auth (Cloudflare Access) in front of the hostname | `curl -sI` for redirects to a login page or 403 |

### 6.3 The fix

**Primary (repo-side, do it):** correct the tunnel contract so this cannot be mis-copied again.

- `CLOUDFLARE_TUNNEL.md` — change the local-target line to `http://127.0.0.1:7777` and add an explicit warning block: *"Never use `0.0.0.0` as an ingress `service:` target — it is a bind address, not a dial address. `0.0.0.0` is correct for `OPENVPM_AGENTOS_HOST` (server bind) and wrong for cloudflared (`client dial`)."*
- Add a copy-pasteable, correct ingress snippet and a validation command.
- Document the health-check path and the expected JSON so the next person can verify in 5 seconds.
- Note in the doc that the runtime binds `0.0.0.0` **by design** (so WSL/Windows/tunnel can all reach it) — the fix is on the client side, **not** a change to `serve()`.

**Secondary (repo-side, do it):**

- Split the scheduler's base URL from the public/external base URL so the scheduler never dials itself through the public tunnel (Workstream C, §5.3). Add the new env var(s) to `.env.example` with a comment explaining the loopback default. **`.env.example` currently documents no AgentOS variable at all** — that gap is why the addresses drifted; close it.
- Extend the health probe in `apps/web/server/routers/extensions/ai-swarm.ts` (`checkAgentOsHealth`, ~line 240) so the tunnel URL is an explicit candidate and a remote probe gets a longer timeout than the current 800 ms (a tunnel round-trip plus TLS handshake can exceed it, producing a false "offline"). Keep `http://127.0.0.1:7777` first for local dev **and keep the page fallback literal intact** (§2.2). Surface which URL succeeded (`agentOsUrl` already returns it) so the operator can see *which* path worked.
- If you change any user-visible string, update **both** `en.json` and `sk.json` leaf-symmetrically.

**Do not** "fix" this by changing `serve(host=...)` to `127.0.0.1` — that would break WSL/Windows/tunnel reachability and is the opposite of the problem.

### 6.4 Verification (must be reproducible by the owner)

Provide a numbered verification script with expected output for each step, covering: loopback, LAN (if applicable), and the public tunnel; then the web-app view (`/admin/ai-swarm` telemetry showing `isOnline: true` with the resolved URL); then a scheduler cron firing after two poll intervals. State clearly which steps require the owner's machine and cannot be run from this sandbox.

### 6.5 Deliverable

`TUNNEL-7777-RCA.md`: timeline, ranked cause table with verdicts, the applied fix, the owner-action list (exact commands), the verification script, and a rollback line.

---

## 7. Workstream E — The consolidated final-pass prompt

`FINAL-PASS-PROMPT.md` is the payload a future operator pastes to run the orchestration loop cleanly. It must be **short enough to be honoured in one run** (target 120–200 lines) and must contain:

1. **Mission** — one paragraph, the four-phase cycle (dispatch → implement → verify → merge) and its stop condition.
2. **Ground truth block** — the *live* merged-sprint list derived from Workstream A, with a dated stamp and an instruction to re-derive it with `git log`/`gh pr list` rather than trusting the literal list. Include the exact re-derivation commands.
3. **Invariants** — the DO-NOT-TOUCH set, the source-contract traps that actually exist (short list, each with file path), i18n leaf symmetry, zero-new-warnings.
4. **Dispatch protocol** — lock → confirm clean tree → dispatch → verify patch → merge; the abort conditions (must abort on lock failure, on failed verification, on truncation guard).
5. **Memory hygiene** — explicit instruction that **git outranks every other source**, that `SPRINT-INDEX.md` is authoritative *only if it exists and is maintained* (it was deleted at `dab4d05` — see §5.1), and that seeded entity memory (sprints 1/2/3/4/7 only) and the team's hardcoded "authority rule" are **not** ground truth. A sprint counts as done only if its files moved in a commit.
6. **Verification contract** — the exact `pnpm --filter @openpims/web …` command set, run before and after.
7. **Reporting format** — the short Slovak operator summary (§9 below).
8. **Known-failure appendix** — the ≤ 10 failure classes from Workstream A §3.4 and the prompt-library failure modes from Workstream B §4.3, so the next run does not rediscover them.
9. **Ground-truth location** — name the single place sprint state lives (the `CONTRACT DECISION` from §5.1) and the exact command that regenerates it. If the decision was "git is the only truth", say so explicitly and drop all `tasks/`-reading steps from the loop.

Write it in English, with Slovak strings only where it quotes UI text. It must be self-contained: a future operator should need **no other prompt file** to run the loop.

---

## 8. Verification suite (run at the end, from a clean tree)

> **Sandbox memory guard — read first.** `tasks/arena-sprint-prompt-engineering-audit.md` documents that Arena sandboxes have **2–4 GB RAM**, while a full monorepo `tsc --noEmit` costs **2.2–2.8 GB** and dies with **`Exit status 134 / Aborted (OOM)`**. Before any type-check:
>
> ```bash
> export NODE_OPTIONS="--max-old-space-size=3500"
> ```
>
> Prefer **targeted** verification of the files you touched, and treat a full-monorepo type-check as best-effort; the hosted CI pipeline is the authoritative gate. If a check is killed for memory, **say so explicitly** in the artifact and in the owner summary — never report an OOM as a pass, and never report it as a code failure.

```bash
export NODE_OPTIONS="--max-old-space-size=3500"
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
pnpm --filter @openpims/web test
pnpm --filter @openpims/web i18n:scan
```

Requirements:
- `type-check` exits 0.
- `lint` — **no new warnings** versus the baseline you recorded in §1. Quantify: "baseline N → now N".
- `test` — full suite green; explicitly re-run the two pinned tests from §1 and quote both results before/after.
- `i18n:scan` exits 0 and leaf-symmetry holds if you touched messages.
- Python side: state how the edited `.agents/agno/pipeline_team_os.py` was validated. If it cannot be executed in this sandbox, use the strongest available static check and **say so**: `python -m py_compile .agents/agno/pipeline_team_os.py` plus a syntax/AST check of the edited regions, and flag the runtime test as an owner action.

---

## 9. Commit & PR structure

Branch: `arena/<session-id>-openvpm-ai` (never push elsewhere). One logical change per commit:

```
docs(audit): sprint audit of last 30 sprints vs git evidence
docs(audit): prompt-library audit and consolidation proposal
fix(agno): fail loud when sprint ground truth is missing; dedupe Golden Ticket headers
chore(tasks): keep prompt library versioned, ignore swarm runtime churn
fix(agno): correct cloudflared ingress target and document bind-vs-dial
feat(agno): decouple scheduler base URL from public tunnel URL
fix(ai-swarm): probe tunnel URL with remote-aware timeout
docs(prompt): add consolidated final-pass orchestration prompt
```

Open one PR titled `Final pass: Agno OS audit, tunnel repair, prompt consolidation`. PR body: the four artifact paths, the root cause in ≤ 5 lines, the owner-action list, and before/after test counts.

---

## 10. Definition of Done

- [ ] All five artifacts exist under `artifacts/agno-final-pass/` and contain no unverified assertion presented as fact.
- [ ] Sprint audit covers ~30 sprints, each with a status + cited evidence; the "merged" definition (files moved in a commit) was applied strictly.
- [ ] The restored `tasks/` library (118 files) was used: the real `SPRINT-INDEX.md` was read and its 30/30-stub successor was reconciled against git rather than repeated or dismissed; the 17 `gt-*` Golden Tickets were at least enumerated.
- [ ] `§5.1a` was verified line by line — the prompt-engineering audit's four open items (`sanitize_golden_ticket_prompt`, duplicate `# GOLDEN TICKET` headers, `NODE_OPTIONS` guidance, `test_prompt_templates.py`) are each confirmed open or confirmed done, and the three already-implemented hardening items are recorded as done rather than re-proposed.
- [ ] A `CONTRACT DECISION` exists for where sprint ground truth lives, the `.gitignore` contract prevents recurrence (proved by `git status --short` after a simulated dispatch), and the silent error-string returns in `list_arena_sprints` / `read_sprint_assignment` are either patched or explicitly deferred with a reason.
- [ ] Prompt audit read every file in `artifacts/audit-prompts/`, `.agents/prompts/`, `prompts/`; every file carries one of KEEP/MERGE/REWRITE/ARCHIVE.
- [ ] Agno workflow artifact lists each finding with file:line evidence, severity, fix, and verified/unverified flag; the stale sprint-seed finding is either fixed or has a concrete proposed patch.
- [ ] Tunnel RCA names a rank-1 root cause with a reproducible test, corrects the bind-vs-dial error in the doc, and gives the owner exact commands.
- [ ] `FINAL-PASS-PROMPT.md` is self-contained, ≤ 200 lines, and re-derives ground truth rather than trusting a frozen list.
- [ ] Verification suite run; before/after results quoted; zero new lint warnings.
- [ ] No fiscal, clinical, controlled-substance or schema file touched. No unrelated cleanup.
- [ ] Out-of-scope findings are listed as FOLLOW-UP, not fixed.
- [ ] Commits follow §9; the PR is open.

---

## 11. Final reply to the owner (Slovak, short)

Reply in Slovak, ≤ 25 lines:

1. Artifact paths (5).
2. **Root cause of the 7777/tunnel break in 2–3 sentences**, and whether it is `CONFIRMED` or still a rank-1 hypothesis.
3. The 3–5 most important audit findings with numbers (merge ratio, rework rate, stale-memory effect).
4. What you changed in code, and what you deliberately did not change and why.
5. Verification results before → after.
6. **Owner-action list** — the exact commands that must be run on the Windows/WSL machine, copy-pasteable, in order.
7. The single most valuable next action.

No long recap of the files — the artifacts carry the detail.

---

## 12. Lessons already paid for (do not relearn)

- A sprint `.md` is **not** evidence that a sprint shipped. Only a commit that moved its target files is. The converse also holds: a stale index saying "written" does **not** mean the work is missing — check the files before declaring a sprint unmerged.
- **A "30/30 merged" summary written over a detailed status table is a red flag, not a status report.** `497e8ff` replaced a nuanced 20-row table with a 5-line all-clear stub, and the same commit produced a **29-byte** "archive" tarball — an archive that cannot restore anything. Verify archives by size and by test-extracting; never trust the file's existence.
- **Deleting a directory can silently disarm a toolchain.** `tasks/` was removed, but `pipeline_tools.py` still reads it in seven places and the team prompt still calls it the authority. The tools then returned *strings that look like data* (`"Chyba: …"`) instead of failing loudly. Before deleting or moving any path, grep the agent tooling for it (`grep -rn '"tasks\|SPRINT-INDEX' .agents/`), and prefer a hard failure over a prose error a model will happily misread.
- **Anything an agent writes into an un-ignored directory becomes a commit hazard.** `tasks/` was never gitignored, which is how a 300-file commit containing a duplicate copy of the app source happened. Decide the ignore contract *before* the tool writes there.
- **A written prompt is not a scheduled one.** Three of the four recovered Agno prompts were never executed at all (prompt-engineering audit, phase-2 concurrency audit, enterprise specs) while a fourth (pipeline hardening) *was* implemented — and nothing in the repo distinguishes the two cases. Track dispatch state, not file existence.
- **The sandbox is not the host.** `tsc --noEmit` over this monorepo needs 2.2–2.8 GB and Arena sandboxes have 2–4 GB, so a full type-check can die with exit 134. Export `NODE_OPTIONS="--max-old-space-size=3500"`, prefer targeted checks, and report an OOM as an OOM — never as a pass or as a code failure.
- A file path is configuration. When the same address appears as both a bind target and a dial target (or the same directory as both tool input and an ignored scratch space), the two readings will eventually diverge — name them differently in code and in docs.
- `admin-panel-pagekit.test.ts` pins the literal `http://127.0.0.1:7777` in the swarm page — a well-intentioned "fix" to that fallback breaks the suite.
- `en.json`/`sk.json` leaf symmetry is enforced by `i18n-structure.test.ts`; adding one key to one locale fails the run.
- The lint baseline is **not** zero — say "no NEW warnings", never "fix all warnings".
- `0.0.0.0` means *bind everywhere*; it never means *connect here*. Mixing those two is exactly how this regression happened.
- The repository is not the runtime: `start-agno.bat` runs `/home/ubuntu/agno/pipeline_team_os.py` in WSL. A patch that is not synced there has **no effect on behaviour** — always state which copy you validated.
- Docs from an earlier era (`C:\Users\marek\…` PowerShell paths, `Desktop Commander`, `-LiteralPath`) are historical. Translate them to the current environment rather than executing them literally.
- Approximate line numbers are acceptable; wrong counts and invented APIs are not. Recount before saving.
