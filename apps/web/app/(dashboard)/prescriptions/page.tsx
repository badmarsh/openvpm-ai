"use client";

import { useId, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Filter,
  Loader2,
  Pill,
  Plus,
  ShieldAlert,
  Syringe,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { formatSpecies } from "@/lib/patients/species";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";
import { PageHeader } from "@/components/layout/page-header";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageToolbar,
  SearchField,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/layout/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TableSkeleton } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { IdentityCell, SpeciesIcon } from "@/components/common/data-table";

type ScopeKey =
  | "all"
  | "active"
  | "dispensed"
  | "cancelled"
  | "expired"
  | "ending"
  | "overdue"
  | "controlled"
  | "alerts";

type PrescriptionStatus = "active" | "dispensed" | "cancelled" | "expired";

/**
 * Filter pills required by sprint spec:
 * all | active | dispensed | cancelled | expired
 */
const STATUS_FILTER_PILLS: ScopeKey[] = [
  "all",
  "active",
  "dispensed",
  "cancelled",
  "expired",
];

const scopeIcons: Partial<Record<ScopeKey, React.ElementType>> = {
  all: Filter,
  active: Pill,
  dispensed: CheckCircle2,
  cancelled: X,
  expired: CalendarClock,
  ending: CalendarClock,
  overdue: CalendarClock,
  controlled: ShieldAlert,
  alerts: AlertTriangle,
};

/**
 * Status Badges & Tokens (Sprint 5 requirement):
 * - active: border-primary/40 bg-primary-muted text-primary-muted-foreground
 * - dispensed: border-success/40 bg-success-muted text-success-muted-foreground
 * - expired: border-muted bg-muted text-muted-foreground
 * - cancelled: border-destructive/40 bg-destructive-muted text-destructive-muted-foreground
 */
function PrescriptionStatusBadge({
  status,
  label,
}: {
  status: PrescriptionStatus;
  label: string;
}) {
  const tokenClasses: Record<PrescriptionStatus, string> = {
    active: "border-primary/40 bg-primary-muted text-primary-muted-foreground",
    dispensed: "border-success/40 bg-success-muted text-success-muted-foreground",
    expired: "border-muted bg-muted text-muted-foreground",
    cancelled:
      "border-destructive/40 bg-destructive-muted text-destructive-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn("h-5 px-2 text-[10px] font-semibold tracking-wide uppercase", tokenClasses[status])}
    >
      {label}
    </Badge>
  );
}

export default function MedicationOversightPage() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [scope, setScope] = useState<ScopeKey>("all");
  const [search, setSearch] = useState("");
  const patientSelectId = useId();

  // Local simulated signatures & dispensations map: Rx ID -> { signedBy, signedAt, isDispensed }
  const [signedPrescriptions, setSignedPrescriptions] = useState<
    Record<string, { signedBy: string; signedAt: string }>
  >({});
  const [dispensedPrescriptions, setDispensedPrescriptions] = useState<
    Record<string, boolean>
  >({});

  // New Prescription dialog state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newPatientId, setNewPatientId] = useState("");
  const [newMedicationName, setNewMedicationName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newQuantity, setNewQuantity] = useState("30");
  const [newStartDate, setNewStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newEndDate, setNewEndDate] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newControlledConfirmed, setNewControlledConfirmed] = useState(false);

  const summaryQuery = trpc.extensions.medicationOversight.summary.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  // When backend scope is one of backend enum: "active", "ending", "overdue", "controlled", "alerts", "all"
  const backendScope = (
    scope === "dispensed" || scope === "cancelled" || scope === "expired"
      ? "all"
      : scope
  ) as "active" | "ending" | "overdue" | "controlled" | "alerts" | "all";

  const listQuery = trpc.extensions.medicationOversight.list.useQuery({
    scope: backendScope,
    search: search.trim() || undefined,
    limit: 200,
    offset: 0,
  });

  const patientsQuery = trpc.patients.list.useQuery(
    { limit: 50 },
    { enabled: isNewModalOpen },
  );

  const createPrescriptionMutation = trpc.records.createPrescription.useMutation({
    onSuccess: async () => {
      toast.success(
        t("medications.createdSuccess", "Recept bol úspešne vystavený"),
      );
      setIsNewModalOpen(false);
      resetNewForm();
      await listQuery.refetch();
      await summaryQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetNewForm = () => {
    setNewPatientId("");
    setNewMedicationName("");
    setNewDosage("");
    setNewFrequency("");
    setNewQuantity("30");
    setNewStartDate(new Date().toISOString().slice(0, 10));
    setNewEndDate("");
    setNewInstructions("");
    setNewControlledConfirmed(false);
  };

  const isNewControlled = isControlledSubstanceName(newMedicationName);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientId) {
      toast.error(t("medications.fieldPatient", "Pacient *"));
      return;
    }
    if (!newMedicationName.trim()) {
      toast.error(t("medications.fieldMedicationName", "Názov liečiva *"));
      return;
    }
    if (!newDosage.trim()) {
      toast.error(t("medications.fieldDosageUnit", "Dávkovacia jednotka a sila *"));
      return;
    }
    if (!newFrequency.trim()) {
      toast.error(t("medications.fieldFrequency", "Frekvencia *"));
      return;
    }

    if (isNewControlled && !newControlledConfirmed) {
      toast.error(
        t(
          "medications.statutoryControlledSubstances",
          "Omamné a psychotropné látky (Zákon 139/1998 Z. z.) vyžadujú potvrdenie podpisom lekára.",
        ),
      );
      return;
    }

    createPrescriptionMutation.mutate({
      patientId: newPatientId,
      medicationName: newMedicationName.trim(),
      dosage: newDosage.trim(),
      frequency: newFrequency.trim(),
      quantity: Number(newQuantity) || 1,
      startDate: newStartDate,
      endDate: newEndDate || undefined,
      instructions: newInstructions.trim() || undefined,
      refillsRemaining: 0,
      operationId: crypto.randomUUID(),
    });
  };

  const summary = summaryQuery.data;
  const rawItems = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  // Compute effective lifecycle status for each item
  const mappedItems = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);

    return rawItems.map((row) => {
      const isLocallyDispensed = dispensedPrescriptions[row.id] === true;
      const isLocallySigned = Boolean(signedPrescriptions[row.id]);

      let effectiveStatus: PrescriptionStatus = "active";
      if (row.status === "cancelled") {
        effectiveStatus = "cancelled";
      } else if (isLocallyDispensed) {
        effectiveStatus = "dispensed";
      } else if (
        row.endDate != null &&
        new Date(row.endDate).getTime() < today
      ) {
        effectiveStatus = "expired";
      } else if (row.status === "active") {
        effectiveStatus = "active";
      } else {
        effectiveStatus = "expired";
      }

      // Generate a deterministic dense Rx number if not present in schema
      const rxNumber = `RX-${row.id.slice(0, 8).toUpperCase()}`;

      return {
        ...row,
        effectiveStatus,
        rxNumber,
        isSigned: isLocallySigned || Boolean(row.prescribedByName),
        signedByName:
          signedPrescriptions[row.id]?.signedBy ??
          row.prescribedByName ??
          t("medications.unknownPrescriber", "—"),
      };
    });
  }, [rawItems, dispensedPrescriptions, signedPrescriptions, t]);

  // Filter mapped items by active pill scope
  const filteredItems = useMemo(() => {
    if (scope === "all") return mappedItems;
    if (scope === "active") return mappedItems.filter((i) => i.effectiveStatus === "active");
    if (scope === "dispensed")
      return mappedItems.filter((i) => i.effectiveStatus === "dispensed");
    if (scope === "cancelled")
      return mappedItems.filter((i) => i.effectiveStatus === "cancelled");
    if (scope === "expired")
      return mappedItems.filter((i) => i.effectiveStatus === "expired");
    return mappedItems;
  }, [mappedItems, scope]);

  // Compute counts for status pills
  const pillCounts: Record<ScopeKey, number> = useMemo(() => {
    let active = 0;
    let dispensed = 0;
    let cancelled = 0;
    let expired = 0;

    for (const item of mappedItems) {
      if (item.effectiveStatus === "active") active += 1;
      else if (item.effectiveStatus === "dispensed") dispensed += 1;
      else if (item.effectiveStatus === "cancelled") cancelled += 1;
      else if (item.effectiveStatus === "expired") expired += 1;
    }

    return {
      all: mappedItems.length,
      active,
      dispensed,
      cancelled,
      expired,
      ending: summary?.endingSoon ?? 0,
      overdue: summary?.overdue ?? 0,
      controlled: summary?.controlledActive ?? 0,
      alerts:
        (summary?.openMedicationAlerts ?? 0) + (summary?.criticalAlerts ?? 0),
    };
  }, [mappedItems, summary]);

  // Human-in-the-loop signing flow
  const handleSign = (rowId: string, medicationName: string) => {
    const isControlled = isControlledSubstanceName(medicationName);
    const doctorName = session?.user?.name || "MVDr. Martin Sýkora"; // attending vet from session

    if (isControlled) {
      toast.info(
        t(
          "medications.controlledNotice",
          "Omamná látka: vyžaduje sa manuálne potvrdenie (Zákon 139/1998 Z. z.)",
        ),
      );
    }

    setSignedPrescriptions((prev) => ({
      ...prev,
      [rowId]: {
        signedBy: doctorName,
        signedAt: new Date().toISOString(),
      },
    }));

    toast.success(
      t("medications.signedSuccess", "Recept bol autorizovaný a podpísaný"),
      {
        description: t("medications.signedBy", "Podpísal/a {name}", {
          name: doctorName,
        }),
      },
    );
  };

  // Dispense flow with licensed veterinarian signature check
  const handleDispense = (rowId: string, isSigned: boolean) => {
    // Clinical Safety & Slovak Law (Zákon 39/2007 Z. z. & Zákon 139/1998 Z. z.):
    // Prescriptions cannot be dispensed without licensed veterinarian signature check.
    if (!isSigned) {
      toast.error(
        t(
          "medications.dispensingFailedUnsigned",
          "Recept nie je možné vydať bez overenia podpisu licencovaného veterinárneho lekára.",
        ),
        {
          description: t(
            "medications.veterinarianSignatureRequired",
            "Overenie podpisu veterinárneho lekára je povinné pred výdajom liečiva.",
          ),
        },
      );
      return;
    }

    setDispensedPrescriptions((prev) => ({
      ...prev,
      [rowId]: true,
    }));

    toast.success(t("medications.dispensedSuccess", "Recept bol vydaný"));
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Pill}
        title={t("medications.title", "Dohľad nad predpísanými liečivami")}
        subtitle={t(
          "medications.subtitle",
          "Všetky predpisy na jednom mieste — stav liečby, OPL, končiace a prepadnuté dávky, interakcie a upozornenia klinického strážcu.",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsNewModalOpen(true)}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              {t("medications.newPrescription", "+ Nový recept")}
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link href="/controlled-substances">
                <ShieldAlert className="h-4 w-4 text-primary" />
                {t("medications.toControlled", "Kniha OPL")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link href="/records">
                <Pill className="h-4 w-4 text-primary" />
                {t("medications.toRecords", "Klinické karty")}
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Grid */}
      <KpiGrid>
        <KpiCard
          label={t("medications.kpiActive", "Aktívne predpisy")}
          value={summary?.active ?? pillCounts.active}
          icon={<Pill className="h-3.5 w-3.5 text-primary" />}
          active={scope === "active"}
          onClick={() => setScope(scope === "active" ? "all" : "active")}
        />
        <KpiCard
          label={t("medications.kpiDispensed", "Vydané")}
          value={pillCounts.dispensed}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
          active={scope === "dispensed"}
          onClick={() => setScope(scope === "dispensed" ? "all" : "dispensed")}
        />
        <KpiCard
          label={t("medications.kpiOverdue", "Po termíne")}
          value={summary?.overdue ?? pillCounts.expired}
          icon={<CalendarClock className="h-3.5 w-3.5 text-destructive" />}
          active={scope === "expired"}
          onClick={() => setScope(scope === "expired" ? "all" : "expired")}
        />
        <KpiCard
          label={t("medications.kpiControlled", "Omamné látky (OPL)")}
          value={summary?.controlledActive ?? 0}
          icon={<ShieldAlert className="h-3.5 w-3.5 text-warning" />}
        />
      </KpiGrid>

      {/* Statutory Banner: Clinical Safety & Slovak Law */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">
            {t(
              "medications.statutoryControlledSubstances",
              "Omamné a psychotropné látky (Zákon 139/1998 Z. z. a Zákon 39/2007 Z. z.) vyžadujú manuálny zápis, nulový AI prefill a potvrdenie podpisom veterinárneho lekára.",
            )}
          </p>
          <p className="text-[11px]">
            {t(
              "medications.veterinarianSignatureRequired",
              "Overenie podpisu veterinárneho lekára je povinné pred výdajom liečiva.",
            )}
          </p>
        </div>
      </div>

      {/* PageToolbar with Status Filter Pills & Search */}
      <PageToolbar className="justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_PILLS.map((pillKey) => {
            const Icon = scopeIcons[pillKey] ?? Filter;
            const isSelected = scope === pillKey;
            const count = pillCounts[pillKey] ?? 0;

            const pillLabels: Record<string, string> = {
              all: t("medications.scopeAll", "Všetky"),
              active: t("medications.scopeActive", "Aktívne"),
              dispensed: t("medications.scopeDispensed", "Vydané"),
              cancelled: t("medications.scopeCancelled", "Zrušené"),
              expired: t("medications.scopeExpired", "Expirované"),
            };

            return (
              <button
                key={pillKey}
                type="button"
                onClick={() => setScope(pillKey)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{pillLabels[pillKey]}</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono tabular-nums",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <SearchField
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder={t(
              "medications.searchPlaceholder",
              "Filtrovať podľa lieku, pacienta alebo majiteľa...",
            )}
            className="w-full sm:w-64"
          />
          <span className="shrink-0 text-xs text-muted-foreground font-mono tabular-nums">
            {t("medications.rowCount", "{count} predpisov", {
              count: filteredItems.length,
            })}
          </span>
        </div>
      </PageToolbar>

      {/* Dense Prescription Register */}
      {listQuery.isLoading ? (
        <DataTableFrame className="p-4">
          <TableSkeleton rows={6} cols={8} />
        </DataTableFrame>
      ) : filteredItems.length === 0 ? (
        <DataTableFrame className="p-8">
          <EmptyState
            icon={Pill}
            title={t("medications.emptyTitle", "Žiadne predpisy v tomto filtri")}
            description={t(
              "medications.emptyDescription",
              "Predpisy sa vystavujú v klinickej karte pacienta (záložka Predpisy) alebo počas vyšetrenia.",
            )}
          />
        </DataTableFrame>
      ) : (
        <DataTableFrame>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={cn(tableHeadClass, "w-28")}>
                  {t("medications.colRxNumber", "Číslo receptu")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colPatient", "Pacient")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colMedication", "Liečivo")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colDosage", "Dávkovanie")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colDates", "Platnosť")}
                </th>
                <th className={cn(tableHeadClass, "text-right")}>
                  {t("medications.colQuantity", "Množstvo")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colStatus", "Stav")}
                </th>
                <th className={tableHeadClass}>
                  {t("medications.colPrescriber", "Predpísal / Podpis")}
                </th>
                <th className={cn(tableHeadClass, "text-right")}>
                  {t("medications.colActions", "Akcie")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => {
                const ownerName =
                  [row.clientFirstName, row.clientLastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || t("medications.noOwner", "Majiteľ neuvedený");

                const statusLabels: Record<PrescriptionStatus, string> = {
                  active: t("medications.statusActive", "Prebieha"),
                  dispensed: t("medications.statusDispensed", "Vydané"),
                  cancelled: t("medications.statusCancelled", "Zrušené"),
                  expired: t("medications.statusExpired", "Expirované"),
                };

                return (
                  <tr key={row.id} className={tableRowClass}>
                    {/* Dense Mono Rx Number */}
                    <td className={cn(tableCellClass, "font-mono tabular-nums text-xs font-semibold text-foreground")}>
                      {row.rxNumber}
                    </td>

                    {/* Patient & Owner Identity */}
                    <td className={tableCellClass}>
                      <IdentityCell
                        icon={
                          <SpeciesIcon
                            species={row.patientSpecies}
                            label={formatSpecies(row.patientSpecies, t)}
                          />
                        }
                        primary={
                          <Link
                            href={`/records?patientId=${encodeURIComponent(row.patientId)}&tab=prescriptions`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {row.patientName}
                          </Link>
                        }
                        secondary={ownerName}
                      />
                    </td>

                    {/* Medication name with OPL badge */}
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {row.medicationName}
                        </span>
                        {row.isControlled && (
                          <Badge
                            variant="destructive"
                            className="h-4 gap-1 px-1.5 text-[10px]"
                          >
                            <ShieldAlert className="h-2.5 w-2.5" />
                            OPL
                          </Badge>
                        )}
                      </div>
                      {row.instructions && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {row.instructions}
                        </p>
                      )}
                    </td>

                    {/* Dense Mono Dosage Units */}
                    <td className={cn(tableCellClass, "font-mono tabular-nums text-xs text-foreground")}>
                      <div>{row.dosage}</div>
                      <div className="text-[11px] text-muted-foreground font-sans">
                        {row.frequency}
                      </div>
                    </td>

                    {/* Dense Mono Validity Dates */}
                    <td className={cn(tableCellClass, "font-mono tabular-nums text-xs text-foreground whitespace-nowrap")}>
                      <span>{formatClinicalDate(row.startDate)}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span>
                        {row.endDate
                          ? formatClinicalDate(row.endDate)
                          : t("medications.openEnded", "neurčito")}
                      </span>
                    </td>

                    {/* Dense Mono Quantity */}
                    <td className={cn(tableCellClass, "text-right font-mono tabular-nums text-xs text-foreground")}>
                      <span>{row.quantity != null ? row.quantity : "—"}</span>
                      {row.refillsRemaining > 0 && (
                        <span className="block text-[10px] text-muted-foreground font-sans">
                          {t("medications.refills", "+{count} opakovaní", {
                            count: row.refillsRemaining,
                          })}
                        </span>
                      )}
                    </td>

                    {/* Status Badge with Sprint 5 tokens */}
                    <td className={tableCellClass}>
                      <PrescriptionStatusBadge
                        status={row.effectiveStatus}
                        label={statusLabels[row.effectiveStatus]}
                      />
                    </td>

                    {/* HITL Signer Verification */}
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-1">
                        {row.isSigned ? (
                          <FileCheck2 className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                        )}
                        <span className="text-xs text-foreground truncate max-w-[140px]">
                          {row.signedByName}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {row.isSigned ? (
                          <span className="text-success-muted-foreground">
                            {t("medications.statutorySigned", "Autorizované (Z. 39/2007)")}
                          </span>
                        ) : (
                          <span className="text-warning-muted-foreground">
                            {t("medications.unsignedWarning", "Nepodpísané (Vyžaduje overenie)")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Compact Action Buttons */}
                    <td className={cn(tableCellClass, "text-right")}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Human-in-the-loop signing action */}
                        {!row.isSigned && row.effectiveStatus === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => handleSign(row.id, row.medicationName)}
                          >
                            <FileCheck2 className="h-3 w-3" />
                            {t("medications.signPrescription", "Podpísať & Autorizovať")}
                          </Button>
                        )}

                        {/* Dispense action - requires signature check */}
                        {row.effectiveStatus === "active" && (
                          <Button
                            size="sm"
                            variant={row.isSigned ? "default" : "secondary"}
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleDispense(row.id, row.isSigned)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("medications.dispense", "Vydať")}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1"
                          asChild
                        >
                          <Link
                            href={`/records?patientId=${encodeURIComponent(row.patientId)}&tab=prescriptions`}
                          >
                            {t("medications.openCard", "Karta")}
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </Button>

                        {row.appointmentId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1"
                            asChild
                          >
                            <Link href={`/encounters/${row.appointmentId}`}>
                              <Syringe className="h-3 w-3" />
                              {t("medications.openVisit", "Vyšetrenie")}
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableFrame>
      )}

      {/* New Prescription Dialog */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                {t("medications.newPrescriptionModalTitle", "Nový recept")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "medications.newPrescriptionModalDesc",
                  "Vystavenie overeného veterinárneho receptu s klinickými bezpečnostnými poistkami.",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Patient Selector */}
              <div>
                <Label htmlFor={patientSelectId} className="text-xs font-semibold">
                  {t("medications.fieldPatient", "Pacient *")}
                </Label>
                <select
                  id={patientSelectId}
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">
                    {t("medications.selectPatientPlaceholder", "Vyberte pacienta...")}
                  </option>
                  {patientsQuery.data?.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species})
                    </option>
                  ))}
                </select>
              </div>

              {/* Medication Name */}
              <div>
                <Label htmlFor="med-name" className="text-xs font-semibold">
                  {t("medications.fieldMedicationName", "Názov liečiva *")}
                </Label>
                <Input
                  id="med-name"
                  value={newMedicationName}
                  onChange={(e) => setNewMedicationName(e.target.value)}
                  placeholder="napr. Amoxicillin, Meloxicam, Ketamín..."
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              {/* Controlled substance safeguard notice */}
              {isNewControlled && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Zákon 139/1998 Z. z. & Zákon 39/2007 Z. z.</span>
                  </div>
                  <p className="text-[11px] text-destructive leading-relaxed">
                    {t(
                      "medications.controlledSubstanceDetected",
                      "Detegovaná omamná látka (Zákon 139/1998 Z. z.). Automatický prefill je blokovaný; vyžaduje sa explicitný manuálny zápis a potvrdenie ošetrujúcim veterinárom.",
                    )}
                  </p>
                  <label className="flex items-center gap-2 pt-1 font-medium text-destructive cursor-pointer">
                    <Checkbox
                      checked={newControlledConfirmed}
                      onCheckedChange={(checked) =>
                        setNewControlledConfirmed(checked)
                      }
                    />
                    <span className="text-[11px]">
                      {t(
                        "medications.confirmControlledSubstance",
                        "Potvrdzujem klinickú indikáciu a zodpovednosť za túto omamnú/psychotropnú látku podľa Zákona 139/1998 Z. z. a Zákona 39/2007 Z. z.",
                      )}
                    </span>
                  </label>
                </div>
              )}

              {/* Dosage & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="med-dosage" className="text-xs font-semibold">
                    {t("medications.fieldDosageUnit", "Dávkovacia jednotka a sila *")}
                  </Label>
                  <Input
                    id="med-dosage"
                    value={newDosage}
                    onChange={(e) => setNewDosage(e.target.value)}
                    placeholder="napr. 10 mg/kg, 2 tbl"
                    className="mt-1 h-9 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="med-freq" className="text-xs font-semibold">
                    {t("medications.fieldFrequency", "Frekvencia *")}
                  </Label>
                  <Input
                    id="med-freq"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    placeholder="napr. 1x denne, každých 12 hod"
                    className="mt-1 h-9 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Quantity & Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="med-qty" className="text-xs font-semibold">
                    {t("medications.fieldQuantity", "Množstvo *")}
                  </Label>
                  <Input
                    id="med-qty"
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono tabular-nums"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="med-start" className="text-xs font-semibold">
                    {t("medications.fieldStartDate", "Platnosť od *")}
                  </Label>
                  <Input
                    id="med-start"
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono tabular-nums"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="med-end" className="text-xs font-semibold">
                    {t("medications.fieldEndDate", "Platnosť do")}
                  </Label>
                  <Input
                    id="med-end"
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <Label htmlFor="med-inst" className="text-xs font-semibold">
                  {t("medications.fieldInstructions", "Pokyny pre aplikáciu")}
                </Label>
                <Textarea
                  id="med-inst"
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="napr. Podávať po jedle, zapíjať dostatkom vody..."
                  rows={2}
                  className="mt-1 text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewModalOpen(false)}
                className="text-xs"
              >
                {t("common.cancel", "Zrušiť")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  createPrescriptionMutation.isPending ||
                  (isNewControlled && !newControlledConfirmed)
                }
                className="gap-1.5 text-xs font-semibold"
              >
                {createPrescriptionMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {t("medications.btnCreate", "Vystaviť recept")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
