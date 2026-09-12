# Data Classification Policy

**Issue:** P0-L05<br>
**Version:** 1.0-draft<br>
**Status:** Technicky implementované v aktuálnom release candidate; **formálne schválenie DPO/právnikom/vlastníkom systému je otvorené**.<br>
**Scope:** PostgreSQL/Supabase tenant data in OpenVPM AI<br>
**Effective date:** Nenadobudla účinnosť bez schválenia

> Tento dokument nie je právne stanovisko ani potvrdenie GDPR compliance. Je
> technickým návrhom klasifikácie a minimálnych ochranných opatrení, ktorý musí
> schváliť prevádzkovateľ, DPO a podľa potreby právny poradca pred použitím na
> reálnych údajoch.

## 1. Cieľ a princípy

Klasifikácia určuje minimálnu úroveň zaobchádzania s údajom. Nenahrádza:

- tenant izoláciu pomocou `practice_id` a PostgreSQL RLS,
- RBAC a autorizáciu jednotlivých API procedúr,
- šifrovanie, správu tajomstiev, retention policy ani incident response,
- povinnosť mlčanlivosti veterinárneho personálu.

Predvolené pravidlo je **klasifikovať vyššie, ak existuje pochybnosť**. Zníženie
klasifikácie nesmie vykonať bežná request cesta aplikácie.

## 2. Úrovne citlivosti

| Label | Význam | Minimálne zaobchádzanie |
|---|---|---|
| `PUBLIC` | Údaj určený na verejné zverejnenie bez väzby na osobu, pacienta alebo klinický prípad. | Overené zverejnenie; žiadne tajomstvá ani identifikátory. |
| `INTERNAL` | Prevádzkový údaj určený iba pre OpenVPM a poverený personál. | Authenticated access, tenant scope, redakcia v logoch. |
| `CONFIDENTIAL` | Osobné, kontaktné, zmluvné alebo obchodné údaje, ktorých únik môže poškodiť majiteľa alebo kliniku. | Tenant RLS, RBAC, TLS, private storage, minimizácia a audit prístupov. |
| `STRICTLY_CONFIDENTIAL` | Zdravotná/klinická dokumentácia zvieraťa, diagnostika, liečba, AI vstupy/výstupy, identifikátory pacienta a údaje s vysokým dopadom úniku. | Všetky opatrenia vyššie; prísne need-to-know, zákaz verejných exportov, osobitná retention a kontrola externých procesorov. |

## 3. Mapovanie doménového modelu

OpenVPM v aktuálnom modeli používa tieto názvy:

| Požadovaný pojem | Aktuálna tabuľka | Predvolený label | Poznámka |
|---|---|---|---|
| Owner / majiteľ zvieraťa | `clients` | `CONFIDENTIAL` | `clients` je canonical owner/client model. |
| Patient / zviera | `patients` | `STRICTLY_CONFIDENTIAL` | Identita zvieraťa, mikročip a väzba na majiteľa. |
| Encounter header / vizita | `appointments` | `STRICTLY_CONFIDENTIAL` | Samostatná tabuľka `encounters` v aktuálnom release neexistuje; UI route `/encounters` pracuje s appointment ID. |
| Encounter clinical detail | `soap_notes` | `STRICTLY_CONFIDENTIAL` | Zahŕňa aj koncepty/drafty pred finalizáciou. |

Migrácia `packages/db/drizzle/0107_data_classification_labels.sql` pridáva
`data_sensitivity_level` ako PostgreSQL enum a `NOT NULL` default do všetkých
vyššie uvedených tabuliek. Historické riadky dostanú bezpečný default počas
migrácie; neexistuje tiché zníženie klasifikácie.

## 4. Technické pravidlá

1. Každý nový klinický alebo osobný model musí mať klasifikáciu zdokumentovanú
   v code review. Ak je model odvodený z pacienta alebo vizity, dedí minimálne
   `STRICTLY_CONFIDENTIAL`, pokiaľ schválený model neurčí prísnejšie pravidlo.
2. `data_sensitivity_level` nie je filtrovanie prístupu. Každý query path musí
   naďalej používať `practice_id`, RLS a autorizáciu.
3. PostgreSQL RLS policy `tenant_isolation` sa uplatňuje aj na klasifikované
   tabuľky. V `packages/db/rls/enable-rls.sql` je explicitne zdokumentované,
   že label nesmie obísť tenant boundary.
4. Trigger `prevent_data_sensitivity_downgrade()` povoľuje hosted app role iba
   zvýšiť citlivosť. Downgrade vyžaduje owner-controlled migration alebo
   zdokumentovanú maintenance operáciu.
5. Logy, alerty, exporty a AI prompt payloady nesmú obsahovať surové hodnoty
   `STRICTLY_CONFIDENTIAL`, ak to nie je nevyhnutné pre autorizovaný účel.
6. Externý prenos klinického obsahu je povolený až po overení procesora, DPA,
   lokality spracovania a kill-switchu; tento dokument sám o sebe taký prenos
   neschvaľuje.

## 5. Dôkazy a testy

- Schema source: `packages/db/schema/data-classification.ts` a stĺpce v
  `clients.ts`, `patients.ts`, `scheduling.ts`, `clinical.ts`.
- SQL migration: `packages/db/drizzle/0107_data_classification_labels.sql`.
- RLS contract: `packages/db/rls/enable-rls.sql`.
- Unit/static contract: `apps/web/lib/__tests__/data-classification.test.ts`.
- PostgreSQL/RLS integration contract: `packages/db/test-data-classification.ts`.
- CI execution: RLS job in `.github/workflows/ci.yml`.

Technický test dokazuje defaulty, enum boundary, cross-tenant visibility a
zákaz downgrade-u cez `openpims_app`. Nepredstavuje právne schválenie politiky.

## 6. Schválenie a zodpovednosti

Pred označením P0-L05 ako **Done** musia byť mimo kódu priložené:

- schválená verzia tejto politiky s dátumom účinnosti,
- určený vlastník klasifikácie a DPO/zástupca,
- potvrdenie mapovania retention lehôt a exportných pravidiel,
- review dopadu na klinický audit, AI providery a incident response.

Do získania týchto podpisov je stav issue:

> **Technically implemented — pending policy approval / institutional evidence**

## 7. Zostatkové riziko

- Klasifikácia nemeria automaticky význam každého textového poľa; nové tabuľky
  môžu dočasne zostať bez explicitného labelu, kým neprejdú code review.
- Existing self-host deployments must apply migration 0107 and re-run
  `pnpm db:rls`; otherwise the database may not have the downgrade trigger or
  least-privilege RLS role configured.
- PostgreSQL owner/superuser can bypass trigger/RLS. Také operácie musia byť
  obmedzené na migration/maintenance credentials a auditované prevádzkovateľom.
