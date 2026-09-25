"""Prompt-template tests for the Arena Golden Ticket generators.

Closes the gap left by ``tasks/arena-sprint-prompt-engineering-audit.md``, which
identified three chronic defects and was never implemented:

1. **Prompt bloat / nesting** — when ``requirements`` (or a sprint assignment)
   is *already* a Golden Ticket, embedding it into a new ticket produced a
   duplicate ``# GOLDEN TICKET`` H1 and duplicate ``## 1. Context / Why`` /
   ``Scope`` / ``Definition of Done`` sections. Reproduced in the wild by
   ``tasks/arena-1790286107-arena-sprint-8-billing-ledger-.md``, which contains
   two H1 headers and two ``## 1. Context / Why`` headings.
2. **Sandbox OOM** — a full monorepo ``tsc --noEmit`` needs 2.2-2.8 GB and dies
   with exit 134 in a 2-4 GB Arena sandbox, so the ticket must instruct
   ``NODE_OPTIONS=--max-old-space-size=3500`` and targeted verification.
3. **Error signalling** — ground-truth failures must not be returned as prose
   strings that an LLM caller reads as data.

No live Chrome, AgentOS, or network access is required.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

AGNO_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGNO_DIR))

import pipeline_tools as pt  # noqa: E402


REPO_ROOT = AGNO_DIR.parents[1]
SPRINT8_DISPATCH_FILE = REPO_ROOT / "tasks" / "arena-1790286107-arena-sprint-8-billing-ledger-.md"


def _headings(text: str) -> list[tuple[int, str]]:
    return [
        (len(m.group(1)), m.group(2).strip())
        for m in re.finditer(r"^(#{1,6})\s+(.*)$", text, re.MULTILINE)
    ]


def _level_histogram(text: str) -> dict[int, int]:
    out: dict[int, int] = {}
    for level, _ in _headings(text):
        out[level] = out.get(level, 0) + 1
    return out


# ---------------------------------------------------------------------------
# 1. Nested Golden Ticket prevention
# ---------------------------------------------------------------------------

def test_sanitize_leaves_plain_requirements_untouched() -> None:
    """A normal requirement string must pass through byte-identical."""
    plain = "Add a species filter to the lab results table.\n- [ ] Tests pass\n"
    assert pt.sanitize_golden_ticket_prompt(plain) == plain


def test_sanitize_removes_nested_golden_ticket_headers() -> None:
    """The documented defect: two H1s and two `## 1. Context / Why` sections."""
    nested = (
        "<system_prompt>\n"
        "Si špičkový autonómny full-stack softvérový inžinier.\n\n"
        "# GOLDEN TICKET: Outer wrapper\n\n"
        "## 1. Context / Why\nBoilerplate we regenerate ourselves.\n\n"
        "## 3. Acceptance Criteria (Definition of Done)\n"
        "# GOLDEN TICKET: The real ticket\n\n"
        "## 1. Context / Why\nThe actual requirement.\n\n"
        "## 2. Scope\n- app/(dashboard)/billing/page.tsx\n"
        "</system_prompt>\n"
    )
    clean = pt.sanitize_golden_ticket_prompt(nested)

    assert clean.upper().count("# GOLDEN TICKET") == 0, "nested H1 headers must be stripped"
    assert "<system_prompt>" not in clean, "wrapper tags are supplied by the generator"
    assert "</system_prompt>" not in clean
    assert "The actual requirement." in clean, "content must never be dropped"
    assert "app/(dashboard)/billing/page.tsx" in clean


def test_sanitize_never_drops_content() -> None:
    """Sanitisation demotes structure; it must not lose a single requirement line."""
    body_lines = [
        "- Bring /billing in line with the Dashboard UI Kit.",
        "- Eliminate double gaps from `mt-4` fighting `space-y-6`.",
        "- Use semantic tokens, not raw palette classes.",
    ]
    nested = "# GOLDEN TICKET: X\n\n## 1. Context / Why\n" + "\n".join(body_lines) + "\n"
    clean = pt.sanitize_golden_ticket_prompt(nested)
    for line in body_lines:
        assert line in clean


def test_sanitize_demotes_headings_so_they_cannot_collide() -> None:
    """Every surviving heading must sit at least 2 levels below the ticket frame."""
    nested = (
        "# GOLDEN TICKET: X\n\n"
        "## 1. Context / Why\nA\n\n"
        "### In Scope\nB\n\n"
        "#### Detail\nC\n"
    )
    clean = pt.sanitize_golden_ticket_prompt(nested)
    levels = [level for level, _ in _headings(clean)]
    assert levels, "headings should survive, just demoted"
    # Original H2 -> H4, H3 -> H5, H4 -> H6. Nothing may land at H1 or H2.
    assert min(levels) >= 4, f"a heading still collides with the ## frame: {levels}"
    assert max(levels) <= 6


@pytest.mark.skipif(
    not SPRINT8_DISPATCH_FILE.exists(),
    reason="tasks/ library not present in this checkout",
)
def test_real_world_sprint8_file_has_the_defect_and_is_fixed() -> None:
    """Regression anchor: the committed dispatcher file really was doubly wrapped."""
    raw = SPRINT8_DISPATCH_FILE.read_text(encoding="utf-8")

    raw_h1 = [h for h in _headings(raw) if h[0] == 1]
    assert len(raw_h1) == 2, "fixture no longer reproduces the double-H1 defect"
    assert raw.count("## 1. Context / Why") == 2

    clean = pt.sanitize_golden_ticket_prompt(raw)
    assert [h for h in _headings(clean) if h[0] == 1] == [], "no H1 may survive"
    # The distinctive real requirement must still be present after sanitising.
    assert "Single unified vertical spacing system" in clean
    # And no surviving heading may sit at the ticket frame's level.
    assert min(level for level, _ in _headings(clean)) >= 4


# ---------------------------------------------------------------------------
# 2. Generated tickets are structurally sound
# ---------------------------------------------------------------------------

@pytest.fixture()
def isolated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point session/task writes at a throwaway repo.

    Deliberately local rather than shared via conftest.py: the existing
    test_pipeline_tools.py defines its own identical fixture, and moving it would
    couple two suites that are currently independent.
    """
    repo = tmp_path / "openvpm-ai"
    (repo / "tasks").mkdir(parents=True)
    scratch = tmp_path / "tmp"
    scratch.mkdir()
    monkeypatch.setattr(pt, "REPO_DIR", str(repo))
    monkeypatch.setattr(pt, "TMP_DIR", str(scratch))
    monkeypatch.setattr(pt, "ARENA_SESSIONS_FILE", str(scratch / "arena_sessions.json"))
    monkeypatch.setattr(pt, "ARENA_NAVIGATION_WAIT_SECONDS", 0)
    monkeypatch.setattr(pt, "_sleep", lambda *_args, **_kwargs: None)
    return repo


@pytest.fixture()
def captured_dispatch(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    sent: list[str] = []

    def fake_send(prompt_text: str, **_kwargs: object) -> str:
        sent.append(prompt_text)
        return "DISPATCH_OK opened=/agent url=https://arena.ai/agent submitted=yes"

    monkeypatch.setattr(pt, "send_prompt_to_arena_browser", fake_send)
    return sent


def test_create_and_dispatch_emits_exactly_one_system_prompt_frame(
    isolated: Path,
    captured_dispatch: list[str],
) -> None:
    pt.create_and_dispatch_arena_task("Lab results page", "Add species filter")
    assert len(captured_dispatch) == 1
    prompt = captured_dispatch[0]
    assert prompt.count("<system_prompt>") == 1
    assert prompt.count("</system_prompt>") == 1
    assert prompt.upper().count("# GOLDEN TICKET") == 1


def test_create_and_dispatch_deduplicates_prewrapped_requirements(
    isolated: Path,
    captured_dispatch: list[str],
) -> None:
    """Passing an existing Golden Ticket must not produce a ticket-in-ticket."""
    already_a_ticket = (
        "<system_prompt>\n# GOLDEN TICKET: Inner\n\n"
        "## 1. Context / Why\nInner context.\n\n"
        "## 2. Scope\n- apps/web/app/(dashboard)/lab-results/page.tsx\n"
        "</system_prompt>\n"
    )
    pt.create_and_dispatch_arena_task("Lab results page", already_a_ticket)
    prompt = captured_dispatch[0]

    assert prompt.upper().count("# GOLDEN TICKET") == 1, "nested ticket leaked through"
    assert prompt.count("<system_prompt>") == 1
    assert "Inner context." in prompt, "the real requirements must survive"
    assert "apps/web/app/(dashboard)/lab-results/page.tsx" in prompt


def test_create_and_dispatch_includes_sandbox_memory_guard(
    isolated: Path,
    captured_dispatch: list[str],
) -> None:
    pt.create_and_dispatch_arena_task("Lab results page", "Add species filter")
    prompt = captured_dispatch[0]
    assert "NODE_OPTIONS" in prompt
    assert "--max-old-space-size=3500" in prompt
    assert "OOM" in prompt


# ---------------------------------------------------------------------------
# 3. Fail-loud ground truth (see commit fixing the silent "Chyba:" strings)
# ---------------------------------------------------------------------------

def test_missing_sprint_returns_sentinel_and_lists_what_exists() -> None:
    result = pt.read_sprint_assignment(9999)
    assert result.startswith("ASSIGNMENT_NOT_FOUND"), result[:80]


def test_missing_index_is_a_sentinel_not_prose(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pt, "_get_repo_path", lambda: str(tmp_path))
    result = pt.list_arena_sprints()
    assert result.startswith("GROUND_TRUTH_MISSING"), result[:80]
    assert "git log" in result, "must tell the caller how to re-derive truth"


def test_format_sprint_prompt_passes_sentinel_through_unchanged() -> None:
    """A missing assignment must be returned as the sentinel, never wrapped into a ticket."""
    result = pt.format_arena_sprint_prompt(9999)
    assert result.startswith("ASSIGNMENT_NOT_FOUND")
    assert "# GOLDEN TICKET" not in result, "an error must not become a ticket body"
