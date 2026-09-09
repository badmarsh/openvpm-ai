"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bot,
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
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

export const SUGGESTIONS = [
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dateLabel, setDateLabel] = useState("");
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
      .filter((m) => !m.isError)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
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

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("agent.title", "AI Asistent")}
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              {t("agent.badge", "Klinický AI Copilot")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "agent.subtitle",
              "Ask about your clinic. It can look things up and, with your okay, do the work.",
            )}
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "capabilities")}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="chat" className="gap-1.5">
              <Bot className="h-4 w-4" />
              {t("agent.tabs.chat", "Asistent")}
            </TabsTrigger>
            <TabsTrigger value="capabilities" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              {t("agent.tabs.capabilities", "Schopnosti")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

                  <div className="flex items-center justify-between gap-3 px-1 pt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {instruction.length > 0 && `${instruction.length}/${AGENT_INSTRUCTION_MAX_LENGTH}`}
                    </span>

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
    </div>
  );
}
