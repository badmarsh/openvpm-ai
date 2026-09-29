"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Activity,
  Shield,
  Camera,
  CalendarDays,
  Cake,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  GitMerge,
  Heart,
  Loader2,
  Paperclip,
  Phone,
  Plus,
  Pencil,
  ReceiptEuro,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  dateTimeLocalInputUtcInstant,
  formatDateTimeLocalInputForTimeZone,
} from "@/lib/date-input";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { StatusPulseBadge } from "@/components/ui/status-pulse-badge";
import {
  PatientHeaderSkeleton,
  PatientSnapshotSkeleton,
} from "@/components/ui/content-skeletons";
import { useI18n } from "@/lib/i18n";
import { PatientHistorySearch } from "@/components/patients/patient-history-search";
import { PatientDocumentUpload } from "@/components/records/patient-document-upload";
import { CapturePhotos } from "@/components/records/capture-photos";
import { ConsentSign } from "@/components/records/consent-sign";
import { RecentClinicalItems } from "@/components/records/recent-clinical-items";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import { cn } from "@/lib/utils";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  fetchWithClientTimeout,
} from "@/lib/client-fetch";
import {
  IMAGE_UPLOAD_POLICY_MESSAGE,
  isImageUploadFileValid,
} from "@/lib/upload-policy";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
  type ManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  buildVitalTrend,
  buildWeightTrend,
} from "@/lib/records/clinical-trends";
import {
  formatClinicalDate,
  formatClinicalDateTime,
} from "@/lib/records/clinical-dates";
import { soapSectionText } from "@/lib/records/soap-content";
import { isRabiesVaccineName } from "@/lib/records/vaccination-policy";
import {
  patientFileKind,
  patientFileLabel,
  type PatientFileKind,
} from "@/lib/records/file-kinds";
import {
  isPatientWeightInputValid,
} from "@/lib/records/patient-weight-policy";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import {
  VITALS_BODY_CONDITION_MIN,
  VITALS_CAPILLARY_REFILL_MAX_SEC,
  VITALS_CAPILLARY_REFILL_MIN_SEC,
  VITALS_CAPILLARY_REFILL_STEP,
  VITALS_HEART_RATE_MAX_BPM,
  VITALS_HEART_RATE_MIN_BPM,
  VITALS_MUCOUS_MEMBRANE_MAX_LENGTH,
  VITALS_NOTES_MAX_LENGTH,
  VITALS_PAIN_SCORE_MAX,
  VITALS_PAIN_SCORE_MIN,
  VITALS_RESPIRATORY_RATE_MAX_BPM,
  VITALS_RESPIRATORY_RATE_MIN_BPM,
  VITALS_TEMPERATURE_MAX_C,
  VITALS_TEMPERATURE_MIN_C,
  VITALS_TEMPERATURE_STEP,
  VITALS_WEIGHT_MAX_KG,
  VITALS_WEIGHT_MIN_KG,
  VITALS_WEIGHT_STEP,
  isVitalsOptionalBodyConditionInputValid,
  isVitalsOptionalCapillaryRefillInputValid,
  isVitalsOptionalHeartRateInputValid,
  isVitalsOptionalPainScoreInputValid,
  isVitalsOptionalRespiratoryRateInputValid,
  isVitalsOptionalTemperatureInputValid,
  isVitalsOptionalTextInputValid,
  isVitalsOptionalWeightInputValid,
} from "@/lib/records/vitals-policy";
import { formatAppointmentStatus } from "@/lib/scheduling/appointment-status";
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  kilogramsToPounds,
  poundsToKilograms,
  roundClinicalMeasurement,
  type BodyConditionScale,
  type MeasurementSystem,
} from "@/lib/ambulatory-workspace";

import {
  VitalsTab,
  VaccinationsTab,
  MedicalRecordsTab,
  AppointmentsTab,
  DocumentsTab,
  InvoicesTab,
  AllergyForm,
  PrescriptionsTab,
  LabResultsTab,
  ProceduresTab,
  OverviewTab,
  WeightHistoryTab,
} from "@/components/patients/sections";
import { PatientStickyRail } from "@/components/patients/patient-sticky-rail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";



const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

function formatSex(
  sex: string | null,
  t?: (key: string, fallback: string) => string,
): string {
  if (!sex) return t ? t("patients.profile.notRecorded", "Unknown") : "Unknown";
  const labels: Record<string, { key: string; label: string }> = {
    male: { key: "sexMale", label: "Male (Intact)" },
    female: { key: "sexFemale", label: "Female (Intact)" },
    male_neutered: { key: "sexMaleNeutered", label: "Male (Neutered)" },
    female_spayed: { key: "sexFemaleSpayed", label: "Female (Spayed)" },
  };
  const match = labels[sex];
  if (!match) return sex;
  return t ? t(`patients.form.${match.key}`, match.label) : match.label;
}

function calculateAge(
  dob: string | null,
  t?: (
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
  ) => string,
): string {
  if (!dob) return t ? t("patients.profile.notRecorded", "Unknown") : "Unknown";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const adjustedMonths = months < 0 ? months + 12 : months;
  const adjustedYears = months < 0 ? years - 1 : years;

  if (adjustedYears === 0) {
    return t
      ? t(
          "patients.profile.monthsOld",
          `${adjustedMonths} month${adjustedMonths !== 1 ? "s" : ""}`,
          { count: adjustedMonths },
        )
      : `${adjustedMonths} month${adjustedMonths !== 1 ? "s" : ""}`;
  }
  if (adjustedMonths === 0) {
    return t
      ? t(
          "patients.profile.yearsOld",
          `${adjustedYears} year${adjustedYears !== 1 ? "s" : ""}`,
          { count: adjustedYears },
        )
      : `${adjustedYears} year${adjustedYears !== 1 ? "s" : ""}`;
  }
  return t
    ? `${t("patients.profile.yearsOld", `${adjustedYears}y`, { count: adjustedYears })} ${t("patients.profile.monthsOld", `${adjustedMonths}m`, { count: adjustedMonths })}`
    : `${adjustedYears}y ${adjustedMonths}m`;
}

type Tab =
  | "overview"
  | "history"
  | "diagnostics"
  | "preventive"
  | "prescriptions"
  | "admin";

const TAB_IDS: Tab[] = [
  "overview",
  "history",
  "diagnostics",
  "preventive",
  "prescriptions",
  "admin",
];

// Backwards-compatible mapping for previously bookmarked ?tab= links:
// weight/appointments merged into overview; labResults+vitals into
// diagnostics; records into history; vaccinations+procedures into
// preventive; documents+invoices into admin.
const LEGACY_TAB_MAP: Record<string, Tab> = {
  weight: "overview",
  appointments: "overview",
  clinical: "diagnostics",
  vitals: "diagnostics",
  labResults: "diagnostics",
  records: "history",
  vaccinations: "preventive",
  procedures: "preventive",
  documents: "admin",
  invoices: "admin",
};


function canManagePatientDetailRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function canRecordVitalsRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canCorrectClinicalRecordRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canEditVaccinationCertificateRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canCreateSoapNoteRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canPrescribeRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canRecordVaccinationRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canSearchPatientHistoryRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "viewer"
  );
}

type VitalsFormState = {
  temperatureC: string;
  heartRateBpm: string;
  respiratoryRateBpm: string;
  weightKg: string;
  bodyConditionScore: string;
  painScore: string;
  mucousMembrane: string;
  capillaryRefillSec: string;
  notes: string;
};

function initialVitalsForm(): VitalsFormState {
  return {
    temperatureC: "",
    heartRateBpm: "",
    respiratoryRateBpm: "",
    weightKg: "",
    bodyConditionScore: "",
    painScore: "",
    mucousMembrane: "",
    capillaryRefillSec: "",
    notes: "",
  };
}

function canonicalMeasurementInput(
  value: string,
  converter: ((value: number) => number) | undefined,
  scale: number,
): string {
  const trimmed = value.trim();
  if (!trimmed || !converter) return trimmed;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return String(roundClinicalMeasurement(converter(parsed), scale));
}

function formatClinicalTemperature(
  value: number | string | null | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return measurementSystem === "us_customary"
    ? `${roundClinicalMeasurement(celsiusToFahrenheit(parsed))} F`
    : `${roundClinicalMeasurement(parsed)} C`;
}

function formatClinicalWeight(
  value: number | string | null | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return measurementSystem === "us_customary"
    ? `${roundClinicalMeasurement(kilogramsToPounds(parsed))} lb`
    : `${roundClinicalMeasurement(parsed, 3)} kg`;
}

function PatientDetailErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function PatientDetailLoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <PatientHeaderSkeleton />
      <PatientSnapshotSkeleton />
    </div>
  );
}

/** Dense heading wrapper for a chart sub-section inside one clinical unit. */
function ChartSection({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`patient-section-${id}`} className="space-y-3">
      <h3
        id={`patient-section-${id}`}
        className="border-b border-border pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

export default function PatientDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab) {
      if (TAB_IDS.includes(urlTab as Tab)) {
        return urlTab as Tab;
      }
      return LEGACY_TAB_MAP[urlTab] ?? "overview";
    }
    return "overview";
  });

  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);
  const [fieldVisitLocationId, setFieldVisitLocationId] = useState("");
  const [copiedMicrochip, setCopiedMicrochip] = useState(false);

  // Six dense clinical units replace the previous eleven spread-out tabs.
  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: "overview", label: t("patients.tabs.overview", "Overview") },
      { id: "history", label: t("patients.tabs.records", "Medical Records") },
      {
        id: "diagnostics",
        label: t("patients.tabs.diagnostics", "Diagnostics & Vitals"),
      },
      {
        id: "preventive",
        label: t("patients.tabs.preventive", "Vaccinations & Procedures"),
      },
      {
        id: "prescriptions",
        label: t("patients.tabs.prescriptions", "Prescriptions & Therapy"),
      },
      { id: "admin", label: t("patients.tabs.admin", "Documents & Billing") },
    ],
    [t],
  );

  // Sub-sections rendered inside a tab. Labels live here so every panel keeps
  // a stable, translatable heading.
  const chartSections = useMemo(
    () => ({
      overview: [
        { id: "weight", label: t("patients.tabs.weight", "Weight History") },
        {
          id: "appointments",
          label: t("patients.tabs.appointments", "Appointments"),
        },
      ],
      diagnostics: [
        { id: "labResults", label: t("patients.tabs.labResults", "Lab Results") },
        { id: "vitals", label: t("patients.tabs.vitals", "Vitals") },
      ],
      preventive: [
        {
          id: "vaccinations",
          label: t("patients.tabs.vaccinations", "Vaccinations"),
        },
        { id: "procedures", label: t("patients.tabs.procedures", "Procedures") },
      ],
      admin: [
        { id: "documents", label: t("patients.tabs.documents", "Documents") },
        { id: "invoices", label: t("patients.tabs.invoices", "Invoices") },
      ],
    }),
    [t],
  );


  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerCardRef = useRef<HTMLDivElement>(null);
  const photoUploadAttemptRef = useRef<ManagedUploadAttempt | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const canManagePatientDetail = canManagePatientDetailRole(
    session?.user?.role,
  );
  const canRecordVitals = canRecordVitalsRole(session?.user?.role);
  const canCorrectClinicalRecords = canCorrectClinicalRecordRole(
    session?.user?.role,
  );
  const canEditVaccinationCertificate = canEditVaccinationCertificateRole(
    session?.user?.role,
  );
  const canSearchPatientHistory = canSearchPatientHistoryRole(
    session?.user?.role,
  );
  const canCreateSoapNote = canCreateSoapNoteRole(session?.user?.role);
  const canPrescribe = canPrescribeRole(session?.user?.role);
  const canRecordVaccination = canRecordVaccinationRole(session?.user?.role);

  const {
    data: patient,
    isLoading,
    error,
  } = trpc.patients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id },
  );
  const canonicalPatientId = patient?.id ?? params.id;
  const refreshPatientDetail = () =>
    Promise.all(
      Array.from(new Set([params.id, canonicalPatientId])).map((id) =>
        utils.patients.getById.invalidate({ id }),
      ),
    );

  useEffect(() => {
    if (!patient?.mergeMetadata || patient.id === params.id) return;
    window.history.replaceState(
      window.history.state,
      "",
      `/patients/${patient.id}?mergedFrom=${params.id}`,
    );
  }, [params.id, patient?.id, patient?.mergeMetadata]);
  const {
    data: recordsSettings,
    isLoading: recordsSettingsLoading,
    error: recordsSettingsError,
  } = trpc.records.settings.useQuery();
  const ambulatoryEnabled =
    recordsSettings?.ambulatoryWorkspace.enabled === true;
  const chartMeasurementSystem =
    recordsSettings?.ambulatoryWorkspace.measurementSystem ?? "metric";
  const chartBodyConditionScale =
    recordsSettings?.ambulatoryWorkspace.bodyConditionScale ?? 9;
  const fieldVisitLocationsQuery = trpc.appointments.listLocations.useQuery(
    undefined,
    {
      enabled:
        ambulatoryEnabled && canRecordVitals && patient?.status === "active",
    },
  );

  async function uploadPatientPhoto(selectedFile?: File) {
    if (!canManagePatientDetail) {
      return;
    }

    if (selectedFile && !isImageUploadFileValid(selectedFile)) {
      photoUploadAttemptRef.current = null;
      setPhotoUploadError(null);
      toast.error(IMAGE_UPLOAD_POLICY_MESSAGE);
      return;
    }

    if (selectedFile) {
      photoUploadAttemptRef.current = selectManagedUploadFile(
        photoUploadAttemptRef.current,
        selectedFile,
      );
    }
    const attempt = photoUploadAttemptRef.current;
    if (!attempt) return;

    const formData = new FormData();
    formData.append("file", attempt.file);
    formData.append("category", "patient-photos");
    formData.append("patientId", canonicalPatientId);

    setUploadingPhoto(true);
    setPhotoUploadError(null);
    try {
      const res = await fetchWithClientTimeout(
        "/api/upload",
        {
          method: "POST",
          body: formData,
          headers: { "Idempotency-Key": attempt.idempotencyKey },
        },
        CLIENT_UPLOAD_TIMEOUT_MS,
      );

      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        photoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "response",
          status: res.status,
        });
        throw new Error(json.error ?? t("patients.photo.uploadFailed", "Upload failed"));
      }

      photoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
        kind: "success",
      });
      await refreshPatientDetail();
      toast.success(t("patients.detail.photoUpdated", "Fotografia pacienta aktualizovaná"));
    } catch (err) {
      if (photoUploadAttemptRef.current === attempt) {
        photoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "ambiguous",
        });
      }
      const message =
        err instanceof Error ? err.message : t("patients.photo.uploadError", "Failed to upload photo");
      setPhotoUploadError(message);
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (file) void uploadPatientPhoto(file);
  }

  // These sources power the ambulatory snapshot and fail closed together. SOAP
  // history remains lazy until a full medical summary is requested.
  const problemsQuery = trpc.records.listProblems.useQuery(
    { patientId: canonicalPatientId },
    { enabled: ambulatoryEnabled },
  );
  const vaccinationsQuery = trpc.records.listVaccinations.useQuery(
    { patientId: canonicalPatientId },
    { enabled: ambulatoryEnabled },
  );
  const snapshotVitalsQuery = trpc.vitals.listByPatient.useQuery(
    { patientId: canonicalPatientId, limit: 50 },
    { enabled: ambulatoryEnabled },
  );
  const soapNotesQuery = trpc.records.listSoapNotes.useQuery(
    { patientId: canonicalPatientId },
    { enabled: false },
  );
  const prescriptionsQuery = trpc.records.listPrescriptions.useQuery(
    { patientId: canonicalPatientId },
    { enabled: ambulatoryEnabled },
  );
  const recentVisitsQuery = trpc.appointments.listByPatient.useQuery(
    { patientId: canonicalPatientId, limit: 5 },
    { enabled: ambulatoryEnabled },
  );
  // Owner contact for the overview quick facts.
  const clientQuery = trpc.clients.getById.useQuery(
    { id: patient?.clientId ?? "" },
    { enabled: Boolean(patient?.clientId) },
  );
  // Insurance status shown next to the patient facts.
  const insuranceQuery = trpc.insurance.listPolicies.useQuery(
    { patientId: canonicalPatientId },
    { enabled: Boolean(patient?.id) },
  );
  const recordsSettingsMissing =
    !recordsSettingsLoading && !recordsSettingsError && !recordsSettings;
  const verifiedRecordsSettings =
    recordsSettingsError || recordsSettingsMissing || !recordsSettings
      ? null
      : recordsSettings;
  const recordsSettingsTimeZone = verifiedRecordsSettings
    ? verifiedRecordsSettings.timezone
    : undefined;
  const weightTrend = useMemo(
    () => buildWeightTrend(patient?.weights ?? [], recordsSettingsTimeZone),
    [patient?.weights, recordsSettingsTimeZone],
  );
  const [weightKg, setWeightKg] = useState("");
  const [weightMeasuredAt, setWeightMeasuredAt] = useState("");
  const weightMeasuredInstant =
    weightMeasuredAt && recordsSettingsTimeZone
      ? dateTimeLocalInputUtcInstant(weightMeasuredAt, recordsSettingsTimeZone)
      : null;
  const weightTimeValid =
    !weightMeasuredAt ||
    Boolean(
      weightMeasuredInstant && weightMeasuredInstant.getTime() <= Date.now(),
    );
  const canonicalPatientWeight = canonicalMeasurementInput(
    weightKg,
    chartMeasurementSystem === "us_customary" ? poundsToKilograms : undefined,
    3,
  );
  const addWeight = trpc.patients.addWeight.useMutation({
    onSuccess: () => {
      toast.success(t("patients.weight.toastRecorded", "Weight recorded"));
      setWeightMeasuredAt("");
      void refreshPatientDetail();
      setWeightKg("");
    },
    onError: (err) => toast.error(err.message),
  });
  const canSubmitWeight =
    canManagePatientDetail &&
    isPatientWeightInputValid(canonicalPatientWeight) &&
    weightTimeValid &&
    !addWeight.isPending;

  function handleRecordWeight(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitWeight || !patient) return;
    addWeight.mutate({
      patientId: patient.id,
      weightKg: canonicalPatientWeight,
      recordedAt: weightMeasuredInstant ?? undefined,
    });
  }

  // Allergies: recorded here feed the alert bar, prescription safety
  // warnings, the portal, and PDF summaries.
  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [allergyName, setAllergyName] = useState("");
  const [allergySeverity, setAllergySeverity] = useState<
    "mild" | "moderate" | "severe"
  >("moderate");
  const [allergyReaction, setAllergyReaction] = useState("");
  const addAllergy = trpc.patients.addAllergy.useMutation({
    onSuccess: () => {
      toast.success(t("patients.allergy.toastRecorded", "Allergy recorded"));
      void refreshPatientDetail();
      setAllergyName("");
      setAllergyReaction("");
      setAllergySeverity("moderate");
      setShowAllergyForm(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const startFieldVisit = trpc.appointments.startFieldVisit.useMutation({
    onSuccess: ({ appointment, created }) => {
      toast.success(
        created ? t("patients.fieldVisit.started", "Field visit started") : t("patients.fieldVisit.resumed", "Open field visit resumed"),
      );
      router.push(`/encounters/${appointment.id}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const correctAllergy = trpc.patients.markAllergyEnteredInError.useMutation({
    onSuccess: () => {
      toast.success(t("patients.allergy.correctionRecorded", "Allergy correction recorded"));
      void refreshPatientDetail();
    },
    onError: (err) => toast.error(err.message),
  });
  const canSubmitAllergy =
    canManagePatientDetail &&
    allergyName.trim().length > 0 &&
    !addAllergy.isPending;

  function handleAddAllergy(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitAllergy || !patient) return;
    addAllergy.mutate({
      patientId: patient.id,
      allergen: allergyName.trim(),
      severity: allergySeverity,
      reaction: allergyReaction.trim() || undefined,
    });
  }

  const loadError = error ?? recordsSettingsError;
  const isPageLoading = !loadError && (isLoading || recordsSettingsLoading);

  if (isPageLoading) {
    return (
      <PatientDetailLoadingPanel
        label={t("patients.profile.loading", "Loading patient...")}
      />
    );
  }

  if (
    loadError ||
    recordsSettingsMissing ||
    !verifiedRecordsSettings ||
    !patient
  ) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("patients.form.loadError", "Unable to load patient")}
        description={
          loadError?.message ??
          (recordsSettingsMissing || !verifiedRecordsSettings
            ? t(
                "common.error_retry",
                "Unable to load clinical settings. Please retry.",
              )
            : t(
                "patients.profile.patientNotFoundDesc",
                "Choose a patient from the Patients list before opening the detail page.",
              ))
        }
        action={{
          label: t("patients.actions.backToPatients", "Back to Patients"),
          onClick: () => router.push("/patients"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  const patientData = patient;
  const recordsTimeZone = verifiedRecordsSettings.timezone;
  const recordsPracticeName =
    verifiedRecordsSettings.name ?? "Veterinary Practice";
  const recordsPracticePhone = verifiedRecordsSettings.phone;
  const ambulatoryProfile = verifiedRecordsSettings.ambulatoryWorkspace;
  const fieldVisitLocations = fieldVisitLocationsQuery.data ?? [];
  const fieldVisitLocationsMissing =
    !fieldVisitLocationsQuery.isLoading &&
    !fieldVisitLocationsQuery.error &&
    !fieldVisitLocationsQuery.data;
  const selectedFieldVisitLocationId =
    fieldVisitLocations.length === 1
      ? fieldVisitLocations[0]!.id
      : fieldVisitLocations.some(
            (location) => location.id === fieldVisitLocationId,
          )
        ? fieldVisitLocationId
        : "";
  const fieldVisitLocationsUnavailable =
    fieldVisitLocationsQuery.isLoading ||
    Boolean(fieldVisitLocationsQuery.error) ||
    fieldVisitLocationsMissing ||
    fieldVisitLocations.length === 0;
  const activeProblems = (problemsQuery.data ?? []).filter(
    (problem) => problem.status === "active",
  );
  const activePrescriptions = (prescriptionsQuery.data ?? []).filter(
    (prescription) => prescription.effectiveStatus === "active",
  );
  const latestWeightKg = patient.weights[0]?.weightKg;
  const latestWeight = latestWeightKg
    ? ambulatoryProfile.measurementSystem === "us_customary"
      ? `${roundClinicalMeasurement(kilogramsToPounds(Number(latestWeightKg)))} lb`
      : `${roundClinicalMeasurement(Number(latestWeightKg), 3)} kg`
    : "Not recorded";
  const latestVisit = recentVisitsQuery.data?.[0];
  const latestSnapshotVitals = snapshotVitalsQuery.data?.find(
    (vital) => !vital.correctionId,
  );
  const latestSnapshotBcs = snapshotVitalsQuery.data?.find(
    (vital) => !vital.correctionId && vital.bodyConditionScore !== null,
  );
  const latestVitalsSummary = latestSnapshotVitals
    ? [
        latestSnapshotVitals.temperatureC != null
          ? formatClinicalTemperature(
              latestSnapshotVitals.temperatureC,
              ambulatoryProfile.measurementSystem,
            )
          : null,
        latestSnapshotVitals.heartRateBpm != null
          ? "HR " + latestSnapshotVitals.heartRateBpm
          : null,
        latestSnapshotVitals.respiratoryRateBpm != null
          ? "RR " + latestSnapshotVitals.respiratoryRateBpm
          : null,
        latestSnapshotVitals.weightKg != null
          ? formatClinicalWeight(
              latestSnapshotVitals.weightKg,
              ambulatoryProfile.measurementSystem,
            )
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ") || "Recorded without summary values"
    : "None recorded";
  const activeVisitId =
    (recentVisitsQuery.data ?? []).find((visit) => visit.status === "in_exam")
      ?.id ?? null;
  // Overview shows the raw measurement line (or nothing) so the panel can
  // render its own localized empty state.
  const overviewVitalsSummary = latestSnapshotVitals
    ? [
        latestSnapshotVitals.temperatureC != null
          ? formatClinicalTemperature(
              latestSnapshotVitals.temperatureC,
              ambulatoryProfile.measurementSystem,
            )
          : null,
        latestSnapshotVitals.heartRateBpm != null
          ? String(latestSnapshotVitals.heartRateBpm) + " /min"
          : null,
        latestSnapshotVitals.respiratoryRateBpm != null
          ? String(latestSnapshotVitals.respiratoryRateBpm) + " /min"
          : null,
        latestSnapshotVitals.weightKg != null
          ? formatClinicalWeight(
              latestSnapshotVitals.weightKg,
              ambulatoryProfile.measurementSystem,
            )
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ") || null
    : null;
  const overviewVitalsAt = latestSnapshotVitals?.recordedAt
    ? formatClinicalDateTime(latestSnapshotVitals.recordedAt, recordsTimeZone)
    : null;
  const insurancePolicy = insuranceQuery.data?.[0] ?? null;
  const insuranceSummary = insurancePolicy
    ? {
        providerName: insurancePolicy.providerName ?? null,
        policyNumber: insurancePolicy.policyNumber ?? null,
        expirationDate: insurancePolicy.expirationDate
          ? String(insurancePolicy.expirationDate)
          : null,
        coveragePercent:
          insurancePolicy.coveragePercent !== null &&
          insurancePolicy.coveragePercent !== undefined
            ? Number(insurancePolicy.coveragePercent)
            : null,
      }
    : null;
  const insuranceExpired = Boolean(
    insurancePolicy?.expirationDate &&
      new Date(insurancePolicy.expirationDate).getTime() < Date.now(),
  );

  const currentVaccinations = (vaccinationsQuery.data ?? []).filter(
    (vaccination) => !vaccination.correctionId,
  );
  const nextVaccinationDueDate = currentVaccinations
    .flatMap((vaccination) =>
      vaccination.nextDueDate ? [vaccination.nextDueDate] : [],
    )
    .sort()[0];
  const vaccinationSummary = currentVaccinations.length
    ? String(currentVaccinations.length) +
      " recorded" +
      (nextVaccinationDueDate
        ? " · next due " +
          formatClinicalDate(nextVaccinationDueDate, recordsTimeZone)
        : " · no due date recorded")
    : "None recorded";

  async function handleDownloadSummary() {
    try {
      const [
        problemsResult,
        vaccinationsResult,
        soapNotesResult,
        prescriptionsResult,
      ] = await Promise.all([
        problemsQuery.refetch(),
        vaccinationsQuery.refetch(),
        soapNotesQuery.refetch(),
        prescriptionsQuery.refetch(),
      ]);

      const summaryError =
        problemsResult.error ??
        vaccinationsResult.error ??
        soapNotesResult.error ??
        prescriptionsResult.error;
      if (summaryError) {
        throw summaryError;
      }
      if (
        !problemsResult.data ||
        !vaccinationsResult.data ||
        !soapNotesResult.data ||
        !prescriptionsResult.data
      ) {
        throw new Error(
          "Unable to load complete medical summary data. Please retry.",
        );
      }

      const problems = problemsResult.data;
      const vaccinations = vaccinationsResult.data;
      const soapNotes = soapNotesResult.data;
      const prescriptions = prescriptionsResult.data;
      const { generateMedicalSummaryPdf } = await import("@/lib/pdf");

      generateMedicalSummaryPdf({
        practiceName: recordsPracticeName,
        practicePhone: recordsPracticePhone ?? undefined,
        patientName: patientData.name,
        species: patientData.species ?? "Unknown",
        breed: patientData.breed ?? undefined,
        sex: patientData.sex ?? undefined,
        dob: patientData.dob ?? undefined,
        color: patientData.color ?? undefined,
        microchip: patientData.microchipNumber ?? undefined,
        clientName: [patientData.clientFirstName, patientData.clientLastName]
          .filter(Boolean)
          .join(" "),
        allergies: (patientData.allergies ?? []).map((a) => ({
          allergen: a.allergen,
          severity: a.severity ?? "unknown",
          reaction: a.reaction ?? undefined,
        })),
        problems: problems.map((p) => ({
          description: p.description,
          status: p.status ?? "active",
          onsetDate: p.onsetDate ?? undefined,
        })),
        vaccinations: vaccinations
          .filter((v) => !v.correctionId)
          .map((v) => ({
            name: v.vaccineName,
            date: v.administeredAt
              ? formatClinicalDate(v.administeredAt, recordsTimeZone, "Unknown")
              : "Unknown",
            nextDue: v.nextDueDate
              ? formatClinicalDate(v.nextDueDate, recordsTimeZone)
              : undefined,
          })),
        recentNotes: soapNotes
          .filter((note) => note.status === "finalized" && !note.correctionId)
          .slice(0, 5)
          .map((n) => ({
            date: n.createdAt
              ? formatClinicalDate(n.createdAt, recordsTimeZone, "Unknown")
              : "Unknown",
            subjective: n.subjective ?? undefined,
            objective: n.objective ?? undefined,
            assessment: n.assessment ?? undefined,
            plan: n.plan ?? undefined,
            imported: n.imported,
            authorName: n.authorName,
            finalizerName: n.finalizerName ?? undefined,
            finalizedAt: n.finalizedAt
              ? formatClinicalDateTime(n.finalizedAt, recordsTimeZone)
              : undefined,
            replacementForLabel: n.replacesSoapNoteId
              ? `SOAP note dated ${formatClinicalDate(
                  soapNotes.find((source) => source.id === n.replacesSoapNoteId)
                    ?.createdAt,
                  recordsTimeZone,
                  "unknown date",
                )}`
              : undefined,
            addenda: n.addenda.map((addendum) => ({
              content: soapSectionText(addendum.content),
              authorName: addendum.authorName,
              createdAt: formatClinicalDateTime(
                addendum.createdAt,
                recordsTimeZone,
              ),
            })),
          })),
        recordCorrections: [
          ...(patientData.allergyHistory ?? [])
            .filter(
              (allergy) =>
                Boolean(allergy.correctionId) &&
                Boolean(allergy.correctionReason) &&
                Boolean(allergy.correctedAt),
            )
            .map((allergy) => ({
              recordLabel: `Allergy “${allergy.allergen}” recorded ${formatClinicalDate(
                allergy.notedAt,
                recordsTimeZone,
                "Unknown date",
              )}`,
              reason: allergy.correctionReason ?? "Reason unavailable",
              correctedByName: allergy.correctedByName ?? "Unknown clinician",
              correctedAt: allergy.correctedAt
                ? formatClinicalDateTime(allergy.correctedAt, recordsTimeZone)
                : "Unknown time",
            })),
          ...soapNotes
            .filter(
              (note) =>
                note.status === "finalized" && Boolean(note.correctionId),
            )
            .map((note) => ({
              recordLabel: `SOAP note dated ${formatClinicalDate(
                note.createdAt,
                recordsTimeZone,
                "Unknown date",
              )}`,
              reason: note.correctionReason ?? "Reason unavailable",
              correctedByName: note.correctedByName ?? "Unknown clinician",
              correctedAt: note.correctedAt
                ? formatClinicalDateTime(note.correctedAt, recordsTimeZone)
                : "Unknown time",
              replacementLabel: note.replacementSoapNoteId
                ? (() => {
                    const replacement = soapNotes.find(
                      (candidate) =>
                        candidate.id === note.replacementSoapNoteId,
                    );
                    return replacement
                      ? `SOAP note dated ${formatClinicalDate(
                          replacement.createdAt,
                          recordsTimeZone,
                          "unknown date",
                        )}, finalized by ${replacement.finalizerName ?? "Unknown clinician"}`
                      : "Replacement SOAP retained in chart";
                  })()
                : undefined,
            })),
        ],
        prescriptions: prescriptions.map((rx) => ({
          medication: rx.medicationName,
          dosage: rx.dosage ?? "",
          frequency: rx.frequency ?? "",
          status: rx.effectiveStatus ?? "active",
        })),
        generatedDate: formatClinicalDate(new Date(), recordsTimeZone),
      }).save(`${patientData.name.replace(/\s+/g, "_")}_medical_summary.pdf`);

      toast.success(t("patients.detail.summaryDownloaded", "Zdravotný súhrn stiahnutý"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("patients.detail.summaryError", "Failed to generate medical summary"),
      );
    }
  }

  const statusColor =
    patient.status === "active"
      ? "bg-emerald-500"
      : patient.status === "deceased"
        ? "bg-gray-400"
        : "bg-amber-500";

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/patients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("patients.actions.backToPatients", "Back to Patients")}
      </Button>

      <RecentClinicalItems
        patientId={patient.id}
        enabled={ambulatoryProfile.enabled}
      />

      {patient.mergeMetadata ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <div className="flex items-start gap-3">
            <GitMerge className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {t(
                  "patients.duplicates.canonicalChartOpened",
                  "Opened the canonical chart for a merged patient identity",
                )}
              </p>
              <p className="mt-1">
                {t(
                  "patients.duplicates.mergedIntoNotice",
                  `${patient.mergeMetadata.sourceSnapshot.name} was merged into this chart by ${patient.mergeMetadata.performedByName} on ${formatClinicalDateTime(
                    patient.mergeMetadata.createdAt,
                    recordsTimeZone,
                  )}.`,
                  {
                    name: patient.mergeMetadata.sourceSnapshot.name,
                    performedBy: patient.mergeMetadata.performedByName,
                    date: formatClinicalDateTime(
                      patient.mergeMetadata.createdAt,
                      recordsTimeZone,
                    ),
                  },
                )}
              </p>
              <p className="mt-1 text-blue-800 dark:text-blue-200">
                {t(
                  "patients.duplicates.reasonPrefix",
                  `Reason: ${patient.mergeMetadata.reason}`,
                  { reason: patient.mergeMetadata.reason },
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Patient Header Card */}
      <div ref={headerCardRef} className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="space-y-1">
              <div className="group relative h-16 w-16 overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-xs">
                {patient.photoUrl ? (
                  <img
                    src={patient.photoUrl}
                    alt={patient.name}
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-3xl">
                    {speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}
                  </div>
                )}
                {canManagePatientDetail && (
                  <>
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-wait"
                      title={t("patients.profile.uploadPhoto", "Upload photo")}
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      ) : (
                        <Camera className="h-5 w-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </>
                )}
              </div>
              {photoUploadError && photoUploadAttemptRef.current ? (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => void uploadPatientPhoto()}
                  className="whitespace-nowrap text-xs font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
                >
                  {t("patients.profile.tryPhotoAgain", "Try photo again")}
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {patient.name}
                </h1>
                <StatusPulseBadge
                  variant={
                    patient.status === "deceased"
                      ? "deceased"
                      : patient.status === "inactive"
                        ? "offline"
                        : "online"
                  }
                  label={
                    patient.status === "deceased"
                      ? t("patients.status.deceased", "Deceased")
                      : patient.status === "inactive"
                        ? t("patients.status.inactive", "Inactive")
                        : t("patients.status.active", "Active")
                  }
                  size="md"
                />
              </div>

              {/* Metadata Pills Row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
                  <span>{speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}</span>
                  <span>
                    {patient.species &&
                      (patient.species in PATIENT_SPECIES_EMOJI
                        ? t(
                            `patients.species_${patient.species}`,
                            patient.species.charAt(0).toUpperCase() +
                              patient.species.slice(1),
                          )
                        : patient.species.charAt(0).toUpperCase() +
                          patient.species.slice(1))}
                  </span>
                </span>

                {patient.breed && (
                  <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {patient.breed}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {patient.dob ? (
                    <Cake className="h-3.5 w-3.5 text-amber-500/90 shrink-0" />
                  ) : null}
                  <span>{calculateAge(patient.dob, t)}</span>
                </span>

                {patient.sex && (
                  <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {formatSex(patient.sex, t)}
                  </span>
                )}

                {patient.color && (
                  <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                    {t(
                      "patients.profile.colorPrefix",
                      `Color: ${patient.color}`,
                      { color: patient.color },
                    )}
                  </span>
                )}

                {patient.microchipNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(patient.microchipNumber!);
                      setCopiedMicrochip(true);
                      setTimeout(() => setCopiedMicrochip(false), 2000);
                      toast.success(
                        t(
                          "patients.profile.microchipCopied",
                          "Microchip copied to clipboard",
                        ),
                      );
                    }}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 hover:bg-muted/60 px-2.5 py-1 text-xs font-mono tabular-nums text-foreground/90 transition-all shadow-2xs hover:border-primary/40 cursor-pointer"
                    title={t("patients.profile.copyMicrochip", "Click to copy microchip")}
                  >
                    <span className="text-[10px] uppercase font-sans text-muted-foreground font-semibold">{t("patients.profile.chipLabel", "Chip:")}</span>
                    <span className="tracking-tight">{patient.microchipNumber}</span>
                    {copiedMicrochip ? (
                      <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground/70 group-hover:text-foreground shrink-0 transition-colors" />
                    )}
                  </button>
                )}
              </div>

              {patient.clientFirstName && (
                <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => router.push(`/clients/${patient.clientId}`)}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline hover:text-primary/90"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>{patient.clientFirstName} {patient.clientLastName}</span>
                  </button>
                  {patient.clientPhone ? (
                    <a
                      href={`tel:${patient.clientPhone}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-mono tabular-nums transition-colors"
                      title={t("patients.profile.callClient", "Call client")}
                    >
                      <Phone className="h-3 w-3" />
                      <span>{patient.clientPhone}</span>
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {verifiedRecordsSettings.ambulatoryWorkspace.enabled &&
            canRecordVitals &&
            patient.status === "active" ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {fieldVisitLocations.length > 1 ? (
                    <label>
                      <span className="sr-only">
                        {t(
                          "patients.actions.fieldVisitLocation",
                          "Field visit location",
                        )}
                      </span>
                      <select
                        aria-label={t(
                          "patients.actions.fieldVisitLocation",
                          "Field visit location",
                        )}
                        value={selectedFieldVisitLocationId}
                        disabled={
                          fieldVisitLocationsUnavailable ||
                          startFieldVisit.isPending
                        }
                        onChange={(event) =>
                          setFieldVisitLocationId(event.target.value)
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">
                          {t(
                            "patients.actions.selectLocation",
                            "Select location...",
                          )}
                        </option>
                        {fieldVisitLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={
                      startFieldVisit.isPending ||
                      fieldVisitLocationsUnavailable ||
                      !selectedFieldVisitLocationId
                    }
                    onClick={() => {
                      if (!selectedFieldVisitLocationId) return;
                      startFieldVisit.mutate({
                        patientId: patient.id,
                        locationId: selectedFieldVisitLocationId,
                      });
                    }}
                  >
                    {startFieldVisit.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Stethoscope className="mr-2 h-4 w-4" />
                    )}
                    {startFieldVisit.isPending
                      ? t("patients.actions.startingVisit", "Starting visit...")
                      : t(
                          "patients.actions.fieldVisit",
                          "Start field visit",
                        )}
                  </Button>
                </div>
                {fieldVisitLocationsQuery.error ||
                fieldVisitLocationsMissing ||
                (!fieldVisitLocationsQuery.isLoading &&
                  fieldVisitLocations.length === 0) ? (
                  <p className="max-w-xs text-right text-xs text-destructive">
                    {fieldVisitLocationsQuery.error?.message ??
                      t("patients.fieldVisit.addLocationFirst", "Add an active location before starting a field visit.")}
                  </p>
                ) : fieldVisitLocations.length > 1 &&
                  !selectedFieldVisitLocationId ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "patients.actions.chooseLocationHelp",
                      "Choose where this field visit is managed.",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/records?patientId=${patient.id}`}>
                <FileText className="mr-2 h-4 w-4" />
                {t(
                  "patients.actions.openClinicalChart",
                  "Otvoriť klinickú kartu",
                )}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
              <FileDown className="mr-2 h-4 w-4" />
              {t(
                "patients.actions.downloadMedicalSummary",
                "Download Summary",
              )}
            </Button>
            {canManagePatientDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/patients/${patient.id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("patients.actions.editPatient", "Edit")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <PatientStickyRail
        name={patient.name}
        species={patient.species}
        status={patient.status ?? "active"}
        allergies={patient.allergies ?? []}
        latestWeight={latestWeight}
        ambulatoryEnabled={ambulatoryProfile.enabled}
        sentinelRef={headerCardRef}
      />

      {/* Deceased Patient Sympathy Banner (Sympathy Gate active) */}
      {patient.status === "deceased" ? (
        <div className="mt-4 rounded-xl border border-slate-300/60 bg-gradient-to-r from-slate-100/90 via-slate-50 to-slate-100/90 p-4 text-slate-800 shadow-2xs dark:border-slate-800 dark:bg-gradient-to-r dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-900/60 dark:text-slate-200">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-slate-200/80 p-2 dark:bg-slate-800 shrink-0">
              <Heart className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">
                  {t("patients.sympathy.inMemoriam", "In Memoriam")}
                </p>
                <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {t("patients.sympathy.gateActive", "Sympathy Gate Active")}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t(
                  "patients.sympathy.notice",
                  "This patient is marked as deceased. Automated reminders, vaccination alerts, marketing, and client portal notifications are respectfully suppressed.",
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {ambulatoryProfile.enabled ? (
        <section className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">
                {t("patients.profile.snapshotTitle", "Patient snapshot")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  "patients.profile.snapshotSubtitle",
                  "The field essentials before treatment begins.",
                )}
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {t("patients.profile.latestWeight", `Latest weight: ${latestWeight}`, {
                weight: latestWeight,
              })}
            </span>
          </div>
          {problemsQuery.isLoading ||
          prescriptionsQuery.isLoading ||
          recentVisitsQuery.isLoading ||
          snapshotVitalsQuery.isLoading ||
          vaccinationsQuery.isLoading ? (
            <PatientSnapshotSkeleton />
          ) : problemsQuery.error ||
            prescriptionsQuery.error ||
            recentVisitsQuery.error ||
            snapshotVitalsQuery.error ||
            vaccinationsQuery.error ||
            !problemsQuery.data ||
            !prescriptionsQuery.data ||
            !recentVisitsQuery.data ||
            !snapshotVitalsQuery.data ||
            !vaccinationsQuery.data ? (
            <p className="mt-3 text-sm text-destructive">
              {t(
                "patients.profile.snapshotError",
                "The complete clinical snapshot could not be verified. Open the chart sections below before relying on history.",
              )}
            </p>
          ) : (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.allergies", "Allergies")}
                </dt>
                <dd className="mt-1">
                  {patient.allergies.length
                    ? patient.allergies
                        .map((allergy) => allergy.allergen)
                        .join(", ")
                    : t("patients.profile.noneRecorded", "None recorded")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.activeProblems", "Active problems")}
                </dt>
                <dd className="mt-1">
                  {activeProblems.length
                    ? activeProblems
                        .map((problem) => problem.description)
                        .join(", ")
                    : t("patients.profile.noneRecorded", "None recorded")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.activeMedications", "Active medications")}
                </dt>
                <dd className="mt-1">
                  {activePrescriptions.length
                    ? activePrescriptions
                        .map((prescription) =>
                          prescription.dosage
                            ? `${prescription.medicationName} (${prescription.dosage}${prescription.frequency ? ` · ${prescription.frequency}` : ""})`
                            : prescription.medicationName,
                        )
                        .join(", ")
                    : t("patients.profile.noneRecorded", "None recorded")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.lastVisit", "Last visit")}
                </dt>
                <dd className="mt-1">
                  {latestVisit
                    ? `${formatClinicalDate(latestVisit.startTime, recordsTimeZone)} · ${latestVisit.origin === "field" ? t("patients.profile.fieldVisitOrigin", "Field visit") : (latestVisit.typeName ?? t("patients.profile.appointmentOrigin", "Appointment"))}`
                    : t("patients.profile.noPriorVisits", "No prior visits")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.latestVitals", "Latest vitals")}
                </dt>
                <dd className="mt-1">{latestVitalsSummary}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("patients.profile.bcsVaccines", "BCS / vaccines")}
                </dt>
                <dd className="mt-1">
                  BCS{" "}
                  {latestSnapshotBcs?.bodyConditionScore !== null &&
                  latestSnapshotBcs?.bodyConditionScore !== undefined ? (
                    <>
                      {latestSnapshotBcs.bodyConditionScore} /{" "}
                      {latestSnapshotBcs.bodyConditionScale}
                    </>
                  ) : (
                    t("patients.profile.notRecorded", "not recorded")
                  )}
                  {" · "}
                  {vaccinationSummary}
                </dd>
              </div>
            </dl>
          )}
        </section>
      ) : null}

      {/* Allergy Alert Bar */}
      {patient.allergies && patient.allergies.length > 0 ? (
        <div className="mt-4 rounded-xl border border-red-200/80 bg-red-50/60 p-4 shadow-xs dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/40 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">
                    {t("patients.profile.allergies", "Allergies")}
                  </h4>
                  <span className="rounded-full bg-red-200/70 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-900/60 dark:text-red-200">
                    {patient.allergies.length}
                  </span>
                </div>
                {canManagePatientDetail && !showAllergyForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAllergyForm(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-300/80 bg-red-100/50 hover:bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 transition-colors dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                  >
                    <Plus className="h-3 w-3" />
                    {t("patients.profile.add", "Add")}
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                {patient.allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm transition-shadow shadow-2xs",
                      allergy.severity === "severe"
                        ? "border-red-300/80 bg-red-100/60 text-red-950 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-100"
                        : allergy.severity === "moderate"
                          ? "border-amber-300/80 bg-amber-100/60 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-100"
                          : "border-yellow-300/80 bg-yellow-50 text-yellow-950 dark:border-yellow-800/80 dark:bg-yellow-950/50 dark:text-yellow-100",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground dark:text-inherit">
                        {allergy.allergen}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                          allergy.severity === "severe"
                            ? "bg-red-600 text-white shadow-2xs"
                            : allergy.severity === "moderate"
                              ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                              : "bg-yellow-500/20 text-yellow-900 dark:text-yellow-200 border border-yellow-500/30",
                        )}
                      >
                        {allergy.severity === "severe" && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                          </span>
                        )}
                        {allergy.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground dark:text-inherit/80">
                      {t(
                        "patients.profile.reactionPrefix",
                        `Reaction: ${allergy.reaction || "Not documented"}`,
                        {
                          reaction:
                            allergy.reaction ||
                            t("patients.profile.notDocumented", "Not documented"),
                        },
                      )}
                    </p>
                    <ClinicalCorrectionControl
                      correction={null}
                      canCorrect={canCorrectClinicalRecords}
                      isPending={correctAllergy.isPending}
                      triggerLabel={t(
                        "patients.profile.markAllergyError",
                        "Mark allergy entered in error",
                      )}
                      description={t(
                        "patients.profile.markAllergyErrorDesc",
                        "The original allergy and this permanent reason remain in staff chart history. The allergy will stop feeding current alerts, prescription safety, AI context, PDF summaries, and the client portal.",
                      )}
                      timeZone={recordsTimeZone}
                      onCorrect={(reason) =>
                        correctAllergy.mutateAsync({
                          patientId: patient.id,
                          recordId: allergy.id,
                          reason,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {showAllergyForm ? (
                <div className="mt-3">
                  <AllergyForm
                    allergyName={allergyName}
                    setAllergyName={setAllergyName}
                    allergySeverity={allergySeverity}
                    setAllergySeverity={setAllergySeverity}
                    allergyReaction={allergyReaction}
                    setAllergyReaction={setAllergyReaction}
                    canSubmit={canSubmitAllergy}
                    isPending={addAllergy.isPending}
                    onSubmit={handleAddAllergy}
                    onCancel={() => setShowAllergyForm(false)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : canManagePatientDetail ? (
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2 text-xs">
          {showAllergyForm ? (
            <AllergyForm
              allergyName={allergyName}
              setAllergyName={setAllergyName}
              allergySeverity={allergySeverity}
              setAllergySeverity={setAllergySeverity}
              allergyReaction={allergyReaction}
              setAllergyReaction={setAllergyReaction}
              canSubmit={canSubmitAllergy}
              isPending={addAllergy.isPending}
              onSubmit={handleAddAllergy}
              onCancel={() => setShowAllergyForm(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {t(
                  "patients.profile.noAllergies",
                  "No known allergies recorded.",
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowAllergyForm(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t("patients.profile.addAllergy", "Add allergy")}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {patient.allergyHistory.some(
        (allergy) =>
          Boolean(allergy.correctionId) || Boolean(allergy.deletedAt),
      ) ? (
        <details className="mt-3 rounded-lg border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t(
              "patients.profile.allergyHistory",
              "Allergy correction history",
            )}
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {patient.allergyHistory
              .filter(
                (allergy) =>
                  Boolean(allergy.correctionId) || Boolean(allergy.deletedAt),
              )
              .map((allergy) => (
                <div
                  key={allergy.id}
                  className="rounded-md border border-border bg-muted/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{allergy.allergen}</span>
                    <span className="text-xs uppercase text-muted-foreground">
                      {allergy.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "patients.profile.reactionPrefix",
                      `Reaction: ${allergy.reaction || "Not documented"}`,
                      {
                        reaction:
                          allergy.reaction ||
                          t("patients.profile.notDocumented", "Not documented"),
                      },
                    )}
                  </p>
                  {allergy.correctionId &&
                  allergy.correctionReason &&
                  allergy.correctedAt ? (
                    <ClinicalCorrectionControl
                      correction={{
                        id: allergy.correctionId,
                        reason: allergy.correctionReason,
                        correctedAt: allergy.correctedAt,
                        correctedByName: allergy.correctedByName,
                      }}
                      canCorrect={false}
                      isPending={false}
                      onCorrect={async () => undefined}
                      timeZone={recordsTimeZone}
                    />
                  ) : (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      {t(
                        "patients.profile.legacyAllergyRemoval",
                        "Legacy removal retained. This predates permanent allergy correction attribution, so no reason or clinician is available.",
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </details>
      ) : null}

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as Tab)}
        className="mt-6"
      >
        <div className="overflow-x-auto border-b border-border">
          <TabsList
            aria-label={t("patients.detail.chartSectionsAria", "Sekcie karty pacienta")}
            className="inline-flex h-auto w-auto min-w-max gap-0 rounded-none bg-transparent p-0"
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "relative min-h-11 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-8">
            <OverviewTab
              patient={patient}
              recordsTimeZone={recordsTimeZone}
              clientPhone={clientQuery.data?.phone ?? null}
              latestVitalsSummary={overviewVitalsSummary}
              latestVitalsAt={overviewVitalsAt}
              activeProblems={activeProblems.map((problem) => ({
                description: problem.description,
                onsetDate: problem.onsetDate,
              }))}
              allergies={(patient.allergies ?? []).map((allergy) => ({
                allergen: allergy.allergen,
                severity: allergy.severity,
              }))}
              activeMedicationsCount={activePrescriptions.length}
              insurance={insuranceSummary}
              insuranceLoading={insuranceQuery.isLoading}
              insuranceExpired={insuranceExpired}
            />
            {chartSections.overview.map((section) => (
              <ChartSection key={section.id} id={section.id} label={section.label}>
                {section.id === "weight" ? (
                  <WeightHistoryTab
                    weights={patient.weights}
                    patientId={patient.id}
                    canManagePatientDetail={canManagePatientDetail}
                    canCorrectClinicalRecords={canCorrectClinicalRecords}
                    weightKg={weightKg}
                    setWeightKg={setWeightKg}
                    weightMeasuredAt={weightMeasuredAt}
                    setWeightMeasuredAt={setWeightMeasuredAt}
                    onSubmitWeight={handleRecordWeight}
                    isAddingWeight={addWeight.isPending}
                    canSubmitWeight={canSubmitWeight}
                    weightTrend={weightTrend}
                    measurementSystem={chartMeasurementSystem}
                    recordsTimeZone={recordsTimeZone ?? ""}
                    recordsSettingsTimeZone={recordsSettingsTimeZone ?? undefined}
                    canonicalPatientWeight={Number(canonicalPatientWeight)}
                    maxMeasuredAt={formatDateTimeLocalInputForTimeZone(new Date(), recordsSettingsTimeZone)}
                    onRefresh={() => void refreshPatientDetail()}
                    onSwitchToVitals={() => setActiveTab("diagnostics")}
                  />
                ) : null}
                {section.id === "appointments" ? (
                  <AppointmentsTab patientId={patient.id} timeZone={recordsTimeZone} />
                ) : null}
              </ChartSection>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <section aria-labelledby="patient-section-records">
            <h2 id="patient-section-records" className="sr-only">
              {t("patients.tabs.records", "Medical Records")}
            </h2>
            <MedicalRecordsTab
              patientId={patient.id}
              timeZone={recordsTimeZone}
              canCorrectClinicalRecords={canCorrectClinicalRecords}
              canSearchPatientHistory={canSearchPatientHistory}
              canCreateSoapNote={canCreateSoapNote}
              activeVisitId={activeVisitId}
            />
          </section>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-6">
          <div className="space-y-8">
            {chartSections.diagnostics.map((section) => (
              <ChartSection key={section.id} id={section.id} label={section.label}>
                {section.id === "labResults" ? (
                  <LabResultsTab patientId={patient.id} timeZone={recordsTimeZone} />
                ) : null}
                {section.id === "vitals" ? (
                  <VitalsTab
                    patientId={patient.id}
                    timeZone={recordsTimeZone}
                    measurementSystem={chartMeasurementSystem}
                    bodyConditionScale={chartBodyConditionScale}
                    canRecordVitals={canRecordVitals}
                    canCorrectClinicalRecords={canCorrectClinicalRecords}
                  />
                ) : null}
              </ChartSection>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="preventive" className="mt-6">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {t(
                  "patients.chartActions.preventiveHelp",
                  "Preventive care lives in this unit: vaccination calendar, batches and certificates plus every recorded procedure.",
                )}
              </p>
              {canRecordVaccination ? (
                <Button asChild size="sm">
                  <Link
                    href={`/records?patientId=${encodeURIComponent(patient.id)}&tab=vaccinations&new=1`}
                  >
                    <Syringe className="mr-2 h-4 w-4" />
                    {t("patients.chartActions.recordVaccination", "Record vaccination")}
                  </Link>
                </Button>
              ) : null}
            </div>
            {chartSections.preventive.map((section) => (
              <ChartSection key={section.id} id={section.id} label={section.label}>
                {section.id === "vaccinations" ? (
                  <VaccinationsTab
                    patientId={patient.id}
                    timeZone={recordsTimeZone}
                    canCorrectClinicalRecords={canCorrectClinicalRecords}
                    canPrepareCertificate={canManagePatientDetail}
                    canEditCertificate={canEditVaccinationCertificate}
                  />
                ) : null}
                {section.id === "procedures" ? (
                  <ProceduresTab patientId={patient.id} timeZone={recordsTimeZone} />
                ) : null}
              </ChartSection>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6">
          <section aria-labelledby="patient-section-prescriptions">
            <h2 id="patient-section-prescriptions" className="sr-only">
              {t("patients.tabs.prescriptions", "Prescriptions & Therapy")}
            </h2>
            <PrescriptionsTab
              patientId={patient.id}
              timeZone={recordsTimeZone}
              canPrescribe={canPrescribe}
            />
          </section>
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {t(
                  "patients.chartActions.adminHelp",
                  "Owner consents, photo documentation, attached reports and billing history for this patient.",
                )}
              </p>
              {canManagePatientDetail && (
                <>
                  <CapturePhotos patientId={patient.id} />
                  <ConsentSign patientId={patient.id} />
                </>
              )}
            </div>
            {chartSections.admin.map((section) => (
              <ChartSection key={section.id} id={section.id} label={section.label}>
                {section.id === "documents" ? (
                  <DocumentsTab patientId={patient.id} timeZone={recordsTimeZone} />
                ) : null}
                {section.id === "invoices" ? (
                  <InvoicesTab patientId={patient.id} />
                ) : null}
              </ChartSection>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}