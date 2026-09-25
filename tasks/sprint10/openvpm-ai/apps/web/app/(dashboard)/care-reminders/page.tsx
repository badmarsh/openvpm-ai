"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RotateCcw,
  SearchX,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  formatDateYmdToDisplay,
  formatDateTimeToDisplay,
} from "@/lib/date-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/common/loading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageToolbar,
  SearchField,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";

type ReminderStatusFilter = "open" | "completed" | "dismissed";
type ReminderDueFilter = "all" | "overdue" | "upcoming";
type OutreachChannel = "email" | "sms";
const MAX_DISMISS_SELECTION = 100;

type OutreachTarget = {
  reminderId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientSmsConsent: boolean;
  patientName: string;
  title: string;
  dueDate: string;
};

function canManage(role?: string | null): boolean {
  return ["admin", "veterinarian", "technician", "front_desk"].includes(
    role ?? "",
  );
}

function displayDate(value: string): string {
  return formatDateYmdToDisplay(value);
}

function relativeDay(dueDate: string, today: string, t: (key: string, fallback?: string, params?: Record<string, string | number>) => string): string {
  const due = new Date(dueDate + "T12:00:00Z");
  const now = new Date(today + "T12:00:00Z");
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return t("careReminders.relativeToday", "Today");
  if (diffDays === 1) return t("careReminders.relativeTomorrow", "Tomorrow");
  if (diffDays === -1) return t("careReminders.relativeYesterday", "Yesterday");
  if (diffDays > 1) return t("careReminders.relativeInDays", "in {count} d.", { count: diffDays });
  return t("careReminders.relativeOverdueDays", "{count} d. ago", { count: Math.abs(diffDays) });
}

export default function CareRemindersPage() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<ReminderStatusFilter>("open");
  const [due, setDue] = useState<ReminderDueFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    clientName: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissalReason, setDismissalReason] = useState("");
  const [outreachTarget, setOutreachTarget] = useState<OutreachTarget | null>(
    null,
  );
  const [outreachChannel, setOutreachChannel] =
    useState<OutreachChannel>("email");
  const outreachRequestId = useRef<string | null>(null);
  const query = trpc.careReminders.list.useQuery({ status, due, limit: 1000 });
  // KPI source: the full open queue. Same endpoint as above; shares the cache
  // with the default view, so no extra request happens there.
  const openQueueQuery = trpc.careReminders.list.useQuery({
    status: "open",
    due: "all",
    limit: 1000,
  });
  const patientSearch = trpc.patients.search.useQuery(
    { query: patientQuery, status: "active" },
    {
      enabled:
        showCreate && !selectedPatient && patientQuery.trim().length >= 2,
    },
  );
  const update = trpc.careReminders.setCompleted.useMutation({
    onSuccess: async (_, variables) => {
      await utils.careReminders.list.invalidate();
      toast.success(
        variables.completed
          ? t("careReminders.reminderCompleted", "Reminder completed")
          : t("careReminders.reminderReopened", "Reminder reopened"),
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const dismiss = trpc.careReminders.setDismissed.useMutation({
    onSuccess: async (_, variables) => {
      setSelectedIds(new Set());
      setShowDismiss(false);
      setDismissalReason("");
      await utils.careReminders.list.invalidate();
      toast.success(
        variables.dismissed
          ? variables.items.length === 1
            ? t(
                "careReminders.dismissedOne",
                "1 invalid reminder dismissed",
              )
            : t(
                "careReminders.dismissedMany",
                "{count} invalid reminders dismissed",
                { count: variables.items.length },
              )
          : t("careReminders.reminderRestored", "Reminder restored"),
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const sendOutreach = trpc.careReminders.sendOutreach.useMutation({
    onSuccess: (_, variables) => {
      outreachRequestId.current = null;
      setOutreachTarget(null);
      toast.success(
        variables.channel === "sms"
          ? t(
              "careReminders.sentText",
              "Care reminder sent by text and recorded in the inbox",
            )
          : t(
              "careReminders.sentEmail",
              "Care reminder sent by email and recorded in the inbox",
            ),
      );
      utils.communications.listConversations.invalidate();
    },
    onError: (error) => {
      if (
        error.data?.code === "BAD_REQUEST" ||
        error.data?.code === "PRECONDITION_FAILED" ||
        error.data?.code === "NOT_FOUND"
      ) {
        outreachRequestId.current = null;
      }
      toast.error(error.message);
    },
  });
  const manageable = canManage(session?.user?.role);
  const create = trpc.careReminders.create.useMutation({
    onSuccess: async () => {
      setShowCreate(false);
      setPatientQuery("");
      setSelectedPatient(null);
      setTitle("");
      setDueDate("");
      setNotes("");
      setStatus("open");
      setDue("all");
      await utils.careReminders.list.invalidate();
      toast.success(t("careReminders.reminderAdded", "Care reminder added"));
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    setSelectedIds(new Set());
    setShowDismiss(false);
    setDismissalReason("");
  }, [status, due]);

  const data = query.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = data?.counts;
  const today = data?.today ?? "";
  const openQueueItems = useMemo(
    () => openQueueQuery.data?.items ?? [],
    [openQueueQuery.data],
  );
  const openQueueToday = openQueueQuery.data?.today ?? today;
  const dueTodayCount = useMemo(
    () =>
      openQueueItems.filter(
        (item) => item.status === "open" && item.dueDate === openQueueToday,
      ).length,
    [openQueueItems, openQueueToday],
  );
  const overdueCount = useMemo(
    () =>
      openQueueItems.filter(
        (item) => item.status === "open" && openQueueToday > item.dueDate,
      ).length,
    [openQueueItems, openQueueToday],
  );
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        (item.patientName ?? "").toLowerCase().includes(needle) ||
        (item.clientName ?? "").toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle) ||
        (item.notes ?? "").toLowerCase().includes(needle),
    );
  }, [items, search]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const hasActiveFilters =
    search.trim().length > 0 || (status === "open" && due !== "all");
  const clearFilters = () => {
    setSearch("");
    setDue("all");
  };

  const canSendOutreach =
    Boolean(outreachTarget) &&
    (outreachChannel === "email"
      ? Boolean(outreachTarget?.clientEmail)
      : Boolean(
          outreachTarget?.clientPhone && outreachTarget.clientSmsConsent,
        )) &&
    !sendOutreach.isPending;
  const outreachSubject = outreachTarget
    ? t("careReminders.outreachSubject", "Care Reminder for {patientName}", {
        patientName: outreachTarget.patientName,
      })
    : "";
  const outreachContent = outreachTarget
    ? t(
        "careReminders.outreachContent",
        "Hello {clientName},\n\nThis is a reminder from our veterinary team about {patientName}: {title}. The reminder date is {dueDate}. Please contact us if you have questions or would like to schedule.",
        {
          clientName: outreachTarget.clientName,
          patientName: outreachTarget.patientName,
          title: outreachTarget.title,
          dueDate: displayDate(outreachTarget.dueDate),
        },
      )
    : "";

  function openOutreach(item: (typeof items)[number]) {
    const channel: OutreachChannel = item.clientEmail
      ? "email"
      : item.clientSmsConsent && item.clientPhone
        ? "sms"
        : "email";
    setOutreachTarget({
      reminderId: item.id,
      clientName: item.clientName,
      clientEmail: item.clientEmail,
      clientPhone: item.clientPhone,
      clientSmsConsent: item.clientSmsConsent,
      patientName: item.patientName,
      title: item.title,
      dueDate: item.dueDate,
    });
    setOutreachChannel(channel);
    outreachRequestId.current = null;
  }

  function dueStateBadge(item: (typeof items)[number]) {
    if (item.status === "completed") {
      return <Badge variant="success">{t("careReminders.tabCompleted", "Completed")}</Badge>;
    }
    if (item.status === "dismissed") {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t("careReminders.tabDismissed", "Dismissed")}
        </Badge>
      );
    }
    if (item.dueDate < today) {
      return (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          {t("careReminders.metricOverdue", "Overdue")}
        </Badge>
      );
    }
    if (item.dueDate === today) {
      return <Badge variant="warning">{t("careReminders.metricDueToday", "Due today")}</Badge>;
    }
    return null;
  }

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={BellRing}
        title={t("careReminders.title", "Care reminders")}
        subtitle={t(
          "careReminders.subtitle",
          "Internal follow-up work for each patient. This queue never sends an email or text automatically; client outreach remains a separate, deliberate action with its own consent checks.",
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/recalls">
                {t("careReminders.navVaccinationRecalls", "Vaccination recalls")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/schedule">
                {t("careReminders.navAppointmentReminders", "Appointment reminders")}
              </Link>
            </Button>
            {manageable ? (
              <Button className="gap-2" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />{" "}
                {t("careReminders.addReminder", "Add reminder")}
              </Button>
            ) : null}
          </div>
        }
      />

      {showCreate ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>
                {t("careReminders.formTitle", "Add an internal reminder")}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "careReminders.formSubtitle",
                  "Choose an active patient. Saving adds clinic work only and does not contact the client.",
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("careReminders.closeFormAria", "Close reminder form")}
              onClick={() => setShowCreate(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedPatient || !title.trim() || !dueDate) return;
                create.mutate({
                  patientId: selectedPatient.id,
                  title,
                  dueDate,
                  notes: notes || undefined,
                });
              }}
            >
              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="care-reminder-patient"
                >
                  {t("careReminders.labelPatient", "Patient")}
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedPatient.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPatient.clientName}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientQuery("");
                      }}
                    >
                      {t("careReminders.btnChange", "Change")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="care-reminder-patient"
                      value={patientQuery}
                      onChange={(event) => setPatientQuery(event.target.value)}
                      placeholder={t(
                        "careReminders.searchPatientsPlaceholder",
                        "Search active patients or owners",
                      )}
                      autoComplete="off"
                    />
                    {patientSearch.isFetching ? (
                      <p className="text-xs text-muted-foreground">
                        {t("careReminders.searching", "Searching...")}
                      </p>
                    ) : null}
                    {patientSearch.data?.length ? (
                      <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                        {patientSearch.data.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            className="block w-full border-b border-border px-3 py-2 text-left last:border-0 hover:bg-accent"
                            onClick={() =>
                              setSelectedPatient({
                                id: patient.id,
                                name: patient.name,
                                clientName:
                                  [
                                    patient.clientFirstName,
                                    patient.clientLastName,
                                  ]
                                    .filter(Boolean)
                                    .join(" ") ||
                                  t("careReminders.clientFallback", "Client"),
                              })
                            }
                          >
                            <span className="text-sm font-medium">
                              {patient.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {[patient.clientFirstName, patient.clientLastName]
                                .filter(Boolean)
                                .join(" ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="care-reminder-title"
                >
                  {t("careReminders.labelReminder", "Reminder")}
                </label>
                <Input
                  id="care-reminder-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="care-reminder-date"
                >
                  {t("careReminders.labelDueDate", "Due date")}
                </label>
                <Input
                  id="care-reminder-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="care-reminder-notes"
                >
                  {t("careReminders.labelNotesOptional", "Notes (optional)")}
                </label>
                <Textarea
                  id="care-reminder-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={4000}
                />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  {t("careReminders.btnCancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !selectedPatient ||
                    !title.trim() ||
                    !dueDate ||
                    create.isPending
                  }
                >
                  {create.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("careReminders.btnSaveReminder", "Save reminder")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showDismiss && selectedItems.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>
                {t(
                  "careReminders.dismissTitle",
                  "Dismiss invalid reminders",
                )}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "careReminders.dismissSubtitle",
                  "{count} selected. They will leave the active queue but remain in an auditable dismissed view.",
                  { count: selectedItems.length },
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(
                "careReminders.closeDismissAria",
                "Close dismissal form",
              )}
              onClick={() => setShowDismiss(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (dismissalReason.trim().length < 3) return;
                dismiss.mutate({
                  dismissed: true,
                  reason: dismissalReason,
                  items: selectedItems.map((item) => ({
                    id: item.id,
                    expectedUpdatedAt: item.updatedAt.toISOString(),
                  })),
                });
              }}
            >
              <label className="block space-y-2 text-sm font-medium">
                {t(
                  "careReminders.whyInvalidLabel",
                  "Why are these reminders invalid?",
                )}
                <Textarea
                  value={dismissalReason}
                  onChange={(event) => setDismissalReason(event.target.value)}
                  minLength={3}
                  maxLength={100}
                  required
                  placeholder={t(
                    "careReminders.whyInvalidPlaceholder",
                    "For example: duplicate reminders from an import",
                  )}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDismiss(false)}
                >
                  {t("careReminders.btnCancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    dismissalReason.trim().length < 3 || dismiss.isPending
                  }
                >
                  {dismiss.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {t("careReminders.btnDismissCount", "Dismiss {count}", {
                    count: selectedItems.length,
                  })}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {outreachTarget ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>
                {t("careReminders.contactClientTitle", "Contact {clientName}", {
                  clientName: outreachTarget.clientName,
                })}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "careReminders.contactClientDesc",
                  "Sending is deliberate and separate from completing the internal reminder. Email suppression, SMS consent, sender, and quiet-hour protections are applied before delivery.",
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(
                "careReminders.closeOutreachAria",
                "Close outreach composer",
              )}
              onClick={() => {
                outreachRequestId.current = null;
                setOutreachTarget(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSendOutreach) return;
                outreachRequestId.current ??= crypto.randomUUID();
                sendOutreach.mutate({
                  reminderId: outreachTarget.reminderId,
                  channel: outreachChannel,
                  requestId: outreachRequestId.current,
                });
              }}
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={outreachChannel === "email" ? "default" : "outline"}
                  disabled={!outreachTarget.clientEmail}
                  onClick={() => {
                    outreachRequestId.current = null;
                    setOutreachChannel("email");
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {t("careReminders.channelEmail", "Email")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={outreachChannel === "sms" ? "default" : "outline"}
                  disabled={
                    !outreachTarget.clientPhone ||
                    !outreachTarget.clientSmsConsent
                  }
                  onClick={() => {
                    outreachRequestId.current = null;
                    setOutreachChannel("sms");
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("careReminders.channelText", "Text")}
                </Button>
              </div>
              {!outreachTarget.clientEmail &&
              (!outreachTarget.clientPhone ||
                !outreachTarget.clientSmsConsent) ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {t(
                    "careReminders.noContactWarning",
                    "This client has no deliverable email and no SMS-consented phone number. Update the client record before sending outreach.",
                  )}
                </p>
              ) : null}
              {outreachChannel === "email" ? (
                <div className="space-y-2 text-sm font-medium">
                  <p>{t("careReminders.outreachSubjectLabel", "Subject")}</p>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-normal">
                    {outreachSubject}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 text-sm font-medium">
                <p>{t("careReminders.templatePreviewLabel", "Template preview")}</p>
                <div className="min-h-36 whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 font-normal">
                  {outreachContent}
                </div>
                <p className="text-xs font-normal text-muted-foreground">
                  {t(
                    "careReminders.outreachDisclaimer",
                    "Reminder wording is generated server-side and cannot be changed into free-form external email.",
                  )}
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSendOutreach}>
                  {sendOutreach.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {outreachChannel === "sms"
                    ? t("careReminders.sendText", "Send text")
                    : t("careReminders.sendEmail", "Send email")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Status tabs */}
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as ReminderStatusFilter);
          if (value !== "open") setDue("all");
        }}
      >
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="open" className={underlineTabsTriggerClass}>
            {t("careReminders.tabOpen", "Open")}
          </TabsTrigger>
          <TabsTrigger value="completed" className={underlineTabsTriggerClass}>
            {t("careReminders.tabCompleted", "Completed")}
          </TabsTrigger>
          <TabsTrigger value="dismissed" className={underlineTabsTriggerClass}>
            {t("careReminders.tabDismissed", "Dismissed")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Toolbar: search + due filter + count */}
      <PageToolbar>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t(
            "careReminders.searchPlaceholder",
            "Search by patient, owner, or reminder...",
          )}
        />
        {status === "open" ? (
          <select
            className={filterControlClass}
            aria-label={t(
              "careReminders.dueFilterAria",
              "Filter by due date",
            )}
            value={due}
            onChange={(event) =>
              setDue(event.target.value as ReminderDueFilter)
            }
          >
            <option value="all">{t("careReminders.filterAll", "All")}</option>
            <option value="overdue">
              {t("careReminders.filterOverdue", "Overdue")}
            </option>
            <option value="upcoming">
              {t("careReminders.filterUpcoming", "Upcoming")}
            </option>
          </select>
        ) : null}
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            {t("careReminders.clearFilters", "Clear filters")}
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {t("careReminders.resultCount", "{count} records", {
            count: filteredItems.length,
          })}
        </span>
      </PageToolbar>

      {/* KPI row */}
      {data ? (
        <KpiGrid className="sm:grid-cols-3">
          <KpiCard
            label={t("careReminders.metricOpen", "Open")}
            value={counts?.open ?? 0}
            icon={<BellRing className="h-4 w-4 text-primary/70" />}
          />
          <KpiCard
            label={t("careReminders.metricDueToday", "Due today")}
            value={dueTodayCount}
            icon={<Clock3 className="h-4 w-4 text-warning" />}
          />
          <KpiCard
            label={t("careReminders.metricOverdue", "Overdue")}
            value={
              <span
                className={
                  overdueCount > 0 ? "text-destructive" : undefined
                }
              >
                {overdueCount}
              </span>
            }
            icon={
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  overdueCount > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              />
            }
          />
        </KpiGrid>
      ) : null}

      {status === "open" && manageable && filteredItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-3">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size === 0
              ? t(
                  "careReminders.selectToDismissPrompt",
                  "Select up to 100 invalid reminders to dismiss them safely.",
                )
              : selectedIds.size === 1
                ? t("careReminders.selectedOne", "1 reminder selected")
                : t(
                    "careReminders.selectedMany",
                    "{count} reminders selected",
                    { count: selectedIds.size },
                  )}
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={selectedIds.size === 0}
            onClick={() => setShowDismiss(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("careReminders.btnDismissSelected", "Dismiss selected")}
          </Button>
        </div>
      ) : null}

      <DataTableFrame>
        {query.isLoading ? (
          <TableSkeleton
            rows={5}
            cols={6}
            className="rounded-none border-0 shadow-none"
          />
        ) : query.error || !data ? (
          <EmptyState
            className="rounded-none border-0"
            icon={AlertTriangle}
            title={t(
              "careReminders.errorTitle",
              "Could not load care reminders",
            )}
            description={
              query.error?.message ??
              t("careReminders.noData", "The reminder queue returned no data.")
            }
            action={{
              label: t("careReminders.retry", "Retry"),
              onClick: () => query.refetch(),
            }}
          />
        ) : filteredItems.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              className="rounded-none border-0"
              icon={SearchX}
              title={t(
                "careReminders.emptyFilteredTitle",
                "No records match the current filters",
              )}
              description={t(
                "careReminders.emptyFilteredDesc",
                "Adjust or clear the search and filters to see the rest of the queue.",
              )}
              action={{
                label: t("careReminders.clearFilters", "Clear filters"),
                onClick: clearFilters,
                icon: X,
              }}
            />
          ) : (
            <EmptyState
              className="rounded-none border-0"
              icon={
                status === "open"
                  ? BellRing
                  : status === "completed"
                    ? CheckCircle2
                    : Trash2
              }
              title={
                status === "open"
                  ? t(
                      "careReminders.emptyOpenTitle",
                      "No reminders in this view",
                    )
                  : status === "completed"
                    ? t(
                        "careReminders.emptyCompletedTitle",
                        "No completed reminders",
                      )
                    : t(
                        "careReminders.emptyDismissedTitle",
                        "No dismissed reminders",
                      )
              }
              description={
                status === "open"
                  ? t(
                      "careReminders.emptyOpenDesc",
                      "Try another due-date filter, or add a reminder from a patient record.",
                    )
                  : status === "completed"
                    ? t(
                        "careReminders.emptyCompletedDesc",
                        "Completed care reminders will remain available here for review.",
                      )
                    : t(
                        "careReminders.emptyDismissedDesc",
                        "Invalid reminders dismissed from the active queue will remain available here for audit and restoration.",
                      )
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {status === "open" && manageable ? (
                    <th className={cn(tableHeadClass, "w-10")}>
                      <input
                        type="checkbox"
                        aria-label={t(
                          "careReminders.selectAllAria",
                          "Select all reminders",
                        )}
                        checked={
                          filteredItems.length > 0 &&
                          selectedIds.size ===
                            Math.min(filteredItems.length, MAX_DISMISS_SELECTION)
                        }
                        onChange={(event) =>
                          setSelectedIds(
                            event.target.checked
                              ? new Set(
                                  filteredItems
                                    .slice(0, MAX_DISMISS_SELECTION)
                                    .map((item) => item.id),
                                )
                              : new Set(),
                          )
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                  ) : null}
                  <th className={tableHeadClass}>
                    {t("careReminders.colDue", "Due")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("careReminders.colPatientClient", "Patient / client")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("careReminders.colReminder", "Reminder")}
                  </th>
                  <th className={tableHeadClass}>
                    {t("careReminders.colSource", "Source")}
                  </th>
                  <th className={cn(tableHeadClass, "text-right")}>
                    {t("careReminders.colAction", "Action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const overdue =
                    item.status === "open" && item.dueDate < today;
                  return (
                    <tr
                      key={item.id}
                      className={cn(tableRowClass, "align-top")}
                    >
                      {status === "open" && manageable ? (
                        <td className={tableCellClass}>
                          <input
                            type="checkbox"
                            aria-label={t(
                              "careReminders.selectItemAria",
                              "Select {title} for {patientName}",
                              {
                                title: item.title,
                                patientName: item.patientName,
                              },
                            )}
                            checked={selectedIds.has(item.id)}
                            disabled={
                              !selectedIds.has(item.id) &&
                              selectedIds.size >= MAX_DISMISS_SELECTION
                            }
                            onChange={(event) => {
                              const next = new Set(selectedIds);
                              if (event.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              setSelectedIds(next);
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                        </td>
                      ) : null}
                      <td
                        className={cn(
                          tableCellClass,
                          "whitespace-nowrap align-top",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              overdue ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {displayDate(item.dueDate)}
                          </span>
                          {dueStateBadge(item)}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {relativeDay(item.dueDate, today, t)}
                        </p>
                      </td>
                      <td className={cn(tableCellClass, "align-top")}>
                        <div className="min-w-0">
                          <Link
                            href={`/patients/${item.patientId}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {item.patientName}
                          </Link>
                          <p className="mt-0.5 max-w-[14rem] truncate text-xs text-muted-foreground">
                            {item.clientName}
                          </p>
                          {item.patientStatus !== "active" ? (
                            <Badge
                              variant="outline"
                              className="mt-2 capitalize"
                            >
                              {item.patientStatus}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className={cn(tableCellClass, "align-top")}>
                        <p className="font-medium">{item.title}</p>
                        {item.notes ? (
                          <p className="mt-1 max-w-xl whitespace-pre-wrap text-xs text-muted-foreground">
                            {item.notes}
                          </p>
                        ) : null}
                        {item.status === "dismissed" &&
                        item.dismissalReason ? (
                          <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {t("careReminders.labelDismissed", "Dismissed:")}
                            </span>{" "}
                            {item.dismissalReason}
                            <span className="mt-1 block">
                              {item.dismissedByName ??
                                t(
                                  "careReminders.unknownStaffMember",
                                  "Unknown staff member",
                                )}
                              {item.dismissedAt
                                ? ` • ${formatDateTimeToDisplay(item.dismissedAt)}`
                                : ""}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className={cn(tableCellClass, "align-top")}>
                        <Badge
                          variant={item.imported ? "secondary" : "outline"}
                        >
                          {item.imported
                            ? t("careReminders.sourceImported", "Imported")
                            : "OpenVPM"}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          tableCellClass,
                          "text-right align-top",
                        )}
                      >
                        {manageable ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {item.status === "dismissed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={dismiss.isPending}
                                onClick={() =>
                                  dismiss.mutate({
                                    dismissed: false,
                                    items: [
                                      {
                                        id: item.id,
                                        expectedUpdatedAt:
                                          item.updatedAt.toISOString(),
                                      },
                                    ],
                                  })
                                }
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                {t("careReminders.btnRestore", "Restore")}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant={
                                  item.status === "open"
                                    ? "default"
                                    : "outline"
                                }
                                disabled={update.isPending}
                                onClick={() =>
                                  update.mutate({
                                    id: item.id,
                                    completed: item.status === "open",
                                    expectedUpdatedAt:
                                      item.updatedAt.toISOString(),
                                  })
                                }
                              >
                                {item.status === "open"
                                  ? t(
                                      "careReminders.btnComplete",
                                      "Complete",
                                    )
                                  : t("careReminders.btnReopen", "Reopen")}
                              </Button>
                            )}
                            {item.status === "open" &&
                            item.patientStatus === "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openOutreach(item)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                {t(
                                  "careReminders.btnContactClient",
                                  "Contact client",
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("careReminders.readOnly", "Read only")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataTableFrame>
    </div>
  );
}
