# Slovak Integration Catalog

Architektonická mapa integrácií pre slovenské veterinárne kliniky. Každá
integrácia má označený stav: **implementované**, **v pláne (fáza 2)**, alebo
**na vyžiadanie**.

---

## 1. Analyzátory a diagnostické prístroje

| Prístroj | Konektor | Stav | Poznámka |
|---|---|---|---|
| IDEXX VetLab Station | tRPC konektor + lokálny serial-to-REST bridge | v pláne | výsledky ako lab-result záznam |
| Fuji Dri-Chem NX500 | lokálny bridge | v pláne | |
| scil Vet abc Plus | lokálny bridge | v pláne | hematológia |

Architektúra: prístroj → lokálny serial/USB-to-REST bridge (na klinike) →
`apps/web/server/routers/extensions/lab-import.ts` → párovanie s pacientom.

## 2. Veterinárne laboratóriá

| Laboratórium | Formát | Stav | Párovanie |
|---|---|---|---|
| Laboklin | HL7 / PDF | v pláne | podľa čísla vzorky / čipu |
| Synlab | HL7 / PDF | v pláne | podľa čísla vzorky / čipu |
| ŠVÚ (Zvolen / Bratislava) | HL7 / PDF | na vyžiadanie | podľa čísla vzorky / čipu |

Automatické párovanie výsledkov je riešené v `lib/lab` a
`server/routers/extensions/lab-import.ts`.

## 3. Registre a štátne systémy

| Systém | Účel | Integrácia | Stav |
|---|---|---|---|
| **KVEPIS** (ŠVPS SR) | zákonné hlásenia | `lib/kvepis/*`, `/statutory/kvepis` | fáza 1 (Guided Hub), fáza 2 (B2G) |
| **CRSZ** (Centrálny register spoločenských zvierat) | registrácia čipov | `lib/crsz`, `extensions/crsz.ts` | implementované |
| **CEHZ** (Centrálna evidencia hospodárskych zvierat) | evidencia chovov | validačné pole v `lib/kvepis/validator.ts` | fáza 1 (validácia), fáza 2 (API) |
| **ÚPVS** (Ústredný portál verejnej správy) | elektronické schránky, doručenky | `lib/kvepis/builder.ts`, GovBox obálka | fáza 1 (XML), fáza 2 (B2G brána) |

## 4. Platobné terminály

| Poskytovateľ | Integrácia | Stav |
|---|---|---|
| FiskalPRO | `FiskalProDriver` (LAN/REST) | Tier-1 |
| Nexi | cez platebný terminál + e-Kasa | v pláne |
| ČSOB / Tatra banka POS | cez POS bránu | v pláne |

## 5. Poisťovne zvierat

| Poisťovňa | Integrácia | Stav |
|---|---|---|
| PetExpert Slovensko | automatický export poistnej udalosti z uzavretej návštevy | v pláne |

Export poistnej udalosti: po uzavretí návštevy (`visit_closeouts`) sa vygeneruje
štruktúrovaný podklad (diagnózy, výkony, faktúra) pre poisťovňu; odoslanie
vždy vyžaduje súhlas klienta (consent).

---

## 6. Referencie XSD / formátov

- KVEPIS: menný priestor `https://www.svps.sk/kvepis/schemas/submission/v1`
  (verziu XSD pripnúť pred produkciou — pozri `lib/kvepis/builder.ts`).
- UPVS GovBox: obálka XML + doručenka (ZEP / ASiC-E).
- e-Kasa VRP2: API Finančnej správy SR.
