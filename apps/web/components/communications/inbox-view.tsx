"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  Globe,
  Send,
  ArrowLeft,
  ArrowRight,
  Clock,
  Circle,
  Plus,
  Search,
  Inbox as InboxIcon,
  X,
  UserCheck,
  UserMinus,
  UserPlus,
  Sparkles,
  AlertCircle,
  Loader2,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Package,
  CheckCircle2,
} from "lucide-react";
import { cleanEmailBody } from "@/lib/inbox-cleaner";
import { importErrorKey } from "@/lib/inventory/import-errors";
import { WholesalerImportDialog } from "@/components/inventory/wholesaler-import-dialog";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  isClientSearchInputValid,
} from "@/lib/clients/policy";
import {
  COMMUNICATION_SUBJECT_MAX_LENGTH,
  communicationContentMaxLength,
  isCommunicationContentValid,
  isCommunicationSubjectValid,
} from "@/lib/communications/policy";
import { communicationStatusLabel } from "@/lib/communications/status";
import { toast } from "sonner";
import { translateOutboundEmailError } from "@/lib/outbound-email-errors";

type FilterTab = "all" | "unread" | "sent";
type Channel = "phone" | "sms" | "email" | "portal" | "whatsapp";

type InboxListItem = {
  id: string;
  clientId: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  content: string | null;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  readAt?: Date | string | null;
  providerMessageId: string | null;
  createdAt: Date | string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  unreadCount?: number;
  senderDisplay?: string | null;
  senderGroupKey?: string | null;
};

type ClientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type ConversationGroup =
  | {
      kind: "client";
      id: string;
      clientId: string;
      clientName: string;
      latest: InboxListItem;
      unreadCount: number;
    }
  | {
      kind: "unmatched";
      id: string;
      communicationId: string;
      senderGroupKey: string;
      clientName: string;
      latest: InboxListItem;
      unreadCount: number;
    };

const channelIcons: Record<Channel, React.ElementType> = {
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
  portal: Globe,
  whatsapp: MessageCircle,
};

/** WhatsApp messages are stored as channel="sms" with dedupeKey prefixed "wa:". */
function MessageContentBubble({
  content,
  channel,
  direction,
  providerMessageId,
  communicationId,
}: {
  content: string | null;
  channel: string;
  direction: string;
  providerMessageId?: string | null;
  communicationId?: string;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const { t } = useI18n();
  const [importingAttId, setImportingAttId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importPreloaded, setImportPreloaded] = useState<any | null>(null);

  const parseAttachmentMutation = trpc.extensions.wholesalerImport.parseAttachmentForImport.useMutation({
    onSuccess: (data) => {
      setImportPreloaded(data);
      setImportDialogOpen(true);
      setImportingAttId(null);
    },
    onError: (err) => {
      toast.error(t(importErrorKey(err.message)));
      setImportingAttId(null);
    },
  });
  const attMatch = content ? content.match(/<!--INBOX_ATTACHMENTS:([\s\S]*?)-->/) : null;
  let attachments: Array<{ id: string; filename?: string; content_type?: string }> = [];
  if (attMatch && attMatch[1]) {
    try {
      attachments = JSON.parse(attMatch[1]);
    } catch {}
  }

  const rawWithoutMeta = content ? content.replace(/\n*<!--INBOX_ATTACHMENTS:[\s\S]*?-->/g, "").trim() : "";
  const isEmail = channel === "email" && direction === "inbound";
  const { cleanText, hasQuotedHistory, rawText } = isEmail
    ? cleanEmailBody(rawWithoutMeta)
    : { cleanText: rawWithoutMeta, hasQuotedHistory: false, rawText: rawWithoutMeta };

  return (
    <div className="space-y-2">
      <p className="text-sm whitespace-pre-wrap leading-relaxed">
        {cleanText || "[Žiadny text správy]"}
      </p>

      {attachments.length > 0 ? (
        <div className="mt-2 space-y-1.5 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
            <Paperclip className="h-3 w-3" />
            <span>Prílohy ({attachments.length}):</span>
          </div>
          <div className="grid gap-1.5">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-1.5">
                <a
                  href={"/api/inbox/attachments/" + providerMessageId + "/" + att.id}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background/80 hover:bg-background px-2.5 py-1.5 transition-colors shadow-sm text-foreground min-w-0"
                >
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-xs font-medium">
                    {att.filename || "Príloha"}
                  </span>
                  <Download className="h-3.5 w-3.5 ml-auto text-muted-foreground shrink-0" />
                </a>
                {communicationId && att.filename?.toLowerCase().endsWith(".pdf") ? (
                  <button
                    type="button"
                    title="Importovať do skladu"
                    disabled={importingAttId === att.id || parseAttachmentMutation.isPending}
                    onClick={() => {
                      setImportingAttId(att.id);
                      parseAttachmentMutation.mutate({ communicationId, attachmentId: att.id });
                    }}
                    className="shrink-0 flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-1.5 text-[11px] font-medium text-amber-800 transition-colors disabled:opacity-50"
                  >
                    {importingAttId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Package className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Sklad</span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <WholesalerImportDialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) setImportPreloaded(null);
        }}
        onSuccess={() => {
          setImportDialogOpen(false);
          setImportPreloaded(null);
        }}
        preloadedData={importPreloaded}
      />

      {hasQuotedHistory ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowHistory(!showHistory);
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            {showHistory ? (
              <>
                <ChevronUp className="h-3 w-3" />
                <span>Skryť pôvodnú citáciu</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>Zobraziť celú pôvodnú správu</span>
              </>
            )}
          </button>
          {showHistory ? (
            <div className="mt-1.5 rounded bg-muted/60 p-2 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/40">
              {rawText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isWhatsAppMessage(item: { dedupeKey?: string | null; providerMessageId?: string | null }): boolean {
  return item.dedupeKey?.startsWith("wa:") === true;
}

function dateInputDayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

function formatInboxDate(date: Date, timeZone?: string | null): string {
  const loc = typeof document !== "undefined" && document.documentElement.lang === "sk" ? "sk-SK" : "en-US";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeZone: timeZone ?? undefined,
  };

  try {
    return date.toLocaleDateString(loc, options);
  } catch {
    return date.toLocaleDateString(loc, {
      ...options,
      timeZone: undefined,
    });
  }
}

function relativeTime(
  date: Date | string | null,
  timeZone?: string | null,
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
): string {
  if (!date) return "";
  const tr = t ?? ((_, fallback, params) => (fallback ?? "").replace(/{(\w+)}/g, (_, k) => String(params?.[k] ?? "")));
  const now = new Date();
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return tr("inbox.relativeJustNow", "Just now");
  if (diffMin < 60)
    return tr("inbox.relativeMinutesAgo", "{count}m ago", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)
    return tr("inbox.relativeHoursAgo", "{count}h ago", { count: diffHr });
  const todayDay = dateInputDayNumber(
    formatDateInputForTimeZone(now, timeZone),
  );
  const messageDay = dateInputDayNumber(
    formatDateInputForTimeZone(d, timeZone),
  );
  const diffDay =
    todayDay !== null && messageDay !== null
      ? todayDay - messageDay
      : Math.floor(diffHr / 24);
  if (diffDay === 1) return tr("inbox.relativeYesterday", "Yesterday");
  if (diffDay < 7)
    return tr("inbox.relativeDaysAgo", "{count}d ago", { count: diffDay });
  return formatInboxDate(d, timeZone);
}

function isUnreadInboxMessage(item: {
  direction: string;
  status: string;
  readAt?: Date | string | null;
}) {
  return item.direction === "inbound" && !item.readAt && item.status !== "read";
}

function canMutateInboxRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

export function InboxView() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedUnmatched, setSelectedUnmatched] =
    useState<InboxListItem | null>(null);
  const [selectedSenderKey, setSelectedSenderKey] = useState<string | null>(null);
  const [linkClientSearch, setLinkClientSearch] = useState("");

  const localizedChannelLabels: Record<Channel, string> = useMemo(
    () => ({
      phone: t("inbox.channelPhone", "Phone"),
      sms: t("inbox.channelSms", "SMS"),
      email: t("inbox.channelEmail", "Email"),
      portal: t("inbox.channelPortal", "Portal"),
      whatsapp: t("inbox.channelWhatsapp", "WhatsApp"),
    }),
    [t],
  );

  // Compose form state
  const [composeChannel, setComposeChannel] = useState<Channel>("portal");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");

  // New message client picker
  const [newMessageMode, setNewMessageMode] = useState(false);
  const [newClientSearch, setNewClientSearch] = useState("");
  const [smsBannerDismissed, setSmsBannerDismissed] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [dismissedAiSuggestion, setDismissedAiSuggestion] = useState(false);
  const [replyUnmatchedContent, setReplyUnmatchedContent] = useState("");
  const [replyUnmatchedSubject, setReplyUnmatchedSubject] = useState("");
  const trimmedNewClientSearch = newClientSearch.trim();
  const trimmedLinkClientSearch = linkClientSearch.trim();
  const canSearchNewClients = isClientSearchInputValid(newClientSearch);
  const canSearchLinkClients = isClientSearchInputValid(linkClientSearch);

  const {
    data: inboxSettings,
    isLoading: inboxSettingsLoading,
    error: inboxSettingsError,
  } = trpc.communications.settings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: commsData,
    isLoading,
    error: inboxError,
  } = trpc.communications.listConversations.useQuery(
    { inboxFilter: filter, limit: 50, offset: 0 },
    { refetchInterval: 30000 },
  );

  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
  } = trpc.communications.getByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId },
  );

  const {
    data: unmatchedThread,
    isLoading: unmatchedThreadLoading,
  } = trpc.communications.getBySender.useQuery(
    { senderGroupKey: selectedSenderKey! },
    { enabled: !!selectedSenderKey },
  );

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = trpc.clients.search.useQuery(
    { query: trimmedNewClientSearch },
    { enabled: canSearchNewClients },
  );

  const {
    data: linkClientResults,
    isLoading: linkClientLoading,
    error: linkClientError,
  } = trpc.clients.search.useQuery(
    { query: trimmedLinkClientSearch },
    { enabled: Boolean(selectedUnmatched && canSearchLinkClients) },
  );

  const {
    data: messagingStatus,
    isLoading: messagingStatusLoading,
    error: messagingStatusError,
    refetch: refetchMessagingStatus,
  } = trpc.messaging.getInboxStatus.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });

  const utils = trpc.useUtils();
  const smsSummary = messagingStatus?.summary;
  const smsStatusUnavailable =
    !messagingStatusLoading &&
    (Boolean(messagingStatusError) || !messagingStatus);
  const smsComposeBlocked =
    composeChannel === "sms" && smsSummary?.smsComposeEnabled !== true;
  const showSmsBanner = Boolean(smsSummary?.showBanner && !smsBannerDismissed);
  const showSmsStatusError = Boolean(
    smsStatusUnavailable && !smsBannerDismissed,
  );
  const currentUserId = session?.user?.id;
  const canMutateInbox = canMutateInboxRole(session?.user?.role);
  const inboxListError = inboxSettingsError ?? inboxError;
  const inboxListLoading = inboxSettingsLoading || isLoading;
  const inboxSettingsMissing =
    !inboxSettingsLoading && !inboxSettingsError && !inboxSettings;
  const inboxMessagesMissing = !isLoading && !inboxError && !commsData?.items;
  const inboxListMissing = inboxSettingsMissing || inboxMessagesMissing;
  const timelineDisplayError = inboxSettingsError ?? timelineError;
  const timelineDisplayLoading = inboxSettingsLoading || timelineLoading;
  const timelineMissing =
    Boolean(selectedClientId) &&
    !timelineLoading &&
    !timelineError &&
    !timeline;
  const timelineDisplayMissing = inboxSettingsMissing || timelineMissing;
  const searchMissing =
    canSearchNewClients && !searchLoading && !searchError && !searchResults;
  const linkClientMissing =
    Boolean(selectedUnmatched && canSearchLinkClients) &&
    !linkClientLoading &&
    !linkClientError &&
    !linkClientResults;
  const verifiedInboxSettings =
    inboxSettingsError || inboxSettingsMissing || !inboxSettings
      ? null
      : inboxSettings;
  const inboxTimeZone = verifiedInboxSettings
    ? verifiedInboxSettings.timezone
    : null;

  useEffect(() => {
    if (inboxSettingsError || inboxSettingsMissing) {
      setSelectedUnmatched(null);
    }
  }, [inboxSettingsError, inboxSettingsMissing]);

  const replyUnmatchedRequestRef = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const externalComposeRequest = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const createMutation = trpc.communications.create.useMutation({
    onSuccess: () => {
      externalComposeRequest.current = null;
      toast.success(t("inbox.toastMessageSent", "Message sent"));
      utils.communications.listConversations.invalidate();
      if (selectedClientId) {
        utils.communications.getByClient.invalidate({
          clientId: selectedClientId,
        });
      }
      setComposeContent("");
      setComposeSubject("");
    },
    onError: (err) => {
      if (err.data?.code === "BAD_REQUEST") {
        externalComposeRequest.current = null;
      }
      toast.error(translateOutboundEmailError(err.message, t));
      utils.communications.listConversations.invalidate();
      if (selectedClientId) {
        utils.communications.getByClient.invalidate({
          clientId: selectedClientId,
        });
      }
    },
  });

  const composeDeliveryChannel =
    composeChannel === "sms" || composeChannel === "whatsapp"
      ? "sms"
      : composeChannel === "portal"
        ? "portal"
        : "email";
  const composeContentMaxLength = communicationContentMaxLength(
    composeDeliveryChannel,
  );
  const composeContentInvalid =
    composeContent.length > 0 &&
    !isCommunicationContentValid(composeContent, composeDeliveryChannel);
  const composeSubjectInvalid =
    composeChannel === "email" && !isCommunicationSubjectValid(composeSubject);
  const canSendCompose =
    canMutateInbox &&
    Boolean(selectedClientId) &&
    isCommunicationContentValid(composeContent, composeDeliveryChannel) &&
    !composeSubjectInvalid &&
    !createMutation.isPending &&
    !(composeChannel === "sms" && smsComposeBlocked);

  const markReadMutation = trpc.communications.markClientRead.useMutation({
    onSuccess: (_data, variables) => {
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
  });

  const assignMutation = trpc.communications.assignClient.useMutation({
    onSuccess: (_data, variables) => {
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
    onError: (err, variables) => {
      toast.error(translateOutboundEmailError(err.message, t));
      utils.communications.listConversations.invalidate();
      utils.communications.getByClient.invalidate({
        clientId: variables.clientId,
      });
    },
  });

  const updateStatusMutation = trpc.communications.updateStatus.useMutation({
    onSuccess: () => {
      utils.communications.listConversations.invalidate();
    },
    onError: (err) => {
      toast.error(translateOutboundEmailError(err.message, t));
    },
  });

  const { data: aiActionData } =
    trpc.communications.suggestClientAction.useQuery(
      {
        senderGroupKey: selectedSenderKey || selectedUnmatched?.id || "",
        content: selectedUnmatched?.content,
        subject: selectedUnmatched?.subject,
      },
      { enabled: Boolean(selectedUnmatched && canMutateInbox) },
    );

  const createAndLinkMutation =
    trpc.communications.createClientAndLink.useMutation({
      onSuccess: (data) => {
        toast.success(t("inbox.toastClientCreatedAndLinked", "Client created and messages linked"));
        utils.communications.listConversations.invalidate();
        setSelectedUnmatched(null);
        setSelectedSenderKey(null);
        setSelectedClientId(data.client.id);
        setSelectedClientName(data.client.firstName + " " + data.client.lastName);
      },
      onError: (err) => {
        toast.error(translateOutboundEmailError(err.message, t));
      },
    });

  const linkCommunicationMutation =
    trpc.communications.linkCommunicationToClient.useMutation({
      onSuccess: (_data, variables) => {
        utils.communications.listConversations.invalidate();
        utils.communications.getByClient.invalidate({
          clientId: variables.clientId,
        });
      },
      onError: (err) => {
        toast.error(translateOutboundEmailError(err.message, t));
      },
    });

  const replyToUnmatchedMutation =
    trpc.communications.replyToUnmatched.useMutation({
      onSuccess: () => {
        setReplyUnmatchedContent("");
        setReplyUnmatchedSubject("");
        setShowReplyForm(false);
        replyUnmatchedRequestRef.current = null;
        utils.communications.listConversations.invalidate();
      },
      onError: (err) => { toast.error(translateOutboundEmailError(err.message, t)); },
    });

  const conversationGroups = useMemo((): ConversationGroup[] => {
    if (!commsData?.items) return [];
    return (commsData.items as InboxListItem[]).map((item) => {
      const unreadCount = Number(
        item.unreadCount ?? (isUnreadInboxMessage(item) ? 1 : 0),
      );
      if (!item.clientId) {
        const senderKey = item.senderGroupKey || item.id;
        const senderTitle = item.senderDisplay || t("inbox.unmatchedPrefix", "Unmatched {channel}", {
          channel:
            localizedChannelLabels[item.channel as Channel] ??
            t("inbox.channelMessageFallback", "Message"),
        });
        return {
          kind: "unmatched",
          id: `unmatched:${senderKey}`,
          communicationId: item.id,
          senderGroupKey: senderKey,
          clientName: senderTitle,
          latest: item,
          unreadCount,
        };
      }

      return {
        kind: "client",
        id: `client:${item.clientId}`,
        clientId: item.clientId,
        clientName:
          item.clientFirstName && item.clientLastName
            ? `${item.clientFirstName} ${item.clientLastName}`
            : t("inbox.unknownClient", "Unknown Client"),
        latest: item,
        unreadCount,
      };
    });
  }, [commsData, localizedChannelLabels, t]);

  const selectedGroup = useMemo(
    () =>
      conversationGroups.find(
        (group) =>
          group.kind === "client" && group.clientId === selectedClientId,
      ),
    [conversationGroups, selectedClientId],
  );
  const assignmentSource = selectedGroup?.latest ?? timeline?.[0];
  const assignedTo = assignmentSource?.assignedTo ?? null;
  const assignedToName = assignmentSource?.assignedToName ?? null;
  const assignedToMe = Boolean(assignedTo && assignedTo === currentUserId);
  const assignmentLabel = assignedTo
    ? assignedToMe
      ? t("inbox.assignedToYou", "Assigned to you")
      : t("inbox.assignedToStaff", "Assigned to {name}", {
          name: assignedToName ?? t("inbox.staffFallback", "staff"),
        })
    : t("inbox.unassigned", "Unassigned");
  const selectedUnmatchedEffectiveChannel = selectedUnmatched ? (isWhatsAppMessage(selectedUnmatched) ? "whatsapp" : (selectedUnmatched.channel as Channel)) : null;
  const SelectedUnmatchedIcon = selectedUnmatchedEffectiveChannel
    ? (channelIcons[selectedUnmatchedEffectiveChannel] ?? MessageSquare)
    : MessageSquare;
  const selectedUnmatchedChannel = selectedUnmatched
    ? (localizedChannelLabels[selectedUnmatched.channel as Channel] ??
      t("inbox.channelMessageFallback", "Message"))
    : t("inbox.channelMessageFallback", "Message");

  function handleSelectClient(
    clientId: string,
    clientName: string,
    unreadCount = 0,
  ) {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setSelectedUnmatched(null);
    setSelectedSenderKey(null);
    setLinkClientSearch("");
    setNewMessageMode(false);
    if (unreadCount > 0 && canMutateInbox) {
      markReadMutation.mutate({ clientId });
    }
  }

  function handleSelectUnmatched(item: InboxListItem, senderGroupKey?: string) {
    setDismissedAiSuggestion(false);
    setShowReplyForm(false);
    setSelectedClientId(null);
    setSelectedClientName("");
    setSelectedSenderKey(senderGroupKey || item.senderGroupKey || item.id);
    setSelectedUnmatched(item);
    setLinkClientSearch("");
    setNewMessageMode(false);

    if (isUnreadInboxMessage(item) && canMutateInbox) {
      updateStatusMutation.mutate({ id: item.id, status: "read" });
    }
  }

  function handleSend() {
    if (!selectedClientId) return;
    if (smsComposeBlocked) {
      toast.error(
        smsStatusUnavailable
          ? t("inbox.errorCheckingTexting", "Unable to check texting setup")
          : (smsSummary?.title ??
            t("inbox.checkingTexting", "Checking texting setup")),
      );
      return;
    }
    if (!canSendCompose) return;
    const trimmedContent = composeContent.trim();
    const trimmedSubject = composeSubject.trim();
    let requestId: string | undefined;
    if (composeChannel === "sms" || composeChannel === "email") {
      const fingerprint = `${composeChannel}\u0000${selectedClientId}\u0000${trimmedSubject}\u0000${trimmedContent}`;
      if (externalComposeRequest.current?.fingerprint !== fingerprint) {
        externalComposeRequest.current = {
          fingerprint,
          requestId: crypto.randomUUID(),
        };
      }
      requestId = externalComposeRequest.current.requestId;
    }
    createMutation.mutate({
      clientId: selectedClientId,
      channel: composeChannel,
      direction: "outbound",
      subject:
        composeChannel === "email" ? trimmedSubject || undefined : undefined,
      content: trimmedContent,
      ...(requestId ? { requestId } : {}),
    });
  }

  function handleNewMessage() {
    if (!canMutateInbox) return;
    externalComposeRequest.current = null;
    setNewMessageMode(true);
    setSelectedClientId(null);
    setSelectedClientName("");
    setSelectedUnmatched(null);
    setLinkClientSearch("");
    setNewClientSearch("");
  }

  function handleAssignmentToggle() {
    if (!canMutateInbox || !selectedClientId) return;
    assignMutation.mutate({
      clientId: selectedClientId,
      action: assignedToMe ? "unassign" : "assign_to_me",
      expectedAssignedTo: assignedTo,
    });
  }

  function handleLinkUnmatchedClient(client: ClientSearchResult) {
    if (!canMutateInbox || !selectedUnmatched) return;
    const clientName = `${client.firstName} ${client.lastName}`;

    linkCommunicationMutation.mutate(
      {
        communicationId: selectedUnmatched.id,
        clientId: client.id,
      },
      {
        onSuccess: () => {
          toast.success(
            t("inbox.toastMessageLinked", "Message linked to client"),
          );
          setSelectedUnmatched(null);
          setSelectedClientId(client.id);
          setSelectedClientName(clientName);
          setLinkClientSearch("");
        },
      },
    );
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("inbox.filterAll", "All") },
    { key: "unread", label: t("inbox.filterUnread", "Unread") },
    { key: "sent", label: t("inbox.filterSent", "Sent") },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("inbox.title", "Inbox")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("inbox.subtitle", "Client communications")}
          </p>
        </div>
        {canMutateInbox ? (
          <Button onClick={handleNewMessage} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("inbox.newMessage", "New Message")}
          </Button>
        ) : null}
      </div>

      {showSmsStatusError ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-semibold text-destructive">
                  {t(
                    "inbox.errorCheckingTexting",
                    "Unable to check texting setup",
                  )}
                </h3>
                <Badge variant="destructive">
                  {t("inbox.smsStatusUnavailable", "SMS status unavailable")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-destructive/80">
                {t(
                  "inbox.smsStatusErrorDesc",
                  "Retry before staff send SMS conversations from the shared inbox.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetchMessagingStatus()}
                >
                  {t("inbox.btnRetry", "Retry")}
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label={t(
                "inbox.dismissSmsWarningAria",
                "Dismiss SMS status warning",
              )} /* aria-label="Dismiss SMS status warning" */
              onClick={() => setSmsBannerDismissed(true)}
              className="h-8 w-8 shrink-0 rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      ) : showSmsBanner && smsSummary ? (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-semibold">
                  {smsSummary.kind === "not_configured"
                    ? t("inbox.smsBanner.notConfiguredTitle", smsSummary.title)
                    : smsSummary.kind === "action_required"
                      ? t("inbox.smsBanner.actionNeededTitle", smsSummary.title)
                      : smsSummary.kind === "pending"
                        ? t("inbox.smsBanner.pendingTitle", smsSummary.title)
                        : smsSummary.kind === "disabled"
                          ? t("inbox.smsBanner.disabledTitle", smsSummary.title)
                          : smsSummary.kind === "ready"
                            ? t("inbox.smsBanner.readyTitle", smsSummary.title)
                            : smsSummary.title}
                </h3>
                <Badge variant={smsSummary.badge.variant}>
                  {smsSummary.kind === "not_configured"
                    ? t("inbox.smsBanner.notConfiguredBadge", smsSummary.badge.label)
                    : smsSummary.kind === "action_required"
                      ? t("inbox.smsBanner.actionNeededBadge", smsSummary.badge.label)
                      : smsSummary.kind === "pending"
                        ? t("inbox.smsBanner.pendingBadge", smsSummary.badge.label)
                        : smsSummary.kind === "disabled"
                          ? t("inbox.smsBanner.disabledBadge", smsSummary.badge.label)
                          : smsSummary.kind === "ready"
                            ? t("inbox.smsBanner.readyBadge", smsSummary.badge.label)
                            : smsSummary.badge.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {smsSummary.kind === "not_configured"
                  ? t("inbox.smsBanner.notConfiguredDesc", smsSummary.description)
                  : smsSummary.kind === "action_required"
                    ? t("inbox.smsBanner.actionNeededDesc", smsSummary.description)
                    : smsSummary.kind === "pending"
                      ? t("inbox.smsBanner.pendingDesc", smsSummary.description)
                      : smsSummary.kind === "disabled"
                        ? t("inbox.smsBanner.disabledDesc", smsSummary.description)
                        : smsSummary.kind === "ready"
                          ? t("inbox.smsBanner.readyDesc", smsSummary.description)
                          : smsSummary.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {messagingStatus?.canManage && smsSummary.actionLabel ? (
                  <Button size="sm" asChild>
                    <Link href="/settings?tab=messaging&setup=texting">
                      {smsSummary.kind === "not_configured"
                        ? t("inbox.smsBanner.notConfiguredAction", smsSummary.actionLabel)
                        : smsSummary.kind === "action_required"
                          ? t("inbox.smsBanner.actionNeededAction", smsSummary.actionLabel)
                          : smsSummary.kind === "pending"
                            ? t("inbox.smsBanner.pendingAction", smsSummary.actionLabel)
                            : smsSummary.kind === "disabled"
                              ? t("inbox.smsBanner.disabledAction", smsSummary.actionLabel)
                              : smsSummary.actionLabel}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground">
                    {t(
                      "inbox.askAdminManageTexting",
                      "Ask an administrator to manage texting.",
                    )}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label={t(
                "inbox.dismissSmsPromptAria",
                "Dismiss SMS setup prompt",
              )}
              onClick={() => setSmsBannerDismissed(true)}
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Two-panel layout; below md the panes swap (list OR thread) so
          neither renders into ~half a phone screen. */}
      <div className="flex flex-1 rounded-lg border border-border bg-card overflow-hidden min-h-0">
        {/* Left panel - list */}
        <div
          data-tour="inbox-list"
          className={cn(
            "w-full flex-col border-border shrink-0 md:flex md:w-80 md:border-r",
            selectedClientId || selectedUnmatched || newMessageMode
              ? "hidden"
              : "flex",
          )}
        >
          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
                  filter === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Communication list */}
          <div className="flex-1 overflow-y-auto">
            {inboxListError || inboxListMissing ? (
              <div className="m-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {inboxListError?.message ??
                  t(
                    "inbox.errorLoadingMessages",
                    "Unable to load inbox messages. Please retry.",
                  )}
              </div>
            ) : inboxListLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("inbox.loadingMessages", "Loading messages...")}
              </div>
            ) : conversationGroups.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent p-8"
                icon={InboxIcon}
                title={t("inbox.emptyNoMessagesYet", "No messages yet")} /* title="No messages yet" */ /* title="No messages yet" */
              />
            ) : (
              conversationGroups.map((group) => {
                const effectiveChannel = isWhatsAppMessage(group.latest) ? "whatsapp" : (group.latest.channel as Channel);
                const Icon =
                  channelIcons[effectiveChannel] ??
                  MessageSquare;
                const isSelected =
                  group.kind === "client"
                    ? selectedClientId === group.clientId && !selectedUnmatched
                    : (selectedSenderKey ? selectedSenderKey === group.senderGroupKey : selectedUnmatched?.id === group.communicationId);
                const isUnread = group.unreadCount > 0;
                const preview =
                  group.latest.subject ||
                  group.latest.content?.slice(0, 60) ||
                  t("inbox.noContent", "No content");

                return (
                  <button
                    key={group.id}
                    onClick={() =>
                      group.kind === "client"
                        ? handleSelectClient(
                            group.clientId,
                            group.clientName,
                            group.unreadCount,
                          )
                        : handleSelectUnmatched(group.latest, group.senderGroupKey)
                    }
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-1.5 shrink-0">
                        {isUnread ? (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm truncate",
                              isUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {group.clientName}
                          </span>
                          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                            <Icon className="h-3 w-3" />
                            <span className="text-xs">
                              {relativeTime(
                                group.latest.createdAt,
                                inboxTimeZone,
                                t,
                              )}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {preview.length > 60
                            ? preview.slice(0, 60) + "..."
                            : preview}
                        </p>
                        {group.kind === "unmatched" ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">
                            {t(
                              "inbox.needsClientMatch",
                              "Needs client match",
                            )}
                          </p>
                        ) : group.latest.assignedTo ? (
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            {group.latest.assignedTo === currentUserId
                              ? t("inbox.assignedToYou", "Assigned to you")
                              : t(
                                  "inbox.assignedToStaff",
                                  "Assigned to {name}",
                                  {
                                    name:
                                      group.latest.assignedToName ??
                                      t("inbox.staffFallback", "staff"),
                                  },
                                )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - detail/compose */}
        <div
          className={cn(
            "flex-1 flex-col min-w-0 md:flex",
            selectedClientId || selectedUnmatched || newMessageMode
              ? "flex"
              : "hidden",
          )}
        >
          {(selectedClientId || selectedUnmatched || newMessageMode) && (
            <button
              type="button"
              onClick={() => {
                setSelectedClientId(null);
                setSelectedUnmatched(null);
                setNewMessageMode(false);
              }}
              className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("inbox.backToConversations", "Back to conversations")}
            </button>
          )}
          {newMessageMode && canMutateInbox ? (
            /* New message - client search */
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-sm mb-2">
                  {t("inbox.newMessage", "New Message")}
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t(
                      "inbox.searchClientsPlaceholder",
                      "Search clients...",
                    )}
                    value={newClientSearch}
                    maxLength={CLIENT_SEARCH_MAX_LENGTH}
                    onChange={(e) => setNewClientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {searchError || searchMissing ? (
                  <div className="m-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {searchError?.message ??
                      t(
                        "inbox.errorSearchingClients",
                        "Unable to search clients. Please retry.",
                      )}
                  </div>
                ) : searchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("inbox.searchingClients", "Searching clients...")}
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((client) => (
                    <button
                      key={client.id}
                      onClick={() =>
                        handleSelectClient(
                          client.id,
                          `${client.firstName} ${client.lastName}`,
                        )
                      }
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="text-sm font-medium">
                        {client.firstName} {client.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {client.email ||
                          client.phone ||
                          t("inbox.noContactInfo", "No contact info")}
                      </div>
                    </button>
                  ))
                ) : canSearchNewClients ? (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={Search}
                    title={t("inbox.noClientsFound", "No clients found")} /* title="No clients found" */
                  />
                ) : (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={Search}
                    title={t(
                      "inbox.typeToSearchClient",
                      "Type to search for a client",
                    )}
                  />
                )}
              </div>
            </div>
          ) : selectedUnmatched ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => setSelectedUnmatched(null)}
                    className="lg:hidden p-1 hover:bg-accent rounded"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-sm">
                      {selectedUnmatched.senderDisplay ||
                      t(
                        "inbox.unmatchedInboundTitle",
                        "Unmatched inbound message",
                      )}
                    </h3>
                    <Badge variant="secondary" className="mt-1">
                      {t("inbox.needsClientBadge", "Needs client")}
                      {unmatchedThread && unmatchedThread.length > 1 ? ` (${unmatchedThread.length})` : ""}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* AI suggestion — yellow dismissible banner */}
                {(() => {
                  if (!aiActionData || dismissedAiSuggestion) return null;
                  const suggested = aiActionData.suggestedNewClient;
                  const candidates = aiActionData.matchedCandidates ?? [];
                  const hasMatch = candidates.length > 0;
                  const primary = hasMatch ? candidates[0] : null;
                  const firstName = suggested?.firstName || "";
                  const lastName = suggested?.lastName || "";
                  const email = suggested?.email || "";
                  const hasData = firstName || lastName || email;
                  if (!hasData && !hasMatch) return null;
                  const displayName = hasMatch
                    ? (primary!.firstName + " " + primary!.lastName)
                    : ([firstName, lastName].filter(Boolean).join(" ") || email);
                  return (
                    <div className="flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 dark:border-amber-800/30 dark:bg-amber-950/20 px-3 py-1.5 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium shrink-0">
                          {hasMatch ? t("inbox.aiSuggestionMatch", "Nájdený klient:") : t("inbox.aiSuggestionNew", "Vytvoriť klienta:")}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 truncate">{displayName}</span>
                        {hasMatch && primary?.email ? (
                          <span className="text-[10px] text-amber-600/70 truncate hidden sm:inline">{primary.email}</span>
                        ) : null}
                      </div>
                      {hasMatch ? (
                        <Button
                          size="sm"
                          className="h-6 text-[11px] gap-1 px-2.5 shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
                          disabled={linkCommunicationMutation.isPending}
                          onClick={() => handleLinkUnmatchedClient(primary!)}
                        >
                          {linkCommunicationMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          {t("inbox.btnMatch", "Spárovať")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-6 text-[11px] gap-1 px-2.5 shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
                          disabled={createAndLinkMutation.isPending}
                          onClick={() => {
                            createAndLinkMutation.mutate({
                              communicationId: selectedUnmatched!.id,
                              senderGroupKey: selectedSenderKey || undefined,
                              firstName: firstName || "Klient",
                              lastName: lastName || "Novy",
                              email: email,
                            });
                          }}
                        >
                          {createAndLinkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                          {t("inbox.btnCreateAndLink", "Vytvoriť & Prepojiť")}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDismissedAiSuggestion(true)}
                        className="h-5 w-5 flex items-center justify-center rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0"
                        aria-label="Zavrieť návrh"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })()}
                {unmatchedThreadLoading && !unmatchedThread ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("inbox.loadingMessages", "Loading messages...")}
                  </div>
                ) : (
                  (unmatchedThread && unmatchedThread.length > 0 ? unmatchedThread : [selectedUnmatched]).map((msg) => (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-[75%] rounded-lg bg-muted px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                          <ArrowLeft className="h-3 w-3" />
                          <SelectedUnmatchedIcon className="h-3 w-3" />
                          <span className="text-[10px] uppercase font-medium">
                            {selectedUnmatchedChannel}
                          </span>
                        </div>

                        {msg.subject ? (
                          <p className="text-xs font-semibold mb-1 text-foreground">
                            {msg.subject}
                          </p>
                        ) : null}

                        <MessageContentBubble
                          content={msg.content}
                          channel={msg.channel}
                          direction={msg.direction}
                          providerMessageId={msg.providerMessageId}
                          communicationId={msg.id}
                        />

                        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          <span className="text-[10px]">
                            {relativeTime(msg.createdAt, inboxTimeZone, t)}
                          </span>
                          {msg.status ? (
                            <span className="text-[10px] ml-1 capitalize">
                              {msg.status}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ─── Bottom strip ─── */}
              <div className="border-t border-border">
                {canMutateInbox ? (
                  <div className="px-3 py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5"
                      onClick={() => {
                        setShowClientSearch(v => !v);
                        if (showClientSearch) setLinkClientSearch("");
                      }}
                    >
                      <Search className="h-3 w-3 shrink-0" />
                      <span>{t("inbox.searchOtherClient", "Priradiť inému klientovi...")}</span>
                      {showClientSearch ? (
                        <ChevronUp className="h-3 w-3 ml-auto shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
                      )}
                    </button>
                    {showClientSearch ? (
                      <div className="pb-1 space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder={t("inbox.searchClientsPlaceholder", "Search clients...")}
                            value={linkClientSearch}
                            maxLength={CLIENT_SEARCH_MAX_LENGTH}
                            autoFocus
                            onChange={(e) => setLinkClientSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                          />
                        </div>
                        {canSearchLinkClients ? (
                          <div className="max-h-36 overflow-y-auto rounded-md border border-border">
                            {linkClientError || linkClientMissing ? (
                              <div className="m-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                                {linkClientError?.message ?? t("inbox.errorSearchingClients", "Unable to search clients. Please retry.")}
                              </div>
                            ) : linkClientLoading ? (
                              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("inbox.searchingClients", "Searching clients...")}
                              </div>
                            ) : linkClientResults && linkClientResults.length > 0 ? (
                              linkClientResults.map((client) => (
                                <button
                                  key={client.id}
                                  onClick={() => handleLinkUnmatchedClient(client)}
                                  disabled={linkCommunicationMutation.isPending}
                                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{client.firstName} {client.lastName}</div>
                                    <div className="truncate text-xs text-muted-foreground">{client.email || client.phone || t("inbox.noContactInfo", "No contact info")}</div>
                                  </div>
                                  <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </button>
                              ))
                            ) : (
                              <div className="py-4 text-center text-xs text-muted-foreground">
                                {t("inbox.noClientsFound", "No clients found")}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {t("inbox.viewerCannotLink", "Viewer access cannot link inbox messages.")}
                  </p>
                )}

                {/* Reply compose bar */}
                {canMutateInbox && selectedUnmatched?.channel === "email" ? (() => {
                  const fromHeader = selectedUnmatched.content?.match(/^From:[ 	]*(.+)$/m)?.[1]?.trim() ?? "";
                  const bracketMatch = /<([^>]+)>/.exec(fromHeader);
                  const toEmail = (bracketMatch ? bracketMatch[1] : fromHeader).trim();
                  const originalSubject = selectedUnmatched.subject ?? "";
                  const replySubjectDefault = originalSubject.startsWith("Re:") ? originalSubject : ("Re: " + originalSubject);
                  if (!toEmail.includes("@")) return null;
                  return (
                    <div className="border-t border-border">
                      {showReplyForm ? (
                        <div className="px-3 pt-2 pb-2.5 space-y-1.5 bg-muted/20">
                          <div className="flex items-center gap-1.5 justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Send className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-[11px] font-medium">{t("inbox.replyUnmatchedTitle", "Odpovedať")}</span>
                              <span className="font-mono text-[10px] text-muted-foreground truncate">{toEmail}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setShowReplyForm(false); setReplyUnmatchedContent(""); setReplyUnmatchedSubject(""); }}
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <Input
                            value={replyUnmatchedSubject || replySubjectDefault}
                            onChange={(e) => setReplyUnmatchedSubject(e.target.value)}
                            placeholder={t("inbox.replySubjectPlaceholder", "Predmet")}
                            className="h-7 text-xs"
                            maxLength={200}
                          />
                          <textarea
                            value={replyUnmatchedContent}
                            onChange={(e) => setReplyUnmatchedContent(e.target.value)}
                            placeholder={t("inbox.replyContentPlaceholder", "Napíšte odpoveď...")}
                            className="w-full min-h-[52px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            maxLength={5000}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="w-full gap-1.5 h-7 text-xs"
                            disabled={replyToUnmatchedMutation.isPending || replyUnmatchedContent.trim().length < 1}
                            onClick={() => {
                              const trimmedContent = replyUnmatchedContent.trim();
                              if (!trimmedContent) return;
                              const finalSubject = (replyUnmatchedSubject || replySubjectDefault).trim();
                              const fingerprint = [toEmail, finalSubject, trimmedContent].join("|SEP|");
                              if (replyUnmatchedRequestRef.current?.fingerprint !== fingerprint) {
                                replyUnmatchedRequestRef.current = { fingerprint, requestId: crypto.randomUUID() };
                              }
                              replyToUnmatchedMutation.mutate({
                                communicationId: selectedUnmatched.id,
                                senderGroupKey: selectedUnmatched.senderGroupKey ?? undefined,
                                toEmail,
                                subject: finalSubject,
                                content: trimmedContent,
                                requestId: replyUnmatchedRequestRef.current!.requestId,
                              });
                            }}
                          >
                            {replyToUnmatchedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            {t("inbox.btnSendReply", "Odoslať odpoveď")}
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowReplyForm(true)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                        >
                          <Send className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 text-left truncate text-muted-foreground/70">{t("inbox.replyContentPlaceholder", "Napíšte odpoveď...")}</span>
                          <span className="font-mono text-[10px] shrink-0 text-muted-foreground/50">{toEmail}</span>
                        </button>
                      )}
                    </div>
                  );
                })() : null}
              </div>
            </div>
          ) : selectedClientId ? (
            /* Conversation timeline */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Conversation header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => setSelectedClientId(null)}
                    className="lg:hidden p-1 hover:bg-accent rounded"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-sm">
                      {selectedClientName}
                    </h3>
                    <Badge
                      variant={assignedTo ? "outline" : "secondary"}
                      className="mt-1"
                    >
                      {assignmentLabel}
                    </Badge>
                  </div>
                </div>
                {canMutateInbox ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAssignmentToggle}
                    disabled={assignMutation.isPending || !timeline?.length}
                    className="shrink-0 gap-1.5"
                  >
                    {assignedToMe ? (
                      <UserMinus className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                    {assignedToMe
                      ? t("inbox.btnUnassign", "Unassign")
                      : t("inbox.btnAssignToMe", "Assign to me")}
                  </Button>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timelineDisplayError || timelineDisplayMissing ? (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {timelineDisplayError?.message ??
                      t(
                        "inbox.errorLoadingConversation",
                        "Unable to load conversation messages. Please retry.",
                      )}
                  </div>
                ) : timelineDisplayLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("inbox.loadingMessages", "Loading messages...")}
                  </div>
                ) : timeline && timeline.length > 0 ? (
                  [...timeline].reverse().map((msg) => {
                    const effectiveMsgChannel = isWhatsAppMessage(msg) ? "whatsapp" : (msg.channel as Channel);
                    const Icon = channelIcons[effectiveMsgChannel] ?? MessageSquare;
                    const isOutbound = msg.direction === "outbound";
                    const statusLabel = communicationStatusLabel(msg);

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          isOutbound ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2",
                            isOutbound
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          {/* Direction + channel */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 mb-1",
                              isOutbound
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {isOutbound ? (
                              <ArrowRight className="h-3 w-3" />
                            ) : (
                              <ArrowLeft className="h-3 w-3" />
                            )}
                            <Icon className="h-3 w-3" />
                            <span className="text-[10px] uppercase font-medium">
                              {localizedChannelLabels[msg.channel as Channel]}
                            </span>
                          </div>

                          {msg.subject && (
                            <p
                              className={cn(
                                "text-xs font-semibold mb-0.5",
                                isOutbound
                                  ? "text-primary-foreground/90"
                                  : "text-foreground",
                              )}
                            >
                              {msg.subject}
                            </p>
                          )}

                          <MessageContentBubble
                            content={msg.content}
                            channel={msg.channel}
                            direction={msg.direction}
                            providerMessageId={msg.providerMessageId}
                            communicationId={msg.id}
                          />

                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              isOutbound
                                ? "text-primary-foreground/50"
                                : "text-muted-foreground",
                            )}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">
                              {relativeTime(msg.createdAt, inboxTimeZone)}
                            </span>
                            {statusLabel ? (
                              <span className="text-[10px] ml-1 capitalize">
                                {statusLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    className="border-0 bg-transparent py-8"
                    icon={MessageSquare}
                    title={t(
                      "inbox.emptyClientConversation",
                      "No messages with this client yet",
                    )} /* title="No messages with this client yet" */
                  />
                )}
              </div>

              {/* Compose area */}
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={composeChannel}
                    onChange={(e) =>
                      setComposeChannel(e.target.value as Channel)
                    }
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="sms">{t("inbox.optionSms", "SMS")}</option>
                    <option value="email">{t("inbox.optionEmail", "Email")}</option>
                    <option value="whatsapp">{t("inbox.optionWhatsapp", "WhatsApp")}</option>
                    <option value="portal">Portal</option>
                  </select>

                  {composeChannel === "email" && (
                    <Input
                      placeholder={t("inbox.subjectPlaceholder", "Subject")}
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      maxLength={COMMUNICATION_SUBJECT_MAX_LENGTH}
                      aria-invalid={composeSubjectInvalid || undefined}
                      className="flex-1"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    placeholder={t(
                      "inbox.typeMessagePlaceholder",
                      "Type a message...",
                    )}
                    value={composeContent}
                    onChange={(e) => setComposeContent(e.target.value)}
                    maxLength={composeContentMaxLength}
                    aria-invalid={composeContentInvalid || undefined}
                    rows={2}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!canSendCompose}
                    size="sm"
                    className="self-end gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t("inbox.btnSend", "Send")}
                  </Button>
                </div>
                {smsStatusUnavailable ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticeUnableCheckTexting",
                      "Unable to check texting setup. Retry from the inbox banner before sending SMS.",
                    )}
                  </p>
                ) : composeChannel === "portal" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticePortal",
                      "Portal messages are visible to the client in their portal message thread and replies return to this inbox.",
                    )}
                  </p>
                ) : composeChannel === "email" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticeEmail",
                      "Email is sent to the client’s registered address. Replies arrive in this inbox automatically.",
                    )}
                  </p>
                ) : composeChannel === "whatsapp" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticeWhatsapp",
                      "WhatsApp message sent via the clinic's connected number.",
                    )}
                  </p>
                ) : smsComposeBlocked && smsSummary ? (
                  <p className="text-xs text-muted-foreground">
                    {smsSummary.description}
                  </p>
                ) : smsComposeBlocked ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticeCheckingTexting",
                      "Checking texting setup before SMS can be sent.",
                    )}
                  </p>
                ) : composeChannel === "sms" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "inbox.noticeSmsServiceOnly",
                      "Service messages only: appointments, care updates, and replies. Marketing or promotional texting is not supported.",
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          ) : conversationGroups.length > 0 ? (
            /* Conversations exist but none is selected */
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                className="border-0 bg-transparent"
                icon={MessageSquare}
                title={t(
                  "inbox.emptySelectConversationTitle",
                  "Select a conversation",
                )}
                description={t(
                  "inbox.emptySelectConversationDesc",
                  "Pick a conversation from the list to read and reply.",
                )}
              />
            </div>
          ) : (
            /* Truly empty inbox */
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                className="border-0 bg-transparent"
                icon={InboxIcon}
                title={t("inbox.emptyNoMessagesYet", "No messages yet")}
                description={
                  canMutateInbox
                    ? t(
                        "inbox.emptyInboxActionSendFirst",
                        "Send your first message to a client.",
                      )
                    : t(
                        "inbox.emptyInboxViewer",
                        "No client communications to review yet.",
                      )
                }
                action={
                  canMutateInbox
                    ? {
                        label: t("inbox.btnNewMessage", "New message"), /* label: "New message" */
                        onClick: handleNewMessage,
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
