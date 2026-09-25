"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Cable,
  KeyRound,
  Plug,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Waypoints,
} from "lucide-react";

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
} from "@/components/layout/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

/**
 * Secure Interop Bridge v1 → v2 — operator console (Sprint 30).
 *
 * Reads `trpc.extensions.bridgeV1V2.*`. The bridge itself (encryption, schema
 * validation, statutory gates) lives in `@/lib/interop/bridge-v1v2`; this page
 * only observes and operates it. Every string goes through `useI18n()`.
 */

type BridgeTab = "endpoints" | "messages" | "contracts" | "keys" | "events";

const TABS: ReadonlyArray<{ value: BridgeTab; labelKey: string }> = [
  { value: "endpoints", labelKey: "interopBridge.tabs.endpoints" },
  { value: "messages", labelKey: "interopBridge.tabs.messages" },
  { value: "contracts", labelKey: "interopBridge.tabs.contracts" },
  { value: "keys", labelKey: "interopBridge.tabs.keys" },
  { value: "events", labelKey: "interopBridge.tabs.events" },
];

/** Status tokens follow docs/UIKIT.md semantics — no raw Tailwind colours. */
const MESSAGE_STATUS_CLASS: Record<string, string> = {
  validated: "border-primary/40 bg-primary-muted text-primary-muted-foreground",
  processed: "border-primary/40 bg-primary-muted text-primary-muted-foreground",
  acknowledged: "border-border bg-muted text-muted-foreground",
  received: "border-border bg-muted text-muted-foreground",
  quarantined: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  rejected: "border-destructive/50 bg-destructive-muted text-destructive font-medium",
  failed: "border-destructive/50 bg-destructive-muted text-destructive font-medium",
};

const ENDPOINT_STATUS_CLASS: Record<string, string> = {
  active: "border-primary/40 bg-primary-muted text-primary-muted-foreground",
  paused: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  revoked: "border-destructive/50 bg-destructive-muted text-destructive font-medium",
};

const EVENT_SEVERITY_CLASS: Record<string, string> = {
  info: "border-border bg-muted text-muted-foreground",
  warning: "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  critical: "border-destructive/50 bg-destructive-muted text-destructive font-medium",
};

const GATE_BADGES = [
  "clinicalDraft",
  "controlledSubstances",
  "sympathyGate",
] as const;

export default function InteropBridgePage() {
  const { t, locale } = useI18n();
  const [tab, setTab] = React.useState<BridgeTab>("endpoints");
  const [search, setSearch] = React.useState("");
  const [messageStatus, setMessageStatus] = React.useState<string>("ALL");
  const [selfTest, setSelfTest] = React.useState<string | null>(null);

  const overviewQuery = trpc.extensions.bridgeV1V2.getOverview.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const endpointsQuery = trpc.extensions.bridgeV1V2.listEndpoints.useQuery(
    { search: search.trim() || undefined },
    { enabled: tab === "endpoints" },
  );
  const messagesQuery = trpc.extensions.bridgeV1V2.listMessages.useQuery(
    {
      status: messageStatus === "ALL" ? undefined : (messageStatus as never),
      search: search.trim() || undefined,
      limit: 100,
      offset: 0,
    },
    { enabled: tab === "messages" },
  );
  const contractsQuery = trpc.extensions.bridgeV1V2.listContracts.useQuery(
    undefined,
    { enabled: tab === "contracts" },
  );
  const keysQuery = trpc.extensions.bridgeV1V2.listKeys.useQuery(undefined, {
    enabled: tab === "keys",
  });
  const eventsQuery = trpc.extensions.bridgeV1V2.listEvents.useQuery(
    { limit: 100 },
    { enabled: tab === "events" },
  );

  const dispatchMutation = trpc.extensions.bridgeV1V2.dispatch.useMutation();
  const ingestMutation = trpc.extensions.bridgeV1V2.ingest.useMutation();

  const overview = overviewQuery.data;
  const dateLocale = locale === "sk" ? "sk-SK" : "en-GB";
  const formatDateTime = React.useCallback(
    (value: Date | string | null | undefined) => {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    },
    [dateLocale],
  );

  const reasonLabel = React.useCallback(
    (code: string | null | undefined, fallbackKey: string) => {
      if (!code) return "—";
      return t(`${fallbackKey}.${code}`, code);
    },
    [t],
  );

  /**
   * Round-trip proof: seals a heartbeat envelope with the registered v1 key,
   * then feeds it back through the ingest path (signature → AES-256-GCM →
   * schema contract → safety gates). A healthy bridge answers `validated`.
   */
  const runSelfTest = async () => {
    setSelfTest("running");
    try {
      const now = new Date();
      const dispatched = await dispatchMutation.mutateAsync({
        direction: "v1_to_v2",
        messageType: "bridge.heartbeat",
        externalId: `selftest-${now.getTime()}`,
        payload: {
          runtime: "v1",
          at: now.toISOString(),
          version: overview?.policy.protocolVersion ?? "2026-09-bridge-v1",
          pendingMessages: 0,
        },
      });
      if (!dispatched.ok || !dispatched.message) {
        setSelfTest(
          `${t("interopBridge.selfTest.refused")}: ${reasonLabel(dispatched.failureCode, "interopBridge.reason")}`,
        );
        return;
      }
      const ingested = await ingestMutation.mutateAsync({
        envelope: dispatched.message.envelope,
      });
      setSelfTest(
        `${t("interopBridge.selfTest.result")}: ${t(`interopBridge.status.${ingested.status}`, ingested.status)}`,
      );
    } catch (error) {
      setSelfTest(
        error instanceof Error
          ? `${t("interopBridge.selfTest.failed")}: ${error.message}`
          : t("interopBridge.selfTest.failed"),
      );
    } finally {
      void overviewQuery.refetch();
    }
  };

  const refreshAll = () => {
    void overviewQuery.refetch();
    if (tab === "endpoints") void endpointsQuery.refetch();
    if (tab === "messages") void messagesQuery.refetch();
    if (tab === "contracts") void contractsQuery.refetch();
    if (tab === "keys") void keysQuery.refetch();
    if (tab === "events") void eventsQuery.refetch();
  };

  const isLoading =
    tab === "endpoints"
      ? endpointsQuery.isLoading
      : tab === "messages"
        ? messagesQuery.isLoading
        : tab === "contracts"
          ? contractsQuery.isLoading
          : tab === "keys"
            ? keysQuery.isLoading
            : eventsQuery.isLoading;

  const endpointItems = endpointsQuery.data?.items ?? [];
  const messageItems = messagesQuery.data?.items ?? [];
  const contractItems = contractsQuery.data?.items ?? [];
  const keyItems = keysQuery.data?.items ?? [];
  const eventItems = eventsQuery.data?.items ?? [];
  const total =
    tab === "endpoints"
      ? endpointsQuery.data?.total
      : tab === "messages"
        ? messagesQuery.data?.total
        : tab === "contracts"
          ? contractsQuery.data?.total
          : tab === "keys"
            ? keysQuery.data?.total
            : eventsQuery.data?.total;

  const hasRows =
    tab === "endpoints"
      ? endpointItems.length > 0
      : tab === "messages"
        ? messageItems.length > 0
        : tab === "contracts"
          ? contractItems.length > 0
          : tab === "keys"
            ? keyItems.length > 0
            : eventItems.length > 0;

  const rotationDue = overview?.keys.rotationDue ?? false;
  const attention =
    (overview?.messages.quarantined ?? 0) + (overview?.messages.rejected ?? 0);

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Waypoints}
        title={t("interopBridge.title", "Secure Interop Bridge v1 → v2")}
        subtitle={t(
          "interopBridge.subtitle",
          "Encrypted and schema-validated message exchange between the VPM v1 and v2 runtimes.",
        )}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshAll}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              {t("interopBridge.actions.refresh", "Refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void runSelfTest()}
              disabled={dispatchMutation.isPending || ingestMutation.isPending}
            >
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
              {t("interopBridge.actions.selfTest", "Verify round trip")}
            </Button>
          </>
        }
      />

      <div
        data-testid="interop-bridge-legislative-banner"
        role="note"
        className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-3"
      >
        {GATE_BADGES.map((gate) => (
          <div key={gate} className="flex items-start gap-2">
            {gate === "controlledSubstances" ? (
              <Siren aria-hidden className="mt-0.5 h-3.5 w-3.5 text-destructive" />
            ) : gate === "sympathyGate" ? (
              <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 text-warning" />
            ) : (
              <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 text-primary" />
            )}
            <p className="text-xs text-muted-foreground">
              {t(`interopBridge.gates.${gate}`, gate)}
            </p>
          </div>
        ))}
      </div>

      {selfTest && selfTest !== "running" ? (
        <div
          role="status"
          data-testid="interop-bridge-selftest"
          className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground"
        >
          {selfTest}
        </div>
      ) : null}

      <KpiGrid>
        <KpiCard
          icon={Plug}
          label={t("interopBridge.kpi.endpoints", "Peer endpoints")}
          tone={(overview?.endpoints.active ?? 0) > 0 ? "primary" : "muted"}
          value={overview?.endpoints.active ?? 0}
          hint={t("interopBridge.kpi.endpointsHint", "{count} registered", {
            count: overview?.endpoints.total ?? 0,
          })}
        />
        <KpiCard
          icon={ArrowLeftRight}
          label={t("interopBridge.kpi.traffic", "Messages (24 h)")}
          tone="muted"
          value={(overview?.messages.inbound24h ?? 0) + (overview?.messages.outbound24h ?? 0)}
          hint={t("interopBridge.kpi.trafficHint", "in {inbound} / out {outbound}", {
            inbound: overview?.messages.inbound24h ?? 0,
            outbound: overview?.messages.outbound24h ?? 0,
          })}
        />
        <KpiCard
          icon={ShieldCheck}
          label={t("interopBridge.kpi.validated", "Validated share")}
          tone={(overview?.messages.successRate ?? 0) >= 95 ? "primary" : "warning"}
          value={`${overview?.messages.successRate ?? 0}%`}
          hint={t("interopBridge.kpi.validatedHint", "{count} accepted", {
            count:
              (overview?.messages.validated ?? 0) + (overview?.messages.processed ?? 0),
          })}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("interopBridge.kpi.attention", "Quarantined / rejected")}
          tone={attention > 0 ? "destructive" : "muted"}
          value={attention}
          hint={
            rotationDue
              ? t("interopBridge.kpi.rotationDue", "Key rotation is due")
              : t("interopBridge.kpi.rotationOk", "Keys are current")
          }
        />
      </KpiGrid>

      <div
        role="tablist"
        aria-label={t("interopBridge.tabs.ariaLabel", "Bridge surfaces")}
        className={underlineTabsListClass}
      >
        {TABS.map((item) => {
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              data-state={selected ? "active" : "inactive"}
              className={`${underlineTabsTriggerClass} ${
                selected ? "text-foreground" : "text-muted-foreground"
              }`}
              onClick={() => setTab(item.value)}
            >
              {t(item.labelKey, item.value)}
            </button>
          );
        })}
      </div>

      <PageToolbar>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("interopBridge.search.placeholder", "Search messages or peers")}
        />
        {tab === "messages" ? (
          <select
            aria-label={t("interopBridge.search.statusFilter", "Status filter")}
            className={filterControlClass}
            value={messageStatus}
            onChange={(event) => setMessageStatus(event.target.value)}
          >
            {["ALL", "validated", "processed", "quarantined", "rejected", "acknowledged"].map(
              (status) => (
                <option key={status} value={status}>
                  {status === "ALL"
                    ? t("interopBridge.search.allStatuses", "All statuses")
                    : t(`interopBridge.status.${status}`, status)}
                </option>
              ),
            )}
          </select>
        ) : null}
        <span
          aria-live="polite"
          className="text-xs tabular-nums text-muted-foreground"
        >
          {t("interopBridge.results", "Results: {count}", { count: total ?? 0 })}
        </span>
      </PageToolbar>

      <DataTableFrame>
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : !hasRows ? (
          <EmptyState
            icon={Cable}
            title={t("interopBridge.empty.title", "Nothing to show yet")}
            description={t(
              "interopBridge.empty.description",
              "Register the peer runtime and its key, then every bridged message will be listed here.",
            )}
          />
        ) : tab === "endpoints" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.name", "Endpoint")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.runtime", "Runtime")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.direction", "Direction")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.baseUrl", "Base URL")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.key", "Active key")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.status", "Status")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.endpoints.lastSeen", "Last seen")}
                </th>
              </tr>
            </thead>
            <tbody>
              {endpointItems.map((endpoint) => (
                <tr key={endpoint.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-medium text-foreground`}>
                    {endpoint.name}
                  </td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {t(`interopBridge.runtime.${endpoint.runtime}`, endpoint.runtime)}
                  </td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {t(
                      `interopBridge.direction.${endpoint.direction}`,
                      endpoint.direction,
                    )}
                  </td>
                  <td className={`${tableCellClass} truncate font-mono`}>
                    {endpoint.baseUrl}
                  </td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {endpoint.activeKeyId ?? "—"}
                  </td>
                  <td className={tableCellClass}>
                    <Badge
                      variant="outline"
                      className={
                        ENDPOINT_STATUS_CLASS[endpoint.status] ??
                        "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {t(`interopBridge.endpointStatus.${endpoint.status}`, endpoint.status)}
                    </Badge>
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap tabular-nums`}>
                    {formatDateTime(endpoint.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : tab === "messages" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.created", "Received")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.type", "Message type")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.direction", "Direction")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.externalId", "Source record")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.status", "Status")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.gates", "Clinical gates")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.messages.size", "Size")}
                </th>
              </tr>
            </thead>
            <tbody>
              {messageItems.map((message) => (
                <tr key={message.id} className={tableRowClass}>
                  <td className={`${tableCellClass} whitespace-nowrap tabular-nums`}>
                    {formatDateTime(message.createdAt)}
                  </td>
                  <td className={`${tableCellClass} font-mono`}>{message.messageType}</td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {message.direction}
                  </td>
                  <td className={`${tableCellClass} truncate font-mono`}>
                    {message.externalId}
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className={
                          MESSAGE_STATUS_CLASS[message.status] ??
                          "border-border bg-muted text-muted-foreground"
                        }
                      >
                        {t(`interopBridge.status.${message.status}`, message.status)}
                      </Badge>
                      {message.failureCode ? (
                        <span
                          title={message.failureCode}
                          className="font-mono text-[11px] text-muted-foreground"
                        >
                          {reasonLabel(message.failureCode, "interopBridge.reason")}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap items-center gap-1">
                      {message.clinicalDraft ? (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted text-muted-foreground"
                        >
                          {t("interopBridge.badge.draft", "Draft — vet signs")}
                        </Badge>
                      ) : null}
                      {message.controlledSubstance ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/50 bg-destructive-muted text-destructive font-medium"
                        >
                          <Siren aria-hidden className="h-3 w-3" />
                          {t("interopBridge.badge.controlled", "OPL — manual entry")}
                        </Badge>
                      ) : null}
                      {message.sympathySuppressed ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning-muted text-warning-muted-foreground"
                        >
                          <ShieldAlert aria-hidden className="h-3 w-3" />
                          {t("interopBridge.badge.sympathy", "Outreach suppressed")}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap font-mono tabular-nums`}>
                    {t("interopBridge.messages.bytes", "{count} B", {
                      count: message.payloadByteSize,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : tab === "contracts" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.type", "Message type")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.direction", "Direction")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.schema", "Schema")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.strict", "Strict")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.status", "Status")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.contracts.approved", "Approved")}
                </th>
              </tr>
            </thead>
            <tbody>
              {contractItems.map((contract) => (
                <tr
                  key={`${contract.direction}-${contract.messageType}`}
                  className={tableRowClass}
                >
                  <td className={`${tableCellClass} font-mono`}>{contract.messageType}</td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {contract.direction}
                  </td>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {contract.schemaVersion}
                  </td>
                  <td className={tableCellClass}>
                    {contract.strict
                      ? t("interopBridge.contracts.strictYes", "Unknown fields rejected")
                      : t("interopBridge.contracts.strictNo", "Unknown fields allowed")}
                  </td>
                  <td className={tableCellClass}>
                    <Badge
                      variant="outline"
                      className={
                        contract.status === "active"
                          ? "border-primary/40 bg-primary-muted text-primary-muted-foreground"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {t(`interopBridge.contractStatus.${contract.status}`, contract.status)}
                    </Badge>
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap tabular-nums`}>
                    {contract.approvedAt
                      ? formatDateTime(contract.approvedAt)
                      : t("interopBridge.contracts.default", "Catalogue default")}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : tab === "keys" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.runtime", "Runtime")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.keyId", "Key id")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.fingerprint", "Fingerprint")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.age", "Age")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.status", "Status")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.keys.rotation", "Rotation")}
                </th>
              </tr>
            </thead>
            <tbody>
              {keyItems.map((key) => (
                <tr key={key.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono tabular-nums`}>
                    {t(`interopBridge.runtime.${key.runtime}`, key.runtime)}
                  </td>
                  <td className={`${tableCellClass} font-mono`}>{key.keyId}</td>
                  <td className={`${tableCellClass} truncate font-mono text-[11px]`}>
                    {key.fingerprint}
                  </td>
                  <td className={`${tableCellClass} whitespace-nowrap tabular-nums`}>
                    {t("interopBridge.keys.ageDays", "{days} d", { days: key.ageDays })}
                  </td>
                  <td className={tableCellClass}>
                    <Badge
                      variant="outline"
                      className={
                        key.status === "active"
                          ? "border-primary/40 bg-primary-muted text-primary-muted-foreground"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {t(`interopBridge.keyStatus.${key.status}`, key.status)}
                    </Badge>
                  </td>
                  <td className={tableCellClass}>
                    {key.rotationDue ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <RotateCw aria-hidden className="h-3 w-3" />
                        {t("interopBridge.keys.rotationDue", "Rotation due")}
                      </span>
                    ) : (
                      t("interopBridge.keys.rotationOk", "Within policy")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.events.at", "When")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.events.type", "Event")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.events.severity", "Severity")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.events.actor", "Actor")}
                </th>
                <th scope="col" className={`${tableCellClass} text-left font-medium`}>
                  {t("interopBridge.events.detail", "Detail")}
                </th>
              </tr>
            </thead>
            <tbody>
              {eventItems.map((event) => (
                <tr key={event.id} className={tableRowClass}>
                  <td className={`${tableCellClass} whitespace-nowrap tabular-nums`}>
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td className={`${tableCellClass} font-mono`}>{event.eventType}</td>
                  <td className={tableCellClass}>
                    <Badge
                      variant="outline"
                      className={
                        EVENT_SEVERITY_CLASS[event.severity] ??
                        "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {t(`interopBridge.severity.${event.severity}`, event.severity)}
                    </Badge>
                  </td>
                  <td className={`${tableCellClass} truncate font-mono`}>{event.actor}</td>
                  <td className={`${tableCellClass} truncate`}>{event.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </DataTableFrame>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <KeyRound aria-hidden className="mt-0.5 h-3.5 w-3.5" />
        {t(
          "interopBridge.legal.note",
          "Every payload is sealed with AES-256-GCM, signed with HMAC-SHA256 and validated against a strict schema before it reaches clinical data. Bridge secrets live only in the deployment secret store — the database keeps fingerprints.",
        )}
      </p>
    </div>
  );
}
