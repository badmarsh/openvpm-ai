# GAP Analysis — Post "Pilot-Ready" Status

> **Living document.** Update every two weeks during pilot. Owner: Product + Engineering.
> Status date: 2026-09-12. Version: 0.1.

---

## Taxonomy

| Status | Meaning |
|--------|---------|
| Done | Implemented, tested, evidence available |
| Partial | Started; known gaps documented below |
| Missing | Not started; required for battle-tested |
| Deferred | Out of v1 scope by decision |

---

## Area 1 - Regulatory & Legal

| ID | Claim / Requirement | Status | GAP description | Owner | Target |
|----|---------------------|--------|-----------------|-------|--------|
| L-01 | KVEPIS podanie akceptovane SVPS | Partial | XML generator + validator existuje; **chyba: testovaci endpoint SVPS, dokaz prijatia, verziovanie XML schemy** | Eng + Legal | Q4 2026 |
| L-02 | e-Kasa certifikovana integracia | Partial | Driver napisany; **chyba: zoznam certifikovanych ORP zariadeni, testovacie scenare vypadku, void/storno flow** | Eng + Accounting | Q4 2026 |
| L-03 | Formalne potvrdenie integracnych podmienok (UPVS/eID) | Missing | Ziadna zmluva ani sandbox priradeny od NASES | Legal | Q1 2027 |
| L-04 | DPA a register subprocesorov | Partial | Vertex/Anthropic identifikovani v RISK_REGISTER; **chyba: podpisana DPA, region confirmed, kill-switch otestovany** | Legal | Q4 2026 |
| L-05 | Klasifikacia dat podla citlivosti a ucelu | Missing | Ziadna data-classification policy; chyba sensitivity label v scheme | Legal + Eng | Q4 2026 |
| L-06 | Verziovanie legislativnych pravidiel + update-process | Missing | Ziadny pipeline pre zmeny zakona → kod | Product | Q1 2027 |
| L-07 | Pravne posudenie zodpovednosti za AI odporucanie | Missing | Ziadne pravne stanovisko k AI liability | Legal | Q4 2026 |

---

## Area 2 - Production Evidence

| ID | Metric | Status | GAP description | Owner | Target |
|----|--------|--------|-----------------|-------|--------|
| P-01 | Pocet aktivnych klinik | Missing | 0 produkcnych klinik; VetSykora = simulovany pilot | Product | 1 klinika Q4 2026 |
| P-02 | Pocet pacientov a navstev v produkcii | Missing | Ziadne realne data | Product | 100 navstev Q4 2026 |
| P-03 | Uptime (30-dnovy rolling) | Missing | Ziadna produkcna infrastruktura, ziadny SLA | SRE | Q4 2026 |
| P-04 | Pocet incidentov a MTTR | Missing | Ziadny incident log | SRE | Q4 2026 |
| P-05 | Priemerny cas odozvy API (p95) | Partial | Health endpoint existuje; chyba produkcne meranie, dashboardy | SRE | Q4 2026 |
| P-06 | Uspesnost synchronizacie e-Kasy | Missing | Driver nebol spusteny pri realnej transakcii | Eng | Q4 2026 |
| P-07 | Pocet uspesnych KVEPIS podani | Missing | 0 realnych podani | Eng + Legal | Q1 2027 |
| P-08 | Vysledky pilotu po 30/60/90 dnoch | Missing | Ziadny pilot prebieha | Product | Q1 2027 |
| P-09 | Cas zaskolenia pouzivatela (onboarding time) | Missing | Nemeriane | Product + UX | Q1 2027 |

---

## Area 3 - Clinical Workflows

| ID | Workflow | Status | GAP description | Owner | Target |
|----|----------|--------|-----------------|-------|--------|
| C-01 | Anestetika / protokol intubacie | Missing | Ziadny modul; chyba Doppler, EKG, SpO2 logging | Clinical + Eng | Q1 2027 |
| C-02 | ICU / intenzivna starostlivost | Missing | Ziadny flowsheet pre IV, monitoring, vital-signs trend | Clinical + Eng | Q1 2027 |
| C-03 | Chirurgia - periop workflow | Missing | Ziadny pre/intra/post-op zaznam | Clinical + Eng | Q1 2027 |
| C-04 | Triage kategorizacia | Missing | Ziadny triage score, urgency flag | Clinical + Eng | Q2 2027 |
| C-05 | Laboratorna integracia (IDEXX, Zoetis) | Partial | ext_lab_import.ts existuje; chyba live API konektor | Eng | Q1 2027 |
| C-06 | DICOM / snimkovacie zariadenia | Partial | Auto-prepare stub v encounters; chyba realny DICOM store | Eng | Q2 2027 |

---

## Area 4 - AI Safety & Governance

| ID | Requirement | Status | GAP description | Owner | Target |
|----|-------------|--------|-----------------|-------|--------|
| A-01 | Klinicky eval dataset (zlaty standard) | Partial | evals/dataset.json ma 114 cases; chyba veterinarny review, rozsirenie pre SK zakony | Clinical + Eng | Q4 2026 |
| A-02 | Metriky chybovosti (FP/FN rate) | Partial | evals/metrics.ts existuje; chyba definicia klinickeho prahu "bezpecne" | Clinical + Legal | Q4 2026 |
| A-03 | Red-team testy | Missing | Ziadne adversarial testy na prompt injection alebo falsne odporucania | Security | Q4 2026 |
| A-04 | Traceability zdrojov pri odporucaniach | Partial | Citacie v prompte; chyba audit trail per-recommendation v DB | Eng | Q4 2026 |
| A-05 | Automation bias - klinicka edukacia | Missing | Ziadny onboarding modul varujuci lekarov | UX + Clinical | Q1 2027 |
| A-06 | AI liability - pravne stanovisko | Missing | Viz L-07 | Legal | Q4 2026 |

---

## Area 5 - Security & Infrastructure

| ID | Requirement | Status | GAP description | Owner | Target |
|----|-------------|--------|-----------------|-------|--------|
| S-01 | Nezavisly bezpecnostny audit (RLS/IDOR/SSRF) | Missing | Ziadny externy penetration test | Security | Q4 2026 |
| S-02 | Disaster recovery drill (zdokumentovany) | Partial | Runbook existuje; chyba zdokumentovany drill log | Ops | Q4 2026 |
| S-03 | E2E test v CI (Playwright) | Partial | Playwright testy existuju lokalne; nie su v ci.yml gate | Eng | Q4 2026 |
| S-04 | Data retention & deletion policy | Missing | Ziadna automatizovana retention politika | Legal + Eng | Q4 2026 |
| S-05 | SK migracia - rucne kroky dokumentovane | Partial | Skript existuje; chyba runbook pre SK-specificke polia | Ops | Q4 2026 |

---

## Area 6 - Hardware & External Integrations

| ID | Integration | Status | GAP description | Owner | Target |
|----|-------------|--------|-----------------|-------|--------|
| H-01 | e-Kasa - certifikovany zoznam ORP zariadeni | Missing | Ziadny verejny zoznam; "certifikovany hardver" != certifikovana integracia | Product | Q4 2026 |
| H-02 | Laboratorium - live konektor (IDEXX) | Missing | Import existuje; ziadna ziva integracia | Eng | Q1 2027 |
| H-03 | Velkoobchod - live EDI/API | Partial | CSV import; ziadne API napojenie na CYMEDICA/PHARMOS live | Eng | Q1 2027 |
| H-04 | PetExpert - live claims API | Partial | Payload builder existuje; ziadne produkcne credentials | Eng | Q1 2027 |

---

## Pre-Pilot Gate (10 podmienok)

Nasledujucich 10 podmienok musi byt zelenych pred nastupom prvej realnej kliniky:

| # | Podmienka | Aktualny stav |
|---|-----------|---------------|
| G-01 | Aspon 1 klinika podpisala pilot agreement | Missing |
| G-02 | DPA podpisana so vsetkymi AI subprocesormi | Missing |
| G-03 | Disaster recovery drill zdokumentovany (< 90 dni) | Partial |
| G-04 | E2E testy v CI pipeline (green) | Partial |
| G-05 | Externy security audit report k dispozicii | Missing |
| G-06 | Onboarding cas < 2 hodiny pre netechnickeho uzivatela | Missing |
| G-07 | KVEPIS testovaci endpoint priradeny (SVPS) | Missing |
| G-08 | e-Kasa void/storno flow otestovany v test prostredi | Missing |
| G-09 | AI eval dataset schvaleny klinickym veterinarom | Partial |
| G-10 | Incident response playbook zdokumentovany | Partial |

**Aktualny score: 0/10 zelenych, 4/10 ciastocnych.**

---

## Produktova priorita (reorganizovana)

```
[MUST - pred prvou klinikou]
  G-01 Pilot klinika
  G-02 DPA / legal
  G-05 Security audit
  G-07 KVEPIS testovaci endpoint
  G-08 e-Kasa void flow

[SHOULD - Q4 2026]
  P-03 Produkcny uptime monitoring
  A-01 Rozsireny eval dataset
  A-03 Red-team testy
  S-01 Penetration test
  L-05 Data classification

[COULD - Q1 2027]
  C-01..C-04 Klinicke workflow moduly
  H-02 Live lab konektor
  L-06 Legislativny update pipeline
```

---

*Aktualizacia: kazde 2 tyzdne. Zodpovedny: Product Lead + CTO.*
