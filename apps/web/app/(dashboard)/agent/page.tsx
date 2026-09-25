"use client";

import { useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bot,
  FlaskConical,
  AlertTriangle,
  CreditCard,
  Loader2,
  Sparkles,
  RotateCcw,
  Stethoscope,
  Calendar,
  Pill,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Wrench,
  HelpCircle,
  ArrowUp,
  Activity,
  CheckCircle2,
  Clock,
  FileCheck2,
  Mic,
  ScanLine,
  Send,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  pageShellClass,
  PageToolbar,
  SearchField,
  DataTableFrame,
  KpiGrid,
  KpiCard,
  filterControlClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
  tableHeadClass,
  tableCellClass,
  tableRowClass,
  EmptyState,
} from "@/components/layout/page-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  StatusPulseBadge,
  type StatusPulseVariant,
} from "@/components/ui/status-pulse-badge";
import {
  emitGuideSignal,
  GUIDE_SIGNALS,
} from "@/components/tour/guide-signals";
import {
  AGENT_INSTRUCTION_MAX_LENGTH,
  isAgentInstructionValid,
} from "@/lib/agent/policy";
import { toast } from "sonner";
import {
  loadPersistedChat,
  savePersistedChat,
  clearPersistedChat,
  type PersistedChatMessage,
} from "./components/agent-chat-history";
import { AgentCapabilitiesView } from "./components/agent-capabilities";
import { AgentMessageBubble, TypingIndicator } from "./components/agent-message-bubble";
import { AgentExportButtons } from "./components/agent-export-dialog";

function canRunAgentRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

const SUGGESTIONS = [
  {
    key: "agent.suggestions.vaccinations",
    fallback: "Which patients are overdue for vaccinations?",
  },
  {
    key: "agent.suggestions.appointments",
    fallback: "Summarize today's appointments.",
  },
  {
    key: "agent.suggestions.carprofen",
    fallback: "What's the carprofen dose for a 12 kg dog?",
  },
  {
    key: "agent.suggestions.clinicalSummary",
    fallback: "Pull a clinical summary for the next patient checked in.",
  },
] as const;

type MockSessionItem = {
  id: string;
  type: "voice" | "imaging" | "discharge" | "chat";
  title: string;
  duration: string;
  status: "draft" | "confirmed" | "expired";
  createdAt: string;
  href: string;
};

export default function AgentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("agent.checkingAccess", "Checking agent access...")}
        </div>
      </div>
    );
  }

  if (!canRunAgentRole(session?.user?.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Bot}
          title={t("agent.accessRestricted", "Agent access is restricted")}
          description={t(
            "agent.accessRestrictedDesc",
            "Only administrators and veterinarians can run the OpenVPM Agent.",
          )}
          action={{
            label: t("agent.backToDashboard", "Back to dashboard"),
            onClick: () => router.push("/"),
          }}
        />
      </div>
    );
  }

  return <AgentRunner isAdmin={session?.user?.role === "admin"} />;
}

function AgentRunner({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { t } = useI18n();
  const status = trpc.agent.status.useQuery();
  const run = trpc.agent.run.useMutation();
  const [activeTab, setActiveTab] = useState<"chat" | "capabilities">("chat");
  const [messages, setMessages] = useState<PersistedChatMessage[]>([]);
  const [instruction, setInstruction] = useState("");
  const [allowWrites, setAllowWrites] = useState(false);
  const [deepThinking, setDeepThinking] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>("all");
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>("all");
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefilled = useRef(false);
  const chatInitialized = useRef(false);

  // Restore chat history from sessionStorage on client mount
  useEffect(() => {
    if (!chatInitialized.current) {
      chatInitialized.current = true;
      const history = loadPersistedChat(userId);
      if (history.length > 0) {
        setMessages(history);
        idRef.current = Math.max(...history.map((m) => m.id), 0);
      }
    }
  }, [userId]);

  // Persist messages whenever updated
  useEffect(() => {
    if (chatInitialized.current) {
      savePersistedChat(messages, userId);
    }
  }, [messages, userId]);

  // One-shot ?ask= prefill (guides deep-link here with a ready question).
  useEffect(() => {
    if (prefilled.current || typeof window === "undefined") return;
    prefilled.current = true;
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask?.trim()) {
      setInstruction(ask.trim().slice(0, AGENT_INSTRUCTION_MAX_LENGTH));
      router.replace("/agent");
      textareaRef.current?.focus();
    }
  }, [router]);

  const statusMissing = !status.isLoading && !status.error && !status.data;
  const verifiedAgentStatus =
    status.error || statusMissing || !status.data ? null : status.data;
  const configured = verifiedAgentStatus
    ? verifiedAgentStatus.configured
    : false;
  const canUseAi = verifiedAgentStatus?.canUseAi ?? false;
  const needsBillingSetup = verifiedAgentStatus?.needsBillingSetup ?? false;
  const canRun = !status.isLoading && configured && canUseAi;
  const instructionInvalid =
    instruction.length > 0 && !isAgentInstructionValid(instruction);
  const submitDisabled =
    !canRun || !isAgentInstructionValid(instruction) || run.isPending;
  const hasConversation = messages.length > 0;
  const lastReplyId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isError)?.id;

  // Signal the tour AFTER the reply is committed to the DOM
  const signaledReplyId = useRef<number | null>(null);
  useEffect(() => {
    if (lastReplyId == null || signaledReplyId.current === lastReplyId) return;
    signaledReplyId.current = lastReplyId;
    emitGuideSignal(GUIDE_SIGNALS.agentRunSucceeded);
  }, [lastReplyId]);

  useEffect(() => {
    if (!canRun && allowWrites) {
      setAllowWrites(false);
    }
  }, [allowWrites, canRun]);

  // Auto-scroll to the newest message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, run.isPending]);

  // Localized date
  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString("sk-SK", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  }, []);

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }

  function submit() {
    if (submitDisabled) return;
    const text = instruction.trim();
    // Send a trailing window of the conversation for multi-turn context.
    const history = messages
      .filter((m) => !m.isError && Boolean(m.content?.trim()))
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));
    const writes = allowWrites;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text },
    ]);
    setInstruction("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    run.mutate(
      {
        instruction: text,
        allowWrites: writes,
        deepThinking,
        history: history.length > 0 ? history : undefined,
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: data.text,
              toolCalls: data.toolCalls,
            },
          ]);
        },
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: err.message,
              isError: true,
            },
          ]);
        },
        onSettled: () => setAllowWrites(false),
      },
    );
  }

  function pickSuggestion(text: string) {
    setInstruction(text);
    setActiveTab("chat");
    textareaRef.current?.focus();
  }

  function handleResetChat() {
    setMessages([]);
    clearPersistedChat(userId);
    toast.success(t("agent.newSessionStarted", "Nová relácia asistenta spustená"));
  }

  const handleCopyMessage = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success(t("agent.copiedToClipboard", "Skopírované do schránky"));
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const statusBanner = status.isLoading ? (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      <span>{t("agent.status.checkingConfig", "Checking agent configuration…")}</span>
    </div>
  ) : status.error ? (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">
          {t("agent.status.checkError", "Could not check agent status")}
        </p>
        <p className="mt-1">{status.error.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2.5 h-7 text-xs"
          onClick={() => void status.refetch()}
        >
          {t("agent.status.retry", "Retry")}
        </Button>
      </div>
    </div>
  ) : statusMissing ? (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">
          {t("agent.status.unavailable", "Agent status is unavailable")}
        </p>
        <p className="mt-1">
          {t(
            "agent.status.unavailableDesc",
            "We could not confirm the agent is ready. Retry before running.",
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2.5 h-7 text-xs"
          onClick={() => void status.refetch()}
        >
          {t("agent.status.retry", "Retry")}
        </Button>
      </div>
    </div>
  ) : needsBillingSetup ? (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs">
      <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="font-semibold text-foreground">
          {t("agent.status.addCardTitle", "Add a card to try AI")}
        </p>
        <p className="mt-1 text-muted-foreground">
          {verifiedAgentStatus?.accessMessage}
        </p>
        {isAdmin ? (
          <Button
            size="sm"
            className="mt-2.5 h-7 text-xs"
            onClick={() => router.push("/settings?tab=billing")}
          >
            {t("agent.status.addCardButton", "Add a card")}
          </Button>
        ) : (
          <p className="mt-2 text-muted-foreground">
            {t(
              "agent.status.askAdminCard",
              "Ask a practice administrator to add the card.",
            )}
          </p>
        )}
      </div>
    </div>
  ) : !canUseAi ? (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {verifiedAgentStatus?.accessMessage ??
          t(
            "agent.status.notAvailable",
            "OpenVPM AI is not available for this workspace.",
          )}
      </p>
    </div>
  ) : !configured ? (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {verifiedAgentStatus?.hosted ? (
        <p>
          {t(
            "agent.status.hostedUnavailable",
            "The agent is not available right now. We are on it. Please check back soon.",
          )}
        </p>
      ) : (
        <p>
          {t(
            "agent.status.configVertexPrefix",
            "Configure Google Vertex AI with",
          )}{" "}
          <code className="break-all font-mono">GOOGLE_VERTEX_PROJECT</code>,{" "}
          <code className="break-all font-mono">GOOGLE_VERTEX_LOCATION</code>,{" "}
          {t(
            "agent.status.configVertexMid",
            "and service-account credentials for Gemini, or set",
          )}{" "}
          <code className="break-all font-mono">ANTHROPIC_API_KEY</code>{" "}
          {t(
            "agent.status.configVertexSuffix",
            "for an explicit Claude model.",
          )}
        </p>
      )}
    </div>
  ) : null;

  // Recent AI sessions dataset (Voice, Imaging, Discharge, Chat)
  const recentSessions: MockSessionItem[] = useMemo(() => [
    {
      id: "ses-vce-8912",
      type: "voice",
      title: "Bella (Labrador Retriever) — Anamnéza & SOAP",
      duration: "1m 42s",
      status: "confirmed",
      createdAt: "Dnes, 09:15",
      href: "/agent/voice",
    },
    {
      id: "ses-img-4321",
      type: "imaging",
      title: "Luna (Európska krátkosrstá) — RTG Thorax VHS",
      duration: "4.2s",
      status: "confirmed",
      createdAt: "Dnes, 08:50",
      href: "/agent/imaging",
    },
    {
      id: "ses-dis-1098",
      type: "discharge",
      title: "Max (Nemecký ovčiak) — Prepúšťacia správa po operácii",
      duration: "2.1s",
      status: "draft",
      createdAt: "Dnes, 08:20",
      href: "/agent/discharge",
    },
    {
      id: "ses-vce-8905",
      type: "voice",
      title: "Rocky (Bordeauxská doga) — Kontrola po ortopédii",
      duration: "3m 15s",
      status: "draft",
      createdAt: "Dnes, 07:45",
      href: "/agent/voice",
    },
    {
      id: "ses-cht-7741",
      type: "chat",
      title: "Konzílium — Výpočet dávky karprofénu & NSAID interakcie",
      duration: "1.8s",
      status: "confirmed",
      createdAt: "Včera, 16:30",
      href: "/agent",
    },
    {
      id: "ses-img-4319",
      type: "imaging",
      title: "Milo (Bígl) — Abdominálny ultrazvuk (AFAST)",
      duration: "6.5s",
      status: "expired",
      createdAt: "Včera, 14:10",
      href: "/agent/imaging",
    },
  ], []);

  const filteredRecentSessions = useMemo(() => {
    return recentSessions.filter((s) => {
      const matchesSearch =
        !sessionSearch ||
        s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(sessionSearch.toLowerCase());

      const matchesStatus =
        sessionStatusFilter === "all" || s.status === sessionStatusFilter;

      const matchesType =
        sessionTypeFilter === "all" || s.type === sessionTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [recentSessions, sessionSearch, sessionStatusFilter, sessionTypeFilter]);

  const subAgents = [
    {
      id: "voice",
      href: "/agent/voice",
      title: t("agent.subagents.voiceTitle", "Hlasový prepis"),
      desc: t(
        "agent.subagents.voiceDesc",
        "Hlasové diktovanie v reálnom čase a ambientný prepis vyšetrenia do štruktúrovaných SOAP záznamov.",
      ),
      icon: Mic,
      statusVariant: "online" as StatusPulseVariant,
      statusLabel: t("agent.subagents.statusLive", "Aktívny"),
      badge: "Gemini 2.5 STT",
    },
    {
      id: "imaging",
      href: "/agent/imaging",
      title: t("agent.subagents.imagingTitle", "Diagnostické zobrazovanie"),
      desc: t(
        "agent.subagents.imagingDesc",
        "Multimodálna analýza RTG, sono, CT a MRI snímok s automatickým výpočtom VHS.",
      ),
      icon: ScanLine,
      statusVariant: "online" as StatusPulseVariant,
      statusLabel: t("agent.subagents.statusLive", "Aktívny"),
      badge: "Vision VL",
    },
    {
      id: "discharge",
      href: "/agent/discharge",
      title: t("agent.subagents.dischargeTitle", "Prepúšťací asistent"),
      desc: t(
        "agent.subagents.dischargeDesc",
        "Generovanie prepúšťacích správ, rozpisu domácej medikácie a komunikácie pre majiteľov.",
      ),
      icon: Send,
      statusVariant: "online" as StatusPulseVariant,
      statusLabel: t("agent.subagents.statusLive", "Aktívny"),
      badge: "Sympathy Gate",
    },
  ];

  return (
    <div className={pageShellClass}>
      {/* 1. PageHeader with icon=Bot and AI BETA badge */}
      <PageHeader
        icon={Bot}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("agent.title", "AI Asistent")}
            <Badge
              variant="secondary"
              className="gap-1 bg-primary/10 text-primary border-primary/20 font-semibold"
            >
              <Sparkles className="h-3 w-3" />
              AI BETA
            </Badge>
          </span>
        }
        subtitle={t(
          "agent.subtitle",
          "Ask about your clinic. It can look things up and, with your okay, do the work.",
        )}
        actions={
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "chat" | "capabilities")}
          >
            <TabsList className={underlineTabsListClass}>
              <TabsTrigger value="chat" className={cn(underlineTabsTriggerClass, "gap-1.5")}>
                <Bot className="h-4 w-4" />
                {t("agent.tabs.chat", "Asistent")}
              </TabsTrigger>
              <TabsTrigger value="capabilities" className={cn(underlineTabsTriggerClass, "gap-1.5")}>
                <Sparkles className="h-4 w-4" />
                {t("agent.tabs.capabilities", "Schopnosti")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* 2. Advisory banner: all AI outputs require vet confirmation before clinical use */}
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="leading-relaxed">
          {t(
            "agent.advisory.banner",
            "Všetky výstupy AI agentov majú odporúčací charakter a vyžadujú kontrolu a schválenie licencovaným veterinárnym lekárom pred klinickým použitím (Zákon č. 39/2007 Z. z.).",
          )}
        </span>
      </div>

      {/* 3. KpiGrid: active sessions, completed today, avg response time, SOAP drafts pending */}
      <KpiGrid>
        <KpiCard
          icon={Activity}
          label={t("agent.kpi.activeSessions", "Aktívne relácie")}
          value="4"
          tone="primary"
        />
        <KpiCard
          icon={CheckCircle2}
          label={t("agent.kpi.completedToday", "Dnes dokončené")}
          value="18"
          tone="primary"
        />
        <KpiCard
          icon={Clock}
          label={t("agent.kpi.avgResponseTime", "Priemerná odozva")}
          value="1.8s"
        />
        <KpiCard
          icon={FileCheck2}
          label={t("agent.kpi.soapDraftsPending", "Čakajúce SOAP koncepty")}
          value="2"
          tone="warning"
        />
      </KpiGrid>

      {/* 4. Navigation cards to Voice / Imaging / Discharge with live status indicators */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("agent.subagents.title", "Špecializovaní AI agenti")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {subAgents.map((ag) => {
            const Icon = ag.icon;
            return (
              <Card
                key={ag.id}
                className="group relative flex flex-col justify-between border-border transition-all hover:border-primary/40 hover:shadow-xs"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {ag.title}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="mt-0.5 text-[10px] font-mono"
                        >
                          {ag.badge}
                        </Badge>
                      </div>
                    </div>
                    <StatusPulseBadge
                      variant={ag.statusVariant}
                      label={ag.statusLabel}
                      size="sm"
                    />
                  </div>
                  <CardDescription className="pt-2 text-xs leading-relaxed text-muted-foreground">
                    {ag.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex justify-end">
                  <Link href={ag.href} className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs group-hover:border-primary/40 group-hover:text-primary"
                    >
                      <span>{t("agent.subagents.openAgent", "Otvoriť agenta")}</span>
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {activeTab === "capabilities" ? (
        <AgentCapabilitiesView
          onPickQuery={pickSuggestion}
          onActivateWriteMode={() => {
            setAllowWrites(true);
            setActiveTab("chat");
          }}
        />
      ) : (
        /* Main 2-Column Chat Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Sidebar Controls & Presets */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Status & Safety Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  {t("agent.systemCardTitle", "Stav a režim asistenta")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusBanner ? (
                  <div>{statusBanner}</div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{t("agent.status.ready", "AI asistent je pripravený a plne konfigurovaný")}</span>
                  </div>
                )}

                {/* Write Mode Box */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowWrites}
                      onChange={(e) => setAllowWrites(e.target.checked)}
                      disabled={!canRun || run.isPending}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    {t(
                      "agent.composer.allowWrites",
                      "Allow writes: appointments and patient vitals",
                    )}
                  </label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      "agent.composer.writeWarning",
                      "Write mode can create appointments or record patient vitals. It turns off automatically after this run.",
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Morning Vet Brief */}
            {canRun && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                      {t("agent.morningBrief.title", "Ranný prehľad")}
                      {dateLabel ? ` — ${dateLabel}` : ""}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                      {t(
                        "agent.morningBrief.subtitle",
                        "Spustite AI dopyt pre okamžitý prehľad dňa",
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      icon: Stethoscope,
                      labelKey: "agent.morningBrief.today",
                      labelFallback: "Dnes v ordinácii",
                      query: "Zhrň mi dnešné termíny – počet pacientov, prvé návštevy a urgentné prípady.",
                    },
                    {
                      icon: Pill,
                      labelKey: "agent.morningBrief.vaccinesExpiring",
                      labelFallback: "Expirujúce vakcíny",
                      query: "Ktorí pacienti majú expirované alebo čoskoro expirujúce očkovania?",
                    },
                    {
                      icon: Calendar,
                      labelKey: "agent.morningBrief.unfinishedRecords",
                      labelFallback: "Nedokončené záznamy",
                      query: "Máme nejakých pacientov z posledných 7 dní bez ukončeného SOAP záznamu alebo prepúšťacej správy?",
                    },
                    {
                      icon: ShieldAlert,
                      labelKey: "agent.morningBrief.hospitalized",
                      labelFallback: "Aktívne hospitalizácie",
                      query: "Zoznam aktuálne hospitalizovaných pacientov s ich diagnózou a dátumom prijatia.",
                    },
                  ].map(({ icon: Icon, labelKey, labelFallback, query }) => {
                    const label = t(labelKey, labelFallback);
                    return (
                      <button
                        key={labelKey}
                        type="button"
                        className="flex items-center gap-2.5 text-left rounded-lg px-3 py-2 text-xs bg-white/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-300 transition-colors group"
                        onClick={() => pickSuggestion(query)}
                      >
                        <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="font-medium text-amber-900 dark:text-amber-200">{label}</span>
                        <ChevronRight className="h-3 w-3 ml-auto text-amber-400 group-hover:text-amber-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("agent.quickQuestions", "Rýchle veterinárne otázky")}:
              </label>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start h-auto py-2.5 px-3 text-xs text-left bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 whitespace-normal leading-relaxed transition-colors shadow-xs"
                    disabled={!canRun}
                    onClick={() => pickSuggestion(t(s.key, s.fallback))}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-2 shrink-0 text-primary opacity-80" />
                    <span>{t(s.key, s.fallback)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Tips Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  {t("agent.tipsTitle", "Ako sa pýtať asistenta")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <p>• {t("agent.tips.naturalLanguage", "Pýtajte sa prirodzenou slovenčinou na pacientov, dávkovanie či termíny.")}</p>
                <p>• {t("agent.tips.context", "Asistent udržiava kontext konverzácie až 12 správ spätne.")}</p>
                <p>• {t("agent.tips.writeMode", "Pre úpravy kartotéky nezabudnite povoliť režim zápisu vyššie.")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Chat Workspace */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="flex flex-col h-[680px] shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {t("agent.chatTitle", "Konverzácia")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {hasConversation
                        ? t("agent.chat.messagesInSession", "{count} správ v relácii", {
                            count: messages.length,
                          })
                        : t("agent.chat.readyForQuery", "Pripravené na dopyt")}
                    </CardDescription>
                  </div>
                </div>

                {hasConversation && (
                  <div className="flex items-center gap-2">
                    <AgentExportButtons messages={messages} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetChat}
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("agent.newChat", "Nová relácia")}
                    </Button>
                  </div>
                )}
              </CardHeader>

              {/* Messages Content */}
              <CardContent
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
              >
                {!hasConversation ? (
                  <div className="flex h-full flex-col items-center justify-center text-center p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h2 className="font-heading text-lg font-semibold">
                      {t("agent.welcome.title", "What can I help you with?")}
                    </h2>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
                      {t(
                        "agent.welcome.subtitle",
                        "AI is built into OpenVPM. Ask a question in plain words, or start with one of these.",
                      )}
                    </p>
                    <p className="mt-4 text-[11px] text-muted-foreground/80">
                      {t("agent.welcome.hint", "Vyberte si otázku z ľavého panelu alebo napíšte vlastnú nižšie.")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        data-tour={m.id === lastReplyId ? "agent-reply" : undefined}
                      >
                        <AgentMessageBubble
                          message={m}
                          onCopy={() => handleCopyMessage(m.content, m.id)}
                          isCopied={copiedIndex === m.id}
                        />
                      </div>
                    ))}
                    {run.isPending ? <TypingIndicator /> : null}
                  </div>
                )}
              </CardContent>

              {/* Composer */}
              <div className="p-3 border-t border-border bg-card">
                <div
                  data-tour="agent-input"
                  className="rounded-xl border border-border bg-muted/20 p-2 shadow-xs focus-within:border-primary/40 focus-within:bg-background transition-colors"
                >
                  <textarea
                    ref={textareaRef}
                    value={instruction}
                    onChange={(e) => {
                      setInstruction(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    rows={1}
                    maxLength={AGENT_INSTRUCTION_MAX_LENGTH}
                    aria-invalid={instructionInvalid || undefined}
                    disabled={!canRun || run.isPending}
                    placeholder={
                      canRun
                        ? t(
                            "agent.composer.placeholder",
                            "Ask the agent anything…  (Enter to send, Shift+Enter for a new line)",
                          )
                        : needsBillingSetup
                          ? t(
                              "agent.composer.placeholderNoCard",
                              "Add a card to try AI.",
                            )
                          : t(
                              "agent.composer.placeholderUnavailable",
                              "The agent is not available right now.",
                            )
                    }
                    className="max-h-36 w-full resize-none bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                        <input
                          type="checkbox"
                          checked={deepThinking}
                          onChange={(e) => setDeepThinking(e.target.checked)}
                          disabled={!canRun || run.isPending}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <Sparkles
                          className={`h-3.5 w-3.5 ${
                            deepThinking ? "text-violet-500 animate-pulse" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={
                            deepThinking
                              ? "font-semibold text-violet-600 dark:text-violet-400"
                              : "text-muted-foreground"
                          }
                        >
                          {t("agent.composer.deepThinking", "Hlbšia analýza (Konzílium)")}
                        </span>
                        {deepThinking && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 border-violet-400 text-violet-600 dark:text-violet-400"
                          >
                            Pro
                          </Badge>
                        )}
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {instruction.length > 0 && `${instruction.length}/${AGENT_INSTRUCTION_MAX_LENGTH}`}
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={submit}
                      disabled={submitDisabled}
                      aria-label={t("agent.composer.send", "Send")}
                      className="h-8 px-3 rounded-lg gap-1.5 text-xs font-semibold"
                    >
                      {run.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{t("agent.composer.sending", "Odosielam...")}</span>
                        </>
                      ) : (
                        <>
                          <span>{t("agent.composer.send", "Odoslať")}</span>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {allowWrites ? (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      {t(
                        "agent.composer.writeWarning",
                        "Write mode can create appointments or record patient vitals. It turns off automatically after this run.",
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 6. DataTableFrame: recent AI sessions (type badge, duration, status draft/confirmed/expired) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("agent.recentSessions.title", "Nedávne AI relácie")}
            </h2>
          </div>

          <PageToolbar>
            <SearchField
              value={sessionSearch}
              onChange={setSessionSearch}
              placeholder={t("agent.recentSessions.title", "Hľadať v reláciách...")}
              className="max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sessionTypeFilter}
                onChange={(e) => setSessionTypeFilter(e.target.value)}
                className={filterControlClass}
                aria-label={t("agent.recentSessions.colType", "Typ")}
              >
                <option value="all">{t("common.all", "Všetky typy")}</option>
                <option value="voice">{t("agent.recentSessions.typeVoice", "Hlasový prepis")}</option>
                <option value="imaging">{t("agent.recentSessions.typeImaging", "Rádiológia AI")}</option>
                <option value="discharge">{t("agent.recentSessions.typeDischarge", "Prepúšťacia správa")}</option>
                <option value="chat">{t("agent.recentSessions.typeChat", "Kopilot asistent")}</option>
              </select>

              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className={filterControlClass}
                aria-label={t("agent.recentSessions.colStatus", "Stav")}
              >
                <option value="all">{t("common.all", "Všetky stavy")}</option>
                <option value="confirmed">{t("agent.recentSessions.statusConfirmed", "Potvrdené")}</option>
                <option value="draft">{t("agent.recentSessions.statusDraft", "Koncept")}</option>
                <option value="expired">{t("agent.recentSessions.statusExpired", "Expirované")}</option>
              </select>
            </div>
          </PageToolbar>
        </div>

        {filteredRecentSessions.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={t("agent.recentSessions.emptyTitle", "Žiadne nedávne AI relácie")}
            description={t(
              "agent.recentSessions.emptyDescription",
              "Relácie AI agentov sa zobrazia tu po uskutočnení diktátov, analýz snímok alebo konzultácií.",
            )}
          />
        ) : (
          <DataTableFrame>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={tableHeadClass}>
                    {t("agent.recentSessions.colId", "ID relácie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("agent.recentSessions.colType", "Typ")}
                  </th>
                  <th className={tableHeadClass}>
                    Popis & Nález
                  </th>
                  <th className={tableHeadClass}>
                    {t("agent.recentSessions.colDuration", "Trvanie")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("agent.recentSessions.colStatus", "Stav")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("agent.recentSessions.colTimestamp", "Vytvorené")}
                  </th>
                  <th className={cn(tableHeadClass, "text-right")}>
                    {t("agent.recentSessions.colAction", "Akcia")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentSessions.map((item) => {
                  const typeLabel =
                    item.type === "voice"
                      ? t("agent.recentSessions.typeVoice", "Hlasový prepis")
                      : item.type === "imaging"
                        ? t("agent.recentSessions.typeImaging", "Rádiológia AI")
                        : item.type === "discharge"
                          ? t("agent.recentSessions.typeDischarge", "Prepúšťacia správa")
                          : t("agent.recentSessions.typeChat", "Kopilot asistent");

                  const statusPulseVariant: StatusPulseVariant =
                    item.status === "confirmed"
                      ? "confirmed"
                      : item.status === "draft"
                        ? "pending"
                        : "failed";

                  const statusLabel =
                    item.status === "confirmed"
                      ? t("agent.recentSessions.statusConfirmed", "Potvrdené")
                      : item.status === "draft"
                        ? t("agent.recentSessions.statusDraft", "Koncept")
                        : t("agent.recentSessions.statusExpired", "Expirované");

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      className={cn(tableRowClass, "cursor-pointer")}
                    >
                      <td className={cn(tableCellClass, "font-mono font-medium text-foreground")}>
                        {item.id}
                      </td>
                      <td className={tableCellClass}>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] font-medium",
                            item.type === "voice" && "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
                            item.type === "imaging" && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
                            item.type === "discharge" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                            item.type === "chat" && "bg-primary/10 text-primary border-primary/20",
                          )}
                        >
                          {typeLabel}
                        </Badge>
                      </td>
                      <td className={cn(tableCellClass, "font-medium text-foreground max-w-xs truncate")}>
                        {item.title}
                      </td>
                      <td className={cn(tableCellClass, "font-mono tabular-nums text-muted-foreground")}>
                        {item.duration}
                      </td>
                      <td className={tableCellClass}>
                        <StatusPulseBadge
                          variant={statusPulseVariant}
                          label={statusLabel}
                          size="sm"
                        />
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {item.createdAt}
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Link
                          href={item.href}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </div>
    </div>
  );
}
