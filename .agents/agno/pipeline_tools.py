import os
import sys
import time
import shutil
import json
import glob
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any

AGNO_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.abspath(os.path.join(AGNO_DIR, "../.."))
TMP_DIR = os.path.join(AGNO_DIR, "tmp")
ARENA_SESSIONS_FILE = os.path.join(TMP_DIR, "arena_sessions.json")

# Import contracts zo samostatného balíčka openvpm_dev_orchestrator
try:
    from openvpm_dev_orchestrator.contracts import (
        RunState,
        DevTaskRequest,
        RiskClass,
        PolicyDecision,
        ChangePlan,
        CommandResult,
        ReviewReport,
        DevelopmentRun,
    )
except ImportError:
    sys.path.insert(0, os.path.join(AGNO_DIR, "src"))
    from openvpm_dev_orchestrator.contracts import (
        RunState,
        DevTaskRequest,
        RiskClass,
        PolicyDecision,
        ChangePlan,
        CommandResult,
        ReviewReport,
        DevelopmentRun,
    )


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
    path = os.path.join(REPO_DIR, subpath) if subpath else REPO_DIR
    if not os.path.exists(path) and os.path.exists("/home/ubuntu/openvpm"):
        return os.path.join("/home/ubuntu/openvpm", subpath)
    return path

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
from agno.tools.firecrawl import FirecrawlTools

firecrawl_tools = FirecrawlTools(
    api_url="https://firecrawl.dev.significa.sk",
    api_key="fc-dummy",
    enable_scrape=True,
    enable_crawl=True,
    enable_mapping=True,
    enable_search=True,
)


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


def dispatch_to_arena_session(module_name: str, prompt_summary: str, target_model: str = "Arena.ai") -> str:
    """Zaregistruje a odošle novú úlohu do zoznamu relácií Arena.ai a priradí jej jedinečné session ID."""
    os.makedirs(TMP_DIR, exist_ok=True)
    sessions = []
    if os.path.exists(ARENA_SESSIONS_FILE):
        try:
            with open(ARENA_SESSIONS_FILE, "r", encoding="utf-8") as f:
                sessions = json.load(f)
        except Exception:
            sessions = []

    clean_target = "Arena.ai"

    import time
    session_id = f"arena-{int(time.time())}-{module_name.lower().replace(' ', '-')[:12]}"
    
    # Skutočné odoslanie do prehliadača ak je prompt zadaný
    browser_status = ""
    try:
        # Skontroluj, či existuje pripravené zadanie v tasks/
        tasks_dir = os.path.join(_get_repo_path(), "tasks")
        matching_task = glob.glob(os.path.join(tasks_dir, f"*{module_name.lower()[:8]}*.md"))
        full_text = prompt_summary
        if matching_task:
            with open(matching_task[0], "r", encoding="utf-8") as f:
                full_text = f.read()
        
        browser_status = send_prompt_to_arena_browser(prompt_text=full_text, auto_submit=True)
    except Exception as e:
        browser_status = f"Odoslanie cez CDP zlyhalo: {str(e)}"

    new_session = {
        "session_id": session_id,
        "module": module_name,
        "prompt_summary": prompt_summary[:200],
        "target_model": clean_target,
        "status": "RUNNING",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "progress": f"Generovanie kódu v Arena.ai... ({browser_status})"
    }
    sessions.append(new_session)
    with open(ARENA_SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2)

    return f"Relácia Arena.ai odoslaná!\n• ID: {session_id}\n• Modul: {module_name}\n• Prehliadač: {browser_status}\n• Stav: RUNNING"


def list_active_arena_sessions() -> str:
    """Vráti prehľad všetkých aktívnych relácií v Arena.ai zo súborov tasks/ a arena_sessions.json."""
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    sessions = []
    
    if os.path.exists(ARENA_SESSIONS_FILE):
        try:
            with open(ARENA_SESSIONS_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, list):
                    sessions = loaded
        except Exception:
            sessions = []

    task_files = glob.glob(os.path.join(tasks_dir, "arena-*.md"))
    registered_ids = {s.get("session_id") for s in sessions if isinstance(s, dict)}

    for tf in task_files:
        tid = os.path.basename(tf).replace(".md", "")
        if tid not in registered_ids:
            has_patch = (
                os.path.exists(os.path.join(tasks_dir, f"{tid}.patch")) or
                os.path.exists(os.path.join(tasks_dir, f"arena-response-{tid}.patch"))
            )
            sessions.append({
                "session_id": tid,
                "module": tid,
                "target_model": "Arena.ai",
                "status": "COMPLETED" if has_patch else "PENDING",
                "progress": "Patch pripravený v tasks/" if has_patch else "Zadanie vytvorené v tasks/",
            })

    if not sessions:
        return "ℹ️ Žiadne aktívne relácie Arena.ai neboli nájdené. Novú úlohu môžete vytvoriť cez 'create_and_dispatch_arena_task'."

    res = f"### Aktívne Arena.ai relácie ({len(sessions)} celkovo):\n"
    for s in sessions:
        icon = "✅" if s.get("status") == "COMPLETED" else "⏳" if s.get("status") == "RUNNING" else "⚠️"
        res += f"{icon} **[{s.get('session_id')}]** {s.get('module')}\n"
        res += f"   Cieľ: `Arena.ai` | Stav: **{s.get('status')}**\n"
        res += f"   Detail: {s.get('progress')}\n\n"
    return res


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
    patch_files = glob.glob(os.path.join(tasks_dir, "*.patch"))
    repair_files = glob.glob(os.path.join(tasks_dir, "repair-*.md"))

    res = ["### Arena Watcher Health Audit:"]
    res.append(f"• Celkový počet zadaní v tasks/: {len(task_files)}")
    res.append(f"• Pripravené patche (*.patch): {len(patch_files)}")
    res.append(f"• Opravné výzvy (repair-*.md): {len(repair_files)}")
    res.append(f"• Aktívne swarm vetvy v git: {len(swarm_branches)} ({', '.join(swarm_branches) if swarm_branches else 'žiadne'})")

def _get_cdp_endpoints(custom_ports: str = "9222,60325,9223,9229,9333,5000") -> list:
    """Zostaví prioritný zoznam CDP endpointov pre Windows host (192.168.0.100) aj lokálny WSL."""
    endpoints = []
    win_host = os.getenv("WINDOWS_HOST_IP", "192.168.0.100")

    # 1. Čítanie aktívneho DevTools portu priamo z Windows Chrome profilu
    try:
        from pathlib import Path
        for pth in [
            Path("/mnt/c/Users/marek/AppData/Local/Google/Chrome/User Data/DevToolsActivePort"),
            Path("/home/ubuntu/.config/google-chrome/DevToolsActivePort"),
        ]:
            if pth.exists():
                lines = pth.read_text(encoding="utf-8").strip().splitlines()
                if lines and lines[0].strip().isdigit():
                    act_port = int(lines[0].strip())
                    endpoints.append(f"http://{win_host}:{act_port}")
                    endpoints.append(f"http://127.0.0.1:{act_port}")
    except Exception:
        pass

    # 2. Windows host bridge (192.168.0.100:9222) a lokálny port 9222
    endpoints.append(f"http://{win_host}:9222")
    endpoints.append("http://127.0.0.1:9222")

    # 3. Zadané voliteľné porty
    if custom_ports:
        for p in [int(x.strip()) for x in custom_ports.split(",") if x.strip().isdigit()]:
            endpoints.append(f"http://{win_host}:{p}")
            endpoints.append(f"http://127.0.0.1:{p}")

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
    patch_files = glob.glob(os.path.join(tasks_dir, "*.patch"))
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
    "git", "pnpm", "gh", "node", "python", "python3", "pytest", "cat", "ls", "dir", "echo"
}
FORBIDDEN_OPERATORS = ["|", "`", "$(", ">", "<"]
FORBIDDEN_PATH_SUBSTRINGS = [".env", "id_rsa", "id_ed25519", "credentials", "secret"]


def run_shell_command(command: str) -> str:
    """Spustí bezpečný príkaz v termináli v priečinku repozitára s prísnym whitelistom nástrojov a ochranou pred command injection.
    Podporuje jednotlivé príkazy aj sekvenčné zreťazenie cez ';' alebo '&&'.
    """
    if not command or not command.strip():
        return "Chyba: Príkaz je prázdny."

    command = command.strip().rstrip(";\n\r ").strip()

    # 1. Zákaz nebezpečných operátorov shell injection (pipe, subshell, redirects)
    for op in FORBIDDEN_OPERATORS:
        if op in command:
            return f"❌ Bezpečnostné zamietnutie: Operátor '{op}' nie je z bezpečnostných dôvodov povolený."

    import re
    import shlex
    sub_commands = [c.strip() for c in re.split(r";|&&", command) if c.strip()]
    if not sub_commands:
        return "Chyba: Príkaz neobsahuje žiadne inštrukcie."

    results = []
    repo = _get_repo_path()
    is_win = sys.platform == "win32"

    for sub_cmd in sub_commands:
        # 2. Ochrana citlivých súborov (secrets & credentials)
        lower_cmd = sub_cmd.lower()
        for forbidden in FORBIDDEN_PATH_SUBSTRINGS:
            if forbidden in lower_cmd:
                return f"❌ Bezpečnostné zamietnutie: Prístup k súborom obsahujúcim '{forbidden}' je blokovaný."

        try:
            parts = shlex.split(sub_cmd, posix=not is_win)
        except Exception as e:
            return f"Chyba pri syntaktickej analýze príkazu '{sub_cmd}': {e}"

        if not parts:
            continue

        cmd_base = os.path.basename(parts[0]).lower().replace(".exe", "").replace(".cmd", "").replace(".bat", "")
        if cmd_base not in ALLOWED_SHELL_COMMANDS:
            return (
                f"❌ Bezpečnostné zamietnutie: Nástroj '{parts[0]}' nie je na zozname povolených príkazov.\n"
                f"Povolené nástroje sú výhradne: {', '.join(sorted(ALLOWED_SHELL_COMMANDS))}."
            )

        executable = parts[0]
        if is_win:
            which_exe = shutil.which(parts[0])
            if which_exe:
                executable = which_exe

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
                # Pri chybe prerušíme sekvenciu
                break
        except subprocess.TimeoutExpired:
            return f"❌ Timeout: Príkaz '{sub_cmd}' prekročil maximálny limit 60 sekúnd."
        except Exception as e:
            return f"Chyba pri spúšťaní príkazu '{sub_cmd}': {str(e)}"

    output = "\n\n".join(results)
    return output[:3000] if output else "Príkaz prebehol úspešne bez výstupu (exit code 0)."


# =====================================================================
# DOMAIN D: ARCHITECTURAL & COMPLIANCE AUDIT
# =====================================================================

def audit_architectural_boundaries(file_list_comma_separated: str) -> str:
    """Overí, či zmenené súbory neporušujú pravidlá zero-conflict upstream syncu (nedotýkajú sa vanilla schém ani journalu)."""
    files = [f.strip() for f in file_list_comma_separated.split(",") if f.strip()]
    violations = []
    
    for f in files:
        if f.startswith("packages/db/schema/") and not os.path.basename(f).startswith("ext_"):
            violations.append(f"Porušenie pravidla 3.1: Vanilla schéma `{f}` nesmie byť menená. Použi `packages/db/schema/ext_*.ts`.")
        if "_journal.json" in f:
            violations.append("Porušenie pravidla 3.2: `_journal.json` nesmie byť upravovaný ručne.")
        if f.startswith("apps/web/server/routers/") and not f.startswith("apps/web/server/routers/extensions/") and not f.endswith("_app.ts"):
            repo_dir = _get_repo_path()
            upstream_file = os.path.normpath(os.path.join(repo_dir, "..", "OpenVPM", f))
            if not os.path.exists(upstream_file):
                violations.append(f"Upozornenie: Nový vlastný tRPC router `{f}` by mal patriť do `extensions/`.")

    if violations:
        return "❌ ARCHITEKTURÁLNE PORUŠENIA NÁJDENÉ:\n" + "\n".join(f"• {v}" for v in violations)
    return "✅ ARCHITEKTONICKÝ AUDIT: Všetky zmeny sú v súlade so Zero-Conflict Upstream architektúrou."


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

def send_prompt_to_arena_browser(
    prompt_text: str,
    ports: str = "9222,60325,9223,9229,9333,5000",
    auto_submit: bool = True,
) -> str:
    """Odošle pripravený prompt cez CDP priamo do aktívneho tabu Arena.ai v Google Chrome a automaticky ho odošle (Submit)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return "Chyba: playwright knižnica nie je dostupná v prostredí."

    endpoints = _get_cdp_endpoints(ports)
    
    try:
        with sync_playwright() as p:
            for endpoint in endpoints:
                try:
                    browser = p.chromium.connect_over_cdp(endpoint, timeout=10000)
                    pages = [page for ctx in browser.contexts for page in ctx.pages]
                    arena_page = next((page for page in pages if "arena" in page.url.lower()), None)
                    if arena_page:
                        url = arena_page.url
                        textarea = arena_page.locator("textarea, div[contenteditable='true'], input[type='text']").first
                        if textarea.count() > 0:
                            textarea.fill(prompt_text)
                            submitted_msg = ""
                            if auto_submit:
                                clicked = False
                                for sel in [
                                    "button[type='submit']",
                                    "button:has-text('Send')",
                                    "button:has-text('Odoslať')",
                                    "button[aria-label*='Send']",
                                    "button[aria-label*='Submit']",
                                    "button.send-button",
                                    "form button",
                                ]:
                                    btn = arena_page.locator(sel).first
                                    if btn.count() > 0 and btn.is_visible() and btn.is_enabled():
                                        try:
                                            btn.click(timeout=1500)
                                            clicked = True
                                            break
                                        except Exception:
                                            pass
                                if not clicked:
                                    try:
                                        textarea.press("Enter")
                                        clicked = True
                                    except Exception:
                                        pass
                                submitted_msg = " [Odoslané/Submit: ÁNO]" if clicked else " [Odoslanie čaká na klik]"
                            return f"✅ Prompt bol úspešne vložený do aktívneho tabu Arena.ai ({url}) cez {endpoint}!{submitted_msg}"
                        else:
                            return f"⚠️ Tab Arena.ai nájdený na {endpoint} ({url}), ale nenašiel sa vstupný formulár. Prompt je uložený v tasks/."
                except Exception:
                    continue
    except Exception as e:
        return f"Chyba pri hľadaní CDP portu: {str(e)}"

    return "ℹ️ Chrome s Arena.ai a CDP portom nebol detegovaný. Prompt bol bezpečne uložený do tasks/ pre manuálne vloženie do Arena.ai."


def collect_code_from_arena_browser(
    task_id: str,
    timeout_seconds: int = 180,
    ports: str = "9222,60325,9223,9229,9333,5000",
) -> str:
    """Počká na dokončenie generovania v Arena.ai a automaticky extrahuje git patch alebo kód do tasks/{task_id}.patch."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return "Chyba: playwright knižnica nie je dostupná v prostredí."

    clean_id = task_id.replace("arena-", "").replace(".patch", "")[:25]
    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    os.makedirs(tasks_dir, exist_ok=True)
    patch_path = os.path.join(tasks_dir, f"{clean_id}.patch")
    response_path = os.path.join(tasks_dir, f"arena-response-{clean_id}.md")

    endpoints = _get_cdp_endpoints(ports)

    try:
        with sync_playwright() as p:
            for endpoint in endpoints:
                try:
                    browser = p.chromium.connect_over_cdp(endpoint, timeout=10000)
                    pages = [page for ctx in browser.contexts for page in ctx.pages]
                    arena_page = next((page for page in pages if "arena" in page.url.lower()), None)
                    if not arena_page:
                        continue

                    # Sledovanie generovania: čakaj kým zmizne stop tlačidlo alebo kým sa dĺžka odpovede zastabilizuje
                    start_time = time.time()
                    last_len = 0
                    stable_cycles = 0

                    while time.time() - start_time < timeout_seconds:
                        stop_btn = arena_page.locator("button:has-text('Stop'), button:has-text('Stop generating')").first
                        is_generating = stop_btn.count() > 0 and stop_btn.is_visible()

                        # Zisti aktuálny text odpovede
                        curr_text = arena_page.evaluate("""() => {
                            const pres = Array.from(document.querySelectorAll('pre code, pre, .prose'));
                            return pres.map(p => p.innerText || '').join('\\n');
                        }""")
                        curr_len = len(curr_text.strip())

                        if is_generating:
                            stable_cycles = 0
                        else:
                            if curr_len > 0 and curr_len == last_len:
                                stable_cycles += 1
                                if stable_cycles >= 2:  # 4 sekundy bez zmeny a bez stop tlačidla
                                    break
                            else:
                                stable_cycles = 0

                        last_len = curr_len
                        time.sleep(2)

                    # Extrakcia kódu z DOM
                    code_blocks = arena_page.evaluate("""() => {
                        const blocks = [];
                        document.querySelectorAll('pre code, pre').forEach(el => {
                            const txt = el.innerText || el.textContent || '';
                            if (txt.trim().length > 0) {
                                blocks.push(txt.trim());
                            }
                        });
                        return blocks;
                    }""")

                    full_msg = arena_page.evaluate("""() => {
                        const msgs = document.querySelectorAll('[data-message-author-role=\"assistant\"], div.chat-message, div.prose');
                        if (msgs.length > 0) {
                            return msgs[msgs.length - 1].innerText || '';
                        }
                        return '';
                    }""")

                    if not code_blocks and not full_msg:
                        return f"⚠️ V Arena tabe na {endpoint} sa nenašla žiadna nová odpoveď. Skontrolujte generovanie v prehliadači."

                    # Uloženie plného markdownu
                    with open(response_path, "w", encoding="utf-8") as rf:
                        rf.write(full_msg or "\n\n".join(code_blocks))

                    # Hľadanie git diff bloku
                    patch_content = ""
                    for block in code_blocks:
                        if "diff --git" in block or "--- a/" in block or "Index:" in block:
                            patch_content = block
                            break

                    if not patch_content:
                        return f"⚠️ V odpovedi pre {clean_id} sa nenašiel platný git unified diff (chýba 'diff --git'). Odpoveď bola uložená do {response_path}, ale .patch súbor nebol vytvorený."

                    with open(patch_path, "w", encoding="utf-8") as pf:
                        pf.write(patch_content)

                    # Aktualizácia arena_sessions.json
                    try:
                        sessions = []
                        if os.path.exists(ARENA_SESSIONS_FILE):
                            with open(ARENA_SESSIONS_FILE, "r", encoding="utf-8") as f:
                                sessions = json.load(f)
                        updated = False
                        for s in sessions:
                            if clean_id in s.get("session_id", ""):
                                s["status"] = "COMPLETED"
                                s["progress"] = f"Patch extrahovaný do tasks/{clean_id}.patch"
                                updated = True
                        if not updated:
                            sessions.append({
                                "session_id": f"arena-{clean_id}",
                                "module": clean_id,
                                "target_model": "arena",
                                "status": "COMPLETED",
                                "progress": f"Patch extrahovaný do tasks/{clean_id}.patch",
                            })
                        with open(ARENA_SESSIONS_FILE, "w", encoding="utf-8") as f:
                            json.dump(sessions, f, indent=2)
                    except Exception:
                        pass

                    return f"""✅ Kód z Arena.ai bol úspešne extrahovaný!
• Súbor patchu: `tasks/{clean_id}.patch` ({len(patch_content.splitlines())} riadkov)
• Celá odpoveď: `tasks/arena-response-{clean_id}.md`
• Pripravené na aplikovanie: Zavolajte `apply_arena_patch(task_id='{clean_id}', patch_source='tasks/{clean_id}.patch')`"""

                except Exception:
                    continue
    except Exception as e:
        return f"Chyba pri extrakcii kódu z Areny cez CDP: {str(e)}"

    return f"ℹ️ Žiaden tab Arena.ai s dokončenou odpoveďou nebol nájdený na endpointoch {endpoints}."


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

<vystupny_format>
Vráť kompletný kód pre dotknuté súbory alebo ucelený git diff/patch pripravený na aplikáciu cez git apply.
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

    dispatch_msg = dispatch_to_arena_session(
        module_name=title,
        prompt_summary=requirements[:150],
        target_model="Arena.ai"
    )

    cdp_msg = send_prompt_to_arena_browser(prompt, auto_submit=auto_submit)

    return f"""### 🚀 Úloha vytvorená a odoslaná pre Arena.ai:
• **Task ID:** `{task_id}`
• **Stav behu:** `{RunState.IMPLEMENTING.value}`
• **Názov:** {title}
• **Cieľ:** `Arena.ai`
• **Súbor zadania:** `tasks/{task_id}.md`
• **Súbor behu (contracts):** `tasks/run-{task_id.replace('arena-', '')[:25]}.json`
• **Stav odoslania do prehliadača:** {cdp_msg}

{dispatch_msg}"""


def apply_arena_patch(task_id: str, patch_source: str) -> str:
    """Aplikuje vygenerovaný kód / patch z Arena.ai do izolovanej vetvy swarm/agno-<task_id> po overení architektonických pravidiel a pre-flight kontrole."""
    repo = _get_repo_path()
    clean_id = task_id.replace("arena-", "").replace(".patch", "")[:25]
    branch_name = f"swarm/agno-{clean_id}"

    # 1. Získanie obsahu patchu a súboru
    patch_file_path = None
    patch_content = ""
    if os.path.exists(patch_source):
        patch_file_path = patch_source
        try:
            with open(patch_file_path, "r", encoding="utf-8") as pf:
                patch_content = pf.read()
        except Exception:
            pass
    elif os.path.exists(os.path.join(repo, patch_source)):
        patch_file_path = os.path.join(repo, patch_source)
        try:
            with open(patch_file_path, "r", encoding="utf-8") as pf:
                patch_content = pf.read()
        except Exception:
            pass
    else:
        tmp_patch = os.path.join(TMP_DIR, f"{clean_id}.patch")
        with open(tmp_patch, "w", encoding="utf-8") as pf:
            pf.write(patch_source)
        patch_file_path = tmp_patch
        patch_content = patch_source

    # 2. Architektonický audit dotknutých súborov (Zero-Conflict Upstream Sync & Secrets Safety)
    touched_files = _extract_patch_files(patch_content)
    violations = []
    for f in touched_files:
        if f.startswith("packages/db/schema/") and not os.path.basename(f).startswith("ext_"):
            violations.append(f"Vanilla schéma `{f}` nesmie byť modifikovaná (Zero-Conflict Upstream Sync). Použi `ext_*.ts`.")
        if "drizzle/meta/_journal.json" in f:
            violations.append("Drizzle journal `_journal.json` nesmie byť upravovaný ručne.")
        if ".env" in f or "secret" in f.lower() or "id_rsa" in f.lower():
            violations.append(f"Citlivý súbor `{f}` nesmie byť menený patchom (Secrets Safety).")

    if violations:
        run = get_development_run(task_id)
        if run:
            run.state = RunState.REJECTED
            run.failure_reason = "Architektonické porušenia v patchi: " + "; ".join(violations)
            save_development_run(run)
        return "❌ PATCH ZAMIETNUTÝ — ARCHITEKTURÁLNE PORUŠENIE:\n" + "\n".join(f"• {v}" for v in violations)

    # 3. Deterministický pre-flight: git apply --check (overenie pred prepnutím vetvy)
    check_proc = subprocess.run(
        [_which("git"), "apply", "--check", "--ignore-whitespace", patch_file_path],
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
    try:
        subprocess.run([_which("git"), "checkout", "-B", branch_name], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    except subprocess.CalledProcessError as e:
        return f"Chyba pri vytváraní vetvy {branch_name}: {e.stderr}"

    # 5. Aplikovanie patchu
    proc = subprocess.run([_which("git"), "apply", "--ignore-whitespace", "--3way", patch_file_path], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        proc2 = subprocess.run([_which("git"), "apply", "--ignore-whitespace", patch_file_path], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace")
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
        save_development_run(run)

    stat = subprocess.run([_which("git"), "status", "--short"], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace")
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
Si Arena.ai expert.
Predchádzajúca implementácia úlohy {task_id} vygenerovala nasledujúce chyby pri kompilácii a testoch OpenVPM:

<chybovy_vystup_z_testov>
{verification_output}
</chybovy_vystup_z_testov>

<poziadavka_na_opravu>
1. Presne oprav identifikované TypeScript chyby, chýbajúce importy alebo nesymetrické i18n preklady (sk.json / en.json).
2. Dodrž zero-conflict pravidlá a PageKit komponenty.
3. Vráť opravený git diff/patch.
</poziadavka_na_opravu>
</system_prompt>"""

    tasks_dir = os.path.join(_get_repo_path(), "tasks")
    repair_file = os.path.join(tasks_dir, f"repair-{task_id}.md")
    with open(repair_file, "w", encoding="utf-8") as rf:
        rf.write(repair_prompt)

    cdp_msg = send_prompt_to_arena_browser(repair_prompt, auto_submit=True)

    attempt_str = f"(Opravný pokus {run.repair_attempts}/3)" if run else ""
    return f"""### ⚠️ HODNOTENIE LÍDERA: POTREBNÁ OPRAVA (REPAIR REQUIRED) {attempt_str}
Verifikácia odhalila chyby v kóde. Líder pripravil opravný prompt:
• Stav behu: `{RunState.IMPLEMENTING.value}`
• Súbor s opravným promptom: `tasks/repair-{task_id}.md`
• Odoslanie do Arena.ai tabu: {cdp_msg}

Opravný prompt bol pripravený a odoslaný. Po vygenerovaní v Arene stiahnite kód cez 'collect_code_from_arena_browser', aplikujte ho a zopakujte verifikáciu."""
