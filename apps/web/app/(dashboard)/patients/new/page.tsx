"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Check, Loader2, PawPrint } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import {
  PageHeader,
  PageSectionHeader,
} from "@/components/layout/page-header";
import { pageShellClass } from "@/components/layout/page-kit";
import { toast } from "sonner";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  isClientSearchInputValid,
} from "@/lib/clients/policy";
import {
  PATIENT_BREED_MAX_LENGTH,
  PATIENT_COLOR_MAX_LENGTH,
  PATIENT_MICROCHIP_NUMBER_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  isOptionalPatientTextValid,
  isRequiredPatientTextValid,
} from "@/lib/patients/policy";
import { PATIENT_SPECIES_OPTIONS } from "@/lib/patients/species";

import { useI18n } from "@/lib/i18n";

const speciesOptions = PATIENT_SPECIES_OPTIONS;

const sexOptions = [
  { value: "male", key: "sexMale", label: "Male (Intact)" },
  { value: "female", key: "sexFemale", label: "Female (Intact)" },
  { value: "male_neutered", key: "sexMaleNeutered", label: "Male (Neutered)" },
  { value: "female_spayed", key: "sexFemaleSpayed", label: "Female (Spayed)" },
] as const;

/** Native <select> styled like the Input primitive (h-10, text-sm, focus ring). */
const formSelectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Form section card, matching the other dashboard entry forms. */
const formSectionClass =
  "space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs";

/** Whitespace and hyphen/dash noise that scanners and pasted documents add. */
const MICROCHIP_EDGE_NOISE =
  /^[\s\u2010-\u2015\u2212-]+|[\s\u2010-\u2015\u2212-]+$/g;
/** Grouping separators people type inside a chip number. */
const MICROCHIP_GROUP_SEPARATORS = /[\s\u2010-\u2015\u2212-]/g;
/** ISO 11784/11785 transponder codes are exactly 15 decimal digits. */
const ISO_MICROCHIP_PATTERN = /^\d{15}$/;
const DIGITS_ONLY_PATTERN = /^\d+$/;

/**
 * Normalise a scanned or typed microchip number. Surrounding whitespace and
 * hyphens are always dropped. Grouping separators are collapsed only when the
 * result is a 15-digit ISO 11784/11785 code, so older non-ISO identifiers
 * (AVID, FECAVA, Trovan) are never rewritten.
 */
function cleanMicrochipInput(raw: string): string {
  const trimmed = raw.replace(MICROCHIP_EDGE_NOISE, "");
  const compact = trimmed.replace(MICROCHIP_GROUP_SEPARATORS, "");
  return ISO_MICROCHIP_PATTERN.test(compact) ? compact : trimmed;
}

type MicrochipCheck =
  | { kind: "empty" }
  | { kind: "iso" }
  | { kind: "digits"; count: number }
  | { kind: "other" };

/** Classify a chip number for the inline hint. Advisory only, never blocking. */
function describeMicrochip(raw: string): MicrochipCheck {
  const cleaned = cleanMicrochipInput(raw);
  if (!cleaned) return { kind: "empty" };
  if (ISO_MICROCHIP_PATTERN.test(cleaned)) return { kind: "iso" };
  const compact = cleaned.replace(MICROCHIP_GROUP_SEPARATORS, "");
  if (DIGITS_ONLY_PATTERN.test(compact)) {
    return { kind: "digits", count: compact.length };
  }
  return { kind: "other" };
}

const IMPLICIT_SUBMIT_SAFE_INPUT_TYPES = new Set([
  "submit",
  "button",
  "reset",
  "image",
]);

/**
 * Intake forms only submit from the submit button. Microchip scanners send a
 * trailing Enter, and Enter in any text field would otherwise create a
 * half-filled chart.
 */
function preventImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    !IMPLICIT_SUBMIT_SAFE_INPUT_TYPES.has(target.type)
  ) {
    event.preventDefault();
  }
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

function NewPatientLoadingPanel({ label }: { label: string }) {
  return (
    <div className="max-w-2xl">
      <div
        role="status"
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

export default function NewPatientPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <NewPatientLoadingPanel
        label={t("patients.form.checkingAccess", "Checking patient access...")}
      />
    );
  }

  if (!canManagePatientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <div className={pageShellClass}>
          <PageHeader
            icon={PawPrint}
            title={t("patients.form.titleNew", "New Patient")}
          />
          <EmptyState
            icon={AlertCircle}
            title={t("patients.form.readOnlyNotice", "Patient actions are read-only")}
            description={t(
              "patients.form.readOnlyDesc",
              "Only staff roles with patient write access can manage patients.",
            )}
            action={{
              label: t("patients.actions.backToPatients", "Back to Patients"),
              onClick: () => router.push("/patients"),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <NewPatientLoadingPanel
          label={t("patients.form.loadingForm", "Loading patient form...")}
        />
      }
    >
      <NewPatientForm />
    </Suspense>
  );
}

function canManagePatientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

type PatientTouchedField = "owner" | "name" | "microchipNumber";

function NewPatientForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    species: "canine" as string,
    breed: "",
    sex: "" as string,
    dob: "",
    color: "",
    microchipNumber: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<
    Partial<Record<PatientTouchedField, boolean>>
  >({});
  // `isPending` only flips after React re-renders, so a fast double click
  // could otherwise send two create requests. This guard is synchronous.
  const submitLockRef = useRef(false);
  const ownerSearchRef = useRef<HTMLInputElement>(null);
  const ownerResultsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Realtime debounce anti-duplicate check for microchip
  const [debouncedMicrochip, setDebouncedMicrochip] = useState(form.microchipNumber);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMicrochip(form.microchipNumber);
    }, 400);
    return () => clearTimeout(handler);
  }, [form.microchipNumber]);

  // Check exactly the value that will be saved (see cleanMicrochipInput).
  const microchipForDuplicateCheck = cleanMicrochipInput(debouncedMicrochip);
  const { data: duplicatePatientCheck } =
    trpc.extensions.duplicateShield.checkPatient.useQuery(
      { microchipNumber: microchipForDuplicateCheck },
      {
        enabled: microchipForDuplicateCheck.length >= 5,
        refetchOnWindowFocus: false,
      }
    );

  const preselectedClientId = searchParams.get("clientId") ?? "";
  const preselectedClientName = (searchParams.get("clientName") ?? "").trim();
  const firstClinicDay = searchParams.get("setup") === "first-visit";
  const trimmedClientSearch = clientSearch.trim();
  const canSearchClients = isClientSearchInputValid(clientSearch);

  const {
    data: clientResults,
    isLoading: isSearchingClients,
    error: clientSearchError,
  } = trpc.clients.search.useQuery(
    { query: trimmedClientSearch },
    { enabled: canSearchClients },
  );
  const clientSearchMissing =
    canSearchClients &&
    !selectedClientName &&
    !isSearchingClients &&
    !clientSearchError &&
    !clientResults;

  useEffect(() => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        preselectedClientId,
      ) ||
      !preselectedClientName ||
      preselectedClientName.length > CLIENT_SEARCH_MAX_LENGTH
    ) {
      return;
    }
    setForm((current) =>
      current.clientId
        ? current
        : { ...current, clientId: preselectedClientId },
    );
    setSelectedClientName((current) => current || preselectedClientName);
  }, [preselectedClientId, preselectedClientName]);

  const createPatient = trpc.patients.create.useMutation({
    // The submit lock stays engaged on success: the page is navigating away.
    onSuccess: (patient) => {
      toast.success(t("patients.form.createdSuccess", "Patient created"));
      if (firstClinicDay) {
        router.push(
          `/schedule?setup=first-visit&patient=${encodeURIComponent(patient.name)}`,
        );
        return;
      }
      router.push(`/patients/${patient.id}`);
    },
    onError: (err) => {
      submitLockRef.current = false;
      // Input validation failures arrive as serialized zod issues; show a
      // translated message instead of raw JSON.
      const message = err.data?.zodError
        ? t(
            "patients.form.validation.checkRequiredFields",
            "Check required fields and field lengths.",
          )
        : err.message;
      toast.error(message);
      setError(message);
    },
  });

  const canSubmit =
    !!form.clientId &&
    isRequiredPatientTextValid(form.name, PATIENT_NAME_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.breed, PATIENT_BREED_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.color, PATIENT_COLOR_MAX_LENGTH) &&
    isOptionalPatientTextValid(
      form.microchipNumber,
      PATIENT_MICROCHIP_NUMBER_MAX_LENGTH,
    );

  // Every control stays locked while the request runs and after it succeeds,
  // until the redirect lands, so the same chart cannot be created twice.
  const formLocked = createPatient.isPending || createPatient.isSuccess;

  const ownerError = form.clientId
    ? null
    : t(
        "patients.form.validation.ownerRequired",
        "Search for the owner and select them from the results.",
      );
  const nameError = isRequiredPatientTextValid(form.name, PATIENT_NAME_MAX_LENGTH)
    ? null
    : t("patients.form.validation.nameRequired", "Enter the patient's name.");
  const visibleOwnerError = touched.owner ? ownerError : null;
  const visibleNameError = touched.name ? nameError : null;

  const missingFields = [
    ownerError ? t("patients.form.owner", "Owner (Client)") : null,
    nameError ? t("patients.form.patientName", "Patient Name") : null,
  ].filter((field): field is string => Boolean(field));
  const requirementsHint = canSubmit
    ? null
    : missingFields.length > 0
      ? t(
          "patients.form.validation.missingFields",
          "To create the patient, complete: {fields}.",
          { fields: missingFields.join(", ") },
        )
      : t(
          "patients.form.validation.checkRequiredFields",
          "Check required fields and field lengths.",
        );

  const microchipCheck = describeMicrochip(form.microchipNumber);
  const microchipHint =
    microchipCheck.kind === "iso"
      ? {
          tone: "success" as const,
          text: t(
            "patients.form.microchipHint.iso",
            "ISO 11784/11785 format · 15 digits",
          ),
        }
      : microchipCheck.kind === "digits" && touched.microchipNumber
        ? {
            tone: "warning" as const,
            text: t(
              "patients.form.microchipHint.length",
              "ISO 11784/11785 chips have 15 digits; this number has {count}. Check the scan, or keep it for an older non-ISO chip.",
              { count: microchipCheck.count },
            ),
          }
        : {
            tone: "muted" as const,
            text: t(
              "patients.form.microchipHint.help",
              "Scan or type the chip number. Spaces and dashes are removed from 15-digit ISO numbers.",
            ),
          };

  const markTouched = (field: PatientTouchedField) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);
    setTouched({ owner: true, name: true, microchipNumber: true });

    const submittedDob =
      (e.currentTarget.elements.namedItem("dob") as HTMLInputElement | null)
        ?.value ?? form.dob;

    if (!form.clientId) {
      setError(t("patients.form.ownerSelectError", "Please select an owner (client)."));
      return;
    }
    if (!form.name.trim()) {
      setError(t("patients.form.validation.nameRequired", "Enter the patient's name."));
      return;
    }
    if (!canSubmit) {
      setError(
        t(
          "patients.form.validation.checkRequiredFields",
          "Check required fields and field lengths.",
        ),
      );
      return;
    }

    const microchipNumber = cleanMicrochipInput(form.microchipNumber);
    if (microchipNumber !== form.microchipNumber) {
      updateField("microchipNumber", microchipNumber);
    }

    submitLockRef.current = true;
    createPatient.mutate({
      clientId: form.clientId,
      name: form.name.trim(),
      species: form.species as any,
      breed: form.breed.trim() || undefined,
      sex: form.sex ? (form.sex as any) : undefined,
      dob: submittedDob || undefined,
      color: form.color.trim() || undefined,
      microchipNumber: microchipNumber || undefined,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectClient = (client: {
    id: string;
    firstName: string;
    lastName: string;
  }) => {
    // The search box and its results unmount on selection; hand focus to the
    // next field instead of dropping it on <body>.
    flushSync(() => {
      setForm((prev) => ({ ...prev, clientId: client.id }));
      setSelectedClientName(`${client.firstName} ${client.lastName}`);
      setClientSearch("");
      setShowClientDropdown(false);
    });
    nameInputRef.current?.focus();
  };

  const changeOwner = () => {
    // Render the search box first so focus can move straight into it.
    flushSync(() => {
      setForm((prev) => ({ ...prev, clientId: "" }));
      setSelectedClientName("");
    });
    ownerSearchRef.current?.focus();
  };

  const focusOwnerOption = (index: number) => {
    const options = ownerResultsRef.current?.querySelectorAll<HTMLButtonElement>(
      "button[data-owner-option]",
    );
    if (!options || options.length === 0) return;
    options[(index + options.length) % options.length]?.focus();
  };

  const handleOwnerSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      flushSync(() => setShowClientDropdown(true));
      focusOwnerOption(0);
    } else if (event.key === "Escape") {
      setShowClientDropdown(false);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      // Enter never submits from the search box; a single match is picked.
      event.preventDefault();
      if (clientResults?.length === 1) selectClient(clientResults[0]);
    }
  };

  const handleOwnerOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOwnerOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) ownerSearchRef.current?.focus();
      else focusOwnerOption(index - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      ownerSearchRef.current?.focus();
      setShowClientDropdown(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className={pageShellClass}>
        <PageHeader
          icon={PawPrint}
          title={t("patients.form.titleNew", "New Patient")}
          subtitle={
            firstClinicDay
              ? t("patients.form.firstClinicDayStep2", "First clinic day, step 2 of 3: add this owner's pet. Booking is next.")
              : t("patients.form.subtitleNew", "Add a new patient record")
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/patients")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("patients.actions.backToPatients", "Back to Patients")}
            </Button>
          }
        />

        {error ? (
          <Alert variant="destructive" className="bg-destructive/10">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form
          noValidate
          onSubmit={handleSubmit}
          onKeyDown={preventImplicitSubmit}
          aria-busy={formLocked}
        >
          <fieldset disabled={formLocked} className="min-w-0 space-y-6">
            <section className={formSectionClass}>
              <PageSectionHeader
                title={t("patients.form.sections.owner.title", "Owner")}
                subtitle={t(
                  "patients.form.sections.owner.subtitle",
                  "Every patient chart belongs to one client.",
                )}
              />
              {/* Client Search */}
              <div className="space-y-1.5">
                <Label htmlFor="clientSearch">
                  {t("patients.form.owner", "Owner (Client)")}
                  <RequiredMark />
                </Label>
                {selectedClientName ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                      <Check
                        className="mr-2 h-4 w-4 text-success"
                        aria-hidden="true"
                      />
                      {selectedClientName}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={changeOwner}
                      aria-label={t("patients.form.changeOwner", "Change owner")}
                    >
                      {t("patients.actions.change", "Change")}
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      ref={ownerSearchRef}
                      id="clientSearch"
                      placeholder={t(
                        "patients.form.searchOwnerPlaceholder",
                        "Search clients by name or email...",
                      )}
                      value={clientSearch}
                      maxLength={CLIENT_SEARCH_MAX_LENGTH}
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-controls="clientSearch-results"
                      aria-invalid={Boolean(visibleOwnerError)}
                      aria-describedby={
                        visibleOwnerError ? "clientSearch-error" : undefined
                      }
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={(event) => {
                        // Keyboard focus moving into the results keeps them open.
                        if (ownerResultsRef.current?.contains(event.relatedTarget)) {
                          return;
                        }
                        markTouched("owner");
                        // Delay so a tap on a result still lands on touch browsers.
                        window.setTimeout(() => setShowClientDropdown(false), 150);
                      }}
                      onKeyDown={handleOwnerSearchKeyDown}
                    />
                    {showClientDropdown && canSearchClients && (
                      <div
                        ref={ownerResultsRef}
                        id="clientSearch-results"
                        className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg"
                        onBlur={(event) => {
                          if (
                            event.currentTarget.contains(event.relatedTarget) ||
                            event.relatedTarget === ownerSearchRef.current
                          ) {
                            return;
                          }
                          markTouched("owner");
                          setShowClientDropdown(false);
                        }}
                      >
                        {clientSearchError || clientSearchMissing ? (
                          <div role="alert" className="p-3 text-sm text-destructive">
                            {clientSearchError?.message ??
                              t(
                                "patients.form.clientSearchError",
                                "Unable to search clients. Please retry.",
                              )}
                          </div>
                        ) : isSearchingClients ? (
                          <div
                            role="status"
                            className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
                          >
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                            {t("patients.form.searchingOwners", "Searching clients...")}
                          </div>
                        ) : clientResults && clientResults.length > 0 ? (
                          clientResults.map((client, index) => (
                            <button
                              key={client.id}
                              type="button"
                              data-owner-option
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring first:rounded-t-md last:rounded-b-md"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectClient(client)}
                              onKeyDown={(event) =>
                                handleOwnerOptionKeyDown(event, index)
                              }
                            >
                              <span className="font-medium">
                                {client.firstName} {client.lastName}
                              </span>
                              <span className="truncate text-muted-foreground">
                                {client.email || client.phone || ""}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {t("patients.form.noOwnersFound", "No clients found")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <FieldError id="clientSearch-error" message={visibleOwnerError} />
              </div>
            </section>

            <section className={formSectionClass}>
              <PageSectionHeader
                title={t("patients.form.sections.signalment.title", "Patient")}
                subtitle={t(
                  "patients.form.sections.signalment.subtitle",
                  "Name, species, and signalment.",
                )}
              />
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  {t("patients.form.patientName", "Patient Name")}
                  <RequiredMark />
                </Label>
                <Input
                  ref={nameInputRef}
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  onBlur={() => markTouched("name")}
                  placeholder={t("patients.form.patientNamePlaceholder", "Patient name")}
                  maxLength={PATIENT_NAME_MAX_LENGTH}
                  autoComplete="off"
                  required
                  aria-invalid={Boolean(visibleNameError)}
                  aria-describedby={visibleNameError ? "name-error" : undefined}
                />
                <FieldError id="name-error" message={visibleNameError} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="species">
                    {t("patients.form.species", "Species")}
                    <RequiredMark />
                  </Label>
                  <select
                    id="species"
                    value={form.species}
                    onChange={(e) => updateField("species", e.target.value)}
                    className={formSelectClass}
                    required
                  >
                    {speciesOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value
                          ? t(`patients.species_${opt.value}`, opt.label)
                          : opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="breed">{t("patients.form.breed", "Breed")}</Label>
                  <Input
                    id="breed"
                    value={form.breed}
                    onChange={(e) => updateField("breed", e.target.value)}
                    placeholder={t("patients.form.breedPlaceholder", "Breed")}
                    maxLength={PATIENT_BREED_MAX_LENGTH}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sex">{t("patients.form.sex", "Sex")}</Label>
                  <select
                    id="sex"
                    value={form.sex}
                    onChange={(e) => updateField("sex", e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="">{t("patients.form.selectSex", "Select sex...")}</option>
                    {sexOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`patients.form.${opt.key}`, opt.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">{t("patients.form.dob", "Date of Birth")}</Label>
                  <DatePicker
                    id="dob"
                    name="dob"
                    value={form.dob}
                    onChange={(val) => updateField("dob", val)}
                    className="h-10"
                  />
                </div>
              </div>
            </section>

            <section className={formSectionClass}>
              <PageSectionHeader
                title={t(
                  "patients.form.sections.identification.title",
                  "Identification",
                )}
                subtitle={t(
                  "patients.form.sections.identification.subtitle",
                  "A microchip number helps prevent duplicate charts.",
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="microchipNumber">
                    {t("patients.form.microchip", "Microchip Number")}
                  </Label>
                  <Input
                    id="microchipNumber"
                    value={form.microchipNumber}
                    onChange={(e) => updateField("microchipNumber", e.target.value)}
                    onBlur={() => {
                      markTouched("microchipNumber");
                      const cleaned = cleanMicrochipInput(form.microchipNumber);
                      if (cleaned !== form.microchipNumber) {
                        updateField("microchipNumber", cleaned);
                      }
                    }}
                    placeholder={t("patients.form.microchipPlaceholder", "Microchip ID")}
                    className="font-mono"
                    maxLength={PATIENT_MICROCHIP_NUMBER_MAX_LENGTH}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="microchipNumber-hint"
                  />
                  <p
                    id="microchipNumber-hint"
                    className={cn(
                      "text-xs",
                      microchipHint.tone === "success" &&
                        "font-medium text-success-muted-foreground",
                      microchipHint.tone === "warning" &&
                        "font-medium text-warning-muted-foreground",
                      microchipHint.tone === "muted" && "text-muted-foreground",
                    )}
                  >
                    {microchipHint.text}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color">
                    {t("patients.form.color", "Color / Markings")}
                  </Label>
                  <Input
                    id="color"
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    placeholder={t("patients.form.colorPlaceholder", "e.g., Black and white")}
                    maxLength={PATIENT_COLOR_MAX_LENGTH}
                    autoComplete="off"
                  />
                </div>
              </div>

              {duplicatePatientCheck?.found && duplicatePatientCheck.patient ? (
                <div
                  role="alert"
                  className="rounded-lg border border-warning/40 bg-warning-muted/40 p-4 shadow-2xs"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-warning-muted-foreground">
                          {t(
                            "patients.duplicateWarningTitle",
                            "Warning: Existing record found",
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-warning-muted-foreground/80">
                          {t(
                            "patients.duplicateWarningDesc",
                            "A patient with this microchip already exists in the clinic: {name} (Owner: {owner}). Would you like to link the existing profile?",
                            {
                              name: duplicatePatientCheck.patient.name,
                              owner:
                                duplicatePatientCheck.patient.ownerName ||
                                t("patients.profile.noOwner", "No owner assigned"),
                            },
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(`/patients/${duplicatePatientCheck.patient!.id}`)
                      }
                      className="shrink-0 border-warning/40 text-xs font-semibold text-warning-muted-foreground hover:bg-warning-muted"
                    >
                      {t("patients.openExistingCard", "Open existing profile")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!canSubmit || createPatient.isPending}
                  aria-describedby={
                    requirementsHint ? "patient-form-requirements" : undefined
                  }
                >
                  {formLocked ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      {t("patients.actions.creating", "Creating...")}
                    </>
                  ) : (
                    t("patients.form.createPatient", "Create Patient")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/patients")}
                >
                  {t("patients.actions.cancel", "Cancel")}
                </Button>
              </div>
              {requirementsHint ? (
                <p
                  id="patient-form-requirements"
                  className="text-xs text-muted-foreground"
                >
                  {requirementsHint}
                </p>
              ) : null}
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
