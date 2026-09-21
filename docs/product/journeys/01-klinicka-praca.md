# Skupina 1 — Klinická & pacientska práca (J1–J6)

> **Frekvencia:** T1–T3 (každé 2 minúty až niekoľkokrát denne). Toto je chrbtica produktu.
> Akákoľvek regresia tu znamená, že klinika prestane pracovať — priorita nad všetkým ostatným.
> **Business Case:** [BC-1](#business-case-klinická--pacientska-práca) na konci dokumentu.

---

## J1 — Hľadanie pacienta / majiteľa

### Persóna & Kontext

**Primárna: P3 Zuzana (front_desk).** Sedí pri telefóne, ktorý zvonií. Volajúca hovorí „volám kvôli Rekovi, je to ten labrador, čo bol minulý týždeň“.
Zuzana má **8 sekúnd** na to, aby vedela, koho má na linke, inak sa rozhovor rúca. V tom istom čase je v čakárni človek, ktorý chce zaplatiť, a v ordinácii lekár, ktorý sa pýta „kto je ďalší“.
**Sekundárna: P2 Lucia (veterinarian)** — medzi dvoma vyšetreniami potrebuje otvoriť kartu pacienta, ktorého vidí prvýkrát (prevzatý z pohotovosti), musí vedieť jeho váhu, alergie a posledné laboratórium za 5 sekúnd.
**Sekundárna: P4 Martin (technician)** — pri odbere hľadá pacienta podľa čísla čipu, lebo majiteľ nemá kartu.

**Motivácia:** nájsť *správneho* pacienta, nie *nejakého* pacienta. **Emočný stav:** tlak, mierna podráždenosť („to tu predsa musí byť“), pri veľa zhodách neistota (dva labradory menom Rex).

### Trigger

- **Externý:** telefónny hovor, príchod klienta bez karty, doručená faktúra/pošta s menom pacienta.
- **Interný:** lekár potrebuje históriu pred rozhodnutím; technik potrebuje kartu pre odber.
- **Systémový:** notifikácia o recall pripomienke nesie meno pacienta → klik vyžaduje otvorenie karty.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí univerzálne hľadanie (klávesová skratka / ikona lupy v hlavičke) alebo `/patients` | Zobrazí vstupné pole s placeholderom „Pacient, majiteľ, čip, telefón, faktúra…“; v pozadí sa načítajú „naposledy otvorené“ (tiered navigation podľa `feat(search)`, commit `3537c67`) | Ak je to rutinný prípad, používateľ zvolí „naposledy otvorené“ a preskočí na krok 5 |
| 2 | Začne písať „rex“ | Na 1–2 znaky sa zobrazia **sekundárne akcie** (vytvor nového pacienta, prejdi na rozvrh), až od 3 znakov sa spustí dopyt na `patients` + `clients` + `microchip_registrations` + `invoices.invoiceNumber` | Ak dopyt vráti 0 výsledkov → krok 3b |
| 3a | Číta výsledky | Zoradí podľa relevancie: presná zhoda mena + otvorená karta pacienta na vrchu; každý riadok nesie **majiteľa, druh/plemeno, vek, čip (posledné 4 znaky), stav (aktívny/zosnulý)** a **príznaky rizika**: alergia, ochranná lehota, kontrolované látky | Ak dva riadky vyzerajú rovnako → krok 4 |
| 3b | Zadá telefón `+421 903 …` alebo posledných 9 číslic | Vyhľadá v `clients.phone` vrátane normalizácie; pri viacerých číslach jedného klienta zobrazí **jedného klienta s viacerými kontaktmi**, nie duplicity | Ak telefón neexistuje → ponuka „vytvoriť nový klient“ (J6) s predvyplneným číslom |
| 3c | Zadá 15-miestny čip | Validuje ISO 11784/11785 formát, hľadá v `microchip_registrations`; pri náleze zobrazí banner „čip je registrovaný v CRSZ na iného majiteľa“ | **Konflikt vlastníctva** → eskaluje na krok 6 (lekár) |
| 4 | Vyberie správneho pacienta z 2–5 zhod | Zobrazí rozlišujúce atribúty (vek, váha, posledná návšteva) a tlačidlo „zobraziť históriu pred otvorením“ (inline náhľad posledných 3 záznamov) | Ak si nie je istá → inline náhľad; ak nevie → telefónne doptanie s onboardom („máte aj druhého labradora?“) |
| 5 | Otvorí kartu pacienta | Načíta `patients.getById` + posledné vitálne, alergie, aktívne preskripcie, otvorené reminder-y; karta sa otvorí ako plnohodnotná obrazovka alebo **bočný panel** bez opustenia aktuálnej stránky | Ak je pacient v inej karte otvorený inde → zámok s varovaním „Petra práve upravuje lekár“ |
| 6 | (Konflikt čipu) Lekár skontroluje `pet_passports` a `kvl_cr_passports` | Systém zobrazí posledného známeho vlastníka a dátum registrácie; ponúkne „založiť prevod vlastníctva“ s poznámkou do auditu | Ak sa majiteľ nedá vyriešiť → zakladá sa nový záznam s označením „čip registrovaný na X“ (nezlučuje sa automaticky) |

### Alternatívne toky

1. **Duplicitný pacient, dva rôzne záznamy.** Klient má 2 karty (Rex z 2021 a Rex z 2023). Systém na to upozorní pri otvorení druhej karty: „sú 2 pacienti s rovnakým menom a čipom“ → používateľ ide na `/patients/duplicates` a `patients.merge` (serializable transakcia, `patient_merge_events`). Po zlúčení musí systém **znovu preťažiť otvorené záložky** (inak lekár píše do zrušeného ID).
2. **Hľadanie v diakritike a preklepoch.** Klient volá „Rex“ ale systém má „Rexík“; majiteľ je „Ďurica“ ale recepcia píše „Durica“. Systém musí mať bezdiakritické a prefixové porovnanie (rovnaká technológia, ktorá dnes funguje v `pg_trgm`/ILIKE, ale normalizovaná na `unaccent`). Preklep na 1 znak nesmie vrátiť prázdno.
3. **Pacient zosnulý (sympathy).** Výsledky obsahujú pacienta so stavom `deceased`. Systém nesmie len tak otvoriť marketingové/recall akcie (sympathy gate `consent-gate.ts`), musí vizuálne označiť kartu a v hľadaní dať možnosť „skryť zosnulých“ (default: zobrazení, ale tíšene).
4. **Hľadanie z inej pobočky (multi-clinic, R-08).** Klient je z pobočky B. Dnešná verzia vracia záznamy len v kontexte aktívnej praxe/lokality — filozoficky správne (RLS izolácia), UX ale musí povedať „pacient existuje v pobočke X, nemáte oprávnenie“ namiesto prázdneho výsledku.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Pred hľadaním | napätie (zvoniaci telefón, čakajúci klient) | Súbeh 3 požiadaviek naraz |
| Počas písania | nádej → frustrácia, ak sa hľadá aj po 3 znakoch „nič“ | Pocit „systém ma zdržiava“ je najsilnejší zdroj odporu k PIMS |
| Pri zhodách | neistota, ak sú si výsledky podobné | Strach zapísať do zlej karty (klinické riziko) |
| Po otvorení | úľava, ak je na karte hneď vidno váhu/alergiu | Lekár nemusí klikať 4× |
| Pri zlúčení duplicít | hnev („zase dva Rexovia“) | Pocit, že chybu zdedil po predošlom systéme |

### Kontextové prepojenia

- **Pred:** J6 (nový klient/pacient), J9 (telefonát vyžadujúci hľadanie), J7 (klient volá o termín).
- **Po:** J2/J3 (diktovanie a SOAP), J4 (história), J11 (dopyty k faktúre), J14 (recall).
- **Priamo do seba:** každý journey v tomto dokumente začína hľadaním — ak je táto vrstva pomalá, spomalí všetko.

### AI Touchpointy

- ✅ **Chceme:** prirodzený jazyk („pes, ktorý mal tento rok alergiu na potravu“), fuzzy vyhľadanie v histórii textov SOAP (`records.searchPatientHistory`), zhrnutie histórie v 5 vetách pre lekára, ktorý pacienta vidí prvýkrát (AI summary), preklad ľudových názvov liekov na generické („na bolesť sme dávali Rimadyl“ → carprofen).
- ⛔ **Nechceme:** AI **rozhodujúca o identite pacienta**. Nikdy nesmie automaticky zlúčiť dve karty ani „domyslieť“, že ide o toho istého Rexa. Rovnako nesmie byť AI odpoveďou na otázku „je to ten istý pes?“. Identita = deterministické dáta + ľudské rozhodnutie.
- 🔒 **Bezpečnostná hranica:** výsledky hľadania nesú dáta, ktoré vznikli z verejných vstupov (`booking.book` je `publicProcedure`) — tieto polia sa **nesmú** dostať do promptu bez ohraničenia (otvorené riziko F-04-2 z auditu).

---

### Use Case: UC-101

**Názov:** Vyhľadanie pacienta alebo majiteľa a otvorenie klinickej karty
**Primárny aktér:** `front_desk`, `veterinarian`, `technician` (čítanie histórie aj `viewer` podľa `records.searchPatientHistory`)

**Predpoklady:**
- Používateľ má aktívnu session s `practiceId` (RLS `tenant_isolation` je zapnutá).
- Existuje aspoň jeden pacient alebo klient v praxi (inak prázdny stav s CTA „Vytvoriť prvého klienta“).
- Vyhľadávacia vrstva má indexy na `patients.name`, `patients.microchip`, `clients.phone`, `clients.email`.

**Hlavný scenár:**
1. Používateľ otvorí vyhľadávanie a zadá reťazec (≥ 3 znaky alebo telefón/čip).
2. Systém normalizuje vstup (diakritika, medzery, formát telefónu, formát čipu).
3. Systém vykoná paralelné dopyty nad pacientmi, klientmi, mikročipmi a faktúrami v rozsahu praxe.
4. Systém zoradí výsledky podľa relevancie (presná zhoda → prefix → fuzzy) a obohatí ich o rizikové príznaky.
5. Používateľ vyberie výsledok (alebo otvorí inline náhľad histórie).
6. Systém načíta kartu pacienta so súhrnom (váha, alergie, aktívne lieky, otvorené reminder-y) a zapíše prístup do `audit_log`.
7. Používateľ pokračuje v klinickom alebo administratívnom kroku (J2, J3, J4, J11).

**Alternatívne scenáre:**
- **A1 — Nulový výsledok:** systém ponúkne vytvorenie klienta/pacienta s predvyplneným vstupom (napojenie na J6) a bez modálneho bloku.
- **A2 — Viac zhod:** systém zobrazí rozlišujúce atribúty a inline náhľad; nikdy nezoradí „možno ten správny“ bez označenia dôvodu zhody.
- **A3 — Duplicitný pacient:** systém zobrazí banner s odkazom na zlúčenie (`patients.merge`) a označí, ktorý záznam má viac klinických dát.
- **A4 — Vyhľadávanie podľa čipu s cudzím vlastníkom:** systém zablokuje tichý zápis a vyžaduje vedomé rozhodnutie lekára.
- **A5 — Prístup mimo role na históriu:** systém vráti meno a kontakt, ale klinickú históriu skryje (napr. `viewer`).

**Výnimočné scenáre:**
- **E1 — Vyhľadávací backend neodpovedá (DB timeout / pg_trgm chýba):** systém sa nesmie tváriť, že nič neexistuje. Zobrazí „hľadanie nedostupné, skúste presné pole / použite zoznam pacientov“ a ponúkne fallback na abecedný index.
- **E2 — Nevalidný vstup (binárne znaky, 10 000 znakov):** systém vstup orezáva (limit ~64 znakov) a vracia `BAD_REQUEST` s jasným textom; nesmie spadnúť do full-table scanu.
- **E3 — Súbežná zmena pacienta (merge) počas otvorenej karty:** systému musí vrátiť `CONFLICT` pri ďalšom zápise a ponúknuť prechod na nový záznam (nie tichý zápis do zrušeného ID).

**Postconditions:**
- Používateľ má otvorenú klinickú kartu správneho pacienta v rozsahu svojej role.
- Prístup je zaznamenaný v `audit_log` (kto, kedy, ktorý pacient).
- Pri nulovom výsledku existuje zdokumentovaná cesta k vytvoreniu záznamu bez duplicity.

**Business pravidlá:**
- **GDPR (čl. 5, 32) + zákon 18/2018:** prístup k zdravotným údajom len v rozsahu oprávnenia; každé čítanie je auditovateľné, RLS nedovoľuje prekročiť prax.
- **Zákon 39/2007 Z. z.:** identifikácia zvieraťa je povinná pri ošetrení; čip má prednosť pri zvieratách podliehajúcich registrácii.
- **ISO 11784/11785:** validácia 15-miestneho čísla pred akýmkoľvek zápisom do `microchip_registrations`.
- **Vlastné pravidlo produktu:** žiadne automatické zlučovanie záznamov bez ľudského potvrdenia (audit trail `patient_merge_events`).

**Dátové entity:** `patients` (R), `clients` (R), `client_contacts` (R), `microchip_registrations` (R), `pet_passports` (R), `invoices` (R — číslo dokladu), `patient_allergies` (R), `soap_notes` (R), `vital_signs` (R), `audit_log` (W), `patient_merge_events` (W pri A3).

**Integrácie:** CRSZ / KVL SR (stav registrácie čipu — dnes len lokálne dáta, B2G nie je implementované), `duplicateShield` (interný), voliteľne e-mail/SMS kanály pri dopyte na identitu.

---

## J2 — Klinická karta a hlasové diktovanie (SOAP draft)

### Persóna & Kontext

**P1 Peter (veterinarian)** stojí pri stole v ordinácii, ruky má od rukavíc, medzi dvoma pacientmi má 90 sekúnd. Diktuje do mikrofónu počítača alebo do telefónu: „tridsaťdva kila, teplota tridsaťdeväť dva, sliznice bledé, palpácia bolestivá v epigastriu, dnes urobíme krvný obraz a biochemiu…“.
**P2 Lucia** diktuje plynulejšie, ale má ostražitosť voči AI: „ak mi to napíše dávku, ktorú som nepovedala, je to pre mňa koniec“.
**Kontext produktu:** jediný AI povrch v kóde, ktorý je **admin/vet only** (`voice.ts:46`) a má plnú governance bránu (`prepareConfirmation` → `ClinicalDiffConfirmModal` → `voice.saveAsSoapNote`, `ext_clinician_confirmations`, `ext_voice`).

### Trigger

- **Klinický:** lekár dokončil vyšetrenie a chce zapísať záznam bez písania.
- **Systémový:** pri otvorení encounteru je karta pacienta prázdna a existuje predchádzajúci draft (`voice_dictations`).
- **Externý:** technik doplnil vitálne, ktoré treba dostať do záznamu (handoff J8 → J2).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Klika „Diktovať / Scribe“ v karte pacienta alebo na `/agent/voice` | `agent.status` overí dostupnosť AI a kredit; zobrazí stav mikrofónu a voľbu jazyka SK/EN | Ak AI nie je dostupné (self-host bez kľúčov / vyčerpaný limit) → krok 2b: manuálny editor bez AI |
| 2 | Stlačí „Nahrávať“ a diktuje (20–120 s) | Zobrazí priebeh nahrávania, lokálny indikátor, čas; audio sa drží v pamäti, nie na disku prehliadača; pri strate siete sa zobrazí varovanie a nahrávanie sa **nesmie ticho prerušiť** | Ak používateľ zabudne vypnúť nahrávanie → auto-stop pri 5 minútach s potvrdením |
| 3 | Ukončí nahrávanie, odošle | `voice.uploadAndProcess` → STT → `voice.formatTextToSoap` rozdelí text do Subjective / Objective / Assessment / Plan; vracia draft so značkou, že ide o **návrh** | Ak STT vráti prázdny/podozrivo krátky text (< 20 znakov) → systém žiada nové nahratie namiesto tichého prázdneho draftu |
| 4 | Skontroluje draft v diff modáli | `prepareConfirmation` vydá 15-minútovú obálku v `ext_clinician_confirmations` viazanú na aktéra, prax, revíziu a hash draftu | Ak obálka expiruje (> 15 min) → používateľ musí potvrdiť znova na novom hash (nie tichý fallback) |
| 5 | Vyberie, čo prevziať / upraví text | Diff zobrazuje AI text vs. „Môj text“ po blokoch; pri **kontrolovaných látkach (Zákon 139/1998)** je prefill **vypnutý** — AI text sa u nich nezobrazuje ako návrh na prevzatie | Ak lekár upraví dávkovanie → systém si zapíše, že text bol editovaný (hash draft ≠ hash potvrdeného obsahu) |
| 6 | Potvrdí | `voice.saveAsSoapNote` v jednej transakcii spotrebuje obálku a zapíše SOAP v stave `draft` (alebo `clinician_edited_draft`) | Ak zlyhá audit zápis → **celá transakcia sa rollbackuje** (`_safety.ts`), text sa nestratí, používateľ dostane jasnú chybu a možnosť uložiť ako lokálny koncept |
| 7 | Pokračuje vo vitálnych / dávkovaní / predpise | Systém prepne na J5 (Clinical Guardian) a J10 (výdaj/predpis) s predvyplneným kontextom | Ak pacient nemá váhu → blokuje dávkovaciu kalkulačku a žiada váženie (nie odhad) |

### Alternatívne toky

1. **AI je nedostupná alebo limit vyčerpaný (R-01, R-07).** Systém **nesmie** blokovať klinickú prácu: prepne sa na manuálny rich-text editor s uloženým draftom, s viditeľným bannerom „AI nedostupné — pracujete manuálne“ a s garanciou, že nič z diktátu sa nestratilo (audio ostáva dostupné pre opätovné spracovanie).
2. **Lekár diktuje mimo rozsahu SOAP** (napr. „zajtra mi zavolajte o tretej, pripomeňte mi, že má dostať Bravecto“). Systém musí rozpoznať **nedokumentačný zámer** a ponúknuť vytvorenie úlohy/reminderu (`care_reminders`) namiesto zapísania do Plan. Nesprávne zatriedenie je pre lekára horšie než neúplný záznam.
3. **Diktuje technik, nie lekár.** `voice.*` je admin/vet only. Ak technik klikne na Scribe, systém musí povedať „diktovanie je dostupné lekárovi; vitálne a anamnézu zapíšte formulárom“ — nie skryť tlačidlo bez vysvetlenia (frustrácia P4).
4. **Audio obsahuje identifikovateľné údaje tretích osôb** (klient rozpráva o rodine). Systém musí mať politiku retencie audio záznamov: predvolene nezachovávať zvuk, alebo 30 dní a potom nekompromisne zmazať (`voice_dictations`, `docs/data-retention-policy.md`).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Pred diktovaním | zvedavosť alebo skepsa | „Naozaj mi to ušetrí čas, alebo budem opravovať text?“ |
| Počas diktovania | sústredenie, mierny diskomfort | Rozpráva pred strojom, kolegovia počúvajú |
| Po prepise | prekvapenie/radosť, ak je text použiteľný | Kvalita slovenčiny je tu všetko — jeden komolený termín zničí dôveru |
| V diff modáli | **kritický moment dôvery** | Lekár vidí, čo AI povedala vs. čo povedal on |
| Po uložení | úľava, ak nemusí prepisovať | „Toto je 6 minút, ktoré som dnes dostal späť“ |
| Pri hallucinácii | hnev a odmietnutie | Ak sa v zázname objaví liek alebo dávka, ktorú nepovedal, AI je „nebezpečná“ |

### Kontextové prepojenia

- **Pred:** J1 (hľadanie), J8 (check-in a vitálne od technika), J17 (RTG nález).
- **Po:** J3 (dokončenie a finalizácia SOAP), J5 (kontrola liekov), J10 (predpis), J11 (fakturácia z diktátu — `voice.createBillFromExtractedItems`), J12 (closeout).

### AI Touchpointy

- ✅ **Chceme:** STT so slovníkom 300+ veterinárnych termínov a generík; rozdelenie do SOAP; rozpoznanie čísel (váha, teplota, dávka) s **explicitným zvýraznením, že ide o AI-prepísané číslo**; rozpoznanie „nedokumentačného zámeru“ (úloha, objednávka, pripomienka); automatické doplnenie „encounter context“ z rozvrhu (5 s písania → použiteľný draft).
- ⛔ **Nechceme:** AI, ktorá doplní liek alebo dávku, ktorú lekár nepovedal (**zero-prefill pri kontrolovaných látkach** je už implementované a musí zostať); AI, ktorá sama zmení Assessment/Plan; AI, ktorá posiela audio do iného regiónu bez súhlasu kliniky (R-07).
- **Human review bod:** diff modál s povinným potvrdením; obálka je jednorazová a expiruje.
- **Otvorená medzera (R-03):** text z diktátu sa po finalizácii nezapíše ako AI provenance do `ext_ai_audit_log`. Pre kontrolu ŠVPS a pre právnu obhajobu je to dnes najvážnejšia medzera v dôkazovom reťazci.

---

### Use Case: UC-102

**Názov:** Hlasové diktovanie a vytvorenie SOAP konceptu s potvrdením lekára
**Primárny aktér:** `veterinarian` (a `admin`); čítanie draftu `technician`

**Predpoklady:**
- Používateľ má rolu `veterinarian` alebo `admin` (`voice.ts:46`) a feature `agent` je povolený (`requireFeature("agent")`).
- Pacient existuje a je priradený k aktívnej praxi; ideálne má zaznamenanú váhu (nie povinné pre draft, povinné pre dávkovanie).
- Je dostupný AI provider a kredit (hosted), alebo je k dispozícii manuálny fallback.

**Hlavný scenár:**
1. Lekár otvorí kartu pacienta a spustí Scribe.
2. Systém overí dostupnosť AI a práva; zobrazí UI nahrávania.
3. Lekár nadiktuje nález; systém vykoná STT a štruktúrovanie do SOAP.
4. Systém zobrazí diff (AI text vs. aktuálny koncept) a vydá potvrdzovaciu obálku s TTL 15 min.
5. Lekár upraví a potvrdí obsah.
6. Systém v jednej transakcii spotrebuje obálku, zapíše SOAP koncept s hashmi a stavom `draft` / `clinician_edited_draft`.
7. Systém zobrazí potvrdenie s možnosťou pokračovať na finalizáciu (J3) alebo predpis (J10).

**Alternatívne scenáre:**
- **A1 — AI nedostupné:** manuálny editor, draft sa uloží ako koncept bez AI kontextu, banner vysvetľuje prečo; audio sa dá preposlať na neskoršie spracovanie.
- **A2 — Časť textu nie je klinická (úloha/objednávka):** systém ponúkne vytvorenie `care_reminders` alebo internej úlohy (SMS/telefón) namiesto zápisu do Plan.
- **A3 — Lekár chce prevziať len časť:** systém umožní blokové prijatie jednotlivých SOAP sekcií.
- **A4 — Kontrolovaná látka v diktáte:** systém nezobrazí prefill názvu/dávky OPL a vyžaduje manuálne zadanie + svedka pri výdaji (`controlled_substance_log`).

**Výnimočné scenáre:**
- **E1 — Chyba STT providera / timeout:** systém nesmie uložiť prázdny záznam ani stratiť zvuk; vráti `INTERNAL_SERVER_ERROR` s textom „prepis sa nepodaril, skúste znova alebo píšte manuálne“ a zachová audio reláciu.
- **E2 — Expirácia potvrdzovacej obálky:** potvrdenie sa odmietne (`PRECONDITION_FAILED`) a UI vygeneruje novú obálku; žiadny tichý zápis.
- **E3 — Súbežná úprava draftu iným používateľom:** `expectedRevision` mismatch → `CONFLICT` s možnosťou zobraziť rozdiel.
- **E4 — Zlyhanie auditu (hash chain):** celá transakcia sa rollbackuje; text zostáva v UI a je možné ho uložiť ako lokálny koncept (bez tvrdenia, že je uložený).

**Postconditions:**
- Existuje SOAP koncept s viditeľným pôvodom (AI asistent, revízia, hashe v `ext_clinician_confirmations`).
- Potvrdenie lekára je spotrebované (jednorazové) a nedá sa replayovať.
- Pri kontrolovaných látkach neexistuje AI prefill.

**Business pravidlá:**
- **HITL kontrakt:** AI nikdy nezapisuje do zdravotného záznamu bez potvrdenia lekára (`docs/confirmation-protocol.md`, `docs/ai-finalization-operations.md`).
- **Zákon 139/1998 Z. z.** (omamné a psychotropné látky): zero-prefill, povinná evidencia, svedok pri znehodnotení.
- **GDPR čl. 9 + 28:** audio obsahuje zdravotné údaje → potreba DPA so sub-procesorom AI a jasnej retencie zvuku (R-07).
- **Nariadenie EÚ 2019/6:** pri liekoch pre potravinové zvieratá sa v zázname nesmie stratiť informácia o ochrannej lehote.

**Dátové entity:** `voice_dictations` (W), `ext_voice*` (W), `ext_clinician_confirmations` (W/R), `soap_notes` (W — koncept), `patients` (R), `vital_signs` (R kontext), `patient_weights` (R), `care_reminders` (W pri A2), `audit_log` (W), `ext_ai_audit_log` (**W — chýba pri tejto ceste, R-03**).

**Integrácie:** AI provider (STT + LLM, model podľa `ext_ai_settings` / `feature_mappings`), storage pre dočasné audio, PWA mikrofón (permission API).

---

## J3 — Nový SOAP z encounteru (manuálne / AI draft / finalizácia)

### Persóna & Kontext

**P1 Peter** dokončil vyšetrenie; teraz musí urobiť **právne platný záznam** — nie „poznámku“. Vie, že finalizovaný záznam je nemenný a že oprava ide len dodatkom (`soap_note_addenda`, dokument `clinical_record_corrections`).
**P2 Lucia** pracuje opačne: najprv otvorí `records/new-soap/[patientId]`, nechá AI draft („Draft with AI“, `agent.status` → `ai.draftSoapNote` s `mode` a `deepThinking`), potom prepisuje.
**P3 Zuzana** potrebuje vedieť, že záznam je hotový — inak pacient „visí“ na whiteboarde (J8) a faktúra sa nemôže vystaviť (J11).

### Trigger

- **Klinický:** encounter skončil, je potrebné uzavrieť záznam pred ďalším pacientom.
- **Interný:** whiteboard ukazuje pacienta v stave „v ordinácii“ → klik → encounter.
- **Systémový:** autosave draftu a pripomienka „nedokončený záznam z 14:20“ (musí existovať, inak záznamy zostávajú nedokončené do večera).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Klikne na termín na `/schedule` alebo na kartu na `/whiteboard` | Otvorí `/encounters/[appointmentId]` s kontextom (klient, pacient, dôvod návštevy z `booking.reason`, predchádzajúce vitálne) | Ak encounter už má finalizovaný SOAP → rovno read-only s možnosťou „dodatok“ |
| 2 | Klikne „Nový SOAP záznam“ | Otvorí `/records/new-soap/[patientId]`; načíta `records.getSoapDraft`; zobrazí šablóny podľa typu návštevy (`treatment_templates`, `visit_work_items`) | Ak existuje neuložený draft z iného zariadenia → varovanie o konflikte revízií |
| 3 | Vyberie šablónu alebo začne písať | Autosave každých ~10 s (`records.saveSoapDraft` s `expectedRevision`); indikátor `saved / saving / offline` | Ak je stav `offline` → lokálna queue a explicitné varovanie „neopúšťajte kartu, neuložené“ |
| 4 | (Voliteľne) „Draft with AI“ | `ai.draftSoapNote` naplní sekcie; vstupom je kontext pacienta a encounteru | Ak je `agent.status` nedostupný → tlačidlo skryté s vysvetlením, nie tichý error toast |
| 5 | Zapisuje vitálne a lieky | `vitals.recordVitalSigns` (admin/vet/tech) → pri zmene váhy sa prepočítajú dávky; `clinicalGuardian.checkMedications` beží priebežne | Ak je váha v rozptyle > 15 % od poslednej → systém sa opýta „prepísať alebo ide o inú váhu?“ |
| 6 | Potvrdí diagnostiku / problem list | Zapíše sa do `problem_list`, histórie; pri chronickom ochorení systém ponúkne follow-up (J15) | Ak problem už existuje → priradí k existujúcemu, nevytvorí duplicitu |
| 7 | Klikne „Finalizovať“ | `records.finalizeSoapNote` → validácia povinných polí, `FOR UPDATE` revízia, SHA-256 hash obsahu, nemennosť; stav `finalized` | Ak chýba povinné pole (napr. Assessment) → systém vysvetlí, čo konkrétne chýba, nie generické „invalid input“ |
| 8 | Odovzdá pacienta na recepciu | Whiteboard sa aktualizuje na „Čaká na faktúru“ (jantárový odznak podľa `docs/help/sk/billing-finance.md`); recepcia dostane signál | Ak je návšteva „no charge“ → closeout to musí dovoliť bez vystavenia faktúry (J12) |
| 9 | (Neskôr) nájde chybu v zázname | Systém umožní **len dodatok alebo opravný záznam** (`soap_note_addenda`, `soap_note_replacements`, `clinical_record_corrections`) s povinným dôvodom | Ak sa pokúsi editovať finalizovaný záznam → systém vysvetlí prečo nie (nie len „403“) |

### Alternatívne toky

1. **AI draft generovaný z „dôvodu návštevy“ od klienta.** Dôvod vyplnil klient vo verejnom booking formulári (`booking.book`, `publicProcedure`). Text je **cudzí vstup** a môže obsahovať prompt injection (audit F-04-2). Systém musí: (a) obaliť cudzí text boundary tagmi (ako `<db_record>` v agent runneri), (b) obmedziť dĺžku, (c) v UI označiť, že dôvod dodal klient. Bez toho je „Draft with AI“ útočná plocha.
2. **Diktát od lekára + doplnenie od technika.** Technik doplnil vitálne počas diktovania lekára; pri finalizácii sa obe zmeny stretnú. Systém musí zlúčiť **atribútovo** (vitálne pole vs. text SOAP), nie prepísať celý objekt. Konflikt na tom istom poli = `CONFLICT` s diffom.
3. **Záznam sa píše počas výpadku internetu.** Autosave zlyhá, `saveState === "offline"`; klinika beží ďalej. Po obnove sa draft synchronizuje s viditeľným potvrdením a s časovou pečiatkou pôvodu (dôležité: aby sa nezapisoval starý text po novšej verzii z iného zariadenia).
4. **Pacient odchádza bez záznamu (urgent, eutanázia, skratka).** Systém musí ponúknuť rýchly „minimálny záznam“ (konzultácia + odporúčanie) jedným formulárom, aby záznam nevznikol hypoteticky „potom“ a už nikdy. Právne: zákon 39/2007 vyžaduje záznam o ošetrení.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie encounteru | rutina, mierny odpor | „Zase písať“ |
| Počas písania | sústredenie | Rozptyľujú ho telefonáty, ale záznam musí byť presný |
| AI draft | nádej alebo podráždenie | „Toto je buď 5 minút, alebo 5 minút opráv“ |
| Finalizácia | **zodpovednosť a neistota** | Nemenný záznam = právny dokument |
| Po finalizácii | úľava a „ďalší“ | Najčastejší moment psychologickej odmeny v celom produkte |
| Pri chybe a dodatku | frustrácia a obava | „Bude to vyzerať, že som niečo zakryl?“ |

### Kontextové prepojenia

- **Pred:** J1, J4 (história), J5 (lieky), J8 (check-in), J17 (RTG nález).
- **Po:** J10 (predpis), J11 (faktúra), J12 (closeout), J15 (follow-up), J20 (hospitalizácia, ak pacient zostáva).

### AI Touchpointy

- ✅ **Chceme:** draft z kontextu (**`visitContext`** — 5 sekúnd písania lekára premení generický draft na použiteľný; najvyšší pomer hodnota/práca z auditu, F-04-3), zhrnutie predchádzajúcich 3 návštev, návrh kódov/diagnóz z textu pre lepšiu fakturáciu, kontrola úplnosti („chýba Assessment“).
- ⛔ **Nechceme:** AI, ktorá sama určí diagnózu, sama vyberie liek, sama nastaví cenu; AI komentujúca kvalitu lekára; AI generujúca text do finalizovaného záznamu bez potvrdenia.
- **Human review bod:** finalizácia = jediná brána, ktorou sa AI text dostane do právoplatného záznamu. **Musí pridať provenance záznam (R-03).**

---

### Use Case: UC-103

**Názov:** Vytvorenie, uloženie a finalizácia SOAP záznamu pre encounter
**Primárny aktér:** `veterinarian` (`admin`); technik dopĺňa vitálne

**Predpoklady:**
- Existuje `appointment` (alebo aspoň pacient a klient) a používateľ má právo zápisu do klinického záznamu.
- Pacient je priradený k aktívnej praxi; prax má nastavené šablóny pre daný typ návštevy.

**Hlavný scenár:**
1. Používateľ otvorí encounter a vytvorí nový SOAP záznam (alebo AI draft).
2. Systém načíta kontext (pacient, klient, história, vitálne, dôvod návštevy).
3. Používateľ doplní obsah; systém priebežne autosaveuje koncept s kontrolou revízie.
4. Systém priebežne vyhodnocuje lieky a riziká (`clinicalGuardian.checkMedications`) a zobrazuje alerty.
5. Používateľ klikne „Finalizovať“.
6. Systém validuje povinné polia, uzamkne revíziu, zapíše hash a stav `finalized`.
7. Systém informuje whiteboard a recepciu, že návšteva je klinicky ukončená.

**Alternatívne scenáre:**
- **A1 — AI draft z cudzieho vstupu:** AI draft je pripravený, ale obalený sanitizáciou; UI označuje, ktoré časti pochádzajú z klientského vstupu.
- **A2 — Offline:** koncept sa ukladá do lokálnej queue, po obnove synchronizuje s viditeľnou časovou pečiatkou.
- **A3 — No-charge návšteva:** finalizácia prebehne bez povinnosti fakturácie; closeout má variant „bez platby“ (`visit_closeouts.chargeDisposition = no_charge`).
- **A4 — Dvojité klinické role:** technik dopĺňa vitálne počas písania lekára; zmeny sa aplikujú na úrovni polí.

**Výnimočné scenáre:**
- **E1 — Revízny konflikt:** `expectedRevision` sa nezhoduje → `CONFLICT` + ponuka zobraziť diff a prevziať novšiu verziu. Žiadny tichý overwrite.
- **E2 — Zaseknutý draft (session expirovaná počas písania):** systém udrží text a po re-logyne ponúkne obnovu (`localStorage` + serverový draft), s upozornením, že ide o obnovenú verziu.
- **E3 — Zlyhanie DB transakcie pri finalizácii:** používateľ dostane presnú správu „záznam nebol finalizovaný“ + možnosť skopírovať text. Nikdy nesmie vidieť „uložené“ a pritom mať neuložené.
- **E4 — Pokus o editáciu finalizovaného záznamu:** systém vráti `PRECONDITION_FAILED` s odkazom na „Vytvoriť dodatok“ (povolenie: admin/vet).

**Postconditions:**
- Existuje finalizovaný SOAP záznam s hashom, revíziou a autorom; je nemenný a dostupný v histórii (J4).
- Whiteboard a recepcia vidia stav pacienta.
- Pri AI účasti existuje auditný záznam (dnes **chýba** — R-03) a potvrdenie lekára.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** vedenie záznamu o ošetrení, uchovávanie, dostupnosť pre kontrolu.
- **EÚ 2019/6:** záznam o podaní lieku vrátane ochrannej lehoty pri potravinových zvieratách.
- **GDPR čl. 5/32:** minimalizácia (nezapisovať zbytočné údaje o tretích osobách), integrita (hash chain).
- **Produktové:** finalizovaný záznam je read-only; oprava je vždy nový dokument (dodatok/opravný záznam) s dôvodom.

**Dátové entity:** `soap_notes` (W), `soap_note_addenda` (W), `soap_note_replacements` (W), `clinical_record_corrections` (W), `appointments` (R/W status), `treatment_templates` (R), `treatment_plan_items` (R/W), `problem_list` (W), `vital_signs` (W), `ext_clinical_guardian_alerts` (W), `visit_work_items` (R/W), `files` (R).

**Integrácie:** AI provider (draft), whiteboard stream (SSE), notifikačné kanály (SMS/e-mail pri follow-upe).

---

## J4 — Anamnéza, história a dokumenty pacienta

### Persóna & Kontext

**P2 Lucia** preberá pacienta s chronickým ochorením a potrebuje za 60 sekúnd pochopiť, čo sa dialo 6 mesiacov dozadu: vývoj kreatinínu, posledná antibiotická kúra, alergia, ochranná lehota, či bola podaná vakcína. **P1 Peter** sa vracia k pacientovi po roku a pýta sa „kedy sme mu naposledy robili krv a čo vyšlo“.
**P4 Martin** hľadá nahraté snímky a PDF od referenčného laboratória.

### Trigger

- **Klinické:** príjem pacienta s anamnézou; druhé čítanie pred operáciou; kontrola pred predpisom lieku.
- **Systémový:** alert Clinical Guardianu odkazuje na históriu („renálne zlyhanie v problem liste“).
- **Externé:** klient prichádza s dokumentáciou z inej kliniky (papier/PDF).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí kartu pacienta → záložka História | Zobrazí časovú os: návštevy, SOAP, operácie, hospitalizácie;predvolene posledných 12 mesiacov, s filtrom na telo systému | Ak je história prázdna (nový pacient) → CTA „nahrať dokumentáciu / import histórie“ |
| 2 | Prepne na Laboratórium | Zobrazí posledné výsledky (in-house analyzátory + externé labáky) s referenčnými rozsahmi a **trendovou líniou** (`lab_results`, `external_lab_observations`, `lab_result_events`) | Ak je výsledok mimo rozsahu → vizuálne označenie a väzba na SOAP záznam, v ktorom bol použitý |
| 3 | Prepne na Lieky a alergie | Zobrazí aktívne preskripcie, históriu výdajov, alergie, nežiaduce reakcie; pri potravinových zvieratách ochranné lehoty (`ext_withdrawal_periods`) | Ak chýba alergický status → systém to explicitne uvedie ako „nezistené“ (nie „žiadne“) |
| 4 | Otvorí Dokumenty | Zobrazí nahrané PDF/obrázky (`files`, `historical_documents`) s kategorizáciou (lab, röntgen, posudok, poistka) | Ak dokument nie je priradený → systém ponúkne priradenie k pacientovi (nie automatické) |
| 5 | (Voliteľne) nahrá externú dokumentáciu | Upload s validáciou typu a veľkosti; uloženie ako `file_storage_events` / `file_object_replicas`; AI môže navrhnúť zaradenie a sumarizáciu | Ak je dokument inej kliniky → označí sa pôvod (nie je to záznam OpenVPM) |
| 6 | (Voliteľne) zobrazí „Medical Record Summary“ | PDF/súborová zostava pre klienta alebo poisťovňu; importované záznamy sú označené „Imported“ | Ak je zostava pre poisťovňu → iná šablóna (PetExpert/Generali/Union, J11) |
| 7 | Odovzdá lekárovi (alebo si ju sám prečíta) | Systém zapíše, ktoré dáta boli zobrazené pred rozhodnutím (audit) | Ak sa pacient lieči aj inde → poznámka „duálna starostlivosť“ |

### Alternatívne toky

1. **História prichádza z migrácie.** Záznamy z konkurenčného systému majú označenie „Imported“ a zachovaný pôvodný dátum návštevy (`docs/migrating-to-openvpm.md`). Systém nesmie miešať importované a vlastné záznamy bez vizuálneho rozlíšenia — inak lekár verí dátam, ktoré nikdy nevideli validáciu.
2. **Chýbajúce laboratórne výsledky vs. „žiadne výsledky“.** Prázdny stav sa **nikdy** nesmie interpretovať ako „v poriadku“. UI musí rozlišovať: (a) nebolo vyšetrenie, (b) bolo, ale výsledok nie je v systéme, (c) bol výsledok odstránený (soft-delete s dôvodom).
3. **Pacient s dvomi vlastníkmi (rozvod, spoločná domácnosť).** Karta musí umožniť `client_contacts` a explicitne označiť, kto je platiteľ a kto je informovaná osoba (GDPR minimalizácia: druhý kontakt nesmie vidieť faktúry).
4. **Nesprávne priradený výsledok (cudzí pacient).** Pri náleze nesúladu (napr. čip v PDF patrí inému pacientovi) musí byť možnosť výsledok **odpojiť a previesť** s auditom — nie len vymazať.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Prvé načítanie | netrpezlivosť | Lekár chce odpoveď, nie zoznam súborov |
| Trendy a grafy | **spokojnosť** | „Konečne vidím, kam to ide“ — najvyššia hodnota na jednotku úsilia |
| Dokumenty | mierny chaos | Nezaradené PDF, duplicitné skeny |
| Externá dokumentácia | obava | „Môžem sa na to spoľahnúť?“ |
| Prázdne stavy | neistota | Ticho je horšie ako explicitné „nevieme“ |

### Kontextové prepojenia

- **Pred:** J1, J6, J16, J17.
- **Po:** J3, J5, J10, J11 (poistná správa), J12, J21 (pre-op kontrola), J27 (klient vidí svoju časť).

### AI Touchpointy

- ✅ **Chceme:** AI zhrnutie histórie („Pacient je 4 roky liečený na CKD; za posledných 6 mesiacov kreatinín stúpol o 22 %; posledná ATB pred 3 mesiacmi“), extrakcia údajov z nahratých PDF do trendov (s povinným potvrdením), preklad odborného textu do zrozumiteľného jazyka pre majiteľa (J27), upozornenie na nelogické dátumy (dátum pred narodením).
- ⛔ **Nechceme:** AI, ktorá „domyslí“ chýbajúce výsledky; AI, ktorá sama vytvorí diagnózu z dokumentu; AI, ktorá zobrazí sumár bez označenia, ktoré dáta chýbajú.
- **Human review bod:** extrakcia z PDF = povinné potvrdenie pred uložením do trendov (nie tiché „naučenie“).

---

### Use Case: UC-104

**Názov:** Zobrazenie a doplnenie klinickej histórie pacienta (trendy, dokumenty, anamnéza)
**Primárny aktér:** `veterinarian`, `technician`; čítanie aj `viewer`

**Predpoklady:**
- Pacient existuje; používateľ má oprávnenie vidieť klinickú časť karty.
- Existujú aspoň niektoré záznamy alebo dokumenty (inak sa zobrazí definovaný prázdny stav).

**Hlavný scenár:**
1. Používateľ otvorí kartu a vstúpi na históriu.
2. Systém načíta záznamy, laboratórne trendy, lieky, alergie a dokumenty v rozsahu aktuálneho pacienta.
3. Systém zobrazí trendy s referenčnými rozsahmi a označí odchýlky.
4. Používateľ nahrá externú dokumentáciu (alebo ju priradí k existujúcemu záznamu).
5. Systém uloží dokument s pôvodom, kategóriou a auditom; voliteľne spustí AI extrakciu s potvrdením.
6. Používateľ exportuje súhrn (klient, poisťovňa) alebo pokračuje v rozhodovaní.

**Alternatívne scenáre:**
- **A1 — Prázdna história:** systém zobrazí štruktúrovaný prázdny stav s CTA (nahrať, zapísať prvú návštevu).
- **A2 — Importované záznamy:** sú viditeľne označené ako `Imported` s pôvodným dátumom a zdrojom migrácie.
- **A3 — Externý výsledok s iným čipom:** systém ponúkne odpojenie a prevod k správnemu pacientovi s auditom.
- **A4 — Duálna starostlivosť:** systém umožní označiť „liečený aj v inom zariadení“ a evidovať kontaktné údaje.

**Výnimočné scenáre:**
- **E1 — Poškodený/nesprávne nahraný súbor:** upload zlyhá s konkrétnou chybou (typ, veľkosť, antivírusový skener), pôvodný súbor sa nezapíše do `files` a používateľ nemusí skúšať naslepo.
- **E2 — Extrakcia PDF zlyhá (naskenovaný dokument bez textovej vrstvy):** systém to **povie** namiesto doterajšieho tichého správania, keď binárne PDF vyzerá ako text (audit F-07-1).
- **E3 — Prístup k dokumentu s inou klasifikáciou:** systém vráti `FORBIDDEN` s vysvetlením a neukáže ani metadáta (napr. `viewer` bez klinického prístupu).

**Postconditions:**
- Používateľ má kompletné (alebo explicitne neúplné) dáta s viditeľným pôvodom.
- Dokumenty sú uložené s prístupovým auditom a možnosťou retencie/mazania podľa politiky.
- Každá AI extrakcia má potvrdenie a stopu.

**Business pravidlá:**
- **GDPR čl. 5 (minimalizácia) a čl. 15 (prístup):** klient má právo na kópiu svojich dát — musí existovať deterministická cesta k exportu (nie „napíšte podporu“).
- **Zákon 39/2007 Z. z.:** uchovávanie dokumentácie po zákonnú dobu; soft-delete s dôvodom namiesto fyzického mazania.
- **EÚ 2019/6:** ochranné lehoty musia byť viditeľné pred podaním lieku potravinovému zvieraťu.

**Dátové entity:** `patients` (R), `soap_notes` (R), `clinical_notes` (R), `vital_signs` (R), `patient_weights` (R), `patient_allergies` (R), `problem_list` (R), `prescriptions` (R), `lab_results` (R/W), `external_lab_observations` (R/W), `lab_result_events` (W), `files` (W), `historical_documents` (W), `file_storage_events` (W), `health_documents` (R).

**Integrácie:** storage (files/repliky), lab konektory (Laboklin/Synlab v pláne), AI provider (extrakcia/sumarizácia), tlač/PDF export.

---

## J5 — Clinical Guardian: interakcie, dávkovanie, toxicita

### Persóna & Kontext

**P2 Lucia** predpisuje kombináciu NSAID + kortikosteroid pri psovi v zlyhaní obličiek. Vie, že je to riziko, ale pod časovým tlakom si nie je istá dávkou. Chce byť **zastavená** — nie poučovaná.
**P1 Peter** predpisuje rutinne a chce, aby systém mlčal, keď je všetko v poriadku (jeho najväčšia obava: alert fatigue).
**Kľúčový fakt z kódu:** Clinical Guardian **nie je AI** — je deterministický (keyword sety NSAID/kortikosteroidy/nefrotoxické, SQL pravidlá, `ext_clinical_guardian_alerts` so severity `critical | warning | info`, `resolveAlert`/`dismissAlert` s dôvodom). Marketing ho nesmie nazývať AI (audit F-X2-1), inak sa znehodnotí dôvera v skutočné AI funkcie.

### Trigger

- **Klinický:** lekár ide predpísať liek alebo podať injekciu.
- **Systémový:** nový lab. výsledok ukáže renálnu/pečeňovú hodnotu mimo rozsahu → systém vyhodnotí kontext predpisu.
- **Interný:** technik pripravuje liek k výdaju (J10) a alert prechádza na neho.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Lekár vyberie liek v predpise / v encounteri | `clinicalGuardian.checkMedications` vyhodnotí: druh, váhu, diagnózy v `problem_list`, alergie, aktuálne lab. hodnoty, ostatné lieky, ochranné lehoty; `drug_interactions` na interakcie | Ak pacient nemá váhu → dávkovanie blokované, žiadosť o váženie |
| 2 | Systém vráti alert | Karta alertu: severity, čo zistil, aké dáta použil, čo odporúča („zvážiť alternatívu“, „skontrolovať dávku“) vrátane **odkazu na konkrétny záznam** (napr. „kreatinín 320 µmol/l, 12. 9.“) | Ak je severity `critical` → blokuje uloženie, pokiaľ lekár nezvolí explicitné „podávam aj tak — dôvod“ |
| 3 | Lekár sa rozhodne | Možnosti: (a) zmeniť liek, (b) upraviť dávku, (c) prijať alert s dôvodom, (d) označiť ako falošný pozitív | Ak `dismissAlert` → systém vyžaduje dôvod a zapisuje do auditu (učí sa z toho pravidlá, nie automaticky sa nevypína) |
| 4 | Systém zapíše rozhodnutie | `recordAlerts` + stav alertu; pri „podávam aj tak“ sa vytvorí záznam o klinickom rozhodnutí v SOAP zázname (nie mimo neho) | Ak je alert vyriešený, v encounteri zostáva viditeľný v sekcii rizík |
| 5 | (Pri kontrolovaných látkach) technik pripraví a lekár podá | Zero-prefill AI, povinný záznam podľa zákona 139/1998: množstvo, dátum, podpis, svedok pri znehodnotení (`controlled_substance_log`) | Ak chýba svedok → záznam sa nedá uzavrieť |

### Alternatívne toky

1. **Falošný pozitív (napr. „NSAID + kortikosteroid“ vtedy, keď má pacient washout periódu dávno za sebou).** Systém musí vyžadovať klinický dôvod dismissu a **započítať ho** do štatistiky kvality pravidla (aby sa pravidlo dalo vylepšiť). Dnes je dismiss možný, ale bez spätnej väzby do tvorby pravidiel — to je product gap.
2. **Pacient bez dát (nový klient bez histórie).** Systém nesmie tvrdiť „bez rizika“ — musí ukázať neúplnosť („alergie nezistené“, „lab. výsledky 0“). Rozdiel medzi „nič som nenašiel“ a „nemám čo hľadať“ je klinický rozdiel.
3. **Viacnásobné lieky z externého zdroja.** Klient užíva liek od inej kliniky; systém ho nemusí mať. Pri predpise musí byť otázka „užíva aj iné lieky?“ možnosťou jedným klikom (a odpoveď vstúpi do alert logiky).
4. **Technik nemá právo na rozhodnutie.** Alert, ktorý vyžaduje zmenu, sa musí preniesť lekárovi ako úloha; technik ho nesmie len „odkliknúť“ — inak sa obchádza systém.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Pred predpisom | rutina | Peter: „Nech mi do toho nelezú“ |
| Pri `critical` alerte | **zastavenie a úľava** | Lucia cítila, že sa niečo deje, ale kurz by nedala |
| Pri opakovaných `warning` | podráždenosť | Ak je 30 % alertov nanič, lekár začne ignorovať všetky |
| Pri dismiss s dôvodom | mierne napätie | „Chce po mne papierovanie“ — no v správnom dizajne je to 1 klik + 10 znakov |
| Pri kontrole OPL | vážnosť, zodpovednosť | Právny svet, nie UX |

### Kontextové prepojenia

- **Pred:** J3 (encounter), J4 (lab a alergie), J10 (predpis/výdaj), J16 (nový lab. výsledok).
- **Po:** J10, J11 (účtovanie lieku), J28 (evidencia OPL a ochranné lehoty), J29 (eutanázia — použitie OPL).

### AI Touchpointy

- **Dnes:** žiadne — a je to **feature**, nie nedostatok. Deterministické pravidlo je auditovateľné a reprodukovateľné; AI by do klinického rozhodnutia o lieku vniesla neistotu, ktorú nemožno obhajovať pri súde.
- ✅ **Vhodné AI uplatnenie (okolo pravidiel, nie namiesto nich):** priorita alertov podľa kontextu pacienta, sumarizácia „prečo mi to hlási“ do 2 viet, generovanie vysvetlenia pre majiteľa (prečo liek nemeníme), podpora tvorby pravidiel z histórie („toto pravidlo malo 40 % falošných pozitív“).
- ⛔ **Nevhodné:** AI, ktorá sama rozhodne, či alert potlačiť; AI, ktorá „obhajuje“ liek; AI ako jediná kontrola OPL.

---

### Use Case: UC-105

**Názov:** Klinická kontrola liekov, dávkovania a toxicity pred predpisom alebo podaním
**Primárny aktér:** `veterinarian`, `technician` (spúšťa kontrolu; rozhodnutie patrí lekárovi)

**Predpoklady:**
- Pacient má známu váhu (alebo ju technik práve odváži) a je priradený k praxi.
- Existujú pravidlá (kód) pre interakcie a dávkovanie; liek existuje v katalógu produktov/služieb.

**Hlavný scenár:**
1. Používateľ vyberie liek (v predpise/kalkulačke/dávkovaní).
2. Systém vyhodnotí druh, váhu, diagnózy, alergie, lab. výsledky, aktuálne lieky a ochranné lehoty.
3. Systém zobrazí alert (ak existuje) s údajmi, ktoré viedli k rozhodnutiu, a s odporúčaním.
4. Používateľ zvolí úpravu lieku/dávky, alebo prijme rozhodnutie s dôvodom.
5. Systém zapíše rozhodnutie do auditovateľnej stopy a do SOAP kontextu.
6. Pri kontrolovaných látkach systém vyžaduje evidenciu podľa zákona 139/1998.

**Alternatívne scenáre:**
- **A1 — Alert je falošný pozitív:** používateľ ho dismissuje s dôvodom; záznam je v audite a k dispozícii pre zlepšenie pravidla.
- **A2 — Chýbajúce dáta:** systém zobrazí „kontrola neúplná“ a vyžaduje vedomé potvrdenie lekára, že predpisuje s neúplnými dátami.
- **A3 — Externá medikácia:** používateľ označí „užíva aj iné lieky“ a doplní ich; kontrola sa prepočíta.
- **A4 — Technik spustí kontrolu, ale nemá právo rozhodnúť:** alert sa eskaluje lekárovi, technik dostane inštrukciu (nie možnosť potlačiť).

**Výnimočné scenáre:**
- **E1 — Kontrola nemôže prebehnúť (výpadok DB / chýbajúci katalóg):** systém **nesmie** ticha povoliť predpis. Zobrazí varovanie „kontrola nedostupná, predpisujete na vlastnú zodpovednosť“ a vyžaduje potvrdenie lekára.
- **E2 — Nekonzistentné dáta pacienta (váha 0, druh prázdny):** systém blokuje dávkovanie s vysvetlením, aké pole chýba.
- **E3 — Alert, ktorý vznikne až po uložení predpisu:** systém musí vedieť dodatočne notifikovať lekára a označiť preskripciu ako „vyžaduje kontrolu“ (nie tichú úpravu).

**Postconditions:**
- Existuje klinické rozhodnutie s odôvodnením (buď akceptovaný alert, alebo vedomé prijatie rizika).
- Kontrolované látky sú evidované podľa zákona.
- Alerty majú stav (`open`/`resolved`/`dismissed`) a nenesú zodpovednosť za lekára.

**Business pravidlá:**
- **Zákon 139/1998 Z. z.:** evidencia OPL, zero-prefill, svedok znehodnotenia.
- **EÚ 2019/6 + zákon 39/2007:** ochranné lehoty pri potravinových zvieratách (nesmie sa predpísať liek s lehotou bez evidencie lehoty).
- **Klinické pravidlo produktu:** toxicity pravidlá pre druhy (paracetamol — mačka; ivermektín — kólia) sú nekompromisné `critical`.
- **Právne:** alert nepreberá zodpovednosť — zodpovednosť zostáva na lekárovi, ale systém nesmie dovoliť predpis bez vedomého potvrdenia.

**Dátové entity:** `drug_interactions` (R), `ext_clinical_guardian_alerts` (W/R), `patient_allergies` (R), `problem_list` (R), `lab_results` (R), `prescriptions` (R/W), `prescription_events` (W), `controlled_substance_log` (W/R), `inventory` produkty so stavom zásob (R), `vital_signs` (R), `patient_weights` (R), `ext_withdrawal_periods` (R/W), `audit_log` (W).

**Integrácie:** dávkovacia kalkulačka (interná), katalóg liekov (lokálny), voliteľne externé referenčné databázy interakcií (dnes neexistuje — product gap pre v0.8).

---

## J6 — Nový klient + nový pacient (Duplicate Shield)

### Persóna & Kontext

**P3 Zuzana** prijíma nového klienta: „Dobrý deň, chceme prísť s mačkou, ešte u vás neboli.“ Za 90 sekúnd má mať založeného klienta, pacienta, súhlasy, a portálový link. Nesmie vzniknúť duplicita — a ak klient už existuje (volal minulý rok), musí ho systém nájsť.
**P4 Martin** zakladá pacienta po očkovacej kampani a pracuje s čítačkou čipov.

### Trigger

- **Externý:** nový klient v čakárni/na telefóne.
- **Onboarding:** migrácia dát (J-NEW-2) zakladá desiatky až tisíce záznamov.
- **Systémový:** CRSZ registrácia čipu vyžaduje existujúceho pacienta.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/clients/new` (alebo klikne „+“ v hľadaní) | Zobrazí formulár s minimom polí: meno, telefón, e-mail, adresa, spôsob komunikácie | Ak je pole e-mail prázdne → povolené, ale systém upozorní, že portál a pripomienky cez e-mail nebudú fungovať |
| 2 | Zadá meno a telefón | `duplicateShield.checkClient` (e-mail exact/ilike + telefón normalizovaný na posledných 9 číslic) → zobrazí možné zhody **pred** uložením | Ak zhoda existuje → krok 3b (neukladať nového klienta) |
| 3a | Pokračuje „Bez zhody“ | `clients.create` uloží klienta; systém vygeneruje **portálový capability link** (`consent_receipt_capabilities`/portal token) a zobrazí ho s tlačidlom „skopírovať“ | Ak prax má vypnutý portál → banner „portál nie je aktivovaný“ |
| 3b | Zhoda nájdená | Systém otvorí existujúceho klienta a ponúkne „pridať nového pacienta k tomuto majiteľovi“ | Ak klient tvrdí, že je to blízka osoba (rodina) → samostatný záznam s poznámkou (nie zlúčenie) |
| 4 | Otvorí `/patients/new` | Formulár: meno, druh, plemeno, pohlavie, dátum narodenia, farba, čip, poznámky | Ak je čip zadaný → validácia ISO 11784/11785 (15 číslic) ešte pred uložením |
| 5 | Načíta čip čítačkou | Systém overí unikátnosť čipu; pri zhode v `microchip_registrations` **zobrazí, komu patrí** | **Ak patrí inému pacientovi → STOP** (nesmie vytvoriť duplicitnú registráciu) |
| 6 | Uloží pacienta | `patients.create`; systém ponúkne doplnenie: váha, sterilizácia, alergie, potravinové vs. spoločenské zviera | Ak je zviera potravinové → systém **vyžaduje** evidenciu relevantných údajov (CEHZ kód farmy, ochranné lehoty) |
| 7 | Vyplní súhlasy | SMS opt-in (`sms_consent_events`), e-mail preferencie, GDPR informovanie; čas a spôsob súhlasu sa ukladajú | Ak klient odmietne komunikáciu → systém to musí rešpektovať aj pri recall kampaniach (J14, J19) |
| 8 | Dokončí check-in alebo objedná termín | Náväznosť na J7/J8 s už predvyplnenými dátami | Ak pacient vyžaduje očkovanie → systém predvyplní schému podľa druhu a veku (J13) |

### Alternatívne toky

1. **Duplicitný pacient (dva záznamy toho istého zvieraťa).** Systém dnes kontroluje duplicitného **klienta** automaticky, ale ekvivalent pre pacienta neexistuje (audit F-01-2 — mikročip sa kontroluje len na samostatnej obrazovke `/patients/duplicates`). Riešenie: spustiť kontrolu čipu + mena + dátumu narodenia priamo vo formulári, a pri zhode blokovať „Vytvoriť“ s odkazom na zlúčenie.
2. **Migrovaný klient s prázdnym e-mailom.** Migrácia povoľuje klienta bez e-mailu (`docs/migrating-to-openvpm.md`), ale pripomienky a portál potrebujú kanál. Systém musí pri takom klientovi zobraziť „kanál chýba“ a ponúknuť doplnenie pri najbližšej návšteve.
3. **Zakázaná registrácia čipu (čip patrí inému majiteľovi, ale zviera je prevedené).** Systém potrebuje workflow „prevod vlastníctva“: nový záznam pacienta alebo prepis vlastníka so záznamom o pôvodnom majiteľovi a s dôvodom (kúpa, útulok, dedičstvo).
4. **Onboarding hromadného zápisu (10+ pacientov pri kampani).** Systém musí umožniť rýchle zakladanie v režime „ďalší“ bez straty kontextu, s odloženým doplnením detailov. Inak recepcia prepíše len polovicu a zvyšok do systému nikdy nedôjde.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Zadávanie údajov | neutrálna/rutinná | Zuzana to robí 5× denne |
| Zhoda klienta | úľava | „Ušetrilo mi to prepisovanie“ |
| Zhoda čipu na iného majiteľa | **nepríjemnosť, konflikt s klientom** | Rozhovor „to je moje zviera“ je emočne náročný |
| Povinné polia (CEHZ) | tlak, zmätok | „Prečo to odo mňa chce, keď to nikdy nikto nepoužil?“ |
| Súhlasy (GDPR) | zodpovednosť | Strach z pokuty pri nesprávnom získaní súhlasu |
| Po dokončení | úľava | Ideálne pod 90 sekúnd |

### Kontextové prepojenia

- **Pred:** J1 (ak sa hľadaním nenašiel), J-NEW-2 (migrácia).
- **Po:** J7 (termín), J13 (očkovanie), J27 (portál — klient dostane link), J28 (CRSZ registrácia).

### AI Touchpointy

- ✅ **Chceme:** AI návrh (a) ako vyplniť druh/plemeno z ľudového pomenovania („škrečok džungársky“), (b) odhad dospelosti z dátumu narodenia pre očkovaciu schému, (c) sumarizácia „čo sme sa dohodli“ pre klienta pri zakladaní (zhovievavé potvrdenie).
- ⛔ **Nechceme:** AI, ktorá sama zlúči klientov alebo pacientov; AI, ktorá vyplní čísla čipov (riziko preklepu = právny problém pri CRSZ); AI, ktorá zhromažďuje súhlasy namiesto človeka (GDPR vyžaduje preukázateľný súhlas).
- **Deterministické jadro:** Duplicate Shield je (a má zostať) deterministický a tak komunikovaný.

---

### Use Case: UC-106

**Názov:** Založenie nového klienta a pacienta s kontrolou duplicít a súhlasov
**Primárny aktér:** `front_desk` (aj `veterinarian`, `technician`, `admin`)

**Predpoklady:**
- Používateľ má rolu s právom zápisu do `clients`/`patients`.
- Existuje prax s aktívnym subscription/self-host režimom.
- Portál je voliteľne aktivovaný pre prax.

**Hlavný scenár:**
1. Používateľ otvorí formulár nového klienta.
2. Systém vykoná kontrolu duplicít (e-mail, telefón) **pred** uložením.
3. Pri absencii zhody systém uloží klienta a vygeneruje portálový link.
4. Používateľ založí pacienta; systém validuje mikročip a overí jeho unikátnosť.
5. Systém vyžiada relevantné povinné údaje (napr. potravinové zviera → kód farmy).
6. Používateľ zaznamená súhlasy (SMS/e-mail/GDPR).
7. Systém vytvorí kompletný záznam a ponúkne náväzné akcie (termín, očkovanie, portál).

**Alternatívne scenáre:**
- **A1 — Zhoda klienta:** systém presmeruje na existujúci záznam a ponúkne pridanie pacienta.
- **A2 — Zhoda čipu:** systém blokuje vytvorenie a ponúkne kontrolu vlastníctva / prevod.
- **A3 — Chýbajúci kontaktný kanál:** systém povolí uloženie, ale označí klienta ako „bez možnosti notifikácie“ a zobrazí to pri každej kampani.
- **A4 — Hromadné zakladanie (kampaň/migrácia):** režim „ulož a pokračuj na ďalšieho“ s odloženými voliteľnými poľami.

**Výnimočné scenáre:**
- **E1 — Súbežné vytvorenie toho istého klienta na dvoch recepciách:** systém musí vrátiť konflikt (unikátny index / kontrola pred insertom) a zobrazí už vytvorený záznam namiesto duplicity.
- **E2 — Neplatný mikročip (menej/viac číslic, nečíselné znaky):** systém vráti `BAD_REQUEST` s konkrétnou chybou a čip neuloží; práca môže pokračovať bez čipu (stav „čip neznámy“).
- **E3 — Zlyhanie generovania portálového linku:** pacient sa uloží, link sa vygeneruje dodatočne; systém nesmie označiť klienta ako „portál pripravený“, ak link neexistuje.

**Postconditions:**
- Existuje klient a pacient s preukázateľnou kontrolou duplicít.
- Mikročip je validovaný a (ak je registrovaný) vedený v `microchip_registrations`.
- Súhlasy sú evidované s časom, kanálom a verziou textu.
- Portálový link existuje a je pripravený na zdieľanie (J27).

**Business pravidlá:**
- **GDPR čl. 6 a 7 + zákon 18/2018:** preukázateľný súhlas, možnosť odvolania, minimalizácia.
- **Zákon 39/2007 Z. z. § 19:** identifikácia zvierat, registrácia mikročipov, CEHZ pre hospodárske zvieratá.
- **ISO 11784/11785:** formát mikročipu pred akýmkoľvek zápisom.
- **Produktové:** žiadne automatické zlučovanie; zlúčenie je serializable transakcia s udalosťou v `patient_merge_events`.

**Dátové entity:** `clients` (W), `client_contacts` (W), `patients` (W), `microchip_registrations` (W/R), `pet_passports` (W), `sms_consent_events` (W), `platform_email_preferences` (W), `consent_forms` (W), `consent_receipt_capabilities` (W), `patient_merge_events` (W), `audit_log` (W).

**Integrácie:** CRSZ / KVL SR (lokálna evidencia; B2G nie je implementované), SMS/e-mail provider, portál (capability token), tlač dokumentov.

---

## Business Case: Klinická & pacientska práca

### Status Quo

Slovenská klinika s 3 lekármi a 42 pacientmi denne pracuje dnes v jednom z dvoch režimov:

**A) Papier + Excel (menšie ambulancie).** Karty v šanóne, „kniha ošetrení“ v zošite, fakturácia v účtovnom programe. Dôsledky:
- Lekár píše záznam po ordinačných hodinách — 45–70 minút denne.
- História pacienta sa hľadá fyzicky; pri dvoch pacientoch súbežne sa stráca 30–90 s na hľadanie.
- Interakcie sa kontrolujú z pamäte. Pri 900 návštevách/mesiac je šanca ľudskej chyby reálna, nie teoretická.
- Diktovanie neexistuje — po ruke nemá zapisovateľku.

**B) Desktop PIMS (AVImark, Cornerstone, Vetis, Vet-On).** Záznamy existujú, ale:
- Písanie zaberá 6–10 minút na encounter a väčšina lekárov odkladá dokumentáciu na koniec dňa („písanie po 18:00“).
- História je roztrúsená medzi 3–4 obrazovky; laboratórne výsledky sú PDF v priečinku.
- Kontrola liekov je „v hlave lekára“, prípadne v číselníku bez väzby na pacientovu váhu, diagnózu a labák.
- Notifikácie o rizikách neexistujú; riziko nesie lekár a jeho pamäť.

**Kvantifikácia bolesti (referenčný model):** 3 lekári × 12 encounterov × 6 minút = **216 minút/deň** písania = 3,6 hodiny/deň lekárskej práce, ktorá neprináša obrat. Pri náklade 0,30 €/min je to **64,80 €/deň** = 1 394 €/mesiac = 16 700 €/rok priamych mzdových nákladov na administráciu, ktorú je možné z veľkej časti eliminovať.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Dokumentácia mimo ordinačných hodín (45 → 15 min/deň, 1 lekár v režime „zvyšky“) | 30 min × 0,30 € × 252 dní | 2 268 € |
| AI/voice úspora počas dňa (3 lekári, priemer 24 min/deň celkovo, konzervatívne) | 72 min × 0,30 € × 252 | 5 443 € |
| Vyššia zachytenosť účtovaných výkonov (lepšia dokumentácia → 1,5 % obratu) | 41 400 € × 1,5 % × 12 | 7 452 € |
| Rýchlejšie hľadanie pacienta (8 hľadaní/deň × 40 s) | 5,3 min × 0,15 € × 252 | 200 € |
| Menej duplicitných pacientov a opravných úkonov | 1 duplicita/mesiac × 25 min | 150 € |
| Eliminované klinické riziko (1 závažná interakcia alebo predávkovanie ročne, konzervatívna hodnota liečby, straty dôvery a práce naviac) | 1 × 3 000 € | 3 000 € |
| Menej reworku a dohľadávania (0,5 h/týždeň lekára) | 26 h × 0,30 € | 3 287 € |
| **Spolu (konzervatívne)** | | **21 800 €** |

> **Overlap upozornenie:** „Vyššia zachytenosť výkonov“ sa čiastočne prekrýva s BC-3. Pri skladaní
> celkovej hodnoty kliniky používajte kombinovaný strop z README §6.1, nie súčet.

### ROI po tier-och

| Tier | Náklad/rok | Hodnota skupiny | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted (0 €)** | ~1 200 € (server, zálohy, 0,5 h/týždeň IT) | 21 800 € | 18× | 20 dní |
| **Cloud Solo 49 €/mes (588 €)** | 588 € | 8 100 € (1 lekár: 1 815 € AI + 2 268 € večery + 2 520 € capture + 1 497 € rework/riziko) | 13,8× | 27 dní |
| **Cloud Klinika 119 €/mes (1 428 €)** | 1 428 € | 21 800 € | 15,3× | 24 dní |
| **Cloud Nemocnica 229 €/mes (2 748 €)** | 2 748 € | 28 000 € (3 lekári + 2 technici, viac encounterov) | 10,2× | 36 dní |

**Proti modelu v kóde (R-01):** flat 79 USD (~73 €) za lokalitu so všetkými funkciami dáva pri referenčnom modeli ROI 14× a payback 25 dní. Rozdiel medzi 49 € Solo a flat 73 € je v tomto modeli nevýznamný voči hodnote — **cena nie je hlavná bariéra, dôvera je.**

### Competitive Moat

| Schopnosť | Kto to má dnes | Prečo je to moat |
|---|---|---|
| **Hash-chain audit AI záznamov** (`ext_ai_audit_log`, monotónne sekvencie, advisory lock) | Overené v tomto repozitári; u bežných PIMS sa audit končí pri „kto zmenil záznam“ | Pri kontrole alebo spore je odpoveď na otázku „bolo to AI a kto to potvrdil“ **doložiteľná** — to je argument pre zodpovedného lekára aj pre poisťovňu |
| **Potvrdzovacia obálka lekára s TTL a hashmi** | Nikde inde v SK/CZ priestore nie je verejne doložená | AI nesmie zapísať text do záznamu bez jednorazového ľudského potvrdenia — obhájiteľné pri audite |
| **Zero-prefill pre kontrolované látky** | Konkurencia zvyčajne „povolí a varuje“ | Predpis OPL nie je len o varovaní — je o zodpovednosti; obchádzanie AI je tu bezpečnostná vlastnosť |
| **Deterministický Clinical Guardian s dôvodom dismissu** | Riešenia často predávajú „AI kontroly“ bez auditovateľnosti | Reprodukovateľné pravidlo sa dá obhájiť a vylepšovať podľa reálnych dismissov |
| **Open-source + self-host** | Vetfox je cloud-only, Vetis je licencovaný desktop, Vetbook cloud s cenou podľa úložiska | Klinika, ktorá nechce mať dáta u tretieho subjektu, má pri OpenVPM reálnu (nie marketingovú) voľbu |

**Kde konkurencia vyhráva a treba to dobehnúť:** onboarding a podpora (Vetfox dáva prvé 3 mesiace zdarma a má ľudskú podporu), import dodacích listov z veľkoobchodov (Vetfox podporuje Noviko, SG-VET, Samohýl, Biopharm) a celková „hotovosť“ UX po 15 rokoch vývoja. **Poznámka k metodike:** tvrdenia o konkurencii sú hypotézy z verejných zdrojov a vyžadujú competitive intelligence upgrade (viď §KPI nižšie).

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Ako to rieši journey design |
|---|---|---|
| **„Nemám čas sa to učiť“** | Lekár neopustí svoje workflow uprostred dňa | J2/J3 pracujú s existujúcim zvykom (diktovanie, šablóna) a AI je voliteľná vrstva, nie povinná; manuálny režim je plnohodnotný |
| **„AI mi zapíše blbosť a budem za to zodpovedný“** | Odmietnutie AI textu | Diff modál + jednorazové potvrdenie + zero-prefill pri OPL + (po R-03) provenance zápis; lekár vidí, že kontrola je na jeho strane |
| **„Starý systém poznám 10 rokov“** | Odpor k zmene v T1 workflow | J-NEW-1 začína na „prvý deň užitočný“ (nastavenie len troch vecí) a nie na „vyplňte 40 polí“; J-NEW-3 meria týždenné míľniky |
| **„Mám 12 000 záznamov v starom systéme“** | Strach zo straty histórie | J-NEW-2: dry-run najprv, viditeľný report riadkov, import medical history s pôvodnými dátumami, označenie `Imported` |
| **„Legalita — a čo kontrola?“** | Obava z KVEPIS/ŠVPS/GDPR | J28 + J30: XSD validátor, export dôkazov, hash-chain audit, DPA a data residency popísané (R-07) |
| **„Koľko ma to bude stáť?“** | Nejasný TCO | Self-host 0 € + konkrétne čísla ROI (tento BC) namiesto marketingových fráz |

### KPIs

| Metrika | Baseline (ručný systém) | Cieľ (3 mesiace po nasadení) | Ako merať |
|---|---|---|---|
| Priemerný čas na finalizáciu SOAP | 6–10 min | ≤ 3,5 min | `soap_notes` timestampy: `createdAt` → `finalizedAt`, segmentované podľa `usedAi` |
| Podiel encounterov písaných po 18:00 | 40–60 % | < 15 % | čas finalizácie mimo ordinačných hodín |
| Podiel encounterov s AI draftom, ktorý lekár prevzal aspoň na 50 % | 0 % | > 45 % | diff dáta + hash draft vs. potvrdené |
| Čas hľadania pacienta (p95) | 20–40 s (manuálne/papier) | < 5 s | front-end timing + dopyt latency |
| Duplicitní pacienti na 1 000 záznamov | 8–15 (typicky pri papieri) | < 2 | počet `patient_merge_events` / nové záznamy |
| Miera „AI text v zázname bez provenance“ | n/a (AI neexistuje) | **0 %** (blokujúca metrika, R-03) | `ext_ai_audit_log` vs. finalizované AI drafty |
| NPS lekárov (J2/J3) | n/a | ≥ 40 | in-app prieskum po 30 dňoch používania |
| Podiel alertov dismissnutých bez dôvodu | n/a | < 5 % | `ext_clinical_guardian_alerts` + dôvod |
| Čas od príchodu po check-in | 3–6 min (manuálne) | < 90 s | `appointments` check-in timestampy (J8) |
| Churn (mesačný) | n/a | < 1,5 % | `usage_records` / predplatné |
