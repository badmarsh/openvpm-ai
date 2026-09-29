# Sklad a lekáreň

Spravujte zásoby produktov, omamné a psychotropné látky a dávkovanie liekov
v sekcii **Sklad** (`/inventory`). Všetky pohyby zásob sú zaznamenávané
s časovou pečiatkou, menom používateľa a dôvodom.

> **Roly**: Všetky roly môžu prezerať sklad. Úpravy vyžadujú rolu
> Správca praxe alebo Recepcia. Omamné a psychotropné látky sú vyhradené
> pre Správcu praxe a Veterinárneho lekára.

---

## 1. Správa produktov a zásob

Katalóg produktov je zdrojom pravdy pre všetko, čo dispenzujete alebo
predávate. Každý produkt obsahuje:

- **Názov, SKU, kategória** — organizujte produkty podľa typu (liek,
  spotrebný materiál, krmivo atď.) s plnou slovenskou lokalizáciou a skloňovaním
- **Dodávateľ** — prepojenie so záznamom dodávateľa
- **Jednotková cena** — použitá pri pridaní produktu do faktúry
- **Číslo šarže a dátum exspirácie** — sledované pre každú dávku
- **Hladina objednávky** — keď zásoby klesnú na túto úroveň alebo pod ňu,
  produkt sa zobrazí v upozorneniach
- **Stránkovanie** — zoznam zobrazuje 50 položiek na stranu s rýchlou navigáciou,
  čítačom stránok a automatickým návratom na stranu 1 pri vyhľadávaní.

**Filter upozornení**: Použite filter v hornej časti stránky skladu:

| Filter | Zobrazuje |
|---|---|
| Všetky | Celý katalóg |
| Pozornosť | Blíži sa k hladine objednávky |
| Nízke zásoby | Na hladine objednávky alebo pod ňou |
| Expirované | Po dátume exspirácie |
| Čoskoro expiruje | Expiruje v nastavenom horizonte |

**Úprava zásob**: Otvorte produkt a kliknite na **Upraviť množstvo**.
Zadajte zmenu (kladná pre príjem, záporná pre odpis), vyberte dôvod zo
zoznamu a uložte. Každá úprava je zaznamenaná s menom, časovou pečiatkou
a dôvodom.

---

## 2. Omamné a psychotropné látky (Kniha OPL)

Omamné a psychotropné látky — lieky Schedule I/II vrátane ketamínu,
propofolu, opiátov, butorfanolu a fentanylu — sú sledované v samostatnom
registri **Omamné látky** na adrese `/controlled-substances`.

**Prístup**: Len roly Správca praxe a Veterinárny lekár. Roly Recepcia
a Veterinárny asistent/technik nemajú prístup k tomuto registru.

**Záznam výdaja**:
1. Otvorte stretnutie s pacientom
2. Prejdite na sekciu omamných látok
3. Zadajte: názov lieku, použité množstvo, číslo šarže, pacienta a indikáciu
4. Zaznamenajte prípadný odpad (znehodnotené množstvo), meno svedka a
   jeho podpis
5. Odošlite — záznam sa zapíše do nemenného auditného záznamu

**Požiadavka na svedka**: Každý výdaj OPL zahŕňajúci znehodnotenie vyžaduje
prítomnosť a podpis druhej oprávnenej osoby (Správca praxe alebo
Veterinárny lekár).

**Odsúhlasenie**: Pravidelné odsúhlasenie porovná fyzický stav zásob so
záznamom. Spustite odsúhlasenie zo stránky Omamných látok.

**Štátna inšpekcia a úradná tlač OPK**: Pre potreby úradnej kontroly ŠÚKL a ŠVPS SR,
overenie inventúrnej bilancie a vytlačenie formátovanej knihy OPK (A4 na šírku s podpismi)
prejdite do modulu **Legislatíva → Kontrolované látky** na adrese `/statutory`.
Obidva moduly pracujú s identickým dátovým zdrojom v reálnom čase.

> ⚠️ **Nulové AI predvyplnenie**: AI asistent nemá možnosť predvyplniť
> žiadne polia OPL. Všetky záznamy zadáva manuálne licencovaný
> veterinárny lekár. Toto je povinná zákonná požiadavka podľa
> Zákona č. 139/1998 Z. z.

---

## 3. Dávkovacia kalkulačka

Dávkovacia kalkulačka je dostupná v zázname pacienta aj na obrazovke
stretnutia. Poskytuje rozsahy dávok podľa hmotnosti pre bežné
veterinárne lieky.

**Postup použitia**:
1. Otvorte záznam pacienta alebo stretnutie
2. Kliknite na **Dávkovacia kalkulačka**
3. Vyberte liek z formulária
4. Zadajte hmotnosť pacienta (kg)
5. Voliteľne zadajte koncentráciu lieku (mg/ml) pre výpočet objemu
6. Kalkulačka vráti rozsah dávky pre daný druh (pes alebo mačka)

Formulár obsahuje ochrany pred druhovo špecifickou toxicitou
(napr. paracetamol pre mačky, ivermektín pre kólie).

> ⚠️ **Len podpora klinického rozhodovania**: Dávkovacia kalkulačka je
> referenčný nástroj. Vždy overte vypočítané dávky v oficiálnom Súhrne
> charakteristických vlastností lieku (SPC). S každým výsledkom sa zobrazuje
> povinné upozornenie.

---

## 4. Elektronický import dodacích listov od veľkoobchodníkov

Systém umožňuje automatické spracovanie a import elektronických dodacích listov
priamo do skladu:

| Veľkoobchodník | Formát súboru |
|---|---|
| **Cymedica SK s.r.o.** | CSV (oddeľovač bodkočiarka) |
| **Pharmos a.s.** | EDI / CSV s ADC/ŠÚKL kódmi |
| **Samohýl SK, s.r.o.** | CSV s EAN kódmi |
| **Henry Schein SK** | CSV / Tab-delimited |
| **BIOPHARM, s.r.o.** | CSV s kódmi a šaržami liečiv |
| **KOMVET s.r.o.** | Tab-delimited .txt bezpečný parser |
| **SG-Vet s.r.o.** | XML s podporou slovenských tagov (`<polozka>`, `<sarza>`, `<expiracia>`) |
| **SANVET s.r.o. / PHRAMED** | CSV s automatickým rozpoznaním distribútora |

Parsované polia zahŕňajú: kód položky (SKU), názov produktu, číslo šarže, dátum
exspirácie, množstvo a nákupnú cenu bez DPH. Systém automaticky vyhľadá zhodu s existujúcimi
kartami produktov a navrhne naskladnenie (`update_stock`) alebo založenie nového produktu (`create_product`).

> 🛑 **Bezpečnostná brána pre omamné látky (Zákon č. 139/1998 Z. z.)**:
> Pri importe systém automaticky identifikuje regulované látky (Ketamidor, ketamín,
> butorfanol, fentanyl, propofol atď.) a nastavuje predvolenú akciu na **Preskočiť** (`skip`).
> Omamné látky nie je možné automaticky naskladniť do bežných zásob — vyžadujú manuálny
> zápis autorizovaným veterinárnym lekárom do Knihy OPL.

Import nájdete v sekcii **Sklad → Import dodacieho listu** (`/inventory/import`).

---

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk).
