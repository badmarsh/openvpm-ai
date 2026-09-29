# Skupina 2 — Recepcia & rozvrh (J7–J9)

> **Frekvencia:** T1–T3 (každú hodinu až každý encounter). Rozvrh je „srdcový tep“ kliniky:
> ak je nesprávny, celý deň je nesprávny. **Business Case:** [BC-2](#business-case-recepcia--rozvrh).

---

## J7 — Nová návšteva / objednanie termínu (interné + online)

### Persóna & Kontext

**P3 Zuzana** drží telefón pri uchu a zároveň vidí na obrazovke dnešný rozvrh. Volajúca chce „niečo na budúci týždeň, najlepšie poobede, lebo chodím do práce“. Zuzana musí za 60 sekúnd nájsť slot, ktorý vyhovuje klientovi aj lekárovi, a nesmie spôsobiť dvojitý zápis.
**P5 Katarína** (majiteľka) si o 22:40 objednáva termín online na `/portal/[token]/book` alebo `/book/[slug]` — lebo cez deň sa nedovolá.
**Rozhodovacia realita z kódu:** interné objednávanie ide cez `appointments.*` (mutácie `requireRole("admin","veterinarian","front_desk")`, check-in/out aj `technician`), verejné cez `booking.book` (`publicProcedure` s honeypotom, IP + slug rate limitom a `takeAppointmentSchedulingLock`), portálové cez `portal.requestAppointment` (capability token + rate limity).

### Trigger

- **Externý:** telefónny hovor, klient v čakárni („chcem sa objednať na očkovanie“), online formulár, portál.
- **Interný:** lekár chce naplánovať kontrolu po operácii (J21), recepcia dopĺňa pacienta do voľného slotu (waitlist).
- **Systémový:** recall pripomienka má tlačidlo „objednať“ (J14), čím sa spúšťa objednávkový tok s predvyplneným dôvodom.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí `/schedule` (alebo klikne na voľný slot) | Zobrazí deň/týždeň podľa `staff_schedules`, `rooms`, typov návštev (`appointment_types`); farby podľa lekára a stavu | Ak je deň plný → systém ponúkne najbližšie 3 voľné okná a waitlist |
| 2 | Vyberie deň a čas | Systém overí dostupnosť slotu (typu návštevy, dĺžka, miestnosť, lekár) a zobrazí trvanie | Ak je na ten čas blokácia (napr. operácia) → slot sa nezobrazí ako voľný, ale ako „blokovaný“ s dôvodom |
| 3 | Vyberie klienta a pacienta | `duplicateShield.checkClient` pri novom klientovi; pri existujúcom načíta pacientov, varovania (napr. „pacient má ochrannú lehotu“) | Ak klient neexistuje → prejde do J6 (nový klient/pacient) s návratom do objednávky |
| 4 | Vyberie typ návštevy a dôvod | Dôvod sa uloží (u verejnej rezervácie je to cudzí vstup; systém ho sanitizuje a nikdy nepoužije bez ohraničenia v prompte — F-04-2) | Ak typ návštevy vyžaduje prípravu (napr. „RTG“) → systém pridá inštrukciu pre klienta do potvrdenia |
| 5 | Uloží termín | `takeAppointmentSchedulingLock` (per-practice transakčný zámok) zabráni dvojitému zápisu; systém vytvorí `appointments`, naplánuje pripomienky | Ak zámok zistí konflikt → systém zobrazí existujúci termín namiesto chyby |
| 6 | Skontroluje komunikáciu s klientom | Systém zobrazí stav kanálov: SMS súhlas (`sms_consent_events`), e-mail preferencie, sympathy gate (zosnulý pacient), potlačenia (`sms_suppressions`) | Ak kanál nie je povolený → systém neposiela automatiku a označí „kontaktovať ručne“ |
| 7 | Odošle potvrdenie | SMS/e-mail s dátumom, časom, lekárom a inštrukciou; pri online rezervácii potvrdenie na zadaný kontakt | Ak doručenie zlyhá → úloha na recepciu (nie tichý fail) |
| 8 | (Online cesta) klient odošle formulár | Systém overí honeypot, rate limity, dostupnosť; vytvorí **žiadosť** o termín (nie vždy potvrdený termín, podľa konfigurácie praxe) | Ak prax vyžaduje schválenie → termín je „na potvrdenie“, recepcia ho vidí v queue |
| 9 | Recepcia potvrdí/schváli | Termín sa stane záväzným, klient dostane potvrdenie; pri vzniku konfliktu systém navrhne alternatívy | Ak klient nereaguje do 24 h → systém sa opýta, či slot uvoľniť (waitlist) |

### Alternatívne toky

1. **Dvojitý zápis (dve recepčné, dva kanály naraz).** Rovnaký slot z portálu a z telefónu. Systém musí mať jeden zámok na prax a vrátiť **druhému** používateľovi existujúci termín s menom klienta — nikdy nie druhý záznam na ten istý čas a miestnosť.
2. **Klient omylom odošle formulár dvakrát.** Dnes rôzne rate-limit politiky pre `booking.book` a `portal.requestAppointment` znamenajú, že druhá požiadavka môže skončiť v nešpecifikovanej chybe (audit F-02-1). Správne správanie: systém rozpozná duplicitnú žiadosť (rovnaký klient + pacient + čas) a povie „vaša žiadosť už bola prijatá, potvrdenie posielame na …“.
3. **Zrušenie uvoľní slot, na ktorý čaká niekto z waitlistu.** Systém musí vedieť ponúknuť uvoľnený slot konkrétnym ľuďom z `appointment_waitlist` (dnes je `waitlist.ts` implementovaný, ale automatické oslovenie je v roadmap v0.7 — pri návrhu J9 s ním počítame).
4. **Objednávka z mobilu v terénne (zlý signál).** Formulár musí byť odolný voči opakovanému odoslaniu a nesmie vytvoriť dva termíny pri dvojkliku; ideálne je PWA s offline detekciou.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Hľadanie slotu | tlak a mierna panika | Zuzana má na linke človeka, ktorý čaká |
| Zhoda s klientovým želaním | úľava | „Konečne to sedí“ |
| Konflikt termínu | hnev, hanba pred klientom | Chyba je viditeľná navonok |
| Online objednávka (klient) | **pohodlie a kontrola** | Nezávislosť od ordinačných hodín je pre majiteľa „wow“ moment |
| Neistota „je termín potvrdený?“ | úzkosť | Klient nevie, či má prísť — toto nesmie zostať otvorené |

### Kontextové prepojenia

- **Pred:** J1 (hľadanie), J6 (nový klient), J14 (recall CTA), J-NEW-3 (adopcia).
- **Po:** J8 (check-in), J9 (zmena/zrušenie), J11 (faktúra pri „no-show“ poplatku), J27 (portál).

### AI Touchpointy

- ✅ **Chceme:** AI návrh optimálneho slotu (rešpektuje dĺžku typu návštevy, historické trvanie lekára a prestávky), AI rozpoznanie zámeru v SMS/e-maili od klienta („potrebujem prísť skôr“) → návrh zmeny termínu na schválenie, automatické generovanie inštrukcií pred návštevou podľa typu.
- ⛔ **Nechceme:** AI, ktorá sama potvrdí termín bez pravidiel praxe; AI, ktorá presunie iné termíny (to je zmysel `takeAppointmentSchedulingLock` a ľudského rozhodnutia); AI spracúvajúca voľný text z verejného formulára bez sanitizácie (F-04-2).

---

### Use Case: UC-107

**Názov:** Objednanie termínu (interné, online, portálové) a jeho potvrdenie
**Primárny aktér:** `front_desk` (interné), klient (online/portál); `veterinarian` pri plánovaní kontrol

**Predpoklady:**
- Prax má definované ordinačné hodiny, typy návštev, lekárov a miestnosti (`staff_schedules`, `appointment_types`, `rooms`).
- Pri online ceste je aktívna `booking_page` (`booking_pages`) alebo portálový capability token.
- Pri novom klientovi existuje alebo vzniká záznam (J6).

**Hlavný scenár:**
1. Používateľ vyberie deň/čas alebo klient odošle online žiadosť.
2. Systém overí dostupnosť (lekár, miestnosť, trvanie, blokácie) a platnosť vstupov.
3. Systém vytvorí termín v transakcii so zámkom proti dvojitému zápisu.
4. Systém naplánuje pripomienky a pripraví potvrdenie podľa povolených kanálov.
5. Systém odošle potvrdenie (alebo ho uloží ako úlohu, ak kanál nie je povolený).
6. Recepcia vidí termín v rozvrhu a klient dostane zrozumiteľnú inštrukciu.

**Alternatívne scenáre:**
- **A1 — Kolízia:** systém vráti existujúci termín alebo navrhne najbližšie alternatívy; nevytvára duplicitu.
- **A2 — Waitlist:** pri plnom rozvrhu sa klient zaradí do `appointment_waitlist` s preferenciami; uvoľnený slot sa dá ponúknuť.
- **A3 — Termín vyžaduje schválenie:** online žiadosť zostáva „pending“ a recepcia ju v queue potvrdí alebo odmietne.
- **A4 — Sympathy gate:** pri pacientovi so stavom `deceased` systém automaticky nezaraďuje marketingové/pripomienkové správy.

**Výnimočné scenáre:**
- **E1 — Rate limit / spam z verejného formulára:** systém vráti `TOO_MANY_REQUESTS` a honeypot odpovie **falošným úspechom** (zámer, `booking.ts`), aby neprozradil pravidlo; legitímny klient dostane jasnú inštrukciu zavolať.
- **E2 — Výpadok notifikačného kanála (SMS provider fail):** systém označí potvrdenie ako nedoručené a vytvorí úlohu recepcii; nesmie sa tváriť, že potvrdenie odišlo.
- **E3 — Nevalidný vstup v online formulári (zlý dátum, minulosť, príliš dlhý text):** systém vráti konkrétnu chybu, neuloží čiastočný záznam a nezobrazí interné detaily.
- **E4 — Klient je „bez kontaktu“:** pri chýbajúcom e-maile a SMS súhlase systém umožní vytvoriť termín s poznámkou „kontaktovať ručne“ a zobrazí to v rozvrhu.

**Postconditions:**
- Existuje práve jeden termín pre daného lekára/miestnosť/čas.
- Klient má (alebo máme úlohu odoslať) potvrdenie s inštrukciami.
- Sú naplánované pripomienky v rámci súhlasov a suppression zoznamov.

**Business pravidlá:**
- **GDPR čl. 6/7 + zákon 18/2018:** marketingové a pripomienkové správy len so súhlasom; sympathy gate pre zosnulé pacienty.
- **Zákon 39/2007 Z. z.:** rozsah ordinačných hodín a povinnosť poskytnúť prvú pomoc (urgentné prípady majú prednosť — J22).
- **Zákon 289/2008 Z. z.:** pri „no-show“ poplatku musí byť doklad a pravidlo vopred komunikované klientovi.
- **Produktové:** rozvrh nesmie nikdy obsahovať dvojitú rezerváciu (per-practice zámok).

**Dátové entity:** `appointments` (W), `appointment_types` (R), `appointment_waitlist` (W), `staff_schedules` (R), `rooms` (R), `clients` (R/W), `patients` (R), `booking_pages` (R), `portal_sessions` (R), `communications` (W), `sms_consent_events` (R), `sms_suppressions` (R), `notifications` (W), `audit_log` (W).

**Integrácie:** SMS provider, e-mail provider, portál (capability token), voliteľne Google/Microsoft kalendár (feed — `docs/help/calendar-feed.md`).

---

## J8 — Check-in, čakáreň a whiteboard

### Persóna & Kontext

**P3 Zuzana** odškrtne príchod, **P4 Martin** vidí na tablete, kto čaká, **P1 Peter** vidí, kto je v ordinácii a koho má zavolať. Whiteboard je jediná **zdieľaná pravda** o stave dňa.
**Reality check z kódu:** `whiteboard.getActive` + SSE `/api/whiteboard/stream` (heartbeat 15 s) + polling fallback 30 s; `/waiting-room` je verejná cesta pre TV obrazovku (`middleware.ts`), dáta však chránené session v `whiteboard.getActive`.

### Trigger

- **Externý:** klient vstúpil do čakárne.
- **Interný:** technik potrebuje vedieť poradie; lekár volá pacienta.
- **Systémový:** stav termínu sa zmenil (čaká → v ordinácii → hotovo), notifikácia pre recepciu „čaká na faktúru“.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Recepcia klikne „Check-in“ na termíne | `appointments.*` zmení stav na „čaká“; whiteboard sa aktualizuje (SSE ping/polling) | Ak je termín mimo poradia (urgent) → systém umožní „prioritný“ príznak s dôvodom |
| 2 | Systém zobrazí pacienta na whiteboarde | Karta obsahuje pacienta, majiteľa (s ohľadom na GDPR minimalizáciu na TV), lekára, typ návštevy, čas čakania | Ak je čakanie > 20 min → systém vizuálne zvýrazní (outlier), navrhne informovať klienta |
| 3 | Technik presunie pacienta „do ordinácie“ | Stav sa zmení, časovač začne/ukončí; dáta sa obnovia streamom | Ak je lekár zaneprázdnený inou kartou → systém zobrazí upozornenie „lekár má otvorený encounter“ |
| 4 | Technik doplní vitálne | `vitals.recordVitalSigns` (admin/vet/tech); váha sa prepojí na dávkovanie | Ak vitálne chýbajú a typ návštevy ich vyžaduje → systém zadrží prechod na „hotovo“ |
| 5 | Lekár dokončí encounter | Stav „ready to go home“ / „checked out“; recepcia dostane signál „čaká na faktúru“ | Ak pacient zostáva hospitalizovaný → presun do J20 (dnes neexistuje) |
| 6 | Recepcia prepustí pacienta | Whiteboard sa vyčistí; visita má stav `checked_out` | Ak je účtovanie otvorené → pacient zostáva viditeľný s odznakom „nedoplatok“ |

### Alternatívne toky

1. **Whiteboard „zamrzne“.** SSE dnes posiela iba `connected` a `ping`, takže „live“ je vlastne 15-sekundový heartbeat a pri ticho polootvorenom spojení sa polling vypne (audit F-03-1). Správne správanie: emitovať dátové `update` eventy alebo **nechať polling bežať aj v „live“ režime**. Klinicky: ak tabuľa zamrzne na 10 minút, čakáreň sa zaplní bez toho, aby o tom niekto vedel.
2. **TV v čakárni a GDPR.** Verejná cesta `/waiting-room` je v `PUBLIC_PATH_PREFIXES`. Akékoľvek dáta, ktoré sa tam dostanú, sú verejné pre kohokoľvek v čakárni. Systém musí vedieť zobraziť len krstné meno + druh zvieraťa + stav, nie plné meno majiteľa ani dôvod návštevy (audit to explicitne označuje ako neoverené, F-03-2).
3. **Pacient príde bez termínu.** Systém musí umožniť „walk-in“ check-in (vytvorí encounter bez objednávky) bez rušenia rozvrhu; inak recepcia prepíše termín na nejaký iný a rozvrh sa rozpadne.
4. **Súbeh dvoch zmien na whiteboarde.** Ranná zmena odovzdáva pacientov; systém potrebuje „handoff“ poznámku k pacientovi, ktorá sa pri prechode zmeny zobrazí.

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Check-in | rutina | 42× denne |
| Zaseknutý whiteboard | **panika a nedôvera** | Nikto nevie, kto je na rade |
| Dlhé čakanie pacienta | tlak a hanba | Klient sa pýta recepcie, recepcia nemá odpoveď |
| Handoff zmien | úľava | Informácia sa nestratí |

### Kontextové prepojenia

- **Pred:** J7 (termín), J22 (urgent, ktorý preskočí poradie).
- **Po:** J3 (encounter), J10 (výdaj), J11 (faktúra), J20 (hospitalizácia), J12 (closeout).

### AI Touchpointy

- ✅ **Chceme:** predikcia čakania (na základe histórie typu návštevy a lekára), sumarizácia „čo sa dnes deje“ pre lekára na začiatku zmeny, rozpoznanie rizikových pacientov v čakárni (napr. dýchavičný pacient — urgentný príznak).
- ⛔ **Nechceme:** AI zobrazujúca mená majiteľov na verejnej TV obrazovke; AI, ktorá posúva poradie pacientov bez ľudského rozhodnutia.

---

### Use Case: UC-108

**Názov:** Check-in pacienta, priebeh návštevy a aktualizácia whiteboardu
**Primárny aktér:** `front_desk` (check-in), `technician` a `veterinarian` (priebeh)

**Predpoklady:**
- Existuje dnešný termín alebo je potrebný walk-in.
- Používateľ má rolu s právom na zmenu stavu (`appointments.ts` check-in/out vrátane `technician`).
- Prax má nastavené ordinačné hodiny (`settingsMissing` a `activeAppointmentsMissing` stavy sú v UI riešené).

**Hlavný scenár:**
1. Recepcia nájde termín a vykoná check-in.
2. Systém zmení stav a publikuje stav na whiteboard.
3. Technik zaznamená vitálne a presunie pacienta do ordinácie.
4. Lekár vykoná encounter (J3) a nastaví ďalší stav.
5. Recepcia vidí „čaká na faktúru“ a pacienta prepustí po úhrade alebo s nedoplatkom.
6. Systém uzavrie stav návštevy na whiteboarde a uchová históriu časov (čakanie, trvanie).

**Alternatívne scenáre:**
- **A1 — Walk-in:** systém vytvorí encounter bez termínu a zobrazí ho ako „bez objednávky“.
- **A2 — Urgent:** pacient dostane prioritu s dôvodom; poradie sa zmení a ostatní to vidia (fairness).
- **A3 — Pacient odchádza pred vyšetrením:** systém umožní stav „odosiel z čakárne“ so záznamom a voliteľne bez fakturácie.
- **A4 — Odovzdanie zmeny:** systém umožní poznámku k pacientovi, ktorú vidí nasledujúca zmena.

**Výnimočné scenáre:**
- **E1 — Stream nedostupný / strata spojenia:** systém sa prepne na polling a v UI zobrazí „obnovujem každých 30 s“; nesmie ticha zamrznúť bez indikácie.
- **E2 — Súbežná zmena stavu dvoma používateľmi:** druhý zápis dostane konflikt a UI zobrazí aktuálny stav (posledný vyhráva len po potvrdení).
- **E3 — Pacient so zosnulým stavom v DB (sympathy), ktorý je omylom na TV:** systém nesmie zobrazovať zosnulých pacientov.

**Postconditions:**
- Stav pacienta je jednotný na rozvrhu, whiteboarde aj v encounteri.
- Existuje časová stopa (čakanie, trvanie vyšetrenia) použiteľná pre reporting (J25) a pre komunikáciu s klientom.
- TV obrazovka neobsahuje viac dát, než je nevyhnutné.

**Business pravidlá:**
- **GDPR čl. 5 (minimalizácia):** verejne zobraziteľné údaje musia byť obmedzené na nevyhnutné minimum.
- **Zákon 39/2007 Z. z.:** urgentné prípady majú prednosť pred plánovanými (prvá pomoc).
- **Produktové:** jeden zdroj pravdy o stave pacienta; žiadne duplicitné stavy medzi rozvrhom a whiteboardom.

**Dátové entity:** `appointments` (W — stav, čas check-in/out), `visit_work_items` (W/R), `vital_signs` (W), `patients` (R), `clients` (R), `locations`/`rooms` (R), `communications` (W — informovanie o zdržaní), `audit_log` (W).

**Integrácie:** SSE stream, TV/PWA displej, SMS (informácia o zdržaní), embedded waiting-room TV komponent.

---

## J9 — Zmena, zrušenie a presun termínu + pripomienky

### Persóna & Kontext

**P3 Zuzana** o 8:05 prijíma tri zrušenia naraz (choroba, auto, dieťa). Musí uvoľniť sloty, ponúknuť ich z waitlistu a informovať ľudí, ktorí čakali „na uvoľnenie“.
**P7 Anna** sleduje, koľko termínov sa ruší a prečo — to je jej prevádzkový ukazovateľ.

### Trigger

- **Externý:** klient volá „nemôžem prísť“; klient nepríde bez ohlásenia (no-show).
- **Interný:** lekár je na školení/nemocenský, treba presunúť 14 termínov (rýchlo a bez chaosu).
- **Systémový:** pripomienka 24 h pred termínom (SMS/e-mail) v rámci súhlasov; cron `/api/cron/reminders`.

### Kroky (Step-by-Step)

| # | Akcia používateľa | Reakcia systému | Rozhodovací bod |
|---|---|---|---|
| 1 | Otvorí termín a klikne „Zrušiť/Zmeniť“ | Systém zobrazí dopad (naviazané work items, pripomienky, prípadná faktúra) | Ak je termín už s materiálom/liekom pripravený → systém upozorní (sklad) |
| 2 | Vyberie dôvod zrušenia | Dôvod sa eviduje štruktúrovane (choroba, práca, doprava, financie, iné) — nie ako voľný text | Ak je dôvod „lekár“ → systém navrhne hromadný presun pacientov lekára |
| 3 | Vyberie nový termín | Systém overí dostupnosť a navrhne najbližšie voľné okná pre toho istého lekára (zachovanie kontinuity) | Ak nie je najbližší voľný termín prijateľný → waitlist/priority flag |
| 4 | Odošle zmenu klientovi | SMS/e-mail s pôvodným a novým časom, s jasným CTA (potvrdiť/zmeniť) | Ak klient nereaguje do 12 h → úloha pre recepciu na telefonát |
| 5 | Uvoľnený slot sa má ponúknuť niekomu inému | Systém vyberie kandidátov z `appointment_waitlist` podľa preferencií a pošle ponuku s platnosťou (napr. 30 min) | Ak niekto ponuku prijme → slot sa potvrdí; ak nie → ponuka sa uvoľní ďalšiemu |
| 6 | (No-show) Systém zistí neprítomnosť | Stav „no-show“, čas záznamu, voliteľne poplatok podľa pravidla praxe (s dokladom a komunikáciou vopred) | Ak je klient opakovane no-show → systém varuje pri ďalšej objednávke (nie blokuje automaticky) |
| 7 | Pripomienky 24 h / 2 h pred termínom | Cron vyhodnotí súhlas, suppression, sympathy gate a doručiteľnosť; systém zapíše stav doručenia | Ak doručenie zlyhá → systém eskaluje na SMS alebo na úlohu recepcie |

### Alternatívne toky

1. **Hromadné zrušenie dňa (lekár ochorel).** Systém potrebuje „bulk reschedule“ s navrhnutím nových časov na základe typu návštevy a priority (napr. pooperačná kontrola = vysoká priorita). Bez toho recepcia strávi 2 hodiny telefonátmi a časť pacientov sa stratí.
2. **Klient chce presunúť na skorší termín.** Systém musí umožniť swap dvoch termínov s kontrolou konfliktov a s notifikáciou obom stranám (dnes chýba drag-to-reschedule, plánované v0.7).
3. **Pripomienka je nežiaduca (sympathy, sťažnosť, súdny spor).** Systém rešpektuje `sms_suppressions` a sympathy gate — a to aj na úkor započítania do kampane. Etika je tu dôležitejšia než automatizácia.
4. **Klient potvrdí „prídem“ a nepríde.** Systém musí rozlíšiť „potvrdené“ a „odhadované“ — a no-show u potvrdeného termínu zaevidovať ako rizikový signál (nie ako generický).

### Emočná mapa

| Fáza | Emócia | Prečo |
|---|---|---|
| Zrušenie | **stres a pocit chaosu** | Naraz 3 problémy |
| Hromadný presun | zúfalstvo → úľava | Bez „bulk“ nástroja je to 2 h telefonátov |
| Potvrdenie klienta | úľava | Zníženie neistoty |
| No-show | hnev a frustrácia | Práca naviac, prázdny slot |

### Kontextové prepojenia

- **Pred:** J7 (objednávka), J14 (recall → objednávka).
- **Po:** J11 (no-show poplatok, ak je pravidlom), J25 (analytika no-show a vyťaženia), J27 (klient si sám mení termín na portáli).

### AI Touchpointy

- ✅ **Chceme:** predikcia rizika no-show (na základe histórie klienta), AI generovanie textu pripomienky (krátky, zrozumiteľný, jazykovo správny), AI rozpoznanie odpovede klienta („prídem“ / „posuňte na skôr“ / „ruším“) a návrh akcie, AI návrh hromadného presunu s rešpektovaním priorít.
- ⛔ **Nechceme:** AI, ktorá sama zruší termín (to je zásah do dostupnosti starostlivosti); AI, ktorá posiela pripomienky mimo súhlasov; AI generujúca „vysvetlenie“ za kliniku pri spore o no-show poplatok.

---

### Use Case: UC-109

**Názov:** Zmena, zrušenie a presun termínu vrátane pripomienok a no-show evidencie
**Primárny aktér:** `front_desk`; sekundárne `admin`, `veterinarian`

**Predpoklady:**
- Existuje termín so stavom, ktorý umožňuje zmenu (nie `checked_out` bez pravidla pre storno).
- Klient má evidovaný kontaktný kanál a súhlas pre pripomienky, ak sa majú posielať automaticky.
- Sú nastavené pripomienkové politiky (napr. 24 h / 2 h) a existuje cron `/api/cron/reminders`.

**Hlavný scenár:**
1. Používateľ zvolí termín a akciu `zmeniť` / `zrušiť` / `presunúť`.
2. Systém vyhodnotí dopady (work items, sklad, príprava, pripomienky).
3. Používateľ vyberie nový termín alebo dôvod zrušenia.
4. Systém vykoná zmenu v transakcii a zaeviduje dôvod.
5. Systém odošle klientovi informáciu a naplánuje nové pripomienky.
6. Pri uvoľnenom slote systém ponúkne slot waitlistu (ak je aktivovaný).

**Alternatívne scenáre:**
- **A1 — Hromadný presun:** použitie bulk akcie pre všetkých pacientov daného lekára v danom dni s návrhom nových časov podľa priority typu návštevy.
- **A2 — Swap termínov:** presun s výmenou dvoch slotov vrátane notifikácie obom klientom.
- **A3 — No-show:** evidencia neprítomnosti, voliteľný poplatok, varovanie pri ďalšej objednávke.
- **A4 — Waitlist ponuka:** časovo limitovaná ponuka uvoľneného slotu s automatickým potvrdením pri prijatí.

**Výnimočné scenáre:**
- **E1 — Zmena bez súhlasu na notifikáciu:** systém zmenu vykoná, ale notifikáciu nahradí úlohou pre recepciu a zapíše, že klient nebol informovaný automaticky.
- **E2 — Chyba doručenia pripomienky (provider failure):** systém označí pokus ako zlyhaný a vytvorí fallback úlohu; nesmie tvrdiť, že správa bola doručená.
- **E3 — Klient zmení termín 3× za hodinu (spam):** systém limituje počet zmien v čase a ponúkne telefonát na recepciu.

**Postconditions:**
- Rozvrh neobsahuje konflikt a zmena má dôvod v audite.
- Klient je informovaný alebo existuje úloha na informovanie.
- Uvoľnený čas je buď obsadený z waitlistu, alebo viditeľne voľný.

**Business pravidlá:**
- **GDPR čl. 6/7:** pripomienky a zmeny len v rámci súhlasov; možnosť odhlásenia rešpektovaná (`sms_suppressions`).
- **Sympathy gate:** žiadne automatické správy pre zosnulých pacientov.
- **Zákon 289/2008 Z. z.:** ak klinika účtuje no-show poplatok, musí byť doklad a pravidlo komunikované.
- **Produktové:** presun musí zachovať kontinuitu starostlivosti (ideálne ten istý lekár) a nesmie stratiť klinickú informáciu naviazanú na termín.

**Dátové entity:** `appointments` (W), `appointment_waitlist` (W/R), `patient_merge_events` (nie), `sms_delivery_events` (W), `sms_send_attempts` (W), `care_reminders` (R/W), `communications` (W), `notifications` (W), `invoices` (W pri no-show poplatku), `audit_log` (W).

**Integrácie:** SMS provider (s frontou a retry), e-mail, portál (zmena z klientskej strany), kalendárový feed.

---

## Business Case: Recepcia & rozvrh

### Status Quo

**Typický deň bez OpenVPM AI:** 55–70 telefonátov, z toho polovica na objednávanie a zmenu. Rozvrh v papieri alebo v desktop PIMS s obmedzenými pravidlami. Pripomienky posiela recepcia ručne (alebo ich neposiela vôbec). No-show je „normálna daň“ 8–12 % termínov. Uvoľnené termíny zostávajú nevyužité, pretože nie je komu ich ponúknuť.

**Kvantifikácia bolesti (referenčný model):**
- 42 pacientov/deň, z toho 6–8 % no-show = 2,5–3,4 nevyužité termíny denne.
- Pri priemernom účte 46 € to je **115–156 €/deň** strateného obratu = **2 400–3 300 €/mesiac** (pri 21,5 dňoch: 2 470–3 355 €).
- Recepcia strávi 25–40 minút denne len hľadaním slotov a prepisovaním zmien.

### Kvantifikovaná hodnota

| Položka | Výpočet | Hodnota / rok |
|---|---|---|
| Online objednávanie znižuje telefonickú záťaž | 10 hovorov/deň × 2,5 min × 0,15 € × 252 | 945 € |
| Rýchlejší check-in (digitálny, bez hľadania karty) | 42 × 30 s × 0,15 € × 252 | 794 € |
| Menej telefonátov do ordinácie (whiteboard namiesto „kto je na rade“) | 12 × 45 s × 0,30 € × 252 | 680 € |
| Znížené no-show (automatické pripomienky 24 h / 2 h; konzervatívne 60 % z 3 % zníženia) | 16 termínov/mesiac × 46 € | 8 832 € |
| Vyplnenie uvoľnených slotov z waitlistu | 4 termíny/mesiac × 46 € | 2 208 € |
| **Spolu (konzervatívne)** | | **13 459 €** |

### ROI po tier-och

| Tier | Náklad/rok | Hodnota (škálovaná) | ROI | Payback |
|---|---|---|---|---|
| **Self-hosted** | ~1 200 € | 9 200 € (menšia ambulancia) | 7,7× | 48 dní |
| **Cloud Solo** | 588 € | 8 000 € (1 lekár, 20 pacientov/deň) | 13,6× | 27 dní |
| **Cloud Klinika** | 1 428 € | 13 459 € | 9,4× | 39 dní |
| **Cloud Nemocnica** | 2 748 € | 20 000 € (3 lokality, viac kanálov, viac no-show) | 7,3× | 51 dní |

**Kľúčový insight:** hodnota tu nie je v ušetrenom čase recepcie (to je ~2 400 €/rok), ale v **zachytenom obrate** z no-show a waitlistu (~11 000 €/rok). Preto musí byť automatizácia pripomienok a waitlistu **v každom tiere**, nie ako prémiová funkcia — inak klinika nezažije hodnotu na vlastnej pokladni.

### Competitive Moat

| Schopnosť | Prečo je to moat |
|---|---|
| **Per-practice transakčný zámok proti dvojitej rezervácii** naprieč interným, verejným a portálovým kanálom | Väčšina PIMS má „dostupnosť“ riešenú na úrovni UI; pri súbehu kanálov vytvára duplicity. Tu je to vyriešené v DB |
| **Capability-token portál bez hesla** (magic link, žiadne registrácie) | Klinika nemusí riešiť heslá klientov ani ich onboarding; adopcia portálu je výrazne vyššia |
| **Sympathy gate a consent gate na úrovni SQL segmentácie** | Etická poistka, ktorú konkurencia nemá systematicky; pre kliniku to znamená, že jedna zlá správa nezničí dôveru |
| **Waitlist so štruktúrovanými preferenciami** | Priama väzba na tržby — nie „pekná funkcia“, ale mechanizmus vyplnenia kapacity |

**Kde konkurencia vyhráva:** drag-to-reschedule a vyspelosť kalendárneho UX (Vetfox je cloud-first s jednoduchým rozhraním; desktop riešenia majú roky ladené workflow recepcie). OpenVPM má drag-to-reschedule v roadmap v0.7 — to je najviditeľnejšia medzera pre recepciu.

### Adoption Barriers & Riešenia

| Bariéra | Prejav | Riešenie v designe |
|---|---|---|
| „Klienti budú volať aj tak“ | Recepcia nepropaguje portál | J7 vytvára portálový link automaticky pri zakladaní klienta (J6) a potvrdenie vždy obsahuje link |
| „Nemôžem si dovoliť, aby systém potvrdil termín, ktorý nestíham“ | Strach z eliminácie ľudskej kontroly | Konfigurovateľné: online žiadosť = „na potvrdenie“, alebo priama rezervácia do voľných slotov |
| „Papierový rozvrh vidím celý deň“ | Zvyk vizuálneho prehľadu | Whiteboard + tlačová/zdieľaná verzia rozvrhu; TV režim |
| „Kto zaplatí zmeškané termíny?“ | No-show pravidlá sú politicky citlivé | Systém eviduje no-show a pripomienku, ale rozhodnutie o poplatku necháva na kliniku |
| „Nemáme čas nastavovať všetko“ | Onboarding | J-NEW-1: rozvrh a typy návštev patria medzi prvé 3 nastavenia |

### KPIs

| Metrika | Baseline | Cieľ (3 mesiace) | Meranie |
|---|---|---|---|
| Podiel online/portál objednávok | 0–5 % | ≥ 25 % | pomer `booking.*` + `portal.requestAppointment` k všetkým termínom |
| No-show rate | 8–12 % | < 6 % | `appointments.status = no_show` / všetky termíny |
| Vyplnenie uvoľnených slotov z waitlistu | 0 % | ≥ 30 % | `appointment_waitlist` → konverzia na termín |
| Čas objednania jedného termínu (recepcia) | 2,5–4 min | < 60 s | čas od otvorenia modalu po uloženie |
| Podiel telefonátov na objednávky | 50 % hovorov | < 30 % | log komunikácie + telefonické štatistiky (manuálne) |
| p95 latencia whiteboard refresh | 15–30 s | < 5 s (dátový event) | SSE eventy / polling |
| Churn recepčných (fluktuácia) | vysoká | –20 % | HR údaje kliniky (indikátor zníženia tlaku) |
