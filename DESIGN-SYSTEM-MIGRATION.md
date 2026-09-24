# Design System Migration — Supabase-Inspired Token Unification

## Summary of Changes

### Architecture: Three-Tier Token Model

| Tier | Token | Purpose | Overridable? |
|------|-------|---------|-------------|
| **Brand** | `--brand`, `--brand-foreground` | Stable Supabase emerald — sidebar active indicator, AI badge, brand accent | **No** — fixed identity |
| **Primary** | `--primary`, `--primary-foreground` | Clinic's chosen accent — buttons, links, active CTAs | **Yes** — via BrandTheme |
| **Status** | `--success`, `--warning`, `--destructive`, `--info` + muted pairs | Semantic status — badges, alerts, indicators | **No** — must remain readable |

### Key Insight
Previously, `--primary` was used for *both* the brand accent AND the clinic's overrideable color. This caused:
- Sidebar active states changing color per-clinic
- Brand emerald competing with success green
- No stable "identity" color for the application

The new `--brand` token is **never overridden by BrandTheme**, creating a stable visual identity anchor.

---

## Files Changed

### 1. `apps/web/styles/globals.css`
**What**: Complete token spine rewrite for `:root` and `.dark`
- Added `--brand` and `--brand-foreground` tokens
- Shifted primary default to Supabase emerald (`154.9 65% 53%`)
- Updated `--success` to hue 142° (distinct from brand's 154.9°)
- Updated `--warning` to hue 38° (warm amber)
- Updated `--info` to hue 217° (sky blue)
- Dark mode surfaces use `240 10% 3.9%` (Supabase studio depth)
- Sidebar dark mode uses deep near-black panel

### 2. `packages/config/tailwind.config.ts`
**What**: Added `brand` color mapping, removed raw `teal` palette
- `brand: { DEFAULT: "hsl(var(--brand))", foreground: "hsl(var(--brand-foreground))" }`
- Removed `teal: { 50–950 }` hardcoded palette

### 3. `apps/web/components/layout/sidebar.tsx`
**What**: Navigation ergonomics overhaul
- **Active item**: `bg-primary text-primary-foreground` → `bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-brand pl-[9px]` (subtle left accent bar in brand emerald)
- **Active icon**: `text-primary-foreground` → `text-brand` (emerald icon tint)
- **Hover**: `hover:bg-accent` → `hover:bg-sidebar-accent/60`
- **AI badge**: `bg-amber-100 text-amber-800` → `bg-brand/15 text-brand`
- **Inbox count**: `bg-primary` → `bg-destructive` (red draws attention)
- **Section headers**: `text-[10px]` → `text-[11px]`, `text-muted-foreground/70` → `text-muted-foreground/50`
- **Separators**: `border-border/50` → `border-border/30` (subtler)

### 4. `apps/web/components/clinical/clinical-status-badge.tsx`
**What**: Replaced all 4 status states with semantic tokens
| State | Before | After |
|-------|--------|-------|
| AI Draft | `bg-amber-50 text-amber-900 border-amber-300` | `bg-warning-muted text-warning-muted-foreground border-warning/30` |
| Imported | `bg-slate-50 text-slate-800 border-slate-300` | `bg-muted text-muted-foreground border-border` |
| Admin Draft | `bg-sky-50 text-sky-900 border-sky-300` | `bg-info-muted text-info-muted-foreground border-info/30` |
| Authorized | `bg-emerald-50 text-emerald-900 border-emerald-300` | `bg-success-muted text-success-muted-foreground border-success/30` |

### 5. `apps/web/components/ui/status-pulse-badge.tsx`
**What**: Replaced all 13 hardcoded variant styles with semantic tokens
| Variant | Before | After |
|---------|--------|-------|
| online/confirmed/in_exam | `border-emerald-500/30 bg-emerald-500/10` | `border-success/30 bg-success/10` |
| offline/waiting | `border-amber-500/30 bg-amber-500/10` | `border-warning/30 bg-warning/10` |
| quarantine/rabies | `border-amber-600/40 bg-amber-500/15` | `border-warning/40 bg-warning/15` |
| urgent | `border-rose-500/40 bg-rose-500/15` | `border-destructive/40 bg-destructive/15` |
| failed | `border-red-500/30 bg-red-500/10` | `border-destructive/30 bg-destructive/10` |
| pending | `border-blue-500/30 bg-blue-500/10` | `border-info/30 bg-info/10` |
| finished/deceased | `border-slate-300/60 bg-slate-100` | `border-border bg-muted` |

### 6. `apps/web/components/ui/badge.tsx`
**What**: Added `brand` variant
- New: `brand: "border-transparent bg-brand/15 text-brand-foreground dark:text-brand"`

### 7. `apps/web/components/dashboard/clinical-guardian-widget.tsx`
**What**: Replaced hardcoded emerald and amber
- Shield icon (healthy): `bg-emerald-500/15 text-emerald-600` → `bg-success/15 text-success`
- Statutory badge: raw `border-amber-500/30 text-amber-700` → `<Badge variant="warning">`
- Alert icon: `text-amber-600` → `text-warning`
- Checkmark (all good): `text-emerald-500` → `text-success`

### 8. `apps/web/app/(dashboard)/page.tsx`
**What**: Dashboard follow-up section
- Count badge: `bg-amber-500/15 text-amber-700` → `bg-warning/15 text-warning-muted-foreground`
- Alert icon: `text-amber-600` → `text-warning`

### 9. `apps/web/app/(dashboard)/admin/page.tsx`
**What**: Replaced ~15+ hardcoded color instances
- Status styles map: `bg-green-100 text-green-700` → `bg-success-muted text-success-muted-foreground`
- Recovery trial styles: `bg-amber-100 text-amber-800` → `bg-warning-muted text-warning-muted-foreground`
- SMS severity badges: `bg-red-100 text-red-800` → `bg-destructive/10 text-destructive`
- Validation indicators: `text-green-700` → `text-success`, `text-red-700` → `text-destructive`
- Enable profile button: `border-green-300 bg-green-50` → `border-success/30 bg-success/5`
- Warning text: `text-amber-700` → `text-warning-muted-foreground`
- Help requested text: `text-emerald-700` → `text-success`

### 10. `apps/web/lib/theme/presets.ts`
**What**: Added `--brand` and `--brand-foreground` to all 4 theme presets (supabase, vercel, amber, linear, openvpm)
- Supabase preset: completely re-aligned to new token architecture
- Other presets: brand tokens added but primary unchanged (preserves theme identity)

---

## Before/After Component Examples

### Sidebar Item (Active State)
```tsx
// ❌ BEFORE — solid block, changes per-clinic
className="bg-primary text-primary-foreground shadow-xs font-bold"

// ✅ AFTER — subtle accent bar, stable brand emerald
className="bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-brand pl-[9px] font-bold"
```

### Status Badge (Clinical)
```tsx
// ❌ BEFORE — hardcoded amber
<Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200">

// ✅ AFTER — semantic warning token
<Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning/30">
```

### AI Badge (Sidebar)
```tsx
// ❌ BEFORE — raw amber Tailwind
className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"

// ✅ AFTER — brand token
className="bg-brand/15 text-brand"
```

### Metric Card (Dashboard)
```tsx
// ❌ BEFORE — primary icon bg
<div className="bg-primary/10 text-primary">

// ✅ AFTER — same (unchanged, but now --primary defaults to emerald)
<div className="bg-primary/10 text-primary">
```

---

## Migration Checklist for Remaining Files

### Phase 1: High-Impact Pages (batch find-replace)
- [x] `admin/page.tsx` — Done ✓
- [x] `billing/ekasa/page.tsx` — Migrated to brand/success/warning tokens ✓
- [x] `billing/page.tsx` — Migrated to brand/success/destructive tokens ✓
- [x] `billing/pos/page.tsx` — Migrated to brand/success/secondary tokens ✓
- [x] `agent/components/agent-sidebar.tsx` — Migrated to success/warning tokens ✓
- [x] `agent/discharge/page.tsx` — Migrated to warning/success/info tokens ✓
- [x] `encounters/[appointmentId]/page.tsx` — Migrated to warning/success/info tokens ✓
- [x] `clients/[id]/page.tsx` — Migrated to warning/success tokens ✓
- [x] `clients/new/page.tsx` — Migrated to warning tokens ✓
- [x] `controlled-substances/page.tsx` — Migrated to success/info/destructive tokens ✓
- [x] `marketing/handouts/page.tsx` — Migrated to primary/brand/success/warning tokens ✓
- [x] `marketing/media/page.tsx` — Migrated to primary/brand/success/warning tokens ✓

### Phase 2: Agent & Voice Components
- [x] `agent/components/agent-capabilities.tsx` — Migrated warning badge ✓
- [x] `agent/components/agent-composer.tsx` — Migrated warning box ✓
- [x] `agent/components/agent-export-dialog.tsx` — Migrated success check icon ✓
- [x] `agent/components/agent-message-bubble.tsx` — Migrated success check icon ✓
- [x] `agent/components/prescription-proposal-card.tsx` — Migrated success and warning styles ✓
- [x] `agent/voice/components/voice-commands.tsx` — Migrated command category badges and check icon ✓

### Phase 3: Utility Components
- [x] `copilot/confidence-score-badge.tsx` — Migrated high/medium/low confidence badges ✓
- [x] `copilot/clinical-status-badge.tsx` — Verified (already references clinical-status-badge) ✓
- [x] `common/species-badge.tsx` — Verified (clean, uses semantic classes) ✓

### Replacement Rules
When migrating, follow these rules:

| Pattern | Context | Replace with |
|---------|---------|-------------|
| `bg-emerald-*` | Success/authorized state | `bg-success-muted` or `bg-success/10` |
| `text-emerald-*` | Success/authorized state | `text-success` or `text-success-muted-foreground` |
| `bg-emerald-*` | Brand accent/button | `bg-brand` or `bg-brand/15` |
| `text-emerald-*` | Brand accent icon | `text-brand` |
| `bg-amber-*` / `text-amber-*` | Warning/warning state | `bg-warning-muted text-warning-muted-foreground` or `bg-warning/10 text-warning` |
| `bg-sky-*` / `text-sky-*` | Info/admin draft | `bg-info-muted text-info-muted-foreground` or `bg-info/10 text-info` |
| `bg-blue-*` / `text-blue-*` | Info/trialing | `bg-info-muted text-info-muted-foreground` |
| `bg-green-*` / `text-green-*` | Success/active | `bg-success-muted text-success-muted-foreground` |
| `bg-red-*` / `text-red-*` | Error/destructive | `bg-destructive/10 text-destructive` |
| `bg-teal-*` / `text-teal-*` | Any | Migrate to `success`, `brand`, or `muted-foreground` based on context |
| `bg-slate-*` / `text-slate-*` | Neutral/finished | `bg-muted text-muted-foreground` |
| `#hex` values | Print templates | Acceptable (print-only, no dark mode) |
