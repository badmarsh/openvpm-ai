"""Reliability tests for the Arena pipeline tools.

Covers tab matching, completion detection, patch validation, physical
dispatch, and upstream-aware architectural audit. No live Chrome or AgentOS
process is required.
"""

from __future__ import annotations

import inspect
import json
import sys
import threading
from contextlib import contextmanager
from pathlib import Path

import pytest

AGNO_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGNO_DIR))

import pipeline_tools as pt  # noqa: E402


DIFF = (
    "diff --git a/apps/web/lib/sprint5.ts b/apps/web/lib/sprint5.ts\n"
    "--- a/apps/web/lib/sprint5.ts\n"
    "+++ b/apps/web/lib/sprint5.ts\n"
    "@@ -1 +1 @@\n"
    "-old\n"
    "+new\n"
)
README = (
    "# Setup\n\n"
    "Run `pnpm install`, then `pnpm --filter @openpims/web type-check`.\n"
    "See the README for vitest instructions.\n"
)


class FakePage:
    """Minimal Playwright page used by the CDP seams."""

    def __init__(self, url: str, title: str = "", snapshot: dict | None = None) -> None:
        self.url = url
        self._title = title
        self.snapshot = dict(snapshot or {})
        self.filled: str | None = None
        self.goto_urls: list[str] = []
        self.submitted = False
        self.clicked: list[str] = []

    def title(self) -> str:
        return self._title

    def evaluate(self, script: str, arg: object | None = None) -> object:
        if arg is not None:
            return {"ok": True, "length": len(str(arg))}
        return dict(self.snapshot)

    def goto(self, url: str, **kwargs: object) -> None:
        self.goto_urls.append(url)
        self.url = url

    def locator(self, selector: str) -> "FakeLocator":
        return FakeLocator(self, selector)


class FakeLocator:
    def __init__(self, page: FakePage, selector: str) -> None:
        self.page = page
        self.selector = selector

    @property
    def first(self) -> "FakeLocator":
        return self

    def count(self) -> int:
        selector = self.selector
        if "textarea" in selector or "contenteditable" in selector or "textbox" in selector:
            return 1
        if "submit" in selector or "Send" in selector or "send-button" in selector:
            return 1
        return 0

    def is_visible(self) -> bool:
        return self.count() > 0

    def is_enabled(self) -> bool:
        return True

    def fill(self, text: str) -> None:
        self.page.filled = text

    def click(self, timeout: int | None = None) -> None:
        self.page.clicked.append(self.selector)
        self.page.submitted = True

    def press(self, key: str) -> None:
        if key == "Enter":
            self.page.submitted = True

    def input_value(self) -> str:
        return self.page.filled or ""

    def evaluate(self, script: str) -> str:
        return self.page.filled or ""


class FakeContext:
    def __init__(self, pages: list[FakePage] | None = None) -> None:
        self.pages = list(pages or [])

    def new_page(self) -> FakePage:
        page = FakePage("about:blank", "")
        self.pages.append(page)
        return page


class FakeBrowser:
    def __init__(self, pages: list[FakePage] | None = None) -> None:
        self.contexts = [FakeContext(pages)]

    def new_context(self) -> FakeContext:
        context = FakeContext()
        self.contexts.append(context)
        return context


@pytest.fixture
def isolated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point session and task writes at a throwaway repo."""
    repo = tmp_path / "openvpm-ai"
    (repo / "tasks").mkdir(parents=True)
    tmp = tmp_path / "tmp"
    tmp.mkdir()
    monkeypatch.setattr(pt, "REPO_DIR", str(repo))
    monkeypatch.setattr(pt, "TMP_DIR", str(tmp))
    monkeypatch.setattr(pt, "ARENA_SESSIONS_FILE", str(tmp / "arena_sessions.json"))
    monkeypatch.setattr(pt, "ARENA_NAVIGATION_WAIT_SECONDS", 0)
    monkeypatch.setattr(pt, "_sleep", lambda *_args, **_kwargs: None)
    return repo


def _cdp(browser: FakeBrowser):
    @contextmanager
    def _session(_ports: str):
        yield [(browser, "http://127.0.0.1:9222")]

    return _session


def _running_snapshot(**overrides: object) -> dict:
    snapshot = {
        "createPrVisible": False,
        "createPrEnabled": False,
        "stopVisible": False,
        "thinking": False,
        "bashRunning": False,
        "terminalExited": False,
        "terminalText": "",
        "assistantText": README,
        "codeBlocks": [README],
        "completionMarker": False,
    }
    snapshot.update(overrides)
    return snapshot


# ---------------------------------------------------------------------------
# Tab matching
# ---------------------------------------------------------------------------

def test_tab_match_uses_exact_agent_session_not_first_arena_tab() -> None:
    tabs = [
        ("https://arena.ai/agent/sprint-1", "Arena sprint"),
        ("https://arena.ai/agent/sprint-5", "Arena sprint"),
        ("https://arena.ai/agent/sprint-7", "Arena sprint"),
    ]
    matched = pt.match_arena_tab(tabs, session_id="sprint-5")
    assert matched is not None
    assert matched.url.endswith("/agent/sprint-5")


def test_tab_match_rejects_session_prefix_and_arena_substring() -> None:
    tabs = [
        ("https://arena.ai/login", "Arena"),
        ("https://arena.ai/agent/sprint-50", "sprint-50"),
        ("https://example.com/arena", "unrelated"),
    ]
    assert pt.match_arena_tab(tabs, session_id="sprint-5") is None
    assert pt.url_matches_session("https://arena.ai/agent/sprint-50", "sprint-5") is False
    assert pt.url_matches_session("https://arena.ai/agent/sprint-5", "sprint-5") is True
    assert pt.url_matches_session("https://arena.ai/agent/sprint-5/files", "sprint-5") is True


def test_tab_match_uses_slug_in_title_or_url_and_refuses_ambiguous_hits() -> None:
    tabs = [
        ("https://arena.ai/agent/uuid-1", "Sprint 1"),
        ("https://arena.ai/agent/uuid-5", "Sprint 5 prescriptions"),
    ]
    matched = pt.match_arena_tab(tabs, task_slug="sprint-5")
    assert matched is not None
    assert "uuid-5" in matched.url

    ambiguous = [
        ("https://arena.ai/agent/aaa", "sprint-5 notes"),
        ("https://arena.ai/agent/bbb", "sprint-5 other"),
    ]
    assert pt.match_arena_tab(ambiguous, task_slug="sprint-5") is None
    assert pt.match_arena_tab(tabs, task_slug="arena") is None
    assert pt.match_arena_tab(tabs, task_slug="agent") is None


def test_slug_token_does_not_match_longer_numeric_suffix() -> None:
    assert pt.slug_in_text("sprint-5", "https://arena.ai/agent/sprint-50") is False
    assert pt.slug_in_text("sprint-5", "Sprint 5 — prescriptions") is True


# ---------------------------------------------------------------------------
# Completion detection
# ---------------------------------------------------------------------------

def test_default_collect_timeout_is_long_and_configurable() -> None:
    default = inspect.signature(pt.collect_code_from_arena_browser).parameters[
        "timeout_seconds"
    ].default
    assert 600 <= default <= 900
    assert pt._coerce_collect_timeout(None) == pt.DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS
    assert pt._coerce_collect_timeout(600) == 600
    assert pt._coerce_collect_timeout(900) == 900


def test_stable_dom_and_readme_are_not_completion() -> None:
    observation = pt.detect_arena_run_state(_running_snapshot())
    assert observation.status == "RUNNING"
    assert observation.reason == "awaiting_completion_signal"
    assert observation.patch_text is None

    timed_out = pt.detect_arena_run_state(_running_snapshot(), timed_out=True)
    assert timed_out.status == "RUNNING"
    assert timed_out.reason == "watcher_timeout"
    assert timed_out.patch_text is None


def test_thinking_or_bash_stays_running_even_with_partial_diff() -> None:
    thinking = pt.detect_arena_run_state({
        "thinking": True,
        "completionMarker": True,
        "assistantText": "ARENA_TASK_COMPLETE",
        "codeBlocks": [DIFF],
    })
    assert thinking.status == "RUNNING"
    assert thinking.reason == "thinking"
    assert thinking.patch_text is None

    bash = pt.detect_arena_run_state({
        "bashRunning": True,
        "createPrVisible": True,
        "createPrEnabled": True,
        "terminalText": "pnpm install\n" + DIFF,
        "terminalExited": True,
        "codeBlocks": [DIFF],
    })
    assert bash.status == "RUNNING"
    assert bash.reason == "bash_running"
    assert bash.patch_text is None

    generating = pt.detect_arena_run_state({"stopVisible": True, "assistantText": DIFF})
    assert generating.status == "RUNNING"
    assert generating.reason == "generating"


def test_completion_requires_create_pr_terminal_diff_or_marker() -> None:
    disabled = pt.detect_arena_run_state({
        "createPrVisible": True,
        "createPrEnabled": False,
        "assistantText": "Click Create PR when you are done.",
    })
    assert disabled.status == "RUNNING"

    create_pr = pt.detect_arena_run_state({
        "createPrVisible": True,
        "createPrEnabled": True,
        "codeBlocks": [DIFF],
    })
    assert create_pr.status == "COMPLETED"
    assert create_pr.reason == "create_pr_active"
    assert create_pr.patch_text is not None
    assert create_pr.patch_text.startswith("diff --git a/")

    terminal = pt.detect_arena_run_state({
        "terminalExited": True,
        "terminalText": "pnpm test\nexit code: 0\n" + DIFF,
    })
    assert terminal.status == "COMPLETED"
    assert terminal.reason == "terminal_exited_with_diff"

    marker = pt.detect_arena_run_state({"assistantText": "ARENA_TASK_COMPLETE"})
    assert marker.status == "COMPLETED"
    assert marker.reason == "explicit_completion_marker"
    assert marker.patch_text is None


def test_collect_reports_running_while_bash_and_writes_no_patch(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    page = FakePage(
        "https://arena.ai/agent/sprint-5",
        "Sprint 5",
        _running_snapshot(bashRunning=True, terminalText="pnpm install\nvitest\n"),
    )
    foreign = FakePage(
        "https://arena.ai/agent/sprint-1",
        "Sprint 1",
        _running_snapshot(assistantText="SPRINT1_SECRET"),
    )
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(FakeBrowser([foreign, page])))
    result = pt.collect_code_from_arena_browser("sprint-5", timeout_seconds=0)
    assert "status=RUNNING" in result
    assert "status=COMPLETED" not in result
    assert "bash_running" in result
    assert "patch_written=no" in result
    assert "SPRINT1_SECRET" not in result
    assert list((isolated / "tasks").glob("*.patch")) == []


def test_collect_timeout_stays_running_for_configured_long_window(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = {"t": 0.0}

    def monotonic() -> float:
        return clock["t"]

    def sleep(seconds: float) -> None:
        clock["t"] += seconds

    page = FakePage(
        "https://arena.ai/agent/sprint-5",
        "Sprint 5",
        _running_snapshot(bashRunning=True),
    )
    monkeypatch.setattr(pt, "_monotonic", monotonic)
    monkeypatch.setattr(pt, "_sleep", sleep)
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(FakeBrowser([page])))
    result = pt.collect_code_from_arena_browser("sprint-5", timeout_seconds=600)
    assert "status=RUNNING" in result
    assert "status=COMPLETED" not in result
    assert "timeout_seconds=600" in result
    assert clock["t"] >= 600
    assert list((isolated / "tasks").glob("*.patch")) == []


def test_collect_matches_exact_session_and_ignores_other_sprints(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sprint1 = FakePage(
        "https://arena.ai/agent/sprint-1",
        "Sprint 1",
        _running_snapshot(
            createPrVisible=True,
            createPrEnabled=True,
            codeBlocks=["diff --git a/sprint1.ts b/sprint1.ts\n--- a/sprint1.ts\n+++ b/sprint1.ts\n"],
            assistantText="SPRINT1",
        ),
    )
    sprint5 = FakePage(
        "https://arena.ai/agent/sprint-5",
        "Sprint 5",
        _running_snapshot(createPrVisible=True, createPrEnabled=True, codeBlocks=[DIFF]),
    )
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(FakeBrowser([sprint1, sprint5])))
    result = pt.collect_code_from_arena_browser("sprint-5", timeout_seconds=0)
    assert "status=COMPLETED" in result
    assert "reason=create_pr_active" in result
    assert "patch_written=yes" in result
    patch = (isolated / "tasks" / "sprint-5.patch").read_text(encoding="utf-8")
    assert patch.startswith("diff --git a/apps/web/lib/sprint5.ts")
    assert "sprint1.ts" not in patch


def test_collect_not_found_does_not_hijack_or_keep_prose_patch(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bad = isolated / "tasks" / "sprint-7.patch"
    bad.write_text(README, encoding="utf-8")
    browser = FakeBrowser([
        FakePage("https://arena.ai/agent/sprint-1", "Sprint 1", _running_snapshot()),
    ])
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(browser))
    result = pt.collect_code_from_arena_browser("sprint-7", timeout_seconds=0)
    assert "status=NOT_FOUND" in result
    assert "status=COMPLETED" not in result
    assert "patch_written=no" in result
    assert not bad.exists()


def test_collect_completed_without_diff_does_not_write_patch(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    page = FakePage(
        "https://arena.ai/agent/sprint-5",
        "Sprint 5",
        _running_snapshot(assistantText="ARENA_TASK_COMPLETE\n" + README),
    )
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(FakeBrowser([page])))
    result = pt.collect_code_from_arena_browser("sprint-5", timeout_seconds=0)
    assert "status=COMPLETED" in result
    assert "reason=explicit_completion_marker" in result
    assert "patch_written=no" in result
    assert list((isolated / "tasks").glob("*.patch")) == []


def test_collect_terminal_exit_with_diff_completes(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    page = FakePage(
        "https://arena.ai/agent/sprint-5",
        "Sprint 5",
        _running_snapshot(
            terminalExited=True,
            terminalText="vitest\nexit code: 0\n" + DIFF,
            assistantText=README,
            codeBlocks=[README],
        ),
    )
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(FakeBrowser([page])))
    result = pt.collect_code_from_arena_browser("sprint-5", timeout_seconds=0)
    assert "status=COMPLETED" in result
    assert "reason=terminal_exited_with_diff" in result
    assert "patch_written=yes" in result
    saved = (isolated / "tasks" / "sprint-5.patch").read_text(encoding="utf-8")
    assert saved.startswith("diff --git a/")
    assert "pnpm install" not in saved


def test_source_has_no_premature_stability_or_blind_tab_heuristic() -> None:
    source = Path(pt.__file__).read_text(encoding="utf-8")
    assert "stable_cycles" not in source
    assert 'if "arena" in page.url.lower()' not in source
    assert "next((page for page" not in source
    assert "send_prompt_to_arena_browser" in inspect.getsource(pt.dispatch_to_arena_session)


# ---------------------------------------------------------------------------
# Patch validation
# ---------------------------------------------------------------------------

def test_only_unified_diffs_qualify_as_patches(tmp_path: Path) -> None:
    assert pt.extract_unified_diff(README) is None
    assert pt.extract_unified_diff("Please use diff --git when formatting a patch.") is None
    assert pt.extract_unified_diff(
        "Index: README.md\n--- README.md\n+++ README.md\n@@ -1 +1 @@\n-a\n+b\n"
    ) is None
    assert pt.is_unified_diff(DIFF)
    extracted = pt.extract_unified_diff("Explanation\n```diff\n" + DIFF + "```\nThanks")
    assert extracted is not None
    assert extracted.startswith("diff --git a/")
    mini = "--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-a\n+b\n"
    assert pt.extract_unified_diff(mini).startswith("--- a/")

    prose_path = tmp_path / "notes.patch"
    assert pt.write_unified_patch(str(prose_path), README) is False
    assert not prose_path.exists()
    assert pt.write_unified_patch(str(prose_path), DIFF) is True
    assert prose_path.read_text(encoding="utf-8").startswith("diff --git a/")


def test_apply_rejects_nondiff_without_writing_patch_or_calling_git(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("git must not run for non-diff text")

    monkeypatch.setattr(pt.subprocess, "run", boom)
    result = pt.apply_arena_patch("sprint-5", README)
    assert "unified diff" in result
    assert list((isolated / "tasks").glob("*.patch")) == []
    assert list(Path(pt.TMP_DIR).glob("*.patch")) == []


def test_listing_ignores_prose_patch_files(isolated: Path) -> None:
    tasks = isolated / "tasks"
    (tasks / "arena-foo.md").write_text("ticket", encoding="utf-8")
    (tasks / "arena-foo.patch").write_text(README, encoding="utf-8")
    report = pt.list_active_arena_sessions()
    assert "PENDING" in report
    assert "COMPLETED" not in report


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def test_dispatch_physically_sends_full_prompt_and_marks_running(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, object] = {}

    def fake_send(prompt_text: str, **kwargs: object) -> str:
        seen["prompt"] = prompt_text
        seen.update(kwargs)
        return (
            "DISPATCH_OK opened=/agent url=https://arena.ai/agent "
            "submitted=yes arena_session_id=- endpoint=test"
        )

    monkeypatch.setattr(pt, "send_prompt_to_arena_browser", fake_send)
    full = "FULL SPEC\n" + ("requirement line\n" * 30)
    result = pt.dispatch_to_arena_session(
        "Prescriptions",
        "short summary",
        full_prompt=full,
    )
    assert seen["prompt"] == full
    assert "short summary" != seen["prompt"]
    assert seen["auto_submit"] is True
    assert "status=RUNNING" in result
    assert "DISPATCH_OK" in result
    saved = json.loads(Path(pt.ARENA_SESSIONS_FILE).read_text(encoding="utf-8"))
    assert saved[0]["status"] == "RUNNING"
    assert saved[0]["dispatch_ok"] is True
    assert len(saved[0]["prompt_summary"]) <= 200


def test_dispatch_failure_is_not_reported_as_running(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        pt,
        "send_prompt_to_arena_browser",
        lambda *_args, **_kwargs: "DISPATCH_FAILED reason=cdp_unavailable",
    )
    result = pt.dispatch_to_arena_session("Inbox", "summary", full_prompt="full ticket")
    assert "status=DISPATCH_FAILED" in result
    assert "status=RUNNING" not in result
    saved = json.loads(Path(pt.ARENA_SESSIONS_FILE).read_text(encoding="utf-8"))
    assert saved[0]["status"] == "DISPATCH_FAILED"


def test_send_opens_agent_and_does_not_fill_foreign_sprint(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    foreign = FakePage("https://arena.ai/agent/sprint-1", "Sprint 1")
    browser = FakeBrowser([foreign])
    monkeypatch.setattr(pt, "_cdp_browser_session", _cdp(browser))
    prompt = "FULL GOLDEN TICKET " + ("x" * 180)
    result = pt.send_prompt_to_arena_browser(
        prompt,
        session_id="arena-999-prescriptions",
        task_slug="prescriptions",
        auto_submit=True,
    )
    assert "DISPATCH_OK" in result
    assert "opened=/agent" in result
    assert foreign.filled is None
    opened = [page for page in browser.contexts[0].pages if page is not foreign]
    assert len(opened) == 1
    assert opened[0].goto_urls
    assert opened[0].goto_urls[0].rstrip("/").endswith("/agent")
    assert "/sprint-1" not in opened[0].goto_urls[0]
    assert opened[0].filled == prompt
    assert opened[0].submitted is True


def test_create_and_dispatch_sends_the_golden_ticket_once(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def fake_send(prompt_text: str, **_kwargs: object) -> str:
        calls.append(prompt_text)
        return (
            "DISPATCH_OK opened=/agent url=https://arena.ai/agent "
            "submitted=yes arena_session_id=- endpoint=test"
        )

    monkeypatch.setattr(pt, "send_prompt_to_arena_browser", fake_send)
    result = pt.create_and_dispatch_arena_task("Lab results page", "Add species filter")
    assert len(calls) == 1
    assert "GOLDEN TICKET" in calls[0]
    assert "Add species filter" in calls[0]
    assert "Lab results page" in calls[0]
    assert "status=RUNNING" in result or "DISPATCH_OK" in result


def test_repair_prompt_targets_the_stored_session(
    isolated: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pt._upsert_session({
        "session_id": "local-1",
        "task_id": "task-9",
        "arena_session_id": "remote-9",
        "arena_url": "https://arena.ai/agent/remote-9",
        "task_slug": "task-9",
        "status": "RUNNING",
        "module": "task-9",
    })
    seen: dict[str, object] = {}

    def fake_send(prompt_text: str, **kwargs: object) -> str:
        seen["prompt"] = prompt_text
        seen.update(kwargs)
        return (
            "DISPATCH_OK opened=existing url=https://arena.ai/agent/remote-9 "
            "submitted=yes arena_session_id=remote-9 endpoint=test"
        )

    monkeypatch.setattr(pt, "send_prompt_to_arena_browser", fake_send)
    pt.evaluate_verification_and_repair("task-9", "Type-Check FAILED\nerror TS2322")
    assert seen["session_id"] == "remote-9"
    assert str(seen["arena_url"]).endswith("/agent/remote-9")
    assert "TS2322" in str(seen["prompt"])


def test_session_updates_are_exact_and_lock_safe(isolated: Path) -> None:
    pt._upsert_session({"session_id": "sprint-1", "status": "RUNNING", "module": "one"})
    pt._upsert_session({"session_id": "sprint-10", "status": "RUNNING", "module": "ten"})
    pt._update_sessions_exact(["sprint-1"], status="COMPLETED", progress="done")
    by_id = {row["session_id"]: row["status"] for row in pt._load_sessions()}
    assert by_id["sprint-1"] == "COMPLETED"
    assert by_id["sprint-10"] == "RUNNING"

    barrier = threading.Barrier(8)

    def worker(index: int) -> None:
        barrier.wait()
        pt._upsert_session({
            "session_id": f"parallel-{index}",
            "status": "RUNNING",
            "module": f"m{index}",
        })

    threads = [threading.Thread(target=worker, args=(index,)) for index in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    saved = json.loads(Path(pt.ARENA_SESSIONS_FILE).read_text(encoding="utf-8"))
    ids = {row["session_id"] for row in saved}
    assert {f"parallel-{index}" for index in range(8)} <= ids


# ---------------------------------------------------------------------------
# Architectural audit
# ---------------------------------------------------------------------------

def test_upstream_candidates_include_documented_checkout() -> None:
    candidates = pt._upstream_root_candidates()
    assert any(path.endswith("OpenVPM") for path in candidates)
    assert any("Users" in path and "OpenVPM" in path for path in candidates)


def test_vanilla_routers_are_not_violations_when_upstream_has_them(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    routers = tmp_path / "OpenVPM" / "apps" / "web" / "server" / "routers"
    routers.mkdir(parents=True)
    (routers / "records.ts").write_text("export {}", encoding="utf-8")
    (routers / "whiteboard.ts").write_text("export {}", encoding="utf-8")
    monkeypatch.setenv("OPENVPM_UPSTREAM_DIR", str(tmp_path / "OpenVPM"))
    allowed = pt.audit_architectural_boundaries(
        "apps/web/server/routers/records.ts, "
        "apps/web/server/routers/whiteboard.ts, "
        "apps/web/server/routers/extensions/lab.ts, "
        "packages/db/schema/ext_ekasa.ts"
    )
    assert allowed.startswith("✅")
    assert "PORUŠENIA" not in allowed

    custom = pt.audit_architectural_boundaries("apps/web/server/routers/lab-import.ts")
    assert "PORUŠENIA" in custom
    assert "lab-import.ts" in custom
    assert "extensions/" in custom

    mixed = pt.audit_architectural_boundaries(
        r"apps\web\server\routers\records.ts, packages/db/schema/patients.ts"
    )
    assert "patients.ts" in mixed
    assert "records.ts" not in mixed


def test_known_vanilla_routers_are_not_false_positives_without_checkout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pt, "_upstream_router_dirs", lambda: [])
    allowed = pt.audit_architectural_boundaries(
        "apps/web/server/routers/records.ts, apps/web/server/routers/whiteboard.ts"
    )
    assert allowed.startswith("✅")
    unknown = pt.audit_architectural_boundaries("apps/web/server/routers/not-vanilla.ts")
    assert "PORUŠENIA" in unknown
    journal = pt.audit_architectural_boundaries("packages/db/drizzle/meta/_journal.json")
    assert "_journal.json" in journal


def test_team_os_instructions_encode_the_reliability_contract() -> None:
    text = (AGNO_DIR / "pipeline_team_os.py").read_text(encoding="utf-8")
    assert "DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS" in text
    assert "/agent/<session_id>" in text
    assert "records.ts" in text
    assert "whiteboard.ts" in text
    assert "status=COMPLETED" in text
    assert "studio_seed.lock" in text
    assert "JSON záznam" in text
