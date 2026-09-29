# Skupina 5 — Lab & zobrazovanie (J16–J17)

> **Frekvencia:** T4 (podľa potreby, 6–20× denne v klinike s in-house diagnostikou). Ide o
> **rozhodovacie dáta**: lekár na nich stavia liečbu, a preto je tu najdrahšia chyba — tá, ktorú nikto nevidí.
> **Business Case:** [BC-5](#business-case-lab--zobrazovanie).

---

## J16 — Príjem, validácia a interpretácia laboratórnych výsledkov

### Persóna & Kontext

**P4 Martin** odoberie krv, vloží vzorku do IDEXX Catalyst / ProCyte, Fuji Dri-Chem alebo Mindray BC-Vet a za 8–12 minút drží v ruke výsledok. Ten musí skončiť (a) v karte pacienta, (b) v trende, (c) v rozhodnutí lekára.
**P2 Lucia** potrebuje vedieť, čo je mimo rozsah a ako sa to zmenilo od minula. **P1 Peter** potrebuje vidieť výsledok bez preklikávania troch obrazoviek.
**Reality check z kódu (a to najdôležitejšie):** `extensions.labImport.parsePdfOrImageReport` je dnes **heuristický parser bez AI**, ktorý binárne PDF číta ako UTF-8 text a vracia „confidence 0,65–0,94“ vypočítané **z počtu nájdených riadkov** (audit F-07-1). `labParser` mapping sa v kóde nikdy nečíta. `MODEL_CARDS.md` pritom deklaruje AI OCR. V klinickom potvrdzovacom modáli teda **dnes svieti vymyslené číslo istoty** — to je najvážnejší UX problém celej skupiny a musí sa riešiť pred pilotom.

### Trigger

- **Klinický:** lekár potrebuje krvný obraz alebo biochemiu pred rozhodnutím (pred operáciou, pri CKD, pri akútnom stavě).
- **Externý:** prichádza výsledok od Laboklin/Synlab/ŠVÚ (PDF/HL7) alebo ho prináša klient.
- **Systémový:** mimo-rozsahová hodnota spustí alert (J5) alebo označí pacienta pre follow-up (J15).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/lab-results` alebo klinickú kartu | Systém zobrazí nevyriešené výsledky (nové, nepotvrdené) a naposledy zobrazené | Ak existujú nepotvrdené výsledky > 24 h → systém ich zvýrazní (riziko, že si ich nikto nevšimol) |
| 2 | Import z analyzátora (ASTM/HL7/CSV) | `labImport` parsuje výsledky, priradí analyty k referenčným rozsahom (canine/feline) a zvýrazní odchýlky | Ak parsovanie zlyhá (nerozpoznané pole) → systém zobrazí konkrétne riadky a **nič neuloží naslepo** |
| 3 | Import PDF/obrázka z referenčného laboratória | Systém rozpozná, či je PDF textové alebo sken; pri skene **musí priznať**, že nemá textovú vrstvu | **Blokujúce pravidlo R-04:** dnes sa zobrazuje falošné „confidence 94 %“ — musí sa nahradiť pravdivým stavom (počet nájdených riadkov, upozornenie na 0 výsledkov) |
| 4 | Lekár skontroluje výsledky | Systém zobrazí hodnoty, referenčné rozsahy, **trend oproti predchádzajúcim 2–3 odberom** a vyznačí klinicky významné zmeny | Ak je hodnota kritická (napr. glukóza < 2,5 mmol/l) → systém okamžite upozorní, nečaká na ďalší krok |
| 5 | Lekár potvrdí/odmietne prevzatie do záznamu | `requiresVetApproval` cesta: potvrdenie uloží výsledky do karty; odmietnutie ich označí ako nepoužité s dôvodom | Ak lekár prevzal výsledky bez kontroly → systém potrebuje aspoň jeden klik „skontrolované“ (HITL stopa) |
| 6 | Výsledok vstúpi do rozhodnutia | AI/šablóna ponúkne formuláciu do SOAP (`objective`), alert do Clinical Guardianu, prípadne plán kontroly | Ak sa výsledok vzťahuje na inú liečbu (napr. NSAID a kreatinín) → prepojenie na J5 |
| 7 | Archivácia a komunikácia | PDF je v karte; klient má prístup cez portál (J27); pri požiadavke sa exportuje súhrn | Ak výsledok priniesol klient ako papier → evidenčné naskenovanie s pôvodom „externé“ |

### Alternatívne toky

1. **Zlyhanie OCR/skenu.** Systém **nesmie** vrátiť prázdny výsledok bez vysvetlenia (dnes: binárne PDF → UTF-8 → 0 výsledkov bez varovania). Musí povedať: „tento súbor nie je textové PDF; nahrajte CSV/HL7 alebo prepíšte hodnoty manuálne“ a ponúknuť manuálny formulár s predvyplnenými analytmi podľa laboratória.
2. **Výsledok patrí inému pacientovi.** PDF nesie mikročip alebo číslo žiadanky, ktoré nezodpovedá. Systém musí párovať podľa čipu/žiadanky a pri konflikte blokovať priradenie; nie „uložiť k najbližšiemu pacientovi“.
3. **Referenčné rozsahy nezodpovedajú druhu** (napr. mačka vs. pes, exot). Systém musí mať rozsahy podľa druhu a pri chýbajúcom druhu ukázať hodnoty **bez** vyhodnotenia (nikdy nesprávne „normálne“).
4. **Kritická hodnota mimo ordinačných hodín.** Systém musí mať definovanú eskaláciu (kto, ako a dokedy kontaktuje klienta) — inak je kritická hodnota len pekný červený text na obrazovke.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Odber a čakanie | napätie | Výsledok môže zmeniť plán dňa |
| Zobrazenie výsledku | sústredenie | 15 parametrov, hľadá sa jedna hodnota |
| Trendy | **istota a úľava** | „Vidím, že sa to zlepšuje“ |
| Falošná istota (confidence) | **strata dôvery** | „Prečo mi systém hovorí 94 %, keď nič nenašiel?“ |
| Kritická hodnota | tlak a zodpovednosť | Najvyššie klinické riziko |

### Kontextové prepojenia

- **Pred:** J3 (encounter rozhoduje o odberoch), J8 (odber u technika), J13 (pre-op lab).
- **Po:** J5 (lieky a kontraindikácie), J15 (kontrola chronika), J4 (história), J21 (pre-op a po-op), J27 (klient vidí výsledky).

### AI Touchpointy

- ✅ **Chceme:** reálny OCR pre PDF/skeny s **poctivou** mierou neistoty na úrovni poľa (nie globálne číslo); extrakcia trendov; AI sumarizácia „čo to znamená“ pre lekára (1–2 vety) a pre majiteľa (zrozumiteľne, s disclaimerom); rozpoznanie anomálií (napr. nekonzistentné jednotky, preklep v desatinnej čiarke, dátum mimo poradia).
- ⛔ **Nechceme:** AI, ktorá stanoví diagnózu alebo terapiu z výsledkov; AI, ktorá zatvorí (auto-confirm) výsledok bez lekára; AI, ktorá zobrazuje číslo istoty tam, kde istota neexistuje (F-07-1).
- **Human review bod:** prevzatie výsledku do karty je vždy ľudská akcia s podpisom (kto prevzal, kedy).

---

### Use Case: UC-116

**Názov:** Import, validácia a prevzatie laboratórneho výsledku do klinického záznamu
**Primárny aktér:** `technician`, `veterinarian` (prevzatie); `front_desk` pri nahratí PDF

**Predpoklady:**
- Existuje pacient s druhmi a referenčnými rozsahmi (canine/feline; pri exotoch môžu chýbať).
- Je dostupný zdroj výsledku (analyzátor, PDF/HL7, manuálny vstup).
- Používateľ má oprávnenie zápisu do lab. výsledkov (role podľa `lab-import` routera).

**Hlavný scenár:**
1. Používateľ nahrá alebo importuje výsledok.
2. Systém rozpozná formát a extrahuje analyt–hodnotu–jednotku, s priradením k pacientovi.
3. Systém priradí referenčné rozsahy a označí odchýlky; pri viacerých odchýlkach zobrazí súhrn.
4. Systém zobrazí pravdivý stav spracovania (textové PDF vs. sken, počet rozpoznaných riadkov).
5. Lekár skontroluje hodnoty a potvrdí prevzatie do záznamu.
6. Systém zapíše výsledok, aktualizuje trendy a vyhodnotí väzbu na liečbu (J5) a follow-up (J15).

**Alternatívne scenáre:**
- **A1 — Manuálny vstup:** pri nerozpoznanom formáte systém ponúkne formulár s analytmi typickými pre dané laboratórium/analyzátor.
- **A2 — Externé laboratórium s nesúladom pacienta:** systém blokuje priradenie a žiada ručné rozhodnutie s auditom.
- **A3 — Kritická hodnota:** systém vyžaduje eskaláciu podľa definovaného postupu (kontakt klienta s časovým limitom).
- **A4 — Čiastočný import:** systém uloží len úplné riadky a neúplné zobrazí na doplnenie; nikdy nevytvorí „prázdny výsledok“.

**Výnimočné scenáre:**
- **E1 — Binárne PDF/obrázok bez textovej vrstvy:** systém vráti jasné varovanie a **nezobrazí** confidence skóre; ponúkne manuálny vstup alebo OCR pipeline (až po implementácii).
- **E2 — Poškodený/nekompletný súbor:** systém vráti konkrétnu chybu, neuloží nič a zachová pôvodný súbor na opätovné nahratie v rámci session.
- **E3 — Duplicitný import toho istého výsledku:** systém rozpozná duplicitu (pacient + dátum + laboratórium) a nezdvojí trend.
- **E4 — Zlyhanie uloženia (DB):** žiadne „tiché“ prevzatie; používateľ vidí, že výsledok nebol uložený, a má možnosť zopakovať.

**Postconditions:**
- Výsledok je v karte pacienta s pôvodom (analyzátor/lab/manuálne), dátumom a prevzatím lekárom.
- Trendy sa aktualizovali a rizikové väzby (lieky, diagnózy) sú vyhodnotené.
- Neúplné alebo nerozpoznané časti sú viditeľné a nie sú skryté.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** klinická dokumentácia musí byť úplná a doložiteľná; výsledky sú jej súčasťou.
- **GDPR čl. 5/32:** zdravotné údaje patria k pacientovi; prístup len v rámci praxe a rolí.
- **Produktové (a etické):** zobrazená miera istoty musí mať reálny základ — **žiadne vymyslené confidence skóre** (R-04). Pri výsledkoch platí: radšej „potrebujem ľudskú kontrolu“ než falošná automatizácia.
- **Klinické:** kritické hodnoty majú eskaláciu, nie len farebné označenie.

**Dátové entity:** `lab_results` (W/R), `lab_analyzer_reports` (W/R), `lab_result_events` (W), `lab_result_replacements` (W), `external_lab_reports` (W), `external_lab_observations` (W), `patients` (R), `patient_weights` (R), `files` (W), `prescriptions` (R), `audit_log` (W).

**Integrácie:** IDEXX Catalyst/ProCyte, Fuji Dri-Chem, Mindray BC-Vet (ASTM/HL7/CSV), Laboklin/Synlab (HL7/PDF/IMAP v pláne v0.7), ŠVÚ, storage a AI (OCR/LLM až po zavedení poctivých mier).

---

## J17 — Zobrazovacie vyšetrenie (RTG, VHS) a AI nález

### Persóna & Kontext

**P1 Peter** potrebuje rýchlo vyhodnotiť hrudník: „je to srdce, alebo pľúca?“ Manuálne meranie VHS (vertebral heart score) zaberá 5–8 minút a je subjektívne. **P2 Lucia** chce oporu pri popise, nie náhradu úsudku.
**Kód:** `extensions.imaging.*` s `prepareConfirmation` → `confirmAnalysis` (`appendAiAuditEvent` pri potvrdení) → voliteľne `injectFindingsIntoSoap` (len do **draftu**, s prefixom „[AI Rádiológia … – návrh na overenie lekárom]“). Snímky sa ukladajú ako `ai_imaging_analyses` + súbory. AI volanie je bez `abortSignal`/timeout (audit) a pri chybe vracia surový upstream text — UX riziko.

### Trigger

- **Klinický:** pacient s dýchavičnosťou, ochorenie srdca, trauma, pre-op.
- **Systémový:** RTG je naplánované v rámci návštevy (work item); výsledok musí vstúpiť do záznamu.
- **Externý:** snímka z inej kliniky (druhý názor, referál).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/agent/imaging` alebo kartu pacienta | Systém overí feature `agent`, oprávnenie a dostupnosť AI; zobrazí posledné snímky pacienta | Ak AI nie je dostupná → systém ponúkne len uloženie snímky a manuálny popis |
| 2 | Nahrá snímku (alebo vyberie existujúcu z karty pacienta) | Systém validuje formát a veľkosť, uloží ju a zobrazí náhľad spolu s poslednou snímkou pacienta | Ak je snímka nekvalitná (artefakty, kolimácia) → systém upozorní a odporučí opakované nasnímanie |
| 3 | Spustí AI analýzu | Systém pošle snímku do modelu, zobrazí priebeh; pri dlhom behu nesmie UI zamrznúť (dnes chýba timeout) | Ak analýza presiahne limit → systém musí mať definovaný timeout a možnosť pokračovať bez AI |
| 4 | Lekár dostane návrh | Nález je zobrazený **ako návrh** s jasným označením AI, s upozornením na obmedzenia modelu (napr. „VHS odhad, nie diagnóza“) | Ak lekár nesúhlasí → môže návrh odmietnuť (nič sa nezapíše) alebo upraviť |
| 5 | Potvrdenie | `prepareConfirmation` → `ClinicalDiffConfirmModal` → `confirmAnalysis` s `appendAiAuditEvent` | Ak obálka expiruje → nová, žiadny tichý zápis |
| 6 | Prenos do SOAP | `injectFindingsIntoSoap` zapíše do `objective` **len do draftu** s AI prefixom | Ak je SOAP už finalizovaný → systém to odmietne a ponúkne dodatok |
| 7 | Archivácia a zdieľanie | Snímka zostáva v karte; klient ju môže vidieť v portáli (voliteľne); export pre referál | Ak snímka ide mimo kliniky → systém eviduje, čo bolo odoslané (GDPR stopy) |

### Alternatívne toky

1. **AI si „vymyslí“ popis (halucinácia).** Systém musí: (a) označiť text ako návrh, (b) zabrániť zápisu do finalizovaného záznamu (už je), (c) umožniť jednoduché odmietnutie a (d) v audit zapísať aj odmietnutie (aby bolo vidno, že lekár AI nepoužil). Bez bodu (d) sa nedá vyhodnotiť, či je AI prínosom.
2. **AI model nedostupný/vracia chybu s interným textom.** Dnes sa chyba vracia ako `INTERNAL_SERVER_ERROR` so surovým upstream textom. UI musí vrátiť používateľskú správu („analýza nie je dostupná, skúste neskôr / uložte snímku a popíšte manuálne“) a nikdy nezobraziť interné detaily.
3. **Snímka z inej kliniky (referál).** Systém musí evidovať pôvod snímky a nesmie ju použiť na trénovanie ani na marketingové účely (súhlas kliniky/klienta).
4. **DICOM PACS (Nemocnica tier).** Viaccestné ukladanie snímok a rozlíšenie „lokálne vs. cloud“ musí byť viditeľné; klinika musí vedieť, kde jej snímky sú (nadväznosť na R-07).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Nahratie snímky | rutina | 2–6× denne |
| Čakanie na AI | mierna netrpezlivosť | Lekár chce odpoveď, ale nie na úkor chyby |
| Čítanie návrhu | **zvedavosť, obozretnosť** | „Sedí to s tým, čo vidím?“ |
| Odmietnutie návrhu | frustrácia alebo úľava | Podľa kvality modelu |
| Zápis do SOAP | spokojnosť | Ušetrené minúty popisu |

### Kontextové prepojenia

- **Pred:** J3 (encounter), J16 (lab), J21 (pre-op).
- **Po:** J3 (objective), J10 (liečba), J15 (follow-up), J12 (closeout), J27 (zdieľanie s klientom).

### AI Touchpointy

- ✅ **Chceme:** VHS meranie s vysvetlením (referenčné body), detekcia najčastejších nálezov (kardiomegália, edém pľúc, pneumotorax, fraktúry) **ako podporný nález**, porovnanie s predchádzajúcou snímkou (progresia), generovanie textu pre referál.
- ⛔ **Nechceme:** AI, ktorá stanoví diagnózu; AI, ktorá zapíše nález do finalizovaného záznamu; AI, ktorá zobrazuje „istotu“ bez validovaných metrík (model cards musia obsahovať reálnu presnosť a limity); AI bez audit stopy.
- **Human review bod:** potvrdenie lekárom (existujúci `confirmAnalysis` + `appendAiAuditEvent`) — treba doplniť aj zápis odmietnutia a timeout/abort.

---

### Use Case: UC-117

**Názov:** Zobrazovacie vyšetrenie s AI podporou a zápis nálezu do záznamu
**Primárny aktér:** `veterinarian` (analýza a potvrdenie), `technician` (nahratie)

**Predpoklady:**
- Pacient existuje a má príslušný kontext (dôvod vyšetrenia).
- Feature `agent` je povolený a AI model pre imaging je nakonfigurovaný (alebo je k dispozícii manuálny režim).
- Snímka je v podporovanom formáte a kvalite.

**Hlavný scenár:**
1. Používateľ nahrá snímku a spustí analýzu.
2. Systém uloží snímku, spustí model a vráti nález ako návrh.
3. Lekár skontroluje návrh, upraví ho alebo odmietne.
4. Systém pri potvrdení zapíše AI audit udalosť a uloží nález.
5. Voliteľne sa nález prenesie do SOAP draftu s AI označením.
6. Snímka a nález sú dostupné v karte; export pre referál je možný.

**Alternatívne scenáre:**
- **A1 — Manuálny popis bez AI:** systém umožní uložiť snímku a napísať nález ručne (plnohodnotná cesta).
- **A2 — Odmietnutie AI nálezu:** systém zapíše odmietnutie do auditu a neuloží text do záznamu.
- **A3 — Porovnanie s predchádzajúcou snímkou:** systém zobrazí obe snímky a (ak je k dispozícii) rozdiely.
- **A4 — Referál inam:** systém vygeneruje export s popisom a snímkou, zaznamená rozsah zdieľaných dát.

**Výnimočné scenáre:**
- **E1 — Model nedostupný alebo timeout:** systém zobrazí používateľskú chybu, ponúkne manuálny popis a **zachová snímku**; nesmie stratiť nahratý súbor.
- **E2 — Snímka v nepodporovanom formáte:** systém vráti konkrétnu chybu a odporučí konverziu; neuloží poškodenú snímku.
- **E3 — SOAP už finalizovaný:** `injectFindingsIntoSoap` zlyhá s `PRECONDITION_FAILED` a ponúkne dodatok (nie prepis).
- **E4 — Súbežná analýza tej istej snímky dvakrát:** systém zabráni duplicitnému AI behu (idempotencia) a druhé volanie odmietne alebo vráti existujúci výsledok.

**Postconditions:**
- Snímka je uložená v karte s pôvodom a prístupovým auditom.
- Nález (AI alebo manuálny) je v zázname s jednoznačným označením pôvodu.
- AI beh (a jeho potvrdenie/odmietnutie) je v `ext_ai_audit_log`.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** dokumentácia vyšetrenia vrátane zobrazovacích metód.
- **GDPR čl. 9/28:** snímky sú zdravotné údaje; spracovanie AI modelom musí mať DPA a jasný región (R-07).
- **MDR/regulačné (pozor):** ak sa AI výstup prezentuje ako diagnostická pomôcka, môže ísť o medicínsky softvér; komunikačne musí zostať „podporný nástroj s ľudskou kontrolou“ a v `MODEL_CARDS.md` musia byť reálne limity.
- **Produktové:** žiadny AI text do finalizovaného záznamu; žiadne zobrazovanie neexistujúcich metrík istoty.

**Dátové entity:** `ai_imaging_analyses` (W/R), `files` (W), `patients` (R), `soap_notes` (W draft), `ext_clinician_confirmations` (W), `ext_ai_audit_log` (W), `audit_log` (W).

**Integrácie:** AI vision model (cez `feature_mappings`), DICOM/PACS (v roadmap v1.0), storage, tlač/PDF export, portál.

---

## Business Case: Lab & zobrazovanie

### Status Quo

**Bez integrovaného PIMS** má klinika tri svety: analyzátor (ktorý tlačí výsledok na papier alebo do vlastného softvéru), PDF od referenčného laboratória (ktoré príde e-mailom) a karta pacienta (papier/PIMS). Dôsledky:

- **Ručné prepisovanie výsledkov:** 5–8 minút na jeden report; pri 6–8 reportoch denne to je 30–60 minút denne technika.
- **Chýbajúce trendy:** lekár porovnáva papierové výsledky očami. Zmena kreatinínu o 20 % za 6 mesiacov sa pri tom ľahko prehliadne.
- **Falošná istota pri AI importe:** ak klinika používa systém, ktorý zobrazuje nepodložené confidence skóre, dôvera sa buduje na piesku (F-07-1) — a to je horšie než žiadna AI.
- **RTG snímky** sa ukladajú do priečinkov alebo na CD/USB, často sa stratia; manuálne meranie VHS zaberá 5–8 minút a je závislé od skúsenosti.
- **Referenčné laboratóriá:** výsledok príde e-mailom bez väzby na pacienta; pri dvoch pacientoch s podobným menom je zámena reálna.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Rýchlejší príjem a prepis výsledkov | 36 min/deň × 0,17 € × 252 | 1 542 € |
| Menej prepisových chýb (2 000 výsledkov/rok × 1,5 %) | 30 chýb → 6 klinicky relevantných; 1 zvrat navyše | 360 € |
| Automatické VHS a AI popis snímky | 9 min/deň × 0,30 € × 252 | 680 € |
| Digitálna archivácia snímok (menej CD a hľadania) | 300 snímok × 0,6 € + čas | 480 € |
| Rýchlejšie vyhodnotenie trendov u chronických pacientov | 8 min/deň × 0,30 € × 252 | 605 € |
| Rýchlejšia triage externých laboratórnych PDF (Laboklin/Synlab) | 80 dokumentov/mesiac × 4 min × 0,15 € | 576 € |
| Menej duplicitných odberov (lekár vidí, že test už bol) | 3 testy/mesiac × 45 € | 1 620 € |
| Menej opakovaných RTG kvôli strate/archivácii | 1,5 snímky/mesiac × 60 € | 1 080 € |
| Úspora na AI behoch pri správnom dávkovaní (iba relevantné snímky) | –– konzervatívne | 0 € |
| **Spolu (konzervatívne)** | | **6 943 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € (AI kľúče/možnosti extra) | 4 000 € | 3,3× | 110 dní |
| **Cloud Solo** | 588 € | 3 500 € (bez in-house analyzátorov) | 6,0× | 61 dní |
| **Cloud Klinika** | 1 428 € | 6 943 € | 4,9× | 75 dní |
| **Cloud Nemocnica** | 2 748 € (vrátane PACS) | 12 000 € (PACS, DICOM, viac vyšetrení) | 4,4× | 84 dní |

**Poznámka:** Lab a imaging **nesú ROI sami o sebe** — ich hodnota je v klinickej presnosti a v tom, že bez nich klinika nemôže plnohodnotne prejsť na OpenVPM (BC-5 je „enabler“ pre BC-1 a BC-7). V investičnom pitchi ich nepredávajte ako úsporu, ale ako **kvalitu rozhodovania**.

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Parsery pre SK/CZ realitu** (IDEXX, Fuji, Mindray, Laboklin, Synlab, ŠVÚ) s dôrazom na slovenský lab. ekosystém | Väčšina PIMS má „lab modul“ ako import CSV pre jeden alebo dva systémy |
| **AI governance aj pri imaging** (obálka, audit, len do draftu, viditeľný prefix) | Konkurencia pridáva AI rýchlo a bez stopy; pri snímkach je zodpovednosť najvyššia a práve tu je governance predajný argument pre kliniku, ktorá má právnu zodpovednosť |
| **Kritické hodnoty s eskaláciou** | Klinická bezpečnosť, nie len farbička |
| **Bez-falošná-istota princíp** | Po implementácii R-04 je to pozícia, ktorú možno obhájiť: „nikdy vám nepovieme, že vieme niečo, čo nevieme“ |

**Kde konkurencia vyhráva:** zrelosť integrácií s laboratóriami (niektoré PIMS majú priame live konektory), DICOM a väčšie inštalácie. OpenVPM musí v0.7 dodať Laboklin fetcher a scil Vet abc Plus, aby nezaostal v základnej hygiene.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Náš analyzátor je starý a má vlastný SW“ | Strach z nekompatibility | Import exportu (CSV/PDF) + manuálny formulár, ktorý je pri použití rýchlejší než prepis do papiera |
| „Neverím AI v popise snímok“ | Odmietnutie | Manuálna cesta je plnohodnotná; AI je voliteľná; audit zaznamená aj odmietnutie, takže sa dá dokázať kritický postoj |
| „Máme snímky na CD“ | Zvyk | Import priamo z CD/priečinka + náhľad v karte |
| „Lab výsledky prídu mailom“ | Chýbajúca integrácia | V0.7 IMAP fetcher s párovaním podľa čipu/žiadanky; do tej doby dôsledný drag&drop import |
| „Nechcem, aby AI videla naše snímky“ | Obava o dáta | Jasný panel „kde tečú dáta“ (R-07) a možnosť vypnúť AI úplne |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Čas od odberu po zobrazenie výsledku lekárovi | 10–25 min (papier) | ≤ 5 min | `lab_results` timestampy |
| Podiel výsledkov s trendom (2+ merania) u chronikov | < 20 % | ≥ 70 % | počet pacientov s 2+ záznamami toho istého analytu |
| Chybovosť prepisu výsledkov | 1–2 % | < 0,2 % | audit korektúr `lab_result_replacements` |
| Čas popisu RTG (VHS vrátane) | 5–8 min | ≤ 3 min | čas od nahratia po uloženie nálezu |
| Podiel AI návrhov prevzatých lekárom aspoň čiastočne | n/a | ≥ 40 % | `ai_imaging_analyses` + potvrdenia |
| Podiel AI návrhov odmietnutých (sledovať dôvod) | n/a | merané, nie cieľ | audit odmietnutí |
| Počet falošných „confidence“ zobrazení | **> 0 dnes (F-07-1)** | **0** | kontrola UI + testy |
