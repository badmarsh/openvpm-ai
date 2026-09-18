# Nastavenia

**Nastavenia** (`/settings`) sú riadiacim panelom vašej praxe. Nájdete tu
všetko od rolí používateľov a šablón až po konfiguráciu e-Kasa a exporty
dát. Rola **Správca praxe** má plný prístup ku všetkým nastaveniam;
**Veterinárny lekár** má prístup na čítanie väčšiny sekcií.

---

## 1. Prehľad nastavení

Stránka nastavení je rozdelená do nasledovných sekcií:

| Sekcia | Čo konfigurujete |
|---|---|
| **Informácie o praxi** | Názov, adresa, telefón, časové pásmo, logo |
| **Používatelia a roly** | Pozvanie personálu, priradenie rolí, deaktivácia účtov |
| **Zabezpečenie** | Zmena hesla priamo v aplikácii, dostupné pre každého člena personálu (`/settings/security`) |
| **Služby a produkty** | Katalóg služieb, ceny, daňové kódy |
| **Šablóny** | Šablóny SOAP poznámok, prepúšťacích správ, predpisov a e-mailov |
| **Upomienky** | Pravidlá predvolania na vakcínu, načasovanie starostlivosti |
| **e-Kasa** | Hardvér fiškálnej pokladnice, DIČ, IČ DPH, test pripojenia |
| **AI Nastavenia** | Správa providerov (Vertex, OpenRouter, Alibaba), ModelPicker, veterinárne mapovanie (`/settings/ai`) |
| **Brand Kit** | Logo ambulancie (SVG/PNG), primárna a sekundárna farba, hlavičky dokumentov |
| **Import dát** | Migrácia záznamov z predchádzajúceho systému (`/settings/import-v2`) |
| **Export a záloha dát** | CSV exporty, záloha databázy vo formáte JSON |
| **API kľúče** | Generovanie a zrušenie API kľúčov pre integrácie |
| **Predplatné a fakturácia** | Správa plánu, nastavenie Stripe Connect |
| **Sprievodcovia** | Interaktívne návody priamo v aplikácii |

---

## 2. Rýchle sprievodcovia

Otvorte **Nastavenia → Sprievodcovia** a spustite podrobné interaktívne
návody, ktoré využívajú vaše vlastné živé dáta. Dostupné sprievodcovia:

- **Nastavenie praxe** — vyplňte informácie o praxi, pridajte prvú službu
- **Pridanie prvého pacienta** — vytvorte klienta, zaregistrujte zviera,
  pridajte číslo mikročipu
- **Vytvorenie prvej faktúry** — pridajte službu, odošlite faktúru,
  zaznamenajte platbu
- **Napísanie prvej SOAP poznámky** — otvorte stretnutie, vyplňte
  Subjektívne/Objektívne/Hodnotenie/Plán, finalizujte a podpíšte

Každý sprievodca trvá 1–3 minúty a môžete ho kedykoľvek znovu spustiť.

---

## 3. Správa dát

Všetky operácie s dátami nájdete v **Nastavenia → Dáta**.

### Export dát

- **CSV exporty** — Stiahnite klientov, pacientov, termíny alebo faktúry
  ako súbory kompatibilné s tabuľkovými procesormi.
- **Záloha databázy** — Stiahnite úplnú štruktúrovanú JSON zálohu vašej
  praxe: každý klient, zviera, SOAP poznámka, laboratórny výsledok, faktúra
  a platba. Kliknite na **Exportovať zálohu databázy**. Nahraté prílohy
  (obrázky, PDF) nie sú súčasťou tohto JSON súboru.

> ⚠️ **Export do PDF — slovenská diakritika**: Exporty PDF prechádzajú
> sanitizáciou, ktorá konvertuje slovenskú diakritiku (č→c, š→s, ä→a).
> Na presné zachovanie všetkých znakov používajte CSV exporty.

### Import dát

Migrujte z iného systému cez **Nastavenia → Import dát**
(`/settings/import-v2`). Importy prebiehajú v prísnom poradí
(klienti → pacienti → vakcíny) a každý import zobrazí **náhľad pred
spustením** — vidíte presne, čo sa zmení, skôr než sa čokoľvek uloží.
Importy len pridávajú záznamy; nikdy neprepíšu existujúce dáta.

Pozrite si [Vaše dáta: export, záloha a import](../your-data.md) pre
kompletný sprievodca migráciou.

### Odstránenie vzorových dát

Keď ste pripravení na ostrú prevádzku, kliknite na **Odstrániť vzorové
dáta** v Nastavenia → Dáta. Táto akcia je nevratná.

### Odstránenie praxe

Trvalé odstránenie praxe je nevratné. Kontaktujte
[jurkemik@significa.sk](mailto:jurkemik@significa.sk).

---

## 4. AI Nastavenia a konfigurácia modelov (`/settings/ai`)

V záložke **Nastavenia → AI Nastavenia** (alebo priamo cez `/settings/ai`) konfigurujete umelú inteligenciu pre vašu kliniku:

- **Poskytovatelia inferencie:**
  - **Google Cloud Vertex AI:** Enterprise úroveň bez uchovávania dát (Zero Data Retention).
  - **OpenRouter API:** Flexibilný prístup k popredným svetovým modelom.
  - **Alibaba Cloud / AliProxy:** Pokročilá analýza obrazu a multimodálna syntéza.
  - **Vlastný OpenAI-kompatibilný endpoint:** Pre lokálny offline beh na vlastnom serveri kliniky.
- **ModelPicker (Vyhľadávanie modelov):** Interaktívny výber s okamžitým dynamickým načítaním zoznamu modelov z API a testom spojenia (latencia v ms).
- **Veterinárne funkčné mapovanie:**
  - *Klinický Copilot & SOAP:* Gemini 3.8 Flash pre rýchle a presné záznamy.
  - *Zobrazovacie metódy & RTG:* Multimodálne modely (Gemini 3.8 Multimodal, Wan 3.0).
  - *Voice SOAP:* Hlasový prepis veterinárnych diktátov.
  - *Laboratórny parser:* Automatická extrakcia parametrov z PDF nálezov analyzátorov.
- **Bezpečnosť kľúčov:** Kľúče sú ukladané výhradne šifrované (AES-256-GCM v tabuľke `ext_ai_settings`) a maskované pred bežným personálom.

---

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk).

