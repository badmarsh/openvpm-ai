import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * /prescriptions — Dashboard UI Kit + statutory safeguard contract tests.
 *
 * These are source-level contract tests (no DOM): they pin the Dashboard
 * UI Kit hierarchy, the prescription lifecycle states and their badge tokens,
 * the human-in-the-loop signing / licensed-veterinarian gate, the controlled
 * substance safeguards (Zákon 39/2007 Z. z. & Zákon 139/1998 Z. z.), and they
 * enforce 100% i18n leaf-key symmetry between messages/sk.json and
 * messages/en.json so no user-facing text can remain hardcoded.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '..', '..')

const pageSource = readFileSync(path.join(webRoot, 'app', '(dashboard)', 'prescriptions', 'page.tsx'), 'utf8')
const skMessages = JSON.parse(
  readFileSync(path.join(webRoot, 'messages', 'sk.json'), 'utf8'),
) as Record<string, unknown>
const enMessages = JSON.parse(
  readFileSync(path.join(webRoot, 'messages', 'en.json'), 'utf8'),
) as Record<string, unknown>

/** Page Kit primitives the page must consume from @/components/layout/page-kit. */
const PAGE_KIT_EXPORTS = [
  'pageShellClass',
  'KpiGrid',
  'KpiCard',
  'PageToolbar',
  'SearchField',
  'DataTableFrame',
  'tableHeadClass',
  'tableCellClass',
  'tableRowClass',
] as const

/** Prescription lifecycle states required by the sprint spec. */
const LIFECYCLE_STATES = ['active', 'dispensed', 'cancelled', 'expired'] as const

/** Status filter pills required by the sprint spec. */
const STATUS_FILTER_PILLS = ['all', 'active', 'dispensed', 'cancelled', 'expired'] as const

/** Semantic badge tokens, one per lifecycle state. */
const BADGE_TOKENS: Record<(typeof LIFECYCLE_STATES)[number], string> = {
  active: 'border-primary/40 bg-primary-muted text-primary-muted-foreground',
  dispensed: 'border-success/40 bg-success-muted text-success-muted-foreground',
  expired: 'border-muted bg-muted text-muted-foreground',
  cancelled: 'border-destructive/40 bg-destructive-muted text-destructive-muted-foreground',
}

function collectLeafKeys(value: unknown, prefix = ''): string[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectLeafKeys(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return [prefix]
}

function lookupLeaf(target: Record<string, unknown>, dotKey: string): unknown {
  return dotKey.split('.').reduce<unknown>((node, part) => {
    if (node !== null && typeof node === 'object') {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, target)
}

function placeholders(value: unknown): Set<string> {
  if (typeof value !== 'string') return new Set()
  const found = new Set<string>()
  for (const match of value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)) {
    found.add(match[1])
  }
  return found
}

describe('prescriptions page — Page Kit contract', () => {
  it('imports the required Page Kit exports from @/components/layout/page-kit', () => {
    expect(pageSource).toMatch(/from\s+['"]@\/components\/layout\/page-kit['"]/)
    expect(pageSource).toMatch(/from\s+['"]@\/components\/layout\/page-header['"]/)
    for (const name of PAGE_KIT_EXPORTS) {
      expect(pageSource, `missing Page Kit export: ${name}`).toContain(name)
    }
  })

  it('follows the Page Kit hierarchy: PageHeader -> KpiGrid -> PageToolbar -> SearchField -> DataTableFrame', () => {
    const positions = [
      pageSource.indexOf('<PageHeader'),
      pageSource.indexOf('<KpiGrid'),
      pageSource.indexOf('<PageToolbar'),
      pageSource.indexOf('<SearchField'),
      pageSource.indexOf('<DataTableFrame'),
    ]
    expect(positions).not.toContain(-1)
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i], `hierarchy order broken before step ${i + 1}`).toBeGreaterThan(positions[i - 1])
    }
  })

  it('renders exactly four KPI metrics via KpiCard inside KpiGrid', () => {
    expect(pageSource).toContain('<KpiGrid')
    const kpiCardCount = (pageSource.match(/<KpiCard\b/g) ?? []).length
    expect(kpiCardCount).toBe(4)
    for (const kpiKey of [
      'medications.kpiActive',
      'medications.kpiDispensed',
      'medications.kpiOverdue',
      'medications.kpiControlled',
    ]) {
      expect(pageSource, `missing KPI key: ${kpiKey}`).toContain(kpiKey)
    }
  })

  it('models the four prescription lifecycle states', () => {
    expect(pageSource).toContain(
      'type PrescriptionStatus = "active" | "dispensed" | "cancelled" | "expired"',
    )
    for (const state of LIFECYCLE_STATES) {
      expect(pageSource, `missing lifecycle state: ${state}`).toContain(state)
    }
  })

  it('renders the status filter pills for all | active | dispensed | cancelled | expired', () => {
    const pillsBlock =
      pageSource.slice(pageSource.indexOf('STATUS_FILTER_PILLS'), pageSource.indexOf('STATUS_FILTER_PILLS') + 400) ?? ''
    expect(pillsBlock).toContain('STATUS_FILTER_PILLS')
    for (const pill of STATUS_FILTER_PILLS) {
      expect(pillsBlock, `missing filter pill: ${pill}`).toContain(`"${pill}"`)
    }
    expect(pageSource).toContain('STATUS_FILTER_PILLS.map(')
  })

  it('uses the semantic badge token for every lifecycle state', () => {
    for (const state of LIFECYCLE_STATES) {
      expect(pageSource, `missing badge token for ${state}`).toContain(BADGE_TOKENS[state])
    }
  })

  it('renders TableSkeleton inside DataTableFrame while the list is loading', () => {
    const framePos = pageSource.indexOf('<DataTableFrame')
    const skeletonPos = pageSource.indexOf('<TableSkeleton')
    expect(framePos).toBeGreaterThanOrEqual(0)
    expect(skeletonPos).toBeGreaterThanOrEqual(0)
    expect(skeletonPos).toBeGreaterThan(framePos)
    expect(pageSource).toContain('isLoading')
  })

  it('renders EmptyState inside DataTableFrame', () => {
    const framePos = pageSource.indexOf('<DataTableFrame')
    const emptyPos = pageSource.indexOf('<EmptyState')
    expect(emptyPos).toBeGreaterThanOrEqual(0)
    expect(emptyPos).toBeGreaterThan(framePos)
    expect(pageSource).toContain('medications.emptyTitle')
    expect(pageSource).toContain('medications.emptyDescription')
  })

  it('does not use the legacy Card component', () => {
    expect(pageSource).not.toMatch(/<Card[\s>/]/)
    expect(pageSource).not.toMatch(/from\s+['"]@\/components\/ui\/card['"]/)
  })

  it('does not use raw Tailwind palette colors (text-emerald-*, text-amber-*, bg-sky-*)', () => {
    expect(pageSource).not.toMatch(/text-emerald-/)
    expect(pageSource).not.toMatch(/text-amber-/)
    expect(pageSource).not.toMatch(/bg-sky-/)
  })

  it('formats Rx number, dosage units and dates with dense mono tabular numbers', () => {
    const monoCells = (pageSource.match(/font-mono tabular-nums text-xs/g) ?? []).length
    expect(monoCells).toBeGreaterThanOrEqual(3)
    expect(pageSource).toContain('medications.colRxNumber')
    expect(pageSource).toContain('medications.colDosage')
    expect(pageSource).toContain('medications.colDates')
  })

  it('exposes the "+ Nový recept" / "+ New Prescription" primary action', () => {
    expect(pageSource).toContain('medications.newPrescription')
    expect(pageSource).toContain('+ Nový recept')
    expect(lookupLeaf(enMessages, 'medications.newPrescription')).toMatch(/^\+\s*New\b/i)
  })
})

describe('prescriptions page — clinical safety & statutory safeguards', () => {
  it('keeps the OPL ledger link and controlled-substance policy wired', () => {
    expect(pageSource).toContain('"/controlled-substances"')
    expect(pageSource).toContain('isControlledSubstanceName')
    expect(pageSource).toContain('isControlled')
  })

  it('signs prescriptions from the authenticated session user, never a hardcoded vet', () => {
    expect(pageSource).toContain('useSession')
    expect(pageSource).toContain('const { data: session } = useSession()')
    expect(pageSource).toContain('session?.user?.name')
    expect(pageSource).not.toMatch(/const doctorName = "MVDr\./)
  })

  it('gates controlled substances behind an explicit human confirmation (Zákon 139/1998 Z. z.)', () => {
    expect(pageSource).toContain('onCheckedChange')
    expect(pageSource).toContain('isNewControlled && !newControlledConfirmed')
    expect(pageSource).toContain('medications.confirmControlledSubstance')
    expect(pageSource).toContain('medications.statutoryControlledSubstances')
    expect(pageSource).toContain('medications.controlledSubstanceDetected')
  })

  it('blocks dispensing without a licensed veterinarian signature check (Zákon 39/2007 Z. z.)', () => {
    expect(pageSource).toContain('medications.dispensingFailedUnsigned')
    expect(pageSource).toContain('medications.veterinarianSignatureRequired')
    expect(pageSource).toContain('Zákon 39/2007 Z. z.')
    expect(pageSource).toContain('Zákon 139/1998 Z. z.')
  })
})

describe('prescriptions page — i18n contract', () => {
  it('keeps 100% leaf-key symmetry between messages/sk.json and messages/en.json', () => {
    const skKeys = collectLeafKeys(skMessages).sort()
    const enKeys = collectLeafKeys(enMessages).sort()
    expect(enKeys, 'SK/EN leaf key sets differ').toEqual(skKeys)
  })

  it('keeps interpolation placeholders symmetric for every shared leaf key', () => {
    const skKeys = new Set(collectLeafKeys(skMessages))
    for (const key of collectLeafKeys(enMessages)) {
      if (!skKeys.has(key)) continue
      const skValue = lookupLeaf(skMessages, key)
      const enValue = lookupLeaf(enMessages, key)
      expect(
        [...placeholders(enValue)].sort(),
        `placeholder mismatch for key: ${key}`,
      ).toEqual([...placeholders(skValue)].sort())
    }
  })

  it('resolves every i18n key referenced in the page to both locale files (no hardcoded UI text)', () => {
    const usedKeys = new Set<string>()
    for (const match of pageSource.matchAll(/['"](medications\.[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)['"]/g)) {
      usedKeys.add(match[1])
    }
    expect(usedKeys.size).toBeGreaterThan(20)
    for (const key of [...usedKeys].sort()) {
      expect(lookupLeaf(skMessages, key), `missing in sk.json: ${key}`).not.toBeUndefined()
      expect(lookupLeaf(enMessages, key), `missing in en.json: ${key}`).not.toBeUndefined()
    }
  })

  it('has no mojibake in the Slovak page fallbacks', () => {
    // Correct Slovak text never contains these glyphs. When UTF-8 bytes are
    // re-decoded as CP437 (the classic double-encode bug) at least one of them
    // always leaks through: Γ Ç ─ ╛ ┼ ├ ┬ ╝ î.
    const mojibakeMarkers = /[\u0393\u00c7\u2500\u255b\u253c\u251c\u252c\u255d\u00ee]/g
    const leaks = pageSource.match(mojibakeMarkers) ?? []
    expect(leaks, `mojibake glyphs found: ${leaks.join(' ')}`).toHaveLength(0)
    expect(pageSource).toContain('Dohľad nad predpísanými liečivami')
    expect(pageSource).toContain('Recept bol úspešne vystavený')
  })
})
