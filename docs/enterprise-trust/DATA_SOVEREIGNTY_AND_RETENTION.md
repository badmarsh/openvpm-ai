# Dátová Suverenita, Šifrovanie a Retenčná Matica

Tento dokument stanovuje architektonické zásady uchovávania, ochrany a bezpečného vymazávania dát v prostredí OpenVPM AI.

---

## 1. Zákonom Stanovená Retenčná Matica (Slovakia)

V zmysle platných právnych predpisov Slovenskej republiky uplatňuje OpenVPM AI tieto retenčné doby:

| Kategória Údajov | Zákonný Predpis | Minimálna Doba Uchovávania | Režim po Uplynutí Doby |
| :--- | :--- | :--- | :--- |
| **Zdravotná dokumentácia pacientov** (anamnézy, SOAP, vyšetrenia) | Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti | **10 rokov** od posledného ošetrenia | Archivácia / Možnosť exportu a výmazu na žiadosť |
| **Register omamných a psychotropných látok** (opiátová kniha) | Zákon č. 139/1998 Z. z. | **10 rokov** od vykonania zápisu | Trvalá nemenná archivácia (append-only ledger) |
| **Kniha besnoty a záznamy o pohryznutí** | Zákon č. 39/2007 Z. z. § 17 a § 19 | **5 rokov** | Archivácia |
| **Kniha ošetrení hospodárskych zvierat** | Zákon č. 39/2007 Z. z. | **5 rokov** | Archivácia / KVEPIS synchronizácia |
| **Účtovné a daňové doklady e-Kasa** | Zákon č. 431/2002 Z. z. o účtovníctve | **10 rokov** od konca účtovného roka | Daňový archív |
| **Hlasové nahrávky klinických diktátov** | GDPR / Nariadenie EÚ 2016/679 | **Max. 24 hodín** | **Automatický nevratný výmaz** (S3 lifecycle cron) |
| **Auditné záznamy prístupov a potvrdení AI** | Zákon č. 18/2018 Z. z. | **5 rokov** | Neupraviteľný hash chain |

---

## 2. Šifrovanie a Správa Kryptografických Kľúčov

- **V tranzite (In Transit):** TLS 1.3 (fallback TLS 1.2), podpora výhradne bezpečných cipher suites (ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES256-GCM-SHA384). HSTS vynútené na úrovni reverzného proxy (`max-age=63072000; includeSubDomains; preload`).
- **V pokoji (At Rest):** 
  - Databázové zväzky šifrované pomocou AWS KMS spravovaných kľúčov (AES-256).
  - Zdravotnícke snímky (DICOM/PNG) v S3 uložené so server-side šifrovaním (SSE-S3 / SSE-KMS).
  - Hash chain v `ext_ai_audit_log` používa kryptografickú hašovaciu funkciu SHA-256 viazanú na identifikátor predchádzajúceho bloku.

---

## 3. Právo na Výmaz a Prenositeľnosť (GDPR čl. 17 a čl. 20)

1. **Prenositeľnosť údajov (Export):**
   - Majiteľ zvieraťa alebo lekár môže kedykoľvek exportovať kompletnú kartu pacienta v strojovo čitateľnom formáte (štruktúrovaný JSON a tlačový PDF balíček).
2. **Výmaz osobných údajov:**
   - Na žiadosť dotknutej osoby sa vykoná anonymizácia mena, adresy a kontaktných údajov majiteľa v tabuľke `clients`.
   - Zdravotné záznamy o zvierati a použité lieky zostávajú v anonymizovanej forme zachované pre splnenie zákonnej povinnosti podľa Zákona č. 39/2007 Z. z. (zákonná výnimka z práva na výmaz podľa čl. 17 ods. 3 písm. b GDPR).
