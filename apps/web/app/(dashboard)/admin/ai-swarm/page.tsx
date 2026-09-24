"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Copy,
  Check,
  Activity,
  Workflow,
  Users,
  ShieldCheck,
  ArrowLeft,
  Server,
  Database,
  Radio,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  pageShellClass,
  PageToolbar,
  SearchField,
  filterControlClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
  DataTableFrame,
  KpiGrid,
  KpiCard,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { EmptyState } from "@/components/common/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AiSwarmAdminPage() {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = React.useState<string>("fleet");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [copiedCli, setCopiedCli] = React.useState<boolean>(false);

  const { data, isLoading, refetch, isRefetching } =
    trpc.extensions.aiSwarm.getStatus.useQuery(undefined, {
      refetchInterval: 15000,
    });

  const isOnline = Boolean(data?.runtime.isOnline);
  const agentUiUrl = data?.runtime.agentUiUrl || "http://localhost:3007";
  const agentOsUrl = data?.runtime.agentOsUrl || "http://127.0.0.1:7777";

  const handleCopyCli = () => {
    navigator.clipboard.writeText("python .agents/agno/pipeline_team_os.py");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2500);
  };

  const handleOpenAgentUi = (targetUrl?: string) => {
    const url = targetUrl || agentUiUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Filter agents
  const filteredAgents = React.useMemo(() => {
    if (!data?.fleet) return [];
    return data.fleet.filter((ag) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ag.name.toLowerCase().includes(q) ||
        ag.role.toLowerCase().includes(q) ||
        ag.description.toLowerCase().includes(q) ||
        ag.model.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "ALL" || ag.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [data?.fleet, searchQuery, categoryFilter]);

  // Filter sessions
  const filteredSessions = React.useMemo(() => {
    if (!data?.sessions) return [];
    return data.sessions.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.sessionId.toLowerCase().includes(q) ||
        s.module.toLowerCase().includes(q) ||
        (s.promptSummary && s.promptSummary.toLowerCase().includes(q)) ||
        (s.progress && s.progress.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data?.sessions, searchQuery, statusFilter]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {t("admin.aiSwarm.toolbar.completed", "Dokončené")}
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
            <Radio className="h-3 w-3 animate-pulse" />
            {t("admin.aiSwarm.toolbar.running", "Bežiace")}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" />
            {t("admin.aiSwarm.toolbar.failed", "Zlyhané")}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            {t("admin.aiSwarm.toolbar.pending", "Čakajúce")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className={cn(pageShellClass, "w-full max-w-full overflow-hidden")}>
      {/* 1. PageHeader */}
      <PageHeader
        icon={Bot}
        title={t("admin.aiSwarm.title", "AI Swarm & AgentOS Centrála")}
        subtitle={t(
          "admin.aiSwarm.subtitle",
          "Správa a telemetria multi-agentného vývojového roja, lokálneho AgentOS runtime (:7777) a priame prepojenie na Agent UI."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t("admin.aiSwarm.actions.backToAdmin", "Platform Admin")}
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 h-3.5 w-3.5",
                  isRefetching && "animate-spin"
                )}
              />
              {isRefetching
                ? t("admin.aiSwarm.actions.refreshing", "Obnovuje sa...")
                : t("admin.aiSwarm.actions.refresh", "Obnoviť stav")}
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenAgentUi()}
              className="gap-1.5 font-medium shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("admin.aiSwarm.actions.openAgentUi", "Otvoriť Agent UI")}
              <ExternalLink className="h-3 w-3 opacity-70" />
            </Button>
          </div>
        }
      />

      {/* 2. Runtime status card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-3 w-3 rounded-full",
                  isOnline
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                )}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("admin.aiSwarm.runtime.endpoint", "Backend endpoint")}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {agentOsUrl}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {isOnline
                    ? t("admin.aiSwarm.runtime.statusOnline", "Online (Pripravený)")
                    : t("admin.aiSwarm.runtime.statusOffline", "Offline (Pohotovosť)")}
                  {data?.runtime.responseTimeMs != null && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      ({data.runtime.responseTimeMs} ms)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden h-8 w-px bg-border sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.aiSwarm.runtime.agentUi", "Rozhranie Agent UI")}:
              </span>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {agentUiUrl}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCli}
              className="h-8 gap-1.5 text-xs font-mono"
            >
              {copiedCli ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {t("admin.aiSwarm.actions.copied", "Skopírované")}
                </>
              ) : (
                <>
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  python .agents/agno/pipeline_team_os.py
                  <Copy className="ml-1 h-3 w-3 text-muted-foreground" />
                </>
              )}
            </Button>
          </div>
        </div>

        {!isOnline && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              {t(
                "admin.aiSwarm.runtime.offlineNotice",
                "AgentOS aktuálne nebeží na porte 7777. Pre spustenie runtime na pozadí spustite v termináli: python .agents/agno/pipeline_team_os.py."
              )}
            </p>
          </div>
        )}
      </div>

      {/* 3. KpiGrid */}
      <KpiGrid>
        <KpiCard
          icon={<Bot className="h-4 w-4 text-primary" />}
          label={t("admin.aiSwarm.kpi.fleetAgents", "Flotila agentov")}
          value={data?.stats.totalAgents ?? 7}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4 text-blue-500" />}
          label={t("admin.aiSwarm.kpi.activeSessions", "Relácie vývoja")}
          value={`${data?.stats.totalSessions ?? 0} (${data?.stats.runningSessions ?? 0} aktívnych)`}
        />
        <KpiCard
          icon={<Workflow className="h-4 w-4 text-emerald-500" />}
          label={t("admin.aiSwarm.kpi.teamsAndWorkflows", "Tímy & Pipeline")}
          value={`${data?.stats.totalTeams ?? 1} tím / ${data?.stats.totalWorkflows ?? 1} flow`}
        />
        <KpiCard
          icon={<Server className="h-4 w-4 text-purple-500" />}
          label={t("admin.aiSwarm.kpi.runtimeHealth", "Zdravie AgentOS")}
          value={isOnline ? "FastAPI 7777" : "Standby"}
        />
      </KpiGrid>

      {/* 4. Tabs & Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="fleet" className={underlineTabsTriggerClass}>
            <Users className="mr-1.5 h-4 w-4" />
            {t("admin.aiSwarm.tabs.fleet", "Flotila agentov a tímov")}
          </TabsTrigger>
          <TabsTrigger value="sessions" className={underlineTabsTriggerClass}>
            <Activity className="mr-1.5 h-4 w-4" />
            {t("admin.aiSwarm.tabs.sessions", "Relácie a úlohy")}
            {Boolean(data?.sessions?.length) && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {data?.sessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="agent-ui" className={underlineTabsTriggerClass}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {t("admin.aiSwarm.tabs.agentUi", "Živá Agent UI Konzola")}
          </TabsTrigger>
          <TabsTrigger value="guardrails" className={underlineTabsTriggerClass}>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {t("admin.aiSwarm.tabs.guardrails", "Architektúra a bezpečnosť")}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Agent Fleet & Teams */}
        <TabsContent value="fleet" className="space-y-4">
          <PageToolbar>
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t(
                "admin.aiSwarm.toolbar.searchPlaceholder",
                "Filtrovať agentov, relácie alebo úlohy..."
              )}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={filterControlClass}
              aria-label={t("admin.aiSwarm.toolbar.allCategories", "Všetky kategórie")}
            >
              <option value="ALL">
                {t("admin.aiSwarm.toolbar.allCategories", "Všetky kategórie")}
              </option>
              <option value="orchestrator">
                {t("admin.aiSwarm.toolbar.orchestrator", "Orchestrátor")}
              </option>
              <option value="developer">
                {t("admin.aiSwarm.toolbar.developer", "Vývojár (Coder)")}
              </option>
              <option value="qa">
                {t("admin.aiSwarm.toolbar.qa", "QA & Review")}
              </option>
              <option value="operations">
                {t("admin.aiSwarm.toolbar.operations", "Operácie & Git")}
              </option>
            </select>
          </PageToolbar>

          {/* Teams Overview Box */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.teams?.map((tm) => (
              <div
                key={tm.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      {tm.name}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {tm.mode}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tm.description}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {tm.members.map((m) => (
                      <span
                        key={m}
                        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3.5 pt-2 border-t border-border/50 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-primary"
                    onClick={() => handleOpenAgentUi(`${agentUiUrl}?team=${tm.id}`)}
                  >
                    {t("admin.aiSwarm.table.chatInAgentUi", "Otvoriť v Agent UI")}
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Button>
                </div>
              </div>
            ))}

            {data?.workflows?.map((wf) => (
              <div
                key={wf.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Workflow className="h-4 w-4 text-emerald-500" />
                      {wf.name}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {wf.stepsCount} krokov
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {wf.description}
                  </p>
                </div>
                <div className="mt-3.5 pt-2 border-t border-border/50 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                    onClick={() => handleOpenAgentUi(agentUiUrl)}
                  >
                    {t("admin.aiSwarm.table.chatInAgentUi", "Otvoriť v Agent UI")}
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Agents Table */}
          {filteredAgents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title={t("admin.aiSwarm.empty.noAgents", "Nenašli sa žiadni agenti zodpovedajúci filtru.")}
              description={t(
                "admin.aiSwarm.empty.clearFilters",
                "Zrušiť filtre"
              )}
              action={{
                label: t("admin.aiSwarm.empty.clearFilters", "Zrušiť filtre"),
                onClick: () => {
                  setSearchQuery("");
                  setCategoryFilter("ALL");
                },
              }}
            />
          ) : (
            <DataTableFrame>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.table.name", "Názov agenta / tímu")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.table.role", "Rola a zodpovednosť")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.table.model", "Model a poskytovateľ")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.table.tools", "Kľúčové nástroje")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("admin.aiSwarm.table.actions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((ag) => (
                    <tr key={ag.id} className={tableRowClass}>
                      <td className={cn(tableCellClass, "font-medium")}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {ag.name}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {ag.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <div className="font-medium text-foreground">
                          {ag.role}
                        </div>
                        <div className="text-[11px] text-muted-foreground max-w-sm truncate">
                          {ag.description}
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {ag.model}
                        </Badge>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {ag.provider}
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ag.tools.map((tl) => (
                            <span
                              key={tl}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                            >
                              {tl}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-primary"
                          onClick={() =>
                            handleOpenAgentUi(`${agentUiUrl}?agent=${ag.id}`)
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          {t("admin.aiSwarm.table.chatInAgentUi", "Otvoriť v Agent UI")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>

        {/* Tab 2: Sessions & Tasks */}
        <TabsContent value="sessions" className="space-y-4">
          <PageToolbar>
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t(
                "admin.aiSwarm.toolbar.searchPlaceholder",
                "Filtrovať agentov, relácie alebo úlohy..."
              )}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={filterControlClass}
              aria-label={t("admin.aiSwarm.toolbar.allStatuses", "Všetky stavy")}
            >
              <option value="ALL">
                {t("admin.aiSwarm.toolbar.allStatuses", "Všetky stavy")}
              </option>
              <option value="COMPLETED">
                {t("admin.aiSwarm.toolbar.completed", "Dokončené")}
              </option>
              <option value="RUNNING">
                {t("admin.aiSwarm.toolbar.running", "Bežiace")}
              </option>
              <option value="FAILED">
                {t("admin.aiSwarm.toolbar.failed", "Zlyhané")}
              </option>
              <option value="PENDING">
                {t("admin.aiSwarm.toolbar.pending", "Čakajúce")}
              </option>
            </select>
          </PageToolbar>

          {filteredSessions.length === 0 ? (
            <EmptyState
              icon={Activity}
              title={t("admin.aiSwarm.empty.noSessions", "Nenašli sa žiadne relácie zodpovedajúce filtru.")}
              description={t(
                "admin.aiSwarm.empty.clearFilters",
                "Zrušiť filtre"
              )}
              action={{
                label: t("admin.aiSwarm.empty.clearFilters", "Zrušiť filtre"),
                onClick: () => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                },
              }}
            />
          ) : (
            <DataTableFrame>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.sessionsTable.sessionId", "ID relácie / úlohy")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.sessionsTable.module", "Úloha / Modul")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.sessionsTable.status", "Stav")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.sessionsTable.progress", "Priebeh / Výstup")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("admin.aiSwarm.sessionsTable.created", "Vytvorené")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("admin.aiSwarm.table.actions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s) => (
                    <tr key={s.sessionId} className={tableRowClass}>
                      <td className={cn(tableCellClass, "font-mono font-medium")}>
                        {s.sessionId}
                      </td>
                      <td className={tableCellClass}>
                        <div className="font-semibold text-foreground max-w-sm">
                          {s.module}
                        </div>
                        {s.promptSummary && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-sm">
                            {s.promptSummary}
                          </div>
                        )}
                      </td>
                      <td className={tableCellClass}>
                        {renderStatusBadge(s.status)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="max-w-xs truncate text-[11px] text-muted-foreground">
                          {s.progress || "—"}
                        </div>
                      </td>
                      <td className={cn(tableCellClass, "font-mono text-[11px] text-muted-foreground")}>
                        {s.createdAt || "—"}
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-primary"
                          onClick={() =>
                            handleOpenAgentUi(`${agentUiUrl}?session=${s.sessionId}`)
                          }
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("admin.aiSwarm.table.chatInAgentUi", "Otvoriť v Agent UI")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>

        {/* Tab 3: Architecture & Safety Guardrails */}
        <TabsContent value="guardrails" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(
                      "admin.aiSwarm.guardrails.humanInTheLoopTitle",
                      "Human-in-the-Loop brána (Zákon 39/2007 Z. z.)"
                    )}
                  </h3>
                  <Badge variant="outline" className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    AKTÍVNY DOHĽAD
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  "admin.aiSwarm.guardrails.humanInTheLoopDesc",
                  "Všetky klinické návrhy AI ostávajú v stave draft až do autorizácie atestovaným veterinárnym lekárom cez ClinicalDiffConfirmModal."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(
                      "admin.aiSwarm.guardrails.controlledSubstancesTitle",
                      "Brána omamných a psychotropných látok (Zákon 139/1998 Z. z.)"
                    )}
                  </h3>
                  <Badge variant="outline" className="mt-0.5 text-[10px] text-destructive">
                    STRIKTNÝ ZÁKAZ AI PREFILLU
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  "admin.aiSwarm.guardrails.controlledSubstancesDesc",
                  "Nulové automatické predvypĺňanie opiátov, ketamínu, propofolu a fentanylu. Vyžaduje sa manuálne zadanie lekárom."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(
                      "admin.aiSwarm.guardrails.sympathyGateTitle",
                      "Sympatická brána pietneho kľudu"
                    )}
                  </h3>
                  <Badge variant="outline" className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                    GDPR & AUTOMATION SUPPRESSION
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  "admin.aiSwarm.guardrails.sympathyGateDesc",
                  "Pri úhyne alebo eutanázii pacienta sa okamžite potláča akákoľvek automatizovaná SMS a marketingová komunikácia s majiteľom."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Database className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(
                      "admin.aiSwarm.guardrails.zeroConflictTitle",
                      "Zero-Conflict Upstream architektúra"
                    )}
                  </h3>
                  <Badge variant="outline" className="mt-0.5 text-[10px] text-purple-600 dark:text-purple-400">
                    VANILLA SCHEMAS IMMUTABLE
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  "admin.aiSwarm.guardrails.zeroConflictDesc",
                  "Vanilkové schémy (packages/db/schema/*.ts) sú nemenné. Všetky rozšírenia idú cez ext_* a izolovaný extensionsRouter."
                )}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Live Embedded Agent UI */}
        <TabsContent value="agent-ui" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("admin.aiSwarm.agentUiView.title", "Živá Agent UI Konzola (:3007)")}
                </h3>
                <Badge variant={isOnline ? "default" : "secondary"} className="text-[10px]">
                  {isOnline ? "AgentOS :7777 Ready" : "AgentOS Standby"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "admin.aiSwarm.agentUiView.subtitle",
                  "Interaktívne webové rozhranie pre komunikáciu s lokálnym AgentOS tímom a sledovanie behov v reálnom čase."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAgentUi()}
                className="gap-1.5 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("admin.aiSwarm.agentUiView.openExternal", "Otvoriť v plnom okne")}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background shadow-xs">
            <iframe
              src={agentUiUrl}
              className="h-[750px] w-full border-0"
              title="Agent UI"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
