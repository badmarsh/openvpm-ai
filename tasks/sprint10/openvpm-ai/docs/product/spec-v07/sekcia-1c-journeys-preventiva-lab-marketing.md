# Sekcia 1c — Hĺbková dekompozícia User Journeys: prevencia, laboratórium, zobrazovanie, marketing (J13–J19)

> **Rozsah:** toky prevencie, diagnostiky a rastu (tier T3–T4). Nízka frekvencia, vysoký dopad na tržby a compliance.
> **Čísla úspor:** ledger L08–L10, L15, L20, L30, L33, L34 → [`_generated/financial-model.md`](_generated/financial-model.md).
> **Persóny:** [`docs/product/journeys/04-preventiva.md`](../journeys/04-preventiva.md),
> [`05-lab-zobrazovanie.md`](../journeys/05-lab-zobrazovanie.md), [`06-marketing.md`](../journeys/06-marketing.md).

---

## J13 — Očkovanie, digitálny pas a hlásenie besnoty

**Tier:** T3 · **Audit:** PASS 200 OK · **Ledger:** L08, L20 · **Use Case:** UC-08 (časť), UC-26 · **Business Case:** BC-01, BC-06

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Veterinárny asistent | `technician` | pripraví vakcínu, overí šaržu a expiráciu, asistuje pri fixácii |
| Sekundárny: MVDr. lekár | `veterinarian` | podpisuje certifikát (`supervisingVeterinarianId`), rozhoduje o odklade pri chorom zvieraťu |
| Sekundárny: Admin | `admin` | mesačné hlásenia, KVEPIS, register besnoty |
| Pasívny: Majiteľ zvieraťa | klient | dostane digitálny pas a termín revakcinácie do portálu |

### 2. Trigger a vstupné predpoklady

**Trigger:** preventívna návšteva; revakcinácia po recall pripomienke (J14); očkovanie pred cestou do zahraničia;
pohryznutie človeka (povinné hlásenie a observácia); hromadné očkovanie vrhu.

**Pre-conditions:** pacient s aktuálnou hmotnosťou a druhom; `vaccination_records` história (dávková schéma
`initial`/`booster`); vakcína na sklade s platnou expiráciou (`products.expirationDate`); definovaní
`listVaccinationProviders`; pri besnote — evidenčné číslo zvieraťa a čip (`microchip_registrations`).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Asistent otvorí kartu → „Očkovanie“ | Zobrazí sa dávková schéma: posledná vakcinácia, výrobca, šarža, `licensedDurationMonths`, `nextDueDate` | Vakcína po lehote → booster; pred lehôtou → varovanie o predčasnom podaní |
| 2 | Vyberie vakcínu a šaržu | Kontrola expirácie a skladového stavu; odpis zo skladu (`inventory.adjustStock`) a `dispense_charge_queue` (J10) | Expirovaná šarža → blokované |
| 3 | Lekár skontroluje stav zvieraťa | Klinická kontraindikácia (horúčka, akútne ochorenie) → odklad s novým `nextDueDate` | Odklad → `care_reminders` s novým termínom |
| 4 | `records.createVaccination` | Záznam: `vaccineName`, `productName`, `lotNumber`, `manufacturer`, `productExpirationDate`, `doseType`, `licensedDurationMonths`, `rabiesTagNumber`, `supervisingVeterinarianId`, `nextDueDate` | Chýba šarža → odmietnuté (nie je to voliteľné pole) |
| 5 | Certifikát a pas | `records.prepareVaccinationCertificate` → tlač/PDF; `extensions.crsz.issuePetPassport` (digitálny pas zvieraťa) alebo `issueKvlCrPassport` (KVL SR pas) | Cesta do zahraničia → overenie čipu a platnosti besnoty (21 dní po očkovaní) |
| 6 | **Hlásenie besnoty** | `extensions.statutory.recordRabiesNotification` → `ext_rabies_notifications`; pri podozrení `createRabiesObservation` → `ext_rabies_observations` so `recordRabiesCheckpoint` (kontroly observácie) | Pohryznutie človeka → povinné hlásenie; observácia 14 dní s checkpointmi |
| 7 | Naplánovanie revakcinácie | `nextDueDate` → `care_reminders` + `ext_marketing_recall_schedules` + automatizácia `vaccine_due` (J14) | Klient odmietol pripomienky → `consentGateCheck` utlmí SMS, termín zostáva v systéme |
| 8 | Mesačný register | `reports.rabiesRegister`, `reports.treatmentDiary`, `extensions.kvepis.createSubmission` → `validateAndBuild` (XSD SVPS SR) → XML export | Priame B2G podanie **nie je** dostupné (XML-only; certifikáty nepridelené — JG-S06) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | Chybný záznam vakcinácie (zlá šarža) | `records.markVaccinationEnteredInError` + nový záznam; pôvodný zostáva označený, nie zmazaný |
| E2 | Zmena údajov certifikátu (meno majiteľa, číslo čipu) | `records.updateVaccinationCertificateDetails` s audit stopou; vydaný certifikát sa označí ako nahradený |
| E3 | Vakcína podaná bez evidencie (asistent zabudol) | `visit_work_items` pri closeoute odhalí výkon bez záznamu → blokácia dokončenia návštevy |
| E4 | Zviera uhynulo po očkovaní (podozrenie na nežiaduci účinok) | Sympathy gate; hlásenie nežiaduceho účinku (farmakovigilancia EÚ 2019/6); `ext_rabies_observations` ak ide o besnotu |
| E5 | Hromadné očkovanie vrhu / farmy | Dnes po jednom; **NÁVRH v1.0:** stádová medicína (herd health) s hromadnými dávkami a ochrannými lehotami (ROADMAP v1.0) |
| E6 | Očkovanie u potravinového zvieraťa | Kontrola ochrannej lehoty (`ext_withdrawal_periods`) a CEHZ kódu farmy |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/vaccinations`, `/patients/[id]`, `/statutory`, `/statutory/kvepis`, `/reports`, `/portal/[token]/pets` |
| Komponenty | `components/statutory/crsz-panel.tsx`, `components/clinical/*`, `components/patients/*` |
| Modaly | výber šarže, certifikát (náhľad pred tlačou), hlásenie besnoty, observácia s checkpointmi |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `records.createVaccination/listVaccinations/listVaccinationProviders/prepareVaccinationCertificate/updateVaccinationCertificateDetails/markVaccinationEnteredInError`, `extensions.statutory.listRabiesNotifications/recordRabiesNotification/listRabiesObservations/createRabiesObservation/recordRabiesCheckpoint`, `extensions.crsz.issuePetPassport/issueKvlCrPassport/listPassports/listKvlCrPassports/getCertificateHtml`, `extensions.kvepis.createSubmission/validateAndBuild/signSubmission/listSubmissions`, `reports.rabiesRegister/treatmentDiary` |
| Drizzle | `vaccination_records`, `pet_passports`, `kvl_cr_passports`, `microchip_registrations`, `ext_rabies_notifications`, `ext_rabies_observations`, `ext_kvepis_submissions`, `ext_kvepis_credentials`, `care_reminders`, `ext_marketing_recall_schedules`, `products`, `dispense_charge_queue` |
| Validácia | XSD schéma SVPS SR (KVEPIS), ISO 11784/11785 (čip), 6-miestne kódy fariem (CEHZ) |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** povinné očkovanie proti besnote, evidencia a hlásenie; kniha ošetrení.
- **KVEPIS / ŠVPS SR:** mesačná ambulantná kniha a hlásenie chorôb — dnes **XML-only export** s XSD validáciou;
  priame SOAP/REST podanie je v ROADMAP v0.7 a závisí od pridelenia produkčných certifikátov.
- **EÚ 2019/6 + Cesta do zahraničia:** pas zvieraťa, platnosť očkovania 21 dní, identifikácia čipom.
- **GDPR:** certifikát obsahuje údaje majiteľa; verejný odkaz na pas len cez capability token.
- **RLS:** `tenant_isolation` na všetkých registroch.

### 7. Merateľná úspora času (ledger **L08, L20**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L08 Vakcinácia, certifikát, hlásenie (lekár) | lekár | 1,50 min × 350/mes. | 0,50 min | 5,8 h | **3,2 h/mes. = 112 €** |
| L20 Asistencia pri vakcinácii, pas a čip | technik | 2,00 min × 350/mes. | 1,00 min | 5,8 h | **3,2 h/mes. = 90 €** |

### 8. Odkaz → **UC-26** (registre a hlásenia), **UC-08**, čiastočne **UC-17**

---

## J14 — Recall a revakcinácia (kampane a pripomienky)

**Tier:** T4 · **Audit:** PASS 200 OK · **Ledger:** L30 · **Páka:** R2 · **Use Case:** UC-17 · **Business Case:** BC-03, BC-04

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | spúšťa a kontroluje dávky pripomienok; telefonuje, keď SMS nezaberie |
| Sekundárny: Admin | `admin` | definuje pravidlá, segmenty, journey, šablóny, quiet hours |
| Sekundárny: MVDr. lekár | `veterinarian` | schvaľuje zdravotne citlivé kampane; podpisuje odporúčanie |
| Pasívny: Majiteľ zvieraťa | klient | dostane pripomienku a odkaz na rezerváciu |

### 2. Trigger a vstupné predpoklady

**Trigger:** cron `/api/cron/reminders`; `extensions.automationEvents.runVaccineSweep`; `care_reminders` po dosiahnutí
`nextDueDate`; ručné spustenie kampane z `/recalls`; udalosť `visit_completed` / `surgery_completed` / `wellness_enrolled`.

**Pre-conditions:** vyplnené `nextDueDate` pri vakcináciách; súhlas klienta pre kanál; aktívne pravidlá
(`ext_automation_rules.is_active`); nakonfigurovaný SMS/e-mail kanál (`ext_channel_accounts`, `messaging_registrations`).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Systém pripraví dávku | `notifications.getOverdueVaccinations` + `getVaccinationRecallPreview` (koľko pacientov, aký kanál, aký text) | Náhľad ukáže aj **utlmené** prípady s dôvodom (deceased, opt-out, quiet hours, cap) |
| 2 | Recepcia skontroluje náhľad | Zoznam s menom, druhom, poslednou vakcináciou, dňami po lehote, kanálom | Nesprávny pacient → vylúčiť z dávky s dôvodom |
| 3 | Odošle | `notifications.sendVaccinationReminders` / `sendBulkReminders`; pre každú správu `consentGateCheck`; fronta `sms_send_attempts` | Čiastočné zlyhanie → per-správa stav, nie rollback celej dávky |
| 4 | Automatizácia pokračuje | `ext_automation_rules` (trigger `vaccine_due`) → `ext_automation_step_executions` → ďalší krok po N dňoch bez reakcie; `ext_automation_enrollments` (enroll/pause/resume/cancel) | Klient reagoval → journey sa ukončí, žiadna duplicitná správa |
| 5 | Klient klikne na odkaz | Rezervácia cez `/portal/book` (J7) alebo telefonát; `funnel_events` zaznamená konverziu | Bez kliku → po 2. pokuse ponuka telefonátu recepciou |
| 6 | Segmentácia a kampane | `extensions.crmSegments.list/get/recompute/getSegmentMembers` — 9+ segmentov (`lib/autopilot/segmentation-engine.ts`), vrátane `post_op_recovery` (operácia za posledných 30 dní, **len žijúci pacienti**) | Segment obsahuje zosnulého pacienta → filter je súčasť SQL segmentu |
| 7 | Vyhodnotenie | `extensions.marketing.getMessageStats`, `listMessageLogs`, `extensions.automationSuppression.getMetrics/listLogs`, `extensions.automationEvents.getQueueMetrics` | Nízka konverzia → zmena šablóny (`upsertMessageTemplate`) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Pacient uhynul, kampaň beží** | Sympathy gate: `assertPatientNotDeceased` + suppression log; navyše `extensions.marketing.sendCondolenceCard` ako **jediná** povolená komunikácia (a len ak ju spustí človek) |
| E2 | **Klient chce menej správ** | Frequency cap a quiet hours v `consentGateCheck`; `/email-preferences` a `/odhlasenie`; `unsubscribeByToken` |
| E3 | **Dvojité odoslanie rovnakej pripomienky** | Idempotencia per (pacient, trigger, okno); `sms-delivery:{provider}:{messageId}` advisory lock |
| E4 | **Nesprávne `nextDueDate` (chyba pri zápise)** | Kampaň by volala klientov príliš skoro → `care_reminders` UI musí umožniť korekciu a `records.markVaccinationEnteredInError` |
| E5 | **Follow-up kanál bez UI** | ⚠️ `ai.patientsNeedingFollowUp` existuje, ale nemá UI (jediné použitie je `/api-docs/ai`) — riziko R-11. **NÁVRH v0.7:** karta „Follow-up na dnes“ na dashboard, viazaná na `encounters.listPendingFollowUps` |
| E6 | **Provider výpadok počas dávky** | Retry fronta `/api/cron/message-queue-drain`; `sms_provider_event_conflicts` reconciliácia; metrika `getQueueMetrics` |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/recalls`, `/care-reminders`, `/marketing/automations`, `/marketing/messages`, `/marketing/suppression`, `/inbox`, `/` (dashboard) |
| Komponenty | `components/automations/client-automations-view.tsx`, `components/automations/clinical-automations-view.tsx`, `components/communications/message-logs-view.tsx` |
| Modaly | náhľad dávky (povinný pred odoslaním), editor šablóny, detail utlmenia s dôvodom |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `notifications.getOverdueVaccinations/getVaccinationRecallPreview/sendVaccinationReminders/sendBulkReminders/getUpcomingReminders`, `careReminders.list/create/sendOutreach/setCompleted/setDismissed`, `extensions.automationRules.list/create/update/toggle/delete`, `extensions.automationJourneys.list/create/update`, `extensions.automationEnrollments.list/enroll/pause/resume/cancel`, `extensions.automationEvents.list/get/cancel/getQueueMetrics/processQueueNow/simulateEvent/runVaccineSweep`, `extensions.automationSuppression.getMetrics/listLogs`, `extensions.crmSegments.list/get/toggle/recompute/recomputeAll/getSegmentMembers`, `ai.patientsOverdueVaccinations`, `extensions.marketing.upsertMessageTemplate/triggerMessage/processQueuedMessages/getMessageStats` |
| Drizzle | `care_reminders`, `ext_automation_rules`, `ext_automation_journeys`, `ext_automation_enrollments`, `ext_automation_events`, `ext_automation_step_executions`, `ext_automation_suppression_log`, `ext_crm_segments`, `ext_crm_segment_memberships`, `ext_marketing_recall_schedules`, `ext_marketing_message_templates`, `ext_marketing_message_logs`, `sms_send_attempts`, `funnel_events` |
| Fronty a crony | `/api/cron/reminders`, `/api/cron/message-queue-drain`, `/api/cron/automation-worker`, `/api/cron/activation-digest` |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR + Sympathy Gate:** atomické utlmenie pri úhyne; dôkaz v `ext_automation_suppression_log` (typ, dôvod, čas, zdroj).
- **Zákon 452/2021 Z. z.:** marketingový charakter pripomienky = potrebný súhlas; čisto transakčná pripomienka termínu = plnenie zmluvy. Rozlíšenie robí `communicationType` v `consentGateCheck`.
- **Zákon 39/2007 Z. z.:** pripomienka nesmie obsahovať diagnózu ani tvrdenie o zdravotnom stave (validácia `validateMarketingText` blokuje Rx tvrdenia).
- **Etika:** žiadna kampaň nesmie vytvárať tlak na eutanáziu ani zneužívať smútok — `sendCondolenceCard` je manuálna, nie automatická.

### 7. Merateľná úspora času a výnos (ledger **L30**, páka **R2**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Príprava a realizácia recall kampane | 240 min/mes. (Excel zoznam + ručné volania) | 60 min/mes. (náhľad + potvrdenie) | model 3,0 h → **real 1,7 h/mes. = 41 €** |
| Konverzia revakcinácií | ~18 návštev/mes. | ~32 návštev/mes. | **+14 návštev × 45 € = 630 €**; po atribúcii 70 % → **441 €/mes.** (R2, BC-03) |

### 8. Odkaz → **UC-17**, čiastočne **UC-19**, **UC-26**

---

## J15 — Wellness (preventívny) plán a kontrolná návšteva

**Tier:** T4 · **Audit:** PASS 200 OK · **Ledger:** L34 · **Páka:** R3 · **Use Case:** UC-32 · **Business Case:** BC-03

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | predáva plán pri preventívnej návšteve; eviduje čerpanie benefitov |
| Sekundárny: Admin | `admin` | tvorí plány, ceny, cyklickú fakturáciu |
| Sekundárny: MVDr. lekár | `veterinarian` | odporúča plán podľa veku a rizík pacienta; robí kontrolné návštevy |
| Pasívny: Majiteľ zvieraťa | klient | platí mesačne, čerpá benefity, vidí prehľad v portáli |

### 2. Trigger a vstupné predpoklady

**Trigger:** preventívna návšteva šteňaťa/mačiatka; chronický pacient s pravidelnou medikáciou; ponuka pri platení;
cron `/api/cron/wellness-billing` pre cyklickú fakturáciu.

**Pre-conditions:** definovaný `wellness_plans` (benefity, cena, periodicita, platnosť); aktívny `wellness_enrollments`
stav; pre platbu — `practice_payment_accounts` (Stripe) alebo manuálna úhrada.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Recepcia otvorí `/wellness` | `wellness.listPlans` — plány s benefitmi a cenou; `listEnrollments` — kto je zapojený | Klient chce iný mix → úprava plánu (admin), nie ad-hoc zľava |
| 2 | Zapíše klienta | `wellness.enroll` (klient, pacient, plán, začiatok, spôsob platby) | Duplicitný enrolment → odmietnutý |
| 3 | Cyklická fakturácia | `wellness.listDue` → `generateDueInvoices` → `invoices` → `markBilled`; cron `/api/cron/wellness-billing` | Platba zlyhala → plán do stavu `paused` s upomienkou, nie okamžité zrušenie |
| 4 | Čerpanie benefitu pri návšteve | `extensions.marketing.listWellnessRedemptions` / `redeemWellnessBenefit` → `ext_marketing_wellness_redemptions`; na faktúre položka so zľavou/„hradí plán“ | Benefit vyčerpaný → štandardná cena s vysvetlením |
| 5 | Kontrolná návšteva | Termín (J7), encounter, SOAP (J3), closeout (J12) s `followUpDisposition='scheduled'` | Nález mimo plánu → liečba mimo plán (jasná komunikácia ceny) |
| 6 | Ukončenie | `wellness.cancel` s dôvodom (úmrtie, presun, nespokojnosť) | Úmrtie → sympathy gate, žiadna fakturácia po dátume úmrtia |
| 7 | Vyhodnotenie | `/reports` — MRR z wellness, miera zotrvania, čerpanie benefitov | Nízke čerpanie → riziko churn; ponuka termínov |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | Klient neplatí 2 mesiace | `paused` → upomienka → `cancel`; benefity nedostupné; transparentný stav v portáli |
| E2 | Benefit použitý bez evidencie | `visit_work_items` a `dispense_charge_queue` pri closeoute odhalia nezrovnalosť |
| E3 | Zmena plánu uprostred obdobia | Pomerová úprava (pro-rata) s audit stopou; žiadne tiché prepočítanie |
| E4 | Úmrtie pacienta | Okamžité zastavenie fakturácie, sympathy komunikácia, refundácia nespotrebovanej časti |
| E5 | Klient chce plán „na mieru“ | Admin vytvorí nový plan variant; recepcia nesmie improvisovať s cenami |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/wellness`, `/marketing/wellness`, `/clients/[id]`, `/billing`, `/reports`, `/portal/[token]/*` |
| Komponenty | `components/dashboard/*` (wellness panel), `components/billing/*` |
| Modaly | enrolment, čerpanie benefitu, zrušenie s dôvodom |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `wellness.listPlans/createPlan/setPlanActive/enroll/listDue/listEnrollments/generateDueInvoices/markBilled/cancel`, `extensions.marketing.listWellnessRedemptions/redeemWellnessBenefit`, `reports.revenue`, `billing.createInvoice/recordPayment` |
| Drizzle | `wellness_plans`, `wellness_enrollments`, `ext_marketing_wellness_redemptions`, `invoices`, `payments` |
| Cron | `/api/cron/wellness-billing`, `/api/cron/billing-lifecycle` |
| Invarianty | jedna faktúra na enrolment na obdobie; `markBilled` je idempotentné (opätovné spustenie nevytvorí duplicitu) |

### 6. Legislatívny a bezpečnostný checkpoint

- **Ochrana spotrebiteľa:** zmluva o recurring platbe musí byť uzavretá s jasnými podmienkami a možnosťou ukončenia (`consent_forms` vzor).
- **GDPR:** recurring platba = spracúvanie na plnenie zmluvy; marketingové oslovenie s ponukou plánu = súhlas.
- **Zákon 39/2007 Z. z.:** plán nesmie nahrádzať klinické rozhodnutie — benefity sú rámec, nie nárok na výkon bez indikácie.
- **Sympathy Gate:** ukončenie komunikácie aj fakturácie pri úhyne.

### 7. Merateľná úspora času a výnos (ledger **L34**, páka **R3**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Enrolment + cyklická fakturácia | 3,75 h/mes. | 1,00 h/mes. | model 2,8 h → **real 1,5 h/mes. = 45 €** |
| Recurring tržby | 0 € | 60 plánov × 25 € = 1 500 €/mes. | rampa roku 1 50 % × atribúcia 50 % → **375 €/mes.** (R3, BC-03) |
| **Retenčný efekt (upside, nezapočítaný)** | — | wellness klienti majú ~1,8× viac návštev/rok | +24 návštev/mes. × 58,36 € = ~1 400 €/mes. — **v modeli sa neuvádza**, aby nedošlo k dvojitému započítaniu s R3 |

### 8. Odkaz → **UC-32**, čiastočne **UC-27**, **UC-31**

---

## J16 — Príjem, validácia a interpretácia laboratórnych výsledkov

**Tier:** T3 · **Audit:** PASS 200 OK · **Ledger:** L09, L15 · **Use Case:** UC-08 · **Business Case:** BC-01
**Známe riziko (P0, audit F-07-1):** `labImport.parsePdfOrImageReport` číta binárne PDF ako UTF-8 text a
„confidence score“ je odvodený z **počtu** výsledkov (0,65/0,72/0,84/0,94), nie z kvality extrakcie; záznam dostane
`deviceModel: "PDF Laboklin/IDEXX AI OCR"` a poznámku „confidence: 94 %“, hoci **žiaden model nebeží**.
Toto je v Sekcii 3 riešené ako **UC-08 AC-5…AC-7** (zákaz falošnej istoty).

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Veterinárny asistent | `technician` | nahráva súbor z analyzátora alebo PDF z referenčného laboratória |
| Sekundárny: MVDr. lekár | `veterinarian` | review inbox: overí a interpretuje, rozhodne o liečbe |
| Sekundárny: `front_desk` | `front_desk` | vie nahrať doručený e-mail/PDF (podľa `requireRole` v `lab-import`) |

### 2. Trigger a vstupné predpoklady

**Trigger:** výsledok z in-house analyzátora (IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX500, Mindray BC-Vet);
PDF/e-mail z Laboklin/Synlab; manuálny zápis po telefóne; oprava chybného výsledku.

**Pre-conditions:** pacient a encounter/`appointmentId` (alebo aspoň dátum odberu); referenčné rozsahy pre druh
(pes/mačka); pre priradenie — `records.listLabAssignees`; pri oprave — dôvod a pôvodná hodnota.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Asistent otvorí `/lab-results` → „Import“ | `components/lab/analyzer-import-panel.tsx`; výber súboru alebo analyzátora | Textový výstup analyzátora → `labImport.parseFile`; PDF/obrázok → `parsePdfOrImageReport` |
| 2 | Nahrá súbor | Parser extrahuje analyty, hodnoty, jednotky, flagy; `external_lab_reports` + `external_lab_observations` uchovajú **surový** vstup | 0 extrahovaných výsledkov → **explicitná chyba** „súbor sa nepodarilo načítať“, nie tichý prázdny záznam |
| 3 | Skontroluje párovanie | Panel ukáže navrhnutého pacienta (podľa čipu/mena v správe) a vyžaduje potvrdenie | Neisté párovanie → manuálny výber; nikdy auto-zápis |
| 4 | `labImport.saveReport` | Vzniknú `lab_results` so statusom `pending`, flagom `unknown`/`normal`/`abnormal`/`critical` a referenčným rozsahom; `requiresVetApproval: true` | Kritický flag → okamžitá notifikácia lekára (nie „počkaj na inbox“) |
| 5 | Priradenie lekárovi | `records.assignLabFollowUp` / `labImport.assignReport` → `listLabReviewInbox`, `listLabAssignees` | Nikto nepriradený → fronta „nepriradené“ na dashboard |
| 6 | Lekár review | `labImport.reviewReport` alebo `records.completeLabResult` → status `reviewed`/`completed`; `lab_result_events` uchová stopu; trend `getPatientAnalyteHistory` | Lekár nesúhlasí s hodnotou → krok 7 |
| 7 | Oprava výsledku | `records.markLabResultEnteredInError` + nový záznam; `lab_result_replacements` uchová pôvodnú hodnotu, dôvod, autora, čas | Pôvodná hodnota **nikdy** nie je prepísaná in-place (bezpečnosť podľa `docs/lab-result-safety.md`) |
| 8 | Záver do dokumentácie | Lekár zapíše interpretáciu do `assessment` (J3); voliteľne follow-up (J12) | Zmena liečby podľa výsledku → Clinical Guardian re-check (J5) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Binárne PDF bez textovej vrstvy** | Dnes: UTF-8 „smeti“ → 0 výsledkov bez varovania. **Požadované:** detekcia binárneho vstupu, explicitná chybová hláška, ponuka manuálneho prepisu alebo OCR s označením „extrakcia nie je overená“ |
| E2 | **Súbor patriaci inému pacientovi** | Párovanie len s potvrdením človeka; `lab_result_events` zaznamená, kto priradil |
| E3 | **Duplicitná správa (rovnaký odber dvakrát)** | Fingerprint/`externalId` unikátne; druhý import sa označí ako duplikát, nie nový záznam |
| E4 | **Súbežná úprava výsledku** | `pg_advisory_xact_lock` (testované v `lab-result-safety.test.ts:54`) + optimistic revision |
| E5 | **Hodnota mimo referenčného rozsahu bez flagu** | Systém prepočíta flag podľa rozsahu pre druh; nespolieha sa len na flag z prístroja |
| E6 | **Výsledok dorazil po finalizácii SOAP** | Nový záznam + notifikácia; lekár rozhodne o addende (UC-05), nikdy o prepise finalizovaného záznamu |
| E7 | **Chýbajúci referenčný rozsah pre exota** | Zobraziť hodnotu bez rozsahu s označením „referenčný rozsah nie je definovaný“ — **nie** rozsah psa |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/lab-results`, `/patients/[id]`, `/records`, `/inbox` (review fronta) |
| Komponenty | `components/lab/analyzer-import-panel.tsx`, `components/lab/*`, `components/clinical/*` |
| Modaly | import (výber súboru, náhľad extrakcie), párovanie pacienta, review s komentárom, dôvod opravy |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `extensions.labImport.parseFile/parsePdfOrImageReport/saveReport/listReports/getReport/assignReport/reviewReport/getPatientAnalyteHistory`, `records.listLabResults/listLabResultHistory/listLabReviewInbox/listLabAssignees/createLabResult/updateLabResultStatus/completeLabResult/assignLabFollowUp/completeLabFollowUp/markLabResultEnteredInError` |
| Drizzle | `lab_results` (`lab_status`: pending/completed/reviewed; `lab_result_flag`: unknown/normal/abnormal/critical), `lab_analyzer_reports`, `external_lab_reports`, `external_lab_observations`, `lab_result_events`, `lab_result_replacements` |
| Zámky | `pg_advisory_xact_lock` pri zápise/oprave výsledku; `uniqueIndex` na `(practiceId, patientId, analyte, takenAt)` pre duplicitné odbery |
| Integrácie | IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX500, Mindray BC-Vet (parser vzorov); scil Vet abc Plus a Laboklin HL7 fetcher sú v ROADMAP v0.7 |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** laboratórny výsledok je súčasť zdravotnej dokumentácie; oprava musí byť stopovateľná.
- **Klinická bezpečnosť:** žiadna automatická interpretácia bez review lekára (`requiresVetApproval`); falošná
  istota (vymyslený confidence score) je bezpečnostné riziko — musí byť odstránená (UC-08 AC-5).
- **GDPR:** súbor môže obsahovať údaje majiteľa; surový vstup sa uchováva ako dôkaz, nie ako verejný artefakt.
- **RLS:** `tenant_isolation` na všetkých lab tabuľkách.

### 7. Merateľná úspora času (ledger **L15, L09**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L15 Lab import, validácia, zápis do karty | technik | 8,00 min × 220/mes. (ručný prepis ~15 analytov) | 2,00 min (parser + review) | 22,0 h | **12,1 h/mes. = 339 €** |
| L09 Interpretácia a záver | lekár | 3,00 min × 220/mes. | 1,50 min | 5,5 h | **3,0 h/mes. = 106 €** |

### 8. Odkaz → **UC-08**

---

## J17 — Zobrazovacie vyšetrenie (RTG, USG) a AI nález s VHS

**Tier:** T3 · **Audit:** PASS 200 OK · **Ledger:** L10 · **Use Case:** UC-09 · **Business Case:** BC-01
**Známe riziko:** `imaging.analyze` nemá `abortSignal`/timeout a pri chybe vracia `INTERNAL_SERVER_ERROR`
s raw textom upstream chyby (`imaging.ts:307`) — únik technických detailov a zamrznuté UI. Riešené v UC-09 AC-6.

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** MVDr. lekár | `veterinarian` (alebo `admin` s klinickou rolou) | robí RTG, meria VHS, píše nález; rozhoduje o ďalšom postupe |
| Sekundárny: Veterinárny asistent | `technician` | polohuje pacienta, pripraví snímku, nahraje súbor |
| Blokový: `front_desk`, `viewer` | — | `requireRole("admin","veterinarian")` + `requireFeature("agent")` |

### 2. Trigger a vstupné predpoklady

**Trigger:** klinické podozrenie (kašeľ, intolerancia záťaže, trauma, kulhanie); pooperačná kontrola; skríning
(u veľkých plemien na DKK, kardiomyopatia); žiadosť majiteľa.

**Pre-conditions:** súbor snímky vo `files` (alebo `capture_sessions` z mobilu); druh a váha pacienta pre VHS
(VHS je definovaný pre psa a mačku — `species: "canine" | "feline"`); kalibrovaná dĺžka na snímke (mm).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár otvorí `/agent/imaging` | Výber modality (`xray`/`ultrasound`/`ct`/`mri`/`photo`), pacienta, súboru | Snímka nekvalitná → opakovať, nie interpretovať |
| 2 | Zadá dotaz (voliteľne) | `userPrompt` ≤ 2 000 znakov („hodnoť veľkosť srdca, pľúcne pole“) | Bez promptu → všeobecný nález |
| 3 | `extensions.imaging.analyze` | Vznikne `ai_imaging_analyses` so statusom `PENDING` → `COMPLETED`/`FAILED`; 6 modality promptov SK/EN; `providerOptions.google.thinking.budgetTokens: 2048` | Timeout/porucha → `FAILED` s **použiteľnou** hláškou (nie raw upstream error) |
| 4 | Lekár číta nález | Text nálezu + miera istoty; explicitný disclaimer, že ide o návrh na overenie | Lekár nesúhlasí → edituje pred potvrdením |
| 5 | Meranie VHS | `extensions.imaging.calculateVhs(longAxisMm, shortAxisMm, t4VertebraLengthMm, species)` → `lib/imaging/vhs-calculator.ts`; výsledok s referenčným pásmom (pes ~8,5–10,5; mačka iné pásmo) | Namerané hodnoty mimo fyziologických hraníc → validácia odmietne (prevencia preklepu 100 mm) |
| 6 | Potvrdenie | `prepareConfirmation` → **`ClinicalDiffConfirmModal`** → `confirmAnalysis`; spotrebuje envelope, appendne `ext_ai_audit_log`, zapíše `ext_clinician_confirmations` (`imaging_analysis`, `imaging_confirmed`) | Bez potvrdenia nález **nie je** súčasťou dokumentácie |
| 7 | Zápis do SOAP | `injectFindingsIntoSoap` — `assertAiMayWriteToSoapNote` povoľuje zápis **len do draftu**; text dostane prefix `[AI Rádiológia … – návrh na overenie lekárom]` do sekcie `objective` | Draft už finalizovaný → odmietnuté (CONFLICT), lekár použije addendum |
| 8 | Ďalšie kroky | `createSurgicalPlanFromImaging` (návrh operačného plánu → JG-C03), `createMarketingQuizFromImaging` (edukačný obsah → J18, s `validateMarketingText`) | Chirurgický plán je **návrh**, vyžaduje potvrdenie lekára a súhlas majiteľa (D-04) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **AI vráti nález k inej modalite / halucinuje štruktúry** | Lekár musí mať možnosť označiť „nález nepoužiteľný“ → `FAILED`/`rejected` s dôvodom v `ext_ai_audit_log`; žiadny zápis do SOAP |
| E2 | **Chýba kalibrácia (mm) pre VHS** | Kalkulačka odmietne výpočet; ponuka zadať známu dĺžku implantátu/merítka |
| E3 | **Súbor je príliš veľký / nepodporovaný formát** | Validácia pred odoslaním do modelu; kompresia alebo odmietnutie s návodom |
| E4 | **Model nedostupný** | VHS kalkulačka (deterministická) funguje aj bez AI; UI oddelí „meranie“ a „AI interpretácia“ |
| E5 | **Súbežná úprava draftu SOAP** | `imaging.ts:637` vracia `CONFLICT` pri súbežnej zmene |
| E6 | **Snímka obsahuje identifikačné údaje majiteľa** | Minimalizácia pred odoslaním do modelu (orezanie, anonymizácia); `files` prístup cez RLS |
| E7 | **Marketingový obsah zo snímky** | Len so súhlasom majiteľa (`ext_marketing_media_consents`, `createMediaConsent`/`revokeMediaConsent`) |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/agent/imaging`, `/patients/[id]`, `/records/new-soap/[patientId]`, `/marketing/media` |
| Komponenty | `components/imaging/*`, `components/copilot/clinical-diff-confirm-modal.tsx`, `components/copilot/confidence-score-badge.tsx` |
| Modaly | upload snímky, VHS kalkulačka (3 polia + druh), `ClinicalDiffConfirmModal`, dialog „vložiť do SOAP“ |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `extensions.imaging.analyze/listByPatient/get/calculateVhs/prepareConfirmation/confirmAnalysis/injectFindingsIntoSoap/createSurgicalPlanFromImaging/createMarketingQuizFromImaging` |
| Drizzle | `ai_imaging_analyses` (`ai_imaging_status`, `ai_imaging_image_type`, indexy na file/patient/practice/status), `files`, `file_object_replicas`, `soap_notes`, `ext_clinician_confirmations`, `ext_ai_audit_log`, `ext_marketing_media_assets`, `ext_marketing_media_consents` |
| Deterministická časť | `lib/imaging/vhs-calculator.ts` — bez LLM, reprodukovateľné, auditovateľné |
| Bezpečnosť volania | `autonomousProcedure` (nie v jednej DB transakcii počas volania modelu); **chýba** `abortSignal`/timeout → doplniť v0.7 |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** rádiologický nález je zdravotná dokumentácia — podpisuje lekár (`confirmAnalysis`), AI je pomôcka.
- **HITL:** dvojfázové potvrdenie s envelope; bez neho `injectFindingsIntoSoap` odmietne zápis; zápis len do draftu.
- **GDPR + sub-procesori:** snímka môže obsahovať osobné údaje; Vertex AI / Anthropic sú identifikovaní ako
  sub-procesori, **DPA zatiaľ nepodpísaná, región nepotvrdený** (`ROADMAP.md`, register dlhu bod 4) — pre pilotnú
  kliniku je to otvorená compliance položka.
- **Označovanie AI:** prefix v SOAP a badge sú povinné, aby čitateľ záznamu vedel, čo je strojový návrh.

### 7. Merateľná úspora času (ledger **L10**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Meranie VHS + text nálezu | 6,00 min × 120/mes. | 2,50 min (kalkulačka + AI návrh s potvrdením) | model 7,0 h → **real 3,9 h/mes. = 135 €** |
| **Kvalitatívne** | VHS sa na mnohých ambulanciách nerobí vôbec (časovo náročné) | štandardná súčasť kardiologického vyšetrenia | skríning kardiomegálie u rizikových plemien → včasná diagnóza (BC-01, BC-07) |

### 8. Odkaz → **UC-09**, čiastočne **UC-12** (chirurgický plán)

---

## J18 — Tvorba a schválenie obsahu (content queue, médiá, web)

**Tier:** T4 · **Audit:** PASS 200 OK · **Ledger:** L33 (zdieľaný s J19) · **Use Case:** UC-19 (časť) · **Business Case:** BC-08

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Admin | `admin` | zodpovedá za značku, tonality, súlad s legislatívou |
| Sekundárny: Recepcia | `front_desk` | publikuje schválený obsah, spravuje TV obrazovku v čakárni |
| Sekundárny: MVDr. lekár | `veterinarian` | odborná korektúra zdravotných tvrdení |

### 2. Trigger a vstupné predpoklady

**Trigger:** plán obsahu (týždenný `getWeeklyPlan`); sezónna kampaň (kliešte, Vianoce, dovolenky); nový handout
po častej diagnóze; aktualizácia webu kliniky; potreba edukačného materiálu do čakárne.

**Pre-conditions:** `ext_marketing_brand_kit` / `practices.settings.brandKit` (farby, tonalita, logo, soc. siete);
`ext_content_pillars` (tematické piliere); `ext_channel_accounts` (OAuth účty); pri médiách —
`ext_marketing_media_consents` (súhlas majiteľa so zverejnením zvieraťa).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Admin otvorí `/marketing/plan` | `extensions.marketing.getWeeklyPlan`, `listContentBatches`, `createContentBatch` — plán s piliermi a dátumami | Prázdny plán → `createContentBatch` navrhne dávku podľa sezóny a pilierov |
| 2 | Vygeneruje príspevok | `generatePost` (`lib/marketing/composer.ts`): fakty o klinike, sezónne tipy, meno pacienta **len ak** je `allowName` povolené a existuje súhlas | AI nedostupné → `localCompose()` deterministický fallback s rovnakým tvarom výstupu |
| 3 | Pridá médium | `listMediaAssets`/`createMediaAsset`/`applyMediaEdit`/`suggestMediaAltText`; `generateImageForPost` (imageGeneration); `submitVideo` + `pollVideo`; `generateIllustration` (deterministické SVG, **nie** AI) | ⚠️ Pri offline proxy `generateImage` ticho fallbackne na kurovaný stock obrázok s rovnakým tvarom odpovede (audit A15) — musí byť označený ako „stock“, nie „generované“ |
| 4 | Validácia textu | `validateMarketingText()` — block/warn pravidlá (Rx tvrdenia, lieky, cenové sľuby, zdravotné tvrdenia); `autoFixContentItem` navrhne opravu | Block → publikovanie nemožné bez úpravy |
| 5 | Schválenie | `/marketing/content-queue` → `approveContentItem` / `approveContentBatch` / `rejectContentItem` / `rescheduleContentItem`; `escalateReview` pri pochybnostiach | Bez schválenia sa obsah **nedostane** von (dvojstupňová bariéra) |
| 6 | Publikovanie | `processQueuedMessages` / `triggerMessage` do kanálov; `appendAiAuditEvent` pre `marketing_content` | Zlyhanie kanála → retry fronta a stav v `listMessageLogs` |
| 7 | Handouty a TV | `/marketing/handouts` (`ext_marketing_handouts` — PDF edukácia), `/marketing/tv` a `/tv` (`getPublicTvSlides`, `ext_marketing_tv_slides`) | Handout s medicínskym obsahom → schválenie lekárom |
| 8 | Web kliniky | `/marketing/website` → `getWebsiteConfig`/`updateWebsiteSections`/`toggleWebsite`/`publishWebsite`/`getPublicWebsiteData`/`suggestWebsiteFaq`/`submitWebsiteContactForm`/`listWebsiteInquiries`/`updateWebsiteInquiryStatus`/`trackWebsiteAction` | Inquiry → `/inbox` alebo staff task |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Obsah obsahuje meno/fotku pacienta bez súhlasu** | `allowName` + `ext_marketing_media_consents` kontrola; `revokeMediaConsent` okamžite stiahne obsah z fronty |
| E2 | **Prompt injection z recenzie alebo webového textu** | Externý text sa spracúva ako dáta; `validateMarketingText` blokuje Rx tvrdenia; AI odpoveď sa ukladá ako **draft**, nie priamo publikovateľný obsah (audit F-X3-2) |
| E3 | **AI generuje zdravotné tvrdenie („vylieči“)** | block-level validácia; `autoFixContentItem` navrhne neutralizáciu |
| E4 | **Dvojité publikovanie** | idempotencia na `ext_marketing_content_items` + stavový automat; `processQueuedMessages` pod zámkom |
| E5 | **Video generovanie zlyhá** | `pollVideo` vráti stav; žiadne tiché „úspešné“ s prázdnym URL |
| E6 | **Cenová informácia je neaktuálna** | Web ťahá dáta z `services`/`practices`, nie z AI textu; AI nesmie vymýšľať ceny |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/marketing`, `/marketing/plan`, `/marketing/content-queue`, `/marketing/media`, `/marketing/handouts`, `/marketing/tv`, `/tv`, `/marketing/website`, `/marketing/brand-kit`, `/marketing/messages` |
| Komponenty | `components/marketing/*`, `components/brand/*`, `components/marketing/social-approval-queue-tab.tsx`, `components/marketing/automation-illustrations.tsx` |
| Modaly | generovanie príspevku, media picker (`website-media-picker-dialog.tsx`), schvaľovací queue, editor sekcií webu |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `extensions.marketing.listTemplates/generatePost/createCustomPost/listContentItems/createContentBatch/approveContentBatch/approveContentItem/rejectContentItem/rescheduleContentItem/autoFixContentItem/escalateReview/getWeeklyPlan/listMediaAssets/createMediaAsset/deleteMediaAsset/applyMediaEdit/suggestMediaAltText/generateIllustration/generateImageForPost/submitVideo/pollVideo/listMediaConsents/createMediaConsent/revokeMediaConsent/grantConsent/listConsentCandidates/getPublicTvSlides/getWebsiteConfig/updateWebsiteSections/publishWebsite/getPublicWebsiteData/suggestWebsiteFaq/listWebsiteInquiries/createPostFromBulletin`, `extensions.automationContent.*`, `extensions.automationChannels.*` |
| Drizzle | `ext_marketing_content_items`, `ext_marketing_content_batches`, `ext_content_briefs`, `ext_content_pillars`, `ext_marketing_media_assets`, `ext_marketing_media_consents`, `ext_marketing_handouts`, `ext_marketing_tv_slides`, `ext_marketing_website_config`, `ext_marketing_website_inquiries`, `ext_marketing_operative_scripts`, `ext_ai_audit_log` |
| Audit | `appendAiAuditEvent` pre `entityType='marketing_content'` / `'marketing_media'` (`lib/ai/audit-ledger.ts:37–38`) |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR:** súhlas so zverejnením fotky zvieraťa = súhlas majiteľa (osobný údaj); `revokeMediaConsent` musí byť
  okamžité a musí stiahnuť aj už publikovaný obsah.
- **Reklamná regulácia a veterinárna etika (KVL SR):** žiadne Rx tvrdenia, žiadne sľuby vyliečenia, žiadne
  porovnávanie s konkurenciou; `validateMarketingText` je enforcement vrstva.
- **Označovanie AI obsahu:** `meta.generated`, badge „generované“; stock fallback nesmie byť označený ako AI výstup.
- **Prístupnosť:** `suggestMediaAltText` — alt text je požiadavka prístupnosti, nie ozdoba.

### 7. Merateľná úspora času (ledger **L33**, zdieľaný s J19)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Marketing: obsah + kampane + recenzie (admin) | 9,0 h/mes. (externý dodávateľ alebo večery konateľa) | 3,0 h/mes. (generovanie + schvaľovanie) | model 6,0 h → **real 3,3 h/mes. = 99 €** |
| Náklady na externého dodávateľa | 300–600 €/mes. | 0 € (interná produkcia) | **nezapočítané v ROI** (konzervativizmus); uvádza sa ako upside BC-08 |

### 8. Odkaz → **UC-19** (časť), **UC-18** (súhlasy)

---

## J19 — Kampaň, segmentácia a reputácia (recenzie, post-op follow-up)

**Tier:** T4 · **Audit:** PASS 200 OK · **Ledger:** L33, L12 · **Use Case:** UC-17, UC-19 · **Business Case:** BC-08, BC-03

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Admin | `admin` | sleduje reputáciu, segmenty, metriky kampaní |
| Sekundárny: Recepcia | `front_desk` | odpovedá na recenzie (podľa skriptov), volá nespokojným klientom |
| Sekundárny: MVDr. lekár | `veterinarian` | odborná odpoveď na klinickú recenziu; schvaľuje post-op skripty |
| Pasívny: Majiteľ zvieraťa | klient | dostane žiadosť o recenziu, odpovie na post-op otázku |

### 2. Trigger a vstupné predpoklady

**Trigger:** dokončená návšteva (`visit_completed`); ukončená operácia (`surgery_completed`); nová recenzia
(sync); mesačné vyhodnotenie; eskalácia negatívnej recenzie; `runVaccineSweep`.

**Pre-conditions:** `ext_channel_accounts` pre Google/Facebook; `ext_marketing_reviews` sync;
`ext_marketing_operative_scripts` pre post-op otázky; segmenty `ext_crm_segments` vypočítané
(`recomputeAll`); suppression centrum aktívne.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Udalosť spustí journey | `lib/autopilot/postoperative.ts` deteguje operáciu a emituje durable `surgery_completed`; `ext_automation_events` + `ext_automation_journeys` naplánujú kroky (24 h / 3. deň / 10. deň) | Falošná detekcia (dentálna hygiena bez chirurgie) → test `postoperative.test.ts:74` garantuje, že sa neoznačí |
| 2 | Post-op follow-up | Verejný formulár `/postop/[id]` → `submitPostopResponse` → `listPostopResponses`; ak klient hlási problém → `escalateReview` a staff task | Odpoveď „rana hnisa“ → **človek** volá, nie automatizovaná odpoveď |
| 3 | Žiadosť o recenziu | Po úspešnej návšteve a po uplynutí ochranného okna; `consentGateCheck(review_request)` — **nikdy** po úhyne | Zosnulý pacient → sympathy gate blokuje aj žiadosť o recenziu |
| 4 | Príde recenzia | `syncExternalReviews` → `ext_marketing_reviews`; SLA 24 h; `saveAiReviewDraft` (`generateReviewReply`) → draft odpovede | Draft sa **nepublikuje** bez `approveReviewReply` |
| 5 | Negatívna recenzia | `escalateReview` → `ext_marketing_staff_tasks` → `resolveStaffTask`; interná notifikácia do `/inbox` | Do 24 h bez reakcie → eskalácia na admina |
| 6 | Segmentácia | `extensions.crmSegments.recompute/getSegmentMembers` — 9+ segmentov (`lib/autopilot/segmentation-engine.ts`): napr. `post_op_recovery` (operácia do 30 dní, **len žijúci pacienti**), chronici, seniori, noví klienti, stratení | Segment pre kampaň sa musí dať vysvetliť (SQL definícia je súčasťou segmentu) |
| 7 | Kampaň | `triggerMessage`/`processQueuedMessages` nad segmentom s `validateMarketingText` a consent gate | Časť segmentu je utlmená → `getMetrics` ukáže koľko a prečo |
| 8 | Vyhodnotenie | `getMessageStats`, `listMessageLogs`, `getQueueMetrics`, `listLogs` (suppression), `funnel_events`, `ext_marketing_competitor_snapshots` + `runCompetitorAnalysis` (`/vet-intel`) | Nízka konverzia → zmena šablóny alebo kanála |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Recenzia obsahuje útok / prompt injection** | Text recenzie je cudzí vstup: spracúva sa ako dáta, draft odpovede prechádza `validateMarketingText`, publikuje len človek |
| E2 | **Klient v recenzii rieši klinickú chybu** | Eskalácia na lekára a admina; žiadna automatická odpoveď; dokumentácia k prípadu (J3/UC-05, `ext_pilot_feedback`) |
| E3 | **Úhyn pacienta a naplánovaná žiadosť o recenziu** | Sympathy gate atomicky ruší všetky naplánované kroky; `sendCondolenceCard` len manuálne |
| E4 | **Duplicitná recenzia z dvoch zdrojov** | Deduplikácia podľa `(source, externalId)`; `ext_marketing_reviews` unique |
| E5 | **Kampaň zasiahla klienta, ktorý si želá ticho** | Suppression log + metrika; pri opakovaní → kontrola pravidiel a quiet hours |
| E6 | **Segment obsahuje pacientov inej praxe** | RLS: SQL segmentov beží v tenante; cross-tenant = 0 riadkov |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/marketing`, `/marketing/reviews`, `/marketing/automations`, `/marketing/messages`, `/marketing/suppression`, `/marketing/competitors`, `/vet-intel`, `/marketing/scripts`, `/postop/[id]`, `/inbox` |
| Komponenty | `components/marketing/social-approval-queue-tab.tsx`, `components/automations/*`, `components/communications/message-logs-view.tsx` |
| Modaly | draft odpovede na recenziu, eskalácia, detail segmentu, náhľad kampane |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `extensions.marketing.syncExternalReviews/saveAiReviewDraft/approveReviewReply/escalateReview/resolveStaffTask/submitPostopResponse/listPostopResponses/listOperativeScripts/upsertOperativeScript/sendCondolenceCard/triggerMessage/processQueuedMessages/getMessageStats/listMessageLogs/checkSmsRateLimit/getUnsubscribeInfo/unsubscribeByToken/listCompetitorSnapshots/runCompetitorAnalysis/toggleCompetitorDigest`, `extensions.crmSegments.list/get/toggle/recompute/recomputeAll/getSegmentMembers`, `extensions.automationEvents.simulateEvent/processQueueNow/getQueueMetrics`, `extensions.automationSuppression.getMetrics/listLogs` |
| Drizzle | `ext_marketing_reviews`, `ext_marketing_staff_tasks`, `ext_marketing_postop_responses`, `ext_marketing_operative_scripts`, `ext_crm_segments`, `ext_crm_segment_memberships`, `ext_automation_*`, `ext_marketing_competitor_snapshots`, `funnel_events`, `ext_pilot_feedback` |
| Event pipeline | `lib/autopilot/{postoperative,rules-engine,segmentation-engine,consent-gate}.ts`; durable events v `ext_automation_events` |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR + Sympathy Gate:** `consentGateCheck` s `communicationType='review_request'`; atomické utlmenie pri úhyne;
  dôkaz v `ext_automation_suppression_log`.
- **Zákon 452/2021 Z. z.:** marketingový charakter kampaní → súhlas; unsubscribe token (`unsubscribeByToken`) musí fungovať bez prihlásenia.
- **Etika a KVL:** odpoveď na recenziu nesmie odhaľovať zdravotné údaje klienta (verejný priestor!) — draft validuje, či neobsahuje diagnózu.
- **RLS:** segmenty a recenzie sú tenan-izolované.

### 7. Merateľná úspora času a hodnoty (ledger **L33**, **L12**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L33 Marketing: obsah, kampane, recenzie, suppression (zdieľaný s J18) | admin | 9,0 h/mes. | 3,0 h/mes. | 6,0 h | **3,3 h/mes. = 99 €** |
| L12 Eutanázia/úhyn — administratíva a sympathy | lekár | 20 min × 8/mes. | 8 min | 1,6 h | **0,9 h/mes. = 31 €** |

**Hodnotový efekt (BC-08, nezapočítaný ako cash):** SLA 24 h na recenzie a post-op follow-up zvyšujú
pravdepodobnosť odporúčania. Model zámerne **nekvantifikuje** nárast kmeňovej bázy z reputácie — chýbajú
dôkazové dáta a riziko nadhodnotenia je vysoké.

### 8. Odkaz → **UC-17** (časť), **UC-19** (časť), **UC-05** (pri klinickej chybe)
