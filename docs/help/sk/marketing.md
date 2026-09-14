# Marketingové Štúdio a komunikácia

Marketingový modul OpenVPM odosiela automatické správy klientom, spravuje
reputáciu vašej praxe a pomáha vám osloviť správnych klientov v správnom
čase. Prejdite do **Marketingové Štúdio** (`/marketing`).

> **Roly**: Správca praxe má plný prístup. Veterinárni lekári môžu
> prezerať kampane a schvaľovať klinický obsah. Veterinárni asistenti
> a Recepcia majú prístup na čítanie.

---

## 1. Prehľad komunikácie

Marketingový modul pracuje s 12 vstavanými CRM segmentmi, ktoré
automaticky klasifikujú vašich klientov podľa ich aktivity:

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
| Vysokohodnotní VIP | Klienti s najvyššími príjmami |

Segmenty sa počítajú automaticky — nie je potrebné ich udržiavať manuálne.

---

## 2. Starostlivosť a automatizované cesty

Po konfigurácii prebieha päť automatizovaných zákazníckych ciest na pozadí:

| Cesta | Spúšťač | Správy |
|---|---|---|
| Uvítanie nového klienta | Registrácia nového klienta | Uvítacia správa + žiadosť o spätnú väzbu po 7 dňoch |
| Sledovanie po návšteve | Ukončenie návštevy | Poďakovanie + žiadosť o recenziu po 24 hodinách |
| Upomienka na vakcínu | Blížiaci sa termín vakcíny | Upomienka 14 dní vopred + odpočítavanie 3 dni + oznámenie o meškaní |
| Starostlivosť po operácii | Zaznamenaná operácia | Kontrola stavu po 24 hodinách + uzdravovanie 3. deň + kontrola stehov 10. deň |
| Reaktivácia pacienta | 12 mesiacov od poslednej návštevy | Správa o predvolaní |

### ⚠️ Sympathy Flow — povinná bezpečnostná brána

> **Toto nie je nastaviteľná možnosť. Nedá sa vypnúť.**

Keď je stav pacienta nastavený na **uhynutý**, alebo keď je v systéme
zaznamenaná eutanázia, nasleduje toto **automaticky a trvalo**:

- Všetky automatizované upomienky pre tohto pacienta sú **okamžite
  potlačené** — vrátane upomienok na vakcíny, predvolaní, sledovaní
  po návšteve a žiadostí o recenziu
- Všetky otvorené upomienky starostlivosti pre pacienta sú zamietnuté
  s dôvodom *"Sympathy Gate: Pacient uhynul / bol eutanazovaný."*
- Automaticky sa vytvorí interná úloha kondolencie pre personál, aby
  mohol osobne osloviť majiteľa
- Každé potlačenie je zaznamenané v auditnom zázname s kódom dôvodu
  `deceased_patient`

Toto správanie sa vzťahuje na všetkých päť ciest uvedených vyššie.
Neexistuje žiadna výnimka, žiadna bielá listina a žiadna možnosť
odhlásenia.

---

## 3. Marketingové Štúdio

Vytvárajte príspevky na sociálne siete, obsah pre televíziu v čakárni
a tlačené informačné materiály pre klientov v **Marketingové Štúdio →
Štúdio**.

AI-generované návrhy obsahu produkuje AI model systému. **Akýkoľvek
návrh obsahujúci klinické tvrdenia** (liečebné odporúčania, informácie
o dávkovaní, prevencia chorôb) musí byť schválený licencovaným
veterinárnym lekárom pred zverejnením. Systém túto požiadavku vynucuje.

---

## 4. Správa reputácie

Prichádzajúce recenzie sú zobrazené v **Marketingové Štúdio → Recenzie**.
Každá recenzia má 24-hodinové SLA na odpoveď sledované systémom.

Recenzie s hodnotením **2 hviezdy alebo menej** sú automaticky eskalované:
systém nastaví príznak eskalácie a vytvorí úlohu pre personál, aby mohol
promptne reagovať.

---

## 5. Televízia v čakárni

Zobrazujte front termínov, wellness propagácie a oznámenia praxe na
obrazovke v čakárni na adrese `/tv`. Displej sa aktualizuje automaticky
a nevyžaduje žiadny ďalší hardvér — stačí otvoriť URL v ľubovoľnom
prehliadači pripojenom k obrazovke.

---

Potrebujete pomoc? Napíšte na [hello@openvpm.com](mailto:hello@openvpm.com).
