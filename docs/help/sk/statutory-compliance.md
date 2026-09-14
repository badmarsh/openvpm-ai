# Legislatívny súlad

OpenVPM pomáha vašej praxi plniť zákonné povinnosti veterinárneho práva SR.
Prejdite do sekcie **Legislatíva** (`/statutory`) v bočnom paneli pre
prístup ku všetkým zákonným registrom a nástrojom na podávanie hlásení.

> **Roly**: Správca praxe a Veterinárny lekár majú plný prístup. Veterinárny
> asistent/technik a Recepcia majú väčšinou prístup len na čítanie. Omamné
> a psychotropné látky sú vyhradené pre Správcu praxe a Veterinárneho lekára.

---

## 1. Legislatívny rámec

Modul legislatívneho súladu pokrýva povinnosti podľa:

- **Zákon č. 39/2007 Z. z.** (o veterinárnej starostlivosti) — kniha
  ošetrení, kniha besnoty, ochranné lehoty, CRSZ, hlásenia KVEPIS
- **Zákon č. 139/1998 Z. z.** (o omamných a psychotropných látkach) —
  register OPL s nemenným auditným záznamom
- **Nariadenie EÚ 2019/6** (o veterinárnych liekoch) — evidencia ochranných
  lehôt pre potravinové zvieratá

Systém vedie nasledovné zákonné registre:

| Register | Zákonný základ |
|---|---|
| Kniha besnoty | Zákon 39/2007 |
| Kniha ošetrení | Zákon 39/2007 |
| Evidencia eutanázií | Zákon 39/2007 |
| Kniha OPL (omamné látky) | Zákon 139/1998 |
| Ochranné lehoty | Zákon 39/2007, EÚ 2019/6 |
| Register likvidácie mŕtvych zvierat | Zákon 39/2007 |

---

## 2. Postup podania KVEPIS

KVEPIS je systém hlásenia veterinárnych údajov ŠVPS SR. OpenVPM generuje
XML export ambulantnej knihy a hlásení chorôb validovaný voči oficiálnej
XSD schéme ŠVPS SR.

**Postup exportu**:
1. Prejdite do **Legislatíva → KVEPIS** (`/statutory/kvepis`)
2. Vyberte vykazované obdobie (mesiac)
3. Kliknite na **Validovať & Exportovať XML** — systém overí dáta voči
   XSD schéme a nahlási prípadné chyby pred exportom
4. Stiahnite XML súbor a nahrajte ho manuálne cez portál ŠVPS SR

> ⚠️ **Aktuálny stav**: Generovanie XML a XSD validácia sú plne
> implementované. **Priame automatické podanie** (B2G REST API) na ŠVPS SR
> je plánované vo **verzii v0.7**, po pridelení produkčných integračných
> kľúčov od ŠVPS SR. Do tej doby je potrebné manuálne nahratie XML súboru
> na portál ŠVPS SR.

---

## 3. Evidencia besnoty (Kniha besnoty)

Každé očkovanie proti besnote musí byť zaznamenané. Systém automaticky
sleduje **3-dňové okno na hlásenie** na Regionálnu veterinárnu a potravinovú
správu (RVPS).

**Postup**:
1. Otvorte záznam pacienta a prejdite na záložku **Očkovania**
2. Zaznamenajte vakcínu proti besnote (dátum, číslo šarže, výrobca)
3. Modul legislatívneho súladu automaticky vytvorí záznam hlásenia na RVPS
4. Všetky čakajúce a dokončené hlásenia zobrazíte v **Legislatíva → Besnota**

Register besnoty zobrazuje dátum očkovania, termín hlásenia, stav podania
na RVPS a podpis veterinárneho lekára.

> ⚠️ **Bezpečnostná brána Sympathy Flow**: Ak je zviera po zaregistrovaní
> uhynuté alebo eutanazované, všetky automatické upomienky a marketingové
> správy pre tohto pacienta sú trvalo potlačené. Toto je povinné správanie
> systému, nie nastaviteľná možnosť.

---

## 4. Ochranné lehoty

Pre potravinové zvieratá musí byť každý podaný liek zdokumentovaný vrátane
ochrannej lehoty. Prejdite do **Legislatíva → Ochranné lehoty**.

**Postup záznamu**:
1. Kliknite na **Pridať ochrannú lehotu**
2. Zadajte: názov lieku, číslo šarže, typ zvieraťa, kód hospodárstva CEHZ
   (6-miestny, automaticky validovaný), dátum podania
3. Zadajte ochrannú lehotu v dňoch (mäso a/alebo mlieko zvlášť)
4. Systém vypočíta a zobrazí dátum **Bezpečné od** (`safeUntil`)

Aktívne ochranné lehoty sú zvýraznené v zázname pacienta.

> ⚠️ **Požiadavka na presnosť**: Záznamy o ochranných lehotách nie sú
> právne záväzné na základe návrhov AI. Vždy overte ochranné lehoty
> v oficiálnom Súhrne charakteristických vlastností produktu (SPC).
> Za presnosť záznamov zodpovedá veterinárny lekár.

---

## 5. CRSZ a PetPass

Registrujte spoločenské zvieratá v Centrálnom registri spoločenských
zvierat (CRSZ) cez **Legislatíva → CRSZ**.

**Funkcie**:
- **Validácia mikročipu**: Formát ISO 11784/11785 (15 číslic) je
  automaticky overovaný
- **Potvrdenie registrácie**: Generovanie úradného potvrdenia pre majiteľa
- **Hromadný export KVL SR**: Vyberte viacero zvierat a exportujte
  do KVL SR ako CSV alebo XML
- **Cestovné doklady PetPass**: Generovanie cestovných dokladov pre
  zvieratá prekračujúce hranice EÚ

---

## 6. Register likvidácie mŕtvych zvierat

Povinná evidencia uhynutých zvierat odovzdaných na asanáciu. Prejdite do
**Legislatíva → Likvidácia mŕtvych zvierat**.

**Postup záznamu**:
1. Kliknite na **Nový záznam likvidácie**
2. Vyberte pacienta, zadajte dátum úhynu/eutanázie, hmotnosť a
   asanačný podnik
3. Zaznamenajte dátum odvozu a referenčné číslo
4. Uložte — záznam sa pridá do registra hlásení ŠNHRA

Zo záznamov sa generujú formuláre hlásení pre Štátnu veterinárnu správu.

---

## 7. Aktuálne obmedzenia

Nasledovné známe obmedzenia platia od verzie v0.6:

| Oblasť | Stav |
|---|---|
| Priame B2G podanie KVEPIS | Nie je k dispozícii — len XML export; živé REST plánované v0.7 |
| Produkčný sandbox ÚPVS/Slovensko.sk | Zatiaľ nepridelený (Q1 2027) |
| Plnohodnotný DICOM PACS (RTG/CT) | Plánovaný v1.0 — aktuálne je dostupný upload súborov + AI analýza |
| Reálne produkčné podania KVEPIS | Žiadne zatiaľ — len simulácia/testovanie |
| AI predvyplnenie OPL | NULA — všetky záznamy sú manuálne zámerom |
| Živé API konektory laboratórií | Parser existuje; živé API odložené na v0.7 |

---

Potrebujete pomoc? Napíšte na [hello@openvpm.com](mailto:hello@openvpm.com).
