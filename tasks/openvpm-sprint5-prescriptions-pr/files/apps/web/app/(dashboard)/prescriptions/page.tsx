'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  FileText,
  Pill,
  Plus,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import {
  DataTableFrame,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageToolbar,
  SearchField,
  TableSkeleton,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from '@/components/layout/page-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/use-i18n'
import { trpc } from '@/trpc/react'

/**
 * Mirrors the tRPC contract of `extensions.medicationOversight`
 * (see apps/web/server/routers/extensions/medicationOversight.ts).
 * Field names must match the live router output 1:1 — if the upstream
 * router renames a field, adjust this type only; the page renders solely
 * from these two contracts.
 */
type OversightScope = 'active' | 'ending' | 'overdue' | 'controlled' | 'alerts' | 'all'
type OversightStatus = 'active' | 'ending' | 'overdue' | 'completed' | 'cancelled'

interface GuardianAlert {
  severity: 'critical' | 'warning'
  message: string
}

interface OversightItem {
  id: string
  prescriptionNo: string
  medicationName: string
  dosage: string
  frequency: string
  withdrawalDays: number | null
  startDate: string
  endDate: string | null
  status: OversightStatus
  isControlled: boolean
  patient: { id: string; name: string }
  owner: { id: string; name: string }
  guardianAlerts: GuardianAlert[]
}

interface OversightSummary {
  active: number
  endingSoon: number
  overdue: number
  endingWindowDays: number
  criticalAlerts: number
  openMedicationAlerts: number
}

/**
 * Semantic status tokens (docs/UIKIT.md) — no raw Tailwind colors:
 * active  -> primary, ending -> warning, overdue -> destructive,
 * OPL / critical alerts -> destructive (font-medium), warnings -> warning.
 */
const STATUS_META: Record<OversightStatus, { labelKey: string; chipClass: string }> = {
  active: {
    labelKey: 'prescriptions.status.active',
    chipClass: 'border-primary/40 bg-primary-muted text-primary-muted-foreground',
  },
  ending: {
    labelKey: 'prescriptions.status.ending',
    chipClass: 'border-warning/40 bg-warning-muted text-warning-muted-foreground',
  },
  overdue: {
    labelKey: 'prescriptions.status.overdue',
    chipClass: 'border-destructive/40 bg-destructive-muted text-destructive-muted-foreground',
  },
  completed: {
    labelKey: 'prescriptions.status.completed',
    chipClass: 'border-border bg-muted text-muted-foreground',
  },
  cancelled: {
    labelKey: 'prescriptions.status.cancelled',
    chipClass: 'border-border bg-muted text-muted-foreground',
  },
}

const SCOPE_TABS: ReadonlyArray<{ value: OversightScope; labelKey: string }> = [
  { value: 'active', labelKey: 'prescriptions.tabs.active' },
  { value: 'ending', labelKey: 'prescriptions.tabs.ending' },
  { value: 'overdue', labelKey: 'prescriptions.tabs.overdue' },
  { value: 'controlled', labelKey: 'prescriptions.tabs.controlled' },
  { value: 'alerts', labelKey: 'prescriptions.tabs.alerts' },
  { value: 'all', labelKey: 'prescriptions.tabs.all' },
]

const TABLE_COLUMNS = [
  'medication',
  'rx',
  'dosage',
  'frequency',
  'withdrawal',
  'period',
  'status',
  'actions',
] as const

const OPL_BADGE_CLASS = 'border-destructive/50 bg-destructive-muted text-destructive font-medium'
const ALERT_CRITICAL_CLASS = 'border-destructive/50 bg-destructive-muted text-destructive font-medium'
const ALERT_WARNING_CLASS = 'border-warning/40 bg-warning-muted text-warning-muted-foreground'

export default function PrescriptionsPage() {
  const { t, locale } = useI18n()
  const [scope, setScope] = React.useState<OversightScope>('active')
  const [search, setSearch] = React.useState('')

  // All data comes exclusively from the existing medicationOversight queries.
  const summaryQuery = trpc.extensions.medicationOversight.summary.useQuery(undefined, { refetchInterval: 60_000 })
  const listQuery = trpc.extensions.medicationOversight.list.useQuery({ scope, search, limit: 200, offset: 0 })

  const summary: OversightSummary | undefined = summaryQuery.data
  const rawList = listQuery.data
  const items: OversightItem[] = rawList === undefined ? [] : Array.isArray(rawList) ? rawList : rawList.items
  const total: number = rawList !== undefined && !Array.isArray(rawList) ? rawList.total : items.length
  const isLoading = listQuery.isLoading
  const hasSearch = search.trim().length > 0

  const dateLocale = locale === 'sk' ? 'sk-SK' : 'en-GB'
  const formatDate = React.useCallback(
    (iso: string) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'short' }).format(new Date(iso)),
    [dateLocale],
  )

  const guardianTone =
    (summary?.criticalAlerts ?? 0) > 0
      ? 'destructive'
      : (summary?.openMedicationAlerts ?? 0) > 0
        ? 'warning'
        : 'default'

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Pill}
        title={t('prescriptions.title')}
        subtitle={t('prescriptions.subtitle')}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/controlled-substances">
                <BookOpenCheck aria-hidden className="h-3.5 w-3.5" />
                {t('prescriptions.actions.ledger')}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/prescriptions/new">
                <Plus aria-hidden className="h-3.5 w-3.5" />
                {t('prescriptions.actions.new')}
              </Link>
            </Button>
          </>
        }
      />

      <KpiGrid>
        <KpiCard icon={Pill} label={t('prescriptions.kpi.active')} tone="primary" value={summary?.active ?? 0} />
        <KpiCard
          icon={CalendarClock}
          label={t('prescriptions.kpi.ending', { days: summary?.endingWindowDays ?? 7 })}
          tone="warning"
          value={summary?.endingSoon ?? 0}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t('prescriptions.kpi.overdue')}
          tone="destructive"
          value={summary?.overdue ?? 0}
        />
        <KpiCard
          icon={ShieldAlert}
          label={t('prescriptions.kpi.guardian')}
          tone={guardianTone}
          value={summary?.openMedicationAlerts ?? 0}
          hint={
            (summary?.criticalAlerts ?? 0) > 0
              ? t('prescriptions.kpi.guardianCritical', { count: summary?.criticalAlerts ?? 0 })
              : undefined
          }
        />
      </KpiGrid>

      <div role="tablist" aria-label={t('prescriptions.tabs.ariaLabel')} className={underlineTabsListClass}>
        {SCOPE_TABS.map((tab) => {
          const selected = scope === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              data-state={selected ? 'active' : 'inactive'}
              className={`${underlineTabsTriggerClass} ${selected ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setScope(tab.value)}
            >
              {t(tab.labelKey)}
            </button>
          )
        })}
      </div>

      <PageToolbar>
        <SearchField value={search} onChange={setSearch} placeholder={t('prescriptions.search.placeholder')} />
        <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
          {t('prescriptions.results', { count: total })}
        </span>
        {hasSearch && (
          <Button size="sm" variant="ghost" className={filterControlClass} onClick={() => setSearch('')}>
            {t('prescriptions.search.clear')}
          </Button>
        )}
      </PageToolbar>

      <DataTableFrame>
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : items.length === 0 ? (
          hasSearch ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('prescriptions.empty.search.title')}
              description={t('prescriptions.empty.search.description', { query: search.trim() })}
              action={
                <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                  {t('prescriptions.search.clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Pill}
              title={t('prescriptions.empty.title')}
              description={t('prescriptions.empty.description')}
              action={
                <Button size="sm" asChild>
                  <Link href="/prescriptions/new">
                    <Plus aria-hidden className="h-3.5 w-3.5" />
                    {t('prescriptions.actions.new')}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column} scope="col" className={`${tableCellClass} text-left font-medium`}>
                    {t(`prescriptions.table.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = STATUS_META[item.status]
                return (
                  <tr key={item.id} className={tableRowClass}>
                    <td className={`${tableCellClass} min-w-0 max-w-[240px]`}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">{item.medicationName}</span>
                        {item.isControlled && (
                          <Link
                            href="/controlled-substances"
                            title={t('prescriptions.opl.tooltip')}
                            className="shrink-0"
                          >
                            <Badge variant="outline" className={OPL_BADGE_CLASS}>
                              <ShieldAlert aria-hidden className="h-3 w-3" />
                              {t('prescriptions.opl.badge')}
                            </Badge>
                          </Link>
                        )}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {item.patient.name} · {item.owner.name}
                      </div>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>{item.prescriptionNo}</td>
                    <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>{item.dosage}</td>
                    <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>{item.frequency}</td>
                    <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>
                      {item.withdrawalDays != null
                        ? t('prescriptions.withdrawal.value', { days: item.withdrawalDays })
                        : t('prescriptions.withdrawal.none')}
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>
                      {formatDate(item.startDate)} → {item.endDate ? formatDate(item.endDate) : '—'}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={status.chipClass}>
                          {t(status.labelKey)}
                        </Badge>
                        {item.guardianAlerts.map((alert, alertIndex) => (
                          <Badge
                            key={`${item.id}-alert-${alertIndex}`}
                            variant="outline"
                            title={alert.message}
                            className={alert.severity === 'critical' ? ALERT_CRITICAL_CLASS : ALERT_WARNING_CLASS}
                          >
                            {alert.severity === 'critical' ? (
                              <ShieldAlert aria-hidden className="h-3 w-3" />
                            ) : (
                              <AlertTriangle aria-hidden className="h-3 w-3" />
                            )}
                            {alert.severity === 'critical'
                              ? t('prescriptions.alert.critical')
                              : t('prescriptions.alert.warning')}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={`/prescriptions/${item.id}`}
                            aria-label={t('prescriptions.actions.view')}
                            title={t('prescriptions.actions.view')}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          aria-label={t('prescriptions.actions.stop')}
                          title={t('prescriptions.actions.stop')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </DataTableFrame>

      <p className="text-xs text-muted-foreground">
        {t('prescriptions.legal.note')}{' '}
        <Link href="/controlled-substances" className="underline underline-offset-2 hover:text-foreground">
          {t('prescriptions.actions.ledger')}
        </Link>
      </p>
    </div>
  )
}
