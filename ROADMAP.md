# OpenVPM AI Roadmap

Tento dokument definuje strategický a technický plán rozvoja OpenVPM AI. Naším cieľom je poskytnúť veterinárnym ambulanciám a klinikám najmodernejší otvorený systém na trhu, ktorý chráni ich nezávislosť a dáta.

---

## Milnik v0.6 — PILOT-READY (Hotove a overene k 12. 9. 2026)

> **UPOZORNENIE: "Pilot-ready" != "battle-tested".** Ziadna produkcna klinika nie je aktualne aktivna. Vsetky integracie su overene testami a simulovanymi scenarmi. Realne produkcne nasadenie prebehne v Q4 2026. Aktualne pre-pilot gate score: **0/10**. Podrobnosti: [`docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md`](docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md)

Tento milnik predstavuje kompletne jadro systemu overene 14-dnovym simulovanym testovanim a sadou 4 858 automatizovanych testov (100% pass rate).

### 1. Klinické jadro a EMR
- [x] Kompletný elektronický zdravotný záznam pacienta (SOAP poznámky, vitálne funkcie, hmotnostné trendy).
- [x] Dávkovacia kalkulačka liečiv s kontrolou maximálnych dávok a druhovej toxicity (paracetamol mačky, ivermektín kólie).
- [x] Očkovacia schéma, digitálny pas zvieraťa a certifikáty s automatickým pripomínaním revakcinácie.
- [x] Prehliadač laboratórnych výsledkov s fyziologickými referenčnými rozsahmi pre psov a mačky.
- [x] Evidencia omamných a psychotropných látok (kniha opiátov) s auditným záznamom svedka znehodnotenia.

### 2. Slovenský legislatívny balík (Zákon 39/2007, 139/1998, 289/2008)
- [x] **KVEPIS Hub (`/statutory/kvepis`):** validacia dat voci oficialnej XSD scheme SVPS SR, mesacna ambulantna kniha, hlasenie chorob. *(XML-only export; priame podanie na SVPS SR v produkcii zatial neuskutocnene — testovaci endpoint nebol prideleny)*
- [x] **CRSZ modul:** validácia a kontrola 15-miestnych mikročipov podľa ISO 11784/11785, export dávok do KVL SR.
- [x] **CEHZ evidencia:** validácia 6-miestnych kódov fariem pre hospodárske zvieratá a kontrola ochranných lehôt mäsa/mlieka.
- [x] **e-Kasa driver:** podpora hardveru FiskalPRO (LAN/REST) a VRP2 s offline transaknym frontom a idempotenciou. *(Certifikacia integracie s FR SR prebieha; hardver je podporovany, integracia nie je formalne certifikovana)*
- [x] **ÚPVS / Slovensko.sk:** generovanie GovBox XML obálok pre doručovanie do elektronických schránok orgánov štátnej správy.

### 3. Poisťovne a integrácie partnerov
- [x] **PetExpert Slovensko:** payload builder pre poistne udalosti (`routers/extensions/insurance.ts`), kontrola micocipu, vypocet 10% spoluucasti. *(Live API integracia s produkcnymi credentials neprebehla)*
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

## Transparentny register technickeho dlhu a znamych limitacii

Pre nezavislych auditorov a kliniky uvaedzame transparentny zoznam poloziek:

1. **KVEPIS B2G certifikaty (XML-only):** XML export a validator su konformne s XSD schemou SVPS SR. Priame volanie REST API brany je zavisle od pridelenia produkcnych integracnych klucov SVPS SR. Realny produkcny KVEPIS token zatial neprideleny.
2. **e-Kasa certifikacia integracie:** Driver je implementovany a otestovany; formalna certifikacia integracie s FR SR este neprebehla. "Podporovany hardver" != "certifikovana integracia".
3. **Ziadna realna produkcna klinika:** VetSykora PoC bol simulovany shadow-run. 0 realnych produkcnych klinik, 0 realnych transakcii v CHDU, 0 realnych KVEPIS podani.
4. **DPA a AI sub-procesory:** Vertex AI a Anthropic su identifikovane ako sub-procesori; DPA zatial nepodpisana, region nepotvrdeny.
5. **Cloudova tlac na lokalnu e-Kasu:** Ak klinika pouziva cloudovu verziu, vyzaduje sa lokálne mapovanie portu alebo v0.7 Tray Agent.
6. **Multi-location prevadzka:** Schema podporuje viacero pobocok; UI v0.6 je optimalizovane pre jednolokacne kliniky.
7. **Live lab konektory (IDEXX, Zoetis):** Parser vzorov existuje; ziadna ziva integr. s externym API laboratoria v produkcii.
8. **Externy bezpecnostny audit:** Ziadny nezavisly penetracny test (RLS/IDOR/SSRF) zatial nevykonal. Planovany Q4 2026.

> Kompletna trackovatelna issue list: [`docs/production-readiness/ISSUE_TRACKER_GAP.md`](docs/production-readiness/ISSUE_TRACKER_GAP.md)
