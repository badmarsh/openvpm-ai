# OpenVPM AI — Úloha: Komplexná aktualizácia dokumentácie (Outline Wiki, Lokálne Help súbory, In-App Modal Help)

> **Použitie:** Skopírujte text tohto promptu do novej session agenta s prístupom k repozitáru `openvpm-ai` a k Outline MCP serveru (`outline.dev.significa.sk`), prípadne použite ako riadiaci dokument pre synchronizáciu všetkých 3 vrstiev dokumentácie po konsolidácii informačnej architektúry (IA Consolidation v0.6+).

---

Si hlavný technický dokumentačný architekt pre projekt **OpenVPM AI** (veterinárny informačný systém pre slovenské kliniky, pilot: MVDr. Martin Sýkora).

## TVOJA ÚLOHA (MISSION)
Zosynchronizuj a aktualizuj všetky **3 vrstvy dokumentácie** v projekte OpenVPM AI tak, aby presne reflektovali stav po **konsolidácii informačnej architektúry (IA Consolidation)**:
1. **Outline Wiki** (`outline.dev.significa.sk`) — centrálna online používateľská príručka kliniky.
2. **Lokálna Markdown dokumentácia** (`docs/help/sk/*.md` a `docs/help/en/*.md`) — repozitárová príručka.
3. **In-App kontextová nápoveda (Modal Help)** (`apps/web/components/help/help-content.ts`) — modálne okná nápovedy priamo v aplikácii dostupné cez tlačidlo pomocníka na každej stránke.

Informácie nesmieš vymýšľať — musíš presne odzrkadľovať implementáciu v kóde repozitára `openvpm-ai`.

---

## 1. PREHĽAD ZMIEN V SYSTÉME (ČO SA ZMENILO)

Po úspešnej konsolidácii navigácie a modulov platia tieto fakty:
1. **Redukcia navigácie:** Bočné menu bolo zredukované z ~44 na ~32 položiek pre prehľadnejší ranný aj denný workflow lekára a recepcie.
2. **Sekcia Kampane & SMS (`/marketing`):**
   - **Tabbed rozhranie na `/marketing`:**
     - `overview` (Prehľad & Generátor / Marketing Studio) — generovanie príspevkov na IG/FB/email, TV slajdy do čakárne, generovanie obrázkov a videí.
     - `calendar` (Kalendár obsahu) — týždenný plán príspevkov s exportom.
     - `queue` (Schvaľovací proces) — schvaľovanie konceptov personálom pred publikovaním.
     - `competitors` (Konkurencia & Intel) — trhový monitoring, sledovanie aktivít konkurenčných ambulancií v regióne.
   - **Klientske presmerovania (backward compatibility):**
     - `/marketing/plan` ➔ `/marketing?tab=calendar`
     - `/marketing/content-queue` ➔ `/marketing?tab=queue`
     - `/vet-intel` ➔ `/marketing?tab=competitors`
     - `/marketing/suppression` ➔ `/marketing/automations?tab=suppression`
3. **Automatizácie (`/marketing/automations`):**
   - Rozšírené na 6 tabov: Pravidlá (`rules`), Cesty (`journeys`), Segmenty (`segments`), Kanály (`channels`), Event Bus (`events`), Potlačenia (`suppression`).
   - **Centrum potlačení:** Auditný prehľad a metrika zablokovaných správ podľa zákonných a etických limitov (Sympathy Gate pri úhyne pacienta, tichý nočný režim 20:00–08:00, SMS rate limit max 1 správa / 14 dní).
4. **Skripty recepcie (`/marketing/consents`):**
   - Modul premenovaný z "Súhlasy & skripty" na **"Skripty recepcie"** (`nav.receptionScripts`). Zameraný na komunikačné štandardy telefonátov, riešenie námietok majiteľov a informované súhlasy pred zákrokom.
5. **Brand Kit presunutý do Nastavení:**
   - `/marketing/brand-kit` odstránený z hlavného menu; Brand Kit bol plne konsolidovaný do `/settings?tab=brandKit`.
6. **Nová sekcia v menu — Preventívna starostlivosť (`nav.sectionPreventive`):**
   - Umiestnená medzi Klinickú kartu a Lekáreň.
   - Združuje položky: **Očkovania** (`/vaccinations`) a **Wellness plány** (`/wellness` / `/marketing/wellness`).
7. **Aktualizovaná terminológia navigácie:**
   - Sekcia Klinika: **"Klinická karta"** (`nav.sectionClinical`).
   - Sekcia Marketing: **"Kampane & SMS"** (`nav.sectionMarketing`).
   - Sekcia Prevencia: **"Preventívna starostlivosť"** (`nav.sectionPreventive`).
8. **Rýchle UX vylepšenia (Quick Wins):**
   - **e-Kasa pokladňa (`/billing/ekasa`):** Rýchly akčný banner pre dennú uzávierku (Z-report) priamo v záložke Doklady.
   - **Whiteboard (`/whiteboard`):** Pridaný aj do sekcie Účtovníctvo & Predpisy s odznakom *"Nové"*.
   - **Whiteboard karta pacienta:** Pacienti so statusom `checked_out` majú výrazný jantárový (amber) badge **"Čaká na faktúru"** (`whiteboard.invoicePending`).
   - **Klinické záznamy (`/records`):** Zobrazenie Vitals Quick-Stats pásika priamo v hlavičke SOAP správy.

---

## 2. VRSTVA 1: OUTLINE WIKI (ONLINE DOKUMENTÁCIA)

Použi Outline MCP nástroje (`outline_list_documents`, `outline_fetch`, `outline_update_document`, `outline_create_attachment`) a zaktualizuj príručku v kolekcii **Používateľská príručka (Návody pre ambulanciu)**.

### Kapitoly na aktualizáciu v Outline:
1. **Kapitola 1: Začíname a Navigácia v systéme**
   - Popíš konsolidovanú štruktúru bočného panelu (~32 položiek).
   - Zaznamenaj premenovanie sekcií na "Klinická karta", "Preventívna starostlivosť" a "Kampane & SMS".
   - Aktualizuj popis prístupových rolí (Správca praxe, Veterinárny lekár, Veterinárny asistent/technik, Recepcia).
2. **Kapitola 3: Fakturácia a e-Kasa**
   - Doplň popis rýchlej dennej uzávierky cez banner priamo v záložke Doklady (`activeTab === "receipts"`).
   - Popíš prepojenie Prevádzkovej tabule (Whiteboard) na fakturáciu — status `checked_out` s odznakom *"Čaká na faktúru"* upozorňuje recepciu na nevyrovnaný účet pred odchodom klienta.
3. **Kapitola 8: Kampane & SMS (pôvodne Marketingové štúdio)**
   - Detailne popíš zjednotený tabový panel `/marketing`:
     - **Prehľad & Generátor:** Tvorba príspevkov pomocou AI, TV slajdy do čakárne, generovanie mediálneho obsahu.
     - **Kalendár obsahu:** Týždenný harmonogram tém (kliešte, vakcinácie, dentálna hygiena).
     - **Schvaľovací proces:** Kontrola príspevkov personálom pred odoslaním.
     - **Konkurencia & Intel:** Prieskum trhu a sledovanie konkurencie v okrese.
   - Zaktualizuj sekciu Automatizácie:
     - 6 tabov vrátane Centra potlačení (`suppression`).
     - Vysvetli prísne legislatívne a etické pravidlá: **Sympathy Gate** (okamžitá stopka správ pri úhyne pacienta), **Tichý nočný režim** (20:00–08:00) a **SMS limit** (max 1 kampaň za 14 dní).
   - Popíš modul **Skripty recepcie** (`/marketing/consents`).
4. **Kapitola 10: Správa a Nastavenia kliniky**
   - Zaznamenaj presun konfigurácie Brand Kitu (logo, farby, typografia, firemný štýl) priamo do `/settings` do záložky **Brand Kit**.
5. **Kapitola 12: Wellness a Preventívna starostlivosť**
   - Popíš novú dedikovanú sekciu v navigácii združujúcu Očkovania a Preventívne balíčky (Wellness plány).

### Pravidlá formátovania v Outline:
- **Žiadne H1 v tele dokumentu:** Názov dokumentu nastavuj cez `title`. Telo začínaj priamo úvodom alebo `##` (H2).
- **Zákaz duplicity emoji v názvoch:** Ak je emoji ikona v meta atribúte `icon`, neopakuj ju v textovom názve dokumentu.
- **Vkladanie obrázkov:** Používaj existujúce screenshoty z `docs/screenshots/wiki/*.png` a nahrávaj ich cez `create_attachment`.

---

## 3. VRSTVA 2: LOKÁLNA MARKDOWN DOKUMENTÁCIA (`docs/help/`)

Zaktualizuj súbory v `docs/help/sk/` a zosynchronizuj ich s `docs/help/en/`:

1. `docs/help/sk/marketing.md` a `docs/help/en/marketing.md`:
   - Zreviduj štruktúru URL — nahraď zastarané samostatné odkazy na `/marketing/plan` a `/marketing/content-queue` tabovým modelom `/marketing?tab=...`.
   - Popíš Centrum potlačení v automatizáciách (`/marketing/automations?tab=suppression`).
   - Popíš modul Skripty recepcie (`/marketing/consents`).
   - Odstráň odkazy na Brand Kit v marketingu a odkáž na Nastavenia kliniky.
2. `docs/help/sk/admin-settings.md` a `docs/help/en/admin-settings.md`:
   - Pridaj popis záložky Brand Kit v nastaveniach ambulancie.
3. `docs/help/sk/billing-finance.md` a `docs/help/en/billing-finance.md`:
   - Doplň postup vykonania dennej uzávierky e-Kasy cez akčný banner v dokladoch.
   - Popíš synchronizáciu s Whiteboardom a indikátor "Čaká na faktúru".
4. `docs/help/sk/wellness.md` a `docs/help/en/wellness.md`:
   - Aktualizuj umiestnenie modulu v novej navigačnej sekcii "Preventívna starostlivosť".
5. `docs/help/sk/getting-started.md` a `docs/help/en/getting-started.md`:
   - Aktualizuj navigačnú mapu a pomenovania sekcií ("Klinická karta", "Preventívna starostlivosť", "Kampane & SMS").
6. `docs/help/README.md`:
   - Aktualizuj celkovú obsahovú štruktúru a zoznam kapitol.

---

## 4. VRSTVA 3: IN-APP KONTEXTOVÁ NÁPOVEDA (`apps/web/components/help/help-content.ts`)

Uprav a doplň záznamy v objekte `HELP_CONTENT` v súbore [apps/web/components/help/help-content.ts](file:///c:/Users/marek/Documents/Vet/openvpm-ai/apps/web/components/help/help-content.ts).

### Požadované úpravy trás:
1. **`"/marketing"`:**
   - Aktualizuj popis a kroky tak, aby odzrkadľovali 4 integrované taby: *Prehľad & Generátor*, *Kalendár obsahu*, *Schvaľovací proces*, *Konkurencia & Intel*.
   - V `tips` spomeň automatickú synchronizáciu tabu v URL parametri `?tab=...`.
2. **`"/marketing/automations"`:**
   - Rozšír kroky o záložku **Potlačenia (Suppression)** a vysvetli mechanizmy Sympathy Gate, Quiet Hours a SMS limitov.
3. **`"/marketing/consents"`:**
   - Zmeň `title` na `"Skripty recepcie a informované súhlasy"`.
   - Prispôsob `intro` a kroky na telefonické štandardy personálu, uvítacie hovory a predoperačné súhlasy.
4. **`"/marketing/brand-kit"`:**
   - Pridaj upozornenie, že nastavenie vizuálnej identity je presunuté do Nastavení kliniky (`/settings?tab=brandKit`).
5. **`"/marketing/plan"` a `"/marketing/content-queue"` a `"/vet-intel"`:**
   - Uprav nápovedu s informáciou, že tieto sekcie boli integrované ako priame taby v Marketingovom štúdiu (`/marketing`).
6. **`"/billing/ekasa"`:**
   - Doplň krok pre rýchle spustenie dennej uzávierky cez nový banner v zozname dokladov.
7. **`"/whiteboard"`:**
   - Zahrň popis stavu `Čaká na faktúru` pre prepustených pacientov a prepojenie na pokladňu.
8. **`"/settings"`:**
   - Doplň popis záložky Brand Kit pre správu farieb, loga a firemných údajov.
9. **Nové trasy pre Preventívnu starostlivosť:**
   - Pridaj alebo zosúlaď záznamy pre:
     - `"/marketing/wellness"` a `"/wellness"` (správa a predaj preventívnych balíčkov).
     - `"/vaccinations"` (prehľad vakcinácií a revakcinačných termínov).

### Striktné pravidlá pre kód `help-content.ts`:
- Dodržiavaj interface `HelpContent` (`title`, `intro`, `steps: { icon, title, description }[]`, `tips`, `relatedModules`, `practicalExample`).
- Texty formuluj v slovenčine s reálnym klinickým kontextom (žiadne generické lorum ipsum).
- Zachovaj 100 % TypeScript kompatibilitu bez `any` chýb.

---

## 5. OVEROVACIE KRITÉRIÁ (DEFINITION OF DONE)

Po dokončení úprav vykonaj validáciu:
1. **Regresné testy navigácie a nápovedy:**
   ```bash
   pnpm --filter @openpims/web test config/__tests__/custom-nav-i18n.test.ts components/help/__tests__/help-content.test.ts
   ```
2. **TypeScript kontrola:**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
3. **i18n symetria:**
   ```bash
   node -e "const s=require('./apps/web/messages/sk.json');const e=require('./apps/web/messages/en.json');console.log(Object.keys(s).length === Object.keys(e).length ? 'Symmetry OK' : 'MISMATCH')"
   ```
4. **Produkčný build:**
   ```bash
   pnpm build
   ```

---

## 6. FORMÁT VÝSTUPNÉHO REPORTU

Po vykonaní zmien odovzdaj štruktúrovaný report:
```markdown
## Dokumentačný Audit & Synchronizácia — Výsledok

### 1. Outline Wiki
- [x] Zoznam aktualizovaných / vytvorených dokumentov s ID a názvami
- [x] Zoznam vložených screenshotov

### 2. Lokálna Markdown dokumentácia (`docs/help/`)
- [x] Zoznam upravených SK súborov
- [x] Zoznam upravených EN súborov
- [x] Overenie symetrie a integrity odkazov

### 3. In-App Modal Help (`help-content.ts`)
- [x] Zoznam aktualizovaných trás v HELP_CONTENT
- [x] Zoznam novopridaných trás
- [x] Výsledok testu `help-content.test.ts`

### 4. Technická validácia
- TypeScript type-check: OK / Chyby
- Unit testy: X/X passed
- Produkčný build: OK
```
