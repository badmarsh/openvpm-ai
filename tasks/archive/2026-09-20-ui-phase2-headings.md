> **Verification 2026-09-27** · Status: **PARTIAL** · Verdict: **ARCHIVE** · Ledger: `tasks/VERIFICATION-LOG.md`  
> **Evidence:** `e7c3ea83` migrated most pages; 52 dashboard files now use PageHeader. Still using a raw page-level `<h1>` with no PageHeader: `clients/[id]/page.tsx:207`, `encounters/[appointmentId]/page.tsx:648`, `records/new-soap/[patientId]/page.tsx:1053`.  
> **Notes:** The header still says [STATUS: IN_PROGRESS]. The three leftovers belong to open Sprint 18 (clients) and to future encounter/SOAP work. Don't re-dispatch this file.  
> **Origin:** `tasks/ui-phase2-headings.md` · first committed 2026-09-20 (`e7c3ea83`)

---

# TASK: UI Consolidation — Phase 2: Headings & Typography

[STATUS: IN_PROGRESS]

## 1. Context / Why
Audit identifikoval 30 z 66 dashboard stránok bez PageHeader. Phase 1 (predošlá session) už zmigrovala základ — komponenty PageHeader, EmptyState, useConfirmDialog sú k dispozícii. Phase 2 systematicky adoptuje PageHeader na zostávajúcich stránkach a unifikuje typografickú hierarchiu.

## 2. Scope

### In Scope
- 14 stránok s raw h1: agent/*(4x), automations, encounters/[appointmentId], lab-results, marketing/*(5x), records/replace-soap
- 2 stránky s h2 ako page title: clients/[id]/page.tsx, records/new-soap/[patientId]
- 1 stránka: patients/[id]/page.tsx (h2 bez PageHeader wrappera)
- migration-archive, marketing/automations, vet-intel kde dáva zmysel
- PageSectionHeader adopcia pre sekcie

### Out of Scope
- page.tsx (dashboard home), admin/pilot, waiting-room, onboarding, post-login, support, marketing/tv
- Phase 3 (Tables, Tabs, EmptyState) a Phase 4 (Dialogs)

## 3. Acceptance Criteria
- [ ] 14 raw-h1 stránok → PageHeader
- [ ] clients/[id] a records/new-soap → PageHeader
- [ ] patients/[id] → PageHeader
- [ ] Žiadna stránka nemá page-level h1/h2 mimo PageHeader
- [ ] 100% i18n parita en.json + sk.json
- [ ] pnpm --filter @openpims/web type-check — exit 0
- [ ] pnpm --filter @openpims/web i18n:scan — clean

## 4. Technical Architecture
- Balíčky: apps/web only
- Komponenty: apps/web/components/layout/page-header.tsx
- Riziko: risk:low

