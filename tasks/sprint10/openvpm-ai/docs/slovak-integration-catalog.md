# Slovak Veterinary Integration Catalog (Slovenský integračný katalóg)

Architektonická mapa integrácií a partnerov pre slovenské veterinárne kliniky. Každá integrácia má explicitne definovaný technický stav, komunikačný protokol, dátový formát a príslušné súbory v kódovej báze OpenVPM AI.

---

## 1. Veterinárne poisťovne (Pet Insurance)

Na slovenskom trhu je dominantným partnerom pre priame vyúčtovanie ošetrenia **PetExpert Slovensko** (v spolupráci s ČSOB Pojišťovnou / Generali / Union). Priame vysporiadanie (Direct Settlement) umožňuje majiteľovi zvieraťa uhradiť na klinike iba spoluúčasť (zvyčajne 10 %, min. 35 €), pričom zvyšných 90 % uhrádza poisťovňa priamo na bankový účet kliniky.

| Partner | Stav | Protokol / Formát | Dátový model & Kód | Funkcionalita |
|---|---|---|---|---|
| **PetExpert Slovensko** | **Implementované (v0.6)** | REST JSON (Partner API v2.1) + PDF report | `lib/insurance/petexpert.ts`<br>`routers/extensions/insurance.ts` | Validácia mikročipu (15 číslic ISO 11784/11785), kontrola exspirácie poistky, automatický výpočet spoluúčasti (10 % / min. 35 €), generovanie poistnej udalosti pri uzavretí vizity (`visit_closeouts`), oficiálne tlačivo pre likvidátora |
| **Generali Poistka Zvierat** | **Implementované (v0.6)** | Štruktúrovaný PDF / CSV export | `routers/extensions/insurance.ts` | Export položkového zoznamu úkonov, podaných liekov a klinickej správy s pečiatkou lekára |
| **Union Poisťovňa** | **Implementované (v0.6)** | Štruktúrovaný PDF / CSV export | `routers/extensions/insurance.ts` | Lekárska správa a rozpad nákladov pre preplatenie majiteľovi |

---

## 2. Veľkoobchody s veterinárnymi liekmi a tovarom (Wholesale Distributors)

Automatizovaný import elektronických dodacích listov (príjem na sklad) eliminuje manuálne prepisovanie šarží, expirácií a nákupných cien.

| Distribútor | Stav | Formát súboru | Parser v kódovej báze | Mapované polia |
|---|---|---|---|---|
| **CYMEDICA SK s.r.o.** | **Implementované (v0.6)** | CSV / Semicolon-delimited | `lib/inventory/wholesaler-import.ts` | Kód tovaru, Názov liečiva, **Číslo šarže (Lot)**, **Dátum exspirácie**, Množstvo, MJ, Nákupná cena bez DPH, Sadzba DPH (10 % pre liečivá) |
| **PHARMOS a.s.** | **Implementované (v0.6)** | EDI / CSV | `lib/inventory/wholesaler-import.ts` | ADC / ŠUKL kód, Názov lieku, Šarža, Expirácia, Dodané množstvo, Veľkoobchodná nákupná cena |
| **SAMOHÝL SK, s.r.o.** | **Implementované (v0.6)** | CSV s EAN kódmi | `lib/inventory/wholesaler-import.ts` | **EAN čiarový kód (13 číslic)**, Názov veterinárnej diéty / prípravku, Množstvo, Nákupná cena |
| **Henry Schein SK** | **Implementované (v0.6)** | CSV / Tab-delimited | `lib/inventory/wholesaler-import.ts` | Katalógové číslo materiálu, Názov chirurgického spotrebného materiálu, Množstvo, Nákupná cena |
| **Univerzálny dodávateľ** | **Implementované (v0.6)** | Štandardné CSV | `lib/inventory/wholesaler-import.ts` | Názov položky, Množstvo, Nákupná cena, DPH |

---

## 3. Laboratórne analyzátory a in-house diagnostika

Klinické biochemické a hematologické analyzátory priamo na pracovisku. Výsledky sa automaticky parsujú, overujú voči fyziologickým referenčným rozsahom (canine/feline) a ukladajú do elektronického zdravotného záznamu pacienta.

| Zariadenie | Stav | Typ pripojenia | Modul v kódovej báze | Podporované analyty |
|---|---|---|---|---|
| **IDEXX Catalyst One / Dx** | **Implementované (v0.6)** | ASTM / CSV / Serial-to-REST bridge | `lib/lab/analyzer-parser.ts`<br>`routers/extensions/lab-import.ts` | Kompletná biochémia: ALT, AST, ALP, GGT, UREA, CREA, GLU, TBIL, TP, ALB, GLOB, Ca, PHOS, Cholesterin, Amyláza, Lipáza |
| **IDEXX ProCyte Dx / LaserCyte** | **Implementované (v0.6)** | CSV / REST bridge | `lib/lab/analyzer-parser.ts` | Hematológia s diferenciálom: WBC, RBC, HGB, HCT, MCV, MCH, MCHC, PLT, Neu, Lym, Mono, Eos, Baso |
| **Fuji Dri-Chem NX500 / NX700** | **Implementované (v0.6)** | ASTM E1394 / CSV | `lib/lab/analyzer-parser.ts` | Suchá chémia (ALT, ALP, BUN, CRE, GLU, TP, ALB, TBIL, IP, Ca, Mg, CRP) |
| **Mindray BC-Vet (BC-2800 / 30)** | **Implementované (v0.6)** | HL7 / Mircosoft Excel / CSV | `lib/lab/analyzer-parser.ts` | 3-part / 5-part hematológia malých zvierat |
| **scil Vet abc Plus** | **V pláne (v0.7)** | RS-232 / CSV | `routers/extensions/lab-import.ts` | Hematologický analyzátor |

---

## 4. Externé referenčné laboratóriá

Špecializovaná diagnostika (histológia, genetika, mikrobiológia, sérológia, titrácia protilátok besnoty).

| Laboratórium | Stav | Formát | Integrácia | Poznámka |
|---|---|---|---|---|
| **Laboklin SK / DE** | **Pripravené (v0.6)** | HL7 v2.5 / PDF email connector | `lib/lab/*`, `server/routers/extensions/lab-import.ts` | Párovanie výsledkov podľa čísla žiadanky / mikročipu pacienta |
| **Synlab SK** | **Pripravené (v0.6)** | HL7 / XML | `routers/extensions/lab-import.ts` | Laboratórny import a automatická notifikácia veterinára |
| **Štátny veterinárny a potravinový ústav (ŠVÚ Zvolen / Bratislava)** | **Pripravené (v0.6)** | Oficiálny nález PDF / XML | `routers/extensions/statutory.ts` | Úradné rozbory nákaz (besnota TIRC, trichinelóza, brucelóza, africký mor ošípaných AMO) pre KVEPIS |

---

## 5. Štátne registre a legislatívny compliance (Zákon 39/2007, 139/1998)

| Systém | Inštitúcia | Zákonný základ | Implementácia v OpenVPM | Stav |
|---|---|---|---|---|
| **KVEPIS** | ŠVPS SR | Zákon č. 39/2007 Z.z. | `lib/kvepis/builder.ts`<br>`lib/kvepis/validator.ts`<br>`/statutory/kvepis` | **Implementované (v0.6)**<br>Validačný motor voči oficiálnej XSD schéme ŠVPS, generovanie ambulantnej knihy a hlásenia chorôb |
| **CRSZ** | KVL SR / ŠVPS SR | Zákon č. 39/2007 Z.z. § 19 | `lib/crsz/microchip.ts`<br>`routers/extensions/crsz.ts` | **Implementované (v0.6)**<br>Overenie ISO 11784/11785 čipov, generovanie potvrdenia o registrácii, hromadný KVL SR CSV/XML export |
| **CEHZ** | Plemenárske služby SR | Zákon č. 39/2007 Z.z. | `lib/kvepis/validator.ts` | **Implementované (v0.6)**<br>Evidencia a validácia 6-miestnych kódov fariem pre hospodárske zvieratá a ochranné lehoty |
| **ÚPVS / Slovensko.sk** | MIRRI SR | Zákon č. 305/2013 Z.z. | `lib/kvepis/builder.ts` | **Implementované (v0.6)**<br>Generovanie GovBox XML obálky pre elektronické schránky s podporou kvalifikovaného podpisu |

---

## 6. e-Kasa a platobné terminály (Zákon č. 289/2008 Z.z.)

| Zariadenie / Služba | Certifikácia | Architektúra | Modul v kódovej báze | Podporované operácie |
|---|---|---|---|---|
| **FiskalPRO** (VX520, VX675, N5, T2) | Certifikované CHDÚ (Finančná správa SR) | LAN / REST / USB Driver | `lib/ekasa/drivers/fiskalpro.ts`<br>`routers/extensions/ekasa.ts` | Tlač pokladničného dokladu, úhrada faktúry, vklad/výber, storno dokladu, denná/mesačná uzávierka, offline front s idempotenciou |
| **e-Kasa VRP2** | Finančná správa SR | REST API VRP2 | `lib/ekasa/drivers/vrp2.ts` | Virtuálna registračná pokladnica pre menšie ambulancie |
| **Nexi / Slovenská sporiteľňa / ČSOB POS** | EMV / Contactless | Prepojenie cez FiskalPRO COM/LAN | `lib/ekasa/*` | Automatické odoslanie sumy na platobný terminál pri voľbe platby kartou |

---

## 7. Klientsky portál & Mobilná PWA

Plne responzívna klientska webová aplikácia dostupná na `/portal` s podporou offline inštalácie (PWA) na iOS a Android:
- Online rezervácia termínu (`/portal/book`)
- Digitálny očkovací preukaz s termínmi revakcinácie (`/portal/[token]/pets`)
- Prehľad a stiahnutie faktúr s možnosťou online platby (`/portal/[token]/invoices`)
- Bezpečné správy a zasielanie fotografií (`/portal/[token]/messages`)
- Bezheslový prístup cez Magic Links / SMS overenie
