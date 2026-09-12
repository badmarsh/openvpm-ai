# OpenVPM AI — Autopilot Vision: Konsolidovaný súhrn

> **Dátum konsolidácie:** 2026-09-12  
> **Anchor commit (výskum):** `23f23a3`  
> **Stav na main po merge:** commit `9478878`  
> **Agenti:** 1 (Architecture) · 2 (Schema) · 3 (Event Engine) · 4 (Guardrails/GDPR) · 5 (Roadmap)

---

## §1 Vízia a cieľ

> *„OpenVPM should automatically answer: 'What happened in the clinic today, and what safe, relevant, measurable communication action can we create from it?'"*

**5 autopilot pilierov:**

| Pilier | Popis |
|--------|-------|
| **Social media autopilot** | AI generuje a publikuje obsah z klinických udalostí |
| **CRM & segmentation** | Segmentácia klientov, journey engine, personalizácia |
| **Data entry copilot** | Voice→SOAP, discharge, imaging s human-in-the-loop |
| **Reputation management** | Google reviews, Meta odpovede, sentiment, PII guard |
| **Event bus & automation** | Postgres-backed durable event log, rules engine, journeys |

---

## §2 Maturity matrix

*Agent 5 audit z kódu, anchor commit `23f23a3`*

| Pilier | Zrelosť | Čo je postavené | Čo chýba |
|--------|---------|-----------------|-----------|
| Social media | **~45%** | Content planner, AI copywriter SK/EN, batch approval, media kit | Žiadny Meta/Google API klient, publishChannel stub, žiadna atribúcia |
| CRM & segments | **~35%** | SMS/email suppression, consent ledger, rate limiter, sympathy gate | Žiadne segmenty, journey tabuľky, `inactive_recall` sa nikdy neemituje |
| Data entry copilot | **~65%** | Voice→SOAP, confirmation envelope, AI audit chain, imaging prompts | Voice wiring incomplete v 3 routeroch, PDF→lab parsery nevypojené |
| Reputation | **~35%** | `ext_marketing_reviews` (ingest + reply) | Žiadny GBP/Meta API klient, žiadny sentiment/PII guard, approval gate |
| Event bus | **~45%** | Trigger pipeline, message log, sympathy gate, consent+rate suppression, 15 cron jobs | processQueue neposiela nič, journey tabuľky chýbajú, worker neexistuje |

---

## §3 Kritické nálezy (kód)

### 🔴 Kritické

**[F-1] `processQueue` neodosiela správy**  
`apps/web/lib/marketing/messaging.ts:L376-464` — označuje riadky `delivered` bez volania SMS/email providera. Žiadny cron nevolá `processQueue`. **Žiadna marketing správa nebola nikdy odoslaná.**

**[F-2] `visit_completed` trigger nedosiahnuteľný na kanonickej ceste**  
`appointments.update` hádže error pri `clinical_finalized`/`completed`. `encounters.completeCheckout` nevysiela marketing trigger. Flagship flow „visit closed → thank-you → review ask" nefunguje.

**[F-3] Sympathy gate nie je bezpodmienečná (SKILL.md §3 porušenie)**  
Blokuje iba ak `legalBasis === 'consent'` ALEBO templateKey v 5-item allowliste. Seed rules používajú `legalBasis: 'contract'` → sympathy gate ich neblokuje.

### 🟠 Vysoká závažnosť

**[F-4]** Marketing quiet hours = `now.getHours()` (server timezone) namiesto existujúcej `isQuietHours()` s klientskou timezone.

**[F-5]** Rate limiter je zero-tolerance (`count === 0`), nevie vyjadriť „max N za 7 dní".

**[F-6]** 6/10 trigger families dead code: `vaccine_due`, `inactive_recall`, `payment_failed`, `wellness_enrolled`, `birthday_reminder`, `anniversary_reminder` nikdy neemitované.

**[F-7]** Delivery note parsery pre 8 veľkoobchodníkov existujú ale nevypojené (len v testoch).

---

## §4 Navrhovaná architektúra

*Agent 1 (ARCHITECTURE-RESEARCH.md §B–§E)*

### Event bus — Postgres durable log
**Nie Redis/BullMQ** — žiadny worker runtime, docker-compose bez Redis, 5 Postgres-durable precedentov. Redis oprávnený až pri >10 000 event/min.

**Worker:** pg-polling cron (nie LISTEN/NOTIFY — nekompatibilné so serverless/pgBouncer).

### Kľúčové nové entity
```
ext_automation_events   — append-only event bus
ext_automation_rules    — configurable triggers + conditions + actions
ext_automation_journeys — timed steps, branching, pause/resume
ext_suppression_log     — unified suppression audit
```

### Phase 0 odporúčanie (Agent 1 §F)
Pred event busom opraviť `visit_completed` emission cez existujúce tabuľky — 1-dňový fix unblockuje flagship flow.

---

## §5 Schema design

*Agent 2 (SCHEMA-DESIGN.md) — overené `tsc --noEmit` exit 0 + `drizzle-kit push` na PostgreSQL 18.4*

### 11 nových tabuliek, 4 nové `ext_*` súbory

| Súbor | Tabuľky |
|-------|---------|
| `ext_automation.ts` | events, rules, journeys, enrollments, step_executions, suppression_log |
| `ext_crm.ts` | segments, segment_memberships |
| `ext_content_calendar.ts` | content_pillars, content_briefs |
| `ext_channel_accounts.ts` | OAuth state (FB/IG/GBP/YouTube) |

**ALTER:** `ext_marketing_reviews` +19 nullable stĺpcov (nie nová tabuľka)

### ⚠️ DDL problémy zistené pri push
| Problém | SQLSTATE | Riešenie |
|---------|----------|----------|
| `seasonMonths CHECK` s `int4range::int[]` | 42846 | Opravené na `<@ ARRAY[1..12]` |
| Composite tenant FKs `(practice_id, id)` na prázdnej DB | 42830 | Dokumentované; týka sa aj upstream `care_reminders` |

**Token encryption pre `ext_channel_accounts`:** použiť `lib/messaging/registration-crypto.ts` (AES-256-GCM) — nie `auth-tokens.ts` (one-way SHA-256).

---

## §6 Compliance & GDPR gate

*Agent 4 (GUARDRAILS-COMPLIANCE.md)*

### Consent per typ komunikácie

| Typ | Právny základ | Required signal |
|-----|---------------|-----------------|
| Vaccination reminder (informačný) | Art 6(1)(b) zmluva | Žiadny marketing consent, ale sympathy + suppression + quiet hours |
| Marketing SMS/email | Art 6(1)(a) súhlas | `clients.smsConsent` + `ext_marketing_media_consents` scope=marketing_messages |
| Social media (foto klienta) | Art 6(1)(a) súhlas | `ext_marketing_media_consents` scope=photo_social/story/testimonial |
| Review request | Art 6(1)(f) legit. záujem | Max 1/visit, frequency cap |
| Reputation reply | Art 6(1)(f) legit. záujem | Anonymizácia + PII scanner + manager approval ak mention liečby |

### Navrhovaný audit ledger
- `ext_automation_audit_log` — append-only, hash chain, SAR-exportable, 10r retenzia
- `ext_approval_queue` — risk Low/Med/High/Critical, TTL 24h/12h/4h/1h, auto-reject timeout, escalation

### Slovak law checklist
| Zákon | Požiadavka | Stav |
|-------|-----------|------|
| 39/2007 Z.z. | Treatment Diary + KVL podpis + 3-dňový RVPS cron | ✅ Implementovaný |
| 139/1998 Z.z. | **ŽIADNE AI prefill** pre omamné látky — trestná zodpovednosť | ✅ Guardrail existuje |
| GDPR Art 22 | Profiling transparency, reasonCodes, opt-out | ⚠️ Chýba |
| GDPR Art 9 | Zdravie zvierat = high-sensitivity → marketing consent | ✅ Čiastočne |
| ePrivacy | Vaccination reminder = service ak čisto informačný | ⚠️ Potrebuje validator |

### Copilot — NEVER auto-commit fields
```
drug dose · withdrawal period · euthanasia dosing · diagnosis
controlled substance · lab interpretation · allergy · vaccination
```

---

## §7 Roadmap

*Agent 5 (ROADMAP-COSTBENEFIT.md §B) — ~78–97 senior dev dní*

### Strategické odporúčanie
> **Začni s event bus + send adapter + suppression center + vaccination recall** (~2-týždňový pilot). Nie social publishing.  
> Meta App Review podaj hneď na začiatku (6–8 týždňov čakania).

| Fáza | Obsah | Dni |
|------|-------|-----|
| **Phase 0 — Unblock** | Opraviť F-1/F-2/F-3/F-4/F-5 (processQueue provider, visit_completed, sympathy gate, quiet hours, rate limiter) | ~3 |
| **Phase 1 — Foundation** | Postgres event bus, pg-polling worker, rules v1, journey v1, vaccination recall E2E, consent gate lib | ~18–22 |
| **Phase 2 — CRM & Social** | Segmenty, segment journeys, Meta Graph API, Google Business Profile API, OAuth channel accounts | ~20–25 |
| **Phase 3 — Copilot & Rep** | Voice→SOAP full wiring, PDF→lab parsery, reputation reply + PII guard, approval queue UI | ~18–22 |
| **Phase 4 — Scale** | Attribution, A/B testing, analytics, advanced AI content | ~19–25 |

### Effort overrides (Agent 5 vs megaprompt)

| Task | Brief | Override | Dôvod |
|------|-------|----------|-------|
| Journey engine | 6d | **8d** | Enrollment + step execution + drain + pause/resume |
| Rules engine | 4d | **3d** | Schema hotová, conditions eval straightforward |
| Voice wiring | 2d | **1.5d** | Pattern established |
| PDF→lab parsers | 4d | **5d** | 8 veľkoobchodníkov, integration testing |

---

## §8 Otvorené otázky pre product ownera

| # | Otázka | Agent | Urgencia |
|---|--------|-------|----------|
| Q1 | Je `processQueue` vedome stub, alebo sa verilo že posiela? | 1, 3, 5 | 🔴 Kritická |
| Q2 | Aký SMS/email provider? (Twilio, SK SMS provider, SES, Postmark) | 3 | 🔴 Phase 0 |
| Q3 | Meta App Review — kedy podať? | 5 | 🟠 Phase 1 start |
| Q4 | Segment identifier format pre `client.segment` | 1, 3 | 🟠 Pred rules engine |
| Q5 | KEP podpisovanie pre KVEPIS: D.Signer vs. cloud HSM | 1 | 🟡 Phase 2 |
| Q6 | Lab priority pre pilot: Laboklin / Synlab / ŠVÚ | 5 | 🟡 Phase 3 |
| Q7 | Legacy migration: WinVet (Firebird) vs. Vetis/VetProf (MSSQL) | 5 | 🟡 Phase 4 |
| Q8 | ePrivacy: vaccination reminder = service alebo marketing? | 4 | 🟠 Phase 1 |
| Q9 | Pilot kliniky signed? | 5 | 🔴 Blocking metrics |
| Q10 | Approval gate defaults pre pilot kliniku | 4 | 🟡 Phase 1 |
| Q11 | Segmentation run frequency: weekly vs. nightly vs. real-time | 3 | 🟡 Phase 1 |

---

## §9 Zdrojové artefakty

```
artifacts/autopilot-vision-2026-09-12/
├── ARCHITECTURE-RESEARCH.md    Agent 1 — 1 811 riadkov (§A–§H)
├── SCHEMA-DESIGN.md            Agent 2 — 2 501 riadkov, DDL + verifikácia
├── EVENT-ENGINE-PLAN.md        Agent 3 — 1 021 riadkov (§A–§F)
├── GUARDRAILS-COMPLIANCE.md    Agent 4 —   677 riadkov (§A–§F)
└── ROADMAP-COSTBENEFIT.md      Agent 5 —   338 riadkov (§A–§F)
```

> ⚠️ **Spoľahlivosť tagov:** Agenti 1, 3, 5 mali priamy FS access — `[VERIFIED]` tagy sú spoľahlivé na `23f23a3`. Agent 4 nemal FS access — všetky `[INFERRED]` tvrdenia o existujúcom kóde treba verifikovať lokálne.
