# Skupina 3 — Farmácia & fakturácia (J10–J12)

> **Frekvencia:** T2 (každý encounter). Tu sa klinický záznam mení na peniaze a na zákonný doklad.
> Chyba tu má tri podoby: stratené euro, nespokojný klient, pokuta. **Business Case:** [BC-3](#business-case-farmácia--fakturácia).

---

## J10 — Predpis, výdaj lieku a účtovanie liečiva

### Persóna & Kontext

**P1 Peter** ukončil vyšetrenie a povie „dám mu 10 dní amoxicilínu, 250 mg tablety, 2× denne“ — a tým začal reťazec, ktorý musí skončiť správnym počtom tabliet na sklade, správne vykázanou položkou na fakture, a pri OPL aj zápisom, ktorý prežije kontrolu.
**P4 Martin** pripraví liek k výdaju; **P2 Lucia** pri pochybnostiach o dávke potrebuje kalkulačku s toxicitou.
**Rozhodovacia realita z kódu:** `prescriptions` + `prescription_events`, `external_prescriptions`/`external_prescription_fills` (lieky vydané inde), `dispense_charge_queue` (výdaj → účtovanie), `inventory` produkty (šarža, exspirácia, `reorderPoint`), `controlled_substance_log`, dávkovacia kalkulačka s kontrolou max. dávok, `voice.extractBillableItems` (admin/vet).

### Trigger

- **Klinický:** pacient potrebuje liečbu po vyšetrení alebo operácii (J21).
- **Skladový:** liek dochádza a je potrebná objednávka (J24).
- **Legislatívny:** potreba evidencie OPL pri podaní alebo znehodnotení (Zákon 139/1998) alebo evidencie ochrannej lehoty (EÚ 2019/6).
- **Externý:** klient prináša recept od inej kliniky alebo prichádza do lekárne kliniky.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Lekár v encounteri vyberie liek (alebo nadiktuje a použije extrakciu) | Systém napojí liek na katalóg `products`, zobrazí stav zásob, šaržu, exspiráciu a cenu; spustí Clinical Guardian (J5) | Ak liek nie je na sklade → ponuka: (a) predpísať na predpis pre lekáreň, (b) ekvivalent, (c) objednať (J24) |
| 2 | Zadá dávkovanie (mg/kg, frekvencia, dĺžka) | Dávkovacia kalkulačka vypočíta množstvo na pacientovu váhu, skontroluje maximum a druh (paracetamol/mačka, ivermektín/kólia); pri potravinovom zvierati vyžiada ochrannú lehotu | Ak je dávka nad maximum → blokujúce varovanie s vysvetlením a nutným dôvodom, ak lekár trvá na podaní |
| 3 | Kontrola v režime „koľko je treba vydať“ | Systém prepočíta počet balení/tablet (napr. 10 dní, 2× denne, 2 tablety/24 h → 20 tabliet), a upozorní na „nedávam celé balenie“ (`dispense_charge_queue`) | Ak je potrebné delenie tablety → systém to zobrazí v inštrukcii pre klienta |
| 4 | Výdaj (technik/lekár) | Systém odpíše zo skladu konkrétnu šaržu (FIFO podľa exspirácie), zapíše `dispense_charge_queue` položku na účtovanie | Ak sa odpisuje iná šarža než FEFO → systém varuje (riziko exspirácie) |
| 5 | (OPL) Podanie a evidencia | `controlled_substance_log`: množstvo, dátum, pacient, lekár; pri znehodnotení povinný svedok | Ak chýba svedok → záznam nie je uzavretý a systém to nahlasuje v dennej kontrole |
| 6 | Vznikne položka na účtovanie | `dispense_charge_queue` → položka pre J11 (faktúra) alebo pre closeout (J12) | Ak je výdaj „na faktúru na účet“ (firemný klient/chov) → `accounts_receivable` |
| 7 | Recept sa vytlačí/odošle | PDF s dávkovaním a inštrukciou v slovenčine; pri potravinovom zvierati s ochrannou lehotou | Ak klient nemá e-mail → tlač alebo SMS so stručným dávkovaním (nie lekárskym textom) |
| 8 | Plus/duálna cesta: klient si vyzdvihne liek v lekárskej lekárni | Systém eviduje `external_prescriptions` a sleduje, či bol liek vydaný, alebo či pacient liečbu nezačal | Ak nie je evidencia výdaja → systém nevie, či pacient lieči (riziko, ktoré by mal otvorene ukázať) |

### Alternatívne toky

1. **Liek nie je na sklade a klient čaká.** Systém musí dať tri realistické voľby (predpis do lekáreň, ekvivalent, objednávka s odhadom doručenia) — nie len „nie je na sklade“. Najhoršie behaviorálne zlyhanie je nechať to na ľudskej improvizácii.
2. **Výdaj mimo záznamu (technik podá a zabudne zapísať).** Systém má dennú kontrolu `dispense_charge_queue` (položky vydané bez účtu) a musí je **aktívne** ukázať pri closeoute alebo na dashboarde — inak sa stráca obrat aj evidencia.
3. **Exspirácia počas liečby (liek s krátkou exspiráciou pri 10-dňovej liečbe).** Systém upozorní, ak šarža exspiruje skôr než plánovaný koniec liečby, a odporučí inú šaržu.
4. **Klient odmieta liek alebo liečbu (finančné dôvody).** Systém musí umožniť zaznamenať „nedohodnutá liečba“ vrátane odôvodnenia — to je klinicky aj právne dôležité (lekár odporučil, klient odmietol).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Voľba lieku | rozhodnosť | Lekár vie, čo chce — nechce byť zdržovaný |
| Dávkovanie | zodpovednosť | Tu je najvyššie klinické riziko |
| Blokujúce varovanie | **úľava (Lucia) / podráždenie (Peter)** | Peter chce vedieť dôvod, inak to považuje za „obštrukciu“ |
| Výdaj | rutina / časový tlak | Technik pripravuje 20–30 výdajov denne |
| Kontrola OPL | vážnosť | Právna zodpovednosť, svedok, papier |

### Kontextové prepojenia

- **Pred:** J5 (guardian), J16 (lab), J3 (encounter), J21 (pooperačná liečba).
- **Po:** J11 (faktúra), J12 (closeout), J24 (sklad), J28 (OPL a ochranné lehoty), J27 (klient vidí inštrukcie a faktúru).

### AI Touchpointy

- ✅ **Chceme:** extrakcia liekov z diktátu (`voice.extractBillableItems`) s povinným prehľadom pred vytvorením účtu; návrh ekvivalentu pri nedostupnosti s odkazom na aktívnu látku; automatické vysvetlenie dávkovania pre majiteľa v ľudskej reči; rozpoznanie „podobného lieku“ pri riziku zámeny (look-alike/sound-alike).
- ⛔ **Nechceme:** AI, ktorá sama určí dávku alebo sama vypočíta počet balení bez prepočtu kalkulačkou; AI, ktorá **prefilluje kontrolované látky** (zero-prefill je pravidlo); AI, ktorá navrhne zmenu liečby počas kontroly (rozhoduje lekár).
- **Otvorená medzera z auditu (F-11-1):** extrakcia dnes používa hardcoded ceny z `KNOWN_SERVICES_CATALOG`, nie cenník kliniky. Pre J10/J11 to znamená riziko nesprávnej faktúry — musí sa napojiť na `services`/`products`.

---

### Use Case: UC-110

**Názov:** Predpis lieku, výdaj zo skladu a vytvorenie účtovanej položky
**Primárny aktér:** `veterinarian` (predpis), `technician` (výdaj); kontrola OPL `admin`/`veterinarian`

**Predpoklady:**
- Pacient má váhu a je priradený k praxi.
- Liek existuje v katalógu (`products`) so stavom zásob, prípadne je vedený ako „na predpis“.
- Pre OPL je nastavená evidencia a je dostupný svedok (druhá osoba).

**Hlavný scenár:**
1. Lekár vyberie liek a zadá dávkovanie.
2. Systém overí dávkovanie, toxicitu druhu, interakcie a ochranné lehoty.
3. Systém vypočíta potrebné množstvo a ponúkne výdaj zo skladu (FEFO podľa exspirácie).
4. Technik vykoná výdaj; systém odpíše šaržu a vytvorí položku v `dispense_charge_queue`.
5. Pri OPL systém vyžiada evidenciu vrátane svedka.
6. Systém vytvorí recept/dávkovaciu inštrukciu pre klienta a položku pre fakturáciu.
7. Položka je dostupná v J11 (faktúra) alebo v J12 (closeout).

**Alternatívne scenáre:**
- **A1 — Liek nie je na sklade:** systém ponúkne predpis do lekáreň, ekvivalent, alebo objednávku s termínom dodania (J24).
- **A2 — Výdaj z otvoreného balenia:** systém vypočíta počet tabliet a vytvorí položku za čiastočné balenie podľa pravidiel praxe.
- **A3 — Klient odmieta liečbu:** systém umožní záznam „odmietnuté“ s dôvodom a bez účtovania lieku.
- **A4 — Externý recept / výdaj mimo praxe:** systém eviduje `external_prescriptions` a stav výdaja, ale neovplyvňuje sklad.

**Výnimočné scenáre:**
- **E1 — Súbežný výdaj poslednej šarže dvoma technikmi:** systém musí vrátiť konflikt a nedovoliť negatívny stav skladu; druhý výdaj ponúkne inú šaržu alebo objednávku.
- **E2 — Zlyhanie tlače receptu:** systém ponechá položku rozpracovanú, ponúkne PDF na stiahnutie a označí tlač ako neúspešnú; recept sa nesmie „stratiť“.
- **E3 — Chýbajúci svedok pri OPL znehodnotení:** záznam zostane otvorený, systém ho zobrazí v dennej kontrole a vyžaduje doplnenie.
- **E4 — Nevalidná dávka (záporná, extrémna):** systém vráti `BAD_REQUEST` s vysvetlením a neuloží predpis.

**Postconditions:**
- Existuje preskripcia s dávkovaním a (ak relevantné) s evidenciou OPL a ochrannej lehoty.
- Sklad je znížený o konkrétnu šaržu a položka je pripravená na účtovanie.
- Klient má zrozumiteľnú inštrukciu (tlač/SMS/portál).

**Business pravidlá:**
- **Zákon 139/1998 Z. z.:** evidencia OPL, zero-prefill (AI), svedok pri znehodnotení, uchovávanie záznamov.
- **EÚ 2019/6 + zákon 39/2007:** evidencia ochranných lehôt, zákaz použitia lieku potravinovému zvieraťu bez evidencie lehoty.
- **Zákon 362/2011 Z. z.** (o liekoch): predpis a výdaj liekov, náležitosti dokladu (repo poznamenáva tento rámec pri preskripcii).
- **Produktové:** žiadny výdaj bez záznamu; žiadny negatívny stav skladu; FEFO pri šaržiach.

**Dátové entity:** `prescriptions` (W/R), `prescription_events` (W), `external_prescriptions` (R/W), `external_prescription_fills` (R), `dispense_charge_queue` (W), `products` (R/W stav), `purchase_orders` (R), `controlled_substance_log` (W/R), `patient_weights` (R), `patient_allergies` (R), `problem_list` (R), `ext_withdrawal_periods` (W/R), `ext_carcass_disposals` (W pri úhyne), `audit_log` (W).

**Integrácie:** veľkoobchodníci (CYMEDICA/PHARMOS/SAMOHÝL/Henry Schein — import dodacích listov, dnes bez UI, R-09), dávkovacia kalkulačka, tlač/PDF, portál.

---

## J11 — Faktúra, platba a e-Kasa doklad

### Persóna & Kontext

**P3 Zuzana** má pred sebou klienta, ktorý chce zaplatiť kartou, a vedľa neho druhého, ktorý chce faktúru na firmu. Za 90 sekúnd musí byť hotový doklad, ktorý obstojí pred daňovou kontrolou, pričom platba kartou prechádza cez terminál a pokladnica cez e-Kasu.
**P7 Anna** na konci dňa potrebuje dennú uzávierku, ktorá „sedí na cent“.
**Rozhodovacia realita z kódu:** faktúry `billing.*` (vytvorenie `requireRole("admin")`, platby `admin`/`front_desk` podľa `billing.ts`), `invoice_items`, `payments`, `invoice_adjustments`, e-Kasa `ekasa_config` / `ekasa_receipts` / `ekasa_daily_closures` (drivers FiskalPRO a VRP2, crony na dennú uzávierku a retry), `financial_closes` (append-only a neprístupné aplikačnej role), poistenie `insurance_claims`, a **európsky fakturačný detail**: DPH sadzby 23 % / 19 % (a 10 % pri liekoch podľa katalógu dodávateľov).

### Trigger

- **Klinický/prevádzkový:** encounter skončil, položky sú pripravené (`dispense_charge_queue`, work items, služby).
- **Systémový:** whiteboard odznak „Čaká na faktúru“ pri `checked_out` pacientovi.
- **Externý:** klient žiada doklad/duplikát; poisťovňa žiada rozpis; účtovníčka žiada export.
- **Pravidelný:** denná uzávierka pokladnice (cron) a mesačný export (J25).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí pacienta/visit closeout a klikne „Vytvoriť faktúru“ | Systém zobrazí **predvyplnené položky** (služby, lieky, materiál, procedúry) vrátane tých, ktoré vznikli v `dispense_charge_queue` | Ak položka chýba (napr. výkon nebol zaznamenaný) → recepcia ju musí vedieť pridať z cenníka bez opustenia obrazovky |
| 2 | Skontroluje položky a ceny | Ceny sa berú z cenníka praxe (`services`/`products`), nie z hardcoded katalógu (F-11-1); systém zobrazí DPH sadzbu a odpočítateľnosť | Ak je klient poistený (PetExpert/Generali/Union) → systém prepne do režimu poistnej udalosti (J11-A2) |
| 3 | Zvolí typ dokladu | Možnosti: faktúra (daňový doklad), pokladničný blok s e-Kasa dokladom, „no charge“ (bez poplatku), dobropis pri oprave | Ak ide o platbu kartou → systém pošle sumu na terminál (Nexi/SLSP/ČSOB cez FiskalPRO) |
| 4 | Prijme platbu | Systém zaznamená `payments` (hotovosť/karta/prevod, čiastočné platby); pri e-Kase vytvorí doklad a zapíše UID | Ak e-Kasa nie je aktivovaná (`EKASA_FISCALIZATION_ENABLED=false`) → systém **jasne označí**, že doklad nie je fiškálny (cvičný režim) |
| 5 | Odošle/vytlačí doklad klientovi | PDF/e-mail/SMS alebo tlač; pri platbe kartou potvrdenie o úhrade; systém eviduje stav doručenia | Ak odoslanie zlyhá → úloha a možnosť stiahnuť PDF priamo z portálu (J27) |
| 6 | (Nepravidelnosť) Oprava faktúry | Storno alebo dobropis; systém vyžaduje dôvod a zapisuje do auditu; storno len admin/vet | Ak bola faktúra už zaplatená → jasný postup (dobropis + nová faktúra) |
| 7 | Denná uzávierka | `ekasa.dailySummary` + `ekasa_daily_closures`; systém porovná pokladnicu a platby, vytvorí uzávierku | Ak je rozdiel → systém zobrazí konkrétne neuzavreté transakcie, nie len číslo |
| 8 | (Poisťovňa) Vytvorí poistnú udalosť | Payload builder pre PetExpert (validácia čipu, exspirácia poistky, spoluúčasť 10 % / min. 35 €), export pre Generali/Union | Ak poistka exspirovala → systém to zobrazí ešte pred vytvorením faktúry (nie po nej) |

### Alternatívne toky

1. **Klient platí kartou a transakcia neprejde.** Systém musí ponechať faktúru neuhradenú bez fiškálneho dokladu (nie „vytvorený a potom zmazaný“), ponúknuť opakovanie alebo inú formu platby a zreteľne odlíšiť stav „platba zlyhala“ od „platba prebehla“. V e-Kasa reťazci je to o to citlivejšie: doklad sa nesmie vytlačiť pred potvrdením úhrady bez vedomého rozhodnutia obsluhy.
2. **Poistenie (PetExpert direct settlement).** Klient hradí len spoluúčasť (typicky 10 %, min. 35 €), zvyšok uhrádza poisťovňa na účet kliniky. Systém musí: (a) overiť čip a exspiráciu poistky, (b) vygenerovať poistnú udalosť s položkovým rozpisom, (c) správne vykázať pohľadávku voči poisťovni (`insurance_claims`), (d) po vyplatení spárovať platbu (banková/ručná) a uzavrieť pohľadávku. Bez bodu (d) sa „poisťou hradená“ faktúra stane večným nedoplatkom.
3. **Faktúra na firmu / chov (accounts receivable).** Klient neplatí na mieste; systém musí umožniť `chargeDisposition = accounts_receivable`, sledovať splatnosť a upozorňovať — inak sa pohľadávky strácajú v Exceli.
4. **Duplicitná faktúra pre ten istý encounter.** Systém musí zabrániť vytvoreniu druhej faktúry na ten istý `visitId` (alebo to aspoň explicitne potvrdiť), inak vzniká dvojité účtovanie, ktoré klient odhalí a stratí dôveru.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Kontrola položiek | napätie | „Sedí to na to, čo sme spravili?“ |
| Vytvorenie dokladu | zodpovednosť | Právny dokument, kontrola FS SR |
| Platba kartou | mierny stres | Terminál, čakanie, klient sa pozerá |
| Odchod klienta | **úľava a profesionálny pocit** | Všetko prebehlo bez doťahovania |
| Uzávierka dňa | únava → úľava | „Sedí to“ je najlepší koniec dňa |
| Nezrovnalosť | panika | „Kde je chyba?“ bez detailov = najhoršie |

### Kontextové prepojenia

- **Pred:** J10 (výdaj lieku), J12 (closeout), J17 (RTG), J16 (lab), J8 (check-out).
- **Po:** J25 (reporting a mesačná uzávierka), J24 (spotreba skladu), J27 (klient vidí faktúru).

### AI Touchpointy

- ✅ **Chceme:** extrakcia účtovateľných položiek z diktátu (`voice.extractBillableItems`) s povinným ľudským výberom; upozornenie „tento výkon sa bežne účtuje a nebol pridaný“; zhrnutie faktúry pre klienta ľudskou rečou („zákrok, 3 lieky, 1 krvný test“); kontrola konzistencie (napr. lab test bez výsledku, materiál bez zákroku).
- ⛔ **Nechceme:** AI, ktorá sama nastaví cenu alebo sama vytvorí faktúru bez potvrdenia; AI, ktorá „dotvorí“ chýbajúce položky bez toho, aby ich človek videl; AI v e-Kasa fiškálnom reťazci (mimo čitateľnej kontroly).
- **Poznámka:** `ai.dailySummary` vs `ekasa.dailySummary` — dve procedúry s rovnakým názvom a rôznym obsahom (F-11-2). Pre UX je to matúce, treba premenovať.

---

### Use Case: UC-111

**Názov:** Vytvorenie faktúry, evidencia platby a vystavenie e-Kasa dokladu (vrátane poistného vyúčtovania)
**Primárny aktér:** `front_desk`; schvaľovanie storno `admin`/`veterinarian`

**Predpoklady:**
- Existuje uzavretá alebo prebiehajúca návšteva s položkami na účtovanie.
- Cenník praxe (`services`, `products`) je nastavený a položky majú DPH sadzbu.
- Pri e-Kasa platbách je nakonfigurovaný driver (`ekasa_config`) a hardvér dostupný (LAN/REST/USB, prípadne VRP2).

**Hlavný scenár:**
1. Používateľ otvorí closeout/fakturáciu a systém predvyplní položky.
2. Používateľ skontroluje a prípadne doplní položky z cenníka.
3. Systém vyberie typ dokladu (faktúra, pokladničný doklad, no-charge, poistná udalosť).
4. Používateľ zaeviduje platbu (hotovosť, karta, prevod, čiastočná).
5. Systém vystaví e-Kasa doklad (ak je aktivovaná) alebo označí cvičný režim.
6. Systém doručí doklad klientovi (PDF/e-mail/SMS/portál).
7. Pri poistení systém vytvorí poistnú udalosť a pohľadávku voči poisťovni.

**Alternatívne scenáre:**
- **A1 — No-charge návšteva:** faktúra sa nevytvorí; closeout sa uzavrie bez poplatku (napr. kontrola po operácii v rámci balíčka).
- **A2 — PetExpert direct settlement:** klient platí spoluúčasť, systém vytvára `insurance_claims` a čaká na úhradu 90 %.
- **A3 — Accounts receivable (firma, chov):** faktúra so splatnosťou; systém sleduje úhradu a pripomína ju.
- **A4 — Storno/dobropis:** oprava s dôvodom a auditom, len oprávnená rola.
- **A5 — Wellness/plánovaná platba:** pravidelné platby (`wellness_enrollments`) účtované cronom a spárované s faktúrou.

**Výnimočné scenáre:**
- **E1 — e-Kasa driver nedostupný (offline front):** systém zaradí doklad do offline frontu s idempotenciou a viditeľným stavom; klinika ďalej pracuje, ale **nesmie** tvrdiť, že doklad je vystavený.
- **E2 — Duplicitná platba (dvojklik / terminál dvakrát):** systém rozpozná duplicitu na základe idempotency key a druhú platbu odmietne alebo označí na ručné riešenie.
- **E3 — Chybná DPH sadzba (produkt bez sadzby):** systém zablokuje vystavenie dokladu a vyžiada doplnenie sadzby; nesmie potichu použiť default.
- **E4 — Zlyhanie dennej uzávierky:** systém opakovane skúsi cronom (`ekasa-retry`), viditeľne označí neuzavretý deň a nikdy nevykáže uzávierku, ktorá neprebehla.
- **E5 — Poistka neplatná/expirovaná:** systém to zobrazí pred vytvorením faktúry; pri vytvorení dokladu s neplatnou poistkou musí byť rozhodnutie vedomé.

**Postconditions:**
- Existuje doklad s položkami, DPH, ID platby a (ak relevantné) e-Kasa UID.
- Klinika má uzavretú alebo evidovanú pohľadávku (klient/poisťovňa).
- Klient má doklad dostupný v portáli.

**Business pravidlá:**
- **Zákon 289/2008 Z. z. (e-Kasa):** evidencia tržieb, pokladničné doklady, denná uzávierka, offline režim; **stav certifikácie musí byť komunikovaný** (R-06).
- **Zákon 222/2004 Z. z. (DPH):** správne sadzby a náležitosti dokladu (23 %/19 %; 10 % pri liekoch, ak je nastavené).
- **Zákon 431/2002 Z. z. (účtovníctvo):** uchovávanie dokladov, append-only `financial_closes`, export pre účtovníka.
- **GDPR:** faktúra nesmie obsahovať klinické údaje nad nevyhnutný rozsah; poistnej udalosti odovzdávame len potrebné údaje.
- **Produktové:** žiadna faktúra bez položky, žiadny doklad bez ceny z cenníka, žiadne tiché defaulty.

**Dátové entity:** `invoices` (W), `invoice_items` (W), `invoice_adjustments` (W), `payments` (W), `payment_disputes` (W), `ekasa_config` (R), `ekasa_receipts` (W), `ekasa_daily_closures` (W), `financial_closes` (W — append only), `insurance_policies` (R), `insurance_claims` (W), `services`/`products` (R), `dispense_charge_queue` (R/W), `visit_closeouts` (R/W), `audit_log` (W).

**Integrácie:** e-Kasa drivers (FiskalPRO VX520/VX675/N5/T2, VRP2), platebné terminály (Nexi/SLSP/ČSOB), Stripe (online platby v portáli), PetExpert + Generali/Union export, poštová/fakturačná e-mail infra.

---

## J12 — Uzavretie návštevy a odovzdanie klientovi (closeout)

### Persóna & Kontext

**P3 Zuzana** potrebuje jedným miestom uzavrieť návštevu: či je zaplatené, či liek ide domov, či má prísť na kontrolu, a či má dostať správu. **P1 Peter** chce mať istotu, že pacient neodíde bez toho, aby mal v ruke plán.
**Rozhodovacia realita z kódu:** `visit_closeouts` s enumami `chargeDisposition = paid | accounts_receivable | no_charge`, `prescriptionDisposition = prescribed | not_needed`, `followUpDisposition = none | needed | scheduled`, `handoffMethod = print | …`; stav `draft → clinical_finalized → completed`; whiteboard odznak „Čaká na faktúru“; `visit_work_items`; `visit_treatment_plans` s prezentáciou klientovi a jeho odpoveďou.

### Trigger

- **Klinický:** encounter je klinicky ukončený (`finalizeClinical`).
- **Systémový:** whiteboard ukazuje pacienta `checked_out` s neuzavretým účtovaním.
- **Externý:** klient sa pýta „a čo ďalej?“ — to je najčastejšia otázka dňa.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí closeout pre visit | Systém zobrazí 3 rozhodnutia v jednom paneli: **peniaze, lieky, follow-up** (mapovanie na enumy `visit_closeouts`) + spôsob odovzdania | Ak nie je klinicky finalizované → systém to blokuje s odkazom na J3 |
| 2 | Rozhodne o platbe | `paid` (s faktúrou/dokladom), `accounts_receivable` (na účet), `no_charge` | Ak je `no_charge` a existuje spotreba lieku → systém sa opýta, či ide o goodwill alebo o chybu (aby sa nestrácal tovar) |
| 3 | Rozhodne o liekoch | `prescribed` (s odkazom na J10) alebo `not_needed` | Ak lieky nie sú vydané a mali byť → systém drží otvorenú položku `dispense_charge_queue` |
| 4 | Rozhodne o follow-upe | `none`, `needed` (úloha pre recepciu), `scheduled` (termín vytvorený v J7) | Ak `needed` bez termínu → systém vytvorí úlohu na recepciu s odporúčaným oknom (napr. 10–14 dní) |
| 5 | Vyberie spôsob odovzdania | `print` / e-mail / SMS / portál: prepúšťacia správa a inštrukcie (`extensions.discharge.*`, J21/J29) | Ak má klient odmietnutý kontakt → tlač a poznámka „odovzdané osobne“ |
| 6 | Dokončí closeout | Stav `completed`; whiteboard pacienta vyčistí alebo ponechá s odznakom nedoplatku | Ak zostáva nedoplatok → pacient zostáva viditeľný do úhrady (nie „zmizne“) |
| 7 | (Voliteľne) prezentuje liečebný plán | `visit_treatment_plans`: prezentácia klientovi s jeho odpoveďou po jednotlivých bodoch (akceptované/odmietnuté/otázka) a revíziami | Ak klient odmietne časť plánu → eviduje sa odpoveď, aby bola dohoda doložiteľná |
| 8 | Systém spustí automatizácie | Pripomienka, post-op check-in (`/postop/[id]`), review request, wellness ponuka — **vždy v rámci consent a sympathy gate** | Ak pacient zomrel → sympathy gate blokuje automatizácie a prepne jazyk komunikácie (J29) |

### Alternatívne toky

1. **Klient odchádza bez zaplatenia (a sľúbi, že príde).** Closeout musí umožniť `accounts_receivable` s poznámkou a dátumom pripomienky; systém drží pacienta na whiteboarde ako „nedoplatok“ a neskôr pripomína. Dnes je to manuálna hliadka v hlave recepčnej.
2. **Návšteva bez poplatku (kontrola v rámci balíčka, goodwill, reklamácia).** Systém musí evidovať **kto** rozhodol a **prečo** — nešlo o chybu, ale o obchodné rozhodnutie; bez tejto stopy sa v reportingu tvári ako „strata“.
3. **Pacient je hospitalizovaný (nepúšťa sa domov).** Closeout sa nesmie použiť ako ukončenie; v dnešnej verzii neexistuje hospitalizačný modul (R-02). Minimálna náhrada: stav „zostáva na klinike“ s poznámkou a otvoreným work itemom, aby sa nezabudlo na plán.
4. **Klient chce všetko na papieri a „váš systém ma nezaujíma“.** Systém musí dať kvalitný tlačový výstup (medical record summary, prepúšťacia správa, inštrukcie) — papier je legitímna voľba klienta, nie zlyhanie kliniky.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie closeout | netrpezlivosť | Je tu ďalší pacient |
| Rozhodnutia | zodpovednosť a mierny stres | Tri veci naraz, na ktoré sa nedá zabudnúť |
| Odovzdanie klientovi | **profesionalita a úľava** | „Mám to čierne na bielom“ |
| Nezaplatené | nepríjemnosť | Konflikt s klientom |
| Zabudnutý follow-up | vina | „Povedal som mu, aby prišiel, ale nikto mu nezavolal“ |

### Kontextové prepojenia

- **Pred:** J3 (encounter), J10 (lieky), J11 (platba), J21 (pooperačná starostlivosť).
- **Po:** J15 (kontrola), J14 (recall), J19 (review request), J27 (portál), J29 (sympathy).

### AI Touchpointy

- ✅ **Chceme:** discharge text s deterministickým fallbackom (už existuje a je to vzor správania), automatické zostavenie „čo robiť doma“ v jazyku klienta, rozpoznanie potreby follow-upu z obsahu SOAP (návrh, nie rozhodnutie), sumarizácia nákladov pre klienta.
- ⛔ **Nechceme:** AI, ktorá rozhodne o `no_charge`; AI, ktorá odošle faktúru alebo prepúšťaciu správu bez ľudskej kontroly pri citlivých prípadoch (eutanázia, úhyn, sťažnosť).

---

### Use Case: UC-112

**Názov:** Uzavretie návštevy (closeout) s rozhodnutím o platbe, liekoch, follow-upe a odovzdaní
**Primárny aktér:** `front_desk` (uzavretie), `veterinarian`/`technician` (klinické rozhodnutia)

**Predpoklady:**
- Návšteva existuje a je klinicky ukončená (`visit_closeouts.status` aspoň `clinical_finalized`).
- Existuje aspoň jeden rozhodovací vstup pre každý z troch „disposition“ bodov (prípadne sa použije default s povinným potvrdením).

**Hlavný scenár:**
1. Používateľ otvorí closeout.
2. Systém zobrazí stav klinickej finalizácie a pripravené položky/faktúru.
3. Používateľ rozhodne o platbe, liekoch a follow-upe.
4. Používateľ vyberie spôsob odovzdania dokumentov.
5. Systém dokončí closeout a aktualizuje whiteboard.
6. Systém naplánuje follow-up, pripomienky a (voliteľne) automatizácie v rámci súhlasov.

**Alternatívne scenáre:**
- **A1 — Nedoplatok na faktúru:** `accounts_receivable` s pripomienkou a viditeľným stavom na whiteboarde.
- **A2 — Bez poplatku:** `no_charge` s dôvodom a autorom rozhodnutia.
- **A3 — Follow-up „potrebný“ bez termínu:** systém vytvorí úlohu pre recepciu s odporúčaným oknom.
- **A4 — Prezentácia liečebného plánu s odpoveďou klienta:** plán má revízie a odpovede po položkách (dohoda je doložiteľná).

**Výnimočné scenáre:**
- **E1 — Closeout pri nedokončenom klinickom zázname:** systém blokuje uzavretie a odkáže na J3; nesmie dovoliť „uzavrieť bez záznamu“.
- **E2 — Zlyhanie generovania prepúšťacej správy:** systém použije deterministickú šablónu a označí, že AI nebola použitá (`usedAi: false`); pacient nesmie odísť bez inštrukcií.
- **E3 — Duplicitné uzavretie (dve obrazovky):** druhý pokus vráti konflikt a zobrazí aktuálny stav closeoutu.
- **E4 — Pacient so stavom `deceased`:** systém blokuje automatizácie a ponúkne sympathy vetvu (kondolenčné správy, žiadny review request, žiadny recall).

**Postconditions:**
- `visit_closeouts` je `completed` s vyplnenými decision bodmi.
- Klient má doklad a inštrukcie (tlač/e-mail/portál).
- Follow-up je buď naplánovaný, alebo je vytvorená úloha; whiteboard je čistý alebo nesie nedoplatok.

**Business pravidlá:**
- **Zákon 39/2007 Z. z.:** záznam o ošetrení vrátane odporúčaní; pri potravinových zvieratách ochranná lehota v odovzdaných inštrukciách.
- **Zákon 289/2008 + 431/2002:** doklad a jeho uchovanie; finančné uzávierky nemenné.
- **GDPR:** automatizované správy (follow-up, review request) len v rámci súhlasov; sympathy gate.
- **Produktové:** žiadna návšteva nesmie byť „uzavretá“ bez rozhodnutia o platbe a follow-upe; žiadne automatizácie pre zosnulých pacientov alebo po sťažnosti.

**Dátové entity:** `visit_closeouts` (W/R), `visit_work_items` (W/R), `invoices` (R/W), `payments` (R/W), `prescriptions` (R), `dispense_charge_queue` (R/W), `discharge_reports` (W), `visit_treatment_plans`, `visit_treatment_plan_responses`, `visit_treatment_plan_response_lines` (W), `care_reminders` (W), `ext_marketing_postop_responses` (W), `communications` (W), `audit_log` (W).

**Integrácie:** e-Kasa, platobné terminály, SMS/e-mail, portál (dokumenty a faktúry), AI discharge (`extensions.discharge.*`).

---

## Business Case: Farmácia & fakturácia

### Status Quo

Dnešná praxe v slovenskej klinike bez integrovaného PIMS: sklad a fakturácia žijú v **dvoch oddelených svetoch**. Sklad je často Excel alebo modul v účtovnom programe, fakturácia v inom programe, a klinický záznam v treťom. Následky:

- **Stratený obrat z nepodchytených výdajov:** liek sa vydá, ale nevykáže. Pri 20–30 výdajoch denne a 2–3 % „zabudnutých“ položkách ide o 20–35 €/deň.
- **Exspirácie a nepresné stavy:** typická klinika s 8 000–15 000 € skladom stráca 2–4 % ročne na exspirácie a rozdiely v stavoch (240–600 €/mesiac).
- **Ručné prepisovanie dodacích listov:** 6–10 hodín mesačne technika (60–100 €/mesiac).
- **Fakturácia:** 42 dokladov denne, každý s manuálnym hľadaním ceny; pri kartových platbách sa musí ručne prepisovať suma do pokladnice — priestor na chyby a na rozdiel v uzávierke.
- **Poisťovne:** bez direct settlementu klient platí celú sumu a poisťovňa mu prepláca 4–8 týždňov; klinika stráca konverziu pri drahších zákrokoch (klient odkladá alebo ide inam).

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Čas výdaja lieku (25 výdajov/deň, 1 min úspora) | 25 × 0,17 € × 252 | 1 071 € |
| Znížené exspirácie a skladové rozdiely | 160 €/mesiac úspora | 1 920 € |
| Menej strát z neevidovaného výdaja | 60 €/mesiac | 720 € |
| Vyššia zachytenosť účtovaných výkonov (1,5 % obratu) | 41 400 € × 1,5 % × 12 | 7 452 € |
| Rýchlejšia fakturácia (40 s/účet × 42 účtov) | 28 min × 0,15 € × 252 | 1 058 € |
| Denná uzávierka e-Kasa (12 → 3 min) | 9 min × 0,15 € × 252 | 340 € |
| Poisťovne: rýchlejšie vyplatenie (cash-flow efekt a istota pohľadávky) | odhad | 1 200 € |
| Menej chýb v DPH a dobropisov pri kartových platbách | 12 prípadov × 15 min + riziko | 350 € |
| PetExpert/Generali/Union: správny rozpis znižuje reklamácie a vratky | odhad na základe typickej miery vratiek | 1 000 € |
| **Spolu (konzervatívne)** | | **15 111 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € | 9 500 € (menšia prax, menší sklad) | 7,9× | 46 dní |
| **Cloud Solo** | 588 € | 6 200 € (1 lekár, ~12 výdajov/deň) | 10,5× | 35 dní |
| **Cloud Klinika** | 1 428 € | 15 111 € | 10,6× | 35 dní |
| **Cloud Nemocnica** | 2 748 € | 22 000 € (viac skladu, viac poisťovní, viac pokladníc) | 8,0× | 46 dní |

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Import dodacích listov od 4 SK veľkoobchodníkov** (CYMEDICA, PHARMOS, SAMOHÝL, Henry Schein) so šaržami a exspiráciami (`lib/inventory/wholesaler-import.ts`) | Vetfox podporuje Noviko/SG-VET/Samohýl/Biopharm pre CZ trh; **slovenskí dodávatelia a ich formáty sú odlišný argument**. Pozor: parser existuje, UI nie (R-09) |
| **Väzba výdaj → účtovanie (`dispense_charge_queue`)** | V mnohých systémoch je sklad a fakturácia oddelená; tu je výdaj udalosťou, ktorá nikdy „nezmizne“ bez rozhodnutia |
| **e-Kasa drivers (FiskalPRO + VRP2) s offline frontom a retry** | Pre SK trh je to priama zákonná požiadavka, nie „integrácia“; kombinácia s pokladnicou a faktúrou v jednom systéme je vzácnosť |
| **Poistný direct settlement PetExpert vrátane výpočtu spoluúčasti (10 %, min. 35 €)** | Konkurencia často rieši poistky exportom PDF; automatizácia skracuje peňažný cyklus |
| **Nemenné finančné uzávierky (`financial_closes` mimo aplikačnej role)** | V prípade sporu je preukázateľné, že uzávierka nebola menená z aplikácie |

**Kde konkurencia vyhráva:** skladové a fakturačné moduly starších SK/CZ systémov (Vetis, Vet-On) sú zrelé, s dlhoročne ladenými tlačovými výstupmi a zvykmi účtovníkov. OpenVPM musí dodať **presvedčivý export pre účtovníčku** a tlačové zostavy, inak narazí na odpor mimo kliniky.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie v designe |
|---|---|---|
| „Účtovníčka používa iný program“ | Export nezodpovedá jej zvykom | J25: CSV/PDF export s jasnými stĺpcami a mapovateľnými kódmi; dohodnutie formátu pri onboardingu |
| „Nemáme certifikovanú pokladnicu“ | R-06 (e-Kasa default off) | UI rozlišuje cvičný a fiškálny režim; onboarding vysvetlí stav certifikácie bez zavádzania |
| „Ceny máme inde“ | F-11-1 (hardcoded ceny) | Cenník praxe ako jediný zdroj pravdy; AI extrakcia nesmie predvyplniť cenu mimo cenníka |
| „Bojím sa, že prídem o prehľad o sklade“ | Zvyk na Excel | Inventúra (J24) + report spotreby a exspirácií s exportom; sklad je viditeľný aj bez klikania |
| „Poisťovne sú komplikované“ | Nechuť riešiť direct settlement | Systém vedie cez kontrolu čipu/exspirácie poistky a vytvorí podklady za obsluhu |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Podiel výdajov bez účtovanej položky | 2–3 % | < 0,3 % | `dispense_charge_queue` bez nadväzujúcej faktúry |
| Hodnota exspirácií za mesiac | 240–600 € | < 120 € | skladové odpisy/exspirácie |
| Rozdiel v dennej e-Kasa uzávierke | 2–5 prípadov/mesiac | ~0 | počet neuzavretých/nesediacich dní |
| Priemerný čas fakturácie jedného účtu | 2–3 min | < 60 s | čas v UI + počet manuálnych položiek |
| Podiel poistných udalostí vyplatených do 30 dní (PetExpert) | 40 % | ≥ 80 % | `insurance_claims` stav + dátum úhrady |
| Chybovosť DPH | neznáma | 0 chýb | kontrola reportov vs. doklady |
| Podiel faktúr hradených online (portál) | 0 % | ≥ 20 % | `payments` kanál + `stripe_events` |
