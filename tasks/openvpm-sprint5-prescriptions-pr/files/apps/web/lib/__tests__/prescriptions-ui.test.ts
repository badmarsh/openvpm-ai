import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * TASK-OPENVPM-SPRINT-5 — Page Kit contract tests for /prescriptions.
 *
 * These are source-level contract tests (no DOM): they pin the Dashboard
 * UI Kit hierarchy, forbid legacy Card components and raw Tailwind colors,
 * and enforce 100% i18n leaf-key symmetry between messages/sk.json and
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

const PAGE_KIT_EXPORTS = [
  'pageShellClass',
  'PageHeader',
  'KpiGrid',
  'KpiCard',
  'PageToolbar',
  'SearchField',
  'filterControlClass',
  'underlineTabsListClass',
  'underlineTabsTriggerClass',
  'tableHeadClass',
  'tableCellClass',
  'tableRowClass',
  'DataTableFrame',
] as const

const SCOPE_VALUES = ['active', 'ending', 'overdue', 'controlled', 'alerts', 'all'] as const

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

describe('prescriptions page — Page Kit contract (Sprint 5)', () => {
  it('imports the required Page Kit exports from @/components/layout/page-kit', () => {
    expect(pageSource).toMatch(/from\s+['"]@\/components\/layout\/page-kit['"]/)
    for (const name of PAGE_KIT_EXPORTS) {
      expect(pageSource, `missing Page Kit export: ${name}`).toContain(name)
    }
  })

  it('follows the Page Kit hierarchy: PageHeader -> KpiGrid -> underline tabs -> PageToolbar -> DataTableFrame', () => {
    const positions = [
      pageSource.indexOf('<PageHeader'),
      pageSource.indexOf('<KpiGrid'),
      pageSource.indexOf('role="tablist"'),
      pageSource.indexOf('<PageToolbar'),
      pageSource.indexOf('<DataTableFrame'),
    ]
    expect(positions).not.toContain(-1)
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i], `hierarchy order broken before step ${i + 1}`).toBeGreaterThan(positions[i - 1])
    }
  })

  it('renders the four KPI metrics via KpiCard inside KpiGrid', () => {
    expect(pageSource).toContain('<KpiGrid')
    const kpiCardCount = (pageSource.match(/<KpiCard\b/g) ?? []).length
    expect(kpiCardCount).toBe(4)
    for (const kpiKey of [
      'prescriptions.kpi.active',
      'prescriptions.kpi.ending',
      'prescriptions.kpi.overdue',
      'prescriptions.kpi.guardian',
    ]) {
      expect(pageSource, `missing KPI key: ${kpiKey}`).toContain(kpiKey)
    }
  })

  it('uses underline tabs for all six oversight scopes', () => {
    expect(pageSource).toContain('underlineTabsListClass')
    expect(pageSource).toContain('underlineTabsTriggerClass')
    for (const scope of SCOPE_VALUES) {
      expect(pageSource, `missing scope value: ${scope}`).toContain(`value: '${scope}'`)
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

  it('renders EmptyState inside DataTableFrame with separate "no data" and "no search results" variants', () => {
    const framePos = pageSource.indexOf('<DataTableFrame')
    const emptyPos = pageSource.indexOf('<EmptyState')
    expect(emptyPos).toBeGreaterThanOrEqual(0)
    expect(emptyPos).toBeGreaterThan(framePos)
    expect(pageSource).toContain('prescriptions.empty.title')
    expect(pageSource).toContain('prescriptions.empty.description')
    expect(pageSource).toContain('prescriptions.empty.search.title')
    expect(pageSource).toContain('prescriptions.empty.search.description')
  })

  it('does not use the legacy Card component', () => {
    expect(pageSource).not.toMatch(/<Card[\s>/]/)
    expect(pageSource).not.toMatch(/from\s+['"]@\/components\/ui\/card['"]/)
  })

  it('does not use raw Tailwind colors (text-emerald-*, text-amber-*, bg-sky-*)', () => {
    expect(pageSource).not.toMatch(/text-emerald-/)
    expect(pageSource).not.toMatch(/text-amber-/)
    expect(pageSource).not.toMatch(/bg-sky-/)
  })

  it('uses semantic tokens for active / ending / overdue / OPL states', () => {
    expect(pageSource).toContain('border-primary/40 bg-primary-muted text-primary-muted-foreground')
    expect(pageSource).toContain('border-warning/40 bg-warning-muted text-warning-muted-foreground')
    expect(pageSource).toContain('border-destructive/40 bg-destructive-muted text-destructive-muted-foreground')
    expect(pageSource).toContain('border-destructive/50 bg-destructive-muted text-destructive font-medium')
  })

  it('reads all data exclusively from the medicationOversight tRPC queries', () => {
    expect(pageSource).toMatch(
      /medicationOversight\.summary\.useQuery\(undefined,\s*\{\s*refetchInterval:\s*60_000\s*\}\)/,
    )
    expect(pageSource).toMatch(
      /medicationOversight\.list\.useQuery\(\{\s*scope,\s*search,\s*limit:\s*200,\s*offset:\s*0\s*\}\)/,
    )
  })

  it('keeps the OPL ledger link and Clinical Guardian alerts functional', () => {
    expect(pageSource).toContain('"/controlled-substances"')
    expect(pageSource).toContain('criticalAlerts')
    expect(pageSource).toContain('openMedicationAlerts')
    expect(pageSource).toContain('guardianAlerts')
    expect(pageSource).toContain('isControlled')
  })
})

describe('prescriptions page — i18n contract (Sprint 5)', () => {
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
    for (const match of pageSource.matchAll(/['"](prescriptions\.[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)['"]/g)) {
      usedKeys.add(match[1])
    }
    expect(usedKeys.size).toBeGreaterThan(10)
    for (const key of [...usedKeys].sort()) {
      expect(lookupLeaf(skMessages, key), `missing in sk.json: ${key}`).not.toBeUndefined()
      expect(lookupLeaf(enMessages, key), `missing in en.json: ${key}`).not.toBeUndefined()
    }
  })
})
