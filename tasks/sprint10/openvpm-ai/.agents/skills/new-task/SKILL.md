---
name: new-task
description: Interactive Golden Ticket task generator for OpenVPM AI. Triggers when the user asks to create, plan, or specify a new task or feature (e.g. "vytvor new-task ...", "new task", "priprav task", "naplanuj feature"). Formulates architectural requirements, proposes intelligent defaults based on OpenVPM AI guardrails, asks clarifying questions, and presents a complete Golden Ticket for human acceptance before coding starts.
---

# New Task Skill — Golden Ticket Generator for OpenVPM AI

Tento skill riadi proces špecifikácie novej úlohy podľa inžinierskeho konceptu **„The ticket is the quality ceiling“** a formátu **Golden Ticket** z `docs/agents/jira-operating-manual.md`.

---

## 1. Kedy sa tento skill aktivuje
Aktivuje sa vždy, keď používateľ zadá pokyn na vytvorenie novej úlohy, napríklad:
- `vytvor new-task <názov/popis>`
- `nová úloha: <popis>`
- `priprav task pre <funkcionalitu>`
- `chcem implementovať <funkcionalitu>`

---

## 2. Princípy a pravidlá pre OpenVPM AI
Každý vygenerovaný Golden Ticket MUSÍ automaticky rešpektovať architektonické pravidlá projektu (z `.agents/skills/openvpm-ai/SKILL.md`):

1. **Zero-Conflict Upstream Sync:**
   - Žiadne modifikácie pôvodných upstream tabuliek (`packages/db/schema/*.ts`).
   - Ak úloha vyžaduje nové tabuľky, navrhni dedikovanú schému `packages/db/schema/ext_<nazov>.ts`.
2. **Multitenant RLS:**
   - Všetky databázové dotazy v tRPC musia byť izolované tenantom (`withTenant` a `ctx.practiceId`).
3. **i18n Parita (100% symetria):**
   - Ak úloha pridáva texty do UI, musí sa doplniť EN (`messages/en.json`) aj SK (`messages/sk.json`).
4. **Klinická bezpečnosť a legislative gates:**
   - Ak sa úloha dotýka liekov, dávkovania, e-Kasy, hlásení KVEPIS alebo AI asistenta, vyžaduje sa potvrdenie lekárom (Clinician Confirmation Gate) a klasifikácia `risk:prod` / `risk:money` / `risk:security`.

---

## 3. Postup práce agenta (Interaktívny workflow)

Keď používateľ zadá požiadavku (napr. *„vytvor new-task integracia s google maps“*), agent postupuje nasledovne:

### Krok 1: Analýza kontextu a proaktívny návrh
Nečakaj pasívne s prázdnym formulárom. **Navrhni inteligentné predvolené hodnoty (smart defaults)**:
- **Prečo (Why):** Na čo táto funkcia slúži vo veterinárnom PIMS (napr. vyhľadávanie adresy majiteľa zvieraťa, výjazdová služba lekára, zobrazenie polohy ambulancie).
- **Scope (In / Out):** Čo patrí do prvej verzie a čo je rozumné vylúčiť (napr. In: autocomplete adresy a statická mapa; Out: reálny live GPS tracking áut).
- **Dotknuté súbory/moduly:** Konkrétne cesty v monorepe (`apps/web/`, `packages/db/`, `packages/api/`).
- **Riziková klasifikácia:** `risk:low` vs `risk:money` / `risk:security` / `risk:data`.

### Krok 2: Cielené doplňujúce otázky (max 2–3 otázky)
Ak existujú kľúčové alternatívy riešenia, spýtaj sa používateľa vecne a stručne s očíslovanými možnosťami. Napríklad:
> *„Pre Google Maps vidím dve hlavné využitia: (A) Našepkávač adries pri registrácii klienta a pacienta, (B) Mapa a navigácia na webe ambulancie / klientskom portáli. Chceš v tomto tasku riešiť obe, alebo len jedno z nich?“*

### Krok 3: Vygenerovanie kompletného Golden Ticketu
Zostav ticket v nasledujúcej štandardnej štruktúre:

```markdown
# TASK: <Výstižný názov úlohy>

## 1. Context / Why
<1–3 vety: aký problém veterinárnej praxe alebo klienta to rieši. Prečo to robíme.>

## 2. Scope
### In Scope (V rozsahu tejto úlohy)
- [x] Konkrétna funkcia 1
- [x] Konkrétna funkcia 2

### Out of Scope (Odložené na neskôr / mimo rozsahu)
- [ ] Čo v tomto tasku zámerne nerobíme, aby sme udržali WIP = 1

## 3. Acceptance Criteria (Definition of Done)
- [ ] Kritérium 1 (testovateľné a overiteľné)
- [ ] Kritérium 2
- [ ] Doplnené preklady EN aj SK (100% i18n parita)
- [ ] Žiadne lint/typecheck chyby (`pnpm turbo type-check`)

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` / `packages/api` / `packages/db`
- **Databáza:** Žiadna zmena / Nová schéma `packages/db/schema/ext_<modul>.ts`
- **RLS & Bezpečnosť:** `withTenant` / Role enforcement (`assertAgentRole`)
- **Environment / Secrets:** napr. `GOOGLE_MAPS_API_KEY` v `.env.example`
- **Riziko:** `risk:low` | `risk:prod` | `risk:money` | `risk:data`

## 5. Verification & Test Plan
- **Automatizované testy:** príkaz na spustenie (napr. `pnpm vitest run ...`)
- **Manuálne overenie:** presný postup, čo a kde v prehliadači skontrolovať (napr. port 3001, obrazovka `/clients/new`)

## 6. Definition of Ready
- [x] Acceptance criteria sú jednoznačné a testovateľné
- [x] Určené vstupné súbory a architektúra
- [x] Známe externé závislosti a API kľúče
```

### Krok 4: Predloženie na akceptáciu používateľovi
Na konci výstupu vyzvi používateľa na akceptáciu:
> *„Pozri si prosím tento návrh zadania. Ak s ním súhlasíš, napíš **akceptujem** (alebo **go**) a môžeme začať implementovať. Ak chceš niečo upraviť alebo doplniť, napíš mi pripomienky.“*

---

## 4. Ukladanie akceptovaných taskov
Keď používateľ zadanie akceptuje:
- Ulož schválený task do priečinka `tasks/<slug-nazov-tasku>.md` (alebo `artifacts/tasks/<slug-nazov-tasku>.md`).
- Nastav stav na `[STATUS: READY_FOR_IMPLEMENTATION]`.
- Následne môže agent začať čistú implementáciu podľa schválených acceptance criteria bez odbiehania od témy.
