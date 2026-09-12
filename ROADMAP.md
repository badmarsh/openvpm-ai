# OpenVPM AI Roadmap

Tento dokument definuje strategický a technický plán rozvoja OpenVPM AI. Naším cieľom je poskytnúť veterinárnym ambulanciám a klinikám najmodernejší otvorený systém na trhu, ktorý chráni ich nezávislosť a dáta.

---

## 🚀 Míľnik v0.6 — PILOT-READY (Hotové a overené k 12. 9. 2026)

Tento míľnik predstavuje kompletné jadro systému overené 14-dňovým pilotným testovaním a sadou 4 858 automatizovaných testov (100% pass rate).

### 1. Klinické jadro a EMR
- [x] Kompletný elektronický zdravotný záznam pacienta (SOAP poznámky, vitálne funkcie, hmotnostné trendy).
- [x] Dávkovacia kalkulačka liečiv s kontrolou maximálnych dávok a druhovej toxicity (paracetamol mačky, ivermektín kólie).
- [x] Očkovacia schéma, digitálny pas zvieraťa a certifikáty s automatickým pripomínaním revakcinácie.
- [x] Prehliadač laboratórnych výsledkov s fyziologickými referenčnými rozsahmi pre psov a mačky.
- [x] Evidencia omamných a psychotropných látok (kniha opiátov) s auditným záznamom svedka znehodnotenia.

### 2. Slovenský legislatívny balík (Zákon 39/2007, 139/1998, 289/2008)
- [x] **KVEPIS Hub (`/statutory/kvepis`):** validácia dát voči oficiálnej XSD schéme ŠVPS SR, mesačná ambulantná kniha, hlásenie chorôb.
- [x] **CRSZ modul:** validácia a kontrola 15-miestnych mikročipov podľa ISO 11784/11785, export dávok do KVL SR.
- [x] **CEHZ evidencia:** validácia 6-miestnych kódov fariem pre hospodárske zvieratá a kontrola ochranných lehôt mäsa/mlieka.
- [x] **e-Kasa certifikovaný driver:** podpora hardvéru FiskalPRO (LAN/REST) a VRP2 s offline transakčným frontom a idempotenciou.
- [x] **ÚPVS / Slovensko.sk:** generovanie GovBox XML obálok pre doručovanie do elektronických schránok orgánov štátnej správy.

### 3. Poisťovne a integrácie partnerov
- [x] **PetExpert Slovensko:** priame vysporiadanie poistných udalostí (`routers/extensions/insurance.ts`), kontrola mikročipu, výpočet 10% spoluúčasti (min. 35 €) a generovanie oficiálneho tlačiva pre likvidátora.
- [x] **Generali / Union:** položkový export lekárskej správy a účtovaných položiek.
- [x] **Veľkoobchody liečiv:** elektronický import dodacích listov so šaržami a expiráciami od **Cymedica SK**, **Pharmos a.s.**, **Samohýl SK** a **Henry Schein SK**.
- [x] **In-house analyzátory:** automatický parser nálezov z prístrojov **IDEXX Catalyst/ProCyte**, **Fuji Dri-Chem NX500** a **Mindray BC-Vet**.

### 4. Mobilný klientsky portál (PWA)
- [x] Plne responzívne rozhranie pre smartfóny na `/portal`.
- [x] Online rezervácia termínu vyšetrenia (`/portal/book`).
- [x] Digitálny očkovací preukaz s termínmi revakcinácií (`/portal/[token]/pets`).
- [x] Prehľad a stiahnutie faktúr s online úhradou cez Stripe (`/portal/[token]/invoices`).
- [x] Bezpečný chat s veterinárnou ambulanciou a posielanie fotografií rán (`/portal/[token]/messages`).
- [x] Bezheslové prihlásenie majiteľa cez Magic Link (SMS / e-mail).

### 5. Bezpečnosť a klinická AI
- [x] 114 deterministických eval testov v `lib/ai/__tests__/clinical-eval-harness.test.ts`.
- [x] Kryptografická auditná reťaz (HMAC-SHA256) pre nemennosť zdravotných záznamov.
- [x] Povinný clinician opt-in: AI nemôže samostatne prepísať ani publikovať zdravotný záznam bez potvrdenia lekára.
- [x] RLS (Row Level Security) na úrovni databázy zaručujúca 100% izoláciu dát medzi klinikami.

---

## ⏳ Míľnik v0.7 — Q4 2026 (Automatizácia a periférie)

- [ ] **Priame B2G SOAP/REST volania do KVEPIS:** automatické odoslanie podania na ŠVPS SR bez nutnosti manuálneho sťahovania XML (po pridelení produkčných certifikátov).
- [ ] **Tray Agent pre e-Kasa (Windows/macOS):** lokálny bežiaci proces v systémovej lište pre bezproblémové pripojenie USB pokladníc FiskalPRO na lokálnej sieti.
- [ ] **Integrácia laboratória scil Vet abc Plus:** RS-232 / USB prepojenie hematológie.
- [ ] **Automatický Laboklin HL7 fetcher:** sťahovanie laboratórnych správ cez zabezpečený email/IMAP konektor a párovanie k pacientovi podľa čipu.
- [ ] **Drag-to-reschedule v kalendári:** intuitívne presúvanie termínov myšou s automatickou SMS notifikáciou majiteľovi.
- [ ] **Čakáreň na uvoľnený termín (Waitlist):** automatické oslovenie náhradníkov cez SMS, ak iný klient zruší vyšetrenie.

---

## 🔮 Míľnik v1.0 — 2027 (Nemocničný a terénny Enterprise štandard)

- [ ] **Stádová medicína (Herd Health Management):** hromadná evidencia pre farmy, plány reprodukcie dobytka, skupinové vakcinácie a hromadné ochranné lehoty.
- [ ] **Plne offline terénny režim:** mobilná aplikácia s obojsmernou synchronizáciou (Conflict-Free Replicated Data Types - CRDT) pre lekárov na výjazdoch bez signálu.
- [ ] **Pokročilý DICOM PACS server:** cloudové a lokálne ukladanie RTG, ultrazvukových a CT snímok priamo v systéme.
- [ ] **AI analýza ultrazvukového a RTG obrazu:** automatická detekcia fraktúr a kardiomegálie na snímkach.
- [ ] **Natívne mobilné aplikácie:** iOS a Android aplikácie v oficiálnych obchodoch App Store a Google Play.

---

## Transparentný register technického dlhu a známych limitácií

Pre nezávislých auditorov a kliniky uvádzame transparentný zoznam položiek:

1. **KVEPIS B2G certifikáty:** XML export a validátor sú 100% konformné s oficiálnou XSD schémou ŠVPS SR. Priame volanie REST API brány je závislé na časovom harmonograme ŠVPS SR pre uvoľňovanie produkčných integračných kľúčov pre rok 2026/2027.
2. **Cloudová tlač na lokálnu e-Kasu:** Ak klinika používa cloudovú verziu a má e-Kasa pokladnicu bez verejnej IP adresy, vyžaduje sa lokálne namapovanie portu cez router alebo v0.7 Tray Agent.
3. **Multi-location prevádzka:** Databázová schéma plne podporuje viacero prevádzok/pobočiek jednej kliniky (`practices` + `locations`). V súčasnej verzii v0.6 je používateľské rozhranie optimalizované primárne pre jednolokačné kliniky a ambulancie.
