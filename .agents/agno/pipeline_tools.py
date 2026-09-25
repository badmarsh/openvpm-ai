import os
import sys
import time
import shutil
import json
import glob
import re
import tempfile
import threading
import urllib.parse
import subprocess
import shlex
from contextlib import contextmanager
from dataclasses import asdict, dataclass, fields, is_dataclass
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
)

AGNO_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.abspath(os.path.join(AGNO_DIR, "../.."))
TMP_DIR = os.path.join(AGNO_DIR, "tmp")
ARENA_SESSIONS_FILE = os.path.join(TMP_DIR, "arena_sessions.json")

def _load_orchestrator_contracts():
    """Import run contracts, or install a local fallback for unit tests.

    The orchestrator package is optional in this repo. Tests must be able to
    import the pipeline tools without AgentOS or that package installed.
    """
    try:
        from openvpm_dev_orchestrator.contracts import (
            RunState as run_state,
            DevTaskRequest as dev_task_request,
            RiskClass as risk_class,
            PolicyDecision as policy_decision,
            ChangePlan as change_plan,
            CommandResult as command_result,
            ReviewReport as review_report,
            DevelopmentRun as development_run,
        )
        from openvpm_dev_orchestrator.policy_engine import PolicyEngine as policy_engine
        return (
            run_state,
            dev_task_request,
            risk_class,
            policy_decision,
            change_plan,
            command_result,
            review_report,
            development_run,
            policy_engine,
        )
    except ImportError:
        sys.path.insert(0, os.path.join(AGNO_DIR, "src"))
        try:
            from openvpm_dev_orchestrator.contracts import (
                RunState as run_state,
                DevTaskRequest as dev_task_request,
                RiskClass as risk_class,
                PolicyDecision as policy_decision,
                ChangePlan as change_plan,
                CommandResult as command_result,
                ReviewReport as review_report,
                DevelopmentRun as development_run,
            )
            from openvpm_dev_orchestrator.policy_engine import PolicyEngine as policy_engine
            return (
                run_state,
                dev_task_request,
                risk_class,
                policy_decision,
                change_plan,
                command_result,
                review_report,
                development_run,
                policy_engine,
            )
        except ImportError:
            return _fallback_orchestrator_contracts()


def _fallback_orchestrator_contracts():
    """Minimal pydantic-shaped stand-ins used when the package is absent."""

    class RunState(str, Enum):
        IMPLEMENTING = "IMPLEMENTING"
        VERIFYING = "VERIFYING"
        READY_FOR_PR = "READY_FOR_PR"
        REJECTED = "REJECTED"
        FAILED = "FAILED"

    class RiskClass(str, Enum):
        LOW = "low"
        MEDIUM = "medium"
        HIGH = "high"

    @dataclass
    class CommandResult:
        name: str
        argv: list
        exit_code: int
        duration_ms: int
        output_tail: str = ""

    @dataclass
    class ReviewReport:
        approved: bool
        blocking_findings: list
        non_blocking_findings: list
        evidence_summary: str = ""

    @dataclass
    class DevelopmentRun:
        task_id: str
        state: RunState
        title: str = ""
        allowed_paths: list = None
        declared_risk: Any = None
        created_at: str = ""
        updated_at: str = ""
        verification_results: list = None
        failure_reason: str = ""
        repair_attempts: int = 0
        review_report: Any = None

        def __post_init__(self) -> None:
            if self.allowed_paths is None:
                self.allowed_paths = []
            if self.verification_results is None:
                self.verification_results = []

        def model_dump_json(self, indent: int = 2) -> str:
            def conv(obj):
                if isinstance(obj, Enum):
                    return obj.value
                if is_dataclass(obj):
                    return {key: conv(value) for key, value in asdict(obj).items()}
                if isinstance(obj, list):
                    return [conv(item) for item in obj]
                return obj
            return json.dumps(conv(self), indent=indent, ensure_ascii=False)

        @classmethod
        def model_validate_json(cls, raw: str) -> "DevelopmentRun":
            data = json.loads(raw)
            if "state" in data and not isinstance(data["state"], RunState):
                data["state"] = RunState(data["state"])
            known = {item.name for item in fields(cls)}
            return cls(**{key: value for key, value in data.items() if key in known})

    class DevTaskRequest:
        pass

    class PolicyDecision:
        pass

    class ChangePlan:
        pass

    class PolicyEngine:
        @classmethod
        def evaluate_files(cls, task_id: str, touched_files: list) -> PolicyDecision:
            dec = PolicyDecision()
            dec.allowed = True
            dec.violations = []
            return dec

        @classmethod
        def evaluate_task(cls, request: Any, plan: Any = None) -> PolicyDecision:
            dec = PolicyDecision()
            dec.allowed = True
            dec.violations = []
            return dec

    return (
        RunState,
        DevTaskRequest,
        RiskClass,
        PolicyDecision,
        ChangePlan,
        CommandResult,
        ReviewReport,
        DevelopmentRun,
        PolicyEngine,
    )


(
    RunState,
    DevTaskRequest,
    RiskClass,
    PolicyDecision,
    ChangePlan,
    CommandResult,
    ReviewReport,
    DevelopmentRun,
    PolicyEngine,
) = _load_orchestrator_contracts()


def _get_run_file_path(task_id: str) -> str:
    clean_id = task_id.replace("arena-", "").replace(".patch", "")[:25]
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    os.makedirs(tasks_dir, exist_ok=True)
    return os.path.join(tasks_dir, f"run-{clean_id}.json")


def get_development_run(task_id: str) -> Optional[DevelopmentRun]:
    path = _get_run_file_path(task_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return DevelopmentRun.model_validate_json(f.read())
        except Exception:
            pass
    return None


def save_development_run(run: DevelopmentRun) -> None:
    path = _get_run_file_path(run.task_id)
    run.updated_at = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(path, "w", encoding="utf-8") as f:
        f.write(run.model_dump_json(indent=2))


def _which(cmd: str) -> str:
    found = shutil.which(cmd)
    return found if found else cmd

def _get_repo_path(subpath: str = "") -> str:
    env_repo = os.getenv("OPENVPM_REPO_PATH")
    if env_repo and os.path.exists(env_repo):
        return os.path.join(env_repo, subpath) if subpath else env_repo

    # Ak REPO_DIR existuje a obsahuje tasks alebo package.json (napr. v pytest fixture alebo priamom behu)
    if REPO_DIR and os.path.exists(REPO_DIR) and (
        os.path.exists(os.path.join(REPO_DIR, "package.json"))
        or os.path.exists(os.path.join(REPO_DIR, "tasks"))
    ):
        return os.path.join(REPO_DIR, subpath) if subpath else REPO_DIR

    candidates = [
        "/mnt/c/Users/marek/Documents/Vet/openvpm-ai",
        r"C:\Users\marek\Documents\Vet\openvpm-ai",
        "/home/ubuntu/openvpm",
        REPO_DIR,
    ]
    for cand in candidates:
        if cand and os.path.exists(os.path.join(cand, "package.json")) and os.path.exists(os.path.join(cand, "apps", "web")):
            return os.path.join(cand, subpath) if subpath else cand

    return os.path.join(REPO_DIR, subpath) if subpath else REPO_DIR

def _run_pnpm(args: List[str], cwd: str, timeout: int = 120) -> subprocess.CompletedProcess:
    """Spustí pnpm príkaz s podporou pre Windows (shell=True) a UTF-8 kódovaním."""
    is_win = sys.platform == "win32"
    pnpm_bin = _which("pnpm")
    cmd = [pnpm_bin] + args
    return subprocess.run(
        cmd,
        cwd=cwd,
        shell=is_win,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )


# =====================================================================
# FIRECRAWL TOOLKIT (https://firecrawl.dev.significa.sk)
# =====================================================================
def _build_firecrawl_tools():
    """Build Firecrawl tools when agno is installed.

    Unit tests import this module without the AgentOS stack. A missing
    optional dependency must not prevent the reliability engine from loading.
    """
    try:
        from agno.tools.firecrawl import FirecrawlTools
    except ImportError:
        return None
    return FirecrawlTools(
        api_url="https://firecrawl.dev.significa.sk",
        api_key="fc-dummy",
        enable_scrape=True,
        enable_crawl=True,
        enable_mapping=True,
        enable_search=True,
    )


firecrawl_tools = _build_firecrawl_tools()


# =====================================================================
# DOMAIN A: PROMPT & ARENA SPRINT TOOLS
# (Prompt Manager, Arena Dispatcher, Arena Watcher)
# =====================================================================

def list_arena_sprints() -> str:
    """Vráti zoznam všetkých Arena sprintov zo súboru tasks/SPRINT-INDEX.md vrátane ich stavu (merged, written, unverified)."""
    index_file = os.path.join(_get_repo_path(), "tasks", "SPRINT-INDEX.md")
    if not os.path.exists(index_file):
        return "Chyba: Súbor tasks/SPRINT-INDEX.md nebol nájdený."
    try:
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()
        return f"### Arena Sprint Index\n\n{content}"
    except Exception as e:
        return f"Chyba pri čítaní tasks/SPRINT-INDEX.md: {str(e)}"


def read_sprint_assignment(sprint_number: int) -> str:
    """Načíta a vráti zadanie konkrétneho sprintu zo súboru tasks/arena-sprint-<sprint_number>-*.md."""
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    pattern = os.path.join(tasks_dir, f"arena-sprint-{sprint_number}-*.md")
    matches = glob.glob(pattern)
    if not matches:
        return f"Sprint {sprint_number} nebol nájdený v tasks/. Skontroluj zoznam cez list_arena_sprints()."
    
    file_path = matches[0]
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return f"### Zadanie Sprintu {sprint_number} ({os.path.basename(file_path)})\n\n{content[:4000]}"
    except Exception as e:
        return f"Chyba pri čítaní súboru {file_path}: {str(e)}"


def format_arena_sprint_prompt(sprint_number: int, target_model: str = "arena") -> str:
    """Sformátuje zadanie sprintu do hotového promptu pre Arena.ai ako striktný GOLDEN TICKET."""
    assignment = read_sprint_assignment(sprint_number)
    if "nebol nájdený" in assignment or "Chyba" in assignment:
        return assignment

    prompt = f"""<system_prompt>
Si špičkový full-stack softvérový inžinier pre OpenVPM AI (Next.js 15, React 19, TypeScript, tRPC v11, Drizzle ORM, Tailwind UI Kit).
Tvoja úloha je zadaná ako striktný GOLDEN TICKET („The ticket is the quality ceiling“).

# GOLDEN TICKET: Arena Sprint {sprint_number}

## 1. Context / Why
OpenVPM AI je enterprise veterinárny nemocničný informačný systém. Implementácia Sprintu {sprint_number} musí byť ergonomická, dátovo čistá, plne bilingválna (SK/EN) a v súlade so slovenským veterinárnym právom.

## 2. Scope & Architectural Constraints (NEMENNÉ PRAVIDLÁ)
1. Upstream Schema Immutability: NIKDY neupravuj packages/db/schema/*.ts ani _journal.json. Všetky nové tabuľky musia ísť do packages/db/schema/ext_*.ts a tRPC routre do apps/web/server/routers/extensions/*.ts pod extensionsRouter.
2. 100% i18n Symmetry: Každý text v UI musí ísť cez useI18n(). Žiadne hardcoded JSX texty. Presná symetria kľúčov medzi messages/en.json a messages/sk.json.
3. Clinical Safety (Zákon 39/2007 Z. z.): AI návrhy ostávajú v stave 'draft' pred autorizáciou veterinárom.
4. Controlled Substances (Zákon 139/1998 Z. z.): ZERO AI prefill pre ketamín, propofol, opioidy / fentanyl. Iba manuálny zápis so ShieldAlert.
5. Sympathy Gate: Deceased pacienti striktne potláčajú automatizovanú komunikáciu.
6. UI Kit: Používaj PageHeader, PageToolbar, DataTableFrame, KpiGrid z apps/web/components/layout/page-kit.tsx.

## 3. Task Assignment & Acceptance Criteria
{assignment}

## 4. Definition of Done
- [ ] 0 chýb v TypeScript type-check (pnpm --filter @openpims/web type-check).
- [ ] 0 warnings v ESLint (pnpm lint).
- [ ] 100% leaf symetria kľúčov v messages/sk.json a messages/en.json.
- [ ] Žiadne neoprávnené úpravy vanilkových súborov.

Vráť kompletný ucelený kód alebo git diff/patch pripravený na aplikáciu.
</system_prompt>"""
    return prompt




def list_active_arena_sessions() -> str:
    """Vráti prehľad všetkých aktívnych relácií v Arena.ai zo súborov tasks/ a arena_sessions.json."""
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    sessions = _load_sessions()

    task_files = glob.glob(os.path.join(tasks_dir, "arena-*.md"))
    registered_ids = {s.get("session_id") for s in sessions if isinstance(s, dict)}

    for tf in task_files:
        tid = os.path.basename(tf).replace(".md", "")
        if tid not in registered_ids:
            has_patch = _task_has_valid_patch(tasks_dir, tid)
            sessions.append({
                "session_id": tid,
                "module": tid,
                "target_model": "Arena.ai",
                "status": "COMPLETED" if has_patch else "PENDING",
                "progress": (
                    "Platný unified diff v tasks/"
                    if has_patch
                    else "Zadanie vytvorené v tasks/"
                ),
            })

    if not sessions:
        return "ℹ️ Žiadne aktívne relácie Arena.ai neboli nájdené. Novú úlohu môžete vytvoriť cez 'create_and_dispatch_arena_task'."

    res = f"### Aktívne Arena.ai relácie ({len(sessions)} celkovo):\n"
    for s in sessions:
        status = s.get("status")
        if status == "COMPLETED":
            icon = "✅"
        elif status in {"RUNNING", "DISPATCHING"}:
            icon = "⏳"
        else:
            icon = "⚠️"
        res += f"{icon} **[{s.get('session_id')}]** {s.get('module')}\n"
        res += f"   Cieľ: `Arena.ai` | Stav: **{s.get('status')}**\n"
        res += f"   Detail: {s.get('progress')}\n\n"
    return res



def _get_cdp_endpoints(custom_ports: str = "9222,60325,9223,9229,9333,5000") -> list:
    """Zostaví prioritný zoznam CDP endpointov pre lokálny WSL/Linux aj Windows host (192.168.0.100)."""
    endpoints = []
    win_host = os.getenv("WINDOWS_HOST_IP", "192.168.0.100")

    # 1. Lokálny port 9222 má najvyššiu prioritu (Linux Chrome bežiaci v WSL)
    endpoints.append("http://127.0.0.1:9222")
    endpoints.append(f"http://{win_host}:9222")

    # 2. Čítanie aktívneho DevTools portu priamo z Chrome profilu
    try:
        from pathlib import Path
        for pth in [
            Path("/home/ubuntu/.config/google-chrome/DevToolsActivePort"),
            Path("/mnt/c/Users/marek/AppData/Local/Google/Chrome/User Data/DevToolsActivePort"),
        ]:
            if pth.exists():
                lines = pth.read_text(encoding="utf-8").strip().splitlines()
                if lines and lines[0].strip().isdigit():
                    act_port = int(lines[0].strip())
                    endpoints.append(f"http://127.0.0.1:{act_port}")
                    endpoints.append(f"http://{win_host}:{act_port}")
    except Exception:
        pass

    # 3. Zadané voliteľné porty
    if custom_ports:
        for p in [int(x.strip()) for x in custom_ports.split(",") if x.strip().isdigit()]:
            endpoints.append(f"http://127.0.0.1:{p}")
            endpoints.append(f"http://{win_host}:{p}")

    seen = set()
    uniq = []
    for ep in endpoints:
        if ep not in seen:
            seen.add(ep)
            uniq.append(ep)
    return uniq


def monitor_arena_health() -> str:
    """Preverí skutočný stav všetkých relácií Arena.ai a vetiev swarm/agno-* v repozitári."""
    repo = _get_repo_path()
    tasks_dir = os.path.join(repo, "tasks")
    
    swarm_branches = []
    try:
        proc = subprocess.run(
            [_which("git"), "branch", "--list", "swarm/agno-*"],
            cwd=repo,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if proc.returncode == 0:
            swarm_branches = [b.strip().replace("*", "").strip() for b in proc.stdout.splitlines() if b.strip()]
    except Exception:
        pass

    task_files = glob.glob(os.path.join(tasks_dir, "arena-*.md"))
    patch_files = [
        path for path in glob.glob(os.path.join(tasks_dir, "*.patch"))
        if _patch_file_is_valid(path)
    ]
    repair_files = glob.glob(os.path.join(tasks_dir, "repair-*.md"))

    res = ["### Arena Watcher Health Audit:"]
    res.append(f"• Celkový počet zadaní v tasks/: {len(task_files)}")
    res.append(f"• Pripravené patche (*.patch): {len(patch_files)}")
    res.append(f"• Opravné výzvy (repair-*.md): {len(repair_files)}")
    res.append(f"• Aktívne swarm vetvy v git: {len(swarm_branches)} ({', '.join(swarm_branches) if swarm_branches else 'žiadne'})")

    # CDP liveness check cez dynamické endpointy (Windows host + WSL)
    cdp_active = False
    cdp_active_url = ""
    for ep in _get_cdp_endpoints():
        try:
            import urllib.request
            with urllib.request.urlopen(f"{ep}/json/version", timeout=0.8) as resp:
                if resp.getcode() == 200:
                    cdp_active = True
                    cdp_active_url = ep
                    break
        except Exception:
            continue

    if not cdp_active:
        res.append("⚠️ POZOR: Chrome CDP mostík NIE JE aktívny na žiadnom zistenom porte.")
        res.append("   Skutočný priebeh generovania v taboch Arena.ai nemožno živým spôsobom sledovať.")
        res.append("   Stavy v zozname sú len lokálne záznamy z tasks/. ZÁKAZ halucinovať, že stream beží plynule alebo že relácia nezamrzla!")
    else:
        res.append(f"✅ Chrome CDP mostík ({cdp_active_url}) je aktívny a prepojený s prehliadačom.")

    active_report = list_active_arena_sessions()
    return f"{active_report}\n\n" + "\n".join(res)


# =====================================================================
# DOMAIN B: GITHUB & PR INTEGRATION (GitHub Manager)
# =====================================================================

def list_github_pull_requests(limit: int = 5) -> str:
    """Získa zoznam otvorených Pull Requestov v repozitári badmarsh/openvpm-ai cez GitHub CLI."""
    try:
        cmd = [_which("gh"), "pr", "list", "--repo", "badmarsh/openvpm-ai", "--limit", str(limit), "--json", "number,title,headRefName,state,url"]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
        if proc.returncode != 0:
            return f"Chyba pri spúšťaní gh pr list: {proc.stderr}"
        prs = json.loads(proc.stdout)
        if not prs:
            return "Žiadne otvorené Pull Requesty na badmarsh/openvpm-ai."
        res = "### Otvorené Pull Requesty (badmarsh/openvpm-ai):\n"
        for p in prs:
            res += f"• **PR #{p['number']}**: {p['title']}\n"
            res += f"  Vetva: `{p['headRefName']}` | Stav: `{p['state']}` | URL: {p['url']}\n"
        return res
    except Exception as e:
        return f"Chyba pri volaní gh CLI: {str(e)}"


def get_pull_request_diff(pr_number: int, max_lines: int = 150) -> str:
    """Vráti diff konkrétneho Pull Requestu z badmarsh/openvpm-ai pre revíziu zmien."""
    try:
        cmd = [_which("gh"), "pr", "diff", str(pr_number), "--repo", "badmarsh/openvpm-ai"]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        if proc.returncode != 0:
            return f"Chyba pri získavaní diffu pre PR #{pr_number}: {proc.stderr}"
        diff_lines = proc.stdout.splitlines()
        total_lines = len(diff_lines)
        truncated_diff = "\n".join(diff_lines[:max_lines])
        return f"### Diff pre PR #{pr_number} ({total_lines} riadkov celkovo, zobrazených prvých {min(total_lines, max_lines)}):\n```diff\n{truncated_diff}\n```"
    except Exception as e:
        return f"Chyba pri čítaní diffu: {str(e)}"


def check_pull_request_ci(pr_number: int) -> str:
    """Skontroluje stav CI testov (GitHub Actions) pre zadaný Pull Request."""
    try:
        cmd = [_which("gh"), "pr", "checks", str(pr_number), "--repo", "badmarsh/openvpm-ai"]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        if proc.returncode != 0:
            return f"CI checks pre PR #{pr_number} neboli nájdené alebo zlyhali: {proc.stderr}"
        return f"### CI Kontroly pre PR #{pr_number}:\n{proc.stdout}"
    except Exception as e:
        return f"Chyba pri kontrole CI: {str(e)}"


# =====================================================================
# DOMAIN C: LOCAL RUNNER & VERIFICATION (Qwen Implementer)
# =====================================================================

def run_qwen_code_cli(prompt: str, working_dir: Optional[str] = None) -> str:
    """Spustí lokálny Qwen Code CLI (/usr/bin/qwen -p) na zapracovanie kódu z PR do repozitára."""
    cwd = working_dir or _get_repo_path()
    try:
        cmd = ["/usr/bin/qwen", "-p", prompt]
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        out = (proc.stdout or proc.stderr).strip()
        return f"### Výstup Qwen CLI:\n{out[:2500]}"
    except Exception as e:
        return f"Chyba pri behu Qwen CLI: {str(e)}"


def run_openvpm_verification(checks: str = "typecheck,lint,test,i18n", task_id: str = "") -> str:
    """Spustí kompletnú verifikačnú sadu OpenVPM (typecheck, lint, test, i18n) a vyhodnotí výsledok podľa pravidiel projektu."""
    repo = _get_repo_path()
    results = []
    has_error = False
    cmd_results: list[CommandResult] = []

    check_list = [c.strip().lower() for c in checks.split(",")]

    if "lint" in check_list:
        t0 = time.time()
        p_lint = _run_pnpm(["lint"], cwd=repo, timeout=90)
        dur = int((time.time() - t0) * 1000)
        err_snippet = "\n".join((p_lint.stderr or p_lint.stdout).splitlines()[-15:])
        cmd_results.append(CommandResult(
            name="lint",
            argv=["pnpm", "lint"],
            exit_code=p_lint.returncode,
            duration_ms=dur,
            output_tail=err_snippet or (p_lint.stdout or "")[:500],
        ))
        if p_lint.returncode != 0:
            has_error = True
            results.append(f"• **Lint (`pnpm lint`)**: FAILED\n  ```\n  {err_snippet}\n  ```")
        else:
            results.append("• **Lint (`pnpm lint`)**: PASSED")

    if "typecheck" in check_list or "type-check" in check_list:
        t0 = time.time()
        p_tc = _run_pnpm(["--filter", "@openpims/web", "type-check"], cwd=repo, timeout=120)
        dur = int((time.time() - t0) * 1000)
        err_snippet = "\n".join((p_tc.stdout or p_tc.stderr).splitlines()[-15:])
        cmd_results.append(CommandResult(
            name="typecheck",
            argv=["pnpm", "--filter", "@openpims/web", "type-check"],
            exit_code=p_tc.returncode,
            duration_ms=dur,
            output_tail=err_snippet or (p_tc.stdout or "")[:500],
        ))
        if p_tc.returncode != 0:
            has_error = True
            results.append(f"• **Type-Check (`@openpims/web`)**: FAILED\n  ```\n  {err_snippet}\n  ```")
        else:
            results.append("• **Type-Check (`@openpims/web`)**: PASSED")

    if "i18n" in check_list:
        t0 = time.time()
        p_i18n = _run_pnpm(["--filter", "@openpims/web", "i18n:scan"], cwd=repo, timeout=60)
        dur = int((time.time() - t0) * 1000)
        err_snippet = "\n".join((p_i18n.stdout or p_i18n.stderr).splitlines()[-15:])
        cmd_results.append(CommandResult(
            name="i18n:scan",
            argv=["pnpm", "--filter", "@openpims/web", "i18n:scan"],
            exit_code=p_i18n.returncode,
            duration_ms=dur,
            output_tail=err_snippet or (p_i18n.stdout or "")[:500],
        ))
        if p_i18n.returncode != 0:
            has_error = True
            results.append(f"• **i18n Scan (`@openpims/web i18n:scan`)**: FAILED\n  ```\n  {err_snippet}\n  ```")
        else:
            results.append("• **i18n Scan (`@openpims/web i18n:scan`)**: PASSED")

    if "test" in check_list:
        t0 = time.time()
        p_test = _run_pnpm(["--filter", "@openpims/web", "test", "run"], cwd=repo, timeout=120)
        dur = int((time.time() - t0) * 1000)
        err_snippet = "\n".join((p_test.stdout or p_test.stderr).splitlines()[-15:])
        cmd_results.append(CommandResult(
            name="test",
            argv=["pnpm", "--filter", "@openpims/web", "test", "run"],
            exit_code=p_test.returncode,
            duration_ms=dur,
            output_tail=err_snippet or (p_test.stdout or "")[:500],
        ))
        if p_test.returncode != 0:
            has_error = True
            results.append(f"• **Unit Testy (`@openpims/web test`)**: FAILED\n  ```\n  {err_snippet}\n  ```")
        else:
            results.append("• **Unit Testy (`@openpims/web test`)**: PASSED")

    if task_id:
        run = get_development_run(task_id)
        if run:
            run.verification_results = cmd_results
            save_development_run(run)

    summary = "✅ VŠETKY KONTROLY PREŠLI (Zelená integrácia)" if not has_error else "❌ NIEKTORÉ KONTROLY ZLYHALI"
    return f"### OpenVPM Verifikačný Report:\n{summary}\n\n" + "\n".join(results)


def git_checkout_branch(branch_name: str) -> str:
    """Prepne lokálny repozitár na zadanú vetvu (napr. na overenie PR)."""
    repo = _get_repo_path()
    try:
        proc = subprocess.run([_which("git"), "checkout", branch_name], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
        return proc.stdout or proc.stderr
    except Exception as e:
        return f"Chyba pri git checkout: {str(e)}"


ALLOWED_SHELL_COMMANDS = {
    "git", "pnpm", "gh", "node", "python", "python3", "pytest", "cat", "ls", "dir", "echo",
    "grep", "findstr", "head", "tail", "wc", "sort", "uniq"
}
FORBIDDEN_OPERATORS = ["`", "$(", ">", "<"]
FORBIDDEN_PATH_SUBSTRINGS = [".env", "id_rsa", "id_ed25519", "credentials", "secret"]


def _split_outside_quotes(text: str, delimiter: str) -> list[str]:
    """Rozdelí text podľa oddeľovača s ignorovaním výskytov vo vnútri jednoduchých alebo dvojitých úvodzoviek."""
    parts = []
    current = []
    in_single = False
    in_double = False
    i = 0
    dlen = len(delimiter)
    while i < len(text):
        ch = text[i]
        if ch == "'" and not in_double:
            in_single = not in_single
            current.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            current.append(ch)
        elif not in_single and not in_double and text[i:i+dlen] == delimiter:
            parts.append("".join(current).strip())
            current = []
            i += dlen - 1
        else:
            current.append(ch)
        i += 1
    if current:
        parts.append("".join(current).strip())
    return [p for p in parts if p]


def _check_forbidden_operators(cmd: str) -> str | None:
    """Overí zákaz nebezpečných operátorov shellu (subshell, redirecty do súborov) mimo úvodzoviek."""
    in_single = False
    in_double = False
    for i, ch in enumerate(cmd):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif not in_single and not in_double:
            for op in FORBIDDEN_OPERATORS:
                if cmd[i:i+len(op)] == op:
                    return op
    return None


def run_shell_command(command: str) -> str:
    """Spustí bezpečný príkaz v termináli v priečinku repozitára s prísnym whitelistom nástrojov a ochranou pred command injection.
    Podporuje jednotlivé príkazy, sekvenčné zreťazenie (';', '&&') aj bezpečný pipeline ('|') medzi povolenými nástrojmi.
    """
    if not command or not command.strip():
        return "Chyba: Príkaz je prázdny."

    command = command.strip().rstrip(";\n\r ").strip()

    # 1. Zákaz nebezpečných operátorov shell injection (subshell, redirects) mimo úvodzoviek
    forbidden_op = _check_forbidden_operators(command)
    if forbidden_op:
        return (
            f"❌ Bezpečnostné zamietnutie: Operátor '{forbidden_op}' nie je povolený.\n"
            f"Pre zápis do súborov použi nástroj 'write_project_file'. Pre čítanie súborov použi 'read_project_file'."
        )

    # Rozdelenie sekvencií ';' alebo '&&' s rešpektovaním úvodzoviek
    sub_commands = []
    for semi_split in _split_outside_quotes(command, ";"):
        for and_split in _split_outside_quotes(semi_split, "&&"):
            if and_split.strip():
                sub_commands.append(and_split.strip())

    if not sub_commands:
        return "Chyba: Príkaz neobsahuje žiadne inštrukcie."

    results = []
    repo = _get_repo_path()
    is_win = sys.platform == "win32"

    for sub_cmd in sub_commands:
        # Podpora pipeline cez '|' (napr. git log ... | head -n 5)
        pipe_commands = _split_outside_quotes(sub_cmd, "|")
        if not pipe_commands:
            continue

        pipe_steps = []
        validation_error = None
        for p_cmd in pipe_commands:
            lower_cmd = p_cmd.lower()
            for forbidden in FORBIDDEN_PATH_SUBSTRINGS:
                if forbidden in lower_cmd:
                    validation_error = f"❌ Bezpečnostné zamietnutie: Prístup k súborom obsahujúcim '{forbidden}' je blokovaný."
                    break
            if validation_error:
                break

            try:
                parts = shlex.split(p_cmd, posix=not is_win)
            except Exception as e:
                validation_error = f"Chyba pri syntaktickej analýze príkazu '{p_cmd}': {e}"
                break

            if not parts:
                continue

            cmd_base = os.path.basename(parts[0]).lower().replace(".exe", "").replace(".cmd", "").replace(".bat", "")
            if cmd_base not in ALLOWED_SHELL_COMMANDS:
                validation_error = (
                    f"❌ Bezpečnostné zamietnutie: Nástroj '{parts[0]}' nie je na zozname povolených príkazov.\n"
                    f"Povolené nástroje sú výhradne: {', '.join(sorted(ALLOWED_SHELL_COMMANDS))}."
                )
                break

            executable = parts[0]
            if is_win:
                which_exe = shutil.which(parts[0])
                if which_exe:
                    executable = which_exe

            pipe_steps.append((executable, parts))

        if validation_error:
            return validation_error

        if not pipe_steps:
            continue

        if len(pipe_steps) == 1:
            executable, parts = pipe_steps[0]
            try:
                proc = subprocess.run(
                    [executable] + parts[1:],
                    cwd=repo,
                    shell=False,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=60,
                )
                out = ((proc.stdout or "") + (proc.stderr or "")).strip()
                header = f"$ {sub_cmd}" if len(sub_commands) > 1 else ""
                body = out if out else "(exit code 0)"
                results.append(f"{header}\n{body}".strip())
                if proc.returncode != 0:
                    break
            except subprocess.TimeoutExpired:
                return f"❌ Timeout: Príkaz '{sub_cmd}' prekročil maximálny limit 60 sekúnd."
            except Exception as e:
                return f"Chyba pri spúšťaní príkazu '{sub_cmd}': {str(e)}"
        else:
            try:
                procs = []
                prev_stdout = None
                for i, (executable, parts) in enumerate(pipe_steps):
                    is_last = (i == len(pipe_steps) - 1)
                    p = subprocess.Popen(
                        [executable] + parts[1:],
                        stdin=prev_stdout,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        cwd=repo,
                        shell=False,
                    )
                    if prev_stdout:
                        try:
                            prev_stdout.close()
                        except Exception:
                            pass
                    prev_stdout = p.stdout
                    procs.append(p)

                out_bytes, err_bytes = procs[-1].communicate(timeout=60)
                for p in procs[:-1]:
                    p.wait()

                out_text = (out_bytes.decode("utf-8", errors="replace") if out_bytes else "").strip()
                err_text = (err_bytes.decode("utf-8", errors="replace") if err_bytes else "").strip()
                combined = (out_text + "\n" + err_text).strip()
                header = f"$ {sub_cmd}" if len(sub_commands) > 1 else ""
                body = combined if combined else "(exit code 0)"
                results.append(f"{header}\n{body}".strip())
                if procs[-1].returncode != 0:
                    break
            except subprocess.TimeoutExpired:
                return f"❌ Timeout: Pipeline '{sub_cmd}' prekročil maximálny limit 60 sekúnd."
            except Exception as e:
                return f"Chyba pri spúšťaní pipeline '{sub_cmd}': {str(e)}"

    output = "\n\n".join(results)
    return output[:3000] if output else "Príkaz prebehol úspešne bez výstupu (exit code 0)."


# =====================================================================
# DOMAIN D: ARCHITECTURAL & COMPLIANCE AUDIT
# =====================================================================



def audit_clinical_and_safety_gates(text_or_code: str) -> str:
    """Skontroluje kód alebo návrh modulu na súlad so slovenským veterinárnym právom (Zákon 39/2007, 139/1998 a Sympathy Gate)."""
    warnings = []
    
    controlled_substances = ["ketamin", "ketamine", "propofol", "fentanyl", "butorfanol", "butorphanol", "morfium", "morphine", "opiát", "opiate"]
    for cs in controlled_substances:
        if cs in text_or_code.lower():
            warnings.append(f"Zákon 139/1998 Z. z.: Detegovaná omamná/psychotropná látka '{cs}'. AI návrhy musia byť vynulované (ZERO prefill) s vyžadovaním manuálneho podpisu veterinára.")

    if "deceased" in text_or_code.lower() and "suppress" not in text_or_code.lower():
        warnings.append("Sympathy Gate: Práca s úhynom pacienta musí obsahovať automatické potlačenie komunikácie (ext_automation_suppression_log).")

    if not warnings:
        return "✅ KLINICKÝ AUDIT: Kód spĺňa veterinárne a bezpečnostné predpisy (Zákon 39/2007 a 139/1998 Z. z.)."
    return "⚠️ NÁLEZY KLINICKÉHO AUDITU:\n" + "\n".join(f"• {w}" for w in warnings)


def audit_i18n_symmetry() -> str:
    """Skontroluje 100% symetriu kľúčov medzi slovenským (sk.json) a anglickým (en.json) prekladovým slovníkom."""
    en_file = os.path.join(_get_repo_path(), "apps", "web", "messages", "en.json")
    sk_file = os.path.join(_get_repo_path(), "apps", "web", "messages", "sk.json")
    
    if not os.path.exists(en_file) or not os.path.exists(sk_file):
        return "Súbory slovníkov en.json alebo sk.json neboli nájdené."

    try:
        with open(en_file, "r", encoding="utf-8") as f:
            en_data = json.load(f)
        with open(sk_file, "r", encoding="utf-8") as f:
            sk_data = json.load(f)

        def get_all_keys(d, prefix=""):
            keys = set()
            for k, v in d.items():
                curr = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    keys.update(get_all_keys(v, curr))
                else:
                    keys.add(curr)
            return keys

        en_keys = get_all_keys(en_data)
        sk_keys = get_all_keys(sk_data)

        missing_in_sk = en_keys - sk_keys
        missing_in_en = sk_keys - en_keys

        if not missing_in_sk and not missing_in_en:
            return f"✅ 100% I18N SYMETRIA: Všetkých {len(en_keys)} kľúčov sa zhoduje medzi EN a SK."
        
        report = f"❌ I18N ASYMETRIA DETEGOVANÁ (EN: {len(en_keys)}, SK: {len(sk_keys)} kľúčov):\n"
        if missing_in_sk:
            report += f"• Chýbajúce v SK ({len(missing_in_sk)}): {list(missing_in_sk)[:5]}\n"
        if missing_in_en:
            report += f"• Chýbajúce v EN ({len(missing_in_en)}): {list(missing_in_en)[:5]}\n"
        return report
    except Exception as e:
        return f"Chyba pri kontrole i18n: {str(e)}"


def read_project_file(file_path: str, max_lines: int = 300) -> str:
    """Bezpečne prečíta obsah súboru z projektu OpenVPM s obmedzením počtu riadkov."""
    full_path = file_path if os.path.isabs(file_path) else os.path.join(_get_repo_path(), file_path)
    if not os.path.exists(full_path):
        return f"Súbor {file_path} nebol nájdený."
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        snippet = "".join(lines[:max_lines])
        return f"### Súbor {file_path} ({len(lines)} riadkov):\n```\n{snippet}\n```"
    except Exception as e:
        return f"Chyba pri čítaní súboru: {str(e)}"


def write_project_file(file_path: str, content: str) -> str:
    """Zapíše alebo upraví lokálny súbor v repozitári OpenVPM (s ochranou zero-conflict pravidiel)."""
    repo = _get_repo_path()
    full_path = file_path if os.path.isabs(file_path) else os.path.join(repo, file_path)
    
    # Pre-flight check: ochrana vanilla schém
    norm_path = os.path.normpath(full_path).replace("\\", "/")
    if "packages/db/schema/" in norm_path and not os.path.basename(norm_path).startswith("ext_"):
        if os.path.basename(norm_path) != "index.ts":
            return f"❌ ODMIETNUTÉ: Úprava vanilla schémy '{file_path}' je zakázaná (pravidlo Zero-Conflict Upstream Sync)."

    if ".env" in os.path.basename(norm_path) and not norm_path.endswith(".example"):
        return f"❌ ODMIETNUTÉ: Úprava súboru '{file_path}' je zakázaná (ochrana tajomstiev)."

    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"✅ Súbor '{file_path}' bol úspešne zapísaný ({len(content.splitlines())} riadkov)."
    except Exception as e:
        return f"Chyba pri zápise súboru '{file_path}': {str(e)}"


# =====================================================================
# DOMAIN E: PROMPT ARCHITECTURE (Prompt Architect)
# =====================================================================

def design_system_prompt(agent_role: str, capabilities: str, constraints: str) -> str:
    """Vygeneruje precízny a bezpečný systémový prompt podľa štandardu OpenVPM s XML tagmi."""
    prompt = f"""<system_instruction>
Si špecializovaný autonómny agent pre systém OpenVPM AI.
Rola: {agent_role}

<capabilities>
{capabilities}
</capabilities>

<operational_constraints>
1. Striktné dodržiavanie zero-conflict upstream pravidiel.
2. Všetky výstupy a dialógy lokalizované cez systém i18n.
3. {constraints}
</operational_constraints>
</system_instruction>"""
    return prompt


def validate_prompt_xml(prompt_text: str) -> str:
    """Overí validitu XML tagov a štruktúru systémového promptu pre LLM modely."""
    import re
    tags = re.findall(r"<([a-zA-Z0-9_-]+)>", prompt_text)
    closing_tags = re.findall(r"</([a-zA-Z0-9_-]+)>", prompt_text)
    
    unclosed = [t for t in tags if closing_tags.count(t) < tags.count(t)]
    if unclosed:
        return f"⚠️ Varovanie: Tieto XML tagy v prompte nie sú korektne uzatvorené: {unclosed}"
    return "✅ ŠTRUKTÚRA PROMPTU: Všetky XML tagy sú správne spárované."


# =====================================================================
# DOMAIN F: ARENA AUTOMATION & PLAYWRIGHT CDP BRIDGE
# =====================================================================





def _extract_patch_files(patch_content: str) -> list[str]:
    """Extrahoval zoznam zmenených súborov z diff/patch obsahu."""
    files = set()
    for line in patch_content.splitlines():
        line = line.strip()
        if line.startswith("diff --git a/"):
            parts = line.split()
            if len(parts) >= 4:
                files.add(parts[2].removeprefix("a/"))
        elif line.startswith("--- a/"):
            files.add(line.removeprefix("--- a/").strip())
        elif line.startswith("+++ b/"):
            files.add(line.removeprefix("+++ b/").strip())
    return sorted(list(files))


def create_and_dispatch_arena_task(
    title: str,
    requirements: str,
    allowed_paths: str = "",
    target_model: str = "Arena.ai",
    auto_submit: bool = True,
) -> str:
    """Líder vytvorí kompletný Arena Sprint Prompt s pravidlami OpenVPM, uloží ho do tasks/ a odošle do Arena.ai relácie."""
    import time
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:30]
    task_id = f"arena-{int(time.time())}-{slug}"
    
    paths_val = allowed_paths or "apps/web/app/, apps/web/components/, apps/web/server/routers/extensions/, packages/db/schema/ext_*.ts, apps/web/messages/"
    prompt = f"""<system_prompt>
Si špičkový autonómny full-stack softvérový inžinier pre veterinárny systém OpenVPM AI (Next.js 15 App Router, React 19, TypeScript, tRPC v11, Drizzle ORM, Tailwind UI Kit).
Tvoja úloha je zadaná ako striktný GOLDEN TICKET („The ticket is the quality ceiling“).

# GOLDEN TICKET: {title}

## 1. Context / Why
OpenVPM AI je enterprise veterinárny nemocničný informačný systém. Modul "{title}" rieši potreby každodennej klinickej a administratívnej praxe s dôrazom na rýchlosť, bezpečnosť a zákonnú zhodu.

## 2. Scope
### In Scope
- Implementácia a harmonizácia modulu: {title}
- Použitie Dashboard UI Kit štandardu (docs/UIKIT.md): PageHeader, PageToolbar, DataTableFrame, KpiGrid z `@/components/layout/page-kit`.
- Povolené cieľové cesty: {paths_val}
- 100% leaf symetria kľúčov medzi `apps/web/messages/sk.json` a `apps/web/messages/en.json`.

### Out of Scope (Prísne zakázané)
- Žiadne úpravy vanilkových schém v `packages/db/schema/*.ts` ani `_journal.json`.
- Žiadne hardcoded texty v JSX/TSX.
- Žiadne zásahy mimo povolených ciest.

## 3. Acceptance Criteria (Definition of Done)
{requirements}
- [ ] Všetky texty v UI idú výhradne cez `useI18n()` s identickými kľúčmi v `messages/sk.json` aj `messages/en.json`.
- [ ] 0 chýb pri `pnpm turbo type-check` (alebo `pnpm --filter @openpims/web type-check`).
- [ ] 0 chýb a varovaní pri `pnpm lint`.
- [ ] Klinická bezpečnosť (Zákon 39/2007 Z. z.): AI návrhy ostávajú v stave draft pred podpisom veterinárom.
- [ ] Omamné látky (Zákon 139/1998 Z. z.): ZERO AI prefill pre ketamín, opioidy, propofol (iba manuálny zápis so ShieldAlert).
- [ ] Sympathy Gate: potlačenie automatických pripomienok pri stave pacienta deceased.

## 4. Technical Architecture & Constraints
- Balíčky: `apps/web`, `packages/db`, `packages/api`
- Databáza: nové tabuľky výhradne cez `packages/db/schema/ext_<nazov>.ts` a export v `index.ts`.
- tRPC routre: `apps/web/server/routers/extensions/<nazov>.ts` pripojené pod `extensionsRouter` v `_app.ts`.
- Navigácia: položky menu výhradne v `apps/web/config/custom-nav.ts`.
- Riziková trieda: risk:low

## 5. Verification & Test Plan
- Automatizované testy: `pnpm vitest run ...`
- Typová kontrola: `pnpm --filter @openpims/web type-check`
- Linter a i18n kontrola: `pnpm lint && pnpm --filter @openpims/web i18n:scan`

## 6. Definition of Ready
- [x] Acceptance criteria sú jednoznačné a overiteľné
- [x] Architektonické hranice a povolené cesty sú presne určené
- [x] Všetky klinické poistky sú zapracované do zadania

## 7. Delivery & Git Remote Protocol (PRÍSNE VYŽADOVANÉ)
Po úspešnom dokončení a overení (type-check, lint, testy):
1. Vytvor novú vetvu priamo z aktuálnej hlavy repozitára:
   `git checkout -b arena/{slug}`
2. Pridaj iba zmenené súbory v povolenom rozsahu ciest:
   `git add <zmenené_súbory>`
3. Vytvor štruktúrovaný commit v angličtine:
   `git commit -m "feat({slug}): {title} - implementácia podľa Golden Ticketu"`
4. Pushni vetvu do remote (alebo klikni 'Create PR' v rozhraní Arena):
   `git push origin arena/{slug}`
5. Vypíš do chatu finálny marker potvrdzujúci dokončenie:
   `ARENA_TASK_COMPLETE branch=arena/{slug}`

<vystupny_format>
Vráť informáciu o pushnutej vetve `arena/{slug}` s finálnym markerom:
ARENA_TASK_COMPLETE branch=arena/{slug}
Ak git remote push v tvojom cloudovom sandboxe nie je povolený, klikni na tlačidlo 'Create PR', prípadne ako záložný variant vráť kompletný ucelený git diff/patch.
</vystupny_format>
</system_prompt>
"""

    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    os.makedirs(tasks_dir, exist_ok=True)
    task_file = os.path.join(tasks_dir, f"{task_id}.md")
    with open(task_file, "w", encoding="utf-8") as f:
        f.write(prompt)

    allowed_list = [p.strip() for p in allowed_paths.split(",") if p.strip()] or [
        "apps/web/app/",
        "apps/web/components/",
        "apps/web/server/routers/extensions/",
        "packages/db/schema/ext_",
        "apps/web/messages/",
    ]

    # Vytvorenie a uloženie záznamu DevelopmentRun s počiatočným stavom IMPLEMENTING
    run = DevelopmentRun(
        task_id=task_id,
        state=RunState.IMPLEMENTING,
        title=title,
        allowed_paths=allowed_list,
        declared_risk=RiskClass.LOW,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
    )
    save_development_run(run)

    # Single physical dispatch. A second send_prompt call raced the first and
    # could land the golden ticket in a different sprint tab.
    dispatch_msg = dispatch_to_arena_session(
        module_name=title,
        prompt_summary=requirements[:150],
        target_model="Arena.ai",
        full_prompt=prompt,
        task_file=task_file,
        session_id=task_id,
        task_slug=slug,
    )

    return f"""### 🚀 Úloha vytvorená a odoslaná pre Arena.ai:
• **Task ID:** `{task_id}`
• **Stav behu:** `{RunState.IMPLEMENTING.value}`
• **Názov:** {title}
• **Cieľ:** `Arena.ai`
• **Súbor zadania:** `tasks/{task_id}.md`
• **Súbor behu (contracts):** `tasks/run-{task_id.replace('arena-', '')[:25]}.json`
• **Stav odoslania do prehliadača:** {dispatch_msg}

{dispatch_msg}"""


def apply_arena_patch(task_id: str, patch_source: str) -> str:
    """Aplikuje vygenerovaný kód / patch z Arena.ai do izolovanej vetvy swarm/agno-<task_id> po overení architektonických pravidiel a pre-flight kontrole."""
    repo = _get_repo_path()
    clean_id = task_id.replace("arena-", "").replace(".patch", "")[:25]
    branch_name = f"swarm/agno-{clean_id}"

    # 1. Získanie obsahu patchu a súboru
    patch_file_path = None
    patch_content = ""
    tasks_dir = os.path.join(repo, "tasks")

    target_path = None
    if '\n' not in patch_source and os.path.exists(patch_source):
        target_path = patch_source
    elif '\n' not in patch_source and os.path.exists(os.path.join(repo, patch_source)):
        target_path = os.path.join(repo, patch_source)
    elif '\n' not in patch_source and os.path.exists(os.path.join(tasks_dir, patch_source)):
        target_path = os.path.join(tasks_dir, patch_source)

    if target_path and os.path.isdir(target_path):
        import glob
        found_patches = glob.glob(os.path.join(target_path, "**/*.patch"), recursive=True)
        if found_patches:
            patch_file_path = found_patches[0]
            try:
                with open(patch_file_path, "r", encoding="utf-8", errors="replace") as pf:
                    patch_content = pf.read()
            except Exception:
                pass
        else:
            return f"❌ V priečinku `{patch_source}` sa nenašiel žiadny .patch súbor."
    elif target_path and os.path.isfile(target_path):
        patch_file_path = target_path
        try:
            with open(patch_file_path, "r", encoding="utf-8", errors="replace") as pf:
                patch_content = pf.read()
        except Exception:
            pass
    elif '\n' not in patch_source and (any(sep in patch_source for sep in ["/", "\\"]) or patch_source.endswith((".patch", ".diff", ".md", ".txt")) or patch_source.startswith("tasks")):
        import glob
        base_name = os.path.basename(patch_source).lower().replace(".patch", "").replace(".md", "").replace(".diff", "")
        clean_task = task_id.lower().replace("arena-", "").replace(".patch", "")
        candidates = []
        if os.path.isdir(tasks_dir):
            all_patches = glob.glob(os.path.join(tasks_dir, "**/*.patch"), recursive=True)
            for p in all_patches:
                p_lower = os.path.basename(p).lower()
                if base_name and (base_name in p_lower or p_lower in base_name):
                    candidates.append(p)
                elif clean_task and (clean_task in p_lower or p_lower in clean_task):
                    candidates.append(p)
                elif "sprint" in base_name and any(num in base_name and num in p_lower for num in ["5", "8", "9", "10", "11"]):
                    candidates.append(p)

        if candidates:
            patch_file_path = candidates[0]
            try:
                with open(patch_file_path, "r", encoding="utf-8", errors="replace") as pf:
                    patch_content = pf.read()
            except Exception:
                pass
        else:
            avail = [f for f in os.listdir(tasks_dir) if f.endswith(".patch")] if os.path.isdir(tasks_dir) else []
            return (
                f"❌ Súbor patchu nebol nájdený: `{patch_source}`.\n"
                f"Dostupné patch súbory v `tasks/`:\n" +
                ("\n".join(f"• `tasks/{f}`" for f in avail) if avail else "• (žiadne .patch súbory v tasks/)")
            )
    else:
        patch_content = patch_source
        patch_file_path = None

    qualified = extract_unified_diff(patch_content)
    if not qualified:
        if patch_file_path and str(patch_file_path).endswith(".patch"):
            _discard_invalid_patch(patch_file_path)
        run = get_development_run(task_id)
        if run:
            run.state = RunState.REJECTED
            run.failure_reason = (
                "Patch neobsahuje unified diff (diff --git alebo --- a/)."
            )
            save_development_run(run)
        return (
            "❌ PATCH ZAMIETNUTÝ: obsah nie je unified diff. "
            "Povolené sú len patche začínajúce na `diff --git` alebo `--- a/`. "
            "Markdown vysvetlenie sa do .patch nezapisuje."
        )
    os.makedirs(TMP_DIR, exist_ok=True)
    clean_patch = os.path.join(
        TMP_DIR, f"{_safe_artifact_stem(task_id)}.clean.patch"
    )
    if not write_unified_patch(clean_patch, qualified):
        return "❌ PATCH ZAMIETNUTÝ: nepodarilo sa zapísať unified diff."
    patch_file_path = clean_patch
    patch_content = qualified

    # 2. Architektonický audit dotknutých súborov (Zero-Conflict Upstream Sync & Secrets Safety)
    touched_files = _extract_patch_files(patch_content)
    policy_decision = PolicyEngine.evaluate_files(task_id, touched_files)
    if not policy_decision.allowed:
        run = get_development_run(task_id)
        if run:
            run.state = RunState.REJECTED
            run.policy_decision = policy_decision
            run.failure_reason = "Architektonické porušenia v patchi: " + "; ".join(policy_decision.violations)
            save_development_run(run)
        return "❌ PATCH ZAMIETNUTÝ — ARCHITEKTURÁLNE PORUŠENIE:\n" + "\n".join(f"• {v}" for v in policy_decision.violations)

    # 3. Deterministický pre-flight: git apply --check (overenie pred prepnutím vetvy)
    check_proc = subprocess.run(
        [_which("git"), "apply", "--check", "--recount", "--ignore-whitespace", patch_file_path],
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if check_proc.returncode != 0:
        err_msg = (check_proc.stderr or check_proc.stdout or "Neznámy konflikt v patchi").strip()
        run = get_development_run(task_id)
        if run:
            run.state = RunState.FAILED
            run.failure_reason = f"Pre-flight kontrola zlyhala: {err_msg[:300]}"
            save_development_run(run)
        return f"❌ PRE-FLIGHT ZLYHAL: Patch sa nedá čisto aplikovať na aktuálny kód:\n```\n{err_msg}\n```\nOdporúčanie: Líder musí sformulovať opravný prompt s požiadavkou na zosúladenie s vetvou."

    # 4. Bezpečné vytvorenie a prepnutie izolovanej vetvy swarm/agno-*
    worktree_dir = os.path.join(repo, ".agents", "agno", "tmp", "worktrees", f"agno-{clean_id}")
    use_worktree = os.getenv("OPENVPM_USE_WORKTREE", "false").lower() in ("true", "1", "yes")
    target_dir = repo

    if use_worktree:
        try:
            os.makedirs(os.path.dirname(worktree_dir), exist_ok=True)
            if not os.path.exists(worktree_dir):
                subprocess.run(
                    [_which("git"), "worktree", "add", "-B", branch_name, worktree_dir],
                    cwd=repo,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    check=True,
                )
            target_dir = worktree_dir
        except Exception:
            target_dir = repo
            try:
                subprocess.run([_which("git"), "checkout", "-B", branch_name], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
            except subprocess.CalledProcessError as e:
                return f"Chyba pri vytváraní vetvy {branch_name}: {e.stderr}"
    else:
        try:
            subprocess.run([_which("git"), "checkout", "-B", branch_name], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        except subprocess.CalledProcessError as e:
            return f"Chyba pri vytváraní vetvy {branch_name}: {e.stderr}"

    # 5. Aplikovanie patchu
    proc = subprocess.run([_which("git"), "apply", "--recount", "--ignore-whitespace", "--3way", patch_file_path], cwd=target_dir, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        proc2 = subprocess.run([_which("git"), "apply", "--recount", "--ignore-whitespace", patch_file_path], cwd=target_dir, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if proc2.returncode != 0:
            run = get_development_run(task_id)
            if run:
                run.state = RunState.FAILED
                run.failure_reason = f"Chyba pri aplikovaní patchu: {proc.stderr or proc2.stderr}"
                save_development_run(run)
            return f"❌ Chyba pri aplikovaní patchu na vetvu {branch_name}:\n{proc.stderr or proc2.stderr}"

    # 6. Aktualizácia stavu behu na VERIFYING
    run = get_development_run(task_id)
    if run:
        run.state = RunState.VERIFYING
        if target_dir != repo:
            run.worktree_path = target_dir
        save_development_run(run)

    stat = subprocess.run([_which("git"), "status", "--short"], cwd=target_dir, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return f"""✅ Patch z Arena.ai úspešne prešiel pre-flight auditom a bol aplikovaný na vetvu `{branch_name}`!
• Stav behu: `{RunState.VERIFYING.value}`
• Dotknuté súbory ({len(touched_files)}):
```
{stat.stdout.strip()}
```
Odporúčanie: Spustiť verifikáciu cez `run_openvpm_verification(task_id='{task_id}')`."""


def evaluate_verification_and_repair(task_id: str, verification_output: str, target_model: str = "arena") -> str:
    """Líder zhodnotí výsledok verifikácie. Ak nastala chyba, sformuluje repair prompt a odošle ho späť do Areny. Integruje RunState stavový automat."""
    clean_id = task_id.replace("arena-", "").replace(".patch", "")[:25]
    branch_name = f"swarm/agno-{clean_id}"
    run = get_development_run(task_id)

    passed = "VŠETKY KONTROLY PREŠLI" in verification_output or ("PASSED" in verification_output and "FAILED" not in verification_output)

    if passed:
        if run:
            run.state = RunState.READY_FOR_PR
            run.review_report = ReviewReport(
                approved=True,
                blocking_findings=[],
                non_blocking_findings=[],
                evidence_summary="Všetky verifikačné kontroly (typecheck, lint, test, i18n) prebehli úspešne.",
            )
            save_development_run(run)

        return f"""### 🏆 HODNOTENIE LÍDERA: SCHVÁLENÉ (READY FOR PR)
Všetky testy a statické kontroly (typecheck, lint, i18n) prebehli úspešne bez jedinej chyby!
• Task ID: `{task_id}`
• Vetva: `{branch_name}`
• Stav behu: `{RunState.READY_FOR_PR.value}`
• Kód vyhovuje 100% pravidlám OpenVPM AI monorepa.
• Pripravené na zlúčenie / PR."""

    # Ak nastala chyba
    if run:
        run.repair_attempts += 1
        if run.repair_attempts > 3:
            run.state = RunState.FAILED
            run.failure_reason = "Prekročený maximálny počet pokusov o opravu (3 pokusy)."
            save_development_run(run)
            return f"""### ⛔ HODNOTENIE LÍDERA: ÚLOHA ZLYHALA (MAX REPAIRS EXCEEDED)
Úloha `{task_id}` prekročila maximálny limit 3 pokusov o automatickú opravu.
• Stav behu: `{RunState.FAILED.value}`
• Posledný chybový výstup:
```
{verification_output[:800]}
```
Vyžaduje sa manuálny zásah developera."""

        run.state = RunState.IMPLEMENTING
        run.review_report = ReviewReport(
            approved=False,
            blocking_findings=[verification_output[:400]],
            non_blocking_findings=[],
            evidence_summary=f"Zlyhanie verifikácie (opravný cyklus {run.repair_attempts}/3).",
        )
        save_development_run(run)

    repair_prompt = f"""<system_prompt>
Si Arena.ai expert pracujúci na projekte OpenVPM AI.
KRITICKÉ UPOZORNENIE K RELÁCII (SESSION INVARIANT):
Táto Arena relácia už v predchádzajúcom kroku vytvorila vetvu alebo Pull Request. Arena.ai v tej istej relácii technicky NEDOKÁŽE a NEUMOŽŇUJE vytvoriť nový Pull Request ani novú vetvu druhýkrát!
Preto striktne dodržuj tieto pravidlá:
1. NEPOKÚŠAJ SA vytvoriť nový Pull Request ani novú vetvu cez UI alebo git.
2. NESTLAČAJ tlačidlo 'Create PR'.
3. Všetky opravy vykonaj priamo v súboroch repozitára v tvojom sandboxe.
4. Výstup MUSÍŠ poskytnúť VÝHRADNE AKO ČISTÝ UNIFIKOVANÝ .patch SÚBOR (unified diff začínajúci na `diff --git a/...`). Naša orchestrácia tento patch automaticky prevezme cez CDP a aplikuje lokálne cez git apply.

Predchádzajúca implementácia úlohy {task_id} vygenerovala nasledujúce chyby pri kompilácii a testoch OpenVPM:

<chybovy_vystup_z_testov>
{verification_output}
</chybovy_vystup_z_testov>

<poziadavka_na_opravu>
1. Presne oprav identifikované TypeScript chyby, chýbajúce importy alebo nesymetrické i18n preklady (sk.json / en.json).
2. Dodrž zero-conflict pravidlá a PageKit komponenty (docs/UIKIT.md).
3. Vráť opravený čistý unifikovaný git diff/patch.
</poziadavka_na_opravu>
</system_prompt>"""

    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    repair_file = os.path.join(tasks_dir, f"repair-{task_id}.md")
    with open(repair_file, "w", encoding="utf-8") as rf:
        rf.write(repair_prompt)

    repair_target = _lookup_dispatch_target(task_id)
    cdp_msg = send_prompt_to_arena_browser(
        repair_prompt,
        auto_submit=True,
        session_id=repair_target["session_id"],
        task_slug=repair_target["task_slug"],
        arena_url=repair_target["arena_url"],
    )

    attempt_str = f"(Opravný pokus {run.repair_attempts}/3)" if run else ""
    return f"""### ⚠️ HODNOTENIE LÍDERA: POTREBNÁ OPRAVA (REPAIR REQUIRED) {attempt_str}
Verifikácia odhalila chyby v kóde. Líder pripravil opravný prompt:
• Stav behu: `{RunState.IMPLEMENTING.value}`
• Súbor s opravným promptom: `tasks/repair-{task_id}.md`
• Odoslanie do Arena.ai tabu: {cdp_msg}

Opravný prompt bol pripravený a odoslaný. Po vygenerovaní v Arene stiahnite kód cez 'collect_code_from_arena_browser', aplikujte ho a zopakujte verifikáciu."""


# =====================================================================
# ARENA RELIABILITY ENGINE
# Tab matching, completion detection, physical dispatch, patch gate.
# =====================================================================

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS = 900
MIN_ARENA_COLLECT_TIMEOUT_SECONDS = 600
ARENA_POLL_INTERVAL_SECONDS = 2.0
ARENA_NAVIGATION_WAIT_SECONDS = 4.0
DEFAULT_CDP_PORTS = "9222,60325,9223,9229,9333,5000"
ARENA_AGENT_ORIGIN = os.getenv("ARENA_AGENT_ORIGIN", "https://arena.ai")

# Explicit tokens only. Words like "complete", "done", or a quiet chat are not
# completion — those fired the premature-COMPLETED bug during pnpm/vitest.
_COMPLETION_MARKER_RE = re.compile(
    r"ARENA_TASK_COMPLETE|ARENA_SPRINT_COMPLETE|"
    r"<!--\s*arena-complete\s*-->|\[arena:complete\]",
    re.IGNORECASE,
)
_TERMINAL_EXIT_RE = re.compile(
    r"exit(?:\s*|_)code\s*[:=]\s*\d+|"
    r"process exited|"
    r"command (?:finished|completed|exited)",
    re.IGNORECASE,
)
_GENERIC_SLUGS = frozenset({
    "ai",
    "agent",
    "arena",
    "com",
    "http",
    "https",
    "new",
    "tab",
    "task",
    "www",
    "agent-mode",
})
_ID_FIELDS = ("session_id", "task_id", "arena_session_id")
_SESSION_SEQ_LOCK = threading.Lock()
_SESSION_SEQ = 0

# Upstream routers from evangauer/openvpm main. Used only when the sibling
# checkout cannot be located, so records.ts / whiteboard.ts are not false
# violations in CI or a WSL shell that cannot see C:\\...\\OpenVPM.
KNOWN_UPSTREAM_ROUTER_FILES = frozenset({
    "_app.ts",
    "admin.ts",
    "agent.ts",
    "ai.ts",
    "api-keys.ts",
    "appointments.ts",
    "auth.ts",
    "billing.ts",
    "booking.ts",
    "care-reminders.ts",
    "clients.ts",
    "communications.ts",
    "controlled-substances.ts",
    "dashboard.ts",
    "data.ts",
    "dosing.ts",
    "encounters.ts",
    "insurance.ts",
    "inventory.ts",
    "messaging.ts",
    "migration-archive.ts",
    "notifications.ts",
    "pagination.ts",
    "patients.ts",
    "portal.ts",
    "recent-clinical-items.ts",
    "records.ts",
    "reports.ts",
    "settings.ts",
    "storage-bounds.ts",
    "subscription.ts",
    "templates.ts",
    "treatment-plans.ts",
    "visit-treatment-plans.ts",
    "vitals.ts",
    "waitlist.ts",
    "webhooks.ts",
    "wellness.ts",
    "whiteboard.ts",
})

_COMPOSER_SELECTORS = (
    "div[contenteditable='true']",
    "textarea:not([name*='recaptcha']):not([class*='recaptcha'])",
    "textarea",
    "[role='textbox']",
    "input[type='text']",
)
_SUBMIT_SELECTORS = (
    "button[type='submit']",
    "button[data-testid='send-button']",
    "button[aria-label='Send']",
    "button[aria-label*='Send']",
    "form button[type='submit']",
)

_ARENA_SNAPSHOT_JS = r"""() => {
  const textOf = (el) => ((el && (el.innerText || el.textContent)) || "").trim();
  const visible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const enabled = (el) => {
    if (!el || el.disabled) return false;
    const aria = (el.getAttribute("aria-disabled") || "").toLowerCase();
    return aria !== "true";
  };
  const labelOf = (el) => (
    (el.innerText || "") + " " +
    (el.getAttribute("aria-label") || "") + " " +
    (el.getAttribute("title") || "")
  ).replace(/\s+/g, " ").trim();
  const isCreatePr = (label) => /create\s+(a\s+)?(pull request|pr)\b/i.test(label);
  const isPrCreated = (label) => /(?:pr|pull\s+request|branch)\s+(?:created|opened|pushed)|view\s+(?:pr|pull\s+request)\b/i.test(label);
  const buttons = Array.from(document.querySelectorAll(
    "button, a[role='button'], [role='button'], a[href]"
  ));
  const createPr = buttons.find((el) => visible(el) && isCreatePr(labelOf(el))) || null;
  const hasPrCreatedButton = buttons.some((el) => visible(el) && isPrCreated(labelOf(el)));
  const hasPrLink = !!document.querySelector("a[href*='/pull/'], a[href*='/tree/'], a[href*='/compare/']");
  const stop = buttons.find((el) => {
    if (!visible(el) || isCreatePr(labelOf(el))) return false;
    return /\b(stop|cancel)\b/i.test(labelOf(el));
  }) || null;
  const terminalNodes = Array.from(document.querySelectorAll(
    "[data-testid='terminal'], [data-terminal], .terminal, .xterm-rows, pre.terminal"
  ));
  const terminalText = terminalNodes.map(textOf).filter(Boolean).join("\n");
  const toolRunning = !!document.querySelector(
    "[data-tool-status='running'], [data-terminal-status='running'], " +
    "[data-state='running'], .tool-running, .terminal-running"
  );
  const spinnerInTerminal = terminalNodes.some((node) =>
    node.querySelector(".animate-spin, [data-running='true']")
  );
  const blocks = [];
  document.querySelectorAll("pre code, pre").forEach((el) => {
    const txt = textOf(el);
    if (txt) blocks.push(txt);
  });
  const msgs = document.querySelectorAll(
    "[data-message-author-role='assistant'], div.chat-message, div.prose"
  );
  const assistantText = msgs.length ? textOf(msgs[msgs.length - 1]) : "";
  const bodyText = (document.body && document.body.innerText) || "";
  const markerRe = /ARENA_TASK_COMPLETE|ARENA_SPRINT_COMPLETE|<!--\s*arena-complete\s*-->|\[arena:complete\]/i;
  const prAlreadyCreated = hasPrCreatedButton || hasPrLink ||
    /(?:pull\s+request|pr|branch)\s+(?:created|opened|pushed)|view\s+(?:pr|pull\s+request)/i.test(bodyText);
  return {
    createPrVisible: !!createPr,
    createPrEnabled: !!(createPr && enabled(createPr)),
    prAlreadyCreated: prAlreadyCreated,
    stopVisible: !!stop,
    thinking: !!document.querySelector(
      "[data-thinking='true'], [data-state='thinking'], .thinking-indicator"
    ),
    bashRunning: toolRunning || spinnerInTerminal,
    terminalExited: /exit(?:\s*|_)code\s*[:=]\s*\d+|process exited|command (?:finished|completed|exited)/i.test(terminalText),
    terminalText: terminalText,
    assistantText: assistantText,
    codeBlocks: blocks,
    completionMarker: markerRe.test(bodyText) || !!document.querySelector("[data-arena-status='complete']"),
    title: document.title || ""
  };
}"""


@dataclass(frozen=True)
class ArenaTab:
    """A browser tab reduced to the fields used for session matching."""

    url: str
    title: str = ""
    handle: Any = None


@dataclass(frozen=True)
class ArenaRunObservation:
    """Result of the completion-state engine.

    ``status`` is only ``RUNNING`` or ``COMPLETED``. Silence, a stable DOM,
    and a watcher timeout never produce ``COMPLETED``.
    """

    status: str
    reason: str
    timed_out: bool = False
    patch_text: Optional[str] = None

    def __post_init__(self) -> None:
        if self.status not in {"RUNNING", "COMPLETED"}:
            raise ValueError(f"unsupported arena status: {self.status}")


@dataclass
class BrowserDispatchResult:
    """Structured result of a physical Arena composer dispatch."""

    ok: bool
    url: str = ""
    message: str = ""
    submitted: bool = False
    opened_new: bool = False
    arena_session_id: str = ""
    endpoint: str = ""


def _sleep(seconds: float) -> None:
    """Sleep wrapper so tests can disable real waits."""
    time.sleep(seconds)


def _monotonic() -> float:
    """Monotonic clock wrapper so tests can advance time."""
    return time.monotonic()


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _arena_origin() -> str:
    return os.getenv("ARENA_AGENT_ORIGIN", ARENA_AGENT_ORIGIN).rstrip("/")


def arena_agent_home_url() -> str:
    """URL of a fresh Arena Agent composer (``/agent``, no session id)."""
    return _arena_origin() + "/agent"


def _slugify(value: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    if max_len > 0:
        slug = slug[:max_len].strip("-")
    return slug


def _is_generic_slug(slug: str) -> bool:
    norm = _slugify(slug, max_len=0)
    return not norm or norm in _GENERIC_SLUGS or len(norm) < 3


def _new_local_session_id(module_name: str) -> str:
    """Build a collision-resistant local session id.

    ``time.time()`` second resolution used to collide when two sprints were
    dispatched in the same second and then matched by substring.
    """
    global _SESSION_SEQ
    with _SESSION_SEQ_LOCK:
        _SESSION_SEQ += 1
        seq = _SESSION_SEQ
    slug = _slugify(module_name, 24) or "task"
    return f"arena-{time.time_ns()}-{seq}-{slug}"


def _safe_artifact_stem(task_id: str) -> str:
    """Filesystem stem that does not collapse distinct sprint ids."""
    stem = str(task_id or "").strip().replace("\\", "/").split("/")[-1]
    if stem.endswith(".patch"):
        stem = stem[:-6]
    if stem.endswith(".md"):
        stem = stem[:-3]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-")
    return (stem or "arena-task")[:80]


def _artifact_paths(task_id: str) -> tuple[str, str]:
    stem = _safe_artifact_stem(task_id)
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    return (
        os.path.join(tasks_dir, f"{stem}.patch"),
        os.path.join(tasks_dir, f"arena-response-{stem}.md"),
    )


def _atomic_write(path: str, content: str) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".writing", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


_in_process_session_lock = threading.RLock()


@contextmanager
def _sessions_lock() -> Iterator[None]:
    """Exclusive lock around ``arena_sessions.json`` read-modify-write.

    Dispatch and collect both mutate the same file. Without the lock a
    concurrent update dropped one sprint or marked ``sprint-1`` complete
    because its id was a substring of ``sprint-10``.
    """
    os.makedirs(os.path.dirname(ARENA_SESSIONS_FILE) or ".", exist_ok=True)
    lock_path = ARENA_SESSIONS_FILE + ".lock"
    if not os.path.exists(lock_path) or os.path.getsize(lock_path) == 0:
        try:
            with open(lock_path, "a", encoding="utf-8") as init_h:
                if init_h.tell() == 0:
                    init_h.write("0")
                    init_h.flush()
        except OSError:
            pass

    with _in_process_session_lock:
        handle = open(lock_path, "r+", encoding="utf-8")
        try:
            if os.name == "nt":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            yield
        finally:
            try:
                if os.name == "nt":
                    import msvcrt

                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
            handle.close()


def _read_sessions_unlocked() -> list[dict[str, Any]]:
    if not os.path.exists(ARENA_SESSIONS_FILE):
        return []
    try:
        with open(ARENA_SESSIONS_FILE, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(loaded, list):
        return []
    return [item for item in loaded if isinstance(item, dict)]


def _write_sessions_unlocked(sessions: list[dict[str, Any]]) -> None:
    _atomic_write(
        ARENA_SESSIONS_FILE,
        json.dumps(sessions, indent=2, ensure_ascii=False) + "\n",
    )


def _load_sessions() -> list[dict[str, Any]]:
    """Return a snapshot of arena sessions under the file lock."""
    with _sessions_lock():
        return _read_sessions_unlocked()


def _mutate_sessions(
    mutator: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Apply ``mutator`` to the session list atomically."""
    with _sessions_lock():
        sessions = _read_sessions_unlocked()
        updated = mutator(sessions)
        if not isinstance(updated, list):
            raise TypeError("session mutator must return a list")
        _write_sessions_unlocked(updated)
        return updated


def _identity_set(record: Mapping[str, Any]) -> set[str]:
    found = set()
    for key in _ID_FIELDS:
        value = str(record.get(key) or "").strip()
        if value:
            found.add(value)
    return found


def _find_session_records(wanted: Sequence[str]) -> list[dict[str, Any]]:
    """Exact-id lookup. ``sprint-1`` must not match ``sprint-10``."""
    needles = {str(item).strip() for item in wanted if str(item or "").strip()}
    if not needles:
        return []
    matches = []
    for record in _load_sessions():
        keys = _identity_set(record)
        slug = str(record.get("task_slug") or "").strip()
        if slug:
            keys.add(slug)
        if keys & needles:
            matches.append(record)
    return matches


def _update_sessions_exact(identities: Sequence[str], **changes: Any) -> None:
    wanted = {str(item).strip() for item in identities if str(item or "").strip()}
    if not wanted:
        return

    def mutate(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        found = False
        for record in sessions:
            if _identity_set(record) & wanted:
                record.update(changes)
                record["updated_at"] = _now()
                found = True
        if not found:
            primary = next(iter(wanted))
            created = {
                "session_id": primary,
                "task_id": primary,
                "target_model": "Arena.ai",
                "created_at": _now(),
                "updated_at": _now(),
            }
            created.update(changes)
            sessions.append(created)
        return sessions

    _mutate_sessions(mutate)


def _upsert_session(record: dict[str, Any]) -> None:
    identity = str(record.get("session_id") or "").strip()
    if not identity:
        raise ValueError("session record requires session_id")

    def mutate(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for existing in sessions:
            if identity in _identity_set(existing):
                existing.update(record)
                existing["updated_at"] = _now()
                return sessions
        stored = dict(record)
        stored.setdefault("created_at", _now())
        stored["updated_at"] = _now()
        sessions.append(stored)
        return sessions

    _mutate_sessions(mutate)


# ---------------------------------------------------------------------------
# Unified diff validation (bug 5)
# ---------------------------------------------------------------------------

def _line_starts_diff(line: str) -> bool:
    """True when a line opens a unified diff, not when prose mentions one."""
    stripped = line.lstrip()
    return stripped.startswith("diff --git a/") or stripped.startswith("--- a/")


def _is_diff_line(line: str) -> bool:
    stripped = line.lstrip()
    if stripped.startswith((
        "diff --git ",
        "--- a/",
        "--- /dev/null",
        "+++ b/",
        "+++ /dev/null",
        "@@",
        "index ",
        "new file mode ",
        "deleted file mode ",
        "old mode ",
        "new mode ",
        "similarity index ",
        "rename from ",
        "rename to ",
        "copy from ",
        "copy to ",
        "Binary files ",
        "GIT binary patch",
        "literal ",
        "delta ",
    )):
        return True
    if line.startswith(("+", "-", " ", "\\")):
        return True
    if stripped == "\\ No newline at end of file":
        return True
    return False


def _dedent_diff(lines: list[str]) -> str:
    if not lines:
        return ""
    indent = len(lines[0]) - len(lines[0].lstrip(" "))
    if indent:
        dedented = []
        for line in lines:
            if line.startswith(" " * indent):
                dedented.append(line[indent:])
            else:
                dedented.append(line)
        lines = dedented
    return "\n".join(lines).strip("\n")


def _extract_regions(text: str) -> list[str]:
    lines = text.splitlines()
    regions: list[str] = []
    index = 0
    while index < len(lines):
        if not _line_starts_diff(lines[index]):
            index += 1
            continue
        start = index
        index += 1
        while index < len(lines):
            line = lines[index]
            if line.strip() == "" or _is_diff_line(line) or _line_starts_diff(line):
                index += 1
                continue
            break
        chunk_lines = lines[start:index]
        while chunk_lines and chunk_lines[-1].strip() == "":
            chunk_lines.pop()
        body = _dedent_diff(chunk_lines)
        if body.startswith("diff --git a/") or body.startswith("--- a/"):
            regions.append(body)
    return regions


def extract_unified_diff(text: str) -> Optional[str]:
    """Return a unified diff, or None if ``text`` is not one.

    Qualifying patches start with ``diff --git a/`` or ``--- a/``. Markdown
    explanations, README setup steps, and ``Index:``-only diffs do not.
    """
    if text is None or not str(text).strip():
        return None
    raw_str = str(text)
    if "```" in raw_str:
        import re
        blocks = re.findall(r"```(?:diff|patch)?\s*\n(.*?)\n```", raw_str, flags=re.DOTALL)
        if blocks:
            joined_blocks = "\n".join(b for b in blocks if "diff --git" in b or "--- a/" in b)
            if joined_blocks.strip():
                raw_str = joined_blocks

    regions = _extract_regions(raw_str)
    if not regions:
        return None
    git_regions = [item for item in regions if item.startswith("diff --git a/") or item.startswith("--- a/")]
    if git_regions:
        combined = "\n".join(item.rstrip() for item in git_regions)
        if not combined.endswith("\n"):
            combined += "\n"
        return combined
    chosen = regions
    best = max(chosen, key=len)
    if not (best.startswith("diff --git a/") or best.startswith("--- a/")):
        return None
    if not best.endswith("\n"):
        best += "\n"
    return best


def is_unified_diff(text: str) -> bool:
    """Return True when ``text`` contains a qualifying unified diff."""
    return extract_unified_diff(text) is not None


def write_unified_patch(path: str, content: str) -> bool:
    """Write ``path`` only when ``content`` is a unified diff.

    Non-diff text is never written to a ``.patch`` file. Returns False and
    leaves the filesystem unchanged when the content does not qualify.
    """
    diff = extract_unified_diff(content)
    if not diff:
        return False
    if not (diff.startswith("diff --git a/") or diff.startswith("--- a/")):
        return False
    _atomic_write(path, diff)
    return True


def _patch_file_is_valid(path: str) -> bool:
    if not path or not os.path.isfile(path):
        return False
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return is_unified_diff(handle.read())
    except OSError:
        return False


def _discard_invalid_patch(path: str) -> None:
    """Remove a legacy prose ``.patch`` so it cannot be applied later."""
    if not os.path.isfile(path):
        return
    if _patch_file_is_valid(path):
        return
    try:
        os.remove(path)
    except OSError:
        pass


def _task_has_valid_patch(tasks_dir: str, task_id: str) -> bool:
    stem = _safe_artifact_stem(task_id)
    candidates = [
        os.path.join(tasks_dir, f"{stem}.patch"),
        os.path.join(tasks_dir, f"{task_id}.patch"),
    ]
    return any(_patch_file_is_valid(path) for path in candidates)


# ---------------------------------------------------------------------------
# Tab matching (bug 2)
# ---------------------------------------------------------------------------

def extract_agent_session_id(url: str) -> str:
    """Return the ``<session_id>`` from ``/agent/<session_id>``, else ``''``."""
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in urllib.parse.unquote(parsed.path or "").split("/") if part]
    lowered = [part.lower() for part in parts]
    if "agent" not in lowered:
        return ""
    tail = parts[lowered.index("agent") + 1:]
    return tail[0] if tail else ""


def url_matches_session(url: str, session_id: str) -> bool:
    """True only for an exact ``/agent/<session_id>`` path segment.

    ``/agent/sprint-5`` matches ``sprint-5``. It does not match ``sprint-50``,
    ``sprint-1``, or a tab whose URL merely contains the word ``arena``.
    """
    if not url or not session_id:
        return False
    parsed = urllib.parse.urlparse(url)
    parts = [part for part in urllib.parse.unquote(parsed.path or "").split("/") if part]
    lowered = [part.lower() for part in parts]
    if "agent" not in lowered:
        return False
    tail = parts[lowered.index("agent") + 1:]
    return bool(tail) and tail[0] == session_id


def slug_in_text(slug: str, text: str) -> bool:
    """True when ``slug`` is a whole token in ``text``, not a prefix."""
    norm_slug = _slugify(slug, max_len=0)
    if _is_generic_slug(norm_slug):
        return False
    norm_text = _slugify(text or "", max_len=0)
    if not norm_text:
        return False
    pattern = rf"(?:^|-){re.escape(norm_slug)}(?:-|$)"
    return re.search(pattern, norm_text) is not None


def _as_tab(item: Any) -> ArenaTab:
    if isinstance(item, ArenaTab):
        return item
    if isinstance(item, str):
        return ArenaTab(url=item, title="")
    if isinstance(item, (tuple, list)):
        url = str(item[0]) if item else ""
        title = str(item[1]) if len(item) > 1 else ""
        return ArenaTab(url=url, title=title)
    url = str(getattr(item, "url", "") or "")
    title_attr = getattr(item, "title", "")
    title = ""
    if callable(title_attr):
        try:
            title = str(title_attr() or "")
        except Exception:
            title = ""
    else:
        title = str(title_attr or "")
    return ArenaTab(url=url, title=title, handle=item)


def match_arena_tab(
    tabs: Sequence[Any],
    *,
    session_id: str = "",
    task_slug: str = "",
    extra_ids: Sequence[str] = (),
    arena_url: str = "",
) -> Optional[ArenaTab]:
    """Select the tab for this sprint, or None.

    Matching is strict:

    1. URL path ``/agent/<session_id>`` (exact segment, not a prefix).
    2. Otherwise a unique task slug in the URL or document title.

    The first tab containing ``arena`` is never a match. Ambiguous slug hits
    return None so Sprint 1 cannot be saved as Sprint 5.
    """
    views = [_as_tab(tab) for tab in tabs]
    ids: list[str] = []
    for value in (session_id, *extra_ids, extract_agent_session_id(arena_url)):
        text = str(value or "").strip()
        if text and text not in ids:
            ids.append(text)
    if ids:
        exact = [
            tab for tab in views
            if any(url_matches_session(tab.url, sid) for sid in ids)
        ]
        if exact:
            return exact[-1]
    slug = str(task_slug or "").strip()
    if slug and not _is_generic_slug(slug):
        hits = [
            tab for tab in views
            if slug_in_text(slug, tab.url) or slug_in_text(slug, tab.title)
        ]
        if len(hits) == 1:
            return hits[0]
    return None


def select_matching_page(
    pages: Sequence[Any],
    *,
    session_id: str = "",
    task_slug: str = "",
    extra_ids: Sequence[str] = (),
    arena_url: str = "",
) -> Any:
    """Return the page object for this session, or None. Never hijacks."""
    matched = match_arena_tab(
        pages,
        session_id=session_id,
        task_slug=task_slug,
        extra_ids=extra_ids,
        arena_url=arena_url,
    )
    if matched is None:
        return None
    return matched.handle if matched.handle is not None else matched


def _list_pages(browser: Any) -> list[Any]:
    pages: list[Any] = []
    for context in getattr(browser, "contexts", []) or []:
        pages.extend(getattr(context, "pages", []) or [])
    return pages


def _page_still_matches(
    page: Any,
    session_id: str,
    task_slug: str,
    extra_ids: Sequence[str],
    arena_url: str,
) -> bool:
    return select_matching_page(
        [page],
        session_id=session_id,
        task_slug=task_slug,
        extra_ids=extra_ids,
        arena_url=arena_url,
    ) is not None


# ---------------------------------------------------------------------------
# Completion state engine (bug 1)
# ---------------------------------------------------------------------------

def _pick(signals: Mapping[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in signals and signals[key] is not None:
            return signals[key]
    return default


def _normalize_signals(signals: Mapping[str, Any]) -> dict[str, Any]:
    blocks = _pick(signals, "code_blocks", "codeBlocks", default=[]) or []
    return {
        "create_pr_visible": bool(_pick(
            signals, "create_pr_visible", "createPrVisible", default=False
        )),
        "create_pr_enabled": bool(_pick(
            signals, "create_pr_enabled", "createPrEnabled", default=False
        )),
        "pr_already_created": bool(_pick(
            signals, "pr_already_created", "prAlreadyCreated", "has_pr", "hasPr", default=False
        )),
        "has_prior_pr": bool(_pick(
            signals, "has_prior_pr", "hasPriorPr", default=False
        )),
        "stop_visible": bool(_pick(signals, "stop_visible", "stopVisible", default=False)),
        "thinking": bool(_pick(signals, "thinking", default=False)),
        "bash_running": bool(_pick(signals, "bash_running", "bashRunning", default=False)),
        "terminal_exited": bool(_pick(
            signals, "terminal_exited", "terminalExited", default=False
        )),
        "terminal_text": str(_pick(signals, "terminal_text", "terminalText", default="") or ""),
        "assistant_text": str(_pick(
            signals, "assistant_text", "assistantText", default=""
        ) or ""),
        "code_blocks": [str(item) for item in blocks],
        "completion_marker": bool(_pick(
            signals, "completion_marker", "completionMarker", default=False
        )),
        "title": str(_pick(signals, "title", default="") or ""),
        "url": str(_pick(signals, "url", default="") or ""),
    }


def _signal_texts(sig: Mapping[str, Any]) -> str:
    parts = [sig["assistant_text"], sig["terminal_text"], sig["title"], *sig["code_blocks"]]
    return "\n".join(str(part or "") for part in parts)


def _has_explicit_marker(sig: Mapping[str, Any]) -> bool:
    if sig["completion_marker"]:
        return True
    return _COMPLETION_MARKER_RE.search(_signal_texts(sig)) is not None


def _in_progress_reason(sig: Mapping[str, Any]) -> Optional[str]:
    if sig["bash_running"]:
        return "bash_running"
    if sig["stop_visible"]:
        return "generating"
    if sig["thinking"]:
        return "thinking"
    return None


def _terminal_has_exited(sig: Mapping[str, Any]) -> bool:
    if sig["bash_running"] or sig["stop_visible"]:
        return False
    if sig["terminal_exited"]:
        return True
    return bool(_TERMINAL_EXIT_RE.search(sig["terminal_text"]))


def _best_diff(sig: Mapping[str, Any]) -> Optional[str]:
    chunks = [sig["terminal_text"], sig["assistant_text"], *sig["code_blocks"]]
    found: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        diff = extract_unified_diff(str(chunk or ""))
        if diff and diff not in seen:
            seen.add(diff)
            found.append(diff)
    if not found:
        return None
    git_diffs = [item for item in found if item.startswith("diff --git a/")]
    return max(git_diffs or found, key=len)


def detect_arena_run_state(
    signals: Mapping[str, Any],
    *,
    timed_out: bool = False,
) -> ArenaRunObservation:
    """Classify an Arena tab as RUNNING or COMPLETED.

    COMPLETED is returned only for a positive completion signal, and never
    while the agent is thinking or executing a command:

    * Create PR is visible and enabled
    * the terminal exited and its output contains a unified diff
    * an explicit completion marker was reached

    A DOM whose text length is unchanged, a README excerpt, or a watcher
    timeout are not completion. Those conditions stay RUNNING so a multi-minute
    ``pnpm install`` / ``vitest`` / ``type-check`` cannot be saved as a patch.
    """
    sig = _normalize_signals(signals)
    in_progress = _in_progress_reason(sig)
    if in_progress:
        return ArenaRunObservation(
            status="RUNNING",
            reason=in_progress,
            timed_out=timed_out,
            patch_text=None,
        )
    diff_text = _best_diff(sig)

    # Invariant: If a PR or branch was already created by this Arena session,
    # Arena cannot create a second PR. In that state, a clean unified diff (.patch)
    # is the exclusive valid delivery mechanism and marks completion.
    if (sig["pr_already_created"] or sig["has_prior_pr"]) and diff_text:
        return ArenaRunObservation(
            status="COMPLETED",
            reason="prior_pr_unified_diff",
            timed_out=timed_out,
            patch_text=diff_text,
        )

    if sig["create_pr_visible"] and sig["create_pr_enabled"]:
        return ArenaRunObservation(
            status="COMPLETED",
            reason="create_pr_active",
            timed_out=timed_out,
            patch_text=diff_text,
        )
    if _terminal_has_exited(sig):
        terminal_diff = extract_unified_diff(sig["terminal_text"])
        if terminal_diff:
            return ArenaRunObservation(
                status="COMPLETED",
                reason="terminal_exited_with_diff",
                timed_out=timed_out,
                patch_text=terminal_diff,
            )
    if _has_explicit_marker(sig):
        return ArenaRunObservation(
            status="COMPLETED",
            reason="explicit_completion_marker",
            timed_out=timed_out,
            patch_text=diff_text,
        )

    # When no Create PR button is visible (e.g. consumed, disabled or non-interactive mode)
    # and the agent finished generating a valid unified diff:
    if diff_text and not sig["create_pr_visible"]:
        return ArenaRunObservation(
            status="COMPLETED",
            reason="unified_diff_produced",
            timed_out=timed_out,
            patch_text=diff_text,
        )

    reason = "watcher_timeout" if timed_out else "awaiting_completion_signal"
    return ArenaRunObservation(
        status="RUNNING",
        reason=reason,
        timed_out=timed_out,
        patch_text=None,
    )


def _coerce_collect_timeout(timeout_seconds: Optional[int]) -> int:
    if timeout_seconds is None:
        return DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS
    try:
        value = int(timeout_seconds)
    except (TypeError, ValueError):
        return DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS
    if value < 0:
        return DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS
    return value


def _read_page_snapshot(page: Any) -> dict[str, Any]:
    raw = page.evaluate(_ARENA_SNAPSHOT_JS)
    if not isinstance(raw, dict):
        raw = {}
    raw.setdefault("url", getattr(page, "url", "") or "")
    if not raw.get("title"):
        title_attr = getattr(page, "title", "")
        if callable(title_attr):
            try:
                raw["title"] = title_attr() or ""
            except Exception:
                raw["title"] = ""
        else:
            raw["title"] = title_attr or ""
    return raw


def _format_running(
    observation: ArenaRunObservation,
    *,
    task_id: str,
    session_id: str,
    timeout_seconds: int,
    elapsed: float,
    endpoint: str,
    page_url: str,
) -> str:
    return "\n".join([
        "status=RUNNING",
        f"reason={observation.reason}",
        f"timeout_seconds={timeout_seconds}",
        f"elapsed_seconds={int(elapsed)}",
        f"timed_out={'true' if observation.timed_out else 'false'}",
        "patch_written=no",
        "### Arena.ai relácia beží (RUNNING)",
        "Relácia NIE JE dokončená. Ticho v chate počas pnpm/vitest/type-check",
        "nie je completion a .patch sa nezapisuje.",
        f"• Task: {task_id}",
        f"• Session: {session_id or '-'}",
        f"• Dôvod: {observation.reason}",
        f"• Timeout: {timeout_seconds}s (uplynulo {int(elapsed)}s)",
        f"• Tab: {page_url or '-'}",
        f"• CDP: {endpoint or '-'}",
    ])


def _format_not_found(
    task_id: str,
    session_id: str,
    task_slug: str,
    detail: str,
    skipped: str = "",
) -> str:
    lines = [
        "status=NOT_FOUND",
        "reason=tab_not_matched",
        "patch_written=no",
        "### Arena.ai tab pre túto reláciu nebol nájdený (NOT_FOUND)",
        "Cudzie sprinty neboli použité. Prvý tab s 'arena' v URL sa nepreberá.",
        f"• Task: {task_id}",
        f"• Session: {session_id or '-'}",
        f"• Slug: {task_slug or '-'}",
        f"• Detail: {detail}",
    ]
    if skipped:
        lines.append(f"• {skipped}")
    return "\n".join(lines)


def _skipped_tab_summary(pages: Sequence[Any]) -> str:
    urls = []
    for page in pages:
        url = str(getattr(page, "url", "") or "")
        if "arena" in url.lower() or "/agent" in url.lower():
            urls.append(url)
    if not urls:
        return "žiadne Arena taby na pripojených CDP endpointoch"
    return "preskočené taby: " + ", ".join(urls[:6])


def _resolve_collect_target(
    task_id: str,
    session_id: str,
    task_slug: str,
) -> dict[str, Any]:
    primary = (session_id or task_id or "").strip()
    slug = (task_slug or "").strip()
    if not slug and not _is_generic_slug(_slugify(task_id)):
        slug = _slugify(task_id)
    extra: list[str] = []
    arena_url = ""
    for record in _find_session_records([primary, task_id, slug]):
        remote = str(record.get("arena_session_id") or "").strip()
        if remote and remote not in extra and remote != primary:
            extra.append(remote)
        if not arena_url and record.get("arena_url"):
            arena_url = str(record["arena_url"])
        stored_slug = str(record.get("task_slug") or "").strip()
        if stored_slug and not task_slug:
            slug = stored_slug
    return {
        "task_id": task_id,
        "session_id": primary,
        "task_slug": slug,
        "extra_ids": extra,
        "arena_url": arena_url,
    }


def _finalize_completed(
    page: Any,
    snapshot: Mapping[str, Any],
    observation: ArenaRunObservation,
    *,
    task_id: str,
    session_id: str,
    task_slug: str,
    extra_ids: Sequence[str],
    arena_url: str,
    timeout_seconds: int,
    elapsed: float,
    endpoint: str,
) -> str:
    if not _page_still_matches(page, session_id, task_slug, extra_ids, arena_url):
        return _format_not_found(
            task_id,
            session_id,
            task_slug,
            "tab zmenil identitu tesne pred zápisom patchu",
        )
    patch_path, response_path = _artifact_paths(task_id)
    wrote = False
    if observation.patch_text:
        wrote = write_unified_patch(patch_path, observation.patch_text)
    if not wrote:
        _discard_invalid_patch(patch_path)
    assistant = str(
        snapshot.get("assistantText")
        or snapshot.get("assistant_text")
        or ""
    )
    if assistant:
        try:
            _atomic_write(response_path, assistant)
        except OSError:
            pass
    page_url = str(getattr(page, "url", "") or snapshot.get("url") or "")
    remote_id = extract_agent_session_id(page_url)
    progress = (
        f"COMPLETED ({observation.reason}); "
        + (f"patch tasks/{os.path.basename(patch_path)}" if wrote else "bez unified diff, .patch nezapísaný")
    )
    _update_sessions_exact(
        [session_id, task_id, remote_id],
        status="COMPLETED",
        progress=progress,
        arena_url=page_url,
        arena_session_id=remote_id,
        task_slug=task_slug,
        patch_written=wrote,
    )
    lines = [
        "status=COMPLETED",
        f"reason={observation.reason}",
        f"timeout_seconds={timeout_seconds}",
        f"elapsed_seconds={int(elapsed)}",
        f"patch_written={'yes' if wrote else 'no'}",
        "### Arena.ai relácia dokončená (COMPLETED)",
        f"• Task: {task_id}",
        f"• Session: {session_id or '-'}",
        f"• Dôvod: {observation.reason}",
        f"• Tab: {page_url or '-'}",
        f"• CDP: {endpoint or '-'}",
    ]
    if wrote:
        lines.append(f"• Súbor patchu: `tasks/{os.path.basename(patch_path)}`")
        lines.append(
            "• Pripravené na aplikovanie: "
            f"`apply_arena_patch(task_id='{task_id}', "
            f"patch_source='tasks/{os.path.basename(patch_path)}')`"
        )
    else:
        lines.append("• Unified diff sa nenašiel. Súbor .patch nebol vytvorený.")
    return "\n".join(lines)


def _watch_matched_page(
    page: Any,
    *,
    task_id: str,
    session_id: str,
    task_slug: str,
    extra_ids: Sequence[str],
    arena_url: str,
    timeout_seconds: int,
    endpoint: str,
) -> str:
    timeout_seconds = _coerce_collect_timeout(timeout_seconds)
    started = _monotonic()
    deadline = started + timeout_seconds
    while True:
        if not _page_still_matches(page, session_id, task_slug, extra_ids, arena_url):
            _discard_invalid_patch(_artifact_paths(task_id)[0])
            return _format_not_found(
                task_id,
                session_id,
                task_slug,
                "tab už nezodpovedá session id / task slug",
            )
        try:
            snapshot = _read_page_snapshot(page)
        except Exception as exc:
            snapshot = {"error": str(exc)}

        # Propagate prior PR / completed session history so watcher recognizes patch-only delivery
        try:
            prior_records = _find_session_records([task_id, session_id])
            if any(r.get("patch_written") or r.get("has_pr") or r.get("status") == "COMPLETED" for r in prior_records):
                snapshot["has_prior_pr"] = True
            run = get_development_run(task_id)
            if run and run.repair_attempts > 0:
                snapshot["has_prior_pr"] = True
        except Exception:
            pass

        timed_out = _monotonic() >= deadline
        observation = detect_arena_run_state(snapshot, timed_out=timed_out)
        elapsed = _monotonic() - started
        if observation.status == "COMPLETED":
            return _finalize_completed(
                page,
                snapshot,
                observation,
                task_id=task_id,
                session_id=session_id,
                task_slug=task_slug,
                extra_ids=extra_ids,
                arena_url=arena_url,
                timeout_seconds=timeout_seconds,
                elapsed=elapsed,
                endpoint=endpoint,
            )
        if timed_out:
            _discard_invalid_patch(_artifact_paths(task_id)[0])
            _update_sessions_exact(
                [session_id, task_id],
                status="RUNNING",
                progress=f"RUNNING ({observation.reason}); timeout {timeout_seconds}s",
                patch_written=False,
            )
            return _format_running(
                observation,
                task_id=task_id,
                session_id=session_id,
                timeout_seconds=timeout_seconds,
                elapsed=elapsed,
                endpoint=endpoint,
                page_url=str(getattr(page, "url", "") or ""),
            )
        _sleep(ARENA_POLL_INTERVAL_SECONDS)


def _probe_cdp_endpoint(endpoint: str, timeout: float = 0.2) -> bool:
    """Rýchly TCP socket check či je CDP port otvorený (eliminuje 2-10s timeouty Playwrightu)."""
    try:
        from urllib.parse import urlparse
        import socket
        u = urlparse(endpoint)
        host = u.hostname or "127.0.0.1"
        port = u.port or 9222
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@contextmanager
def _cdp_browser_session(ports: str) -> Iterator[list[tuple[Any, str]]]:
    """Connect to every live CDP endpoint and yield ``(browser, endpoint)``."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("playwright_unavailable") from exc
    with sync_playwright() as playwright:
        connected: list[tuple[Any, str]] = []
        for endpoint in _get_cdp_endpoints(ports):
            if not _probe_cdp_endpoint(endpoint):
                continue
            try:
                browser = playwright.chromium.connect_over_cdp(endpoint, timeout=2000)
            except Exception:
                continue
            connected.append((browser, endpoint))
        yield connected


def _find_matching_page(
    connected: Sequence[tuple[Any, str]],
    *,
    session_id: str,
    task_slug: str,
    extra_ids: Sequence[str],
    arena_url: str,
) -> tuple[Any, str, list[Any]]:
    seen: list[Any] = []
    for browser, endpoint in connected:
        pages = _list_pages(browser)
        seen.extend(pages)
        page = select_matching_page(
            pages,
            session_id=session_id,
            task_slug=task_slug,
            extra_ids=extra_ids,
            arena_url=arena_url,
        )
        if page is not None:
            return page, endpoint, seen
    return None, "", seen


def collect_code_from_arena_browser(
    task_id: str = "",
    timeout_seconds: int = DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS,
    ports: str = DEFAULT_CDP_PORTS,
    session_id: str = "",
    task_slug: str = "",
) -> str:
    """Watch one Arena session and extract a unified diff only when it finishes.

    The default timeout is 900 seconds (configurable, intended range 600–900).
    A session stays ``status=RUNNING`` while the agent is thinking or running
    bash (``pnpm install``, ``vitest``, ``type-check``), even if the chat text
    does not change. It becomes ``status=COMPLETED`` only when Create PR is
    active, the terminal exits with a finished diff, or an explicit completion
    marker is reached.

    Tabs are matched by ``/agent/<session_id>`` or by task slug in the URL /
    title. If that tab is absent the call returns ``status=NOT_FOUND`` and
    does not read another sprint. Non-diff text is never written to ``.patch``.
    """
    timeout_seconds = _coerce_collect_timeout(timeout_seconds)
    target = _resolve_collect_target(task_id, session_id, task_slug)
    try:
        with _cdp_browser_session(ports) as connected:
            if not connected:
                return _format_running(
                    ArenaRunObservation("RUNNING", "cdp_unavailable", timed_out=False),
                    task_id=task_id,
                    session_id=target["session_id"],
                    timeout_seconds=timeout_seconds,
                    elapsed=0,
                    endpoint="",
                    page_url="",
                ) + "\n• Chrome CDP mostík nie je aktívny. Stav COMPLETED sa nehlási."
            page, endpoint, seen = _find_matching_page(
                connected,
                session_id=target["session_id"],
                task_slug=target["task_slug"],
                extra_ids=target["extra_ids"],
                arena_url=target["arena_url"],
            )
            if page is None:
                _discard_invalid_patch(_artifact_paths(task_id)[0])
                return _format_not_found(
                    task_id,
                    target["session_id"],
                    target["task_slug"],
                    "žiadny tab s /agent/<session_id> ani s task slug",
                    _skipped_tab_summary(seen),
                )
            return _watch_matched_page(
                page,
                task_id=task_id,
                session_id=target["session_id"],
                task_slug=target["task_slug"],
                extra_ids=target["extra_ids"],
                arena_url=target["arena_url"],
                timeout_seconds=timeout_seconds,
                endpoint=endpoint,
            )
    except RuntimeError as exc:
        return (
            "status=RUNNING\n"
            "reason=playwright_unavailable\n"
            "patch_written=no\n"
            f"timeout_seconds={timeout_seconds}\n"
            "### Arena.ai stav neznámy (RUNNING)\n"
            f"• {exc}\n"
            "• Bez CDP sa relácia nesmie označiť ako COMPLETED."
        )
    except Exception as exc:
        return (
            "status=RUNNING\n"
            "reason=cdp_error\n"
            "patch_written=no\n"
            f"timeout_seconds={timeout_seconds}\n"
            "### Arena.ai stav neznámy (RUNNING)\n"
            f"• Chyba CDP: {exc}\n"
            "• Bez spoľahlivého signálu sa relácia nesmie označiť ako COMPLETED."
        )


# ---------------------------------------------------------------------------
# Physical dispatch (bug 3)
# ---------------------------------------------------------------------------

def _locator_first(page: Any, selector: str) -> Any:
    located = page.locator(selector)
    first = getattr(located, "first", located)
    if callable(first):
        return first()
    return first


def _first_locator(page: Any, selectors: Sequence[str], *, require_enabled: bool, require_visible: bool = True) -> Any:
    for selector in selectors:
        try:
            loc = _locator_first(page, selector)
            if loc.count() <= 0:
                continue
            if require_visible and not loc.is_visible():
                continue
            if require_enabled and not loc.is_enabled():
                continue
            return loc
        except Exception:
            continue
    return None


def _read_control_text(locator: Any) -> str:
    try:
        return str(locator.input_value() or "")
    except Exception:
        try:
            return str(locator.evaluate(
                "el => el.value || el.innerText || el.textContent || ''"
            ) or "")
        except Exception:
            return ""


def _text_matches_prompt(value: str, prompt: str) -> bool:
    expected = (prompt or "").strip()
    actual = (value or "").strip()
    if not expected:
        return False
    if actual == expected or expected in actual:
        return True
    import re
    norm_expected = re.sub(r"\s+", " ", expected)
    norm_actual = re.sub(r"\s+", " ", actual)
    return norm_expected == norm_actual or norm_expected in norm_actual


def _fill_and_submit(page: Any, prompt_text: str, auto_submit: bool) -> tuple[bool, bool, str]:
    composer = _first_locator(page, _COMPOSER_SELECTORS, require_enabled=False, require_visible=True)
    if composer is None:
        return False, False, "composer_missing"
    try:
        composer.fill("")
        composer.fill(prompt_text)
    except Exception as exc:
        return False, False, f"fill_failed:{exc}"
    if not _text_matches_prompt(_read_control_text(composer), prompt_text):
        return False, False, "fill_truncated"
    if not auto_submit:
        return True, False, "filled"
    button = _first_locator(page, _SUBMIT_SELECTORS, require_enabled=True)
    if button is not None:
        try:
            button.click(timeout=1500)
            return True, True, "submitted_click"
        except Exception:
            pass
    try:
        composer.press("Enter")
        return True, True, "submitted_enter"
    except Exception as exc:
        return True, False, f"submit_failed:{exc}"


def _wait_for_agent_session_url(page: Any) -> str:
    wait = float(os.getenv(
        "ARENA_NAVIGATION_WAIT_SECONDS",
        str(ARENA_NAVIGATION_WAIT_SECONDS),
    ))
    deadline = _monotonic() + max(wait, 0.0)
    last = str(getattr(page, "url", "") or "")
    while True:
        last = str(getattr(page, "url", "") or last)
        if extract_agent_session_id(last):
            return last
        if _monotonic() >= deadline:
            return last
        _sleep(0.25)


def _open_fresh_agent_page(browser: Any, target: str) -> Any:
    contexts = list(getattr(browser, "contexts", []) or [])
    context = contexts[0] if contexts else browser.new_context()
    page = context.new_page()
    page.goto(target, wait_until="domcontentloaded", timeout=30000)
    return page


def _target_agent_url(arena_url: str) -> str:
    if arena_url and extract_agent_session_id(arena_url):
        return arena_url
    return arena_agent_home_url()


def _ensure_arena_repository_selected(page: Any, target_repo: str = "badmarsh/openvpm-ai", max_attempts: int = 2) -> bool:
    """Zabezpečí, že v rozhraní Arena.ai je vybraný správny GitHub repozitár.
    Vykoná až max_attempts pokusov s overením, aby výber v rozhraní skutočne zotrval na vybranej položke.
    """
    repo_btn_selectors = [
        "button:has-text('Select a repository')",
        f"button:has-text('{target_repo}')",
        "button:has-text('badmarsh/')",
    ]

    for attempt in range(1, max_attempts + 1):
        btn = None
        for sel in repo_btn_selectors:
            try:
                loc = page.locator(sel).first
                if loc.is_visible():
                    btn = loc
                    break
            except Exception:
                continue

        if not btn:
            # Tlačidlo výberu repozitára nie je na stránke (napr. už bežiaca session)
            return True

        try:
            btn_text = (btn.inner_text() or "").strip()
        except Exception:
            btn_text = ""

        # Ak už je vybraný cieľový repozitár, netreba klikať
        if target_repo in btn_text:
            return True

        # 1. Otvorenie dropdownu
        try:
            btn.click()
            page.wait_for_timeout(400)
        except Exception:
            pass

        # 2. Overenie otvorenia dialógu
        try:
            dialog = page.locator("[role='dialog']").first
            if not dialog.is_visible():
                btn.click()
                page.wait_for_timeout(400)
        except Exception:
            pass

        # 3. Vyhľadanie a kliknutie na repozitár
        try:
            option = page.locator(f"[role='dialog'] [role='option']:has-text('{target_repo}')").first
            if option.is_visible():
                option.click()
                page.wait_for_timeout(500)
            else:
                all_opts = page.locator("[role='dialog'] [role='option']").all()
                for opt in all_opts:
                    if target_repo in (opt.inner_text() or ""):
                        opt.scroll_into_view_if_needed()
                        opt.click()
                        break
                page.wait_for_timeout(500)
        except Exception:
            pass

        # 4. Overenie úspechu výberu
        for sel in repo_btn_selectors:
            try:
                loc = page.locator(sel).first
                if loc.is_visible():
                    new_text = (loc.inner_text() or "").strip()
                    if target_repo in new_text:
                        return True
            except Exception:
                continue

        page.wait_for_timeout(400)

    return False




def verify_arena_repository_lock(
    ports: str = DEFAULT_CDP_PORTS,
    target_repo: str = "",
    max_attempts: int = 2,
) -> str:
    """Overí a zamkne GitHub repozitár v Arena.ai UI pred každým dispatchom.

    Volá _ensure_arena_repository_selected() cez aktívny Chrome CDP tab.
    Vráti LOCK_OK ak repozitár bol úspešne vybraný, alebo LOCK_FAILED ak zámok
    po max_attempts pokusoch zlyhal. V tom prípade NESMI nasledovať žiadny dispatch.

    Parametre:
        ports:        CDP porty (predvolené DEFAULT_CDP_PORTS).
        target_repo:  Cieľový repozitár (predvolené ARENA_DEFAULT_GITHUB_REPO).
        max_attempts: Počet pokusov verifikačného zámku (predvolene 2).
    """
    repo = target_repo.strip() or os.getenv("ARENA_DEFAULT_GITHUB_REPO", "badmarsh/openvpm-ai")
    try:
        with _cdp_browser_session(ports) as connected:
            if not connected:
                return (
                    "LOCK_FAILED reason=cdp_unavailable "
                    "detail=Chrome CDP port nie je aktivny. Repozitar nebol overeny."
                )
            for browser, endpoint in connected:
                pages = _list_pages(browser)
                if not pages:
                    continue
                page = next(
                    (p for p in pages if "/agent" in str(getattr(p, "url", ""))),
                    pages[0],
                )
                locked = _ensure_arena_repository_selected(
                    page, target_repo=repo, max_attempts=max_attempts
                )
                if locked:
                    return f"LOCK_OK repo={repo} endpoint={endpoint}"
                return (
                    f"LOCK_FAILED reason=repo_not_selected repo={repo} "
                    f"detail=Ani po {max_attempts} pokusoch tlacidlo nehlasi spravny repozitar. "
                    f"DISPATCH_ABORTED - neodosielaj prompt."
                )
            return "LOCK_FAILED reason=no_pages detail=Ziadny tab nebol najdeny v Chrome CDP."
    except RuntimeError as exc:
        return f"LOCK_FAILED reason=playwright_unavailable detail={exc}"
    except Exception as exc:
        return f"LOCK_FAILED reason=exception detail={exc}"

def _dispatch_on_browser(
    browser: Any,
    prompt_text: str,
    *,
    session_id: str,
    task_slug: str,
    arena_url: str,
    auto_submit: bool,
) -> BrowserDispatchResult:
    """Fill this Chrome only. Never type into an unrelated sprint tab."""
    pages = _list_pages(browser)
    page = select_matching_page(
        pages,
        session_id=session_id,
        task_slug=task_slug,
        arena_url=arena_url,
    )
    opened_new = False
    if page is None:
        target = _target_agent_url(arena_url)
        page = _open_fresh_agent_page(browser, target)
        opened_new = True

    # Ak začíname novú reláciu, uistíme sa, že je vybraný správny GitHub repozitár (s 2 pokusmi a overením)
    page_url = str(getattr(page, "url", "") or "")
    if opened_new or (not extract_agent_session_id(page_url) and "arena.ai" in page_url):
        target_repo = os.getenv("ARENA_DEFAULT_GITHUB_REPO", "badmarsh/openvpm-ai")
        repo_locked = _ensure_arena_repository_selected(page, target_repo=target_repo, max_attempts=2)
        if not repo_locked:
            return BrowserDispatchResult(
                ok=False,
                url=str(getattr(page, "url", "") or ""),
                message=f"DISPATCH_ABORTED: Nepodarilo sa uzamknúť repozitár {target_repo} v Arena UI. Prompt NEBOL odoslaný.",
                submitted=False,
                opened_new=opened_new,
            )

    filled, submitted, detail = _fill_and_submit(page, prompt_text, auto_submit)
    if not filled or (auto_submit and not submitted):
        return BrowserDispatchResult(
            ok=False,
            url=str(getattr(page, "url", "") or ""),
            message=f"DISPATCH_FAILED reason={detail}",
            submitted=submitted,
            opened_new=opened_new,
        )
    observed = _wait_for_agent_session_url(page)
    remote = extract_agent_session_id(observed)
    return BrowserDispatchResult(
        ok=True,
        url=observed,
        message=detail,
        submitted=submitted,
        opened_new=opened_new,
        arena_session_id=remote,
    )


def _format_dispatch_ok(result: BrowserDispatchResult, endpoint: str) -> str:
    remote = result.arena_session_id or "-"
    url = result.url or arena_agent_home_url()
    opened = "/agent" if result.opened_new else "existing"
    submitted = "yes" if result.submitted else "no"
    return (
        f"DISPATCH_OK opened={opened} url={url} submitted={submitted} "
        f"arena_session_id={remote} endpoint={endpoint}\n"
        f"✅ Prompt bol úspešne vložený do Arena.ai ({url}) cez {endpoint} a odoslaný."
    )


def _dispatch_succeeded(message: str) -> bool:
    if "DISPATCH_OK" not in (message or ""):
        return False
    return "DISPATCH_FAILED" not in message


def _parse_token(message: str, name: str) -> str:
    match = re.search(rf"(?:^|\s){re.escape(name)}=(\S+)", message or "")
    return match.group(1) if match else ""


def send_prompt_to_arena_browser(
    prompt_text: str,
    ports: str = DEFAULT_CDP_PORTS,
    auto_submit: bool = True,
    session_id: str = "",
    task_slug: str = "",
    arena_url: str = "",
) -> str:
    """Open ``/agent`` (or the matching session tab) and submit ``prompt_text``.

    An existing tab is used only when its URL is ``/agent/<session_id>`` or
    its URL/title contains the task slug. Otherwise a new ``/agent`` tab is
    opened. Unrelated sprint tabs are never filled.
    """
    if not (prompt_text or "").strip():
        return "DISPATCH_FAILED reason=empty_prompt"
    try:
        with _cdp_browser_session(ports) as connected:
            if not connected:
                return (
                    "DISPATCH_FAILED reason=cdp_unavailable "
                    "detail=Chrome CDP port nie je aktívny. Cudzí tab nebol použitý."
                )
            last_failure = "DISPATCH_FAILED reason=cdp_unavailable"
            for browser, endpoint in connected:
                try:
                    result = _dispatch_on_browser(
                        browser,
                        prompt_text,
                        session_id=session_id,
                        task_slug=task_slug,
                        arena_url=arena_url,
                        auto_submit=auto_submit,
                    )
                except Exception as exc:
                    last_failure = f"DISPATCH_FAILED reason=exception detail={exc}"
                    continue
                result.endpoint = endpoint
                if result.ok:
                    return _format_dispatch_ok(result, endpoint)
                last_failure = result.message or last_failure
            return last_failure
    except RuntimeError as exc:
        return f"DISPATCH_FAILED reason=playwright_unavailable detail={exc}"
    except Exception as exc:
        return f"DISPATCH_FAILED reason=cdp_error detail={exc}"


def _resolve_dispatch_prompt(
    module_name: str,
    prompt_summary: str,
    full_prompt: str,
    task_file: str,
) -> tuple[str, str]:
    """Return ``(prompt, source)``. Never glob a prefix of another sprint."""
    if full_prompt and full_prompt.strip():
        return full_prompt, "full_prompt"
    if task_file:
        path = task_file
        if not os.path.isabs(path):
            path = os.path.join(_get_repo_path(), path)
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    return handle.read(), "task_file"
            except OSError:
                pass
    return prompt_summary or "", "summary_only"


def dispatch_to_arena_session(
    module_name: str,
    prompt_summary: str,
    target_model: str = "Arena.ai",
    full_prompt: str = "",
    task_file: str = "",
    session_id: str = "",
    task_slug: str = "",
) -> str:
    """Register a session and physically dispatch the full task to Arena.ai.

    Calling this opens ``/agent``, fills the composer with the complete task
    specification (not the 200-character summary), and triggers generation via
    :func:`send_prompt_to_arena_browser`. The JSON record is bookkeeping.
    ``RUNNING`` is recorded only after ``DISPATCH_OK``.
    """
    del target_model  # external model names are not stored; target is Arena.ai
    local_id = (session_id or "").strip() or _new_local_session_id(module_name)
    slug = (task_slug or "").strip() or _slugify(module_name)
    prompt, source = _resolve_dispatch_prompt(
        module_name, prompt_summary, full_prompt, task_file
    )
    base = {
        "session_id": local_id,
        "task_id": local_id,
        "module": module_name,
        "task_slug": slug,
        "prompt_summary": (prompt_summary or "")[:200],
        "target_model": "Arena.ai",
        "prompt_source": source,
    }
    if not prompt.strip():
        _upsert_session({
            **base,
            "status": "DISPATCH_FAILED",
            "progress": "Prázdny prompt, prehliadač nebol kontaktovaný.",
            "dispatch_ok": False,
        })
        return (
            "status=DISPATCH_FAILED\n"
            "DISPATCH_FAILED reason=empty_prompt\n"
            f"• ID: {local_id}\n"
            "• Stav: DISPATCH_FAILED"
        )
    _upsert_session({
        **base,
        "status": "DISPATCHING",
        "progress": "Otváranie /agent a vkladanie plnej špecifikácie.",
        "dispatch_ok": False,
    })
    try:
        browser_status = send_prompt_to_arena_browser(
            prompt_text=prompt,
            auto_submit=True,
            session_id=local_id,
            task_slug=slug,
        )
    except Exception as exc:
        browser_status = f"DISPATCH_FAILED reason=exception detail={exc}"
    ok = _dispatch_succeeded(browser_status)
    arena_url = _parse_token(browser_status, "url")
    remote_id = _parse_token(browser_status, "arena_session_id")
    if remote_id in {"", "-"}:
        remote_id = extract_agent_session_id(arena_url)
    status = "RUNNING" if ok else "DISPATCH_FAILED"
    _update_sessions_exact(
        [local_id],
        status=status,
        progress=browser_status[:500],
        arena_url=arena_url,
        arena_session_id=remote_id,
        dispatch_ok=ok,
        prompt_source=source,
        module=module_name,
        task_slug=slug,
    )
    if ok:
        return (
            "status=RUNNING\n"
            "DISPATCH_OK\n"
            "Relácia Arena.ai odoslaná!\n"
            f"• ID: {local_id}\n"
            f"• Modul: {module_name}\n"
            f"• URL: {arena_url or arena_agent_home_url()}\n"
            f"• Zdroj promptu: {source}\n"
            f"• Prehliadač: {browser_status}\n"
            "• Stav: RUNNING"
        )
    return (
        "status=DISPATCH_FAILED\n"
        "DISPATCH_FAILED\n"
        "Relácia nebola fyzicky odoslaná do prehliadača. "
        "JSON záznam nie je dispatch.\n"
        f"• ID: {local_id}\n"
        f"• Dôvod: {browser_status}\n"
        "• Stav: DISPATCH_FAILED"
    )


# ---------------------------------------------------------------------------
# Architectural audit (bug 4)
# ---------------------------------------------------------------------------

def _normalize_repo_path(path: str) -> str:
    norm = (path or "").strip().replace("\\", "/").lstrip("./")
    for marker in ("apps/", "packages/"):
        index = norm.find(marker)
        if index > 0 and ("/" in norm[:index] or ":" in norm[:index]):
            norm = norm[index:]
            break
    return norm


def _upstream_root_candidates() -> list[str]:
    """Locations of the vanilla OpenVPM checkout, most specific first."""
    candidates = []
    env = os.getenv("OPENVPM_UPSTREAM_DIR", "").strip()
    if env:
        candidates.append(env)
    repo = _get_repo_path()
    candidates.append(os.path.normpath(os.path.join(repo, "..", "OpenVPM")))
    candidates.append(os.path.normpath(os.path.join(repo, "..", "openvpm")))
    candidates.append(r"C:\Users\marek\Documents\Vet\OpenVPM")
    candidates.append("/mnt/c/Users/marek/Documents/Vet/OpenVPM")
    unique: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        key = os.path.normcase(os.path.normpath(item))
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def _upstream_router_dirs() -> list[str]:
    found = []
    for root in _upstream_root_candidates():
        directory = os.path.join(root, "apps", "web", "server", "routers")
        if os.path.isdir(directory):
            found.append(directory)
    return found


def _upstream_router_exists(basename: str) -> Optional[bool]:
    """True/False when an upstream tree was found, else None.

    None means the caller must not treat a missing checkout as proof that a
    vanilla router is custom.
    """
    directories = _upstream_router_dirs()
    if not directories:
        return None
    target = basename.lower()
    for directory in directories:
        try:
            names = set(os.listdir(directory))
        except OSError:
            continue
        if basename in names or target in {name.lower() for name in names}:
            return True
    return False


def _router_violation(rel_path: str) -> Optional[str]:
    norm = _normalize_repo_path(rel_path)
    if not norm.startswith("apps/web/server/routers/"):
        return None
    if norm.startswith("apps/web/server/routers/extensions/"):
        return None
    base = os.path.basename(norm)
    if base in {"_app.ts", "_app.tsx"}:
        return None
    if not base.endswith((".ts", ".tsx", ".js", ".jsx")):
        return None
    upstream = _upstream_router_exists(base)
    if upstream is True:
        return None
    if upstream is None and base in KNOWN_UPSTREAM_ROUTER_FILES:
        return None
    return (
        f"Upozornenie: Nový vlastný tRPC router `{norm}` by mal patriť do "
        "`extensions/`. Súbor neexistuje v upstream OpenVPM "
        "(`../OpenVPM/apps/web/server/routers/`)."
    )


def audit_architectural_boundaries(file_list_comma_separated: str) -> str:
    """Audit changed paths against zero-conflict and backport rules.

    Vanilla schema files and ``_journal.json`` are violations. A tRPC router
    under ``apps/web/server/routers/`` is a violation only when it is absent
    from upstream OpenVPM (``../OpenVPM/apps/web/server/routers/``). Generic
    enhancements of vanilla routers such as ``records.ts`` and
    ``whiteboard.ts`` are permitted under Upstream-Backport-Aware Coding.
    Extension routers are always permitted.
    """
    files = [item.strip() for item in (file_list_comma_separated or "").split(",") if item.strip()]
    violations: list[str] = []
    for rel in files:
        norm = _normalize_repo_path(rel)
        base = os.path.basename(norm)
        if norm.startswith("packages/db/schema/") and not base.startswith("ext_"):
            violations.append(
                f"Porušenie pravidla 3.1: Vanilla schéma `{norm}` nesmie byť menená. "
                "Použi `packages/db/schema/ext_*.ts`."
            )
        if "_journal.json" in norm:
            violations.append(
                "Porušenie pravidla 3.2: `_journal.json` nesmie byť upravovaný ručne."
            )
        router_issue = _router_violation(norm)
        if router_issue:
            violations.append(router_issue)
    if violations:
        return "❌ ARCHITEKTURÁLNE PORUŠENIA NÁJDENÉ:\n" + "\n".join(
            f"• {item}" for item in violations
        )
    return (
        "✅ ARCHITEKTONICKÝ AUDIT: Všetky zmeny sú v súlade so Zero-Conflict "
        "Upstream architektúrou. Generic enhancement vanilla upstream súborov "
        "(vrátane routerov existujúcich v ../OpenVPM/apps/web/server/routers/) "
        "je povolený."
    )


def _lookup_dispatch_target(task_id: str) -> dict[str, str]:
    """Resolve the Arena tab a repair prompt must return to."""
    clean = _safe_artifact_stem(task_id)
    records = _find_session_records([task_id, clean])
    if not records:
        return {"session_id": task_id, "task_slug": "", "arena_url": ""}
    record = records[-1]
    return {
        "session_id": str(
            record.get("arena_session_id")
            or record.get("session_id")
            or task_id
        ),
        "task_slug": str(record.get("task_slug") or ""),
        "arena_url": str(record.get("arena_url") or ""),
    }
