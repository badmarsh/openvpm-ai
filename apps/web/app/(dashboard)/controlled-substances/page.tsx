"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ShieldAlert,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatUserRole } from "@/lib/users/role";
import { formatDateTime } from "@/lib/locale/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader, PageSectionHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONTROLLED_SUBSTANCE_DRUG_NAME_MAX_LENGTH,
  CONTROLLED_SUBSTANCE_LOT_NUMBER_MAX_LENGTH,
  CONTROLLED_SUBSTANCE_NOTES_MAX_LENGTH,
  CONTROLLED_SUBSTANCE_QUANTITY_MAX,
  CONTROLLED_SUBSTANCE_QUANTITY_MIN,
  CONTROLLED_SUBSTANCE_QUANTITY_STEP,
  CONTROLLED_SUBSTANCE_UNIT_MAX_LENGTH,
  isControlledSubstanceOptionalTextInputValid,
  isControlledSubstanceQuantityInputValid,
  isControlledSubstanceRequiredTextInputValid,
} from "@/lib/controlled-substances/policy";

const DEA_SCHEDULES = [
  { label: "Schedule II", value: "II" },
  { label: "Schedule III", value: "III" },
  { label: "Schedule IV", value: "IV" },
  { label: "Schedule V", value: "V" },
] as const;

const ACTIONS = [
  { label: "Received", value: "received" },
  { label: "Administered", value: "administered" },
  { label: "Wasted", value: "wasted" },
  { label: "Returned", value: "returned" },
] as const;

const UNITS = [
  { label: "mg", value: "mg" },
  { label: "ml", value: "ml" },
  { label: "tablet", value: "tablet" },
  { label: "capsule", value: "capsule" },
  { label: "vial", value: "vial" },
] as const;

/**
 * Chromatic movement taxonomy (Zákon 139/1998 Z. z.):
 * green = income (delivery note), violet/blue = issue (patient application /
 * prescription), red = destruction or expiry write-off.
 */
const MOVEMENT_BADGE_STYLES: Record<string, string> = {
  received:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  administered:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  returned: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  wasted: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

const MOVEMENT_KIND: Record<string, "income" | "issue" | "disposal"> = {
  received: "income",
  administered: "issue",
  returned: "issue",
  wasted: "disposal",
};

function sumReceivedAction(action: string): boolean {
  return action === "received";
}

function formatBalance(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(3);
}

function canManageControlledSubstancesRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

const trimmedOrUndefined = (value: string) => value.trim() || undefined;

function formatControlledSubstanceDateTime(
  date: Date | string,
  timeZone?: string | null,
  language?: string | null
) {
  return formatDateTime(date, { timeZone, language });
}

function InlineLookupError({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertTriangle className="h-3 w-3" />
      {message}
    </p>
  );
}

function LogEntryForm({ onClose, onRecorded }: { onClose: () => void; onRecorded?: (id: string) => void }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const createMutation = trpc.controlledSubstances.create.useMutation({
    onSuccess: (entry) => {
      onRecorded?.(entry.id);
      toast.success(t("controlledSubstances.logEntryRecorded", "Log entry recorded"));
      utils.controlledSubstances.list.invalidate();
      utils.controlledSubstances.summary.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const patientsQuery = trpc.patients.list.useQuery({
    limit: 100,
    offset: 0,
  });
  const witnessesQuery = trpc.controlledSubstances.listWitnesses.useQuery();

  const [form, setForm] = useState({
    drugName: "",
    deaSchedule: "II",
    action: "received",
    quantity: "",
    unit: "mg",
    patientId: "",
    witnessedBy: "",
    lotNumber: "",
    notes: "",
  });
  const patientsMissing =
    !patientsQuery.isLoading && !patientsQuery.error && !patientsQuery.data;
  const witnessesMissing =
    !witnessesQuery.isLoading && !witnessesQuery.error && !witnessesQuery.data;
  const patientOptions =
    patientsQuery.data && !patientsQuery.error && !patientsMissing
      ? patientsQuery.data.items
      : [];
  const witnessOptions =
    witnessesQuery.data && !witnessesQuery.error && !witnessesMissing
      ? witnessesQuery.data
      : [];
  const patientLookupUnavailable =
    form.action === "administered" &&
    (patientsQuery.isLoading ||
      Boolean(patientsQuery.error) ||
      patientsMissing);
  const witnessLookupUnavailable =
    (form.action === "wasted" || form.action === "administered") &&
    (witnessesQuery.isLoading ||
      Boolean(witnessesQuery.error) ||
      witnessesMissing);
  const canSubmit =
    isControlledSubstanceRequiredTextInputValid(
      form.drugName,
      CONTROLLED_SUBSTANCE_DRUG_NAME_MAX_LENGTH
    ) &&
    isControlledSubstanceQuantityInputValid(form.quantity) &&
    isControlledSubstanceRequiredTextInputValid(
      form.unit,
      CONTROLLED_SUBSTANCE_UNIT_MAX_LENGTH
    ) &&
    isControlledSubstanceOptionalTextInputValid(
      form.lotNumber,
      CONTROLLED_SUBSTANCE_LOT_NUMBER_MAX_LENGTH
    ) &&
    isControlledSubstanceOptionalTextInputValid(
      form.notes,
      CONTROLLED_SUBSTANCE_NOTES_MAX_LENGTH
    ) &&
    (form.action !== "administered" || Boolean(form.patientId)) &&
    (form.action !== "administered" || Boolean(form.witnessedBy)) &&
    (form.action !== "wasted" || Boolean(form.witnessedBy)) &&
    !patientLookupUnavailable &&
    !witnessLookupUnavailable &&
    !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (patientLookupUnavailable) {
      toast.error(
        patientsQuery.error?.message ??
          (patientsMissing
            ? t(
                "controlledSubstances.errors.patientUnavailable",
                "Patient lookup is unavailable. Please retry.",
              )
            : "Patient lookup is still loading")
      );
      return;
    }
    if (witnessLookupUnavailable) {
      toast.error(
        witnessesQuery.error?.message ??
          (witnessesMissing
            ? t(
                "controlledSubstances.errors.witnessUnavailable",
                "Witness lookup is unavailable. Please retry.",
              )
            : "Witness lookup is still loading")
      );
      return;
    }
    if (form.action === "administered" && !form.patientId) {
      toast.error(
        t(
          "controlledSubstances.errors.patientRequired",
          "Patient is required for administered entries",
        )
      );
      return;
    }
    if ((form.action === "wasted" || form.action === "administered") && !form.witnessedBy) {
      toast.error(
        t(
          "controlledSubstances.errors.witnessRequired",
          "Witness is required for wasted entries",
        )
      );
      return;
    }
    createMutation.mutate({
      drugName: form.drugName.trim(),
      deaSchedule: form.deaSchedule as "II" | "III" | "IV" | "V",
      action: form.action as "received" | "administered" | "wasted" | "returned",
      quantity: form.quantity.trim(),
      unit: form.unit.trim(),
      patientId: form.patientId || undefined,
      witnessedBy: form.witnessedBy || undefined,
      lotNumber: trimmedOrUndefined(form.lotNumber),
      notes: trimmedOrUndefined(form.notes),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-heading text-base font-semibold">
        {t("controlledSubstances.newLogEntry", "New Log Entry")}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.drugNameRequired", "Drug Name *")}
          </label>
          <Input
            placeholder={t("controlledSubstances.drugNamePlaceholder", "Drug name")}
            value={form.drugName}
            maxLength={CONTROLLED_SUBSTANCE_DRUG_NAME_MAX_LENGTH}
            onChange={(e) => setForm({ ...form, drugName: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.deaSchedule", "DEA Schedule")}
          </label>
          <select
            value={form.deaSchedule}
            onChange={(e) => setForm({ ...form, deaSchedule: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEA_SCHEDULES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(`controlledSubstances.schedules.schedule${s.value}`, s.label)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.action", "Action")}
          </label>
          <select
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {t(`controlledSubstances.actions.${a.value}`, a.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("controlledSubstances.quantityRequired", "Quantity *")}
            </label>
            <Input
              type="number"
              step={CONTROLLED_SUBSTANCE_QUANTITY_STEP}
              min={CONTROLLED_SUBSTANCE_QUANTITY_MIN}
              max={CONTROLLED_SUBSTANCE_QUANTITY_MAX}
              placeholder={t("controlledSubstances.qtyPlaceholder", "Qty")}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("controlledSubstances.unit", "Unit")}
            </label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {t(`controlledSubstances.units.${u.value}`, u.label)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.patient", "Patient")} {form.action === "administered" && "*"}
          </label>
          <select
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            required={form.action === "administered"}
            disabled={
              patientsQuery.isLoading ||
              Boolean(patientsQuery.error) ||
              patientsMissing
            }
            className={[
              "flex h-10 w-full rounded-md border border-input bg-background",
              "px-3 py-2 text-sm",
            ].join(" ")}
          >
            <option value="">
              {patientsQuery.error || patientsMissing
                ? t("controlledSubstances.errors.unableToLoadPatients", "Unable to load patients")
                : patientsQuery.isLoading
                  ? t("controlledSubstances.errors.patientLoading", "Loading patients...")
                  : t("controlledSubstances.errors.noPatient", "No patient")}
            </option>
            {patientOptions.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
                {patient.clientFirstName || patient.clientLastName
                  ? ` (${[patient.clientFirstName, patient.clientLastName]
                      .filter(Boolean)
                      .join(" ")})`
                  : ""}
              </option>
            ))}
          </select>
          {patientsQuery.error || patientsMissing ? (
            <InlineLookupError
              message={
                patientsQuery.error?.message ??
                t(
                  "controlledSubstances.errors.patientLookupNoData",
                  "Patient lookup returned no data. Please retry before recording an administered dose.",
                )
              }
            />
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.witness", "Witness")}{" "}
            {(form.action === "wasted" || form.action === "administered") && "*"}
          </label>
          <select
            value={form.witnessedBy}
            onChange={(e) => setForm({ ...form, witnessedBy: e.target.value })}
            required={form.action === "wasted" || form.action === "administered"}
            disabled={
              witnessesQuery.isLoading ||
              Boolean(witnessesQuery.error) ||
              witnessesMissing
            }
            className={[
              "flex h-10 w-full rounded-md border border-input bg-background",
              "px-3 py-2 text-sm",
            ].join(" ")}
          >
            <option value="">
              {witnessesQuery.error || witnessesMissing
                ? t("controlledSubstances.errors.unableToLoadWitnesses", "Unable to load witnesses")
                : witnessesQuery.isLoading
                  ? t("controlledSubstances.errors.witnessLoading", "Loading witnesses...")
                  : t("controlledSubstances.errors.noWitness", "No witness")}
            </option>
            {witnessOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({formatUserRole(user.role, t)})
              </option>
            ))}
          </select>
          {witnessesQuery.error || witnessesMissing ? (
            <InlineLookupError
              message={
                witnessesQuery.error?.message ??
                t(
                  "controlledSubstances.errors.witnessLookupNoData",
                  "Witness lookup returned no data. Please retry before recording wasted inventory.",
                )
              }
            />
          ) : null}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.lotNumber", "Lot Number")}
          </label>
          <Input
            placeholder={t("controlledSubstances.lotPlaceholder", "Lot #")}
            value={form.lotNumber}
            maxLength={CONTROLLED_SUBSTANCE_LOT_NUMBER_MAX_LENGTH}
            onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t("controlledSubstances.notes", "Notes")}
          </label>
          <Input
            placeholder={t("controlledSubstances.notesPlaceholder", "Optional notes")}
            value={form.notes}
            maxLength={CONTROLLED_SUBSTANCE_NOTES_MAX_LENGTH}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {createMutation.isPending
            ? t("controlledSubstances.submitting", "Submitting...")
            : t("controlledSubstances.submitEntry", "Submit Entry")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("controlledSubstances.cancel", "Cancel")}
        </Button>
      </div>
      {createMutation.error && (
        <p className="text-sm text-destructive">
          {createMutation.error.message}
        </p>
      )}
    </form>
  );
}

function SummarySection() {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = trpc.controlledSubstances.summary.useQuery({});
  const summaryMissing = !isLoading && !error && !data;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        <span>{t("controlledSubstances.summary.title", "Drug Balance Summary")}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {error || summaryMissing ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error?.message ??
                t(
                  "controlledSubstances.errors.loadBalancesError",
                  "Unable to load controlled-substance balances. Please retry.",
                )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("controlledSubstances.summary.loading", "Loading summary...")}
            </div>
          ) : data && data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    {t("controlledSubstances.summary.columns.drug", "Drug")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.summary.columns.received", "Received")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.summary.columns.administered", "Administered")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.summary.columns.wasted", "Wasted")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.summary.columns.returned", "Returned")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.summary.columns.netBalance", "Net Balance")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((drug) => (
                  <TableRow key={`${drug.drugName}-${drug.unit}`}>
                    <TableCell className="px-3 py-2.5 font-medium">
                      {drug.drugName}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {t(`controlledSubstances.units.${drug.unit}`, drug.unit)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-600">
                      {drug.totalReceived}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-violet-600">
                      {drug.totalAdministered}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-red-600">
                      {drug.totalWasted}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-blue-600">
                      {drug.totalReturned}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {formatBalance(
                        Number(drug.totalReceived) -
                          Number(drug.totalAdministered) -
                          Number(drug.totalWasted) -
                          Number(drug.totalReturned),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-6"
              icon={ShieldAlert}
              title={t("controlledSubstances.summary.noDataTitle", "No balance data yet")}
              description={t(
                "controlledSubstances.summary.noDataDesc",
                "Balance totals will appear once controlled-substance entries are logged.",
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Source references and blank manual form are deliberately separate (zero AI prefill). */
function PendingImportReviews() {
  const { t } = useI18n();
  const reviews = trpc.extensions.wholesalerImport.pendingControlledReviews.useQuery();
  const [selected, setSelected] = useState<{ receiptId: string; line: number } | null>(null);
  const [entryId, setEntryId] = useState("");
  const link = trpc.extensions.wholesalerImport.linkControlledReview.useMutation({
    onSuccess: () => { setSelected(null); setEntryId(""); void reviews.refetch(); },
    onError: () => toast.error(t("inventory.wholesalerImport.reviewLinkError")),
  });
  return <section className="mt-4 space-y-2 rounded-md border border-purple-500/30 p-3">
    <h2 className="text-sm font-semibold">{t("inventory.wholesalerImport.pendingTitle")}</h2>
    <p className="text-xs text-muted-foreground">{t("inventory.wholesalerImport.manualOnly")}</p>
    {reviews.error && <p role="alert">{t("inventory.wholesalerImport.reviewLoadError")}</p>}
    {reviews.data?.flatMap(receipt => receipt.controlledReview.filter(row => !row.ledgerId).map(row =>
      <div key={receipt.id + row.line} className="flex flex-wrap items-center gap-2 text-sm">
        <span>{receipt.supplierName} · {receipt.deliveryNoteNumber} · {row.name}</span>
        <Button size="sm" variant="outline" onClick={() => { setEntryId(""); setSelected({ receiptId: receipt.id, line: row.line }); }}>
          {t("inventory.wholesalerImport.manualEntry")}
        </Button>
      </div>
    ))}
    {selected && <>
      {!entryId && <LogEntryForm key={selected.receiptId + selected.line} onClose={() => setSelected(null)} onRecorded={id => setEntryId(id)} />}
      <label className="block text-xs">{t("inventory.wholesalerImport.reviewEntryId")}
        <Input value={entryId} onChange={e => setEntryId(e.target.value)} />
      </label>
      <Button disabled={!entryId || link.isPending} onClick={() => link.mutate({ ...selected, entryId })}>{t("inventory.wholesalerImport.linkManualEntry")}</Button>
      <Button variant="ghost" onClick={() => setSelected(null)}>{t("common.cancel")}</Button>
    </>}
  </section>;
}

export default function ControlledSubstancesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("controlledSubstances.checkingAccess", "Checking controlled-substance access...")}
        </div>
      </div>
    );
  }

  if (!canManageControlledSubstancesRole(session?.user?.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("controlledSubstances.restrictedTitle", "Controlled substance log is restricted")}
        description={t(
          "controlledSubstances.restrictedDesc",
          "Only administrators and veterinarians can view or record controlled-substance activity.",
        )}
        action={{
          label: t("controlledSubstances.backToDashboard", "Back to dashboard"),
          onClick: () => router.push("/"),
        }}
      />
    );
  }

  return <ControlledSubstancesLogPage />;
}

function ControlledSubstancesLogPage() {
  const { t, locale } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const searchFilter = search.trim();
  const settingsQuery = trpc.controlledSubstances.settings.useQuery();

  const { data, isLoading, error } = trpc.controlledSubstances.list.useQuery({
    drugName: searchFilter || undefined,
    limit,
    offset,
  });
  /**
   * Zákon 139/1998 Z. z. requires a running stock figure next to every
   * movement, so the ledger is joined with the per-drug balance summary.
   */
  const { data: balances } = trpc.controlledSubstances.summary.useQuery({});
  const balanceByDrug = new Map(
    (balances ?? []).map((row) => [
      row.drugName,
      Number(row.totalReceived) -
        Number(row.totalAdministered) -
        Number(row.totalWasted) -
        Number(row.totalReturned),
    ]),
  );
  const logError = settingsQuery.error ?? error;
  const isLogLoading = settingsQuery.isLoading || isLoading;
  const settingsMissing =
    !settingsQuery.isLoading && !settingsQuery.error && !settingsQuery.data;
  const logMissing = !isLoading && !error && !data;
  const controlledSubstanceLogMissing = settingsMissing || logMissing;
  const verifiedLogPayload =
    !logError &&
    !isLogLoading &&
    !controlledSubstanceLogMissing &&
    settingsQuery.data &&
    data
      ? { settings: settingsQuery.data, log: data }
      : null;
  const canRecordControlledSubstance = Boolean(verifiedLogPayload);

  useEffect(() => {
    if (!canRecordControlledSubstance && showForm) {
      setShowForm(false);
    }
  }, [canRecordControlledSubstance, showForm]);

  return (
    <div>
      <PageHeader
        title={t("controlledSubstances.title", "Kniha omamných látok (OPK)")}
        subtitle={t(
          "controlledSubstances.subtitle",
          "Evidencia pohybu omamných a psychotropných látok podľa zákona č. 139/1998 Z. z.",
        )}
        actions={
          <Button
            disabled={!canRecordControlledSubstance}
            onClick={() => {
              if (!canRecordControlledSubstance) return;
              setShowForm(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t("controlledSubstances.logEntry", "Zaznamenať pohyb")}
          </Button>
        }
      />

      {canRecordControlledSubstance && showForm && (
        <LogEntryForm onClose={() => setShowForm(false)} />
      )}

      {canRecordControlledSubstance && <PendingImportReviews />}

      {/* Summary Section */}
      <div className="mt-6">
        <SummarySection />
      </div>

      {/* Ledger toolbar */}
      <div className="mt-6 space-y-3">
        <PageSectionHeader
          title={t("controlledSubstances.ledger.title", "Kniha pohybov omamných látok")}
          subtitle={t(
            "controlledSubstances.ledger.subtitle",
            "Každý príjem, výdaj, likvidácia exspirácie a kontrola zostatku sa eviduje nezmazateľne v poradí podľa dátumu.",
          )}
        />
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("controlledSubstances.filterPlaceholder", "Filter by drug name...")}
              value={search}
              maxLength={CONTROLLED_SUBSTANCE_DRUG_NAME_MAX_LENGTH}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="h-9 pl-9"
            />
          </div>
        </div>
      </div>

      {logError || controlledSubstanceLogMissing ? (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {logError?.message ??
            t(
              "controlledSubstances.errors.loadEntriesError",
              "Unable to load controlled-substance entries. Please retry.",
            )}
        </div>
      ) : isLogLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("controlledSubstances.loadingEntries", "Loading controlled-substance entries...")}
        </div>
      ) : !verifiedLogPayload ? (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {t(
            "controlledSubstances.errors.loadEntriesError",
            "Unable to load controlled-substance entries. Please retry.",
          )}
        </div>
      ) : verifiedLogPayload.log.items.length > 0 ? (
        <>
          <div className="mt-4 rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    {t("controlledSubstances.table.dateTime", "Date & time")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.drugName", "Drug name")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.schedule", "Schedule")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.action", "Movement type")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.table.received", "Received")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.table.issued", "Issued")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("controlledSubstances.table.balance", "Balance")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.patient", "Patient")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.performedBy", "Veterinarian")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.witness", "Witness")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.lotNumber", "Batch (lot)")}
                  </TableHead>
                  <TableHead>
                    {t("controlledSubstances.table.notes", "Notes")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedLogPayload.log.items.map((entry) => {
                  const movementKind =
                    MOVEMENT_KIND[entry.action] ?? "issue";
                  const balance = balanceByDrug.get(entry.drugName);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {entry.performedAt
                          ? formatControlledSubstanceDateTime(
                              entry.performedAt,
                              verifiedLogPayload.settings.timezone,
                              locale
                            )
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-medium">
                        {entry.drugName}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                        {entry.deaSchedule}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={`h-5 px-2 text-[11px] font-medium ${
                              MOVEMENT_BADGE_STYLES[entry.action] ??
                              "border-border bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {t(`controlledSubstances.actions.${entry.action}`, entry.action)}
                          </Badge>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                            {t(
                              `controlledSubstances.movementKinds.${movementKind}`,
                              movementKind,
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {sumReceivedAction(entry.action) ? entry.quantity : "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {sumReceivedAction(entry.action) ? "\u2014" : entry.quantity}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {balance === undefined ? (
                          "\u2014"
                        ) : (
                          <span
                            className={
                              balance <= 0 ? "text-red-600" : "font-medium"
                            }
                          >
                            {formatBalance(balance)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground">
                        {entry.patientName || "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground">
                        {entry.performerName || "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground">
                        {entry.witnessName || "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {entry.lotNumber || "\u2014"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 max-w-[220px] truncate text-muted-foreground">
                        {entry.notes || "\u2014"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <p>
              {t(
                "controlledSubstances.pagination.showing",
                `Showing ${offset + 1}–${Math.min(offset + limit, verifiedLogPayload.log.total)} of ${verifiedLogPayload.log.total}`,
                {
                  start: offset + 1,
                  end: Math.min(offset + limit, verifiedLogPayload.log.total),
                  total: verifiedLogPayload.log.total,
                }
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                {t("controlledSubstances.pagination.previous", "Previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= verifiedLogPayload.log.total}
                onClick={() => setOffset(offset + limit)}
              >
                {t("controlledSubstances.pagination.next", "Next")}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={ShieldAlert}
          title={
            search
              ? t("controlledSubstances.empty.filterTitle", "No entries match your filter")
              : t("controlledSubstances.empty.noEntriesTitle", "No controlled substance entries yet")
          }
          description={
            search
              ? t("controlledSubstances.empty.filterDesc", "Try a different drug name or clear the filter.")
              : t(
                  "controlledSubstances.empty.noEntriesDesc",
                  "Record each received, administered, wasted, or returned scheduled-drug event here.",
                )
          }
          action={
            search
              ? undefined
              : {
                  label: t(
                    "controlledSubstances.empty.logFirst",
                    "Zaznamenať príjem omamnej látky",
                  ),
                  onClick: () => {
                    if (!canRecordControlledSubstance) return;
                    setShowForm(true);
                  },
                  icon: Plus,
                }
          }
        />
      )}
    </div>
  );
}
