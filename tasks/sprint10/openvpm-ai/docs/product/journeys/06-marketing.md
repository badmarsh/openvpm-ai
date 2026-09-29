# Skupina 6 — Marketing & reputácia (J18–J19)

> **Frekvencia:** T4 (týždenne), roly `admin` / `front_desk` s klinickým schvaľovaním (`veterinarian`).
> Marketing v PIMS nie je „navyše“ — je to kanál, ktorým sa plní rozvrh. **Business Case:** [BC-6](#business-case-marketing--reputácia).

---

## J18 — Tvorba a schválenie obsahu (content queue)

### Persóna & Kontext

**P3 Zuzana** má 20 minút v utorok popoludní na to, aby pripravila obsah na týždeň. Nie je copywriterka a nikdy nechcela byť. **P7 Anna** schvaľuje, čo ide von — nesie reputačné riziko. **P1 Peter** nechce vidieť marketingové texty, ktoré sľubujú klinické výsledky.
**Kód:** `marketing.generatePost` / `lib/marketing/composer.ts` (s deterministickým `localCompose()` fallbackom), `validateMarketingText()` (block/warn pred publikáciou), content queue s `approveContentItem` a dávkovým schvaľovaním (`createContentBatch`/`approveContentBatch`), `ext_marketing_content_items`, media assets s AI generovaním, `generateIllustration` (deterministické SVG, „AI Canvas“ v UI).

### Trigger

- **Časový cyklus:** týždenný content plán (`/marketing/plan`, `ext_content_pillars`, `ext_content_briefs`).
- **Sezónny:** jarné/letné riziká (kliešte, horúčavy), Vianoce, „mesiac prevencie“.
- **Klinický:** aktuálna téma z praxe (napr. zvýšený výskyt parazitov) — chrániť pred strašením.
- **Externý:** recenzia, otázka klienta, mediálna téma.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/marketing` a zvolí tému alebo plán | Systém zobrazí plán s témami, kanálmi a stavmi (nápad → draft → na schválenie → publikované) | Ak je plán prázdny → CTA „vygenerovať 4 témy na tento mesiac“ |
| 2 | Spustí generovanie textu | `marketing.generatePost` vytvorí text podľa faktov kliniky a témy (alebo deterministický `localCompose`); voliteľne obrázok/ilustráciu | Ak AI nie je dostupná → systém vygeneruje lokálny text a označí `usedAi: false` |
| 3 | Vyberie médium | AI obrázok (generovaný), ilustrácia (SVG v brand farbách), alebo fotografia pacienta (s kontrolou súhlasu `ext_marketing_media_consents`) | **Ak fotografia obsahuje pacienta → systém vyžaduje súhlas majiteľa** (nie „checkbox“ bez dátumu) |
| 4 | Upraví text | Editor s validáciou `validateMarketingText()` — blokuje Rx tvrdenia, sľuby liečby, nevhodné garancie | Ak validácia blokuje → text sa nedá publikovať (nie len varovanie) |
| 5 | Pošle na schválenie | Obsah prejde do schvaľovacej queue; schvaľuje admin/vet; systém zapíše AI audit pri generovaní | Ak schvaľuje `front_desk` sám → systém to nedovolí pri klinicky citlivej téme (policy musí byť explicitná) |
| 6 | Publikuje (alebo naplánuje) | Publikácia do kanálov (sociálne siete, web, TV v čakárni `/marketing/tv`, handouts) alebo naplánovanie | Ak kanál nie je pripojený → systém ponúkne manuálne stiahnutie a skopírovanie |
| 7 | Sleduje výsledok | Prehľad: dosah, reakcie, spomínané témy, počet inquiry cez web (`ext_marketing_website_inquiries`) | Ak obsah nefunguje → systém navrhne inú formu (video, handout) |

### Alternatívne toky

1. **Text je klinicky problematický** (napr. „táto vakcína 100 % ochráni“). Validátor musí blokovať a vysvetliť, prečo — nie len „text je neplatný“. Klinická zodpovednosť je nad marketingom.
2. **Fotografia pacienta bez súhlasu.** Systém musí médium označiť ako „neschválené na použitie“ a nesmie ho dovoliť priradiť k príspevku. Súhlas musí mať dátum, rozsah (kanály) a možnosť odvolania (`ext_marketing_media_consents`, `ext_marketing_handouts`).
3. **Krízová komunikácia** (napr. podozrenie na nákazu v okolí, medializovaná kauza). Systém musí mať „tichý režim“ — zastaviť plánované príspevky a umožniť pripraviť jedno oficiálne vyjadrenie. Bez toho klinika v kríze zverejní „Veselé Vianoce“.
4. **AI vygeneruje obrázok so skreslenou anatómiou** (typický problém generatívnych modelov). Systém musí mať možnosť označiť médium ako nevhodné a nahradiť deterministickou ilustráciou, ktorá je vždy anatomicky neutrálna.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie plánu | **odpor a „nemám čas“** | Marketing je pre recepciu „povinnosť navyše“ |
| Generovanie | prekvapenie, úľava | „Za 30 sekúnd mám text“ |
| Validácia | mierna frustrácia | „Prečo mi to zakazuje?“ — treba vysvetlenie |
| Schvaľovanie | napätie | Kto nesie zodpovednosť? |
| Publikácia | hrdosť | „Klinika vyzerá profesionálne“ |

### Kontextové prepojenia

- **Pred:** J19 (segmentácia a kampane), J14 (recall ako obsahový zdroj), J25 (reporting).
- **Po:** J19 (recenzie a reputácia), J27 (portál ako kanál), J7 (inquiry → termín).

### AI Touchpointy

- ✅ **Chceme:** generovanie textov v slovenčine s klinickou validáciou, sezónne návrhy, preklad odborného textu do ľudskej reči, alt-texty pre prístupnosť (`suggestMediaAltText`), FAQ pre web (`suggestWebsiteFaq`), odpovede na recenzie ako **draft** (`generateReviewReply` + `approveReviewReply`).
- ⛔ **Nechceme:** AI publikujúca bez schválenia; AI používajúca pacientove fotky alebo dáta bez súhlasu; AI, ktorá vkladá do promptu voľný text z externého zdroja bez ohraničenia (recenzia je cudzí vstup, audit F-X3-2); AI sľubujúca klinické výsledky.

---

### Use Case: UC-118

**Názov:** Vytvorenie, validácia a schválenie marketingového obsahu
**Primárny aktér:** `front_desk` (tvorba), `admin`/`veterinarian` (schválenie)

**Predpoklady:**
- Klinika má vyplnený brand kit (`/marketing/brand-kit`) a základné fakty o praxi.
- Existuje content plán alebo aspoň téma; kanály sú nakonfigurované alebo sa obsah pripravuje na manuálne použitie.
- Pri médiách s pacientmi existuje súhlas (`ext_marketing_media_consents`).

**Hlavný scenár:**
1. Používateľ zvolí tému z plánu alebo zadá vlastnú.
2. Systém vygeneruje text (AI) alebo použije deterministický fallback.
3. Používateľ vyberie médium (AI obrázok, ilustráciu, fotografiu so súhlasom).
4. Systém validuje text; pri blokujúcich zisteniach nedovolí publikáciu.
5. Používateľ pošle obsah na schválenie.
6. Schvaľujúca rola obsah schváli alebo zamietne s dôvodom.
7. Systém publikuje alebo naplánuje publikáciu a zapíše AI audit.

**Alternatívne scenáre:**
- **A1 — Bez AI:** deterministický lokálny text je plnohodnotná alternatíva; musí byť označený ako „bez AI“.
- **A2 — Krízový režim:** systém zastaví plánované publikácie a umožní pripraviť jedno vyhlásenie.
- **A3 — Médium so súhlasom na obmedzené kanály:** systém rešpektuje rozsah súhlasu (napr. len web, nie sociálne siete).
- **A4 — Obsah zameraný na prevenciu (nie marketing):** systém umožní publikovať v režime edukácie s inou validáciou (bez CTA na konkrétny produkt).

**Výnimočné scenáre:**
- **E1 — AI generovanie zlyhá/vráti nesprávny jazyk:** systém ponúkne fallback a nepublikuje; text sa nesmie uložiť ako „hotový“.
- **E2 — Kanál nie je dostupný (API zmena/odpojenie):** systém uloží obsah ako „pripravený na manuálne publikovanie“ a upozorní; nesmie tvrdiť, že bolo publikované.
- **E3 — Zlyhanie validácie (chyba v pravidlách):** obsah sa nesmie publikovať „naslepo“; systém radšej blokuje a vytvorí internú úlohu.

**Postconditions:**
- Obsah je buď publikovaný/naplánovaný, alebo uložený s jasným stavom a dôvodom.
- Médiá majú zdokumentovaný súhlas a rozsah použitia.
- AI generovanie má záznam v `ext_ai_audit_log` (`marketing_content`).

**Business pravidlá:**
- **GDPR čl. 6/9:** fotky pacientov a údaje klientov len so súhlasom; právo odvolania sa musí prejaviť (obsah stiahnuť).
- **Zákon 362/2011 / EÚ 2019/6 (reklama na lieky):** zákaz reklamy na lieky na predpis a klinických sľubov; validátor to musí vynucovať.
- **Sympathy gate:** žiadny marketingový obsah, ktorý by mohol zasiahnuť rodinu po úhyne pacienta v kontexte ich pacienta.
- **Produktové:** žiadny obsah neide von bez schválenia; AI nikdy nepublikuje priamo.

**Dátové entity:** `ext_marketing_content_items` (W/R), `ext_marketing_content_batches` (W), `ext_marketing_media_assets` (W), `ext_marketing_media_consents` (R/W), `ext_content_pillars` (R), `ext_content_briefs` (R/W), `ext_marketing_handouts` (W), `ext_marketing_tv_slides` (W), `ext_ai_audit_log` (W), `audit_log` (W).

**Integrácie:** sociálne siete (ak sú pripojené), web builder (`ext_marketing_website_config`), AI text/obrázok, storage médií, TV slides.

---

## J19 — Kampaň, segmentácia a reputácia (recenzie, recall kampaň)

### Persóna & Kontext

**P7 Anna** chce vedieť, ktorí klienti prinesú najviac hodnoty a ktorí odchádzajú. **P3 Zuzana** chce, aby jej systém povedal, komu presne napísať — nie aby jej dal zoznam 1 200 ľudí.
**Kód:** `crm-segments`, `lib/crm`, `automation-*` routers (`ext_automation_journeys`, `ext_automation_enrollments`, `ext_automation_rules`, `ext_automation_suppression_log`), `crmSegment`-based suppression, recenzie (`ext_marketing_reviews`, `generateReviewReply`, `approveReviewReply`), `runCompetitorAnalysis` (verejné dáta konkurencie — **nie PHI**).

### Trigger

- **Obchodný:** potreba naplniť kapacitu (napr. mäkký týždeň), sezónna kampaň, uvedenie novej služby (dental, J? v module `dental`).
- **Retenčný:** klient nebol 12 mesiacov (`crm-segments` „churn risk“), pacient nedokončil liečbu.
- **Reputačný:** nová recenzia (pozitívna/negatívna), pokles hodnotenia.
- **Systémový:** automatizačný journey (`automation-journeys`) na základe udalosti (napr. po operácii → post-op check-in).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí segmenty | Systém zobrazí segmenty s počtami (aktívni, spíaci, churn risk, po operácii, chronickí, noví) | Ak segment obsahuje < 10 ľudí → kampaň nemá zmysel, systém to povie |
| 2 | Vyberie segment a cieľ kampane | Systém ponúkne šablónu a kanál; zobrazí očakávaný dopad a náklady (SMS cena, AI overage podľa `plans.ts`) | Ak náklad presahuje očakávaný prínos → systém varuje (transparentnosť) |
| 3 | Skontroluje vylúčenia | Systém aplikuje suppression log, sympathy gate, consent gate a CRM suppression | Ak je vylúčených > 25 % segmentu → systém to vysvetlí (zdravý signál, nie chyba) |
| 4 | Pripraví text (AI alebo šablóna) | Text je na schválenie; personalizácia len na úrovni povolených polí (meno zvieraťa pri súhlase) | Ak je AI text klinicky citlivý → schvaľuje lekár |
| 5 | Spustí journey | Udalosť enrolluje klientov, krok sa vykoná podľa plánu; log sa zapisuje | Ak krok zlyhá (doručenie) → retry a fallback; journey nie je „ticho mŕtvy“ |
| 6 | Sleduje výsledok | Report: doručené, konverzie, prínos v €, odhlásenia, sťažnosti | Ak je sťažnosť → zastavenie journey a manuálne riešenie |
| 7 | Rieši recenzie | Systém zobrazí recenzie, pripraví draft odpovede (AI), schválenie a publikácia; pri negatívnej recenzii eskaluje majiteľovi | Ak je recenzia o klinickej chybe → **nikdy** automatická odpoveď; eskaluje lekár/admin |
| 8 | (Voliteľne) Competitor analysis | Systém prejde verejné dáta konkurencie (bez PHI) a vytvorí snapshot pre positioning | Ak dáta chýbajú → nevyvodzovať závery; len zaznamenať |

### Alternatívne toky

1. **Negatívna recenzia ako prvá reakcia klienta.** Systém musí mať eskaláciu: notifikácia majiteľovi, možnosť zavolať klientovi (kontakt z karty), a **žiadnu automatickú odpoveď**. Reputácia sa nezachraňuje textom, ale kontaktom.
2. **Journey, ktorá sa zasekne (chybný krok, zmenená šablóna).** Systém musí viditeľne zobraziť zaseknuté enrollmenty a ponúknuť ich dokončenie; ticho zaseknutá automatizácia je horšia než žiadna.
3. **Klient sa sťažuje na komunikáciu („prestaňte mi písať“).** Systém musí okamžite zastaviť všetky journeys a zapísať to do suppression; pri ďalšom pokuse musí blokovať aj manuálne odoslanie.
4. **Meranie prínosu kampane.** Bez priradenia konverzií systému chýba odpoveď na „vyplatilo sa to?“. Systém musí párovať kampaň → termín → faktúru (nie len „odoslané“).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Výber segmentu | **kompetencia** | „Konečne mám prehľad“ |
| Vylúčenia | dôvera | „Systém ma chráni pred trapasom“ |
| Spustenie | netrpezlivosť | Čakanie na výsledok |
| Výsledok | hrdosť / sklamanie | Podľa konverzie |
| Negatívna recenzia | **stres a strach** | Reputačné riziko |

### Kontextové prepojenia

- **Pred:** J18 (obsah), J14 (recall), J12 (closeout → post-op a review request).
- **Po:** J7 (termíny), J25 (analytika), J27 (klient vidí komunikáciu).

### AI Touchpointy

- ✅ **Chceme:** segmentácia s vysvetlením („títo ľudia odišli po zvýšení ceny“), návrh textov podľa segmentu, sumarizácia recenzií (témy chvály a sťažností), predikcia churnu, návrh A/B testov, automatické meranie prínosu.
- ⛔ **Nechceme:** AI odpovedajúca na recenzie bez schválenia, AI pracujúca s klinickými údajmi v marketingových promptoch, AI kombinujúca dáta pacientov s verejnými dátami konkurencie.

---

### Use Case: UC-119

**Názov:** Cielená kampaň, automatizovaná journey a správa reputácie
**Primárny aktér:** `admin`, `front_desk`; schvaľovanie klinického obsahu `veterinarian`

**Predpoklady:**
- Existujú segmenty (`ext_crm_segments`) s členmi (`ext_crm_segment_memberships`).
- Sú evidované súhlasy a suppression log.
- Kanály (SMS/e-mail) sú nakonfigurované, alebo sa kampaň vedie manuálne.

**Hlavný scenár:**
1. Používateľ vyberie segment a cieľ kampane.
2. Systém vyhodnotí vylúčenia (súhlas, sympathy, suppression, sťažnosti).
3. Systém pripraví obsah a náhľad personalizácie; pri klinicky citlivej téme vyžaduje schválenie lekárom.
4. Systém spustí odosielanie alebo journey a loguje kroky.
5. Systém meria konverziu (termín, návšteva, tržba) a odhlásenia.
6. Reputačná časť: systém spracuje recenzie, pripraví drafty odpovedí, schvaľuje a publikuje (alebo eskaluje).

**Alternatívne scenáre:**
- **A1 — Nízka konverzia:** systém navrhne inú fázu (telefonát, iný text, iný čas).
- **A2 — Automatická journey na udalosť:** po closeoute sa pošle post-op check-in s `/postop/[id]`; pri „obava“ eskaluje lekárovi.
- **A3 — Negatívna recenzia:** eskalácia, žiadna automatická odpoveď; možný manuálny kontakt.
- **A4 — Competitor snapshot:** systém vytvorí prehľad verejných dát bez PHI.

**Výnimočné scenáre:**
- **E1 — Dvojité odoslanie (retry + úspech):** systém musí mať idempotenciu (requestId) a klient nesmie dostať správu dvakrát.
- **E2 — Journey zaseknutá na chybnom kroku:** systém viditeľne označí zaseknuté enrollmenty a ponúkne ich opravu/dokončenie.
- **E3 — Odvolanie súhlasu počas kampane:** systém musí okamžite zastaviť ďalšie kroky pre daného klienta a zaznamenať to.
- **E4 — Zneužitie AI (prompt injection cez text recenzie alebo web inquiry):** systém obmedzí a obalí cudzí text; pri podozrení na vloženú inštrukciu odpoveď zablokuje a eskaluje.

**Postconditions:**
- Kampaň má merateľný výsledok a rešpektuje všetky súhlasy.
- Journey má stav (aktívna, dokončená, zaseknutá, zastavená) a log.
- Recenzie majú zdokumentovanú odpoveď vrátane schválenia; negatívne prípady majú eskaláciu.

**Business pravidlá:**
- **GDPR čl. 6/7/21:** súhlas a právo namietať; pri odvolaní súhlasu okamžité zastavenie.
- **Zákon 18/2018:** spracúvanie osobných údajov na marketingové účely, informačná povinnosť.
- **Zákon 362/2011 + EÚ 2019/6:** zákaz reklamy na lieky na predpis, obmedzenia klinických tvrdení.
- **Etický princíp produktu:** sympathy gate a zákaz zneužitia citlivých situácií (úhyn, sťažnosť, spor).

**Dátové entity:** `ext_crm_segments` (R/W), `ext_crm_segment_memberships` (R), `ext_automation_journeys` (R/W), `ext_automation_rules` (R/W), `ext_automation_enrollments` (W/R), `ext_automation_events` (W), `ext_automation_suppression_log` (W), `ext_marketing_reviews` (R/W), `ext_marketing_message_logs` (W), `ext_marketing_competitor_snapshots` (W), `communications` (W), `appointments` (R/W), `invoices` (R pre meranie prínosu), `ext_ai_audit_log` (W).

**Integrácie:** SMS/e-mail provider, hypoteticky sociálne siete, Google recenzie (ak integrácia existuje/manuálne), AI text, portál.

---

## Business Case: Marketing & reputácia

### Status Quo

**Typická slovenská klinika** dnes marketing „nemá“ alebo ho robí v pauzách: Facebook bez plánu, fotky z mobilu, občas príspevok, žiadne meranie. Recenzie sa sledujú náhodou a odpovedá sa na ne neskoro (alebo vôbec).
**Dôsledky:**

- Klinika má **prázdne kapacity** (napr. utorok dopoludnia), ale nemá kanál, ako ich zaplniť bez zliav.
- **Nový klienti** prichádzajú hlavne odporúčaním, ktoré sa nedá riadiť; spokojní klienti nie sú požiadaní o recenziu v momente najvyššej spokojnosti (po úspešnej liečbe).
- **Spiace skupiny** pacientov nie sú oslovené: klienti, ktorí neboli 12 mesiacov, sa nevrátia, lebo „nič ich neoslovilo“.
- Obsah zaberá recepcii 2–4 hodiny mesačne; kvalita je nízka; klinicky rizikové formulácie vznikajú bez kontroly.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Ušetrený čas na prípravu obsahu (AI generovanie + schvaľovanie) | 2,5 h/mesiac mix recepcia+lekár | 420 € |
| Nahradenie plateného nástroja na plánovanie a šablóny | ~25 €/mesiac | 300 € |
| Nové návštevy z cielenej komunikácie (6/mesiac) | 6 × 46 € | 3 312 € |
| Reputácia: zlepšenie hodnotenia → viac nových klientov (2/mesiac) | 2 × 46 € × 12 (konzervatívne polovica opakovateľná) | 1 656 € |
| Zaplnenie prázdnych kapacít (mäkké hodiny) | 2 termíny/mesiac × 46 € | 1 104 € |
| Ušetrený čas na prípravu podkladov pre tlač (handouts, TV) | 1 h/mesiac | 101 € |
| **Spolu (konzervatívne)** | | **6 893 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € | 3 500 € | 2,9× | 125 dní |
| **Cloud Solo** | 588 € | 3 000 € (menšia klientela, lokálny trh) | 5,1× | 72 dní |
| **Cloud Klinika** | 1 428 € | 6 893 € | 4,8× | 76 dní |
| **Cloud Nemocnica** | 2 748 € | 11 000 € (viac pobočiek, viac obsahu, viac kanálov) | 4,0× | 91 dní |

**Poznámka:** Marketing má najdlhšiu návratnosť, ale **najnižšie náklady na adopciu** (neruší klinický workflow). Pre kliniku, ktorá sa bojí AI v klinike, je to ideálny prvý „dôkaz hodnoty“ (J-NEW-3).

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Marketing napojený na klinické dáta v rámci consent modelu** (recall z vakcinácie, post-op check-in) | Konkurencia predáva „SMS kampane“; tu je kampaň dôsledok klinickej udalosti a je eticky vybavená (sympathy gate, suppression) |
| **Content queue so schvaľovaním a klinickou validáciou** | V SK kontexte je to rozdiel medzi „Facebook kliniky“ a komunikáciou, ktorá neporušuje pravidlá o liekoch |
| **Meranie prínosu kampane na tržby** (nie na počet odoslaných správ) | Vie presvedčiť majiteľa, ktorý „marketingu neverí“ |
| **Vestavěný web builder a TV v čakárni** | Viac povrchov pre jednu prácu (jeden text → web, sociálne siete, TV, handout) |

**Kde konkurencia vyhráva:** hotové napojenia na sociálne siete a zrelé CRM; OpenVPM má technicky dobrý základ, ale integrácie s kanálmi sú slabšie než u špecializovaných nástrojov.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Marketing pre nás nie je priorita“ | Nikto to nepoužíva | J19 začína automatickými, na udalosti viazanými správami (post-op, recall), ktoré nevyžadujú plánovanie |
| „Bojím sa, že pošleme niečo nevhodné“ | Strach z omylu | Náhľad, schválenie, sympathy a consent gate, vylúčenia viditeľné pred odoslaním |
| „Nevyrábajme spam“ | Etický odpor | Frekvenčné limity a viditeľný počet kontaktov na klienta za posledných 90 dní |
| „Nemáme fotky“ | Nedostatok obsahu | Deterministické ilustrácie v brand farbách (bez rizika falošnej anatómie) |
| „Neviem to merať“ | Nedôvera | Report s prínosom v € pri každej kampani |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Počet nových klientov z digitálnych kanálov | 10–15/mesiac | ≥ 25/mesiac | `funnel_events`, `ext_marketing_website_inquiries`, zdroj pri zakladaní |
| Konverzia kampane na termín | 0 % | ≥ 12 % | kampaň → `appointments` |
| Priemerné hodnotenie recenzií | 4,1–4,4 | ≥ 4,6 | `ext_marketing_reviews` agregát |
| Čas odpovede na recenziu | 3–10 dní | < 24 h (draft), publikácia podľa schválenia | čas od prijatia po odpoveď |
| Miera odhlásení z komunikácie | neznáma | < 1,5 % | `sms_suppressions`, e-mail preferencie |
| Počet obsahu za týždeň | 0–1 | ≥ 3 | `ext_marketing_content_items` stav publikované |
| Náklad na AI behy v marketingu | neznámy | meraný, v rámci AI allowance | `usage_records` |
