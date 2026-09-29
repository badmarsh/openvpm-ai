---
name: prelozit
description: Deep translation pass for OpenVPM AI. Proactively scans, detects, and fixes hardcoded English strings in JSX/TSX components, enforces strict 100% symmetry between en.json and sk.json, localizes clinical date formats, and applies professional Slovak veterinary terminology (KVL, ŠVPS). Triggers on "preloz", "prelozit", "deep translation pass", "preloz komponent", "i18n pass", "skontroluj preklady", "oprav anglictinu".
---

# Preložiť Skill — Deep Translation Pass pre OpenVPM AI

Tento skill riadi **kompletný, hĺbkový prekladový audit a refaktoring (Deep Translation Pass)** v celom projekte **OpenVPM AI**. Zabezpečuje, že v používateľskom rozhraní nezostane ani jediný zabudnutý anglický text, dátumový formátovač alebo nepreložený dialóg.

---

## 1. Kedy sa tento skill aktivuje

Aktivuje sa vždy, keď používateľ požiada o preklad, kontrolu jazyka alebo odstránenie angličtiny:
- `prelož <komponent/stránku/trasu>` / `preloz to`
- `spusť deep translation pass` / `deep translation pass`
- `skontroluj preklady` / `i18n pass` / `i18n scan`
- `oprav angličtinu` / `prelož všetko čo je v angličtine`
- `prelož komponent <NázovKomponentu>`

---

## 2. Kľúčové architektonické pravidlá (Strict i18n Guardrails)

Pri každom preklade agent **MUSÍ bezpodmienečne** dodržiavať nasledujúce pravidlá:

1. **100% symetria kľúčov medzi slovníkmi:**
   - Každý nový kľúč pridaný do [`apps/web/messages/en.json`](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/messages/en.json) **MUSÍ** byť v tom istom kroku pridaný do [`apps/web/messages/sk.json`](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/messages/sk.json).
   - Využívať **výhradne vnorené JSON objekty** (`records: { soap: { title: "..." } }`), nikdy nie ploché bodkované reťazce na koreňovej úrovni (`"records.soap.title": "..."`).
2. **Nulový hardcoded text v JSX/TSX:**
   - Žiadny viditeľný reťazec nesmie byť zapísaný natvrdo v JSX tagu:
     ```tsx
     // ❌ ZAKÁZANÉ:
     <Button>Mark entered in error</Button>
     <label>Consent text</label>
     <input placeholder="Why is this record incorrect?" />

     // ✅ POVINNÉ:
     const { t } = useI18n();
     <Button>{t("records.correction.triggerLabel", "Mark entered in error")}</Button>
     <label>{t("records.consentSign.consentTextLabel", "Consent text")}</label>
     <input placeholder={t("records.correction.reasonPlaceholder", "Why is this record incorrect?")} />
     ```
   - Fallback text v `t("kluc", "Fallback")` musí byť **vždy v angličtine** (Rule 4).
3. **Autentická slovenská veterinárna terminológia (Zákon 39/2007 Z. z., KVL SR, ŠVPS SR):**
   - Preklad **nesmie** byť mechanický (Google Translate).
   - Príklady odbornej veterinárnej terminológie:
     - `Kniha ošetrení` (nie *„Kniha liečby“* alebo *„Treatment Book“*)
     - `Ochranná lehota` (nie *„Doba vysadenia“* alebo doslovné *„Withdrawal period“*)
     - `Očkovací preukaz` / `Pas spoločenského zvieraťa` (nie *„Vakcinačná karta“*)
     - `OPL` / `Omamné a psychotropné látky` (nie *„Kontrolované látky“*)
     - `Chybný zápis` / `Oprava záznamu` (nie *„Zadané v omyle“*)
     - `Konzílium` (nie *„Konzultácia“*)
     - `Hospitalizácia` / `Prijatie na kliniku`
     - `Uzamknuté a overené` (nie doslovné *„Zapečatené a verifikované“*)
4. **Dynamická lokalizácia dátumov:**
   - Nikdy nepoužívať `date.toLocaleDateString("en-US")` ani `date.toLocaleString("en-US")`.
   - Používať funkcie z [`apps/web/lib/records/clinical-dates.ts`](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/lib/records/clinical-dates.ts), ktoré automaticky rešpektujú aktívny jazyk z prehliadača (`document.documentElement.lang`).

---

## 3. Štandardný pracovný postup (Deep Translation Workflow)

Keď je spustený Deep Translation Pass, agent vykoná nasledujúce 4 fázy:

### Fáza 1: Detekcia nepreložených výrazov (Automated Scan)

1. Spustiť automatizovaný skener na cieľovú zložku alebo celú aplikáciu:
   ```bash
   # Cielený sken pre konkrétny modul:
   node apps/web/scripts/scan-hardcoded-i18n.js apps/web/components/<modul>

   # Alebo globálny sken s overením symetrie:
   node apps/web/scripts/scan-hardcoded-i18n.js --symmetry --summary
   ```
2. Skener okamžite identifikuje:
   - `raw-jsx-text`: Texty priamo v tagoch (`<Button>Text</Button>`, `<label>Text</label>`)
   - `prop-placeholder`, `prop-aria-label`, `prop-title`: Nepreložené atribúty formulárov
   - `hardcoded-en-us-date`: Dátumy formátované s `"en-US"`

---

### Fáza 2: Návrh štruktúry kľúčov a terminológie

1. Kľúče zatriediť do príslušnej domény:
   - `records`: SOAP poznámky, vakcíny, laboratórium, súhlasy (`consentSign`), opravy (`correction`)
   - `patients`: Karta pacienta, úkony, anamnéza, zlúčenie záznamov
   - `schedule`: Rozvrh, termíny, prepojenie s kalendárom (`calendarSubscribe`)
   - `billing`: Účtenky, faktúry, e-Kasa, položky dokladu
   - `inventory`: Sklad, lieky, šarže, exspirácie, naskladnenie
   - `settings`: Nastavenia praxe, personál, priestory
   - `common`: Všeobecné akcie (`close`, `tryAgain`, `done`, `cancel`, `updating`)
2. Vypracovať nezávislý slovenský preklad v profesionálnej veterinárnej terminológii.

---

### Fáza 3: Refaktoring kódu a aktualizácia slovníkov

1. **V komponente `.tsx`:**
   - Pridať `import { useI18n } from "@/lib/i18n";` (ak chýba).
   - Inicializovať `const { t } = useI18n();`.
   - Nahradiť raw texty volaním `t("domena.kluc", "English fallback")`.
2. **V slovníkoch:**
   - Pridať anglické texty do [`apps/web/messages/en.json`](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/messages/en.json).
   - Pridať slovenské texty do [`apps/web/messages/sk.json`](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/messages/sk.json).

---

### Fáza 4: Automatizované Quality Gates (Overenie)

Agent MUSÍ pred ukončením úlohy overiť všetky štyri kontroly:

1. **100% symetria slovníkov:**
   ```bash
   node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); function keys(o,p=''){return Object.keys(o).flatMap(k=>{const path=p?p+'.'+k:k;return(typeof o[k]==='object'&&o[k]!==null)?keys(o[k],path):[path];});} const kEn=keys(en),kSk=keys(sk),sEn=new Set(kEn),sSk=new Set(kSk); const missing=kEn.filter(k=>!sSk.has(k)),extra=kSk.filter(k=>!sEn.has(k)); if(missing.length||extra.length){console.error('i18n asymmetry detected!',{missing,extra});process.exit(1);}else{console.log('✓ i18n 100% symmetric ('+kEn.length+' keys)');}"
   ```
2. **Čistota komponentu cez i18n skener:**
   ```bash
   node apps/web/scripts/scan-hardcoded-i18n.js <upraveny-subor-alebo-zlozka>
   # Očakávaný výsledok: "✓ No hardcoded strings found in scanned files!"
   ```
3. **TypeScript typová kontrola:**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
4. **Súvisiace unit testy:**
   ```bash
   pnpm --filter @openpims/web test
   ```

---

## 4. Príklad z praxe (Referenčný prípad)

Keď používateľ nahlási nepreložené okno:
```
/patients/ ziskat podpis: Form Title Consent text
```
Postup agenta:
1. Spustí skener: `node apps/web/scripts/scan-hardcoded-i18n.js apps/web/components/records/consent-sign.tsx`
2. Zistí riadky L156 (`Form`), L187 (`Title`), L203 (`Consent text`).
3. Refaktoruje na `t("records.consentSign.formLabel", "Form")` atď.
4. Zosynchronizuje `en.json` a `sk.json` (`Formulár`, `Názov formulára`, `Text súhlasu`).
5. Overí symetriu (`6 826 keys`) a spustí `type-check`.
