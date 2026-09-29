# Skupina 4 — Preventívna starostlivosť (J13–J15)

> **Frekvencia:** T3–T4 (denne až týždenne). Preventíva je **najziskovejšia a najviac zanedbávaná**
> oblasť veterinárnej praxe: je plánovateľná, opakovateľná a jej vynechanie sa prejaví až o rok.
> **Business Case:** [BC-4](#business-case-preventívna-starostlivosť).

---

## J13 — Očkovanie a hlásenie besnoty

### Persóna & Kontext

**P4 Martin** pripravuje vakcínu, **P1 Peter** ju podá a podpíše. Pri besnote tým zároveň vzniká **zákonná povinnosť hlásenia** v 3-dňovom okne na RVPS (`ext_rabies_notifications`, `ext_rabies_observations`, `vaccination_records`, `lib/records/vaccination-policy.ts`).
**P5 Katarína** si o rok musí pamätať, že pes má revakcináciu — a nechce, aby to riešila ona, ale systém.

### Trigger

- **Klinický:** preventívna návšteva (typicky ročná), prvá vakcinácia šteňaťa/mačiatka, cesta do zahraničia (pet pas), titrácia protilátok.
- **Systémový:** recall pripomienka (J14) vygenerovala termín a systém pripravil očkovaciu schému podľa druhu, veku a histórie.
- **Legislatívny:** besnota = povinné hlásenie; potravinové zviera = ďalšie registrácie.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí kartu pacienta a záložku Očkovania | Systém zobrazí očkovaciu schému (čo je splnené, čo chýba), posledné dávky, šarže, platnosť, a **stav hlásenia** pri besnote | Ak je zviera prvé očkovanie a < 12 týždňov → systém varuje, že vakcinácia môže byť neplatná (materské protilátky) |
| 2 | Vyberie vakcínu z katalógu | Systém načíta šaržu, exspiráciu a výrobcu (`products`); pri besnote pripraví aj podklady pre hlásenie | Ak vakcína nie je na sklade → ponuka objednávky (J24) alebo inej šarže |
| 3 | Zaznamená podanie | `vaccination_records` + odpíše sklad; pri potravinovom zvierati systém vyžiada evidenciu podľa EÚ 2019/6 | Ak chýba číslo šarže → systém to označí ako neúplný záznam (pri besnote neprípustné) |
| 4 | Systém vypočíta ďalší termín | Podľa typu vakcíny, druhu, veku a pravidiel praxe; vytvorí recall (`ext_marketing_recall_schedules`, `lib/vaccination-recalls.ts`) | Ak klient neželá pripomienky → recall zostane interný (na dashboarde), bez správy |
| 5 | Systém pripraví hlásenie besnoty | `ext_rabies_notifications` so stavom a 3-dňovým oknom; v UI vidno, kedy je potrebné podať | Ak je hlásenie po termíne → systém eskaluje (nie tichý „overdue“) |
| 6 | Vystaví certifikát / očkovací preukaz | PDF s dátumom, šaržou, výrobcom a platnosťou; digitálna verzia v portáli (J27) | Ak ide o cestu do zahraničia → pet pas a požiadavky krajiny (dnes bez kontroly pravidiel cieľovej krajiny — gap) |
| 7 | (CRSZ) Zaznamená mikročip, ak ešte nie je | Validácia ISO 11784/11785, registrácia v `microchip_registrations` | Ak je čip registrovaný na inú osobu → prevod vlastníctva (J6-A2) |

### Alternatívne toky

1. **Klient prináša očkovanie z inej kliniky.** Systém musí umožniť zápis externej vakcinácie **s pôvodom** (kto podal, kedy, aká šarža) a nezapočítať ju ako vlastný výkon. Bez pôvodu sa história stáva nedôveryhodnou.
2. **Meškanie očkovania o 3 mesiace.** Systém musí vedieť vyhodnotiť, či je potrebné začať schému odznova (pri šteňati) alebo stačí pokračovať, a navrhnúť správny postup. Toto je presne miesto, kde AI (alebo deterministická schéma) zachraňuje klinickú kvalitu.
3. **Besnota a titrácia protilátok namiesto očkovania** (napr. pri komplikáciách alebo pre cestu). Systém musí evidovať aj tento scenár a nesmie ho považovať za vynechané očkovanie.
4. **Nežiaduca reakcia po vakcíne.** Systém musí umožniť hlásenie nežiaducej reakcie a prepojiť ju s vakcínou a šaržou — to je aj bezpečnostná, aj právna stopa.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Príprava | rutina | Preventíva je najčastejší „pokojný“ výkon |
| Kontrola schémy | **istota** | „Vidím, že sme na správnej ceste“ |
| Hlásenie besnoty | zodpovednosť, mierny stres | Zákonná lehota |
| Klient odchádza | spokojnosť | Má preukaz a má termín |
| Chýbajúca šarža | frustrácia | „Prečo to po mne chce teraz?“ |

### Kontextové prepojenia

- **Pred:** J6 (nový pacient), J7 (objednávka), J14 (recall vygeneroval termín).
- **Po:** J14 (ďalší recall), J28 (besnota a KVEPIS), J27 (očkovací preukaz v portáli), J25 (report očkovaní).

### AI Touchpointy

- ✅ **Chceme:** návrh schémy pre atypické druhy/exoty, upozornenie na nekonzistencie (dátum pred narodením, chýbajúca šarža), generovanie zrozumiteľného vysvetlenia pre klienta („prečo musí prísť o 21 dní“), preklad schémy do cestovných požiadaviek (návrh na overenie lekárom).
- ⛔ **Nechceme:** AI, ktorá sama zapíše očkovanie (zákonná evidencia vyžaduje presnosť), AI, ktorá sama nahlási besnotu na úrad (podanie je zodpovednosť lekára), AI odhadujúca číslo šarže.

---

### Use Case: UC-113

**Názov:** Zaznamenanie očkovania (vrátane besnoty) a vytvorenie nadväzných povinností
**Primárny aktér:** `veterinarian`, `technician` (podľa praxe)

**Predpoklady:**
- Pacient existuje; vakcína je v katalógu so šaržou a exspiráciou.
- Pri besnote je nakonfigurovaná evidencia hlásení (RVPS) a je známa prax (okno hlásenia).

**Hlavný scenár:**
1. Používateľ otvorí očkovaciu záložku a vyberie vakcínu.
2. Systém zobrazí stav schémy a upozornenia (vek, platnosť, predchádzajúce dávky).
3. Používateľ zaznamená podanie vrátane šarže a výrobcu.
4. Systém odpíše sklad a vytvorí záznam o vakcinácii.
5. Systém vypočíta ďalší termín a vytvorí recall.
6. Pri besnote systém vytvorí hlásenie s termínom a stavom.
7. Systém vytvorí certifikát/preukaz a sprístupní ho v portáli.

**Alternatívne scenáre:**
- **A1 — Externé očkovanie:** zápis s pôvodom (iná klinika) bez započítania výkonu.
- **A2 — Meškanie a reštart schémy:** systém navrhne korektný postup (odznova vs. pokračovať).
- **A3 — Titrácia protilátok:** samostatný typ záznamu, ktorý nevytvára falošný „nevykonaný recall“.
- **A4 — Nežiaduca reakcia:** záznam reakcie prepojený na vakcínu a šaržu, s možnosťou ďalšieho postupu.

**Výnimočné scenáre:**
- **E1 — Chýbajúca šarža pri besnote:** systém neuloží záznam ako úplný; prizná neúplnosť a vyžiada doplnenie (pri besnote blokuje).
- **E2 — Exspirovaná vakcína (šarža po dátume):** systém blokuje podanie a vyžaduje voľbu inej šarže/dodávky.
- **E3 — Zlyhanie generovania PDF preukazu:** systém ponúkne opakovať alebo uloží stav „preukaz nebol vytvorený“ s úlohou; nesmie tvrdiť, že preukaz existuje.

**Postconditions:**
- Existuje záznam o očkovaní so šaržou, výrobcom a dátumom; sklad je odpísaný.
- Existuje recall na ďalšiu dávku (alebo dôvod, prečo nie).
- Pri besnote existuje hlásenie so stavom a termínom.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** povinné očkovanie psov proti besnote, hlásenie v zákonnej lehote, kniha besnoty, evidence.
- **EÚ 2019/6:** záznam o podaní lieku a (pri potravinových zvieratách) ochranná lehota.
- **GDPR:** preukaz a certifikáty sú zdravotné údaje; dostupné len klientovi (nie verejne).
- **Produktové:** bez šarže nie je záznam úplný; bez dátumu nie je výpočet ďalšej dávky platný.

**Dátové entity:** `vaccination_records` (W), `products` (R/W), `ext_rabies_notifications` (W), `ext_rabies_observations` (W/R), `microchip_registrations` (R/W), `pet_passports` (W), `ext_marketing_recall_schedules` (W), `files` (W), `audit_log` (W).

**Integrácie:** KVEPIS (XML export — R-05), CRSZ/KVL (registrácia čipu), tlač/PDF, portál, voliteľne e-mail/SMS pripomienky.

---

## J14 — Recall a revakcinácia (kampane a pripomienky)

### Persóna & Kontext

**P3 Zuzana** raz za týždeň otvára zoznam pacientov, ktorým „vyšla“ revakcinácia, a obvoláva ich. **P7 Anna** chce vedieť, koľko peňazí recall priniesol — nie koľko SMS odišlo.
**Kľúčové dáta:** `ext_marketing_recall_schedules`, `lib/vaccination-recalls.ts`, `marketing.getRecallSchedule`, `care_reminders` (s dismiss/undo), autopilotné journeys a suppression log; consent gate a sympathy gate.

### Trigger

- **Časový cyklus:** týždenný cron / plánovač generuje zoznam pacientov po termíne.
- **Systémový:** `marketing.getRecallSchedule` ukáže prehľad; automatizácia pošle SMS/e-mail.
- **Interný:** manažérka chce kampaň „dovakcinujte svojich psov pred letom“.
- **Externý:** klient sa sám ozve po pripomienke.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/recalls` (alebo dostane týždenný prehľad) | Systém zobrazí pacientov s prešlým termínom, rozdelených podľa typu (besnota, kombinovaná, iné) a podľa oneskorenia | Ak je zoznam príliš dlhý → segmentácia podľa priority (besnota, potravinové zviera, starší pacient) |
| 2 | Skontroluje kanály a súhlasy | Systém ukáže, kto má SMS/e-mail súhlas a kto je v suppression logu alebo sympathy gate | Ak klient nemá žiadny kanál → systém ho presunie do „obvolať“, nie do „nemožné“ |
| 3 | Spustí kampaň (alebo si nechá vygenerovať text) | Systém vygeneruje text (AI copy alebo šablóna), zobrazí ho na schválenie a pošle dávkovo s throttlingom | Ak je text marketingový a klinika nemá súhlas → systém nepošle (consent gate) |
| 4 | Sleduje výsledok | Dashboard: doručené, odpovede, vytvorené termíny, realizované návštevy | Ak konverzia < 5 % → systém navrhne inú fázu (telefonát, iný text, iný čas) |
| 5 | Príde odpoveď „áno, chcem termín“ | Systém prepojí odpoveď s J7 (objednávka) a predvyplní pacienta a typ návštevy | Ak klient odmietne → systém zapíše dôvod a neskúša to znova (nie 4× za mesiac) |
| 6 | Uzavrie kampaň | Report: poslané / konvertované / prínos v €; záznam do histórie kampaní | Ak kampaň minula (napr. pretože text bol nevhodný) → systém navrhne úpravu, nie ďalšie odoslanie |

### Alternatívne toky

1. **Recall pre zosnulé zviera.** Sympathy gate musí blokovať odoslanie; systém musí mať navyše **spätnú kontrolu**, či sa pacient neoznačil ako `deceased` po naplánovaní kampane (fronta vs. stavový zmena).
2. **Klient explicitne odmietol pripomienky.** Systém si to musí pamätať (`sms_suppressions`, `care_reminders` dismissal s dôvodom) a rešpektovať to aj pri manuálnom odoslaní obsluhou — ideálne s viditeľným varovaním.
3. **Dva rôzne zdroje pravdy o termíne** (klinický `care_reminders` vs. marketingový `ext_marketing_recall_schedules`). Ak si protirečia, klient dostane dve rôzne informácie. Systém musí mať jedno primárne pravidlo a marketingový zoznam len ako kanál.
4. **Recall na liek, nie na vakcínu** (napr. kontrola chronického pacienta s liekmi). Systém musí podporovať aj neliekové recally — inak sa chronickí pacienti strácajú.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie zoznamu | **pocit viny a preťaženia** | 40+ ľudí, ktorým sme sa neozvali |
| Odoslanie kampane | úľava | „Systém to spravil za mňa“ |
| Konverzia | **radosť a hrdosť** | „Volali sme a prišli“ |
| Blokovaný klient (sympathy/consent) | zmiešané | Etické, ale znie to ako obmedzenie |
| Neúspešná kampaň | sklamanie | „Zase sme to pokazili“ |

### Kontextové prepojenia

- **Pred:** J13 (očkovanie vytvorilo recall), J15 (kontrolná návšteva), J19 (marketing kampane).
- **Po:** J7 (objednanie), J8 (check-in), J25 (meranie prínosu), J27 (klient si sám objedná z portálu).

### AI Touchpointy

- ✅ **Chceme:** AI generovanie textu pripomienky podľa typu (besnota vs. kontrola vs. lieky), personalizácia s ohľadom na históriu („naposledy sme riešili kožu“), predikcia, koho má zmysel kontaktovať (ochota vrátiť sa), meranie efektu textu A/B, rozpoznanie odpovede klienta v SMS.
- ⛔ **Nechceme:** AI, ktorá sama rozhodne o odoslaní mimo súhlasov; AI, ktorá obchádza sympathy gate; AI, ktorá klientovi sľúbi klinické výsledky (napr. „vakcína vás ochráni 100 %“).

---

### Use Case: UC-114

**Názov:** Recall kampaň — identifikácia pacientov, komunikácia a meranie konverzie
**Primárny aktér:** `front_desk` (vykonanie), `admin`/`veterinarian` (schválenie textu)

**Predpoklady:**
- Existuje recall plán (z vakcinácií, care reminders alebo wellness) s dátumom ďalšej dávky/kontroly.
- Sú nastavené komunikačné kanály, súhlasy, suppression log a sympathy gate.
- Používateľ má oprávnenie spúšťať kampane.

**Hlavný scenár:**
1. Používateľ otvorí recall prehľad alebo prijme týždenný report.
2. Systém zobrazí segmentovaný zoznam s dôvodom (typ, oneskorenie, priorita).
3. Systém vygeneruje alebo predvyplní text správy a zobrazí ho na schválenie.
4. Po schválení systém odošle správy v rámci súhlasov a throttlingu.
5. Systém sleduje odpovede a konverziu na termín.
6. Systém vytvorí report s prínosom a s odporúčaním pre ďalšiu fázu.

**Alternatívne scenáre:**
- **A1 — Bez kanála:** pacient je presunutý do „obvolať“ s telefónnym číslom a poznámkou.
- **A2 — Blokované súhlasom/sympathy:** systém správu neodošle, zapíše dôvod a v reporte to oddelí od „nezáujmu“.
- **A3 — Manuálna kampaň:** používateľ vyberie konkrétnych pacientov a pošle správu jednotlivo (pre citlivé prípady).
- **A4 — Druhá fáza kampane:** pri nízkej konverzii systém navrhne telefonát alebo iný text.

**Výnimočné scenáre:**
- **E1 — Doručenie zlyhá (SMS/e-mail provider):** systém eviduje stav a pokusy, vytvorí úlohu na recepciu; nezapočíta správu ako doručenú.
- **E2 — Duplicitný recall (dva záznamy o tej istej vakcíne):** systém deduplikuje v rámci kampane, aby klient nedostal 2 správy.
- **E3 — Zmena stavu pacienta počas kampane (úhyn, sťažnosť):** systém zastaví odosielanie pre daného pacienta a zapíše, kedy bol kontakt zastavený.

**Postconditions:**
- Kampaň má merateľný výsledok (doručené, odpovede, termíny, prínos v €).
- Všetky správy sú v súlade so súhlasmi a sympathy gate.
- Klient má jasnú cestu k objednaniu (link alebo telefonát).

**Business pravidlá:**
- **GDPR čl. 6/7 + zákon 18/2018:** marketingová komunikácia len so súhlasom, možnosť odhlásenia, evidencia.
- **Zákon 39/2007 Z. z.:** pripomienka povinného očkovania je legitímny záujem, ale nesmie sa používať ako marketing.
- **Sympathy gate:** žiadny kontakt pre zosnulé pacienty.
- **Produktové:** jeden primárny zdroj pravdy o termíne (klinický recall), marketingové kampane sú len kanál.

**Dátové entity:** `ext_marketing_recall_schedules` (R/W), `care_reminders` (R/W), `vaccination_records` (R), `patients` (R), `clients` (R), `sms_consent_events` (R), `platform_email_preferences` (R), `sms_suppressions` (R), `ext_automation_suppression_log` (W), `communications` (W), `ext_marketing_message_logs` (W), `appointments` (W), `audit_log` (W).

**Integrácie:** SMS/e-mail provider, automations engine, portál (link na objednávku), AI copy (marketing composer).

---

## J15 — Wellness plán a kontrolná návšteva

### Persóna & Kontext

**P7 Anna** chce predvídateľný príjem a lepšiu starostlivosť: „zaplaťte mesačne za plán, ktorý pokrýva preventívu“. **P5 Katarína** má psa s CKD — chce vedieť, čo ju čaká, a neplatiť nečakané sumy.
**P1 Peter** chce, aby kontrola nebola „prázdna návšteva“, ale aby niesla konkrétne kroky (krv, tlak, úprava liekov).
**Dáta a kód:** `wellness_plans`, `wellness_enrollments` (cron `/api/cron/wellness-billing` na pravidelné účtovanie), `care_reminders`, `ai.patientsNeedingFollowUp` (dnes **bez UI** — R-11), `/postop/[id]` (verejná pooperačná kontrola).

### Trigger

- **Klinický:** pacient má chronické ochorenie alebo bol po operácii (J21).
- **Obchodný:** klinika chce opakovaný príjem (wellness plán).
- **Systémový:** follow-up odporúčanie z closeoutu (J12) alebo `ai.patientsNeedingFollowUp`.
- **Externý:** klient dostal pooperačný check-in a odpovedal „mám otázku“ (`ext_marketing_postop_responses`).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia/lekár navrhne wellness plán alebo kontrolu | Systém zobrazí plán s obsahom (konzultácie, odbery, očkovanie) a cenou; pri kontrole naplánuje konkrétne úkony podľa diagnózy | Ak pacient zomrel → sympathy gate blokuje enrollment (implementované) |
| 2 | Klient súhlasí | `wellness_enrollments`; systém nastaví pravidelnú platbu a pripomienky (mesačne/ročne) | Ak klient chce plán bez pravidelnej platby → jednorazový balíček (nie plán) |
| 3 | Systém vytvorí plán kontrol | Termíny (napr. 3×/rok kontrola + 1× krv) sa zapíšu do rozvrhu/recallov | Ak je sezóna plná → systém navrhne najbližšie realistické okno |
| 4 | Deň kontroly: technik urobí odbery | Lab výsledky idú do trendov (J16); váha sa meria vždy (nie odhad) | Ak je výsledok mimo rozsahu → alert (J5) a lekár je notifikovaný |
| 5 | Lekár vyhodnotí kontrolu | Systém predloží porovnanie s predchádzajúcimi 2 návštevami (trendy, nie surové čísla) | Ak sa stav zhoršil → systém ponúkne eskaláciu (špecialista, hospitalizácia J20) |
| 6 | Úprava liečby | J5 (guardian) + J10 (predpis/výdaj) s kontextom chronického ochorenia | Ak dávka prekročí maximum → blokácia s dôvodom |
| 7 | Nasledujúca pripomienka | `care_reminders` na ďalšiu kontrolu; voliteľne automatické notifikácie | Ak klient vynechá 2 kontroly → systém eskaluje (telefonát, nie ďalšia SMS) |
| 8 | (Pooperačná kontrola) krátka cesta | Verejný `/postop/[id]` check-in: klient odpovie „v poriadku / otázka / obava“ | Ak „obava“ → úloha pre lekára do 24 h (nie čakanie na najbližší termín) |

### Alternatívne toky

1. **Klient vynechá kontrolu.** Systém musí rešpektovať jeho voľbu, ale aj **viditeľne evidovať riziko**: chronický pacient bez kontroly 6 mesiacov je klinicky iný stav než ten, ktorý chodí. Dashboard musí mať zoznam „stratení pacienti“ (dnes chýba UI pre `ai.patientsNeedingFollowUp`).
2. **Wellness plán a plánovaná platba zlyhá (karta exspirovala).** Systém musí upozorniť kliniku aj klienta a jasne rozlíšiť, či plán pokračuje bez platby (služba vs. platba). Bez toho sa v praxi hromadia nedoplatky, o ktorých nikto nevie.
3. **Pacient v paliatívnej starostlivosti.** Cieľ nie je „vyliečiť“, ale udržať kvalitu života. Systém musí umožniť plán s inými cieľmi (kvalita života, bolesť) a citlivú komunikáciu — vrátane prípravy na eutanáziu (J29).
4. **Multi-actor: klient si sám rezervuje kontrolu z portálu.** Systém musí vedieť rozlíšiť „bežnú kontrolu“ od „kontroly vyžadujúcej lab pred návštevou“ a poslať inštrukciu vopred (napr. 12 h lačnenia).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Návrh plánu | obava z ceny | „Koľko ma to bude stáť?“ |
| Súhlas | **úľava a dôvera** | Predvídateľnosť |
| Kontrola | nádej/strach | Výsledky môžu zmeniť život |
| Zhoršenie | smútok a neistota | Potreba citlivého rozhovoru |
| Vynechaná kontrola | vina (klient) / frustrácia (klinika) | „Nemal som čas“ |

### Kontextové prepojenia

- **Pred:** J12 (closeout odporúčal kontrolu), J21 (pooperačná starostlivosť), J16 (lab).
- **Po:** J16, J5, J10, J20 (hospitalizácia pri zhoršení), J29 (paliatíva/eutanázia), J27 (portál).

### AI Touchpointy

- ✅ **Chceme:** predikcia zhoršenia z trendov (napr. rastúci kreatinín + klesajúca váha → „vyšetrenie skôr než za 6 mesiacov“), príprava agendy kontroly (čo skontrolovať), sumarizácia priebehu pre klienta, návrh textu pooperačného check-inu.
- ⛔ **Nechceme:** AI, ktorá stanoví prognózu bez lekára; AI, ktorá komunikuje zlé správy bez ľudského rozhodnutia; AI, ktorá navýši liečbu bez kontroly interakcií.

---

### Use Case: UC-115

**Názov:** Wellness plán, kontrolná návšteva a follow-up chronického pacienta
**Primárny aktér:** `front_desk` (enrollment a termíny), `veterinarian` (klinické rozhodnutia)

**Predpoklady:**
- Pacient existuje a nie je v sympathy stave.
- Klinika má definované wellness plány (`wellness_plans`) so sumou a intervalom.
- Klient má platobný nástroj alebo súhlasí s platbou na mieste/prevodom.

**Hlavný scenár:**
1. Používateľ navrhne plán alebo kontrolu (alebo systém vytvorí návrh z follow-up logiky).
2. Systém zobrazí obsah, cenu a harmonogram; pri kontrole navrhne konkrétne úkony.
3. Klient súhlasí; systém vytvorí enrollment a naplánuje termíny a pripomienky.
4. Na kontrole systém spracuje vitálne a lab výsledky do trendov.
5. Lekár vyhodnotí stav a upraví liečbu (s kontrolou J5).
6. Systém naplánuje ďalšiu kontrolu a udržiava viditeľnosť pacienta v „starostlivosťovom“ zozname.

**Alternatívne scenáre:**
- **A1 — Jednorazový balíček:** bez pravidelnej platby, jednorazový set výkonov.
- **A2 — Vynechaná kontrola:** pacient zostáva v zozname „stratení/oneskorení“ s eskalačnou úlohou.
- **A3 — Pooperačný check-in:** krátka verejná spätná väzba s eskaláciou pri obavách.
- **A4 — Paliatívny režim:** plán s cieľom kvality života, s inou komunikáciou a pripravenosťou na J29.

**Výnimočné scenáre:**
- **E1 — Zlyhanie pravidelnej platby:** systém upozorní kliniku aj klienta a rozlíši stav služby a platby; plán sa nesmie ticho zrušiť.
- **E2 — Zmena stavu pacienta (úhyn) počas plánu:** systém zastaví účtovanie, prepne komunikáciu do sympathy vetvy a v reportingu to oddelí.
- **E3 — Chýbajúce výsledky pred kontrolou:** systém označí kontrolu ako „bez lab. podkladov“ a ponúkne posun alebo doplnenie; nesmie predstierať kompletnosť.

**Postconditions:**
- Existuje plán/enrollment s harmonogramom a platobnými pravidlami.
- Kontrola má výsledky v trendoch a rozhodnutie lekára.
- Patient má ďalší termín alebo je v eskalačnom zozname.

**Business pravidlá:**
- **GDPR čl. 6:** pravidelné platby a komunikácia len v rámci zmluvného vzťahu a súhlasov.
- **Zákon 39/2007 Z. z.:** pri potravinových zvieratách zachovať väzbu na ochranné lehoty aj v pláne.
- **Sympathy gate:** implementovaná poistka pri `deceased`.
- **Produktové:** plán nesmie generovať účtovanie za neposkytnuté služby; pri prerušení musí byť stav viditeľný.

**Dátové entity:** `wellness_plans` (R/W), `wellness_enrollments` (W/R), `care_reminders` (W/R), `appointments` (W/R), `lab_results` (R/W), `vital_signs` (W), `patient_weights` (W), `prescriptions` (R/W), `invoices`/`payments` (W cez cron), `ext_marketing_postop_responses` (R/W), `audit_log` (W).

**Integrácie:** cron wellness-billing, platobný kanál, SMS/e-mail, lab. analyzátory, portál.

---

## Business Case: Preventívna starostlivosť

### Status Quo

**Bez systému** je preventíva vecou pamäte a papiera:

- Recall sa robí ručne: recepčná raz za mesiac prejde karty a obvoláva. Pri 1 200 aktívnych pacientoch je to 4–6 hodín mesačne a **30–50 % pacientov sa nikdy nedovolá** (nedvíhajú, nemajú čas).
- Miera zaočkovanosti psov proti besnote v praxi „papierového“ typu bývá 60–75 %, hoci by mohla byť 90 %+ — nie preto, že ľudia nechcú, ale preto, že ich nikto neosloví.
- Chronickí pacienti „vypadnú“ po 6–12 mesiacoch; klinika to zistí, až keď prídu v zlom stave (a to je drahšie pre klienta aj horšie pre zviera).
- Wellness plány a preventívne balíčky sa nepredávajú, pretože ich nikto nevie systematicky sledovať (kto je v pláne, čo už vyčerpal, kedy má prísť).

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Znovu-získané návštevy z automatického recallu | 8 návštev/mesiac × 46 € | 4 416 € |
| Wellness plány (predplatné) — dodatočný pravidelný príjem | 6 plánov × 35 €/mesiac | 2 520 € |
| Menej no-show na preventíve (pripomienky) | 3 termíny/mesiac × 46 € | 1 656 € |
| Ušetrený čas recepcie pri príprave zoznamov a obvolávaní | 1,5 h/mesiac × 8,45 € | 152 € |
| Rýchlejšia príprava očkovacej dokumentácie a preukazov | 6 min/deň × 0,15 € × 252 | 227 € |
| Eliminované riziko pokuty pri povinnom hlásení besnoty (expected value) | 1 prípad / 3 roky × 1 200 € | 400 € |
| **Spolu (konzervatívne)** | | **9 371 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € | 5 500 € (menšia prax) | 4,6× | 80 dní |
| **Cloud Solo** | 588 € | 4 400 € (1 lekár, 400 pacientov) | 7,5× | 49 dní |
| **Cloud Klinika** | 1 428 € | 9 371 € | 6,6× | 57 dní |
| **Cloud Nemocnica** | 2 748 € | 14 000 € (viac pacientov, viac pobočiek) | 5,1× | 72 dní |

**Poznámka:** Preventíva má najnižšie ROI v tomto dokumente, ale **najvyšší strategický význam**: zvyšuje klinickú kvalitu (zaočkovanosť), predlžuje životnosť pacienta v praxi a vytvára pravidelný príjem. Pre investorov je to „retention + predictable revenue“, nie „cost saving story“.

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Recall napojený na klinické dáta, nie na marketingový zoznam** | Väčšina PIMS má pripomienky ako „texty“; tu je recall dôsledok konkrétnej vakcinácie, lieku alebo diagnózy s deduplikáciou |
| **Sympathy a consent gate implementovaná na viacerých vrstvách** (vrátane SQL segmentácie) | Jedna necitlivá SMS rodine po úhyne je dôvod na odchod; tu je to systémovo blokované |
| **Wellness plány s cron účtovaním** | Kombinácia klinického harmonogramu a pravidelného príjmu nie je v SK PIMS bežná |
| **Pooperačný check-in cez verejnú stránku** (`/postop/[id]`) | Rýchla spätná väzba od klienta, ktorú konkurencia rieši telefonátom alebo vôbec |

**Kde konkurencia vyhráva:** jednoduchosť a zvyk (Vetfox, Vet-On, Vetis majú pripomienky ako SMS texty a roky praxe s ich správaním). Dôležitejšie než funkcie je **neprekvapiť zákazníka**: systém musí vedieť vyzerať ako to, na čo je klinika zvyknutá.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Klienti nechcú platiť dopredu“ | Odpor k plánom | Wellness ako voliteľný nástroj; default je bezplatný recall na očkovanie |
| „Bojím sa, že pošlem správu nesprávnemu človeku“ | Strach z etického zlyhania | Sympathy gate + suppression + náhľad pred odoslaním a možnosť manuálneho review |
| „Nemám čas obvolávať“ | Realistická kapacita | Automatizovaná prvá fáza (SMS/e-mail) + úlohový zoznam pre telefonáty |
| „Neviem, či to funguje“ | Nedôvera v marketing | Report o konverzii a prínose v € (nie počet odoslaných správ) |
| „Chcem mať kontrolu“ | Lekárska autorita | Každý text je schvaľovaný; AI len navrhuje |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Podiel pacientov s platnou besnotou | 60–75 % | ≥ 88 % | `vaccination_records` vs. aktívni psí pacienti |
| Recall konverzia na termín | 0 % (žiadny systém) | ≥ 15 % | kampaň → vytvorený termín |
| Počet chronických pacientov „stratených“ > 12 mes. | neznámy | < 15 % | posledná návšteva vs. aktívna diagnóza |
| Príjem z wellness plánov | 0 € | ≥ 1 500 €/mesiac | `wellness_enrollments` + fakturácia |
| Follow-up po operácii do 7 dní | neriadený | ≥ 80 % | `ext_marketing_postop_responses` |
| Podiel wellness enrollments s úspešnou platbou | n/a | ≥ 95 % | cron billing + `payments` |
