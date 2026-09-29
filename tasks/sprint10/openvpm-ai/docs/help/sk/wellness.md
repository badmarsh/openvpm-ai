# Wellness plány

Wellness plány vám umožňujú ponúkať klientom mesačné alebo ročné
preventívne balíky. V rámci konsolidovanej navigácie nájdete tento modul
v novej dedikovanej sekcii **Preventívna starostlivosť** (`/wellness` a
`/marketing/wellness`), ktorá združuje **Očkovania** (`/vaccinations`)
a **Wellness plány**. Plány znižujú náklady na rutinnú starostlivosť
pre klientov a zároveň poskytujú praxi predvídateľný pravidelný príjem.

> **Roly**: Správca praxe a Recepcia vytvárajú a spravujú plány
> a registrácie. Všetky klinické roly môžu prezerať wellness stav pacienta.

---

## 1. Prehľad plánov

Wellness plán je pomenovaný balík s mesačnou alebo ročnou cenou, ktorý
zahŕňa definovanú sadu čerpateľných služieb (napr. jedna ročná prehliadka,
dve vakcíny, jedna dentálna kontrola ročne).

Správcovia vytvárajú a konfigurujú plány v **Nastavenia → Wellness plány**.
Každý plán obsahuje:

- **Názov a popis** — viditeľné pre personál aj klientov
- **Cena** — mesačný alebo ročný fakturačný cyklus
- **Zahrnuté služby** — zoznam služieb, ktoré môže klient čerpať v rámci
  plánu, s množstvami na fakturačné obdobie

Plány sú aktivované a sprístupnené pre registráciu po uložení.

---

## 2. Registrácia pacienta

Postup registrácie pacienta do wellness plánu:

1. Otvorte záznam pacienta
2. Prejdite na záložku **Wellness**
3. Kliknite na **Registrovať do plánu**
4. Vyberte aktívny plán zo zoznamu
5. Potvrďte dátum začiatku registrácie
6. Kliknite na **Registrovať**

Fakturácia začína dňom registrácie. Záložka Wellness pacienta zobrazuje:

- Názov plánu a stav (aktívny, zrušený, pozastavený)
- Nasledujúci dátum fakturácie
- Zostatok čerpateľných služieb v tomto cykle

---

## 3. Čerpanie služieb

Keď je vykonaná služba zahrnutá v pláne (napr. ročná prehliadka):

1. Otvorte stretnutie pacienta alebo faktúru
2. Pridajte službu ako riadkovú položku
3. Systém detekuje, že je krytá aktívnym plánom a označí ju
   ako **Vyčerpanú**
4. Čerpanie sa zaznamenáva voči povoleniu plánu pre tento cyklus

Vyčerpané služby sú zobrazené na záložke Wellness pacienta. Nevyužité
služby v fakturačnom cykle sa neprenášajú do ďalšieho cyklu, pokiaľ
to nie je takto nakonfigurované.

---

## 4. Fakturačný proces

Faktúry za wellness plány sa generujú automaticky v každý dátum
fakturačného cyklu. Systém:

1. Vypočíta nasledujúci dátum fakturácie na základe dátumu registrácie
   a cyklu
2. Vytvorí faktúru za poplatok za plán
3. Pokúsi sa účtovať cez Stripe, ak má klient uloženú platobnú metódu
4. Zobrazí faktúru v **Fakturácia** na manuálnu kontrolu a inkaso,
   ak nie je nakonfigurovaná automatická platba

Skontrolujte vygenerované wellness faktúry a inkasujte platby ako
pri akejkoľvek inej faktúre.

---

## 5. Zrušenie registrácie

Postup zrušenia registrácie pacienta:

1. Otvorte záznam pacienta a prejdite na záložku **Wellness**
2. Kliknite na **Zrušiť registráciu**
3. Potvrďte zrušenie

Zrušenie okamžite zastaví všetku budúcu fakturáciu. Služby už vyčerpané
v aktuálnom cykle sa automaticky nevracajú. Prípadný kredit alebo čiastočné
vrátenie riešte manuálne prostredníctvom úpravy faktúry alebo dobropisom.

---

Potrebujete pomoc? Napíšte na [jurkemik@significa.sk](mailto:jurkemik@significa.sk).
