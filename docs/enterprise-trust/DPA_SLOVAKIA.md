# Zmluva o Spracúvaní Osobných Údajov (DPA — Data Processing Agreement)

uzatvorená v zmysle **čl. 28 Nariadenia Európskeho parlamentu a Rady (EÚ) 2016/679 (GDPR)**
a **§ 34 Zákona č. 18/2018 Z. z. o ochrane osobných údajov**

---

### Medzi zmluvnými stranami:

1. **Prevádzkovateľ:**
   Veterinárna ambulancia / klinika (zákazník používajúci OpenVPM AI)
   (ďalej len *„Prevádzkovateľ“*)

   a

2. **Sprostredkovateľ:**
   OpenVPM AI / poskytovateľ SaaS platformy
   (ďalej len *„Sprostredkovateľ“*)

---

## Článok 1 — Predmet a Účel Zmluvy

1. Táto zmluva upravuje práva a povinnosti zmluvných strán pri spracúvaní osobných údajov klientov (vlastníkov a držiteľov zvierat) a zamestnancov Prevádzkovateľa v rámci poskytovania veterinárneho informačného systému OpenVPM AI.
2. Účelom spracúvania je:
   - Vedenie odbornej veterinárnej zdravotnej dokumentácie v zmysle Zákona č. 39/2007 Z. z.
   - Správa zákonných registrov (Kniha besnoty, Kniha ošetrení hospodárskych zvierat, Register omamných a psychotropných látok, PetPass / CRSZ).
   - Správa objednávkového kalendára, komunikácia s majiteľmi (SMS/e-mail pripomienky) a vystavovanie daňových a pokladničných dokladov (e-Kasa — Zákon č. 289/2008 Z. z.).
   - Asistované prepisovanie hlasových klinických poznámok (Voice-to-SOAP).

---

## Článok 2 — Kategórie Dotknutých Osôb a Rozsah Údajov

1. **Dotknuté osoby:**
   - Majitelia, držitelia a sprevádzajúce osoby zvierat (fyzické osoby a SZČO).
   - Ošetrujúci personál (veterinárni lekári, technici, recepcia).
2. **Kategórie bežných osobných údajov:**
   - Meno, priezvisko, titul.
   - Trvalý pobyt, doručovacia adresa.
   - Telefónne číslo, e-mailová adresa.
   - IČO / DIČ (ak ide o farmárov a chovateľov).
   - Číslo občianskeho preukazu / mandátneho certifikátu (pre účely KEP / KVEPIS podaní).
3. **Osobitné kategórie údajov:**
   - Platforma NESPRACÚVA genetické, biometrické ani zdravotné údaje o fyzických osobách (zdravotné údaje sa týkajú výhradne zvieracích pacientov).

---

## Článok 3 — Miesto Spracúvania a Dátová Suverenita

1. Sprostredkovateľ garantuje, že **všetky produkčné databázy, aplikačné servery a objektové úložiská sú fyzicky umiestnené v regióne Európskej únie (primárne Frankfurt, Nemecko)**.
2. Žiadne osobné údaje nie sú prenášané do tretích krajín bez primeraných záruk (Standard Contractual Clauses — SCC).

---

## Článok 4 — Schválení Subprocesori (Ďalší Sprostredkovatelia)

Prevádzkovateľ udeľuje všeobecný súhlas so zapojením týchto subprocesorov:

| Subprocesor | Sídlo / Región | Poskytovaná Služba | Záruka Ochrany Údajov |
| :--- | :--- | :--- | :--- |
| **Amazon Web Services (AWS)** | Frankfurt (EÚ) | Cloudová infraštruktúra, S3 šifrované úložisko, zálohy | ISO 27001, SOC 2, EÚ Data Boundary |
| **Supabase / PostgreSQL** | EÚ Región | RLS Tenant-izolovaná databáza | EÚ DPA, RLS presadzovanie na úrovni jadra DB |
| **Anthropic PBC** | EÚ Endpoint | Textové LLM inferencie (SOAP drafting) | Zero Data Retention zmluva (zákaz trénovania na dátach) |
| **Google Cloud Platform** | EÚ Región | Multimodálne RTG inferencie (Vision) | EÚ Model Clauses, žiadne ukladanie snímkov |
| **Resend / Twilio** | EÚ infraštruktúra | Transakčný e-mail a SMS pripomienky | EÚ DPA, ISO 27001 |

---

## Článok 5 — Technické a Organizačné Opatrenia (TOMs)

1. **Šifrovanie:**
   - Šifrovanie všetkých dát v tranzite: TLS 1.3 s HSTS.
   - Šifrovanie dát v pokoji (Encryption at Rest): AES-256 na úrovni databázových zväzkov a S3 bucketov.
2. **Prístupové práva (RBAC):**
   - Striktné oddelenie rolí (`admin`, `veterinarian`, `technician`, `front_desk`, `viewer`).
   - Audit trail zaznamenávajúci každý prístup, zmenu a export.
3. **Multi-Tenant Izolácia (Row-Level Security):**
   - Každý dopyt do databázy je nútene izolovaný cez `practice_id` pomocou PostgreSQL Row-Level Security. Prístup k dátam inej kliniky je na úrovni databázového enginu nemožný.
4. **Hlasové diktáty (GDPR 24-hodinový limit):**
   - Audio nahrávky hlasových diktátov sú po vygenerovaní textovej správy zaradené do automatického bezpečného výmazu, najneskôr do 24 hodín.

---

## Článok 6 — Hlásenie Bezpečnostných Incidentov

1. V prípade zistenia porušenia ochrany osobných údajov (data breach) sa Sprostredkovateľ zaväzuje informovať Prevádzkovateľa **bez zbytočného odkladu, najneskôr do 24 hodín** od zistenia incidentu.
2. Oznámenie obsahuje povahu incidentu, kategórie dotknutých osôb, predpokladané dôsledky a prijaté nápravné opatrenia.
