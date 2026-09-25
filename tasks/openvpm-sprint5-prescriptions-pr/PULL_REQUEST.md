# Pull Request: Sprint 5 — Prescriptions & Medication Oversight, UI Kit Harmonization

**Branch:** `sprint-5/prescriptions-medication-oversight-ui-kit` → `main`
**Ticket:** TASK-OPENVPM-SPRINT-5 · **Risk:** `risk:prod` · **Packages:** `apps/web`
**Title (skratka):** `feat(web): harmonize /prescriptions with Dashboard UI Kit (Sprint 5)`

---

## Context / Why

Register dohľadu nad liečivami (`/prescriptions`) používal staré, nekonzistentné UI vzory:
vlastné `<Card>` KPI bloky, zastaraný `DataTable` komponent a surové Tailwind farby
(`text-emerald-*`, `text-amber-*`, `bg-sky-*`). Táto zmena harmonizuje stránku so
štandardom **Dashboard UI Kit** (`docs/UIKIT.md`, `@/components/layout/page-kit`)
a udržiava klinickú a legislatívnu zhodu (Zákon 39/2007 Z. z., Zákon 139/1998 Z. z.
o OPL, Clinical Guardian).

## Changes

| Súbor | Zmena |
|---|---|
| `apps/web/app/(dashboard)/prescriptions/page.tsx` | Kompletný refaktor na Page Kit hierarchiu (full-file replacement) |
| `apps/web/lib/__tests__/prescriptions-ui.test.ts` | Nový source-level kontraktový test (14 testov, vitest) |
| `apps/web/messages/sk.json` | **Merge fragment** — pridá uzol `prescriptions` (45 leaf kľúčov) |
| `apps/web/messages/en.json` | **Merge fragment** — symetrický uzol `prescriptions` (45 leaf kľúčov) |

### 1) `page.tsx` — Page Kit hierarchia

`PageHeader` (ikona `Pill`, titulok, jednoradkový podtitul, akcie `size="sm"`:
**Kniha OPL** → `/controlled-substances` + **Nový predpis**) →
`KpiGrid` so 4× `KpiCard` (Aktívne predpisy, Končia do {days} dní, Po termíne,
Strážca liekov — tone podľa `summary.criticalAlerts`/`openMedicationAlerts`) →
underline taby (`underlineTabsListClass`/`underlineTabsTriggerClass`) pre 6 rozsahov:
`active`, `ending`, `overdue`, `controlled`, `alerts`, `all` →
`PageToolbar` (`SearchField` + počítadlo `Výsledky: {count}` + ghost tlačidlo
**Vyčistiť filter**) → `DataTableFrame` s hustou tabuľkou
(`tableHeadClass`/`tableCellClass`/`tableRowClass`, názov lieku
`font-medium text-foreground text-xs`, Rx/dávkovanie/frekvencia/obdobie
`font-mono tabular-nums text-xs`, pacient · majiteľ v sekundárnom riadku s
`truncate` v `min-w-0`, akcie kompaktne `size="sm"` ghost).

- **Loading:** `TableSkeleton rows={10}` vo vnútri `DataTableFrame` (`listQuery.isLoading`).
- **Empty state:** `EmptyState` vo vnútri `DataTableFrame` s rozlíšením
  „Žiadne predpisy“ vs „Žiadne výsledky hľadania“ (akcia = vyčistenie hľadania).
- **Semantické tokeny (žiadne surové farby):**
  - Aktívne → `border-primary/40 bg-primary-muted text-primary-muted-foreground`
  - Končiace → `border-warning/40 bg-warning-muted text-warning-muted-foreground`
  - Po termíne → `border-destructive/40 bg-destructive-muted text-destructive-muted-foreground`
  - OPL / kritické výstrahy → `border-destructive/50 bg-destructive-muted text-destructive font-medium`
  - Warning výstrahy → `border-warning/40 bg-warning-muted text-warning-muted-foreground`

### 2) Klinické a legislatívne záruky

- **OPL (Zákon 139/1998 Z. z.):** `isControlled` položky získavajú OPL badge so
  `ShieldAlert` a preklik do `/controlled-substances` (Kniha OPL) + legislatívna
  päta pod tabuľkou. Žiadny AI prefill UI — OPL sa tu len zobrazuje (read-only).
- **Clinical Guardian:** KPI *Strážca liekov* číta `summary.openMedicationAlerts`,
  hint `summary.criticalAlerts`; per-item `guardianAlerts` sa renderujú ako
  semantické destructive/warning čipy (správa výstrahy v `title`).
- **Ochranná lehota** (withdrawal period) je samostatný stlpec tabuľky.
- **Sympathy Gate** (potlačenie pripomienok pri `deceased`) je backendová
  mantina tRPC/AI drafteru — stránka sa jej nedotýka, nie je v Scope.

### 3) Dáta výlučne z existujúcich dotazov (žiadna zmena kontraktov)

```ts
trpc.extensions.medicationOversight.summary.useQuery(undefined, { refetchInterval: 60_000 })
trpc.extensions.medicationOversight.list.useQuery({ scope, search, limit: 200, offset: 0 })
```

`list` sa defensive readuje ako `T[]` aj `{ items, total }` — behavior sa nemení
nezávisle od konkrétnej shape.

### 4) i18n — 100% symetria

Všetky texty cez `useI18n()`, žiadne hardcoded JSX reťazce. Uzol `prescriptions`
(45 leaf kľúčov) je v `sk.json` aj `en.json` listovo identický vrátane
placeholderov (`{days}`, `{count}`, `{query}`). Veterinárna terminológia:
„Dohľad nad liečivami“, „Kniha OPL“, „Ochranná lehota“, „Dávkovanie“.

## Verification

Spustené v izolovanom workspace (vitest 4.1.11, Node 20):

- ✅ `vitest run apps/web/lib/__tests__/prescriptions-ui.test.ts` — **14/14 passed**
  (Page Kit importy + poradie hierarchie, 4× KpiCard, underline tabs pre 6 scopes,
  `TableSkeleton`/`EmptyState` vo vnútri `DataTableFrame`, absence `<Card>` a
  `text-emerald-*`/`text-amber-*`/`bg-sky-*`, prítomnosť semantických tokenov,
  fixácia tRPC dotazov, OPL/Guardian pole, **100% leaf symetria SK/EN**,
  symetria placeholderov, rešolvovateľnosť všetkých 37 použitých kľúčov)
- ✅ Mutácia (odstránený EN kľúč / premenený `{days}`) → testy **fail** (nie sú vakuové)
- ✅ `tsc --strict` pre testový súbor — clean; `page.tsx` — syntakticky clean

Pred merge v reálnom repu spustiť:

```bash
pnpm --filter @openpims/web test prescriptions-ui
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
node apps/web/scripts/check-i18n-symmetry.js
```

## Acceptance Checklist (DoD)

- [x] Hierarchia `PageHeader → KpiGrid → underline tabs → PageToolbar → DataTableFrame → EmptyState`
- [x] Dáta výlučne z `medicationOversight.summary` (refetch 60 s) a `medicationOversight.list` (limit 200, offset 0)
- [x] Výlučne dizajnové tokeny — žiadne `text-emerald-*`, `text-amber-*`, `bg-sky-*`
- [x] Hustá tabuľka podľa specifikácie (mono/tabular-nums, truncate/min-w-0, `size="sm"` akcie)
- [x] Kniha OPL (`/controlled-substances`) + Clinical Guardian výstrahy plne funkčné
- [x] Unit test `prescriptions-ui.test.ts` prechádza (14/14 v workspace)
- [x] 100% i18n symetria, všetko cez `useI18n()`, 0 hardcoded reťazcov
- [ ] `pnpm --filter @openpims/web type-check` — **spustiť v reálnom repu** (viz Predpoklady)
- [ ] `pnpm --filter @openpims/web lint` (0 varovaní) — **spustiť v reálnom repu**

## Out of Scope (nespravené, zámerne)

- Žiadne zmeny `packages/db/schema/*.ts` ani `_journal.json`
- Žiadne zmeny tRPC routerov / backendových schém
- Žiadne zásahy do iných dashboard stránok (`/whiteboard`, `/encounters`,
  `/care-reminders`, `/billing`)
- Žiadne súbory mimo 4 povolených ciest

## ⚠️ Predpoklady na zladenie (jednoradičové, ak reálny rep líši)

1. **Typy tRPC outputu** — `OversightSummary`/`OversightItem` na vrchu `page.tsx`
   sú zrkadlo kontraktu. Mená `criticalAlerts` a `openMedicationAlerts` sú dané
   ticketom; ostatné polia (`active`, `endingSoon`, `overdue`, `endingWindowDays`,
   `prescriptionNo`, `medicationName`, `dosage`, `frequency`, `withdrawalDays`,
   `isControlled`, `patient/owner`, `guardianAlerts`) — pri rozdielne menovanej
   poli uprav **len tieto dva typy**, UI kód ani preklady sa nemenia.
2. **Import cesty** — `useI18n` z `@/hooks/use-i18n` (vracia `{ t, locale }`) a
   `trpc` z `@/trpc/react`; prispôsob reálnemu aliasu.
3. **Propy page-kit** — `PageHeader { icon, title, subtitle, actions }`,
   `KpiCard { icon, label, value, tone, hint }`, `EmptyState { icon, title,
   description, action }`, `TableSkeleton { rows }`.

## How to apply (kód bol generovaný bez prístupu k originálu)

```bash
# v kópii reálneho repu:
# 1) full-file replacement — 2 kórové súbory
cp <pr>/apps/web/app/(dashboard)/prescriptions/page.tsx apps/web/app/(dashboard)/prescriptions/page.tsx
cp <pr>/apps/web/lib/__tests__/prescriptions-ui.test.ts  apps/web/lib/__tests__/prescriptions-ui.test.ts

# 2) i18n — zlúčiť uzol "prescriptions" do existujúcich súborov (NIE prepis!):
jq --slurpfile src <pr>/apps/web/messages/sk.json '. + { prescriptions: $src[0].prescriptions }' \
   apps/web/messages/sk.json > /tmp/sk.json && mv /tmp/sk.json apps/web/messages/sk.json
jq --slurpfile src <pr>/apps/web/messages/en.json '. + { prescriptions: $src[0].prescriptions }' \
   apps/web/messages/en.json > /tmp/en.json && mv /tmp/en.json apps/web/messages/en.json

# 3) overenie
pnpm --filter @openpims/web test prescriptions-ui
pnpm --filter @openpims/web type-check
pnpm --filter @openpims/web lint
node apps/web/scripts/check-i18n-symmetry.js

# 4) commit + PR
git add -A && git commit -m "feat(web): harmonize /prescriptions with Dashboard UI Kit (Sprint 5)"
git push -u origin HEAD
gh pr create --base main --head sprint-5/prescriptions-medication-oversight-ui-kit \
  --title "feat(web): harmonize /prescriptions with Dashboard UI Kit (Sprint 5)" \
  --body "$(cat PULL_REQUEST.md)"
```

Alternatíva: patch `0001-feat-web-harmonize-prescriptions-with-Dashboard-UI-K.patch`
(pripravený v `pr-package/`) — pre plnú aplikáciu cez `git am` je potrebná
kópia originálnych verzií 4 súborov ako base; inak použite postup vyššie.
