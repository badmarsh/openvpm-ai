AGNO-ENTERPRISE-SPECIFICATION — OpenVPM AI

Architecture Decision Record & Implementation Specification
Zapojenie 12 enterprise schopností Agno 3.0.11 (AgentOS) do vývojového tímu openvpm_dev_team

	
Status	PROPOSED — na schválenie
Verzia	1.0.0
Dátum	2026-09-25
Autor	Principal AI Platform Architect / Staff Systems Engineer, OpenVPM AI
Schvaľuje	Marek (Lead Architect)
Framework	Agno 3.0.11 (pip install agno==3.0.11 agno[scheduler] lancedb openai sqlalchemy[asyncio])
Implementácia	.agents/agno/pipeline_team_os.py (drop-in blueprint)
Predchádzajúce fázy	Phase 2 — SQLite WAL režim a lock time-outy (pipeline_team.db)
Governing law	Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti; Zákon č. 139/1998 Z. z. o omamných látkach, psychotropných látkach a prípravkoch (OPL)
1. Kontext a motivácia

OpenVPM AI prevádzkuje autonómny vývojový tím (pipeline_team_os.py) postavený na Agno AgentOS, ktorý riadi vývoj sprintov, integráciu s Arena.ai cez Chrome CDP a automatickú verifikáciu. Súčasný stav využíva základné nástroje, čiastočný MemoryManager a vektorovú Knowledge.

Agno 3.0.11 však natívne obsahuje plnohodnotnú kognitívnu vrstvu (agno.learn — LearningMachine a learning stores), systém schvaľovania (agno.approval), evaluačný engine (agno.eval) a plánovač úloh (AgentOS(scheduler=True)), pre ktoré už v pipeline_team.db existujú tabuľky agno_learnings, agno_memories, agno_schedules, agno_approvals, agno_metrics, agno_eval_runs. Doposiaľ však neboli zapojené do jedného konzistentného celku.

Cieľom tohto dokumentu je vyčerpávajúca technická špecifikácia (ADR + Implementation Specification), ktorá definuje dátové toky a schémy 12 modulov, spôsob zapojenia do tímu openvpm_dev_team a jeho agentov, dodržanie slovenskej veterinárnej legislatívy cez Decision Logs a Approvals a pripraví podklad pre otestovaný produkčný kód.

1.1 Ciele
Zapojiť všetkých 12 enterprise schopností Agno 3.0.11 do jedného AgentOS runtime-u.
Udržať jednu perzistentnú vrstvu — pipeline_team.db (SQLite, WAL) + LanceDB (vektory).
Nemenný audit trail compliance rozhodnutí (Zákon 39/2007 Z. z., Zákon 139/1998 Z. z. o OPL).
Human-in-the-Loop brány pre rizikové akcie (git push origin main, gh pr merge, deploy na produkciu).
Učiaci sa tím: lessons learned z PASSED/FAILED sprintov sa stávajú kontextom budúcich sprintov.
1.2 Non-ciele
Migrácia z SQLite na PostgreSQL (ponechaná ako ADR-13 / budúci sprint).
Nahradenie Arena.ai/CDP vrstvy (ostáva čiernou skrinkou volanou nástrojmi).
Elektronický podpis veterinárnych dokumentov — zakázané počas celej životnosti systému (viď § 7).
2. Cieľová architektúra
text
                         ┌────────────────────────────────────────────┐
                         │        AgentOS 3.0.11 (FastAPI :7777)      │
                         │  scheduler=True · tracing=True · REST/MCP  │
                         └────────────────────────────────────────────┘
        /teams/openvpm_dev_team/runs ──────────────────────────────┐
                                                                   ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │              Team "openvpm_dev_team" (koordinátor sprintov)              │
   │  learning=LearningMachine · memory_manager · session_summary_manager     │
   │  knowledge=Knowledge(LanceDb) · post_hooks=[metrics, 2× agent_as_judge]  │
   └──────────────────────────────────────────────────────────────────────────┘
        │            │              │               │                │
        ▼            ▼              ▼               ▼                ▼
 prompt_manager  arena_        arena_         github_manager   qwen_implementer
 (prompty,       dispatcher    watcher        (git/PR/deploy   (kód, UI Kit,
  knowledge,     (CDP          (health,        + schvaľovacie    i18n, sandbox
  learnings)      dispatch)     patche, DB)     brány HITL)       príkazy)

   ┌───────────────────────── Kognitívna & perzistentná vrstva ───────────────┐
   │ LearningMachine                                                         │
   │  ├─ UserProfileStore ──────┐                                            │
   │  ├─ UserMemoryStore ───────┤                                            │
   │  ├─ SessionContextStore ───┼──► agno_learnings  (SQLite, WAL)           │
   │  ├─ EntityMemoryStore ─────┤    agno_memories   (MemoryManager)          │
   │  └─ DecisionLogStore ──────┘    agno_sessions / agno_runs               │
   │ LearnedKnowledgeStore ────────► Knowledge (agno_knowledge + LanceDB)     │
   │ RunMetrics ───────────────────► agno_metrics    (+ /metrics API)         │
   │ BaseEval / AgentAsJudgeEval ──► agno_eval_runs  (+ /eval-runs API)       │
   │ @approval (required|audit) ──► agno_approvals   (+ /approvals API)       │
   │ ScheduleManager ─────────────► agno_schedules / agno_schedule_runs       │
   └──────────────────────────────────────────────────────────────────────────┘
2.1 Mapovanie schopností → komponentov
#	Schopnosť	Agno komponent (3.0.11)	Perzistencia	Kapitola
1	Learning	LearningMachine (agno.learn)	agno_learnings	§ 3.1
2	User Memories	UserMemoryStore	agno_learnings (memories_{user_id})	§ 3.2
3	User Profiles	UserProfileStore + OpenVPMUserProfile	agno_learnings (user_profile_{user_id})	§ 3.3
4	Entity Memories	EntityMemoryStore (ns openvpm)	agno_learnings (entity_openvpm_*)	§ 3.4
5	Session Context	SessionContextStore	agno_learnings (session_context_{sid})	§ 3.5
6	Decision Logs	DecisionLogStore	agno_learnings (dec_*)	§ 3.6
7	Memory	MemoryManager + SessionSummaryManager	agno_memories	§ 3.7
8	Knowledge	Knowledge + LanceDb (hybrid)	agno_knowledge + data/lancedb	§ 3.8
9	Metrics	RunMetrics / SessionMetrics	agno_metrics	§ 3.9
10	Evaluation	BaseEval, AgentAsJudgeEval	agno_eval_runs	§ 3.10
11	Approvals	@approval(ApprovalType) + @tool(HITL)	agno_approvals	§ 3.11
12	Scheduler	AgentOS(scheduler=True) + ScheduleManager	agno_schedules, agno_schedule_runs	§ 3.12
2.2 Kľúčové architektonické rozhodnutia (ADR súhrn)
ADR	Rozhodnutie	Odôvodnenie
ADR-01	Jeden zdieľaný LearningMachine na úrovni tímu (namespace=openvpm)	Konzistentný pohľad na learnings pre leadera aj delegované úlohy; store-y sú per-user/per-session, nie per-agent — jedna inštancia znamená jedno pravdivé miesto (agno_learnings)
ADR-02	Režimy učenia: User Profile/User Memory/Session Context = ALWAYS; Entity Memory/Decision Log/Learned Knowledge = AGENTIC	Osobné preferencie a plán musia byť zachytené konzistentne; grafové a auditné zápisy majú hodnotu len ak sú vedomé (menej šumu)
ADR-03	Custom schema=OpenVPMUserProfile pre role lead_architect/veterinarian/nurse	Klinický kontext je prvotriedny údaj — musí byť typovaný, nie volný text
ADR-04	MemoryManager (Agentic Memory, enable_agentic_memory=True) na tíme; členovia zdieľajú user_id mapovanie	Vyhne sa dvojitému zápisu (agentic > automatic); súlad UserMemory ↔ agno_memories cez jeden db
ADR-05	Knowledge = LanceDB SearchType.hybrid + KnowledgeTools u prompt_managera; enable_agentic_knowledge_filters=True na tíme	Presné dohľadanie UIKIT/zákonov podľa metadát (`kind=law
ADR-06	Rozhodnutia s compliance dopadom = DecisionLog(decision_type="compliance") + tag zákona; nemenné (len update_outcome)	Auditný trail požadovaný veterinárnou legislatívou
ADR-07	Rizikové akcie = @approval(type=ApprovalType.required) + @tool(requires_confirmation=True); compliance stopy = ApprovalType.audit	Blokujúce admin-schválenie pre push/merge/deploy; auditný záznam pre OPL procesy
ADR-08	Eval Suite = deterministické BaseEval podtriedy (i18n, vanilla) + AgentAsJudgeEval (UI Kit, report)	100% leaf symetria sa musí overiť exaktne, kvalita štýlu súdom LLM
ADR-09	Schedulery: */5 * * * * health + 0 3 * * * nočný audit, tz=Europe/Bratislava, if_exists="update"	Idempotentné seedovanie pri každom štarte; časové pásmo SK
ADR-10	SQLite engine s PRAGMA journal_mode=WAL, busy_timeout=30000, foreign_keys=ON na každom spojení	Phase 2 invariance — scheduler + API + nočný audit bežia súčasne
ADR-11	checkpoint="tool-batch" na AgentOS	Obnoviteľnosť dlhých tímových runov po páde bez straty dávok nástrojov
ADR-12	Auth: authorization=True len s JWT kľúčom (JWT_VERIFICATION_KEY/JWT_JWKS_FILE), inak service-account režim	Bezpečné defaulty bez lockoutu lokálneho vývoja
3. Detailná špecifikácia modulov
3.1 Learning — LearningMachine (agno_learnings)

Účel. Koordinácia všetkých learning store-ov; po skončení sprintu (PASSED/FAILED) extrahuje lessons learned a ukladá ich do agno_learnings; do budúcich promptov filtruje a injektuje len relevantné learnings (napr. „V sandboxe nepúšťaj celý monorepo type-check", „OPL vyžaduje manuálny podpis").

API (Agno 3.0.11, overené introspekciou).

Python
LearningMachine(
    db, model, knowledge=None,
    user_profile=False | bool | UserProfileConfig | LearningStore,
    user_memory=..., session_context=..., entity_memory=...,
    learned_knowledge=..., decision_log=...,
    namespace="global", max_updates_per_run=10,
    custom_stores: dict[str, LearningStore] | None, debug_mode, name,
)

Protokol LearningStore: recall(**kw) -> Any, build_context(data) -> str, get_tools(**kw) -> [Callable], process(messages, **kw) -> None. Režimy LearningMode: ALWAYS, AGENTIC, PROPOSE, HITL. Všetkých 5 store-ov je inštancovaných priamo a pomenovaných v blueprinte:

Python
user_profile_store   = learning_machine.user_profile_store    # UserProfileStore
user_memory_store    = learning_machine.user_memory_store     # UserMemoryStore
session_context_store= learning_machine.session_context_store # SessionContextStore
entity_memory_store  = learning_machine.entity_memory_store   # EntityMemoryStore
decision_log_store   = learning_machine.decision_log_store    # DecisionLogStore

Dátový tok — retrospektíva sprintu (record_sprint_learnings).

Tím dokončí sprint → koordinátor vyhodnotí status ∈ {PASSED, FAILED} (guard: iná hodnota → ValueError).
Každá lesson → DecisionLogStore.save(DecisionLog(id="dec_…", decision_type="lesson_learned", tags=[sprint_id, module, status], outcome=status)) → nemenný riadok v agno_learnings.
Události → EntityMemoryStore.remember_about(entity=module, entity_type="module", events=[…]) + link_entities(sprint_id, "implements", module) — história modulu naprieč reláciami.
update_outcome(decision_id, outcome, outcome_quality) pri spätnom overení.

Filtrácia a injekcia do promptov (recall_relevant_learnings).

Trvalé (seed) learnings — vždy prítomné: dec_seed_sandbox_typecheck („V sandboxe nepúšťaj celý monorepo type-check"), dec_seed_opl_manual_signature („OPL vyžaduje manuálny podpis"). Seed je idempotentný (get(id) pred zápisom).
Vyhľadané — DecisionLogStore.search(query=…, agent_id=…, days=90, limit=6) — fulltext/semantic podľa dotazu úlohy.
Automatické — LearningMachine.recall() + build_context() vkladá do system promptu ALWAYS-store výpisy (profil, user memories, session context) a AGENTIC store výpisy podľa max_entities_in_context=8.
Výsledok = markdown blok ## Relevantné learnings (agno_learnings) — kontrakt pre prompt_managera.

Doplnkovo learned_knowledge=LearnedKnowledgeConfig(knowledge=knowledge_base, namespace="openvpm") (režim AGENTIC, nástroje search_learnings/save_learning) ukladá prenositeľné insight-y do Knowledge bázy — dokumentovaný nuans Agno: agno_learnings kryje 5 store-ov (profile, memory, session context, entity, decision log), learned_knowledge žije vo vektorovej báze.

Zapojenie. Team(learning=learning_machine); prompt_manager dostáva nástroje learning_machine.get_tools() (overené: 9 nástrojov — update_user_profile, update_user_memory, remember_about, link_entities, search_entities, forget, log_decision, record_outcome, search_decisions) + vlastný recall_learnings_tool.

Akceptačné kritériá.

 record_sprint_learnings zapíše lessons pre PASSED aj FAILED (test: 2× dec_* v agno_learnings).
 Seed lessons sú po štarte v recall bloku (test: "monorepo type-check" a "manuálny podpis" v recall_relevant_learnings).
 agno_learnings ide REST-om čítať (GET /learnings?learning_type=…) pre audit.
3.2 User Memories — UserMemoryStore

Účel. Neštruktúrované pozorovania o ľuďoch — preferencie, pracovné návyky, štýl komunikácie. Pre Mareka napr. „reporty v slovenčine, executive_summary, okamžitý dispatch".

Schéma (agno.learn.schemas.Memories → agno_learnings, id memories_{user_id}).

Pole	Typ	Poznámka
user_id	str	kľúč (marek@openvpm.sk)
memories	list	záznamy {id, content, metadata} — anti-akumulačný extrakčný prompt preferuje update pred insert
agent_id, team_id	str?	auditná stopa
created_at, updated_at	ts	

Režim. UserMemoryConfig(mode=ALWAYS, enable_add/update/delete_memory=True, enable_clear_memories=False) — pasívna extrakcia zároveň s hlavným runom; mazanie celého profilu je zakázané (compliance). V AGENTIC režime je nástroj update_user_memory (add/update/delete).

Dátový tok. vstup používateľa → ALWAYS extrakcia (paralelne s modelovým hovorom) → upsert do agno_learnings → recall() pri ďalšom rune rovnakého user_id vkladá do system promptu.

Zosúladenie s agno_memories. MemoryManager (§ 3.7) ukladá do agno_memories; UserMemoryStore do agno_learnings. Obe vrstvy zdieľajú jeden SqliteDb a rovnaké user_id — blueprint to explicitne uvádza v additional_instructions (žiadne duplicitné protichodné zápisy; MemoryManager = agentic facts, UserMemoryStore = kontextové pozorovania).

Akceptačné kritériá. Preferencie Mareka prežijú novú session (seed seed_architect_profile() + add_memory); GET /learnings?learning_type=user_memory&user_id=… vracia záznamy.

3.3 User Profiles — UserProfileStore

Účel. Typovaný, štruktúrovaný profil človeka vrátane modelu rolí a klinického kontextu:

Rola (role)	Klinický kontext	Oprávnenia (systémový pohľad)
lead_architect	vývojový tím (Marek)	architektonické rozhodnutia, schvaľovanie (approver), dispatch immediate, report sk / executive_summary
veterinarian	ambulancia/klinika	klinické rozhodnutia, predpis liekov, OPL predpis s manuálnym podpisom
nurse	ambulancia/klinika	ošetrovateľská dokumentácia, bez predpisovania liekov

Schéma. Vlastný dataclass OpenVPMUserProfile(schema=…) nahrádza štandard UserProfile (obohatený o role, language, report_style, dispatch_mode, clinical_context). Pole user_id je povinné zvyšok voliteľný (extrakcia dopĺňa len známe fakty).

Režim. ALWAYS (mená/preferencie sa majú zachytiť konzistentne) + additional_instructions=USER_PROFILE_ROLE_MODEL definujúci sémantiku rolí. V AGENTIC režime nástroj update_user_profile.

Perzistencia. agno_learnings, id user_profile_{user_id} (overené voči AgentOS /learnings API). Prístup: user_profile_store.save(user_id, profile) / .get(user_id).

Akceptačné kritériá. Seed profil Marek: role=lead_architect, language=sk, dispatch_mode=immediate (testom overené). Profil veterinára nikdy nezíska approver práva bez explicitnej zmeny ADR-07.

3.4 Entity Memories — EntityMemoryStore

Účel. Kontextový graf „všetkého okrem používateľa" — v OpenVPM mapovanie modulov a ich histórie rozhodnutí/zmien naprieč reláciami.

Mapovanie entít (namespace openvpm).

Entita	entity_type	Typické vzťahy
sprint-5, sprint-6	sprint	implements → module
prescriptions	module	implements Zákon 39/2007, depends_on → whiteboard
e-kasa	module	depends_on → prescriptions
whiteboard	module	blocks/blocked_by sprintov

Schéma (EntityMemory). entity_id, entity_type, name, description, properties{}, aliases[], facts[], events[], relationships[], namespace, user_id/agent_id/team_id, created_at/updated_at/archived_at.

Režim. AGENTIC — agent rozhoduje, kedy si čo zapamätá; nástroje: remember_about, link_entities, search_entities, forget (+ list). Ohraniče: max_entities_in_context=8, max_facts_per_entity=15, max_events_per_entity=10, supersession_threshold=0.8 (aut. deduplikácia prekonaných faktov).

Dátový tok histórie modulu. Retrospektíva sprintu → remember_about(module, events=[…]) (časová pečiatka + lessons) → link_entities(sprint, "implements", module). O mesiac neskôr: search_entities("prescriptions") vráti entity aj s udalosťami — kontinuita rozhodnutí naprieč reláciami (testom overené: entity search vracia prescriptions + sprint-5).

Compliance. Fakty o OPL skladových zásobách sa nesmú ukladať (MemoryManager.additional_instructions to explicitne zakazuje) — entity memory smie obsahovať iba procesné/technické fakty.

3.5 Session Context — SessionContextStore

Účel. Kompaktný medzikrokový stav (goal, plan, progress, summary) — udržiava „vlákno" dlhej úlohy aj keď sa message history skráti. Nahrádza zahltenie kontextového okna tokenmi.

Schéma (SessionContext). session_id, user_id, summary, goal, plan, progress, agent_id, team_id, timestamps. enable_planning=True pridáva plánovací cyklus.

Režim. ALWAYS-only (záznam sa prepísať po každom rune — nie append). additional_instructions vynucujú limit ~300 tokenov bez kódu.

Dátový tok. run → extrakcia stavu (paralelne) → replace session_context_{session_id} → ďalší run: recall(session_id) → build_context() do system promptu. Spolupráca s add_history_to_context=True, num_history_runs=5 na tíme: history = posledných 5 runov, session_context = kompaktný stav celého sprintu.

Akceptačné kritériá. Po 50 runoch ostáva session_context < ~300 tokenov; plán sprintu (goal/plan/progress) prežije num_history_runs skrátenie.

3.6 Decision Logs — DecisionLogStore

Účel. Nemenný audit trail: prečo agent urobil rozhodnutie — výber modelu, schválenie/zamietnutie diffu, detekcia kolízie, compliance rozhodnutia.

Schéma (DecisionLog → agno_learnings, id dec_*).

Pole	Typ	Príklad (OpenVPM)
id	str	dec_58fd4c6fefe3
decision	str	„Receptáre: používaj DataTableFrame"
reasoning	str	„Custom tabuľka porušuje UIKIT.md §3"
decision_type	str	lesson_learned | compliance | eval_result | metrics_summary | tool_selection | diff_review | collision
context	str	sprint=sprint-5; module=prescriptions; status=PASSED
alternatives	list	[„custom tabuľka", „KpiGrid-only layout"]
confidence	float 0–1	1.0
outcome, outcome_quality	str	good | bad | neutral (dopĺňa sa update_outcome)
tags	list	["lesson", "zakon-139-1998-OPL", …]
session_id, user_id, agent_id, team_id	str	auditná väzba

Nemennosť. save() je insert-only; jediná mutácia je update_outcome(decision_id, outcome, outcome_quality) — doplnenie výsledku bez prepísania rozhodnutia a dôvodu. To spĺňa požiadavku auditného trailu (Zákon 39/2007 Z. z. — ošetrovateľská/zdravotná dokumentácia nesmie byť spätne menená; OPL evidencia podobne).

Režim. AGENTIC (log_decision, record_outcome, search_decisions) + programové record_decision() / record_compliance_decision() pre deterministické zápisy z nástrojov a evalov.

Compliance mapovanie — viď § 7.

3.7 Memory — MemoryManager (Agentic Memory) + SessionSummaryManager

Účel. Zosúladenie UserMemory a session summaries s perzistentnou pipeline_team.db.

MemoryManager (agno.memory) — agno_memories tabuľka (memory_table):

Python
MemoryManager(model=…, db=db, delete_memories=True, update_memories=True,
              add_memories=True, additional_instructions=…)

Režimy: Agentic (Team(enable_agentic_memory=True) — model volá memory nástroje; pri oboch príznakoch má prednosť) vs Automatic (update_memory_on_run=True). Blueprint volí Agentic. Záznam UserMemory(memory_id, memory, topics, …); prístup team.get_user_memories(user_id=…); vyhľadávanie search_user_memories(retrieval_method="last_n"|"first_n"|"agentic").

SessionSummaryManager (agno.session) — Team(enable_session_summaries=True, add_session_summary_to_context=True, session_summary_manager=…); rolling summary get_session_summary(session_id) (summary, topics). Ukladá sa pri session záznamoch v agno_sessions. Kustomizovaný prompt: slovenský executive_summary (12 viet).

Dátový tok. run → agentic memory nástroje (rozhodnutie modelu) → upsert_memories do agno_memories → ďalší run: memories do system promptu. Súlad so store-om § 3.2: jeden db, jedno user_id, rozdelená zodpovednosť (facts vs. pozorovania) — vynútené inštrukciami oboch extraktorov.

3.8 Knowledge — Knowledge + LanceDB

Účel. Sémantické vyhľadávanie v agentích nástrojoch: AGENTS.md, UIKIT.md, zákony (39/2007, 139/1998) + priebežné preindexovanie repozitára.

Konfigurácia.

Python
Knowledge(name=…, description=…, vector_db=LanceDb(
    uri="data/lancedb", table_name="openvpm_knowledge",
    search_type=SearchType.hybrid,           # vector + keyword (RRF)
    embedder=OpenAIEmbedder(id="text-embedding-3-small"),
))

Stratégia preindexovania (reindex_repo_knowledge).

Zdroj	metadata.kind	Trigger
AGENTS.md	repo	startup (chybajúce) + nočný audit (force=True)
UIKIT.md	repo	↑
docs/legal/zakon-39-2007-…md	law	↑
docs/legal/zakon-139-1998-…md (OPL)	law	↑

Metadata (kind, area, lang, source) umožňujú knowledge_filters={"kind": "law"} — compliance otázky dostanú len zákony. Deduplikáciu rieši Knowledge podľa mena/obsahu; remove_all_content + reload je núdzový „rebuild".

Sémantické vyhľadávanie v nástrojoch.

KnowledgeTools(knowledge=…, enable_think=True, enable_search=True, enable_analyze=True) u prompt_managera — agentic RAG.
Team(search_knowledge=True, enable_agentic_knowledge_filters=True) — líder skladá filtre dynamicky.
add_knowledge_to_context=True (traditional RAG) je alternatíva pre deterministické scénare.

Learned knowledge. LearnedKnowledgeStore (§ 3.1) píše prenositeľné insight-y do tej istej bázy (namespace openvpm) — jeden index, dva účely.

Akceptačné kritériá. Po force reindexácii dotaz „OPL podpis" vráti chunky z zakon-139-1998 (filter kind=law); zmena UIKIT.md je po nočnom audite vyhľadateľná.

3.9 Metrics — RunMetrics, telemetria a náklady

Účel. Telemetrický model: spotreba tokenov, latencia modelov, chybovosť nástrojov, kalkulácia nákladov na sprint.

Model metrík (Agno 3.0.11). BaseMetrics → input_tokens, output_tokens, total_tokens, audio_*, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost. RunMetrics navyše: duration, time_to_first_token, details (per-model ModelMetrics podľa (provider, id) — vrátane eval_model), additional_metrics. ToolCallMetrics na ToolExecution.metrics (chybovosť/latencia nástrojov). SessionMetrics = team.get_session_metrics().

Zber.

Automatický — Agno perzistuje surové metriky do agno_metrics pri db=; AgentOS vystavuje GET /metrics (denne agregované runy/sessions/users/tokens/rozpis modelov) + /metrics/refresh.
Post-hook collect_run_metrics — prejde leadera + member_responses (rekurzívne pre vnorené tímy), dopočíta odhad nákladov estimate_cost() (ak provider nevracia cost) podľa MODEL_PRICUSING (USD/1M tokenov: gpt-5.2 = 1.25/10.0, gpt-5-mini = 0.25/2.0, qwen3-coder = 0.35/1.4) a uloží sprint-level súhrn ako DecisionLog(decision_type="metrics_summary", tags=["metrics", "sprint-cost"]).

Kalkulácia nákladov na sprint. Σ (estimate_cost(leader) + estimate_cost(member_i)) cez všetky runy so session_id/tags sprintu; eval-model tokeny sú v details["eval_model"] (náklady judge-ov patria do ceny kvality). Report: POST /metrics/refresh → GET /metrics alebo SQL nad agno_metrics.

Pozor. Leaderove RunMetrics neobsahujú členov — blueprint ich sčítava rekurzívne (potvrdené štruktúrou TeamRunOutput.member_responses).

3.10 Evaluation — BaseEval, agent_as_judge

Účel. Evaluačná sada (Eval Suite) pre kód vygenerovaný v sprintoch + kvalitatívne skóre výstupov.

Rozhranie. BaseEval (agno.eval.base): pre_check(run_input), post_check(run_output), async_pre_check, async_post_check — inštancie je možné vložiť priamo do pre_hooks/post_hooks. AgentAsJudgeEval(BaseEval): criteria, scoring_strategy="numeric"|"binary", threshold (1–10, default 7), additional_guidelines, model, evaluator_agent, on_fail, db, run_in_background. Výsledok AgentAsJudgeEvaluation {input, output, criteria, score, reason, passed} → agno_eval_runs (GET /eval-runs).

Eval Suite sprintu (3 požadované kontroly + 1 kvalitatívna).

#	Eval	Typ	Kritérium	Práh
1	I18nLeafSymmetryEval	deterministický BaseEval	100% leaf symetria kľúčov en.json ↔ sk.json (flatten na leaf cesty, obojsmerný rozdiel = FAIL)	0 rozdielov
2	VanillaSchemaGuardEval	deterministický BaseEval	detekcia nepovolených zásahov do vanilkových schém (db/schema/vanilla/**, migrations/vanilla/**, supabase/migrations/vanilla/**) cez git diff --name-only origin/main...HEAD	0 zásahov
3	uikit-adherence	AgentAsJudgeEval	adherence k UI Kitu: PageHeader, KpiGrid, DataTableFrame z @/uikit, žiadne ad-hoc náhrady	numeric ≥ 8
4	report-quality-sk	AgentAsJudgeEval	reporty pre Mareka: slovenčina, executive_summary, vecnosť	numeric ≥ 7

Dátový tok. (a) post_hooks tímu: collect_run_metrics + dva judge-y (run_in_background=True — neblokujú odpoveď, výsledok do agno_eval_runs); (b) brána: run_sprint_eval_suite() pred gh_pr_merge (github_manager inštrukcia: bez PASSED nesplučuje) a v nočnom audite; (c) nástroje check_i18n_symmetry_tool, check_vanilla_schema_tool pre qwen_implementera počas implementácie. Každý výsledok auditne do DecisionLogov (decision_type="eval_result").

Pozor (z dokumentácie Agno). Zdieľanie jednej AgentAsJudgeEval inštancie medzi paralelnými requestami môže stratiť DB logovanie (async_post_check dočasne mení db) — factory make_*_judge() vytvára čerstvé inštancie pri konštrukcii post_hooks; pri hromadnom run() používaj vždy novú inštanciu.

3.11 Approvals — agno.approval, agno_approvals

Účel. Human-in-the-Loop schvaľovacie brány pre rizikové akcie s perzistentným auditným záznamom.

API.

Python
from agno.approval import approval, ApprovalType   # ApprovalType.required | .audit

@approval(type=ApprovalType.required)              # alebo @approval (default)
@tool(requires_confirmation=True)                  # HITL vlajka
def risky(...): ...
ApprovalType	Správanie	Použitie
required (default)	Blokujúce. Run sa pozastaví (PAUSED), vznikne pending záznam; pokračuje sa až po resolve	deletions, payments, deploy
audit	Neblokujúce. Vyžaduje vrstvu HITL (requires_confirmation / requires_user_input / external_execution); po resolve kroku vznikne resolved audit záznam	compliance logging

Presné vymedzenie rizikových akcií (OpenVPM).

Nástroj	Typ	Vlastník	HITL
git_push_origin_main(branch)	ApprovalType.required	github_manager	requires_confirmation
gh_pr_merge(pr_number)	ApprovalType.required	github_manager	requires_confirmation (podmienka: Eval Suite PASSED)
deploy_to_production(service, version)	ApprovalType.required	github_manager	requires_confirmation + env kill-switch OPENVPM_DEPLOY_COMMAND
opl_prescription_signoff(prescription_id, veterinarian)	ApprovalType.audit	github_manager	requires_confirmation — eviduje manuálny podpis, nikdy ho nenahrádza

Životný cyklus požiadavky.

Generovanie. Agent zavolá nástroj → run sa pozastaví (status=PAUSED, requirements[] s needs_confirmation) → @approval zapíše riadok do agno_approvals (status=pending, pause_type=confirmation, tool_name, tool_args, source_type=team|agent, run_id, session_id).
Schválenie cez Agno Studio / API.
REST: GET /approvals?status=pending&approval_type=required → POST /approvals/{id}/resolve {"status": "approved"|"rejected", "resolved_by": "marek@openvpm.sk"};
Studio (Control Plane): Approvals tab — approve/reject s auditom;
pokračovanie: POST /teams/{team_id}/runs/{run_id}/continue s requirements (potvrdené confirmation: true) — pre required stačí resolve + continue, pre HITL-krok aj requirement.confirm() / provide_user_input({...}).
Audit. Riadok ostáva v agno_approvals (resolved_by, resolved_at, resolution_data); GET /approvals/count pre pending stav v dashboarde. Team-level: approval nástroj môže byť na lídrovi alebo členovi — pauza sa propaguje na team run (overené cookbook team-approval).

Akceptačné kritériá. [x] create→resolve lifecycle na agno_approvals otestovaný (pending=1 → approved). [x] requires_confirmation=True na všetkých 4 nástrojoch (overené introspekciou funkcií). [x] Bez resolve neexistuje continue — kontrakt REST API.

3.12 Scheduler — AgentOS.scheduler, agno_schedules

Účel. Periodické cron úlohy bez externej infraštruktúry (in-process poller SchedulePoller → HTTP volanie na AgentOS endpoint).

API.

Python
AgentOS(..., scheduler=True, scheduler_poll_interval=15,
        scheduler_base_url="http://127.0.0.1:7777", internal_service_token=…)
ScheduleManager(db).create(name, cron, endpoint, method="POST", payload=…,
    timezone=…, timeout_seconds=…, max_retries=…, retry_delay_seconds=…,
    if_exists="raise"|"update")   # + list/get/update/enable/disable/delete/trigger/get_runs

Definícia periodických úloh (seed_schedules, tz=Europe/Bratislava, idempotentné if_exists="update").

Názov	Cron	Endpoint	Payload (skrátene)
openvpm-arena-health	*/5 * * * *	POST /agents/arena_watcher/runs	„HEALTHCHECK: skontroluj bežiace Arena relácie, zber patchov, pri anomáliách decision_type=collision"
openvpm-nightly-audit	0 3 * * *	POST /teams/openvpm_dev_team/runs	„NIGHTLY AUDIT: (1) Eval Suite — i18n symetria + vanilla guard, (2) audit_db_integrity, (3) reindex_knowledge; výsledok do decision logu"

Dátový tok. poller (15 s) → claim_due_schedule (atomický claim v agno_schedules) → HTTP POST s internal_service_token → run → agno_schedule_runs história (success|failed|paused|timeout, attempt, error). Správa: GET/POST/PATCH/DELETE /schedules… + POST /schedules/{id}/trigger + GET /schedules/{id}/runs.

Garancie. max_retries=2 (health) / 2 (audit), retry_delay_seconds=60/120, timeout_seconds=600/1800; seed v lifespan (štart) — prežije reštarty a replikáciu configu.

Akceptačné kritériá. [x] Po seed_schedules() sú v agno_schedules presne 2 riadky so správnymi cron výrazmi (testom overené). [x] Dvojitý seed nespraví duplikáty.

4. Implementačný blueprint — .agents/agno/pipeline_team_os.py

Drop-in modul (1550 riadkov, syntakticky bezchybný, importom a smoke testami overený na agno 3.0.11). Štruktúra sekcií:

Sekcia	Obsah	Kapitoly
0	Konfigurácia (env, cesty, TABLES, MODEL_PRICING, KNOWLEDGE_SOURCES, VANILLA_SCHEMA_GLOBS, I18N_PATHS, BOOT_LEARNINGS)	všetky
1	make_sqlite_engine() — WAL + busy_timeout=30000 + foreign_keys=ON + synchronous=NORMAL na connect evente; SqliteDb(db_engine=…, **TABLES)	ADR-10
2	make_orchestrator/learning/qwen_model()	§ 3.9
3	OpenVPMUserProfile + USER_PROFILE_ROLE_MODEL	§ 3.3
4	knowledge_base (LanceDb hybrid) + reindex_repo_knowledge()	§ 3.8
5	memory_manager + session_summary_manager	§ 3.7
6	learning_machine (5 store-ov + learned_knowledge) + record_decision, record_compliance_decision, record_sprint_learnings, recall_relevant_learnings, seed_boot_learnings, seed_architect_profile	§ 3.1–3.6
7	I18nLeafSymmetryEval, VanillaSchemaGuardEval (BaseEval), make_uikit_adherence_judge, make_report_quality_judge, run_sprint_eval_suite	§ 3.10
8	estimate_cost, collect_run_metrics (@hook)	§ 3.9
9	Schvaľovacie brány: git_push_origin_main, gh_pr_merge, deploy_to_production (ApprovalType.required), opl_prescription_signoff (ApprovalType.audit)	§ 3.11, § 7
10	Prevádzkové nástroje (Arena CDP, gh, sandbox, guardy, audit_db_integrity, reindex_knowledge)	—
11	Agenti + Team(id="openvpm_dev_team")	§ 2
12	seed_schedules() + lifespan	§ 3.12
13	AgentOS(..., scheduler=True, checkpoint="tool-batch", tracing=True) + app + serve	ADR-11/12
4.1 Konfiguračné premenné
Env	Default	Význam
OPENVPM_PIPELINE_DB	./data/pipeline_team.db	SQLite súbor
OPENVPM_LANCEDB_URI	./data/lancedb	LanceDB adresár
OPENVPM_REPO_ROOT	cwd	koreň repozitára (git diff guard)
OPENVPM_SQLITE_BUSY_TIMEOUT_MS	30000	Phase 2 lock timeout
ARENA_API_BASE, ARENA_API_TOKEN	—	Arena.ai API (CDP adapter)
CHROME_CDP_URL	http://127.0.0.1:9222	Chrome CDP
OPENVPM_DEPLOY_COMMAND	(prázdne = deploy disabled)	deploy príkaz {service}/{version}
OPENVPM_SCHEDULE_TZ	Europe/Bratislava	cron časové pásmo
OPENVPM_AGENTOS_BASE_URL	http://127.0.0.1:7777	scheduler base URL
OPENVPM_INTERNAL_SERVICE_TOKEN	auto	scheduler→OS token
OPENVPM_AGENTOS_AUTH	auto	auto=len s JWT kľúčom; 1/0 = vynútiť
JWT_VERIFICATION_KEY / JWT_JWKS_FILE	—	produkčná autentizácia
OPENVPM_ORCHESTRATOR_MODEL / OPENVPM_LEARNING_MODEL / QWEN_CODER_MODEL	gpt-5.2 / gpt-5-mini / qwen3-coder	modely
DASHSCOPE_API_KEY, QWEN_BASE_URL	—	Qwen endpoint
4.2 Závislosti
text
pip install "agno==3.0.11" "agno[scheduler]" lancedb openai \
            "sqlalchemy[asyncio]" fastapi[standard] httpx croniter
# voliteľne (tracing): pip install opentelemetry-api opentelemetry-sdk \
#                          openinference-instrumentation-agno
5. Zapojenie do tímu openvpm_dev_team
Agent	Úloha	Kľúčové nástroje	Learning/Memory dotyk
prompt_manager	prompty, knowledge kontext, injekcia learningov	KnowledgeTools, recall_learnings_tool, log_compliance_decision_tool + 9 learning nástrojov	primárny konzument agno_learnings
arena_dispatcher	dispatch úloh do Arena.ai (Chrome CDP), okamžitý dispatch pre Mareka	arena_dispatch_task	decision log pri dispatchi
arena_watcher	health checky, zber patchov, detekcia kolízií	arena_health_check, arena_collect_patches, audit_db_integrity_tool, reindex_knowledge_tool	decision_type="collision"
github_manager	git/PR workflow, schvaľovacie brány	git_push_origin_main, gh_pr_merge, deploy_to_production, opl_prescription_signoff, gh_pr_create, gh_pr_diff, run_sprint_eval_suite_tool	compliance decision logs
qwen_implementer	implementácia kódu (Qwen Coder)	run_repo_command, check_i18n_symmetry_tool, check_vanilla_schema_tool	lessons via team

* = HITL/Approval brána.

Tím (Team): learning=learning_machine (všetkých 5 store-ov), memory_manager + enable_agentic_memory=True, session_summary_manager + enable_session_summaries=True, knowledge + enable_agentic_knowledge_filters=True, post_hooks=[collect_run_metrics, uikit_judge, report_judge], store_member_responses=True (perzistencia member Responses kvôli metrikám členov).

6. Compliance rámec — slovenská veterinárna legislatíva
Požiadavka zákona	Zdroj	Mechanizmus v systéme
Ošetrovateľská/zdravotná dokumentácia — nemeniteľnosť záznamov	Zákon 39/2007 Z. z.	DecisionLogStore insert-only + update_outcome (len výsledok); WAL SQLite bez UPDATE endpointu na agno_learnings
Predpis veterinárneho lieku — viazaný na lekára	Zákon 39/2007 Z. z.	rol veterinarian v OpenVPMUserProfile; nurse bez predpisovacích nástrojov; každý predpis = decision_type="compliance", tag zakon-39-2007
OPL predpis — manuálny (vlastnoručný) podpis lekára	Zákon 139/1998 Z. z.	opl_prescription_signoff (ApprovalType.audit + requires_confirmation) eviduje manuálny podpis; elektronický podpis je zakázaný; seed learning dec_seed_opl_manual_signature v každom promptovom kontexte
Evidencia OPL (kniha evidencie, zodpovedná osoba)	Zákon 139/1998 Z. z.	entity_memory zakazuje citlivé OPL skladové dáta; procesné kroky = audit approvals (agno_approvals.resolved_by) + compliance decision logs
Auditná dohľadateľnosť „kto, kedy, prečo"	obe zákony	DecisionLog (prečo) + agno_approvals (kto schválil, resolved_by/resolved_at) + agno_runs (čo sa stalo) + /learnings REST

Pravidlo (vynútené inštrukciami aj nástrojmi): automatizácia smie pripraviť podklady k OPL predpisu a auditne zaznamenať proces; podpis vykoná vždy veterinárny lekár manuálne a systém to len potvrdí (requires_confirmation). Žiadny tok nesmie ApprovalType.audit obísť.

7. Perzistencia — SQLite (Phase 2 invariance)
Pravidlo	Nastavenie	Dôvod
Journal mód	PRAGMA journal_mode=WAL	paralelné čítania (API) počas zápisu (scheduler)
Lock timeout	PRAGMA busy_timeout=30000 + connect_args.timeout=30s	žiadny okamžitý database is locked
Cudzie kľúče	PRAGMA foreign_keys=ON	integrita vzťahov
Zapisovanie	PRAGMA synchronous=NORMAL	bezpečné pri WAL, rýchle commity
Aplikácia	@event.listens_for(engine, "connect")	každé spojenie z poolu (aj reconnect)

Lazy creation. Agno vytvára tabuľky pri prvom zápise (table_exists() na overenie) — pri Phase 2 DB už tabuľky existujú; blueprint mapuje TABLES na existujúce mená (agno_sessions, agno_runs, agno_memories, agno_metrics, agno_eval_runs, agno_knowledge, agno_learnings, agno_schedules, agno_schedule_runs, agno_approvals, agno_traces, agno_spans).

8. Testovací plán a akceptačné kritériá sprintu
8.1 Vykonané smoke testy (blueprint, agno 3.0.11, Python 3.13)
#	Test	Výsledok
1	py_compile + import modulu (konštrukcia Team + AgentOS + get_app())	✅
2	LearningMachine — 5 store-ov + get_tools() = 9 nástrojov	✅
3	Seed: 2 boot learnings (idempotentné 2→0) + profil Marek (lead_architect, sk, immediate)	✅
4	record_sprint_learnings(PASSED) — 2× dec_* + entity event + link sprint-5 implements prescriptions; guard pre neplatný status	✅
5	recall_relevant_learnings — obe seed lessons v injekčnom bloku	✅
6	I18nLeafSymmetryEval — symetria PASS; asymetria FAIL s en-only=1, sk-only=1	✅
7	VanillaSchemaGuardEval — detekcia db/schema/vanilla/seed.sql	✅
8	run_sprint_eval_suite — brána pred merge	✅
9	estimate_cost (gpt-5.2, 1M/0.5M → $6.25)	✅
10	4× requires_confirmation=True (approvals metadata)	✅
11	seed_schedules() — */5 * * * * + 0 3 * * * Europe/Bratislava, idempotentné	✅
12	AgentOS OpenAPI — 89 ciest vrátane /schedules, /approvals, /metrics, /learnings, /eval-runs	✅
13	agno_approvals lifecycle create→resolve (pending=1, resolved_by=marek@openvpm.sk)	✅
14	SQLite: journal_mode=wal, busy_timeout=30000, integrity_check=ok	✅
8.2 Akceptačné kritériá sprintu (Definition of Done)
 pipeline_team_os.py beží v CI (importný smoke + testy vyššie).
 Sprint retrospektíva reálne ukladá lessons do agno_learnings (viditeľné cez GET /learnings).
 git push origin main / gh pr merge / deploy sú bez POST /approvals/{id}/resolve nemožné.
 Nočný audit 3 noci po sebe: i18n symetria PASS, integrity_check=ok, knowledge reindex bez chyby.
 Eval Suite PASSED ako podmienka merge (preukázané na demo PR).
 OPL scenár: opl_prescription_signoff vyžaduje potvrdenie a zanechá compliance decision + audit approval.
9. Rollout / migrácia
Deň 0 — merge blueprintu; env premenné; pip install -r z § 4.2; spustiť python .agents/agno/pipeline_team_os.py (lifeshaw oseje learnings, profil, schedulery).
Deň 1 — reindex_repo_knowledge(force=True) (prvá plná indexácia AGENTS.md/UIKIT.md/zákonov); overiť GET /schedules a GET /learnings.
Deň 2–3 — pilotný sprint (napr. sprint-5/prescriptions) s manuálnym approverom (Marek); retrospektíva → lessons.
Deň 4+ — plná prevádzka; týždenný review GET /metrics (náklady na sprint) a GET /eval-runs (kvalita).

Rollback. Blueprint je jediný modul; rollback = nasadiť predchádzajúcu verziu pipeline_team_os.py. agno_learnings/agno_approvals sú append-only — žiadna migrácia späť netreba; schedulery sa deaktivujú POST /schedules/{id}/disable.

10. Riziká a mitigácie
Riziko	Dopad	Mitigácia
SQLite write-contention pod náporom (API + scheduler + audit)	database is locked	WAL + busy_timeout=30s (ADR-10); náhradné riešenie ADR-13 (Postgres)
Hluk v DecisionLogoch (AGENTIC vs ALWAYS)	zahltenie kontextu	AGENTIC pre decision log; max_updates_per_run=10; days=90 filter v recall
Zdieľaná AgentAsJudgeEval inštancia pri paralele	strata DB logov	factory pattern na judge-y (§ 3.10)
Model sa pokúsi obísť approval bránu	compliance incident	inštrukcie + nástroje bez programátorského ekvivalentu; deploy kill-switch; audit approval na OPL
LanceDB index drift (zmena UIKIT.md bez reindexu)	zlé odpovede	nočný audit force=True reindex + area filtre
Chýbajúci JWT kľúč v produkcii	otvorený OS	authorization=auto vyžaduje JWT inak service-account režim; deployment checklist
Zlyhanie cron úlohy	tichý dlh	max_retries + agno_schedule_runs história + GET /schedules/{id}/runs monitoring
Príloha A — REST plocha AgentOS (overená, 89 ciest)
Skupina	Endpointy	Použitie
Runs	POST /teams/openvpm_dev_team/runs, …/runs/{id}/continue, /agents/{id}/runs	spúšťanie + pokračovanie po approve
Schedules	GET/POST /schedules, PATCH/DELETE /schedules/{id}, `…/enable	disable
Approvals	GET /approvals, GET /approvals/count, POST /approvals/{id}/resolve, …/status	§ 3.11
Learnings	GET/POST /learnings, GET /learnings?learning_type=…, GET /learnings/users/{user_id}	§ 3.1–3.6 (audit CRUD nad agno_learnings)
Metrics	GET /metrics, POST /metrics/refresh	§ 3.9
Evals	GET/PATCH/DELETE /eval-runs, …/{eval_run_id}	§ 3.10
Sessions	GET /sessions, …/runs, fork/rename	história sprintov
Príloha B — Dátové toky retrospektívy a schvaľovania (sekvenčné diagramy)
text
RETROSPEKTÍVA SPRINTU                     SCHVAĽOVACÍ TOK (gh pr merge)
──────────────────────                    ─────────────────────────────
team run končí (PASSED|FAILED)            github_manager: gh_pr_merge(42)
  └► record_sprint_learnings                └► Eval Suite → FAILED? → STOP
       ├► DecisionLogStore.save × N               → PASSED pokračuje
       │    (agno_learnings, nemenné)         └► @approval → run PAUSED
       ├► EntityMemoryStore.remember_about        └► agno_approvals: pending
       └► link_entities(sprint ⇒ module)     Marek: GET /approvals
                                             Marek: POST /approvals/{id}/resolve
NEXT SPRINT                                     └► status=approved
  └► recall_relevant_learnings()           Marek/Studio: POST …/runs/{id}/continue
       └► "## Relevantné learnings"              └► gh pr merge → COMPLETED
          v system prompt tímu                        └► audit: resolved_by=Marek
Príloha C — Zdroje
Agno 3.0.11 dokumentácia: docs.agno.com — Learning Machines, Learning Stores (User Profile, User Memory, Session Context, Entity Memory, Learned Knowledge, Decision Log), Learning Modes, Memory (MemoryManager), Knowledge/LanceDB, Metrics (RunMetrics), AgentAsJudgeEval/BaseEval, Approvals, Scheduling, AgentOS reference, SqliteDb reference.
Interné: AGENTS.md, UIKIT.md, Phase 2 report (SQLite WAL), Zákon č. 39/2007 Z. z., Zákon č. 139/1998 Z. z. o OPL.

Stav: dokument pripravený na schválenie (Marek, Lead Architect). Po schválení nasleduje rollout podľa § 9.