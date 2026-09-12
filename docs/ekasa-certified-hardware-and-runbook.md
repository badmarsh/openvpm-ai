# e-Kasa: Certifikovaný hardvér & prevádzkový runbook

> **Právny rámec:** Zákon č. 289/2008 Z. z. o používaní elektronickej
> registračnej pokladnice (v znení Zákona č. 384/2025 Z. z.) a metodické
> usmernenia Finančnej správy SR.

---

## 1. Prioritizácia certifikovaného hardvéru (Tier-1)

| Priorita | Zariadenie / služba | Integrácia v OpenVPM | Rozhranie |
|---|---|---|---|
| **Tier-1** | **FiskalPRO** (terminály + eKasa Box) | `lib/ekasa/driver.ts` → `FiskalProDriver` | LAN TCP/REST, port 8080/8443 |
| **Tier-1** | **VRP2** (cloud Finančná správa SR) | `lib/ekasa/driver.ts` → `Vrp2Driver` | Cloud API FS SR |
| Tier-2 | **Elcom Euro-50/150** | `lib/ekasa/driver.ts` → `ElcomDriver` | POS REST server (serial-to-REST bridge) |
| Tier-2 | **Varos FT4000** | `resolveFiscalDriver()` (slot pripravený) | tbd |

> **Odporúčanie:** Pre fyzické ambulancie zaviesť **FiskalPRO** ako natívny
> Tier-1 driver; pre multi-clinic SaaS nasadenie použiť **VRP2** (žiadny lokálny
> hardvér, centrálna správa pokladníc).

---

## 2. Testovacie scenáre (povinné pred GO-LIVE)

### 2.1 Výpadok internetu — 48-hodinová offline lehota
- **Podmienka:** `offlineModeEnabled=true`, doklad sa uloží so stavom
  `OFFLINE_STORED`.
- **Overenie:** po obnovení spojenia sa doklad odošle a získa UID; OKP/PKP
  zostávajú nemenné.
- **Hranica:** 48 hodín — po prekročení je potrebné postupovať podľa
  metodického pokynu FS SR (dodatočné oznámenie daňovému úradu).

### 2.2 Zlyhanie tlače / chýbajúci papier
- `getStatus()` reportuje `paperOk=false` → blokovanie nového dokladu a
  notifikácia obsluhy. Náhradný režim: elektronický doklad + neskoršia dotlač.

### 2.3 CHDU (fiškálna pamäť) plná / porucha
- `getStatus()` reportuje `chduMemoryOk=false` → okamžitá servisná eskalácia,
  zákaz predaja cez danú pokladnicu do odstránenia poruchy.

### 2.4 Storno dokladu s väzbou na pôvodný UID
- Storno je povolené len pre rolu `admin` / `veterinarian`
  (`assertCanVoidReceipt`).
- Povinná referencia `originalReceiptUid` (pôvodný UID z FR SR).
- Výnimka: offline uložený doklad sa viaže na pôvodné číslo dokladu.

### 2.5 Oprava položky / vrátenie lieku na sklad
- `RETURN` opravný doklad nesie položky so záporným množstvom → skladové
  hospodárstvo prijme vrátené kusy (rekonciliácia podľa `items`).

---

## 3. Firmvéry a certifikáty

- FiskalPRO: použiť len firmvér certifikovaný pre e-Kasa klient (verzia podľa
  výrobcu), certifikát pokladnice z FS SR v `ekasa_config.cert_base64`.
- PKP (Podpisový kód podnikateľa) sa v produkcii počíta RSA-SHA256 privátnym
  kľúčom certifikátu FS SR — `generatePkp()` v `lib/ekasa/service.ts`.
- OKP (Overovací kód podnikateľa) — SHA-1, formát
  `DIC|pokladnicaId|receiptNumber|issuedAt|amountTotal`.

---

## 4. Opatrenia bezpečnosti

- SSRF guard: povolené sú len HTTPS hosty Finančnej správy
  (`lib/ekasa/fiscal.ts` — `isAllowedEkasaApiUrl`).
- LAN drivery (FiskalPRO/Elcom) komunikujú len s lokálnymi adresami terminálov.
- Všetky kľúče/certifikáty uložené šifrovane; nikdy nie v logoch ani audit
  záznamoch (redakcia tajomstiev v `lib/audit.ts`).
