# Začíname s OpenVPM

Vitajte v OpenVPM — otvorenom systéme pre správu veterinárnej praxe. Tento
sprievodca vás prevedie prvým prihlásením, nastavením praxe a prehľadom
prístupových práv.

Každý návod tu nájdete aj priamo v aplikácii s vašimi vlastnými dátami: otvorte
**Nastavenia** a kliknite na **Sprievodcovia**.

---

## Prvé prihlásenie

Prejdite na URL adresu vašej praxe a prihláste sa e-mailom a heslom. Na
**OpenVPM Cloud** je pred prvým prihlásením potrebné overiť e-mailovú adresu.
Ak sa po registrácii zobrazí výzva na overenie, skontrolujte doručenú poštu a
kliknite na overovací odkaz — potom sa vráťte na prihlasovaciu stránku.

---

## Vytvorenie účtu praxe

Počas registrácie (`/register`) zadáte názov praxe, časové pásmo a e-mail
administrátora. Po vytvorení účtu sa automaticky pridajú vzorové dáta — niekoľko
demo klientov, zvierat a termínov — aby ste si mohli aplikáciu vyskúšať hneď.

Keď budete pripravení pracovať s reálnymi dátami, vzorové dáta odstráňte
cez **Nastavenia → Dáta → Odstrániť vzorové dáta**.

---

## Pozývanie členov tímu

Prejdite do **Nastavenia → Používatelia**. Kliknite na **Pozvať**. Zadajte
e-mailovú adresu člena tímu a vyberte jeho rolu. Pozvánka sa automaticky
odošle e-mailom; pozvaný si nastaví vlastné heslo pri akceptovaní (`/accept-invite`).

---

## Obnovenie hesla

Na prihlasovacej stránke kliknite na **Zabudnuté heslo** (`/forgot-password`).
Zadajte svoju e-mailovú adresu a skontrolujte doručenú poštu. Odkaz vás
presmeruje na `/reset-password`, kde si nastavíte nové heslo. Odkaz na obnovenie
hesla má obmedzenú platnosť.

---

## Overenie e-mailu (len pre hosťovanú verziu)

Na OpenVPM Cloud musí každý nový účet overiť e-mailovú adresu pred
prihlásením. Overovací e-mail sa odošle ihneď po registrácii. Ak ho
nedostanete, skontrolujte priečinok spam alebo kontaktujte
[jurkemik@significa.sk](mailto:jurkemik@significa.sk).

Samohosťovaná inštalácia môže požiadavku na overenie e-mailu vypnúť
v konfigurácii prostredia.

---

## Demo režim

Skúšobné a demo účty začínajú s prednastavenými vzorovými dátami, aby ste
mohli preskúmať všetky funkcie bez dotyku reálnych záznamov. Všetky funkcie —
fakturácia, plánovanie, legislatívny súlad, AI agent — sú v demo režime plne
funkčné.

Keď budete pripravení na ostrú prevádzku, odstráňte vzorové dáta cez
**Nastavenia → Dáta → Odstrániť vzorové dáta**.

---

## Prístup klientského portálu

Klienti si nevytvárajú vlastné účty. Vygenerujete im bezpečný magic link
z ich záznamu (otvorte klienta, kliknite na **Odoslať odkaz na portál**).
Odkaz ich automaticky prihlási a otvorí ich osobný portál na `/portal`.
Platnosť odkazov vyprší po nastaviteľnom čase; nový odkaz môžete kedykoľvek
vygenerovať zo záznamu klienta.

---

## Navigácia v systéme

Bočný navigačný panel bol konsolidovaný na ~32 kľúčových položiek rozdelených do 7 prehľadných sekcií podľa denného toku ambulancie:

- **Klinická karta:** Pacienti (`/patients`), Záznamy SOAP (`/records`), Vyšetrenia (`/encounters`), Laboratórium (`/lab-results`), Zdravotné pripomienky (`/care-reminders`), Pripomienky (`/recalls`), AI Analýza snímkov (`/agent/imaging`), AI Hlasové diktovanie (`/agent/voice`).
- **Preventívna starostlivosť:** Očkovania (`/vaccinations`) a Wellness plány (`/wellness`).
- **Recepcia & Tok:** Rozvrh (`/schedule`), Čakáreň (`/waiting-room`), Prevádzková tabuľa (`/whiteboard`), Klienti (`/clients`), Pošta & Správy (`/inbox`).
- **Lekáreň & Sklad:** Sklad liečiv (`/inventory`), Omamné látky OPL (`/controlled-substances`).
- **Účtovníctvo & Predpisy:** Fakturácia (`/billing`), e-Kasa doklady (`/billing/ekasa`), Štatutárne registre (`/statutory`), Prehľady (`/reports`), Whiteboard (`/whiteboard`).
- **Kampane & SMS:** Marketingové Štúdio (`/marketing` so 4 záložkami), Recenzie (`/marketing/reviews`), Letáky (`/marketing/handouts`), Správy & SMS (`/marketing/messages`), Web kliniky (`/marketing/website`), Automatizácie (`/marketing/automations`), Skripty recepcie (`/marketing/consents`), Knižnica médií (`/marketing/media`).
- **Správa & Manažment:** Platform Admin (`/admin`), Nastavenia kliniky & Brand Kit (`/settings`), AI Agent (`/agent`), Prepúšťacie správy (`/agent/discharge`).

---

## Rýchly prehľad rolí a oprávnení

| Rola | Popis | Kľúčové obmedzenia |
|---|---|---|
| **Správca praxe** | Plný prístup: nastavenia, fakturácia, auditný záznam, všetky klinické záznamy | Žiadne |
| **Veterinárny lekár** | Plná klinická autorita: SOAP poznámky, predpisy, OPL, zobrazovacie metódy | — |
| **Veterinárny asistent/technik** | Vitálne funkcie, návrhy záznamov, podávanie liekov | Bez prístupu k OPL a predpisom |
| **Recepcia** | Termíny, registrácia klientov, platby, e-Kasa | Bez OPL; bez predpisov |
| **Klient (portál)** | Vlastné zvieratá, termíny, faktúry, správy | Len vlastné záznamy cez capability token |

Oprávnenia sú vynucované na strane servera. Skrytie v UI je len pohodlie,
nie bezpečnostná hranica.

---

## Pokračujte v prieskume

- [Váš denný prehľad](../your-day.md) — rozvrh, tabuľa, príjem
- [Fakturácia a financie](billing-finance.md) — faktúry, platby, e-Kasa
- [Legislatívny súlad](statutory-compliance.md) — KVEPIS, besnota, ochranné lehoty
- [Opýtajte sa AI](../ask-the-ai.md) — pýtajte sa na vaše dáta bežnými slovami
- [Vaše dáta: export, záloha a import](../your-data.md)

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk)
a odpovie vám skutočný človek.
