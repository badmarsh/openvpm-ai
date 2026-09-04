"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Package,
  Pill,
  Plus,
  Receipt,
  Stethoscope,
  Save,
  Scissors,
  Syringe,
  Trash2,
  UserRound,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/locale/format";
import {
  BILLING_INVOICE_MAX_ITEMS,
  isBillingInvoiceLineTotalValid,
  isBillingInvoiceSubtotalValid,
} from "@/lib/billing/policy";
import { centsToMoney, moneyToCents } from "@/lib/billing/invoice-balance";
import { tryCalculateInvoiceTaxTotals } from "@/lib/billing/invoice-tax";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  getVisitCompletionAction,
  requiresPrescriptionInventoryUnitReview,
} from "@/lib/encounters/visit-completion";
import {
  APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH,
  isAppointmentPatientSearchInputValid,
} from "@/lib/scheduling/appointment-policy";
import { ServicePicker } from "@/components/billing/service-picker";
import { CapturePhotos } from "@/components/records/capture-photos";
import { ConsentSign } from "@/components/records/consent-sign";
import { EncounterVitalsCard } from "@/components/records/encounter-vitals-card";
import { AmbulatorySoapCard } from "@/components/records/ambulatory-soap-card";
import { AmbulatoryVisitRecordsCard } from "@/components/records/ambulatory-visit-records-card";
import { RecentClinicalItems } from "@/components/records/recent-clinical-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import type { AppRouter } from "@/server/routers/_app";

const TreatmentPlanComposer = dynamic(
  () =>
    import("@/components/encounters/treatment-plan-composer").then(
      (module) => module.TreatmentPlanComposer,
    ),
  { ssr: false, loading: () => null },
);

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CloseoutQueryState = {
  data: RouterOutputs["encounters"]["getCloseout"] | undefined;
  error: { message: string } | null;
  isLoading: boolean;
};
type InvoiceQueryState = {
  data: RouterOutputs["billing"]["listInvoices"] | undefined;
  error: { message: string } | null;
  isLoading: boolean;
};

type ChargeItem = {
  key: string;
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
  taxable: boolean;
  sourcePrescriptionId?: string;
  sourceDispenseChargeId?: string;
};

type ClinicalDraftFields = {
  diagnosisSummary: string;
  dischargeInstructions: string;
  warningSigns: string;
  noInstructionsReason: string;
  prescriptionDisposition: "" | "prescribed" | "not_needed";
  followUpDisposition: "" | "none" | "needed" | "scheduled";
  followUpNotes: string;
  followUpAppointmentId: string;
  followUpDueDate: string;
  followUpAssignedTo: string;
  documentationExceptionReason: string;
};

function providerDisplayName(name: string | null): string {
  const normalized = name?.trim();
  if (!normalized) return "Unassigned provider";
  return /^(dr\.?|doctor)\s/i.test(normalized)
    ? normalized
    : `Dr. ${normalized}`;
}

function chargeItemsFingerprint(items: ChargeItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.description,
      item.quantity,
      item.unitPrice,
      item.itemType,
      item.itemId ?? null,
      item.taxable,
      item.sourcePrescriptionId ?? null,
      item.sourceDispenseChargeId ?? null,
    ]),
  );
}

function clinicalDraftFingerprint(fields: ClinicalDraftFields): string {
  return JSON.stringify([
    fields.diagnosisSummary,
    fields.dischargeInstructions,
    fields.warningSigns,
    fields.noInstructionsReason,
    fields.prescriptionDisposition,
    fields.followUpDisposition,
    fields.followUpNotes,
    fields.followUpAppointmentId,
    fields.followUpDueDate,
    fields.followUpAssignedTo,
    fields.documentationExceptionReason,
  ]);
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_exam: "In exam",
  checked_out: "Checked out",
  no_show: "No show",
  cancelled: "Cancelled",
};

function canManageVisit(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function canCreateSoap(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canRecordVitals(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canRecordVisitWork(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canRecordProcedure(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canManageBilling(role?: string | null): boolean {
  return role === "admin" || role === "front_desk";
}

function nextVisitAction(status: string): {
  label: string;
  status: "checked_in" | "in_exam";
} | null {
  if (status === "scheduled" || status === "confirmed") {
    return { label: "Check in", status: "checked_in" };
  }
  if (status === "checked_in") {
    return { label: "Start exam", status: "in_exam" };
  }
  return null;
}

function PatientAssignmentPanel({
  appointmentId,
  clientName,
}: {
  appointmentId: string;
  clientName: string;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const searchIsValid = isAppointmentPatientSearchInputValid(search);
  const canSearch = deferredSearch.length > 0 && searchIsValid;
  const patientSearch = trpc.patients.search.useQuery(
    { query: deferredSearch, status: "active" },
    { enabled: canSearch },
  );
  const attachPatient = trpc.appointments.attachPatient.useMutation({
    onSuccess: async () => {
      toast.success(t("encounters.patientPanel.attachedToast", "Patient attached to visit"));
      await Promise.all([
        utils.appointments.getById.invalidate({ id: appointmentId }),
        utils.appointments.list.invalidate(),
        utils.encounters.getCloseout.invalidate({ appointmentId }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <UserRound className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">{t("encounters.patientPanel.attachHeader", "Attach a patient before clinical care")}</p>
          <p className="mt-1 text-sm">
            {clientName
              ? t("encounters.patientPanel.attachBelongingTo", "Choose a patient belonging to {name}.", { name: clientName })
              : t("encounters.patientPanel.attachAutoMatch", "Choose the patient and OpenVPM will attach the matching client.")}{" "}
            {t("encounters.patientPanel.attachNotice", "The exam cannot start until both records are active and matched.")}
          </p>
        </div>
      </div>

      {selectedPatient ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-background/80 p-3 text-sm text-foreground dark:border-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{selectedPatient.name}</p>
              <p className="text-xs text-muted-foreground">
                {[selectedPatient.species, selectedPatient.breed]
                  .filter(Boolean)
                  .join(" · ") || t("encounters.patientPanel.detailsUnavailable", "Patient details unavailable")}
                {selectedPatient.clientFirstName
                  ? " · " +
                    selectedPatient.clientFirstName +
                    " " +
                    (selectedPatient.clientLastName ?? "")
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={attachPatient.isPending}
                onClick={() => setSelectedPatient(null)}
              >
                {t("encounters.patientPanel.change", "Change")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={attachPatient.isPending}
                onClick={() =>
                  attachPatient.mutate({
                    id: appointmentId,
                    patientId: selectedPatient.id,
                  })
                }
              >
                {attachPatient.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("encounters.patientPanel.attachButton", "Attach patient")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Input
            value={search}
            maxLength={APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH}
            aria-label={t("encounters.patientPanel.searchAria", "Search patient to attach")}
            aria-invalid={!searchIsValid}
            placeholder={t("encounters.patientPanel.searchPlaceholder", "Search patient, owner, or breed")}
            onChange={(event) => setSearch(event.target.value)}
          />
          {!searchIsValid ? (
            <p className="mt-2 text-xs text-destructive">
              {t("encounters.patientPanel.searchTooLong", "Patient search is too long.")}
            </p>
          ) : patientSearch.error ? (
            <p className="mt-2 text-xs text-destructive">
              {t("encounters.patientPanel.searchFailed", "Patient search failed. Retry before attaching a record.")}
            </p>
          ) : canSearch && patientSearch.isLoading ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("encounters.patientPanel.searchingPatients", "Searching patients...")}
            </p>
          ) : canSearch && patientSearch.data?.length === 0 ? (
            <p className="mt-2 text-xs">
              {t("encounters.patientPanel.noMatchedPatient", "No active patient matched.")}{" "}
              <Link className="font-medium underline" href="/patients/new">
                {t("encounters.patientPanel.createPatientRecord", "Create the patient record")}
              </Link>{" "}
              {t("encounters.patientPanel.returnToVisit", "and then return to this visit.")}
            </p>
          ) : patientSearch.data?.length ? (
            <div className="mt-2 overflow-hidden rounded-md border border-amber-300 bg-background text-foreground dark:border-amber-800">
              {patientSearch.data.map((patient) => (
                <button
                  type="button"
                  key={patient.id}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                  onClick={() => setSelectedPatient(patient)}
                >
                  <span>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[patient.species, patient.breed]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[patient.clientFirstName, patient.clientLastName]
                      .filter(Boolean)
                      .join(" ") || t("encounters.patientPanel.noActiveClient", "No active client")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatAppointmentTime(
  value: Date | string,
  timeZone?: string | null,
): string {
  try {
    return new Date(value).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone ?? undefined,
    });
  } catch {
    return new Date(value).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function addDateInputDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function defaultPayLaterDueDate(timeZone?: string | null): string {
  const today = formatDateInputForTimeZone(new Date(), timeZone);
  return addDateInputDays(today, 30);
}

function formatClinicDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    },
  );
}

function EncounterLoading() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("encounters.workspace.loading", "Loading visit workspace...")}
    </div>
  );
}

export default function EncounterWorkspacePage() {
  const { t } = useI18n();
  const params = useParams<{ appointmentId: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const appointmentId = params.appointmentId;
  const utils = trpc.useUtils();
  const [ambulatorySoapPlan, setAmbulatorySoapPlan] = useState("");

  const appointmentQuery = trpc.appointments.getById.useQuery(
    { id: appointmentId },
    { enabled: Boolean(appointmentId) },
  );
  const appointment = appointmentQuery.data;
  const patientQuery = trpc.patients.getById.useQuery(
    { id: appointment?.patientId ?? "" },
    { enabled: Boolean(appointment?.patientId) },
  );
  const taxConfigQuery = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const invoicesQuery = trpc.billing.listInvoices.useQuery(
    { appointmentId, limit: 25, offset: 0 },
    { enabled: Boolean(appointmentId) },
  );
  const closeoutQuery = trpc.encounters.getCloseout.useQuery(
    { appointmentId },
    { enabled: Boolean(appointmentId) },
  );
  const recordsSettingsQuery = trpc.records.settings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("encounters.workspace.statusUpdatedToast", "Visit status updated"));
      utils.appointments.getById.invalidate({ id: appointmentId });
      utils.appointments.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (sessionStatus === "loading" || appointmentQuery.isLoading) {
    return <EncounterLoading />;
  }

  if (appointmentQuery.error || !appointment) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("encounters.workspace.loadErrorTitle", "Unable to load this visit")}
        description={
          appointmentQuery.error?.message ??
          t("encounters.workspace.loadErrorDescription", "The appointment may have been removed or belongs to another clinic.")
        }
        action={{
          label: t("encounters.workspace.backToSchedule", "Back to schedule"),
          onClick: () => window.location.assign("/schedule"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  const role = session?.user?.role;
  const patient = patientQuery.data;
  const ambulatoryProfile = recordsSettingsQuery.data?.ambulatoryWorkspace;
  const isAmbulatoryWorkspace =
    appointment.origin === "field" && ambulatoryProfile?.enabled === true;
  const ambulatorySettingsReady =
    appointment.origin !== "field" ||
    (Boolean(ambulatoryProfile) && !recordsSettingsQuery.error);
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ");
  const nextAction = nextVisitAction(appointment.status);
  const visitClinicalStateReady =
    Boolean(closeoutQuery.data) &&
    !closeoutQuery.error &&
    ambulatorySettingsReady;
  const visitOpenForClinicalEntry =
    visitClinicalStateReady &&
    appointment.status === "in_exam" &&
    closeoutQuery.data?.closeout?.status !== "clinical_finalized" &&
    closeoutQuery.data?.closeout?.status !== "completed";
  const missingClinicalTarget = !appointment.patientId || !appointment.clientId;
  const activeInvoices =
    invoicesQuery.data?.items.filter(
      (invoice) => !invoice.isEstimate && invoice.status !== "void",
    ) ?? [];
  const visitInvoices = invoicesQuery.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/schedule">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("encounters.workspace.backToSchedule", "Back to schedule")}
          </Link>
        </Button>
      </div>

      {appointment.patientId ? (
        <RecentClinicalItems
          patientId={appointment.patientId}
          appointmentId={appointmentId}
          enabled={isAmbulatoryWorkspace}
        />
      ) : null}

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold">
                {appointment.patientName ?? t("encounters.workspace.unassignedVisit", "Unassigned visit")}
              </h1>
              <Badge variant="outline">
                {appointment.status === "scheduled"
                  ? t("encounters.status.scheduled", "Scheduled")
                  : appointment.status === "confirmed"
                    ? t("encounters.status.confirmed", "Confirmed")
                    : appointment.status === "checked_in"
                      ? t("encounters.status.checkedIn", "Checked in")
                      : appointment.status === "in_exam"
                        ? t("encounters.status.inExam", "In exam")
                        : appointment.status === "checked_out"
                          ? t("encounters.status.checkedOut", "Checked out")
                          : appointment.status === "no_show"
                            ? t("encounters.status.noShow", "No show")
                            : appointment.status === "cancelled"
                              ? t("encounters.status.cancelled", "Cancelled")
                              : appointment.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.origin === "field"
                ? t("encounters.workspace.fieldVisit", "Field visit")
                : (appointment.typeName ?? t("encounters.workspace.appointmentType", "Appointment"))}{" "}
              · {clientName || t("encounters.workspace.noClient", "No client")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                {formatAppointmentTime(
                  appointment.startTime,
                  taxConfigQuery.data?.timezone,
                )}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {appointment.doctorName
                  ? providerDisplayName(appointment.doctorName)
                  : t("encounters.workspace.unassignedProvider", "Unassigned provider")}
              </span>
              {appointment.locationName || appointment.roomName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {[appointment.locationName, appointment.roomName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {nextAction && canManageVisit(role) ? (
          <Button
            disabled={
              updateStatus.isPending ||
              (nextAction.status === "in_exam" && missingClinicalTarget)
            }
            title={
              nextAction.status === "in_exam" && missingClinicalTarget
                ? t("encounters.workspace.attachBeforeExamTooltip", "Attach a patient before starting the exam.")
                : undefined
            }
            onClick={() =>
              updateStatus.mutate({
                id: appointmentId,
                status: nextAction.status,
              })
            }
          >
            {updateStatus.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {nextAction.status === "checked_in"
              ? t("encounters.workspace.actionCheckIn", "Check in")
              : nextAction.status === "in_exam"
                ? t("encounters.workspace.actionStartExam", "Start exam")
                : nextAction.label}
          </Button>
        ) : appointment.status === "in_exam" && canManageVisit(role) ? (
          <Button
            onClick={() => {
              const closeout = document.getElementById("visit-closeout");
              closeout?.scrollIntoView({ behavior: "smooth", block: "start" });
              closeout?.focus({ preventScroll: true });
            }}
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            {t("encounters.workspace.reviewCloseout", "Review closeout")}
          </Button>
        ) : null}
      </header>

      <VisitCompletionGuide
        appointmentId={appointmentId}
        appointmentStatus={appointment.status}
        patientId={appointment.patientId}
        role={role}
        closeoutQuery={closeoutQuery}
        invoicesQuery={invoicesQuery}
        hasActiveInvoice={activeInvoices.length > 0}
      />

      {appointment.notes ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">{t("encounters.workspace.visitNoteLabel", "Visit note:")}</span> {appointment.notes}
        </div>
      ) : null}

      {appointment.origin === "field" &&
      (recordsSettingsQuery.error || !ambulatoryProfile) ? (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {t("encounters.workspace.ambulatorySettingsLock", "Ambulatory settings could not be verified. Clinical writes are locked until the practice profile reloads.")}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="flex flex-col gap-6">
          <Card id="clinical-work" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>{t("encounters.workspace.clinicalWorkTitle", "Clinical work")}</CardTitle>
              <CardDescription>
                {t("encounters.workspace.clinicalWorkDesc", "Document and capture visit work without losing the appointment.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!appointment.patientId ? (
                canManageVisit(role) ? (
                  <PatientAssignmentPanel
                    appointmentId={appointmentId}
                    clientName={clientName}
                  />
                ) : (
                  <EmptyState
                    icon={UserRound}
                    title={t("encounters.workspace.patientAssignmentRequiredTitle", "Patient assignment required")}
                    description={t("encounters.workspace.patientAssignmentRequiredDesc", "A teammate with visit access must attach the active patient and matching client before clinical care begins.")}
                    className="p-8"
                  />
                )
              ) : patientQuery.error ||
                (!patientQuery.isLoading && !patient) ? (
                <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                  {t("encounters.workspace.loadChartError", "Unable to load the patient chart. Refresh before documenting.")}
                </div>
              ) : patientQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("encounters.workspace.loadingPatientContext", "Loading patient context...")}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{patient?.name}</p>
                        <p className="text-sm capitalize text-muted-foreground">
                          {[patient?.species, patient?.breed]
                            .filter(Boolean)
                            .join(" · ") || t("encounters.patientPanel.detailsUnavailable", "Patient details unavailable")}
                        </p>
                      </div>
                      {!patient?.allergies.length ? (
                        <Badge variant="secondary">{t("encounters.workspace.noRecordedAllergies", "No recorded allergies")}</Badge>
                      ) : null}
                    </div>
                    {patient?.allergies.length ? (
                      <div
                        className="mt-3 grid gap-2"
                        role="alert"
                        aria-label={t("encounters.workspace.allergyWarningsAria", "Current allergy warnings")}
                      >
                        {patient.allergies.map((allergy) => (
                          <div
                            key={allergy.id}
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-destructive">
                                {allergy.allergen}
                              </span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                                {allergy.severity}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-foreground">
                              {t("encounters.workspace.reactionLabel", "Reaction: {reaction}", { reaction: allergy.reaction || t("records.common.notDocumented", "Not documented") })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canCreateSoap(role) &&
                    !isAmbulatoryWorkspace &&
                    closeoutQuery.data?.linkedSoapCount === 0 &&
                    !closeoutQuery.data?.soapDraft &&
                    closeoutQuery.data?.missingSoapReplacement ? (
                      <Button size="sm" asChild>
                        <Link
                          href={`/records/replace-soap/${appointment.patientId}?sourceNoteId=${closeoutQuery.data.missingSoapReplacement.sourceNoteId}&return=patient`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {t("encounters.workspace.createMissingSoapReplacement", "Create missing SOAP replacement")}
                        </Link>
                      </Button>
                    ) : null}
                    {canCreateSoap(role) &&
                    !isAmbulatoryWorkspace &&
                    appointment.status === "in_exam" &&
                    closeoutQuery.data?.linkedSoapCount === 0 &&
                    !closeoutQuery.data?.missingSoapReplacement &&
                    closeoutQuery.data?.closeout?.status !==
                      "clinical_finalized" &&
                    closeoutQuery.data?.closeout?.status !== "completed" ? (
                      <Button size="sm" asChild>
                        <a
                          href={`/records/new-soap/${appointment.patientId}?appointmentId=${appointmentId}`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {closeoutQuery.data?.soapDraft
                            ? t("encounters.workspace.resumeSoapDraft", "Resume SOAP draft")
                            : t("encounters.workspace.writeSoapNote", "Write SOAP note")}
                        </a>
                      </Button>
                    ) : null}
                    {canCreateSoap(role) &&
                    !isAmbulatoryWorkspace &&
                    visitOpenForClinicalEntry ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=prescriptions&new=1`}
                        >
                          <Pill className="mr-2 h-4 w-4" />
                          {t("encounters.workspace.prescribe", "Prescribe")}
                        </Link>
                      </Button>
                    ) : null}
                    {canRecordVisitWork(role) && visitOpenForClinicalEntry ? (
                      <>
                        {!isAmbulatoryWorkspace ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=vaccinations&new=1`}
                            >
                              <Syringe className="mr-2 h-4 w-4" />
                              {t("encounters.workspace.vaccination", "Vaccination")}
                            </Link>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=labResults&new=1`}
                          >
                            <FlaskConical className="mr-2 h-4 w-4" />
                            {t("encounters.workspace.labResult", "Lab result")}
                          </Link>
                        </Button>
                      </>
                    ) : null}
                    {canRecordProcedure(role) && visitOpenForClinicalEntry ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=procedures&new=1`}
                        >
                          <Scissors className="mr-2 h-4 w-4" />
                          {t("encounters.workspace.procedure", "Procedure")}
                        </Link>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patients/${appointment.patientId}`}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t("encounters.workspace.openPatientChart", "Open patient chart")}
                      </Link>
                    </Button>
                    {canManageVisit(role) ? (
                      <>
                        <CapturePhotos
                          patientId={appointment.patientId}
                          appointmentId={appointmentId}
                        />
                        <ConsentSign
                          patientId={appointment.patientId}
                          appointmentId={appointmentId}
                        />
                      </>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("encounters.workspace.linkedActionsNotice", "Use these visit actions so SOAP notes, prescriptions, vaccinations, lab results, procedures, photos, and signatures stay linked to this appointment and its charge reconciliation.")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isAmbulatoryWorkspace && appointment.patientId ? (
            <AmbulatorySoapCard
              patientId={appointment.patientId}
              appointmentId={appointmentId}
              canWrite={canCreateSoap(role)}
              visitOpen={visitOpenForClinicalEntry}
              linkedSoapCount={closeoutQuery.data?.linkedSoapCount ?? 0}
              onPlanChange={setAmbulatorySoapPlan}
            />
          ) : null}

          {appointment.patientId ? (
            <EncounterVitalsCard
              patientId={appointment.patientId}
              appointmentId={appointment.id}
              canRecord={visitOpenForClinicalEntry && canRecordVitals(role)}
              canCorrect={canCreateSoap(role)}
              visitStateReady={visitClinicalStateReady}
              visitOpen={visitOpenForClinicalEntry}
              timeZone={taxConfigQuery.data?.timezone}
              measurementSystem={
                isAmbulatoryWorkspace
                  ? ambulatoryProfile?.measurementSystem
                  : "metric"
              }
              bodyConditionScale={
                isAmbulatoryWorkspace
                  ? ambulatoryProfile?.bodyConditionScale
                  : 9
              }
            />
          ) : null}

          {isAmbulatoryWorkspace && appointment.patientId ? (
            <AmbulatoryVisitRecordsCard
              patientId={appointment.patientId}
              appointmentId={appointmentId}
              role={role}
              visitOpen={visitOpenForClinicalEntry}
              timeZone={taxConfigQuery.data?.timezone}
            />
          ) : null}

          {isAmbulatoryWorkspace && appointment.patientId ? (
            <VisitCloseout
              appointment={appointment}
              appointmentId={appointmentId}
              role={role}
              closeoutQuery={closeoutQuery}
              invoicesQuery={invoicesQuery}
              compact={ambulatoryProfile?.compactCloseout === true}
              soapPlan={ambulatorySoapPlan}
            />
          ) : null}

          {!isAmbulatoryWorkspace &&
          canRecordVitals(role) &&
          appointment.patientId &&
          appointment.clientId ? (
            <TreatmentPlanComposer
              appointmentId={appointment.id}
              clientId={appointment.clientId}
              patientId={appointment.patientId}
              patientName={appointment.patientName ?? t("records.common.patient", "Patient")}
            />
          ) : null}

          {!isAmbulatoryWorkspace ? (
            <VisitCloseout
              appointment={appointment}
              appointmentId={appointmentId}
              role={role}
              closeoutQuery={closeoutQuery}
              invoicesQuery={invoicesQuery}
            />
          ) : null}

          <EncounterInvoices
            appointmentId={appointmentId}
            invoicesQuery={invoicesQuery}
            visitInvoices={visitInvoices}
            canManage={
              canManageBilling(role) &&
              closeoutQuery.data?.closeout?.status !== "completed"
            }
          />

          <VisitWorkReconciliation
            appointmentId={appointmentId}
            canManage={canManageVisit(role) && appointment.status === "in_exam"}
            canCorrect={
              appointment.status === "in_exam" &&
              (role === "admin" ||
                role === "veterinarian" ||
                role === "front_desk")
            }
            canVoid={role === "admin" || role === "veterinarian"}
          />
        </div>

        <div id="charge-capture" className="scroll-mt-4">
          <ChargeCapture
            appointmentId={appointmentId}
            clientId={appointment.clientId}
            patientId={appointment.patientId}
            canManage={
              canManageBilling(role) &&
              appointment.status === "in_exam" &&
              closeoutQuery.data?.closeout?.status !== "completed"
            }
            activeInvoice={
              activeInvoices[0]
                ? {
                    id: activeInvoices[0].id,
                    status: activeInvoices[0].status,
                  }
                : null
            }
            invoiceStateReady={
              Boolean(invoicesQuery.data) && !invoicesQuery.error
            }
            invoiceStateLoading={invoicesQuery.isLoading}
            linkedPrescriptions={closeoutQuery.data?.medications ?? []}
          />
        </div>
      </div>
    </div>
  );
}

function VisitCompletionGuide({
  appointmentId,
  appointmentStatus,
  patientId,
  role,
  closeoutQuery,
  invoicesQuery,
  hasActiveInvoice,
}: {
  appointmentId: string;
  appointmentStatus: string;
  patientId: string | null;
  role?: string | null;
  closeoutQuery: CloseoutQueryState;
  invoicesQuery: InvoiceQueryState;
  hasActiveInvoice: boolean;
}) {
  const { t } = useI18n();
  const reconciliation = trpc.encounters.getVisitReconciliation.useQuery(
    { appointmentId },
    { enabled: Boolean(appointmentId && patientId) },
  );
  const closeoutStatus = closeoutQuery.data?.closeout?.status;
  const completed = closeoutStatus === "completed";
  const clinicalRecordComplete =
    (closeoutQuery.data?.linkedSoapCount ?? 0) > 0 ||
    closeoutStatus === "clinical_finalized" ||
    completed;
  const billingComplete =
    hasActiveInvoice ||
    (completed &&
      closeoutQuery.data?.closeout?.chargeDisposition === "no_charge");
  const reconciliationComplete =
    Boolean(reconciliation.data) && reconciliation.data?.unresolvedCount === 0;
  const handoffComplete = closeoutStatus === "clinical_finalized" || completed;
  const stateReady =
    Boolean(closeoutQuery.data) &&
    !closeoutQuery.error &&
    Boolean(invoicesQuery.data) &&
    !invoicesQuery.error &&
    Boolean(reconciliation.data) &&
    !reconciliation.error;
  const action = getVisitCompletionAction({
    appointmentStatus,
    hasPatient: Boolean(patientId),
    closeoutStatus,
    stateReady,
    linkedSoapCount: closeoutQuery.data?.linkedSoapCount,
    hasActiveInvoice,
    unresolvedWorkCount: reconciliation.data?.unresolvedCount,
    canCreateSoap: canCreateSoap(role),
    canManageBilling: canManageBilling(role),
    canManageVisit: canManageVisit(role),
  });
  const steps = [
    { label: t("encounters.completion.stepClinicalRecord", "Clinical record"), complete: clinicalRecordComplete },
    { label: t("encounters.completion.stepVisitCharges", "Visit charges"), complete: billingComplete },
    { label: t("encounters.completion.stepReconcileWork", "Reconcile work"), complete: reconciliationComplete },
    { label: t("encounters.completion.stepOwnerHandoff", "Owner handoff"), complete: handoffComplete },
    { label: t("encounters.completion.stepCheckout", "Checkout"), complete: completed },
  ];
  const actionHref =
    action.target === "patient"
      ? "#clinical-work"
      : action.target === "soap" && patientId
        ? `/records/new-soap/${patientId}?appointmentId=${appointmentId}`
        : action.target === "charge_capture"
          ? "#charge-capture"
          : action.target === "reconciliation"
            ? "#visit-work-reconciliation"
            : action.target === "closeout"
              ? "#visit-closeout"
              : action.target === "complete"
                ? "/schedule"
                : null;
  const actionLabel =
    action.target === "patient"
      ? t("encounters.completion.actionAttachPatient", "Attach patient")
      : action.target === "soap"
        ? t("encounters.completion.actionWriteSoap", "Write SOAP note")
        : action.target === "charge_capture"
          ? t("encounters.completion.actionCaptureCharges", "Capture charges")
          : action.target === "reconciliation"
            ? t("encounters.completion.actionReconcileWork", "Reconcile work")
            : action.target === "closeout"
              ? handoffComplete
                ? t("encounters.completion.actionCompleteCheckout", "Complete checkout")
                : t("encounters.completion.actionFinishOwnerHandoff", "Finish owner handoff")
              : action.target === "complete"
                ? t("encounters.completion.actionBackToSchedule", "Back to schedule")
                : null;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("encounters.completion.finishVisitBadge", "Finish this visit")}
            </p>
            <CardTitle className="mt-1">{action.title}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {action.description}
            </CardDescription>
          </div>
          {actionHref && actionLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <a href={actionHref}>
                  {actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              {action.target === "charge_capture" ? (
                <Button variant="ghost" asChild>
                  <a href="#visit-closeout">{t("encounters.completion.noChargeContinueHandoff", "No charge? Continue handoff")}</a>
                </Button>
              ) : null}
            </div>
          ) : action.target === "loading" ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("encounters.completion.checkingVisit", "Checking visit")}
            </div>
          ) : null}
        </div>
        {action.target === "soap" ? (
          <p className="text-xs text-muted-foreground">
            {t("encounters.completion.exemptVisitHint", "Truly exempt visit? Use the documented SOAP exception in Visit closeout instead.")}
          </p>
        ) : action.target === "charge_capture" ? (
          <p className="text-xs text-muted-foreground">
            {t("encounters.completion.chargeCaptureHint", "OpenVPM will not bill a suggestion automatically. A teammate must add and save each charge, or document a no-charge disposition at checkout.")}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol
          className="grid gap-2 sm:grid-cols-5"
          aria-label={t("encounters.completion.progressAria", "Visit completion progress")}
        >
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs"
            >
              <span
                className={
                  step.complete
                    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
                }
              >
                {step.complete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className={
                  step.complete ? "font-medium" : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function splitOwnerInstructions(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function VisitCloseout({
  appointment,
  appointmentId,
  role,
  closeoutQuery,
  invoicesQuery,
  compact = false,
  soapPlan = "",
}: {
  appointment: {
    status: string;
    patientId: string | null;
    patientName: string | null;
    patientSpecies: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
    doctorName: string | null;
    startTime: Date | string;
    typeRequiresDoctor: number | null;
  };
  appointmentId: string;
  role?: string | null;
  closeoutQuery: CloseoutQueryState;
  invoicesQuery: InvoiceQueryState;
  compact?: boolean;
  soapPlan?: string;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const isOnline = useOnlineStatus();
  const [compactExpanded, setCompactExpanded] = useState(!compact);
  const data = closeoutQuery.data;
  const closeout = data?.closeout ?? null;
  const activeInvoice = data?.invoices[0] ?? null;
  const hydratedRevision = useRef<string | null>(null);
  const hydratedInvoice = useRef<string | null>(null);
  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [dischargeInstructions, setDischargeInstructions] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [noInstructionsReason, setNoInstructionsReason] = useState("");
  const [prescriptionDisposition, setPrescriptionDisposition] = useState<
    "" | "prescribed" | "not_needed"
  >("");
  const [followUpDisposition, setFollowUpDisposition] = useState<
    "" | "none" | "needed" | "scheduled"
  >("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpAppointmentId, setFollowUpAppointmentId] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState("");
  const [documentationExceptionReason, setDocumentationExceptionReason] =
    useState("");
  const [chargeDisposition, setChargeDisposition] = useState<
    "" | "paid" | "accounts_receivable" | "no_charge"
  >("");
  const [noChargeReason, setNoChargeReason] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [handoffMethod, setHandoffMethod] = useState<
    "" | "print" | "verbal" | "declined"
  >("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [followUpResolution, setFollowUpResolution] = useState<
    "" | "scheduled" | "completed" | "not_needed"
  >("");
  const [resolutionAppointmentId, setResolutionAppointmentId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [draftSaveState, setDraftSaveState] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [copiedPlanSnapshot, setCopiedPlanSnapshot] = useState<{
    plan: string;
    instructions: string;
  } | null>(null);
  const draftInitializedRef = useRef(false);
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef("");
  const savePromiseRef = useRef<Promise<unknown> | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const conflictRef = useRef(false);
  const fieldsRef = useRef<ClinicalDraftFields>({
    diagnosisSummary,
    dischargeInstructions,
    warningSigns,
    noInstructionsReason,
    prescriptionDisposition,
    followUpDisposition,
    followUpNotes,
    followUpAppointmentId,
    followUpDueDate,
    followUpAssignedTo,
    documentationExceptionReason,
  });
  fieldsRef.current = {
    diagnosisSummary,
    dischargeInstructions,
    warningSigns,
    noInstructionsReason,
    prescriptionDisposition,
    followUpDisposition,
    followUpNotes,
    followUpAppointmentId,
    followUpDueDate,
    followUpAssignedTo,
    documentationExceptionReason,
  };

  const applyClinicalFields = useCallback((fields: ClinicalDraftFields) => {
    setDiagnosisSummary(fields.diagnosisSummary);
    setDischargeInstructions(fields.dischargeInstructions);
    setWarningSigns(fields.warningSigns);
    setNoInstructionsReason(fields.noInstructionsReason);
    setPrescriptionDisposition(fields.prescriptionDisposition);
    setFollowUpDisposition(fields.followUpDisposition);
    setFollowUpNotes(fields.followUpNotes);
    setFollowUpAppointmentId(fields.followUpAppointmentId);
    setFollowUpDueDate(fields.followUpDueDate);
    setFollowUpAssignedTo(fields.followUpAssignedTo);
    setDocumentationExceptionReason(fields.documentationExceptionReason);
    setCopiedPlanSnapshot(null);
    fieldsRef.current = fields;
  }, []);

  useEffect(() => {
    if (!data) return;
    const key = closeout ? `${closeout.id}:${closeout.revision}` : "empty";
    if (hydratedRevision.current === key) return;
    const clinicalSource = closeout?.amendmentDraft ?? closeout;
    const serverFields: ClinicalDraftFields = {
      diagnosisSummary: clinicalSource?.diagnosisSummary ?? "",
      dischargeInstructions: clinicalSource?.dischargeInstructions ?? "",
      warningSigns: clinicalSource?.warningSigns ?? "",
      noInstructionsReason: clinicalSource?.noInstructionsReason ?? "",
      prescriptionDisposition: clinicalSource?.prescriptionDisposition ?? "",
      followUpDisposition: clinicalSource?.followUpDisposition ?? "",
      followUpNotes: clinicalSource?.followUpNotes ?? "",
      followUpAppointmentId: clinicalSource?.followUpAppointmentId ?? "",
      followUpDueDate: clinicalSource?.followUpDueDate ?? "",
      followUpAssignedTo: clinicalSource?.followUpAssignedTo ?? "",
      documentationExceptionReason:
        clinicalSource?.documentationExceptionReason ?? "",
    };
    const serverRevision = closeout?.revision ?? 0;
    const localDirty =
      clinicalDraftFingerprint(fieldsRef.current) !==
      lastSavedFingerprintRef.current;
    if (
      draftInitializedRef.current &&
      serverRevision > revisionRef.current &&
      (localDirty || savePromiseRef.current)
    ) {
      conflictRef.current = true;
      setConflictRevision(serverRevision);
      setDraftSaveState("conflict");
      return;
    }
    if (draftInitializedRef.current && serverRevision <= revisionRef.current) {
      hydratedRevision.current = key;
      return;
    }
    applyClinicalFields(serverFields);
    revisionRef.current = serverRevision;
    lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
    setLastDraftSavedAt(closeout?.updatedAt ?? null);
    setDraftSaveState(closeout ? "saved" : "idle");
    conflictRef.current = false;
    setConflictRevision(null);
    draftInitializedRef.current = true;
    setChargeDisposition(closeout?.chargeDisposition ?? "");
    setNoChargeReason(closeout?.noChargeReason ?? "");
    setHandoffMethod(closeout?.handoffMethod ?? "");
    hydratedRevision.current = key;
  }, [applyClinicalFields, closeout, data]);

  useEffect(() => {
    if (!data) return;
    const key = activeInvoice
      ? `${activeInvoice.id}:${activeInvoice.dueDate ?? "unscheduled"}`
      : "no-invoice";
    if (hydratedInvoice.current === key) return;
    setInvoiceDueDate(
      activeInvoice?.dueDate ?? defaultPayLaterDueDate(data.practice.timezone),
    );
    hydratedInvoice.current = key;
  }, [activeInvoice, data]);

  const refresh = async () => {
    await Promise.all([
      utils.encounters.getCloseout.invalidate({ appointmentId }),
      utils.appointments.getById.invalidate({ id: appointmentId }),
      utils.appointments.list.invalidate(),
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      }),
      utils.whiteboard.getActive.invalidate(),
    ]);
  };

  const saveDraft = trpc.encounters.saveDraft.useMutation();
  const saveDraftRef = useRef(saveDraft.mutateAsync);
  saveDraftRef.current = saveDraft.mutateAsync;
  const finalizeClinical = trpc.encounters.finalizeClinical.useMutation({
    onSuccess: async () => {
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState("saved");
      toast.success(t("encounters.closeout.handoffFinalizedToast", "Clinical handoff finalized"));
      await refresh();
    },
    onError: async (error) => {
      if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") {
        conflictRef.current = true;
        try {
          const latest = await utils.encounters.getCloseout.fetch({
            appointmentId,
          });
          setConflictRevision(latest.closeout?.revision ?? 0);
        } catch {
          setConflictRevision(null);
        }
        setDraftSaveState("conflict");
      }
      toast.error(error.message);
    },
  });
  const completeVisit = trpc.encounters.completeVisit.useMutation({
    onSuccess: async () => {
      toast.success(t("encounters.closeout.visitCompletedToast", "Visit completed safely"));
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const reopenClinical = trpc.encounters.reopenClinical.useMutation({
    onSuccess: async () => {
      toast.success(
        t("encounters.closeout.amendmentStartedToast", "Amendment draft started; the signed handoff remains active"),
      );
      setAmendmentReason("");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const resolveNeededFollowUp =
    trpc.encounters.resolveNeededFollowUp.useMutation({
      onSuccess: async () => {
        toast.success(t("encounters.closeout.followUpResolvedToast", "Follow-up obligation resolved with attribution"));
        setFollowUpResolution("");
        setResolutionAppointmentId("");
        setResolutionNotes("");
        await refresh();
        await utils.encounters.listPendingFollowUps.invalidate();
      },
      onError: (error) => toast.error(error.message),
    });

  const canDraftClinical =
    role === "admin" || role === "veterinarian" || role === "technician";
  const canFinalizeClinical =
    data?.canFinalizeDoctorRequiredVisit === true ||
    (appointment.typeRequiresDoctor === 0 &&
      (role === "admin" || role === "technician"));
  const signedClinical =
    closeout?.status === "clinical_finalized" ||
    closeout?.status === "completed";
  const amendingClinical = Boolean(closeout?.amendmentDraft);
  const clinicalLocked = signedClinical && !amendingClinical;
  const isCompleted = closeout?.status === "completed";
  const normalizedSoapPlan = soapPlan.trim();
  const planCopyState = !copiedPlanSnapshot
    ? "available"
    : normalizedSoapPlan !== copiedPlanSnapshot.plan
      ? "plan_changed"
      : dischargeInstructions !== copiedPlanSnapshot.instructions
        ? "instructions_edited"
        : "copied";

  function copySoapPlanToOwnerInstructions() {
    if (!normalizedSoapPlan || clinicalLocked || !canDraftClinical) return;
    setDischargeInstructions(normalizedSoapPlan);
    setNoInstructionsReason("");
    setCopiedPlanSnapshot({
      plan: normalizedSoapPlan,
      instructions: normalizedSoapPlan,
    });
    toast.success(t("encounters.closeout.planCopiedToast", "Plan copied to owner instructions for review"));
  }
  const persistCloseoutDraft = useCallback(async () => {
    if (!draftInitializedRef.current || clinicalLocked || !canDraftClinical) {
      return null;
    }
    while (true) {
      if (conflictRef.current) return null;
      if (!window.navigator.onLine) {
        setDraftSaveState("unsaved");
        return null;
      }
      if (savePromiseRef.current) {
        await savePromiseRef.current.catch(() => null);
        continue;
      }
      const fields = { ...fieldsRef.current };
      const fingerprint = clinicalDraftFingerprint(fields);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return { revision: revisionRef.current };
      }
      setDraftSaveState("saving");
      const request = saveDraftRef.current({
        appointmentId,
        expectedRevision: revisionRef.current,
        diagnosisSummary: fields.diagnosisSummary || null,
        dischargeInstructions: fields.dischargeInstructions || null,
        warningSigns: fields.warningSigns || null,
        noInstructionsReason: fields.noInstructionsReason || null,
        prescriptionDisposition: fields.prescriptionDisposition || null,
        followUpDisposition: fields.followUpDisposition || null,
        followUpNotes: fields.followUpNotes || null,
        followUpAppointmentId: fields.followUpAppointmentId || null,
        followUpDueDate: fields.followUpDueDate || null,
        followUpAssignedTo: fields.followUpAssignedTo || null,
        documentationExceptionReason:
          fields.documentationExceptionReason || null,
      });
      savePromiseRef.current = request;
      try {
        const result = await request;
        revisionRef.current = result.revision;
        lastSavedFingerprintRef.current = fingerprint;
        setLastDraftSavedAt(result.updatedAt ?? new Date());
        setDraftSaveState("saved");
        await utils.encounters.getCloseout.invalidate({ appointmentId });
      } catch (error) {
        const code = (error as { data?: { code?: string } })?.data?.code;
        if (code === "CONFLICT") {
          conflictRef.current = true;
          try {
            const latest = await utils.encounters.getCloseout.fetch({
              appointmentId,
            });
            setConflictRevision(latest.closeout?.revision ?? 0);
          } catch {
            setConflictRevision(null);
          }
          setDraftSaveState("conflict");
          toast.error(
            t(
              "encounters.closeout.conflictToast",
              "Closeout changed in another session. Your local work is still here.",
            ),
          );
        } else {
          setDraftSaveState("error");
          toast.error(
            error instanceof Error
              ? error.message
              : t(
                  "encounters.closeout.saveDraftError",
                  "Clinical closeout draft could not be saved",
                ),
          );
        }
        return null;
      } finally {
        if (savePromiseRef.current === request) savePromiseRef.current = null;
      }
    }
  }, [
    appointmentId,
    canDraftClinical,
    clinicalLocked,
    t,
    utils.encounters.getCloseout,
  ]);

  const closeoutNeedsLeaveGuard = useCallback(() => {
    if (!draftInitializedRef.current || clinicalLocked) return false;
    return (
      conflictRef.current ||
      savePromiseRef.current !== null ||
      clinicalDraftFingerprint(fieldsRef.current) !==
        lastSavedFingerprintRef.current
    );
  }, [clinicalLocked]);

  useEffect(() => {
    if (!draftInitializedRef.current || clinicalLocked || conflictRef.current) {
      return;
    }
    const fingerprint = clinicalDraftFingerprint(fieldsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    setDraftSaveState("unsaved");
    if (!isOnline) return;
    const timer = window.setTimeout(() => void persistCloseoutDraft(), 1_200);
    autosaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [
    clinicalLocked,
    diagnosisSummary,
    dischargeInstructions,
    documentationExceptionReason,
    followUpAppointmentId,
    followUpAssignedTo,
    followUpDisposition,
    followUpDueDate,
    followUpNotes,
    isOnline,
    noInstructionsReason,
    persistCloseoutDraft,
    prescriptionDisposition,
    warningSigns,
  ]);

  useEffect(() => {
    if (!isOnline || conflictRef.current || !closeoutNeedsLeaveGuard()) return;
    void persistCloseoutDraft();
  }, [closeoutNeedsLeaveGuard, isOnline, persistCloseoutDraft]);

  useUnsavedChangesGuard(
    closeoutNeedsLeaveGuard(),
    t(
      "encounters.closeout.unsavedGuard",
      "This closeout has changes that are not saved on the server. Leave and lose those changes?",
    ),
  );

  async function finalizeClinicalHandoff() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const saved = await persistCloseoutDraft();
    if (!saved || conflictRef.current || !window.navigator.onLine) return;
    const fields = { ...fieldsRef.current };
    finalizeClinical.mutate({
      appointmentId,
      expectedRevision: revisionRef.current,
      diagnosisSummary: fields.diagnosisSummary || null,
      dischargeInstructions: fields.dischargeInstructions || null,
      warningSigns: fields.warningSigns || null,
      noInstructionsReason: fields.noInstructionsReason || null,
      prescriptionDisposition: fields.prescriptionDisposition || null,
      followUpDisposition: fields.followUpDisposition || null,
      followUpNotes: fields.followUpNotes || null,
      followUpAppointmentId: fields.followUpAppointmentId || null,
      followUpDueDate: fields.followUpDueDate || null,
      followUpAssignedTo: fields.followUpAssignedTo || null,
      documentationExceptionReason: fields.documentationExceptionReason || null,
    });
  }

  const fieldsFromPayload = (
    payload: NonNullable<CloseoutQueryState["data"]>,
  ): ClinicalDraftFields => {
    const source = payload.closeout?.amendmentDraft ?? payload.closeout;
    return {
      diagnosisSummary: source?.diagnosisSummary ?? "",
      dischargeInstructions: source?.dischargeInstructions ?? "",
      warningSigns: source?.warningSigns ?? "",
      noInstructionsReason: source?.noInstructionsReason ?? "",
      prescriptionDisposition: source?.prescriptionDisposition ?? "",
      followUpDisposition: source?.followUpDisposition ?? "",
      followUpNotes: source?.followUpNotes ?? "",
      followUpAppointmentId: source?.followUpAppointmentId ?? "",
      followUpDueDate: source?.followUpDueDate ?? "",
      followUpAssignedTo: source?.followUpAssignedTo ?? "",
      documentationExceptionReason: source?.documentationExceptionReason ?? "",
    };
  };

  async function restoreServerCloseoutDraft() {
    try {
      const latest = await utils.encounters.getCloseout.fetch({
        appointmentId,
      });
      const serverFields = fieldsFromPayload(latest);
      applyClinicalFields(serverFields);
      revisionRef.current = latest.closeout?.revision ?? 0;
      lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
      setLastDraftSavedAt(latest.closeout?.updatedAt ?? null);
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState(latest.closeout ? "saved" : "idle");
      await utils.encounters.getCloseout.invalidate({ appointmentId });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "encounters.closeout.restoreServerError",
              "The server closeout could not be loaded",
            ),
      );
    }
  }

  async function overwriteServerCloseoutDraft() {
    if (!window.navigator.onLine) {
      toast.error(
        t(
          "encounters.closeout.reconnectBeforeOverwrite",
          "Reconnect before replacing the server closeout draft",
        ),
      );
      return;
    }
    try {
      const latest = await utils.encounters.getCloseout.fetch({
        appointmentId,
      });
      const serverFields = fieldsFromPayload(latest);
      revisionRef.current = latest.closeout?.revision ?? conflictRevision ?? 0;
      lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState("unsaved");
      await persistCloseoutDraft();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "encounters.closeout.overwriteServerError",
              "The local closeout could not replace the server draft",
            ),
      );
    }
  }
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ");

  async function downloadDischarge() {
    if (!data || !signedClinical) return;
    try {
      const { generateDischargeInstructions } = await import("@/lib/pdf");
      const followUpDate = closeout?.followUpScheduledAt
        ? new Date(closeout.followUpScheduledAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: data.practice.timezone ?? undefined,
          })
        : closeout?.followUpDisposition === "needed" && closeout.followUpDueDate
          ? t("encounters.closeout.neededBy", "Needed by {date}", {
              date: formatClinicDate(closeout.followUpDueDate),
            })
          : undefined;
      const instructions = closeout?.dischargeInstructions
        ? splitOwnerInstructions(closeout.dischargeInstructions)
        : closeout?.noInstructionsReason
          ? [
              t(
                "encounters.closeout.noInstructionsReasonPrefix",
                "No additional home-care instructions: {reason}",
                { reason: closeout.noInstructionsReason },
              ),
            ]
          : [];
      generateDischargeInstructions({
        practiceName: data.practice.name,
        practicePhone: data.practice.phone ?? undefined,
        patientName:
          appointment.patientName ??
          t("encounters.closeout.defaultPatientName", "Patient"),
        species: appointment.patientSpecies ?? "",
        clientName:
          clientName || t("encounters.closeout.defaultClientName", "Owner"),
        visitDate: formatAppointmentTime(
          appointment.startTime,
          data.practice.timezone,
        ),
        doctorName: closeout?.clinicalFinalizerName ?? undefined,
        diagnosis: closeout?.diagnosisSummary ?? undefined,
        medications: (closeout?.medicationSnapshot ?? []).map((medication) => ({
          name: medication.medicationName,
          dosage: medication.dosage,
          frequency: medication.frequency,
          instructions: medication.instructions ?? undefined,
        })),
        instructions,
        followUpDate,
        followUpNotes: closeout?.followUpNotes ?? undefined,
        emergencyNotes: closeout?.warningSigns ?? undefined,
      }).save(
        `discharge_${(appointment.patientName ?? "patient").replace(/\s+/g, "_")}.pdf`,
      );
      toast.success(
        t(
          "encounters.closeout.dischargeDownloadedToast",
          "Discharge instructions downloaded",
        ),
      );
    } catch {
      toast.error(
        t(
          "encounters.closeout.dischargeGenerateError",
          "Discharge instructions could not be generated",
        ),
      );
    }
  }

  type HistoricalCloseout = NonNullable<
    typeof closeout
  >["amendmentHistory"][number];

  async function downloadHistoricalDischarge(amendment: HistoricalCloseout) {
    if (!data) return;
    try {
      const { generateDischargeInstructions } = await import("@/lib/pdf");
      const followUpDate = amendment.followUpScheduledAt
        ? new Date(amendment.followUpScheduledAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: data.practice.timezone ?? undefined,
          })
        : amendment.followUpDisposition === "needed" &&
            amendment.followUpDueDate
          ? t("encounters.closeout.neededBy", "Needed by {date}", {
              date: formatClinicDate(amendment.followUpDueDate),
            })
          : undefined;
      const instructions = amendment.dischargeInstructions
        ? splitOwnerInstructions(amendment.dischargeInstructions)
        : amendment.noInstructionsReason
          ? [
              t(
                "encounters.closeout.noInstructionsReasonPrefix",
                "No additional home-care instructions: {reason}",
                { reason: amendment.noInstructionsReason },
              ),
            ]
          : [];
      generateDischargeInstructions({
        practiceName: data.practice.name,
        practicePhone: data.practice.phone ?? undefined,
        patientName:
          appointment.patientName ??
          t("encounters.closeout.defaultPatientName", "Patient"),
        species: appointment.patientSpecies ?? "",
        clientName:
          clientName || t("encounters.closeout.defaultClientName", "Owner"),
        visitDate: formatAppointmentTime(
          appointment.startTime,
          data.practice.timezone,
        ),
        doctorName: amendment.clinicalFinalizerName,
        diagnosis: amendment.diagnosisSummary ?? undefined,
        medications: amendment.medicationSnapshot.map((medication) => ({
          name: medication.medicationName,
          dosage: medication.dosage,
          frequency: medication.frequency,
          instructions: medication.instructions ?? undefined,
        })),
        instructions,
        followUpDate,
        followUpNotes: amendment.followUpNotes ?? undefined,
        emergencyNotes: amendment.warningSigns ?? undefined,
      }).save(
        `discharge_${(appointment.patientName ?? "patient").replace(/\s+/g, "_")}_revision_${amendment.priorRevision}.pdf`,
      );
      toast.success(
        t(
          "encounters.closeout.dischargeRevisionDownloadedToast",
          "Discharge revision {revision} downloaded",
          { revision: amendment.priorRevision },
        ),
      );
    } catch {
      toast.error(
        t(
          "encounters.closeout.priorDischargeGenerateError",
          "Prior discharge instructions could not be generated",
        ),
      );
    }
  }

  if (closeoutQuery.isLoading) {
    return (
      <Card id="visit-closeout">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("encounters.closeout.loadingReadiness", "Loading closeout readiness...")}
        </CardContent>
      </Card>
    );
  }
  if (closeoutQuery.error || !data) {
    return (
      <Card id="visit-closeout" className="border-destructive">
        <CardHeader>
          <CardTitle>
            {t("encounters.closeout.unavailableTitle", "Visit closeout unavailable")}
          </CardTitle>
          <CardDescription className="text-destructive">
            {closeoutQuery.error?.message ??
              t(
                "encounters.closeout.unavailableDesc",
                "Readiness could not be verified. The visit cannot be checked out.",
              )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const compactPendingActions = isCompleted
    ? []
    : !signedClinical
      ? [
          appointment.status !== "in_exam" && !amendingClinical
            ? t("encounters.closeout.actionStartExam", "Start the exam")
            : null,
          data.soapDraft
            ? t(
                "encounters.closeout.actionFinalizeSoapDraft",
                "Finalize or discard the SOAP draft",
              )
            : data.linkedSoapCount === 0 && !documentationExceptionReason.trim()
              ? t(
                  "encounters.closeout.actionLinkSoap",
                  "Link SOAP documentation or record an exception",
                )
              : null,
          !dischargeInstructions.trim() && !noInstructionsReason.trim()
            ? t(
                "encounters.closeout.actionPrepareDischarge",
                "Prepare owner home-care instructions",
              )
            : null,
          !prescriptionDisposition
            ? t(
                "encounters.closeout.actionConfirmPrescription",
                "Confirm prescription disposition",
              )
            : data.activeMedications.length > 0 &&
                prescriptionDisposition !== "prescribed"
              ? t(
                  "encounters.closeout.actionIncludePrescriptions",
                  "Include linked prescriptions in the handoff",
                )
              : data.activeMedications.length === 0 &&
                  prescriptionDisposition !== "not_needed"
                ? t(
                    "encounters.closeout.actionConfirmNoPrescription",
                    "Confirm that no prescription is needed",
                  )
                : null,
          !followUpDisposition
            ? t(
                "encounters.closeout.actionConfirmFollowUp",
                "Confirm follow-up disposition",
              )
            : followUpDisposition === "scheduled" && !followUpAppointmentId
              ? t(
                  "encounters.closeout.actionChooseScheduledFollowUp",
                  "Choose the scheduled follow-up",
                )
              : followUpDisposition === "needed" &&
                  (!followUpDueDate || !followUpAssignedTo)
                ? t(
                    "encounters.closeout.actionSetDueDateFollowUp",
                    "Set a due date and accountable follow-up owner",
                  )
                : null,
        ].filter((action): action is string => Boolean(action))
      : [
          !chargeDisposition
            ? t("encounters.closeout.actionResolveBilling", "Resolve billing disposition")
            : null,
          !handoffMethod
            ? t(
                "encounters.closeout.actionRecordHandoffMethod",
                "Record the owner handoff method",
              )
            : null,
        ].filter((action): action is string => Boolean(action));

  if (compact && !compactExpanded) {
    return (
      <Card id="visit-closeout" className="scroll-mt-4" tabIndex={-1}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                {t("encounters.closeout.finishFieldVisit", "Finish field visit")}
              </CardTitle>
              <CardDescription>
                {t(
                  "encounters.closeout.finishFieldVisitDesc",
                  "Review only the clinical, billing, or owner-handoff decisions still needed before safe checkout.",
                )}
              </CardDescription>
            </div>
            <Badge variant={isCompleted ? "success" : "outline"}>
              {isCompleted
                ? t("encounters.closeout.statusCompleted", "Completed")
                : signedClinical
                  ? t(
                      "encounters.closeout.statusSigned",
                      "Clinical instructions signed",
                    )
                  : closeout
                    ? t("encounters.closeout.statusDraftSaved", "Draft saved")
                    : t("encounters.closeout.statusReadyForReview", "Ready for review")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {compactPendingActions.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-medium">
                {compactPendingActions.length === 1
                  ? t("encounters.closeout.decisionSingular", "1 decision still needed")
                  : t(
                      "encounters.closeout.decisionPlural",
                      "{count} decisions still needed",
                      { count: compactPendingActions.length },
                    )}
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                {compactPendingActions.map((action) => (
                  <li key={action} className="flex items-start gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              {isCompleted
                ? t(
                    "encounters.closeout.fieldCompletedNotice",
                    "The field visit has a durable clinical and operational closeout.",
                  )
                : t(
                    "encounters.closeout.fieldVisibleNotice",
                    "Visible field decisions are complete. Review the final server-validated safety checks.",
                  )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t(
                "encounters.closeout.safeguardsNotice",
                "SOAP, performed-work reconciliation, and payment controls remain enforced. Only outstanding field decisions are surfaced here.",
              )}
            </p>
            <Button type="button" onClick={() => setCompactExpanded(true)}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {isCompleted
                ? t("encounters.closeout.viewCloseout", "View closeout")
                : t("encounters.closeout.reviewAndFinish", "Review and finish")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="visit-closeout" className="scroll-mt-4" tabIndex={-1}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {compact
                ? t("encounters.closeout.finishFieldVisit", "Finish field visit")
                : t("encounters.closeout.title", "Visit closeout")}
            </CardTitle>
            <CardDescription>
              {compact
                ? t(
                    "encounters.closeout.compactDesc",
                    "Resolve the remaining owner, clinical, and billing decisions without bypassing checkout safeguards.",
                  )
                : t(
                    "encounters.closeout.fullDesc",
                    "Finalize clinical instructions, then verify billing and owner handoff before checkout.",
                  )}
            </CardDescription>
          </div>
          <Badge variant={isCompleted ? "success" : "outline"}>
            {amendingClinical
              ? isCompleted
                ? t(
                    "encounters.closeout.completedAmendmentDraft",
                    "Completed · amendment draft",
                  )
                : t(
                    "encounters.closeout.signedAmendmentDraft",
                    "Signed · amendment draft",
                  )
              : isCompleted
                ? t("encounters.closeout.statusCompleted", "Completed")
                : clinicalLocked
                  ? t(
                      "encounters.closeout.statusFinalized",
                      "Clinical handoff finalized",
                    )
                  : closeout
                    ? t("encounters.closeout.statusDraftSaved", "Draft saved")
                    : t("encounters.closeout.statusNotStarted", "Not started")}
          </Badge>
          {compact ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCompactExpanded(false)}
            >
              {t("encounters.closeout.collapse", "Collapse")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessTile
            label={t("encounters.closeout.clinicalNoteLabel", "Clinical note")}
            value={
              data.soapDraft
                ? t(
                    "encounters.closeout.soapDraftInProgress",
                    "Draft in progress · revision {revision}",
                    { revision: data.soapDraft.revision },
                  )
                : data.linkedSoapCount > 0
                  ? data.linkedSoapCount === 1
                    ? t(
                        "encounters.closeout.linkedSoapCountSingular",
                        "1 linked SOAP note",
                      )
                    : t(
                        "encounters.closeout.linkedSoapCountPlural",
                        "{count} linked SOAP notes",
                        { count: data.linkedSoapCount },
                      )
                  : closeout?.documentationExceptionReason
                    ? t(
                        "encounters.closeout.documentedException",
                        "Documented exception",
                      )
                    : data.missingSoapReplacement
                      ? t(
                          "encounters.closeout.replacementNeeded",
                          "Replacement or exception needed",
                        )
                      : t("encounters.closeout.missingSoap", "Missing")
            }
          />
          <ReadinessTile
            label={t("encounters.closeout.visitMedicationsLabel", "Visit medications")}
            value={
              data.activeMedications.length > 0
                ? data.activeMedications.length === 1
                  ? t(
                      "encounters.closeout.activePrescriptionSingular",
                      "1 active linked prescription",
                    )
                  : t(
                      "encounters.closeout.activePrescriptionPlural",
                      "{count} active linked prescriptions",
                      { count: data.activeMedications.length },
                    )
                : t("encounters.closeout.noneLinked", "None linked")
            }
          />
          <ReadinessTile
            label={t("encounters.closeout.billingLabel", "Billing")}
            value={
              activeInvoice
                ? `${activeInvoice.status} · ${activeInvoice.itemCount} ${
                    activeInvoice.itemCount === 1
                      ? t("encounters.closeout.invoiceLineSingular", "line")
                      : t("encounters.closeout.invoiceLinePlural", "lines")
                  }`
                : t("encounters.closeout.noActiveInvoice", "No active invoice")
            }
          />
        </div>

        {!clinicalLocked ? (
          appointment.status !== "in_exam" && !amendingClinical ? (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t(
                "encounters.closeout.checkInNotice",
                "Check the patient in and start the exam before preparing the clinical closeout.",
              )}
            </div>
          ) : canDraftClinical ? (
            <ClinicalCloseoutForm
              diagnosisSummary={diagnosisSummary}
              setDiagnosisSummary={setDiagnosisSummary}
              dischargeInstructions={dischargeInstructions}
              setDischargeInstructions={setDischargeInstructions}
              warningSigns={warningSigns}
              setWarningSigns={setWarningSigns}
              noInstructionsReason={noInstructionsReason}
              setNoInstructionsReason={setNoInstructionsReason}
              prescriptionDisposition={prescriptionDisposition}
              setPrescriptionDisposition={setPrescriptionDisposition}
              followUpDisposition={followUpDisposition}
              setFollowUpDisposition={setFollowUpDisposition}
              followUpNotes={followUpNotes}
              setFollowUpNotes={setFollowUpNotes}
              followUpAppointmentId={followUpAppointmentId}
              setFollowUpAppointmentId={setFollowUpAppointmentId}
              followUpDueDate={followUpDueDate}
              setFollowUpDueDate={setFollowUpDueDate}
              followUpAssignedTo={followUpAssignedTo}
              setFollowUpAssignedTo={setFollowUpAssignedTo}
              documentationExceptionReason={documentationExceptionReason}
              setDocumentationExceptionReason={setDocumentationExceptionReason}
              compact={compact}
              soapPlan={soapPlan}
              planCopyState={planCopyState}
              onCopySoapPlan={copySoapPlanToOwnerInstructions}
              linkedSoapCount={data.linkedSoapCount}
              missingSoapReplacement={data.missingSoapReplacement}
              soapReplacementHref={
                data.missingSoapReplacement
                  ? `/records/replace-soap/${appointment.patientId}?sourceNoteId=${data.missingSoapReplacement.sourceNoteId}&return=patient`
                  : null
              }
              soapDraft={data.soapDraft}
              soapDraftHref={`/records/new-soap/${appointment.patientId}?appointmentId=${appointmentId}`}
              linkedMedicationCount={data.activeMedications.length}
              followUpAppointments={data.followUpAppointments}
              followUpAssignees={data.followUpAssignees}
              timeZone={data.practice.timezone}
              isAmendment={amendingClinical}
              saveState={draftSaveState}
              lastSavedAt={lastDraftSavedAt}
              isOnline={isOnline}
              isSaving={saveDraft.isPending || finalizeClinical.isPending}
              isFinalizing={finalizeClinical.isPending}
              canFinalize={canFinalizeClinical}
              onSave={() => void persistCloseoutDraft()}
              onUseServer={() => void restoreServerCloseoutDraft()}
              onOverwrite={() => void overwriteServerCloseoutDraft()}
              onFinalize={() => void finalizeClinicalHandoff()}
            />
          ) : (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t(
                "encounters.closeout.roleCannotDraft",
                "Your role cannot prepare clinical closeout instructions.",
              )}
            </div>
          )
        ) : null}

        {signedClinical ? (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">
                  {t(
                    "encounters.closeout.clinicalHandoffFinalizedHeader",
                    "1. Clinical handoff finalized",
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {closeout?.medicationSnapshot.length ?? 0}{" "}
                  {closeout?.medicationSnapshot.length === 1
                    ? t(
                        "encounters.closeout.visitMedicationSingular",
                        "visit medication",
                      )
                    : t(
                        "encounters.closeout.visitMedicationPlural",
                        "visit medications",
                      )}{" "}
                  · {closeout?.followUpDisposition?.replace("_", " ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadDischarge}>
                <Download className="mr-2 h-4 w-4" />
                {t("encounters.closeout.downloadDischarge", "Download discharge")}
              </Button>
            </div>
            <dl className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("encounters.closeout.finalizedBy", "Finalized by")}
                </dt>
                <dd className="mt-1">
                  {closeout?.clinicalFinalizerName ??
                    t(
                      "encounters.closeout.unknownClinician",
                      "Unknown clinician",
                    )}
                  {closeout?.clinicalFinalizedAt
                    ? ` · ${formatAppointmentTime(
                        closeout.clinicalFinalizedAt,
                        data.practice.timezone,
                      )}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("encounters.closeout.followUp", "Follow-up")}
                </dt>
                <dd className="mt-1">
                  {closeout?.followUpDisposition === "scheduled" &&
                  closeout.followUpScheduledAt
                    ? t(
                        "encounters.closeout.followUpScheduledAt",
                        "Scheduled {time}",
                        {
                          time: formatAppointmentTime(
                            closeout.followUpScheduledAt,
                            data.practice.timezone,
                          ),
                        },
                      )
                    : closeout?.followUpDisposition === "needed" &&
                        closeout.followUpDueDate
                      ? t(
                          "encounters.closeout.followUpNeededByAssigned",
                          "Needed by {date} · Assigned to {assignee}",
                          {
                            date: formatClinicDate(closeout.followUpDueDate),
                            assignee:
                              closeout.followUpAssigneeName ??
                              t(
                                "encounters.closeout.clinicTeam",
                                "clinic team",
                              ),
                          },
                        )
                      : t(
                          "encounters.closeout.noFollowUpNeeded",
                          "No follow-up needed",
                        )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(
                    "encounters.closeout.diagnosisSummaryLabel",
                    "Diagnosis or visit summary",
                  )}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {closeout?.diagnosisSummary ||
                    t("encounters.closeout.notRecorded", "Not recorded")}
                </dd>
              </div>
            </dl>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {t("encounters.closeout.medicationsHeader", "Medications")}
              </h4>
              {closeout?.medicationSnapshot.length ? (
                <ul className="space-y-2">
                  {closeout.medicationSnapshot.map((medication) => (
                    <li
                      key={medication.prescriptionId}
                      className="rounded-md border border-border bg-background p-3 text-sm"
                    >
                      <p className="font-medium">{medication.medicationName}</p>
                      <p className="text-muted-foreground">
                        {medication.dosage} · {medication.frequency}
                        {medication.quantity
                          ? t(
                              "encounters.closeout.quantityLabel",
                              " · Quantity {quantity}",
                              { quantity: medication.quantity },
                            )
                          : ""}
                      </p>
                      {medication.instructions ? (
                        <p className="mt-1 whitespace-pre-wrap">
                          {medication.instructions}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "encounters.closeout.noVisitMedications",
                    "No visit medications.",
                  )}
                </p>
              )}
            </div>
            <div className="space-y-3 rounded-md border border-border bg-background p-3 text-sm">
              <div>
                <h4 className="font-medium">
                  {t("encounters.closeout.homeCareHeader", "Home care")}
                </h4>
                {closeout?.dischargeInstructions ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.dischargeInstructions}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {t(
                      "encounters.closeout.noInstructionsReasonPrefix",
                      "No additional instructions: {reason}",
                      { reason: closeout?.noInstructionsReason ?? "" },
                    )}
                  </p>
                )}
              </div>
              {closeout?.warningSigns ? (
                <div>
                  <h4 className="font-medium">
                    {t(
                      "encounters.closeout.warningSignsHeader",
                      "Warning signs and when to call",
                    )}
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.warningSigns}
                  </p>
                </div>
              ) : null}
              {closeout?.followUpNotes ? (
                <div>
                  <h4 className="font-medium">
                    {t(
                      "encounters.closeout.followUpNotesHeader",
                      "Follow-up notes",
                    )}
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.followUpNotes}
                  </p>
                </div>
              ) : null}
            </div>
            {closeout?.amendmentHistory.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t(
                    "encounters.closeout.priorFinalizedVersions",
                    "Prior finalized versions ({count})",
                    { count: closeout.amendmentHistory.length },
                  )}
                </p>
                {closeout.amendmentHistory.map((amendment) => (
                  <details
                    key={`${amendment.priorRevision}:${amendment.reopenedAt}`}
                    className="rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <summary className="cursor-pointer font-medium">
                      {t(
                        "encounters.closeout.revisionWithReason",
                        "Revision {revision} · {reason}",
                        {
                          revision: amendment.priorRevision,
                          reason: amendment.reason,
                        },
                      )}
                    </summary>
                    <div className="mt-3 space-y-2 text-muted-foreground">
                      <p>
                        {t(
                          "encounters.closeout.finalizedAndReopenedBy",
                          "Finalized by {finalizer} on {finalizedAt}. Correction opened by {reopenedBy} on {reopenedAt}.",
                          {
                            finalizer: amendment.clinicalFinalizerName,
                            finalizedAt: formatAppointmentTime(
                              amendment.clinicalFinalizedAt,
                              data.practice.timezone,
                            ),
                            reopenedBy: amendment.reopenedByName,
                            reopenedAt: formatAppointmentTime(
                              amendment.reopenedAt,
                              data.practice.timezone,
                            ),
                          },
                        )}
                      </p>
                      <p className="whitespace-pre-wrap">
                        {amendment.dischargeInstructions ||
                          t(
                            "encounters.closeout.noInstructionsReasonPrefix",
                            "No additional instructions: {reason}",
                            { reason: amendment.noInstructionsReason ?? "" },
                          )}
                      </p>
                      {amendment.diagnosisSummary ? (
                        <p className="whitespace-pre-wrap">
                          <span className="font-medium text-foreground">
                            {t(
                              "encounters.closeout.visitSummaryPrefix",
                              "Visit summary: ",
                            )}
                          </span>
                          {amendment.diagnosisSummary}
                        </p>
                      ) : null}
                      {amendment.warningSigns ? (
                        <p className="whitespace-pre-wrap">
                          <span className="font-medium text-foreground">
                            {t(
                              "encounters.closeout.warningSignsPrefix",
                              "Warning signs: ",
                            )}
                          </span>
                          {amendment.warningSigns}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-foreground">
                          {t(
                            "encounters.closeout.followUpPrefix",
                            "Follow-up: ",
                          )}
                        </span>
                        {amendment.followUpDisposition === "scheduled" &&
                        amendment.followUpScheduledAt
                          ? formatAppointmentTime(
                              amendment.followUpScheduledAt,
                              data.practice.timezone,
                            )
                          : amendment.followUpDisposition === "needed" &&
                              amendment.followUpDueDate
                            ? t(
                                "encounters.closeout.followUpNeededByAssigned",
                                "Needed by {date} · Assigned to {assignee}",
                                {
                                  date: formatClinicDate(
                                    amendment.followUpDueDate,
                                  ),
                                  assignee:
                                    amendment.followUpAssigneeName ??
                                    t(
                                      "encounters.closeout.clinicTeam",
                                      "clinic team",
                                    ),
                                },
                              )
                            : t("encounters.closeout.noneNeeded", "None needed")}
                        {amendment.followUpNotes
                          ? ` · ${amendment.followUpNotes}`
                          : ""}
                      </p>
                      {amendment.medicationSnapshot.length ? (
                        <ul className="list-disc pl-5">
                          {amendment.medicationSnapshot.map((medication) => (
                            <li key={medication.prescriptionId}>
                              {medication.medicationName} · {medication.dosage}{" "}
                              · {medication.frequency}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadHistoricalDischarge(amendment)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t(
                          "encounters.closeout.downloadRevisionButton",
                          "Download revision {revision}",
                          { revision: amendment.priorRevision },
                        )}
                      </Button>
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
            {(role === "admin" || role === "veterinarian") &&
            !amendingClinical ? (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
                <label
                  className="text-sm font-medium"
                  htmlFor="closeout-amendment-reason"
                >
                  {t(
                    "encounters.closeout.createCorrectionLabel",
                    "Create an attributed correction",
                  )}
                </label>
                <Input
                  id="closeout-amendment-reason"
                  value={amendmentReason}
                  onChange={(event) => setAmendmentReason(event.target.value)}
                  placeholder={t(
                    "encounters.closeout.correctionPlaceholder",
                    "Reason this signed handoff needs correction",
                  )}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      amendmentReason.trim().length < 5 ||
                      reopenClinical.isPending
                    }
                    onClick={() =>
                      reopenClinical.mutate({
                        appointmentId,
                        expectedRevision: closeout!.revision,
                        reason: amendmentReason,
                      })
                    }
                  >
                    {reopenClinical.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t(
                      "encounters.closeout.startAmendmentButton",
                      "Start amendment",
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {signedClinical && closeout?.followUpDisposition === "needed" ? (
          <FollowUpResolutionPanel
            dueDate={closeout.followUpDueDate}
            assigneeName={closeout.followUpAssigneeName}
            resolution={closeout.followUpResolution}
            resolutionNotes={closeout.followUpResolutionNotes}
            resolutionScheduledAt={closeout.followUpResolutionScheduledAt}
            resolvedAt={closeout.followUpResolvedAt}
            resolverName={closeout.followUpResolverName}
            selectedResolution={followUpResolution}
            setSelectedResolution={setFollowUpResolution}
            resolutionAppointmentId={resolutionAppointmentId}
            setResolutionAppointmentId={setResolutionAppointmentId}
            notes={resolutionNotes}
            setNotes={setResolutionNotes}
            followUpAppointments={data.followUpAppointments}
            timeZone={data.practice.timezone}
            canResolve={canManageVisit(role)}
            isPending={resolveNeededFollowUp.isPending}
            onResolve={() => {
              if (!followUpResolution || !closeout) return;
              resolveNeededFollowUp.mutate({
                appointmentId,
                expectedRevision: closeout.revision,
                resolution: followUpResolution,
                resolutionAppointmentId:
                  followUpResolution === "scheduled"
                    ? resolutionAppointmentId || null
                    : null,
                notes: resolutionNotes || null,
              });
            }}
          />
        ) : null}

        {clinicalLocked && !isCompleted && canManageVisit(role) ? (
          <OperationalCloseoutForm
            activeInvoice={activeInvoice}
            chargeDisposition={chargeDisposition}
            setChargeDisposition={setChargeDisposition}
            invoiceDueDate={invoiceDueDate}
            setInvoiceDueDate={setInvoiceDueDate}
            minimumDueDate={formatDateInputForTimeZone(
              new Date(),
              data.practice.timezone,
            )}
            noChargeReason={noChargeReason}
            setNoChargeReason={setNoChargeReason}
            handoffMethod={handoffMethod}
            setHandoffMethod={setHandoffMethod}
            isPending={completeVisit.isPending || invoicesQuery.isLoading}
            onDownload={downloadDischarge}
            onComplete={() => {
              if (!chargeDisposition || !handoffMethod || !closeout) return;
              completeVisit.mutate({
                appointmentId,
                expectedRevision: closeout.revision,
                chargeDisposition,
                noChargeReason:
                  chargeDisposition === "no_charge"
                    ? noChargeReason || null
                    : null,
                invoiceDueDate:
                  chargeDisposition === "accounts_receivable"
                    ? invoiceDueDate
                    : null,
                handoffMethod,
              });
            }}
          />
        ) : null}

        {isCompleted ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <p className="font-medium">
              {t(
                "encounters.closeout.completedWithDurableCloseout",
                "Visit completed with a durable closeout.",
              )}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("encounters.closeout.billingLabel", "Billing")}:{" "}
              {closeout?.chargeDisposition?.replace("_", " ")} ·{" "}
              {t("encounters.closeout.ownerHandoffLabel", "Owner handoff")}:{" "}
              {closeout?.handoffMethod}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

type ClinicalCloseoutFormProps = {
  diagnosisSummary: string;
  setDiagnosisSummary: (value: string) => void;
  dischargeInstructions: string;
  setDischargeInstructions: (value: string) => void;
  warningSigns: string;
  setWarningSigns: (value: string) => void;
  noInstructionsReason: string;
  setNoInstructionsReason: (value: string) => void;
  prescriptionDisposition: "" | "prescribed" | "not_needed";
  setPrescriptionDisposition: (value: "" | "prescribed" | "not_needed") => void;
  followUpDisposition: "" | "none" | "needed" | "scheduled";
  setFollowUpDisposition: (value: "" | "none" | "needed" | "scheduled") => void;
  followUpNotes: string;
  setFollowUpNotes: (value: string) => void;
  followUpAppointmentId: string;
  setFollowUpAppointmentId: (value: string) => void;
  followUpDueDate: string;
  setFollowUpDueDate: (value: string) => void;
  followUpAssignedTo: string;
  setFollowUpAssignedTo: (value: string) => void;
  documentationExceptionReason: string;
  setDocumentationExceptionReason: (value: string) => void;
  compact: boolean;
  soapPlan: string;
  planCopyState:
    | "available"
    | "copied"
    | "instructions_edited"
    | "plan_changed";
  onCopySoapPlan: () => void;
  linkedSoapCount: number;
  missingSoapReplacement: { sourceNoteId: string } | null;
  soapReplacementHref: string | null;
  soapDraft: {
    revision: number;
    authorName: string;
    updatedAt: Date | string;
  } | null;
  soapDraftHref: string;
  linkedMedicationCount: number;
  followUpAppointments: Array<{ id: string; startTime: Date | string }>;
  followUpAssignees: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  timeZone?: string | null;
  isAmendment: boolean;
  saveState: "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict";
  lastSavedAt: Date | null;
  isOnline: boolean;
  isSaving: boolean;
  isFinalizing: boolean;
  canFinalize: boolean;
  onSave: () => void;
  onUseServer: () => void;
  onOverwrite: () => void;
  onFinalize: () => void;
};

function ClinicalCloseoutForm(props: ClinicalCloseoutFormProps) {
  const { t } = useI18n();
  const finalizationIssues = [
    props.soapDraft
      ? t(
          "encounters.clinicalForm.issueSoapDraft",
          "Finalize or discard the SOAP draft before signing clinical closeout.",
        )
      : null,
    !props.dischargeInstructions.trim() && !props.noInstructionsReason.trim()
      ? t(
          "encounters.clinicalForm.issueDischargeInstructions",
          "Enter home-care instructions or a clinical reason why none are needed.",
        )
      : null,
    !props.prescriptionDisposition
      ? t(
          "encounters.clinicalForm.issuePrescriptionDisposition",
          "Confirm the prescription disposition.",
        )
      : props.linkedMedicationCount > 0 &&
          props.prescriptionDisposition !== "prescribed"
        ? t(
            "encounters.clinicalForm.issueLinkedPrescriptionsMustBeIncluded",
            "Linked visit prescriptions must be included in the handoff.",
          )
        : props.linkedMedicationCount === 0 &&
            props.prescriptionDisposition !== "not_needed"
          ? t(
              "encounters.clinicalForm.issueNoActivePrescriptionLinked",
              "No active visit prescription is linked.",
            )
          : null,
    !props.followUpDisposition
      ? t(
          "encounters.clinicalForm.issueChooseFollowUpDisposition",
          "Choose a follow-up disposition.",
        )
      : props.followUpDisposition === "scheduled" &&
          !props.followUpAppointmentId
        ? t(
            "encounters.clinicalForm.issueChooseScheduledFollowUp",
            "Choose the scheduled follow-up appointment.",
          )
        : props.followUpDisposition === "needed" && !props.followUpDueDate
          ? t(
              "encounters.clinicalForm.issueSetFollowUpDueDate",
              "Set the date by which follow-up is needed.",
            )
          : props.followUpDisposition === "needed" && !props.followUpAssignedTo
            ? t(
                "encounters.clinicalForm.issueAssignStaffFollowUp",
                "Assign a staff member to own the follow-up.",
              )
            : null,
    props.linkedSoapCount === 0 && !props.documentationExceptionReason.trim()
      ? t(
          "encounters.clinicalForm.issueLinkSoapOrDocumentException",
          "Link a SOAP note or document why one is not required.",
        )
      : null,
  ].filter((issue): issue is string => Boolean(issue));
  const canFinalizeNow =
    props.canFinalize &&
    props.isOnline &&
    props.saveState !== "conflict" &&
    finalizationIssues.length === 0 &&
    !props.isSaving;
  const saveStatus = !props.isOnline
    ? t(
        "encounters.clinicalForm.saveStatusOffline",
        "Offline — changes are only on this device until you reconnect.",
      )
    : props.saveState === "saving"
      ? t(
          "encounters.clinicalForm.saveStatusSaving",
          "Saving closeout draft to the server...",
        )
      : props.saveState === "saved"
        ? props.lastSavedAt
          ? t(
              "encounters.clinicalForm.saveStatusSavedAt",
              "Saved to the server at {time}.",
              {
                time: props.lastSavedAt.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              },
            )
          : t(
              "encounters.clinicalForm.saveStatusSaved",
              "Saved to the server.",
            )
        : props.saveState === "error"
          ? t(
              "encounters.clinicalForm.saveStatusError",
              "Draft save failed. Your changes remain on this device; retry before leaving.",
            )
          : props.saveState === "conflict"
            ? t(
                "encounters.clinicalForm.saveStatusConflict",
                "Another session changed this closeout. Your local version remains visible.",
              )
            : props.saveState === "unsaved"
              ? t(
                  "encounters.clinicalForm.saveStatusUnsaved",
                  "Changes have not reached the server yet.",
                )
              : t(
                  "encounters.clinicalForm.saveStatusReady",
                  "Server draft recovery is ready.",
                );
  const diagnosisField = (
    <div>
      <label className="text-sm font-medium" htmlFor="closeout-diagnosis">
        {t(
          "encounters.clinicalForm.diagnosisSummaryLabel",
          "Diagnosis or visit summary",
        )}{" "}
        <span className="text-muted-foreground">
          {t("encounters.clinicalForm.optional", "(optional)")}
        </span>
      </label>
      <Textarea
        id="closeout-diagnosis"
        value={props.diagnosisSummary}
        onChange={(event) => props.setDiagnosisSummary(event.target.value)}
        rows={3}
        className="mt-1"
      />
    </div>
  );

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h3 className="font-medium">
          1.{" "}
          {props.compact
            ? t(
                "encounters.clinicalForm.fieldOwnerHandoff",
                "Field owner handoff",
              )
            : t(
                "encounters.clinicalForm.clinicalOwnerHandoff",
                "Clinical owner handoff",
              )}
          {props.isAmendment
            ? t("encounters.clinicalForm.amendmentSuffix", " amendment")
            : ""}
        </h3>
        <p className="text-sm text-muted-foreground">
          {props.isAmendment
            ? t(
                "encounters.clinicalForm.amendmentNotice",
                "The current signed discharge remains active until this attributed replacement is finalized.",
              )
            : props.compact
              ? t(
                  "encounters.clinicalForm.compactNotice",
                  "Complete only the outstanding owner-facing decisions. Finalization still creates the same durable discharge record.",
                )
              : t(
                  "encounters.clinicalForm.fullNotice",
                  "Finalized content becomes the durable discharge record and cannot be silently edited.",
                )}
        </p>
      </div>
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          !props.isOnline || props.saveState === "error"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
            : props.saveState === "conflict"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted/20 text-muted-foreground"
        }`}
        role="status"
        aria-live="polite"
      >
        {saveStatus}
      </div>
      {props.saveState === "conflict" ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium">
            {t(
              "encounters.clinicalForm.conflictTitle",
              "Choose which closeout to keep",
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "encounters.clinicalForm.conflictDesc",
              "Use the newest server version, or deliberately replace it with the local fields still visible below. Nothing is overwritten silently.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={props.onUseServer}
            >
              {t(
                "encounters.clinicalForm.useServerVersion",
                "Use server version",
              )}
            </Button>
            <Button type="button" size="sm" onClick={props.onOverwrite}>
              {t(
                "encounters.clinicalForm.overwriteWithLocal",
                "Overwrite with local version",
              )}
            </Button>
          </div>
        </div>
      ) : null}
      {!props.compact ? diagnosisField : null}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="closeout-instructions"
            >
              {t(
                "encounters.clinicalForm.homeCareInstructionsLabel",
                "Home-care instructions",
              )}{" "}
              <span aria-hidden="true">*</span>
            </label>
            <p className="text-xs text-muted-foreground">
              {t(
                "encounters.clinicalForm.homeCareInstructionsDesc",
                "Internal SOAP content is never added automatically. Copy the Plan only as a starting point, then review the owner-facing wording.",
              )}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!props.soapPlan.trim() || props.isSaving}
            onClick={props.onCopySoapPlan}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t(
              "encounters.clinicalForm.copyFromPlanButton",
              "Copy from Plan",
            )}
          </Button>
        </div>
        <div
          className={`mt-2 rounded-md border px-3 py-2 text-xs ${
            props.planCopyState === "copied" ||
            props.planCopyState === "plan_changed"
              ? "border-amber-500/40 bg-amber-500/10"
              : props.planCopyState === "instructions_edited"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-border bg-muted/20 text-muted-foreground"
          }`}
          role="status"
          aria-live="polite"
        >
          {props.planCopyState === "copied"
            ? t(
                "encounters.clinicalForm.planCopiedNotice",
                "Copied from the current Plan. Review and edit the text below before signing the owner handoff.",
              )
            : props.planCopyState === "instructions_edited"
              ? t(
                  "encounters.clinicalForm.planInstructionsEditedNotice",
                  "Owner instructions were edited after the Plan was copied. Verify the final wording before signing.",
                )
              : props.planCopyState === "plan_changed"
                ? t(
                    "encounters.clinicalForm.planChangedNotice",
                    "The SOAP Plan changed after the last copy. Review both records and copy again only if the owner instructions should be replaced.",
                  )
                : props.soapPlan.trim()
                  ? t(
                      "encounters.clinicalForm.planAvailableNotice",
                      "The current Plan is available. Existing owner instructions stay unchanged unless you copy it.",
                    )
                  : t(
                      "encounters.clinicalForm.planEmptyNotice",
                      "Add or load a SOAP Plan before using the copy action.",
                    )}
        </div>
        <Textarea
          id="closeout-instructions"
          value={props.dischargeInstructions}
          onChange={(event) => {
            props.setDischargeInstructions(event.target.value);
            if (event.target.value) props.setNoInstructionsReason("");
          }}
          rows={5}
          className="mt-1"
          placeholder={t(
            "encounters.clinicalForm.dischargeInstructionsPlaceholder",
            "Medication administration, diet, activity, wound care, or monitoring instructions reviewed with the owner.",
          )}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium"
          htmlFor="closeout-no-instructions"
        >
          {t(
            "encounters.clinicalForm.ifNoneReasonLabel",
            "If none, clinical reason",
          )}{" "}
          <span aria-hidden="true">*</span>
        </label>
        <Input
          id="closeout-no-instructions"
          value={props.noInstructionsReason}
          onChange={(event) => {
            props.setNoInstructionsReason(event.target.value);
            if (event.target.value) props.setDischargeInstructions("");
          }}
          className="mt-1"
          placeholder={t(
            "encounters.clinicalForm.ifNoneReasonPlaceholder",
            "Example: No additional home care needed for this technician visit",
          )}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="closeout-warning-signs">
          {t(
            "encounters.clinicalForm.warningSignsLabel",
            "Warning signs and when to call",
          )}{" "}
          <span className="text-muted-foreground">
            {t("encounters.clinicalForm.optional", "(optional)")}
          </span>
        </label>
        <Textarea
          id="closeout-warning-signs"
          value={props.warningSigns}
          onChange={(event) => props.setWarningSigns(event.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>
      {props.compact ? diagnosisField : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-prescriptions"
          >
            {t("encounters.clinicalForm.prescriptionsLabel", "Prescriptions")}{" "}
            <span aria-hidden="true">*</span>
          </label>
          <select
            id="closeout-prescriptions"
            value={props.prescriptionDisposition}
            onChange={(event) =>
              props.setPrescriptionDisposition(
                event.target.value as typeof props.prescriptionDisposition,
              )
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {t("encounters.clinicalForm.selectChoose", "Choose...")}
            </option>
            <option
              value="prescribed"
              disabled={props.linkedMedicationCount === 0}
            >
              {t(
                "encounters.clinicalForm.prescriptionsCreated",
                "Prescription created for this visit",
              )}
            </option>
            <option
              value="not_needed"
              disabled={props.linkedMedicationCount > 0}
            >
              {t(
                "encounters.clinicalForm.noPrescriptionNeeded",
                "No prescription needed",
              )}
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-follow-up">
            {t("encounters.clinicalForm.followUpLabel", "Follow-up")}{" "}
            <span aria-hidden="true">*</span>
          </label>
          <select
            id="closeout-follow-up"
            value={props.followUpDisposition}
            onChange={(event) => {
              const next = event.target
                .value as typeof props.followUpDisposition;
              props.setFollowUpDisposition(next);
              if (next !== "scheduled") props.setFollowUpAppointmentId("");
              if (next !== "needed") {
                props.setFollowUpDueDate("");
                props.setFollowUpAssignedTo("");
              }
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {t("encounters.clinicalForm.selectChoose", "Choose...")}
            </option>
            <option value="none">
              {t("encounters.clinicalForm.followUpNone", "No follow-up needed")}
            </option>
            <option value="needed">
              {t(
                "encounters.clinicalForm.followUpNeeded",
                "Needed — not scheduled yet",
              )}
            </option>
            <option value="scheduled">
              {t("encounters.clinicalForm.followUpScheduled", "Already scheduled")}
            </option>
          </select>
        </div>
      </div>
      {props.followUpDisposition === "scheduled" ? (
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-follow-up-appointment"
          >
            {t(
              "encounters.clinicalForm.scheduledAppointmentLabel",
              "Scheduled appointment",
            )}
          </label>
          <select
            id="closeout-follow-up-appointment"
            value={props.followUpAppointmentId}
            onChange={(event) =>
              props.setFollowUpAppointmentId(event.target.value)
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {t("encounters.clinicalForm.selectChoose", "Choose...")}
            </option>
            {props.followUpAppointments.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatAppointmentTime(candidate.startTime, props.timeZone)}
              </option>
            ))}
          </select>
          {props.followUpAppointments.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "encounters.clinicalForm.noFutureAppointmentNotice",
                "No future appointment is scheduled. Save this draft, create the follow-up from the schedule, then return to finalize.",
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      {props.followUpDisposition === "needed" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="closeout-follow-up-due-date"
            >
              {t(
                "encounters.clinicalForm.followUpDueDateLabel",
                "Follow-up due date",
              )}{" "}
              <span aria-hidden="true">*</span>
            </label>
            <Input
              id="closeout-follow-up-due-date"
              type="date"
              value={props.followUpDueDate}
              onChange={(event) => props.setFollowUpDueDate(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="closeout-follow-up-assignee"
            >
              {t(
                "encounters.clinicalForm.accountableStaffOwnerLabel",
                "Accountable staff owner",
              )}{" "}
              <span aria-hidden="true">*</span>
            </label>
            <select
              id="closeout-follow-up-assignee"
              value={props.followUpAssignedTo}
              onChange={(event) =>
                props.setFollowUpAssignedTo(event.target.value)
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {t("encounters.clinicalForm.selectChoose", "Choose...")}
              </option>
              {props.followUpAssignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name || assignee.email} ·{" "}
                  {assignee.role.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {props.followUpDisposition && props.followUpDisposition !== "none" ? (
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-follow-up-notes"
          >
            {t(
              "encounters.clinicalForm.followUpNotesLabel",
              "Follow-up notes",
            )}{" "}
            <span className="text-muted-foreground">
              {t("encounters.clinicalForm.optional", "(optional)")}
            </span>
          </label>
          <Textarea
            id="closeout-follow-up-notes"
            value={props.followUpNotes}
            onChange={(event) => props.setFollowUpNotes(event.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>
      ) : null}
      {props.soapDraft ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            {t(
              "encounters.clinicalForm.soapDraftInProgressTitle",
              "SOAP draft in progress",
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "encounters.clinicalForm.soapDraftInProgressDesc",
              "Revision {revision} is not part of the signed chart. Finalize or discard it before clinical closeout; a documentation exception cannot leave an unfinished draft behind.",
              { revision: props.soapDraft.revision },
            )}
          </p>
          <Button className="mt-3" size="sm" variant="outline" asChild>
            <a href={props.soapDraftHref}>
              <FileText className="mr-2 h-4 w-4" />
              {t(
                "encounters.clinicalForm.resumeSoapDraft",
                "Resume SOAP draft",
              )}
            </a>
          </Button>
        </div>
      ) : props.missingSoapReplacement ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            {t(
              "encounters.clinicalForm.soapVoidedTitle",
              "The signed SOAP was voided",
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "encounters.clinicalForm.soapVoidedDesc",
              "Create an attributed replacement to keep current clinical documentation linked to this visit. If a replacement is not clinically appropriate—for example, the note belonged to another encounter—document the reason below.",
            )}
          </p>
          <Button className="mt-3" size="sm" asChild>
            <Link href={props.soapReplacementHref ?? props.soapDraftHref}>
              <FileText className="mr-2 h-4 w-4" />
              {t(
                "encounters.clinicalForm.createSignedReplacement",
                "Create signed replacement",
              )}
            </Link>
          </Button>
          <Input
            aria-label={t(
              "encounters.clinicalForm.soapExceptionAriaLabel",
              "SOAP documentation exception",
            )}
            value={props.documentationExceptionReason}
            onChange={(event) =>
              props.setDocumentationExceptionReason(event.target.value)
            }
            className="mt-3"
            placeholder={t(
              "encounters.clinicalForm.replacementSoapNotRequiredPlaceholder",
              "Why a replacement SOAP is not required",
            )}
          />
        </div>
      ) : props.linkedSoapCount === 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            {t(
              "encounters.clinicalForm.noSoapLinkedTitle",
              "No SOAP note is linked",
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "encounters.clinicalForm.noSoapLinkedDesc",
              "Link a SOAP note, or document the bounded exception below.",
            )}
          </p>
          <Input
            aria-label={t(
              "encounters.clinicalForm.soapExceptionAriaLabel",
              "SOAP documentation exception",
            )}
            value={props.documentationExceptionReason}
            onChange={(event) =>
              props.setDocumentationExceptionReason(event.target.value)
            }
            className="mt-2"
            placeholder={t(
              "encounters.clinicalForm.soapNoteNotRequiredPlaceholder",
              "Why a SOAP note is not required",
            )}
          />
        </div>
      ) : null}
      {finalizationIssues.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
          role="status"
        >
          <p className="text-sm font-medium">
            {t(
              "encounters.clinicalForm.beforeFinalizingHeader",
              "Before finalizing",
            )}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {finalizationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={
            props.isSaving || !props.isOnline || props.saveState === "conflict"
          }
          onClick={props.onSave}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("encounters.clinicalForm.saveDraftButton", "Save draft")}
        </Button>
        <Button disabled={!canFinalizeNow} onClick={props.onFinalize}>
          {props.isFinalizing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="mr-2 h-4 w-4" />
          )}
          {t(
            "encounters.clinicalForm.finalizeClinicalHandoffButton",
            "Finalize clinical handoff",
          )}
        </Button>
      </div>
      {!props.canFinalize ? (
        <p className="text-right text-xs text-muted-foreground">
          {t(
            "encounters.clinicalForm.vetMustFinalizeNotice",
            "A veterinarian must finalize doctor-required visit instructions.",
          )}
        </p>
      ) : null}
    </div>
  );
}

function FollowUpResolutionPanel({
  dueDate,
  assigneeName,
  resolution,
  resolutionNotes,
  resolutionScheduledAt,
  resolvedAt,
  resolverName,
  selectedResolution,
  setSelectedResolution,
  resolutionAppointmentId,
  setResolutionAppointmentId,
  notes,
  setNotes,
  followUpAppointments,
  timeZone,
  canResolve,
  isPending,
  onResolve,
}: {
  dueDate: string | null;
  assigneeName: string | null;
  resolution: "scheduled" | "completed" | "not_needed" | null;
  resolutionNotes: string | null;
  resolutionScheduledAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolverName: string | null;
  selectedResolution: "" | "scheduled" | "completed" | "not_needed";
  setSelectedResolution: (
    value: "" | "scheduled" | "completed" | "not_needed",
  ) => void;
  resolutionAppointmentId: string;
  setResolutionAppointmentId: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  followUpAppointments: Array<{ id: string; startTime: Date | string }>;
  timeZone?: string | null;
  canResolve: boolean;
  isPending: boolean;
  onResolve: () => void;
}) {
  const { t } = useI18n();
  const ready = Boolean(
    selectedResolution &&
    (selectedResolution === "scheduled"
      ? resolutionAppointmentId
      : notes.trim()),
  );

  return (
    <div className="space-y-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <div>
        <h3 className="font-medium">
          {t("encounters.followUpPanel.title", "Follow-up obligation")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            "encounters.followUpPanel.auditedNotice",
            "Due {due} · Assigned to {assignee}. This queue state is audited separately from the signed discharge.",
            {
              due: dueDate
                ? formatClinicDate(dueDate)
                : t(
                    "encounters.followUpPanel.dueDateUnavailable",
                    "date unavailable",
                  ),
              assignee:
                assigneeName ??
                t("encounters.followUpPanel.clinicTeam", "clinic team"),
            },
          )}
        </p>
      </div>
      {resolvedAt && resolution ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <p className="font-medium">
            {t("encounters.followUpPanel.resolvedAs", "Resolved as {resolution}", {
              resolution: resolution.replace("_", " "),
            })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {resolverName ??
              t("encounters.followUpPanel.clinicStaff", "Clinic staff")}{" "}
            · {formatAppointmentTime(resolvedAt, timeZone)}
            {resolutionScheduledAt
              ? t(
                  "encounters.followUpPanel.scheduledAtPrefix",
                  " · Scheduled {time}",
                  {
                    time: formatAppointmentTime(
                      resolutionScheduledAt,
                      timeZone,
                    ),
                  },
                )
              : ""}
          </p>
          {resolutionNotes ? (
            <p className="mt-2 whitespace-pre-wrap">{resolutionNotes}</p>
          ) : null}
        </div>
      ) : canResolve ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="closeout-follow-up-resolution"
              >
                {t("encounters.followUpPanel.resolutionLabel", "Resolution")}
              </label>
              <select
                id="closeout-follow-up-resolution"
                value={selectedResolution}
                onChange={(event) => {
                  const next = event.target.value as typeof selectedResolution;
                  setSelectedResolution(next);
                  if (next !== "scheduled") setResolutionAppointmentId("");
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {t("encounters.followUpPanel.selectChoose", "Choose...")}
                </option>
                <option value="scheduled">
                  {t(
                    "encounters.followUpPanel.resolutionScheduled",
                    "Follow-up scheduled",
                  )}
                </option>
                <option value="completed">
                  {t(
                    "encounters.followUpPanel.resolutionCompletedAnotherWay",
                    "Follow-up completed another way",
                  )}
                </option>
                <option value="not_needed">
                  {t(
                    "encounters.followUpPanel.resolutionNotNeeded",
                    "Clinically no longer needed",
                  )}
                </option>
              </select>
            </div>
            {selectedResolution === "scheduled" ? (
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="closeout-resolution-appointment"
                >
                  {t(
                    "encounters.followUpPanel.scheduledAppointmentLabel",
                    "Scheduled appointment",
                  )}
                </label>
                <select
                  id="closeout-resolution-appointment"
                  value={resolutionAppointmentId}
                  onChange={(event) =>
                    setResolutionAppointmentId(event.target.value)
                  }
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">
                    {t("encounters.followUpPanel.selectChoose", "Choose...")}
                  </option>
                  {followUpAppointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {formatAppointmentTime(appointment.startTime, timeZone)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {selectedResolution && selectedResolution !== "scheduled" ? (
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="closeout-resolution-notes"
              >
                {t(
                  "encounters.followUpPanel.resolutionNotesLabel",
                  "Resolution notes",
                )}
              </label>
              <Textarea
                id="closeout-resolution-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1"
                placeholder={t(
                  "encounters.followUpPanel.resolutionNotesPlaceholder",
                  "Document the owner contact or clinical reason.",
                )}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button disabled={!ready || isPending} onClick={onResolve}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t(
                "encounters.followUpPanel.resolveFollowUpButton",
                "Resolve follow-up",
              )}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t(
            "encounters.followUpPanel.mustResolveNotice",
            "A clinic staff member must resolve this obligation from the visit.",
          )}
        </p>
      )}
    </div>
  );
}

function OperationalCloseoutForm({
  activeInvoice,
  chargeDisposition,
  setChargeDisposition,
  invoiceDueDate,
  setInvoiceDueDate,
  minimumDueDate,
  noChargeReason,
  setNoChargeReason,
  handoffMethod,
  setHandoffMethod,
  isPending,
  onDownload,
  onComplete,
}: {
  activeInvoice: {
    id: string;
    status: string;
    itemCount: number;
    total: string;
    paidAmount: string;
    adjustedAmount: string;
    balanceDueCents: number;
    dueDate: Date | string | null;
  } | null;
  chargeDisposition: "" | "paid" | "accounts_receivable" | "no_charge";
  setChargeDisposition: (
    value: "" | "paid" | "accounts_receivable" | "no_charge",
  ) => void;
  invoiceDueDate: string;
  setInvoiceDueDate: (value: string) => void;
  minimumDueDate: string;
  noChargeReason: string;
  setNoChargeReason: (value: string) => void;
  handoffMethod: "" | "print" | "verbal" | "declined";
  setHandoffMethod: (value: "" | "print" | "verbal" | "declined") => void;
  isPending: boolean;
  onDownload: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const paidReady = Boolean(
    activeInvoice &&
    activeInvoice.itemCount > 0 &&
    activeInvoice.status === "paid" &&
    activeInvoice.balanceDueCents === 0,
  );
  const accountsReceivableReady = Boolean(
    activeInvoice &&
    activeInvoice.itemCount > 0 &&
    ["draft", "sent", "overdue"].includes(activeInvoice.status) &&
    invoiceDueDate &&
    invoiceDueDate >= minimumDueDate &&
    activeInvoice.balanceDueCents > 0,
  );
  const zeroDollarInvoiceReady = Boolean(
    activeInvoice &&
    activeInvoice.itemCount > 0 &&
    activeInvoice.status === "draft" &&
    moneyToCents(activeInvoice.total) === 0 &&
    moneyToCents(activeInvoice.paidAmount) === 0 &&
    moneyToCents(activeInvoice.adjustedAmount) === 0 &&
    activeInvoice.balanceDueCents === 0,
  );
  const noChargeReady = !activeInvoice || zeroDollarInvoiceReady;
  const selectedDispositionReady =
    (chargeDisposition === "paid" && paidReady) ||
    (chargeDisposition === "accounts_receivable" && accountsReceivableReady) ||
    (chargeDisposition === "no_charge" &&
      noChargeReady &&
      noChargeReason.trim().length > 0);
  const canComplete =
    selectedDispositionReady && Boolean(handoffMethod) && !isPending;

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h3 className="font-medium">
          {t("encounters.operationalForm.title", "2. Billing and owner handoff")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            "encounters.operationalForm.desc",
            "Confirm the paid, pay-later, or documented no-charge outcome before completing the visit.",
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-charge-state"
          >
            {t(
              "encounters.operationalForm.billingDispositionLabel",
              "Billing disposition",
            )}
          </label>
          <select
            id="closeout-charge-state"
            value={chargeDisposition}
            onChange={(event) =>
              setChargeDisposition(
                event.target.value as typeof chargeDisposition,
              )
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {t("encounters.operationalForm.selectChoose", "Choose...")}
            </option>
            <option value="paid" disabled={!paidReady}>
              {paidReady
                ? t("encounters.operationalForm.invoiceFullyPaid", "Invoice fully paid")
                : t(
                    "encounters.operationalForm.invoiceFullyPaidNotReady",
                    "Invoice fully paid — not ready",
                  )}
            </option>
            <option
              value="accounts_receivable"
              disabled={!accountsReceivableReady}
            >
              {t(
                "encounters.operationalForm.payLater",
                "Pay later — present with due date",
              )}
            </option>
            <option value="no_charge" disabled={!noChargeReady}>
              {zeroDollarInvoiceReady
                ? t(
                    "encounters.operationalForm.noChargeZeroDollar",
                    "No charge — $0 invoice",
                  )
                : noChargeReady
                  ? t(
                      "encounters.operationalForm.noChargeForVisit",
                      "No charge for this visit",
                    )
                  : t(
                      "encounters.operationalForm.noChargeInvoiceHasBalance",
                      "No charge for this visit — invoice has a balance",
                    )}
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-handoff">
            {t("encounters.operationalForm.ownerHandoffLabel", "Owner handoff")}
          </label>
          <select
            id="closeout-handoff"
            value={handoffMethod}
            onChange={(event) =>
              setHandoffMethod(event.target.value as typeof handoffMethod)
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {t("encounters.operationalForm.selectChoose", "Choose...")}
            </option>
            <option value="print">
              {t(
                "encounters.operationalForm.handoffPrint",
                "Printed or downloaded for owner",
              )}
            </option>
            <option value="verbal">
              {t(
                "encounters.operationalForm.handoffVerbal",
                "Reviewed verbally with owner",
              )}
            </option>
            <option value="declined">
              {t(
                "encounters.operationalForm.handoffDeclined",
                "Owner declined instructions",
              )}
            </option>
          </select>
        </div>
      </div>
      {chargeDisposition === "no_charge" ? (
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-no-charge">
            {t("encounters.operationalForm.noChargeReasonLabel", "No-charge reason")}
          </label>
          <Input
            id="closeout-no-charge"
            value={noChargeReason}
            onChange={(event) => setNoChargeReason(event.target.value)}
            className="mt-1"
          />
        </div>
      ) : null}
      {chargeDisposition === "accounts_receivable" ? (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <label
            className="text-sm font-medium"
            htmlFor="closeout-invoice-due-date"
          >
            {t(
              "encounters.operationalForm.paymentDueDateLabel",
              "Payment due date",
            )}
          </label>
          <Input
            id="closeout-invoice-due-date"
            type="date"
            min={minimumDueDate}
            value={invoiceDueDate}
            onChange={(event) => setInvoiceDueDate(event.target.value)}
            className="mt-1 max-w-xs"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              "encounters.operationalForm.paymentDueDateDesc",
              "Completing the visit will present this invoice, preserve its open balance, and place it in accounts receivable. This does not charge a card or send an email automatically.",
            )}
          </p>
        </div>
      ) : null}
      {activeInvoice ? (
        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          {t("encounters.operationalForm.invoiceIsPrefix", "Invoice is")}{" "}
          <strong>{activeInvoice.status}</strong>
          {t(
            "encounters.operationalForm.hasLinesAndBalance",
            ", has {lines}, and a balance of {balance}. ",
            {
              lines:
                activeInvoice.itemCount === 1
                  ? t("encounters.operationalForm.lineSingular", "1 line")
                  : t(
                      "encounters.operationalForm.linePlural",
                      "{count} lines",
                      { count: activeInvoice.itemCount },
                    ),
              balance: formatCurrency(activeInvoice.balanceDueCents / 100),
            },
          )}
          {paidReady
            ? t(
                "encounters.operationalForm.readyPaidCheckout",
                "Ready for paid checkout. ",
              )
            : zeroDollarInvoiceReady
              ? t(
                  "encounters.operationalForm.readyNoChargeCheckout",
                  "Ready for no-charge checkout; the $0 invoice will be finalized without recording a payment. ",
                )
              : accountsReceivableReady
                ? t(
                    "encounters.operationalForm.readyArCheckout",
                    "Ready for accounts-receivable checkout. ",
                  )
                : t(
                    "encounters.operationalForm.saveChargesValidDueDate",
                    "Save charges and choose a valid due date before checkout. ",
                  )}
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link href={`/billing?expand=${activeInvoice.id}`}>
              {t("encounters.operationalForm.openBilling", "Open billing")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            {t(
              "encounters.operationalForm.noActiveInvoiceNotice",
              "No active invoice exists. Choose no charge with a reason, or save visit charges first.",
            )}
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="#charge-capture">
              {t(
                "encounters.operationalForm.captureVisitCharges",
                "Capture visit charges",
              )}
            </a>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t("encounters.operationalForm.downloadDischarge", "Download discharge")}
        </Button>
        <Button disabled={!canComplete} onClick={onComplete}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {t("encounters.operationalForm.completeVisit", "Complete visit")}
        </Button>
      </div>
    </div>
  );
}

function EncounterInvoices({
  appointmentId,
  invoicesQuery,
  visitInvoices,
  canManage,
}: {
  appointmentId: string;
  invoicesQuery: InvoiceQueryState;
  visitInvoices: Array<{
    id: string;
    status: string;
    total: string;
    paidAmount: string;
    adjustedAmount: string;
    isEstimate: boolean;
  }>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const fmt = useCurrencyFormatterWithConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("encounters.invoices.cardTitle", "Invoice state")}</CardTitle>
        <CardDescription>
          {t(
            "encounters.invoices.cardDesc",
            "Charges and payment status linked directly to this visit.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoicesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("encounters.invoices.loadingInvoices", "Loading visit invoices...")}
          </div>
        ) : invoicesQuery.error || !invoicesQuery.data ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.invoices.errorLoading",
              "Unable to load invoice state. Do not create duplicate charges until this is resolved.",
            )}
          </div>
        ) : visitInvoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t(
              "encounters.invoices.emptyTitle",
              "No active invoice for this visit",
            )}
            description={
              canManage
                ? t(
                    "encounters.invoices.emptyDescCanManage",
                    "Add all known services and products in Charge capture to create a visit-linked draft.",
                  )
                : t(
                    "encounters.invoices.emptyDescCannotManage",
                    "An admin or front desk teammate can create this visit's charges.",
                  )
            }
            className="p-8"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visitInvoices.map((invoice) => {
              const paid = Number(invoice.paidAmount ?? 0);
              const adjusted = Number(invoice.adjustedAmount ?? 0);
              const balance = Math.max(
                0,
                Number(invoice.total ?? 0) - paid - adjusted,
              );
              return (
                <div
                  key={invoice.id}
                  className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {invoice.isEstimate
                          ? t("encounters.invoices.estimate", "Estimate")
                          : t("encounters.invoices.invoice", "Invoice")}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "success" : "outline"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "encounters.invoices.totalAndBalance",
                        "Total {total} · Balance {balance}",
                        {
                          total: fmt(invoice.total),
                          balance: fmt(balance),
                        },
                      )}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/billing?expand=${invoice.id}`}>
                      {t("encounters.invoices.openInvoice", "Open invoice")}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <span className="sr-only">
          {t("encounters.invoices.appointmentSrOnly", "Appointment {id}", {
            id: appointmentId,
          })}
        </span>
      </CardContent>
    </Card>
  );
}

function useCurrencyFormatterWithConfig() {
  const config = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  return (value: number | string | null | undefined) =>
    formatCurrency(
      value,
      config.data?.currency ?? "usd",
      config.data?.country ?? "US",
    );
}

function VisitWorkReconciliation({
  appointmentId,
  canManage,
  canCorrect,
  canVoid,
}: {
  appointmentId: string;
  canManage: boolean;
  canCorrect: boolean;
  canVoid: boolean;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const fmt = useCurrencyFormatterWithConfig();
  const reconciliation = trpc.encounters.getVisitReconciliation.useQuery({
    appointmentId,
  });
  const [selectedCharges, setSelectedCharges] = useState<
    Record<string, string>
  >({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const resolve = trpc.encounters.resolveVisitWork.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "encounters.workReconciliation.reconciledToast",
          "Performed item reconciled",
        ),
      );
      utils.encounters.getVisitReconciliation.invalidate({ appointmentId });
    },
    onError: (error) => toast.error(error.message),
  });
  const reopen = trpc.encounters.reopenVisitWork.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "encounters.workReconciliation.reopenedToast",
          "Reconciliation reopened for correction",
        ),
      );
      utils.encounters.getVisitReconciliation.invalidate({ appointmentId });
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card id="visit-work-reconciliation" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>
          {t(
            "encounters.workReconciliation.cardTitle",
            "Performed work reconciliation",
          )}
        </CardTitle>
        <CardDescription>
          {t(
            "encounters.workReconciliation.cardDesc",
            "Every vaccination, lab, procedure, and visit prescription must be linked to a confirmed invoice line or given an attributable no-charge or void/correction reason before checkout.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reconciliation.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "encounters.workReconciliation.checkingWork",
              "Checking performed work...",
            )}
          </div>
        ) : reconciliation.error || !reconciliation.data ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.workReconciliation.stateUnavailable",
              "Reconciliation state is unavailable. Checkout remains blocked until it can be verified.",
            )}
          </div>
        ) : reconciliation.data.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t(
              "encounters.workReconciliation.noItemsRecorded",
              "No visit-owned vaccinations, labs, procedures, or prescriptions have been recorded.",
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
              <span>
                {t(
                  "encounters.workReconciliation.itemsRequiringAttention",
                  "Items requiring attention",
                )}
              </span>
              <Badge
                variant={
                  reconciliation.data.unresolvedCount > 0
                    ? "destructive"
                    : "success"
                }
              >
                {reconciliation.data.unresolvedCount}
              </Badge>
            </div>
            {reconciliation.data.items.map((item) => {
              const unresolved = item.status === "unresolved";
              const staleCharge =
                item.status === "charged" && !item.chargeLinkActive;
              const suggestedCatalog = item.suggestedProductId
                ? `${item.suggestedProductName} (${fmt(item.suggestedProductPrice)})`
                : item.suggestedService
                  ? `${item.suggestedService.name} (${fmt(item.suggestedService.defaultPrice)})`
                  : null;
              const reason = reasons[item.id] ?? "";
              const selectedCharge = selectedCharges[item.id] ?? "";
              return (
                <div
                  key={item.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.sourceLabel}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {item.sourceType}
                      </p>
                    </div>
                    <Badge
                      variant={
                        unresolved || staleCharge ? "destructive" : "outline"
                      }
                    >
                      {staleCharge
                        ? t(
                            "encounters.workReconciliation.chargeRemoved",
                            "charge removed",
                          )
                        : item.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {unresolved || staleCharge ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="text-xs text-muted-foreground">
                        {suggestedCatalog
                          ? t(
                              "encounters.workReconciliation.suggestedCatalogMatch",
                              "Suggested catalog match: {suggestedCatalog}. Add and save it in Charge capture, then link the saved invoice line here.",
                              { suggestedCatalog },
                            )
                          : t(
                              "encounters.workReconciliation.manualMatchHint",
                              "Add and save the appropriate service or product in Charge capture, then link the saved invoice line here. OpenVPM never bills a suggestion automatically.",
                            )}
                      </p>
                      {unresolved && canManage ? (
                        <>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                              aria-label={t(
                                "encounters.workReconciliation.invoiceChargeAriaLabel",
                                "Invoice charge for {label}",
                                { label: item.sourceLabel },
                              )}
                              value={selectedCharge}
                              disabled={resolve.isPending || reopen.isPending}
                              onChange={(event) =>
                                setSelectedCharges((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">
                                {t(
                                  "encounters.workReconciliation.chooseSavedInvoiceLine",
                                  "Choose saved invoice line",
                                )}
                              </option>
                              {reconciliation.data.invoiceItemOptions.map(
                                (charge) => (
                                  <option key={charge.id} value={charge.id}>
                                    {charge.description} ·{" "}
                                    {t(
                                      "encounters.workReconciliation.qtyPrefix",
                                      "qty",
                                    )}{" "}
                                    {charge.quantity} · {fmt(charge.total)}
                                  </option>
                                ),
                              )}
                            </select>
                            <Button
                              variant="outline"
                              disabled={
                                !selectedCharge ||
                                resolve.isPending ||
                                reopen.isPending
                              }
                              onClick={() =>
                                resolve.mutate({
                                  appointmentId,
                                  workItemId: item.id,
                                  resolution: {
                                    status: "charged",
                                    invoiceItemId: selectedCharge,
                                  },
                                })
                              }
                            >
                              {t(
                                "encounters.workReconciliation.linkConfirmedChargeButton",
                                "Link confirmed charge",
                              )}
                            </Button>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={reason}
                              maxLength={500}
                              placeholder={t(
                                "encounters.workReconciliation.reasonPlaceholder",
                                "Reason required for no charge or void/correction",
                              )}
                              aria-label={t(
                                "encounters.workReconciliation.reconciliationReasonAriaLabel",
                                "Reconciliation reason for {label}",
                                { label: item.sourceLabel },
                              )}
                              disabled={resolve.isPending || reopen.isPending}
                              onChange={(event) =>
                                setReasons((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              variant="outline"
                              disabled={
                                reason.trim().length < 3 ||
                                resolve.isPending ||
                                reopen.isPending
                              }
                              onClick={() =>
                                resolve.mutate({
                                  appointmentId,
                                  workItemId: item.id,
                                  resolution: {
                                    status: "no_charge",
                                    reason: reason.trim(),
                                  },
                                })
                              }
                            >
                              {t(
                                "encounters.workReconciliation.noChargeButton",
                                "No charge",
                              )}
                            </Button>
                            {canVoid ? (
                              <Button
                                variant="outline"
                                disabled={
                                  reason.trim().length < 3 ||
                                  resolve.isPending ||
                                  reopen.isPending
                                }
                                onClick={() =>
                                  resolve.mutate({
                                    appointmentId,
                                    workItemId: item.id,
                                    resolution: {
                                      status: "voided",
                                      reason: reason.trim(),
                                    },
                                  })
                                }
                              >
                                {t(
                                  "encounters.workReconciliation.voidCorrectedButton",
                                  "Void/corrected",
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </>
                      ) : staleCharge ? (
                        <p className="text-sm text-destructive">
                          {t(
                            "encounters.workReconciliation.staleChargeNotice",
                            "The linked invoice line is no longer active. Reopen this resolution with a correction reason, fix the invoice, and link the replacement line before checkout.",
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t(
                            "encounters.workReconciliation.teammateMustReconcile",
                            "A clinic teammate with visit access must reconcile this item.",
                          )}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.status === "charged"
                        ? t(
                            "encounters.workReconciliation.linkedChargeSummary",
                            "Linked charge: {desc}",
                            { desc: item.invoiceItemDescription ?? "" },
                          )
                        : item.status === "no_charge"
                          ? t(
                              "encounters.workReconciliation.noChargeReasonSummary",
                              "No-charge reason: {reason}",
                              { reason: item.noChargeReason ?? "" },
                            )
                          : t(
                              "encounters.workReconciliation.voidReasonSummary",
                              "Void/correction reason: {reason}",
                              { reason: item.voidReason ?? "" },
                            )}
                      {item.resolvedByName ? ` · ${item.resolvedByName}` : ""}
                    </p>
                  )}

                  {!unresolved && canCorrect ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                      <Input
                        value={reason}
                        maxLength={500}
                        placeholder={t(
                          "encounters.workReconciliation.correctionReasonPlaceholder",
                          "Why does this reconciliation need correction?",
                        )}
                        aria-label={t(
                          "encounters.workReconciliation.correctionReasonAriaLabel",
                          "Correction reason for {label}",
                          { label: item.sourceLabel },
                        )}
                        disabled={resolve.isPending || reopen.isPending}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        disabled={
                          reason.trim().length < 5 ||
                          resolve.isPending ||
                          reopen.isPending
                        }
                        onClick={() =>
                          reopen.mutate({
                            appointmentId,
                            workItemId: item.id,
                            reason: reason.trim(),
                          })
                        }
                      >
                        {t(
                          "encounters.workReconciliation.reopenForCorrectionButton",
                          "Reopen for correction",
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChargeCapture({
  appointmentId,
  clientId,
  patientId,
  canManage,
  activeInvoice,
  invoiceStateReady,
  invoiceStateLoading,
  linkedPrescriptions,
}: {
  appointmentId: string;
  clientId: string | null;
  patientId: string | null;
  canManage: boolean;
  activeInvoice: { id: string; status: string } | null;
  invoiceStateReady: boolean;
  invoiceStateLoading: boolean;
  linkedPrescriptions: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    quantity: number | null;
    productId: string | null;
    productName: string | null;
    productUnitPrice: string | null;
    productTaxable: boolean | null;
    dispenseChargeId: string | null;
    dispenseChargeStatus: "pending" | "invoiced" | "waived" | null;
    dispenseChargeDescription: string | null;
  }>;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const isOnline = useOnlineStatus();
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loadedInvoiceId, setLoadedInvoiceId] = useState<string | null>(null);
  const lastSavedItemsFingerprintRef = useRef(chargeItemsFingerprint([]));
  const configQuery = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const configReady = Boolean(configQuery.data) && !configQuery.error;
  const activeInvoiceIsDraft = activeInvoice?.status === "draft";
  const invoiceDetailQuery = trpc.billing.getInvoice.useQuery(
    {
      id: activeInvoice?.id ?? "00000000-0000-0000-0000-000000000000",
    },
    { enabled: Boolean(canManage && activeInvoiceIsDraft) },
  );
  const invoiceDetailReady =
    !activeInvoice ||
    (activeInvoiceIsDraft && Boolean(invoiceDetailQuery.data));
  const servicesQuery = trpc.billing.listServices.useQuery(undefined, {
    enabled:
      canManage &&
      configReady &&
      invoiceStateReady &&
      (!activeInvoice || (activeInvoiceIsDraft && invoiceDetailReady)),
  });
  const productsQuery = trpc.billing.listProducts.useQuery(
    { limit: 100 },
    {
      enabled:
        canManage &&
        configReady &&
        invoiceStateReady &&
        (!activeInvoice || (activeInvoiceIsDraft && invoiceDetailReady)),
    },
  );

  useEffect(() => {
    if (!activeInvoice) {
      if (loadedInvoiceId) {
        setItems([]);
        lastSavedItemsFingerprintRef.current = chargeItemsFingerprint([]);
        setLoadedInvoiceId(null);
      }
      return;
    }
    if (
      activeInvoiceIsDraft &&
      invoiceDetailQuery.data?.id === activeInvoice.id &&
      loadedInvoiceId !== activeInvoice.id
    ) {
      const loadedItems = invoiceDetailQuery.data.items.map((item) => ({
        key: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
        itemId: item.itemId ?? undefined,
        taxable: item.taxable,
        sourcePrescriptionId: item.sourcePrescriptionId ?? undefined,
        sourceDispenseChargeId: item.sourceDispenseChargeId ?? undefined,
      }));
      setItems(loadedItems);
      lastSavedItemsFingerprintRef.current =
        chargeItemsFingerprint(loadedItems);
      setLoadedInvoiceId(activeInvoice.id);
    }
  }, [
    activeInvoice,
    activeInvoiceIsDraft,
    invoiceDetailQuery.data,
    loadedInvoiceId,
  ]);

  const catalog = useMemo(() => {
    const services = (servicesQuery.data ?? []).map((service) => ({
      id: `service:${service.id}`,
      itemId: service.id,
      itemType: "service" as const,
      name: service.name,
      code: service.code,
      category: [
        t("encounters.chargeCapture.serviceCategory", "Service"),
        service.category,
      ]
        .filter(Boolean)
        .join(" · "),
      defaultPrice: service.defaultPrice,
      taxable: service.taxable,
      inventoryTracked: null as boolean | null,
      stockQuantity: null as number | null,
      quantity: null as number | null,
      sourcePrescriptionId: undefined as string | undefined,
      sourceDispenseChargeId: undefined as string | undefined,
    }));
    const linkedProductIds = new Set(
      linkedPrescriptions
        .filter(
          (prescription) =>
            prescription.dispenseChargeStatus === "pending" &&
            Boolean(prescription.dispenseChargeDescription) &&
            !requiresPrescriptionInventoryUnitReview({
              description: prescription.dispenseChargeDescription!,
            }),
        )
        .map((prescription) => prescription.productId)
        .filter((id): id is string => Boolean(id)),
    );
    const prescriptionCharges = linkedPrescriptions
      .filter(
        (prescription) =>
          prescription.productId &&
          prescription.productUnitPrice &&
          prescription.quantity &&
          prescription.dispenseChargeId &&
          prescription.dispenseChargeStatus === "pending" &&
          prescription.dispenseChargeDescription &&
          !requiresPrescriptionInventoryUnitReview({
            description: prescription.dispenseChargeDescription,
          }),
      )
      .map((prescription) => ({
        id: `prescription:${prescription.id}`,
        itemId: prescription.productId!,
        itemType: "product" as const,
        name: prescription.dispenseChargeDescription!,
        category: t(
          "encounters.chargeCapture.dispensedPrescriptionCategory",
          "Visit prescription · inventory already dispensed",
        ),
        defaultPrice: prescription.productUnitPrice!,
        taxable: prescription.productTaxable ?? true,
        inventoryTracked: true as boolean | null,
        stockQuantity: null as number | null,
        quantity: prescription.quantity!,
        sourcePrescriptionId: undefined as string | undefined,
        sourceDispenseChargeId: prescription.dispenseChargeId!,
      }));
    const products = (productsQuery.data ?? [])
      .filter((product) => !linkedProductIds.has(product.id))
      .map((product) => ({
        id: `product:${product.id}`,
        itemId: product.id,
        itemType: "product" as const,
        name: product.name,
        category: product.inventoryTracked
          ? t(
              "encounters.chargeCapture.productInStock",
              "Product · {stock} in stock",
              { stock: product.stockQuantity },
            )
          : t(
              "encounters.chargeCapture.productStockNotTracked",
              "Product · stock not tracked",
            ),
        defaultPrice: product.unitPrice,
        taxable: product.taxable,
        inventoryTracked: product.inventoryTracked,
        stockQuantity: product.inventoryTracked ? product.stockQuantity : null,
        quantity: null as number | null,
        sourcePrescriptionId: undefined as string | undefined,
        sourceDispenseChargeId: undefined as string | undefined,
      }));
    return [...prescriptionCharges, ...services, ...products];
  }, [linkedPrescriptions, productsQuery.data, servicesQuery.data, t]);

  const selected = catalog.find((entry) => entry.id === selectedCatalogId);
  const readyVisitPrescriptionCharges = catalog.filter(
    (entry) =>
      entry.sourceDispenseChargeId &&
      !items.some(
        (item) => item.sourceDispenseChargeId === entry.sourceDispenseChargeId,
      ),
  );
  const prescriptionChargesNeedingUnitReview = linkedPrescriptions.filter(
    (prescription) =>
      prescription.dispenseChargeStatus === "pending" &&
      Boolean(prescription.dispenseChargeDescription) &&
      requiresPrescriptionInventoryUnitReview({
        description: prescription.dispenseChargeDescription!,
      }),
  );
  useEffect(() => {
    setQuantity(selected?.quantity ?? 1);
  }, [selected?.id, selected?.quantity]);
  const previewTotals = tryCalculateInvoiceTaxTotals(
    items.map((item) => ({
      lineTotalCents: item.quantity * moneyToCents(item.unitPrice || "0"),
      taxable: item.taxable,
    })),
    configQuery.data?.taxRatePercent ?? "0.00",
  );
  const subtotal = centsToMoney(previewTotals?.subtotalCents ?? 0);
  const tax = centsToMoney(previewTotals?.taxCents ?? 0);
  const total = centsToMoney(previewTotals?.totalCents ?? 0);
  const fmt = (value: number | string | null | undefined) =>
    formatCurrency(
      value,
      configQuery.data?.currency ?? "usd",
      configQuery.data?.country ?? "US",
    );
  const selectedHasStock =
    selected?.itemType !== "product" ||
    Boolean(selected.sourcePrescriptionId) ||
    Boolean(selected.sourceDispenseChargeId) ||
    selected.inventoryTracked === false ||
    (selected.stockQuantity !== null && quantity <= selected.stockQuantity);
  const canAdd =
    Boolean(selected) &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    selectedHasStock &&
    items.length < BILLING_INVOICE_MAX_ITEMS;
  const canSubmit =
    Boolean(clientId && patientId) &&
    isOnline &&
    items.length > 0 &&
    items.every((item) =>
      isBillingInvoiceLineTotalValid(item.unitPrice, item.quantity),
    ) &&
    isBillingInvoiceSubtotalValid(items) &&
    Boolean(previewTotals) &&
    configReady &&
    invoiceStateReady &&
    invoiceDetailReady &&
    (!activeInvoice || activeInvoiceIsDraft);

  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "encounters.chargeCapture.invoiceCreatedToast",
          "Visit charges saved as a draft invoice",
        ),
      );
      setItems([]);
      lastSavedItemsFingerprintRef.current = chargeItemsFingerprint([]);
      setSelectedCatalogId("");
      setQuantity(1);
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
      utils.encounters.getCloseout.invalidate({ appointmentId });
    },
    onError: (error) => toast.error(error.message),
  });
  const updateInvoiceItems = trpc.billing.updateInvoiceItems.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "encounters.chargeCapture.invoiceUpdatedToast",
          "Visit invoice charges updated",
        ),
      );
      lastSavedItemsFingerprintRef.current = chargeItemsFingerprint(items);
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
      utils.encounters.getCloseout.invalidate({ appointmentId });
      if (activeInvoice) {
        utils.billing.getInvoice.invalidate({ id: activeInvoice.id });
      }
    },
    onError: (error) => toast.error(error.message),
  });
  const isSaving = createInvoice.isPending || updateInvoiceItems.isPending;
  const hasUnsavedCharges =
    chargeItemsFingerprint(items) !== lastSavedItemsFingerprintRef.current;
  useUnsavedChangesGuard(
    hasUnsavedCharges,
    t(
      "encounters.chargeCapture.unsavedGuard",
      "Visit charges have not been saved on the server. Leave and lose these changes?",
    ),
  );

  function addCatalogItem(
    entry: (typeof catalog)[number],
    itemQuantity: number,
  ) {
    if (
      items.length >= BILLING_INVOICE_MAX_ITEMS ||
      (entry.sourceDispenseChargeId &&
        items.some(
          (item) =>
            item.sourceDispenseChargeId === entry.sourceDispenseChargeId,
        ))
    ) {
      return;
    }
    setItems((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: entry.name,
        quantity: itemQuantity,
        unitPrice: entry.defaultPrice,
        itemType: entry.itemType,
        itemId: entry.itemId,
        taxable: entry.taxable,
        sourcePrescriptionId: entry.sourcePrescriptionId,
        sourceDispenseChargeId: entry.sourceDispenseChargeId,
      },
    ]);
  }

  function addSelectedItem() {
    if (!selected || !canAdd) return;
    addCatalogItem(selected, quantity);
    setSelectedCatalogId("");
    setQuantity(1);
  }

  function saveCharges() {
    if (!clientId || !patientId || !canSubmit) return;
    const lineItems = items.map(
      ({
        description,
        quantity,
        unitPrice,
        itemType,
        itemId,
        sourcePrescriptionId,
        sourceDispenseChargeId,
      }) => ({
        description,
        quantity,
        unitPrice,
        itemType,
        itemId,
        sourcePrescriptionId,
        sourceDispenseChargeId,
      }),
    );
    if (activeInvoice) {
      if (!invoiceDetailQuery.data) return;
      updateInvoiceItems.mutate({
        id: activeInvoice.id,
        expectedUpdatedAt: invoiceDetailQuery.data.updatedAt,
        items: lineItems,
      });
      return;
    }
    createInvoice.mutate({
      appointmentId,
      clientId,
      patientId,
      items: lineItems,
      isEstimate: false,
    });
  }

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>
          {t("encounters.chargeCapture.cardTitle", "Charge capture")}
        </CardTitle>
        <CardDescription>
          {activeInvoiceIsDraft
            ? t(
                "encounters.chargeCapture.cardDescDraft",
                "Correct or add services and products before this invoice is sent.",
              )
            : t(
                "encounters.chargeCapture.cardDescDefault",
                "Add the services and products performed or dispensed during this visit.",
              )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canManage ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t(
              "encounters.chargeCapture.readOnlyNotice",
              "Charge capture is read-only for your role. An admin or front desk teammate can create the invoice.",
            )}
          </div>
        ) : invoiceStateLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "encounters.chargeCapture.confirmingState",
              "Confirming visit invoice state...",
            )}
          </div>
        ) : !invoiceStateReady ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.lockedStateError",
              "Charge capture is locked because invoice state could not be confirmed. Refresh before creating charges.",
            )}
          </div>
        ) : activeInvoice && !activeInvoiceIsDraft ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t(
              "encounters.chargeCapture.alreadyFinalizedNotice",
              "This visit invoice is already {status}. Open it from Invoice state to collect payment or review the balance. Only unpaid draft charges can be edited.",
              { status: activeInvoice.status },
            )}
          </div>
        ) : activeInvoiceIsDraft && invoiceDetailQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "encounters.chargeCapture.loadingExistingCharges",
              "Loading existing visit charges...",
            )}
          </div>
        ) : activeInvoiceIsDraft &&
          (invoiceDetailQuery.error || !invoiceDetailQuery.data) ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.existingChargesLoadError",
              "Existing charges could not be loaded. Refresh before editing this draft invoice.",
            )}
          </div>
        ) : configQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "encounters.chargeCapture.loadingTaxConfig",
              "Loading practice tax and currency settings...",
            )}
          </div>
        ) : !configReady ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.taxConfigError",
              "Charge capture is locked because tax and currency settings could not be confirmed. Refresh before creating charges.",
            )}
          </div>
        ) : !previewTotals ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.invalidTotalsError",
              "Set the practice tax rate between 0 and 100% and keep the invoice total within the supported currency range before saving charges.",
            )}
          </div>
        ) : !clientId || !patientId ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.missingClientPatientError",
              "Add both a client and patient to the appointment before capturing charges.",
            )}
          </div>
        ) : servicesQuery.error || productsQuery.error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "encounters.chargeCapture.catalogLoadError",
              "Unable to load the charge catalog. Refresh before creating an invoice.",
            )}
          </div>
        ) : servicesQuery.isLoading || productsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "encounters.chargeCapture.loadingServicesAndProducts",
              "Loading services and products...",
            )}
          </div>
        ) : catalog.length === 0 && items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t(
              "encounters.chargeCapture.emptyCatalogTitle",
              "Charge catalog is empty",
            )}
            description={t(
              "encounters.chargeCapture.emptyCatalogDesc",
              "Add services or inventory products before building a visit invoice.",
            )}
            className="p-8"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {!isOnline ? (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                role="status"
              >
                {t(
                  "encounters.chargeCapture.offlineNotice",
                  "Offline — charges stay only in this form. Reconnect before creating or updating the visit invoice.",
                )}
              </div>
            ) : null}
            {readyVisitPrescriptionCharges.length > 0 ? (
              <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3">
                <p className="text-sm font-medium">
                  {t(
                    "encounters.chargeCapture.readyFromThisVisitTitle",
                    "Ready from this visit",
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "encounters.chargeCapture.readyFromThisVisitDesc",
                    "These prescription charges are linked to medication already dispensed during this appointment. Quantity and price use the inventory item's individual dispensing unit. Confirm both before saving the invoice.",
                  )}
                </p>
                <div
                  className="mt-3 flex flex-col gap-2"
                  aria-label={t(
                    "encounters.chargeCapture.readyVisitChargesAriaLabel",
                    "Ready-to-add visit prescription charges",
                  )}
                >
                  {readyVisitPrescriptionCharges.map((entry) => (
                    <Button
                      key={entry.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto justify-between gap-3 whitespace-normal py-2 text-left"
                      aria-label={t(
                        "encounters.chargeCapture.addVisitChargeAriaLabel",
                        "Add visit charge {name}",
                        { name: entry.name },
                      )}
                      disabled={
                        isSaving || items.length >= BILLING_INVOICE_MAX_ITEMS
                      }
                      onClick={() => addCatalogItem(entry, entry.quantity ?? 1)}
                    >
                      <span>{entry.name}</span>
                      <span className="shrink-0 text-right text-muted-foreground">
                        {entry.quantity ?? 1} × {fmt(entry.defaultPrice)}
                        <span className="block font-medium text-foreground">
                          {fmt(
                            centsToMoney(
                              moneyToCents(entry.defaultPrice) *
                                (entry.quantity ?? 1),
                            ),
                          )}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {prescriptionChargesNeedingUnitReview.length > 0 ? (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                role="alert"
              >
                <p className="font-medium">
                  {t(
                    "encounters.chargeCapture.reviewUnitBeforeChargingTitle",
                    "Review medication unit before charging",
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "encounters.chargeCapture.reviewUnitBeforeChargingDesc",
                    "OpenVPM blocked a legacy package-priced dispense snapshot. Do not copy that package price into an invoice. Record an attributable exception for the legacy work item, then add the current inventory product using its verified per-unit price.",
                  )}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {prescriptionChargesNeedingUnitReview.map((prescription) => (
                    <li key={prescription.id}>
                      {prescription.dispenseChargeDescription} ·{" "}
                      {t("encounters.chargeCapture.quantityPrefix", "quantity")}{" "}
                      {prescription.quantity ??
                        t(
                          "encounters.chargeCapture.quantityNotRecorded",
                          "not recorded",
                        )}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                >
                  <Link href="/inventory">
                    {t(
                      "encounters.chargeCapture.reviewInventoryUnitsButton",
                      "Review inventory units",
                    )}
                  </Link>
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_auto] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_80px_auto]">
              <ServicePicker
                services={catalog}
                value={selectedCatalogId}
                onSelect={setSelectedCatalogId}
                disabled={isSaving}
                formatPrice={fmt}
              />
              <Input
                type="number"
                min={1}
                max={selected?.stockQuantity ?? undefined}
                value={quantity}
                aria-label={t(
                  "encounters.chargeCapture.quantityAriaLabel",
                  "Charge quantity",
                )}
                aria-invalid={!selectedHasStock}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canAdd || isSaving}
                onClick={addSelectedItem}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("encounters.chargeCapture.addButton", "Add")}
              </Button>
            </div>

            {!selectedHasStock ? (
              <p className="text-xs font-medium text-destructive">
                {t(
                  "encounters.chargeCapture.quantityExceedsInventoryError",
                  "Quantity exceeds available inventory.",
                )}
              </p>
            ) : null}

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t(
                  "encounters.chargeCapture.noChargesAddedYet",
                  "No charges added yet.",
                )}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.description}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {item.itemType} ·{" "}
                        {item.taxable
                          ? t("encounters.chargeCapture.taxable", "Taxable")
                          : t(
                              "encounters.chargeCapture.notTaxable",
                              "Not taxable",
                            )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t("encounters.chargeCapture.qtyLabel", "Qty")}
                        <Input
                          type="number"
                          min={1}
                          max={10000}
                          value={item.quantity}
                          aria-label={t(
                            "encounters.chargeCapture.itemQtyAriaLabel",
                            "{desc} quantity",
                            { desc: item.description },
                          )}
                          className="w-20 text-foreground"
                          disabled={isSaving}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.key === item.key
                                  ? {
                                      ...candidate,
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t(
                          "encounters.chargeCapture.unitPriceLabel",
                          "Unit price",
                        )}
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          aria-label={t(
                            "encounters.chargeCapture.itemUnitPriceAriaLabel",
                            "{desc} unit price",
                            { desc: item.description },
                          )}
                          className="w-28 text-foreground"
                          disabled={isSaving}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.key === item.key
                                  ? {
                                      ...candidate,
                                      unitPrice: event.target.value,
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        />
                      </label>
                      <span className="flex w-24 flex-col gap-1 text-right text-xs text-muted-foreground">
                        {t(
                          "encounters.chargeCapture.lineTotalLabel",
                          "Line total",
                        )}
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {fmt(item.quantity * Number(item.unitPrice || 0))}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end"
                        aria-label={t(
                          "encounters.chargeCapture.removeItemAriaLabel",
                          "Remove {desc}",
                          { desc: item.description },
                        )}
                        disabled={isSaving}
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (candidate) => candidate.key !== item.key,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-md bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t(
                      "encounters.chargeCapture.subtotalLabel",
                      "Subtotal",
                    )}
                  </span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t(
                      "encounters.chargeCapture.taxLabel",
                      "Tax ({rate}%)",
                      {
                        rate: configQuery.data?.taxRatePercent ?? "0.00",
                      },
                    )}
                  </span>
                  <span>{fmt(tax)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>
                    {t(
                      "encounters.chargeCapture.draftTotalLabel",
                      "Draft total",
                    )}
                  </span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            ) : null}

            <Button disabled={!canSubmit || isSaving} onClick={saveCharges}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="mr-2 h-4 w-4" />
              )}
              {activeInvoiceIsDraft
                ? t(
                    "encounters.chargeCapture.updateInvoiceButton",
                    "Update visit invoice",
                  )
                : t(
                    "encounters.chargeCapture.createInvoiceButton",
                    "Create visit invoice",
                  )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {activeInvoiceIsDraft
                ? t(
                    "encounters.chargeCapture.draftStockNotice",
                    "Unsourced product stock is restored and re-deducted atomically when draft charges change. Visit-prescription stock was already dispensed and is not moved twice.",
                  )
                : t(
                    "encounters.chargeCapture.createStockNotice",
                    "This creates a draft linked to the appointment. Product stock is deducted atomically; visit prescriptions retain their original dispensation.",
                  )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
