"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
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

export default function NewPatientPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("patients.form.checkingAccess", "Checking patient access...")}
      </div>
    );
  }

  if (!canManagePatientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/patients")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("patients.actions.backToPatients", "Back to Patients")}
        </Button>
        <EmptyState
          icon={AlertCircle}
          title={t("patients.form.readOnlyNotice", "Patient actions are read-only")}
          description={t(
            "patients.form.readOnlyDesc",
            "Only staff roles with patient write access can create patients.",
          )}
          action={{
            label: t("patients.actions.backToPatients", "Back to Patients"),
            onClick: () => router.push("/patients"),
          }}
        />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("patients.profile.loading", "Loading patient form...")}
        </div>
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
      toast.error(err.message);
      setError(err.message);
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const submittedDob =
      (e.currentTarget.elements.namedItem("dob") as HTMLInputElement | null)
        ?.value ?? form.dob;

    if (!form.clientId) {
      setError(t("patients.form.ownerSelectError", "Please select an owner (client)."));
      return;
    }
    if (!form.name.trim()) {
      setError(t("patients.form.patientNameRequired", "Patient name is required."));
      return;
    }
    if (!canSubmit) {
      setError(t("common.error_retry", "Check required fields and field lengths."));
      return;
    }

    createPatient.mutate({
      clientId: form.clientId,
      name: form.name.trim(),
      species: form.species as any,
      breed: form.breed.trim() || undefined,
      sex: form.sex ? (form.sex as any) : undefined,
      dob: submittedDob || undefined,
      color: form.color.trim() || undefined,
      microchipNumber: form.microchipNumber.trim() || undefined,
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
    setForm((prev) => ({ ...prev, clientId: client.id }));
    setSelectedClientName(`${client.firstName} ${client.lastName}`);
    setClientSearch("");
    setShowClientDropdown(false);
  };

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/patients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("patients.actions.backToPatients", "Back to Patients")}
      </Button>

      <h2 className="font-heading text-xl font-semibold">
        {t("patients.form.titleNew", "New Patient")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstClinicDay
          ? "First clinic day, step 2 of 3: add this owner's pet. Booking is next."
          : t("patients.form.subtitleNew", "Add a new patient record")}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Client Search */}
        <div>
          <label className="text-sm font-medium">
            {t("patients.form.ownerRequired", "Owner (Client) *")}
          </label>
          {selectedClientName ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
                {selectedClientName}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm((prev) => ({ ...prev, clientId: "" }));
                  setSelectedClientName("");
                }}
              >
                {t("patients.actions.change", "Change")}
              </Button>
            </div>
          ) : (
            <div className="relative mt-1">
              <Input
                placeholder={t(
                  "patients.form.searchOwnerPlaceholder",
                  "Search clients by name or email...",
                )}
                value={clientSearch}
                maxLength={CLIENT_SEARCH_MAX_LENGTH}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowClientDropdown(false), 200);
                }}
              />
              {showClientDropdown && canSearchClients && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  {clientSearchError || clientSearchMissing ? (
                    <div className="p-3 text-sm text-destructive">
                      {clientSearchError?.message ??
                        t(
                          "common.error_retry",
                          "Unable to search clients. Please retry.",
                        )}
                    </div>
                  ) : isSearchingClients ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("patients.form.searchingOwners", "Searching clients...")}
                    </div>
                  ) : clientResults && clientResults.length > 0 ? (
                    clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 first:rounded-t-md last:rounded-b-md"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectClient(client)}
                      >
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-muted-foreground">
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
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="name">
            {t("patients.form.patientNameRequired", "Patient Name *")}
          </label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder={t("patients.form.patientNamePlaceholder", "Patient name")}
            className="mt-1"
            maxLength={PATIENT_NAME_MAX_LENGTH}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="species">
              {t("patients.form.speciesRequired", "Species *")}
            </label>
            <select
              id="species"
              value={form.species}
              onChange={(e) => updateField("species", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div>
            <label className="text-sm font-medium" htmlFor="breed">
              {t("patients.form.breed", "Breed")}
            </label>
            <Input
              id="breed"
              value={form.breed}
              onChange={(e) => updateField("breed", e.target.value)}
              placeholder={t("patients.form.breedPlaceholder", "Breed")}
              className="mt-1"
              maxLength={PATIENT_BREED_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="sex">
              {t("patients.form.sex", "Sex")}
            </label>
            <select
              id="sex"
              value={form.sex}
              onChange={(e) => updateField("sex", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("patients.form.selectSex", "Select sex...")}</option>
              {sexOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`patients.form.${opt.key}`, opt.label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="dob">
              {t("patients.form.dob", "Date of Birth")}
            </label>
            <Input
              id="dob"
              name="dob"
              type="date"
              value={form.dob}
              onChange={(e) => updateField("dob", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="color">
              {t("patients.form.color", "Color/Markings")}
            </label>
            <Input
              id="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
              placeholder={t("patients.form.colorPlaceholder", "e.g., Black and white")}
              className="mt-1"
              maxLength={PATIENT_COLOR_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="microchipNumber">
              {t("patients.form.microchip", "Microchip Number")}
            </label>
            <Input
              id="microchipNumber"
              value={form.microchipNumber}
              onChange={(e) => updateField("microchipNumber", e.target.value)}
              placeholder={t("patients.form.microchipPlaceholder", "Microchip ID")}
              className="mt-1"
              maxLength={PATIENT_MICROCHIP_NUMBER_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={!canSubmit || createPatient.isPending}
          >
            {createPatient.isPending
              ? t("patients.actions.creating", "Creating...")
              : t("patients.form.titleNew", "Create Patient")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/patients")}
          >
            {t("patients.actions.cancel", "Cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
