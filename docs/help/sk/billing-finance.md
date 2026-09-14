# Fakturácia a financie

Táto stránka vysvetľuje správu faktúr, evidenciu platieb, prevádzku
pokladnice e-Kasa, nastavenie predplatného a export účtovných dát v OpenVPM AI.

Celý fakturačný modul nájdete v sekcii **Fakturácia** (`/billing`). Plný
prístup majú roly **Správca praxe** a **Veterinárny lekár**; **Recepcia**
môže vytvárať faktúry a evidovať platby.

---

## 1. Fakturácia

Prejdite do **Fakturácia** (`/billing`) a kliknite na **Nová faktúra**.
Vyberte klienta a pridajte riadkové položky zo zoznamu služieb alebo
produktov. Ceny, daňové kódy a popisy sa dopĺňajú automaticky z katalógu
nakonfigurovaného v **Nastavenia → Služby**. Faktúru uložte ako koncept
alebo ju odošlite priamo klientovi.

**Úprava**: Otvorte ľubovoľnú neuhradenú faktúru a kliknite na **Upraviť**.

**Storno faktúry**: Otvorte faktúru a kliknite na **Stornovať**. Storno je
nevratné a dostupné len pre roly **Správca praxe** a **Veterinárny lekár**.
Stornovaná faktúra zostáva viditeľná v auditnom zázname.

---

## 2. Platby

Na otvorenej faktúre kliknite na **Zaevidovať platbu**. Podporované spôsoby
platby:

- **Hotovosť** — zaznamenané okamžite
- **Karta (Stripe)** — vygeneruje odkaz na Stripe pokladňu pre klienta
  alebo spustí tok platby na termináli
- **Bankový prevod** — zadajte referenčné číslo a označte platbu po
  prijatí na účet

**Čiastkové platby**: Na jednu faktúru môžete evidovať viacero čiastočných
platieb, kým zostatok nedosiahne nulu.

**Potvrdenie platby**: Po zaplatení kliknite na **Odoslať potvrdenie**
a systém pošle PDF potvrdenie e-mailom.

> ⚠️ **Upozornenie — diakritika v PDF**: Exporty PDF prechádzajú
> sanitizáciou, ktorá odstraňuje slovenskú diakritiku (č→c, š→s, ä→a,
> ľ→l, ž→z). Ak záznamy obsahujú slovenské znaky, na presné zachovanie
> použite export do CSV.

---

## 3. Pokladnica (e-Kasa)

Zákon č. 289/2008 Z. z. vyžaduje evidenciu všetkých hotovostných a
kartových platieb cez certifikovaný systém e-Kasa. OpenVPM podporuje:

- **FiskalPRO** (terminály VX520, N5, T2) — pripojenie cez LAN/REST
  k fyzickému terminálu v ambulancii
- **VRP2 (Virtuálna registračná pokladnica)** — cloudové riešenie bez
  fyzického hardvéru; vhodné pre menšie ambulancie

**Nastavenie**: Prejdite do **Nastavenia → e-Kasa** (`/settings/ekasa`).
Zadajte DIČ, IČ DPH (ak je relevantné), ID pokladnice a vyberte typ
terminálu. Uložte a spustite test pripojenia.

**Vydanie dokladu**: Po zaevidovaní platby kliknite na **Vydať e-Kasa
doklad**. Systém odošle dáta do FiskalPRO alebo VRP2, prijme unikátny
fiškálny UID a vytlačí alebo odošle doklad e-mailom.

**Podporované sadzby DPH**: ZERO (0 %), REDUCED_5 (5 %), REDUCED (10 %),
REDUCED_19 (19 %), STANDARD_23 (23 %).

**Denná uzávierka**: Na konci dňa prejdite do
**Fakturácia → e-Kasa → Denná uzávierka** a kliknite na **Spustiť
uzávierku**. Systém vygeneruje povinný denný súhrn.

**Storno dokladu**: Len rola Správca praxe alebo Veterinárny lekár.
Otvorte doklad e-Kasa a kliknite na **Stornovať doklad**. Uvediete
pôvodný fiškálny UID. Všetky storna sú zaznamenané v auditnom zázname.

**Offline odolnosť**: Ak je fiškálny systém nedostupný, doklady sa
ukladajú lokálne (`OFFLINE_STORED`) s kryptografickým kľúčom idempotentnosti
a synchronizujú sa automaticky po obnovení spojenia. Zákonná lehota je
**48 hodín** — po jej prekročení postupujte podľa metodického pokynu
Finančnej správy SR.

> **Stav integrácie**: Driver e-Kasa je plne implementovaný a otestovaný
> s hardvérom FiskalPRO a VRP2. Formálna certifikácia integrácie
> s Finančnou správou SR **prebieha**. Technický formát dokladov je
> konformný; certifikačný proces neovplyvňuje bežnú prevádzku drivera.

---

## 4. Predplatné a plány

Vaše predplatné OpenVPM spravujete v **Nastavenia → Fakturácia** (záložka
predplatného). Pre príjem online platieb kartou prepojte bankový účet cez
**Stripe Connect** — postupujte podľa inštrukcií v nastaveniach fakturácie.

Funkcie závislé od plánu (napr. Pokročilé reporty) sú dostupné podľa
vašej tarify. Váš aktuálny plán a dostupné funkcie vidíte v záhlaví
stránky nastavení fakturácie.

---

## 5. Účtovné exporty

Exportujte dáta faktúr a platieb pre účtovníka cez
**Nastavenia → Dáta → Exportovať CSV**. K dispozícii sú: faktúry (podľa
dátumového rozsahu), platobné záznamy a jednotlivé riadkové položky.

Špecializovaný účtovný export (uzávierka obdobia, rozpad DPH) nájdete v
**Nastavenia → Účtovný export**.

> ⚠️ **Slovenská diakritika — CSV vs PDF**: Exporty CSV zachovávajú všetky
> znaky presne. Exporty PDF konvertujú slovenskú diakritiku (č→c, š→s,
> ä→a). Na účtovné podania vždy používajte CSV.

---

Potrebujete pomoc? Napíšte na [hello@openvpm.com](mailto:hello@openvpm.com).
