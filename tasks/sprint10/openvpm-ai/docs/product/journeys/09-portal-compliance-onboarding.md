# Skupina 9 — Klientsky portál, compliance, citlivé journeys a onboarding (J27–J30, J-NEW-1…3)

> Táto skupina obsahuje **journeys, ktoré rozhodujú o adopcii** (onboarding), **journeys, ktoré rozhodujú o dôvere**
> (compliance, eutanázia) a **journey z perspektívy zákazníka kliniky** (portál).
> **Business Case:** [BC-9](#business-case-klientský-portál-compliance-a-adopcia).

---

## J27 — Klientsky portál: celý deň majiteľa zvieraťa

### Persóna & Kontext

**P5 Katarína** (52, labrador s CKD) je typická používateľka portálu: nie je technofób, ale nemá čas. Chce tri veci: **vedieť kedy**, **vedieť koľko**, **vedieť čo robiť**.
**P6 Ján** (34, urgent) je opačný extrém: chce všetko vyriešiť na mobile, okamžite, vrátane platby.
**Reality check z kódu:** portál existuje ako PWA (`/portal`, `/portal/[token]/*` s capability tokenom, `/portal/access/[token]`), s podsystémami: pets (očkovací preukaz), appointments, book, invoices (online platba cez Stripe), messages (chat + fotky). Verejné povrchy: `/book/[slug]`, `/treatment-plan/[token]`, `/postop/[id]`, `/sign/[token]`, `/capture/[token]`, `/h/[slug]`. Rate limity: 120–300 požiadaviek/15 min pri čítaní, 20/30/10 za hodinu pri zápisoch.

### Trigger

- **Časový:** pripomienka revakcinácie alebo kontroly (J14), splatnosť faktúry.
- **Externý:** zviera sa zraní alebo zhorší stav (chce objednať/urgent).
- **Interný:** klinika požiada o doplnenie dát (foto rany, aktuálna váha) alebo o súhlas (J12, J21).
- **Systémový:** portálový link pri zakladaní klienta (J6) alebo odoslaný v potvrdení termínu.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí link z SMS (magic link) | Bezheslový vstup cez capability token; session má obmedzený rozsah, expiráciu a rate limity | Ak je token neplatný/expirovaný → systém ponúkne nový link (SMS/e-mail), nikdy nie „zaregistrujte sa“ |
| 2 | Vidí úvodnú obrazovku svojich pacientov | Systém zobrazí domácnosť (pacienti), najbližší termín a **to, čo vyžaduje pozornosť** (napr. revakcinácia) | Ak je pacient zosnulý → portál zobrazí sympathy verziu (bez pripomienok a bez „objednajte sa“) |
| 3 | Klikne „Objednať termín“ | `/portal/[token]/book`: výber pacienta, typu návštevy, voľného slotu; systém zobrazí dostupnosť v reálnom čase | Ak nie sú voľné termíny → systém ponúkne waitlist a telefonát (nie slepá ulička) |
| 4 | Odošle žiadosť | Systém ju zaeviduje (podľa konfigurácie rovno potvrdí, alebo čaká na recepciu) | Ak je žiadosť duplicitná → systém ukáže existujúcu žiadosť namiesto chyby |
| 5 | Prezerá zdravotnú kartu / očkovací preukaz | Systém zobrazí zrozumiteľný súhrn: vakcíny s platnosťou, posledné výsledky (s vysvetlením, čo znamenajú), lieky, inštrukcie | Ak niektoré dáta nie sú určené klientovi (interné poznámky) → **nikdy** sa nezobrazia |
| 6 | Stiahne faktúru alebo zaplatí | `/portal/[token]/invoices`: PDF, stav úhrady, online platba (Stripe), história | Ak platba zlyhá → jasný stav a možnosť skúsiť inú metódu; systém neoznačí faktúru ako zaplatenú |
| 7 | Napíše klinike (alebo pošle foto) | `/portal/[token]/messages`: chat s limitom, upozornenie na očakávanú dobu odpovede v rámci ordinačných hodín | Ak správa vyžaduje urgentné riešenie → systém zobrazí „v akútnom prípade volajte“ a telefónne číslo (nie tichý chat) |
| 8 | Reaguje na liečebný plán | `/treatment-plan/[token]`: body plánu s cenami, možnosť akceptovať/odmietnuť/položiť otázku | Ak odmietne → klinika vidí odpoveď vrátane dôvodu a môže reagovať alternatívou |
| 9 | Dostane pripomienku revakcinácie | Systém pošle správu podľa súhlasov a preferencií; v portáli je viditeľná s odpočtom | Ak nemá súhlas na SMS → pripomienka zostane v portáli a v zozname recepcie |
| 10 | Zmení alebo zruší termín | Systém vykoná zmenu podľa pravidiel praxe (v rámci limitu); pri neskorej zmene vidí dôsledky (poplatok, ak je nastavený) | Ak je zmena mimo pravidiel → systém odkáže na telefonát, s vysvetlením prečo |

### Alternatívne toky

1. **Klient nemá smartphone/e-mail.** Portál je voliteľný; klinika musí mať **plnohodnotnú papierovú cestu** a SMS pripomienky. Nikdy nesmie nastať stav, že bez portálu nie je možná registrácia alebo prevzatie pacienta.
2. **Rodina s viacerými ľuďmi (rozvod, spoločná domácnosť).** Systém musí mať jedného platiteľa a ďalšie kontakty s obmedzeným rozsahom (napr. vidí termíny, nevidí faktúry). Vyžaduje to explicitné nastavenie, nie implicitné.
3. **Klient chce vidieť „všetko“ z karty.** Systém musí zobrazovať klinicky zrozumiteľnú vrstvu (nie interné poznámky lekára, nie diferenciálnu diagnostiku) — a to aj preto, aby sa lekár nebál písať do karty.
4. **Zneužitie linku (zdieľanie v rodine, screenshot).** Capability token musí expirovať, dať sa odvolať a musí byť väzaný na konkrétnu domácnosť; pri podozrení vie klinika prístup zrušiť (`portal_sessions`).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie linku | **úľava** | Bez hesla, bez registrácie, funguje to |
| Objednávka | spokojnosť | Nezávislosť od ordinačných hodín |
| Čítanie karty | dôvera alebo zmätok | Podľa zrozumiteľnosti textu |
| Platba | neutrálna | Ak je jednoduchá |
| Chat, keď nikto neodpovedá | **hnev a neistota** | „Píšem do prázdna?“ |
| Pripomienka očkovania | zodpovednosť | „Dobre, že mi to pripomenuli“ |

### Kontextové prepojenia

- **Pred:** J6 (link pri zakladaní), J7 (potvrdenie termínu), J12 (closeout odovzdal dokumenty), J14 (pripomienka).
- **Po:** J7 (objednávka), J9 (zmena), J11 (platba), J15 (kontrola), J21 (pooperačná komunikácia), J23 (telemedicína).

### AI Touchpointy

- ✅ **Chceme:** preklad klinického textu do ľudskej reči (výsledky, diagnóza, liečba) s jasným disclaimerom, sumarizácia „čo odo mňa klinika potrebuje“, odpovede na časté otázky v chate (s odkazom na lekára pri klinických otázkach), pripomienky personalizované podľa pacienta.
- ⛔ **Nechceme:** AI odpovedajúca na klinické otázky bez lekára; AI generujúca sumár karty, ktorá by mohla vyzerať ako diagnostický záver; AI v urgentných situáciách (tam patrí telefón a človek).

---

### Use Case: UC-127

**Názov:** Klientsky portál — objednanie, prehľad karty, dokumenty, platby a komunikácia
**Primárny aktér:** klient (majiteľ zvieraťa); podpora z `front_desk`

**Predpoklady:**
- Existuje klientsky záznam a portálový capability token (`consent_receipt_capabilities`/portal session).
- Prax má aktivovanú knihu a rozvrh; pri platbách je dostupný Stripe/platobný kanál.
- Sú rešpektované súhlasy a sympathy stav pacienta.

**Hlavný scenár:**
1. Klient otvorí portál cez magic link (bez hesla).
2. Systém zobrazí domácnosť, pacientov, najbližší termín a úlohy na pozornosť.
3. Klient objedná termín alebo pošle žiadosť; systém ju spracuje podľa pravidiel praxe.
4. Klient si pozrie kartu/očkovací preukaz a stiahne dokumenty alebo zaplatí faktúru.
5. Klient komunikuje s klinikou cez chat (alebo reaguje na liečebný plán / post-op check-in).
6. Pri pripomienke sa klient objedná alebo potvrdí, že nepríde.

**Alternatívne scenáre:**
- **A1 — Bez kontaktu:** klinika zvolí plnú papierovú cestu; portál sa nepoužije.
- **A2 — Viac kontaktov jednej domácnosti:** platiteľ a obmedzené kontakty s rozlíšeným rozsahom.
- **A3 — Sympathy stav:** portál zobrazuje bez automatizácií, s kondolenčnou komunikáciou a bez pripomienok.
- **A4 — Zmena/odmietnutie plánu:** odpoveď klienta je uložená a viditeľná klinike aj s dôvodom.

**Výnimočné scenáre:**
- **E1 — Expirovaný/odvolaný link:** systém vráti `NOT_FOUND` (bez prezradenia, či token existoval) a ponúkne nový link cez SMS/e-mail.
- **E2 — Rate limit:** systém vráti `TOO_MANY_REQUESTS` s ľudsky zrozumiteľnou správou („skúste to neskôr alebo zavolajte“), nie technickým kódom.
- **E3 — Výpadok platobnej brány:** faktúra zostáva neuhradená; klient dostane alternatívu (prevod, na mieste) a klinika to vidí.
- **E4 — Zlý signál / offline PWA:** systém uloží akciu a dokončí ju po obnovení (bez duplikátov), s jasným stavom „odoslané/neodoslané“.

**Postconditions:**
- Klient má prístup k svojim dátam, termínom a dokladom bez telefonovania.
- Klinika má menej telefonátov a menej ručných krokov.
- Všetky portálové akcie sú v auditnej stope (`portal_sessions`, `audit_log`).

**Business pravidlá:**
- **GDPR čl. 5/6/15/32:** minimalizácia, preukázateľný prístup, bezpečnosť capability tokenov, právo na prístup k dátam.
- **Zákon 18/2018:** spracúvanie a ochrana osobných údajov; clear consent pre komunikáciu.
- **Zákon 289/2008 + 222/2004:** doklad a daňové náležitosti faktúr dostupných v portáli.
- **Produktové:** portál je vždy voliteľný; nikdy nesmie obsahovať klinickú internú vrstvu; sympathy gate je nad všetkými automatizáciami.

**Dátové entity:** `clients`, `client_contacts`, `patients`, `portal_sessions`, `consent_receipt_capabilities` (R), `appointments` (W/R), `booking_pages` (R), `vaccination_records` (R), `lab_results` (R — len zrozumiteľná vrstva), `prescriptions` (R), `invoices`/`payments` (R/W), `files` (R), `messaging`/`communications` (W/R), `visit_treatment_plan_responses` + lines (W/R), `ext_marketing_postop_responses` (W), `sms_consent_events` (R), `audit_log` (W).

**Integrácie:** Stripe (online platby), SMS/e-mail (linky), portál PWA, AI (preklad textu), e-Kasa (doklady z pokladnice majú vlastný kanál).

---

## J28 — Legislatívny cyklus (KVEPIS, CRSZ, OPL, e-Kasa, CEHZ)

### Persóna & Kontext

**P7 Anna** má na starosti compliance. Nie je právnik a nechce ním byť. Chce, aby **systém vedel, čo zákon vyžaduje**, a povedal jej to v pravý čas.
**P1 Peter** podpisuje hlásenia a nesie zodpovednosť — potrebuje vidieť, čo systém posiela.
**Kľúčové dáta:** `extensions.kvepis` (XSD validácia, ambulantná kniha, hlásenia; role admin/vet/tech), `extensions.crsz` (ISO 11784/11785, KVL export; vrátane front_desk), `ext_rabies_notifications` + `ext_rabies_observations` (3-dňové okno), `ext_withdrawal_periods` (ochranné lehoty), `controlled_substance_log` (OPL), `ekasa_*` (denné uzávierky), `ext_kvepis_credentials`, `lib/kvepis/builder.ts` + `validator.ts`, `lib/crsz/microchip.ts`.
**Reality check (R-05):** KVEPIS je dnes **XML-only** — priame B2G podanie nie je implementované; plánované v0.7. Systém preto nesmie tvrdiť „podané“, keď len vygeneroval XML.

### Trigger

- **Časový cyklus:** mesačná ambulantná kniha (KVEPIS), denná e-Kasa uzávierka, 3-dňové okno pri hlásení besnoty, ročné/mesačné prehľady OPL.
- **Udalosť:** nové očkovanie (besnota), registrácia mikročipu, predaj/presun zvieraťa, znehodnotenie OPL, úhyn a likvidácia (`ext_carcass_disposals`).
- **Externý:** kontrola ŠVPS, žiadosť orgánu, zmena legislatívy.
- **Systémový:** blížiaci sa termín hlásenia alebo chýbajúca šarža.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Ukončí klinickú činnosť dňa (napr. očkovanie) | Systém automaticky vytvorí **zákonné povinnosti** (hlásenie besnoty, záznam OPL, pohyb lieku) s termínom a stavom | Ak chýbajú povinné údaje (šarža, čip) → systém to zobrazí ako blokátor, nie ako „upozornenie“ |
| 2 | Otvorí `/statutory` | Systém zobrazí compliance dashboard: čo je splnené, čo čaká, čo je po termíne (a o koľko) | Ak je niečo po termíne → najvyššia priorita s konkrétnym dôvodom a s krokmi |
| 3 | (KVEPIS) Zvolí mesiac a spustí validáciu | `lib/kvepis/validator.ts` skontroluje dáta voči XSD; systém vypíše chyby s odkazom na konkrétny záznam | Ak sú chyby → systém ponúkne opravu na mieste (nie export „s chybami“) |
| 4 | Vygeneruje XML | Systém vytvorí XML súbor a uloží jeho verziu a hash; stav je „vygenerované, nepodané“ | **Systém musí byť explicitný: podanie je manuálne (R-05)** — nesmie naznačiť, že je odoslané |
| 5 | (CRSZ) Registrácia mikročipu | Validácia ISO 11784/11785 + záznam do `microchip_registrations`; export pre KVL SR (CSV/XML) | Ak je čip už registrovaný inde → prevod vlastníctva (J6) |
| 6 | (OPL) Evidencia | `controlled_substance_log`: príjem, výdaj, podanie, znehodnotenie so svedkom; AI zero-prefill | Ak chýba svedok alebo množstvo → záznam nie je uzavretý a systém ho drží otvorený |
| 7 | (Ochranné lehoty) Kontrola | Systém pri potravinovom zvierati zobrazí ochrannú lehotu a zabráni podaniu bez evidencie (EÚ 2019/6) | Ak sa lehota skracuje/predlžuje podľa lieku → systém pracuje s údajmi lieku, nie s odhadom |
| 8 | (e-Kasa) Uzávierka | Systém vykoná dennú uzávierku (alebo opakuje pri chybe); stav je viditeľný | Ak je uzávierka neúspešná → systém nedovolí vykázať deň ako uzavretý |
| 9 | Mesačný compliance prehľad | Systém vytvorí prehľad: hlásenia, OPL, lehoty, uzávierky, chýbajúce záznamy — podklad pre Annu a pre kontrolu | Ak niektoré povinnosti nie sú pokryté systémom → systém to povie (radšej priznanie než falošná kompletnosť) |

### Alternatívne toky

1. **Zmena legislatívy.** Systém musí mať **verzionované pravidlá** (napr. lehoty hlásenia, XSD verzie) a vedieť, ktorá verzia platila v čase záznamu. Bez toho sa historické záznamy hodnotia dnešnými pravidlami a vzniká falošná „nezhoda“.
2. **Dáta z minulého systému (migrácia).** KVEPIS hlásenia za obdobie pred migráciou musia byť dohľadateľné v importovaných dátach alebo jasne označené ako externé (J-NEW-2).
3. **Chýbajúce povinné údaje u starých záznamov.** Systém musí umožniť **hromadnú opravu** (napr. doplniť chýbajúce šarže) s reportom, čo zostáva neopraviteľné — namiesto blokovania celého exportu.
4. **Kontrola na mieste (ŠVPS) požaduje konkrétne obdobie.** Systém musí vyexportovať dáta za obdobie v zrozumiteľnej forme vrátane dokladov (J30).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie compliance dashboardu | **zodpovednosť a mierny stres** | „Čo ak mi niečo chýba?“ |
| Zelený stav | úľava | Systém je „kontrolór“, ktorý nič nenašiel |
| Chyby v exporte | frustrácia | „Zase musím niečo dohľadávať“ |
| Manuálne podanie | mrzutosť | „Prečo to nemôže odísť samo?“ |
| Kontrola | pokoj | Ak sú dôkazy poruke |

### Kontextové prepojenia

- **Pred:** J13 (očkovanie), J10 (OPL), J11 (e-Kasa), J6 (čip), J24 (sklad).
- **Po:** J30 (kontrola), J25 (reporting), J26 (admin).

### AI Touchpointy

- ✅ **Chceme:** kontrola úplnosti („tomuto záznamu chýba šarža“), vysvetlenie právnej požiadavky ľudskou rečou, návrh krokov pri chybe, súhrn compliance stavu pre majiteľa, upozornenie na zmeny, ktoré sa týkajú praxe.
- ⛔ **Nechceme:** AI, ktorá sama podáva hlásenie úradu; AI, ktorá „doplní“ právne údaje odhadom; AI ako náhrada XSD validácie.

---

### Use Case: UC-128

**Názov:** Plnenie legislatívnych povinností (KVEPIS, CRSZ, OPL, ochranné lehoty, e-Kasa)
**Primárny aktér:** `admin`, `veterinarian`, `technician` (podľa modulu; CRSZ aj `front_desk`)

**Predpoklady:**
- Sú vyplnené potrebné údaje v klinických záznamoch (alebo systém ukáže, čo chýba).
- Je nakonfigurovaná prax (KVEPIS credentials, e-Kasa config, cenník, DPH).
- Používateľ má rolu s prístupom k danému modulu.

**Hlavný scenár:**
1. Systém generuje povinnosti z klinických udalostí (očkovanie, výdaj, predaj, úhyn).
2. Používateľ otvorí compliance dashboard a vidí stav povinností.
3. Pri KVEPIS spustí validáciu, opraví chyby a vygeneruje XML (stav „nepodané“).
4. Pri CRSZ zaregistruje mikročip s validáciou formátu.
5. Pri OPL uzavrie záznamy vrátane svedkov.
6. Pri e-Kase vykoná denné uzávierky.
7. Systém vytvorí mesačný compliance prehľad a (na požiadanie) export dôkazov.

**Alternatívne scenáre:**
- **A1 — Hromadná oprava starých záznamov:** systém ponúkne doplnenie chýbajúcich polí s reportom.
- **A2 — Migrované dáta:** historické záznamy sú označené pôvodom a systém ich nezahŕňa do povinností, ktoré nevie splniť.
- **A3 — Zmena legislatívy:** systém použije verziu pravidiel platnú pre dané obdobie.
- **A4 — Kontrola:** používateľ vyexportuje dôkazy (J30).

**Výnimočné scenáre:**
- **E1 — XSD validácia nájde chybu:** export sa nezablokuje natrvalo; systém zobrazí konkrétne záznamy a umožní opravu a opätovnú validáciu.
- **E2 — Chýbajúce KVEPIS credentials alebo nepridelený prístup:** systém to označí ako blokátor s vysvetlením (nie ako tichú chybu).
- **E3 — Zlyhanie e-Kasa uzávierky:** systém opakuje, viditeľne označí neuzavretý deň a ponúkne manuálny krok.
- **E4 — Neúplný OPL záznam (chýbajúci svedok):** záznam zostáva otvorený a je viditeľný v dennom prehľade; systém nevykáže stav „v poriadku“.

**Postconditions:**
- Povinnosti majú stav (splnené, čaká, po termíne) a sú auditovateľné.
- Vygenerované dokumenty majú verziu a hash (dôkaz, kedy a čo bolo vytvorené).
- Žiadna povinnosť „nezanikne“ bez stopy.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** kniha ošetrení, kniha besnoty, hlásenia, evidencia úhynov a likvidácie, CEHZ, ochranné lehoty.
- **Zákon 139/1998 Z. z.:** evidencia OPL, svedkovia, uchovávanie.
- **Zákon 289/2008 Z. z.:** e-Kasa a uzávierky.
- **EÚ 2019/6:** veterinárne lieky a ochranné lehoty.
- **Zákon 305/2013 Z. z.:** elektronické podanie (ÚPVS/GovBox obálky).
- **Produktové:** systém nesmie simulovať podanie úradu; vždy musí byť jasné, čo je vygenerované a čo podané.

**Dátové entity:** `ext_kvepis_submissions` (W/R), `ext_kvepis_credentials` (R), `microchip_registrations` (W/R), `kvl_cr_passports` (W/R), `pet_passports` (W/R), `ext_rabies_notifications` (W/R), `ext_rabies_observations` (R/W), `ext_withdrawal_periods` (R/W), `controlled_substance_log` (W/R), `ext_carcass_disposals` (W), `ekasa_receipts` (R), `ekasa_daily_closures` (R/W), `vaccination_records` (R), `audit_log` (W).

**Integrácie:** KVEPIS (XSD validácia, XML export; B2G v0.7), CRSZ/KVL, CEHZ, ÚPVS/GovBox, e-Kasa (FiskalPRO/VRP2), ŠVÚ.

---

## J29 — Eutanázia, strata pacienta a sympathy gate

### Persóna & Kontext

**P1 Peter** musí po 12 rokoch povedať majiteľovi, že ďalšia liečba nemá zmysel. **P3 Zuzana** musí potom vyriešiť platbu, doklady a **nesmie poslať „pripomienku očkovania“**. **P5 Katarína** (persona) prežíva stratu zvieraťa, ktoré bolo členom rodiny.
Toto je najcitlivejší journey v celom systéme. Systém tu musí byť **tichý, presný a bez automatizácií**.

### Trigger

- **Klinický:** nevyliečiteľný stav, zlomenina s infaustnou prognózou, zlyhanie orgánov, vek spojený s utrpením.
- **Ekonomický (citlivý):** majiteľ nemá prostriedky na ďalšiu liečbu — systém musí podporiť dôstojné alternatívy, nie „odkliknutie“.
- **Systémový:** pacient je označený ako `deceased` → aktivuje sa sympathy gate na všetkých vrstvách.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Lekár zapíše rozhodnutie o eutanázii | Systém vyžaduje **dôvod a potvrdenie** (nie voľný text „eut“), prípadne druhý názor; pri OPL (napr. pentobarbital) pripraví evidenciu | Ak sa používateľ pokúsi zapísať neúplné údaje → systém drží záznam otvorený |
| 2 | Príprava a podanie | Systém vedie záznam o podaných látkach, dávke, čase a svedkovi; pri OPL zero-prefill a povinný zápis | Ak chýba svedok → záznam zostáva otvorený (právna požiadavka) |
| 3 | Súhlas majiteľa | Systém umožní zaznamenať informovaný súhlas (dátum, forma, kto vysvetlil) — podpísaný dokument alebo záznam o rozhovore | Ak majiteľ nie je prítomný → záznam o telefonickom súhlase a svedkovi |
| 4 | Prepis stavu pacienta | Pacient → `deceased`; **sympathy gate** zablokuje automatizácie: žiadne recally, žiadne wellness, žiadne marketingové kampane, žiadne review requesty | Ak existujú naplánované správy vo fronte → systém ich musí **zrušiť** (nie len preskočiť pri odoslaní) |
| 5 | Komunikácia a starostlivosť o majiteľa | Systém ponúkne kondolenčnú komunikáciu (tlač/e-mail/portál) v citlivom jazyku a s pokynmi (kremácia, likvidácia, čo ďalej) | Ak klinika ponúka podporu (pamiatka, „Rainbow bridge“) → systém to vie evidovať |
| 6 | Zákonná evidencia | `ext_carcass_disposals` (likvidácia), záznam o eutanázii, prípadná KVEPIS/CRZ súvislosť | Ak ide o zviera v registri (chovné, hospodárske) → ďalšie hlásenia |
| 7 | Fakturácia | Systém vytvorí doklad (bez marketingových doplnkov typu „ďalšia návšteva so zľavou“) | Ak klient platí neskôr → `accounts_receivable` bez pripomienky v sympathy režime |
| 8 | Následná starostlivosť | Systém môže evidovať, že klient chce byť kontaktovaný o 3 mesiace (na adopciu/pamiatku) — len ak to klient výslovne chce | Default: **žiadny kontakt** (opt-in, nie opt-out) |

### Alternatívne toky

1. **Klient zmení názor v poslednej chvíli.** Systém musí umožniť bezproblémové zastavenie procesu a vrátenie pacienta do liečby (vrátane prípadnej hospitalizácie J20) bez stigmatizujúcej stopy v karte.
2. **Pacient zomrel bez eutanázie (prirodzená smrť / dovlečený už mŕtvy).** Ten istý sympathy režim, ale iná evidencia: dôvod úhynu, likvidácia a komunikácia. Systém to nesmie miešať s eutanáziou (štatistiky a právny význam sú iné).
3. **Majiteľ chce inú kliniku/druhý názor.** Systém musí podporiť odovzdanie dokumentácie a nesmie brániť odchodu.
4. **Pozostali rodinní príslušníci.** Systém musí vedieť, kto má byť informovaný (a kto nie) — a nesmie zdieľať detaily s kontaktom, ktorý na to nemá právo.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Rozhodnutie | **ťarcha a smútok** | Aj pre lekára je to najťažšie rozhodnutie |
| Vykonanie | profesionalita a ticho | Nie je priestor na administratívu |
| Komunikácia s majiteľom | súcit | Najdôležitejšia veta dňa |
| Evidencia | zodpovednosť | Právna a etická |
| Po odchode klienta | vyčerpanie | Personál potrebuje, aby systém nepridával prácu |
| Nesprávna správa (napr. recall) | **hnev a strata dôvery navždy** | Jedna zlá automatizácia = koniec vzťahu |

### Kontextové prepojenia

- **Pred:** J15 (paliatívna starostlivosť), J20 (úhyn v hospitalizácii), J12 (closeout).
- **Po:** J28 (evidencia likvidácie), J19 (vylúčenie z kampaní), J26 (oprávnenia), J30 (kontrola).

### AI Touchpointy

- ✅ **Chceme:** citlivé texty (kondolenčné, inštrukcie k likvidácii) v overenej šablóne; pripomenutie kontrolného zoznamu pre lekára (čo treba zaznamenať); upozornenie na existujúce automatizácie, ktoré musia byť zrušené.
- ⛔ **Nechceme:** **AI, ktorá komunikuje so zarmúteným majiteľom voľne generovaným textom**; AI, ktorá navrhuje eutanáziu; AI, ktorá sa „snaží pomôcť“ marketingovými správami. Toto musí byť deterministické, overené a minimálne.

---

### Use Case: UC-129

**Názov:** Eutanázia, evidencia úhynu a sympathy režim pre pozostalých
**Primárny aktér:** `veterinarian` (rozhodnutie a výkon), `front_desk` (doklady a komunikácia), `admin` (evidencia)

**Predpoklady:**
- Existuje platná klinická indikácia a záznam o rozhodnutí.
- Je dostupná látka podľa praxe (pri OPL evidencia a svedok).
- Telefónne číslo/kontakt majiteľa je aktuálny.

**Hlavný scenár:**
1. Lekár zaznamená indikáciu a rozhodnutie o eutanázii (s dôvodom a časom).
2. Systém vedie záznam o podaní látok a skontroluje OPL pravidlá.
3. Systém umožní zaznamenať informovaný súhlas majiteľa (forma, dátum, osoba).
4. Systém prepne pacienta do `deceased` a aktivuje sympathy gate naprieč systémom.
5. Systém zruší naplánované automatizácie a správy pre daného pacienta.
6. Systém vytvorí dokumentáciu (eutanázia, likvidácia) a citlivú komunikáciu pre majiteľa.
7. Systém uzavrie fakturáciu bez marketingových doplnkov.

**Alternatívne scenáre:**
- **A1 — Dvojitá kontrola:** klinika môže vyžadovať potvrdenie druhým lekárom (politika praxe).
- **A2 — Prirodzený úhyn:** iná evidencia a štatistika, rovnaký sympathy režim.
- **A3 — Odložené rozhodnutie:** pacient pokračuje v paliatívnej liečbe (J15) s iným plánom.
- **A4 — Klient žiada pamiatku/kontakt neskôr:** opt-in záznam; inak žiadny kontakt.

**Výnimočné scenáre:**
- **E1 — Chýbajúce OPL údaje:** záznam nie je uzavretý; systém ho drží otvorený a viditeľný (nie tiché dokončenie).
- **E2 — Zlyhanie komunikácie s majiteľom (nedovolanie sa):** systém vytvorí úlohu na opakovaný kontakt a zapíše pokusy; nikdy neposiela „e-mail o eutanázii“ ako prvú voľbu.
- **E3 — Chybný stav pacienta (omylom označený ako deceased):** systém musí umožniť korekciu s auditom a obnovu automatizácií (ale s explicitným potvrdením).
- **E4 — Existujúca naplánovaná správa už odoslaná:** systém zaznamená incident a ponúkne ľudskú nápravu (telefonát, ospravedlnenie) — proces pre reputačný incident.

**Postconditions:**
- Existuje kompletná zákonná evidencia (eutanázia/úhyn, likvidácia, OPL ak relevantné).
- Všetky automatizácie pre pacienta sú zrušené a zablokované.
- Majiteľ dostal citlivú, ľudskú komunikáciu a klinika má stopu.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** evidencia eutanázií, likvidácia mŕtvych zvierat, hlásenia pri registrovaných zvieratách.
- **Zákon 139/1998 Z. z.:** OPL evidencia pri pentobarbitale a podobných látkach.
- **GDPR čl. 5:** minimalizácia v komunikácii; kontakt len s osobami, ktoré na to majú právo.
- **Etický princíp produktu:** sympatie > marketing. Vždy.

**Dátové entity:** `soap_notes` (W), `clinical_notes` (W), `controlled_substance_log` (W), `ext_carcass_disposals` (W), `patients` (W — stav), `clients` (R), `communications` (W), `care_reminders` (W — zrušenie), `ext_automation_enrollments` (W — zrušenie), `ext_automation_suppression_log` (W), `ext_marketing_recall_schedules` (W — zrušenie), `invoices`/`payments` (W), `audit_log` (W).

**Integrácie:** OPL evidencia, KVEPIS (pri registrovaných zvieratách), tlač/PDF, portál (sympathy verzia), SMS/e-mail.

---

## J30 — Kontrola ŠVPS / audit a export dôkazov

### Persóna & Kontext

**P7 Anna** o 8:10 dostane telefonát: „dnes o 11:00 prídeme na kontrolu“. Má 3 hodiny na to, aby mala poruke knihu ošetrení, OPL záznamy, ochranné lehoty, KVEPIS podania, e-Kasa uzávierky, a aby vedela povedať, kto kedy pristupoval k záznamom.
**P1 Peter** musí byť schopný obhájiť klinické rozhodnutia (najmä pri AI asistencii).

### Trigger

- **Externý:** kontrola ŠVPS/RVPS, daňová kontrola, ÚOOÚ (GDPR), poisťovňa (revízia), súdny spor.
- **Interný:** vlastný audit, poistná udalosť, sťažnosť klienta.
- **Systémový:** podozrenie na anomáliu (napr. chýbajúce OPL záznamy).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/support` alebo `/admin` a zvolí „pripraviť dôkazy“ | Systém ponúkne balíky: klinická dokumentácia, OPL, ochranné lehoty, KVEPIS, e-Kasa, prístupy, AI inventár | Ak je požadované obdobie nejasné → systém ponúkne rozsah (mesiac/rok/kontrétny pacient) |
| 2 | Vygeneruje výpis klinických záznamov | Systém exportuje SOAP záznamy s dátumami, autormi a (pri AI) provenance údajmi | Ak pri niektorom zázname chýba AI stopa → systém to **označí** namiesto skrývania (R-03) |
| 3 | Vygeneruje OPL a ochranné lehoty | Systém exportuje záznamy `controlled_substance_log` vrátane svedkov a `ext_withdrawal_periods` | Ak niektorý záznam nie je uzavretý → viditeľné v exporte |
| 4 | Vygeneruje compliance balíček | KVEPIS XML + potvrdenia o vygenerovaní (verzia/hash), CRSZ registrácie, hlásenia besnoty, e-Kasa uzávierky | Ak nie je niečo podané → systém jasne uvedie stav (nie „hotovo“) |
| 5 | Vygeneruje prístupový audit | `audit_log`: kto, kedy, k akému záznamu (vrátane čítania a zmien) | Ak bol prístup neoprávnený → systém to musí ukázať; nie je to systémová chyba, je to dôkaz |
| 6 | Vygeneruje AI inventár | Zoznam AI povrchov, modelov, oblastí spracovania a stavu DPA (R-07); `ext_ai_audit_log` s hash reťazou | Ak DPA/región nie je vyriešený → musí to byť viditeľné (dlh sa nemá skrývať) |
| 7 | Uloží a odovzdá kontrolórovi | Systém vytvorí ZIP/PDF balík s kontrolným súčtom a časom; záznam o vytvorení je v audite | Ak kontrola požaduje aj zdroje (napr. XML) → export v strojovom formáte |

### Alternatívne toky

1. **Kontrola príde neohlásene a chce „všetko za posledný rok“.** Systém musí mať „one-click audit bundle“ (jeden klik = balík) — v praxi sa totiž priprava dnes robí ručne 4–8 hodín.
2. **Lekár musí obhájiť AI asistenciu.** Systém musí vedieť ukázať: kto potvrdil, kedy, aký text bol AI a čo lekár zmenil (hash draftu vs. potvrdený obsah). To je **hlavný argument pre governance** — a dnes je neúplný pri najpoužívanejšom AI povrchu (R-03).
3. **Žiadosť o korekciu záznamu z požiadavky klienta (GDPR čl. 16/17).** Systém musí vykonať a zdokumentovať korekciu/obmedzenie spracúvania, s jasným rozsahom.
4. **Poisťovňa/revízia žiada konkrétne ošetrenie.** Systém exportuje klinickú dokumentáciu + položkový rozpis (J11) s väzbou na platby.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Oznámenie kontroly | **panika** | Najhorší typ dňa |
| Príprava dôkazov | úľava (ak systém funguje) | „Za 10 minút mám všetko“ |
| Otázka na AI text | neistota | „Viem to obhájiť?“ |
| Odchod kontrolórov | vyčerpanie a hrdosť | „Prešli sme“ |
| Nájdená medzera | hanba a hnev | Systém mal vedieť, že to chýba |

### Kontextové prepojenia

- **Pred:** J28 (compliance), J25 (reporting), J26 (admin), J11 (doklady).
- **Po:** nápravné úlohy v J28/J26, zlepšenia v J3 (provenance) a J10 (OPL).

### AI Touchpointy

- ✅ **Chceme:** vysvetlenie rozdielov medzi verziami pravidiel, sumarizácia AI stopy pre kontrolóra (v ľudskej reči), rozpoznanie medzier („tomuto záznamu chýba AI provenance“) pred kontrolou, príprava odpovedí na typické otázky kontroly.
- ⛔ **Nechceme:** AI, ktorá generuje „vysvetlenie“ za lekára; AI, ktorá mení alebo dopĺňa dôkazy; AI bez auditu (každý AI výstup použitý pri kontrole musí byť sám auditovaný).

---

### Use Case: UC-130

**Názov:** Príprava auditu a export dôkazov (kontrola ŠVPS, GDPR, daňová kontrola, spor)
**Primárny aktér:** `admin` (príprava), `veterinarian` (odborné otázky)

**Predpoklady:**
- Systém má klinické, skladové, finančné a auditné dáta za požadované obdobie.
- Používateľ má oprávnenie exportovať (admin; pri citlivých dátach obmedzené).
- Je známy rozsah kontroly (aspoň približne).

**Hlavný scenár:**
1. Admin zvolí typ kontroly a obdobie.
2. Systém pripraví balíky: klinická dokumentácia, OPL, ochranné lehoty, KVEPIS, e-Kasa, prístupy, AI inventár.
3. Systém vygeneruje dokumenty a strojové výstupy vrátane kontrolných súčtov.
4. Systém zobrazí medzery a nezhody (chýbajúce polia, neuzavreté záznamy, chýbajúca AI stopa).
5. Admin (a lekár) prejdú nálezy a pripravia vysvetlenia.
6. Systém vytvorí balík a zaznamená jeho vytvorenie (kto, kedy, čo obsahoval).

**Alternatívne scenáre:**
- **A1 — Kontrola konkrétneho pacienta:** balík obsahuje len jeho záznamy a (ak treba) súvisiace doklady.
- **A2 — GDPR žiadosť klienta:** export údajov klienta/pacienta a záznam o vybavení žiadosti.
- **A3 — Revízia poisťovne:** klinická dokumentácia + položkový rozpis + doklady.
- **A4 — Vlastný audit:** manažérske prehľady s dôrazom na riziká (chýbajúce záznamy, OPL, lehoty).

**Výnimočné scenáre:**
- **E1 — Chýbajúce dáta za časť obdobia (výpadok, migrácia):** systém to musí priznať a uviesť rozsah (nie predstierať kompletnosť).
- **E2 — Export príliš veľký (rok, všetci pacienti):** systém ponúkne členenie po mesiacoch alebo komprimovaný balík s limitom; nikdy nespadne bez vysvetlenia.
- **E3 — Zlyhanie generovania PDF (diakritika, fonty):** systém ponúkne iný formát (CSV, XML) a označí problém (známe obmedzenie PDF sanitizácie je v `docs/help/sk/billing-finance.md`).
- **E4 — Neoprávnený pokus o export:** systém vráti `FORBIDDEN` a zapíše pokus do auditu.

**Postconditions:**
- Kontrolór má prehľadný balík s kontrolnými súčtami a vysvetleniami.
- Klinika vie, aké medzery má (a má úlohy na ich odstránenie).
- Vytvorenie exportu je auditované.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.** a súvisiace predpisy: povinnosť predložiť dokumentáciu kontrole.
- **Zákon 431/2002 Z. z.:** uchovávanie účtovných dokladov; nemenné uzávierky.
- **GDPR čl. 15/16/17/30:** prístup, oprava, vymazanie (v rozsahu zákonných povinností), záznamy o spracúvaní.
- **Produktové:** audit balík sa nesmie „upravovať“ — je to výstup, nie dokument na marketing.

**Dátové entity:** `soap_notes` (R), `clinical_notes` (R), `controlled_substance_log` (R), `ext_withdrawal_periods` (R), `ext_kvepis_submissions` (R), `ext_rabies_notifications` (R), `microchip_registrations` (R), `ekasa_receipts`/`ekasa_daily_closures` (R), `invoices`/`payments`/`invoice_items` (R), `financial_closes` (R), `ext_ai_audit_log` (R), `audit_log` (R), `files` (R), `usage_records` (R).

**Integrácie:** export formáty (PDF/CSV/XML/ZIP), AI inventár (model cards), KVEPIS/CRSZ výstupy, e-Kasa dáta.

---

## J-NEW-1 — Prvý deň s OpenVPM AI (setup wizard)

### Persóna & Kontext

**P1 Peter** (konateľ) v nedeľu večer „skúsi tento nový systém“. Má 60–90 minút a nulovú toleranciu k 40-polovému nastaveniu. **P3 Zuzana** musí v pondelok o 8:00 **pracovať**, nie nastavovať.
**Kód:** onboarding je zámerne krátky — `ONBOARDING_JOURNEY_STEPS` = `intent → basics → data → allSet` s poznámkou, že branding, tím, AI, SMS a billing **nestojí medzi registráciou a prvým klientom/termínom** (retired steps sa presúvajú do dashboard checklistu).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Registrácia + voľba zámery („čo chcem prvý“: dnešný deň / klienti / AI ukážka) | Systém prispôsobí onboarding podľa `intent` | Ak si nevie vybrať → systém dá default „dnešný deň“ |
| 2 | Základy: názov praxe, mesto, ordinačné hodiny | Systém vytvorí prax a základný rozvrh; zobrazí, že branding je voliteľný neskôr | Ak používateľ preskočí hodiny → rozvrh sa nastaví na rozumný default s upozornením |
| 3 | Dáta: „prines si históriu“ | Systém ponúkne CSV import (J-NEW-2) **alebo** „začať načisto“; ukáže, že import je bezpečný (dry-run) | Ak nemá export → systém ponúkne začať načisto a import spraviť neskôr |
| 4 | Hotovo: „váš prvý deň je pripravený“ | Systém zobrazí checklist: rozvrh, prvý klient, prvý encounter, prvý doklad, AI ukážka | Ak používateľ chce vidieť AI → onboarding ukážka agenta s reálnymi dátami (ale bez PHI mimo praxe) |
| 5 | Skúšobný deň | Systém vedie (guides) cez reálne obrazovky: rozvrh → check-in → whiteboard → encounter → faktúra (existujúce „See your day“ guides) | Ak niečo nefunguje → systém ponúkne diagnostiku (stav praxe, integrácie) namiesto tichej chyby |
| 6 | Prvé reálne dáta | Systém pri prvom klientovi/pacientovi/encounteri zobrazí kontextové tipy (nie modálne blokovanie) | Ak používateľ preskočí AI → všetko ostatné funguje bez AI |

### Alternatívne toky

1. **Klinika chce migrovať veľký objem (5 000+ pacientov).** Onboarding musí vedieť odkázať na asistovanú migráciu a **nesľubovať** self-serve import tam, kde nemá pokrytie (appointments/faktúry sa neimportujú).
2. **Multi-doctor prax s existujúcimi rolami.** Onboarding musí umožniť pozvať tím hneď po základoch (ale nie ako blokujúci krok).
3. **Self-host inštalácia.** Onboarding začína inak: `db:setup`, RLS, seed SK; používateľ potrebuje kontrolu stavu („je systém zdravý?“) — dnes existuje `agent.status` a diagnostika.
4. **Klinika, ktorá chce len fakturáciu.** Onboarding musí umožniť „začať v jednej oblasti“ bez toho, aby používateľ prešel celým stromom funkcií.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Registrácia | zvedavosť a neistota | „Bude to fungovať?“ |
| Hodiny a prax | úľava | Krátke, konkrétne |
| Import dát | strach | „Nepokazím si históriu?“ |
| Prvý encounter | **radosť** | „Naozaj to ide“ |
| Pondelok o 8:00 | rozhodnutie | Buď systém pomôže, alebo ho klinika opustí |

### Kontextové prepojenia

- **Pred:** žiadny (vstupný journey), prípadne predajný/demo kontakt.
- **Po:** J-NEW-2, J-NEW-3, J26 (používatelia a roly), J7 (prvý termín), J3 (prvý encounter).

### AI Touchpointy

- ✅ **Chceme:** onboarding ukážka na reálnych dátach („spýtajte sa na svojich pacientov“), AI sprievodca nastavením („potrebujete nastaviť DPH? Poviem vám, kde“), kontrola zdravia systému (integrácie, AI dostupnosť, zálohy).
- ⛔ **Nechceme:** AI, ktorá sa snaží „predať“ funkcie počas klinickej práce; AI, ktorá nastavuje ceny alebo dane bez potvrdenia.

---

### Use Case: UC-131

**Názov:** Onboarding novej praxe — od registrácie k prvému reálnemu workflow
**Primárny aktér:** `admin` (zakladateľ praxe)

**Predpoklady:**
- Používateľ má platný účet a oprávnenie založiť prax.
- Pri hosted režime je vyriešené predplatné/trial; pri self-hoste je systém nainštalovaný a databáza pripravená (`db:setup`).

**Hlavný scenár:**
1. Používateľ zvolí zámer a vyplní základné údaje praxe.
2. Systém vytvorí prax, nastaví hodiny a základný rozvrh.
3. Používateľ prinesie dáta (import) alebo zvolí začiatok načisto.
4. Systém dokončí onboarding a zobrazí checklist prvého dňa.
5. Používateľ (prípadne s tímom) prejde prvý reálny workflow: klient → pacient → termín → encounter → doklad.
6. Systém zapisuje stav onboarding krokov a ponúka ďalšie kroky podľa potreby.

**Alternatívne scenáre:**
- **A1 — Veľká migrácia:** systém odkáže na asistovanú migráciu a upozorní na limity self-serve importu.
- **A2 — Tím hneď:** pridanie používateľov a rolí bez blokovania základného toku.
- **A3 — Self-host:** diagnostika stavu systému a databázy.
- **A4 — „Len fakturácia“:** onboarding umožní začať v jednej oblasti.

**Výnimočné scenáre:**
- **E1 — Zlyhanie importu počas onboardingu:** systém zachová možnosť pokračovať bez importu a vrátiť sa k nemu; nikdy nezablokuje prvý deň.
- **E2 — Nesprávne nastavená DPH/mena:** systém upozorní pred prvou faktúrou a nedovolí doklad s neplatnou konfiguráciou.
- **E3 — Nedostupný AI provider:** onboarding funguje bez AI; ukážka AI sa presunie alebo zobrazí stav.

**Postconditions:**
- Prax existuje s rozvrhom, používateľmi a (voliteľne) importovanými dátami.
- Klinika dokáže vykonať prvý reálny workflow.
- Používateľ vie, čo ďalej (checklist), a systém to vie tiež.

**Business pravidlá:**
- **GDPR:** akékoľvek demo dáta musia byť oddelené od reálnych; demo praxe sa nesmú miešať s produkciou.
- **Zákon 289/2008 / 222/2004:** pred prvým dokladom musí byť správne nastavenie fakturácie a DPH.
- **Produktové:** onboarding nikdy nesmie blokovať prvý reálny workflow.

**Dátové entity:** `practices` (W), `users` (W), `locations`/`rooms` (W), `staff_schedules` (W), `settings` (W), `services`/`products` (W — cenník), `migration_runs` (W), `clients`/`patients` (W), `appointments` (W), `audit_log` (W).

**Integrácie:** e-mail (pozvánky, verifikácia), Stripe (trial/predplatné), e-Kasa (inštalácia drivera), AI provider, import nástroje.

---

## J-NEW-2 — Migrácia dát z konkurenčného systému

### Persóna & Kontext

**P7 Anna** má 800 klientov a 1 100 pacientov v starom PIMS (AVImark/Cornerstone/ezyVet/Shepherd/Vetis/Vet-On). Bojí sa, že príde o históriu, a vie, že jedna chyba v importe znamená týždeň opravovania.
**Kód a dokumentácia:** self-serve CSV import podporuje **clients → patients → vaccinations → medical history**, s dry-run reportom, párovaním podľa source ID alebo e-mailu, ochranou proti duplicitám, označením `Imported` a **bez rollbacku** po commite (viď `docs/migrating-to-openvpm.md`).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí Settings → Data → Import | Systém vysvetlí poradie, formáty a limity (čo sa neimportuje: termíny, faktúry, zostatky, aktívne preskripcie, laboratóriá, sklad, pripomienky) | Ak používateľ nemá CSV → systém odkáže na export postup pre jeho systém (AVImark, Cornerstone, ezyVet, Shepherd) |
| 2 | Nahrate klientov (CSV) | Systém spustí **dry-run**: počet riadkov, čo sa importuje, duplicity, rekonciliácie, chyby s číslami riadkov | Ak sú štrukturálne chyby → import sa nevykoná, systém ukáže konkrétne riadky na opravu |
| 3 | Skontroluje report a schváli | Systém commitne presne ten súbor, ktorý schválil administrátor (evidencia zdroja a času) | Ak je súbor iný než kontrolovaný → systém varuje a vyžaduje opätovný dry-run |
| 4 | Import pacientov | Systém páruje podľa source patient ID alebo e-mail klienta; nepárovné riadky **ohlási**, nehádá | Ak sa nájde duplicitný pacient → systém ho označí (nie zlučuje automaticky) |
| 5 | Import očkovaní | Systém páruje podľa pacienta, deduplikuje (rovnaký pacient + vakcína + dátum) a zachová históriu | Ak chýbajú dátumy → riadok sa vynechá s dôvodom |
| 6 | Import medical history | Záznamy sa uložia s pôvodnými dátumami a príznakom `Imported` (viditeľné aj v tlačenom súhrne) | Ak je história v jednom texte bez SOAP sekcií → systém ju uloží do prvej prázdnej sekcie (nezahodí text) |
| 7 | Kontrola dát | Systém ponúkne spot-check: nájsť pacienta, overiť históriu, overiť očkovania, vytlačiť súhrn | Ak výsledok nesedí → zastaviť a vytvoriť korekčný plán (bez opakovania importu naslepo) |
| 8 | (Voliteľne) asistovaná migrácia | OpenVPM Cloud vedie kontrolovanú migráciu s bezpečným prenosom a validačným vzorkom | Ak klinika chce ísť self-serve → musí rozumieť limitom a rizikám |

### Alternatívne toky

1. **Klient má prázdny e-mail (typické v starých systémoch).** Import musí prejsť (párovanie podľa source ID) a systém označí klienta ako „bez kanálu“ s výzvou na doplnenie (J6-A3).
2. **História obsahuje citlivé poznámky o majiteľovi.** Import musí zachovať text, ale v portáli sa zobrazuje len to, čo je určené klientovi (nie všetko) — a to aj pri importovaných textoch.
3. **Starý systém exportuje dátumy v európskom formáte.** Systém musí jasne varovať (`3/5/2019` sa číta ako US formát) a vyžaduje ISO dátumy — chyba v dátumoch znamená posun histórie a zlý recall.
4. **Import sa pokazí (nesprávny stĺpec).** Systém musí mať **rollback plán**: nie je automatický, ale systém vie identifikovať importovanú dávku (`migration_runs`) a vygenerovať plán korekcie. Klinika musí byť o tejto vlastnosti informovaná **pred** commitom.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Nahratie CSV | **úzkosť** | „Rozbijem si dáta“ |
| Dry-run report | úľava | Vidí, čo sa stane |
| Commit | strach | Nevratný krok |
| Spot-check | **hrdosť a úľava** | „História je tam“ |
| Chyba v dátach | panika | „Musím to robiť odznova?“ |

### Kontextové prepojenia

- **Pred:** J-NEW-1, J6 (zakladanie záznamov).
- **Po:** J1 (hľadanie funguje), J13/J14 (očkovania a recally fungujú od prvého dňa), J3 (lekár má históriu).

### AI Touchpointy

- ✅ **Chceme:** mapovanie stĺpcov („toto vyzerá ako číslo čipu“), rozpoznanie formátu dátumu a jeho normalizácia, upozornenie na podozrivé dáta (duplicitné čipy, dátumy narodenia v budúcnosti), sumarizácia importovaného reportu pre netechnického používateľa.
- ⛔ **Nechceme:** AI, ktorá „domyslí“ chýbajúce dáta alebo automaticky zlúči záznamy; AI, ktorá rozhodne o tom, čo je duplicita bez potvrdenia človeka.

---

### Use Case: UC-132

**Názov:** Migrácia klientskych a pacientskych dát z konkurenčného systému
**Primárny aktér:** `admin` (schvaľuje), `technician`/`front_desk` (vykonáva import)

**Predpoklady:**
- Existuje prax v OpenVPM a exportované CSV súbory so stabilnými ID alebo e-mailmi.
- Používateľ má prístup do Settings → Data.
- Klinika rozumie, čo import nepodporuje (termíny, faktúry, zostatky…).

**Hlavný scenár:**
1. Používateľ nahrate CSV a spustí dry-run.
2. Systém zobrazí report: importované/duplicity/nepárovné/chyby.
3. Používateľ opraví štrukturálne chyby a schváli presne kontrolovaný súbor.
4. Systém commitne import s evidencia zdroja a času.
5. Systém označí záznamy `Imported` a doplní históriu vrátane očkovaní.
6. Používateľ vykoná spot-check a prípadne naplánuje doplnenie chýbajúcich dát (manuálne alebo asistovane).

**Alternatívne scenáre:**
- **A1 — Nepárovné pacienty:** systém ich vypíše na ručné riešenie (nikdy ich nepriradí odhadom).
- **A2 — Duplicitné pacienty:** systém rozpozná a ponechá rozhodnutie na používateľa (merge podľa J6).
- **A3 — Asistovaná migrácia:** kontrolovaný prenos s validačným vzorkom a schválením.
- **A4 — Neúplná história:** systém importuje, čo má, a viditeľne označí medzery (napr. chýbajúce váhy/lab).

**Výnimočné scenáre:**
- **E1 — Štrukturálne chyby v CSV:** import sa vykoná len ak je súbor validný; inak sa vráti report s číslami riadkov.
- **E2 — Import je prerušený (výpadok):** systém musí vedieť pokračovať alebo opakovať bez duplikátov (idempotencia podľa zdrojových ID).
- **E3 — Nesprávny dátumový formát:** systém upozorní pred commitom; ak import prebehol, ponúkne nápravu (nie tiché ponechanie).
- **E4 — Chybný commit (zlý súbor):** systém nemá automatický rollback, ale dokáže identifikovať dávku a pripraviť korekčný plán; klinika to musí vedieť vopred.

**Postconditions:**
- Klinika má importovaných klientov, pacientov, očkovania a históriu s pôvodom `Imported`.
- Duplicity a nepárovné riadky sú zdokumentované.
- Nasledujúce kroky sú jasné (doplnenie kontaktov, manuálne dáta mimo rozsahu importu).

**Business pravidlá:**
- **GDPR čl. 5/32:** prenos zdravotných údajov len cez schválený bezpečný kanál; žiadne e-mailové prílohy s reálnymi dátami (explicitne v dokumentácii).
- **Zákon 39/2007 Z. z.:** uchovanie klinickej dokumentácie; história nesmie „zmiznúť“.
- **Produktové:** dry-run vždy pred commitom; `Imported` označenie je povinné; žiadne automatické zlučovanie.

**Dátové entity:** `clients` (W), `patients` (W), `vaccination_records` (W), `soap_notes`/`clinical_notes` (W), `patient_merge_events` (W), `migration_runs` (W/R), `migration_records` (W/R), `files` (W), `audit_log` (W).

**Integrácie:** CSV import, asistovaná migrácia (cloud), bezpečný prenos súborov, backup/restore proces.

---

## J-NEW-3 — Prvý mesiac: od neistoty po „nemôžem bez toho žiť“

### Persóna & Kontext

**Celá klinika.** Deň 1: zvedavosť. Deň 7: „zvládame to“. Deň 30: „prečo sme to nemali skôr“. Alebo opak: frustrácia, návrat k starému systému a strata dôvery.
**Kód:** `usage_records`, `conversion_milestones` (v schéme `conversion-milestones.ts` a `practice_conversion_milestones`), `clinic_pilots`/`clinic_pilot_events`, `ext_pilot_feedback`, `funnel_events` — systém má merateľnú stopu adopcie. Dokument `docs/clinic-pilot-readiness.md` hovorí o pre-pilot gate a o tom, že „pilot-ready ≠ battle-tested“.

### Kroky (Step-by-Step)

| # | Fáza | Čo sa deje | Systém musí |
|---|---|---|---|
| 1 | **Deň 1 (zvedavosť)** | Klinika zadá prvých 5 klientov, jeden termín, jeden encounter. AI je „zaujímavosť“. | Ukázať hodnotu na malom úspechu; nemerať a nehodnotiť; neposielať 20 notifikácií |
| 2 | **Deň 2–3 (trenie)** | Recepcia narazí na to, čo „v starom systéme bolo inde“ (napr. drag-to-reschedule). Lekár zistí, že AI draft treba opraviť. | Mať plnohodnotnú manuálnu cestu; zberať spätnú väzbu cez `ext_pilot_feedback`; neopravovať „predávaním“ |
| 3 | **Deň 4–7 (prvý úspech)** | Recall kampaň prinesie 3 termíny; diktovanie ušetrí 10 min; e-Kasa uzávierka sedí. | Ukázať merateľný výsledok (report), aby hodnota nebola pocitová |
| 4 | **Deň 8–14 (paralelná prevádzka)** | Klinika porovnáva starý a nový systém; vzniká „dvojitá práca“. | Zamerať sa na zrušenie duplicity: dokázať, že export/účtovníčka funguje; dohodnúť cut-off |
| 5 | **Deň 15–21 (rozhodnutie)** | Klinika sa rozhoduje: zostať alebo sa vrátiť. Tu sa láme adopcia. | Pripraviť „dôkaz hodnoty“ (BC čísla z reálnych dát) a identifikovať 3 konkrétne bolesti |
| 6 | **Deň 22–30 (zvyk)** | Stáva sa rutina: whiteboard, diktovanie, portál, reporting. | Zapnúť automatizácie (recall, pripomienky, post-op) a sledovať KPI |

### Alternatívne toky

1. **Klinika začína „všetko naraz“.** Riziko: 3 dni chaosu a návrat k starému systému. Systém musí ponúknuť odporúčanú postupnosť (rozvrh → klienti → encounter → doklad → AI) a nedovoliť „zapnúť všetko“ v jeden deň.
2. **Jeden zamestnanec blokuje adopciu.** Systém musí identifikovať „blokátora“ (najnižšia aktivita) a ponúknuť cielené zaškolenie/pomoc; nie trest.
3. **Vrátia sa k starému systému (regresia).** Systém musí umožniť **návrat bez straty** (export všetkých dát), ale aj viditeľne ukázať, čo sa stratí (recally, portál, AI governance). Toto je otázka dôvery.
4. **Sezónny tlak (leto, sviatky).** Adopcia musí mať „tiché obdobie“ bez veľkých zmien a bez agresívnych notifikácií.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Deň 1 | zvedavosť, mierna neistota | Nová vec v ruke |
| Deň 2–3 | **trenie a frustrácia** | „Toto tu nie je / nie je to tam, kde som zvyknutá“ |
| Deň 4–7 | prvá úľava | „Toto mi naozaj pomohlo“ |
| Deň 8–14 | tlak | Paralelná práca |
| Deň 15–21 | rozhodnutie | Buď–alebo |
| Deň 22–30 | **zvyk a hrdosť** | „Toto už robíme takto“ |

### Kontextové prepojenia

- **Pred:** J-NEW-1, J-NEW-2.
- **Po:** všetky journeys; najviac J7–J12 (denný chod) a J14 (prvý automatický prínos).

### AI Touchpointy

- ✅ **Chceme:** „AI adopčný sprievodca“ (postupne odomykať funkcie podľa zvládnutia, nie podľa ceny), upozornenie na to, kedy je používateľ pripravený na ďalšiu funkciu, meranie reálnej hodnoty („ušetrili ste 3,4 h za týždeň“).
- ⛔ **Nechceme:** AI notifikácie typu „využívate len 20 % funkcií“ ako tlak; AI, ktorá „motivuje“ marketingovými textami počas klinickej práce.

---

### Use Case: UC-133

**Názov:** Riadená adopcia počas prvého mesiaca (od prvého dňa k rutine)
**Primárny aktér:** celá klinika; koordinuje `admin`

**Predpoklady:**
- Klinika dokončila J-NEW-1 a prípadne J-NEW-2.
- Sú definované role; existuje aspoň jeden „šampión“ v klinike.
- Systém má zapnuté meranie používania (`usage_records`, `funnel_events`, `conversion_milestones`).

**Hlavný scenár:**
1. Systém definuje adopčný plán: rozvrh → klienti/pacienti → encounter → doklad → portál → automatizácie → AI.
2. Klinika prejde prvý reálny deň s vedením (guides) a s malým počtom pacientov.
3. Systém sleduje míľniky a upozorní na zaseknutie (napr. „nikto ešte nepoužil closeout“).
4. Na konci prvého týždňa systém zobrazí merateľný prínos a 3 konkrétne problémy.
5. V druhom týždni sa odstráni paralelná práca (cut-off so starým systémom) a zapnú sa automatizácie.
6. Na konci mesiaca klinika vidí KPI (čas na záznam, no-show, konverzia recallu) a rozhodne o rozšírení (AI, portál, reporting).

**Alternatívne scenáre:**
- **A1 — Pomalá adopcia u jedného člena tímu:** cielená pomoc a zjednodušenie jeho časti workflow.
- **A2 — Sezónny tlak:** adopcia sa spomalí, systém neupozorňuje na „nevyužívanie“, len drží stav.
- **A3 — Návrat k starému systému:** export všetkých dát + zoznam toho, čo sa stratí (dôstojný odchod je súčasť dôvery).
- **A4 — Rozšírenie na ďalšiu pobočku:** adopcia sa replikuje s hotovým playbookom.

**Výnimočné scenáre:**
- **E1 — Kritická chyba v prvom týždni:** systém musí mať viditeľný „incident“ proces a priamy kontakt na podporu; pilot musí byť chránený.
- **E2 — Strata dát (obava alebo realita):** systém musí preukázateľne ukázať zálohy a ich stav (`backup_runs`) a podporiť obnovu.
- **E3 — Nový zamestnanec v mesiaci 1:** onboarding človeka musí byť rýchly (role + guides), inak sa adopcia rozpadne.

**Postconditions:**
- Klinika používa systém na denný chod (T1 journeys) bez paralelného vedenia.
- Aspoň jedna automatizácia (recall/pripomienky) beží a má merateľný výsledok.
- Adopcia má dáta, podľa ktorých sa dá zlepšovať produkt (spätná väzba, usage, KPI).

**Business pravidlá:**
- **GDPR čl. 5/25:** minimalizácia pri telemetrii; meranie používania nesmie obsahovať klinický obsah (len udalosti a počty).
- **Zákon 39/2007 Z. z.:** paralelná prevádzka nesmie viesť k strate klinických záznamov (ak sa klinika rozhodne vrátiť, musí mať kompletný export).
- **Produktové:** nikdy nedržať zákazníka dátami (data lock-in ako taktika je zakázaná); dôvera je hlavný moat.

**Dátové entity:** `usage_records` (R), `conversion_milestones`/`practice_conversion_milestones` (R/W), `funnel_events` (R), `clinic_pilots`/`clinic_pilot_events` (R/W), `ext_pilot_feedback` (W), `backup_runs` (R), `audit_log` (R), `subscription`/`stripe_events` (R).

**Integrácie:** support, telemetria, backup systém, e-mail/SMS (komunikácia s klinikou), reporting.

---

## Business Case: Klientský portál, compliance a adopcia

### Status quo

- **Klientský portál dnes neexistuje v 90 % SK ambulancií:** klient nemá prístup k očkovaciemu preukazu, faktúre ani termínu. Všetko ide cez telefón v ordinačných hodinách.
- **Compliance je ručná agenda:** KVEPIS, besnota, OPL kniha, ochranné lehoty sa vedú v zošitoch a Exceli; riziko chyby a pokuty nesie lekár.
- **Onboarding je najväčšia bariéra:** prestup z konkurenčného systému sa v praxi odkladá roky, lebo „nemáme čas na migráciu“. Klinika bez pripraveného migračného procesu často zostane pri starom systéme.
- **Adopcia je neviditeľná:** dodávateľ nevie, kto systém reálne používa, a problémy sa riešia až keď zákazník odchádza.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Menej telefonátov na kliniku (termíny, faktúry, výsledky) | 14 hovorov/deň × 2 min × 0,15 € × 252 | 1 058 € |
| Recepcia: objednávky, ktoré prejdú na portál | 12 termínov/deň × 2,5 min × 0,15 € × 252 | 1 134 € |
| Skoršie inkaso vďaka online platbám + menej upomienok | cash-flow a práca naviac | 2 206 € |
| Onboarding: produktivita namiesto 6 týždňov za 3 | 3 týždne × 5 ľudí × 20 h × 12 €/h | 3 200 € |
| Migrácia: ušetrený čas a zachovaná história | 20 h + retencia 4 klientov × 500 € | 2 278 € |
| Retencia: menej odchodov k konkurencii (portál a komunikácia) | 4,5 klienta × 450 € ročná hodnota | 2 025 € |
| Compliance: menej času na KVEPIS/OPL/CRSZ evidenciu | 2 h/mesiac → 0,5 h | 318 € |
| Predchádzanie pokutám (KVEPIS, OPL, e-Kasa doklady) | expected value | 1 000 € |
| e-Kasa dokladová disciplína (menej chýb a storn) | odhad | 480 € |
| **Spolu (konzervatívne)** | | **13 699 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € | 8 000 € | 6,7× | 55 dní |
| **Cloud Solo** | 588 € | 5 500 € | 9,4× | 39 dní |
| **Cloud Klinika** | 1 428 € | 13 699 € | 9,6× | 38 dní |
| **Cloud Nemocnica** | 2 748 € | 20 000 € (portál pre viac pobočiek, viac compliance) | 7,3× | 50 dní |

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Portál bez hesla (capability token) s rozsahom domácnosti** | Najnižšia adopčná bariéra pre klienta; konkurencia zvyčajne vyžaduje registráciu |
| **Sympathy gate a consent gate ako systémový princíp** | Etická infraštruktúra, ktorá sa nedá „rýchlo dokopírovať“ — je vo všetkých cestách |
| **Onboarding, ktorý nezačína nastavovaním** | Filozofia „prvý užitočný deň“ je v rozpore s tradičnými PIMS implementáciami, ktoré trvajú týždne |
| **Migrácia s dry-run a `Imported` označením** | Dôvera pri prestupe; klinika vidí, čo sa stane, a história sa nezamieša s novými záznamami |
| **Audit balík pre kontrolu** | Odpoveď na „príde kontrola“ za minúty, nie hodiny — a to je vec, ktorú si lekári pamätajú roky |

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Nemám čas na migráciu“ | Odložený prestup o roky | J-NEW-2 s dry-runom, import po krokoch, asistovaná migrácia pre cloud |
| „Klienti nebudú používať portál“ | Recepcia nepropaguje | Portál je voliteľný benefit; SMS s linkom v každom potvrdení termínu |
| „Bojím sa kontroly“ | Strach z KVEPIS/OPL | J28 a J30: povinnosti viditeľné, dôkazy na jeden klik, priznané medzery |
| „Zase nový systém, zase chaos“ | Odpor k zmene | J-NEW-3 s postupným odomykaním; prvý týždeň len základ |
| „Nemám istotu, že ma nepodvediete“ | Nedôvera voči dodávateľovi | Open source, self-host, export dát, ŽIADNY lock-in; to je súčasť pitchu |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Podiel klientov s aktívnym portálom | 0 % | ≥ 40 % | `portal_sessions` / aktívni klienti |
| Podiel online objednávok a platieb | 0 % | ≥ 20 % / ≥ 15 % | `booking`/`portal` vs. celkový objem; `stripe_events` |
| Miera dokončenia onboardingu | n/a | ≥ 85 % | onboarding kroky (`ONBOARDING_JOURNEY_STEPS`) |
| Úspešnosť migrácie (riadky bez chýb) | n/a | ≥ 98 % klientov, ≥ 95 % pacientov | `migration_runs` reporty |
| Čas do prvého reálneho workflow | n/a | ≤ 2 dni (solo), ≤ 7 dní (klinika) | `conversion_milestones` |
| Compliance: položky po termíne | neznámy | 0 | compliance dashboard |
| Čas prípravy auditu | 4–8 h | ≤ 30 min | čas generovania balíka (J30) |
| NPS po 30 dňoch | n/a | ≥ 45 | `ext_pilot_feedback` / prieskum |
| Miera „tichého“ opustenia (churn bez spätnej väzby) | neznáma | < 5 % | subscription + feedback |
