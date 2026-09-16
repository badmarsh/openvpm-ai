# Kampane & SMS a komunikácia

Modul **Kampane & SMS** (`/marketing`) riadi automatizovanú komunikáciu s majiteľmi zvierat, spravuje reputáciu vašej kliniky a pomáha vám osloviť správnych klientov v správnom čase pri rešpektovaní prísnych veterinárnych a etických pravidiel.

> **Roly**: Správca praxe má plný prístup. Veterinárni lekári môžu prezerať kampane a schvaľovať klinický obsah. Veterinárni asistenti a Recepcia majú prístup na čítanie a prácu so skriptami.

---

## 1. Marketingové Štúdio (`/marketing`)

Hlavný modul `/marketing` integruje 4 kľúčové pracovné záložky s automatickou synchronizáciou v URL parametri `?tab=...`:

1. **Prehľad & Generátor (`?tab=overview`):**
   - Tvorba príspevkov pre sociálne siete (Facebook, Instagram) pomocou veterinárnej AI.
   - Generovanie vzdelávacích TV slajdov pre obrazovku v čakárni.
   - Multimediálny obsah a tlačové materiály.
2. **Kalendár obsahu (`?tab=calendar`):**
   - Týždenný a mesačný harmonogram tém (prevencia kliešťov, vakcinačné schémy, dentálna hygiena, starostlivosť o seniorov).
   - Export plánu do kalendára.
   - Pôvodná trasa `/marketing/plan` automaticky presmerováva na túto záložku.
3. **Schvaľovací proces (`?tab=queue`):**
   - Kontrolný uzol pre personál kliniky.
   - Všetky AI návrhy obsahujúce klinické tvrdenia (dávkovanie liekov, liečebné postupy, prevencia nákaz) musia byť pred publikovaním autorizované licencovaným veterinárom (Human-in-the-Loop, Zákon 39/2007 Z. z.).
   - Pôvodná trasa `/marketing/content-queue` automaticky presmerováva na túto záložku.
4. **Konkurencia & Intel (`?tab=competitors`):**
   - Trhový monitoring a prehľad aktivít, spektra služieb a reputácie okolitých veterinárnych ambulancií v okrese.
   - Pôvodná trasa `/vet-intel` automaticky presmerováva na túto záložku.

> ℹ️ **Brand Kit**: Nastavenie firemnej identity (logo, farby, typografia) bolo z marketingu konsolidované priamo do **Nastavenia kliniky** (`/settings?tab=brandKit`).

---

## 2. Automatická CRM segmentácia klientov

Systém automaticky klasifikuje databázu do 12 vstavaných CRM segmentov v reálnom čase bez nutnosti manuálnej údržby:

| Segment | Kto je zahrnutý |
|---|---|
| Noví klienti | Zaregistrovaní za posledných 30 dní |
| Aktívni klienti | Návšteva za posledných 6 mesiacov |
| Neaktívni (6 mesiacov) | Žiadna návšteva 6–12 mesiacov |
| Neaktívni (12 mesiacov) | Žiadna návšteva viac ako 12 mesiacov |
| Po operácii | Operácia zaznamenaná za posledných 30 dní |
| Vakcína čoskoro | Termín vakcíny do 14 dní |
| Vakcína po termíne | Termín vakcíny prešiel |
| Seniori | Pacienti starší ako 7 rokov |
| Šteniatka a mačiatka | Pacienti do 1 roka |
| Chronická starostlivosť | Pacienti s chronickými stavmi v zozname problémov |
| Dentálna starostlivosť | Dentálny výkon potrebný alebo označený |
| Vysokohodnotní VIP | Klienti s najvyšším objemom starostlivosti |

---

## 3. Automatizácie & Centrum potlačení (`/marketing/automations`)

Modul automatizácií je rozdelený do 6 špecializovaných záložiek: **Pravidlá** (`rules`), **Cesty** (`journeys`), **Segmenty** (`segments`), **Kanály** (`channels`), **Event Bus** (`events`) a **Potlačenia** (`suppression`).

### Päť vstavaných zákazníckych ciest:

| Cesta | Spúšťač | Správy |
|---|---|---|
| Uvítanie nového klienta | Registrácia nového klienta | Uvítacia správa + žiadosť o spätnú väzbu po 7 dňoch |
| Sledovanie po návšteve | Ukončenie návštevy | Poďakovanie + žiadosť o recenziu po 24 hodinách |
| Upomienka na vakcínu | Blížiaci sa termín vakcíny | Upomienka 14 dní vopred + odpočítavanie 3 dni + oznámenie o meškaní |
| Starostlivosť po operácii | Zaznamenaná operácia | Kontrola stavu po 24 hodinách + uzdravovanie 3. deň + kontrola stehov 10. deň |
| Reaktivácia pacienta | 12 mesiacov od poslednej návštevy | Pripomienka ročnej kontroly |

### ⚠️ Etické poistky a Centrum potlačení (`?tab=suppression`)

Záložka **Potlačenia** (`/marketing/automations?tab=suppression`) poskytuje transparentný auditný prehľad všetkých zablokovaných správ podľa etických a zákonných pravidiel:

1. **Sympathy Gate (Povinná a nevypnuteľná poistka):**
   - Akonáhle lekár v karte pacienta nastaví stav **Uhynutý / Eutanazovaný**, systém **okamžite a trvalo potlačí všetky automatizované správy** (očkovania, predvolania, žiadosti o Google recenzie).
   - Všetky otvorené pripomienky starostlivosti sú zamietnuté s dôvodom: *"Sympathy Gate: Pacient uhynul / bol eutanazovaný."*
   - Pre personál sa automaticky vytvorí interná úloha na osobnú kondolenciu.
   - Každé potlačenie je zapísané v auditnom logu s kódom `deceased_patient`.
2. **Tichý nočný režim (Quiet Hours):**
   - Všetky automatizované SMS a marketingové správy sú v čase medzi **20:00 a 08:00** automaticky pozastavené, aby nerušili klientov.
3. **SMS frekvenčný limit (Frequency Cap):**
   - Maximálne 1 marketingová kampaň za 14 dní na jedného klienta, čo zabraňuje spamu a sťažnostiam.

---

## 4. Skripty recepcie a informované súhlasy (`/marketing/consents`)

Modul na adrese `/marketing/consents` slúži ako komunikačný a právny štandard ambulancie:

- **Telefonické skripty recepcie:** Profesionálne postupy pre uvítacie telefonáty, objednávanie vyšetrení a riešenie námietok majiteľov k cenám zákrokov.
- **Informované súhlasy pred zákrokom:** Tlač a digitálna evidencia informovaných súhlasov pred anestéziou, chirurgickým zákrokom, hospitalizáciou a eutanáziou (Zákon č. 39/2007 Z. z.).
- **GDPR súhlasy & Opt-out:** Evidencia udelených súhlasov a okamžité rešpektovanie odvolania súhlasu klientom.

---

## 5. Správa reputácie a recenzií (`/marketing/reviews`)

- Automatický zber hodnotení na Google Business Profile po úspešných vizitách.
- Sledovanie 24-hodinového SLA na odpoveď na recenzie.
- **Eskalácia nespokojnosti:** Recenzia s hodnotením 2 hviezdičky a menej automaticky vytvorí prioritnú úlohu pre vedenie kliniky na bezodkladné kontaktovanie klienta.

---

## 6. Televízia v čakárni (`/waiting-room` a `/tv`)

Zobrazujte rad čakajúcich, edukačné slajdy z Marketingového štúdia a novinky kliniky na Smart TV v čakárni na adrese `/tv`. Správa slajdov je integrovaná priamo v `/waiting-room`.

---

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk).
