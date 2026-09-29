"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus, Shield, Loader2, Check, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import { cn } from "@/lib/utils";
import { formatClinicalDate, formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { isRabiesVaccineName } from "@/lib/records/vaccination-policy";
import Link from "next/link";

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
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

type VaccinationCertificateEditor = {
  id: string;
  expectedUpdatedAt: string;
  productName: string;
  manufacturer: string;
  lotNumber: string;
  productExpirationDate: string;
  doseType: "" | "initial" | "booster";
  licensedDurationMonths: string;
  rabiesTagNumber: string;
  supervisingVeterinarianId: string;
  reason: string;
};


export function VaccinationsTab({
  patientId,
  timeZone,
  canCorrectClinicalRecords,
  canPrepareCertificate,
  canEditCertificate,
}: {
  patientId: string;
  timeZone?: string | null;
  canCorrectClinicalRecords: boolean;
  canPrepareCertificate: boolean;
  canEditCertificate: boolean;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [editor, setEditor] = useState<VaccinationCertificateEditor | null>(
    null,
  );
  const {
    data: vaccinations,
    isLoading,
    error,
  } = trpc.records.listVaccinations.useQuery({ patientId });
  const providers = trpc.records.listVaccinationProviders.useQuery(undefined, {
    enabled: Boolean(editor),
    staleTime: 5 * 60 * 1000,
  });
  const prepareCertificate =
    trpc.records.prepareVaccinationCertificate.useMutation();
  const updateCertificateDetails =
    trpc.records.updateVaccinationCertificateDetails.useMutation({
      onSuccess: async () => {
        setEditor(null);
        await utils.records.listVaccinations.invalidate({ patientId });
        toast.success(
          t(
            "patients.vaccinations.certUpdatedSuccess",
            "Certificate details updated with an audit entry",
          ),
        );
      },
      onError: (err) => toast.error(err.message),
    });
  const correctVaccination =
    trpc.records.markVaccinationEnteredInError.useMutation({
      onSuccess: async () => {
        toast.success(
          t(
            "patients.vaccinations.markedErrorSuccess",
            "Vaccination retained and marked entered in error",
          ),
        );
        await utils.records.listVaccinations.invalidate({ patientId });
      },
      onError: (err) => toast.error(err.message),
    });
  const vaccinationsMissing = !isLoading && !error && !vaccinations;

  async function downloadCertificate(
    kind: "vaccination_history" | "rabies",
    vaccinationRecordId?: string,
  ) {
    try {
      const certificate = await prepareCertificate.mutateAsync({
        patientId,
        kind,
        vaccinationRecordId,
      });
      if (!certificate.ready) {
        toast.error(
          `Complete these details before issuing the certificate: ${certificate.missingFields.join(
            ", ",
          )}.`,
        );
        return;
      }
      const pdf = await import("@/lib/pdf");
      const generatedDate = formatClinicalDate(
        certificate.generatedAt,
        certificate.practice.timezone,
        "Unknown date",
      );
      const baseData = {
        certificateId: certificate.certificateId,
        generatedDate,
        practice: certificate.practice,
        owner: certificate.owner,
        patient: {
          ...certificate.patient,
          sex: formatSex(certificate.patient.sex, t),
          dob: formatClinicalDate(
            certificate.patient.dob,
            certificate.practice.timezone,
            undefined,
          ),
        },
      };
      const safePatientName = certificate.patient.name.replace(
        /[^a-z0-9]+/gi,
        "_",
      );
      if (kind === "vaccination_history") {
        pdf
          .generateVaccinationHistoryCertificatePdf({
            ...baseData,
            vaccinations: certificate.vaccinations.map((vaccination) => ({
              ...vaccination,
              administeredAt: formatClinicalDate(
                vaccination.administeredAt,
                certificate.practice.timezone,
                "Unknown",
              ),
              nextDueDate: formatClinicalDate(
                vaccination.nextDueDate,
                certificate.practice.timezone,
                undefined,
              ),
            })),
          })
          .save(`${safePatientName}_vaccination_certificate.pdf`);
      } else {
        const rabies = certificate.vaccinations[0]!;
        pdf
          .generateRabiesVaccinationCertificatePdf({
            ...baseData,
            vaccination: {
              ...rabies,
              productName: rabies.productName!,
              manufacturer: rabies.manufacturer!,
              lotNumber: rabies.lotNumber!,
              productExpirationDate: formatClinicalDate(
                rabies.productExpirationDate,
                certificate.practice.timezone,
                "Unknown",
              ),
              doseType: rabies.doseType!,
              licensedDurationMonths: rabies.licensedDurationMonths!,
              administeredAt: formatClinicalDate(
                rabies.administeredAt,
                certificate.practice.timezone,
                "Unknown",
              ),
              nextDueDate: formatClinicalDate(
                rabies.nextDueDate,
                certificate.practice.timezone,
                "Unknown",
              ),
              veterinarianName: rabies.veterinarianName!,
              veterinarianLicenseNumber: rabies.veterinarianLicenseNumber!,
            },
          })
          .save(`${safePatientName}_rabies_vaccination_certificate.pdf`);
      }
      toast.success(
        t(
          "patients.vaccinations.certDownloadedSuccess",
          "Certificate downloaded",
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to create certificate",
      );
    }
  }

  if (error) {
    return (
      <PatientDetailErrorPanel
        message={`${t("patients.vaccinations.loadError", "Unable to load vaccination records.")} ${error.message}`}
      />
    );
  }

  if (vaccinationsMissing) {
    return (
      <PatientDetailErrorPanel
        message={t(
          "patients.vaccinations.loadErrorRetry",
          "Unable to load vaccination records. Please retry.",
        )}
      />
    );
  }

  if (isLoading) {
    return (
      <PatientDetailLoadingPanel
        label={t("patients.vaccinations.loading", "Loading vaccinations...")}
      />
    );
  }

  if (!vaccinations || vaccinations.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title={t(
          "patients.vaccinations.empty",
          "No vaccination records yet",
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {canPrepareCertificate ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {t(
                "patients.vaccinations.certificatesTitle",
                "Vaccination certificates",
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "patients.vaccinations.certificatesSubtitle",
                "Every prepared certificate receives a unique ID and an audit entry. Rabies certificates must pass a required-field check.",
              )}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={prepareCertificate.isPending}
            onClick={() => downloadCertificate("vaccination_history")}
          >
            {prepareCertificate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {t(
              "patients.vaccinations.downloadCertificate",
              "Download vaccination certificate",
            )}
          </Button>
        </div>
      ) : null}

      {editor ? (
        <form
          className="rounded-lg border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (editor.reason.trim().length < 10) return;
            updateCertificateDetails.mutate({
              patientId,
              recordId: editor.id,
              expectedUpdatedAt: editor.expectedUpdatedAt,
              reason: editor.reason,
              productName: editor.productName || undefined,
              manufacturer: editor.manufacturer || undefined,
              lotNumber: editor.lotNumber || undefined,
              productExpirationDate: editor.productExpirationDate || undefined,
              doseType: editor.doseType || undefined,
              licensedDurationMonths: editor.licensedDurationMonths
                ? Number(editor.licensedDurationMonths)
                : undefined,
              rabiesTagNumber: editor.rabiesTagNumber || undefined,
              supervisingVeterinarianId:
                editor.supervisingVeterinarianId || undefined,
            });
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {t(
                  "patients.vaccinations.editCertificateTitle",
                  "Edit certificate details",
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "patients.vaccinations.editCertificateSubtitle",
                  "Clinical history is preserved. A reason is recorded with every change.",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditor(null)}
            >
              {t("patients.actions.cancel", "Cancel")}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [
                  t("patients.vaccinations.productName", "Product name"),
                  "productName",
                ],
                [
                  t("patients.vaccinations.manufacturer", "Manufacturer"),
                  "manufacturer",
                ],
                [
                  t("patients.vaccinations.batchNumber", "Lot number"),
                  "lotNumber",
                ],
                [
                  t(
                    "patients.vaccinations.expiresAt",
                    "Product expiration",
                  ),
                  "productExpirationDate",
                ],
                [
                  t("patients.vaccinations.rabiesTag", "Rabies tag"),
                  "rabiesTagNumber",
                ],
              ] as const
            ).map(([label, field]) => (
              <label
                key={field}
                className="space-y-1 text-xs font-medium text-muted-foreground"
              >
                {label}
                <input
                  type={field === "productExpirationDate" ? "date" : "text"}
                  value={editor[field]}
                  onChange={(event) =>
                    setEditor({ ...editor, [field]: event.target.value })
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                />
              </label>
            ))}
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              {t("patients.vaccinations.doseType", "Dose type")}
              <select
                value={editor.doseType}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    doseType: event.target.value as "" | "initial" | "booster",
                  })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">
                  {t("patients.profile.notRecorded", "Not recorded")}
                </option>
                <option value="initial">
                  {t("patients.vaccinations.doseInitial", "Initial")}
                </option>
                <option value="booster">
                  {t("patients.vaccinations.doseBooster", "Booster")}
                </option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              {t(
                "patients.vaccinations.licensedDuration",
                "Licensed duration",
              )}
              <select
                value={editor.licensedDurationMonths}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    licensedDurationMonths: event.target.value,
                  })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">
                  {t("patients.profile.notRecorded", "Not recorded")}
                </option>
                <option value="12">
                  {t("patients.vaccinations.oneYear", "1 year")}
                </option>
                <option value="36">
                  {t("patients.vaccinations.threeYears", "3 years")}
                </option>
                <option value="48">
                  {t("patients.vaccinations.fourYears", "4 years")}
                </option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              {t(
                "patients.vaccinations.supervisingVet",
                "Supervising veterinarian",
              )}
              <select
                value={editor.supervisingVeterinarianId}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    supervisingVeterinarianId: event.target.value,
                  })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">
                  {t("patients.profile.notRecorded", "Not recorded")}
                </option>
                {providers.data?.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                    {provider.licenseNumber
                      ? ` — ${provider.licenseNumber}`
                      : " — license missing"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-4">
              {t(
                "patients.vaccinations.reasonChange",
                "Reason for change (required, at least 10 characters)",
              )}
              <textarea
                value={editor.reason}
                minLength={10}
                maxLength={500}
                required
                onChange={(event) =>
                  setEditor({ ...editor, reason: event.target.value })
                }
                className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="submit"
              disabled={
                editor.reason.trim().length < 10 ||
                updateCertificateDetails.isPending
              }
            >
              {updateCertificateDetails.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t(
                "patients.vaccinations.saveAuditedChanges",
                "Save audited changes",
              )}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.vaccineName", "Vaccine Name")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.administeredAt", "Date Given")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.expiresAt", "Next Due")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.productLot", "Product / Lot")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.administeredBy", "Administered By")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.vaccinations.certificate", "Certificate")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.form.status", "Status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {vaccinations.map((vax) => (
              <tr
                key={vax.id}
                className={cn(
                  "border-b border-border align-top last:border-0",
                  vax.correctionId && "bg-destructive/5 text-muted-foreground",
                )}
              >
                <td className="px-4 py-3 font-medium">{vax.vaccineName}</td>
                <td className="px-4 py-3">
                  {formatClinicalDate(vax.administeredAt, timeZone, "\u2014")}
                </td>
                <td className="px-4 py-3">
                  {formatClinicalDate(vax.nextDueDate, timeZone, "\u2014")}
                </td>
                <td className="px-4 py-3">
                  <span>{vax.productName ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">
                    Lot {vax.lotNumber ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {vax.administeredByName ?? "\u2014"}
                </td>
                <td className="px-4 py-3">
                  {!vax.correctionId &&
                  canPrepareCertificate &&
                  isRabiesVaccineName(vax.vaccineName) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={prepareCertificate.isPending}
                      onClick={() => downloadCertificate("rabies", vax.id)}
                    >
                      {t("patients.vaccinations.rabiesPdf", "Rabies PDF")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {!vax.correctionId && canEditCertificate ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 block"
                      onClick={() =>
                        setEditor({
                          id: vax.id,
                          expectedUpdatedAt: vax.updatedAt.toISOString(),
                          productName: vax.productName ?? "",
                          manufacturer: vax.manufacturer ?? "",
                          lotNumber: vax.lotNumber ?? "",
                          productExpirationDate:
                            vax.productExpirationDate ?? "",
                          doseType: vax.doseType ?? "",
                          licensedDurationMonths:
                            vax.licensedDurationMonths?.toString() ?? "",
                          rabiesTagNumber: vax.rabiesTagNumber ?? "",
                          supervisingVeterinarianId:
                            vax.supervisingVeterinarianId ?? "",
                          reason: "",
                        })
                      }
                    >
                      {t("patients.vaccinations.editDetails", "Edit details")}
                    </Button>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {vax.correctionId ? (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                      {t(
                        "patients.vaccinations.enteredInError",
                        "Entered in error",
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("patients.vaccinations.recorded", "Recorded")}
                    </span>
                  )}
                  <ClinicalCorrectionControl
                    correction={
                      vax.correctionId &&
                      vax.correctionReason &&
                      vax.correctedAt
                        ? {
                            id: vax.correctionId,
                            reason: vax.correctionReason,
                            correctedAt: vax.correctedAt,
                            correctedByName: vax.correctedByName,
                          }
                        : null
                    }
                    canCorrect={canCorrectClinicalRecords}
                    isPending={
                      correctVaccination.isPending &&
                      correctVaccination.variables?.recordId === vax.id
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}