"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitMerge,
  Loader2,
  SearchX,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "@/server/routers/_app";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDateToDisplay } from "@/lib/date-display";
import { formatSpecies } from "@/lib/patients/species";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import {
  PageHeader,
  PageSectionHeader,
} from "@/components/layout/page-header";
import {
  DataTableFrame,
  PageToolbar,
  SearchField,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { TableSkeleton } from "@/components/common/loading";
import { useI18n } from "@/lib/i18n";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const MERGE_REASON_MIN_LENGTH = 5;
const MERGE_REASON_MAX_LENGTH = 500;
const MERGE_CONFIRMATION = "MERGE";
const DUPLICATE_FILTER_MAX_LENGTH = 128;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DuplicateGroup = RouterOutputs["patients"]["findDuplicates"][number];
type DuplicatePatient = DuplicateGroup["patients"][number];
type MergePreview = RouterOutputs["patients"]["previewMerge"];
type PreviewIdentity = MergePreview["keepPatient"];
type Translate = ReturnType<typeof useI18n>["t"];

type MergeSelection = {
  keepId: string;
  mergeId: string;
  keepName: string;
  mergeName: string;
};

type IdentityField = "species" | "sex" | "dob" | "microchip" | "externalId";

type ComparableIdentity = {
  species: string | null;
  sex?: string | null;
  dob: string | null;
  microchipNumber: string | null;
  externalSource: string | null;
  externalId: string | null;
};

const SEX_LABELS: Record<string, [key: string, fallback: string]> = {
  male: ["patients.form.sexMale", "Male (Intact)"],
  female: ["patients.form.sexFemale", "Female (Intact)"],
  male_neutered: ["patients.form.sexMaleNeutered", "Male (Neutered)"],
  female_spayed: ["patients.form.sexFemaleSpayed", "Female (Spayed)"],
};

const STATUS_LABELS: Record<string, [key: string, fallback: string]> = {
  active: ["patients.form.statusActive", "Active"],
  inactive: ["patients.form.statusInactive", "Inactive"],
  deceased: ["patients.form.statusDeceased", "Deceased"],
};

const IDENTITY_FIELD_LABELS: Record<IdentityField, [key: string, fallback: string]> = {
  species: ["patients.form.species", "Species"],
  sex: ["patients.form.sex", "Sex"],
  dob: ["patients.form.dob", "Date of Birth"],
  microchip: ["patients.duplicates.microchip", "Microchip"],
  externalId: ["patients.duplicates.externalId", "External ID"],
};

function readableCountLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function countLabel(key: string, t: Translate) {
  return t(`patients.duplicates.counts.${key}`, readableCountLabel(key));
}

function labelFrom(
  labels: Record<string, [key: string, fallback: string]>,
  value: string | null | undefined,
  t: Translate,
) {
  if (!value) return "—";
  const entry = labels[value];
  return entry ? t(entry[0], entry[1]) : value;
}

function formatExternalIdentity(identity: {
  externalSource: string | null;
  externalId: string | null;
}) {
  return identity.externalSource && identity.externalId
    ? `${identity.externalSource}: ${identity.externalId}`
    : "—";
}

/** Identifier comparison that ignores grouping separators and letter case. */
function compactIdentifier(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s\u2010-\u2015\u2212-]/g, "").toLowerCase();
}

/** Intact and neutered states of the same sex are one animal over time. */
function baseSex(sex: string | null | undefined): string {
  if (!sex) return "";
  if (sex.startsWith("female")) return "female";
  if (sex.startsWith("male")) return "male";
  return sex;
}

/**
 * Identity fields that both charts record with conflicting values. This is
 * evidence for the reviewer only; the server preview alone decides whether a
 * merge is allowed.
 */
function identityMismatches(
  keep: ComparableIdentity,
  retire: ComparableIdentity,
): IdentityField[] {
  const externalKey = (identity: ComparableIdentity) =>
    identity.externalSource && identity.externalId
      ? `${identity.externalSource.trim().toLowerCase()}:${identity.externalId.trim()}`
      : "";
  const comparisons: Array<[IdentityField, string, string]> = [
    [
      "species",
      (keep.species ?? "").trim().toLowerCase(),
      (retire.species ?? "").trim().toLowerCase(),
    ],
    ["sex", baseSex(keep.sex), baseSex(retire.sex)],
    ["dob", keep.dob ?? "", retire.dob ?? ""],
    [
      "microchip",
      compactIdentifier(keep.microchipNumber),
      compactIdentifier(retire.microchipNumber),
    ],
    ["externalId", externalKey(keep), externalKey(retire)],
  ];
  return comparisons
    .filter(([, left, right]) => left !== "" && right !== "" && left !== right)
    .map(([field]) => field);
}

/** Case- and accent-insensitive text for the candidate filter. */
function searchableText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function groupMatchesFilter(
  group: { clientFirstName: string; clientLastName: string; patients: Array<{ name: string; microchipNumber: string | null }> },
  query: string,
): boolean {
  const needle = searchableText(query.trim());
  if (!needle) return true;
  const names = [
    `${group.clientFirstName} ${group.clientLastName}`,
    ...group.patients.map((patient) => patient.name),
  ];
  if (names.some((name) => searchableText(name).includes(needle))) return true;
  const chipNeedle = compactIdentifier(query);
  return (
    chipNeedle.length > 0 &&
    group.patients.some((patient) =>
      compactIdentifier(patient.microchipNumber).includes(chipNeedle),
    )
  );
}

function DuplicateGroupCard({
  group,
  locked,
  onReview,
}: {
  group: DuplicateGroup;
  locked: boolean;
  onReview: (selection: MergeSelection) => void;
}) {
  const { t } = useI18n();
  const controlId = useId();
  const [keepId, setKeepId] = useState("");
  const [mergeId, setMergeId] = useState("");
  const keepPatient = group.patients.find((patient) => patient.id === keepId);
  const mergePatient = group.patients.find((patient) => patient.id === mergeId);
  const canReview = Boolean(
    keepPatient && mergePatient && keepPatient.id !== mergePatient.id,
  );
  const ownerName = `${group.clientFirstName} ${group.clientLastName}`;
  const historyCount = group.blockerSummary.patientsWithImmutableHistory;
  const roleOf = (patient: DuplicatePatient) =>
    patient.id === keepId ? "keep" : patient.id === mergeId ? "retire" : null;

  return (
    <section className="space-y-3">
      <PageSectionHeader
        title={ownerName}
        subtitle={[
          t(
            "patients.duplicates.sameOwnerReview",
            "{count} same-owner charts need review",
            { count: group.patients.length },
          ),
          historyCount > 0
            ? t(
                "patients.duplicates.historyCount",
                "Charts with retained history: {count}",
                { count: historyCount },
              )
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Badge variant="warning">
            {t("patients.duplicates.badge", "Possible duplicate")}
          </Badge>
        }
      />

      <DataTableFrame>
        <table className="w-full text-xs">
          <caption className="sr-only">
            {t(
              "patients.duplicates.table.caption",
              "Candidate charts for {owner}",
              { owner: ownerName },
            )}
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th scope="col" className={tableHeadClass}>
                {t("patients.duplicates.table.patient", "Patient")}
              </th>
              <th scope="col" className={tableHeadClass}>
                {t("patients.duplicates.table.signalment", "Species · Breed")}
              </th>
              <th scope="col" className={tableHeadClass}>
                {t("patients.form.dob", "Date of Birth")}
              </th>
              <th scope="col" className={tableHeadClass}>
                {t("patients.duplicates.microchip", "Microchip")}
              </th>
              <th scope="col" className={tableHeadClass}>
                {t("patients.duplicates.externalId", "External ID")}
              </th>
              <th scope="col" className={tableHeadClass}>
                {t("patients.duplicates.table.created", "Created")}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.patients.map((patient) => {
              const role = roleOf(patient);
              return (
                <tr
                  key={patient.id}
                  className={cn(
                    tableRowClass,
                    role === "keep" && "bg-success-muted/30",
                    role === "retire" && "bg-warning-muted/30",
                  )}
                >
                  <td className={cn(tableCellClass, "font-medium")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="text-foreground underline-offset-2 hover:underline"
                      >
                        {patient.name}
                      </Link>
                      {role ? (
                        <Badge variant={role === "keep" ? "success" : "warning"}>
                          {role === "keep"
                            ? t("patients.duplicates.roleKeep", "Keep")
                            : t("patients.duplicates.roleRetire", "Retire")}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">
                      {patient.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className={cn(tableCellClass, "text-muted-foreground")}>
                    {formatSpecies(patient.species, t) || "—"}
                    {patient.breed ? ` · ${patient.breed}` : ""}
                  </td>
                  <td className={cn(tableCellClass, "whitespace-nowrap tabular-nums")}>
                    {patient.dob ? formatDateToDisplay(patient.dob) : "—"}
                  </td>
                  <td className={cn(tableCellClass, "font-mono")}>
                    {patient.microchipNumber || "—"}
                  </td>
                  <td className={tableCellClass}>
                    {formatExternalIdentity(patient)}
                  </td>
                  <td
                    className={cn(
                      tableCellClass,
                      "whitespace-nowrap tabular-nums text-muted-foreground",
                    )}
                  >
                    {formatDateToDisplay(patient.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableFrame>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 shadow-xs md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`${controlId}-keep`} className="text-xs">
            {t("patients.duplicates.keepChart", "Keep this chart (canonical)")}
          </Label>
          <select
            id={`${controlId}-keep`}
            className={cn(filterControlClass, "w-full")}
            value={keepId}
            disabled={locked}
            onChange={(event) => {
              setKeepId(event.target.value);
              if (event.target.value === mergeId) setMergeId("");
            }}
          >
            <option value="">
              {t("patients.duplicates.canonicalChoice", "Choose the canonical chart")}
            </option>
            {group.patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} · {patient.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <ArrowRight
          className="mb-2.5 hidden h-4 w-4 text-muted-foreground md:block"
          aria-hidden="true"
        />
        <div className="space-y-1.5">
          <Label htmlFor={`${controlId}-retire`} className="text-xs">
            {t("patients.duplicates.retireDuplicate", "Retire this duplicate")}
          </Label>
          <select
            id={`${controlId}-retire`}
            className={cn(filterControlClass, "w-full")}
            value={mergeId}
            disabled={locked}
            onChange={(event) => setMergeId(event.target.value)}
          >
            <option value="">
              {t("patients.duplicates.duplicateChoice", "Choose the duplicate chart")}
            </option>
            {group.patients
              .filter((patient) => patient.id !== keepId)
              .map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} · {patient.id.slice(0, 8)}
                </option>
              ))}
          </select>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!canReview || locked}
          onClick={() => {
            if (!keepPatient || !mergePatient) return;
            onReview({
              keepId: keepPatient.id,
              mergeId: mergePatient.id,
              keepName: keepPatient.name,
              mergeName: mergePatient.name,
            });
          }}
        >
          <GitMerge className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("patients.duplicates.reviewMerge", "Review merge")}
        </Button>
      </div>
    </section>
  );
}

function IdentitySummary({
  label,
  role,
  patient,
  mismatches,
}: {
  label: string;
  role: "keep" | "retire";
  patient: PreviewIdentity;
  mismatches: IdentityField[];
}) {
  const { t } = useI18n();
  const rows: Array<{
    key: string;
    label: string;
    value: string;
    field?: IdentityField;
    mono?: boolean;
  }> = [
    {
      key: "species",
      label: t("patients.form.species", "Species"),
      value: formatSpecies(patient.species, t) || "—",
      field: "species",
    },
    {
      key: "breed",
      label: t("patients.form.breed", "Breed"),
      value: patient.breed || t("patients.profile.unknownBreed", "Unknown breed"),
    },
    {
      key: "sex",
      label: t("patients.form.sex", "Sex"),
      value: labelFrom(SEX_LABELS, patient.sex, t),
      field: "sex",
    },
    {
      key: "dob",
      label: t("patients.form.dob", "Date of Birth"),
      value: patient.dob ? formatDateToDisplay(patient.dob) : "—",
      field: "dob",
    },
    {
      key: "color",
      label: t("patients.form.color", "Color / Markings"),
      value: patient.color || "—",
    },
    {
      key: "microchip",
      label: t("patients.duplicates.microchip", "Microchip"),
      value: patient.microchipNumber || "—",
      field: "microchip",
      mono: true,
    },
    {
      key: "externalId",
      label: t("patients.duplicates.externalId", "External ID"),
      value: formatExternalIdentity(patient),
      field: "externalId",
    },
    {
      key: "status",
      label: t("patients.form.status", "Status"),
      value: labelFrom(STATUS_LABELS, patient.status, t),
    },
    {
      key: "created",
      label: t("patients.duplicates.table.created", "Created"),
      value: formatDateToDisplay(patient.createdAt),
    },
    {
      key: "chartId",
      label: t("patients.duplicates.chartId", "Chart ID"),
      value: patient.id,
      mono: true,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3",
        role === "keep" ? "border-success-muted" : "border-warning-muted",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-medium">{patient.name}</p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {rows.map((row) => {
          const differs = row.field ? mismatches.includes(row.field) : false;
          return (
            <Fragment key={row.key}>
              <dt
                className={cn(
                  "text-muted-foreground",
                  differs && "font-semibold text-warning-muted-foreground",
                )}
              >
                {row.label}
              </dt>
              <dd
                className={cn(
                  "flex min-w-0 items-start gap-1 break-words",
                  row.mono && "font-mono",
                  differs && "font-semibold text-warning-muted-foreground",
                )}
              >
                <span className="min-w-0 break-all">{row.value}</span>
                {differs ? (
                  <AlertTriangle
                    className="mt-0.5 h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                ) : null}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function RetainedHistoryChecks({ counts }: { counts: Record<string, number> }) {
  const { t } = useI18n();
  const entries = Object.entries(counts);
  const found = entries.filter(([, count]) => count > 0);
  const clear = entries.filter(([, count]) => count === 0);

  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">
        {t("patients.duplicates.retainedHistoryChecks", "Retained-history checks")}
      </h3>
      {found.length > 0 ? (
        <dl className="mt-2 space-y-1 text-sm">
          {found.map(([key, count]) => (
            <div
              key={key}
              className="flex justify-between gap-4 font-medium text-destructive"
            >
              <dt>{countLabel(key, t)}</dt>
              <dd className="tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-sm text-success-muted-foreground">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(
            "patients.duplicates.checksAllClear",
            "All {count} retained-history checks are clear.",
            { count: entries.length },
          )}
        </p>
      )}
      {clear.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t(
              "patients.duplicates.checksClearToggle",
              "Show clear checks ({count})",
              { count: clear.length },
            )}
          </summary>
          <dl className="mt-2 space-y-1">
            {clear.map(([key, count]) => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{countLabel(key, t)}</dt>
                <dd className="tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export default function PatientDuplicatesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [selection, setSelection] = useState<MergeSelection | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [filter, setFilter] = useState("");
  const operationId = useRef<string | null>(null);
  // `isPending` only flips after a re-render, so a fast double click could
  // otherwise send the same merge operation twice.
  const mergeRequestLockRef = useRef(false);
  const utils = trpc.useUtils();

  const duplicates = trpc.patients.findDuplicates.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });
  const preview = trpc.patients.previewMerge.useQuery(
    {
      keepId: selection?.keepId ?? EMPTY_UUID,
      mergeId: selection?.mergeId ?? EMPTY_UUID,
    },
    {
      enabled: isAdmin && selection !== null,
      refetchOnWindowFocus: false,
    },
  );
  const mergePatient = trpc.patients.merge.useMutation({
    onSuccess: async (_merged, variables) => {
      toast.success(
        t(
          "patients.duplicates.successToast",
          "Duplicate chart retired with an immutable merge record",
        ),
      );
      operationId.current = null;
      setSelection(null);
      setReason("");
      setConfirmation("");
      await Promise.all([
        utils.patients.findDuplicates.invalidate(),
        utils.patients.list.invalidate(),
      ]);
      // Redirect to the chart the server actually merged into, not whatever
      // the review state points at by the time the request settles.
      router.push(`/patients/${variables.keepId}?merged=1`);
    },
    onError: (error) => {
      // Keep the operation ID so a retry replays the same server operation.
      mergeRequestLockRef.current = false;
      toast.error(error.message);
    },
  });
  const resetMergeMutation = mergePatient.reset;

  // A running merge (and the redirect after a success) owns the page: the
  // dialog cannot close, and no other review can start, until it settles.
  const mergeLocked = mergePatient.isPending || mergePatient.isSuccess;

  useEffect(() => {
    operationId.current = null;
    setReason("");
    setConfirmation("");
  }, [selection?.keepId, selection?.mergeId]);

  const openReview = (next: MergeSelection) => {
    if (mergeLocked) return;
    resetMergeMutation();
    setSelection(next);
  };

  const closeReview = () => {
    if (mergeLocked) return;
    setSelection(null);
  };

  const trimmedReason = reason.trim();
  const reasonShortBy = Math.max(0, MERGE_REASON_MIN_LENGTH - trimmedReason.length);
  const confirmationMismatch =
    confirmation.length > 0 && !MERGE_CONFIRMATION.startsWith(confirmation);
  const canMerge =
    preview.data?.allowed === true &&
    trimmedReason.length >= MERGE_REASON_MIN_LENGTH &&
    trimmedReason.length <= MERGE_REASON_MAX_LENGTH &&
    confirmation === MERGE_CONFIRMATION &&
    !mergeLocked;

  const submitMerge = () => {
    if (!selection || !canMerge || mergeRequestLockRef.current) return;
    mergeRequestLockRef.current = true;
    operationId.current ??= crypto.randomUUID();
    mergePatient.mutate({
      keepId: selection.keepId,
      mergeId: selection.mergeId,
      reason: trimmedReason,
      operationId: operationId.current,
    });
  };

  const groups = duplicates.data;
  const visibleGroups = useMemo(
    () => (groups ?? []).filter((group) => groupMatchesFilter(group, filter)),
    [groups, filter],
  );
  const chartCount = (groups ?? []).reduce(
    (total, group) => total + group.patients.length,
    0,
  );
  const mismatches = preview.data
    ? identityMismatches(preview.data.keepPatient, preview.data.mergePatient)
    : [];

  const backButton = (
    <Button variant="ghost" size="sm" onClick={() => router.push("/patients")}>
      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
      {t("patients.actions.backToPatients", "Back to Patients")}
    </Button>
  );

  if (sessionStatus === "loading") {
    return (
      <div className={pageShellClass}>
        <TableSkeleton rows={5} cols={2} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={pageShellClass}>
        <PageHeader
          icon={GitMerge}
          title={t("patients.duplicates.title", "Patient Duplicate Review")}
          actions={backButton}
        />
        <EmptyState
          icon={ShieldAlert}
          title={t(
            "patients.duplicates.adminOnlyTitle",
            "Duplicate review is admin-only",
          )}
          description={t(
            "patients.duplicates.adminOnlyDesc",
            "Only practice administrators can review or merge duplicate patient identities.",
          )}
        />
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={GitMerge}
        title={t("patients.duplicates.title", "Patient Duplicate Review")}
        subtitle={t(
          "patients.duplicates.subtitle",
          "Review and merge duplicate charts under the same client.",
        )}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("patients.duplicates.adminOnlyBadge", "Admin-only")}
            </Badge>
            {backButton}
          </>
        }
      />

      <Alert variant="warning" role="note">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="space-y-1">
          <p>
            {t(
              "patients.duplicates.mergeWarning",
              "Never merge charts merely because pet names match. Confirm the owner, species, DOB, microchip, external identity, and both charts' contents. Historical records are never silently reassigned.",
            )}
          </p>
          <p className="text-xs">
            {t(
              "patients.duplicates.scopeNote",
              "OpenVPM only suggests same-owner matches. A merge is permitted only when the retiring chart has no clinical, medication, controlled-substance, financial, or other retained history.",
            )}
          </p>
        </AlertDescription>
      </Alert>

      {duplicates.isError ? (
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {t(
              "patients.duplicates.loadError",
              "Unable to load duplicate candidates.",
            )}
          </AlertTitle>
          <AlertDescription>{duplicates.error.message}</AlertDescription>
        </Alert>
      ) : duplicates.isLoading ? (
        <TableSkeleton rows={5} cols={2} />
      ) : groups && groups.length > 0 ? (
        <>
          <PageToolbar>
            <label htmlFor="duplicate-filter" className="sr-only">
              {t("patients.duplicates.searchLabel", "Filter duplicate candidates")}
            </label>
            <SearchField
              id="duplicate-filter"
              value={filter}
              onChange={setFilter}
              maxLength={DUPLICATE_FILTER_MAX_LENGTH}
              placeholder={t(
                "patients.duplicates.searchPlaceholder",
                "Filter by owner, patient, or microchip...",
              )}
            />
            <p className="text-xs tabular-nums text-muted-foreground sm:ml-auto sm:shrink-0">
              {t(
                "patients.duplicates.summary",
                "Owners: {groups} · Charts to review: {charts}",
                { groups: groups.length, charts: chartCount },
              )}
            </p>
          </PageToolbar>

          {visibleGroups.length > 0 ? (
            <div className={pageShellClass}>
              {visibleGroups.map((group) => (
                <DuplicateGroupCard
                  key={`${group.clientId}-${group.patients.map((patient) => patient.id).join("-")}`}
                  group={group}
                  locked={mergeLocked}
                  onReview={openReview}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title={t(
                "patients.duplicates.noMatchesTitle",
                "No duplicate groups match this filter",
              )}
              description={t(
                "patients.duplicates.noMatchesDesc",
                "Clear the filter to see every same-owner candidate.",
              )}
              action={{
                label: t("patients.duplicates.clearFilter", "Clear filter"),
                onClick: () => setFilter(""),
              }}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={CheckCircle}
          title={t("patients.duplicates.noDuplicatesTitle", "No duplicates found")}
          description={t(
            "patients.duplicates.noDuplicatesDesc",
            "All patient charts appear unique with no duplicates detected.",
          )}
        />
      )}

      <Dialog
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <DialogContent
          aria-busy={mergePatient.isPending}
          className={cn(
            "max-h-[90vh] max-w-3xl overflow-y-auto",
            // The built-in close button cannot be disabled; make it inert.
            mergeLocked &&
              "[&>button:last-child]:pointer-events-none [&>button:last-child]:opacity-30",
          )}
          onEscapeKeyDown={(event) => {
            if (mergeLocked) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (mergeLocked) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t("patients.duplicates.confirmMergeTitle", "Confirm Chart Merge")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "patients.duplicates.previewRecalculated",
                "Preview is recalculated on the server before the merge commits.",
              )}
            </DialogDescription>
          </DialogHeader>

          {selection ? (
            preview.isError ? (
              <Alert variant="destructive" className="bg-destructive/10">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>
                  {t("patients.duplicates.previewError", "Unable to preview this merge.")}
                </AlertTitle>
                <AlertDescription>{preview.error.message}</AlertDescription>
              </Alert>
            ) : preview.isLoading || !preview.data ? (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t(
                  "patients.duplicates.previewLoading",
                  "Checking both charts and their retained history...",
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                  <IdentitySummary
                    label={t("patients.duplicates.keepAsCanonical", "Keep as canonical")}
                    role="keep"
                    patient={preview.data.keepPatient}
                    mismatches={mismatches}
                  />
                  <ArrowRight
                    className="mx-auto h-5 w-5 rotate-90 text-muted-foreground md:rotate-0"
                    aria-hidden="true"
                  />
                  <IdentitySummary
                    label={t("patients.duplicates.retireAsDuplicate", "Retire as duplicate")}
                    role="retire"
                    patient={preview.data.mergePatient}
                    mismatches={mismatches}
                  />
                </div>

                {mismatches.length > 0 ? (
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>
                      {t(
                        "patients.duplicates.mismatch.title",
                        "These charts differ in: {fields}",
                        {
                          fields: mismatches
                            .map((field) =>
                              t(
                                IDENTITY_FIELD_LABELS[field][0],
                                IDENTITY_FIELD_LABELS[field][1],
                              ),
                            )
                            .join(", "),
                        },
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      {t(
                        "patients.duplicates.mismatch.desc",
                        "Confirm both charts describe the same animal before merging.",
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <RetainedHistoryChecks counts={preview.data.blockerCounts} />
                  <div className="rounded-lg border border-border p-3">
                    <h3 className="text-sm font-semibold">
                      {t("patients.duplicates.prospectiveWork", "Prospective work")}
                    </h3>
                    <dl className="mt-2 space-y-1 text-sm">
                      {Object.entries(preview.data.movableCounts).map(
                        ([label, count]) => (
                          <div key={label} className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                              {countLabel(label, t)}
                            </dt>
                            <dd className="tabular-nums">{count}</dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </div>
                </div>

                {!preview.data.allowed ? (
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>
                      {t(
                        "patients.duplicates.mergeBlocked",
                        "Keep both chart identities—this merge is blocked.",
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {preview.data.reasons.map((blockReason) => (
                          <li key={blockReason}>{blockReason}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="success" role="status">
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      {t(
                        "patients.duplicates.mergeAllowed",
                        "The retiring chart has no retained history. Any explicitly listed prospective work will move atomically; an immutable identity event will preserve who merged it, when, and why.",
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {preview.data.allowed ? (
                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="merge-reason">
                        {t(
                          "patients.duplicates.reasonLabel",
                          "Merge Reason (required, min 5 chars)",
                        )}
                      </Label>
                      <Textarea
                        id="merge-reason"
                        value={reason}
                        minLength={MERGE_REASON_MIN_LENGTH}
                        maxLength={MERGE_REASON_MAX_LENGTH}
                        disabled={mergeLocked}
                        placeholder={t(
                          "patients.duplicates.reasonPlaceholder",
                          "Explain reason for merge (e.g., duplicated during migration)...",
                        )}
                        aria-describedby="merge-reason-hint"
                        onChange={(event) => setReason(event.target.value)}
                      />
                      <p
                        id="merge-reason-hint"
                        className="flex justify-between gap-3 text-xs text-muted-foreground"
                      >
                        <span
                          className={cn(
                            trimmedReason.length > 0 &&
                              reasonShortBy > 0 &&
                              "font-medium text-warning-muted-foreground",
                          )}
                        >
                          {trimmedReason.length > 0 && reasonShortBy > 0
                            ? t(
                                "patients.duplicates.reasonRemaining",
                                "Characters still needed: {count}",
                                { count: reasonShortBy },
                              )
                            : t(
                                "patients.duplicates.reasonMinimum",
                                "At least {min} characters",
                                { min: MERGE_REASON_MIN_LENGTH },
                              )}
                        </span>
                        <span className="tabular-nums">
                          {reason.length}/{MERGE_REASON_MAX_LENGTH}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="merge-confirmation">
                        {t(
                          "patients.duplicates.typeConfirm",
                          `Type ${MERGE_CONFIRMATION} to confirm`,
                        )}
                      </Label>
                      <Input
                        id="merge-confirmation"
                        className="max-w-sm font-mono"
                        value={confirmation}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={MERGE_CONFIRMATION}
                        disabled={mergeLocked}
                        aria-invalid={confirmationMismatch}
                        aria-describedby={
                          confirmationMismatch
                            ? "merge-confirmation-error"
                            : undefined
                        }
                        onChange={(event) => setConfirmation(event.target.value)}
                      />
                      {confirmationMismatch ? (
                        <p
                          id="merge-confirmation-error"
                          className="text-xs font-medium text-destructive"
                        >
                          {t(
                            "patients.duplicates.confirmationMismatch",
                            "Type MERGE exactly, in capital letters.",
                          )}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "patients.duplicates.redirectNotice",
                        "{mergeName} will redirect permanently to the canonical {keepName} chart.",
                        {
                          mergeName: selection.mergeName,
                          keepName: selection.keepName,
                        },
                      )}
                    </p>
                  </div>
                ) : null}

                {mergePatient.isError ? (
                  <Alert variant="destructive" className="bg-destructive/10">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{mergePatient.error.message}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )
          ) : null}

          <DialogFooter className="sm:items-center">
            {mergeLocked ? (
              <p
                role="status"
                className="text-xs text-muted-foreground sm:mr-auto"
              >
                {t(
                  "patients.duplicates.closeLocked",
                  "The merge is running. This window closes when it finishes.",
                )}
              </p>
            ) : null}
            <Button variant="outline" disabled={mergeLocked} onClick={closeReview}>
              {t("patients.actions.close", "Close")}
            </Button>
            {preview.data?.allowed ? (
              <Button
                variant="destructive"
                disabled={!canMerge}
                onClick={submitMerge}
              >
                {mergePatient.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GitMerge className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {mergePatient.isPending
                  ? t("patients.duplicates.merging", "Merging charts...")
                  : t("patients.duplicates.executeMerge", "Merge and retire duplicate")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
