# Skupina 8 — Sklad, reporting a admin (J24–J26)

> **Frekvencia:** T4 (týždenne / mesačne), ale **dopad je najvyšší na odpoveď „vyplatí sa to?“**.
> Túto skupinu čítajú vlastníci kliník, nie recepcia. **Business Case:** [BC-8](#business-case-prevádzka--back-office).

---

## J24 — Sklad, inventúra a objednávanie (supply chain, exspirácie, minimálne zásoby)

### Persóna & Kontext

**P4 Martin** objednáva lieky a materiál. Vie, že keď sa minie infúzna súprava počas víkendu, bude to znamenať cestu do nemocničnej lekárne za dvojnásobnú cenu. **P7 Anna** chce mať sklad pod kontrolou, lebo sklad je viazaný kapitál (typicky 8 000–15 000 €) a najčastejšia strata v klinike.
**Reality check z kódu:** `inventory.*` (list/úpravy), `products` s `lotNumber`, `expirationDate`, `costPrice`, `reorderPoint` (default 10), filtre `low_stock | expired | expiring_soon`; `reports.inventoryAlerts`; `purchase_orders`, `suppliers`. **Kľúčová medzera (R-09):** parser dodacích listov od CYMEDICA/PHARMOS/SAMOHÝL/Henry Schein existuje v `lib/inventory/wholesaler-import.ts`, ale **nemá UI na dashboarde** — plánované v0.7.

### Trigger

- **Časový cyklus:** týždenná kontrola zásob; mesačná inventúra určitých kategórií; ročná inventúra.
- **Systémový:** `reorderPoint` dosiahnutý; exspirácia do 60 dní; dlhodobo nepoužívaný liek.
- **Externý:** príchod dodacieho listu (papier/PDF/CSV); cenová zmena od dodávateľa.
- **Klinický:** urgentný nákup (napr. liek potrebný pre hospitalizovaného pacienta).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/inventory` | Systém zobrazí dashboard: hodnota skladu, počet expirácií do 60 dní, položky pod `reorderPoint`, rozdiely | Ak je hodnota skladu nad rozumnou hranicou → systém navrhne prebytočné položky (viazaný kapitál) |
| 2 | Skontroluje alerty | Systém zobrazí tri kategórie: `low_stock` (doobjednať), `expired` (okamžité riešenie), `expiring_soon` (prioritne spotrebovať) | Ak je exspirácia lieku používaného denne → systém navrhne použiť skôr (FEFO) v J10 |
| 3 | Vytvorí objednávku | Systém navrhne optimálne množstvo podľa spotreby za 3–6 mesiacov a aktuálneho stavu; vytvorí `purchase_orders` pre dodávateľa | Ak je dodávateľ nedostupný/oneskorený → systém ponúkne alternatívu a upozorní na riziko |
| 4 | Príjem tovaru | Manuálny príjem **alebo import dodacieho listu** (CSV/EDI/EAN podľa dodávateľa — dnes bez UI, R-09); systém páruje kódy, **šarže a exspirácie** | Ak sa cena líši od poslednej → systém zobrazí rozdiel a vyžiada potvrdenie (nie tiché prepísanie) |
| 5 | Doplnenie šarží | Systém uloží šaržu, exspiráciu, nákupnú cenu a množstvo; pri existujúcej šarži pridá množstvo | Ak je rovnaká šarža s inou exspiráciou → systém blokuje a žiada kontrolu dodacieho listu |
| 6 | Inventúra | Režim počítania (mobilné zadanie, porovnanie so systémom), po uzavretí len **korekčné záznamy s dôvodom** | Ak rozdiel > 5 % hodnoty → systém vyžaduje schválenie adminom a zapíše dôvod |
| 7 | Cenotvorba a marže | Systém zobrazí nákupnú cenu, predajnú maržu a podiel na obrate; upozorní na položky s nulovou alebo zápornou maržou | Ak sa marža dostane pod minimum → systém navrhne novú predajnú cenu (schvaľuje admin) |
| 8 | Report a kapitál | Systém zobrazí hodnotu skladu v čase, obrátku a straty (exspirácie, rozdiely) | Ak obrátka klesá → systém navrhne zúženie sortimentu (nie o 3 mesiace, ale okamžite) |

### Alternatívne toky

1. **Dodací list v inom formáte, než parser čaká.** Systém musí mať **manuálny fallback** (ktorý je dnes v praxi hlavná cesta) a jasne povedať, ktoré pole sa nepodarilo namapovať. Alternatíva: „pošli vzor vzorového súboru dodávateľovi podpory“ — ale reakcia musí byť okamžitá, nie čakanie na ticket.
2. **Exspirácia sa zistí až po použití (nie pri príjme).** Systém musí umožniť spätné dohľadanie šarže: ktorí pacienti ju dostali (dôležité pri recalli šarže od výrobcu!). Toto je funkcia, ktorá pri skutočnej reklamácii šarže zachraňuje kliniku aj pacientov.
3. **Sklad nesedí podľa dôvodu „niekto zabudol zapísať výdaj“.** Systém musí vidieť `dispense_charge_queue` (vydané bez účtu) a spojiť to s inventúrou — inak sa rozdiely „utopia“.
4. **Dvojsklad (ambulancia + sklad/lekáreň).** Systém musí umožniť viac lokácií skladu a jasný presun medzi nimi (dnes je to skôr jednolokačné).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Kontrola dashboardu | **pocit kontroly** | „Konečne vidím, čo mám“ |
| Zistenie exspirácií | mrzutosť (vlastná chyba) | Strata peňazí, ktorá sa dala predísť |
| Príjem dodacieho listu | frustrácia | Manuálne prepisovanie (dokým nie je UI) |
| Inventúra | nuda a odpor | Nikto ju nemá rád |
| Po uzavretí | úľava a istota | „Sklad sedí“ |

### Kontextové prepojenia

- **Pred:** J10 (výdaj liekov), J11 (marže a fakturácia), J20/J21 (materiál pre hospitalizáciu a chirurgiu).
- **Po:** J11 (ceny), J25 (reporting), J30 (kontrola OPL a skladových záznamov).

### AI Touchpointy

- ✅ **Chceme:** predikcia spotreby (sezónnosť, počet pacientov, histórie), automatické návrhy objednávok, rozpoznanie „podobného lieku“ v dodacom liste pri zmene názvu, upozornenie na anomálie (napr. desaťnásobný nárast výdaja jedného lieku → možný preklep alebo zneužitie).
- ⛔ **Nechceme:** AI, ktorá sama odošle objednávku dodávateľovi; AI, ktorá sama zmení ceny bez schválenia; AI bez fallbacku pri nerozpoznanom formáte (musí priznať neistotu).

---

### Use Case: UC-124

**Názov:** Správa skladu — príjem, výdaj, inventúra, objednávanie a alerty
**Primárny aktér:** `technician`, `admin` (úpravy a ceny); `front_desk` správa liekov podľa role

**Predpoklady:**
- Existuje katalóg produktov s `reorderPoint`, cenami a (pri liekoch) šaržami a exspiráciami.
- Sú definovaní dodávatelia (`suppliers`) a ideálne formát dodacích listov.
- Používateľ má oprávnenie na úpravy (úpravy: admin/vet).

**Hlavný scenár:**
1. Používateľ otvorí inventár a systém zobrazí alerty a hodnotu skladu.
2. Používateľ vytvorí objednávku na základe návrhu alebo manuálne.
3. Pri príjme systém spracuje dodací list (import alebo manuálne) a aktualizuje šarže, exspirácie a ceny.
4. Systém aktualizuje stav a prepočíta marže a obrátku.
5. Používateľ vykoná inventúru; systém vytvorí korekčné záznamy s dôvodom a schválením.
6. Systém aktualizuje report a upozorní na riziká (exspirácie, nízka marža, prebytočný kapitál).

**Alternatívne scenáre:**
- **A1 — Import dodacieho listu s neznámym formátom:** manuálny fallback s mapovaním polí a s viditeľnými nezhodami.
- **A2 — Urgentný nákup:** systém umožní príjem mimo štandardného procesu s označením „urgent“ a vyššou cenou (a so záznamom dôvodu).
- **A3 — Reklamácia šarže:** systém dohľadá pacientov, ktorým bola šarža podaná, a vytvorí zoznam kontaktov.
- **A4 — Zmena ceny od dodávateľa:** systém zobrazí starú a novú cenu a navrhne úpravu predajnej ceny so schválením.

**Výnimočné scenáre:**
- **E1 — Duplicitný príjem toho istého dodacieho listu:** systém rozpozná duplicitu (číslo dokladu + dátum + dodávateľ) a nezdvojí zásoby.
- **E2 — Chýbajúca šarža/exspirácia pri lieku na sklade:** systém označí produkt ako „bez úplných údajov“ a nedovolí použitie v J10 bez potvrdenia.
- **E3 — Inventúrny rozdiel nad limit:** systém vyžaduje schválenie a dôvod; záznam je v audite.
- **E4 — Negatívny stav po výdaji (súbeh):** systém blokuje výdaj a žiada korekciu (nikdy neumožní negatívny sklad).

**Postconditions:**
- Sklad má aktuálne stavy, šarže a exspirácie.
- Riziká (nízke zásoby, exspirácie, marže) sú viditeľné a majú vlastníka.
- Inventúra má auditovateľné korekcie.

**Business pravidlá:**
- **Zákon 139/1998 Z. z. + EÚ 2019/6:** evidencia liekov vrátane šarží a exspirácií, dohľadateľnosť podania.
- **Zákon 431/2002 Z. z.** (účtovníctvo): správne ocenenie zásob a doklady o pohybe.
- **DPH:** správne sadzby pri nákupe a predaji (10 % pri liekoch podľa nastavenia, inak štandard).
- **Produktové:** žiadny výdaj bez šarže; žiadny negatívny sklad; ceny len z cenníka praxe.

**Dátové entity:** `products` (W/R), `purchase_orders` (W/R), `suppliers` (R/W), `inventory` pohyby (W), `dispense_charge_queue` (R/W), `services` (R), `financial_closes` (R), `audit_log` (W).

**Integrácie:** veľkoobchodníci (CYMEDICA, PHARMOS, SAMOHÝL, Henry Schein), e-Kasa (nákupné doklady nie sú fiškálne), účtovný export, AI (predikcia spotreby).

---

## J25 — Reporting a mesačná uzávierka (výkonnosť, financie, compliance)

### Persóna & Kontext

**P7 Anna** má 30 minút na to, aby pochopila mesiac: obrat, marže, výkon lekárov, no-show, sklad, KVEPIS, pohľadávky. Nesmie to byť Excel z 3 systémov.
**P1 Peter** chce vidieť, aké zákroky sa vyplácajú (a ktoré nie), aby mohol robiť rozhodnutia o vybavení a o cenách.
**Kód:** `reports.*` (settings, revenue, appointments, topServices, inventoryAlerts) s `requireFeature("advancedReporting")` a rolou admin/vet; `requireFeature` je na hosted tieroch gate (na self-hoste no-op). Dátové zdroje: `invoices`, `invoice_items`, `payments`, `appointments`, `users`, `products`, `insurance_claims`, `usage_records`.

### Trigger

- **Časový cyklus:** 1. deň v mesiaci (uzávierka), pondelok ráno (týždenný prehľad), koniec kvartálu (plánovanie).
- **Interný:** potreba rozhodnúť o investícii (RTG, USG, ďalší lekár), o cene, o službe.
- **Externý:** účtovníčka, banka, investor, poisťovňa, kontrola.
- **Systémový:** alert na nezrovnalosť (napr. neuzavretá e-Kasa uzávierka, neúčtované výdaje).

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/reports` a nastaví obdobie | Systém zobrazí prehľad: obrat, počet návštev, priemerný účet, platby, pohľadávky | Ak nie sú dáta (nová prax) → systém zobrazí prázdny stav s vysvetlením, nie nuly bez kontextu |
| 2 | Prepne na výkon lekárov | Systém zobrazí počty a dokončené návštevy podľa lekára (`byDoctor`), bez hodnotenia kvality | Ak je rozdiel extrémny → systém upozorní na možnú príčinu (typ návštev, nie „výkonnosť“) |
| 3 | Skontroluje top služby | Systém zobrazí najčastejšie a najvýnosnejšie položky (`topServices`) | Ak je niečo často poskytované a málo účtované → systém upozorní (možná chyba procesu) |
| 4 | Sklad a marže | `inventoryAlerts` + hodnota skladu, exspirácie, obrátka | Ak rastú exspirácie → väzba na J24 a na objednávanie |
| 5 | Compliance prehľad | Systém zobrazí: KVEPIS exporty (stav), besnota hlásenia, OPL záznamy, e-Kasa uzávierky | Ak niečo chýba → systém ponúkne priamu akciu (nie len varovanie) |
| 6 | Pohľadávky a cash-flow | Systém zobrazí pohľadávky (klienti, poisťovne) a ich vek; prehľad platieb | Ak pohľadávka > 60 dní → úloha na recepciu a návrh komunikácie |
| 7 | Účtovný export | Systém vytvorí CSV/PDF export pre účtovníčku; pri hosted aj `usage_records` pre prehľad AI/SMS nákladov | Ak formát nezodpovedá účtovníčkine zvykom → riziko; treba konfiguráciu importu na jej strane |
| 8 | Uzávierka mesiaca | Systém uzamkne obdobie (append-only `financial_closes`) a zapíše verziu reportu | Ak sa niečo dosní neskôr → systém to zobrazí ako korekciu v ďalšom období (nie prepis histórie) |

### Alternatívne toky

1. **Dáta nie sú konzistentné (chýbajúce platby, neuzavreté návštevy).** Systém musí zobraziť **data health** panel: koľko návštev je bez closeoutu, koľko faktúr bez platby, koľko e-Kasa dní neuzavretých. Bez toho report klame a manažér prestane veriť číslam.
2. **Multi-clinic reporting (R-08).** Dnes UI neumožňuje bezproblémové prepínanie pobočiek; návrh: kontext pobočky v hlavičke + „všetky pobočky“ agregát pre admina. Bez toho Nemocnica tier nesplní sľub „neobmedzené pobočky“.
3. **Poisťovne a pohľadávky.** Systém musí oddeliť „klient nezaplatil“ od „poisťovňa nezaplatila“ — sú to rôzne procesy, rôzne časy a rôzna komunikácia.
4. **Investičné rozhodnutia.** Systém musí vedieť odpovedať na „vyplatí sa nám USG?“ — napríklad prehľadom výkonov, ktoré sa dnes neúčtujú alebo posielajú inam. Analytika musí byť pripravená na tieto otázky, nie len na obrat.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Otvorenie reportu | **netrpezlivosť, potom úľava** | „Konečne jedno číslo, nie Excel“ |
| Nájdenie problému | mrzutosť / odhodlanie | „Toto musím opraviť“ |
| Compliance | zodpovednosť | Kontrola je realita |
| Uzávierka | spokojnosť | „Mesiac je uzavretý“ |
| Nevera dátam | frustrácia | Najhoršie, čo report môže spôsobiť |

### Kontextové prepojenia

- **Pred:** J11 (platby, e-Kasa), J12 (closeout), J24 (sklad), J28 (compliance).
- **Po:** J26 (admin rozhodnutia), J30 (kontrola), J-NEW-3 (adopcia — dokazovanie hodnoty).

### AI Touchpointy

- ✅ **Chceme:** AI „manažérsky asistent“ — odpovede na otázky v prirodzenom jazyku („ktoré služby nám vlani rástli?“, „koľko sme stratili na exspiráciách?“), upozornenia na anomálie, návrh vysvetlenia (nie korelácie bez kontextu), generovanie mesačného sumáru pre majiteľa.
- ⛔ **Nechceme:** AI, ktorá mení čísla alebo „dopočítava“ chýbajúce dáta; AI ako jediný zdroj pre účtovný výstup; AI na personalizované hodnotenie zamestnancov.

---

### Use Case: UC-125

**Názov:** Reporting, mesačná uzávierka a účtovný/výkonnostný prehľad
**Primárny aktér:** `admin`, `veterinarian` (podľa `reports.ts` a feature gate)

**Predpoklady:**
- Existujú dáta za zvolené obdobie (alebo systém zobrazí prázdne stavy).
- Pri hosted režime je povolená funkcia `advancedReporting` (na self-hoste je bez obmedzenia).
- e-Kasa/finančné uzávierky sú vykonané alebo systém zobrazí ich stav.

**Hlavný scenár:**
1. Používateľ otvorí reporty a nastaví obdobie.
2. Systém agreguje obrat, návštevy, platby, top služby, sklad a compliance stav.
3. Systém zobrazí „data health“ (chýbajúce closeouty, neuzavreté platby, e-Kasa dni).
4. Používateľ vyexportuje podklady pre účtovníčku a (voliteľne) report pre majiteľa/pobočky.
5. Pri uzávierke systém uzamkne obdobie a zapíše verziu.
6. Systém vytvorí akčné úlohy z nálezov (pohľadávky, exspirácie, chýbajúce hlásenia).

**Alternatívne scenáre:**
- **A1 — Prázdne obdobie:** jasný prázdny stav s odkazom na evidenciu, nie nuly.
- **A2 — Multi-clinic:** prepnutie kontextu pobočky a agregát „všetky pobočky“ (návrh, R-08).
- **A3 — Kontrola ŠVPS:** používateľ vyexportuje konkrétny report a dôkazy (J30).
- **A4 — Investičné rozhodnutie:** report „top služby a neúčtované výkony“ ako podklad pre rozhodnutie.

**Výnimočné scenáre:**
- **E1 — Feature gate:** ak nie je `advancedReporting` povolené (hosted), systém zobrazí vysvetlenie a cestu k aktivácii, nie prázdnu obrazovku.
- **E2 — Výpadok agregácie (pomalé dopyty):** systém zobrazí čiastočné dáta s označením a časom poslednej aktualizácie; nesmie zamrznúť bez informácie.
- **E3 — Nezrovnalosti (napr. e-Kasa deň neuzavretý):** systém zobrazí problém a odkaz na priamu akciu (retry, manuálne riešenie).
- **E4 — Zmena uzavretého obdobia:** systém neumožní prepis; vytvorí korekčný záznam v novom období s odkazom na pôvodné.

**Postconditions:**
- Manažér má prehľad, ktorý sa dá obhájiť (vrátane stavu dát).
- Obdobie je uzavreté a účtovné podklady sú vyexportované.
- Nálezy sa zmenili na úlohy, nie na poznámky v zošite.

**Business pravidlá:**
- **Zákon 431/2002 Z. z.:** účtovné doklady a uzávierky, nemennosť; `financial_closes` je append-only.
- **Zákon 289/2008 Z. z.:** pravidelné e-Kasa uzávierky (denné, mesačné).
- **GDPR čl. 5:** reporty nesmú obsahovať viac osobných údajov, než je potrebné; agregáty áno, zbytočné mená nie.
- **Produktové:** report nesmie klamať — pri neúplných dátach musí ukázať neúplnosť.

**Dátové entity:** `invoices` (R), `invoice_items` (R), `payments` (R), `appointments` (R), `users` (R), `products` (R), `insurance_claims` (R), `financial_closes` (R/W), `ekasa_daily_closures` (R), `usage_records` (R), `audit_log` (R/W).

**Integrácie:** účtovný export (CSV/PDF), banka/Stripe, poisťovne, e-Kasa (uzávierky), AI (manažérsky asistent).

---

## J26 — Admin: používatelia, roly, klinika a pobočky (multi-clinic)

### Persóna & Kontext

**P7 Anna** nastavuje ľudí: nový technik nastupuje v pondelok, odchádzajúci zamestnanec musí stratiť prístup v ten istý deň, a **každý musí vidieť len to, čo má**. **P1 Peter** (konateľ) chce mať istotu, že nikto nemá viac práv, než potrebuje.
**Reality check z kódu:** roly `admin | veterinarian | technician | front_desk | viewer`, `service_agent` pre API; `requireRole` je fail-closed middleware; platform admin je oddelený cez `PLATFORM_ADMIN_EMAILS` (`admin.*` = `platformAdminProcedure`); multi-location je v schéme podporované (`locations`), ale UI je v0.6 jednolokačné (R-08).

### Trigger

- **HR udalosť:** nástup/odchod/rolová zmena; materská/pracovná neschopnosť.
- **Bezpečnostná udalosť:** podozrenie na zneužitie prístupu, strata zariadenia.
- **Rast:** otvorenie druhej pobočky, prírastok lekárov.
- **Externý:** kontrola, ktorá sa pýta „kto mal prístup k záznamu XY“.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí nastavenia používateľov | Systém zobrazí zoznam používateľov s rolami, stavom a posledným prihlásením | Ak niekto nebol prihlásený 90 dní → systém navrhne deaktiváciu (nie automaticky) |
| 2 | Pridá používateľa | Systém pošle pozvánku (`accept-invite`), nastaví rolu a (pri viacerých lokalitách) priradenie | Ak je e-mail už použitý v inej praxi → systém to zobrazí a rozhodne o väzbe |
| 3 | Nastaví rolu | Systém zobrazí **maticu oprávnení** (čo presne rola môže: čítať klinické, meniť ceny, spúšťať AI, stornovať faktúry) | Ak niekto žiada „admin“, ale potrebuje len recepciu → systém odporučí najmenšie potrebné oprávnenie (least privilege) |
| 4 | Odchod zamestnanca | Systém deaktivuje účet, zruší session a capability tokeny; história zostáva s menom autora | Ak má odchádzajúci nevyriešené úlohy → systém ich preradí |
| 5 | Konfigurácia praxe | Systém umožní nastaviť ordinačné hodiny, typy návštev, cenník, DPH, e-Kasa, KVEPIS a AI providera | Ak sa mení DPH alebo cenník → systém upozorní na dopad na existujúce faktúry (nové vs. staré) |
| 6 | Pobočky (multi-clinic) | Systém umožní definovať lokality, priradiť personál, rozvrh a sklad; prepínanie kontextu v hlavičke | **Ak UI nepodporuje plný multi-clinic (R-08)** → systém musí povedať pravdu, čo je dnes možné, a nedávať falošný pocit |
| 7 | Audit a prístupy | Systém zobrazí audit log (kto, čo, kedy) a umožní export dôkazov (J30) | Ak niekto zmenil ceny alebo stornoval faktúru → viditeľné v prehľade citlivých akcií |
| 8 | Bezpečnosť a dáta | Systém zobrazí stav: 2FA, export dát, zálohy, AI provider a región (R-07), DPA status | Ak chýba 2FA u admina → systém to zvýrazní ako riziko |

### Alternatívne toky

1. **Zamestnanec na dohodu potrebuje len ranné hodiny.** Systém musí umožniť časové obmedzenie prístupu (alebo aspoň viditeľné obmedzenie rozsahu), nie len rolu.
2. **Záskok z inej kliniky (veterinár na výpomoc).** Systém musí umožniť dočasný prístup s expiráciou a s **obmedzeným rozsahom** (napr. len pacienti danej zmeny) — bez toho kliniky zdieľajú heslá.
3. **Kontrola ŠVPS/BE/ÚOOÚ žiada výpis prístupov.** Systém musí vyexportovať audit (kto videl konkrétny záznam, kto ho menil) v zrozumiteľnej forme.
4. **Druhá pobočka s vlastným skladom a personálom.** Systém musí umožniť oddelené sklady a rozvrhy, ale spoločný prehľad pre majiteľa; dnes je to čiastočné (R-08).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Pridanie používateľa | rutina | Bežná HR úloha |
| Nastavenie rolí | **neistota** | „Nedám mu omylom prístup k peniazom?“ |
| Odchod zamestnanca | zodpovednosť | Bezpečnostné riziko |
| Pobočky | frustrácia | Ak systém nesplní očakávanie |
| Kontrola | pokoj / stres | Podľa pripravenosti dôkazov |

### Kontextové prepojenia

- **Pred:** J-NEW-1 (onboarding kliniky), J28 (compliance), J25 (reporting).
- **Po:** všetky journeys (každý závisí od správne nastavených rolí), J30 (audit a kontrola).

### AI Touchpointy

- ✅ **Chceme:** AI vysvetlenie rolí („čo môže technik?“) prirodzeným jazykom, upozornenie na nadmerné oprávnenia (least privilege audit), sumarizácia audit logu pre majiteľa, generovanie bezpečnostného reportu.
- ⛔ **Nechceme:** AI, ktorá prideľuje alebo odoberá oprávnenia; AI, ktorá číta audit log a vyvodzuje disciplinárne závery; AI s prístupom nad rámec role.

---

### Use Case: UC-126

**Názov:** Správa používateľov, rolí, konfigurácie praxe a pobočiek
**Primárny aktér:** `admin` (praxi), `platform admin` (cez allowlist pre platformové operácie)

**Predpoklady:**
- Používateľ má rolu `admin` a (pri platformových akciách) je v `PLATFORM_ADMIN_EMAILS`.
- Existuje prax a aspoň jeden admin účet.

**Hlavný scenár:**
1. Admin pridá používateľa a priradí mu rolu (a lokalitu).
2. Systém pošle pozvánku a nastaví oprávnenia podľa rolovej matice.
3. Admin nastaví konfiguráciu praxe (hodiny, cenník, dane, integrácie, AI).
4. Pri odchode zamestnanca admin účet deaktivuje a systém zruší prístupy.
5. Admin skontroluje audit a pripraví dôkazy pre kontrolu.
6. Pri viacerých pobočkách systém umožní oddelené lokality a spoločný prehľad (podľa stavu implementácie).

**Alternatívne scenáre:**
- **A1 — Dočasný prístup (záskok):** účet s expiráciou a obmedzeným rozsahom.
- **A2 — Zmena roly existujúceho používateľa:** systém zobrazí, čo nová rola pridá/uberie.
- **A3 — Zmena cenníka/DPH:** systém upozorní na dopad na existujúce doklady a nové faktúry.
- **A4 — Bezpečnostný incident:** admin zablokuje prístup, zruší sessions a vyexportuje audit.

**Výnimočné scenáre:**
- **E1 — Zámok posledného admina:** systém nedovolí odobrať poslednú admin rolu (aby prax nestratila správu).
- **E2 — Pozvánka nedoručená:** systém zobrazí stav a umožní ju poslať znova; nesmie vytvoriť duplicitný účet.
- **E3 — Konfiguračná chyba (napr. nesprávna DPH sadzba):** systém blokuje uloženie nekonzistentnej konfigurácie, ktorá by rozbila fakturáciu.
- **E4 — Pokus o platformovú akciu bez oprávnenia:** systém vráti `FORBIDDEN` a zapíše pokus do auditu.

**Postconditions:**
- Používatelia majú správne roly a (ak relevantné) lokality.
- Odchádzajúci nemajú prístup; história zostáva s autorom.
- Konfigurácia je konzistentná a auditovateľná.

**Business pravidlá:**
- **GDPR čl. 32 + zákon 18/2018:** riadenie prístupu, least privilege, evidencia prístupov.
- **Zákon 431/2002 Z. z.:** finančné záznamy nemenné; zmeny cez korekcie.
- **Zákon 289/2008 Z. z.:** konfigurácia pokladnice a jej zmeny musia byť evidované.
- **Produktové:** fail-closed oprávnenia (`requireRole`), oddelenie platform administrácie od praxe.

**Dátové entity:** `users` (W/R), `practices` (W/R), `locations` (R/W), `staff_schedules` (W/R), `rooms` (W/R), `sessions` (R/W), `audit_log` (R/W), `settings` (W/R), `ext_ai_settings` (W/R), `ekasa_config` (W/R), `usage_records` (R), `subscription`/`stripe_events` (R).

**Integrácie:** e-mail (pozvánky), e-Kasa, KVEPIS/CRSZ credentials (`ext_kvepis_credentials`), Stripe/subscription, AI providery.

---

## Business Case: Prevádzka & back office

### Status quo

Klinika bez integrovaného back office:

- **Sklad:** Excel alebo modul v účtovnom programe, mimo klinického záznamu. Exspirácie a rozdiely sa „riešia“ až pri inventúre; straty 2–4 % ročne z hodnoty skladu.
- **Dodacie listy:** technik prepisuje ručne; 6–10 h mesačne.
- **Reporting:** manažérka raz za mesiac skladá čísla z 3 systémov (PIMS + fakturačný + Excel), 4–8 hodín; výsledok je vždy „verzia 3“.
- **Compliance reporting:** KVEPIS a štatutárne hlásenia sa robia ručne, s rizikom chýb (a s pokutami pri nesplnení).
- **Prístupy a HR:** zmeny práv sú „na hesle“; odchod zamestnanca často neznamená koniec prístupu.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Menej exspirácií a rozdieľov v sklade | 160 €/mesiac | 1 920 € |
| Rýchlejší príjem dodacích listov (import namiesto prepisu) | 8 h/mesiac × 10,06 € | 965 € |
| Reporting bez Excelu (mesačné skladanie + ad-hoc otázky) | 4,5 h/mesiac × 17,68 € | 955 € |
| Rýchlejšia príprava KVEPIS a compliance podkladov | 33 min/mesiac × 17,68 € + audit export | 180 € |
| Presnejší sklad = menej viazaného kapitálu | 3 000 € × 8 % (alternatívny náklad) | 240 € |
| Menej urgentných objednávok s expresným dovozom | 60 €/mesiac | 720 € |
| Predchádzanie pokutám (OPL, KVEPIS, e-Kasa) — expected value | 500 € | 500 € |
| Admin/HR a riadenie prístupov (menej ručných zásahov, bezpečnostná hygiena) | 2 h/mesiac | 318 € |
| Nahradenie externého nástroja (inventúra/účtovné výkazy) | 25 €/mesiac | 300 € |
| Znížené nedoplatky vďaka prehľadu pohľadávok | 0,3 % obratu | 1 490 € |
| Menej zaseknutých procesov (viditeľné chýbajúce closeouty, neuzavreté dni) | odhad | 1 200 € |
| **Spolu (konzervatívne)** | | **8 788 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € (infra a IT čas) | 6 500 € | 5,4× | 67 dní |
| **Cloud Solo** | 588 € | 3 000 € (1 lekár, menší sklad) | 5,1× | 72 dní |
| **Cloud Klinika** | 1 428 € | 8 788 € | 6,2× | 59 dní |
| **Cloud Nemocnica** | 2 748 € | 16 000 € (multi-location, viac skladu, viac compliance) | 5,8× | 63 dní |

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Sklad, klinika a fakturácia v jednom systéme s jednou stopou** | Pri papieri a Exceli sa strácajú práve tie väzby (výdaj bez účtu, materiál bez zákroku) |
| **Append-only finančné uzávierky** | Účtovník a kontrola vidia nemennosť; to je dôvod dôverovať systému pri sporoch |
| **Audit log a export dôkazov ako funkcia, nie „požiadajte podporu“** | Pre kontrolu ŠVPS/ÚOOÚ je to konkrétna odpoveď v minútach |
| **Predikcia spotreby a objednávanie** | Kombinácia klinických dát (počet pacientov, sezónnosť) so skladom je unikátna: viete, prečo spotreba rastie |

**Kde konkurencia vyhráva:** zrelosť skladových modulov (Vetis a desktop riešenia majú roky ladené tlače, dodacie listy od mnohých dodávateľov, zvyky účtovníkov) a hotové napojenia na účtovnícke programy. OpenVPM musí dobehnúť minimálne UI pre wholesaler import a kvalitné tlače/exporty.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie |
|---|---|---|
| „Účtovníčka to musí schváliť“ | Blokátor mimo kliniky | Export v štandardnom formáte + možnosť dohodnúť stĺpce; dôraz na nemennosť uzávierok |
| „Sklad si vedieme v účtovníctve“ | Duplicita | Systém ako zdroj pravdy pre kliniku, účtovníctvo dostáva dáta; nie naopak |
| „Nemáme čas na nastavenie rolí“ | Onboarding | J-NEW-1 s 3 krokmi: prax, používatelia, rozvrh; role sú preddefinované na 5 typov praxe |
| „Multi-clinic nie je hotové“ | Očakávanie tieru Nemocnica | Komunikovať stav (R-08) a dodať multi-location kontext v0.7/v0.8 skôr, než klinika podpíše Nemocnica |
| „Reporting mi ukazuje čísla, ktorým neverím“ | Sceptický manažér | Data health panel + nemenné uzávierky + možnosť dostať sa k dokladu jedným klikom |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Hodnota exspirácií za rok | 2–4 % skladu | ≤ 1 % | pohyby skladu a odpisy |
| Čas na príjem dodacieho listu | 20–40 min (prepis) | ≤ 5 min (import) | čas v UI |
| Čas mesačnej uzávierky | 4–8 h | ≤ 1 h | čas od otvorenia reportu po export |
| Podiel uzávierok bez korekcií | < 50 % | ≥ 90 % | `financial_closes` + korekcie |
| Nevyriešené compliance položky | 3–10/mesiac | 0 | KVEPIS/OPL/e-Kasa alerty |
| Počet aktívnych účtov bez potreby | neznámy | 0 (kontrola štvrťročne) | zoznam používateľov + posledné prihlásenie |
| Čas na prípravu dôkazov pre kontrolu | 1–2 dni | ≤ 30 min | audit export (J30) |
