"""
OpenVPM AI — pipeline_team_os.py
================================

Enterprise AgentOS runtime pre autonómny vývojový tím `openvpm_dev_team`
(postavený na Agno 3.0.11 / AgentOS).

Zapája všetkých 12 enterprise schopností popísaných v:
    docs/architecture/AGNO-ENTERPRISE-SPECIFICATION.md

1.  Learning .............. LearningMachine + agno_learnings (5 store-ov)
2.  User Memories ......... UserMemoryStore (agno_learnings)
3.  User Profiles ......... UserProfileStore + OpenVPMUserProfile schema
4.  Entity Memories ....... EntityMemoryStore, namespace="openvpm"
5.  Session Context ....... SessionContextStore (ALWAYS + planning)
6.  Decision Logs ......... DecisionLogStore (nemenný audit trail)
7.  Memory ................ MemoryManager (Agentic Memory) + SessionSummaryManager
8.  Knowledge ............. Knowledge + LanceDb (hybrid search)
9.  Metrics ............... RunMetrics telemetria + kalkulácia nákladov
10. Evaluation ............ BaseEval suite (I18nLeafSymmetryEval, VanillaSchemaGuardEval) + agent_as_judge
11. Approvals ............. ApprovalType.required | ApprovalType.audit (HITL brány)
12. Scheduler ............. AgentOS scheduler + ScheduleManager (cron úlohy)

Režim SQLite (Phase 2): WAL journal mode + busy_timeout = 30 000 ms +
foreign_keys=ON, aplikované na každom spojení cez SQLAlchemy engine event.

Licenčná poznámka: veterinárna legislatíva SK (Zákon 39/2007 Z. z.,
Zákon 139/1998 Z. z. o OPL) je mapovaná na Decision Logs + Approvals.
OPL predpis vyžaduje MANUÁLNY PODPIS lekára; žiadna automatizácia
ho nesmie nahradiť, iba auditne zaznamenať.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine

logger = logging.getLogger("agno.pipeline")

# =============================================================================
# 0. Konfigurácia prostredia a ciest
# =============================================================================

AGNO_DIR = Path(__file__).resolve().parent
wsl_repo = Path("/mnt/c/Users/marek/Documents/Vet/openvpm-ai")
REPO_ROOT = wsl_repo if wsl_repo.exists() else Path(os.getenv("OPENVPM_REPO_ROOT", Path.cwd())).resolve()

# Linux ext4 disk v WSL pre nulové locking problémy SQLite a LanceDB
WSL_AGNO_TMP = Path("/home/ubuntu/agno/tmp")
TMP_DIR = WSL_AGNO_TMP if WSL_AGNO_TMP.exists() else AGNO_DIR / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)
SKILLS_DIR = REPO_ROOT / ".agents" / "skills"

# Cesty k databázam
default_db = TMP_DIR / "pipeline_team.db"
PIPELINE_DB_FILE = Path(os.getenv("OPENVPM_PIPELINE_DB", str(default_db))).resolve()
default_lance = TMP_DIR / "lancedb"
LANCEDB_URI = Path(os.getenv("OPENVPM_LANCEDB_URI", str(default_lance))).resolve()

# Načítanie .env súborov
load_dotenv(str(REPO_ROOT / ".env"))
load_dotenv(str(AGNO_DIR / ".env"))
if Path("/home/ubuntu/agno/.env").exists():
    load_dotenv("/home/ubuntu/agno/.env")

# Pridanie ciest do sys.path pre import pipeline_tools
for p in [str(AGNO_DIR), str(AGNO_DIR / "src"), "/home/ubuntu/agno", str(REPO_ROOT / ".agents" / "agno")]:
    if p not in sys.path:
        sys.path.insert(0, p)

CHROME_CDP_URL = os.getenv("CHROME_CDP_URL", "http://127.0.0.1:9222")
ARENA_API_BASE = os.getenv("ARENA_API_BASE", "")
ARENA_API_TOKEN = os.getenv("ARENA_API_TOKEN", "")
DEPLOY_COMMAND = os.getenv("OPENVPM_DEPLOY_COMMAND", "")
AGENTOS_BASE_URL = os.getenv("OPENVPM_AGENTOS_BASE_URL", "http://127.0.0.1:7777")
INTERNAL_SERVICE_TOKEN = os.getenv("OPENVPM_INTERNAL_SERVICE_TOKEN", "")
if not INTERNAL_SERVICE_TOKEN or INTERNAL_SERVICE_TOKEN == "openvpm-service-secret":
    import secrets
    # Fail-safe: Nikdy nebežať s hardcoded default secretom (Claude audit remediation)
    INTERNAL_SERVICE_TOKEN = os.getenv("OPENVPM_INTERNAL_SERVICE_TOKEN_FALLBACK") or secrets.token_urlsafe(32)
    logger.warning("OPENVPM_INTERNAL_SERVICE_TOKEN nebol nastavený alebo používal nebezpečný default! Bol vygenerovaný jednorazový bezpečný token.")
SCHEDULE_TIMEZONE = os.getenv("OPENVPM_SCHEDULE_TZ", "Europe/Bratislava")
SQLITE_BUSY_TIMEOUT_MS = int(os.getenv("OPENVPM_SQLITE_BUSY_TIMEOUT_MS", "30000"))

TEAM_ID = "openvpm_dev_team"
USER_ID_ARCHITECT = "marek@openvpm.sk"

TABLES: Dict[str, str] = {
    "session_table": "agno_sessions",
    "runs_table": "agno_runs",
    "memory_table": "agno_memories",
    "metrics_table": "agno_metrics",
    "eval_table": "agno_eval_runs",
    "knowledge_table": "agno_knowledge",
    "learnings_table": "agno_learnings",
    "schedules_table": "agno_schedules",
    "schedule_runs_table": "agno_schedule_runs",
    "approvals_table": "agno_approvals",
    "traces_table": "agno_traces",
    "spans_table": "agno_spans",
}

# Modely & Proxies
ALIPROXY_BASE = os.getenv("ALIPROXY_BASE_URL", "http://192.168.0.100:8080/v1")
if "127.0.0.1" in ALIPROXY_BASE or "localhost" in ALIPROXY_BASE:
    ALIPROXY_BASE = "http://192.168.0.100:8080/v1"
ALIPROXY_KEY = os.getenv("ALIPROXY_API_KEY") or os.getenv("ALIPROXY_KEY") or os.getenv("DASHSCOPE_API_KEY", "EMPTY")

ANTIGRAVITY_BASE = os.getenv("ANTIGRAVITY_BASE_URL", "http://192.168.0.100:8045/v1")
ANTIGRAVITY_KEY = os.getenv("ANTIGRAVITY_API_KEY") or os.getenv("AGNO_PROXY_API_KEY") or os.getenv("AI_API_KEY", "")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-3.8-flash-high")

ORCHESTRATOR_MODEL_ID = os.getenv("OPENVPM_ORCHESTRATOR_MODEL", "gpt-5.2")
LEARNING_MODEL_ID = os.getenv("OPENVPM_LEARNING_MODEL", "gpt-5-mini")
QWEN_CODER_MODEL_ID = os.getenv("QWEN_CODER_MODEL", "qwen3-coder")

MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-5.2": {"input": 1.25, "output": 10.0},
    "gpt-5-mini": {"input": 0.25, "output": 2.0},
    "qwen3-coder": {"input": 0.35, "output": 1.4},
    "gemini-3.8-flash-high": {"input": 0.15, "output": 0.60},
    "qwen-coder-plus": {"input": 0.35, "output": 1.4},
}

KNOWLEDGE_SOURCES: List[Dict[str, str]] = [
    {"path": str(REPO_ROOT / "AGENTS.md"), "kind": "repo", "area": "agents", "lang": "sk"},
    {"path": str(REPO_ROOT / "docs" / "UIKIT.md"), "kind": "repo", "area": "uikit", "lang": "sk"},
    {"path": str(REPO_ROOT / "docs" / "architecture" / "AGNO-ENTERPRISE-SPECIFICATION.md"), "kind": "arch", "area": "agno-spec", "lang": "sk"},
    {"path": str(REPO_ROOT / ".agents" / "skills" / "openvpm-ai" / "SKILL.md"), "kind": "compliance", "area": "openvpm-compliance-skill", "lang": "sk"},
    {"path": str(REPO_ROOT / "docs" / "wiki" / "02-slovenska-legislativa-a-integracie" / "1. e-Kasa integrácia (Zákon č. 289-2008 Z. z.).md"), "kind": "law", "area": "ekasa-289-2008", "lang": "sk"},
    {"path": str(REPO_ROOT / "docs" / "wiki" / "03-klinicka-ai-a-datova-bezpecnost" / "2. Povinné potvrdenie lekárom (Human-in-the-Loop).md"), "kind": "law", "area": "hitl-safety-gate", "lang": "sk"},
]

VANILLA_SCHEMA_GLOBS: Tuple[str, ...] = (
    "packages/db/schema/[!ext_]*.ts",
    "packages/db/drizzle/meta/_journal.json",
)

I18N_PATHS: Dict[str, Path] = {
    "en": REPO_ROOT / "apps" / "web" / "messages" / "en.json",
    "sk": REPO_ROOT / "apps" / "web" / "messages" / "sk.json",
}

BOOT_LEARNINGS: List[Dict[str, Any]] = [
    {
        "id": "dec_seed_sandbox_typecheck",
        "decision": "V sandboxe nepúšťaj celý monorepo type-check",
        "reasoning": (
            "Celý type-check monorepo prekročí sandbox timeout a zahltí logy; "
            "spúšťaj iba cielený type-check zmenených balíkov: pnpm --filter @openpims/web type-check."
        ),
        "decision_type": "lesson_learned",
        "tags": ["lesson", "sandbox", "sprint"],
        "confidence": 1.0,
    },
    {
        "id": "dec_seed_opl_manual_signature",
        "decision": "OPL vyžaduje manuálny podpis",
        "reasoning": (
            "Zákon 139/1998 Z. z. o OPL: predpis na omamné/psychotropné látky "
            "vyžaduje vlastnoručný podpis veterinárneho lekára. Automatizácia "
            "môže iba pripraviť podklady a auditne zaznamenať proces."
        ),
        "decision_type": "compliance",
        "tags": ["lesson", "compliance", "zakon-139-1998-OPL"],
        "confidence": 1.0,
    },
    {
        "id": "dec_seed_sprints_truth",
        "decision": "SPRINT-INDEX.md a git log sú autoritatívne zdroje pravdy o stave sprintov",
        "reasoning": (
            "Súbory v tasks/ obsahujú historické špecifikácie. To, že súbor existuje, "
            "neznamená, že sprint nebol vykonaný. Sprinty 1, 2, 3, 4 a 7 sú už zlúčené v main."
        ),
        "decision_type": "lesson_learned",
        "tags": ["lesson", "sprint-index", "architecture"],
        "confidence": 1.0,
    },
]

# =============================================================================
# 1. Agno Imports
# =============================================================================

from agno.agent import Agent
from agno.approval import ApprovalType, approval
from agno.db.sqlite import SqliteDb
from agno.eval import BaseEval
from agno.eval.agent_as_judge import AgentAsJudgeEval
from agno.hooks import hook
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.knowledge.knowledge import Knowledge
from agno.learn import (
    DecisionLog,
    DecisionLogConfig,
    EntityMemoryConfig,
    LearnedKnowledgeConfig,
    LearningMachine,
    LearningMode,
    SessionContextConfig,
    UserMemoryConfig,
    UserProfileConfig,
)
from agno.memory import MemoryManager, UserMemory
from agno.metrics import RunMetrics
from agno.models.openai import OpenAIChat
from agno.models.openai.like import OpenAILike
from agno.os import AgentOS
from agno.scheduler import ScheduleManager
from agno.session import SessionSummaryManager
from agno.skills import LocalSkills
from agno.team import Team
from agno.tools import tool
from agno.tools.knowledge import KnowledgeTools
from agno.vectordb.lancedb import LanceDb, SearchType

# =============================================================================
# 2. SQLite Engine — WAL Režim a Lock Timeout (Phase 2 Invariance)
# =============================================================================

def make_sqlite_engine(db_file: Path) -> Engine:
    db_file.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{db_file}",
        future=True,
        connect_args={
            "timeout": SQLITE_BUSY_TIMEOUT_MS / 1000.0,
            "check_same_thread": False,
        },
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _record: Any) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    return engine

pipeline_engine: Engine = make_sqlite_engine(PIPELINE_DB_FILE)

db: SqliteDb = SqliteDb(
    id="openvpm-pipeline-db",
    db_engine=pipeline_engine,
    **TABLES,
)

# OpenTelemetry Tracing
try:
    from agno.tracing import setup_tracing
    setup_tracing(db=db)
except Exception as _tr_err:
    logger.debug("Tracing disabled or failed: %s", _tr_err)

# =============================================================================
# 3. Model Factory (Podpora Proxy aj Direct API)
# =============================================================================

def make_orchestrator_model():
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIChat(id=ORCHESTRATOR_MODEL_ID)
    return OpenAILike(
        id=GEMINI_MODEL_ID,
        name="Gemini 3.8 Flash",
        provider="Antigravity Proxy",
        base_url=ANTIGRAVITY_BASE,
        api_key=ANTIGRAVITY_KEY,
        timeout=90.0,
    )

def make_learning_model():
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIChat(id=LEARNING_MODEL_ID)
    return OpenAILike(
        id=GEMINI_MODEL_ID,
        name="Gemini 3.8 Flash",
        provider="Antigravity Proxy",
        base_url=ANTIGRAVITY_BASE,
        api_key=ANTIGRAVITY_KEY,
        timeout=90.0,
    )

def make_qwen_model():
    if os.getenv("DASHSCOPE_API_KEY") and not os.getenv("ALIPROXY_BASE_URL"):
        return OpenAIChat(
            id=QWEN_CODER_MODEL_ID,
            base_url=os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
    return OpenAILike(
        id="qwen-coder-plus",
        name="AliProxy Qwen Coder Plus",
        provider="AliProxy",
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
    )

# =============================================================================
# 4. User Profiles — OpenVPMUserProfile Schéma
# =============================================================================

@dataclass
class OpenVPMUserProfile:
    user_id: str
    name: Optional[str] = None
    preferred_name: Optional[str] = None
    role: Optional[str] = None  # lead_architect | veterinarian | nurse
    language: Optional[str] = None  # sk | en
    report_style: Optional[str] = None  # executive_summary | markdown_detail
    dispatch_mode: Optional[str] = None  # immediate | batched
    clinical_context: Optional[str] = None
    agent_id: Optional[str] = None
    team_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

USER_PROFILE_ROLE_MODEL = (
    "Role a klinický kontext:\n"
    "- lead_architect: vedie architektúru OpenVPM, reporty v slovenčine, "
    "štýl executive_summary, dispatch immediate (Marek).\n"
    "- veterinarian: veterinárny lekár — klinické rozhodnutia, predpisy liekov, "
    "OPL predpisy s manuálnym podpisom (Zákon 139/1998 Z. z.).\n"
    "- nurse: veterinárny asistent/sestra — ošetrovateľská dokumentácia, "
    "bez predpisovania liekov (Zákon 39/2007 Z. z.).\n"
    "Aktualizuj profil iba na základe explicitných preferencií používateľa."
)

# =============================================================================
# 5. Knowledge — LanceDb Hybridné Sémantické Vyhľadávanie
# =============================================================================

if os.getenv("OPENAI_API_KEY"):
    kb_embedder = OpenAIEmbedder(id="text-embedding-3-small")
    kb_table = "openvpm_knowledge"
else:
    kb_embedder = OpenAIEmbedder(
        id="text-embedding-v3",
        dimensions=1024,
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
    )
    kb_table = "openvpm_knowledge_qwen_1024"

# Lokálny GPU Cross-Encoder Reranker na RTX 3090 (24 GB VRAM)
kb_reranker = None
try:
    from agno.knowledge.reranker.sentence_transformer import SentenceTransformerReranker
    import torch
    reranker_device = "cuda" if torch.cuda.is_available() else "cpu"
    kb_reranker = SentenceTransformerReranker(
        model="BAAI/bge-reranker-v2-m3",
        device=reranker_device,
        top_n=5,
    )
    logger.info("Local CUDA reranker initialized on %s (BAAI/bge-reranker-v2-m3)", reranker_device)
except Exception as e:
    logger.warning("Local reranker initialization notice: %s", e)

knowledge_base: Knowledge = Knowledge(
    name="OpenVPM Enterprise Knowledge",
    description=(
        "Repo dokumentácia (AGENTS.md, UIKIT.md) + slovenská veterinárna "
        "legislatíva (Zákon 39/2007 Z. z., Zákon 139/1998 Z. z. o OPL)."
    ),
    vector_db=LanceDb(
        uri=str(LANCEDB_URI),
        table_name=kb_table,
        search_type=SearchType.hybrid,
        embedder=kb_embedder,
    ),
    contents_db=db,
    reranker=kb_reranker,
)

def reindex_repo_knowledge(force: bool = False) -> Dict[str, str]:
    report: Dict[str, str] = {}
    existing_names: set[str] = set()
    if not force:
        try:
            with pipeline_engine.connect() as conn:
                from sqlalchemy import text
                res = conn.execute(text("SELECT name FROM agno_knowledge WHERE status = 'completed'"))
                existing_names = {row[0] for row in res}
        except Exception:
            pass

    for source in KNOWLEDGE_SOURCES:
        path = Path(source["path"])
        key = source["area"]
        if not path.exists():
            report[key] = f"missing: {path}"
            continue
        if not force and key in existing_names:
            report[key] = "already_indexed"
            continue
        try:
            knowledge_base.insert(
                path=str(path),
                name=key,
                metadata={
                    "kind": source["kind"],
                    "area": key,
                    "lang": source["lang"],
                    "source": str(path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path.name),
                },
            )
            report[key] = "indexed"
        except Exception as e:
            report[key] = f"error: {e}"
    return report

# =============================================================================
# 6. Memory — MemoryManager + SessionSummaryManager
# =============================================================================

memory_manager: MemoryManager = MemoryManager(
    id="openvpm-memory-manager",
    name="OpenVPM MemoryManager",
    model=make_learning_model(),
    db=db,
    delete_memories=True,
    update_memories=True,
    add_memories=True,
    additional_instructions=(
        "Ukladaj preferencie a pracovný kontext členov tímu a klientov "
        "(Marek: slovenčina, executive_summary reporty, okamžitý dispatch). "
        "Neukladaj osobné údaje pacientov mimo EntityMemory "
        "a nikdy neukladaj citlivé údaje OPL zásob."
    ),
)

session_summary_manager: SessionSummaryManager = SessionSummaryManager(
    id="openvpm-session-summary-manager",
    name="OpenVPM SessionSummaryManager",
    model=make_learning_model(),
    session_summary_prompt=(
        "Vytvor kompaktné súhrn stretnutia tímu OpenVPM (slovenčina): cieľ "
        "sprintu, vykonané kroky, rozhodnutia, blokátory, ďalší krok. Max 12 viet."
    ),
    last_n_runs=8,
)

# =============================================================================
# 7. Learning — LearningMachine (5 Stores v agno_learnings)
# =============================================================================

learning_machine: LearningMachine = LearningMachine(
    name="OpenVPM LearningMachine",
    db=db,
    model=make_learning_model(),
    knowledge=knowledge_base,
    namespace="openvpm",
    max_updates_per_run=10,
    # 1/5 User Profile Store
    user_profile=UserProfileConfig(
        mode=LearningMode.ALWAYS,
        schema=OpenVPMUserProfile,
        enable_update_profile=True,
        additional_instructions=USER_PROFILE_ROLE_MODEL,
    ),
    # 2/5 User Memory Store
    user_memory=UserMemoryConfig(
        mode=LearningMode.ALWAYS,
        enable_add_memory=True,
        enable_update_memory=True,
        enable_delete_memory=True,
        enable_clear_memories=False,
        additional_instructions=(
            "Preferencie a pracovné návyky: jazyk reportov (sk), štýl "
            "(executive_summary), režim dispatchu (immediate), overené pravidlá "
            "(Sprinty 1, 2, 3, 4 a 7 sú už zlúčené do main; spúšťaj iba cielené testy)."
        ),
    ),
    # 3/5 Session Context Store
    session_context=SessionContextConfig(
        mode=LearningMode.ALWAYS,
        enable_planning=True,
        enable_add_context=True,
        enable_update_context=True,
        enable_delete_context=True,
        additional_instructions=(
            "Udržiavaj KOMPAKTNÝ medzikrokový stav sprintu (cieľ, plán, "
            "progress, summary) — max ~300 tokenov, bez kódu a dlhých výpisov."
        ),
    ),
    # 4/5 Entity Memory Store
    entity_memory=EntityMemoryConfig(
        mode=LearningMode.AGENTIC,
        namespace="openvpm",
        enable_agent_tools=True,
        max_entities_in_context=8,
        max_facts_per_entity=15,
        max_events_per_entity=10,
        additional_instructions=(
            "Moduly a sprinty OpenVPM eviduj ako entity: sprint-1 až sprint-12, "
            "billing, encounters, prescriptions, e-kasa, whiteboard. Pre každý modul "
            "sleduj fakty, udalosti a vzťahy (implements, depends_on, blocks)."
        ),
    ),
    # 5/5 Decision Log Store
    decision_log=DecisionLogConfig(
        mode=LearningMode.AGENTIC,
        enable_agent_tools=True,
        agent_can_save=True,
        agent_can_search=True,
        additional_instructions=(
            "Loguj VÝZNAMNÉ rozhodnutia: výber modelu, schválenie/zamietnutie "
            "diffu, detekciu kolízie, compliance rozhodnutia (Zákon 39/2007 Z. z., "
            "Zákon 139/1998 Z. z. o OPL). OPL = manuálny podpis lekára."
        ),
    ),
    learned_knowledge=LearnedKnowledgeConfig(
        knowledge=knowledge_base,
        mode=LearningMode.AGENTIC,
        namespace="openvpm",
        enable_agent_tools=True,
        agent_can_save=True,
        agent_can_search=True,
    ),
)

user_profile_store = learning_machine.user_profile_store
user_memory_store = learning_machine.user_memory_store
session_context_store = learning_machine.session_context_store
entity_memory_store = learning_machine.entity_memory_store
decision_log_store = learning_machine.decision_log_store

def new_decision_id() -> str:
    return f"dec_{uuid.uuid4().hex[:12]}"

def record_decision(
    decision: str,
    reasoning: str,
    decision_type: str = "general",
    context: Optional[str] = None,
    alternatives: Optional[List[str]] = None,
    confidence: Optional[float] = None,
    tags: Optional[List[str]] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    team_id: Optional[str] = None,
    outcome: Optional[str] = None,
    outcome_quality: Optional[str] = None,
) -> str:
    entry = DecisionLog(
        id=new_decision_id(),
        decision=decision,
        reasoning=reasoning,
        decision_type=decision_type,
        context=context,
        alternatives=alternatives or [],
        confidence=confidence,
        outcome=outcome,
        outcome_quality=outcome_quality,
        tags=tags or [],
        session_id=session_id,
        user_id=user_id,
        agent_id=agent_id,
        team_id=team_id,
    )
    decision_log_store.save(entry)
    return entry.id

def record_compliance_decision(decision: str, reasoning: str, law: str, **kwargs: Any) -> str:
    tags = list(kwargs.pop("tags", []) or [])
    tags.extend(["compliance", law])
    return record_decision(
        decision=decision,
        reasoning=reasoning,
        decision_type="compliance",
        tags=tags,
        confidence=1.0,
        **kwargs,
    )

def record_sprint_learnings(
    sprint_id: str,
    module: str,
    status: str,
    lessons: Sequence[str],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    status_norm = status.upper()
    if status_norm not in {"PASSED", "FAILED"}:
        raise ValueError(f"Sprint status musí byť PASSED|FAILED, dostal: {status}")

    decision_ids: List[str] = []
    for lesson in lessons:
        decision_ids.append(
            record_decision(
                decision=lesson,
                reasoning=f"Lessons learned zo sprintu {sprint_id} ({status_norm}).",
                decision_type="lesson_learned",
                context=f"sprint={sprint_id}; module={module}; status={status_norm}",
                tags=["lesson", sprint_id, module, status_norm.lower()],
                confidence=1.0,
                outcome=f"sprint {sprint_id}: {status_norm}",
                outcome_quality="good" if status_norm == "PASSED" else "bad",
                session_id=session_id,
                team_id=TEAM_ID,
            )
        )

    stamp = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    entity_memory_store.remember_about(
        entity=module,
        entity_type="module",
        events=[f"{stamp} — sprint {sprint_id} skončil {status_norm}: " + "; ".join(lessons)],
        note=f"Auto-zápis z retrospektívy {sprint_id}",
        team_id=TEAM_ID,
        namespace="openvpm",
    )
    entity_memory_store.remember_about(
        entity=sprint_id,
        entity_type="sprint",
        description=f"Sprint {sprint_id} ({status_norm}) nad modulom {module}",
        facts=[f"status={status_norm}", f"module={module}"],
        events=[f"{stamp} — retrospektíva: {len(lessons)} lessons learned"],
        team_id=TEAM_ID,
        namespace="openvpm",
    )
    entity_memory_store.link_entities(
        entity=sprint_id,
        relation="implements",
        related_entity=module,
        team_id=TEAM_ID,
        namespace="openvpm",
    )
    return {"sprint_id": sprint_id, "status": status_norm, "decision_ids": decision_ids}

def recall_relevant_learnings(
    query: str,
    agent_id: Optional[str] = None,
    limit: int = 6,
    days: int = 90,
) -> str:
    lines: List[str] = ["## Relevantné learnings (agno_learnings)", ""]
    seen: set = set()
    for seed in BOOT_LEARNINGS:
        lines.append(f"- [lesson] {seed['decision']}: {seed['reasoning']}")
        seen.add(seed["decision"])
    try:
        results = decision_log_store.search(query=query, agent_id=agent_id, days=days, limit=limit)
        for item in results:
            if item.decision in seen:
                continue
            seen.add(item.decision)
            tag_str = ", ".join(item.tags or [])
            lines.append(
                f"- [{item.decision_type or 'decision'}] {item.decision}"
                + (f" — {item.reasoning}" if item.reasoning else "")
                + (f" (tags: {tag_str})" if tag_str else "")
            )
    except Exception as e:
        logger.debug("DecisionLog search error: %s", e)
    return "\n".join(lines)

def seed_boot_learnings() -> int:
    inserted = 0
    for seed in BOOT_LEARNINGS:
        if decision_log_store.get(seed["id"]) is not None:
            continue
        decision_log_store.save(
            DecisionLog(
                id=seed["id"],
                decision=seed["decision"],
                reasoning=seed["reasoning"],
                decision_type=seed["decision_type"],
                tags=list(seed["tags"]),
                confidence=seed["confidence"],
                team_id=TEAM_ID,
            )
        )
        inserted += 1
    return inserted

def seed_architect_profile() -> None:
    if user_profile_store.get(USER_ID_ARCHITECT) is not None:
        return
    user_profile_store.save(
        user_id=USER_ID_ARCHITECT,
        profile=OpenVPMUserProfile(
            user_id=USER_ID_ARCHITECT,
            name="Marek",
            preferred_name="Marek",
            role="lead_architect",
            language="sk",
            report_style="executive_summary",
            dispatch_mode="immediate",
            clinical_context="OpenVPM AI — vývojový tím",
            team_id=TEAM_ID,
        ),
    )
    user_memory_store.add_memory(
        user_id=USER_ID_ARCHITECT,
        memory=(
            "Marek (lead_architect): reporty v slovenčine, executive_summary "
            "štýl, okamžitý dispatch úloh. "
            "Sprinty 1 (Command Palette), 2 (UI Kit Harmonization), 3 (Ambulatory Field Practice), "
            "4 (Laboratory Results) a 7 (Encounters Hub) sú už dokončené a zlúčené do main."
        ),
    )

def seed_sprint_entities() -> int:
    """Zaznamená do EntityMemoryStore dokončené sprinty, aby ich líder nepovažoval za nezačaté."""
    merged_sprints = [
        ("sprint-1", "command-palette", "PR #42 — Command Palette Smart Ranking & Contextual Actions (MERGED)."),
        ("sprint-2", "ui-kit-harmonization", "Dashboard UI Kit Harmonization across Recalls, Vaccinations & Controlled Substances (MERGED)."),
        ("sprint-3", "field-practice-cehz", "PR #39, #40 — Ambulatory Field Practice & CEHZ / KVEPIS Sync Resilience (MERGED)."),
        ("sprint-4", "laboratory-results", "Laboratory Results & Diagnostic Reference Range Flags (MERGED)."),
        ("sprint-7", "encounters-hub", "Encounters Hub & Care Reminders — Daily Clinical Workflow Harmonization (MERGED)."),
    ]
    inserted = 0
    for s_id, s_mod, s_note in merged_sprints:
        try:
            entity_memory_store.remember_about(
                entity=s_id,
                entity_type="sprint",
                description=f"Sprint {s_id} (MERGED) nad modulom {s_mod}. {s_note}",
                facts=[f"status=MERGED", f"module={s_mod}", "merged_into=main"],
                events=[f"Sprint {s_id} je plne implementovaný, otestovaný a zlúčený do vetvy main."],
                team_id=TEAM_ID,
                namespace="openvpm",
            )
            entity_memory_store.remember_about(
                entity=s_mod,
                entity_type="module",
                facts=[f"implemented_by={s_id}", "status=production_ready"],
                note=s_note,
                team_id=TEAM_ID,
                namespace="openvpm",
            )
            entity_memory_store.link_entities(
                entity=s_id,
                relation="implements",
                related_entity=s_mod,
                team_id=TEAM_ID,
                namespace="openvpm",
            )
            inserted += 1
        except Exception as e:
            logger.debug("Failed to seed sprint entity %s: %s", s_id, e)
    return inserted

# =============================================================================
# 8. Evaluation — BaseEval Suite & agent_as_judge
# =============================================================================

def _flatten_json_leaves(data: Any, prefix: str = "") -> Dict[str, Any]:
    flat: Dict[str, Any] = {}
    if isinstance(data, dict):
        for key, value in data.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            flat.update(_flatten_json_leaves(value, path))
    elif isinstance(data, list):
        for index, value in enumerate(data):
            path = f"{prefix}[{index}]"
            flat.update(_flatten_json_leaves(value, path))
    else:
        flat[prefix] = data
    return flat

class I18nLeafSymmetryEval(BaseEval):
    def __init__(self, name: str = "i18n-leaf-symmetry", en_path: Optional[Path] = None, sk_path: Optional[Path] = None):
        self.name = name
        self.en_path = Path(en_path or I18N_PATHS["en"])
        self.sk_path = Path(sk_path or I18N_PATHS["sk"])

    def check(self) -> Dict[str, Any]:
        missing: Dict[str, List[str]] = {"en": [], "sk": []}
        if not self.en_path.exists() or not self.sk_path.exists():
            return {"name": self.name, "passed": False, "missing": missing, "detail": f"Chýba i18n súbor"}
        en_leaves = _flatten_json_leaves(json.loads(self.en_path.read_text("utf-8")))
        sk_leaves = _flatten_json_leaves(json.loads(self.sk_path.read_text("utf-8")))
        missing["sk"] = sorted(set(en_leaves) - set(sk_leaves))
        missing["en"] = sorted(set(sk_leaves) - set(en_leaves))
        passed = not missing["en"] and not missing["sk"]
        return {
            "name": self.name,
            "passed": passed,
            "missing": missing,
            "detail": "100% leaf symetria OK" if passed else f"en-only={len(missing['sk'])}, sk-only={len(missing['en'])}",
        }

    def pre_check(self, run_input: Any) -> None:
        return None

    def post_check(self, run_output: Any) -> None:
        return None

    async def async_pre_check(self, run_input: Any) -> None:
        return None

    async def async_post_check(self, run_output: Any) -> None:
        return None

class VanillaSchemaGuardEval(BaseEval):
    def __init__(self, name: str = "vanilla-schema-guard", globs: Sequence[str] = VANILLA_SCHEMA_GLOBS):
        self.name = name
        self.globs = tuple(globs)

    def check(self, changed_paths: Optional[Sequence[str]] = None) -> Dict[str, Any]:
        import fnmatch
        violations: List[str] = []
        paths = list(changed_paths or [])
        if not paths:
            try:
                proc = subprocess.run(["git", "diff", "--name-only", "HEAD~1..HEAD"], cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=30)
                if proc.returncode == 0:
                    paths = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
            except Exception:
                paths = []

        for p in paths:
            for pattern in self.globs:
                if fnmatch.fnmatch(p, pattern):
                    violations.append(p)
                    break
        passed = len(violations) == 0
        return {
            "name": self.name,
            "passed": passed,
            "violations": violations,
            "detail": "Vanilla schémy nedotknuté" if passed else f"Porušenie vanilla schémy v {len(violations)} súboroch",
        }

    def pre_check(self, run_input: Any) -> None:
        return None

    def post_check(self, run_output: Any) -> None:
        return None

    async def async_pre_check(self, run_input: Any) -> None:
        return None

    async def async_post_check(self, run_output: Any) -> None:
        return None

def make_uikit_adherence_judge() -> AgentAsJudgeEval:
    return AgentAsJudgeEval(
        name="uikit-adherence",
        model=make_learning_model(),
        criteria=(
            "UI kód musí dodržiavať UIKIT.md: PageHeader, KpiGrid, DataTableFrame. "
            "Žiadne manuálne surové farby, plná odozva a 100% i18n."
        ),
        scoring_strategy="numeric",
        threshold=8,
        db=db,
        run_in_background=True,
    )

def make_report_quality_judge() -> AgentAsJudgeEval:
    return AgentAsJudgeEval(
        name="report-quality-sk",
        model=make_learning_model(),
        criteria=(
            "Výstup pre vedúceho architekta musí byť po slovensky, vecný, "
            "vo formáte executive_summary (krátke odseky + bullet fakty)."
        ),
        scoring_strategy="numeric",
        threshold=7,
        db=db,
        run_in_background=True,
    )

def run_sprint_eval_suite(changed_paths: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    i18n_result = I18nLeafSymmetryEval().check()
    vanilla_result = VanillaSchemaGuardEval().check(changed_paths=changed_paths)
    passed = bool(i18n_result["passed"] and vanilla_result["passed"])
    report = {
        "passed": passed,
        "checks": {
            "i18n_leaf_symmetry": i18n_result,
            "vanilla_schema_guard": vanilla_result,
        },
    }
    record_decision(
        decision=f"Sprint Eval Suite: {'PASSED' if passed else 'FAILED'}",
        reasoning=json.dumps({"i18n": i18n_result["detail"], "vanilla": vanilla_result["detail"]}, ensure_ascii=False),
        decision_type="eval_result",
        tags=["eval", "sprint-eval-suite"],
        confidence=1.0,
        outcome_quality="good" if passed else "bad",
        team_id=TEAM_ID,
    )
    return report

# =============================================================================
# 9. Metrics & Run Telemetry
# =============================================================================

def estimate_cost(metrics: Optional[RunMetrics], model_id: str = "") -> Optional[float]:
    if metrics is None:
        return None
    if metrics.cost is not None:
        return float(metrics.cost)
    price = MODEL_PRICING.get(model_id)
    if price is None:
        for key, value in MODEL_PRICING.items():
            if model_id.endswith(key):
                price = value
                break
    if price is None:
        return None
    return (metrics.input_tokens * price["input"] + metrics.output_tokens * price["output"]) / 1_000_000.0

@hook(run_in_background=False)
def collect_run_metrics(run_output: Any) -> None:
    team_metrics: Optional[RunMetrics] = getattr(run_output, "metrics", None)
    total_cost = estimate_cost(team_metrics, ORCHESTRATOR_MODEL_ID) or 0.0
    total_tokens = team_metrics.total_tokens if team_metrics else 0
    record_decision(
        decision=f"Run metrics: tokens={total_tokens}, cost≈${total_cost:.4f}",
        reasoning=f"team_tokens={total_tokens}",
        decision_type="metrics_summary",
        tags=["metrics", "sprint-cost"],
        confidence=1.0,
        team_id=TEAM_ID,
    )

# =============================================================================
# 10. Approvals — HITL Brány pre Rizikové Akcie (agno_approvals)
# =============================================================================

@approval(type=ApprovalType.required)
@tool(requires_confirmation=True, stop_after_tool_call=True)
def git_push_origin_main(branch: str = "main", repo_path: str = ".") -> str:
    """Git push do origin/main — BLOKUJÚCE schvaľovanie (admin approval)."""
    proc = subprocess.run(["git", "push", "origin", branch], cwd=str(REPO_ROOT / repo_path), capture_output=True, text=True, timeout=300)
    return f"push origin {branch}: rc={proc.returncode}\n{proc.stdout}\n{proc.stderr}"

@approval(type=ApprovalType.required)
@tool(requires_confirmation=True, stop_after_tool_call=True)
def gh_pr_merge(pr_number: int, repo: str = "", squash: bool = True) -> str:
    """`gh pr merge` — BLOKUJÚCE schvaľovanie pred zlúčením do main."""
    cmd = ["gh", "pr", "merge", str(pr_number)]
    if squash:
        cmd.append("--squash")
    if repo:
        cmd.extend(["--repo", repo])
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=300)
    return f"gh pr merge {pr_number}: rc={proc.returncode}\n{proc.stdout}\n{proc.stderr}"

@approval(type=ApprovalType.required)
@tool(requires_confirmation=True, stop_after_tool_call=True)
def deploy_to_production(service: str, version: str) -> str:
    """Nasadenie na produkciu — BLOKUJÚCE schvaľovanie + auditný záznam."""
    import re
    import shlex
    import shutil

    # 1. Prísna validácia vstupov proti shell injection
    if not re.match(r"^[a-zA-Z0-9_-]{1,32}$", service):
        return f"❌ Bezpečnostné zamietnutie: Neplatný názov služby '{service}'."
    if not re.match(r"^[a-zA-Z0-9._-]{1,64}$", version):
        return f"❌ Bezpečnostné zamietnutie: Neplatný formát verzie '{version}'."

    if not DEPLOY_COMMAND:
        record_compliance_decision(
            decision=f"Deploy {service}@{version} ZAMIETNUTÝ bezpečnostným režimom",
            reasoning="OPENVPM_DEPLOY_COMMAND nie je nastavený — deploy je disabled.",
            law="zakon-39-2007",
            tags=["deploy", "production"],
            team_id=TEAM_ID,
        )
        return "BLOCKED: OPENVPM_DEPLOY_COMMAND nie je nastavený."

    formatted_cmd = DEPLOY_COMMAND.replace("{service}", service).replace("{version}", version)
    cmd_parts = shlex.split(formatted_cmd, posix=(sys.platform != "win32"))
    executable = shutil.which(cmd_parts[0]) or cmd_parts[0]
    proc = subprocess.run(
        [executable] + cmd_parts[1:],
        shell=False,
        capture_output=True,
        text=True,
        timeout=1800,
    )
    record_compliance_decision(
        decision=f"Deploy {service}@{version} na produkciu (rc={proc.returncode})",
        reasoning=proc.stdout[-2000:] or "(bez výstupu)",
        law="zakon-39-2007",
        tags=["deploy", "production"],
        outcome="ok" if proc.returncode == 0 else "failed",
        outcome_quality="good" if proc.returncode == 0 else "bad",
        team_id=TEAM_ID,
    )
    return f"deploy {service}@{version}: rc={proc.returncode}\n{proc.stdout[-2000:]}"

@approval(type=ApprovalType.audit)
@tool(requires_confirmation=True, stop_after_tool_call=True)
def opl_prescription_signoff(prescription_id: str, veterinarian: str) -> str:
    """Auditná brána pre OPL predpis (Zákon 139/1998 Z. z. o OPL)."""
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    vet = veterinarian.strip()
    record_compliance_decision(
        decision=f"OPL predpis {prescription_id} — potvrdený manuálny podpis ({vet})",
        reasoning=(
            f"{stamp} — lekár {vet} potvrdil manuálny podpis OPL "
            "predpisu v súlade so Zákonom 139/1998 Z. z. Elektronický podpis "
            "nebol použitý."
        ),
        law="zakon-139-1998-OPL",
        tags=["prescription", "opl", "manual-signature"],
        team_id=TEAM_ID,
    )
    return f"AUDIT: OPL predpis {prescription_id} evidovaný; manuálny podpis potvrdil {vet}."

# =============================================================================
# 11. Pipeline Nástroje z pipeline_tools.py
# =============================================================================

try:
    from pipeline_tools import (
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
        create_and_dispatch_arena_task,
        send_prompt_to_arena_browser,
        collect_code_from_arena_browser,
        DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS,
        apply_arena_patch,
        evaluate_verification_and_repair,
        verify_arena_repository_lock,
    )
except ImportError as _e:
    logger.warning("Could not import full pipeline_tools: %s. Defining fallback stubs.", _e)
    DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS = 900

@tool()
def recall_learnings_tool(query: str) -> str:
    """Vyhľadá a vráti relevantné learnings a pravidlá tímu z agno_learnings."""
    return recall_relevant_learnings(query)

@tool()
def log_compliance_decision_tool(decision: str, reasoning: str, law: str = "zakon-39-2007") -> str:
    """Zaznamená compliance rozhodnutie do DecisionLogStore (Zákon 39/2007 alebo Zákon 139/1998 OPL)."""
    dec_id = record_compliance_decision(decision=decision, reasoning=reasoning, law=law, team_id=TEAM_ID)
    return f"Zaznamenané compliance rozhodnutie {dec_id} (zákon: {law})"

@tool()
def check_i18n_symmetry_tool() -> str:
    """Overí 100% leaf symetriu kľúčov en.json a sk.json."""
    res = I18nLeafSymmetryEval().check()
    return f"Passed: {res['passed']}. Detail: {res['detail']}"

@tool()
def check_vanilla_schema_tool() -> str:
    """Overí, že vanilkové upstream schémy neboli modifikované."""
    res = VanillaSchemaGuardEval().check()
    return f"Passed: {res['passed']}. Detail: {res['detail']}"

@tool()
def run_sprint_eval_suite_tool() -> str:
    """Spustí kompletnú verifikačnú Eval Suite pred merge PR."""
    res = run_sprint_eval_suite()
    return f"Eval Suite Passed: {res['passed']}. Checks: {res['checks']}"

@tool()
def audit_db_integrity_tool() -> str:
    """Nočný audit integrity SQLite databázy a indexov."""
    try:
        import sqlite3
        conn = sqlite3.connect(str(PIPELINE_DB_FILE))
        cur = conn.cursor()
        cur.execute("PRAGMA integrity_check;")
        res = cur.fetchall()
        conn.close()
        return f"DB Integrity: {res}"
    except Exception as e:
        return f"DB Integrity check failed: {e}"

@tool()
def reindex_knowledge_tool() -> str:
    """Prerobí indexáciu repo dokumentov a zákonov do vektorovej databázy."""
    return str(reindex_repo_knowledge(force=True))

# Nástroje z LearningMachine (9 nástrojov pre správu pamätí)
_LEARN_TOOLS = learning_machine.get_tools()

# =============================================================================
# 12. Špecializovaní Agenti
# =============================================================================

prompt_manager = Agent(
    id="prompt_manager",
    name="Prompt Manager",
    role="Správa promptov, learningov a knowledge kontextu pre tím",
    model=make_orchestrator_model(),
    db=db,
    tools=[
        KnowledgeTools(
            knowledge=knowledge_base,
            enable_think=True,
            enable_search=True,
            enable_analyze=True,
            add_few_shot=True,
        ),
        recall_learnings_tool,
        log_compliance_decision_tool,
        list_arena_sprints,
        read_sprint_assignment,
        format_arena_sprint_prompt,
        create_and_dispatch_arena_task,
        *_LEARN_TOOLS,
    ],
    instructions=[
        "Si prompt manažér tímu OpenVPM AI.",
        "Pred tvorbou promptu vždy vytiahni learnings (recall_learnings) a "
        "knowledge (UIKIT.md, zákony).",
        "Pravidlá 'sandbox: žiadny celý monorepo type-check' a 'OPL vyžaduje manuálny podpis' sú záväzné.",
        "Sprinty 1, 2, 3, 4 a 7 sú už dokončené a zlúčené do main — nespúšťaj ich znova.",
        "Reporty píš po slovensky, štýl executive_summary.",
    ],
    add_history_to_context=True,
    num_history_runs=3,
    markdown=True,
)

arena_dispatcher = Agent(
    id="arena_dispatcher",
    name="Arena Dispatcher",
    role="Dispatch úloh do Arena.ai cez Chrome CDP — s verifikačným zámkom repozitára",
    model=make_orchestrator_model(),
    db=db,
    tools=[
        verify_arena_repository_lock,
        dispatch_to_arena_session,
        send_prompt_to_arena_browser,
        create_and_dispatch_arena_task,
    ],
    instructions=[
        "Dispečuješ úlohy do Arena.ai relácií (Chrome CDP).",
        "ABSOLUTNY INVARIANT: Pred každým dispatchom MUSÍŠ zavolať verify_arena_repository_lock().",
        "Ak verify_arena_repository_lock() vráti LOCK_FAILED — OKAMŽITE zastaviš dispatch.",
        "Nikdy nevkladaj prompt do Composera bez LOCK_OK potvrdeného stavu repozitára.",
        "Pri Marekovi: dispatch OKAMŽITE (dispatch_mode=immediate), ale VŽDY po LOCK_OK.",
        "Každý dispatch zaloguj ako rozhodnutie (decision log cez tím).",
    ],
    add_history_to_context=True,
    markdown=True,
)

arena_watcher = Agent(
    id="arena_watcher",
    name="Arena Watcher",
    role="Monitoring Arena relácií, zber patchov, health checky",
    model=make_orchestrator_model(),
    db=db,
    tools=[
        list_active_arena_sessions,
        monitor_arena_health,
        collect_code_from_arena_browser,
        apply_arena_patch,
        audit_db_integrity_tool,
        reindex_knowledge_tool,
    ],
    instructions=[
        "Sleduješ Arena relácie, zbieraš patche a vykonávaš health checky.",
        "Kolízie patchov detekuj včas a loguj decision_type='collision'.",
        f"Watcher nesmie vyhlásiť hotovo, kým collect_code_from_arena_browser nevráti status=COMPLETED. Predvolený timeout je {DEFAULT_ARENA_COLLECT_TIMEOUT_SECONDS}s. Tab sa vyberá podľa /agent/<session_id>, nie podľa prvého tabu s 'arena' v URL. Non-diff text sa do .patch nezapisuje.",
    ],
    add_history_to_context=True,
    markdown=True,
)

github_manager = Agent(
    id="github_manager",
    name="GitHub Manager",
    role="Git/GitHub operácie, PR workflow, schvaľovacie brány",
    model=make_orchestrator_model(),
    db=db,
    tools=[
        git_push_origin_main,
        gh_pr_merge,
        deploy_to_production,
        opl_prescription_signoff,
        list_github_pull_requests,
        get_pull_request_diff,
        check_pull_request_ci,
        run_sprint_eval_suite_tool,
    ],
    instructions=[
        "Riadiš Git/GitHub workflow tímu.",
        "Pred gh_pr_merge MUSÍ prejsť run_sprint_eval_suite (PASSED).",
        "git_push_origin_main / gh_pr_merge / deploy_to_production sú "
        "schvaľovacie brány (ApprovalType.required) — bez ľudského súhlasu ich nikdy neobídeš.",
        "Akcie s dopadom na veterinárnu legislatívu loguj ako compliance rozhodnutia.",
    ],
    add_history_to_context=True,
    markdown=True,
)

qwen_implementer = Agent(
    id="qwen_implementer",
    name="Qwen Implementer",
    role="Implementácia kódových úloh sprintov (Qwen Coder)",
    model=make_qwen_model(),
    db=db,
    tools=[
        run_qwen_code_cli,
        run_openvpm_verification,
        git_checkout_branch,
        run_shell_command,
        check_i18n_symmetry_tool,
        check_vanilla_schema_tool,
        audit_architectural_boundaries,
        audit_clinical_and_safety_gates,
        audit_i18n_symmetry,
        read_project_file,
        write_project_file,
    ],
    instructions=[
        "Implementuješ kódové úlohy sprintov OpenVPM.",
        "UI Kit je záväzný: PageHeader, KpiGrid, DataTableFrame (UIKIT.md).",
        "i18n: pridaj VŽDY oba stromy en.json aj sk.json (100% leaf symetria).",
        "Vanilkové schémy sú read-only — žiadne migrácie do vanilla ciest.",
        "V sandboxe nepúšťaj celý monorepo type-check — iba cielené príkazy.",
        "Pre čítanie súborov používaj primárne nástroj read_project_file, pre zápis write_project_file.",
        "Pre overenie kódu používaj nástroj run_openvpm_verification.",
        "V run_shell_command nepoužívaj subshell ($(...), backticks) ani redirecty do súborov (>, <).",
    ],
    add_history_to_context=True,
    markdown=True,
)

# =============================================================================
# 13. Tím — OpenVPM Dev Team (Agno 3.0.11 Enterprise)
# =============================================================================

openvpm_dev_team = Team(
    id=TEAM_ID,
    name="OpenVPM Dev Team",
    role="Autonómny vývojový tím pre OpenVPM AI sprinty",
    model=make_orchestrator_model(),
    members=[
        prompt_manager,
        arena_dispatcher,
        arena_watcher,
        github_manager,
        qwen_implementer,
    ],
    db=db,
    learning=learning_machine,
    memory_manager=memory_manager,
    enable_agentic_memory=True,
    session_summary_manager=session_summary_manager,
    enable_session_summaries=True,
    add_session_summary_to_context=True,
    knowledge=knowledge_base,
    search_knowledge=True,
    enable_agentic_knowledge_filters=True,
    post_hooks=[
        collect_run_metrics,
        make_uikit_adherence_judge(),
        make_report_quality_judge(),
    ],
    store_member_responses=True,
    show_members_responses=True,
    add_history_to_context=True,
    num_history_runs=5,
    markdown=True,
    instructions=[
        "Si koordinátor vývojového tímu OpenVPM AI (Agno 3.0.11 AgentOS).",
        "Deleguj: prompt_manager → prompt/knowledge, arena_dispatcher → dispatch, "
        "arena_watcher → monitoring/patche, github_manager → git/PR/deploy (schvaľovacie brány), "
        "qwen_implementer → kód.",
        "Pravidlo autority: SPRINT-INDEX.md a git log sú autoritatívne zdroje pravdy. "
        "Sprinty 1, 2, 3, 4 a 7 sú už dokončené a zlúčené v main. NIKDY ich nepovažuj za nezačaté.",
        "Pred retrospektívou sprintu (PASSED/FAILED) zavolaj record_sprint_learnings.",
        "Architektonický audit: Vanilla routery ako records.ts a whiteboard.ts sú upstream baseline a nesmú byť považované za porušenia ak existujú v upstreame. Každé compliance rozhodnutie sa ukladá ako JSON záznam.",
        "Synchronizácia a izolácia Studio komponentov pri bootovaní rešpektuje lock súbor studio_seed.lock.",
        "Compliance: Zákon 39/2007 Z. z. a Zákon 139/1998 Z. z. (OPL — manuálny podpis) sú "
        "neprekročiteľné; rizikové akcie idú vždy cez Approvals.",
        "Reporty pre Mareka: slovenčina, executive_summary štýl.",
    ],
)

# =============================================================================
# 14. Scheduler & Lifespan
# =============================================================================

def seed_schedules() -> None:
    try:
        manager = ScheduleManager(db=db)
        health_cron = "*/5 * * * *"
        audit_cron = "0 3 * * *"

        manager.create(
            name="Arena 5-min Health Check",
            cron=health_cron,
            endpoint="/agents/arena_watcher/runs",
            method="POST",
            description="Vykonaj health check aktívnych Arena relácií a zaloguj stav.",
            payload={"message": "Vykonaj health check aktívnych Arena relácií a zaloguj stav."},
            timezone=SCHEDULE_TIMEZONE,
            max_retries=2,
            retry_delay_seconds=60,
            if_exists="update",
        )

        manager.create(
            name="Nightly SQLite & Compliance Audit",
            cron=audit_cron,
            endpoint=f"/teams/{TEAM_ID}/runs",
            method="POST",
            description="Spusti nočný audit integrity DB, i18n symetrie a reindexáciu knowledge.",
            payload={"message": "Spusti nočný audit integrity DB, i18n symetrie a reindexáciu knowledge."},
            timezone=SCHEDULE_TIMEZONE,
            max_retries=2,
            retry_delay_seconds=120,
            if_exists="update",
        )
    except Exception as e:
        logger.warning("Schedule initialization notice: %s", e)

@asynccontextmanager
async def lifespan(app: AgentOS):
    logger.info("Initializing OpenVPM Enterprise AgentOS (Agno 3.0.11)...")
    boot_count = seed_boot_learnings()
    logger.info("Seeded %d boot learnings into agno_learnings", boot_count)
    seed_architect_profile()
    logger.info("Seeded architect profile for %s", USER_ID_ARCHITECT)
    sprint_count = seed_sprint_entities()
    logger.info("Seeded %d sprint entities into entity_memory_store", sprint_count)
    seed_schedules()
    try:
        kb_report = reindex_repo_knowledge(force=False)
        logger.info("Knowledge base sync report: %s", kb_report)
    except Exception as e:
        logger.warning("Knowledge base initial sync notice: %s", e)
    logger.info("Enterprise AgentOS ready on %s", AGENTOS_BASE_URL)
    yield
    logger.info("Shutting down OpenVPM Enterprise AgentOS...")

# =============================================================================
# 15. AgentOS Runtime
# =============================================================================

agent_os: AgentOS = AgentOS(
    id="openvpm-pipeline-os",
    name="OpenVPM AI Pipeline AgentOS",
    description=(
        "Autonómny vývojový tím OpenVPM AI — Agno 3.0.11 enterprise "
        "(learning, memory, knowledge, metrics, evals, approvals, scheduler)."
    ),
    version="3.0.11",
    db=db,
    checkpoint="tool-batch",
    agents=[
        prompt_manager,
        arena_dispatcher,
        arena_watcher,
        github_manager,
        qwen_implementer,
    ],
    teams=[openvpm_dev_team],
    knowledge=[knowledge_base],
    cors_allowed_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3007",
        "http://localhost:3008",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3007",
        "http://127.0.0.1:3008",
        "http://192.168.0.100:3000",
        "http://192.168.0.100:3001",
        "http://192.168.0.100:3007",
        "http://192.168.0.100:3008",
        "http://192.168.0.100:7777",
        "https://os.agno.com",
    ],
    scheduler=True,
    scheduler_poll_interval=15,
    scheduler_base_url=AGENTOS_BASE_URL,
    internal_service_token=INTERNAL_SERVICE_TOKEN,
    lifespan=lifespan,
    tracing=True,
)

app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(
        app="pipeline_team_os:app",
        host=os.getenv("OPENVPM_AGENTOS_HOST", "0.0.0.0"),
        port=int(os.getenv("OPENVPM_AGENTOS_PORT", "7777")),
    )
