# e-Kasa Certifikovaný Hardvér a Prevádzkový Runbook

Dokumentácia súladu so **Zákonom č. 289/2008 Z. z. o používaní elektronickej registračnej pokladnice** v znení neskorších predpisov (e-Kasa).

---

## 1. Certifikované Integračné Riešenia (Hardware Matrix)

OpenVPM AI komunikuje s certifikovanými hardvérovými chránenými dátovými úložiskami (CHDU) a fiškálnymi tlačiarňami prostredníctvom štandardizovaného `FiscalDriver` rozhrania.

| Riešenie | Podporované Modely | Komunikačné Rozhranie | Certifikácia Finančnej správy SR | Odporúčané Nasadenie |
| :--- | :--- | :--- | :--- | :--- |
| **FiskalPRO** *(Tier-1)* | T2, T3, T80, VX520, eKasa Box | LAN (Ethernet / Wi-Fi), USB REST API (port 8080/8443) | Áno (CHDU certifikované podľa zákona 289/2008) | **Primárne odporúčané riešenie** pre stacionárne aj mobilné kliniky |
| **VRP2 (Cloud)** | Virtuálna registračná pokladnica 2 | REST API Finančnej správy SR (OAuth2 / Token) | Štátne cloudové riešenie FS SR | Menšie terénne praxe bez nutnosti vlastného CHDU |
| **Elcom Euro** | Euro-50TE, Euro-150TE, Euro-2100 | TCP/IP bridge / USB COM port | Áno (certifikované CHDU Elcom) | Tradičné kliniky s existujúcimi pokladnicami Elcom |
| **Varos** | FT4000, FT5000 | Serial / TCP fiscal print server | Áno (Varos trade s.r.o.) | Špecializované vysokozáťažové recepčné pulty |

---

## 2. Režim Výpadku Internetu (Offline Fallback & PKP)

Podľa Zákona č. 289/2008 Z. z. má podnikateľ pri výpadku internetového pripojenia právo pokračovať v evidencii tržieb v offline režime:

### 48-Hodinová Lehota a Generovanie PKP
1. Ak systém zaznamená nedostupnosť serverov Finančnej správy SR (`timeout > 5000ms`), automaticky prepne vystavovanie dokladov do **Offline núdzového režimu**.
2. **PKP (Podpisový kód podnikateľa):** Doklad je podpísaný privátnym kľúčom uloženým v certifikovanom CHDU. Tlačený doklad obsahuje text *"DOKLAD VYSTAVENÝ V NÚDZOVOM REŽIME"* a 344-znakový PKP kód namiesto UID.
3. **Idempotentná fronta (`ext_ekasa_receipts`):** Každý doklad má nemenný UUID identifikátor generovaný pred odoslaním do tlačiarne. Tým je zaručené, že ani pri opakovanom pokuse o synchronizáciu nedôjde k duplicitnému zaúčtovaniu.
4. **Automatický Reconnect & Sync:**
   - Background cron proces periodicky overuje dostupnosť Finančnej správy.
   - Po obnovení spojenia CHDU automaticky odošle balík neodoslaných dokladov a získa pre ne pridelené **UID** (Unikátny identifikátor dokladu) a **OKP**.
   - Zákonná lehota na synchronizáciu je **max. 48 hodín** od obnovenia spojenia.

---

## 3. Postup pri Stornej / Opravnom Doklade

Stornovanie a oprava pokladničného dokladu podlieha prísnym pravidlám zákona a účtovníctva:

1. **Väzba na pôvodný doklad:**
   - Storno doklad **musí obsahovať referenciu na pôvodný UID doklad** (`originalReceiptUid`).
   - Pokus o storno neexistujúceho alebo už raz stornovaného UID systém odmietne s chybou `RECEIPT_ALREADY_VOIDED`.
2. **Rola a autorizácia:**
   - Storno môže vykonať výhradne používateľ s rolou `admin` alebo ošetrujúci `veterinarian`.
   - Každé storno vyžaduje zadanie povinného textového dôvodu (napr. *"Omyl v množstve lieku"*, *"Zrušenie hospitalizácie"*).
3. **Skladová rekonciliácia (Vrátenie tovaru):**
   - Pri úplnom alebo čiastočnom storne položiek viazaných na skladové zásoby (liečivá, antiparazitiká, spotrebný materiál) systém automaticky vykoná naskladnenie vrátených kusov a zaznamená skladový pohyb typu `RESTOCK_RETURN`.

---

## 4. Testovacie Scenáre a Akceptačné Testy

Pred ostrým spustením na klinike sa vykonávajú tieto povinné testy:

1. **Test normálneho predaja (Online):**
   - Vystavenie hotovostného a kartového dokladu so sadzbami DPH 23% (tovar), 19% (štandardná služba) a 5% (vybrané lieky).
   - Overenie prítomnosti platného UID, OKP a QR kódu overiteľného cez aplikáciu *Over doklad*.
2. **Test výpadku internetu (Simulácia offline):**
   - Odpojenie sieťového kábla z pokladnice / simulácia výpadku DNS.
   - Vystavenie dokladu -> overenie vytlačenia PKP kódu.
   - Opätovné zapojenie siete -> overenie automatického doúčtovania a spárovania UID.
3. **Test úplného storna:**
   - Vystavenie dokladu za 50 € -> následné storno cez dialóg.
   - Overenie vytlačenia záporného / opravného dokladu s referenciou na pôvodný UID.
   - Kontrola, že suma dennej uzávierky bola správne korigovaná na 0 €.
