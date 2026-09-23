"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { VaccinationRecallRecipient } from "@/lib/vaccination-recalls";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import {
  formatDateTimeToDisplay,
  formatDateYmdToDisplay,
} from "@/lib/date-display";

const MAX_BATCH_SIZE = 100;

function getRecallBlockMessage(
  recipient: VaccinationRecallRecipient,
  t: (key: string, fallback: string) => string
): string {
  if (recipient.status === "eligible" && recipient.blockMessage) {
    return t("recalls.channelFallbackEmail", recipient.blockMessage);
  }
  if (!recipient.blockReason) {
    return recipient.blockMessage ?? "";
  }
  switch (recipient.blockReason) {
    case "no_deliverable_channel":
      return t(
        "recalls.blocked.noDeliverableChannel",
        "Add a deliverable email or an opted-in mobile number before sending."
      );
    case "email_suppressed":
      return t(
        "recalls.blocked.emailSuppressed",
        "The client's email is suppressed and no safe fallback is available."
      );
    case "sms_suppressed":
      return t(
        "recalls.blocked.smsSuppressed",
        "The client has opted out of text messages and has no deliverable email."
      );
    case "quiet_hours":
      return t(
        "recalls.blocked.quietHours",
        "Texting is in quiet hours and this client has no email fallback."
      );
    case "texting_unavailable":
      return t(
        "recalls.blocked.textingUnavailable",
        "No active clinic texting number is available and this client has no email fallback."
      );
    case "test_practice":
      return t(
        "recalls.blocked.testPractice",
        "Automated outreach is disabled for test practices."
      );
    case "seeded_demo_data":
      return t(
        "recalls.blocked.seededDemoData",
        "Seeded demo patients cannot receive real reminders."
      );
    case "reserved_contact":
      return t(
        "recalls.blocked.reservedContact",
        "Reserved fixture phone numbers cannot receive real reminders."
      );
    default:
      return recipient.blockMessage ?? "";
  }
}

function canOperateRecalls(role?: string | null): boolean {
  return (
    role === "admin" || role === "veterinarian" || role === "front_desk"
  );
}

/** Overdue vaccine due dates arrive as YYYY-MM-DD; render as dd.mm.yyyy. */
function clinicalDate(value: string): string {
  return formatDateYmdToDisplay(value) || value;
}

/** Dense-dashboard table tokens shared with /clients and /patients. */
const TH =
  "h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80";
const TD = "px-4 py-2.5 align-middle";
const BADGE = "px-2 py-0.5 text-[11px]";

export default function VaccinationRecallsPage() {
  const { t } = useI18n();
  const { confirm, dialogProps } = useConfirmDialog();
  const { data: session, status: sessionStatus } = useSession();
  const canOperate = canOperateRecalls(session?.user?.role);
  const utils = trpc.useUtils();
  const preview = trpc.notifications.getVaccinationRecallPreview.useQuery(
    undefined,
    { enabled: sessionStatus === "authenticated" && canOperate }
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const eligibleRecipients = useMemo(
    () =>
      preview.data?.recipients.filter(
        (recipient) => recipient.status === "eligible"
      ) ?? [],
    [preview.data]
  );
  const selectedEligibleIds = eligibleRecipients
    .map((recipient) => recipient.patientId)
    .filter((patientId) => selected.has(patientId))
    .slice(0, MAX_BATCH_SIZE);
  const allEligibleSelected =
    eligibleRecipients.length > 0 &&
    eligibleRecipients
      .slice(0, MAX_BATCH_SIZE)
      .every((recipient) => selected.has(recipient.patientId));

  const sendReminders = trpc.notifications.sendVaccinationReminders.useMutation({
    onSuccess: async (result) => {
      setSelected(new Set());
      await utils.notifications.getVaccinationRecallPreview.invalidate();
      const summary = [
        t("recalls.sentSummary", "{count} sent", { count: result.sent }),
        result.deduped
          ? t("recalls.dedupedSummary", "{count} already handled", {
              count: result.deduped,
            })
          : null,
        result.blocked
          ? t("recalls.blockedSummary", "{count} blocked", {
              count: result.blocked,
            })
          : null,
        result.failed
          ? t("recalls.failedSummary", "{count} failed", {
              count: result.failed,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (result.failed > 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (error) => toast.error(error.message),
  });

  const sendPatients = async (patientIds: string[]) => {
    if (patientIds.length === 0 || sendReminders.isPending) return;
    const count = patientIds.length;
    const confirmMessage =
      count === 1
        ? t(
            "recalls.confirmSendOne",
            "Send vaccination reminders to 1 patient now? Delivery will use each client's eligible channel and will be logged in Communications."
          )
        : t(
            "recalls.confirmSendMany",
            "Send vaccination reminders to {count} patients now? Delivery will use each client's eligible channel and will be logged in Communications.",
            { count }
          );
    // Accessible modal replacement for legacy window.confirm(...)
    const confirmed = await confirm({
      title: t("recalls.confirmSendTitle", "Send Reminders"),
      description: confirmMessage,
      confirmLabel: t("recalls.sendNow", "Send Now"),
    });
    if (!confirmed) {
      return;
    }
    sendReminders.mutate({ patientIds });
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("recalls.checkingAccess", "Checking recall access...")}
      </div>
    );
  }

  if (!canOperate) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("recalls.restrictedTitle", "Vaccination recalls are restricted")}
        description={t(
          "recalls.restrictedDesc",
          "Administrators, veterinarians, and front desk staff can review and send recalls."
        )}
      />
    );
  }

  if (preview.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("recalls.buildingPreview", "Building the recall preview...")}
      </div>
    );
  }

  if (preview.error || !preview.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("recalls.errorTitle", "Could not load vaccination recalls")}
        description={
          preview.error?.message ??
          t("recalls.noData", "The preview returned no data.")
        }
        action={{
          label: t("recalls.retry", "Retry"),
          onClick: () => preview.refetch(),
        }}
      />
    );
  }

  const data = preview.data;
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Syringe}
        title={t("recalls.title", "Vaccination recalls")}
        subtitle={t(
          "recalls.subtitle",
          "Review overdue patients before anything sends. Sample records, reserved contacts, opt-outs, suppressions, and repeat sends are blocked automatically."
        )}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => preview.refetch()}
            disabled={preview.isFetching || sendReminders.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 ${preview.isFetching ? "animate-spin" : ""}`}
            />
            {t("recalls.refreshPreview", "Refresh preview")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RecallMetric
          label={t("recalls.metricOverdue", "Overdue patients")}
          value={data.total}
          icon={Syringe}
        />
        <RecallMetric
          label={t("recalls.metricReady", "Ready to send")}
          value={data.eligible}
          icon={CheckCircle2}
        />
        <RecallMetric
          label={t("recalls.metricBlocked", "Blocked")}
          value={data.blocked}
          icon={AlertTriangle}
        />
        <RecallMetric
          label={t("recalls.metricAlreadyReminded", "Already reminded")}
          value={data.alreadySent}
          icon={Clock3}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>{t("recalls.previewTitle", "Recipient preview")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "recalls.previewDesc",
                "Select up to {max} eligible patients. Sending is always a deliberate action and requires confirmation. The same exact overdue-vaccine set can only be sent once; a newly overdue or newly recorded vaccine creates a new recall snapshot.",
                { max: MAX_BATCH_SIZE }
              )}
            </p>
          </div>
          <Button
            className="gap-2"
            disabled={selectedEligibleIds.length === 0 || sendReminders.isPending}
            onClick={() => sendPatients(selectedEligibleIds)}
          >
            {sendReminders.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("recalls.sendSelected", "Send selected ({count})", {
              count: selectedEligibleIds.length,
            })} {/* Send selected ({selectedEligibleIds.length}) */}
          </Button>
        </CardHeader>
        <CardContent>
          {data.recipients.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={t(
                "recalls.emptyTitle",
                "No overdue vaccination recalls"
              )}
              description={t(
                "recalls.emptyDesc",
                "Active patients with a latest vaccination due date in the past will appear here."
              )}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={`${TH} w-10`}>
                      <Checkbox
                        aria-label={t(
                          "recalls.selectAllAria",
                          "Select all eligible recall recipients"
                        )}
                        checked={allEligibleSelected}
                        disabled={eligibleRecipients.length === 0}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelected(
                              new Set(
                                eligibleRecipients
                                  .slice(0, MAX_BATCH_SIZE)
                                  .map((recipient) => recipient.patientId)
                              )
                            );
                          } else {
                            setSelected(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className={TH}>
                      {t("recalls.colPatientClient", "Patient / client")}
                    </th>
                    <th className={TH}>
                      {t("recalls.colOverdueVaccines", "Overdue vaccines")}
                    </th>
                    <th className={TH}>
                      {t("recalls.colDelivery", "Delivery")}
                    </th>
                    <th className={TH}>
                      {t("recalls.colEligibility", "Eligibility")}
                    </th>
                    <th className={`${TH} text-right`}>
                      {t("recalls.colAction", "Action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((recipient) => {
                    const eligible = recipient.status === "eligible";
                    return (
                      <tr
                        key={recipient.patientId}
                        className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <td className={`${TD} w-10`}>
                          <Checkbox
                            aria-label={t(
                              "recalls.selectPatientAria",
                              "Select {name}",
                              { name: recipient.patientName }
                            )}
                            checked={eligible && selected.has(recipient.patientId)}
                            disabled={!eligible || sendReminders.isPending}
                            onChange={(event) =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(recipient.patientId);
                                else next.delete(recipient.patientId);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className={`${TD} max-w-[220px]`}>
                          <div className="min-w-0">
                            <Link
                              href={`/patients/${recipient.patientId}`}
                              className="block truncate text-sm font-medium text-foreground hover:underline"
                              title={recipient.patientName}
                            >
                              {recipient.patientSpecies ? `${PATIENT_SPECIES_EMOJI[recipient.patientSpecies.toLowerCase() as keyof typeof PATIENT_SPECIES_EMOJI] ?? "🐾"} ` : ""}{recipient.patientName}
                            </Link>
                            <p
                              className="mt-0.5 truncate text-xs text-muted-foreground"
                              title={recipient.clientName}
                            >
                              {recipient.clientName}
                            </p>
                          </div>
                        </td>
                        <td className={TD}>
                          <ul className="space-y-0.5">
                            {recipient.vaccines.map((vaccine) => (
                              <li key={vaccine.recordId} className="flex min-w-0 items-baseline gap-1.5">
                                <span className="truncate text-xs font-medium text-foreground">
                                  {vaccine.vaccineName}
                                </span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                  {t("recalls.duePrefix", "due {date}", {
                                    date: clinicalDate(vaccine.nextDueDate),
                                  })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className={TD}>
                          {recipient.channel === "sms" ? (
                            <Badge variant="info" className={`${BADGE} gap-1`}>
                              <MessageSquare className="h-3 w-3" />{" "}
                              {t("recalls.channelSms", "SMS")}
                            </Badge>
                          ) : recipient.channel === "email" ? (
                            <Badge variant="secondary" className={`${BADGE} gap-1`}>
                              <Mail className="h-3 w-3" />{" "}
                              {t("recalls.channelEmail", "Email")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {eligible && recipient.blockMessage ? (
                            <p className="mt-1 max-w-xs text-xs leading-snug text-muted-foreground">
                              {getRecallBlockMessage(recipient, t)}
                            </p>
                          ) : null}
                        </td>
                        <td className={TD}>
                          {eligible ? (
                            <Badge variant="success" className={BADGE}>
                              {t("recalls.badgeReady", "Ready")}
                            </Badge>
                          ) : recipient.status === "already_sent" ? (
                            <div>
                              <Badge variant="outline" className={BADGE}>
                                {t("recalls.badgeAlreadyReminded", "Already reminded")}
                              </Badge>
                              {recipient.lastSentAt ? (
                                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                                  {formatDateTimeToDisplay(recipient.lastSentAt)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="max-w-xs">
                              <Badge variant="warning" className={BADGE}>
                                {t("recalls.badgeBlocked", "Blocked")}
                              </Badge>
                              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                                {getRecallBlockMessage(recipient, t)}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={!eligible || sendReminders.isPending}
                            onClick={() => sendPatients([recipient.patientId])}
                          >
                            {t("recalls.sendButton", "Send")}
                          </Button>
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
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

function RecallMetric({
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
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
