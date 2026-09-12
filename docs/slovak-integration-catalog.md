# Slovenský Integračný Katalóg & Migrácie (Slovak Integration Catalog)

Tento katalóg mapuje hardvérové zariadenia, laboratóriá, externé databázy a legacy systémy bežne používané na veterinárnych klinikách na Slovensku.

---

## 1. Laboratórne a Diagnostické Prístroje (In-Clinic Analyzers)

OpenVPM AI podporuje príjem laboratórnych výsledkov cez ASTM E1381/E1394 a HL7 štandardy:

| Výrobca / Zariadenie | Typ Prístroja | Integračný Protokol | Formát Dát |
| :--- | :--- | :--- | :--- |
| **IDEXX VetLab Station** | Biomechánia, Hematológia, Moč | LAN / TCP socket (port 5100) | HL7 v2.3 / XML |
| **Fuji Dri-Chem (NX500/700)** | Suchá klinická biochémia | Serial RS-232 / USB Ethernet | ASTM formát výsledkov |
| **scil Vet abc Plus / abc 19** | Automatický hematologický analyzátor | Serial / TCP LAN | ASTM E1394 |
| **Bionote Vcheck V200** | Fluorescenčná imunoanalýza | USB / LAN REST bridge | JSON / CSV export |
| **Heska Element DC / HT5** | Biochémia a hematológia | Ethernet | HL7 / Heska Connect |

---

## 2. Referenčné Veterinárne Laboratóriá (External Labs)

| Laboratórium | Spôsob Odoslania Žiadanky | Príjem Výsledkov |
| :--- | :--- | :--- |
| **Laboklin (Bratislava / Nemecko)** | Automatická elektronická žiadanka (tRPC) | Automatický nočný import cez HL7 / PDF doručenku s párovaním na čip zvieraťa |
| **Synlab Slovensko** | Online objednávka / čiarový kód skúmavky | REST API / E-mail parser so šifrovaným výsledkovým PDF |
| **Štátny veterinárny a potravinový ústav (ŠVÚ Zvolen / Bratislava)** | Oficiálna štátna sprievodka KVEPIS | Certifikovaný inšpekčný protokol |

---

## 3. Liekové a Nomenklatúrne Databázy

- **ÚŠKVBL SR (Ústav štátnej kontroly veterinárnych biopreparátov a liečiv Nitra):**
  - Oficiálny číselník schválených veterinárnych liekov, ATCvet klasifikácia, ochranné lehoty a SPC súhrny.
- **ŠÚKL SR:**
  - Číselník humánnych liekov používaných vo veterinárnej medicíne v režime kaskády (Zákon č. 362/2011 Z. z. o liekoch).

---

## 4. Poisťovne Spoločenských Zvierat

- **PetExpert Slovensko:**
  - Priame prepojenie s likvidačným portálom poisťovne.
  - Odoslanie lekárskej správy, položkového účtu a súhlasu majiteľa jedným kliknutím z uzavretej návštevy.
- **Colonnade Insurance S.A.:**
  - Export poistnej udalosti do štruktúrovaného PDF formulára pre poistenie psa a mačky.

---

## 5. Migrácie ako Produkt (Legacy Migration Playbook)

OpenVPM AI poskytuje dedikovaný migračný engine pre bezpečný prechod z lokálnych desktopových systémov:

| Zdrojový Systém | Databázový Engine | Migrované Entity | Validačný Krok |
| :--- | :--- | :--- | :--- |
| **WinVet** | Firebird / InterBase (.fdb, .gdb) | Klienti, pacienti, vakcinácie, história návštev, cenník | Kontrola formátu telefónnych čísel (+421), 15-miestnych čipov |
| **Vetis / VetProf** | Microsoft SQL Server / Access | Kompletné karty, účtovné doklady, skladové zásoby | Rekonciliácia skladových zostatkov a pohľadávok |
| **Veto** | Paradox / dBase | Základné karty zvierat a majiteľov | Deduplikácia klientov podľa mena a adresy |

### 3-Krokový Migračný Protokol:
1. **Dry-Run & Validácia:** Spustenie migračného skriptu nanečisto s vygenerovaním podrobného reportu nekonzistentných záznamov (napr. chýbajúce čipy, neplatné e-maily).
2. **Paralelný beh (1 týždeň):** Nová inštancia beží paralelne so starým systémom pre overenie dennej praxe.
3. **Zapečatenie a Protokol o Odovzdaní:** Formálny podpisový protokol potvrdzujúci 100% zhodu prenesených údajov pred odstavením pôvodného servera.
