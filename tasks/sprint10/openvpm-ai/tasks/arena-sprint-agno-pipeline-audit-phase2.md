# Arena Sprint: Agno Pipeline Architecture & Concurrency Stress-Test (Phase 2 Audit)

> **Mission for Arena Flagship Agent:**
> Conduct a deep architectural, concurrency, and self-healing audit of the OpenVPM AI autonomous pipeline orchestrator (`.agents/agno/pipeline_tools.py` and `.agents/agno/pipeline_team_os.py`).
> Phase 1 successfully resolved the 5 core failure modes and established 28 passing unit tests (`.agents/agno/tests/test_pipeline_tools.py`).
> Phase 2 focuses on **high-concurrency parallel swarm execution**, **autonomous self-healing repair loops**, and **runtime telemetry resilience**.

---

## 1. Repository & Baseline Context

- **Repository:** `badmarsh/openvpm-ai`
- **Branch:** `main` (clean, latest commits include Sprint 7 merge and Phase 1 Agno hardening)
- **Local Runtime:** WSL Ubuntu with Linux Chrome on `127.0.0.1:9222` (CDP enabled) and Agno AgentOS on `127.0.0.1:7777`.
- **Existing Test Suite:** `pytest .agents/agno/tests/` (28/28 passing).

---

## 2. Audit Scope & Critical Questions

### A. Parallel Swarm Concurrency (4–5 Simultaneous Arena Sessions)
- How does `pipeline_tools.py` behave when 4 different sprints (e.g. Sprint 5, 8, 9, 10) are active simultaneously in different Chrome tabs?
- Inspect `_get_cdp_endpoints()`, `select_arena_tab()`, `find_tab_by_session_id()`, and `collect_code_from_arena_browser()`.
- Are there race conditions when multiple agents attempt Playwright CDP operations at the same millisecond?
- Does `arena_sessions.json` file locking prevent corrupt reads/writes under concurrent access?
- **Recommendation needed:** Should we introduce connection pooling, tab locking, or semaphore-gated browser interactions?

### B. Autonomous Self-Healing & Repair Feedback Loop
- Inspect `evaluate_verification_and_repair()` and `repair_prompt_targets_the_stored_session()`.
- When an Arena agent submits a PR or patch, local verification runs:
  `pnpm --filter @openpims/web type-check`, `pnpm lint`, `pnpm test`.
- If verification fails with TypeScript errors, lint errors, or failed test assertions:
  1. How is the failure diagnostic extracted and formatted?
  2. Does the system target the EXACT same Arena session `/agent/{session_id}`?
  3. Does it prevent infinite retry loops (max retry budget)?
  4. How does the agent resume after repair?

### C. OpenTelemetry Tracing, Database & Performance Under Load
- In Phase 1, we activated `setup_tracing(db=db)` for database span export.
- Does SQLite handle concurrent trace upserts during long-running streaming runs without `database is locked` errors?
- Is WAL (Write-Ahead Logging) mode properly configured on SQLite connections?
- Does batch processing (`batch_processing=True` in `setup_tracing`) optimize performance over simple span processing?

### D. Architecture Boundary & Upstream Backport Safety
- Inspect `audit_architectural_boundaries()`.
- Verify that generic enhancements to upstream files (`apps/web/app/(dashboard)/**`, `components/**`) remain backportable to `../OpenVPM`, while Slovak law / clinical safety / AI specifics remain strictly quarantined in `ext_*` schemas and `extensions/` routers.

---

## 3. Deliverables & Definition of Done

1. **In-depth Architectural Critique:** Clear, prioritized analysis of potential concurrency bottlenecks, race conditions, or edge-case failures.
2. **Concrete Code Enhancements:** Hardened implementations for identified gaps in `.agents/agno/pipeline_tools.py` and `.agents/agno/pipeline_team_os.py`.
3. **Expanded Test Suite:** Additional pytest tests in `.agents/agno/tests/` verifying concurrent tab access, repair loop termination, and trace robustness.
4. **All Tests Green:** `pytest .agents/agno/tests/` must remain 100% green.
