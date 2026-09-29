# Skupina 7 — Nemocnica, chirurgia, urgent a telemedicína (J20–J23)

> **Toto sú nové journeys.** V kóde dnes neexistuje modul hospitalizácie, chirurgie, triáže ani telemedicíny
> (R-02). Existujú len stavebné kamene: `cases`/`case_entries` (epizóda starostlivosti), `whiteboard`,
> `vital_signs`, `visit_closeouts`, `treatment_templates`, `controlled_substance_log` (anestetiká),
> `inventory` (materiál), `ext_dental` (vzor pre procedurálny modul), verejný `/postop/[id]`.
> **Táto skupina je dôvod, prečo klinika s hospitalizáciou dnes nemôže prejsť na OpenVPM — a zároveň
> najväčšia príležitostná hodnota pre tier Nemocnica.** **Business Case:** [BC-7](#business-case-nemocnica--urgent).

---

## J20 — Hospitalizácia (príjem → denné záznamy → prepustenie)

### Persóna & Kontext

**P1 Peter** prijíma pacienta po nočnej kolike: „zostáva na infúziách, kontrolovať každé 4 hodiny“. **P4 Martin** je ten, kto o 22:00, 2:00 a 6:00 meria, zapisuje a nastavuje infúziu. **P7 Anna** potrebuje na konci mesiaca vedieť, koľko hospitalizačných dní bolo vyúčtovaných a koľko ich „zmizlo“.
**Problém status quo:** hospitalizácia sa dnes vedie na papieri alebo v exceli („hospitalizačná kniha“), infúzie sa počítajú v hlave a vyúčtovanie je improvizácia. Nočné zmeny sú tam, kde sa najčastejšie strácajú informácie.

### Trigger

- **Klinický:** pacient vyžaduje observáciu alebo kontinuálnu liečbu (infúzie, kyslík, pooperačná starostlivosť).
- **Chirurgický:** pooperačný monitoring (J21) — hospitalizácia je pokračovanie zákroku.
- **Externý:** pacient privezený z inej kliniky alebo od majiteľa „nemôžem sa oňho starať 24 h“.
- **Systémový:** lekár pri closeoute zvolí „pacient zostáva na klinike“.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Lekár zvolí „prijať na hospitalizáciu“ (z encounteru alebo whiteboardu) | Systém vytvorí **case** (`cases`) typu hospitalizácia s väzbou na pacienta, primárneho lekára, dôvod a predpokladanú dĺžku; pacient sa objaví na **hospitalizačnej tabuli** | Ak je pacient už hospitalizovaný → systém zabráni duplicite a prepojí nový záznam na existujúci case |
| 2 | Lekár zadá plán: lieky, infúzie, monitorovanie, frekvenciu vitálnych | Systém rozloží plán na **úkony s časmi** („každé 4 h: T, P, dýchanie“; „infúzia 250 ml / 8 h“) a vytvorí úlohy pre zmeny | Ak liek nie je na sklade → okamžitá väzba na J24 (objednávka) a upozornenie na riziko |
| 3 | Systém skontroluje lieky | Clinical Guardian (J5) + dávkovanie + kontraindikácie; pri OPL (napr. fentanyl, ketamín, morfín) evidencia podľa zákona 139/1998 | Ak ide o OPL → zero-prefill AI, povinný záznam dávky a svedka pri znehodnotení |
| 4 | Technik/lekár počas zmeny plní úlohy | Systém zobrazuje **zoznam úkonov na najbližšie 2 hodiny**, ktoré sa „odškrtávajú“ s časom podania a menom | Ak je úkon vynechaný alebo po termíne → systém to zvýrazní a vyžaduje dôvod (napr. pacient spí, zvracal) |
| 5 | Záznam vitálnych | `vital_signs` s časovou stopou a automatickým prepočtom (napr. vzorce pre tekutiny); graf priebehu | Ak je hodnota kritická → okamžitá notifikácia lekára (nie až ráno) |
| 6 | Zmena stavu pacienta | Lekár upraví plán; systém verzionuje zmeny („zvýšiť infúziu na 300 ml/8 h o 22:15, MVDr. Hric“) a notifikuje zmenu na ďalšiu zmenu | Ak je pacient v zlom stave → systém ponúkne eskaláciu (J22 urgent / J21 chirurgia) |
| 7 | Ranné vizity | Systém vygeneruje **zhrnutie za 24 h**: vitálne trendy, podané lieky, vynechané úkony, bilancia tekutín, bolesť | Ak údaje chýbajú → vizita musí vidieť „chýba 3× meranie“ (nie tichú medzeru) |
| 8 | Prepustenie | Prepúšťacia správa (J21/J12), plán domácej liečby, kontrola, fakturačné podklady (hospitalizačné dni, lieky, materiál) | Ak klient nemôže prevziať pacienta → stav „čaká na prevzatie“ s inou komunikáciou |
| 9 | Úhyn počas hospitalizácie | Sympathy gate, evidencia likvidácie (`ext_carcass_disposals`), komunikácia s majiteľom podľa postupu | Systém **nikdy** neposiela automatizované marketingové správy a mení jazyk komunikácie (J29) |

### Alternatívne toky

1. **Nočná zmena „nevidí“ plán.** Ak hospitalizačná tabuľa nie je v mobile/tablete dostupná, prežije len to, čo si ľudia povedia. Systém musí mať mobile-first zobrazenie úkonov a fungovať pri zlom Wi-Fi (PWA, offline queue).
2. **Klient chce pacienta vidieť / volá o 23:00.** Systém potrebuje krátky „hospitalizačný denník“ pre klienta (portál): ako mu je, čo dostal (bez vnútorných detailov), kedy zavolať. Ideálne raz denne aktualizovaný — bez toho recepcia strávi hodiny na telefóne.
3. **Pacient zostáva dlhšie ako plán.** Systém musí rozpoznať odchýlku od plánovanej dĺžky a upozorniť na potrebu prehodnotenia (a na fakturačné a kapacitné dôsledky — počet lôžok).
4. **Dva pacienti a jeden prístroj (napr. jedno oxygen box).** Systém musí vidieť kapacitu (lôžka, prístroje) a neumožniť prijatie, ktoré nemá kde umiestniť.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Prijatie | zodpovednosť a tlak | Rozhodnutie, ktoré zmení deň aj noc |
| Nočná zmena | **únava a samota** | Musí sa spoľahnúť na systém, lebo nikto nie je pri tom |
| Kritická hodnota | strach | Najvyššie riziko, najmenej podpory |
| Ranná vizita | úľava / frustrácia | Podľa toho, či sú dáta kompletné |
| Prepustenie | uspokojenie | „Zvládli sme to“ |
| Úhyn | smútok a profesionalita | Musí byť dôstojné, nie administratívna úloha |

### Kontextové prepojenia

- **Pred:** J3 (encounter), J21 (chirurgia), J22 (urgent), J12 (closeout „zostáva na klinike“).
- **Po:** J21 (pooperačná starostlivosť), J15 (kontrola), J11/J25 (fakturácia hospitalizačných dní), J27 (denník pre klienta), J29 (úhyn).

### AI Touchpointy

- ✅ **Chceme:** automatické rozloženie plánu hospitalizácie na úlohy (šetrí lekárovi 10–15 min pri prijatí), zhrnutie 24-h vizity, upozornenie na vynechané úkony, predikcia dĺžky hospitalizácie na základe diagnózy (plánovanie kapacity), generovanie dennej správy pre majiteľa (s ľudským schválením).
- ⛔ **Nechceme:** AI, ktorá sama upraví lieky alebo tekutiny; AI, ktorá komunikuje kritické zmeny klientovi bez lekára; AI ako jediná kontrola dávok v OPL režime.

---

### Use Case: UC-120

**Názov:** Prijatie pacienta na hospitalizáciu, vedenie denných záznamov a prepustenie
**Primárny aktér:** `veterinarian` (prijatie a plán), `technician` (plnenie úkonov), `front_desk` (fakturácia a komunikácia)

**Predpoklady:**
- Pacient existuje a je priradený k praxi; existuje encounter alebo iný klinický kontext.
- Klinika má definované lôžka/kapacity (`locations`, nové `hospitalization_units`) a personál na zmeny.
- Je k dispozícii liek/materiál (alebo je vytvorená objednávka).

**Hlavný scenár:**
1. Lekár prijme pacienta na hospitalizáciu (vzniká case typu `hospitalization`).
2. Lekár zadá liečebný plán s úkonmi, frekvenciami a monitoringom.
3. Systém vygeneruje časovaný plán úkonov a priradí ich zmenám; skontroluje lieky (Guardian, OPL).
4. Personál plní úkony a zapisuje vitálne funkcie a zmeny stavu.
5. Systém vedie dennú bilanciu a pripraví podklady pre vizitu.
6. Lekár upravuje plán; systém eviduje zmeny a notifikuje ďalšiu zmenu.
7. Pri prepustení systém vytvorí prepúšťaciu správu, plán domácej liečby a fakturačné podklady.
8. V prípade úhynu systém aktivuje sympathy postup a evidenciu likvidácie.

**Alternatívne scenáre:**
- **A1 — Krátka observácia (nie plná hospitalizácia):** systém umožní 2–6-h observáciu bez lôžka, ale s úkonmi.
- **A2 — Pacient odchádza na vlastnú žiadosť:** systém to eviduje vrátane poučenia o rizikách (právna stopa).
- **A3 — Presun na iné pracovisko:** systém vytvorí referalný súhrn a zaznamená, čo bolo odovzdané.
- **A4 — Denný denník pre klienta:** systém vytvorí schválený súhrn a sprístupní ho v portáli.

**Výnimočné scenáre:**
- **E1 — Výpadok systému počas zmeny:** papierový fallback formulár (vytlačiteľný z plánu) + možnosť doplniť záznamy spätne s označením „doplnené po výpadku“; bez toho je nočná zmena bez ochrany.
- **E2 — Chýbajúce záznamy (úkon nebol vykonaný ani zaznamenaný):** systém viditeľne zobrazí medzery vo vizite; nesmie tváriť, že plán bol splnený.
- **E3 — Súbežná úprava plánu dvoma lekármi:** konflikt revízií s diffom a povinným potvrdením; žiadny tichý prepis.
- **E4 — Kapacita lôžok vyčerpaná:** systém nedovolí prijatie (alebo vyžaduje vedomé rozhodnutie „na chodbe/box“), aby sa klinika nerozhodovala naslepo.

**Postconditions:**
- Existuje kompletná časová stopa hospitalizácie (plán, úkony, vitálne, zmeny, autor).
- Pri prepustení existuje správa, plán domácej liečby a podklady pre fakturáciu.
- Pri úhyne existuje sympathy komunikácia a zákonná evidencia.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** vedenie dokumentácie o poskytnutej starostlivosti; pri hospodárskych a potravinových zvieratách ďalšie povinnosti (CEHZ, ochranné lehoty).
- **Zákon 139/1998 Z. z.:** evidencia OPL pri kontinuálnej liečbe (najmä anestetiká a analgetiká).
- **EÚ 2019/6:** pri podávaní liekov potravinovým zvieratám evidencia ochranných lehôt.
- **GDPR čl. 5:** denný denník pre klienta nesmie obsahovať viac, než je potrebné (nie plnú internú dokumentáciu).
- **Produktové (návrh):** „žiadna medzera nie je ticho“ — každý vynechaný úkon je viditeľný, každý neúplný záznam je označený.

**Dátové entity (existujúce + nové):**
- Existujúce: `cases` (R/W), `case_entries` (W), `patients` (R), `appointments` (W/R), `vital_signs` (W), `patient_weights` (W), `prescriptions` (R/W), `controlled_substance_log` (W), `inventory`/`products` (R/W), `visit_closeouts` (W), `discharge_reports` (W), `ext_carcass_disposals` (W), `communications` (W).
- **Nové (návrh v0.7):** `hospitalization_stays` (pacient, lôžko, prijatie, prepustenie, stav, primárny lekár, príčina), `hospitalization_orders` (typ úkonu, liek, dávka, frekvencia, čas od–do, stav), `hospitalization_task_log` (kto, kedy, čo vykonal, dôvod vynechania), `hospitalization_fluid_balance` (príjem/výdaj tekutín), `hospitalization_notes` (vizity, zmeny plánu s autorom).

**Integrácie:** lab (J16), imaging (J17), sklad (J24), portál (denník), AI (zhrnutia), tlač (papierový fallback).

---

## J21 — Chirurgia a anestézia (plán → zákrok → pooperačná starostlivosť)

### Persóna & Kontext

**P1 Peter** je hlavný chirurg: 2–4 zákroky denne (kastrácie, dentálne, ortopedické, tumorózne). **P4 Martin** pripravuje anestéziu, prístroj a materiál. **P2 Lucia** preberá pooperačnú starostlivosť a volá majiteľovi.
**Problém status quo:** anesteziologický protokol je na papieri, dávky sa počítajú ručne (najrizikovejšia časť dňa), materiál sa odpisuje z hlavy a pooperačné kontroly závisia od toho, či si niekto spomenie.

### Trigger

- **Plánovaný zákrok:** objednaný v rozvrhu (typ návštevy „chirurgia“), s prípravou (lačnenie, pre-op lab).
- **Akútny zákrok:** torzia žalúdka, cisársky rez — súbežne s J22.
- **Systémový:** pred zákrokom prebehne pre-op checklist (lab, srdce, alergie, súhlas majiteľa).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia/lekár naplánuje zákrok (+2 týždne) | Systém vytvorí case typu `surgery` s väzbou na termín, lekára, typ zákroku; vygeneruje **prípravný checklist** (pre-op lab, lačnenie 8–12 h, súhlas na zákrok, odhad ceny) | Ak chýba odhad ceny alebo súhlas → systém to zobrazí jako neuzavretú položku a pripomenie 48 h pred zákrokom |
| 2 | Odoslanie inštrukcií klientovi | Systém pošle inštrukciu (lačnenie, lieky, príchod) v rámci súhlasov a sympathie; text je vopred pripravený podľa typu zákroku | Ak klient nemá kanál → úloha pre recepciu na telefonát |
| 3 | Deň zákroku: pre-op kontrola | Systém pripomenie otvorené body: lab výsledky, alergie, hmotnosť, srdcové riziko; pri chýbajúcich údajoch ich **vyžaduje** | Ak chýbajú kritické dáta → systém nedovolí „štart zákroku“ bez vedomého potvrdenia lekára |
| 4 | Príprava a podanie anestézie | Systém vypočíta dávky podľa váhy a druhu (premedikácia, indukcia, udržiavanie), zobrazuje **monitorovací protokol** (čas + hodnoty); OPL evidencia (ketamín, fentanyl, propofol) vrátane svedka | Ak sa použije OPL → povinný zápis; AI nikdy neprefilluje OPL. Pri zmene dávky v priebehu → záznam s časom a dôvodom |
| 5 | Zákrok a materiál | Systém zapisuje priebeh (časová os), odpisuje použitý materiál (sterilné balíky, stehy, implantáty) z `inventory`, a umožňuje priloženie snímky/fotky (dokumentácia) | Ak materiál nie je na sklade a použije sa „posledný“ → systém zapíše a vytvorí úlohu na objednávku |
| 6 | Ukončenie a pooperačný plán | Systém vytvorí pooperačný plán: analgézia (s kontrolou J5), antibiotiká, kontrola rany, kontrola na 7–10. deň, núdzové kontaktné číslo | Ak je pacient potravinové zviera → ochranná lehota je súčasťou plánu |
| 7 | Odovzdanie majiteľovi | Prepúšťacia správa s jasnými inštrukciami (čo je normálne, kedy volať, čo nepodávať) — tlač/e-mail/portál | Ak ide o deň zákroku a majiteľ je v strese → komunikácia musí byť krátka a konkrétna |
| 8 | Pooperačný follow-up | Verejný check-in `/postop/[id]`: majiteľ odpovie „v poriadku / mám otázku / mám obavu“; systém eskalizuje „obava“ lekárovi | Ak „obava“ → úloha do 24 h a poznámka do karty; bez systému sa to rieši náhodne |
| 9 | Kontrola | Termín kontroly (J7) + zápis o hojení rany; ukončenie case | Ak sa zákrok skomplikuje → návrat do J20 (hospitalizácia) |

### Alternatívne toky

1. **Anesteziologická komplikácia.** Systém musí mať „emergency“ režim: zápis udalostí s časom (jednoduché klikanie, nie písanie), podávanie antidot, a po zvládnutí automatické vytvorenie správy o komplikácii do dokumentácie. V takých situáciách nie je čas na formuláre — UX musí byť navrhnuté pre jednu ruku.
2. **Klient nesúhlasí s cenou zákroku.** Systém musí umožniť **predbežný rozpočet** (treatment plan s položkami a cenami) pred zákrokom a jeho schválenie/zamietnutie; pri zamietnutí sa má vygenerovať alternatíva (J12 `visit_treatment_plans` s odpoveďami).
3. **Zákrok sa nevykoná (nález na snímke, pacient nestabilný).** Systém musí evidovať „zákrok neuskutočnený“ s dôvodom a plánom ďalšieho postupu, aby nešlo o „stratený“ termín a neúčtovanú položku.
4. **Pooperačná komplikácia (infekcia rany, dehiscencia).** Systém musí umožniť „reopening“ prípadu, zápis komplikácie s fotkou, a prepojiť to na revíznu operáciu (nový case s odkazom na pôvodný).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Plánovanie | kontrolovaný stres | Musí sa myslieť na všetko vopred |
| Pre-op checklist | istota (ak funguje) / nervozita | Vynechané lačnenie = zrušený zákrok |
| Anestézia | **maximálne sústredenie a zodpovednosť** | Najrizikovejšia časť dňa |
| Ukončenie | úľava | „Prežil to“ |
| Odovzdanie majiteľovi | profesionalita | Rodina je v strese |
| Pooperačný deň 2–3 | neistota | Najčastejšie komplikácie; majiteľ má otázky |

### Kontextové prepojenia

- **Pred:** J7 (plánovanie zákroku), J16 (pre-op lab), J17 (RTG), J5 (lieky).
- **Po:** J20 (hospitalizácia), J15 (kontrola), J10 (analgézia a antibiotiká), J11 (fakturácia), J27 (edukácia pre majiteľa), J12 (`visit_treatment_plans` – súhlas s plánom).

### AI Touchpointy

- ✅ **Chceme:** výpočet a **kontrola** anestetických dávok (deterministická kalkulačka s AI „druhým očkom“), generovanie pooperačných inštrukcií podľa typu zákroku, sumarizácia komplikácie do dokumentácie, rozpoznanie rizikových pacientov (vek + komorbidity + lieky).
- ⛔ **Nechceme:** AI, ktorá „povolí“ zákrok bez checklistu; AI, ktorá prefilluje OPL; AI v real-time anestézii ako náhrada monitorovania (nikdy).

---

### Use Case: UC-121

**Názov:** Plánovanie a vykonanie chirurgického zákroku s anestéziou a pooperačnou starostlivosťou
**Primárny aktér:** `veterinarian` (chirurg a anesteziológ), `technician` (príprava a monitoring), `front_desk` (plánovanie a komunikácia)

**Predpoklady:**
- Pacient má aktuálnu váhu; existuje termín zákroku alebo akútna indikácia.
- Pre-op dáta (lab, kardio riziko, alergie) sú známe alebo vedome chýbajú (s potvrdením).
- Je k dispozícii materiál a lieky (alebo je vedome použitý posledný kus).

**Hlavný scenár:**
1. Systém vytvorí case `surgery` a prípravný checklist pre plánovaný zákrok.
2. Používateľ odošle inštrukcie klientovi a získa súhlas s rozpočtom.
3. V deň zákroku systém overí checklist a pustí zákrok do „in progress“.
4. Systém vedie anesteziologický protokol a eviduje podané lieky (vrátane OPL).
5. Systém odpisuje materiál a umožní priloženie fotky/snímky.
6. Systém vytvorí pooperačný plán a prepúšťaciu správu.
7. Pooperačný check-in a kontrola zapisujú stav hojenia; case sa uzavrie.

**Alternatívne scenáre:**
- **A1 — Akútny zákrok:** checklist sa komprimuje na kritické položky, ale nikdy sa nevynechá anestézia a hmotnosť.
- **A2 — Zákrok neuskutočnený:** evidencia s dôvodom a plánom.
- **A3 — Komplikácia v priebehu:** emergency režim zápisu a správa o komplikácii.
- **A4 — Revízna operácia:** nový case s väzbou na pôvodný; materiál a lieky sa účtujú samostatne.

**Výnimočné scenáre:**
- **E1 — Chýbajúca váha v deň zákroku:** systém blokuje výpočet anestézie a žiada váženie (nie odhad).
- **E2 — Výpadok napájania/prístroja:** systém umožní pokračovať v papierovom protokole s následným zápisom a označením zdroja (bez falšovania časov).
- **E3 — Klient sa nedostaví na pooperačnú kontrolu:** systém eskaluje (telefonát, edukácia o riziku rany) a zaznamená komunikáciu.
- **E4 — Chyba v odhade ceny (rozpočet výrazne nižší než reálny):** systém upozorní v priebehu a vyžiada komunikáciu s klientom pred ďalším úkonom (etika a dôvera).

**Postconditions:**
- Existuje kompletný záznam zákroku (časy, lieky, materiál, komplikácie, fotky).
- Pacient má pooperačný plán a termín kontroly; majiteľ má inštrukcie.
- Fakturačné podklady sú kompletné a dohľadateľné.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** dokumentácia zákroku; pri potravinových zvieratách ochranné lehoty.
- **Zákon 139/1998 Z. z.:** OPL evidencia pri anestézii.
- **EÚ 2019/6:** predpis a podanie liekov, ochranné lehoty.
- **GDPR:** fotky rán (zdravotné údaje) – len v rámci karty, publikácia len so súhlasom (marketing média majú vlastný consent model).
- **Produktové:** žiadny zákrok bez hmotnosti a bez checklistu; žiadny OPL bez evidencie.

**Dátové entity (existujúce + nové):**
- Existujúce: `cases` (W/R), `case_entries` (W), `procedures` (R/W), `appointments` (R/W), `vital_signs` (W), `patient_weights` (W), `controlled_substance_log` (W), `inventory`/`products` (W/R), `files` (W), `discharge_reports` (W), `visit_treatment_plans` + responses (W), `treatment_templates` (R), `ext_dental` (R/W pre dentálne zákroky), `prescriptions` (W), `invoices` (W), `ext_marketing_postop_responses` (R/W).
- **Nové (návrh v0.8):** `surgery_cases` (indikácia, typ, plánovaný čas, tím, stav, odhad ceny), `anesthesia_protocols` (premedikácia/indukcia/udržiavanie, časy, hodnoty, komplikácie), `surgery_checklists` (pre-op/op/post-op body a ich stav), `surgical_materials` (spotreba materiálu a implantátov s väzbou na sklad).

**Integrácie:** `ext_dental` (dentálne zákroky), inventory, lab/imaging, OPL, tlač/PDF, portál, `/postop/[id]`.

---

## J22 — Urgentný príjem a triáž (mimo ordinačných hodín)

### Persóna & Kontext

**P6 Ján** volá o 21:40: mačka spadla z balkóna, dýcha zrýchlene. **P3/`front_desk`** má dnes len zoznam „kto je na pohotovosti“ na papieri za monitorom. **P1 Peter** je doma, ale má službu.
**Problém status quo:** bez triážneho systému sú nočné príchody chaos: telefón zvonií, majiteľ je v panike, nikto nevie, či má prísť (a či to prežije cestu), a klinika nevie, koľko urgentov bolo — ani koľko zarobila.

### Trigger

- **Externý:** telefonát alebo príchod mimo ordinačných hodín; zranenie, otrava, pôrod, dýchavičnosť, krvácanie.
- **Interný:** pacient hospitalizovaný (J20) sa zhorší v noci.
- **Systémový:** dlhšie čakanie v čakárni (J8) pri pacientovi s rizikovými príznakmi → návrh triáže.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Klient volá na pohotovostné číslo (alebo píše) | Systém ponúkne **triážny formulár** (aj pre obsluhu po telefóne): druh, váha, príznak, čas vzniku, lieky, či môže dýchať, či krváca, či je pri vedomí | Ak ide o život ohrozujúci stav → systém dá pokyn „príďte ihneď“ a prebudí lekára |
| 2 | Systém vyhodnotí prioritu | Vypočíta triážny level (P1–P4) podľa definovaných pravidiel; zobrazí odporúčanie (prísť hneď / do 2 h / ráno) a **odhad ceny urgentu** (klient má právo vedieť, čo ho čaká) | Ak je level P1 a lekár je na ceste → systém aktivuje „urgent mode“ a pripraví pracovisko (checklist „čo si nachystať“) |
| 3 | Príchod pacienta | Systém vytvorí urgentný case s časom príchodu, triážnym levelom a pacientom (aj nový klient sa musí dať založiť rýchlo — J6 v skrátenom režime) | Ak pacient nie je v systéme → rýchle založenie s minimom polí, dokumentácia sa doplní |
| 4 | Vyšetrenie a stabilizácia | Systém štruktúruje záznam podľa urgentného protokolu (ABCDE), umožní rýchle zapisovanie vitálnych a podaných liekov; AI nevstupuje do rozhodovania | Ak je potrebná operácia → plynulý prechod do J21 (akútny zákrok) |
| 5 | Rozhodnutie: hospitalizácia alebo domov | Systém ponúkne možnosti (J20 / prepustenie s inštrukciami), s dôvodom a s odhadom nákladov | Ak klient odmietne hospitalizáciu → vyžaduje sa poučenie o rizikách (s podpisom/odklepom) |
| 6 | Fakturácia urgentu | Systém aplikuje urgentný cenník (mimo-ordinačná prirážka) a vytvorí doklad (J11) | Ak je klient poistený → PetExpert direct settlement |
| 7 | Nočná uzávierka | Systém zaeviduje urgent do reportu a do dát pre plánovanie pohotovostných služieb | Ak sa urgent stal v čase, keď nebola pohotovosť → systém upozorní, že príjem bol nad rámec (analytika) |

### Alternatívne toky

1. **Pohotovosť je vypnutá alebo lekár nedostupný.** Systém musí mať **jasný scenár „odmietnutia“**: kde najbližšie je pohotovostná klinika, čo povedať klientovi, a záznam o volaní (ľudsky, nie právne chladne). Toto je najcitlivejšia komunikácia celej kliniky.
2. **Klient nemá prostriedky na urgent.** Systém musí mať postup (sociálna situácia, splátky, charitatívny fond) — a nesmie to zlyhávať v UX. Kliniky sa rozhodujú v sekundách a systém im musí dať legitimitu rozhodnutia aj stopu.
3. **Množstvo urgentov v krátkom čase (dopravná nehoda).** Systém musí zvládnuť viac prípadov naraz (triage board s viacerými pacientmi) bez toho, aby sa rozpadla doterajšia rozvrh.
4. **Následná kontrola po urgente.** Systém musí automaticky naplánovať kontrolu (48–72 h) a vysvetliť majiteľovi, prečo je dôležitá — pri urgentoch je najčastejšou chybou „sme v poriadku, netreba“.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Volanie | **panika** | Človek nevie, či robí správnu vec |
| Triáž | úľava alebo strach | Informácia „príďte hneď“ môže zachrániť, ale aj vyľakať |
| Príchod | napätie, krívanie sa | Personál je „nepripravený“ |
| Vyšetrenie | sústredenie | Málo času, veľa rozhodnutí |
| Rozhodnutie o hospitalizácii | tíha | Náklady a strach |
| Odchod | vyčerpanie | Aj pre personál |

### Kontextové prepojenia

- **Pred:** J8 (čakáreň), J20 (pacient v hospitalizácii sa zhorší).
- **Po:** J20, J21, J11 (urgentná fakturácia), J6 (rýchle založenie klienta), J15 (kontrola po urgente).

### AI Touchpointy

- ✅ **Chceme:** podpora triáže (návrh levelu s vysvetlením), rozpoznanie rizikových slov v texte od klienta („krv“, „dýcha rýchlo“, „tabletky“), predbežné odhady nákladov, generovanie pokynov „čo si doniesť / čo nedať preč“, následná kontrola (follow-up) automaticky.
- ⛔ **Nechceme:** AI, ktorá **odmietne** pacienta alebo zníži triážny level bez človeka; AI, ktorá komunikuje s klientom namiesto lekára v akútnej situácii; AI, ktorá podáva dávky liekov.

---

### Use Case: UC-122

**Názov:** Triáž urgentného príjmu mimo ordinačných hodín a nadväzné riešenie
**Primárny aktér:** `front_desk` (príjem telefónu) / `vet` (triáž), `technician` (príprava)

**Predpoklady:**
- Klinika má definovanú pohotovostnú službu (kalendár) a triážne pravidlá.
- Systém vie vytvoriť urgentný case aj pre neznámeho pacienta.
- Je dostupný urgentný cenník.

**Hlavný scenár:**
1. Obsluha vyplní triážny formulár (alebo ho vyplní klient online/telefonicky).
2. Systém vyhodnotí triážny level s odôvodnením a odporúčaním.
3. Klient je informovaný o ďalšom kroku (prísť hneď / do 2 h / ráno) a o predpokladaných nákladoch.
4. Pri príchode systém vytvorí urgentný case a pripraví pracovisko.
5. Lekár vedie záznam urgentu (ABCDE), systém umožní rýchle zadávanie.
6. Systém rozhodne o ďalšom kroku (hospitalizácia/prepustenie) a vytvorí fakturáciu a follow-up.

**Alternatívne scenáre:**
- **A1 — Pohotovosť vypnutá:** systém zobrazí najbližšiu pohotovosť, pokyny a zapíše volanie.
- **A2 — Viac urgentov naraz:** triage board zvládne viac prípadov a prioritizuje.
- **A3 — Klient je bez prostriedkov:** systém má definované možnosti (splátky/fond) a stopu rozhodnutia.
- **A4 — Následná kontrola:** systém ju automaticky naplánuje a komunikuje v rámci súhlasov.

**Výnimočné scenáre:**
- **E1 — Systém nedostupný (nočný výpadok):** musí existovať **tlačený triážny formulár** a telefónny protokol; urgent sa nesmie nefungovať pre výpadok systému.
- **E2 — Chybná triáž (podcenenie):** systém umožní okamžité prehodnotenie levelu s dôvodom a eskaluje; žiadne „už je zaznamenané ako P3“ brzdy.
- **E3 — Duplicitné volanie tej istej veci (klient volá viackrát):** systém spája volania k jednému prípadu, aby obsluha nezakladala duplicity.

**Postconditions:**
- Urgentný prípad má triážny level, čas, rozhodnutie a stopu.
- Klient dostal jasný pokyn a (ak relevantné) odhad ceny.
- Existuje follow-up kontrola a fakturačné podklady.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** povinnosť poskytnúť prvú pomoc a neodkladnú starostlivosť; záznam o ošetrení.
- **Zákon 289/2008 Z. z.:** doklad pri platbe, aj v urgentnom režime.
- **GDPR:** triážny záznam obsahuje zdravotné údaje; prístup len pre oprávnené role, žiadne verejné zobrazenie.
- **Produktové:** triáž je vždy ľudské rozhodnutie; systém navrhuje a dokumentuje.

**Dátové entity (existujúce + nové):**
- Existujúce: `patients` (W/R), `clients` (W/R), `appointments` (W), `vital_signs` (W), `cases`/`case_entries` (W/R), `prescriptions` (W), `invoices`/`payments` (W), `communications` (W), `audit_log` (W).
- **Nové (návrh v0.9):** `emergency_cases` (čas príchodu, level, symptóm, zdroj volania), `triage_assessments` (parametre, level, odôvodnenie, autor), `on_call_schedule` (kto má pohotovosť, kontakt, dostupnosť), `emergency_protocols` (šablóny ABCDE a typických stavov), `price_estimates` (urgentný cenník a odhad).

**Integrácie:** SMS/telefón (na pohotovostné číslo), portál (follow-up), fakturácia, AI (podpora triáže).

---

## J23 — Telemedicína a vzdialený follow-up

### Persóna & Kontext

**P5 Katarína** má 40 minút cesty do kliniky a psa s chronickým ochorením — chce „len vedieť, či mám prísť“. **P6 Ján** má pooperačnú kontrolu po telefóne. **P2 Lucia** má medzi pacientmi 10 minút, ktoré sa nedajú použiť na návštevu, ale dajú sa použiť na krátku konzultáciu.
**Problém status quo:** dnes je telemedicína „sestra zavolá a poviem, že mám prísť“ — bez dokumentácie, bez platby, bez stopy. Právne aj ekonomicky je to neviditeľné.

### Trigger

- **Klinický:** kontrola stavu po liečbe (deň 3–5), po operácii (J21), chronický pacient (J15), konzultácia výsledkov (J16).
- **Externý:** klient pošle fotku rany alebo otázku cez portál (`/portal/[token]/messages`).
- **Obchodný:** klinika chce ponúknuť konzultáciu pre klientov, ktorí sa nedostanú.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia/lekár vytvorí telemedicínsky termín (alebo klient požiada cez portál) | Systém naplánuje **telemedicínsky slot** (10–15 min), vygeneruje odkaz na videohovor a inštrukcie; typicky v rámci `appointments` s typom „telemedicína“ | Ak ide o stav, ktorý si vyžaduje fyzické vyšetrenie (trauma, krvácanie) → systém odmietne telemedicínu a odkáže na urgent (J22) |
| 2 | Klient dostane odkaz a pripomienku | Systém pošle SMS/e-mail s odkazom, časom a žiadosťou o doplnenie (foto, otázky, aktuálna váha ak je dostupná) | Ak klient nemá kameru/mikrofón → systém ponúkne telefonickú konzultáciu alebo chat |
| 3 | Lekár si pripraví kontext | Systém zobrazí ucelený sumár: diagnózy, lieky, posledné výsledky, otázky, fotky; AI môže pripraviť sumár (nie odpovede) | Ak v karte nie je história → systém to povie a lekár vedie konzultáciu opatrnejšie |
| 4 | Videokonzultácia | Systém vedie zápis (AI diktát/štruktúrovaný formulár), umožní zdieľanie súborov (lab výsledok, fotka) a zapisuje trvanie | Ak sa počas hovoru objaví potreba fyzického vyšetrenia → systém umožní okamžite vytvoriť termín a odovzdať prípad |
| 5 | Zápis a odporúčania | Telemedicínsky záznam je súčasťou karty (`soap_notes`/`clinical_notes` typu telemedicína) s jasným označením, že nešlo o fyzické vyšetrenie | Ak lekár nemôže vyvodzovať záver bez vyšetrenia → systém má šablónu „odporúčame vyšetrenie“ s dôvodmi |
| 6 | Platba | Systém účtuje telemedicínsky výkon (cenník) a umožní platbu kartou/online cez portál (Stripe) alebo na mieste | Ak klient nezaplatí → klinika má viditeľnú pohľadávku (nie „stratí sa“) |
| 7 | Follow-up | Systém zapíše výsledok do plánu (pokračovať doma / objednať kontrolu / urgent) a prípadne naplánuje ďalší kontakt | Ak klient neodpovedá → úloha pre recepciu |

### Alternatívne toky

1. **Klient pošle fotku a lekár si ju nevšimne.** Systém musí mať SLA na správy (napr. „odpoveď do 4 h v rámci ordinačných hodín“) a viditeľné „prepálené“ správy. Bez toho sa telemedicína zmení na reputačné riziko.
2. **Konzultácia sa zvrhne na diagnózu bez vyšetrenia.** Systém musí v šablóne zámerne pripomínať rozsah: „na základe videokonzultácie, bez fyzického vyšetrenia“. Právna aj etická ochrana lekára.
3. **Klient chce lacnejšiu liečbu bez návštevy (odporúčanie liekov na diaľku).** Systém **nesmie** umožniť predpis liekov na predpis bez potrebného vyšetrenia (pravidlo praxe + zákonné obmedzenia); musí viesť k fyzickému vyšetreniu.
4. **Technické zlyhanie videohovoru.** Systém musí ponúknuť okamžitý fallback (telefonát), zapísať, že video nefungovalo, a nezapočítať to ako „klient sa nedostavil“.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Objednanie | **úľava** | Bez cestovania, bez čakania v čakárni |
| Príprava | mierna nervozita | „Bude to fungovať?“ |
| Videohovor | dôvera / rozpaky | Kontakt „na diaľku“ s lekárom |
| Odporúčanie | istota | Vie, čo robiť |
| Platba | drobná nepríjemnosť | Za hovor sa platí inak než za návštevu |

### Kontextové prepojenia

- **Pred:** J15 (chronický pacient), J21 (pooperačná kontrola), J12 (closeout odporúčal kontrolu), J27 (portál).
- **Po:** J16 (objednanie lab pred návštevou), J7 (termín), J11 (platba), J25 (report ziskovosti telemedicíny).

### AI Touchpointy

- ✅ **Chceme:** príprava sumáru pred hovorom, automatický zápis a štruktúrovanie z hovoru (s potvrdením lekára), návrh otázok, ktoré má lekár položiť (checklist), triage pri „chcem konzultáciu“ žiadosti, sledovanie otvorených otázok a ich uzatvorenie.
- ⛔ **Nechceme:** AI, ktorá odpovedá klientovi namiesto lekára; AI, ktorá odporúči liek na predpis; AI, ktorá z videa robí „diagnózu“.

---

### Use Case: UC-123

**Názov:** Telemedicínska konzultácia a vzdialený follow-up s dokumentáciou a platbou
**Primárny aktér:** `veterinarian` (konzultácia), `front_desk` (plánovanie, platba), klient (portál)

**Predpoklady:**
- Existuje pacient a klient so súhlasom na komunikáciu (SMS/e-mail/portál).
- Klinika má definovaný typ výkonu „telemedicína“ a jeho cenu.
- Je dostupná video/telefónna infraštruktúra alebo aspoň chat v portáli.

**Hlavný scenár:**
1. Používateľ vytvorí telemedicínsky slot (alebo klient zažiada o konzultáciu).
2. Systém odošle klientovi odkaz a požiadavky na podklady (fotky, otázky).
3. Lekár dostane sumár a vedie konzultáciu.
4. Systém vedie zápis a označí, že ide o vzdialenú konzultáciu bez fyzického vyšetrenia.
5. Systém zapíše odporúčania a vytvorí prípadný termín alebo úlohu.
6. Systém vytvorí platbu a (ak je potrebné) naplánuje follow-up.

**Alternatívne scenáre:**
- **A1 — Iba telefón:** záznam typu „telefonická konzultácia“ s inou šablónou.
- **A2 — Chat v portáli:** asynchrónna konzultácia s časovým limitom odpovede.
- **A3 — Odporúčanie na fyzické vyšetrenie:** systém vytvorí termín a odovzdá kontext lekárovi.
- **A4 — Vyžaduje sa urgent:** systém presmeruje na J22.

**Výnimočné scenáre:**
- **E1 — Video zlyhá:** fallback na telefón; záznam typu komunikácie; nezapočíta sa ako no-show.
- **E2 — Klient sa nedostaví na telemedicínsky termín:** no-show podľa politiky (rovnaké pravidlá ako pri fyzickej návšteve).
- **E3 — Zlyhanie platby:** klinika má viditeľnú pohľadávku a možnosť poslať platobný odkaz znovu.
- **E4 — Lekár nemá dostatok informácií:** systém musí umožniť konzultáciu ukončiť s odporúčaním na vyšetrenie a s vysvetlením klientovi (nie „uvidíme sa“).

**Postconditions:**
- Existuje zdokumentovaná vzdialená konzultácia s jasným rozsahom a odporúčaniami.
- Úhrada je zaevidovaná (alebo je vytvorená pohľadávka).
- Follow-up je naplánovaný alebo je zdôvodnené, prečo nie.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** vedenie záznamu o poskytnutej starostlivosti aj pri vzdialenej forme; pri podozrení na vážny stav odporučiť osobné vyšetrenie.
- **Zákon 362/2011 + EÚ 2019/6:** obmedzenia predpisu liekov bez vyšetrenia; systém musí brániť v nevhodnom predpise na diaľku.
- **GDPR čl. 5/32:** video a fotky sú zdravotné údaje — zabezpečené prenosy, bez ukladania obsahu hovoru, len zápis.
- **Produktové:** jasné označenie „bez fyzického vyšetrenia“, žiadne AI odpovede klientovi bez lekára.

**Dátové entity (existujúce + nové):**
- Existujúce: `appointments` (W/R), `soap_notes`/`clinical_notes` (W), `patients` (R), `clients` (R), `messaging`/`communications` (W/R), `invoices`/`payments` (W), `portal_sessions` (R), `files` (W), `care_reminders` (W), `audit_log` (W).
- **Nové (návrh v1.0):** `telemedicine_sessions` (typ: video/telefón/chat, čas, trvanie, účastníci, výsledok), `telemedicine_requests` (žiadosť klienta, triage, schválenie), `consultation_summaries` (štruktúrovaný zápis s rozsahom konzultácie).

**Integrácie:** video/telefón infra, portál, SMS/e-mail, Stripe/platobné odkazy, AI (sumár a zápis).

---

## Business Case: Nemocnica & urgent

### Status Quo

**Klinika s hospitalizáciou a pohotovosťou bez vhodného PIMS** dnes pracuje kombináciou papiera, Excelu a improvizácie:

- **Hospitalizačná kniha na papieri:** denné záznamy sa píšu do zošita, zmeny si ústne odovzdávajú, večerné hodnoty sa dopíšu „od oka“. Miera chýbajúcich záznamov je 10–25 %.
- **Anestézia:** dávky sa počítajú ručne na papieri; neexistuje systematický protokol pre komplikácie.
- **Urgent mimo hodín:** telefón zdvihne ktokoľvek; rozhodnutie „nech príde / nech počka“ je na ňom; **klinika nezachytí tržby** za urgenty (napr. 20 % urgentov sa nezaeviduje alebo sa účtuje len čiastočne).
- **Pooperačné komplikácie:** zachytia sa len vtedy, keď sa klient sám ozve (typicky po 3–5 dňoch, keď je už infekcia rozvinutá).
- **Kapacita lôžok:** plánuje sa v hlave.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Zachytenie nezúčtovaných hospitalizačných dní | 10 neúčtovaných dní/mesiac × 25 € | 3 000 € |
| Zachytenie urgentných tržieb mimo hodín | 4 urgenty/mesiac × 80 € | 3 840 € |
| Ušetrený čas technika pri hospitalizačných záznamoch | 30 min/deň × 0,17 € × 252 | 1 285 € |
| Čas lekára pri prijímaní a vizitách (plán zo systému) | 20 min/deň × 0,30 € × 252 | 1 512 € |
| Menej vynechaných úkonov (infúzie, analgézia) — prevencia komplikácií | 1 komplikácia /kvartál × 900 € | 3 600 € |
| Zachytená chirurgická dokumentácia a materiál | 12 zákrokov/mesiac, 1 chýbajúca položka 15 € | 2 160 € |
| Znížený počet nočných telefonátov do ordinácie (denný denník pre klienta) | 15 hovorov/mesiac × 3 min × 0,15 € | 68 € |
| Telemedicínske konzultácie (nový príjem) | 12/mesiac × 25 € | 3 600 € |
| **Spolu (konzervatívne)** | | **19 065 €** |

> **Návrh:** skutočná hodnota tejto skupiny je **umožnenie predaja tieru Cloud Nemocnica** — pre kliniku s hospitalizáciou
> je bez týchto modulov OpenVPM nepoužiteľný. Investorom nepredávajte „úsporu 19 000 €“, ale **„rozšírenie
> adresovateľného trhu o kliniky s hospitalizáciou“**.

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € (a vlastná IT kapacita) | 12 000 € | 10× | 37 dní |
| **Cloud Solo** | 588 € | **n/a** (solo ambulancia nemá hospitalizáciu; urgent len výnimočne) | n/a | n/a |
| **Cloud Klinika** | 1 428 € | 14 000 € (bez 24/7 pohotovosti) | 9,8× | 37 dní |
| **Cloud Nemocnica** | 2 748 € | 19 065 € (hospitalizácia + urgent + telemedicína) | 6,9× | 53 dní |

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Hospitalizačný modul prepojený na Clinical Guardian a sklad** | Nemocničné moduly starších PIMS sú oddelené od liekov a skladu; tu je infúzia, liek, materiál a faktúra jedna stopa |
| **Anesteziologický protokol s OPL evidenciou a zero-prefill** | Najrizikovejšia časť medicíny s najprísnejšou evidenciou — a práve tu je governance najsilnejšia |
| **Triáž mimo hodín s odhadom ceny pre klienta** | Transparentnosť ceny v akútnej situácii je zriedkavá a je veľmi silný argument pre majiteľa v panike |
| **Pooperačný follow-up cez `/postop/[id]`** | Zachytáva komplikácie skôr, než sa rozvinú — klinický aj ekonomický efekt |
| **Telemedicína ako platený, zdokumentovaný výkon** | Konkurencia ju má „na telefóne“; tu je to evidovaný výkon s platbou a stopou |

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Hospitalizačnú knihu mám v malíčku“ | Odpor k zmene | Mobile-first tabuľa, ktorá je **rýchlejšia** než zápis do zošita (2 kliky na úkon) |
| „Nemôžem si dovoliť, aby ma systém zdržoval v anestézii“ | Strach z UX v kritickej chvíli | Emergency režim s jednoduchým zápisom, klávesové skratky, funguje aj na tablete |
| „Klienti nebudú platiť za telemedicínu“ | Obava z prijatia | Najprv ako súčasť pooperačnej starostlivosti (zdarma ako marketing), potom ako samostatný výkon |
| „Nemáme 24/7 personál“ | Realita malej kliniky | Triáž bez pohotovosti: systém vie povedať „najbližšia pohotovosť“ a odkázať |
| „Bojím sa chyby v triáži“ | Právna zodpovednosť | Triáž je ľudské rozhodnutie; systém navrhuje, dokumentuje a umožňuje prehodnotenie |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace po nasadení) | Meranie |
|---|---|---|---|
| Podiel zaznamenaných hospitalizačných úkonov | 75–90 % (papier) | ≥ 98 % | `hospitalization_task_log` vs. plán |
| Medián času na záznam úkonu v hospitalizácii | 1–2 min (papier) | ≤ 20 s | meranie UI |
| Zachytené urgentné tržby | 80 % | ≥ 97 % | urgentné cases vs. faktúry |
| Podiel pooperačných komplikácií zachytených do 72 h | < 40 % | ≥ 80 % | `ext_marketing_postop_responses` + karta |
| Vykonané anesteziologické protokoly s kompletným záznamom | 50 % | 100 % | protokoly bez chýbajúcich polí |
| Tržby z telemedicíny | 0 € | ≥ 300 €/mesiac | faktúry typu telemedicína |
| Počet urgentných prípadov bez follow-up termínu | neznámy | < 10 % | `emergency_cases` vs. `appointments` |
