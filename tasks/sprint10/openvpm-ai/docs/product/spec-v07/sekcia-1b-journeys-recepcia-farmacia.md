# Sekcia 1b — Hĺbková dekompozícia User Journeys: recepcia, farmácia, fakturácia (J7–J12)

> **Rozsah:** toky priamo viazané na cash-flow a právnu platnosť záznamu (tier T1–T2).
> **Čísla úspor:** ledger riadky L06, L07, L16, L22–L27 → [`_generated/financial-model.md`](_generated/financial-model.md).
> **Persóny a emočné mapy:** [`docs/product/journeys/02-recepcia-rozvrh.md`](../journeys/02-recepcia-rozvrh.md),
> [`03-farmaka-faktura.md`](../journeys/03-farmaka-faktura.md).

---

## J7 — Nová návšteva / objednanie termínu (interné + online)

**Tier:** T1 · **Audit:** PASS 200 OK · **Ledger:** L22 · **Use Case:** UC-13, UC-14 · **Business Case:** BC-01, BC-04

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | 2 telefóny, ~60 hovorov/deň; objednávka musí trvať menej než trvá hovor |
| Sekundárny: Majiteľ zvieraťa | klient (verejná rezervácia) | `/portal/book` alebo verejná booking page — vstup **bez autentifikácie** |
| Sekundárny: MVDr. lekár | `veterinarian` | doobjednáva kontrolu priamo z encounteru; `appointments.attachPatient` pri field visit |
| Sekundárny: Admin | `admin` | definuje `appointment_types`, `rooms`, `staff_schedules`, `providerScheduleSetup` |

### 2. Trigger a vstupné predpoklady

**Trigger:** telefonát klienta; online formulár; potreba kontroly po výkone; recall kampaň (J14); waitlist ponuka
uvoľneného slotu; výjazd k hospodárskym zvieratám (`startFieldVisit`).

**Pre-conditions:**
- `practices` aktívna; `locations` aspoň jedna; `staff_schedules` vyplnené pre daný deň; `appointment_types` s
  `durationMinutes` a príznakom `requiresDoctor`; `rooms` s typom (`exam` | `surgery` | `treatment` | `boarding`).
- Pre online: aktívny `booking_pages.slug`, `bookableTypeIds`, povolený `subscriptionTier`/`billingStatus`.
- Pre klienta: existujúci `clients` + `patients` alebo možnosť založiť (J6).

### 3. Scenár krok-za-krokom

**Happy path (interná objednávka)**

| # | Akcia | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia otvorí `/schedule` | Denný/týždenný pohľad podľa lekára a miestnosti; farebné stavy podľa `appointment_status` | Klient chce „čo najskôr“ → krok 2 |
| 2 | Zvolí typ a klikne na slot | `appointments.availableSlots` vráti voľné okná; `detectConflicts` kontroluje lekára, miestnosť a pacienta | Žiadny slot → ponuka waitlistu (E3) |
| 3 | Vyplní pacienta, poznámku, dôvod | `appointments.create` beží **pod zámkom**: `takeAppointmentSchedulingLock(db, practiceId)` → `pg_advisory_xact_lock(hashtext(...))`, potom re-check konfliktov | Konflikt vznikol medzitým (druhá recepcia / online) → `TRPCError CONFLICT` s `conflictMessage` |
| 4 | Potvrdí | Záznam `appointments` so statusom `scheduled`; voliteľne `confirmed` po potvrdení klientom; pri sérii `recurring_series` | Opakovaná návšteva (chronik) → `createRecurring` |
| 5 | Notifikácia | `notifications.sendAppointmentReminder` (SMS/e-mail) cez `consentGateCheck`; fronta `sms_send_attempts`, doručenie `sms_provider_events` | Klient nemá SMS súhlas → e-mail alebo žiadna správa (nie je to chyba) |
| 6 | Kalendár do mobilu | `appointments.calendarFeed` / `enableCalendarFeed` / `rotateCalendarFeed` (iCal/Webcal token) | Token unikol → rotácia bez straty existujúcich udalostí |

**Happy path (online rezervácia)**

| # | Akcia | Reakcia systému |
|---|---|---|
| O1 | Klient otvorí `/portal/book` alebo verejnú booking page | Načítajú sa len `bookableTypeIds`; žiadne zdravotné dáta sa nezobrazujú |
| O2 | Vyplní meno, telefón, e-mail, druh zvieraťa, dôvod | Rate limit per IP (`rate_limit_buckets`), validácia, normalizácia telefónu |
| O3 | `booking.book` (publicProcedure) | Vytvorí klienta (ak neexistuje) + `appointments` pod rovnakým zámkom ako interná objednávka → **žiadna dvojitá rezervácia** |
| O4 | Dostane potvrdenie | Magic link na portál; `portal_sessions`; potvrdenie e-mailom/SMS podľa súhlasu |

**Výnimky**

| # | Situácia | Požadované správanie |
|---|---|---|
| E1 | **Súbežná rezervácia toho istého slotu** (recepcia + online) | Advisory lock serializuje; druhý pokus dostane `CONFLICT` s konkrétnym dôvodom („Dr. Hric má v tom čase Rexa“) a ponukou najbližšieho voľného slotu |
| E2 | **Kolízia miestnosti** (RTG / operačka) | Konflikt podľa `roomId`; ak typ vyžaduje špecifickú miestnosť, systém ju nedovolí prebookovať |
| E3 | **Žiadny voľný termín** | Zápis do `appointment_waitlist` (`waitlist.add`), `waitlist.matchesForSlot` nájde náhradníka pri zrušení. ⚠️ **UI pre waitlist dnes neexistuje** — router je hotový, jediný odkaz je v `components/waiting-room/waiting-room-tv.tsx`. Napojenie na `/schedule` je najlacnejšia výhra v0.7 (ROADMAP: „Čakáreň na uvoľnený termín“) |
| E4 | **Urgentný walk-in mimo rozvrhu** | Dnes: `appointments.create` s poznámkou; **cieľ v0.7:** `/triage` s triážnou prioritou (JG-C04) |
| E5 | **Výjazd k hospodárskym zvieratám** | `appointments.startFieldVisit` pod samostatným zámkom `field-visit:{practiceId}:{patientId}`; `appointment_origin='field'`; CEHZ validácia kódu farmy |
| E6 | **Klient zrušil a chce iný termín** | `appointments.reschedule` (pod zámkom) s históriou zmien; automatická notifikácia; pri 3. zrušení → príznak pre recepciu |
| E7 | **Rekurzívna séria** | `createRecurring` / `cancelRecurringSeries` — zrušenie série nesmie zrušiť už vykonané návštevy |
| E8 | **Online vstup s útokom (enumerácia, spam)** | Rate limit, CAPTCHA-like throttling, odpoveď nesmie odhaliť, či telefón existuje v databáze |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/schedule`, `/waiting-room`, `/portal/book`, `/settings` (typy, miestnosti, rozvrhy), `/api/calendar/[token]` |
| Komponenty | `components/schedule/*`, `components/booking/*`, `components/settings/*` |
| Modaly | nový termín, presun termínu (s dôvodom), zrušenie série, waitlist zápis (`NÁVRH` UI), konflikt hláška |
| Skratky | F1/Cmd+K → „nový termín“ ako sekundárna akcia v palete; návrh v0.7: `N` = nový termín v `/schedule` (`NÁVRH`) |
| Roadmapa v0.7 | drag-to-reschedule myšou + automatická SMS (ROADMAP) |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `appointments.list/listByPatient/getById/create/reschedule/updateStatus/attachPatient/delete/createRecurring/cancelRecurringSeries/availableSlots/listTypes/listDoctors/listRooms/listLocations/calendarSettings/calendarFeed/enableCalendarFeed/rotateCalendarFeed/startFieldVisit`, `booking.book`, `waitlist.list/add/setStatus/current/next/matchesForSlot`, `notifications.sendAppointmentReminder` |
| Drizzle | `appointments` (`appointment_status`: scheduled/confirmed/checked_in/in_exam/checked_out/no_show/cancelled; `appointment_origin`: scheduled/field), `appointment_types`, `rooms` (`room_type`: exam/surgery/treatment/boarding), `staff_schedules`, `recurring_series`, `appointment_waitlist`, `booking_pages`, `locations`, `clients`, `patients` |
| **Zámky** | `takeAppointmentSchedulingLock(db, practiceId)` → `pg_advisory_xact_lock(hashtext(appointmentSchedulingLockKey))` — používa sa v `create`, `reschedule`, `updateStatus`, `startFieldVisit` (`appointments.ts:789, 873, 1049, 1646, 1894, 2182`); field-visit lock `field-visit:{practiceId}:{patientId}` |
| Konflikty | `lib/scheduling/conflicts.ts` — `overlaps`, `detectConflicts`, `hasConflict`, `conflictMessage`; dvojfázovo: časový pre-filter v SQL + presná kontrola pod zámkom |
| Idempotencia | online rezervácia: `idempotencyKey`/fingerprint per formulár, aby refresh stránky nevytvoril dva termíny |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR:** verejný formulár zbiera minimum (meno, kontakt, dôvod); dôvod rezervácie nie je zdravotný záznam, kým ho lekár nezapíše do SOAP.
- **Zákon 452/2021 Z. z.:** potvrdzujúca a pripomienková SMS je transakčná, marketing nie — `consentGateCheck` rozlišuje `vaccination_reminder` vs `marketing_sms`.
- **RLS:** `appointments` s `practiceId` z session; online `booking.book` zapisuje do praxe podľa `booking_pages.slug`, nie podľa vstupu.
- **RBAC:** `viewer` nemôže vytvárať ani meniť termíny (globálny mutation guard).
- **Zákon 39/2007 Z. z.:** pri výjazdoch (field visit) musí existovať záznam o poskytnutí starostlivosti rovnako ako na ambulancii.

### 7. Merateľná úspora času (ledger **L22**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Telefonická objednávka (hľadanie voľna v papierovom denníku, kontrola kolízií, zápis, SMS) | 4,50 min | 2,50 min | −2,00 min × 700/mes. = model 23,3 h → **real 12,8 h/mes. = 321 €** |
| Online rezervácie | — | ~250/mes. bez zásahu recepcie | presun práce na klienta; **nie je** započítaný ako úspora (započítava sa len telefonická časť) |

### 8. Odkaz → **UC-13**, **UC-14**, čiastočne **UC-16** (triáž), **UC-17** (waitlist)

---

## J8 — Check-in, čakáreň a prevádzková tabuľa (whiteboard SSE)

**Tier:** T2 · **Audit:** PASS 200 OK · **Ledger:** L23, L14 · **Use Case:** UC-15 · **Business Case:** BC-01

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | klient pri okienku; musí vidieť, kto je v akej fáze, bez klikania |
| Sekundárny: Veterinárny asistent | `technician` | posúva stav „pripravený na odber“ → „v ordinácii“; pracuje s tabletom |
| Sekundárny: MVDr. lekár | `veterinarian` | „kto je ďalší“ — pohľad na tabuľu z ordinácie |
| Pasívny: Majitelia v čakárni | klient | TV obrazovka `/tv`, `/marketing/tv` — bez osobných údajov (len mená psov a stav) |

### 2. Trigger a vstupné predpoklady

**Trigger:** príchod klienta do čakárne; presun pacienta medzi fázami; koniec vyšetrenia; no-show po uplynutí času.

**Pre-conditions:** existujúci `appointments` na dnešný deň; `rooms` a `users` (lekári) definovaní;
`whiteboard.settings` (interval, zobrazenie, TV režim); SSE endpoint dostupný (HTTP/1.1+ cez proxy, `runtime = "nodejs"`).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Recepcia otvorí `/waiting-room` alebo `/whiteboard` | `whiteboard.getActive` vráti dnešné návštevy s stavom, lekárom, miestnosťou, časom príchodu a čakacou dobou | Klient nie je v zozname → walk-in zápis (JG-C04) alebo `appointments.create` |
| 2 | Klikne „Check-in“ pri klientovi | `appointments.updateStatus` → `checked_in` (pod `takeAppointmentSchedulingLock`); časová známka `scheduledStateUpdatedAt` | Status už `checked_in` → idempotentne bez chyby |
| 3 | — | Zmena sa **ihneď** prejaví na všetkých obrazovkách: `GET /api/whiteboard/stream` (SSE) pošle event; klient `lib/whiteboard/use-whiteboard-stream.ts` aktualizuje stav; heartbeat `ping` každých 15 s | SSE vypadne (proxy timeout) → fallback na 30-s polling; UI ukáže „živé dáta nedostupné“, nie zamrznutú tabuľu |
| 4 | Asistent volá pacienta dnu | Status `in_exam`; tabuľa presunie kartu do stĺpca lekára; `visit_work_items` začne zbierať výkony | Lekár nie je dostupný → presun na iného lekára s poznámkou |
| 5 | Počas vyšetrenia | Asistent zapisuje `vitals.record` (tablet), odbery, RTG; položky vznikajú ako `visit_work_items` (`unresolved`) pre neskoršie vyúčtovanie (J12) | Chýbajúca položka → pri closeoute `getVisitReconciliation` ju odhalí |
| 6 | Koniec návštevy | Status `checked_out`; prechod do J11/J12 | Klient odchádza bez platenia → `chargeDisposition='accounts_receivable'` |
| 7 | No-show | Po uplynutí tolerancie recepcia označí `no_show`; spustí sa automatizácia `appointment_no_show` (J14/J19) a uvoľní slot pre waitlist | Klient volá do 10 min → zrušenie `no_show` s dôvodom (audit) |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Dve recepcie označia toho istého klienta** | Idempotentná zmena stavu + `scheduledStateUpdatedAt`; posledná zmena vyhrá, ale v audite zostanú obe |
| E2 | **SSE nie je podporované (stará sieť, proxy)** | Automatický fallback na polling; žiadne biele miesto na tabuli |
| E3 | **TV obrazovka v čakárni** | `/tv` a `/marketing/tv` zobrazujú len meno zvieraťa a stav — **žiadne diagnózy, majitelia, ceny** (GDPR minimalizácia) |
| E4 | **Klient prišiel na zlý deň** | Recepcia ho doobjedná alebo zapíše na waitlist; pôvodný termín sa označí `no_show` s dôvodom „prišiel mimo termínu“ |
| E5 | **Preplnená čakáreň (urgent prílev)** | Bez modulu C-04 tabuľa nerozlišuje „urgent“ a „rutinný“ → riziko, že kritický pacient čaká. **Toto je hlavný klinický dôvod pre JG-C04** |
| E6 | **Výpadok prúdu / offline** | Tabuľa je read-only kópia; papierový fallback (tlačiteľný denný rozvrh); po obnovení sa stavy doplnia s označením „doplnené po výpadku“ |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/waiting-room`, `/whiteboard`, `/tv`, `/marketing/tv`, `/encounters/[appointmentId]` |
| Komponenty | `components/waiting-room/waiting-room-tv.tsx`, `components/dashboard/*`, `components/encounters/*` |
| Live transport | `GET /api/whiteboard/stream` (SSE, `force-dynamic`, `runtime="nodejs"`, session check → 401 bez `practiceId`), heartbeat 15 s, `event: connected` / `event: ping` |
| Modaly | dôvod no-show, presun na iného lekára, potvrdiť check-out |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `whiteboard.settings/getActive/updateStatus`, `appointments.updateStatus`, `vitals.record/listByAppointment`, `encounters.getVisitReconciliation/resolveVisitWork` |
| Drizzle | `appointments` (`status`, `scheduledStateUpdatedAt`, `roomId`, `doctorId`), `visit_work_items` (`visit_work_status`: unresolved/charged/no_charge/voided), `vital_signs`, `rooms`, `users` |
| SSE kontrakt | autentifikácia cez NextAuth session na serveri (nie token v URL); `AbortSignal` čistí interval; žiadne PHI v logoch streamu |
| Zámky | `takeAppointmentSchedulingLock` pri zmene stavu, aby check-in dvoch pacientov do tej istej miestnosti nevytvoril kolíziu |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR čl. 5(1)(c):** TV obrazovka je verejný priestor — zobrazuje minimum; mená majiteľov a diagnózy nikdy.
- **Zákon 39/2007 Z. z.:** časová stopa stavov návštevy je podkladom pre knihu ošetrení a pre dokazovanie priebehu.
- **RLS:** SSE endpoint vracia len dáta `practiceId` zo session; 401 pred otvorením streamu.
- **Bezpečnosť:** SSE nesmie byť použiteľný na enumeráciu pacientov (žiadny verejný token v URL).

### 7. Merateľná úspora času (ledger **L23, L14**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L23 Check-in a čakáreň | recepcia | 1,50 min | 1,00 min | 8,1 h | **4,4 h/mes. = 111 €** |
| L14 Vitálne funkcie, odbery, príprava pri pacientovi | technik | 6,00 min | 4,00 min | 23,3 h | **12,8 h/mes. = 359 €** |

**Prevádzkový efekt:** živá tabuľa odstraňuje „kto je ďalší“ telefonáty medzi ordináciou a recepciou
(~15 prerušení/deň). V modeli nie sú samostatne ledgerované — sú obsiahnuté v L23/L25.

### 8. Odkaz → **UC-15**, čiastočne **UC-16** (triáž)

---

## J9 — Zmena, zrušenie a presun termínu + pripomienky

**Tier:** T3 · **Audit:** PASS 200 OK · **Ledger:** L26, L27 · **Use Case:** UC-17 · **Business Case:** BC-04

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | ruší a presúva 8–10 termínov denne; každá zmena = telefonát + SMS |
| Sekundárny: Majiteľ zvieraťa | klient | ruší cez portál/odkaz v SMS; chce vedieť, či dostane nový termín |
| Sekundárny: Admin | `admin` | nastavuje šablóny pripomienok, quiet hours, frekvenčné limity |

### 2. Trigger a vstupné predpoklady

**Trigger:** telefonát klienta; klient klikol na odkaz v SMS; lekár zrušil ordinačný deň (dovolenka, choroba);
systémový cron `/api/cron/reminders` pripravuje dávku pripomienok.

**Pre-conditions:** existujúci `appointments` v budúcnosti; aktívny `messaging_registrations` (SMS provider);
vyplnené šablóny správ; súhlas klienta (`sms_consent_events`) alebo legítimny záujem pre transakčnú správu.

### 3. Scenár krok-za-krokom

**A. Zmena / zrušenie termínu**

| # | Akcia | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia otvorí `/schedule`, nájde termín | Zobrazí detail s históriou zmien | Klient chce len presunúť → krok 2; chce zrušiť → krok 3 |
| 2 | „Presunúť“ → `appointments.reschedule` | Pod `takeAppointmentSchedulingLock`; re-check konfliktov; nová časová známka; automatická notifikácia s novým termínom | Konflikt → `CONFLICT` a ponuka alternatívy |
| 3 | „Zrušiť“ → `appointments.delete` / status `cancelled` | Povinný dôvod (klient, lekár, kapacita); slot sa uvoľní; `waitlist.matchesForSlot` nájde náhradníka | Náhradník existuje → recepcia volá / SMS (dnes manuálne, `NÁVRH` automatizácia v0.7) |
| 4 | Notifikácia | `notifications.sendAppointmentReminder` s upravenou šablónou; `sms_send_attempts` → `sms_provider_events` → `sms_delivery_events` | Zlyhanie doručenia → retry fronta, eskalácia na e-mail; `/api/cron/sms-provider-events` reconciluje |

**B. Pripomienky (recall & reminder)**

| # | Akcia | Reakcia systému |
|---|---|---|
| 5 | Cron `/api/cron/reminders` pripraví dávku | `notifications.getUpcomingReminders` — termíny na ďalší deň, `getOverdueVaccinations` — po splatnosti revakcinácie |
| 6 | — | Pre každú správu beží `consentGateCheck(db, practiceId, clientId, patientId, communicationType)`: súhlas, suppression, quiet hours, frequency cap, **sympathy gate** (`assertPatientNotDeceased`) |
| 7 | Recepcia skontroluje frontu a odošle | `notifications.sendBulkReminders` / `sendVaccinationReminders` s náhľadom (`getVaccinationRecallPreview`) — **človek potvrdí** dávku pred odoslaním |
| 8 | Doručenie a reakcia | Odpoveď klienta (klik na odkaz) → `/portal` alebo spätný telefonát; `ext_sms_delivery_log` a `sms_delivery_event_history` uchovajú dôkaz |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Pacient uhynul medzi plánovaním a odoslaním** | Sympathy gate blokuje správu atomicky; ak už bola vo fronte, `ext_automation_suppression_log` zaznamená `sympathy` dôvod a správa sa **neodošle**; žiadna žiadosť o Google recenziu |
| E2 | **Klient nemá SMS súhlas** | Presmerovanie na e-mail; ak ani ten → žiadna automatická správa, recepcia volá |
| E3 | **Quiet hours (22:00–7:00)** | Správa sa zaradí na najbližší povolený čas, nestratí sa |
| E4 | **Frequency cap** (klient dostal 3 správy za 7 dní) | Ďalšia správa sa potlačí s dôvodom v logu |
| E5 | **Provider vráti `failed`/`undelivered`** | Retry s exponenciálnym oneskorením; po 2 pokusoch eskalácia na recepciu; `sms_provider_event_conflicts` + `sms_provider_event_resolutions` riešia duplicitné webhooky |
| E6 | **Klient chce odhlásiť všetky správy** | `/odhlasenie`, `/email-preferences`, `clients.revokeSms` → `sms_suppressions`/`email_suppressions`; transakčné správy zostávajú (legítimny záujem) |
| E7 | **Hromadné zrušenie dňa (choroba lekára)** | Zrušenie série s hromadnou notifikáciou; systém musí ponúknuť náhradné termíny, nie len „zrušené“ |
| E8 | **Duplicitné odoslanie dávky** | Advisory lock `sms-delivery:{provider}:{messageId}` + `sms-delivery-event:{evidenceId}` — jedna správa = jeden záznam |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/schedule`, `/recalls`, `/care-reminders`, `/marketing/messages`, `/marketing/suppression`, `/inbox`, `/odhlasenie`, `/email-preferences` |
| Komponenty | `components/schedule/*`, `components/communications/message-logs-view.tsx`, `components/automations/client-automations-view.tsx`, `components/settings/messaging-*` |
| Modaly | dôvod zrušenia, náhľad dávky pred odoslaním (povinný), detail nedoručenej správy |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `appointments.reschedule/delete/cancelRecurringSeries`, `notifications.getUpcomingReminders/sendBulkReminders/sendAppointmentReminder/getOverdueVaccinations/getVaccinationRecallPreview/sendVaccinationReminders`, `waitlist.matchesForSlot`, `careReminders.list/create/sendOutreach/setCompleted/setDismissed`, `extensions.automationSuppression.*`, `clients.revokeSms` |
| Drizzle | `appointments`, `appointment_waitlist`, `sms_send_attempts`, `sms_send_attempt_events`, `sms_provider_events`, `sms_delivery_events`, `sms_delivery_event_history`, `sms_provider_event_conflicts`, `sms_suppressions`, `email_suppressions`, `ext_sms_delivery_log`, `ext_automation_suppression_log`, `care_reminders` |
| Zámky | `pg_advisory_xact_lock(hashtextextended('sms-delivery:{provider}:{messageId}',0))`, `'sms:{practiceId}:{e164}'` pre suppression, `'sms-operations-alert'` |
| Crony | `/api/cron/reminders`, `/api/cron/message-queue-drain`, `/api/cron/sms-provider-events`, `/api/cron/sms-operations` |

### 6. Legislatívny a bezpečnostný checkpoint

- **GDPR + Sympathy Gate:** pri úhyne/eutanázii sa **atomicky** zablokuje všetka automatická komunikácia vrátane žiadostí o recenzie (`consent-gate.ts`); dôkaz v `ext_automation_suppression_log`.
- **Zákon 452/2021 Z. z.:** marketingové SMS len so súhlasom; transakčné (termín, faktúra) na základe plnenia zmluvy.
- **Zákon 39/2007 Z. z.:** pripomienka revakcinácie je podpora prevencie, nie zdravotný výkon — nesmie vytvárať dojem diagnózy.
- **Dôkaznosť:** každá odoslaná správa má dôkaz o doručení a o súhlase v čase odoslania (nie „dnes platný súhlas“).

### 7. Merateľná úspora času (ledger **L26, L27**)

| Ledger | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|
| L26 Zmena/zrušenie termínu a notifikácia | 6,00 min × 180/mes. | 3,00 min | 9,0 h | **5,0 h/mes. = 124 €** |
| L27 Pripomienky na ďalší deň (ručné volania → bulk) | 30 min/deň × 21,5 | 10 min/deň | 7,2 h | **3,9 h/mes. = 99 €** |

**Výnosový efekt (nie čas):** páka **R1** — no-show 12 % → 6 % = 66 uvoľnených termínov/mes.,
z toho 70 % obsadených = 46 návštev × 58,36 € = 2 696 €; po atribúcii systému 60 % = **1 618 €/mes.** (BC-04).

### 8. Odkaz → **UC-17**, čiastočne **UC-19** (portálové zrušenie)

---

## J10 — Predpis, výdaj lieku a účtovanie liečiva

**Tier:** T2 · **Audit:** PASS 200 OK · **Ledger:** L06, L16 · **Use Case:** UC-20, UC-21, UC-22 · **Business Case:** BC-01, BC-06

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** MVDr. lekár | `veterinarian` | predpisuje a nesie zodpovednosť za dávku; pri OPL zapisuje **ručne** |
| Sekundárny: Veterinárny asistent | `technician` | pripraví a vydá liek, odpíše zo skladu, vybaví účtovanie |
| Sekundárny: Recepcia | `front_desk` | vyúčtovanie a doklad (J11) |
| Blokový: `front_desk` pri OPL | — | do `controlled_substance_log` zapisuje len `admin`/`veterinarian` (+ svedok `technician`/`veterinarian`) |

### 2. Trigger a vstupné predpoklady

**Trigger:** lekár zapíše liek do `plan`; vznik preskripcie na chronickú medikáciu; výdaj lieku priamo na ambulancii;
refill žiadosť od klienta; príjem tovaru na sklad (JX-01).

**Pre-conditions:** aktuálna hmotnosť v `patient_weights`; `products` s `stockQuantity` (alebo `inventoryTracked=false`
pre nelimitované); pri potravinových zvieratách vyplnená ochranná lehota; pri OPL dostupný svedok a trezorová bilancia.

### 3. Scenár krok-za-krokom

**A. Predpis (lekár)**

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár zapisuje liek v SOAP alebo v encounteri | `records.checkPrescriptionSafety` spustí kontrolu pred vytvorením | Alert (J5) → lekár rozhodne, pokračuje len s dôvodom |
| 2 | Zvolí liek | Autocomplete z `products` (SKU, cena, skladová dostupnosť, šarža, expirácia) | Liek nie je na sklade → návrh alternatívy alebo objednávka (JX-01) |
| 3 | Zadá dávkovanie | `dosing.calculate` podľa váhy a druhu; kontrola max. dávky a druhovej toxicity | Bez váhy → výpočet odmietnutý |
| 4 | `records.createPrescription` | Záznam do `prescriptions` + `prescription_events` (časová stopa); `external_prescriptions` pre externé recepty | OPL → krok 5 |
| 5 | **OPL vetva** | `isControlledSubstanceName()` (ketamín, fentanyl, buprenorfín, butorfanol, metadón, diazepam, fenobarbital, propofol, morfín): **AI nesmie predvyplniť nič**; lekár zapisuje ručne; pri `administered`/`wasted` je **povinný svedok** (`controlledSubstanceWitnessError`) | Bez svedka → odmietnuté hláškou „Pri podaní / likvidácii omamnej látky je povinný svedok“ |

**B. Výdaj a účtovanie (technik)**

| # | Akcia | Reakcia systému |
|---|---|---|
| 6 | Technik pripraví liek | Otvorí preskripciu z karty pacienta alebo z `visit_work_items`; vyberie šaržu |
| 7 | Potvrdí výdaj | `inventory.adjustStock` (odpis zo skladu so šaržou a expiráciou) + vznikne riadok v `dispense_charge_queue` so `status=pending`, `unitPriceSnapshot`, `descriptionSnapshot`, väzbou na `prescriptionEventId` |
| 8 | Recepcia vyúčtuje | `billing.listDispenseChargeQueue` → `createDispenseChargeInvoice` (položka na faktúre), alebo `waiveDispenseCharge` (s dôvodom), alebo `reopenDispenseCharge` (ak bola chyba) |
| 9 | Refill | `records.recordPrescriptionRefill`; `completePrescription` / `cancelPrescription` uzatvárajú cyklus; cron `/api/cron/prescription-expiry` upozorní na expirujúce preskripcie |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Liek vydaný, ale nevyúčtovaný** | `dispense_charge_queue` zostáva `pending`; pri closeoute (J12) `getVisitReconciliation` zobrazí nevyriešené položky a **blokuje** dokončenie, kým nie sú `charged`/`no_charge`/`voided` |
| E2 | **Chybný odpis zo skladu** | Korekcia cez `inventory.adjustStock` s dôvodom; pôvodný pohyb sa nemaže (audit stopa) |
| E3 | **Expirovaná šarža** | Výdaj odmietnutý; šarža sa presunie na likvidáciu; pri OPL likvidácia so svedkom (`wasted`) |
| E4 | **Negatívny stav skladu** | `importTrackingCheck`/`inventoryTrackingCheck` obmedzenia; systém varuje, ale nezablokuje klinický výdaj (pacient má prednosť) — vznikne „záporný stav“ s vlajkou na inventúru |
| E5 | **Agent s právom `agent:write` chce vytvoriť preskripciu OPL** | ⚠️ známe riziko (audit F-18-1 / R-10): `agent.run` s nástrojom `create_prescription` obchádza screening. **Pred vydaním opravy:** scope `agent:write` nesmie byť povolený na preskripcie kontrolovaných látok; UC-20 AC-7 to vyžaduje ako hard block |
| E6 | **Klient chce liek bez predpisu** | Odmietnuť; `external_prescriptions` pre prípady, keď predpis vystavil iný lekár (s evidenciou zdroja) |
| E7 | **Potravinové zviera** | Pred výdajom kontrola `ext_withdrawal_periods`; lekár musí určiť ochrannú lehotu mäsa/mlieka |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/patients/[id]`, `/encounters/[appointmentId]`, `/controlled-substances`, `/inventory`, `/billing` |
| Komponenty | `components/clinical/*`, `components/inventory/*`, `components/billing/*`, OPL formulár s povinným svedkom |
| Modaly | dávkovacia kalkulačka, výber šarže, **OPL protokol** (ručné polia, svedok, dôvod znehodnotenia), waiver dispense poplatku |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `records.createPrescription/checkPrescriptionSafety/listPrescriptions/listPrescriptionEvents/recordPrescriptionRefill/completePrescription/cancelPrescription`, `dosing.calculate/formulary`, `inventory.adjustStock/list/startTracking`, `controlledSubstances.settings/listWitnesses/list/create/summary`, `billing.listDispenseChargeQueue/createDispenseChargeInvoice/waiveDispenseCharge/reopenDispenseCharge`, `extensions.wholesalerImport.*` |
| Drizzle | `prescriptions`, `prescription_events`, `external_prescriptions`, `external_prescription_fills`, `products` (`lotNumber`, `expirationDate`, `stockQuantity`, `reorderPoint`), `dispense_charge_queue` (`status`, `unitPriceSnapshot`, `invoiceItemId`, `resolutionReason`, `sourceUq`), `controlled_substance_log` (`action`, `quantity`, `lotNumber`, `witnessedBy`) |
| Biznis pravidlá v kóde | `lib/controlled-substances/policy.ts`: `CONTROLLED_SUBSTANCES_REGEX`, `controlledSubstanceWitnessError()`, `computeControlledSubstanceBalance()` (prijaté − podané − zlikvidované + vrátené, nikdy < 0), limity dĺžok a `CONTROLLED_SUBSTANCE_QUANTITY_PATTERN` |
| Invarianty | `dispense_charge_queue.sourceUq` — jeden preskripčný event = jeden riadok fronty (žiadne dvojité účtovanie); `invoiceItemUq` — jedna položka faktúry |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 139/1998 Z. z.:** kniha opiátov — každý pohyb (received/administered/wasted/returned), množstvo s presnosťou 0,001, šarža, svedok pri podaní a znehodnotení, trezorová bilancia.
- **EÚ 2019/6:** predpisovanie a výdaj veterinárnych liečiv, kaskádové pravidlá, ochranné lehoty.
- **Zákon 39/2007 Z. z.:** evidencia poskytnutej starostlivosti vrátane podaných liečiv.
- **HITL / zero prefill:** `ClinicalDiffConfirmModal` blokuje polia s kontrolovanou látkou; AI extrakcia z diktátu označí položku `requiresManualNarcoticProtocol` (`lib/voice/treatment-extractor.ts:20–46`).
- **RLS:** `tenant_isolation` na `prescriptions`, `controlled_substance_log`, `dispense_charge_queue`.

### 7. Merateľná úspora času (ledger **L06, L16**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L06 Predpis a safety check | lekár | 1,50 min × 500/mes. | 0,50 min | 8,3 h | **4,6 h/mes. = 160 €** |
| L16 Výdaj lieku a účtovanie (dispense → charge queue) | technik | 3,00 min × 500/mes. | 1,00 min | 16,7 h | **9,2 h/mes. = 257 €** |

**Efekt proti stratám:** automatická väzba výdaj → položka na faktúre odstraňuje „zabudnuté“ liečivá.
Pri 500 výdajoch/mes. a chybovosti 4 % (20 položiek × priemer 9 €) ide o **~180 €/mes.** — v modeli
sa **neuvádza ako cash**, pretože sa čiastočne prekrýva s R5 a s BC-09 (uzávierka); slúži ako kvalitatívny argument.

### 8. Odkaz → **UC-20**, **UC-21**, **UC-22**, čiastočne **UC-23**

---

## J11 — Faktúra, platba a e-Kasa doklad

**Tier:** T2 · **Audit:** PASS 200 OK · **Ledger:** L24 · **Use Case:** UC-27, UC-28, UC-29 · **Business Case:** BC-01, BC-06, BC-09

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** Recepcia | `front_desk` | klient pri okienku čaká na doklad; fronta za ním |
| Sekundárny: Admin / konateľ | `admin` | denná uzávierka, export pre účtovníka, storno, reklamácie |
| Sekundárny: Majiteľ zvieraťa | klient | platí kartou v portáli (Stripe) alebo na mieste; chce doklad e-mailom |

### 2. Trigger a vstupné predpoklady

**Trigger:** ukončená návšteva (J12); predaj produktu bez služby; cyklická fakturácia wellness (`/api/cron/wellness-billing`);
oprava faktúry; reklamácia platby.

**Pre-conditions:**
- `services` a `products` s cenami a DPH (`taxable`); `ekasa_config` vyplnená (DIČ, IČ DPH, `pokladnicaId`,
  `pokladnicaType` ORP/VRP/CLOUD, certifikát, `offlineModeEnabled`, `cashlessEnabled`).
- Pre kartové platby: `practice_payment_accounts` (Stripe onboarding) — `billing.paymentAccountStatus`.
- Všetky `visit_work_items` a `dispense_charge_queue` položky návštevy sú `resolved` (inak closeout blokuje).

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Recepcia otvorí `/billing/new` (alebo POS `/billing/pos`) | Zoznam klientov (`billing.patientsByClient`), katalóg služieb (`billing.listServices`) a produktov (`listProducts`), šablóny (`templates.applyToInvoice`) | Rýchly predaj bez návštevy → POS |
| 2 | Zostaví faktúru | `billing.createInvoice` s `invoice_items` (množstvo, cena, DPH); možnosť odhadu (`isEstimate`) pred zákrokom | Odhad → po zákroku `convertEstimateToInvoice` |
| 3 | Uplatní úpravu | `billing.applyInvoiceAdjustment` (zľava, oprava) s dôvodom; `invoice_adjustments` uchová stopu | Zmena po odoslaní → len cez úpravu, nie editáciu položiek |
| 4 | Prijme platbu | `billing.recordPayment` (CASH/CARD/TRANSFER); `payments` s väzbou na faktúru; `createCardPaymentCheckout` + `cardPaymentStatus` pre Stripe | Čiastočná platba → zostatok `accounts_receivable` |
| 5 | **e-Kasa doklad** | `extensions.ekasa.createReceiptFromPayment` (alebo `createPosSale`): pod zámkom `pg_advisory_xact_lock(hashtext(practiceId \|\| '-ekasa-receipt-' \|\| localDate))` vznikne `ekasa_receipts` s `idempotencyKey`, `receiptNumber`, `vatRate` (5/19/23 % podľa sadzby SR 2025), `taxBreakdown`, `items` | Pokladnica nedostupná → status `OFFLINE_STORED` a fronta |
| 6 | Odoslanie do CHDÚ | FiskalPRO (LAN/REST) alebo VRP2; `uid`, `okp`, `pkp` sa uložia; status `PENDING → SENT → CONFIRMED`; `printReceipt` | Zlyhanie → `FAILED` + `retryCount`, cron `/api/cron/ekasa-retry` |
| 7 | Doručenie klientovi | `notifications.sendInvoiceEmail`; portál `/portal/[token]/invoices` s online úhradou | Klient chce papier → tlač s QR kódom |
| 8 | Storno / oprava | `extensions.ekasa.stornoReceipt` (`receiptType='STORNO'`/`RETURN'`, `originalReceiptId`, `originalUid`, `stornoReason`) — pôvodný doklad zostáva v evidencii | Bez dôvodu → odmietnuté |
| 9 | Denná uzávierka | `extensions.ekasa.performDailyClosure` → `ekasa_daily_closures` (`closureNumber`, `receiptsCount`, `totalAmount`, `cashAmount`, `cardAmount`, `transferAmount`, `vatBreakdown`, `okp`); cron `/api/cron/ekasa-daily-closure` | Chýbajúci doklad v dni → uzávierka varuje, nedovolí „tichý“ deň |
| 10 | Export pre účtovníka | `extensions.ekasa.getAccountantExport`, `reports.revenue`, `financial_closes` | — |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Výpadok internetu počas platby** | `offlineModeEnabled` → doklad `OFFLINE_STORED`, vytlačený s označením, retry fronta; po obnove `retryReceipt`; klient odchádza s dokladom, nie s dlhom |
| E2 | **Duplicitné odoslanie dokladu** | `idempotencyKey` + advisory lock per practice-day → druhý pokus vráti existujúci doklad, nie nový |
| E3 | **Chybná sadzba DPH** | `ekasa_vat_rate` enum s hodnotami pre 2025 (5 % lieky, 19 % vybrané položky, 23 % základ); `products.taxable` + `vatRate` na položke; mismatch → validácia odmietne |
| E4 | **Klient nezaplatil a odišiel** | `chargeDisposition='accounts_receivable'`; `billing.arSummary` + `payment_disputes`; upomienky; `invoices.status='overdue'` |
| E5 | **Refundácia** | `billing.refundPayment` → `payment_processor_refunds`; e-Kasa opravný doklad `RETURN`; nesmie nastať stav „vrátené bez dokladu“ |
| E6 | **Karta zlyhala** | `payment_processor_settlements`/`payouts` reconciliácia; recepcia ponúkne prevod alebo hotovosť; `stripe_events` webhook evidence |
| E7 | **Faktúra pre poisťovňu** | položkový export lekárskej správy (Generali/Union) — dnes backend, UI chýba (JG-D06) |
| E8 | **Storno po dennej uzávierke** | Povolené len cez opravný doklad s `originalUid`; uzávierka sa spätne nemení (nemennosť CHDÚ) |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/billing`, `/billing/new`, `/billing/pos`, `/billing/ekasa`, `/settings/ekasa`, `/reports`, `/portal/[token]/invoices` |
| Komponenty | `components/billing/*`, `components/ekasa/*`, `components/accounting/*` |
| Modaly | platba (výber metódy, čiastková platba), storno s dôvodom, denná uzávierka (súhrn + potvrdenie), nastavenie pokladnice |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `billing.getTaxConfig/paymentAccountStatus/createPaymentAccountOnboarding/openPaymentAccountDashboard/createInvoice/updateInvoiceItems/getInvoice/listInvoices/updateInvoiceStatus/recordPayment/listPayments/refundPayment/applyInvoiceAdjustment/listAdjustments/voidInvoice/convertEstimateToInvoice/arSummary/createCardPaymentCheckout/cardPaymentStatus/listServices/listProducts/patientsByClient`, `templates.applyToInvoice`, `extensions.ekasa.getConfig/updateConfig/getReceipts/createReceipt/createReceiptFromPayment/createPosSale/retryReceipt/stornoReceipt/printReceipt/getReceiptForPayment/getDailyClosureSummary/performDailyClosure/getDailyClosures/getAccountantExport`, `reports.revenue/legacyFinancialSummary` |
| Drizzle | `invoices`, `invoice_items`, `invoice_adjustments`, `payments`, `payment_disputes`, `payment_processor_refunds/settlements/payouts`, `practice_payment_accounts`, `stripe_events`, `ekasa_config`, `ekasa_receipts`, `ekasa_daily_closures`, `financial_closes`, `services`, `products`, `legacy_financial_*` |
| Zámky a idempotencia | `pg_advisory_xact_lock(hashtext(practiceId \|\| '-ekasa-receipt-' \|\| localDate))` (`lib/ekasa/service.ts:256–258`); `idempotencyKey` unique index na `ekasa_receipts`; `closureDatePracticeUq` na `ekasa_daily_closures` (jedna uzávierka na deň) |
| Crony | `/api/cron/ekasa-retry`, `/api/cron/ekasa-daily-closure`, `/api/cron/wellness-billing`, `/api/cron/billing-lifecycle` |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 289/2008 Z. z. o e-Kase:** doklad z CHDÚ, OKP/PKP, `uid`, denná uzávierka, offline režim s oneskoreným
  odoslaním, storno len opravným dokladom. ⚠️ Driver je implementovaný a otestovaný, **formálna certifikácia
  integrácie s FR SR zatiaľ neprebehla** (`ROADMAP.md`, register dlhu bod 2) — v BC-06 sa benefit uvádza ako
  zníženie rizika, nie ako garantovaná úspora pokút.
- **Zákon o DPH:** sadzby 5 % / 19 % / 23 % (2025) — `ekasa_vat_rate`; rozpis `taxBreakdown` na doklade.
- **GDPR:** faktúra obsahuje osobné údaje — prístup len `front_desk`/`admin`/`veterinarian`; export pre poisťovňu len so súhlasom alebo na základe zmluvy.
- **RLS:** `tenant_isolation` na `invoices`, `payments`, `ekasa_receipts`; uzávierka je per prax per deň.
- **Nemennosť:** uzatvorený deň sa spätne nemení; korekcia výhradne opravným dokladom.

### 7. Merateľná úspora času (ledger **L24**)

| Metrika | Baseline | S OpenVPM AI | Delta |
|---|---|---|---|
| Faktúra + platba + e-Kasa doklad na návštevu | 5,00 min | 3,50 min (položky prichádzajú z `visit_work_items` a `dispense_charge_queue`, doklad vzniká z platby) | −1,50 min × 968/mes. = model 24,2 h → **real 13,3 h/mes. = 333 €** |
| Denná uzávierka | 15 min | < 5 min (cron + súhrn) | zahrnuté v L31 (admin), nie v L24 |

### 8. Odkaz → **UC-27**, **UC-28**, **UC-29**, **UC-30**

---

## J12 — Uzavretie návštevy a odovzdanie klientovi (closeout)

**Tier:** T2 · **Audit:** PASS 200 OK · **Ledger:** L07, L25 · **Use Case:** UC-31, UC-11 · **Business Case:** BC-01, BC-08

### 1. Aktér

| Aktér | Rola | Kontext |
|---|---|---|
| **Primárny:** MVDr. lekár | `veterinarian` | klinická finalizácia: diagnóza, inštrukcie, varovné príznaky, follow-up |
| Sekundárny: Recepcia | `front_desk` | charge disposition, platba, odovzdanie dokumentov klientovi |
| Sekundárny: Veterinárny asistent | `technician` | môže pripraviť prepúšťaciu správu (`requireRole` to umožňuje), ale **nie** klinicky finalizovať |

### 2. Trigger a vstupné predpoklady

**Trigger:** koniec vyšetrenia; koniec hospitalizácie (JG-C02); koniec zákroku (JG-C03); prepustenie z triáže (JG-C04).

**Pre-conditions:**
- `soap_notes` finalizovaný (J3) — bez neho `finalizeClinical` neprejde.
- Všetky `visit_work_items` v stave `charged` / `no_charge` / `voided` (žiadny `unresolved`).
- Všetky `dispense_charge_queue` položky `resolved` (viazané na `invoiceItemId` alebo s `resolutionReason`).
- Pri follow-up `needed`: zadaný `followUpDueDate` a `followUpAssignedTo`.

### 3. Scenár krok-za-krokom

| # | Akcia | Reakcia systému | Rozhodovací point |
|---|---|---|---|
| 1 | Lekár otvorí `/encounters/[appointmentId]` → closeout | `encounters.getCloseout` vráti stav: `visit_closeout_status` (`draft` → `clinical_finalized` → `completed`), chýbajúce položky, `getVisitReconciliation` (výkony vs. faktúra) | Niečo chýba → systém ukáže **čo** a **prečo** blokuje |
| 2 | Doplní `diagnosisSummary`, `dischargeInstructions`, `warningSigns` | `encounters.saveDraft` s `expectedRevision`; voliteľne AI draft cez `extensions.discharge.generate` (deterministický šablónový fallback, ak AI nie je) | Bez inštrukcií → povinný `noInstructionsReason` (nie prázdne pole) |
| 3 | Rozhodne o preskripcii | `prescriptionDisposition`: `prescribed` (s `medicationSnapshot` — immutable snapshot lieku, dávky, frekvencie, inštrukcií) alebo `not_needed` | Predpis vznikol po finalizácii → reopen s dôvodom |
| 4 | Rozhodne o follow-up | `followUpDisposition`: `none` / `needed` / `scheduled`; pri `scheduled` vzniká `followUpAppointmentId`; pri `needed` `followUpDueDate` + `followUpAssignedTo` | `needed` bez priradenia → blokované |
| 5 | **Klinická finalizácia** | `encounters.finalizeClinical` → status `clinical_finalized`, `clinicalFinalizedBy`, `clinicalFinalizedAt`, `clinicalFinalizerName`; pri AI obsahu spotrebuje envelope a appendne `ext_ai_audit_log` | Chyba → rollback celého kroku (atomické) |
| 6 | Prepúšťacia správa pre klienta | `extensions.discharge.prepareConfirmation` → `.save` → `discharge_reports`; voliteľne `.generateSmsAndSchedule` (SMS s odkazom na správu) — pred odoslaním beží sympathy gate | Klient odmietol → `handoffMethod='declined'` s dôvodom |
| 7 | Recepcia dokončí | `chargeDisposition`: `paid` / `accounts_receivable` / `no_charge`; `handoffMethod`: `print` / `verbal` / `declined`; `encounters.completeVisit` → status `completed` | Klient neplatí → AR a upomienky (J11/E4) |
| 8 | Follow-up žije ďalej | `encounters.listPendingFollowUps` → denná fronta pre recepciu; `resolveNeededFollowUp` s `visit_follow_up_resolution` (`scheduled`/`completed`/`not_needed`) | Follow-up po lehote → eskalácia na `care_reminders` |

**Výnimky**

| # | Situácia | Správanie |
|---|---|---|
| E1 | **Nevyúčtovaný výkon** | `visit_work_items.status='unresolved'` → `completeVisit` odmietne; recepcia musí `charged` / `no_charge` / `voided` |
| E2 | **Lekár zistí chybu po finalizácii** | `encounters.reopenClinical` s `reason`, `reopenedAt`, `reopenedBy` — pôvodná finalizácia zostáva v histórii (žiadne tiché prepísanie) |
| E3 | **Pacient zostáva na klinike** | `chargeDisposition` + poznámka; **dnes tu chýba modul hospitalizácie (C-02)** — návšteva sa uzavrie a hospitalizácia žije mimo systému (papier). To je hlavný dôvod, prečo klinika s hospitalizáciou nemôže prejsť na OpenVPM |
| E4 | **Pacient bol presunutý na inú kliniku** | Referalný súhrn cez `discharge_reports` + export dokumentov; `handoffMethod='print'` |
| E5 | **Úhyn počas návštevy** | `patients.status='deceased'` → sympathy gate; `ext_carcass_disposals` (likvidácia kadaveru); žiadna automatická komunikácia (J29) |
| E6 | **Klient odmietol podpísať súhlas s postupom** | `consent_requests` s výsledkom `declined`; lekár rozhodne o alternatíve; stopa v audite (D-04) |
| E7 | **Súbežný closeout dvoma používateľmi** | `expectedRevision` optimistic concurrency → `CONFLICT` s diffom |

### 4. Interakcia s UI

| Prvok | Hodnota |
|---|---|
| Routy | `/encounters/[appointmentId]`, `/encounters`, `/agent/discharge`, `/postop/[id]` (verejná pooperačná inštrukcia), `/portal/[token]/*` |
| Komponenty | `components/encounters/*`, `components/clinical/*`, `components/copilot/clinical-diff-confirm-modal.tsx` (pre AI discharge) |
| Modaly | closeout checklist, dôvod reopen, dôvod `no_charge`/`voided`, potvrdzovací modal prepúšťacej správy |
| Verejné odkazy | `/postop/[id]`, `/api/treatment-plan/[token]`, `/api/sign/[token]` — capability tokeny, nie session |

### 5. Backend a dátový kontrakt

| Vrstva | Kontrakt |
|---|---|
| tRPC | `encounters.getCloseout/saveDraft/finalizeClinical/reopenClinical/completeVisit/getVisitReconciliation/resolveVisitWork/reopenVisitWork/listPendingFollowUps/resolveNeededFollowUp`, `extensions.discharge.generate/prepareConfirmation/save/listByPatient/listRecent/generateSmsAndSchedule`, `billing.listDispenseChargeQueue/waiveDispenseCharge` |
| Drizzle | `visit_closeouts` (status, chargeDisposition, prescriptionDisposition, medicationSnapshot jsonb, followUpDisposition, followUpAppointmentId, followUpDueDate, followUpAssignedTo, warningSigns, noInstructionsReason, handoffMethod, clinicalFinalizedBy/At), `visit_work_items`, `discharge_reports` (+ `discharge_report_status`), `ext_clinician_confirmations`, `ext_ai_audit_log`, `invoices` |
| Invarianty | `visit_closeouts` má unikátny index na appointment; `medicationSnapshot` je **snapshot** (neskoršia zmena preskripcie neprepíše históriu); `uniqueIndex` na `(appointmentId)` v `visit_work_items` pre PII-safe reconciliáciu |
| Atomickosť | finalizácia + audit event + spotreba envelope v **jednej** transakcii; čiastočný stav je nemožný |

### 6. Legislatívny a bezpečnostný checkpoint

- **Zákon 39/2007 Z. z.:** uzavretie návštevy = kompletná dokumentácia o poskytnutej starostlivosti s podpisom
  (`clinicalFinalizedBy`/`At`); `warningSigns` a `dischargeInstructions` sú dôkazom poučenia klienta.
- **Občianske právo / zodpovednosť za škodu:** `handoffMethod='declined'` + dôvod je kľúčový dôkaz pri spore.
- **GDPR:** verejné odkazy (`/postop/[id]`, `/api/sign/[token]`) používajú capability tokeny s obmedzenou platnosťou
  a rozsahom; `consent_receipt_capabilities` eviduje, čo bolo sprístupnené.
- **HITL:** AI-generated discharge text prechádza `prepareConfirmation` → `save`; `resolveAiRecordStatus` určuje, či je výsledok `draft` alebo finalizovaný.
- **Sympathy Gate:** `generateSmsAndSchedule` volá `consentGateCheck` **pred** odoslaním.

### 7. Merateľná úspora času (ledger **L07, L25**)

| Ledger | Rola | Baseline | S OpenVPM AI | Model | **Realizované** |
|---|---|---|---|---|---|
| L07 Closeout: diagnóza, inštrukcie, follow-up | lekár | 2,00 min × 968 | 1,25 min | 12,1 h | **6,7 h/mes. = 233 €** |
| L25 Closeout: charge disposition, follow-up termín | recepcia | 3,00 min × 968 | 2,00 min | 16,1 h | **8,9 h/mes. = 222 €** |

**Kvalitatívny efekt:** 100 % návštev s dokončeným closeout v ten istý deň (cieľ ≥ 98 %) = žiadne
„nevysvetlené“ položky na faktúre a žiadne stratené follow-upy (ktoré sú najčastejším zdrojom
nevrátených pacientov — viď BC-03).

### 8. Odkaz → **UC-31** (closeout), **UC-11** (prepúšťacia správa), čiastočne **UC-27**, **UC-28**
