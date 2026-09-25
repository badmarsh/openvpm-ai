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
  Play,
  Eye,
  Check,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  pageShellClass,
  PageHeader,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function MarketingAutomationsContent() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "rules" ||
    tabParam === "segments" ||
    tabParam === "channels" ||
    tabParam === "events"
      ? tabParam
      : "rules";
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

  // 2. CRM Segments Query & Mutation
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

  // 3. Channel Accounts Query & Mutation
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

  // 4. Live Events & Queue Metrics Queries & Mutations
  const eventsQuery = trpc.extensions.automationEvents.list.useQuery({ limit: 50 });
  const queueMetricsQuery = trpc.extensions.automationEvents.getQueueMetrics.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const processQueueMutation = trpc.extensions.automationEvents.processQueueNow.useMutation({
    onSuccess: (data) => {
      toast.success(
        t(
          "marketing.automations.queueProcessedSuccess",
          `Fronta udalostí bola úspešne spracovaná (${data.processedCount} udalostí).`,
          { count: data.processedCount }
        )
      );
      utils.extensions.automationEvents.list.invalidate();
      utils.extensions.automationEvents.getQueueMetrics.invalidate();
      utils.extensions.automationSuppression.getMetrics.invalidate();
      utils.extensions.automationSuppression.listLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.queueProcessError", "Chyba pri spracovaní fronty."));
    },
  });

  const simulateEventMutation = trpc.extensions.automationEvents.simulateEvent.useMutation({
    onSuccess: (data) => {
      setSimulationResult(data);
      if (data.suppressed) {
        toast.warning(
          t(
            "marketing.automations.simSuppressedToast",
            "Sympathy Gate: Udalosť bola potlačená z dôvodu úmrtia pacienta."
          )
        );
      } else {
        toast.success(
          t(
            "marketing.automations.simSuccessToast",
            `Udalosť ${data.eventType} bola odoslaná do zbernice (zhoda s ${data.matchedRulesCount} pravidlami).`,
            { type: data.eventType, count: data.matchedRulesCount }
          )
        );
      }
      utils.extensions.automationEvents.list.invalidate();
      utils.extensions.automationEvents.getQueueMetrics.invalidate();
      utils.extensions.automationSuppression.getMetrics.invalidate();
      utils.extensions.automationSuppression.listLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("marketing.automations.simErrorToast", "Chyba pri simulácii udalosti."));
    },
  });

  // Modal State for Event Simulation
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simEventType, setSimEventType] = useState<
    "appointment_no_show" | "vaccine_due" | "post_operative_care" | "wellness_enrolled" | "visit_completed" | "surgery_completed" | "patient_deceased"
  >("appointment_no_show");
  const [simPatientSearch, setSimPatientSearch] = useState("");
  const [simSelectedPatientId, setSimSelectedPatientId] = useState("");
  const [simSelectedPatientName, setSimSelectedPatientName] = useState("");
  const [simPayloadText, setSimPayloadText] = useState(
    JSON.stringify(
      {
        service: "Preventívna vakcinácia",
        appointmentId: "appt_demo_01",
        noShowCount: 1,
      },
      null,
      2
    )
  );
  const [simProcessImmediately, setSimProcessImmediately] = useState(true);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Patient Search Query for simulation
  const simPatientsQuery = trpc.patients.list.useQuery(
    { search: simPatientSearch, limit: 6 },
    { enabled: simPatientSearch.trim().length >= 2 }
  );

  // Payload Drawer/Dialog State
  const [selectedEventForPayload, setSelectedEventForPayload] = useState<any | null>(null);

  return (
    <div className={pageShellClass}>
      {/* Header */}
      <PageHeader
        icon={Zap}
        title={t("marketing.automations.title", "Marketing Autopilot & CRM")}
        subtitle={t(
          "marketing.automations.subtitle",
          "Deterministické pravidlá, CRM segmenty, publikačné kanály a durable event bus bez rizika halucinácií."
        )}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="rules" className={underlineTabsTriggerClass}>
            <Zap className="w-4 h-4" />
            <span>{t("marketing.automations.tabRules", "Pravidlá")}</span>
            {rulesQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {rulesQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="segments" className={underlineTabsTriggerClass}>
            <Users className="w-4 h-4" />
            <span>{t("marketing.automations.tabSegments", "Segmenty")}</span>
            {segmentsQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {segmentsQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="channels" className={underlineTabsTriggerClass}>
            <Share2 className="w-4 h-4" />
            <span>{t("marketing.automations.tabChannels", "Kanály")}</span>
            {channelsQuery.data && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {channelsQuery.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className={underlineTabsTriggerClass}>
            <Activity className="w-4 h-4" />
            <span>{t("marketing.automations.tabEvents", "Udalosti & Zbernica")}</span>
            {queueMetricsQuery.data ? (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {queueMetricsQuery.data.pending > 0
                ? t("marketing.automations.queuePending", `${queueMetricsQuery.data.pending} čaká`, {
                    count: queueMetricsQuery.data.pending,
                  })
                : queueMetricsQuery.data.total}
              </Badge>
            ) : eventsQuery.data ? (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {eventsQuery.data.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* 1. RULES TAB */}
        <TabsContent value="rules" className="mt-0 space-y-6">
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

        {/* 2. CRM SEGMENTS TAB */}
        <TabsContent value="segments" className="mt-0 space-y-6">
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

        {/* 3. CHANNELS TAB */}
        <TabsContent value="channels" className="mt-0 space-y-6">
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

        {/* 4. LIVE EVENT BUS & WORKER CONTROL TAB */}
        <TabsContent value="events" className="mt-0 space-y-6">
          {/* Real-time Status Metric Chips */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  {t("marketing.automations.statusPending", "Čakajúce")}
                </span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                  V rade
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {queueMetricsQuery.data?.pending ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("marketing.automations.pendingDesc", "Pripravené na spracovanie workerom")}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-500" />
                  {t("marketing.automations.statusProcessing", "Spracovávané")}
                </span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  Aktívne
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {queueMetricsQuery.data?.processing ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("marketing.automations.processingDesc", "Zamknuté a vyhodnocované pravidlami")}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {t("marketing.automations.statusProcessed", "Spracované")}
                </span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Dokončené
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {queueMetricsQuery.data?.processed ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("marketing.automations.processedDesc", "Pravidlá a cesty úspešne spustené")}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  {t("marketing.automations.statusFailed", "Zlyhané / Preskočené")}
                </span>
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                  Chyba
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(queueMetricsQuery.data?.failed ?? 0) + (queueMetricsQuery.data?.skipped ?? 0)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {queueMetricsQuery.data?.failed ?? 0} zlyhaní, {queueMetricsQuery.data?.skipped ?? 0} preskočených
              </p>
            </div>
          </div>

          {/* Stuck Claims Alert if > 0 */}
          {queueMetricsQuery.data?.stuck ? queueMetricsQuery.data.stuck > 0 ? (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Uviaznuté claimy:</strong> {queueMetricsQuery.data.stuck} udalostí je v stave spracovania dlhšie než 5 minút. Kliknite na "Spracovať frontu teraz" pre automatickú obnovu claimov.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs border-amber-400 hover:bg-amber-100"
                onClick={() => processQueueMutation.mutate()}
                disabled={processQueueMutation.isPending}
              >
                {processQueueMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Obnoviť claimy
              </Button>
            </div>
          ) : null : null}

          {/* Controls Bar: Process Queue Now, Simulate Event, Refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/20">
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                {t("marketing.automations.queueManagement", "Správa fronty zbernice a worker")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "marketing.automations.eventsDesc",
                  "Durable append-only event bus. Zaznamenáva každú udalosť kliniky (návštevy, vakcíny, operácie) pred spracovaním pravidlami."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => processQueueMutation.mutate()}
                disabled={processQueueMutation.isPending}
                className="gap-1.5 text-xs shadow-sm bg-primary text-primary-foreground"
                title={t("marketing.automations.btnProcessQueueNow", "Spracovať frontu teraz")}
              >
                {processQueueMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>
                  {processQueueMutation.isPending
                    ? t("marketing.automations.processingQueue", "Spracovávam frontu…")
                    : t("marketing.automations.btnProcessQueueNow", "Spracovať frontu teraz")}
                </span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSimulationResult(null);
                  setIsSimulateModalOpen(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t("marketing.automations.btnSimulateEvent", "Simulovať udalosť")}</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  eventsQuery.refetch();
                  queueMetricsQuery.refetch();
                }}
                disabled={eventsQuery.isFetching || queueMetricsQuery.isFetching}
                className="text-xs"
                title={t("common.refresh", "Obnoviť")}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    eventsQuery.isFetching || queueMetricsQuery.isFetching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
          </div>

          {/* Events List */}
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
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => setIsSimulateModalOpen(true)}
              >
                <Sparkles className="w-3 h-3 mr-1.5 text-amber-500" />
                {t("marketing.automations.btnSimulateFirst", "Simulovať prvú udalosť")}
              </Button>
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
                      <th className="py-3 px-4 text-right">{t("common.actions", "Akcia")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {eventsQuery.data.map((evt) => (
                      <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {evt.eventType}
                          </span>
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
                                : evt.status === "processing"
                                ? "outline"
                                : evt.status === "skipped"
                                ? "outline"
                                : "destructive"
                            }
                            className={`text-[10px] ${
                              evt.status === "processing"
                                ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950"
                                : evt.status === "skipped"
                                ? "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950"
                                : ""
                            }`}
                          >
                            {evt.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {evt.sourceRouter || "system"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]" title={evt.dedupeKey || ""}>
                          {evt.dedupeKey || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedEventForPayload(evt)}
                            title={t("marketing.automations.inspectPayload", "Zobraziť detail a payload")}
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>Detail</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            <Button variant="outline" size="sm" onClick={() => setIsConnectModalOpen(false)}>
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button
              size="sm"
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
      {/* Simulate Event Modal */}
      <Dialog open={isSimulateModalOpen} onOpenChange={setIsSimulateModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {t("marketing.automations.simModalTitle", "Simulovať udalosť zbernice")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "marketing.automations.simModalDesc",
                "Otestujte reakciu pravidiel, zákazníckych ciest a Sympathy Gate pri vstupe udalosti."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
            {/* Event Type Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="sim-event-type">{t("marketing.automations.simEventType", "Typ udalosti")}</Label>
              <select
                id="sim-event-type"
                value={simEventType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSimEventType(val);
                  setSimulationResult(null);
                  if (val === "appointment_no_show") {
                    setSimPayloadText(
                      JSON.stringify(
                        { service: "Preventívna vakcinácia", appointmentId: "appt_demo_01", noShowCount: 1 },
                        null,
                        2
                      )
                    );
                  } else if (val === "vaccine_due") {
                    setSimPayloadText(
                      JSON.stringify(
                        { vaccineName: "Nobivac DHPPi+L4", dueDate: "2026-10-01", daysUntilDue: 14 },
                        null,
                        2
                      )
                    );
                  } else if (val === "post_operative_care") {
                    setSimPayloadText(
                      JSON.stringify(
                        { procedure: "Kastrácia / Orchiektómia", surgeon: "MVDr. Martin Sýkora", sutureRemovalDays: 10 },
                        null,
                        2
                      )
                    );
                  } else if (val === "wellness_enrolled") {
                    setSimPayloadText(
                      JSON.stringify(
                        { planName: "Senior Prevent Plus", monthlyFee: 29.9, benefits: ["4x kontrola", "1x biochémia"] },
                        null,
                        2
                      )
                    );
                  } else if (val === "visit_completed") {
                    setSimPayloadText(
                      JSON.stringify(
                        { diagnosis: "Otitis externa", followUpRequired: false },
                        null,
                        2
                      )
                    );
                  } else if (val === "surgery_completed") {
                    setSimPayloadText(
                      JSON.stringify(
                        { procedure: "Dentálna hygiena a extrakcia", hospitalizationHours: 4 },
                        null,
                        2
                      )
                    );
                  } else if (val === "patient_deceased") {
                    setSimPayloadText(
                      JSON.stringify(
                        { reason: "Klinická eutanázia pre multiorgánové zlyhanie", sympathyGateTrigger: true },
                        null,
                        2
                      )
                    );
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="appointment_no_show">appointment_no_show (Nedorazenie na termín)</option>
                <option value="vaccine_due">vaccine_due (Termín preočkovania)</option>
                <option value="post_operative_care">post_operative_care (Pooperačná starostlivosť)</option>
                <option value="wellness_enrolled">wellness_enrolled (Zápis do wellness)</option>
                <option value="visit_completed">visit_completed (Ukončená návšteva)</option>
                <option value="surgery_completed">surgery_completed (Ukončená operácia)</option>
                <option value="patient_deceased">patient_deceased (Úmrtie pacienta - Sympathy Gate)</option>
              </select>
            </div>

            {/* Patient Picker (Optional) */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="sim-patient-search">
                  {t("marketing.automations.simPatientLabel", "Priradiť pacienta (voliteľné)")}
                </Label>
                {simSelectedPatientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSimSelectedPatientId("");
                      setSimSelectedPatientName("");
                      setSimPatientSearch("");
                    }}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Odobrať pacienta
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="sim-patient-search"
                  placeholder={
                    simSelectedPatientName
                      ? `Vybraný: ${simSelectedPatientName}`
                      : "Hľadať pacienta podľa mena..."
                  }
                  value={simPatientSearch}
                  onChange={(e) => setSimPatientSearch(e.target.value)}
                  className="h-8 text-xs pl-7"
                />
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-2.5" />
              </div>

              {simPatientsQuery.data?.items && simPatientsQuery.data.items.length > 0 && simPatientSearch.trim().length >= 2 && (
                <div className="absolute z-20 w-full mt-1 max-h-36 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg space-y-1">
                  {simPatientsQuery.data.items.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSimSelectedPatientId(p.id);
                        setSimSelectedPatientName(`${p.name} (${p.species}${p.status === "deceased" ? " - ZOSNULÝ" : ""})`);
                        setSimPatientSearch("");
                      }}
                      className={`cursor-pointer rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors flex items-center justify-between ${
                        p.status === "deceased" ? "text-purple-600 font-semibold" : ""
                      }`}
                    >
                      <span>
                        {p.name} — {p.species} {p.breed ? `(${p.breed})` : ""}
                      </span>
                      {p.status === "deceased" && (
                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                          Zosnulý
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {simSelectedPatientName && (
                <p className="text-[11px] text-primary font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {simSelectedPatientName}
                </p>
              )}
            </div>

            {/* JSON Payload Editor */}
            <div className="space-y-1.5">
              <Label htmlFor="sim-payload">{t("marketing.automations.simPayloadJson", "Payload udalosti (JSON)")}</Label>
              <Textarea
                id="sim-payload"
                rows={5}
                value={simPayloadText}
                onChange={(e) => setSimPayloadText(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* Checkbox: Process Immediately */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sim-process-imm"
                checked={simProcessImmediately}
                onChange={(e) => setSimProcessImmediately(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label htmlFor="sim-process-imm" className="text-xs text-foreground cursor-pointer select-none">
                {t("marketing.automations.simProcessImmediately", "Okamžite spustiť worker a vyhodnotiť pravidlá")}
              </label>
            </div>

            {/* Live Simulation Result Feedback Box */}
            {simulationResult && (
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  simulationResult.suppressed
                    ? "border-purple-300 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200"
                    : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {simulationResult.suppressed ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                      <span>Sympathy Gate Aktívna!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                      <span>Udalosť úspešne spracovaná</span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed">{simulationResult.message}</p>
                {simulationResult.matchedRules && simulationResult.matchedRules.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <span className="font-semibold text-[11px] block">Zodpovedajúce pravidlá:</span>
                    <div className="flex flex-wrap gap-1">
                      {simulationResult.matchedRules.map((r: any) => (
                        <Badge key={r.id} variant="outline" className="text-[10px] bg-background">
                          {r.name} ({r.actionType})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsSimulateModalOpen(false)}>
              {t("common.close", "Zavrieť")}
            </Button>
            <Button
              size="sm"
              disabled={simulateEventMutation.isPending}
              onClick={() => {
                let parsedPayload = {};
                try {
                  parsedPayload = JSON.parse(simPayloadText);
                } catch {
                  toast.error(
                    t(
                      "marketing.automations.invalidJsonPayload",
                      "Neplatný formát JSON payloadu"
                    )
                  );
                  return;
                }
                simulateEventMutation.mutate({
                  eventType: simEventType,
                  patientId: simSelectedPatientId || undefined,
                  payload: parsedPayload,
                  processImmediately: simProcessImmediately,
                });
              }}
              className="gap-1.5"
            >
              {simulateEventMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Play className="w-3.5 h-3.5 fill-current" />
              {t("marketing.automations.btnRunSimulation", "Spustiť simuláciu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payload Inspection Dialog */}
      <Dialog
        open={selectedEventForPayload !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEventForPayload(null);
        }}
      >
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <span>Detail udalosti: {selectedEventForPayload?.eventType}</span>
            </DialogTitle>
            <DialogDescription>
              Dedupe Key: {selectedEventForPayload?.dedupeKey || "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/20 rounded-lg border">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Stav</span>
                <Badge
                  variant={
                    selectedEventForPayload?.status === "processed"
                      ? "default"
                      : selectedEventForPayload?.status === "pending"
                      ? "secondary"
                      : selectedEventForPayload?.status === "skipped"
                      ? "outline"
                      : "destructive"
                  }
                  className="text-[10px] mt-0.5"
                >
                  {selectedEventForPayload?.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Čas vzniku</span>
                <span className="font-mono text-[11px] text-foreground">
                  {selectedEventForPayload?.occurredAt
                    ? new Date(selectedEventForPayload.occurredAt).toLocaleString("sk-SK")
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Zdrojový router</span>
                <span className="font-mono text-[11px] text-foreground">
                  {selectedEventForPayload?.sourceRouter || "system"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Event ID</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate block" title={selectedEventForPayload?.id}>
                  {selectedEventForPayload?.id}
                </span>
              </div>
            </div>

            {selectedEventForPayload?.processedReason && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 space-y-1">
                <span className="font-semibold text-[10px] uppercase text-purple-700 dark:text-purple-300 block">
                  Dôvod spracovania / vynechania (Audit):
                </span>
                <p className="text-xs text-purple-900 dark:text-purple-200">
                  {selectedEventForPayload.processedReason}
                </p>
              </div>
            )}

            {selectedEventForPayload?.failureReason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800 space-y-1">
                <span className="font-semibold text-[10px] uppercase text-rose-700 dark:text-rose-300 block">
                  Dôvod zlyhania:
                </span>
                <p className="text-xs text-rose-900 dark:text-rose-200 font-mono">
                  {selectedEventForPayload.failureReason}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                JSON Payload:
              </span>
              <pre className="p-3 bg-muted/60 rounded-lg text-[11px] font-mono overflow-x-auto max-h-56 whitespace-pre-wrap">
                {JSON.stringify(selectedEventForPayload?.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedEventForPayload(null)}>
              {t("common.close", "Zavrieť")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ClientAutomationsView() {
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