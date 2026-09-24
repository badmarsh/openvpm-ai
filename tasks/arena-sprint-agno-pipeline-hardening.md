# Arena Sprint: Agno Pipeline Architecture, CDP Reliability & Self-Healing Hardening

> **Mission for Arena Agent:**
> Review and harden the OpenVPM AI autonomous pipeline orchestrator located in `.agents/agno/pipeline_team_os.py` and `.agents/agno/pipeline_tools.py`.
> Eliminate race conditions, premature completion heuristics, tab-selection blindness, mock stubs, and false-positive architectural audits.
> Provide clean, robust Python code with comprehensive unit tests in `.agents/agno/tests/test_pipeline_tools.py`.

---

## 1. Context & Architectural Root Causes

OpenVPM AI uses an Agno AgentOS team to orchestrate autonomous coding sprints between Arena.ai, GitHub, and local verification runners.
During production operations, five critical failure modes were empirically diagnosed:

### Bug 1: Premature Completion & Naive DOM Polling in `collect_code_from_arena_browser`
- **Flaw:** The function checks if DOM text length remains unchanged for 4 seconds (`stable_cycles >= 2`) and has a default timeout of only 15–180 seconds.
- **Consequence:** When an Arena coding agent runs terminal commands (`pnpm install`, `vitest`, `type-check`), no new text appears in the chat for several minutes. The watcher prematurely declares `COMPLETED`, extracts context scraps (such as README setup instructions), and falsely reports that the sprint produced no code.
- **Requirement:** Implement a robust state detection engine. A session is ONLY complete when the "Create PR" button becomes active, the terminal exits with a finished diff, or an explicit completion marker is reached. While thinking or executing bash commands, it MUST report `RUNNING` with an accurate timeout (default 600–900 seconds).

### Bug 2: Blind Tab Selection across Multiple Sprints
- **Flaw:** The function uses `next((page for page in pages if "arena" in page.url.lower()), None)`, which blindly connects to the very first tab in Chrome containing "arena".
- **Consequence:** If Sprint 1, Sprint 5, and Sprint 7 are all open in browser tabs, the watcher queries Sprint 1 for all sprints, saving Sprint 1's summary into `sprint-5.patch` and `sprint-7.patch`.
- **Requirement:** Match tabs strictly by session ID (`/agent/<session_id>`) or task slug in the URL / document title. If not found, do not hijack unrelated tabs.

### Bug 3: Mock Stub in `dispatch_to_arena_session`
- **Flaw:** `dispatch_to_arena_session` only appended a JSON dictionary to `arena_sessions.json` with `"status": "RUNNING"` without actually dispatching the prompt to the browser.
- **Requirement:** Integrate physical dispatch via `send_prompt_to_arena_browser` so that calling dispatch actually opens `/agent`, fills the textarea with the full task specification, and triggers generation.

### Bug 4: False Positive in `audit_architectural_boundaries`
- **Flaw:** Any router in `apps/web/server/routers/` was flagged as a violation requiring `extensions/`, ignoring vanilla upstream routers (`records.ts`, `whiteboard.ts`).
- **Requirement:** Verify whether the router file exists in upstream OpenVPM (`../OpenVPM/apps/web/server/routers/`) before flagging a violation. Generic enhancements to vanilla files are explicitly permitted under Upstream-Backport-Aware Coding.

### Bug 5: Non-Diff Text Saved to `.patch` Files
- **Flaw:** If no `diff --git` block was found, `collect_code_from_arena_browser` fell back to saving raw Markdown explanations into `.patch` files.
- **Requirement:** Never save non-diff text to `.patch`. Only unified diffs starting with `diff --git` or `--- a/` qualify as patches.

---

## 2. Scope of Changes

- **Files to Modify:**
  - `.agents/agno/pipeline_tools.py`
  - `.agents/agno/pipeline_team_os.py`
- **Files to Add:**
  - `.agents/agno/tests/test_pipeline_tools.py` (pytest suite covering tab matching, patch validation, architectural audit, and status detection).
- **Files That MUST NOT Be Touched:**
  - Do not modify vanilla upstream schemas in `packages/db/schema/*.ts`.
  - Do not touch database migration journals in `packages/db/drizzle/*`.

---

## 3. Acceptance Criteria & Definition of Done

1. [ ] `pytest .agents/agno/tests/` passes with 100% green tests.
2. [ ] `collect_code_from_arena_browser` correctly identifies `RUNNING` vs `COMPLETED` based on real execution indicators, with configurable long timeouts (600s+).
3. [ ] Tab matching selects the exact session ID in `/agent/{session_id}`.
4. [ ] Non-diff text is never written to `.patch`.
5. [ ] Python typing and docstrings are clean and PEP 8 compliant.
