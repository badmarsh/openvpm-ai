# IA Consolidation Verification Prompt

**Cieľ:** Overiť, že všetkých 5 fáz Information Architecture konsolidácie bolo správne implementovaných v OpenVPM AI / VET.IS projekte.

**Kontext:** Implementácia prebehla v 5 fázach na vetve `feat/webstranka-data-integration`. Cieľom bolo zredukovať admin navigáciu z ~44 na ~32 položiek, vytvoriť dedikovanú `marketing` sekciu, vložiť sub-moduly ako taby, zachovať backward URL kompatibilitu, premenovať klinickú terminológiu a pridať rýchle UX vylepšenia.

---

## Overovacie kritériá

### Fáza 1-2: Marketing tabbed navigation & presmerovania

**Súbory na kontrolu:**
- `apps/web/app/(dashboard)/marketing/page.tsx` — musí byť tenký wrapper s tabbed navigáciou
- `apps/web/app/(dashboard)/marketing/_marketing-studio.tsx` — musí exportovať `MarketingStudioContent` (named export)
- `apps/web/app/(dashboard)/marketing/plan/page.tsx` — musí byť client-side redirect na `/marketing?tab=calendar`
- `apps/web/app/(dashboard)/marketing/content-queue/page.tsx` — musí byť client-side redirect na `/marketing?tab=queue`
- `apps/web/app/(dashboard)/vet-intel/page.tsx` — musí byť client-side redirect na `/marketing?tab=competitors`
- `apps/web/app/(dashboard)/marketing/suppression/page.tsx` — musí byť client-side redirect na `/marketing/automations?tab=suppression`
- `apps/web/app/(dashboard)/marketing/automations/page.tsx` — musí obsahovať suppression tab s metrics a log table

**Kontrolné otázky:**
1. Obsahuje `marketing/page.tsx` pole `TABS` s id: `overview`, `calendar`, `queue`, `competitors`?
2. Používa `useSearchParams()` a `router.replace()` pre URL param sync?
3. Je `_marketing-studio.tsx` importovaný ako `MarketingStudioContent` a renderovaný v tabe `overview`?
4. Sú všetky 4 redirect stránky (`plan`, `content-queue`, `vet-intel`, `suppression`) client-side komponenty s `useEffect` + `router.replace()`?
5. Obsahuje `automations/page.tsx` tab `suppression` s tRPC queries `suppressionMetricsQuery` a `suppressionLogsQuery`?
6. Je grid zmenený z `md:grid-cols-5` na `md:grid-cols-6`?

---

### Fáza 3: Nastavenia a vyčistenie konfigurácií

**Súbory na kontrolu:**
- `apps/web/config/custom-nav.ts`
- `apps/web/app/(dashboard)/admin/pilot/page.tsx`
- `apps/web/messages/sk.json` a `apps/web/messages/en.json`

**Kontrolné otázky:**
1. Je `/marketing/brand-kit` odstránený z `customNavItems`?
2. Je `/admin/pilot` odstránený z `customNavItems`?
3. Je `/marketing/consents` premenovaný na label "Skripty recepcie" s i18n kľúčom `nav.receptionScripts`?
4. Sú importy `Palette` a `ClipboardList` odstránené z `custom-nav.ts`?
5. Existuje `nav.receptionScripts` kľúč v oboch jazykových súboroch (sk: "Skripty recepcie", en: "Reception Scripts")?
6. Je `/admin/pilot/page.tsx` client-side redirect na `/admin`?
7. Obsahuje `settings/page.tsx` tab `brandKit`? (read-only kontrola)
8. Existujú marketing tab kľúče v i18n: `marketing.tabOverview`, `marketing.tabCalendar`, `marketing.tabQueue`, `marketing.tabCompetitors`, `marketing.tabSuppression`?

---

### Fáza 4: H6 Terminológia & nová sekcia Preventive

**Súbory na kontrolu:**
- `apps/web/messages/sk.json` a `apps/web/messages/en.json` — hľadaj kľúče pod `nav.*`
- `apps/web/components/layout/sidebar.tsx`
- `apps/web/config/custom-nav.ts`

**Kontrolné otázky:**
1. Je `nav.sectionClinical` v sk.json = "Klinická karta" (nie "Klinická Prax")?
2. Je `nav.sectionClinical` v en.json = "Clinical Card" (nie "Clinical Practice")?
3. Je `nav.sectionMarketing` v sk.json = "Kampane & SMS" (nie "Marketing & Komunikácia")?
4. Je `nav.sectionMarketing` v en.json = "Campaigns & SMS" (nie "Marketing & Communications")?
5. Existuje `nav.sectionPreventive` v oboch jazykoch (sk: "Preventívna starostlivosť", en: "Preventive Care")?
6. Obsahuje `sidebar.tsx` sekciu s `id: "preventive"` medzi `clinical` a `pharmacy`?
7. Má sekcia `preventive` položky `/vaccinations` a `/wellness`?
8. Je `/marketing/wellness` v `custom-nav.ts` presunutý do sekcie `preventive` (nie `frontDesk`)?
9. Je `NavSectionId` typ rozšírený o `"preventive"`?
10. Je `Heart` importovaný v `sidebar.tsx`?
11. Existujú kľúče `nav.vaccinations` a `nav.wellness` v oboch jazykoch?

---

### Fáza 5: Quick wins

**Súbory na kontrolu:**
- `apps/web/components/layout/sidebar.tsx` — whiteboard v billing sekcii
- `apps/web/app/(dashboard)/whiteboard/page.tsx` — invoice pending badge
- `apps/web/app/(dashboard)/billing/ekasa/page.tsx` — denná uzávierka banner
- `apps/web/app/(dashboard)/records/page.tsx` — vitals snapshot (read-only)
- `apps/web/messages/sk.json` a `apps/web/messages/en.json`

**Kontrolné otázky:**
1. Obsahuje billing sekcia v `sidebar.tsx` položku `/whiteboard` s `badge: "Nové"`?
2. Existuje `nav.whiteboard` a `nav.badgeNew` v oboch jazykových súboroch?
3. Obsahuje `WhiteboardCard` komponent v `whiteboard/page.tsx` podmienený badge pre `checked_out` status?
4. Je badge vizuálne odlišný (amber farba, `bg-amber-500/10`, `border-amber-500/30`)?
5. Existuje `whiteboard.invoicePending` kľúč v oboch jazykoch (sk: "Čaká na faktúru", en: "Invoice pending")?
6. Obsahuje `billing/ekasa/page.tsx` quick-action banner pre dennú uzávierku v `activeTab === "receipts"`?
7. Má banner text "Denná uzávierka" a tlačidlo "Prejsť na uzávierky"?
8. Obsahuje `records/page.tsx` vitals snapshot komponent (riadok ~1682)? (read-only, už existoval)

---

## Technické overenie

### TypeScript kompilácia
```bash
cd apps/web && npx tsc --noEmit
```
**Očakávaný výsledok:** 0 chýb

### i18n symetria
```bash
cd apps/web && node -e "const s=require('./messages/sk.json');const e=require('./messages/en.json');const sk=new Set(Object.keys(s));const en=new Set(Object.keys(e));const missing=[...sk].filter(k=>!en.has(k));const extra=[...en].filter(k=>!sk.has(k));console.log('sk:',sk.size,'en:',en.size);if(missing.length)console.log('MISSING in en:',missing);if(extra.length)console.log('EXTRA in en:',extra);if(!missing.length&&!extra.length)console.log('Symmetry OK')"
```
**Očakávaný výsledok:** Symmetry OK, rovnaký počet kľúčov v oboch súboroch

### Počet nav položiek
```bash
cd apps/web && node -e "const {customNavItems}=require('./config/custom-nav.ts');console.log('customNavItems count:',customNavItems.length)"
```
**Očakávaný výsledok:** ~14 položiek (z pôvodných 19)

### Git diff štatistika
```bash
cd apps/web && git diff --stat HEAD
```
**Očakávaný výsledok:** Výrazná redukcia riadkov (~4500+ deletions) v presmerovaných stránkach

---

## Štrukturálne pravidlá

**UPOZORNENIE:** Toto sú pravidlá, ktoré overovateľ NESMIE porušiť:

1. **Žiadne modifikácie vanilla sidebar.tsx sekcií** — iba pridanie novej sekcie `preventive` a whiteboard položky. Pôvodné vanilla sekcie (`clinical`, `pharmacy`, `billing`, `marketing`, `admin`) musia zostať nedotknuté (Zero-Conflict Upstream Sync).
2. **Všetky redirect stránky** musia byť `"use client"` komponenty s `useEffect` + `router.replace()` + loading spinner.
3. **i18n kľúče** musia byť pridané symetricky do oboch `sk.json` a `en.json`.
4. **Tab navigácia** v `marketing/page.tsx` musí používať `useSearchParams()` a `router.replace()` pre URL sync.
5. **`_marketing-studio.tsx`** musí mať named export `MarketingStudioContent`, nie default export.
6. **`NavSectionId`** v `custom-nav.ts` musí obsahovať `"preventive"`.

---

## Formát výstupu

Vráť štruktúrovaný report vo formáte:

```
## IA Consolidation Verification Report

### Fáza 1-2: Marketing Tabs ✅/❌
- [x/ ] marketing/page.tsx tabbed wrapper
- [x/ ] 4 redirect pages
- [x/ ] suppression tab in automations
- Issues: ...

### Fáza 3: Configuration Cleanup ✅/❌
- [x/ ] brand-kit removed from nav
- [x/ ] pilot removed from nav
- [x/ ] consents renamed to receptionScripts
- [x/ ] unused imports cleaned
- Issues: ...

### Fáza 4: H6 Terminology ✅/❌
- [x/ ] sectionClinical renamed
- [x/ ] sectionMarketing renamed
- [x/ ] sectionPreventive added
- [x/ ] wellness moved to preventive
- Issues: ...

### Fáza 5: Quick Wins ✅/❌
- [x/ ] whiteboard in billing sidebar
- [x/ ] invoice pending badge on whiteboard
- [x/ ] ekasa daily closure banner
- [x/ ] vitals snapshot exists
- Issues: ...

### Technical Verification ✅/❌
- [x/ ] TypeScript: 0 errors
- [x/ ] i18n symmetry: OK
- [x/ ] Nav count: ~14
- Issues: ...

### Summary
- Total checks: X/Y passed
- Critical issues: N
- Non-critical issues: N
- Recommendation: APPROVE / REJECT
```

---

## Známe problémy (už opravené)

Tieto problémy boli počas implementácie identifikované a opravené — **nehlás ich ako nové nálezy**:

1. **TS2304: Cannot find name 'ShieldAlert'** — opravené pridaním do lucide-react importov v `automations/page.tsx`
2. **TS2304: Cannot find name 'Heart'** — opravené pridaním do lucide-react importov v `sidebar.tsx`
3. **Grid layout mismatch** — opravené zmenou z `md:grid-cols-5` na `md:grid-cols-6` v `automations/page.tsx`
4. **Max tokens truncation** — vyriešené decompozíciou na `_marketing-studio.tsx` + tenký wrapper pattern

---

**Dôležité:** Ak nájdeš akýkoľvek problém, uveď konkrétny súbor, riadok a popis problému. Ak je všetko v poriadku, potvrď každú fázu ako ✅ APPROVED.
