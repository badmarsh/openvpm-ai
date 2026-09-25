# TASK: Prijatie AI návrhu po sekciách + viditeľné označenie AI textu (F-04-4)
**[STATUS: PROPOSED]** · Priorita **P1** · Kategórie UX, SAFETY · Úsilie **M** · Vlastník: UI
Audit: `docs/audit/2026-09-ai-ux-audit.md` §4 J-04, register F-04-4

## 1. Context / Why
Jedno kliknutie „Draft“ v `records/new-soap/[patientId]/page.tsx:1029-1045` prepíše **všetky štyri** sekcie SOAP naraz, bez označenia AI textu a bez možnosti prijať len jednu sekciu. Lekár, ktorý chce AI pomoc len pre `assessment`, musí prijať aj prepísaný `subjective`. Zároveň po vložení nie je v karte viditeľné, ktoré vety navrhol model.

## 2. Scope
### In Scope
- [x] AI návrh zobraziť po sekciách s možnosťou prijať/odmietnuť **každú zvlášť** (diff v duchu existujúceho `ClinicalDiffConfirmModal`, ktorý sa **nesmie oslabiť**, len sa použije aj tu).
- [x] Vizuálne označiť AI navrhnutý text (badge pri sekcii / podfarbenie), ktoré zostane viditeľné aj po uložení (napr. `data-source="ai"` na bloku).
- [x] Nikdy neprepísať text, ktorý už lekár napísal, bez explicitného potvrdenia.
- [x] Štítok „AI návrh“ musí zmiznúť v momente, keď lekár text upraví (aby označenie neklamalo).
- [x] Testy: odmietnutie jednej sekcie nezmení ostatné; označenie prežije uloženie konceptu.

### Out of Scope
- [ ] Zmena spôsobu generovania (prompt, model) — rieši GT-012/GT-016.
- [ ] Sledovanie pôvodu na úrovni vety (rieši GT-001).

## 3. Acceptance Criteria (Definition of Done)
- [ ] Manuálne overené na obrazovke nového SOAP: prijatie jednej sekcie nemení ostatné.
- [ ] Nové texty v EN + SK.
- [ ] `pnpm --filter @openpims/web test -- server/__tests__/ai-draft-safety server/__tests__/ai-clinical-finalization` zelené.
- [ ] `ClinicalDiffConfirmModal` a `lib/ai/clinician-confirmation.ts` **nezmenené** (git diff ich neobsahuje).

## 4. Technical Architecture & Constraints
- **Balíčky:** `apps/web` (UI + prípadná úprava schémy draft endpointu na per-sekciu).
- **Riziko:** `risk:prod`.
