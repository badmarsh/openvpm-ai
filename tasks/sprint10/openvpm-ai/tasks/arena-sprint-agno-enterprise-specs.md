# Arena Sprint: Agno Enterprise Architecture Specification & Implementation Blueprints

> **Mission for Arena Agent:**
> Pôsobíš ako Principal AI Platform Architect a Staff Systems Engineer pre enterprise veterinárny systém OpenVPM AI.
> Tvojou misiou je vypracovať kompletnú, hĺbkovú architektonickú špecifikáciu a implementačné blueprints pre zapojenie **12 pokročilých enterprise schopností frameworku Agno 3.0.11 (AgentOS)**:
> 1. Learning (LearningMachine, agno_learnings)
> 2. User Memories (UserMemoryStore)
> 3. User Profiles (UserProfileStore)
> 4. Entity Memories (EntityMemoryStore)
> 5. Session Context (SessionContextStore)
> 6. Decision Logs (DecisionLogStore)
> 7. Memory (MemoryManager, Agentic Memory)
> 8. Knowledge (LanceDb, sémantické vyhľadávanie)
> 9. Metrics (RunMetrics, telemetria a náklady)
> 10. Evaluation (BaseEval, agent_as_judge, kvalitatívne skóre)
> 11. Approvals (Human-in-the-Loop schvaľovacie brány pre rizikové akcie)
> 12. Scheduler (AgentOS scheduler, periodické cron úlohy)

---

## 1. Context & Motivation
OpenVPM AI prevádzkuje autonómny vývojový tím (`pipeline_team_os.py`) postavený na Agno AgentOS, ktorý riadi vývoj sprintov, integráciu s Arena.ai cez Chrome CDP a automatickú verifikáciu.
V súčasnosti tím využíva základné nástroje, čiastočný `MemoryManager` a vektorovú `Knowledge`.
Framework Agno 3.0.11 však natívne obsahuje plnohodnotnú kognitívnu vrstvu (`agno.learn.stores`), systém schvaľovania (`agno.approval`), evaluačný engine (`agno.eval`) a plánovač úloh (`AgentOS.scheduler`), pre ktoré už v databáze existujú tabuľky (`agno_learnings`, `agno_memories`, `agno_schedules`, `agno_approvals`, `agno_metrics`, `agno_eval_runs`).

Cieľom tohto sprintu je pripraviť vyčerpávajúcu technickú špecifikáciu (Architecture Decision Record + Implementation Specification), ktorá presne definuje:
- Dátové toky a schémy jednotlivých modulov.
- Spôsob zapojenia do tímu `openvpm_dev_team` a jednotlivých agentov (`prompt_manager`, `arena_dispatcher`, `arena_watcher`, `github_manager`, `qwen_implementer`).
- Dodržanie slovenskej veterinárnej legislatívy (Zákon 39/2007 Z. z., Zákon 139/1998 Z. z. o OPL) cez Decision Logs a Approvals.
- Konkrétny, otestovaný produkčný kód pre `pipeline_team_os.py`.

---

## 2. Rozsah analýzy a požiadavky na špecifikáciu

Pre KAŽDÚ z 12 vlastností vypracuj podrobnú kapitolu:

### A. Kognitívna vrstva (`agno.learn`)
1. **Learning (`LearningMachine`):**
   - Ako tím po skončení sprintu (PASSED alebo FAILED) extrahuje lessons learned a ukladá ich do `agno_learnings`.
   - Ako sa learnings filtrujú a injektujú do budúcich promptov (napr. „V sandboxe nepúšťaj celý monorepo type-check“, „OPL vyžaduje manuálny podpis“).
2. **User Memories (`UserMemoryStore`):**
   - Schéma a perzistencia preferencií vedúceho architekta (Marek) – jazyk, štýl reportov, okamžitý dispatch.
3. **User Profiles (`UserProfileStore`):**
   - Model rolí a klinického kontextu (Lead Architect vs Veterinárny lekár vs Sestra).
4. **Entity Memories (`EntityMemoryStore`):**
   - Mapovanie entít na moduly OpenVPM (`sprint-5`, `sprint-6`, `prescriptions`, `e-kasa`, `whiteboard`).
   - Sledovanie histórie rozhodnutí a zmien pre konkrétny modul naprieč reláciami.
5. **Session Context (`SessionContextStore`):**
   - Kompaktný medzikrokový stav bez zahltenia kontextového okna tokenmi.
6. **Decision Logs (`DecisionLogStore`):**
   - Nemenný audit trail prečo agent urobil rozhodnutie (výber modelu, schválenie/zamietnutie diffu, detekcia kolízie).

### B. Pamäť a Znalosti
7. **Memory (`MemoryManager`):**
   - Zosúladenie `UserMemory` a `SessionSummaryManager` s perzistentnou databázou (`pipeline_team.db`).
8. **Knowledge (`Knowledge` + LanceDB):**
   - Stratégia priebežného preindexovania repozitára (`AGENTS.md`, `UIKIT.md`, zákony) a sémantické vyhľadávanie v nástrojoch agentov.

### C. Prevádzková a riadiaca vrstva (AgentOS Enterprise)
9. **Metrics (`RunMetrics`, `agno_metrics`):**
   - Telemetrický model: spotreba tokenov, latencia modelov, chybovosť nástrojov, kalkulácia nákladov na sprint.
10. **Evaluation (`BaseEval`, `agent_as_judge`):**
    - Návrh evaluačnej sady (Eval Suite) pre kód vygenerovaný v sprintoch:
      - Adherence k UI Kitu (PageHeader, KpiGrid, DataTableFrame).
      - 100% leaf symetria kľúčov v slovníkoch `en.json` a `sk.json`.
      - Detekcia nepovolených zásahov do vanilkových schém.
11. **Approvals (`agno.approval`, `agno_approvals`):**
    - Presné vymedzenie akcií vyžadujúcich ľudský súhlas (Human-in-the-Loop): `git push origin main`, `gh pr merge`, nasadenie na produkciu.
    - Ako sa požiadavka vygeneruje a ako sa potvrdí cez Agno Studio / API.
12. **Scheduler (`AgentOS.scheduler`, `agno_schedules`):**
    - Definícia periodických úloh (Cron):
      - Každých 5 minút: Health check bežiacich Arena relácií a kontrola patchov.
      - Každú noc: Nočný audit i18n symetrie a integrity databázy.

---

## 3. Implementačný Blueprint
- Priprav ucelený, syntakticky bezchybný Python kód (drop-in) pre `pipeline_team_os.py`, ktorý:
  1. Inicializuje `LearningMachine` so všetkými 5 úložiskami (`UserProfileStore`, `UserMemoryStore`, `EntityMemoryStore`, `DecisionLogStore`, `SessionContextStore`).
  2. Zapája `scheduler=True` do `AgentOS`.
  3. Konfiguruje `ApprovalType` pre kritické nástroje.
  4. Dodržiava SQLite WAL režim a lock timeouty zavedené v Phase 2.

---

## 4. Výstupný formát (Deliverables)
1. Kompletná architektonická špecifikácia uložená do:
   `docs/architecture/AGNO-ENTERPRISE-SPECIFICATION.md`
2. Produkčný blueprint kód a zmeny pre:
   `.agents/agno/pipeline_team_os.py`
3. Vráť ucelený markdown dokument s reportom pripravený na schválenie.
