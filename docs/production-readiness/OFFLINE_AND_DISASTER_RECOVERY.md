# Prevádzková odolnosť & Disaster Recovery (SaaS Multi-Clinic)

> **Ciele:** RPO < 15 minút · RTO < 60 minút · dostupnosť 99,9 % (SLA).

---

## 1. Disaster Recovery Runbook (RPO < 15 min, RTO < 60 min)

| Krok | Akcia | Vlastník | Čas |
|---|---|---|---|
| 1 | Detekcia incidentu (healthcheck, alerting) | SRE | < 1 min |
| 2 | Vyhlásenie P1 / aktivácia runbooku | SRE / on-call | < 5 min |
| 3 | Obnova databázy z poslednej zálohy (PITR, < 15 min RPO) | SRE | < 20 min |
| 4 | Overenie integrity (`scripts/dr-restore-drill.sh`) | SRE | < 15 min |
| 5 | Preklopenie DNS / load balancera na obnovenú inštanciu | SRE | < 5 min |
| 6 | Smoke test kritických ciest (login, recepcia, e-Kasa) | QA | < 10 min |
| 7 | Post-mortem + aktualizácia runbooku | tím | do 48 h |

Zálohy: kontinuálne PITR (point-in-time recovery) + denný snapshot. Objektové
úložisko s versioningom a cross-region replikáciou.

## 2. Plán výpadku internetu kliniky (Offline-first)

- **Recepcia/ambulancia:** lokálny buffer front-endu (queue) pre kritické
  operácie; synchronizácia po obnovení spojenia.
- **e-Kasa:** `offlineModeEnabled` — doklady v stave `OFFLINE_STORED`
  (48-hodinová lehota podľa Zákona č. 289/2008 Z. z.), lokálna tlač cez
  FiskalPRO/Elcom driver.
- **Núdzové príjmové formuláre:** tlačiteľné PDF formuláre, ktoré sa po
  obnovení dávkovo zadajú do systému (auditovaná cesta).

## 3. SLA

| Metrika | Cieľ |
|---|---|
| Dostupnosť | 99,9 % mesačne |
| RPO | < 15 minút |
| RTO | < 60 minút |
| Reakčná doba P1 (výpadok) | < 1 hodina |
| Reakčná doba P2 (degradovaná služba) | < 4 hodiny |
| Reakčná doba P3/P4 | < 1 pracovný deň |

## 4. Automatizované overenie obnovy

```bash
# Otestuje obnovu produkčnej zálohy do izolovanej testovacej inštancie
# a overí integritu dát (počty riadkov, checksumy kritických tabuliek).
bash scripts/dr-restore-drill.sh
```

Test sa spúšťa pravidelne (týždenne) a vždy pred nasadením novej verzie.
