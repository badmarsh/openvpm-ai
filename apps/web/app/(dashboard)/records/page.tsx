"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  FileText,
  Syringe,
  Pill,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Scissors,
  Tag,
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  ShieldCheck,
  Thermometer,
  Heart,
  Wind,
  Scale,
  Activity,
} from "lucide-react";
import { StatusPulseBadge } from "@/components/ui/status-pulse-badge";
import { RecordsTimelineSkeleton, TableSkeleton } from "@/components/ui/content-skeletons";
import { trpc } from "@/lib/trpc";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { soapSectionText } from "@/lib/records/soap-content";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import {
  PrescriptionInventoryProductPicker,
  type PrescriptionInventoryProduct,
} from "@/components/records/prescription-inventory-product-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PATIENT_SEARCH_MAX_LENGTH,
  isPatientSearchInputValid,
} from "@/lib/patients/policy";
import type { PrescriptionSafetyWarning } from "@/lib/records/prescription-safety";
import { buildLabTrends } from "@/lib/records/clinical-trends";
import {
  PRESCRIPTION_COUNT_MAX,
  PRESCRIPTION_DOSAGE_MAX_LENGTH,
  PRESCRIPTION_FREQUENCY_MAX_LENGTH,
  PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH,
  PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH,
  PRESCRIPTION_QUANTITY_MIN,
  PRESCRIPTION_REFILLS_MIN,
  isPrescriptionNonnegativeIntegerInputValid,
  isPrescriptionOptionalPositiveIntegerInputValid,
  isPrescriptionOptionalTextInputValid,
  isPrescriptionPositiveIntegerInputValid,
  isPrescriptionRequiredTextInputValid,
} from "@/lib/records/prescription-policy";
import {
  LAB_REFERENCE_MAX,
  LAB_REFERENCE_MIN,
  LAB_REFERENCE_STEP,
  LAB_RESULT_VALUE_MAX_LENGTH,
  LAB_TEST_NAME_MAX_LENGTH,
  LAB_UNIT_MAX_LENGTH,
  isLabOptionalReferenceInputValid,
  isLabOptionalTextInputValid,
  isLabReferenceRangeOrdered,
  isLabRequiredTextInputValid,
} from "@/lib/records/lab-policy";
import {
  VaccinationFormFields,
  initialVaccinationForm,
  isVaccinationFormValid,
  type VaccinationFormState,
} from "@/components/records/vaccination-form-fields";
import {
  PROBLEM_DESCRIPTION_MAX_LENGTH,
  PROBLEM_STATUSES,
  type ProblemStatus,
  isProblemOptionalDateInputValid,
  isProblemRequiredTextInputValid,
} from "@/lib/records/problem-policy";
import {
  PROCEDURE_ANESTHESIA_MAX_LENGTH,
  PROCEDURE_DESCRIPTION_MAX_LENGTH,
  PROCEDURE_DURATION_MAX_MINUTES,
  PROCEDURE_DURATION_MIN_MINUTES,
  PROCEDURE_NAME_MAX_LENGTH,
  PROCEDURE_NOTES_MAX_LENGTH,
  isProcedureOptionalDurationInputValid,
  isProcedureOptionalTextInputValid,
  isProcedureRequiredTextInputValid,
} from "@/lib/records/procedure-policy";

type Tab = "soap" | "vaccinations" | "prescriptions" | "problems" | "labResults" | "procedures";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "soap", label: "SOAP Notes", icon: FileText },
  { id: "vaccinations", label: "Vaccinations", icon: Syringe },
  { id: "prescriptions", label: "Prescriptions", icon: Pill },
  { id: "problems", label: "Problems", icon: ClipboardList },
  { id: "labResults", label: "Lab Results", icon: FlaskConical },
  { id: "procedures", label: "Procedures", icon: Scissors },
];

function isTab(value: string | null): value is Tab {
  return tabs.some((tab) => tab.id === value);
}

function RecordsChartChunkLoading() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-56 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

function PrescriptionLifecycleChunkLoading() {
  return <div className="h-8 w-24 animate-pulse rounded bg-muted" />;
}

const LabTrendCharts = dynamic(
  () =>
    import("@/components/patients/patient-trend-charts").then(
      (mod) => mod.LabTrendCharts
    ),
  {
    ssr: false,
    loading: RecordsChartChunkLoading,
  }
);

const PrescriptionLifecycleControl = dynamic(
  () =>
    import("@/components/records/prescription-lifecycle-control").then(
      (mod) => mod.PrescriptionLifecycleControl,
    ),
  {
    ssr: false,
    loading: PrescriptionLifecycleChunkLoading,
  },
);

const CLINICAL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
};

function clinicalDateInputToUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function dateInputDayNumber(value: string): number | null {
  const date = clinicalDateInputToUtcDate(value);
  if (!date) return null;
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

function formatClinicalDate(
  value: Date | string | null | undefined,
  timeZone?: string | null,
  fallback = "--"
): string {
  if (!value) return fallback;

  if (typeof value === "string") {
    const dateOnly = clinicalDateInputToUtcDate(value);
    if (dateOnly) {
      return dateOnly.toLocaleDateString("en-US", {
        ...CLINICAL_DATE_FORMAT,
        timeZone: "UTC",
      });
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  const options = {
    ...CLINICAL_DATE_FORMAT,
    timeZone: timeZone ?? undefined,
  };

  try {
    return date.toLocaleDateString("en-US", options);
  } catch {
    return date.toLocaleDateString("en-US", {
      ...options,
      timeZone: undefined,
    });
  }
}

function getVaccineDueStatus(
  nextDueDate: string | null,
  timeZone?: string | null
): {
  label: string;
  className: string;
} {
  if (!nextDueDate) return { label: "N/A", className: "text-muted-foreground" };
  const today = formatDateInputForTimeZone(new Date(), timeZone);
  const todayDay = dateInputDayNumber(today);
  const dueDay = dateInputDayNumber(nextDueDate);
  if (todayDay === null || dueDay === null) {
    return { label: "N/A", className: "text-muted-foreground" };
  }
  const daysUntilDue = dueDay - todayDay;

  if (daysUntilDue < 0)
    return {
      label: "Overdue",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  if (daysUntilDue <= 30)
    return {
      label: "Due Soon",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  return {
    label: "Current",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

function getLabStatusBadge(status: string | null) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "reviewed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function isOutOfRange(
  resultValue: string | null,
  low: string | null,
  high: string | null
): boolean {
  if (!resultValue) return false;
  const val = parseFloat(resultValue);
  if (isNaN(val)) return false;
  if (low !== null && low !== undefined) {
    const lowVal = parseFloat(low);
    if (!isNaN(lowVal) && val < lowVal) return true;
  }
  if (high !== null && high !== undefined) {
    const highVal = parseFloat(high);
    if (!isNaN(highVal) && val > highVal) return true;
  }
  return false;
}

function getPrescriptionStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "discontinued":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

// Tabs restricted from front_desk: SOAP Notes, Prescriptions, Lab Results, Procedures
const frontDeskRestrictedTabs: Tab[] = ["soap", "prescriptions", "labResults", "procedures"];

type LabResultFormState = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRangeLow: string;
  referenceRangeHigh: string;
  resultFlag: "unknown" | "normal" | "abnormal" | "critical";
};

type ReplacementPatientOption = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
};

type ProblemFormState = {
  description: string;
  status: ProblemStatus;
  onsetDate: string;
};

type ProcedureFormState = {
  name: string;
  description: string;
  anesthesiaUsed: string;
  durationMinutes: string;
  notes: string;
};

type PrescriptionFormState = {
  medicationName: string;
  productId: string;
  dosage: string;
  frequency: string;
  quantity: string;
  refillsRemaining: string;
  startDate: string;
  endDate: string;
  instructions: string;
  acknowledgeSafetyWarnings: boolean;
};

function initialLabResultForm(): LabResultFormState {
  return {
    testName: "",
    resultValue: "",
    unit: "",
    referenceRangeLow: "",
    referenceRangeHigh: "",
    resultFlag: "unknown",
  };
}

function initialProblemForm(): ProblemFormState {
  return {
    description: "",
    status: "active",
    onsetDate: "",
  };
}

function initialProcedureForm(): ProcedureFormState {
  return {
    name: "",
    description: "",
    anesthesiaUsed: "",
    durationMinutes: "",
    notes: "",
  };
}

function dateInputValue(date: Date, timeZone?: string | null): string {
  return formatDateInputForTimeZone(date, timeZone);
}

function initialPrescriptionForm(timeZone?: string | null): PrescriptionFormState {
  return {
    medicationName: "",
    productId: "",
    dosage: "",
    frequency: "",
    quantity: "",
    refillsRemaining: "0",
    startDate: dateInputValue(new Date(), timeZone),
    endDate: "",
    instructions: "",
    acknowledgeSafetyWarnings: false,
  };
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safetyBadgeVariant(
  warning: PrescriptionSafetyWarning
): "destructive" | "warning" | "secondary" {
  if (warning.severity === "major") return "destructive";
  if (warning.severity === "moderate") return "warning";
  return "secondary";
}

function PrescriptionSafetyPanel({
  medicationName,
  isLoading,
  errorMessage,
  warnings,
}: {
  medicationName: string;
  isLoading: boolean;
  errorMessage?: string;
  warnings: PrescriptionSafetyWarning[];
}) {
  const { t } = useI18n();
  if (medicationName.trim().length < 2) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("records.prescriptions.safetyChecking", "Checking prescription safety")}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {/* Unable to check prescription safety. {errorMessage} */}
        <span>{t("records.prescriptions.safetyCheckError", "Unable to check prescription safety. {error}", { error: errorMessage })}</span>
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        {t("records.prescriptions.noWarnings", "No allergy or active-medication warnings found.")}
      </div>
    );
  }

  const hasBlockingWarning = warnings.some((warning) => warning.requiresOverride);

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        hasBlockingWarning
          ? "border-amber-300 bg-amber-50"
          : "border-border bg-muted/30"
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle
          className={cn(
            "h-4 w-4",
            hasBlockingWarning ? "text-amber-700" : "text-muted-foreground"
          )}
        />
        {t("records.prescriptions.safetyWarningsTitle", "Prescription safety warnings")}
      </div>
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <div
            key={`${warning.type}-${warning.title}-${index}`}
            className="rounded-md border border-border/60 bg-background px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{warning.title}</p>
              <Badge variant={safetyBadgeVariant(warning)} className="capitalize">
                {warning.severity}
              </Badge>
              {warning.requiresOverride && (
                <Badge variant="outline">{t("records.prescriptions.overrideRequired", "Override required")}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {warning.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordsErrorPanel({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  );
}

function RecordsLoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <StatusPulseBadge variant="pending" label={label} size="sm" />
      </div>
      <RecordsTimelineSkeleton />
    </div>
  );
}

function CorrectedLabResultHistory({
  resultId,
  timeZone,
}: {
  resultId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const history = trpc.records.listLabResultHistory.useQuery(
    { id: resultId },
    { enabled: expanded, staleTime: 60_000 }
  );

  return (
    <div className="mt-2 border-t border-border pt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="px-2"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <History className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {expanded ? t("records.labResults.hideEvidenceHistory", "Hide evidence history") : t("records.labResults.showEvidenceHistory", "Show evidence history")}
      </Button>
      {expanded ? (
        <div className="mt-2 space-y-2" aria-live="polite">
          {history.isLoading ? (
            <p className="text-xs text-muted-foreground">{t("records.labResults.loadingEvidence", "Loading evidence…")}</p>
          ) : history.error ? (
            <p role="alert" className="text-xs text-destructive">
              {t("records.labResults.evidenceHistoryError", "Evidence history could not be loaded. {error}", { error: history.error.message })}
            </p>
          ) : history.data?.length ? (
            <ol className="space-y-2">
              {history.data.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md bg-muted/50 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {event.eventType.replaceAll("_", " ")}
                    </span>
                    <span className="text-muted-foreground">
                      {formatClinicalDateTime(
                        event.createdAt,
                        timeZone,
                        t("records.labResults.timeUnavailable", "Time unavailable")
                      )}{" "}
                      · {event.actorName}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {event.resultValue
                      ? `Snapshot: ${event.resultValue}${event.unit ? ` ${event.unit}` : ""}${
                          event.referenceRangeLow != null &&
                          event.referenceRangeHigh != null
                            ? ` · reference ${event.referenceRangeLow}–${event.referenceRangeHigh}`
                            : ""
                        } · ${event.resultFlag}`
                      : t("records.labResults.valuesPending", "Values pending at this event")}
                  </p>
                  {event.note ? <p className="mt-1">{event.note}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("records.labResults.noEventHistory", "No immutable event history is available for this legacy result.")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RecordsPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isOnline = useOnlineStatus();
  const linkedPatientId = searchParams.get("patientId") ?? "";
  const linkedAppointmentId = searchParams.get("appointmentId") ?? "";
  const requestedTab = searchParams.get("tab");
  const shouldOpenNewRecord = searchParams.get("new") === "1";
  const requestedAmendLabResultId = searchParams.get("amendLabResultId");
  const visitContextKey = linkedPatientId ? searchParams.toString() : "";
  const appliedVisitLink = useRef<string | null>(null);
  const appliedSoapHash = useRef<string | null>(null);
  const appliedLabAmendLink = useRef<string | null>(null);
  const prescriptionOperationId = useRef<string | null>(null);
  const labResultCreationOperationId = useRef<string | null>(null);
  const labCorrectionOperationIds = useRef(new Map<string, string>());
  const labReviewOperationIds = useRef(new Map<string, string>());
  const userRole = session?.user?.role;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("soap");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showVaccinationForm, setShowVaccinationForm] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [replacesLabResultId, setReplacesLabResultId] = useState<string | null>(
    null
  );
  const [replacementPatient, setReplacementPatient] =
    useState<ReplacementPatientOption | null>(null);
  const [replacementPatientSearch, setReplacementPatientSearch] = useState("");
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [vaccinationForm, setVaccinationForm] = useState<VaccinationFormState>(
    () => initialVaccinationForm()
  );
  const [problemForm, setProblemForm] = useState<ProblemFormState>(() =>
    initialProblemForm()
  );
  const [labForm, setLabForm] = useState<LabResultFormState>(() =>
    initialLabResultForm()
  );
  const [procedureForm, setProcedureForm] = useState<ProcedureFormState>(() =>
    initialProcedureForm()
  );
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(
    () => initialPrescriptionForm()
  );
  const [selectedPrescriptionProduct, setSelectedPrescriptionProduct] =
    useState<PrescriptionInventoryProduct | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const canSearchPatients = isPatientSearchInputValid(searchQuery);
  const canSearchReplacementPatients =
    Boolean(replacesLabResultId) &&
    isPatientSearchInputValid(replacementPatientSearch);

  const linkedPatientQuery = trpc.patients.getById.useQuery(
    { id: linkedPatientId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(linkedPatientId) }
  );

  useEffect(() => {
    if (
      !visitContextKey ||
      appliedVisitLink.current === visitContextKey ||
      !linkedPatientQuery.data ||
      linkedPatientQuery.data.id !== linkedPatientId
    ) {
      return;
    }
    const linkedPatient = linkedPatientQuery.data;
    setSelectedPatient({
      id: linkedPatient.id,
      name: linkedPatient.name,
      species: linkedPatient.species,
      breed: linkedPatient.breed,
      clientFirstName: linkedPatient.clientFirstName,
      clientLastName: linkedPatient.clientLastName,
    });
    setSearchQuery(linkedPatient.name);
    const linkedTab = requestedTab;
    if (isTab(linkedTab)) {
      setActiveTab(linkedTab);
    }
    setShowVaccinationForm(false);
    setVaccinationForm(initialVaccinationForm());
    setShowLabForm(false);
    setLabForm(initialLabResultForm());
    setReplacesLabResultId(null);
    setReplacementPatient(null);
    setReplacementPatientSearch("");
    setShowProcedureForm(false);
    setProcedureForm(initialProcedureForm());
    setShowPrescriptionForm(false);
    setPrescriptionForm(initialPrescriptionForm());
    if (shouldOpenNewRecord) {
      if (linkedTab === "vaccinations") setShowVaccinationForm(true);
      if (linkedTab === "prescriptions") setShowPrescriptionForm(true);
      if (linkedTab === "labResults") setShowLabForm(true);
      if (linkedTab === "procedures") setShowProcedureForm(true);
    }
    appliedVisitLink.current = visitContextKey;
  }, [
    linkedAppointmentId,
    linkedPatientId,
    linkedPatientQuery.data,
    requestedTab,
    shouldOpenNewRecord,
    visitContextKey,
  ]);

  const {
    data: searchResults,
    isLoading: isSearchingPatients,
    error: patientSearchError,
  } = trpc.patients.search.useQuery(
    { query: trimmedSearchQuery },
    { enabled: canSearchPatients }
  );
  const patientSearchMissing =
    canSearchPatients &&
    !selectedPatient &&
    !isSearchingPatients &&
    !patientSearchError &&
    !searchResults;
  const replacementPatientResults = trpc.patients.search.useQuery(
    { query: replacementPatientSearch.trim() },
    { enabled: canSearchReplacementPatients }
  );

  const patientId = selectedPatient?.id ?? "";
  const visitContextMatchesPatient =
    !linkedAppointmentId ||
    (Boolean(linkedPatientId) && linkedPatientId === patientId);
  const recordsSettings = trpc.records.settings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const vaccinationProviders =
    trpc.records.listVaccinationProviders.useQuery(undefined, {
      enabled: showVaccinationForm,
      staleTime: 5 * 60 * 1000,
    });
  const recordsSettingsError = recordsSettings.error;
  const recordsSettingsLoading = recordsSettings.isLoading;
  const recordsSettingsMissing =
    !recordsSettingsLoading && !recordsSettingsError && !recordsSettings.data;
  const verifiedRecordsSettings =
    recordsSettingsError || recordsSettingsMissing || !recordsSettings.data
      ? null
      : recordsSettings.data;
  const recordsTimeZone = verifiedRecordsSettings
    ? verifiedRecordsSettings.timezone
    : undefined;
  const recordsPracticeName =
    verifiedRecordsSettings?.name ?? "Veterinary Practice";
  const recordsPracticePhone = verifiedRecordsSettings
    ? verifiedRecordsSettings.phone
    : undefined;
  const hasUnsavedRecordForm =
    (showVaccinationForm &&
      JSON.stringify(vaccinationForm) !==
        JSON.stringify(initialVaccinationForm())) ||
    (showProblemForm &&
      JSON.stringify(problemForm) !== JSON.stringify(initialProblemForm())) ||
    (showLabForm &&
      JSON.stringify(labForm) !== JSON.stringify(initialLabResultForm())) ||
    (showProcedureForm &&
      JSON.stringify(procedureForm) !==
        JSON.stringify(initialProcedureForm())) ||
    (showPrescriptionForm &&
      JSON.stringify(prescriptionForm) !==
        JSON.stringify(initialPrescriptionForm(recordsTimeZone)));
  useUnsavedChangesGuard(
    hasUnsavedRecordForm,
    t("records.unsavedChangesWarning", "This clinical record has not been saved on the server. Leave and lose these values?")
  );

  const {
    data: soapNotes,
    isLoading: isLoadingSoapNotes,
    error: soapNotesError,
  } = trpc.records.listSoapNotes.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: patientVitals } = trpc.vitals.listByPatient.useQuery(
    { patientId: patientId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(patientId), staleTime: 60_000 }
  );

  const getNoteVitals = (appointmentId?: string | null, createdAt?: Date | string | null) => {
    if (!patientVitals?.length) return null;
    if (appointmentId) {
      const match = patientVitals.find((v) => v.appointmentId === appointmentId);
      if (match) return match;
    }
    if (createdAt) {
      const noteDateStr = new Date(createdAt).toDateString();
      const match = patientVitals.find(
        (v) => new Date(v.recordedAt).toDateString() === noteDateStr
      );
      if (match) return match;
    }
    return patientVitals[0] ?? null;
  };
  const soapNotesMissing =
    Boolean(patientId) && !isLoadingSoapNotes && !soapNotesError && !soapNotes;
  useEffect(() => {
    if (!soapNotes || typeof window === "undefined") return;
    const match = window.location.hash.match(/^#soap-note-(.+)$/);
    const noteId = match?.[1];
    if (
      !noteId ||
      appliedSoapHash.current === noteId ||
      !soapNotes.some((note) => note.id === noteId)
    ) {
      return;
    }
    appliedSoapHash.current = noteId;
    setActiveTab("soap");
    setExpandedNoteId(noteId);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`soap-note-${noteId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [soapNotes]);
  const correctSoap = trpc.records.markSoapNoteEnteredInError.useMutation({
    onSuccess: async () => {
      toast.success(t("records.soap.soapVoidSuccess", "SOAP note retained and marked entered in error"));
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (error) => toast.error(error.message),
  });
  const [addendumNoteId, setAddendumNoteId] = useState<string | null>(null);
  const [addendumContent, setAddendumContent] = useState("");
  const [addendumOperationId, setAddendumOperationId] = useState<string | null>(
    null,
  );
  const addSoapAddendum = trpc.records.addSoapNoteAddendum.useMutation({
    onSuccess: async () => {
      setAddendumNoteId(null);
      setAddendumContent("");
      setAddendumOperationId(null);
      toast.success(t("records.soap.addendumSuccess", "Addendum added to the finalized record"));
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (error) => toast.error(error.message),
  });
  const {
    data: vaccinations,
    isLoading: isLoadingVaccinations,
    error: vaccinationsError,
    refetch: refetchVaccinations,
  } = trpc.records.listVaccinations.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const vaccinationsMissing =
    Boolean(patientId) &&
    !isLoadingVaccinations &&
    !vaccinationsError &&
    !vaccinations;
  const correctVaccination =
    trpc.records.markVaccinationEnteredInError.useMutation({
      onSuccess: async () => {
        toast.success(t("records.vaccinations.saveSuccess", "Vaccination retained and marked entered in error"));
        await utils.records.listVaccinations.invalidate({ patientId });
      },
      onError: (error) => toast.error(error.message),
    });
  const {
    data: prescriptionsList,
    isLoading: isLoadingPrescriptions,
    error: prescriptionsError,
    refetch: refetchPrescriptions,
  } =
    trpc.records.listPrescriptions.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const prescriptionsMissing =
    Boolean(patientId) &&
    !isLoadingPrescriptions &&
    !prescriptionsError &&
    !prescriptionsList;
  const {
    data: problems,
    isLoading: isLoadingProblems,
    error: problemsError,
    refetch: refetchProblems,
  } = trpc.records.listProblems.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const problemsMissing =
    Boolean(patientId) && !isLoadingProblems && !problemsError && !problems;
  const {
    data: labResultsList,
    isLoading: isLoadingLabResults,
    error: labResultsError,
    refetch: refetchLabResults,
  } =
    trpc.records.listLabResults.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const labResultsMissing =
    Boolean(patientId) &&
    !isLoadingLabResults &&
    !labResultsError &&
    !labResultsList;
  const replacementSourceLabResult = replacesLabResultId
    ? labResultsList?.find((result) => result.id === replacesLabResultId) ?? null
    : null;
  const labTrendGroups = useMemo(
    () =>
      buildLabTrends(
        (labResultsList ?? []).filter((result) => !result.correctionId),
        recordsTimeZone
      ),
    [labResultsList, recordsTimeZone]
  );
  const {
    data: proceduresList,
    isLoading: isLoadingProcedures,
    error: proceduresError,
    refetch: refetchProcedures,
  } =
    trpc.records.listProcedures.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const proceduresMissing =
    Boolean(patientId) &&
    !isLoadingProcedures &&
    !proceduresError &&
    !proceduresList;
  const canPrescribe = userRole === "admin" || userRole === "veterinarian";
  const canCorrectClinicalRecords =
    userRole === "admin" || userRole === "veterinarian";
  const canCreateVaccinations =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canManageProblems =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canManageLabResults =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canReviewLabResults =
    userRole === "admin" || userRole === "veterinarian";

  useEffect(() => {
    if (
      !canCorrectClinicalRecords ||
      !requestedAmendLabResultId ||
      appliedLabAmendLink.current === requestedAmendLabResultId
    ) {
      return;
    }
    const source = labResultsList?.find(
      (result) => result.id === requestedAmendLabResultId
    );
    if (!source || !source.correctionId || source.replacementLabResultId) return;
    setActiveTab("labResults");
    setLabForm({
      testName: source.testName,
      resultValue: "",
      unit: "",
      referenceRangeLow: "",
      referenceRangeHigh: "",
      resultFlag: "unknown",
    });
    setReplacesLabResultId(source.id);
    setReplacementPatient(selectedPatient);
    setReplacementPatientSearch("");
    setShowLabForm(true);
    labResultCreationOperationId.current = null;
    appliedLabAmendLink.current = source.id;
  }, [
    canCorrectClinicalRecords,
    labResultsList,
    requestedAmendLabResultId,
    selectedPatient,
  ]);
  const canCreateProcedures =
    userRole === "admin" || userRole === "veterinarian";
  const medicationNameForSafety = prescriptionForm.medicationName.trim();
  const prescriptionSafetyEnabled =
    canPrescribe &&
    showPrescriptionForm &&
    !!patientId &&
    medicationNameForSafety.length >= 2;
  const prescriptionSafety = trpc.records.checkPrescriptionSafety.useQuery(
    { patientId, medicationName: medicationNameForSafety },
    {
      enabled: prescriptionSafetyEnabled,
    }
  );
  const prescriptionSafetyMissing =
    prescriptionSafetyEnabled &&
    !prescriptionSafety.isFetching &&
    !prescriptionSafety.error &&
    !prescriptionSafety.data;
  const prescriptionSafetyUnavailable =
    prescriptionSafetyEnabled &&
    (prescriptionSafety.isFetching ||
      Boolean(prescriptionSafety.error) ||
      prescriptionSafetyMissing ||
      !prescriptionSafety.data);
  const verifiedPrescriptionSafety =
    prescriptionSafetyEnabled &&
    !prescriptionSafetyUnavailable &&
    prescriptionSafety.data
      ? prescriptionSafety.data
      : null;
  const linkedPrescriptionProduct = prescriptionForm.productId
    ? selectedPrescriptionProduct
    : null;
  const prescriptionQuantity = optionalNumber(prescriptionForm.quantity);
  const hasValidPrescriptionQuantityForInventory =
    !prescriptionForm.productId ||
    (isPrescriptionPositiveIntegerInputValid(prescriptionForm.quantity) &&
      linkedPrescriptionProduct !== null &&
      prescriptionQuantity !== undefined &&
      prescriptionQuantity <= linkedPrescriptionProduct.stockQuantity);
  const visibleTabs = tabs.filter(
    (tab) =>
      userRole !== "front_desk" || !frontDeskRestrictedTabs.includes(tab.id)
  );
  const currentTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id;

  async function refreshLinkedVisit() {
    if (!linkedAppointmentId) return;
    await Promise.all([
      utils.encounters.getCloseout.invalidate({
        appointmentId: linkedAppointmentId,
      }),
      utils.encounters.getVisitReconciliation.invalidate({
        appointmentId: linkedAppointmentId,
      }),
    ]);
  }

  const createVaccination = trpc.records.createVaccination.useMutation({
    onSuccess: async () => {
      toast.success(t("records.vaccinations.recordedSuccess", "Vaccination recorded"));
      await Promise.all([refetchVaccinations(), refreshLinkedVisit()]);
      setShowVaccinationForm(false);
      setVaccinationForm(initialVaccinationForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createProblem = trpc.records.createProblem.useMutation({
    onSuccess: () => {
      toast.success(t("records.problems.addedSuccess", "Problem added"));
      refetchProblems();
      setShowProblemForm(false);
      setProblemForm(initialProblemForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateProblemStatus = trpc.records.updateProblemStatus.useMutation({
    onSuccess: () => {
      toast.success(t("records.problems.statusUpdatedSuccess", "Problem status updated"));
      refetchProblems();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createLabResult = trpc.records.createLabResult.useMutation({
    onSuccess: async (result) => {
      toast.success(
        replacesLabResultId
          ? t("records.labResults.replacementCreatedSuccess", "Replacement lab result created")
          : t("records.labResults.createdSuccess", "Lab result created")
      );
      await Promise.all([
        refetchLabResults(),
        utils.records.listLabReviewInbox.invalidate(),
        refreshLinkedVisit(),
      ]);
      setShowLabForm(false);
      setLabForm(initialLabResultForm());
      setReplacesLabResultId(null);
      labResultCreationOperationId.current = null;
      if (replacementPatient && result.patientId === replacementPatient.id) {
        setSelectedPatient(replacementPatient);
        setSearchQuery(replacementPatient.name);
        router.replace(
          `/records?patientId=${replacementPatient.id}&tab=labResults#lab-result-${result.id}`
        );
      }
      setReplacementPatient(null);
      setReplacementPatientSearch("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const correctLabResult = trpc.records.markLabResultEnteredInError.useMutation(
    {
      onSuccess: async (correction) => {
        toast.success(t("records.labResults.voidSuccess", "Lab result retained and marked entered in error"));
        if (correction.labResultId) {
          labCorrectionOperationIds.current.delete(correction.labResultId);
        }
        await Promise.all([
          refetchLabResults(),
          utils.records.listLabReviewInbox.invalidate(),
        ]);
      },
      onError: (error) => toast.error(error.message),
    }
  );
  const updateLabResultStatus = trpc.records.updateLabResultStatus.useMutation({
    onSuccess: (result) => {
      toast.success(t("records.labResults.statusUpdatedSuccess", "Lab result status updated"));
      labReviewOperationIds.current.delete(result.id);
      refetchLabResults();
      utils.records.listLabReviewInbox.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createProcedure = trpc.records.createProcedure.useMutation({
    onSuccess: async () => {
      toast.success(t("records.procedures.recordedSuccess", "Procedure recorded"));
      await Promise.all([refetchProcedures(), refreshLinkedVisit()]);
      setShowProcedureForm(false);
      setProcedureForm(initialProcedureForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createPrescription = trpc.records.createPrescription.useMutation({
    onSuccess: async () => {
      toast.success(t("records.prescriptions.createdSuccess", "Prescription created"));
      await Promise.all([refetchPrescriptions(), refreshLinkedVisit()]);
      setShowPrescriptionForm(false);
      setPrescriptionForm(initialPrescriptionForm(recordsTimeZone));
      prescriptionOperationId.current = null;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const canSubmitVaccination =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isVaccinationFormValid(vaccinationForm) &&
    !createVaccination.isPending;
  const canSubmitProblem =
    Boolean(patientId) &&
    isOnline &&
    isProblemRequiredTextInputValid(
      problemForm.description,
      PROBLEM_DESCRIPTION_MAX_LENGTH
    ) &&
    PROBLEM_STATUSES.includes(problemForm.status) &&
    isProblemOptionalDateInputValid(problemForm.onsetDate) &&
    !createProblem.isPending;
  const canSubmitLabResult =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    (!linkedAppointmentId || !replacesLabResultId) &&
    (!replacesLabResultId || Boolean(replacementPatient)) &&
    (!replacesLabResultId || Boolean(labForm.resultValue.trim())) &&
    isLabRequiredTextInputValid(labForm.testName, LAB_TEST_NAME_MAX_LENGTH) &&
    isLabOptionalTextInputValid(
      labForm.resultValue,
      LAB_RESULT_VALUE_MAX_LENGTH
    ) &&
    isLabOptionalTextInputValid(labForm.unit, LAB_UNIT_MAX_LENGTH) &&
    isLabOptionalReferenceInputValid(labForm.referenceRangeLow) &&
    isLabOptionalReferenceInputValid(labForm.referenceRangeHigh) &&
    isLabReferenceRangeOrdered(
      labForm.referenceRangeLow,
      labForm.referenceRangeHigh
    ) &&
    !createLabResult.isPending;
  const canSubmitProcedure =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isProcedureRequiredTextInputValid(
      procedureForm.name,
      PROCEDURE_NAME_MAX_LENGTH
    ) &&
    isProcedureOptionalTextInputValid(
      procedureForm.description,
      PROCEDURE_DESCRIPTION_MAX_LENGTH
    ) &&
    isProcedureOptionalTextInputValid(
      procedureForm.anesthesiaUsed,
      PROCEDURE_ANESTHESIA_MAX_LENGTH
    ) &&
    isProcedureOptionalDurationInputValid(procedureForm.durationMinutes) &&
    isProcedureOptionalTextInputValid(
      procedureForm.notes,
      PROCEDURE_NOTES_MAX_LENGTH
    ) &&
    !createProcedure.isPending;
  const canSubmitPrescription =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.medicationName,
      PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH
    ) &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.dosage,
      PRESCRIPTION_DOSAGE_MAX_LENGTH
    ) &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.frequency,
      PRESCRIPTION_FREQUENCY_MAX_LENGTH
    ) &&
    isPrescriptionOptionalPositiveIntegerInputValid(
      prescriptionForm.quantity
    ) &&
    isPrescriptionNonnegativeIntegerInputValid(
      prescriptionForm.refillsRemaining
    ) &&
    isPrescriptionOptionalTextInputValid(
      prescriptionForm.instructions,
      PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH
    ) &&
    Boolean(prescriptionForm.startDate) &&
    (!prescriptionForm.endDate ||
      prescriptionForm.endDate >= prescriptionForm.startDate) &&
    hasValidPrescriptionQuantityForInventory &&
    !prescriptionSafetyUnavailable &&
    (!verifiedPrescriptionSafety?.requiresOverride ||
      prescriptionForm.acknowledgeSafetyWarnings) &&
    !createPrescription.isPending;

  const tabLabels: Record<Tab, string> = {
    soap: t("records.tabs.soap", "SOAP Notes"),
    vaccinations: t("records.tabs.vaccinations", "Vaccinations"),
    prescriptions: t("records.tabs.prescriptions", "Prescriptions"),
    problems: t("records.tabs.problems", "Problems"),
    labResults: t("records.tabs.labResults", "Lab Results"),
    procedures: t("records.tabs.procedures", "Procedures"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("records.title", "Medical Records")}
        subtitle={t("records.subtitle", "Clinical documentation and patient history")}
      />

      {/* Patient Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("records.searchPlaceholder", "Search patients by patient or owner name...")}
            value={searchQuery}
            maxLength={PATIENT_SEARCH_MAX_LENGTH}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSelectedPatient(null);
            }}
            className="h-11 pl-10 sm:h-10"
          />
        </div>

        {/* Search Dropdown */}
        {canSearchPatients &&
          !selectedPatient &&
          (isSearchingPatients ||
            patientSearchError ||
            patientSearchMissing ||
            searchResults) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {patientSearchError || patientSearchMissing ? (
              <div className="px-4 py-3 text-sm text-destructive">
                {patientSearchError?.message ??
                  t("records.searchError", "Unable to search patients. Please retry.")}
              </div>
            ) : isSearchingPatients ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("records.searchingPatients", "Searching patients...")}
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {t("records.noPatientsFound", "No patients found")}
              </div>
            ) : (
              searchResults?.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchQuery(patient.name);
                    setShowVaccinationForm(false);
                    setVaccinationForm(initialVaccinationForm());
                    setShowProblemForm(false);
                    setProblemForm(initialProblemForm());
                    setShowLabForm(false);
                    setLabForm(initialLabResultForm());
                    setShowProcedureForm(false);
                    setProcedureForm(initialProcedureForm());
                    setShowPrescriptionForm(false);
                    setPrescriptionForm(initialPrescriptionForm());
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  <div>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {patient.species
                        ? patient.species.charAt(0).toUpperCase() +
                          patient.species.slice(1)
                        : ""}
                      {patient.breed ? ` - ${patient.breed}` : ""}
                    </span>
                  </div>
                  {patient.clientFirstName && (
                    <span className="text-xs text-muted-foreground">
                      {t("records.ownerLabel", "Owner: {firstName} {lastName}", {
                        firstName: patient.clientFirstName,
                        lastName: patient.clientLastName ?? "",
                      })}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Patient Banner */}
      {selectedPatient && (
        <div className="mt-4 flex flex-col items-stretch gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <span className="block truncate font-medium sm:inline">
              {selectedPatient.name}
            </span>
            <span className="block truncate text-muted-foreground sm:ml-2 sm:inline">
              {selectedPatient.species
                ? selectedPatient.species.charAt(0).toUpperCase() +
                  selectedPatient.species.slice(1)
                : ""}
              {selectedPatient.breed ? ` - ${selectedPatient.breed}` : ""}
            </span>
            {selectedPatient.clientFirstName && (
              <span className="block truncate text-muted-foreground sm:ml-3 sm:inline">
                {t("records.ownerLabel", "Owner: {firstName} {lastName}", {
                  firstName: selectedPatient.clientFirstName,
                  lastName: selectedPatient.clientLastName ?? "",
                })}
              </span>
            )}
          </div>
          {!linkedAppointmentId ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => {
                setSelectedPatient(null);
                setSearchQuery("");
                setShowVaccinationForm(false);
                setVaccinationForm(initialVaccinationForm());
                setShowProblemForm(false);
                setProblemForm(initialProblemForm());
                setShowLabForm(false);
                setLabForm(initialLabResultForm());
                setShowProcedureForm(false);
                setProcedureForm(initialProcedureForm());
                setShowPrescriptionForm(false);
                setPrescriptionForm(initialPrescriptionForm());
              }}
            >
              {t("records.changePatient", "Change Patient")}
            </Button>
          ) : null}
        </div>
      )}

      {selectedPatient &&
      linkedAppointmentId &&
      linkedPatientId === selectedPatient.id ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("records.recordingForThisVisit", "Recording for this visit")}</p>
            <p className="mt-0.5 text-xs">
              {t("records.recordingForThisVisitDesc", "New clinical work created here will stay attached to the active appointment and appear in checkout reconciliation.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              asChild
            >
              <Link href={`/encounters/${linkedAppointmentId}`}>
                {t("records.backToVisit", "Back to visit")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              asChild
            >
              <Link
                href={`/records?patientId=${encodeURIComponent(linkedPatientId)}&tab=${encodeURIComponent(requestedTab ?? "soap")}`}
              >
                {t("records.leaveVisitContext", "Leave visit context")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {selectedPatient && !isOnline ? (
        <div
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          {t("records.offlineBanner", "Offline — clinical forms stay only on this device. Keep this page open and reconnect before saving a record.")}
        </div>
      ) : null}

      {/* Tabs */}
      {selectedPatient && (
        <>
          <div className="mt-6 max-w-full overflow-x-auto border-b border-border">
            <div className="flex min-w-max gap-0">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex min-h-11 shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                      currentTab === tab.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tabLabels[tab.id]}
                    {currentTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {recordsSettingsError || recordsSettingsMissing ? (
              <RecordsErrorPanel
                message={
                  // Unable to load records settings. ${recordsSettingsError.message}
                  recordsSettingsError
                    ? t("records.settingsErrorWithMsg", "Unable to load records settings. {message}", { message: recordsSettingsError.message })
                    : t("records.settingsError", "Unable to load records settings. Please retry.")
                }
              />
            ) : recordsSettingsLoading ? (
              <>
                {/* <RecordsLoadingPanel label="Loading records settings..." /> */}
                <RecordsLoadingPanel label={t("records.loadingSettings", "Loading records settings...")} />
              </>
            ) : (
              <>
            {/* SOAP Notes Tab */}
            {currentTab === "soap" && (
              <div>
                {soapNotesError || soapNotesMissing ? (
                  <RecordsErrorPanel
                    message={
                      soapNotesError
                        ? t("records.soap.loadErrorWithMsg", "Unable to load SOAP notes. {message}", { message: soapNotesError.message })
                        : t("records.soap.loadError", "Unable to load SOAP notes. Please retry.")
                    }
                  />
                ) : isLoadingSoapNotes ? (
                  <RecordsTimelineSkeleton />
                ) : soapNotes && soapNotes.length > 0 ? (
                  <div className="space-y-4">
                        {soapNotes.map((note) => {
                          const isExpanded = expandedNoteId === note.id;
                          const hasOtherCurrentAppointmentSoap = Boolean(
                            note.appointmentId &&
                            soapNotes.some(
                              (candidate) =>
                                candidate.id !== note.id &&
                                candidate.appointmentId ===
                                  note.appointmentId &&
                                candidate.status === "finalized" &&
                                !candidate.correctionId,
                            ),
                          );
                          const hasAppointmentSoapDraft = Boolean(
                            note.appointmentId &&
                            soapNotes.some(
                              (candidate) =>
                                candidate.id !== note.id &&
                                candidate.appointmentId ===
                                  note.appointmentId &&
                                candidate.status === "draft",
                            ),
                          );
                          const noteVitals = getNoteVitals(note.appointmentId, note.createdAt);

                          return (
                            <div
                              key={note.id}
                              id={`soap-note-${note.id}`}
                              className={cn(
                                "relative overflow-hidden rounded-xl border border-border/80 bg-card/80 backdrop-blur-xs shadow-xs transition-all hover:border-border hover:shadow-sm",
                                note.correctionId &&
                                  "border-destructive/40 bg-destructive/5",
                              )}
                            >
                              <button
                                onClick={() =>
                                  setExpandedNoteId(isExpanded ? null : note.id)
                                }
                                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold font-mono tabular-nums text-foreground">
                                        {note.createdAt
                                          ? formatClinicalDate(
                                              note.createdAt,
                                              recordsTimeZone,
                                            )
                                          : t("records.soap.noDate", "No date")}
                                      </p>
                                      {note.imported ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                          {t("records.soap.importedBadge", "Imported")}
                                        </span>
                                      ) : null}
                                      <StatusPulseBadge
                                        variant={note.status === "draft" ? "pending" : "confirmed"}
                                        label={
                                          note.status === "draft"
                                            ? t("records.soap.draftBadge", "Draft")
                                            : t("records.soap.finalizedBadge", "Finalized")
                                        }
                                        size="sm"
                                      />
                                      {note.correctionId ? (
                                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                          {t("records.enteredInError", "Entered in error")}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {note.imported
                                        ? note.authorName
                                          ? t("records.soap.importedBy", "Imported by {name}", { name: note.authorName })
                                          : t("records.soap.importedRecord", "Imported record")
                                        : (note.authorName ?? t("records.soap.unknownAuthor", "Unknown author"))}
                                    </p>
                                  </div>
                                  <p className="hidden md:block text-sm text-muted-foreground line-clamp-1 max-w-md ml-2 pl-4 border-l border-border/60">
                                    {soapSectionText(
                                      note.assessment ||
                                        note.subjective ||
                                        note.objective ||
                                        note.plan,
                                    ) || t("records.soap.noNoteRecorded", "No note recorded")}
                                  </p>
                                </div>
                                <div className="shrink-0 ml-3">
                                  {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t border-border/70 px-5 py-5 space-y-5 bg-card/40">
                                  {/* Finalized Clinician Approved Seal / Resume Draft Banner */}
                                  {note.status === "finalized" ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-900 dark:text-emerald-200 shadow-2xs">
                                      <div className="flex items-center gap-2.5">
                                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <div>
                                          <p className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                            <span>{t("records.soap.clinicianApproved", "Clinician Approved")}</span>
                                            <span className="text-[10px] opacity-75">· {t("records.soap.legalTamperProof", "Zákonný klinický záznam")}</span>
                                          </p>
                                          <p className="text-[11px] font-mono tabular-nums opacity-90">
                                            {note.finalizerName ?? t("records.soap.unknownClinician", "Unknown clinician")}
                                            {note.finalizedAt ? ` · ${formatClinicalDateTime(note.finalizedAt, recordsTimeZone)}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                                        SEALED & VERIFIED
                                      </span>
                                    </div>
                                  ) : note.appointmentId &&
                                    canCorrectClinicalRecords ? (
                                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-center justify-between">
                                      <span className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                                        {t("records.soap.draftNotice", "Tento záznam je v štádiu konceptu.")}
                                      </span>
                                      <a
                                        href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                                        className="inline-flex text-xs font-semibold text-primary hover:underline"
                                      >
                                        {t("records.soap.resumeDraft", "Resume draft")} →
                                      </a>
                                    </div>
                                  ) : null}

                                  {note.replacesSoapNoteId ? (
                                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                                      <p className="font-medium text-primary">
                                        {t("records.soap.currentReplacementSoap", "Current replacement SOAP")}
                                      </p>
                                      <a
                                        href={`#soap-note-${note.replacesSoapNoteId}`}
                                        className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                                      >
                                        {t("records.soap.viewRetainedOriginal", "View retained original")}
                                      </a>
                                    </div>
                                  ) : null}

                                  {/* Vitals Quick-Stats Strip */}
                                  {noteVitals && (
                                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 shadow-2xs">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                          <Activity className="h-3.5 w-3.5 text-primary" />
                                          {t("records.soap.vitalsSnapshot", "Visit Vitals Quick-Stats")}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                          {formatClinicalDateTime(noteVitals.recordedAt, recordsTimeZone)}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums">
                                        <div className="flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-border/50">
                                          <Thermometer className="h-4 w-4 text-amber-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-sans font-medium">Temp</p>
                                            <p className="font-semibold">{noteVitals.temperatureC ? `${noteVitals.temperatureC} °C` : "—"}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-border/50">
                                          <Heart className="h-4 w-4 text-rose-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-sans font-medium">Heart Rate</p>
                                            <p className="font-semibold">{noteVitals.heartRateBpm ? `${noteVitals.heartRateBpm} bpm` : "—"}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-border/50">
                                          <Wind className="h-4 w-4 text-sky-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-sans font-medium">Resp. Rate</p>
                                            <p className="font-semibold">{noteVitals.respiratoryRateBpm ? `${noteVitals.respiratoryRateBpm} /min` : "—"}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-border/50">
                                          <Scale className="h-4 w-4 text-emerald-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-sans font-medium">Weight</p>
                                            <p className="font-semibold">{noteVitals.weightKg ? `${noteVitals.weightKg} kg` : "—"}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-border/50">
                                          <Activity className="h-4 w-4 text-violet-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-sans font-medium">BCS Score</p>
                                            <p className="font-semibold">{noteVitals.bodyConditionScore ? `${noteVitals.bodyConditionScore}/${noteVitals.bodyConditionScale ?? 9}` : "—"}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Structured S-O-A-P blocks */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                                    {/* Subjective */}
                                    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.03] p-4 space-y-2 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-800 dark:text-sky-300">
                                          S · {t("records.soap.subjective", "Subjective")}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                        {soapSectionText(note.subjective) || "--"}
                                      </p>
                                    </div>

                                    {/* Objective */}
                                    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.03] p-4 space-y-2 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/15 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                                          O · {t("records.soap.objective", "Objective")}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                        {soapSectionText(note.objective) || "--"}
                                      </p>
                                    </div>

                                    {/* Assessment */}
                                    <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.03] p-4 space-y-2 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-800 dark:text-violet-300">
                                          A · {t("records.soap.assessment", "Assessment")}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                        {soapSectionText(note.assessment) || "--"}
                                      </p>
                                    </div>

                                    {/* Plan */}
                                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-4 space-y-2 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                          P · {t("records.soap.plan", "Plan")}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                        {soapSectionText(note.plan) || "--"}
                                      </p>
                                    </div>
                                  </div>
                                  {note.addenda.length > 0 ? (
                                    <div className="space-y-2 border-t border-border pt-3">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t("records.soap.addenda", "Addenda")}
                                      </h4>
                                      {note.addenda.map((addendum) => (
                                        <div
                                          key={addendum.id}
                                          className="rounded-md bg-muted/40 p-3"
                                        >
                                          <p className="text-xs font-medium">
                                            {addendum.authorName} -{" "}
                                            {formatClinicalDateTime(
                                              addendum.createdAt,
                                              recordsTimeZone,
                                            )}
                                          </p>
                                          <p className="mt-1 whitespace-pre-wrap text-sm">
                                            {soapSectionText(addendum.content)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {note.status === "finalized" &&
                                  !note.correctionId &&
                                  canCorrectClinicalRecords ? (
                                    addendumNoteId === note.id ? (
                                      <div className="rounded-md border border-border p-3">
                                        <label
                                          className="text-sm font-medium"
                                          htmlFor={`records-addendum-${note.id}`}
                                        >
                                          {t("records.soap.addAttributedAddendum", "Add attributed addendum")}
                                        </label>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {t("records.soap.addendaCannotBeEdited", "Addenda cannot be edited or deleted after saving.")}
                                        </p>
                                        <textarea
                                          id={`records-addendum-${note.id}`}
                                          value={addendumContent}
                                          onChange={(event) =>
                                            setAddendumContent(
                                              event.target.value,
                                            )
                                          }
                                          maxLength={10_000}
                                          rows={3}
                                          className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
                                        />
                                        <div className="mt-2 flex gap-2">
                                          <Button
                                            size="sm"
                                            disabled={
                                              !addendumContent.trim() ||
                                              addSoapAddendum.isPending
                                            }
                                            onClick={() =>
                                              addSoapAddendum.mutate({
                                                patientId,
                                                noteId: note.id,
                                                operationId:
                                                  addendumOperationId!,
                                                content: addendumContent,
                                              })
                                            }
                                          >
                                            {addSoapAddendum.isPending
                                              ? t("common.saving", "Saving...")
                                              : t("records.soap.saveAddendum", "Save addendum")}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={addSoapAddendum.isPending}
                                            onClick={() => {
                                              setAddendumNoteId(null);
                                              setAddendumContent("");
                                              setAddendumOperationId(null);
                                            }}
                                          >
                                            {t("common.cancel", "Cancel")}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setAddendumNoteId(note.id);
                                          setAddendumContent("");
                                          setAddendumOperationId(
                                            crypto.randomUUID(),
                                          );
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {t("records.soap.addAddendum", "Add addendum")}
                                      </Button>
                                    )
                                  ) : null}
                                  {note.status === "finalized" ? (
                                    <>
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={
                                          note.correctionId &&
                                          note.correctionReason &&
                                          note.correctedAt
                                            ? {
                                                id: note.correctionId,
                                                reason: note.correctionReason,
                                                correctedAt: note.correctedAt,
                                                correctedByName:
                                                  note.correctedByName,
                                              }
                                            : null
                                        }
                                        triggerLabel={t("records.soap.voidWithoutReplacement", "Void without replacement")}
                                        description={t("records.soap.voidDesc", "The original stays in permanent chart history but leaves current clinical summaries immediately. If its content needs correction, cancel and use Replace finalized SOAP. Use void alone only when no replacement belongs on this encounter; closeout will require a documented reason.")}
                                        canCorrect={canCorrectClinicalRecords}
                                        isPending={
                                          correctSoap.isPending &&
                                          correctSoap.variables?.recordId ===
                                            note.id
                                        }
                                        onCorrect={(reason) =>
                                          correctSoap.mutateAsync({
                                            patientId,
                                            recordId: note.id,
                                            reason,
                                          })
                                        }
                                      />
                                      {note.replacementSoapNoteId ? (
                                        <div className="mt-3 flex justify-end">
                                          <a
                                            href={`#soap-note-${note.replacementSoapNoteId}`}
                                            className="text-sm font-medium text-primary hover:underline"
                                          >
                                            {t("records.soap.viewSignedReplacement", "View signed replacement")}
                                          </a>
                                        </div>
                                      ) : canCorrectClinicalRecords &&
                                        (!note.correctionId ||
                                          (!hasOtherCurrentAppointmentSoap &&
                                            !hasAppointmentSoapDraft)) ? (
                                        <div className="mt-3 flex justify-end">
                                          <Button asChild size="sm">
                                            <Link
                                              href={`/records/replace-soap/${encodeURIComponent(patientId)}?sourceNoteId=${encodeURIComponent(note.id)}&return=records`}
                                            >
                                              {note.correctionId
                                                ? t("records.soap.createMissingReplacement", "Create missing replacement")
                                                : t("records.soap.replaceFinalizedSoap", "Replace finalized SOAP")}
                                            </Link>
                                          </Button>
                                        </div>
                                      ) : hasAppointmentSoapDraft &&
                                        note.appointmentId ? (
                                        <div className="mt-3 flex justify-end">
                                          <Button asChild size="sm" variant="outline">
                                            <a
                                              href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                                            >
                                              {t("records.soap.reviewEncounterSoapDraft", "Review encounter SOAP draft")}
                                            </a>
                                          </Button>
                                        </div>
                                      ) : note.correctionId &&
                                        hasOtherCurrentAppointmentSoap ? (
                                        <p className="mt-3 text-right text-xs text-muted-foreground">
                                          {t("records.soap.alreadyHasCurrentFinalized", "This encounter already has a current finalized SOAP.")}
                                        </p>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                  </div>
                ) : (
                  <>
                    {/* title="No SOAP notes yet" */}
                    <EmptyState
                      icon={FileText}
                      title={t("records.soap.emptyTitle", "No SOAP notes yet")}
                      description={t("records.soap.emptyDesc", "SOAP notes are created from an active visit so documentation stays attached to the correct encounter.")}
                    />
                  </>
                )}
              </div>
            )}

            {/* Vaccinations Tab */}
            {currentTab === "vaccinations" && (
              <div>
                {canCreateVaccinations && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showVaccinationForm ? "outline" : "default"}
                      onClick={() => {
                        if (showVaccinationForm) {
                          setVaccinationForm(initialVaccinationForm());
                        }
                        setShowVaccinationForm(!showVaccinationForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("records.vaccinations.addVaccination", "Add Vaccination")}
                    </Button>
                  </div>
                )}

                {canCreateVaccinations && showVaccinationForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitVaccination) return;
                      createVaccination.mutate({
                        patientId,
                        appointmentId: linkedAppointmentId || undefined,
                        vaccineName: vaccinationForm.vaccineName.trim(),
                        productName:
                          vaccinationForm.productName.trim() || undefined,
                        lotNumber:
                          vaccinationForm.lotNumber.trim() || undefined,
                        manufacturer:
                          vaccinationForm.manufacturer.trim() || undefined,
                        productExpirationDate:
                          vaccinationForm.productExpirationDate || undefined,
                        doseType: vaccinationForm.doseType || undefined,
                        licensedDurationMonths:
                          vaccinationForm.licensedDurationMonths
                            ? Number(vaccinationForm.licensedDurationMonths)
                            : undefined,
                        rabiesTagNumber:
                          vaccinationForm.rabiesTagNumber.trim() || undefined,
                        supervisingVeterinarianId:
                          vaccinationForm.supervisingVeterinarianId ||
                          undefined,
                        nextDueDate:
                          vaccinationForm.nextDueDate.trim() || undefined,
                      });
                    }}
                  >
                    <VaccinationFormFields
                      form={vaccinationForm}
                      setForm={setVaccinationForm}
                      providers={vaccinationProviders.data}
                      currentUserId={session?.user?.id}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitVaccination}
                      >
                        {createVaccination.isPending
                          ? t("common.saving", "Saving...")
                          : t("common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowVaccinationForm(false);
                          setVaccinationForm(initialVaccinationForm());
                        }}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {vaccinationsError || vaccinationsMissing ? (
                  <RecordsErrorPanel
                    message={
                      vaccinationsError
                        ? t("records.vaccinations.loadErrorWithMsg", "Unable to load vaccination records. {message}", { message: vaccinationsError.message })
                        : t("records.vaccinations.loadError", "Unable to load vaccination records. Please retry.")
                    }
                  />
                ) : isLoadingVaccinations ? (
                  <RecordsLoadingPanel label={t("records.vaccinations.loading", "Loading vaccinations...")} />
                ) : vaccinations && vaccinations.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.vaccinations.colVaccine", "Vaccine")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.vaccinations.colDateAdministered", "Date Administered")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.vaccinations.colNextDue", "Next Due")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.vaccinations.colAdministeredBy", "Administered By")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.vaccinations.colStatus", "Status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                            {vaccinations.map((vax) => {
                              const dueStatus = getVaccineDueStatus(
                                vax.nextDueDate,
                                recordsTimeZone,
                              );
                              return (
                                <tr
                                  key={vax.id}
                                  className={cn(
                                    "border-b border-border last:border-0",
                                    vax.correctionId &&
                                      "bg-destructive/5 text-muted-foreground",
                                  )}
                                >
                                  <td className="px-4 py-3 font-medium">
                                    {vax.vaccineName}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.administeredAt
                                      ? formatClinicalDate(
                                          vax.administeredAt,
                                          recordsTimeZone,
                                        )
                                      : "--"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.nextDueDate
                                      ? formatClinicalDate(
                                          vax.nextDueDate,
                                          recordsTimeZone,
                                        )
                                      : "--"}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {vax.administeredByName ?? "--"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.correctionId ? (
                                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                                        {t("records.enteredInError", "Entered in error")}
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                          dueStatus.className,
                                        )}
                                      >
                                        {dueStatus.label === "Overdue"
                                          ? t("records.vaccinations.overdue", "Overdue")
                                          : dueStatus.label === "Due Soon"
                                            ? t("records.vaccinations.dueSoon", "Due Soon")
                                            : dueStatus.label === "Current"
                                              ? t("records.vaccinations.current", "Current")
                                              : dueStatus.label}
                                      </span>
                                    )}
                                    <ClinicalCorrectionControl
                                      timeZone={recordsTimeZone}
                                      correction={
                                        vax.correctionId &&
                                        vax.correctionReason &&
                                        vax.correctedAt
                                          ? {
                                              id: vax.correctionId,
                                              reason: vax.correctionReason,
                                              correctedAt: vax.correctedAt,
                                              correctedByName:
                                                vax.correctedByName,
                                            }
                                          : null
                                      }
                                      canCorrect={canCorrectClinicalRecords}
                                      isPending={
                                        correctVaccination.isPending &&
                                        correctVaccination.variables
                                          ?.recordId === vax.id
                                      }
                                      onCorrect={(reason) =>
                                        correctVaccination.mutateAsync({
                                          patientId,
                                          recordId: vax.id,
                                          reason,
                                        })
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Syringe}
                    title={t("records.vaccinations.emptyTitle", "No vaccination records yet")}
                  />
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {currentTab === "prescriptions" && (
              <div>
                {canPrescribe && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showPrescriptionForm ? "outline" : "default"}
                      onClick={() => {
                        if (showPrescriptionForm) {
                          prescriptionOperationId.current = null;
                          setShowPrescriptionForm(false);
                          setPrescriptionForm((current) => ({
                            ...current,
                            acknowledgeSafetyWarnings: false,
                          }));
                          return;
                        }
                        prescriptionOperationId.current = null;
                        setShowPrescriptionForm(true);
                        setPrescriptionForm(
                          initialPrescriptionForm(recordsTimeZone)
                        );
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("records.prescriptions.newPrescription", "New Prescription")}
                    </Button>
                  </div>
                )}

                {canPrescribe && showPrescriptionForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const warnings =
                        verifiedPrescriptionSafety?.warnings ?? [];
                      const requiresOverride =
                        verifiedPrescriptionSafety?.requiresOverride ?? false;
                      if (
                        requiresOverride &&
                        !prescriptionForm.acknowledgeSafetyWarnings
                      ) {
                        toast.error(
                          t("records.prescriptions.acknowledgeSafetyFirst", "Acknowledge prescription safety warnings before saving.")
                        );
                        return;
                      }
                      if (!canSubmitPrescription) return;

                      prescriptionOperationId.current ??= crypto.randomUUID();
                      createPrescription.mutate({
                        patientId,
                        operationId: prescriptionOperationId.current,
                        appointmentId: linkedAppointmentId || undefined,
                        medicationName:
                          prescriptionForm.medicationName.trim(),
                        productId: prescriptionForm.productId || undefined,
                        dosage: prescriptionForm.dosage.trim(),
                        frequency: prescriptionForm.frequency.trim(),
                        quantity: optionalNumber(prescriptionForm.quantity),
                        refillsRemaining:
                          optionalNumber(
                            prescriptionForm.refillsRemaining
                          ) ?? 0,
                        startDate: prescriptionForm.startDate,
                        endDate:
                          prescriptionForm.endDate.trim() || undefined,
                        instructions:
                          prescriptionForm.instructions.trim() || undefined,
                        acknowledgeSafetyWarnings:
                          warnings.length > 0 &&
                          prescriptionForm.acknowledgeSafetyWarnings,
                      });
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldMedication", "Medication *")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.medicationName}
                          maxLength={PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              medicationName: e.target.value,
                              acknowledgeSafetyWarnings: false,
                            }))
                          }
                          placeholder={t("records.prescriptions.placeholderMedication", "e.g. Carprofen")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldInventoryItem", "Inventory Item")}
                        </label>
                        <PrescriptionInventoryProductPicker
                          value={prescriptionForm.productId}
                          selectedProduct={linkedPrescriptionProduct}
                          onChange={(selectedProduct) => {
                            const productId = selectedProduct?.id ?? "";
                            setSelectedPrescriptionProduct(selectedProduct);
                            setPrescriptionForm((current) => ({
                              ...current,
                              productId,
                              medicationName:
                                selectedProduct && !current.medicationName.trim()
                                  ? selectedProduct.name
                                  : current.medicationName,
                              acknowledgeSafetyWarnings: false,
                            }));
                          }}
                        />
                        {prescriptionForm.productId &&
                        linkedPrescriptionProduct ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("records.prescriptions.inventoryHelpText", "Stock and billing both use individual units at {price} per unit. The prescription quantity will be deducted and charged in that same unit.", { price: linkedPrescriptionProduct.unitPrice })}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldDosage", "Dosage *")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.dosage}
                          maxLength={PRESCRIPTION_DOSAGE_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              dosage: e.target.value,
                            }))
                          }
                          placeholder={t("records.prescriptions.placeholderDosage", "e.g. 75 mg")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldFrequency", "Frequency *")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.frequency}
                          maxLength={PRESCRIPTION_FREQUENCY_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              frequency: e.target.value,
                            }))
                          }
                          placeholder={t("records.prescriptions.placeholderFrequency", "e.g. Every 12 hours")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {linkedPrescriptionProduct
                            ? t("records.prescriptions.fieldQuantityInventory", "Quantity (inventory units)")
                            : t("records.prescriptions.fieldQuantity", "Quantity")}
                        </label>
                        <Input
                          type="number"
                          min={PRESCRIPTION_QUANTITY_MIN}
                          max={PRESCRIPTION_COUNT_MAX}
                          step={1}
                          value={prescriptionForm.quantity}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              quantity: e.target.value,
                            }))
                          }
                          placeholder={t("records.prescriptions.placeholderQuantity", "e.g. 30")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldRefills", "Refills")}
                        </label>
                        <Input
                          type="number"
                          min={PRESCRIPTION_REFILLS_MIN}
                          max={PRESCRIPTION_COUNT_MAX}
                          step={1}
                          value={prescriptionForm.refillsRemaining}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              refillsRemaining: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldStartDate", "Start Date *")}
                        </label>
                        <Input
                          type="date"
                          required
                          value={prescriptionForm.startDate}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              startDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldEndDate", "End Date")}
                        </label>
                        <Input
                          type="date"
                          value={prescriptionForm.endDate}
                          min={prescriptionForm.startDate || undefined}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              endDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.prescriptions.fieldInstructions", "Instructions")}
                        </label>
                        <Input
                          value={prescriptionForm.instructions}
                          maxLength={PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              instructions: e.target.value,
                            }))
                          }
                          placeholder={t("records.prescriptions.placeholderInstructions", "Give with food")}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {t("records.prescriptions.controlledSubstanceWarning", "Controlled-substance recordkeeping is not automated. When applicable, complete the clinic's required controlled drug log separately.")}
                      </p>
                      <PrescriptionSafetyPanel
                        medicationName={medicationNameForSafety}
                        isLoading={prescriptionSafety.isFetching}
                        errorMessage={
                          prescriptionSafety.error?.message ??
                          (prescriptionSafetyMissing
                            ? "Please retry."
                            : undefined)
                        }
                        warnings={verifiedPrescriptionSafety?.warnings ?? []}
                      />

                      {verifiedPrescriptionSafety?.requiresOverride && (
                        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <Checkbox
                            checked={
                              prescriptionForm.acknowledgeSafetyWarnings
                            }
                            onChange={(e) =>
                              setPrescriptionForm((current) => ({
                                ...current,
                                acknowledgeSafetyWarnings:
                                  e.currentTarget.checked,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            {t("records.prescriptions.clinicianReviewedWarnings", "Clinician reviewed and accepts these prescription safety warnings.")}
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitPrescription}
                      >
                        {createPrescription.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t("records.prescriptions.savePrescription", "Save Prescription")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          prescriptionOperationId.current = null;
                          setShowPrescriptionForm(false);
                          setPrescriptionForm(
                            initialPrescriptionForm(recordsTimeZone)
                          );
                        }}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {prescriptionsError || prescriptionsMissing ? (
                  <RecordsErrorPanel
                    message={
                      prescriptionsError
                        ? t("records.prescriptions.loadErrorWithMsg", "Unable to load prescriptions. {message}", { message: prescriptionsError.message })
                        : t("records.prescriptions.loadError", "Unable to load prescriptions. Please retry.")
                    }
                  />
                ) : isLoadingPrescriptions ? (
                  <RecordsLoadingPanel label={t("records.prescriptions.loading", "Loading prescriptions...")} />
                ) : prescriptionsList && prescriptionsList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colMedication", "Medication")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colDosage", "Dosage")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colFrequency", "Frequency")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colInventory", "Inventory")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colStatus", "Status")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.prescriptions.colRefills", "Refills")}
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                            {t("records.prescriptions.colActions", "Actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionsList.map((rx) => (
                          <tr
                            key={rx.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {rx.medicationName}
                            </td>
                            <td className="px-4 py-3">{rx.dosage ?? "--"}</td>
                            <td className="px-4 py-3">
                              {rx.frequency ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {rx.productName ? (
                                <span>
                                  {rx.productName}
                                  {rx.quantity != null ? (
                                    <span className="block text-xs">
                                      {t("records.prescriptions.dispensedCount", "Dispensed {quantity}", { quantity: rx.quantity })}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                "--"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                  getPrescriptionStatusBadge(rx.effectiveStatus)
                                )}
                              >
                                {rx.effectiveStatus === "active"
                                  ? t("records.prescriptions.statusActive", "active")
                                  : rx.effectiveStatus === "cancelled"
                                    ? t("records.prescriptions.statusCancelled", "cancelled")
                                    : rx.effectiveStatus === "expired"
                                      ? t("records.prescriptions.statusExpired", "expired")
                                      : (rx.effectiveStatus ?? "unknown")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {rx.refillsRemaining ?? 0}
                            </td>
                            <td className="space-y-2 px-4 py-3 text-right align-top">
                              <div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={
                                    rx.effectiveStatus === "active"
                                      ? t("records.prescriptions.printLabel", "Print Label")
                                      : t("records.prescriptions.printLabelDisabledTooltip", "Only active prescriptions can print a dispensing label")
                                  }
                                  disabled={rx.effectiveStatus !== "active"}
                                  onClick={async () => {
                                  const clientName = [
                                    selectedPatient?.clientFirstName,
                                    selectedPatient?.clientLastName,
                                  ]
                                    .filter(Boolean)
                                    .join(" ");
                                  const { generatePrescriptionLabelPdf } =
                                    await import("@/lib/pdf");
                                  generatePrescriptionLabelPdf({
                                    practiceName: recordsPracticeName,
                                    practicePhone:
                                      recordsPracticePhone ?? undefined,
                                    patientName: selectedPatient?.name ?? "",
                                    clientName,
                                    species: selectedPatient?.species ?? "",
                                    medicationName: rx.medicationName,
                                    dosage: rx.dosage ?? "",
                                    frequency: rx.frequency ?? "",
                                    instructions: rx.instructions ?? undefined,
                                    prescribedBy: rx.prescriberName ?? "",
                                    startDate: rx.startDate
                                      ? formatClinicalDate(
                                          rx.startDate,
                                          recordsTimeZone
                                        )
                                      : formatClinicalDate(
                                          dateInputValue(
                                            new Date(),
                                            recordsTimeZone
                                          ),
                                          recordsTimeZone
                                        ),
                                    quantity: rx.quantity != null ? String(rx.quantity) : undefined,
                                    refillsRemaining: rx.refillsRemaining ?? undefined,
                                  }).save(
                                    `label-${rx.medicationName.replace(/\s+/g, "-").toLowerCase()}.pdf`
                                  );
                                  }}
                                >
                                  <Tag className="mr-1 h-3.5 w-3.5" />
                                  {t("records.prescriptions.printLabel", "Print Label")}
                                </Button>
                              </div>
                              <PrescriptionLifecycleControl
                                prescription={{
                                  id: rx.id,
                                  effectiveStatus: rx.effectiveStatus,
                                  productId: rx.productId,
                                  quantity: rx.quantity,
                                  refillsRemaining: rx.refillsRemaining,
                                }}
                                canManage={canPrescribe}
                                timeZone={recordsTimeZone}
                                onChanged={async () => {
                                  await refetchPrescriptions();
                                  if (linkedAppointmentId) {
                                    await utils.encounters.getCloseout.invalidate({
                                      appointmentId: linkedAppointmentId,
                                    });
                                  }
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Pill} title={t("records.prescriptions.emptyTitle", "No prescriptions yet")} />
                )}
              </div>
            )}

            {/* Problems Tab */}
            {currentTab === "problems" && (
              <div>
                {canManageProblems && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showProblemForm ? "outline" : "default"}
                      onClick={() => {
                        if (showProblemForm) {
                          setProblemForm(initialProblemForm());
                        }
                        setShowProblemForm(!showProblemForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("records.problems.addProblem", "Add Problem")}
                    </Button>
                  </div>
                )}

                {canManageProblems && showProblemForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitProblem) return;
                      createProblem.mutate({
                        patientId,
                        description: problemForm.description.trim(),
                        status: problemForm.status,
                        onsetDate: problemForm.onsetDate.trim() || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.problems.fieldProblem", "Problem *")}
                        </label>
                        <Input
                          name="description"
                          required
                          value={problemForm.description}
                          maxLength={PROBLEM_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              description: e.target.value,
                            }))
                          }
                          placeholder={t("records.problems.placeholderProblem", "e.g. Chronic otitis")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.problems.fieldStatus", "Status")}
                        </label>
                        <select
                          name="status"
                          value={problemForm.status}
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              status: e.target.value as ProblemStatus,
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {PROBLEM_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status === "active"
                                ? t("records.problems.statusActive", "Active")
                                : status === "chronic"
                                  ? t("records.problems.statusChronic", "Chronic")
                                  : t("records.problems.statusResolved", "Resolved")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.problems.fieldOnsetDate", "Onset Date")}
                        </label>
                        <Input
                          name="onsetDate"
                          type="date"
                          value={problemForm.onsetDate}
                          aria-invalid={
                            !isProblemOptionalDateInputValid(
                              problemForm.onsetDate
                            )
                          }
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              onsetDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitProblem}
                      >
                        {createProblem.isPending
                          ? t("common.saving", "Saving...")
                          : t("common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowProblemForm(false);
                          setProblemForm(initialProblemForm());
                        }}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {problemsError || problemsMissing ? (
                  <RecordsErrorPanel
                    message={
                      problemsError
                        ? t("records.problems.loadErrorWithMsg", "Unable to load problems. {message}", { message: problemsError.message })
                        : t("records.problems.loadError", "Unable to load problems. Please retry.")
                    }
                  />
                ) : isLoadingProblems ? (
                  <RecordsLoadingPanel label={t("records.problems.loading", "Loading problems...")} />
                ) : problems && problems.length > 0 ? (
                  <div className="space-y-2">
                    {problems.map((problem) => (
                      <div
                        key={problem.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              problem.status === "active"
                                ? "font-semibold"
                                : "font-normal"
                            )}
                          >
                            {problem.description}
                          </p>
                          {problem.onsetDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("records.problems.onsetPrefix", "Onset: {date}", {
                                date: formatClinicalDate(
                                  problem.onsetDate,
                                  recordsTimeZone
                                ),
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                              problem.status === "active"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : problem.status === "chronic"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            )}
                          >
                            {problem.status === "active"
                              ? t("records.problems.statusActive", "Active")
                              : problem.status === "chronic"
                                ? t("records.problems.statusChronic", "Chronic")
                                : problem.status === "resolved"
                                  ? t("records.problems.statusResolved", "Resolved")
                                  : (problem.status ?? "active")}
                          </span>
                          {canManageProblems && (
                            <div className="flex flex-wrap gap-1">
                              {problem.status !== "active" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "active",
                                    })
                                  }
                                >
                                  {t("records.problems.actionReopen", "Reopen")}
                                </Button>
                              )}
                              {problem.status !== "chronic" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "chronic",
                                    })
                                  }
                                >
                                  {t("records.problems.actionChronic", "Chronic")}
                                </Button>
                              )}
                              {problem.status !== "resolved" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "resolved",
                                    })
                                  }
                                >
                                  {t("records.problems.actionResolve", "Resolve")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title={t("records.problems.emptyTitle", "No problems recorded")}
                  />
                )}
              </div>
            )}

            {/* Lab Results Tab */}
            {currentTab === "labResults" && (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {t("records.labResults.manualOnlyTitle", "Manual lab entry only")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
                        {t("records.labResults.manualOnlyDesc", "Reference lab ordering is disabled until IDEXX, Antech, or Zoetis provider credentials and a real adapter are connected.")}
                      </p>
                    </div>
                  </div>
                  {canManageLabResults && (
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      onClick={() => {
                        if (showLabForm) setLabForm(initialLabResultForm());
                        setReplacesLabResultId(null);
                        setReplacementPatient(null);
                        setReplacementPatientSearch("");
                        labResultCreationOperationId.current = null;
                        setShowLabForm(!showLabForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("records.labResults.addResult", "Add Manual Lab Result")}
                    </Button>
                  )}
                </div>

                {canManageLabResults && showLabForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitLabResult) return;
                      labResultCreationOperationId.current ??= crypto.randomUUID();
                      createLabResult.mutate({
                        patientId:
                          replacesLabResultId && replacementPatient
                            ? replacementPatient.id
                            : patientId,
                        appointmentId:
                          replacesLabResultId &&
                          replacementPatient?.id === selectedPatient?.id
                            ? replacementSourceLabResult?.appointmentId ??
                              undefined
                            : linkedAppointmentId || undefined,
                        testName: labForm.testName.trim(),
                        resultValue: labForm.resultValue.trim() || undefined,
                        unit: labForm.unit.trim() || undefined,
                        referenceRangeLow:
                          labForm.referenceRangeLow.trim() || undefined,
                        referenceRangeHigh:
                          labForm.referenceRangeHigh.trim() || undefined,
                        status: labForm.resultValue.trim()
                          ? "completed"
                          : "pending",
                        resultFlag: labForm.resultValue.trim()
                          ? labForm.resultFlag
                          : "unknown",
                        operationId: labResultCreationOperationId.current,
                        replacesLabResultId:
                          replacesLabResultId ?? undefined,
                      });
                    }}
                  >
                    {replacesLabResultId ? (
                      <div className="space-y-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                        <div>
                          <p className="font-medium">
                            {t("records.labResults.replacementTitle", "Creating an attributed replacement")}
                          </p>
                          <p className="mt-1 text-xs">
                            {t("records.labResults.sourceChart", "Source chart: {source} · Correct destination: {destination}. Only the test name was copied. Deliberately review the destination and enter new values before saving; nothing is submitted automatically.", {
                              source: selectedPatient?.name ?? t("records.common.unknown", "Unknown"),
                              destination: replacementPatient?.name ?? t("records.labResults.choosePatient", "Choose a patient"),
                            })}
                          </p>
                          <p className="mt-2 text-xs">
                            {t("records.labResults.replacementBillingNotice", "If the original visit is still open and this work was unbilled, a same-patient replacement creates new unresolved visit work. Prior charged or no-charge work stays unchanged and is not billed again. Closed-visit and wrong-patient replacements from this dashboard create no visit work.")}
                          </p>
                        </div>
                        <div className="rounded-md border border-blue-200 bg-background/80 p-3 text-foreground dark:border-blue-900">
                          <label className="block text-xs font-medium">
                            {t("records.labResults.replacementPatientLabel", "Replacement patient")}
                            <Input
                              className="mt-1"
                              value={replacementPatientSearch}
                              onChange={(event) =>
                                setReplacementPatientSearch(event.target.value)
                              }
                              placeholder={t("records.labResults.replacementPatientPlaceholder", "Search another patient by name or owner")}
                            />
                          </label>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("records.labResults.replacementPatientHelp", "Leave {patient} selected for a same-patient correction, or search and deliberately choose the correct chart for a wrong-patient repair.", {
                              patient: selectedPatient?.name ?? t("records.labResults.thisPatient", "this patient"),
                            })}
                          </p>
                          {canSearchReplacementPatients ? (
                            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                              {replacementPatientResults.isLoading ? (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  {t("records.labResults.searchingPatients", "Searching patients…")}
                                </p>
                              ) : replacementPatientResults.data?.length ? (
                                replacementPatientResults.data.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                                      replacementPatient?.id === option.id &&
                                        "bg-muted font-medium"
                                    )}
                                    onClick={() => {
                                      setReplacementPatient(option);
                                      setReplacementPatientSearch("");
                                      labResultCreationOperationId.current =
                                        null;
                                    }}
                                  >
                                    <span>{option.name}</span>
                                    <span className="text-muted-foreground">
                                      {[
                                        option.clientFirstName,
                                        option.clientLastName,
                                      ]
                                        .filter(Boolean)
                                        .join(" ") || t("records.labResults.ownerUnavailable", "Owner unavailable")}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  {t("records.labResults.noMatchingPatient", "No matching patient found.")}
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.labResults.testNameRequired", "Test Name *")}
                        </label>
                        <Input
                          name="testName"
                          required
                          value={labForm.testName}
                          maxLength={LAB_TEST_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              testName: e.target.value,
                            }))
                          }
                          placeholder={t("records.labResults.testNamePlaceholder", "e.g. CBC")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.labResults.resultValue", "Result Value")}
                        </label>
                        <Input
                          name="resultValue"
                          value={labForm.resultValue}
                          maxLength={LAB_RESULT_VALUE_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              resultValue: e.target.value,
                            }))
                          }
                          placeholder={t("records.labResults.resultValuePlaceholder", "e.g. 12.5")}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lab-result-flag"
                          className="block text-xs font-medium text-muted-foreground mb-1"
                        >
                          {t("records.labResults.clinicalFlag", "Clinical flag")}
                        </label>
                        <select
                          id="lab-result-flag"
                          value={labForm.resultFlag}
                          disabled={!labForm.resultValue.trim()}
                          onChange={(event) =>
                            setLabForm((form) => ({
                              ...form,
                              resultFlag: event.target.value as LabResultFormState["resultFlag"],
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="unknown">{t("records.labResults.flagUnknown", "Not assessed")}</option>
                          <option value="normal">{t("records.labResults.flagNormal", "Normal")}</option>
                          <option value="abnormal">{t("records.labResults.flagAbnormal", "Abnormal")}</option>
                          <option value="critical">{t("records.labResults.flagCritical", "Critical")}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.labResults.unit", "Unit")}
                        </label>
                        <Input
                          name="unit"
                          value={labForm.unit}
                          maxLength={LAB_UNIT_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              unit: e.target.value,
                            }))
                          }
                          placeholder={t("records.labResults.unitPlaceholder", "e.g. mg/dL")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.labResults.refRangeLow", "Ref. Range Low")}
                        </label>
                        <Input
                          name="referenceRangeLow"
                          type="number"
                          value={labForm.referenceRangeLow}
                          min={LAB_REFERENCE_MIN}
                          max={LAB_REFERENCE_MAX}
                          step={LAB_REFERENCE_STEP}
                          aria-invalid={
                            !isLabOptionalReferenceInputValid(
                              labForm.referenceRangeLow
                            )
                          }
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              referenceRangeLow: e.target.value,
                            }))
                          }
                          placeholder={t("records.labResults.refRangeLowPlaceholder", "e.g. 7.0")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.labResults.refRangeHigh", "Ref. Range High")}
                        </label>
                        <Input
                          name="referenceRangeHigh"
                          type="number"
                          value={labForm.referenceRangeHigh}
                          min={LAB_REFERENCE_MIN}
                          max={LAB_REFERENCE_MAX}
                          step={LAB_REFERENCE_STEP}
                          aria-invalid={
                            !isLabOptionalReferenceInputValid(
                              labForm.referenceRangeHigh
                            ) ||
                            !isLabReferenceRangeOrdered(
                              labForm.referenceRangeLow,
                              labForm.referenceRangeHigh
                            )
                          }
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              referenceRangeHigh: e.target.value,
                            }))
                          }
                          placeholder={t("records.labResults.refRangeHighPlaceholder", "e.g. 27.0")}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {replacesLabResultId
                        ? t("records.labResults.replacementHelp", "Enter a fresh result value to create a completed replacement and send it to the clinic Lab Inbox for review. A replacement cannot be saved as an empty pending result.")
                        : t("records.labResults.newHelp", "Entering a value records this result as completed and sends it to the clinic Lab Inbox for review. A result without values stays pending.")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitLabResult}
                      >
                        {createLabResult.isPending ? t("records.common.saving", "Saving...") : t("records.common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowLabForm(false);
                          setLabForm(initialLabResultForm());
                          setReplacesLabResultId(null);
                          setReplacementPatient(null);
                          setReplacementPatientSearch("");
                          appliedLabAmendLink.current = null;
                          const params = new URLSearchParams(
                            searchParams.toString()
                          );
                          params.delete("amendLabResultId");
                          router.replace(`/records?${params.toString()}`);
                          labResultCreationOperationId.current = null;
                        }}
                      >
                        {t("records.common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {labResultsError || labResultsMissing ? (
                  <RecordsErrorPanel
                    message={
                      labResultsError
                        ? t("records.labResults.loadErrorWithDetails", "Unable to load lab results. {details}", { details: labResultsError.message })
                        : t("records.labResults.loadError", "Unable to load lab results. Please retry.")
                    }
                  />
                ) : isLoadingLabResults ? (
                  <RecordsLoadingPanel label={t("records.labResults.loading", "Loading lab results...")} />
                ) : labResultsList && labResultsList.length > 0 ? (
                  <div className="space-y-4">
                    {labTrendGroups.length > 0 && (
                      <LabTrendCharts groups={labTrendGroups} />
                    )}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colTestName", "Test Name")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colResult", "Result")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colUnit", "Unit")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colReferenceRange", "Reference Range")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colStatus", "Status")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colReviewEvidence", "Review evidence")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colOrderedBy", "Ordered By")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colDate", "Date")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("records.labResults.colActions", "Actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {labResultsList.map((lab) => {
                            const outOfRange = isOutOfRange(
                              lab.resultValue,
                              lab.referenceRangeLow,
                              lab.referenceRangeHigh
                            );
                            return (
                              <tr
                                key={lab.id}
                                id={`lab-result-${lab.id}`}
                                className={cn(
                                  "border-b border-border last:border-0",
                                  lab.correctionId &&
                                    "bg-destructive/5 text-muted-foreground"
                                )}
                              >
                                <td className="px-4 py-3 font-medium">
                                  {lab.testName}
                                  {lab.replacesLabResultId ? (
                                    <a
                                      href={`/records?patientId=${lab.replacesLabResultPatientId ?? patientId}&tab=labResults#lab-result-${lab.replacesLabResultId}`}
                                      className="mt-1 block text-xs font-normal text-primary hover:underline"
                                    >
                                      {t("records.labResults.replacesErrorResult", "Replaces entered-in-error result")}
                                    </a>
                                  ) : null}
                                  {lab.replacementLabResultId ? (
                                    <a
                                      href={`/records?patientId=${lab.replacementLabResultPatientId ?? patientId}&tab=labResults#lab-result-${lab.replacementLabResultId}`}
                                      className="mt-1 block text-xs font-normal text-primary hover:underline"
                                    >
                                      {t("records.labResults.viewReplacementResult", "View replacement result")}
                                    </a>
                                  ) : null}
                                </td>
                                <td
                                  className={cn(
                                    "px-4 py-3",
                                    outOfRange
                                      ? "text-red-600 font-semibold dark:text-red-400"
                                      : ""
                                  )}
                                >
                                  {lab.resultValue ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.unit ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.referenceRangeLow != null &&
                                  lab.referenceRangeHigh != null
                                    ? `${lab.referenceRangeLow} - ${lab.referenceRangeHigh}`
                                    : "--"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col items-start gap-1">
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                        getLabStatusBadge(lab.status)
                                      )}
                                    >
                                      {lab.status === "completed"
                                        ? t("records.labResults.statusCompleted", "completed")
                                        : lab.status === "reviewed"
                                          ? t("records.labResults.statusReviewed", "reviewed")
                                          : lab.status === "pending"
                                            ? t("records.labResults.statusPending", "pending")
                                            : lab.status}
                                    </span>
                                    {lab.resultFlag !== "unknown" ? (
                                      <span className={cn(
                                        "text-xs font-medium capitalize",
                                        lab.resultFlag === "critical"
                                          ? "text-red-700 dark:text-red-300"
                                          : lab.resultFlag === "abnormal"
                                            ? "text-amber-700 dark:text-amber-300"
                                            : "text-emerald-700 dark:text-emerald-300",
                                      )}>
                                        {lab.resultFlag === "critical"
                                          ? t("records.labResults.flagCritical", "Critical")
                                          : lab.resultFlag === "abnormal"
                                            ? t("records.labResults.flagAbnormal", "Abnormal")
                                            : lab.resultFlag === "normal"
                                              ? t("records.labResults.flagNormal", "Normal")
                                              : lab.resultFlag}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {lab.completedAt ? (
                                    <span className="block">
                                      {t("records.labResults.completedBy", "Completed {date} · {actor}", {
                                        date: formatClinicalDate(lab.completedAt, recordsTimeZone),
                                        actor: lab.completionActorName ?? t("records.labResults.actorUnavailableLegacy", "actor unavailable (legacy)")
                                      })}
                                    </span>
                                  ) : (
                                    t("records.labResults.awaitingValues", "Awaiting values")
                                  )}
                                  {lab.reviewedAt ? (
                                    <span className="mt-1 block">
                                      {lab.reviewedByName
                                        ? t("records.labResults.reviewedByName", "Reviewed {date} by {name}", {
                                            date: formatClinicalDate(lab.reviewedAt, recordsTimeZone),
                                            name: lab.reviewedByName,
                                          })
                                        : t("records.labResults.reviewedDate", "Reviewed {date}", {
                                            date: formatClinicalDate(lab.reviewedAt, recordsTimeZone),
                                          })}
                                    </span>
                                  ) : null}
                                  {lab.followUpStatus === "open" ? (
                                    <span className="mt-1 block font-medium text-amber-700 dark:text-amber-300">
                                      {t("records.labResults.followUpAssigned", "Follow-up: {name}", {
                                        name: lab.followUpAssigneeName ?? t("records.labResults.assigned", "assigned")
                                      })}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.orderedByName ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.createdAt
                                    ? formatClinicalDate(
                                        lab.createdAt,
                                        recordsTimeZone
                                      )
                                    : "--"}
                                </td>
                                <td className="px-4 py-3">
                                  {lab.correctionId ? (
                                    <div className="min-w-64">
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={
                                          lab.correctionReason && lab.correctedAt
                                            ? {
                                                id: lab.correctionId,
                                                reason: lab.correctionReason,
                                                correctedAt: lab.correctedAt,
                                                correctedByName:
                                                  lab.correctedByName,
                                              }
                                            : null
                                        }
                                        canCorrect={false}
                                        isPending={false}
                                        onCorrect={async () => undefined}
                                      />
                                      <CorrectedLabResultHistory
                                        resultId={lab.id}
                                        timeZone={recordsTimeZone}
                                      />
                                      {canCorrectClinicalRecords &&
                                      !lab.replacementLabResultId ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="mt-2"
                                          onClick={() => {
                                            const params = new URLSearchParams(
                                              searchParams.toString()
                                            );
                                            params.set("patientId", patientId);
                                            params.set("tab", "labResults");
                                            params.set(
                                              "amendLabResultId",
                                              lab.id
                                            );
                                            router.replace(
                                              `/records?${params.toString()}#lab-result-${lab.id}`
                                            );
                                            setLabForm({
                                              testName: lab.testName,
                                              resultValue: "",
                                              unit: "",
                                              referenceRangeLow: "",
                                              referenceRangeHigh: "",
                                              resultFlag: "unknown",
                                            });
                                            setReplacesLabResultId(lab.id);
                                            setReplacementPatient(
                                              selectedPatient
                                            );
                                            setReplacementPatientSearch("");
                                            setShowLabForm(true);
                                            labResultCreationOperationId.current =
                                              null;
                                          }}
                                        >
                                          {t("records.labResults.createReplacement", "Create replacement")}
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="min-w-52 space-y-2">
                                      {canReviewLabResults &&
                                      lab.status === "completed" &&
                                      (lab.resultFlag !== "critical" ||
                                        lab.followUpStatus !== "not_required") ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            updateLabResultStatus.mutate({
                                              id: lab.id,
                                              status: "reviewed",
                                              operationId:
                                                labReviewOperationIds.current.get(lab.id) ??
                                                (() => {
                                                  const operationId = crypto.randomUUID();
                                                  labReviewOperationIds.current.set(lab.id, operationId);
                                                  return operationId;
                                                })(),
                                            })
                                          }
                                          disabled={
                                            updateLabResultStatus.isPending
                                          }
                                        >
                                          {t("records.labResults.markReviewed", "Mark Reviewed")}
                                        </Button>
                                      ) : lab.status === "completed" &&
                                        lab.resultFlag === "critical" &&
                                        lab.followUpStatus === "not_required" &&
                                        canManageLabResults ? (
                                        <Button asChild variant="ghost" size="sm">
                                          <Link href={`/lab-results?resultId=${lab.id}`}>
                                            {t("records.labResults.assignFollowUp", "Assign follow-up")}
                                          </Link>
                                        </Button>
                                      ) : lab.status === "pending" && canManageLabResults ? (
                                        <Button asChild variant="ghost" size="sm">
                                          <Link href={`/lab-results?resultId=${lab.id}`}>
                                            {t("records.labResults.openSelectedResult", "Open selected result")}
                                          </Link>
                                        </Button>
                                      ) : null}
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={null}
                                        canCorrect={canCorrectClinicalRecords}
                                        isPending={correctLabResult.isPending}
                                        description={t("records.labResults.correctionNotice", "The original result and immutable event evidence remain permanently visible in chart history. It will leave the active Lab Inbox, trends, and follow-up workflows. Unresolved unbilled visit work is voided; charged or no-charge financial history is never changed. Create an attributed replacement after confirming this correction.")}
                                        onCorrect={async (reason) => {
                                          let operationId =
                                            labCorrectionOperationIds.current.get(
                                              lab.id
                                            );
                                          if (!operationId) {
                                            operationId = crypto.randomUUID();
                                            labCorrectionOperationIds.current.set(
                                              lab.id,
                                              operationId
                                            );
                                          }
                                          await correctLabResult.mutateAsync({
                                            patientId,
                                            recordId: lab.id,
                                            operationId,
                                            reason,
                                          });
                                        }}
                                      />
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* title="No lab results yet" */}
                    <EmptyState icon={FlaskConical} title={t("records.labResults.emptyTitle", "No lab results yet")} />
                  </>
                )}
              </div>
            )}

            {/* Procedures Tab */}
            {currentTab === "procedures" && (
              <div>
                {canCreateProcedures && (
                  <div className="flex justify-end mb-4">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      onClick={() => {
                        if (showProcedureForm) {
                          setProcedureForm(initialProcedureForm());
                        }
                        setShowProcedureForm(!showProcedureForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("records.procedures.addProcedure", "Add Procedure")}
                    </Button>
                  </div>
                )}

                {canCreateProcedures && showProcedureForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitProcedure) return;
                      const durationMinutes =
                        procedureForm.durationMinutes.trim();
                      createProcedure.mutate({
                        patientId,
                        appointmentId: linkedAppointmentId || undefined,
                        name: procedureForm.name.trim(),
                        description:
                          procedureForm.description.trim() || undefined,
                        anesthesiaUsed:
                          procedureForm.anesthesiaUsed.trim() || undefined,
                        durationMinutes: durationMinutes
                          ? Number(durationMinutes)
                          : undefined,
                        notes: procedureForm.notes.trim() || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.procedures.nameRequired", "Name *")}
                        </label>
                        <Input
                          name="name"
                          required
                          value={procedureForm.name}
                          maxLength={PROCEDURE_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              name: e.target.value,
                            }))
                          }
                          placeholder={t("records.procedures.namePlaceholder", "e.g. Dental Prophylaxis")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.procedures.durationMinutes", "Duration (minutes)")}
                        </label>
                        <Input
                          name="durationMinutes"
                          type="number"
                          value={procedureForm.durationMinutes}
                          min={PROCEDURE_DURATION_MIN_MINUTES}
                          max={PROCEDURE_DURATION_MAX_MINUTES}
                          step={1}
                          aria-invalid={
                            !isProcedureOptionalDurationInputValid(
                              procedureForm.durationMinutes
                            )
                          }
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              durationMinutes: e.target.value,
                            }))
                          }
                          placeholder={t("records.procedures.durationPlaceholder", "e.g. 45")}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.procedures.description", "Description")}
                        </label>
                        <Input
                          name="description"
                          value={procedureForm.description}
                          maxLength={PROCEDURE_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              description: e.target.value,
                            }))
                          }
                          placeholder={t("records.procedures.descriptionPlaceholder", "Brief description of the procedure")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.procedures.anesthesiaUsed", "Anesthesia Used")}
                        </label>
                        <Input
                          name="anesthesiaUsed"
                          value={procedureForm.anesthesiaUsed}
                          maxLength={PROCEDURE_ANESTHESIA_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              anesthesiaUsed: e.target.value,
                            }))
                          }
                          placeholder={t("records.procedures.anesthesiaPlaceholder", "e.g. Isoflurane")}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("records.procedures.notes", "Notes")}
                        </label>
                        <Input
                          name="notes"
                          value={procedureForm.notes}
                          maxLength={PROCEDURE_NOTES_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              notes: e.target.value,
                            }))
                          }
                          placeholder={t("records.procedures.notesPlaceholder", "Additional notes")}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitProcedure}
                      >
                        {createProcedure.isPending ? t("records.common.saving", "Saving...") : t("records.common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowProcedureForm(false);
                          setProcedureForm(initialProcedureForm());
                        }}
                      >
                        {t("records.common.cancel", "Cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {proceduresError || proceduresMissing ? (
                  <RecordsErrorPanel
                    message={
                      proceduresError
                        ? t("records.procedures.loadErrorWithDetails", "Unable to load procedures. {details}", { details: proceduresError.message })
                        : t("records.procedures.loadError", "Unable to load procedures. Please retry.")
                    }
                  />
                ) : isLoadingProcedures ? (
                  <RecordsLoadingPanel label={t("records.procedures.loading", "Loading procedures...")} />
                ) : proceduresList && proceduresList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.procedures.colName", "Name")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.procedures.colPerformedBy", "Performed By")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.procedures.colDuration", "Duration")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.procedures.colAnesthesia", "Anesthesia")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("records.procedures.colDate", "Date")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {proceduresList.map((proc) => (
                          <tr
                            key={proc.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{proc.name}</p>
                              {proc.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {proc.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.performedByName ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.durationMinutes
                                ? t("records.procedures.minutesValue", "{minutes} min", { minutes: proc.durationMinutes })
                                : "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.anesthesiaUsed ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.createdAt
                                ? formatClinicalDate(
                                    proc.createdAt,
                                    recordsTimeZone
                                  )
                                : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Scissors} title={t("records.procedures.emptyTitle", "No procedures recorded")} />
                )}
              </div>
            )}
              </>
            )}
          </div>
        </>
      )}

      {/* Prompt to search if no patient selected */}
      {!selectedPatient && (
        <EmptyState
          className="mt-6"
          icon={Search}
          title={t("records.searchPrompt", "Search for a patient above to view their medical records")}
        />
      )}
    </div>
  );
}

export default function RecordsPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<RecordsLoadingPanel label={t("records.loading", "Loading records...")} />}>
      <RecordsPageContent />
    </Suspense>
  );
}
