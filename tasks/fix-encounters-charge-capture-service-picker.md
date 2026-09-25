# TASK: Fix Charge Capture ServicePicker Layout, Truncation & i18n in Encounters

## 1. Context / Why
Pri zaznamenávaní poplatkov v detaile vyšetrenia (`/encounters/[appointmentId]`) v sekcii „Zaznamenávanie poplatkov“ (Charge Capture) dochádza v rozbaľovacom zozname `ServicePicker` k závažnej degradácii používateľského rozhrania:
1. **Extrémne orezávanie názvov (Text Truncation):** Názvy položiek cenníka sú v jednoriadkovom flex kontajneri orezané na 1–4 písmená (`C...`, `D...`, `Ext...`, `Intr...`, `K...`), pretože tag kategórie (napr. `Služba · Vyšetrenie`), kód služby a cena zaberajú fixnú šírku (`shrink-0`) a pre samotný názov nezostáva v úzkom popoveri takmer žiadny priestor. Veterinár nevidí, akú službu vyberá.
2. **Nežiaduci horizontálny posuvník (Horizontal Scrollbar):** Zoznam výsledkov pretečie na šírku a v okne popoveru sa zobrazuje horizontálny posuvník.
3. **Chýbajúci preklad (i18n Fallback Bug):** Vyhľadávacie pole v popoveri zobrazuje anglický placeholder `"Type a service name..."` aj v slovenskom jazyku, pretože prekladové kľúče boli nesprávne vnorené pod `settings.billing.servicePicker` namiesto koreňového `billing.servicePicker`.

Oprava zabezpečí čistý, responzívny dvojriadkový layout položky (názov a cena hore, kód a kategória dolu), zamedzí horizontálnemu pretekaniu a opraví lokalizáciu.

## 2. Scope

### In Scope (V rozsahu tejto úlohy)
- [x] **Refaktoring vizuálnej štruktúry riadku v `ServicePicker` (`apps/web/components/billing/service-picker.tsx`):**
  - Dvojriadkový layout: Riadok 1 obsahuje plný názov položky (`service.name`, plná šírka s podporou `line-clamp-2` a `title` atribútom) a zarovnanú cenu (`tabular-nums font-semibold`).
  - Riadok 2 obsahuje kompaktné metadátové štítky (kód položky v mono tagu a názov kategórie v tlmenom texte).
- [x] **Eliminácia horizontálneho posuvníka:**
  - Pridanie `overflow-x-hidden` a optimalizácia šírky popoveru (`min-w-[320px] sm:min-w-[380px] max-w-[calc(100vw-2rem)]`).
- [x] **Oprava a symetria i18n slovníkov (`en.json` & `sk.json`):**
  - Sprístupnenie kľúčov pod `billing.servicePicker.*` pre EN aj SK (`typeServiceName`, `searchServicesAria`, `noMatch`, `placeholder`).
  - Preklad textu vyhľadávania do prirodzenej slovenčiny: „Zadajte názov služby alebo produktu...“.
- [x] **Overenie a testy:**
  - Zachovanie kompatibility s existujúcimi testami (`apps/web/lib/__tests__/service-picker-ui.test.ts` a `billing-ui.test.ts`).
  - Spustenie typechecku a vitestu.

### Out of Scope (Odložené na neskôr / mimo rozsahu)
- [ ] Zmeny v biznis logike pridávania položiek do faktúry v `encounters/[appointmentId]/page.tsx`.
- [ ] Zmeny v schéme databázy alebo tRPC mutáciách pre fakturáciu.

## 3. Acceptance Criteria (Definition of Done)
- [ ] Názvy služieb v rozbaľovacom zozname `ServicePicker` sú plne čitateľné, nezostávajú orezané na 1–3 znaky a majú dostatok priestoru.
- [ ] V popoveri `ServicePicker` sa nezobrazuje žiadny horizontálny scrollbar za žiadnych okolností.
- [ ] Vyhľadávací input v popoveri zobrazuje lokalizovaný placeholder podľa aktívneho jazyka (SK: „Zadajte názov služby alebo produktu...“, EN: „Type a service or product name...“).
- [ ] Zachovaná plná klávesnicová navigácia (ArrowUp, ArrowDown, Enter, Escape).
- [ ] 100% symetria kľúčov medzi `apps/web/messages/en.json` a `apps/web/messages/sk.json`.
- [ ] Všetky unit/UI testy pre `service-picker` a `billing` prechádzajú bez chýb.
- [ ] Čistý TypeScript typecheck bez chýb (`pnpm --filter @openpims/web type-check`).

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web`
- **Dotknuté súbory:**
  - `apps/web/components/billing/service-picker.tsx`
  - `apps/web/messages/en.json`
  - `apps/web/messages/sk.json`
- **Pravidlá architektúry:**
  - Žiadne modifikácie tabuliek v `packages/db`.
  - Striktné zachovanie i18n pravidiel — žiadne hardkódené texty v JSX.
  - Kompatibilita s upstream OpenVPM (generické riešenie použiteľné aj pre upstream backport).
- **Riziko:** `risk:low` (čisto UI/UX vylepšenie a oprava lokalizačných kľúčov).

## 5. Verification & Test Plan
- **Automatizované testy:**
  - `pnpm --filter @openpims/web exec vitest run lib/__tests__/service-picker-ui.test.ts`
  - `pnpm --filter @openpims/web exec vitest run lib/__tests__/billing-ui.test.ts`
  - `pnpm --filter @openpims/web type-check`
- **Manuálne overenie:**
  - Otvoriť detail vyšetrenia `/encounters/[appointmentId]`.
  - Kliknúť na výber služby v sekcii „Zaznamenávanie poplatkov“.
  - Overiť:
    1. Celé názvy služieb (napr. „Konzultácia a vyšetrenie“, „Doprava“, „Extrakcia zuba“) sú plne viditeľné a čitateľné.
    2. Ceny sú zarovnané vpravo na hornom riadku.
    3. Kód a kategória sú na spodnom riadku v decentnom štýle.
    4. Žiadny horizontálny posuvník.
    5. Placeholder v slovenskom jazyku je „Zadajte názov služby alebo produktu...“.

## 6. Definition of Ready
- [x] Problém jasne identifikovaný z dodaného screenshotu.
- [x] Príčiny identifikované v kóde (`service-picker.tsx` flex layout a chýbajúce i18n mapovanie).
- [x] Testovacie kritériá a overovací plán definované.
