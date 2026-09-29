# NAV-RESTRUCTURE-PROPOSAL

**Commit:** `65e008d` | **Date:** 2026-09-14

This document is the single proposed nav tree. Every one of the ~44 inventoried nav-reachable destinations is accounted for — none dropped silently. Format: before/after trees, then concrete target structure suitable for informing a `custom-nav.ts` / `sidebar.tsx` refactor.

---

## Before (Current State)

```
📌 Prehľad                                    [all roles]

──── KLINIKA & PACIENTI ────────────────────────────────
  🐾 Pacienti                                 [all]
  📄 Záznamy                                  [all]
  🔬 Vyšetrenia                               [all]
  🧪 Laboratórium                             [all]
  🔔 Zdravotné pripomienky                    [all]
  💉 Pripomienky                              [admin/vet/front_desk]
  🖼️ Analýza Snímkov           [AI]           [admin/vet]          ← custom

──── RECEPCIA & TOK ────────────────────────────────────
  📅 Rozvrh                                   [all]
  📺 Čakáreň                                  [all]
  📋 Prevádzková tabuľa                       [all]
  👤 Klienti                                  [all]
  💬 Správy                                   [admin/vet/tech/front_desk]

──── LEKÁREŇ & SKLAD ───────────────────────────────────
  📦 Sklad                                    [all]
  ⚠️ Omamné látky                             [admin/vet]

──── ÚČTOVNÍCTVO & PREDPISY ────────────────────────────
  🧾 Fakturácia                               [all]
  📗 Zákonné registre                         [admin/vet]
  📊 Prehľady                                 [admin/vet]
  🧾 e-Kasa Doklady                           [admin/vet/front_desk] ← custom

──── SPRÁVA & MANAŽMENT ────────────────────────────────
  🏢 Platform Admin                           [admin]
  ⚙️ Nastavenia                               [admin]
  🤖 Agent                      [AI]          [admin/vet]
  📣 Marketingové Štúdio                      [admin/vet/front_desk] ← custom
  🎨 Brand Kit                                [admin/vet]            ← custom
  📅 Plán obsahu                              [admin/vet/front_desk] ← custom
  ✅ Schvaľovanie obsahu                      [admin/vet/front_desk] ← custom
  ⭐ Recenzie                                 [admin/vet/front_desk] ← custom
  📄 Letáky                                   [admin/vet/front_desk] ← custom
  💬 Správy & SMS                             [admin/vet/front_desk] ← custom
  🌐 Web kliniky                              [admin/vet]            ← custom
  📺 Čakáreň TV                               [admin/vet/front_desk] ← custom
  ⚡ Automatizácie                            [admin/vet]            ← custom
  🛡️ Centrum potlačení                       [admin/vet]            ← custom
  📋 Súhlasy & skripty                        [admin/vet/front_desk] ← custom
  🖼️ Knižnica médií                           [admin/vet/front_desk] ← custom
  ❤️ Čerpanie benefitov                       [admin/vet/front_desk] ← custom
  🎤 Hlasové Diktovanie         [AI]          [all]                  ← custom
  📝 Prepúšťacie Správy         [AI]          [admin/vet/tech/front_desk] ← custom
  🏢 Vet Intelligence           [AI]          [admin/vet]            ← custom
  🎧 Vzdialená Podpora                        [all]                  ← custom
  🔒 Admin Podpora              [Support]     [admin]                ← custom
  📋 Pilotná Reconciliácia      [Pilot]       [all]                  ← custom
```

**Total visible nav items for admin role: ~44**

---

## After (Proposed State)

```
📌 Prehľad                                    [all roles]

──── KLINIKA & PACIENTI ────────────────────────────────
  🐾 Pacienti                                 [all]
  📄 Klinická karta (was: Záznamy)            [all]
      └─ [integrated] vitals snapshot widget
      └─ [integrated] active treatment plans widget
  🔬 Vyšetrenia                               [all]
      └─ [new tab] Snímky & AI analýza        [admin/vet]
          (was: Analýza Snímkov — nested)
      └─ [new tab] Lab výsledky               [all]
          (cross-reference from lab-results)
      └─ [closeout action] Prepúšťacia správa [admin/vet/tech/front_desk]
          (was: Prepúšťacie Správy — nested)
  🧪 Lab výsledky (was: Laboratórium)         [all]
  🔔 Preventívna starostlivosť                [all]
      (was: Zdravotné pripomienky)
      └─ [new tab] Hromadný recall            [admin/vet/front_desk]
          (was: Pripomienky — nested)
  🎤 Hlasové Diktovanie         [AI]          [all]
      (moved from Admin section → Clinical)

──── RECEPCIA & TOK ────────────────────────────────────
  📅 Rozvrh                                   [all]
  📺 Čakáreň                                  [all]
  📋 Prevádzková tabuľa                       [all]
      └─ [integrated] invoice status badge
  👤 Klienti                                  [all]
      └─ [integrated] wellness benefit balance
  💬 Správy (inbox)                           [admin/vet/tech/front_desk]
  ❤️ Čerpanie benefitov                       [admin/vet/front_desk]
      (moved from Admin/Marketing → frontDesk)

──── LEKÁREŇ & SKLAD ───────────────────────────────────
  📦 Sklad                                    [all]
  ⚠️ Omamné látky                             [admin/vet]

──── ÚČTOVNÍCTVO & PREDPISY ────────────────────────────
  🧾 Fakturácia                               [all]
  🧾 e-Kasa Doklady                           [admin/vet/front_desk]
  📗 Zákonné registre                         [admin/vet]
      └─ [new tab] AI Audit Log
  📊 Prehľady                                 [admin/vet]

──── MARKETING ─────────────────────────────────────────
  📣 Marketingové Štúdio                      [admin/vet/front_desk]
      └─ [tab] Prehľad (overview dashboard)
      └─ [tab] Kalendár
          (was: Plán obsahu — merged)
      └─ [tab] Schvaľovanie
          (was: Schvaľovanie obsahu — merged)
      └─ [tab] Analýza konkurencie            [admin/vet]
          (was: Vet Intelligence — nested)
  ⭐ Recenzie                                 [admin/vet/front_desk]
  📄 Letáky                                   [admin/vet/front_desk]
  💬 Kampane & SMS                            [admin/vet/front_desk]
      (was: Správy & SMS — renamed)
  🌐 Web kliniky                              [admin/vet]
  📺 Čakáreň TV                               [admin/vet/front_desk]
  ⚡ Automatizácie                            [admin/vet]
      └─ [tab] Pravidlá & Cesty
      └─ [tab] Kanály (OAuth connections)
      └─ [tab] Centrum potlačení
          (was: Centrum potlačení — nested)
  📋 Skripty recepcie                         [admin/vet/front_desk]
      (was: Súhlasy & skripty — split; templates → Settings)
  🖼️ Knižnica médií                           [admin/vet/front_desk]

──── SPRÁVA & MANAŽMENT ────────────────────────────────
  🏢 Platform Admin                           [admin]
      └─ [tab] AI Audit Log
      └─ [tab] Reconciliácia (during pilot)   [admin]
          (was: Pilotná Reconciliácia — nested+restricted)
  ⚙️ Nastavenia                               [admin]
      └─ [existing tabs…]
      └─ [new tab] Branding                   ← was: Brand Kit nav item
      └─ [new tab] Integrácie                 ← e-Kasa device config, channel OAuth
      └─ [new tab] Komunikácia                ← recall schedule config
      └─ [new tab] Klinické protokoly         ← consent form templates
  🤖 Agent                      [AI]          [admin/vet]
  🎧 Vzdialená Podpora                        [all]

  ~~Admin Podpora~~             [REMOVED FROM NAV]
```

**Total visible nav items for admin role: ~32** (down from ~44)
**Net reduction: 12 items** removed from nav (nested, merged, or moved to Settings)

---

## Item-by-Item Accounting (Every module accounted for)

| Module | Before | After |
|---|---|---|
| Prehľad | Top-level | ✅ Unchanged |
| Pacienti | Clinical | ✅ Unchanged |
| Záznamy | Clinical | 🔄 Renamed → Klinická karta; enhanced with widgets |
| Vyšetrenia | Clinical | ✅ Unchanged (gains 2 tabs + closeout action) |
| Laboratórium | Clinical | 🔄 Renamed → Lab výsledky; kept standalone |
| Zdravotné pripomienky | Clinical | 🔄 Renamed → Preventívna starostlivosť; gains Hromadný recall tab |
| Pripomienky | Clinical | 📥 Nested → tab inside Preventívna starostlivosť |
| Analýza Snímkov | Clinical (custom) | 📥 Nested → tab inside Vyšetrenia |
| Rozvrh | Front Desk | ✅ Unchanged |
| Čakáreň | Front Desk | ✅ Unchanged |
| Prevádzková tabuľa | Front Desk | ✅ Unchanged (gains invoice badge) |
| Klienti | Front Desk | ✅ Unchanged (gains wellness widget) |
| Správy (inbox) | Front Desk | ✅ Unchanged |
| Sklad | Pharmacy | ✅ Unchanged |
| Omamné látky | Pharmacy | ✅ Unchanged |
| Fakturácia | Billing | ✅ Unchanged |
| Zákonné registre | Billing | ✅ Unchanged (gains AI Audit tab) |
| Prehľady | Billing | ✅ Unchanged |
| e-Kasa Doklady | Billing (custom) | ✅ Unchanged in nav; device config → Settings |
| Platform Admin | Admin | ✅ Unchanged (gains Audit + Reconciliation tabs) |
| Nastavenia | Admin | ✅ Unchanged (gains 4 new tabs) |
| Agent | Admin | ✅ Unchanged |
| Marketingové Štúdio | Admin (custom) | 🔄 Promoted to own section; gains tabs (plan, queue, vet intel) |
| Brand Kit | Admin (custom) | 📤 Moved → Settings > Branding |
| Plán obsahu | Admin (custom) | 📥 Merged → tab inside Marketingové Štúdio |
| Schvaľovanie obsahu | Admin (custom) | 📥 Merged → tab inside Marketingové Štúdio |
| Recenzie | Admin (custom) | 🔄 Moved to Marketing section |
| Letáky | Admin (custom) | 🔄 Moved to Marketing section |
| Správy & SMS | Admin (custom) | 🔄 Renamed → Kampane & SMS; moved to Marketing |
| Web kliniky | Admin (custom) | 🔄 Moved to Marketing section |
| Čakáreň TV | Admin (custom) | 🔄 Moved to Marketing section |
| Automatizácie | Admin (custom) | 🔄 Moved to Marketing; gains Suppression tab |
| Centrum potlačení | Admin (custom) | 📥 Nested → tab inside Automatizácie |
| Súhlasy & skripty | Admin (custom) | 🔄 Split: templates → Settings; scripts → Skripty recepcie in Marketing |
| Knižnica médií | Admin (custom) | 🔄 Moved to Marketing section |
| Čerpanie benefitov | Admin (custom) | 🔄 Moved → frontDesk section |
| Hlasové Diktovanie | Admin (custom) | 🔄 Moved → clinical section |
| Prepúšťacie Správy | Admin (custom) | 📥 Nested → closeout action in Vyšetrenia |
| Vet Intelligence | Admin (custom) | 📥 Nested → tab inside Marketingové Štúdio |
| Vzdialená Podpora | Admin (custom) | 🔄 Moved to Admin section (still in nav) |
| Admin Podpora | Admin (custom) | ❌ Removed from nav (route kept; capability-gated) |
| Pilotná Reconciliácia | Admin (custom) | 📥 Nested → tab inside Platform Admin; admin-only |

Legend: ✅ Unchanged · 🔄 Renamed/moved · 📥 Nested · 📤 Moved to Settings · ❌ Removed from nav

---

## Proposed Section Structure for `custom-nav.ts` Refactor

The current 5 `NavSectionId` values (`clinical`, `frontDesk`, `pharmacy`, `billing`, `admin`) need one addition:

```typescript
export type NavSectionId =
  | "clinical"
  | "frontDesk"
  | "pharmacy"
  | "billing"
  | "marketing"   // NEW — splits Marketing out of admin catch-all
  | "admin";
```

All 14 surviving marketing items move from `section: "admin"` to `section: "marketing"`.
`Čerpanie benefitov` moves from `section: "admin"` to `section: "frontDesk"`.
`Hlasové Diktovanie` moves from `section: "admin"` to `section: "clinical"`.
`Vzdialená Podpora` moves from `section: "admin"` → stays `section: "admin"`.

Items removed from `customNavItems`:
- `Brand Kit` (→ Settings)
- `Plán obsahu` (→ tab in Marketing Studio)
- `Schvaľovanie obsahu` (→ tab in Marketing Studio)
- `Centrum potlačení` (→ tab in Automations)
- `Vet Intelligence` (→ tab in Marketing Studio)
- `Analýza Snímkov` (→ tab in Encounter)
- `Prepúšťacie Správy` (→ action in Encounter closeout)
- `Admin Podpora` (→ capability-gated direct URL only)

Items removed from vanilla `vanillaSections` in `sidebar.tsx`:
- `Pripomienky` / Recalls (→ tab in care-reminders)

---

## Migration Risk Summary

| Change | Risk | Key Concerns |
|---|---|---|
| Add Marketing section to sidebar | **Low** | Section rename in custom-nav.ts only |
| Move Čerpanie benefitov to frontDesk | **Low** | Section change only |
| Move Hlasové Diktovanie to clinical | **Low** | Section change only |
| Remove Admin Podpora from nav | **Low** | Admin-only; route kept |
| Merge Plán obsahu + Schvaľovanie obsahu | **Med** | 2 i18n keys; route redirects needed |
| Nest Centrum potlačení into Automatizácie | **Low** | 1 i18n key; route redirect |
| Nest Vet Intelligence into Marketing Studio | **Low** | 1 i18n key; route redirect |
| Nest Analýza Snímkov into Vyšetrenia | **Med** | i18n key; `baseline-screenshots.spec.ts` check |
| Nest Prepúšťacie Správy into Vyšetrenia | **Med** | i18n key; `ai-finalization-pilot.spec.ts` check |
| Nest Pripomienky into care-reminders | **Med** | Vanilla sidebar item removed; route redirect; e2e check |
| Rename nav labels | **Low** | i18n key additions for new labels |
| Brand Kit → Settings | **Low** | Admin-only; no known e2e |
| Pilotná Reconciliácia → admin-only under Platform Admin | **Med** | Role change affects vet/tech/front_desk pilot users |
| Consent templates → Settings | **Med** | Route split; bookmark impact |
