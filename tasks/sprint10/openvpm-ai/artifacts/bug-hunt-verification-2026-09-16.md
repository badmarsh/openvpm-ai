# Hĺbkový Bug Hunting & Verifikačný Report — OpenVPM AI (16.09.2026)

**Commit base:** `2821c98` (main) + branch `arena/01a0aa72-openvpm-ai`  
**Rozsah:** IA konsolidácia Fáza 4 (Run 2), AI Security remediácia F1–F10, Autopilot Phase 3 Event Bus, e-Kasa, Zákonné registre  
**Tester:** Arena Autonomous QA & Security Core Agent  
**Dátum:** 2026-09-16 UTC

---

## 1. Executive Summary

Celková integrita codebase je **vysoká** — po oprave 3 zlyhávajúcich unit testov (pozri BUG-01) prechádza **100 % testov**:

- **517 test files PASSED, 16 skipped**
- **5206 tests PASSED, 40 skipped, 0 failed**
- **i18n symetria:** `Symmetry OK` (sk.json ↔ en.json, 0 missing keys)
- **TypeScript:** `tsc --noEmit` PASS (s `NODE_OPTIONS=--max-old-space-size=4096`, bez OOM)
- **Cielené security testy:** `custom-nav-i18n`, `agent-auth-e2e`, `tools.test`, `withdrawal-floor`, `marketing-audit`, `route.test` — všetky PASS

Navigácia pre rolu `admin` má presne **32 kánonických položiek** (redukcia z ~44 → 32, -27 %), s globálnou deduplikáciou `seenGlobalHrefs` v `sidebar.tsx:333-357`.

Všetky požiadavky z Run 2 a F1–F10 remediácie sú implementované a verifikované.

---

## 2. Overovacia matica (Verification Protocol)

### 2.1 Syntaktická & typová kontrola
```bash
pnpm --filter @openpims/web type-check
# bez flagu: FATAL OOM (GC limit 2GB)
NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit
# → Exit 0, žiadne chyby
```

### 2.2 i18n symetria
```bash
node -e "
const en=require('./apps/web/messages/en.json');
const sk=require('./apps/web/messages/sk.json');
function diff(a,b,p=''){...}
"
# Výsledok: Symmetry OK
```
Kľúče overené:
- `nav.sectionMarketing` = "Marketing & Komunikácia" (sk) / "Marketing & Communications" (en) ✓
- `nav.marketingMessages` = "Kampane & SMS" / "Campaigns & SMS" (odlíšené od `/inbox` "Správy") ✓
- `nav.records` = "Klinická karta" / "Clinical Records" ✓
- `encounters.closeout.generateAiDischarge`, `encounters.workspace.imagingAi` existujú ✓

### 2.3 Klinické AI prepojenia (Doména A)
**Súbory:**
- `apps/web/app/(dashboard)/encounters/[appointmentId]/page.tsx:L656-L662` — tlačidlo "Snímky & AI analýza" → `/agent/imaging?patientId=...`
- `apps/web/app/(dashboard)/encounters/[appointmentId]/page.tsx:L2311-L2321` — tlačidlo "Vygenerovať AI správu" → `/agent/discharge?patientId=...&appointmentId=...` s ikonou Sparkles
- `apps/web/app/(dashboard)/agent/discharge/page.tsx:L115-L153` — `useSearchParams()` číta `patientId`, `trpc.patients.getById` autofill, obalené v `Suspense`
- `apps/web/app/(dashboard)/agent/imaging/page.tsx:L143-L185` — rovnaký pattern, `Suspense` fallback "Načítavam diagnostiku snímkov..."

**Suspense boundary:** Obe stránky majú export default s `<Suspense>` — prevencia hydration mismatch ✓

**SOAP & Preskripcia fail-closed:**
- `tools.ts:2922-2931` — `create_prescription` assertuje role `["veterinarian","admin"]` + UUID regex pre `userId`
- Test `agent-auth-e2e.test.ts:17 tests` PASS — `service_agent` BLOCKED pre `create_prescription` a `get_controlled_substances_log`
- `check_drug_safety` v `tools.ts:1518-1830` — pri neznámom lieku vracia `safe:false`, `evaluationStatus:"unknown_not_evaluated"` + coverage disclaimer, nie tiché schválenie ✓

### 2.4 Zákonné ochranné lehoty (Doména B)
**Súbor:** `apps/web/lib/statutory/withdrawal.ts`

- `checkStatutoryWithdrawalFloor` implementuje:
  - ŠÚKL katalogové minimá (Draxxin 22d, Cobactan 5d/1d, Shotapen 30d/10d, Noroclav 42d/3d, Baytril 14d/4d, Melovem 15d/5d)
  - EU 2019/6 Čl.115 kaskáda: mäso min 28d, mlieko 7d, vajcia 7d
  - Companion exemption: `["companion","canine","feline","pet"]` → no violation
  - End-of-day boundary `23:59:59.999` v `calculateStatutoryWithdrawal` a `calculateWithdrawalSafeUntil`

**Test:** `withdrawal-floor.test.ts (12 tests)` PASS, vrátane hraničných 0 dní pre bovine → violation s clampom na 28d ✓

### 2.5 Navigácia & Redirecty (Doména C)
**custom-nav.ts** (aktuálny stav, 10 položiek):
- Marketing 8: `/marketing`, `/marketing/reviews`, `/marketing/handouts`, `/marketing/messages`, `/marketing/website`, `/marketing/automations`, `/marketing/consents`, `/marketing/media`
- Klinika: `/agent/voice` (AI badge)
- Billing: `/billing/ekasa`

**vanillaSections v sidebar.tsx:**
- clinical 6, frontDesk 5, preventive 2, pharmacy 2, billing 3, marketing 0, admin 3 + overview 1 = 22 + 10 custom = **32 pre admin** ✓

**Globálna deduplikácia:** `seenGlobalHrefs` Set v `sidebar.tsx:333-357` nahrádza ad-hoc filtre, garantuje jedinečnosť URL ✓

**Backward-compat redirecty (všetky s `router.replace` + Loader2 fallback, bez infinite loop):**
- `/marketing/plan` → `/marketing?tab=calendar` ✓
- `/marketing/content-queue` → `/marketing?tab=queue` ✓
- `/marketing/suppression` → `/marketing/automations?tab=suppression` ✓
- `/marketing/wellness` → `/wellness` ✓
- `/marketing/tv` → `/waiting-room` ✓
- `/marketing/brand-kit` — ponechané ako standalone (link z `_marketing-studio.tsx`), nie v sidebare (zámer)
- `/marketing/competitors` → `/vet-intel?tab=market` ✓
- `/admin/pilot` → `/admin` ✓
- `/admin/support` — standalone podpora, nie v sidebare (zámer)

### 2.6 Marketing AI Audit Ledger & Rate Limiting (Doména D)
**Súbor:** `apps/web/lib/ai/audit-ledger.ts`

- `appendAiAuditEvent`:
  - Fail-closed role check: marketing entity → `["admin","veterinarian","front_desk"]`, clinical → `["admin","veterinarian"]`
  - Validácia SHA-256 hex (64 chars) pre `originalDraftHash` a `confirmedContentHash`
  - `pg_advisory_xact_lock(hashtextextended('ai_audit_chain:' || practiceId))` — serializácia per practice
  - Monotonické `sequenceNumber` + `previousEventHash` linking
  - SHA-256 `eventHash` via `computeAiAuditEventHash(payload)` s `canonicalizationVersion`
  - Insert do `extAiAuditLog` s `wasEditedByClinician` flag

- **Marketing generovanie:**
  - `marketing.ts:L337` + `L505` + `L820` — `assertHostedAiGate()` pred každým Alibaba volaním (billing entitlement + rate limit)
  - `marketing.ts:L581-L590` + `L1531` + `L4689` — `appendAiAuditEvent` pre `marketing_content` a `marketing_media`
  - `ai-gate.ts:32-69` — rateLimit key `marketingAiRateLimitKey(practiceId)`, limit `HOSTED_AI_MARKETING_RATE_LIMIT` per minute, fail-closed pri chybe limiteru

- **Test:** `marketing-audit.test.ts (12 tests)` PASS — overuje role boundaries, clinical partition, hash-chain integrity ✓

### 2.7 Autopilot Event Bus & Idempotencia (Doména E)
**Súbor:** `apps/web/lib/autopilot/event-worker.ts` + `journey-engine.ts` + `packages/db/schema/ext_automation.ts`

- Worker contract:
  - Polling, nie pg LISTEN/NOTIFY (serverless/pgBouncer kompatibilné)
  - `BATCH_SIZE=10`, `STUCK_CLAIM_THRESHOLD=5 min`
  - `recoverStuckClaims()` — reset `processing` → `pending` s `retryCount++`
  - `claimPendingEvents()` — SELECT pending WHERE availableAt <= now, UPDATE to processing s `lockedBy=POD_ID`
  - `processSingleEvent()` → `evaluateRules()` → `executeRuleAction()` → `advanceJourney()` → mark `processed`

- **Idempotencia na DB úrovni:**
  - `ext_automation_events.emissionUq` — unique `(practiceId, eventType, dedupeKey) WHERE dedupeKey IS NOT NULL` — idempotent emission pod webhook/cron retries ✓
  - `ext_automation_enrollments.enrollmentUq` — unique `(practiceId, journeyId, clientId, triggerEventId)` + `onConflictDoNothing()` v `enrollInJourney()` — at-least-once delivery nespôsobí duplicitu journey ✓
  - `ext_automation_step_executions.stepUq` — unique `(enrollmentId, stepIndex)` — step runs exactly once ✓
  - `ext_automation_events.queueIdx` partial index na `status='pending'` — efektívny work-queue scan

- **Sympathy Gate & GDPR:** `consent-gate.ts` — `assertPatientNotDeceased` + `smsConsent` + `extMarketingMediaConsents` check, suppression log `deceased_patient`, `opt_out` ✓
- **Test:** `autopilot-e2e-journeys.test.ts (5 tests)` PASS — vrátane deceased suppression log ✓

### 2.8 Cielené bezpečnostné testy
```bash
pnpm --filter @openpims/web test config/__tests__/custom-nav-i18n.test.ts
# → 3 tests PASSED

pnpm --filter @openpims/web test lib/agent/__tests__/agent-auth-e2e.test.ts
# → 17 tests PASSED (service_agent read OK, clinical write BLOCKED)

pnpm --filter @openpims/web test lib/agent/__tests__/tools.test.ts
# → 61 tests PASSED (drug safety, prescription UUID, formulary bounds)

pnpm --filter @openpims/web test lib/statutory/__tests__/withdrawal-floor.test.ts
# → 12 tests PASSED

pnpm --filter @openpims/web test lib/ai/__tests__/marketing-audit.test.ts
# → 12 tests PASSED

pnpm --filter @openpims/web test app/api/v1/agent/route.test.ts
# → 15 tests PASSED (po fixe BUG-01)
```

---

## 3. Zistené zraniteľnosti a defekty

### BUG-01 — REST API Agent testy nezohľadňovali `service_agent` rolu (Critical → Fixed)
- **ID:** BUG-01
- **Závažnosť:** Medium (test suite trustworthiness, nie runtime)
- **Súbor:** `apps/web/app/api/v1/agent/route.test.ts:L226, L319, L373`
- **Dôkaz:** 3 failing tests po F1 remediácii — očakávali `postCommitEffect: expect.any(Function)` bez `userRole`, ale implementácia v `route.ts:L120-L121` správne nastavuje `userRole: "service_agent"` pre API-key runs
  ```
  Expected: { context: { db, practiceId, userId, postCommitEffect: Any<Function> } }
  Received: { context: { db, practiceId, userId, userRole: "service_agent", postCommitEffect: [Function] } }
  ```
- **Root Cause:** Testy neboli aktualizované po zavedení dedikovanej `service_agent` role v F1 (Service Agent Role Injection)
- **Oprava (diff):**
  ```diff
  - postCommitEffect: expect.any(Function),
  + userRole: "service_agent",
  + postCommitEffect: expect.any(Function),
  ```
  Aplikované na 3 miesta: trim instructions test, write-enabled test, 429 throttle test
- **Verifikácia:** `pnpm --filter @openpims/web test app/api/v1/agent/route.test.ts` → 15 passed, full suite → 5206 passed

### BH-001 — vitest config chýba NODE_ENV=test (Medium → Fixed)
- **ID:** BH-001 (z artifacts/bug-hunt-2026-09-14.md)
- **Súbor:** `apps/web/vitest.config.ts:L1-L14`
- **Dôkaz:** `npx vitest run` bez NODE_ENV spôsobí 33 failures v data-import testoch kvôli `legacyImportCompatibilityOpen()` checku na `process.env.NODE_ENV === "test"` a expired cutoff 2026-08-15
- **Oprava:** Pridané `env: { NODE_ENV: "test" }` do `test` bloku configu
- **Verifikácia:** Raw `pnpm --filter @openpims/web test` teraz konzistentne PASS bez externého `cross-env`

### Pozorovanie (nie bug) — tsc OOM bez heap flag
- `pnpm --filter @openpims/web type-check` padá s `FATAL ERROR: Ineffective mark-compacts near heap limit` pri default 2GB heap
- S `NODE_OPTIONS=--max-old-space-size=4096` PASS
- **Odporúčanie:** Pridať `NODE_OPTIONS` do `package.json` scriptu `type-check` alebo do CI env

### Pozorovanie — Marketing brand-kit a admin/support nie v navigácii
- `/marketing/brand-kit/page.tsx` a `/admin/support/page.tsx` existujú ako standalone stránky, ale nie sú v `customNavItems` (zámerne odstránené per IA audit)
- Brand-kit je linkovaný z `_marketing-studio.tsx`, support je admin nástroj
- **Stav:** Nie je bug, je to zamýšľané čistenie (Správa & Manažment má presne 3 položky)

---

## 4. Potvrdenie klinickej bezpečnosti (Clinical Sign-off)

**Výslovne potvrdzujem, že legislatívne pravidlá SR a fail-safe mechanizmy preskripcie sú neporušené:**

1. **Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti & EÚ 2019/6:**
   - Ochranné lehoty pre potravinové zvieratá vynucujú minimá mäso 28d / mlieko 7d / vajcia 7d pri kaskáde, plus ŠÚKL SPC minimá pre známe liečivá
   - Companion zvieratá (pes, mačka) sú korektne vyňaté bez falošných chýb
   - Časová hranica `23:59:59.999` je implementovaná v `calculateStatutoryWithdrawal`

2. **Zákon č. 362/2011 Z. z. o liekoch:**
   - `create_prescription` je obmedzená na `["veterinarian","admin"]` + UUID validácia aktora (defense-in-depth proti `apikey:` prefixu)
   - `service_agent`, `front_desk`, `technician`, `viewer` sú striktne BLOCKED (FORBIDDEN) pre preskripciu a OPL register
   - `get_controlled_substances_log` rovnako restricted

3. **Fail-Safe Drug Checker:**
   - `check_drug_safety` pri neznámom liečive vracia `safe:false`, `evaluationStatus:"unknown_not_evaluated"`, `severity:"unknown"` s explicitným warningom o obmedzenom pokrytí a nutnosti overiť SPC/Plumb's
   - Rozpoznané toxicity: paracetamol/permethrin/aspirin u mačiek, ibuprofen/naproxen u psov/mačiek, NSAID+corticosteroid, dual NSAID, tramadol+MAOI/SSRI/TCA, aminoglycoside+loop diuretic, fluoroquinolone u juvenilných zvierat

4. **Audit Ledger & GDPR:**
   - Marketing AI generovanie (`marketing_content`, `marketing_media`) zapisuje SHA-256 hash reťaz s `previousEventHash` a `sequenceNumber` pod advisory lockom
   - Role boundaries: front_desk povolený pre marketing, BLOCKED pre clinical entity (soap_note, prescription, discharge_report, imaging_analysis)
   - Sympathy Gate: `patient.status === "deceased"` → suppression `deceased_patient`, marketing/SMS blokované
   - Consent Gate: SMS/email marketing vyžaduje opt-in, inak `opt_out` suppression

5. **Event Bus Idempotencia:**
   - At-least-once delivery nespôsobí duplicitu vďaka unique indexom `emissionUq`, `enrollmentUq`, `stepUq` a `onConflictDoNothing`

**Záver:** Klinické, preskripčné a legislatívne operácie zlyhávajú bezpečne (fail-closed) pri neúplnom kontexte, chýbajúcej autorizácii alebo neznámom lieku. Žiadny AI tool nemôže vydať nekontrolovaný recept alebo označiť neznámu látku za bezpečnú.

---

## 5. Bilancia navigácie (Admin rola) — Finálny overený stav

| Sekcia | Konečný stav | Kánonické trasy |
|---|:---:|---|
| Prehľad | 1 | `/` |
| Klinika & Pacienti | 7 | `/patients`, `/records`, `/encounters`, `/lab-results`, `/care-reminders`, `/recalls`, `/agent/voice` |
| Recepcia & Tok | 5 | `/schedule`, `/waiting-room`, `/whiteboard`, `/clients`, `/inbox` |
| Preventívna starostlivosť | 2 | `/vaccinations`, `/wellness` |
| Lekáreň & Sklad | 2 | `/inventory`, `/controlled-substances` |
| Účtovníctvo & Predpisy | 4 | `/billing`, `/statutory`, `/reports`, `/billing/ekasa` |
| Marketing & Komunikácia | 8 | `/marketing`, `/reviews`, `/handouts`, `/marketing/messages`, `/marketing/website`, `/marketing/automations`, `/marketing/consents`, `/marketing/media` |
| Správa & Manažment | 3 | `/admin`, `/settings`, `/agent` |
| **Spolu** | **32** | **Čistá redukcia o >27 % z pôvodných ~44** |

---

## 6. Nadväzujúce odporúčania (Run 3 / Dokumentácia)

1. **Dokumentácia v `docs/`:** Synchronizovať príručky s novou terminológiou ("Klinická karta", "Kampane & SMS", integrované vyšetrenie)
2. **Screenshot Pipeline:** Využiť skill `make-screenshot` na pregenerovanie 1920x1080 snímok bočnej navigácie a vyšetrenia pre Outline Wiki
3. **CI hardening:** Pridať `NODE_OPTIONS=--max-old-space-size=4096` do `type-check` scriptu, explicitne nastaviť `NODE_ENV=test` v CI pre vitest (už fixnuté v configu)
4. **Rate limit monitoring:** Pridať alerting na `X-RateLimit-*` hlavičky pre marketing AI (429 handling v UI)
5. **E2E Playwright:** Doplniť E2E testy pre encounter → discharge/imaging deep-linking s reálnym patientId

---

## 7. Prílohy — Dôkazy

- `pnpm --filter @openpims/web test` — 517 passed, 5206 tests
- `pnpm --filter @openpims/web test config/__tests__/custom-nav-i18n.test.ts` — 3 passed
- `pnpm --filter @openpims/web test lib/agent/__tests__/agent-auth-e2e.test.ts` — 17 passed
- `pnpm --filter @openpims/web test lib/agent/__tests__/tools.test.ts` — 61 passed
- `pnpm --filter @openpims/web test lib/statutory/__tests__/withdrawal-floor.test.ts` — 12 passed
- `pnpm --filter @openpims/web test lib/ai/__tests__/marketing-audit.test.ts` — 12 passed
- `pnpm --filter @openpims/web test app/api/v1/agent/route.test.ts` — 15 passed
- `node i18n symmetry` — Symmetry OK
- `tsc --noEmit` s 4GB heap — Exit 0

Všetky plánované úlohy Fázy 4, konsolidácie navigácie a F1–F10 remediácie sú kompletne zosúladené s aktuálnym stavom codebase.
