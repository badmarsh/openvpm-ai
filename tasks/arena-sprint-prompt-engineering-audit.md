# Arena Sprint: Prompt Engineering, Golden Ticket Architecture & Sandbox Invariants Audit

> **Mission for Arena Agent:**
> Pôsobíš ako Principal Prompt Engineer & LLM Systems Architect pre vývojovú platformu OpenVPM AI.
> Tvojou misiou je zanalyzovať a zrefaktorovať generátory promptov v `.agents/agno/pipeline_tools.py` (`format_arena_sprint_prompt`, `create_and_dispatch_arena_task`, `design_system_prompt`, `evaluate_verification_and_repair`), eliminovať duplicity, optimalizovať XML tagy pre modely Claude 3.7 Sonnet / Arena Agent Mode, a pridať ochranu pred pamäťovými pádmi (Node OOM) v sandboxoch.
> Výsledkom bude čistý, úsporný a nepriestrelný formát Golden Ticketu overený novými unit testami v `.agents/agno/tests/test_prompt_templates.py`.

---

## 1. Context & Motivation (Prečo tento audit robíme)
OpenVPM AI využíva Arena.ai (Claude 3.7 Sonnet v Agent Mode) na autonómnu implementáciu sprintov.
Aktuálne šablóny promptov v `.agents/agno/pipeline_tools.py` trpia tromi chronickými neduhmi:
1. **Zdvojovanie obsahu (Prompt Bloat):** Keď `create_and_dispatch_arena_task` alebo `format_arena_sprint_prompt` načíta existujúci súbor `tasks/arena-sprint-X.md`, vloží ho do tela nového Golden Ticketu. Výsledkom je dvojitá hlavička `# GOLDEN TICKET`, dvojitý `# 1. Context / Why`, dvojitý `Scope In / Out` a dvojitý `Definition of Done`. To plytvá tokenmi a znižuje pozornosť modelu.
2. **Sandbox Memory Crashes (Node OOM):** Cloudové sandboxy v Arena.ai majú 2 GB až 4 GB RAM. Celoprojektový `pnpm --filter @openpims/web type-check` (`tsc --noEmit`) spotrebuje 2.2–2.8 GB RAM a v predvolenom Node prostredí padá na `Exit status 134 / Aborted (OOM)`. Prompt musí agenta explicitne inštruovať nastaviť `export NODE_OPTIONS="--max-old-space-size=3500"` a zamerať sa na overenie svojich súborov / testov, pretože celomonorepový type-check overuje hostiteľská CI pipeline.
3. **Neucelené XML tagy:** Tagy `<system_prompt>` a `<vystupny_format>` sú užitočné, ale mali by byť štruktúrované podľa moderných odporúčaní Anthropic (oddelenie rolí, kontextu, mantinelov, zmluvy o výstupe a jednorazového git diffu).
4. **Single-PR invariant:** Keď relácia už v prvom kroku vytvorila vetvu / PR, prompt pri oprave nesmie žiadať vytvorenie PR znova (Arena to v rovnakej relácii nedokáže), ale striktne unifikovaný `.patch`.

---

## 2. Scope & Target Files
### In Scope
- `.agents/agno/pipeline_tools.py`:
  - `format_arena_sprint_prompt(...)` – refaktoring na čistú deduplikáciu a štruktúru.
  - `create_and_dispatch_arena_task(...)` – odstránenie vnorených duplicitných hlavičiek, ak vstup už obsahuje štruktúrovaný Golden Ticket.
  - `evaluate_verification_and_repair(...)` – optimalizácia formátu opravných promptov, zhrnutie TS/lint chýb do 6000 znakov, prísny zákaz opätovného volania Create PR.
  - Nový helper `sanitize_golden_ticket_prompt(...)` alebo builder promptov.
- `.agents/agno/tests/test_prompt_templates.py`:
  - Nová sada unit testov overujúca:
    1. Žiadne duplicitné hlavičky `# GOLDEN TICKET` alebo `Context / Why` v generovaných promptoch.
    2. Prítomnosť správnych XML tagov a ich párovosť.
    3. Prítomnosť inštrukcie pre Node memory / sandbox (`NODE_OPTIONS` / targeted checks).
    4. Správne formátovanie repair promptov ako `.patch` pri existujúcom PR.
- Súhrnný report: `tasks/arena-sprint-prompt-engineering-audit-REPORT.md`.

### Out of Scope (Striktne nedotýkať sa)
- Žiadne úpravy vanilkových schém v `packages/db/schema/*.ts`.
- Žiadne úpravy aplikačného kódu Next.js (`apps/web/app/`).

---

## 3. Architektonické požiadavky na Golden Ticket formát
Navrhni a implementuj štruktúru promptu, ktorá:
1. **Začína striktným XML obalom:**
   ```xml
   <system_prompt>
   <role>...</role>
   <context>...</context>
   <scope in="..." out="..." />
   <safety_invariants>
     <!-- Zákon 39/2007 (Human-in-the-loop, draft status) -->
     <!-- Zákon 139/1998 (OPL, ZERO AI prefill) -->
     <!-- Sympathy gate, zero-conflict vanilla immutability -->
   </safety_invariants>
   <task_specification>...</task_specification>
   <sandbox_execution_rules>
     <!-- export NODE_OPTIONS="--max-old-space-size=3500" -->
     <!-- targeted tests first, avoid full monorepo tsc in limited containers -->
   </sandbox_execution_rules>
   <definition_of_done>...</definition_of_done>
   <output_format>
     <!-- Kompletný kód dotknutých súborov alebo čistý unifikovaný git diff -->
   </output_format>
   </system_prompt>
   ```
2. **Deduplikuje vstupné zadanie:** Ak `requirements` už obsahuje sekciu `# GOLDEN TICKET` alebo `## 1. Context`, builder extrahuje len špecifické požiadavky a nevytvára hierarchický miš-maš.
3. **Zachováva 100% spätnú kompatibilitu** so všetkými volaniami v Agno tíme (`pipeline_team_os.py`).

---

## 4. Definition of Done & Verification
- [ ] Všetky unit testy v `.agents/agno/tests/test_prompt_templates.py` prechádzajú na 100% (`pytest .agents/agno/tests/`).
- [ ] Všetky existujúce testy v `test_pipeline_tools.py` naďalej prechádzajú (0 regresií).
- [ ] Vygenerovaný patch je čistý a pripravený na aplikáciu.
- [ ] Report v `tasks/arena-sprint-prompt-engineering-audit-REPORT.md` zosumarizuje ušetrené tokeny, elimináciu duplicity a prínosy pre stabilitu behu v sandboxoch.

Vráť kompletný ucelený kód zmenených súborov alebo git patch pripravený na aplikáciu.
