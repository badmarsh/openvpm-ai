# TASK: Použiteľnosť jadra práce na tablete (F-X8-1)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie UX, A11Y · Úsilie **L** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §5.8, register F-X8-1

## 1. Context / Why
Najdôležitejšie obrazovky pre prácu v ordinácii — `encounters/[appointmentId]/page.tsx` (5 409 riadkov), `records/new-soap/[patientId]/page.tsx` (1 331 riadkov), `agent/voice/page.tsx` a `waitboard` — **neobsahujú ani jeden responzívny marker** (`sm:`, `md:`, `lg:`, `min-h-11`, `overflow-x-auto` sa v týchto súboroch nenachádzajú ani raz). Veterinár pracuje s tabletom na stole; editor SOAP je navyše postavený na `contentEditable`, čo je na dotyku najrizikovejšie UI v systéme.

## 2. Scope
### In Scope
- [x] Encounter a nový SOAP musia byť použiteľné na tablete na šírku (minimálne 1 280 × 800, dotyk): žiadny horizontálny skrol, dotykové ciele ≥ 44 px.
- [x] Hlasový vstup musí mať veľké a jednoznačné ovládanie (nahrať / zastaviť / zrušiť) — dnes je to najdôležitejšia interakcia pri pacientovi.
- [x] Overiť, že dialógy (ClinicalDiffConfirmModal, potvrdenie kontrolovaných látok) sú na dotyku ovládateľné bez hoveru.
- [x] Otestovať s klávesnicou pripojenou k tabletu (zameranie v contentEditable).
- [x] Zoznam obrazoviek a ich stavu doplniť do reportu ako uzavretie bodu U-03/U-04.

### Out of Scope
- [ ] Mobilná verzia pre telefón (iný rozsah).
- [ ] Redizajn vizuálneho štýlu; ide o prispôsobenie existujúceho.

## 3. Acceptance Criteria (Definition of Done)
- [ ] Manuálny tablet test (iPad landscapne) na 4 obrazovkách bez horizontálneho skrolu, s vyplneným checklistom v reporte.
- [ ] Žiadny text sa nesmie stratiť pri prepnutí orientácie počas písania.
- [ ] Nové/upravené texty v EN + SK.
- [ ] `pnpm --filter @openpims/web lint` a type-check zelené.

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI).
- **Riziko:** `risk:prod` (nesprávne upravený editor môže viesť k strate textu — treba autosave testy).
