# Prevádzková Odolnosť, Výpadok Internetu a Disaster Recovery

Prevádzková metodika pre multi-clinic SaaS inštanciu OpenVPM AI.

---

## 1. Disaster Recovery Ciele (RPO & RTO)

| Metrika | Garancia pre Kliniky | Technické Zabezpečenie |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 15 minút** | Kontinuálna replikácia databázy (WAL archivácia) + inkrementálne snapshoty každých 15 min. |
| **RTO (Recovery Time Objective)** | **< 60 minút** | Automatizovaný failover do sekundárnej zóny (Multi-AZ Frankfurt) a kontajnerizovaný redeploy. |
| **SLA Dostupnosti** | **99.9%** (max. 43 min mesačne) | Monitorované cez nezávislý heartbeat monitor s verejnou status stránkou. |

---

## 2. Plán Výpadku Internetu na Klinike (Local Offline Mode)

Keď v ambulancii zlyhá káblové alebo optické pripojenie:

1. **Recepcia a Platby (e-Kasa):**
   - Pokladničné terminály (FiskalPRO / Elcom) sa automaticky prepnú do lokálneho CHDU núdzového režimu.
   - Tržby sa naďalej tlačia s platným PKP kódom (zákonný limit 48 hodín).
2. **Mobilný záložný kanál (LTE/5G Failover):**
   - Odporúčaná konfigurácia klinického smerovača (router s automatickým prepnutím na záložnú 5G SIM kartu).
3. **Núdzový ambulantný príjem:**
   - Prehliadač udržiava lokálnu service worker vyrovnávaciu pamäť statických aktív.
   - Vytlačené núdzové papierové príjmové formuláre pripravené na spätný import po obnove spojenia.

---

## 3. Postup pri P1 Výpadku (Disaster Recovery Runbook)

1. **Detekcia:** Prometheus / Sentry hlási zlyhanie healthchecku (`/api/health/ready` vracajúci kód 503).
2. **Eskalácia:** Automatický alert na Slack/PagerDuty pre on-call inžiniera do 5 minút.
3. **Failover Databázy:**
   - Prepnutie DNS na horúcu repliku v sekundárnej zóne.
   - Spustenie skriptu `scripts/dr-restore-drill.sh` na overenie integrity pred otvorením pre používateľov.
4. **Notifikácia zákazníkov:** Aktualizácia status stránky a SMS notifikácia pre administrátorov kliník.
