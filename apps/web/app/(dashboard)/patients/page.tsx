"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Plus, PawPrint, GitMerge, ArrowUpRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/loading";
import { PageHeader } from "@/components/layout/page-header";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
  IdentityCell,
  SpeciesIcon,
} from "@/components/common/data-table";
import { PATIENT_SEARCH_MAX_LENGTH } from "@/lib/patients/policy";
import { useI18n } from "@/lib/i18n";
import {
  PATIENT_SPECIES_EMOJI,
  PATIENT_SPECIES_OPTIONS,
  type PatientSpecies,
} from "@/lib/patients/species";

const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

type SpeciesFilter = "" | PatientSpecies;

const speciesOptions: Array<{ value: SpeciesFilter; label: string }> = [
  { value: "", label: "All Species" },
  ...PATIENT_SPECIES_OPTIONS,
];

function canManagePatientsRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function formatSex(
  sex: string | null,
  t: (key: string, fallback?: string) => string
): string {
  if (!sex) return "—";
  const defaultLabels: Record<string, string> = {
    male: "M",
    female: "F",
    male_neutered: "MN",
    female_spayed: "FS",
  };
  return t(`patients.sex_${sex}`, defaultLabels[sex] ?? sex);
}

function calcAge(
  dob: string | null,
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 24)
    return t("patients.age_months", "{count} mo.", { count: Math.max(1, totalMonths) });
  return t("patients.age_years", "{count} yr.", { count: Math.floor(totalMonths / 12) });
}

export default function PatientsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState<SpeciesFilter>("");
  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch.length > 0;
  const hasFilters = hasSearch || Boolean(species);
  const canManagePatients = canManagePatientsRole(session?.user?.role);
  const canReviewDuplicates = session?.user?.role === "admin";

  const { data, isLoading, error } = trpc.patients.list.useQuery({
    search: hasSearch ? trimmedSearch : undefined,
    species: species || undefined,
    limit: 25,
    offset: 0,
  });
  const patientsMissing = !isLoading && !error && !data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("patients.title", "Patients")}
        subtitle={t("patients.subtitle", "Manage patient records")}
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {canReviewDuplicates ? (
              <Button
                variant="outline"
                onClick={() => router.push("/patients/duplicates")}
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <GitMerge className="mr-2 h-4 w-4" />
                {t("patients.actions.reviewDuplicates", "Review duplicates")}
              </Button>
            ) : null}
            {canManagePatients && (
              <Button
                onClick={() => router.push("/patients/new")}
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("patients.new_patient", "New Patient")}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t(
              "patients.search_placeholder",
              "Search patients or owners...",
            )}
            value={search}
            maxLength={PATIENT_SEARCH_MAX_LENGTH}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        <select
          value={species}
          onChange={(e) => setSpecies(e.target.value as SpeciesFilter)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-10 sm:w-auto"
        >
          {speciesOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value
                ? t(`patients.species_${opt.value}`, opt.label)
                : t("patients.species_all", "All Species")}
            </option>
          ))}
        </select>
        {data && (
          <p className="text-sm text-muted-foreground sm:shrink-0">
            {data.total === 1
              ? t("patients.plural_one", "{count} patient", { count: data.total })
              : data.total >= 2 && data.total <= 4
                ? t("patients.plural_few", "{count} patients", { count: data.total })
                : t("patients.plural_other", "{count} patients", { count: data.total })}
          </p>
        )}
      </div>

      {error || patientsMissing ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message ?? t("common.error_retry", "Unable to load patients. Please retry.")}
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={5} className="mt-6" />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mt-6 space-y-3 sm:hidden">
            {data.items.map((patient) => {
              const ownerName =
                patient.clientFirstName && patient.clientLastName
                  ? `${patient.clientFirstName} ${patient.clientLastName}`
                  : t("patients.profile.noOwner", "Owner not listed");

              const patientStatusText =
                patient.status === "active"
                  ? t("patients.status_active", "active")
                  : patient.status === "deceased"
                    ? t("patients.status_deceased", "deceased")
                    : t("patients.status_inactive", "inactive");

              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => router.push(`/patients/${patient.id}`)}
                  aria-label={t("patients.list.openPatientAria", "Otvoriť pacienta {name}", { name: patient.name })}
                  className="min-h-11 w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      <span className="mr-1.5" aria-hidden="true">
                        {speciesEmoji[patient.species ?? "other"] ?? "🐾"}
                      </span>
                      {patient.name}
                    </span>
                    <Badge
                      variant={
                        patient.status === "active"
                          ? "success"
                          : patient.status === "deceased"
                            ? "secondary"
                            : "warning"
                      }
                    >
                      {patientStatusText}
                    </Badge>
                  </span>
                  <span className="mt-2 block min-w-0 space-y-1 text-sm text-muted-foreground">
                    <span className="block truncate">
                      {[
                        patient.breed,
                        patient.species
                          ? t(`patients.species_${patient.species}`, patient.species)
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || t("patients.profile.unknownBreed", "Breed and species not listed")}
                    </span>
                    <span className="block truncate">
                      {t("patients.profile.owner", "Owner")}: {ownerName}
                    </span>
                    <span className="block text-xs">
                      {t("patients.column_sex", "Sex")}: {formatSex(patient.sex, t)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <DataTableShell className="mt-6 hidden sm:block">
            <DataTableScroll>
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderRow>
                    <DataTableHeadCell>
                      {t("patients.column_name", "Name")}
                    </DataTableHeadCell>
                    <DataTableHeadCell>
                      {t("patients.column_breed", "Breed")}
                    </DataTableHeadCell>
                    <DataTableHeadCell>
                      {t("patients.column_owner", "Owner")}
                    </DataTableHeadCell>
                    <DataTableHeadCell>
                      {t("patients.column_sex", "Sex")}
                    </DataTableHeadCell>
                    <DataTableHeadCell>
                      {t("patients.column_status", "Status")}
                    </DataTableHeadCell>
                    <DataTableHeadCell align="right">
                      {t("patients.column_actions", "Akcie")}
                    </DataTableHeadCell>
                  </DataTableHeaderRow>
                </DataTableHead>
                <DataTableBody>
                  {data.items.map((patient) => {
                    const patientStatusText =
                      patient.status === "active"
                        ? t("patients.status_active", "active")
                        : patient.status === "deceased"
                          ? t("patients.status_deceased", "deceased")
                          : t("patients.status_inactive", "inactive");

                    return (
                      <DataTableRow
                        key={patient.id}
                        interactive
                        onClick={() => router.push(`/patients/${patient.id}`)}
                      >
                        <DataTableCell>
                          <IdentityCell
                            icon={
                              <SpeciesIcon
                                species={patient.species}
                                label={t(
                                  `patients.species_${patient.species}`,
                                  patient.species,
                                )}
                              />
                            }
                            primary={patient.name}
                            secondary={
                              patient.dob ? calcAge(patient.dob, t) : undefined
                            }
                          />
                        </DataTableCell>
                        <DataTableCell>
                          <div className="text-xs text-foreground">
                            {patient.breed || "—"}
                          </div>
                          {patient.species ? (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {t(
                                `patients.species_${patient.species}`,
                                patient.species,
                              )}
                            </div>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell>
                          <div className="text-xs font-medium text-foreground">
                            {patient.clientFirstName && patient.clientLastName
                              ? `${patient.clientFirstName} ${patient.clientLastName}`
                              : t(
                                  "patients.profile.noOwner",
                                  "Owner not listed",
                                )}
                          </div>
                          {patient.clientPhone ? (
                            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {patient.clientPhone}
                            </div>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatSex(patient.sex, t)}
                          </span>
                        </DataTableCell>
                        <DataTableCell>
                          <Badge
                            variant={
                              patient.status === "active"
                                ? "success"
                                : patient.status === "deceased"
                                  ? "secondary"
                                  : "warning"
                            }
                          >
                            {patientStatusText}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell align="right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            asChild
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Link href={`/patients/${patient.id}`}>
                              {t("patients.list.open", "Karta")}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableShell>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={PawPrint}
          title={
            hasFilters
              ? t(
                  "patients.empty_filter_title",
                  "No patients match your filters",
                )
              : t("patients.empty_title", "No patients yet")
          }
          description={
            hasFilters
              ? t(
                  "patients.empty_filter_desc",
                  "Clear the search or species filter to broaden the list.",
                )
              : t(
                  "patients.empty_desc",
                  "Create a patient record once the owner client is in OpenVPM.",
                )
          }
          action={
            !hasFilters && canManagePatients
              ? {
                  label: t("patients.empty_action", "Add your first patient"),
                  onClick: () => router.push("/patients/new"),
                  icon: Plus,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
