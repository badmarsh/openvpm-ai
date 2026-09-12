# Dátová suverenita & retenčná matica (Slovenská republika)

> **Právne predpisy:** Zákon č. 39/2007 Z. z. (veterinárna starostlivosť),
> Zákon č. 139/1998 Z. z. (omamné a psychotropné látky), Zákon č. 431/2002 Z. z.
> (účtovníctvo), Zákon č. 18/2018 Z. z. (ochrana osobných údajov), GDPR.

---

## 1. Retenčná matica

| Kategória údajov | Doba uchovávania | Právny základ | Po uplynutí |
|---|---|---|---|
| Zdravotná dokumentácia zvierat | **10 rokov** | Zákon č. 39/2007 Z. z. | anonymizácia / výmaz |
| Register omamných a psychotropných látok | **10 rokov** | Zákon č. 139/1998 Z. z. | výmaz |
| Účtovné a daňové doklady (e-Kasa) | **10 rokov** | Zákon č. 431/2002 Z. z. | výmaz |
| Kniha besnoty / RVPS hlásenia | **10 rokov** | Zákon č. 39/2007 Z. z. | výmaz |
| KVEPIS podania a doručenky | **10 rokov** | Zákon č. 39/2007 Z. z. | výmaz |
| Audit trail (audit_log, AI ledger) | 10 rokov (s právnym záznamom) | čl. 5(2) GDPR, § 39 zák. 18/2018 | výmaz |
| Audio nahrávky hlasového diktátu | **max. 24 hodín** (automatický výmaz) | minimalizácia údajov (čl. 5(1)(c) GDPR) | automatický výmaz |

> **Audio diktát:** prepis sa ukladá ako text; surové audio sa automaticky
> maže do 24 hodín od vytvorenia (implementované v `lib/voice` a
> `schema/ext_voice.ts`).

---

## 2. Dátová suverenita (lokalizácia dát)

| Vrstva | Lokalita | Poznámka |
|---|---|---|
| Databáza (PostgreSQL) | EÚ (Supabase / Frankfurt) | RLS tenant izolácia |
| Objektové úložisko (súbory, zálohy) | EÚ (AWS eu-central-1) | AES-256, versioning |
| AI inferencia | EÚ/US API, **Zero Data Retention** | žiadne trénovanie na dátach klientov |
| e-Kasa / KVEPIS | SK (Finančná správa SR, ÚPVS) | štátne systémy |

## 3. Zabezpečenie (technické opatrenia)

- **V tranzite:** TLS 1.3 (povinné), HSTS, certificate pinning pre štátne API.
- **V pokoji:** AES-256 pre objektové úložisko a zálohy; šifrované heslá
  (bcrypt), šifrované certifikáty/tokeny (digest-only storage).
- **Izolácia nájomníkov:** Row-Level Security (`practice_id`), každý dopyt
  tenant-scoped cez `withTenant`/`withSystem`.
- **Prístupy:** RBAC (admin / veterinarian / technician / front_desk / viewer),
  MFA-ready, session versioning.

## 4. Práva dotknutých osôb a portál

- Klient má prístup k údajom svojich zvierat cez klientsky portál
  (token/relácia viazaná na klienta).
- Právo na prístup, opravu, výmaz a prenosnosť sa realizuje cez podporu +
  administrátorské nástroje; výmaz rešpektuje zákonné retenčné lehoty (údaje,
  ktoré zákon vyžaduje uchovávať 10 rokov, sa nevykonajú, ale obmedzí sa ich
  spracúvanie).

## 5. Register subprocesorov

Zhodný s Prílohou A dokumentu `DPA_SLOVAKIA.md`. Zmeny subprocesorov podliehajú
oznamovacej povinnosti voči prevádzkovateľovi.
