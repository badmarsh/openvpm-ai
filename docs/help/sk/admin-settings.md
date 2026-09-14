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
| **Služby a produkty** | Katalóg služieb, ceny, daňové kódy |
| **Šablóny** | Šablóny SOAP poznámok, prepúšťacích správ, predpisov a e-mailov |
| **Upomienky** | Pravidlá predvolania na vakcínu, načasovanie starostlivosti |
| **e-Kasa** | Hardvér fiškálnej pokladnice, DIČ, IČ DPH, test pripojenia |
| **Import dát** | Migrácia záznamov z predchádzajúceho systému (`/settings/import-v2`) |
| **Export a záloha dát** | CSV exporty, záloha databázy vo formáte JSON |
| **API kľúče** | Generovanie a zrušenie API kľúčov pre integrácie |
| **Predplatné a fakturácia** | Správa plánu, nastavenie Stripe Connect |
| **Sprievodcovia** | Interaktívne návody priamo v aplikácii |

> **Známe obmedzenie — bočný panel**: Niektoré položky bočného panelu navigácie
> sa zobrazujú v slovenčine bez ohľadu na nastavenie jazyka. Je to spôsobené tým,
> že 12 kľúčov vlastnej navigácie ešte nie je v slovníku i18n; bočný panel
> pre tieto položky používa záložné hardkódované slovenské texty.
> Toto je známy problém, ktorý bude vyriešený v budúcej verzii.

> **Upozornenie pre prístupnosť**: Koreňový HTML atribút `lang` aplikácie
> je napevno nastavený na `sk` (slovenčina) bez ohľadu na preferenciu jazyka
> používateľa. Čítačky obrazovky a nástroje na preklad v prehliadači
> budú stránku detekovať ako slovenskú.

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

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk).
