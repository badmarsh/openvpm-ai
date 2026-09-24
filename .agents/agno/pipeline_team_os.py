import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Priečinky projektu a lokálneho behu
AGNO_DIR = Path(__file__).resolve().parent
wsl_repo = Path("/mnt/c/Users/marek/Documents/Vet/openvpm-ai")
REPO_DIR = wsl_repo if wsl_repo.exists() else AGNO_DIR.parent.parent
# Používame natívny Linux ext4 disk v WSL pre nulové locking problémy SQLite a LanceDB
TMP_DIR = Path("/home/ubuntu/agno/tmp") if Path("/home/ubuntu/agno").exists() else AGNO_DIR / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)
SKILLS_DIR = REPO_DIR / ".agents" / "skills"

sys.path.insert(0, str(AGNO_DIR))
sys.path.insert(0, str(AGNO_DIR / "src"))
sys.path.insert(0, "/mnt/c/Users/marek/Documents/Vet/openvpm-ai/.agents/agno/src")
sys.path.insert(0, "/mnt/c/Users/marek/Documents/Vet/openvpm-ai/.agents/agno")

# Načítanie premenných prostredia
load_dotenv(str(REPO_DIR / ".env"))
load_dotenv(str(AGNO_DIR / ".env"))

try:
    from openvpm_dev_orchestrator.config import Settings
    settings = Settings.from_env()
except ImportError:
    class Settings:
        database_url: str = os.getenv("AGNO_DATABASE_URL", f"sqlite:///{TMP_DIR}/pipeline_team.db")
        telemetry: bool = os.getenv("AGNO_TELEMETRY", "true").lower() in ("true", "1", "yes")
        bind_host: str = os.getenv("AGNO_BIND_HOST", "127.0.0.1")
        bind_port: int = int(os.getenv("AGNO_BIND_PORT", "7777"))

        @classmethod
        def from_env(cls):
            return cls()

    settings = Settings.from_env()

from agno.agent import Agent
from agno.team.team import Team
from agno.models.openai.like import OpenAILike
from agno.db.sqlite import SqliteDb
from agno.db.base import ComponentType
from agno.registry import Registry
from agno.workflow import Step, Workflow
from agno.os import AgentOS
from agno.knowledge.knowledge import Knowledge
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.vectordb.lancedb import LanceDb
from agno.skills import Skills, LocalSkills
from agno.memory import MemoryManager
from agno.session import SessionSummaryManager

# 1. Príprava databázy podľa Settings (PostgreSQL alebo SQLite)
if settings.database_url.startswith("postgresql"):
    from agno.db.postgres import PostgresDb
    db = PostgresDb(db_url=settings.database_url)
else:
    db = SqliteDb(db_file=str(TMP_DIR / "pipeline_team.db"))

# Zapnutie OpenTelemetry Tracing pre export do databázy (zobrazenie v Agno OS Traces)
try:
    from agno.tracing import setup_tracing
    setup_tracing(db=db)
except Exception as _tr_err:
    pass

# Zabezpečenie správnej IP adresy pre AliProxy z WSL (Windows host je 192.168.0.100)
ALIPROXY_BASE = os.getenv("ALIPROXY_BASE_URL", "http://192.168.0.100:8080/v1")
if "127.0.0.1" in ALIPROXY_BASE or "localhost" in ALIPROXY_BASE:
    ALIPROXY_BASE = "http://192.168.0.100:8080/v1"
ALIPROXY_KEY = os.getenv("ALIPROXY_API_KEY") or os.getenv("ALIPROXY_KEY", "")

# 2. Knowledge Base (Qwen text-embedding-v3 1024 dim cez AliProxy + LanceDB)
qwen_embedder = OpenAIEmbedder(
    id="text-embedding-v3",
    dimensions=1024,
    base_url=ALIPROXY_BASE,
    api_key=ALIPROXY_KEY,
)
knowledge_vector_db = LanceDb(
    table_name="openvpm_knowledge_qwen_1024",
    uri=str(TMP_DIR / "lancedb"),
    embedder=qwen_embedder,
)

openvpm_knowledge = Knowledge(
    name="OpenVPM Knowledge",
    description="Knowledge base pre OpenVPM AI dokumentáciu, architektúru a klinické predpisy (Qwen 1024 dim)",
    contents_db=db,
    vector_db=knowledge_vector_db,
)

# ==========================================
# 0. KONFIGURÁCIA MODELOV (PROXIES)
# ==========================================
# 1. AliProxy (Port 8080) -> qwen-coder-plus
model_qwen = OpenAILike(
    id="qwen-coder-plus",
    name="AliProxy Qwen Coder Plus",
    provider="AliProxy",
    base_url=ALIPROXY_BASE,
    api_key=ALIPROXY_KEY,
)

# 2. Antigravity Proxy (Port 8045) -> Gemini 3.8 Pro
ANTIGRAVITY_BASE = os.getenv("ANTIGRAVITY_BASE_URL", "http://192.168.0.100:8045/v1")
ANTIGRAVITY_KEY = os.getenv("ANTIGRAVITY_API_KEY") or os.getenv("AGNO_PROXY_API_KEY") or os.getenv("AI_API_KEY", "")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-3.8-flash-high")
model_gemini_38 = OpenAILike(
    id=GEMINI_MODEL_ID,
    name="Gemini 3.8 Pro",
    provider="Antigravity Proxy",
    base_url=ANTIGRAVITY_BASE,
    api_key=ANTIGRAVITY_KEY,
    timeout=90.0,
)

# Backwards compatibility alias
model_glm_53 = model_gemini_38

all_available_models = [model_qwen, model_gemini_38]

# ==========================================
# 1. MEMORY & SESSION SUMMARY MANAGERS
# ==========================================
memory_manager = MemoryManager(
    id="openvpm-memory-manager",
    name="OpenVPM User & Team Memory",
    db=db,
    model=model_gemini_38,
    update_memories=True,
    add_memories=True,
)

session_summary_manager = SessionSummaryManager(
    id="openvpm-summary-manager",
    name="OpenVPM Session Summary Manager",
    model=model_gemini_38,
    summary_request_message="Vytvor stručný a vecný súhrn tejto relácie s kľúčovými rozhodnutiami a zmenami v kóde.",
)

# ==========================================
# 2. SKILLS INTEGRÁCIA (.agents/skills)
# ==========================================
all_repo_skills = LocalSkills(path=str(SKILLS_DIR), validate=False)
skill_openvpm = LocalSkills(path=str(SKILLS_DIR / "openvpm-ai"), validate=False)
skill_new_task = LocalSkills(path=str(SKILLS_DIR / "new-task"), validate=False)
skill_deploy = LocalSkills(path=str(SKILLS_DIR / "deploy"), validate=False)
skill_prelozit = LocalSkills(path=str(SKILLS_DIR / "prelozit"), validate=False)
skill_audit = LocalSkills(path=str(SKILLS_DIR / "audit"), validate=False)
skill_ui_craft = LocalSkills(path=str(SKILLS_DIR / "ui-craft"), validate=False)
skill_friction_log = LocalSkills(path=str(SKILLS_DIR / "friction-log"), validate=False)

# ==========================================
# 3. PIPELINE NÁSTROJE
# ==========================================
from pipeline_tools import (
    firecrawl_tools,
    list_arena_sprints,
    read_sprint_assignment,
    format_arena_sprint_prompt,
    dispatch_to_arena_session,
    list_active_arena_sessions,
    monitor_arena_health,
    list_github_pull_requests,
    get_pull_request_diff,
    check_pull_request_ci,
    run_qwen_code_cli,
    run_openvpm_verification,
    git_checkout_branch,
    run_shell_command,
    audit_architectural_boundaries,
    audit_clinical_and_safety_gates,
    audit_i18n_symmetry,
    read_project_file,
    write_project_file,
    design_system_prompt,
    validate_prompt_xml,
    create_and_dispatch_arena_task,
    send_prompt_to_arena_browser,
    collect_code_from_arena_browser,
    DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS,
    apply_arena_patch,
    evaluate_verification_and_repair,
)

# ==========================================
# 4. ŠPECIALIZOVANÍ AGENTI
# ==========================================

# 1. PROMPT MANAGER
prompt_manager = Agent(
    id="prompt-manager",
    name="Prompt Manager",
    role="Koordinuje zadania, spravuje existujúce prompty a zadáva ich flagshipom do Arena.ai",
    model=model_gemini_38,
    tools=[
        create_and_dispatch_arena_task,
        evaluate_verification_and_repair,
        send_prompt_to_arena_browser,
        list_arena_sprints,
        read_sprint_assignment,
        format_arena_sprint_prompt,
        dispatch_to_arena_session,
        read_project_file,
        audit_architectural_boundaries,
        audit_clinical_and_safety_gates,
        audit_i18n_symmetry,
        firecrawl_tools,
    ],
    skills=Skills(loaders=[skill_openvpm, skill_new_task]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Si Prompt Manager. Tvojou kľúčovou úlohou je koordinácia zadaní a tvorba špičkových špecifikácií.",
        "VŠETKY úlohy a sprinty pre Arena.ai a vývojový tím zadávaj VÝHRADNE ako kompletný GOLDEN TICKET podľa .agents/skills/new-task/SKILL.md (1. Context/Why, 2. Scope In/Out, 3. Acceptance Criteria/DoD, 4. Technical Architecture & Constraints, 5. Verification & Test Plan, 6. Definition of Ready). Vágne, neštruktúrované alebo skrátené zadania sú prísne zakázané ('The ticket is the quality ceiling').",
        "Používaj 'list_arena_sprints' a 'read_sprint_assignment' na načítanie existujúcich zadaní.",
        "Pred odoslaním do Arena.ai sformátuj prompt cez 'format_arena_sprint_prompt' alebo 'create_and_dispatch_arena_task' s dodržaním všetkých pravidiel architektúry.",
        "Cez 'firecrawl_tools' môžeš prehľadávať a sťahovať dokumentácie a referencie z webu.",
        "Po príprave odošli úlohu do Arena.ai relácie cez 'dispatch_to_arena_session' alebo 'create_and_dispatch_arena_task'. Obe cesty fyzicky otvoria https://arena.ai/agent, vložia CELÚ špecifikáciu a spustia generovanie. Druhýkrát nevolaj send_prompt_to_arena_browser nad tým istým zadaním.",
    ],
    markdown=True,
    add_history_to_context=True,
)

# 2. ARENA DISPATCHER
arena_dispatcher = Agent(
    id="arena-dispatcher",
    name="Arena Dispatcher",
    role="Rozdeľuje úlohy a otvára relácie v Arena.ai pre paralelné sprinty",
    model=model_gemini_38,
    tools=[
        dispatch_to_arena_session,
        list_active_arena_sessions,
        read_sprint_assignment,
    ],
    skills=Skills(loaders=[skill_openvpm]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Zabezpečuješ paralelné odosielanie úloh do Arena.ai (až 4-5 paralelných relácií naraz).",
        "dispatch_to_arena_session musí fyzicky otvoriť https://arena.ai/agent, vložiť CELÚ špecifikáciu (nie skrátený summary) a spustiť generovanie cez send_prompt_to_arena_browser. JSON záznam v arena_sessions.json nie je dispatch. Stav RUNNING je platný len pri DISPATCH_OK.",
        "Nikdy nevkladaj prompt do cudzieho tabu. Ak /agent/<session_id> neexistuje, otvor nový /agent. Sprint 1 sa nesmie použiť pre Sprint 5 alebo Sprint 7.",
        "Cez 'list_active_arena_sessions' udržiavaj neustály prehľad o tom, ktoré relácie bežia a prideľuj nové úlohy podľa roadmapy.",
    ],
    markdown=True,
    add_history_to_context=True,
)

# 3. ARENA WATCHER
arena_watcher = Agent(
    id="arena-watcher",
    name="Arena Watcher",
    role="Nepretržite monitoruje 4-5 paralelných relácií na Arena.ai, deteguje záseky a hlási dokončené práce",
    model=model_gemini_38,
    tools=[
        monitor_arena_health,
        list_active_arena_sessions,
        collect_code_from_arena_browser,
        list_github_pull_requests,
    ],
    skills=Skills(loaders=[skill_openvpm]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Si strážca a monitorovací agent pre paralelné Arena.ai relácie.",
        "Cez 'monitor_arena_health' kontroluj stav všetkých paralelných behov a deteguj záseky alebo time-outy.",
        "ZÁKAZ HALUCINOVANIA TELEMETRIE: Ak nemáš aktívny živý Chrome CDP mostík (port 9222) k tabu prehliadača, NIKDY netvrď, že stream beží plynule alebo že relácia nezamrzla. Vždy pravdivo uveď, že skutočný stav v prehliadači nevidíš a stav v evidencii je iba orientačný.",
        f"Zber kódu: collect_code_from_arena_browser(task_id=<presné session_id>, timeout_seconds={DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS}). Dokončenie je VÝHRADNE status=COMPLETED (aktívne tlačidlo Create PR, terminál skončil s unified diffom, alebo explicitný completion marker). status=RUNNING znamená, že agent rozmýšľa alebo spúšťa bash (pnpm, vitest, type-check). Ticho v DOM nie je dokončenie a .patch sa nesmie zapisovať.",
        "Tab sa páruje striktne podľa URL /agent/<session_id> alebo task slug v URL/titulku. Ak tab neexistuje, výsledok je status=NOT_FOUND a je zakázané čítať iný sprint.",
        "Akonáhle collect_code_from_arena_browser vráti status=COMPLETED a patch_written=yes, cez 'list_github_pull_requests' over vytvorenie PR a odovzdaj signál GitHub Manažérovi a Qwen Implementerovi.",
        "NIKDY neuvádzaj žiadne konkrétne názvy externých modelov (napr. claude, claude-3-7-sonnet). Vždy referuj výhradne na 'Arena.ai'.",
    ],
    markdown=True,
    add_history_to_context=True,
)

# 4. GITHUB MANAGER
github_manager = Agent(
    id="github-manager",
    name="GitHub Manager",
    role="Overuje dokončené moduly z Arena.ai a vytvára / spravuje Pull Requesty na badmarsh/openvpm-ai",
    model=model_gemini_38,
    tools=[
        list_github_pull_requests,
        get_pull_request_diff,
        check_pull_request_ci,
        git_checkout_branch,
        audit_architectural_boundaries,
        run_shell_command,
    ],
    skills=Skills(loaders=[skill_openvpm, skill_deploy, skill_friction_log]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Si GitHub manažér pre repozitár badmarsh/openvpm-ai.",
        "Cez 'list_github_pull_requests' a 'get_pull_request_diff' preveruj diffy prichádzajúcich PR z Arena.ai.",
        "Cez 'audit_architectural_boundaries' over zero-conflict pravidlá. Vanilla schémy a _journal.json sú porušenie. Úprava vanilkového routeru (records.ts, whiteboard.ts a súbory existujúce v ../OpenVPM/apps/web/server/routers/) je povolený generic enhancement, nie porušenie.",
        "Cez 'check_pull_request_ci' skontroluj, či prešli GitHub Actions CI kontroly.",
    ],
    markdown=True,
    add_history_to_context=True,
)

# 5. QWEN IMPLEMENTER
qwen_implementer = Agent(
    id="qwen-implementer",
    name="Qwen Implementer",
    role="Preberá kód z Arena.ai, zapracováva ho do lokálneho repozitára a spúšťa overovacie testy",
    model=model_qwen,
    tools=[
        apply_arena_patch,
        collect_code_from_arena_browser,
        run_openvpm_verification,
        git_checkout_branch,
        run_qwen_code_cli,
        read_project_file,
        write_project_file,
        run_shell_command,
    ],
    skills=Skills(loaders=[skill_openvpm, skill_ui_craft]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Pracuješ výhradne s lokálnym repozitárom na disku. Tvojou úlohou je prevziať patch z Arena.ai a zapracovať ho do lokálnej vetvy repozitára.",
        "Na čítanie lokálnych súborov používaj VÝHRADNE 'read_project_file' (nikdy sa nepokúšaj volať vzdialené GitHub API).",
        "Na zápis a úpravy lokálnych súborov používaj 'write_project_file' alebo 'run_qwen_code_cli'.",
        "Na aplikáciu patchu z tasks/ používaj 'apply_arena_patch'. Aplikuj len unified diff (`diff --git` alebo `--- a/`). Markdown vysvetlenie nie je patch a nástroj ho odmietne.",
        "Pri spúšťaní príkazov cez 'run_shell_command' preferuj čisté samostatné príkazy (napr. 'git status', 'pnpm test').",
        "Po zapracovaní zmien VŽDY spusti 'run_openvpm_verification(checks=\"typecheck,lint,test,i18n\")' na overenie kvality.",
        "Ak je všetko zelené, potvrď úspešnú integráciu modulu.",
    ],
    markdown=True,
    add_history_to_context=True,
)

# 6. GEMINI 3.8 PRO REVIEWER (formerly GLM 5.3)
gemini_reviewer = Agent(
    id="gemini-reviewer",
    name="Gemini 3.8 Pro Reviewer",
    role="Senior architect and reviewer powered by Gemini 3.8 Pro",
    model=model_gemini_38,
    tools=[
        audit_clinical_and_safety_gates,
        audit_i18n_symmetry,
        audit_architectural_boundaries,
        get_pull_request_diff,
        read_project_file,
        firecrawl_tools,
    ],
    skills=Skills(loaders=[skill_openvpm, skill_audit, skill_prelozit]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Si Gemini 3.8 Pro Reviewer. Zodpovedáš za hlboké uvažovanie, kódové revízie, čistú architektúru a klinickú bezpečnosť podľa slovenského práva.",
        "Cez 'audit_clinical_and_safety_gates' overuj Zákon 39/2007 (Human-in-the-Loop) a Zákon 139/1998 (Zero prefill pre omamné látky).",
        "Cez 'audit_i18n_symmetry' kontroluj 100% symetriu medzi slovenským a anglickým prekladovým slovníkom.",
        "Cez 'firecrawl_tools' môžeš overovať legislatívne znenia (KVL, ŠVPS SR).",
        "Cez 'audit_architectural_boundaries' strážiš hranice monorepa. Nový router mimo extensions/ a mimo upstreamu je porušenie. Generic enhancement vanilla súborov, ktoré existujú v ../OpenVPM/apps/web/server/routers/ (records.ts, whiteboard.ts), je Upstream-Backport-Aware Coding a NIE JE porušenie.",
    ],
    markdown=True,
    add_history_to_context=True,
)
glm_53_agent = gemini_reviewer

# 7. PROMPT ARCHITECT
prompt_architect = Agent(
    id="prompt-architect",
    name="Prompt Architect",
    role="Navrhuje systémové a modulové prompty pre LLM modely",
    model=model_gemini_38,
    tools=[
        design_system_prompt,
        validate_prompt_xml,
        format_arena_sprint_prompt,
        read_project_file,
        firecrawl_tools,
    ],
    skills=Skills(loaders=[skill_openvpm, skill_new_task]),
    knowledge=openvpm_knowledge,
    search_knowledge=True,
    enable_agentic_memory=True,
    enable_session_summaries=True,
    memory_manager=memory_manager,
    session_summary_manager=session_summary_manager,
    db=db,
    instructions=[
        "Navrhuješ a ladíš precízne systémové a modulové prompty pre moduly a úlohy v projekte OpenVPM.",
        "Používaj 'design_system_prompt' a 'validate_prompt_xml' pre garantovanie správnej štruktúry a XML tagov.",
    ],
    markdown=True,
    add_history_to_context=True,
)

all_agents = [
    prompt_manager,
    arena_dispatcher,
    arena_watcher,
    github_manager,
    qwen_implementer,
    gemini_reviewer,
    prompt_architect,
]

# ==========================================
# 5. TÍMY (TEAMS)
# ==========================================
team_members = [prompt_manager, arena_dispatcher, arena_watcher, github_manager, qwen_implementer]
team_instructions = [
    "Vedieš autonómnu vývojovú linku OpenVPM AI (Líder -> Arena.ai -> Kód -> Verifier -> Líder Review):",
    "1. Keď používateľ zadá 'Implementujte XY':",
    "   a) Líder (Prompt Manager) preskúma požiadavku, pravidlá OpenVPM (AGENTS.md, UIKIT.md, i18n, zero-conflict) a vytvorí kompletný GOLDEN TICKET podľa .agents/skills/new-task/SKILL.md cez 'create_and_dispatch_arena_task' (Context/Why, Scope In/Out, Acceptance Criteria/DoD, Architecture, Verification Plan, Definition of Ready).",
    "   b) Nástroj automaticky odošle prompt do Arena.ai tabu cez Chrome CDP (port 9222) a uloží súbor do tasks/arena-sprint-<task_id>.md.",
    "   c) Arena generuje kód. Po získaní patchu alebo PR vetvy Qwen Implementer zapracuje zmeny do izolovanej vetvy swarm/agno-<task_id> pomocou 'apply_arena_patch'.",
    "   d) Spustí sa automatická verifikácia cez 'run_openvpm_verification(checks=\'typecheck,lint,test,i18n\')'.",
    "   e) Líder cez 'evaluate_verification_and_repair' zhodnotí výsledok testov:",
    "      • Ak nastali chyby (TypeScript, linter, i18n scan): sformuluje presný Repair Prompt a odošle ho späť do Areny na opravu.",
    "      • Ak je všetko zelené (PASSED): potvrdí úspech, zosumarizuje zmenené súbory a potvrdí pripravenosť vetvy na PR!",
    "Koordinuj agentov a po každom kroku zrozumiteľne reportuj používateľovi stav a diff.",
    "NIKDY v reportoch neuvádzaj konkrétne názvy externých modelov (napr. claude, claude-3-7-sonnet). Vždy referuj neutrálne na 'Arena.ai'.",
    f"Watcher nesmie vyhlásiť hotovo, kým collect_code_from_arena_browser nevráti status=COMPLETED. Predvolený timeout je {DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS}s. Tab sa vyberá podľa /agent/<session_id>, nie podľa prvého tabu s 'arena' v URL. Non-diff text sa do .patch nezapisuje.",
]

openvpm_dev_team = Team(
    id="openvpm-dev-team",
    name="OpenVPM Dev Team",
    model=model_gemini_38,
    members=team_members,
    instructions=team_instructions,
    db=db,
    session_summary_manager=session_summary_manager,
    enable_session_summaries=True,
    markdown=True,
    add_history_to_context=True,
)

all_teams = [openvpm_dev_team]

# ==========================================
# 6. WORKFLOWY (WORKFLOWS)
# ==========================================
step1 = Step(name="Prompt Preparation", agent=prompt_manager, description="Líder preskúma požiadavku, architektúru a pripraví Arena prompt")
step2 = Step(name="Arena Dispatch", agent=arena_dispatcher, description="Odoslanie zadania do Arena.ai relácie a browser tabu")
step3 = Step(name="Arena Monitoring", agent=arena_watcher, description="Sledovanie paralelných sessions a eliminácia zásekov")
step4 = Step(name="Code Integration", agent=qwen_implementer, description="Zapracovanie patchu/PR do izolovanej vetvy swarm/agno-*")
step5 = Step(name="Verification & Review", agent=prompt_manager, description="Spustenie typecheck, lint, test, i18n a zhodnotenie Lídrom")

arena_dev_workflow = Workflow(
    id="arena-dev-pipeline",
    name="Arena Dev Pipeline",
    description="Autonómny cyklus: Zadanie modulu -> Líder Prompt -> Arena.ai -> Vetva swarm/agno-* -> Verifikácia -> Líder Review",
    steps=[step1, step2, step3, step4, step5],
    db=db,
)

all_workflows = [arena_dev_workflow]

# ==========================================
# 7. SEEDING DO STUDIO DB
# ==========================================
def seed_studio_components() -> None:
    """Publish Studio components under an exclusive lock.

    Concurrent AgentOS boots used to delete and reinsert the catalog at the
    same time. The lock serializes that seed so one process cannot wipe the
    rows the other is still writing.
    """
    lock_path = TMP_DIR / "studio_seed.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = open(lock_path, "a+", encoding="utf-8")
    try:
        if sys.platform == "win32":
            import msvcrt

            handle.seek(0)
            if handle.read(1) == "":
                handle.write("0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        _seed_studio_components_unlocked()
    finally:
        try:
            if sys.platform == "win32":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        handle.close()


def _seed_studio_components_unlocked():
    """Zabezpeci, ze nova struktura agentov a workflowu sa ihned zobrazi v Studio UI (/studio/*).
    Garantuje verziu 1 pre vsetky komponenty, stringove instrukcie a konzistentne linky pre Agno Studio.
    """
    import json
    import time
    from agno.db.base import ComponentType

    # Zoznam povolenych aktivnych komponentov
    active_agent_ids = {ag.id for ag in all_agents}
    active_team_ids = {tm.id for tm in all_teams}
    active_wf_ids = {wf.id for wf in all_workflows}
    active_all = active_agent_ids | active_team_ids | active_wf_ids

    # 1. Hĺbkové vyčistenie SQLite pre čistý štart (v1 published)
    try:
        import sqlite3
        db_file = getattr(db, "db_file", None)
        if db_file and os.path.exists(db_file):
            conn = sqlite3.connect(db_file)
            cur = conn.cursor()
            cur.execute("DELETE FROM agno_component_configs;")
            cur.execute("DELETE FROM agno_components;")
            cur.execute("DELETE FROM agno_component_links;")
            conn.commit()
            conn.close()
    except Exception:
        pass

    # 2. Uloženie agentov s čistým stringom pre inštrukcie (rieši t.trim() chybu)
    for ag in all_agents:
        instr = ag.instructions
        if isinstance(instr, list):
            instr_str = "\n\n".join(str(i) for i in instr)
        elif isinstance(instr, str):
            instr_str = instr
        else:
            instr_str = ""

        desc_str = ag.role or f"Agent {ag.name}"
        config_data = ag.to_dict()
        config_data.pop("db", None)
        config_data["instructions"] = instr_str
        config_data["description"] = desc_str

        db.create_component_with_config(
            component_id=ag.id,
            component_type=ComponentType.AGENT,
            name=ag.name,
            config=config_data,
            description=desc_str,
            stage="published",
        )

    # 3. Uloženie tímov (s korektnou štruktúrou členov a prepojeniami pre Agno Studio)
    for tm in all_teams:
        instr = tm.instructions
        if isinstance(instr, list):
            instr_str = "\n\n".join(str(i) for i in instr)
        elif isinstance(instr, str):
            instr_str = instr
        else:
            instr_str = ""

        desc_str = f"Multi-agent team: {tm.name}"
        serialized_members = []
        team_links = []
        for pos, member in enumerate(tm.members):
            is_agent = isinstance(member, Agent) or not hasattr(member, "members")
            m_type = "agent" if is_agent else "team"
            m_id = member.id if hasattr(member, "id") else str(member)

            if is_agent:
                serialized_members.append({"type": "agent", "agent_id": m_id})
            else:
                serialized_members.append({"type": "team", "team_id": m_id})

            team_links.append({
                "link_kind": "member",
                "link_key": f"member_{pos}",
                "child_component_id": m_id,
                "child_version": 1,
                "position": pos,
                "meta": {"type": m_type},
            })

        config_data = tm.to_dict()
        config_data.pop("db", None)
        config_data["id"] = tm.id
        config_data["name"] = tm.name
        config_data["instructions"] = instr_str
        config_data["description"] = desc_str
        config_data["members"] = serialized_members
        config_data["model"] = {"id": tm.model.id, "provider": tm.model.provider} if tm.model else None

        db.create_component_with_config(
            component_id=tm.id,
            component_type=ComponentType.TEAM,
            name=tm.name,
            config=config_data,
            description=desc_str,
            stage="published",
            links=team_links,
        )

    # 4. Uloženie workflowov (čisté kroky bez null hodnôt, správne prepojenia)
    for wf in all_workflows:
        desc_str = wf.description or f"Workflow {wf.name}"
        config_data = wf.to_dict()
        config_data.pop("db", None)
        config_data["description"] = desc_str
        config_data["instructions"] = ""

        clean_steps = []
        links = []
        for idx, step in enumerate(wf.steps):
            agent_id = step.agent.id if getattr(step, "agent", None) else None
            team_id = step.team.id if getattr(step, "team", None) else None
            step_dict = {
                "type": "Step",
                "name": step.name,
                "step_id": getattr(step, "step_id", str(idx + 1)),
                "description": step.description or "",
                "agent_id": agent_id,
                "team_id": team_id,
                "max_retries": 3,
                "skip_on_failure": False,
                "strict_input_validation": False,
            }
            clean_steps.append(step_dict)
            if agent_id:
                links.append({
                    "link_kind": "step_agent",
                    "link_key": f"step_{idx}",
                    "child_component_id": agent_id,
                    "child_version": 1,
                    "position": idx,
                    "meta": {"type": "agent"},
                })
            elif team_id:
                links.append({
                    "link_kind": "step_team",
                    "link_key": f"step_{idx}",
                    "child_component_id": team_id,
                    "child_version": 1,
                    "position": idx,
                    "meta": {"type": "team"},
                })

        config_data["steps"] = clean_steps

        db.create_component_with_config(
            component_id=wf.id,
            component_type=ComponentType.WORKFLOW,
            name=wf.name,
            config=config_data,
            description=desc_str,
            stage="published",
            links=links,
        )

seed_studio_components()

# ==========================================
# 8. REGISTRY & AGENTOS
# ==========================================
all_knowledge = [openvpm_knowledge]

all_tools = [
    create_and_dispatch_arena_task,
    send_prompt_to_arena_browser,
    collect_code_from_arena_browser,
    apply_arena_patch,
    evaluate_verification_and_repair,
    list_arena_sprints,
    read_sprint_assignment,
    format_arena_sprint_prompt,
    dispatch_to_arena_session,
    list_active_arena_sessions,
    monitor_arena_health,
    list_github_pull_requests,
    get_pull_request_diff,
    check_pull_request_ci,
    run_qwen_code_cli,
    run_openvpm_verification,
    git_checkout_branch,
    run_shell_command,
    audit_architectural_boundaries,
    audit_clinical_and_safety_gates,
    audit_i18n_symmetry,
    read_project_file,
    write_project_file,
    design_system_prompt,
    validate_prompt_xml,
    firecrawl_tools,
]

registry = Registry(
    name="OpenVPM Dev Registry",
    tools=all_tools,
    models=all_available_models,
    knowledge=all_knowledge,
    memory_managers=[memory_manager],
    session_summary_managers=[session_summary_manager],
    dbs=[db],
)

agent_os = AgentOS(
    id="Autonomous Dev Team OS",
    agents=all_agents,
    teams=all_teams,
    workflows=all_workflows,
    knowledge=all_knowledge,
    registry=registry,
    db=db,
    tracing=settings.telemetry,
)

app = agent_os.get_app()

# Zapnutie Chrome Private Network Access (PNA) a CORS
from starlette.middleware.cors import CORSMiddleware
app.user_middleware = [m for m in app.user_middleware if m.cls != CORSMiddleware]
app.middleware_stack = None
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://agno.com",
        "https://www.agno.com",
        "https://app.agno.com",
        "https://os-stg.agno.com",
        "https://os.agno.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    allow_private_network=True,
)

if __name__ == "__main__":
    agent_os.serve(app=app, host=settings.bind_host, port=settings.bind_port, reload=False)
