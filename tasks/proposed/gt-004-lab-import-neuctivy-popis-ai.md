# TASK: Odstrániť klamlivé označenie „AI“ a „istoty“ v laboratórnom importe (F-07-1)
**[STATUS: PROPOSED]** · Priorita **P0** · Kategórie AI, SAFETY · Úsilie **S** · Vlastník: UI + API
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-07, register F-07-1

## 1. Context / Why
Import laboratórneho reportu (`lib/lab-import.ts`) je **deterministický heuristický parser** (regex), ale v kóde nesie číselné „istoty“ 0.65 / 0.72 / 0.84 / 0.94 (`lab-import.ts:81-89`) a v UI sa tvári ako „AI OCR“ zariadenie (`:121`, `:129`). Lekár tak vidí dôveryhodne vyzerajúce skóre pri hodnote prečítanej regexom — to je klinicky nebezpečné (a pri lab. hodnotách môže viesť k nesprávnemu rozhodnutiu).

## 2. Scope
### In Scope
- [x] Nahradiť číselné confidence kvalitatívnym stavom parsovania (napr. „prečítané jednoznačne“ / „vyžaduje kontrolu“) a **nikde neuvádzať percentá ani čísla**, ktoré vyzerajú ako pravdepodobnosť modelu.
- [x] Premenovať označenie zdroja z „AI OCR“ na „Automatické čítanie z reportu (bez AI)“ alebo ekvivalent v SK aj EN.
- [x] Ak sa hodnota nepodarí prečítať jednoznačne, nechať pole prázdne a vyžadovať ručné doplnenie (nikdy nedopĺňať „najpravdepodobnejšiu“ hodnotu).
- [x] Pri každom importe zobraziť jednu vetu vysvetľujúcu, že hodnoty sa iba prepisujú z dokumentu a **lekár ich musí overiť**.
- [x] Testy: parser nevracia číselné skóre; UI texty neobsahujú reťazec „AI OCR“; neistý riadok zostáva prázdny.

### Out of Scope
- [ ] Nasadenie skutočného OCR/AI modelu na reporty (samostatná úloha s vlastným posúdením PHI a residency).
- [ ] Zmena validácie hodnôt alebo referenčných rozsahov.

## 3. Acceptance Criteria (Definition of Done)
- [ ] `grep -rn "0\.65\|AI OCR" apps/web/lib/lab-import.ts apps/web/components` nevracia klamlivé označenia.
- [ ] Nové texty v `messages/en.json` aj `messages/sk.json` (100 % symetria — dnes 7 031 = 7 031 kľúčov).
- [ ] Testy `pnpm --filter @openpims/web test -- lab-import` zelené, s novým testom na „žiadne číselné skóre“.
- [ ] Správa „čo sa stalo“ pre používateľa je zrozumiteľná aj bez znalosti AI (SK).

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (`lib/lab-import.ts`, príslušné UI komponenty).
- **Bezpečnosť:** žiadny nový externý prenos dát.
- **Riziko:** `risk:prod`.
