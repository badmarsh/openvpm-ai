"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Euro,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  RefreshCw,
  Bot,
  Workflow,
  Activity,
  Rocket,
  Radio,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  pageShellClass,
  KpiGrid,
  KpiCard,
  DataTableFrame,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { PageLoading } from "@/components/common/loading";
import { SmsRecoveryConsole } from "@/components/admin/sms-recovery-console";
import { ClinicPilotConsole } from "@/components/admin/clinic-pilot-console";
import { ClinicalSimulationAdminCard } from "@/components/admin/clinical-simulation-card";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

const EMPTY_UUID = "00000000-0000-4000-8000-000000000000";
const MESSAGING_HISTORY_LIMIT = 50;

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | string | null, timeZone?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timeZone?.trim() || "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  try {
    return date.toLocaleDateString("en-US", options);
  } catch {
    return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  }
}

function formatPct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function formatAgeMinutes(minutes: number | null) {
  if (minutes === null) return "Current state";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

const statusStyles: Record<string, string> = {
  active: "bg-success-muted text-success-muted-foreground",
  trialing: "bg-info-muted text-info-muted-foreground",
  past_due: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

const recoveryTrialStyles: Record<string, string> = {
  active: "bg-success-muted text-success-muted-foreground",
  ending_soon: "bg-warning-muted text-warning-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
  no_trial: "bg-muted text-muted-foreground",
};

function recoveryLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function AdminPage() {
  const { t } = useI18n();
  const { confirm, dialogProps } = useConfirmDialog();
  const utils = trpc.useUtils();
  const [messagingHistorySelection, setMessagingHistorySelection] = useState<{
    practiceId: string;
    practiceName: string;
  } | null>(null);
  const { data, isLoading, error, refetch } = trpc.admin.overview.useQuery(
    undefined,
    {
      retry: false,
    },
  );
  const { data: funnel, error: funnelError } =
    trpc.admin.activationFunnel.useQuery({ days: 30 }, { retry: false });
  const { data: recoveryQueue, error: recoveryError } =
    trpc.admin.activationRecovery.useQuery(undefined, { retry: false });
  const { data: journey, error: journeyError } =
    trpc.admin.journeyFunnel.useQuery({ days: 30 }, { retry: false });
  const { data: messagingQueue, error: messagingQueueError } =
    trpc.admin.messagingRegistrationQueue.useQuery(undefined, { retry: false });
  const {
    data: messagingHistory,
    error: messagingHistoryError,
    isFetching: messagingHistoryFetching,
  } = trpc.admin.messagingRegistrationHistory.useQuery(
    {
      practiceId: messagingHistorySelection?.practiceId ?? EMPTY_UUID,
      limit: MESSAGING_HISTORY_LIMIT,
    },
    { enabled: Boolean(messagingHistorySelection), retry: false },
  );
  const { data: smsOperations, error: smsOperationsError } =
    trpc.admin.smsOperationsHealth.useQuery(undefined, { retry: false });
  const { data: smsConfiguration, error: smsConfigurationError } =
    trpc.admin.hostedSmsConfiguration.useQuery(undefined, { retry: false });
  const [extendTrialError, setExtendTrialError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [messagingError, setMessagingError] = useState<string | null>(null);
  const extendTrial = trpc.admin.extendTrial.useMutation({
    onSuccess: () => {
      setExtendTrialError(null);
      utils.admin.overview.invalidate();
    },
    onError: (err) => setExtendTrialError(err.message),
  });
  const setAnalyticsExcluded = trpc.admin.setAnalyticsExcluded.useMutation({
    onSuccess: () => {
      setAnalyticsError(null);
      utils.admin.overview.invalidate();
      utils.admin.activationFunnel.invalidate();
      utils.admin.activationRecovery.invalidate();
    },
    onError: (err) => setAnalyticsError(err.message),
  });
  const refreshMessagingQueue = () =>
    utils.admin.messagingRegistrationQueue.invalidate();
  const submitMessagingBrand = trpc.admin.submitMessagingBrand.useMutation({
    onSuccess: () => {
      setMessagingError(null);
      refreshMessagingQueue();
    },
    onError: (err) => setMessagingError(err.message),
  });
  const submitMessagingCampaign =
    trpc.admin.submitMessagingCampaign.useMutation({
      onSuccess: () => {
        setMessagingError(null);
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const assignMessagingNumbers = trpc.admin.assignMessagingNumbers.useMutation({
    onSuccess: () => {
      setMessagingError(null);
      refreshMessagingQueue();
    },
    onError: (err) => setMessagingError(err.message),
  });
  const inspectMessagingProfile =
    trpc.admin.inspectMessagingProfile.useMutation({
      onSuccess: (result) => {
        setMessagingError(
          result.blockers.length > 0
            ? `Provider profile is not ready: ${result.blockers.join("; ")}.`
            : null,
        );
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const setMessagingProfileEnabled =
    trpc.admin.setMessagingProfileEnabled.useMutation({
      onSuccess: () => {
        setMessagingError(null);
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const attachMessagingProviderIds =
    trpc.admin.attachMessagingProviderIds.useMutation({
      onSuccess: () => {
        setMessagingError(null);
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const clearStaleMessagingSubmissionLock =
    trpc.admin.clearStaleMessagingSubmissionLock.useMutation({
      onSuccess: () => {
        setMessagingError(null);
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const reconcileMessagingRegistration =
    trpc.admin.reconcileMessagingRegistration.useMutation({
      onSuccess: () => {
        setMessagingError(null);
        refreshMessagingQueue();
      },
      onError: (err) => setMessagingError(err.message),
    });
  const {
    data: swarmHealth,
    error: swarmHealthError,
  } = trpc.extensions.aiSwarm.getStatus.useQuery(undefined, {
    retry: false,
    refetchInterval: 30000,
  });

  // Read-only derivation of the AI swarm system-health KPIs and sprint log.
  const swarmDerived = useMemo(() => {
    const fleet = swarmHealth?.fleet ?? [];
    const sessions = swarmHealth?.sessions ?? [];
    const stats = swarmHealth?.stats;
    const lastDeployAt = sessions
      .filter((session) => session.status === "COMPLETED")
      .map((session) => session.createdAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    return {
      totalAgents: stats?.totalAgents ?? fleet.length,
      activeAgents: fleet.filter(
        (agent) => agent.status === "ready" || agent.status === "busy",
      ).length,
      totalSessions: stats?.totalSessions ?? sessions.length,
      completedSessions: stats?.completedSessions ?? 0,
      failedSessions: stats?.failedSessions ?? 0,
      runningSessions: stats?.runningSessions ?? 0,
      pendingSessions: stats?.pendingSessions ?? 0,
      sessions,
      lastDeployAt: lastDeployAt ?? null,
    };
  }, [swarmHealth]);

  if (error?.data?.code === "FORBIDDEN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">{t("admin.accessDenied.title", "Access Denied")} {/* Access Denied */}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin.accessDenied.desc", "This area is for OpenVPM platform operators only.")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("admin.error.title", "Unable to load platform admin")}
        description={error.message}
        action={{
          label: t("admin.error.retry", "Retry"),
          onClick: () => refetch(),
        }}
        className="border-destructive/30 bg-destructive/5"
      />
    );
  }

  if (isLoading) return <PageLoading className="py-24" />;

  if (!data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("admin.error.title", "Unable to load platform admin")}
        description={t(
          "admin.error.missingData",
          "The admin overview finished without returning data. Try loading it again.",
        )}
        action={{
          label: t("admin.error.retry", "Retry"),
          onClick: () => refetch(),
        }}
        className="border-destructive/30 bg-destructive/5"
      />
    );
  }

  const kpis: {
    label: string;
    displayLabel: string;
    value: string;
    icon: LucideIcon;
    tone?: "primary" | "warning" | "destructive" | "muted";
  }[] = [
    {
      label: "Practices",
      displayLabel: t("admin.kpi.practices", "Practices"),
      value: String(data.totals.practices),
      icon: Building2,
    },
    {
      label: "Est. MRR",
      displayLabel: t("admin.kpi.estMrr", "Est. MRR"),
      value: formatUsd(data.totals.estimatedMrr),
      icon: Euro,
    },
    {
      label: "Active trials",
      displayLabel: t("admin.kpi.activeTrials", "Active trials"),
      value: String(data.totals.activeTrials),
      icon: Clock,
    },
    {
      label: "Active",
      displayLabel: t("admin.kpi.active", "Active"),
      value: String(data.totals.active),
      icon: CheckCircle
    },
    {
      label: "Past due",
      displayLabel: t("admin.kpi.pastDue", "Past due"),
      value: String(data.totals.pastDue),
      icon: AlertTriangle,
      tone: data.totals.pastDue > 0 ? "destructive" : undefined,
    },
  ];

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={ShieldCheck}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {t("admin.header.title", "Platform Admin")}
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 font-semibold text-primary"
            >
              {t("admin.header.badge", "ADMIN")}
            </Badge>
          </span>
        }
        subtitle={t("admin.header.subtitle", "Cross-tenant operations overview")}
      />

      {/* KPIs */}
      <KpiGrid className="sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.displayLabel ?? k.label}
            value={k.value}
            icon={k.icon}
            tone={k.tone}
            className="p-4"
          />
        ))}
      </KpiGrid>

      {/* AI swarm system health */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span className="text-sm">
                {t("admin.systemHealth.title", "AI swarm system health")}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "admin.systemHealth.desc",
                "Read-only status of the Arena agent fleet, dispatched sprints, arena sessions, and the last deployment. Full controls live in the AI Swarm hub.",
              )}
            </p>
          </div>
          <Link href="/admin/ai-swarm" className="shrink-0">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.systemHealth.openHub", "Open AI Swarm hub")}
            </Button>
          </Link>
        </div>
        {swarmHealth ? (
          <>
            <KpiGrid className="mt-4">
              <KpiCard
                icon={Bot}
                tone="primary"
                label={t("admin.systemHealth.activeAgents", "Active agents")}
                value={`${swarmDerived.activeAgents}/${swarmDerived.totalAgents}`}
              />
              <KpiCard
                icon={Workflow}
                label={t("admin.systemHealth.sprintsDispatched", "Sprints dispatched")}
                value={String(swarmDerived.totalSessions)}
                hint={
                  swarmDerived.failedSessions > 0
                    ? t(
                        "admin.systemHealth.sprintsHint",
                        "{merged} merged · {failed} failed",
                        {
                          merged: swarmDerived.completedSessions,
                          failed: swarmDerived.failedSessions,
                        },
                      )
                    : undefined
                }
              />
              <KpiCard
                icon={Activity}
                label={t("admin.systemHealth.arenaSessions", "Arena sessions")}
                value={String(swarmDerived.runningSessions)}
                hint={
                  swarmDerived.runningSessions === 0 &&
                  swarmDerived.pendingSessions > 0
                    ? t(
                        "admin.systemHealth.sessionsHint",
                        "{pending} pending · {total} total",
                        {
                          pending: swarmDerived.pendingSessions,
                          total: swarmDerived.totalSessions,
                        },
                      )
                    : undefined
                }
              />
              <KpiCard
                icon={Rocket}
                label={t("admin.systemHealth.lastDeploy", "Last deploy")}
                value={
                  swarmDerived.lastDeployAt
                    ? formatDateTime(swarmDerived.lastDeployAt)
                    : "—"
                }
                hint={
                  swarmDerived.lastDeployAt
                    ? undefined
                    : t("admin.systemHealth.noDeployYet", "No merged sprints yet")
                }
              />
            </KpiGrid>

            {/* Sprint log */}
            <div className="mt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Workflow className="h-4 w-4" />
                <span className="text-sm">
                  {t("admin.systemHealth.sprintLogTitle", "Sprint log")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "admin.systemHealth.sprintLogDesc",
                  "Most recently dispatched Arena sprints and their merge state.",
                )}
              </p>
              <DataTableFrame className="mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className={tableHeadClass}>
                        {t("admin.systemHealth.sprint", "Sprint / module")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.systemHealth.status", "Status")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.systemHealth.progress", "Progress")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.systemHealth.started", "Started")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {swarmDerived.sessions.map((session) => (
                      <tr key={session.sessionId} className={tableRowClass}>
                        <td className={cn(tableCellClass, "font-medium")}>
                          <div className="max-w-sm">
                            <div className="truncate">{session.module}</div>
                            {session.promptSummary ? (
                              <div className="truncate text-[11px] text-muted-foreground">
                                {session.promptSummary}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          {session.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-medium text-success-muted-foreground">
                              <CheckCircle className="h-3 w-3" />
                              {t("admin.systemHealth.merged", "Merged")}
                            </span>
                          ) : session.status === "RUNNING" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-info-muted px-2 py-0.5 text-[11px] font-medium text-info-muted-foreground">
                              <Radio className="h-3 w-3 animate-pulse" />
                              {t("admin.systemHealth.running", "Running")}
                            </span>
                          ) : session.status === "FAILED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {t("admin.systemHealth.failed", "Failed")}
                            </span>
                          ) : session.status === "PENDING" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-[11px] font-medium text-warning-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {t("admin.systemHealth.pending", "Pending")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {t("admin.systemHealth.unknown", "Unknown")}
                            </span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <div className="max-w-xs truncate text-[11px] text-muted-foreground">
                            {session.progress || "—"}
                          </div>
                        </td>
                        <td className={cn(tableCellClass, "font-mono text-[11px] text-muted-foreground")}>
                          {session.createdAt || "—"}
                        </td>
                      </tr>
                    ))}
                    {swarmDerived.sessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-xs text-muted-foreground"
                        >
                          {t("admin.systemHealth.sprintLogEmpty", "No sprints dispatched yet.")}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </DataTableFrame>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {swarmHealthError
              ? t(
                  "admin.systemHealth.loadError",
                  "Could not load AI swarm system health.",
                )
              : t(
                  "admin.systemHealth.loading",
                  "Loading AI swarm system health…",
                )}
          </p>
        )}
      </div>

      <ClinicPilotConsole practices={data.practices} />

      {/* Clinical Simulation & Discovery */}
      <ClinicalSimulationAdminCard />

      {/* SMS operations health */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">{t("admin.sections.smsHealth", "SMS operations health")}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "admin.smsHealth.readOnlyDesc",
                "Read-only carrier, provider-profile, provider-event, send-attempt, and delivery evidence. This monitor never enables sending or changes provider state.",
              )}
            </p>
          </div>
          {smsOperations ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                smsOperations.status === "critical"
                  ? "bg-destructive/10 text-destructive"
                  : smsOperations.status === "attention"
                    ? "bg-warning-muted text-warning-muted-foreground"
                    : "bg-success-muted text-success-muted-foreground"
              }`}
            >
              {smsOperations.status === "critical"
                ? t("admin.smsHealth.critical", "Critical")
                : smsOperations.status === "attention"
                  ? t("admin.smsHealth.attention", "Attention")
                  : smsOperations.status}
            </span>
          ) : null}
        </div>
        {smsConfiguration ? (
          <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("admin.sections.hostedSms", "Hosted SMS configuration")}</p>
              <span className="text-xs text-muted-foreground">
                {smsConfiguration.rolloutIntended
                  ? smsConfiguration.providerIsTelnyx &&
                    smsConfiguration.apiKeyShapeValid &&
                    smsConfiguration.webhookPublicKeyShapeValid &&
                    smsConfiguration.registrationEncryptionKeyShapeValid &&
                    smsConfiguration.provisioningScopeExact &&
                    smsConfiguration.sendingScopeExact &&
                    smsConfiguration.inboundEnabled
                    ? t("admin.smsHealth.rolloutConfigured", "Rollout configured")
                    : t("admin.smsHealth.needsAttention", "Needs attention")
                  : t("admin.smsHealth.safelyDeferred", "Safely deferred")}
              </span>
            </div>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {[
                [t("admin.smsHealth.telnyxProvider", "Telnyx provider"), smsConfiguration.providerIsTelnyx],
                [t("admin.smsHealth.apiKeyShape", "API key shape"), smsConfiguration.apiKeyShapeValid],
                [
                  t("admin.smsHealth.webhookKeyShape", "Webhook key shape"),
                  smsConfiguration.webhookPublicKeyShapeValid,
                ],
                [
                  t("admin.smsHealth.registrationKeyShape", "Registration key shape"),
                  smsConfiguration.registrationEncryptionKeyShapeValid,
                ],
                [
                  t("admin.smsHealth.provisioningScopeExact", "Provisioning scope exact"),
                  smsConfiguration.provisioningScopeExact,
                ],
                [t("admin.smsHealth.sendingScopeExact", "Sending scope exact"), smsConfiguration.sendingScopeExact],
                [t("admin.smsHealth.inboundGateEnabled", "Inbound gate enabled"), smsConfiguration.inboundEnabled],
              ].map(([label, valid]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5"
                >
                  <span>{label}</span>
                  <span
                    className={
                      valid
                        ? "font-medium text-success"
                        : "font-medium text-destructive"
                    }
                  >
                    {valid
                      ? t("admin.smsHealth.valid", "Valid")
                      : t("admin.smsHealth.fix", "Fix")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "admin.smsHealth.scopeSummary",
                "Provisioning {prov} · sending {send} · scopes {pScope}/{sScope}/{lScope} (provisioning / sending practice / sending location). No secret values are shown.",
                {
                  prov: smsConfiguration.provisioningEnabled ? "on" : "off",
                  send: smsConfiguration.sendingEnabled ? "on" : "off",
                  pScope: smsConfiguration.provisioningPracticeScopeCount,
                  sScope: smsConfiguration.sendingPracticeScopeCount,
                  lScope: smsConfiguration.sendingLocationScopeCount,
                },
              )}
            </p>
          </div>
        ) : smsConfigurationError ? (
          <p className="mt-3 text-sm text-red-700">
            {t("admin.hostedSms.loadError", "Could not load hosted SMS configuration diagnostics.")}
          </p>
        ) : null}
        {smsOperations ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                [
                  t("admin.smsHealth.critical", "Critical"),
                  smsOperations.counts.critical,
                  "text-destructive",
                ],
                [
                  t("admin.smsHealth.attention", "Attention"),
                  smsOperations.counts.attention,
                  "text-warning-muted-foreground",
                ],
                [
                  t("admin.smsHealth.sendExceptions", "Send exceptions"),
                  smsOperations.counts.sendAttempts,
                  "text-foreground",
                ],
                [
                  t("admin.smsHealth.deliveryExceptions", "Delivery exceptions"),
                  smsOperations.counts.deliveryEvents +
                    smsOperations.counts.staleWithoutFinal,
                  "text-foreground",
                ],
                [
                  t("admin.smsHealth.providerEvents", "Provider events"),
                  smsOperations.counts.providerEvents,
                  smsOperations.counts.providerEventsQuarantined > 0 ||
                  smsOperations.counts.providerEventConflicts > 0
                    ? "text-destructive"
                    : "text-foreground",
                ],
              ].map(([label, value, tone]) => (
                <div
                  key={String(label)}
                  className="rounded-md border border-border p-3"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Carrier {smsOperations.counts.carrier} · Profile{" "}
              {smsOperations.counts.profile} · Provider audit failures{" "}
              {smsOperations.counts.providerAuditFailures} · Generated{" "}
              {new Date(smsOperations.generatedAt).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Provider events: {smsOperations.counts.providerEventsPending}{" "}
              pending · {smsOperations.counts.providerEventsRetry} retry ·{" "}
              {smsOperations.counts.providerEventsBlockedRecovery}{" "}
              recovery-blocked ·{" "}
              {smsOperations.counts.providerEventsQuarantined} quarantined ·{" "}
              {smsOperations.counts.providerEventConflicts} identity conflicts ·{" "}
              {smsOperations.counts.providerEventsStale} stale
            </p>
            {smsOperations.items.length > 0 ? (
              <DataTableFrame className="mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className={tableHeadClass}>
                        {t("admin.smsHealth.priority", "Priority")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.smsHealth.clinicLocation", "Clinic / location")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.smsHealth.category", "Category")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.smsHealth.age", "Age")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.smsHealth.reason", "Reason")}
                      </th>
                      <th className={tableHeadClass}>{t("admin.table.nextAction", "Next action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smsOperations.items.map((item, index) => (
                      <tr
                        key={`${item.severity}-${item.category}-${item.practiceName}-${item.locationName ?? "practice"}-${index}`}
                        className={cn(tableRowClass, "align-top")}
                      >
                        <td className={tableCellClass}>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                              item.severity === "p0"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning-muted text-warning-muted-foreground"
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          <p className="font-medium">{item.practiceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.locationName ?? "Practice-wide"}
                          </p>
                        </td>
                        <td className={cn(tableCellClass, "capitalize text-muted-foreground")}>
                          {item.category.replaceAll("_", " ")}
                        </td>
                        <td className={cn(tableCellClass, "tabular-nums text-muted-foreground")}>
                          {formatAgeMinutes(item.ageMinutes)}
                        </td>
                        <td className={tableCellClass}>{item.reason}</td>
                        <td className={cn(tableCellClass, "font-medium")}>
                          {item.nextAction}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableFrame>
            ) : (
              <div className="mt-4 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                {t(
                  "admin.smsHealth.noExceptions",
                  "No SMS operational exceptions need attention.",
                )}
              </div>
            )}
            {smsOperations.truncated ? (
              <p className="mt-2 text-xs font-medium text-warning-muted-foreground">
                {t(
                  "admin.smsHealth.bounded",
                  "Results are bounded. Resolve the oldest items, then refresh for the remaining queue.",
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {smsOperationsError
              ? t("admin.smsHealth.loadError", "Could not load SMS operations health.")
              : t("admin.smsHealth.loading", "Loading SMS operations health…")}
          </p>
        )}
      </div>

      <SmsRecoveryConsole />

      {/* Activation recovery queue */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">{t("admin.sections.activationRecovery", "Clinic activation recovery")}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "admin.recovery.desc",
            "Ranked by the next operator action, then by days since a real clinic milestone. Internal/test workspaces and sample data are excluded.",
          )}
        </p>
        {recoveryQueue ? (
          <DataTableFrame className="mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={tableHeadClass}>
                    {t("admin.recovery.rank", "Rank")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.recovery.clinicContact", "Clinic contact")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.recovery.trial", "Trial")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.recovery.setup", "Setup")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.recovery.realActivity", "Real activity")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.recovery.stage", "Stage")}
                  </th>
                  <th className={tableHeadClass}>{t("admin.table.nextAction", "Next action")}</th>
                </tr>
              </thead>
              <tbody>
                {recoveryQueue.map((clinic) => (
                  <tr
                    key={clinic.practiceId}
                    className={cn(tableRowClass, "align-top")}
                  >
                    <td className={cn(tableCellClass, "font-medium tabular-nums")}>
                      {clinic.queueRank}
                    </td>
                    <td className={tableCellClass}>
                      <p className="font-medium">{clinic.practiceName}</p>
                      {clinic.verifiedAdminEmail &&
                      clinic.verifiedAdminEmailAt ? (
                        <a
                          href={`mailto:${clinic.verifiedAdminEmail}`}
                          className="mt-0.5 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          {clinic.verifiedAdminName
                            ? `${clinic.verifiedAdminName} · `
                            : ""}
                          {clinic.verifiedAdminEmail}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium text-warning-muted-foreground">
                          {t("admin.recovery.noVerifiedContact", "No verified admin contact")}
                        </p>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          recoveryTrialStyles[clinic.trialState] ??
                          recoveryTrialStyles.no_trial
                        }`}
                      >
                        {recoveryLabel(clinic.trialState)}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {clinic.trialEndsAt
                          ? t("admin.recovery.trialEnds", "Ends {date}", { date: formatDate(clinic.trialEndsAt, clinic.timezone) })
                          : t("admin.recovery.noTrialEnd", "No trial end")}
                      </p>
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>
                      <p>{clinic.setupStage}</p>
                      {clinic.setupHelpRequestedAt ? (
                        <p className="mt-0.5 text-xs font-medium text-success">
                          {t(
                            "admin.recovery.helpRequested",
                            "Help requested {date}",
                            {
                              date: formatDate(
                                clinic.setupHelpRequestedAt,
                                clinic.timezone,
                              ),
                            },
                          )}
                        </p>
                      ) : null}
                    </td>
                    <td className={tableCellClass}>
                      <p className="tabular-nums">
                        {t(
                          "admin.recovery.clientsAndVisits",
                          "{clients} clients · {visits} visits",
                          {
                            clients: clinic.realClientCount,
                            visits: clinic.realAppointmentCount,
                          },
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(
                          "admin.recovery.lastActivityStalled",
                          "Last {date} · stalled {days}d",
                          {
                            date: formatDate(
                              clinic.lastMeaningfulActivityAt,
                              clinic.timezone,
                            ),
                            days: clinic.stallAgeDays,
                          },
                        )}
                      </p>
                    </td>
                    <td className={cn(tableCellClass, "capitalize text-muted-foreground")}>
                      {recoveryLabel(clinic.authoritativeStage)}
                    </td>
                    <td className={tableCellClass}>
                      <p className="font-medium">{clinic.nextAction}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(
                          "admin.recovery.priority",
                          "Priority {priority}",
                          {
                            priority: clinic.nextActionPriority,
                          },
                        )}
                      </p>
                    </td>
                  </tr>
                ))}
                {recoveryQueue.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-xs text-muted-foreground"
                    >
                      {t("admin.recovery.empty", "No clinic workspaces need activation recovery.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DataTableFrame>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {recoveryError
              ? t("admin.recovery.loadError", "Could not load activation recovery.")
              : t("admin.recovery.loading", "Loading activation recovery…")}
          </p>
        )}
      </div>

      {/* Messaging carrier operations */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm">{t("admin.sections.messagingCarrier", "Messaging carrier registrations")}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "admin.messaging.desc",
            "Brand and campaign submissions incur Telnyx charges and require an explicit confirmation. Refresh is read-only. Assignment never enables sending.",
          )}
        </p>
        {messagingError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {messagingError}
          </div>
        ) : null}
        {messagingQueue ? (
          <DataTableFrame className="mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={tableHeadClass}>
                    {t("admin.messaging.clinic", "Clinic")}
                  </th>
                  <th className={tableHeadClass}>{t("admin.table.status", "Status")}</th>
                  <th className={tableHeadClass}>
                    {t("admin.messaging.brand", "Brand")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.messaging.campaign", "Campaign")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.messaging.numbers", "Numbers")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("admin.messaging.operatorAction", "Operator action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {messagingQueue.map((registration) => {
                  const busy = Boolean(registration.submissionLockAt);
                  const lockIsStale =
                    registration.submissionLockAt != null &&
                    Date.now() -
                      new Date(registration.submissionLockAt).getTime() >=
                      15 * 60 * 1000;
                  const anyMutationPending =
                    submitMessagingBrand.isPending ||
                    submitMessagingCampaign.isPending ||
                    assignMessagingNumbers.isPending ||
                    inspectMessagingProfile.isPending ||
                    setMessagingProfileEnabled.isPending ||
                    attachMessagingProviderIds.isPending ||
                    clearStaleMessagingSubmissionLock.isPending ||
                    reconcileMessagingRegistration.isPending;
                  return (
                    <tr key={registration.id} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <p className="font-medium">
                          {registration.practiceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {registration.legalName} · EIN ••••
                          {registration.taxIdLast4}
                        </p>
                        {registration.lastError ? (
                          <p className="mt-1 max-w-xs text-xs text-destructive">
                            {registration.lastError}
                          </p>
                        ) : null}
                      </td>
                      <td className={tableCellClass}>
                        {t(
                          `admin.messaging.status_${registration.status}`,
                          registration.status.replace("_", " "),
                        )}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {registration.providerBrandStatus ?? t("admin.messaging.notSubmitted", "Not submitted")}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {registration.providerCampaignStatus ?? t("admin.messaging.notSubmitted", "Not submitted")}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {registration.senders.length === 0
                          ? t("admin.messaging.noNumber", "No number")
                          : registration.senders
                              .map(
                                (sender) =>
                                  `${
                                    sender.senderLast4
                                      ? `Number ••••${sender.senderLast4}`
                                      : "Number not assigned"
                                  } (${sender.registrationStatus}; ${
                                    sender.providerProfileReady
                                      ? "provider ready"
                                      : "provider not verified"
                                  })${
                                    sender.registrationDetail
                                      ? ` — ${sender.registrationDetail}`
                                      : ""
                                  }`,
                              )
                              .join(", ")}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                            onClick={() =>
                              setMessagingHistorySelection({
                                practiceId: registration.practiceId,
                                practiceName: registration.practiceName,
                              })
                            }
                          >
                            {t("admin.messaging.history", "History")}
                          </button>
                          {!registration.providerBrandId ? (
                            <button
                              type="button"
                              disabled={busy || anyMutationPending}
                              className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: registration.lastError
                                    ? "Retry messaging brand"
                                    : "Submit messaging brand",
                                  description: registration.lastError
                                    ? `Retry ${registration.practiceName}'s brand only after confirming in the Telnyx portal that no brand was created. This can incur another non-refundable charge. Continue?`
                                    : `Submit ${registration.practiceName}'s legal brand to Telnyx? This incurs a non-refundable provider charge.`,
                                  confirmVariant: "destructive",
                                  confirmLabel: registration.lastError ? "Retry brand" : "Submit brand",
                                });
                                if (confirmed) {
                                  submitMessagingBrand.mutate({
                                    practiceId: registration.practiceId,
                                    confirmProviderCharges: true,
                                    retryAfterProviderReview: Boolean(
                                      registration.lastError,
                                    ),
                                  });
                                }
                              }}
                            >
                              {registration.lastError
                                ? t("admin.messaging.retryBrand", "Retry reviewed brand")
                                : t("admin.messaging.submitBrand", "Submit brand")}
                            </button>
                          ) : null}
                          {registration.providerBrandId &&
                          !registration.providerCampaignId ? (
                            <button
                              type="button"
                              disabled={busy || anyMutationPending}
                              className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: registration.lastError
                                    ? "Retry messaging campaign"
                                    : "Submit messaging campaign",
                                  description: registration.lastError
                                    ? `Retry ${registration.practiceName}'s campaign only after confirming in the Telnyx portal that no matching campaign exists. This can incur another non-refundable charge. Continue?`
                                    : `Submit ${registration.practiceName}'s campaign to Telnyx? This incurs non-refundable provider charges.`,
                                  confirmVariant: "destructive",
                                  confirmLabel: registration.lastError ? "Retry campaign" : "Submit campaign",
                                });
                                if (confirmed) {
                                  submitMessagingCampaign.mutate({
                                    practiceId: registration.practiceId,
                                    confirmProviderCharges: true,
                                    retryAfterProviderReview: Boolean(
                                      registration.lastError,
                                    ),
                                  });
                                }
                              }}
                            >
                              {registration.lastError
                                ? t("admin.messaging.retryCampaign", "Retry reviewed campaign")
                                : t("admin.messaging.submitCampaign", "Submit campaign")}
                            </button>
                          ) : null}
                          {registration.providerCampaignId ? (
                            <button
                              type="button"
                              disabled={busy || anyMutationPending}
                              className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: "Assign texting numbers",
                                  description: `Assign ${registration.practiceName}'s texting numbers to its approved campaign? Sending will remain disabled.`,
                                  confirmLabel: "Assign numbers",
                                });
                                if (confirmed) {
                                  assignMessagingNumbers.mutate({
                                    practiceId: registration.practiceId,
                                    confirmProviderMutation: true,
                                  });
                                }
                              }}
                            >
                              {t("admin.messaging.assignNumbers", "Assign numbers")}
                            </button>
                          ) : null}
                          {registration.senders.map((sender) =>
                            sender.messagingProfileId ? (
                              <span
                                key={sender.locationId}
                                className="contents"
                              >
                                <button
                                  type="button"
                                  disabled={anyMutationPending}
                                  className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                                  onClick={() =>
                                    inspectMessagingProfile.mutate({
                                      practiceId: registration.practiceId,
                                      locationId: sender.locationId,
                                    })
                                  }
                                >
                                  {t("admin.messaging.inspectProfile", "Inspect profile")}
                                </button>
                                {!sender.providerProfileReady &&
                                registration.status === "active" &&
                                sender.registrationStatus === "active" ? (
                                  <button
                                    type="button"
                                    disabled={anyMutationPending}
                                    className="rounded border border-success/30 bg-success/5 px-2 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50"
                                    onClick={async () => {
                                      const confirmed = await confirm({
                                        title: "Enable provider profile",
                                        description: `Install ${registration.practiceName}'s exact clinic-branded START, STOP, and HELP rules, then enable its Telnyx profile only after OpenVPM verifies the webhook, US-only destination list, $10 daily cap, active campaign, and assigned number? Clinic sending will remain off.`,
                                        confirmLabel: "Enable profile",
                                      });
                                      if (confirmed) {
                                        setMessagingProfileEnabled.mutate({
                                          practiceId: registration.practiceId,
                                          locationId: sender.locationId,
                                          enabled: true,
                                          confirmProviderMutation: true,
                                        });
                                      }
                                    }}
                                  >
                                    {t("admin.messaging.enableProfile", "Enable provider profile")}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={anyMutationPending}
                                  className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                                  onClick={async () => {
                                    const confirmed = await confirm({
                                      title: "Disable provider profile",
                                      description: `Disable ${registration.practiceName}'s Telnyx profile and keep clinic sending off?`,
                                      confirmVariant: "destructive",
                                      confirmLabel: "Disable profile",
                                    });
                                    if (confirmed) {
                                      setMessagingProfileEnabled.mutate({
                                        practiceId: registration.practiceId,
                                        locationId: sender.locationId,
                                        enabled: false,
                                        confirmProviderMutation: true,
                                      });
                                    }
                                  }}
                                >
                                  {t("admin.messaging.disableProfile", "Disable provider profile")}
                                </button>
                              </span>
                            ) : null,
                          )}
                          {registration.providerBrandId ? (
                            <button
                              type="button"
                              title={t("admin.messaging.readCarrierStatus", "Read current carrier status")}
                              disabled={anyMutationPending}
                              className="inline-flex items-center rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              onClick={() =>
                                reconcileMessagingRegistration.mutate({
                                  practiceId: registration.practiceId,
                                })
                              }
                            >
                              <RefreshCw className="mr-1 h-3 w-3" /> {t("admin.messaging.refresh", "Refresh")}
                            </button>
                          ) : null}
                          {busy ? (
                            <>
                              <button
                                type="button"
                                disabled={anyMutationPending}
                                className="rounded border border-warning/30 bg-warning/5 px-2 py-1 text-xs font-medium text-warning-muted-foreground hover:bg-warning/10 disabled:opacity-50"
                                onClick={() => {
                                  const brandId = window.prompt(
                                    "After reviewing the Telnyx portal, enter the existing brand ID. Cancel if no provider object exists.",
                                  );
                                  if (!brandId) return;
                                  const campaignId = window.prompt(
                                    "Optional: enter the existing campaign ID, or leave blank.",
                                  );
                                  attachMessagingProviderIds.mutate({
                                    practiceId: registration.practiceId,
                                    providerBrandId: brandId.trim(),
                                    providerCampaignId:
                                      campaignId?.trim() || undefined,
                                    confirmProviderPortalReviewed: true,
                                  });
                                }}
                              >
                                {t("admin.messaging.recoverProviderIds", "Recover provider IDs")}
                              </button>
                              <button
                                type="button"
                                disabled={!lockIsStale || anyMutationPending}
                                title={
                                  lockIsStale
                                    ? "Use only after confirming no matching object exists in Telnyx"
                                    : "Available after the 15-minute safety window"
                                }
                                className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                                onClick={async () => {
                                  const providerObject =
                                    registration.providerBrandId
                                      ? "campaign"
                                      : "brand";
                                  const confirmed = await confirm({
                                    title: "Clear stale submission lock",
                                    description: `I reviewed the Telnyx portal and confirmed NO matching ${providerObject} exists. Clear the stale lock and keep all sending disabled?`,
                                    confirmVariant: "destructive",
                                    confirmLabel: "Clear stale lock",
                                  });
                                  if (confirmed) {
                                    clearStaleMessagingSubmissionLock.mutate({
                                      practiceId: registration.practiceId,
                                      providerObject,
                                      confirmProviderPortalReviewed: true,
                                      confirmNoProviderObjectExists:
                                        "NO_PROVIDER_OBJECT",
                                    });
                                  }
                                }}
                              >
                                {t("admin.messaging.clearStaleLock", "No object — clear stale lock")}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {messagingQueue.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {t("admin.messaging.empty", "No clinics have submitted carrier details yet.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DataTableFrame>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {messagingQueueError
              ? t("admin.messaging.loadError", "Could not load messaging registrations.")
              : t("admin.messaging.loading", "Loading messaging registrations…")}
          </p>
        )}
      </div>

      {/* Messaging carrier history */}
      {messagingHistorySelection ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("admin.messaging.historyTitle", "Carrier lifecycle history")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {messagingHistorySelection.practiceName} · newest first · at
                most {MESSAGING_HISTORY_LIMIT} redacted operational events
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              onClick={() => setMessagingHistorySelection(null)}
            >
              {t("admin.messaging.closeHistory", "Close history")}
            </button>
          </div>
          {messagingHistoryError ? (
            <p className="mt-3 text-sm text-destructive">
              {t("admin.messaging.historyLoadError", "Could not load carrier lifecycle history.")}
            </p>
          ) : messagingHistory ? (
            <>
              <DataTableFrame className="mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className={tableHeadClass}>
                        {t("admin.messaging.recorded", "Recorded")}
                      </th>
                      <th className={tableHeadClass}>
                        {t("admin.messaging.lifecycleEvent", "Lifecycle event")}
                      </th>
                      <th className={tableHeadClass}>{t("admin.table.status", "Status")}</th>
                      <th className={tableHeadClass}>
                        {t(
                          "admin.messaging.operationalEvidence",
                          "Operational evidence",
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {messagingHistory.events.map((event) => (
                      <tr key={event.id} className={cn(tableRowClass, "align-top")}>
                        <td className={tableCellClass}>
                          {formatDateTime(event.createdAt)}
                        </td>
                        <td className={cn(tableCellClass, "capitalize")}>
                          <p>{recoveryLabel(event.eventType)}</p>
                          <p className="mt-1 text-muted-foreground">
                            {recoveryLabel(event.operation)} · {event.provider}
                          </p>
                        </td>
                        <td className={cn(tableCellClass, "capitalize")}>
                          <p>
                            {recoveryLabel(
                              event.statusBefore ?? "not recorded",
                            )}{" "}
                            →{" "}
                            {recoveryLabel(event.statusAfter ?? "not recorded")}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Brand {event.providerBrandStatus ?? "—"} · campaign{" "}
                            {event.providerCampaignStatus ?? "—"}
                          </p>
                        </td>
                        <td className={cn(tableCellClass, "font-mono text-[11px]")}>
                          <p className="break-all">event {event.id}</p>
                          <p className="mt-1 break-all text-muted-foreground">
                            operation {event.operationId}
                          </p>
                          <p className="mt-1 break-all text-muted-foreground">
                            registration {event.registrationId} · location{" "}
                            {event.locationId ?? "—"}
                          </p>
                          <p className="mt-1 capitalize text-muted-foreground">
                            reason {recoveryLabel(event.reasonCode)}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            actor {event.actorLabel}
                          </p>
                        </td>
                      </tr>
                    ))}
                    {messagingHistory.events.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          {t("admin.messaging.historyEmpty", "No carrier lifecycle evidence has been recorded.")}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </DataTableFrame>
              {messagingHistory.truncated ? (
                <p className="mt-2 text-xs font-medium text-warning-muted-foreground">
                  {t(
                    "admin.messaging.historyTruncated",
                    "History is truncated at {limit} events. Review the newest evidence before taking any separate operator action.",
                    { limit: MESSAGING_HISTORY_LIMIT },
                  )}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {messagingHistoryFetching
                ? t(
                    "admin.messaging.loadingHistory",
                    "Loading redacted carrier history…",
                  )
                : t("admin.messaging.selectHistoryAgain", "Pre načítanie evidencie operátora znova kliknite na Históriu.")}
            </p>
          )}
        </div>
      ) : null}

      {/* Trial funnel */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">{t("admin.sections.journeyCohorts", "Production journey cohorts (30 days)")}</span>
        </div>
        {journey ? (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
              {[
                [t("admin.journey.visit", "Visit"), journey.totals.visitors, null],
                [t("admin.journey.demo", "Demo"), journey.totals.demos, journey.totals.demoRate],
                [
                  t("admin.journey.planStarted", "Plan started"),
                  journey.totals.signupProfileViewed,
                  journey.totals.profileViewRate,
                ],
                [
                  t("admin.journey.planBuilt", "Plan built"),
                  journey.totals.signupProfileCompleted,
                  journey.totals.profileCompletionRate,
                ],
                [
                  t("admin.journey.accountForm", "Account form"),
                  journey.totals.signupAccountViewed,
                  journey.totals.accountViewRate,
                ],
                [
                  t("admin.journey.signupSubmitted", "Signup submitted"),
                  journey.totals.signupSubmitted,
                  journey.totals.signupSubmitRate,
                ],
                [
                  t("admin.journey.registered", "Registered"),
                  journey.totals.registrations,
                  journey.totals.signupSuccessRate,
                ],
                [
                  t("admin.journey.activated", "Activated"),
                  journey.totals.activated,
                  journey.totals.activationRate,
                ],
                [
                  t("admin.journey.paymentMethod", "Payment method"),
                  journey.totals.paymentMethodCollected,
                  journey.totals.paymentMethodRate,
                ],
                [
                  t("admin.journey.positivePayment", "First positive payment"),
                  journey.totals.firstPositivePayment,
                  journey.totals.positivePaymentRate,
                ],
              ].map(([label, value, rate]) => (
                <div key={String(label)}>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                    {value}
                    {typeof rate === "number" ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {formatPct(rate)}
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-6">
              <p>Left before trying (7d+): {journey.totals.leftBeforeTrying}</p>
              <p>Demo without signup (7d+): {journey.totals.demoAbandoned}</p>
              <p>
                Signup stalled (7d+): {journey.totals.registrationAbandoned}
              </p>
              <p>
                Activation stalled (7d+): {journey.totals.activationAbandoned}
              </p>
              <p>
                Payment method without positive payment after trial (7d+):{" "}
                {journey.totals.paymentAbandoned}
              </p>
              <p>Client errors: {journey.totals.clientErrors}</p>
            </div>

            <DataTableFrame className="mt-5">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={tableHeadClass}>{t("admin.table.cohortWeek", "Cohort week")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.visit", "Visit")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.demo", "Demo")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.registered", "Registered")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.activated", "Activated")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.paymentMethod", "Payment method")}</th>
                    <th className={tableHeadClass}>{t("admin.journey.positivePayment", "Positive payment")}</th>
                  </tr>
                </thead>
                <tbody>
                  {journey.weeks.map((week) => (
                    <tr key={week.weekStart} className={tableRowClass}>
                      <td className={cn(tableCellClass, "font-medium")}>
                        {week.weekStart}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>
                        {week.visitors}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>{week.demos}</td>
                      <td className={cn(tableCellClass, "tabular-nums")}>
                        {week.registrations}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>
                        {week.activated}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>
                        {week.paymentMethodCollected}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>
                        {week.firstPositivePayment}
                      </td>
                    </tr>
                  ))}
                  {journey.weeks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-xs text-muted-foreground"
                      >
                        {t("admin.journey.empty", "No first-party journey cohorts recorded yet.")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </DataTableFrame>
            <p className="mt-3 text-xs text-muted-foreground">
              Anonymous first touch is carried across openvpm.com, demo, and
              signup. Rates are visit-to-step for demo and registration, then
              step-to-step. Stalls require seven full days; an active trial with
              a collected payment method is not treated as payment-abandoned.
              {journey.totals.historicalUnattributedRegistrations > 0
                ? ` ${journey.totals.historicalUnattributedRegistrations} historical registration(s) have no captured journey ID and remain explicitly unknown.`
                : ""}
              {journey.totals.repairableAttributionGaps > 0
                ? ` ${journey.totals.repairableAttributionGaps} registration(s) have a journey ID but are missing a first touch; reconciliation will repair them.`
                : ""}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {journeyError
              ? t("admin.journey.loadError", "Could not load journey cohorts.")
              : t("admin.journey.loading", "Loading journey cohorts...")}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">{t("admin.sections.trialFunnel", "Trial funnel (30 days)")}</span>
        </div>
        {funnel ? (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-3 xl:grid-cols-8">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.signups", "Signups")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.signups}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.setupStarted", "Setup started")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.setupStarted}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.setupStartRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.setupComplete", "Setup complete")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.setupCompleted}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.setupCompletionRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.activated", "Activated")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.activated}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.activationRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.firstVisitDone", "First visit done")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.firstVisitCompleted}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.firstVisitCompletionRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.paymentMethod", "Payment method")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.paymentMethodCollected}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.paymentMethodRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.firstPositivePayment", "First positive payment")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.firstPositivePayment}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.positivePaymentRate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("admin.funnel.currentlyActive", "Currently active")}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {funnel.totals.currentlyActive}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {formatPct(funnel.totals.currentlyActiveRate)}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Setup progress comes from the guided clinic setup. Activated =
              added a real client and booked a real visit. First visit done
              requires a completed clinical and billing closeout; its rate is
              measured from activated clinics. Payment method = a signed
              subscription Checkout completed with collection required. First
              positive payment = a signed, positive subscription invoice
              payment. Currently active is current billing state, not a
              historical conversion milestone.
            </p>

            <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-4">
              <p className="text-sm font-medium">
                {t("admin.funnel.billingConversion", "First real visit → billing setup")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.funnel.opportunities", "Conversion opportunities")}
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold tabular-nums">
                    {funnel.firstVisitBillingConversion.opportunities}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.funnel.within24h", "Within 24h")}
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold tabular-nums">
                    {funnel.firstVisitBillingConversion.convertedWithin24Hours}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {formatPct(
                        funnel.firstVisitBillingConversion
                          .conversionWithin24HoursRate,
                      )}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.funnel.within72h", "Within 72h")}
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold tabular-nums">
                    {funnel.firstVisitBillingConversion.convertedWithin72Hours}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {formatPct(
                        funnel.firstVisitBillingConversion
                          .conversionWithin72HoursRate,
                      )}
                    </span>
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Uses only first real visits at least 72 hours old. Clinics that
                connected billing before that visit are reported separately (
                {funnel.firstVisitBillingConversion.alreadyConnectedAtVisit})
                and are not in the opportunity denominator.
              </p>
            </div>
            <div className="mt-4 rounded-md border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("admin.funnel.evidenceQuality", "Conversion evidence quality")}
              </p>
              <p className="mt-1">
                Legacy business-stage rows are excluded; unknown evidence is
                never counted as zero or assigned a synthetic date.
              </p>
              <p className="mt-2 font-medium text-foreground">
                {t("admin.funnel.jurisdictionCohorts", "Jurisdiction cohorts")}: US{" "}
                {funnel.jurisdictionCohorts.confirmedUs.signups}
                {" → "}
                {funnel.jurisdictionCohorts.confirmedUs.activated} activated (
                {formatPct(
                  funnel.jurisdictionCohorts.confirmedUs.activationRate,
                )}
                ) · non-US {funnel.jurisdictionCohorts.confirmedNonUs.signups}
                {" → "}
                {funnel.jurisdictionCohorts.confirmedNonUs.activated} (
                {formatPct(
                  funnel.jurisdictionCohorts.confirmedNonUs.activationRate,
                )}
                ) · historical unknown{" "}
                {funnel.jurisdictionCohorts.unknown.signups}
                {" → "}
                {funnel.jurisdictionCohorts.unknown.activated} (
                {formatPct(funnel.jurisdictionCohorts.unknown.activationRate)})
              </p>
              <p className="mt-2">
                Legacy rows: {funnel.dataQuality.legacyBusinessStageRows} ·
                Unknown payment method:{" "}
                {funnel.dataQuality.unknownPaymentMethodPractices} · Unknown
                positive payment:{" "}
                {funnel.dataQuality.unknownPositivePaymentPractices}
                {" · "}Missing registrations:{" "}
                {funnel.dataQuality.missingRegistrationMilestones}
                {" · "}Missing activations:{" "}
                {funnel.dataQuality.missingActivationMilestones}
                {" · "}Unprojected Stripe evidence:{" "}
                {funnel.dataQuality.unprojectedStripeEvidence}
                {" · "}Unmapped Stripe evidence:{" "}
                {funnel.dataQuality.unmappedStripeEvidence}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {funnelError ? t("admin.funnel.loadError", "Could not load the funnel.") : t("admin.funnel.loading", "Loading funnel...")}
          </p>
        )}
      </div>

      {/* Practices table */}
      {extendTrialError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("admin.practices.extendTrialError", "Nepodarilo sa predĺžiť skúšobnú verziu")}: {extendTrialError}
        </div>
      )}
      {analyticsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("admin.practices.analyticsError", "Nepodarilo sa zmeniť zahrnutie do lievika")}: {analyticsError}
        </div>
      )}
      <DataTableFrame>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={tableHeadClass}>{t("admin.table.practice", "Practice")}</th>
              <th className={tableHeadClass}>{t("admin.table.tier", "Plan")}</th>
              <th className={tableHeadClass}>{t("admin.table.status", "Status")}</th>
              <th className={tableHeadClass}>{t("admin.table.source", "Source")}</th>
              <th className={tableHeadClass}>{t("admin.table.intent", "Intent")}</th>
              <th className={tableHeadClass}>{t("admin.table.setup", "Setup")}</th>
              <th className={tableHeadClass}>{t("admin.table.metrics", "Metrics")}</th>
              <th className={tableHeadClass}>{t("admin.table.trialEnds", "Trial ends")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("admin.table.locations", "Locations")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("admin.table.staff", "Staff")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("admin.table.baseMrr", "Base MRR")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("admin.table.clients", "Clients")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("admin.table.patients", "Patients")}</th>
              <th className={tableHeadClass}>{t("admin.table.country", "Country")}</th>
              <th className={tableHeadClass}>{t("admin.table.joined", "Joined")}</th>
            </tr>
          </thead>
          <tbody>
            {data.practices.map((p) => (
              <tr key={p.id} className={tableRowClass}>
                <td className={tableCellClass}>
                  <p className="font-medium">{p.name}</p>
                  {p.adminEmail ? (
                    <a
                      href={`mailto:${p.adminEmail}`}
                      className="mt-0.5 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {p.adminName ? `${p.adminName} · ` : ""}
                      {p.adminEmail}
                      {!p.adminEmailVerifiedAt
                        ? ` · ${t("admin.practices.unverified", "unverified")}`
                        : ""}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("admin.practices.noActiveContact", "No active admin contact")}
                    </p>
                  )}
                </td>
                <td className={cn(tableCellClass, "capitalize")}>{p.tier}</td>
                <td className={tableCellClass}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      statusStyles[p.billingStatus] ||
                      "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.billingStatus.replace("_", " ")}
                  </span>
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  {p.acquisitionSource}
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  {p.onboardingIntent}
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  <p>{p.setupStage}</p>
                  {p.setupHelpRequestedAt ? (
                    <p className="mt-0.5 text-xs font-medium text-success">
                      {t(
                        "admin.recovery.helpRequested",
                        "Help requested {date}",
                        {
                          date: formatDate(
                            p.setupHelpRequestedAt,
                            p.timezone,
                          ),
                        },
                      )}
                    </p>
                  ) : null}
                </td>
                <td className={tableCellClass}>
                  <button
                    type="button"
                    title={
                      p.analyticsExcluded
                        ? t("admin.practices.includeInReporting", "Include this practice in conversion reporting")
                        : t("admin.practices.excludeFromReporting", "Exclude this internal or test practice from conversion reporting")
                    }
                    aria-pressed={p.analyticsExcluded}
                    disabled={setAnalyticsExcluded.isPending}
                    onClick={() =>
                      setAnalyticsExcluded.mutate({
                        practiceId: p.id,
                        excluded: !p.analyticsExcluded,
                      })
                    }
                    className={`rounded border px-1.5 py-0.5 text-xs font-medium disabled:opacity-50 ${
                      p.analyticsExcluded
                        ? "border-warning/30 bg-warning/5 text-warning-muted-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.analyticsExcluded
                      ? t("admin.practices.excluded", "Excluded")
                      : t("admin.practices.exclude", "Exclude")}
                  </button>
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  <span className="inline-flex items-center gap-2">
                    {formatDate(p.trialEndsAt, p.timezone)}
                    {p.billingStatus === "trialing" && (
                      <button
                        type="button"
                        title={t("admin.practices.extendTrialTitle", "Give this trial 14 more days")}
                        disabled={extendTrial.isPending}
                        onClick={() =>
                          extendTrial.mutate({ practiceId: p.id, days: 14 })
                        }
                        className="rounded border border-border px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        +14d
                      </button>
                    )}
                  </span>
                </td>
                <td className={cn(tableCellClass, "text-right tabular-nums")}>
                  {p.locationCount}
                </td>
                <td className={cn(tableCellClass, "text-right tabular-nums")}>
                  {p.userCount}
                </td>
                <td className={cn(tableCellClass, "text-right tabular-nums")}>
                  {formatUsd(p.estimatedMrr)}
                </td>
                <td className={cn(tableCellClass, "text-right tabular-nums")}>
                  {p.clientCount}
                </td>
                <td className={cn(tableCellClass, "text-right tabular-nums")}>
                  {p.patientCount}
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  {p.country}
                </td>
                <td className={cn(tableCellClass, "text-muted-foreground")}>
                  {formatDate(p.createdAt, p.timezone)}
                </td>
              </tr>
            ))}
            {data.practices.length === 0 && (
              <tr>
                <td
                  colSpan={15}
                  className="px-4 py-8 text-center text-xs text-muted-foreground"
                >
                  {t("admin.practices.empty", "No practices yet.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DataTableFrame>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
