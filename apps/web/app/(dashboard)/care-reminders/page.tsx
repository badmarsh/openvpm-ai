"use client";

import { useEffect, useRef, useState } from "react";
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
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CareRemindersPage() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<ReminderStatusFilter>("open");
  const [due, setDue] = useState<ReminderDueFilter>("all");
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

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />{" "}
        {t("careReminders.loading", "Loading care reminders...")}
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <EmptyState
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
    );
  }

  const { counts, items, today } = query.data;
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("careReminders.title", "Care reminders")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t(
              "careReminders.subtitle",
              "Internal follow-up work for each patient. This queue never sends an email or text automatically; client outreach remains a separate, deliberate action with its own consent checks.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/recalls">
              {t("careReminders.navVaccinationRecalls", "Vaccination recalls")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/schedule">
              {t("careReminders.navAppointmentReminders", "Appointment reminders")}
            </Link>
          </Button>
          {manageable ? (
            <Button className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />{" "}
              {t("careReminders.addReminder", "Add reminder")}
            </Button>
          ) : null}
        </div>
      </div>

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
                  maxLength={500}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t("careReminders.metricOpen", "Open")}
          value={counts.open}
          icon={BellRing}
        />
        <Metric
          label={t("careReminders.metricDueOrOverdue", "Due or overdue")}
          value={counts.overdue}
          icon={Clock3}
        />
        <Metric
          label={t("careReminders.metricUpcoming", "Upcoming")}
          value={counts.upcoming}
          icon={CheckCircle2}
        />
        <Metric
          label={t("careReminders.metricDismissed", "Dismissed")}
          value={counts.dismissed}
          icon={Trash2}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>
              {t("careReminders.queueTitle", "Patient follow-up queue")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "careReminders.queueSubtitle",
                "Due dates use the practice day. Imported tasks retain source identity so retrying a migration cannot duplicate them.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={status === "open" ? "default" : "outline"}
              onClick={() => setStatus("open")}
            >
              {t("careReminders.tabOpen", "Open")}
            </Button>
            <Button
              size="sm"
              variant={status === "completed" ? "default" : "outline"}
              onClick={() => {
                setStatus("completed");
                setDue("all");
              }}
            >
              {t("careReminders.tabCompleted", "Completed")}
            </Button>
            <Button
              size="sm"
              variant={status === "dismissed" ? "default" : "outline"}
              onClick={() => {
                setStatus("dismissed");
                setDue("all");
              }}
            >
              {t("careReminders.tabDismissed", "Dismissed")}
            </Button>
            {status === "open" ? (
              <>
                {(["all", "overdue", "upcoming"] as const).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={due === value ? "secondary" : "ghost"}
                    onClick={() => setDue(value)}
                    className="capitalize"
                  >
                    {value === "all"
                      ? t("careReminders.filterAll", "All")
                      : value === "overdue"
                        ? t("careReminders.filterOverdue", "Overdue")
                        : t("careReminders.filterUpcoming", "Upcoming")}
                  </Button>
                ))}
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {status === "open" && manageable && items.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-3">
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
          {items.length === 0 ? (
            <EmptyState
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {status === "open" && manageable ? (
                      <th className="w-10 py-3 pr-3 font-medium">
                        <input
                          type="checkbox"
                          aria-label={t(
                            "careReminders.selectAllAria",
                            "Select all reminders",
                          )}
                          checked={
                            items.length > 0 &&
                            selectedIds.size ===
                              Math.min(items.length, MAX_DISMISS_SELECTION)
                          }
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked
                                ? new Set(
                                    items
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
                    <th className="py-3 pr-4 font-medium">
                      {t("careReminders.colDue", "Due")}
                    </th>
                    <th className="py-3 pr-4 font-medium">
                      {t("careReminders.colPatientClient", "Patient / client")}
                    </th>
                    <th className="py-3 pr-4 font-medium">
                      {t("careReminders.colReminder", "Reminder")}
                    </th>
                    <th className="py-3 pr-4 font-medium">
                      {t("careReminders.colSource", "Source")}
                    </th>
                    <th className="py-3 text-right font-medium">
                      {t("careReminders.colAction", "Action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const overdue =
                      item.status === "open" && item.dueDate <= today;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border align-top last:border-0"
                      >
                        {status === "open" && manageable ? (
                          <td className="py-4 pr-3">
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
                        <td className="py-4 pr-4">
                          <span
                            className={
                              overdue
                                ? "font-medium text-destructive"
                                : "font-medium"
                            }
                          >
                            {displayDate(item.dueDate)}
                          </span>
                          {overdue ? (
                            <p className="mt-1 text-xs text-destructive">
                              {t(
                                "careReminders.dueOrOverdueBadge",
                                "Due or overdue",
                              )}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-4 pr-4">
                          <Link
                            href={`/patients/${item.patientId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {item.patientName}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
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
                        </td>
                        <td className="py-4 pr-4">
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
                                  ? ` • ${item.dismissedAt.toLocaleString()}`
                                  : ""}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="py-4 pr-4">
                          <Badge
                            variant={item.imported ? "secondary" : "outline"}
                          >
                            {item.imported
                              ? t("careReminders.sourceImported", "Imported")
                              : "OpenVPM"}
                          </Badge>
                        </td>
                        <td className="py-4 text-right">
                          {manageable ? (
                            <div className="flex flex-col items-end gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
