"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  AlertCircle,
  Loader2,
  GitBranch,
  Users,
  Share2,
  Activity,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Plus,
  Unlink,
  Heart,
  Moon,
  Gauge,
  UserX,
  Phone,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function MarketingAutomationsContent() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "rules";
  const [activeTab, setActiveTab] = useState(initialTab);

  // 1. Rules Query & Mutation
  const rulesQuery = trpc.extensions.automationRules.list.useQuery();
  const toggleRuleMutation = trpc.extensions.automationRules.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? t("marketing.automations.ruleEnabled", `Pravidlo "${data.name}" bolo zapnuté.`, { name: data.name })
          : t("marketing.automations.rulePaused", `Pravidlo "${data.name}" bolo pozastavené.`, { name: data.name })
      );
      utils.extensions.automationRules.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.ruleToggleError", "Nepodarilo sa zmeniť stav pravidla."));
    },
  });

  // 2. Journeys Query & Mutation
  const journeysQuery = trpc.extensions.automationJourneys.list.useQuery();
  const updateJourneyMutation = trpc.extensions.automationJourneys.update.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? t("marketing.automations.journeyEnabled", `Cesta "${data.name}" bola aktivovaná.`, { name: data.name })
          : t("marketing.automations.journeyPaused", `Cesta "${data.name}" bola pozastavená.`, { name: data.name })
      );
      utils.extensions.automationJourneys.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.journeyUpdateError", "Nepodarilo sa zmeniť stav zákazníckej cesty."));
    },
  });

  // 3. CRM Segments Query & Mutation
  const segmentsQuery = trpc.extensions.crmSegments.list.useQuery();
  const recomputeSegmentMutation = trpc.extensions.crmSegments.recompute.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("marketing.automations.segmentRecomputed", `Segment bol prepočítaný (${data.memberCount} klientov).`, { count: data.memberCount })
      );
      utils.extensions.crmSegments.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.segmentRecomputeError", "Nepodarilo sa prepočítať segment."));
    },
  });
  const recalculateAllMutation = trpc.extensions.crmSegments.recalculateAll.useMutation({
    onSuccess: (data) => {
      toast.success(
        t(
          "marketing.automations.segmentsRecalculated",
          `Prepočítaných ${data.segmentCount} segmentov — spolu ${data.totalMembers} členstiev.`,
          { segments: data.segmentCount, members: data.totalMembers }
        )
      );
      utils.extensions.crmSegments.list.invalidate();
      setMembersPage(0);
      if (drilldownSegmentKey) {
        utils.extensions.crmSegments.getSegmentMembers.invalidate();
      }
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.segmentRecomputeError", "Nepodarilo sa prepočítať segment."));
    },
  });

  // 3b. Segment drill-down state (member inspection dialog)
  const SEGMENT_PAGE_SIZE = 25;
  const [drilldownSegmentKey, setDrilldownSegmentKey] = useState<string | null>(null);
  const [drilldownSegmentName, setDrilldownSegmentName] = useState<string>("");
  const [membersPage, setMembersPage] = useState(0);
  const membersQuery = trpc.extensions.crmSegments.getSegmentMembers.useQuery(
    {
      segmentKey: drilldownSegmentKey ?? "puppy_kitten",
      limit: SEGMENT_PAGE_SIZE,
      offset: membersPage * SEGMENT_PAGE_SIZE,
    },
    { enabled: drilldownSegmentKey !== null }
  );

  const openSegmentDrilldown = (segmentKey: string, displayName: string) => {
    setDrilldownSegmentKey(segmentKey);
    setDrilldownSegmentName(displayName);
    setMembersPage(0);
  };

  // 4. Channel Accounts Query & Mutation
  const channelsQuery = trpc.extensions.automationChannels.list.useQuery();
  const testChannelMutation = trpc.extensions.automationChannels.testConnection.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("marketing.automations.channelHealthy", `Kanál ${data.provider} je aktívny a odpovedá.`, { provider: data.provider })
      );
      utils.extensions.automationChannels.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.channelTestError", "Chyba testovania kanála."));
    },
  });

  const connectChannelMutation = trpc.extensions.automationChannels.connect.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("marketing.automations.channelConnected", `Kanál "${data.displayName}" bol úspešne pripojený.`, { name: data.displayName ?? "" })
      );
      setIsConnectModalOpen(false);
      setConnectDisplayName("");
      setConnectAccountId("");
      utils.extensions.automationChannels.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.channelConnectError", "Chyba pri pripájaní kanála."));
    },
  });

  const disconnectChannelMutation = trpc.extensions.automationChannels.disconnect.useMutation({
    onSuccess: () => {
      toast.success(t("marketing.automations.channelDisconnected", "Kanál bol odpojený."));
      utils.extensions.automationChannels.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.channelDisconnectError", "Chyba pri odpájaní kanála."));
    },
  });

  const syncReviewsMutation = trpc.extensions.marketing.syncExternalReviews.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("marketing.automations.reviewsSynced", `Synchronizácia dokončená: načítaných ${data.insertedCount} nových recenzií, eskalovaných ${data.escalatedCount}.`, {
          count: data.insertedCount,
          escalated: data.escalatedCount,
        })
      );
      utils.extensions.marketing.listReviews.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.reviewsSyncError", "Chyba pri synchronizácii recenzií."));
    },
  });

  // Modal State for Channel Connection
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState<"google_business" | "facebook" | "instagram" | "youtube">("google_business");
  const [connectDisplayName, setConnectDisplayName] = useState("");
  const [connectAccountId, setConnectAccountId] = useState("");

  // 5. Live Events Query
  const eventsQuery = trpc.extensions.automationEvents.list.useQuery({ limit: 30 });

  // 6. Suppression Metrics Query
  const suppressionMetricsQuery = trpc.extensions.automationSuppression.getMetrics.useQuery();
  const suppressionLogsQuery = trpc.extensions.automationSuppression.listLogs.useQuery({ limit: 20 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />
            {t("marketing.automations.title", "Marketing Autopilot & CRM")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.automations.subtitle",
              "Deterministické pravidlá, viacstupňové zákaznícke cesty, 12 CRM segmentov a durable event bus bez rizika halucinácií."
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto p-1 gap-1">
          <TabsTrigger value="rules" className="flex items-center gap-1.5 py-2">
            <Zap className="w-4 h-4" />
            <span>{t("marketing.automations.tabRules", "Pravidlá")}</span>
            {rulesQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {rulesQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="journeys" className="flex items-center gap-1.5 py-2">
            <GitBranch className="w-4 h-4" />
            <span>{t("marketing.automations.tabJourneys", "Cesty")}</span>
            {journeysQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {journeysQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-1.5 py-2">
            <Users className="w-4 h-4" />
            <span>{t("marketing.automations.tabSegments", "Segmenty")}</span>
            {segmentsQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {segmentsQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-1.5 py-2">
            <Share2 className="w-4 h-4" />
            <span>{t("marketing.automations.tabChannels", "Kanály")}</span>
            {channelsQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {channelsQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1.5 py-2">
            <Activity className="w-4 h-4" />
            <span>{t("marketing.automations.tabEvents", "Event Bus")}</span>
            {eventsQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {eventsQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suppression" className="flex items-center gap-1.5 py-2">
            <ShieldAlert className="w-4 h-4" />
            <span>{t("marketing.automations.tabSuppression", "Potlačenia")}</span>
            {suppressionMetricsQuery.data && (
              <Badge variant="outline" className="ml-1 text-xs px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                {suppressionMetricsQuery.data.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 1. RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          {rulesQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {t("marketing.automations.loading", "Načítavam automatizačné pravidlá...")}
            </div>
          ) : !rulesQuery.data || rulesQuery.data.length === 0 ? (
            <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {t("marketing.automations.noRules", "Žiadne pravidlá nie sú nakonfigurované")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rulesQuery.data.map((rule) => {
                const isToggling =
                  toggleRuleMutation.isPending && toggleRuleMutation.variables?.id === rule.id;

                return (
                  <div
                    key={rule.id}
                    className={`group rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md p-5 ${
                      rule.enabled
                        ? "bg-card border-border hover:border-primary/40"
                        : "bg-muted/20 border-muted opacity-75 hover:opacity-90"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                              {rule.name}
                            </h2>
                            <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                              {rule.enabled ? t("common.active", "Aktívne") : t("common.paused", "Pozastavené")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            {rule.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => toggleRuleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                          title={rule.enabled ? "Pozastaviť pravidlo" : "Zapnúť pravidlo"}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                          } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.enabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="pt-2 border-t border-border/60 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {t("marketing.automations.timing", "Časovanie")}: <strong>{rule.triggerEventType}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {t("marketing.automations.channel", "Kanál")}: <strong>{rule.actionType.toUpperCase()}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. JOURNEYS TAB */}
        <TabsContent value="journeys" className="space-y-4">
          {journeysQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {t("marketing.automations.loadingJourneys", "Načítavam zákaznícke cesty...")}
            </div>
          ) : !journeysQuery.data || journeysQuery.data.length === 0 ? (
            <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {t("marketing.automations.noJourneys", "Žiadne zákaznícke cesty nie sú nakonfigurované")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {journeysQuery.data.map((journey) => {
                const isUpdating =
                  updateJourneyMutation.isPending && updateJourneyMutation.variables?.id === journey.id;
                const steps = (journey.steps as any[]) || [];

                return (
                  <div
                    key={journey.id}
                    className="rounded-2xl border bg-card border-border p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-primary" />
                            {journey.name}
                          </h2>
                          <Badge variant="outline" className="text-xs font-mono">
                            {journey.triggerEventType}
                          </Badge>
                          <Badge variant={journey.isActive ? "default" : "secondary"} className="text-xs">
                            {journey.isActive ? t("common.active", "Aktívna") : t("common.paused", "Pozastavená")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{journey.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {t("marketing.automations.frequencyCap", "Cap: {max} správy / {days}d", {
                            max: journey.frequencyCapMaxSteps,
                            days: journey.frequencyCapWindowDays,
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant={journey.isActive ? "outline" : "default"}
                          disabled={isUpdating}
                          onClick={() =>
                            updateJourneyMutation.mutate({
                              id: journey.id,
                              isActive: !journey.isActive,
                            })
                          }
                        >
                          {journey.isActive ? t("common.pause", "Pozastaviť") : t("common.activate", "Aktivovať")}
                        </Button>
                      </div>
                    </div>

                    {/* Step Pipeline Visualization */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("marketing.automations.stepPipeline", "Kroky sekvencie ({count})", { count: steps.length })}:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border bg-muted/20 flex flex-col justify-between space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-primary">
                                {t("marketing.automations.stepNumber", "Krok {num}", { num: idx + 1 })}
                              </span>
                              <Badge variant="secondary" className="text-[10px] uppercase">
                                {step.channel || step.kind}
                              </Badge>
                            </div>
                            <p className="text-foreground font-medium">{step.label}</p>
                            <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-1 border-t border-border/40">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-primary" />
                                {step.delayHours === 0
                                  ? t("marketing.automations.immediate", "Ihneď")
                                  : t("marketing.automations.hoursDelay", "+{hours} hod.", { hours: step.delayHours })}
                              </span>
                              {step.legalBasis && (
                                <span className="font-mono text-[10px]">{step.legalBasis}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. CRM SEGMENTS TAB */}
        <TabsContent value="segments" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t(
                "marketing.automations.segmentsDesc",
                "12 deterministických segmentov pacientov a klientov. Plný súlad s GDPR Art. 9 a Art. 22."
              )}
            </p>
            <Button
              size="sm"
              onClick={() => recalculateAllMutation.mutate()}
              disabled={recalculateAllMutation.isPending}
              className="gap-1.5 text-xs shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${recalculateAllMutation.isPending ? "animate-spin" : ""}`}
              />
              {recalculateAllMutation.isPending
                ? t("marketing.automations.recalculatingSegments", "Prepočítavam segmenty…")
                : t("marketing.automations.recalculateAllSegments", "Prepočítať segmenty")}
            </Button>
          </div>

          {segmentsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {t("marketing.automations.loadingSegments", "Načítavam CRM segmenty...")}
            </div>
          ) : !segmentsQuery.data || segmentsQuery.data.length === 0 ? (
            <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {t("marketing.automations.noSegments", "Žiadne segmenty nie sú k dispozícii")}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => recalculateAllMutation.mutate()}
                disabled={recalculateAllMutation.isPending}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${recalculateAllMutation.isPending ? "animate-spin" : ""}`}
                />
                {t("marketing.automations.recalculateAllSegments", "Prepočítať segmenty")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segmentsQuery.data.map((seg) => {
                const isRecomputing =
                  recomputeSegmentMutation.isPending &&
                  recomputeSegmentMutation.variables?.id === seg.id;
                const displayName = t(
                  `marketing.automations.segmentCatalog.${seg.segmentKey}.name`,
                  seg.name
                );
                const displayDescription = t(
                  `marketing.automations.segmentCatalog.${seg.segmentKey}.description`,
                  seg.description
                );

                return (
                  <div
                    key={seg.id}
                    className="rounded-2xl border bg-card border-border p-4 shadow-sm space-y-3 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-primary/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="text-left min-w-0"
                          onClick={() => openSegmentDrilldown(seg.segmentKey, displayName)}
                          title={t("marketing.automations.viewSegmentMembers", "Zobraziť klientov v segmente")}
                        >
                          <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                            {displayName}
                          </h3>
                          <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                            {seg.segmentKey}
                          </span>
                        </button>
                        <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                          {seg.refreshStrategy}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {displayDescription}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
                          onClick={() => openSegmentDrilldown(seg.segmentKey, displayName)}
                        >
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>{seg.memberCountCache} {t("marketing.automations.clientsCount", "klientov")}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          disabled={isRecomputing}
                          onClick={() => recomputeSegmentMutation.mutate({ id: seg.id })}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isRecomputing ? "animate-spin" : ""}`} />
                          {t("marketing.automations.recompute", "Prepočítať")}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {seg.lastRefreshedAt
                          ? t("marketing.automations.lastRecalculated", "Naposledy prepočítané: {date}", {
                              date: new Date(seg.lastRefreshedAt).toLocaleString("sk-SK", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }),
                            })
                          : t("marketing.automations.neverRecalculated", "Zatiaľ neprepočítané")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            {t(
              "marketing.automations.segmentSympathyNote",
              "Sympathy Gate: klienti so zosnulými pacientmi sú automaticky vylúčení zo všetkých segmentov."
            )}
          </p>
        </TabsContent>

        {/* 4. CHANNELS TAB */}
        <TabsContent value="channels" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t(
                "marketing.automations.channelsDesc",
                "Prepojenie sociálnych sietí a Google profilu pre automatické publikovanie a zber recenzií."
              )}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setConnectDisplayName("");
                setConnectAccountId("");
                setIsConnectModalOpen(true);
              }}
              className="gap-1.5 text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("marketing.automations.connectChannelBtn", "Pripojiť nový kanál")}
            </Button>
          </div>

          {channelsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {t("marketing.automations.loadingChannels", "Načítavam prepojené kanály...")}
            </div>
          ) : !channelsQuery.data || channelsQuery.data.length === 0 ? (
            <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {t("marketing.automations.noChannels", "Žiadne prepojené kanály")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channelsQuery.data.map((ch) => {
                const isTesting =
                  testChannelMutation.isPending && testChannelMutation.variables?.id === ch.id;
                const isDisconnecting =
                  disconnectChannelMutation.isPending && disconnectChannelMutation.variables?.id === ch.id;
                const isReviewSyncing =
                  syncReviewsMutation.isPending &&
                  (ch.provider === "google_business" || ch.provider === "facebook");

                return (
                  <div
                    key={ch.id}
                    className="rounded-2xl border bg-card border-border p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={ch.status === "connected" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {ch.provider.replace("_", " ")}
                        </Badge>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            ch.status === "connected" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {ch.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground">{ch.displayName}</h3>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        ID: {ch.externalAccountId}
                      </p>
                      {ch.publishingQuotaRemaining !== null && ch.publishingQuotaRemaining !== undefined && (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                          {t("marketing.automations.quotaRemaining", "Zostávajúca 24h kvóta: {quota} príspevkov", {
                            quota: ch.publishingQuotaRemaining,
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{t("marketing.automations.connectedSince", "Pripojené")}:</span>
                        <span>{ch.connectedAt ? new Date(ch.connectedAt).toLocaleDateString("sk-SK") : "—"}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 flex-1"
                          disabled={isTesting}
                          onClick={() => testChannelMutation.mutate({ id: ch.id })}
                        >
                          <Activity className={`w-3 h-3 mr-1 text-primary ${isTesting ? "animate-pulse" : ""}`} />
                          {t("marketing.automations.testConnection", "Test")}
                        </Button>

                        {(ch.provider === "google_business" || ch.provider === "facebook") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs px-2.5"
                            disabled={isReviewSyncing}
                            onClick={() =>
                              syncReviewsMutation.mutate({
                                platform: ch.provider === "google_business" ? "google" : "facebook",
                                simulateNewReviews: true,
                              })
                            }
                            title={t("marketing.automations.syncReviews", "Synchronizovať recenzie")}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${isReviewSyncing ? "animate-spin" : ""}`} />
                            {t("marketing.automations.syncReviewsShort", "Sync")}
                          </Button>
                        )}

                        {ch.status === "connected" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                            disabled={isDisconnecting}
                            onClick={() => disconnectChannelMutation.mutate({ id: ch.id })}
                            title={t("marketing.automations.disconnectChannel", "Odpojiť")}
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 5. LIVE EVENT BUS TAB */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t(
                "marketing.automations.eventsDesc",
                "Durable append-only event bus. Zaznamenáva každú udalosť kliniky (návštevy, vakcíny, operácie) pred spracovaním pravidlami."
              )}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => eventsQuery.refetch()}
              disabled={eventsQuery.isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
              {t("common.refresh", "Obnoviť")}
            </Button>
          </div>

          {eventsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {t("marketing.automations.loadingEvents", "Načítavam udalosti...")}
            </div>
          ) : !eventsQuery.data || eventsQuery.data.length === 0 ? (
            <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {t("marketing.automations.noEvents", "Žiadne zaznamenané udalosti")}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t("marketing.automations.eventType", "Typ udalosti")}</th>
                      <th className="py-3 px-4">{t("marketing.automations.occurredAt", "Čas")}</th>
                      <th className="py-3 px-4">{t("marketing.automations.status", "Stav")}</th>
                      <th className="py-3 px-4">{t("marketing.automations.source", "Zdroj")}</th>
                      <th className="py-3 px-4">{t("marketing.automations.dedupeKey", "Dedupe Key")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {eventsQuery.data.map((evt) => (
                      <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {evt.eventType}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(evt.occurredAt).toLocaleString("sk-SK", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              evt.status === "processed"
                                ? "default"
                                : evt.status === "pending"
                                ? "secondary"
                                : evt.status === "skipped"
                                ? "outline"
                                : "destructive"
                            }
                            className="text-[10px]"
                          >
                            {evt.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {evt.sourceRouter || "system"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {evt.dedupeKey || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 6. SUPPRESSION TAB */}
        <TabsContent value="suppression" className="space-y-4">
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-purple-600 fill-purple-600" />
                  Sympathy Gate
                </span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">Kritické</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">{suppressionMetricsQuery.data?.sympathyBlocks ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Zablokovaných pre zosnulých pacientov</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-blue-600" />
                  Nočný kľud
                </span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">20:00 - 08:00</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">{suppressionMetricsQuery.data?.quietHours ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Odložených na povolený čas</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-amber-600" />
                  SMS Limit
                </span>
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">&lt; 3 / 24h</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">{suppressionMetricsQuery.data?.rateLimits ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Potlačených pre prekročenie limitu</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  Chýba súhlas
                </span>
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">GDPR Čl. 9</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">{suppressionMetricsQuery.data?.noConsent ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Potlačených z dôvodu chýbajúceho súhlasu</p>
            </div>
          </div>

          {/* Suppression Logs Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Čas</th>
                    <th className="py-3 px-4">Dôvod</th>
                    <th className="py-3 px-4">Akcia / Kanál</th>
                    <th className="py-3 px-4">Klient / Pacient</th>
                    <th className="py-3 px-4">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppressionLogsQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Načítavam auditné záznamy...
                      </td>
                    </tr>
                  ) : suppressionLogsQuery.data?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        Žiadne potlačené správy.
                      </td>
                    </tr>
                  ) : (
                    suppressionLogsQuery.data?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                          {new Date(log.blockedAt).toLocaleString("sk-SK")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant="secondary" className="text-xs">{log.suppressionReason}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{log.blockedAction}</div>
                          {log.channelAttempted && (
                            <span className="text-[10px] text-muted-foreground uppercase">Kanál: {log.channelAttempted}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{log.clientFirstName} {log.clientLastName}</div>
                          {log.patientName && (
                            <div className="text-[10px] text-muted-foreground">Pacient: {log.patientName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.clearedAt ? (
                            <span className="text-emerald-600 font-medium">Odblokované</span>
                          ) : (
                            <span className="text-muted-foreground">Aktívne potlačené</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Compliance Information Card */}
      <div className="p-5 rounded-xl border bg-muted/30 space-y-2">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {t("marketing.automations.complianceTitle", "Klinické pravidlá a legislatívne limity (SR)")}
        </h3>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 leading-relaxed">
          <li>
            <strong>{t("marketing.automations.quietHours", "Tichý nočný režim")}</strong>:{" "}
            {t(
              "marketing.automations.quietHoursDesc",
              "Žiadne správy neodchádzajú medzi 20:00 a 08:00 ani v nedeľu (zaradia sa do fronty na najbližšie povolené ráno)."
            )}
          </li>
          <li>
            <strong>{t("marketing.automations.smsRateLimit", "SMS Rate Limit")}</strong>:{" "}
            {t(
              "marketing.automations.smsRateLimitDesc",
              "Maximálne 1 marketingová správa za 14 dní na jedného klienta (chráni pred spamovaním majiteľa)."
            )}
          </li>
          <li>
            <strong>{t("marketing.automations.sympathyGate", "Sympathy Gate")}</strong>:{" "}
            {t(
              "marketing.automations.sympathyGateDesc",
              "Pri úmrtí pacienta sa všetky automatizované správy a recall pre zviera okamžite blokujú a vytvorí sa úloha pre personál."
            )}
          </li>
          <li>
            <strong>{t("marketing.automations.legalBasisRule", "Právny základ")}</strong>:{" "}
            {t(
              "marketing.automations.legalBasisRuleDesc",
              "Zmluvné správy (pripomienka očkovania, kontrola po operácii) nevyžadujú marketingový opt-in; propagačné správy a recenzie áno."
            )}
          </li>
        </ul>
      </div>

      {/* Connect Channel Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              {t("marketing.automations.modalConnectTitle", "Pripojiť nový kanál")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "marketing.automations.modalConnectDesc",
                "Vyberte platformu a zadajte identifikátor účtu pre automatizáciu sociálnych médií a zber recenzií."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-select">{t("marketing.automations.modalPlatform", "Platforma")}</Label>
              <select
                id="provider-select"
                value={connectProvider}
                onChange={(e) => setConnectProvider(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="google_business">Google Business Profile</option>
                <option value="facebook">Facebook Page</option>
                <option value="instagram">Instagram Professional</option>
                <option value="youtube">YouTube Channel</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="channel-name">{t("marketing.automations.modalDisplayName", "Názov účtu / zobrazenie")}</Label>
              <Input
                id="channel-name"
                placeholder="napr. Klinika Sýkora (FB Page)"
                value={connectDisplayName}
                onChange={(e) => setConnectDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="channel-account-id">{t("marketing.automations.modalAccountId", "Externé ID účtu / lokality")}</Label>
              <Input
                id="channel-account-id"
                placeholder="napr. act_987654321 alebo gmb_location_01"
                value={connectAccountId}
                onChange={(e) => setConnectAccountId(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConnectModalOpen(false)}>
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button
              disabled={!connectDisplayName.trim() || !connectAccountId.trim() || connectChannelMutation.isPending}
              onClick={() => {
                connectChannelMutation.mutate({
                  provider: connectProvider,
                  displayName: connectDisplayName.trim(),
                  externalAccountId: connectAccountId.trim(),
                  scopes:
                    connectProvider === "google_business"
                      ? ["business.manage", "reviews.read"]
                      : connectProvider === "facebook"
                      ? ["pages_manage_posts", "pages_read_engagement"]
                      : connectProvider === "instagram"
                      ? ["instagram_content_publish"]
                      : ["youtube.upload"],
                });
              }}
            >
              {connectChannelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("marketing.automations.modalBtnSubmit", "Pripojiť kanál")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment Members Drill-Down Dialog */}
      <Dialog
        open={drilldownSegmentKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldownSegmentKey(null);
            setMembersPage(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {t("marketing.automations.membersDialogTitle", "Klienti v segmente: {segment}", {
                segment: drilldownSegmentName,
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                "marketing.automations.membersDialogDesc",
                "Aktívni klienti patriaci do tohto segmentu. Kliknutím otvoríte kartu klienta."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {membersQuery.isLoading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                {t("marketing.automations.loadingMembers", "Načítavam klientov segmentu...")}
              </div>
            ) : !membersQuery.data || membersQuery.data.members.length === 0 ? (
              <div className="p-12 text-center space-y-2 border rounded-xl bg-muted/20">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  {t("marketing.automations.noMembers", "V tomto segmente zatiaľ nie sú žiadni klienti")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "marketing.automations.noMembersHint",
                    "Spustite prepočet segmentov pre aktualizáciu členstva."
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {membersQuery.data.members.map((member) => (
                  <Link
                    key={member.clientId}
                    href={`/clients/${member.clientId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {member.displayName || t("marketing.automations.unnamedClient", "Klient bez mena")}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                        {member.email && <span className="truncate">{member.email}</span>}
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </span>
                        )}
                        {member.city && <span>{member.city}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {member.enrolledAt && (
                        <span className="hidden sm:block text-[10px] text-muted-foreground">
                          {new Date(member.enrolledAt).toLocaleDateString("sk-SK")}
                        </span>
                      )}
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {membersQuery.data && membersQuery.data.total > 0 && (
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-border/60 mt-2">
              <span className="text-[11px] text-muted-foreground self-center">
                {t("marketing.automations.membersShowing", "Zobrazených {shown} z {total}", {
                  shown: Math.min(
                    (membersPage + 1) * SEGMENT_PAGE_SIZE,
                    membersQuery.data.total
                  ),
                  total: membersQuery.data.total,
                })}
              </span>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={membersPage === 0 || membersQuery.isFetching}
                  onClick={() => setMembersPage((p) => Math.max(0, p - 1))}
                >
                  {t("common.back", "Späť")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={
                    membersQuery.isFetching ||
                    (membersPage + 1) * SEGMENT_PAGE_SIZE >= membersQuery.data.total
                  }
                  onClick={() => setMembersPage((p) => p + 1)}
                >
                  {membersQuery.isFetching && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {t("marketing.automations.loadMoreMembers", "Ďalších 25")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MarketingAutomationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MarketingAutomationsContent />
    </Suspense>
  );
}