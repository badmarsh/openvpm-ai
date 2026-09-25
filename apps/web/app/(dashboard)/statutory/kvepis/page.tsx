"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  FileSignature,
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Landmark,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IntegrationModeBanner } from "@/components/common/integration-mode-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/empty-state";
import {
  PageHeader,
  PageSectionHeader,
} from "@/components/layout/page-header";
import {
  DataTableFrame,
  PageToolbar,
  filterControlClass,
  pageShellClass,
} from "@/components/layout/page-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/locale/format";
import { toast } from "sonner";

const STATUS_BADGE: Record<
  string,
  { labelKey: string; labelFallback: string; className: string }
> = {
  DRAFT: {
    labelKey: "statutory.kvepis.statusDraft",
    labelFallback: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  VALIDATED: {
    labelKey: "statutory.kvepis.statusValidated",
    labelFallback: "Validated",
    className: "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300",
  },
  SIGNED: {
    labelKey: "statutory.kvepis.statusSigned",
    labelFallback: "Signed",
    className: "bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300",
  },
  SUBMITTED: {
    labelKey: "statutory.kvepis.statusSubmitted",
    labelFallback: "Submitted",
    className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  },
  ACKNOWLEDGED: {
    labelKey: "statutory.kvepis.statusAcknowledged",
    labelFallback: "Receipt received",
    className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  REJECTED: {
    labelKey: "statutory.kvepis.statusRejected",
    labelFallback: "Rejected",
    className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300",
  },
};

const SUBMISSION_TYPE_LABEL: Record<
  string,
  { labelKey: string; labelFallback: string }
> = {
  rabies_notification: {
    labelKey: "statutory.kvepis.typeRabies",
    labelFallback: "Rabies — notification",
  },
  treatment_diary_batch: {
    labelKey: "statutory.kvepis.typeTreatment",
    labelFallback: "Outpatient treatment book",
  },
  animal_movement: {
    labelKey: "statutory.kvepis.typeMovement",
    labelFallback: "Animal movement",
  },
  infectious_disease_alert: {
    labelKey: "statutory.kvepis.typeInfectious",
    labelFallback: "Infectious disease notification",
  },
};

function submissionTypeLabel(
  t: (key: string, fallback?: string) => string,
  value: string
): string {
  const entry = SUBMISSION_TYPE_LABEL[value];
  return entry ? t(entry.labelKey, entry.labelFallback) : value;
}

function downloadTextFile(filename: string, content: string, mime = "text/xml") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSubmittedAt(
  val: Date | string | null | undefined,
  language: string,
): string {
  return formatDateTime(val, { language });
}

// ---------------------------------------------------------------------------
// Microchip / transponder display validation (ISO 11784/11785)
// ---------------------------------------------------------------------------

const TRANSPONDER_LENGTH = 15;
const SLOVAK_PREFIX = "703";

/** Luhn mod-10 checksum over the full 15-digit ISO transponder number. */
function luhnChecksumValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

type TransponderCheck = {
  state: "empty" | "invalidLength" | "invalidLuhn" | "valid";
  slovak: boolean;
};

/**
 * Client-side display check for the 15-digit ISO microchip format:
 * digit count, Luhn checksum and the Slovak national code prefix (703).
 * The server-side validator (lib/kvepis/validator) remains the source of truth.
 */
function transponderCheck(value: string): TransponderCheck {
  const v = value.trim();
  if (!v) return { state: "empty", slovak: false };
  const slovak = v.startsWith(SLOVAK_PREFIX);
  if (!/^\d+$/.test(v) || v.length !== TRANSPONDER_LENGTH) {
    return { state: "invalidLength", slovak };
  }
  if (!luhnChecksumValid(v)) return { state: "invalidLuhn", slovak };
  return { state: "valid", slovak };
}

/**
 * Lifecycle buckets matching the register's operator-facing view:
 * awaiting (DRAFT/VALIDATED/SIGNED) → sent (SUBMITTED/ACKNOWLEDGED) → error (REJECTED).
 */
const SEND_STATE_BUCKETS: Record<string, string[]> = {
  sent: ["SUBMITTED", "ACKNOWLEDGED"],
  awaiting: ["DRAFT", "VALIDATED", "SIGNED"],
  error: ["REJECTED"],
};

type SendStateFilter = "sent" | "awaiting" | "error" | undefined;

/** Operator-facing send-state badge (sent / awaiting / error). */
function sendStateBadge(
  t: (key: string, fallback?: string) => string,
  status: string,
) {
  if (SEND_STATE_BUCKETS.sent.includes(status)) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3" />
        {t("statutory.kvepis.sendStateSent", "Odoslané")}
      </Badge>
    );
  }
  if (SEND_STATE_BUCKETS.awaiting.includes(status)) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        <Clock className="h-3 w-3" />
        {t("statutory.kvepis.sendStateAwaiting", "Čaká na export")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
    >
      <AlertTriangle className="h-3 w-3" />
      {t("statutory.kvepis.sendStateError", "Chyba")}
    </Badge>
  );
}

export default function KvepisPage() {
  const { t, locale } = useI18n();
  const newSubmissionRef = useRef<HTMLDivElement>(null);
  const [newType, setNewType] = useState<string>("rabies_notification");
  const [form, setForm] = useState({
    farmIco: "",
    cehzCode: "",
    earTagNumber: "",
    transponderNumber: "",
    kvlNumber: "",
    animalSpecies: "",
    diagnosis: "",
    medicationName: "",
    meatWithdrawalDays: "",
    milkWithdrawalDays: "",
    administeredAt: "",
    safeUntil: "",
    incidentDate: "",
    notes: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credIco, setCredIco] = useState("");
  const [credKvl, setCredKvl] = useState("");
  const [credSchranka, setCredSchranka] = useState("");
  const [signMethod, setSignMethod] = useState<"DSIGNER" | "CLOUD_SEAL" | "HSM">("DSIGNER");
  const [sendState, setSendState] = useState<SendStateFilter>(undefined);

  /** Per-row action in flight (validate / xml / sign / submit / receipt) —
   *  drives the loading indicators on the batch action buttons. */
  type PendingAction = "validate" | "xml" | "sign" | "submit" | "receipt";
  const [pendingIds, setPendingIds] = useState<Record<string, PendingAction>>({});
  const withPending = (id: string, action: PendingAction) => ({
    onMutate: () => setPendingIds((p) => ({ ...p, [id]: action })),
    onSettled: () =>
      setPendingIds((p) => {
        if (!(id in p)) return p;
        const next = { ...p };
        delete next[id];
        return next;
      }),
  });

  const utils = trpc.useUtils();
  const {
    data: submissions,
    isLoading,
    isFetching,
    refetch,
  } = trpc.extensions.kvepis.listSubmissions.useQuery({ limit: 100 });
  const { data: credentials } = trpc.extensions.kvepis.getCredentials.useQuery();

  /** Send-state narrowing happens client-side (the list endpoint filters on a
   *  single lifecycle status, while the toolbar needs the three operator buckets). */
  const filtered = useMemo(() => {
    const items = submissions?.items ?? [];
    if (!sendState) return items;
    return items.filter((s) => SEND_STATE_BUCKETS[sendState]?.includes(s.status));
  }, [submissions?.items, sendState]);

  const createMutation = trpc.extensions.kvepis.createSubmission.useMutation({
    onSuccess: (row) => {
      utils.extensions.kvepis.listSubmissions.invalidate();
      setSelectedId(row.id);
      validateMutation.mutate({ submissionId: row.id });
    },
  });
  const validateMutation = trpc.extensions.kvepis.validateAndBuild.useMutation({
    onSuccess: () => utils.extensions.kvepis.listSubmissions.invalidate(),
  });
  const signMutation = trpc.extensions.kvepis.signSubmission.useMutation({
    onSuccess: () => utils.extensions.kvepis.listSubmissions.invalidate(),
  });
  const submitMutation = trpc.extensions.kvepis.submitSubmission.useMutation({
    onSuccess: () => utils.extensions.kvepis.listSubmissions.invalidate(),
  });
  const receiptMutation = trpc.extensions.kvepis.uploadReceipt.useMutation({
    onSuccess: () => utils.extensions.kvepis.listSubmissions.invalidate(),
  });
  const upsertCreds = trpc.extensions.kvepis.upsertCredentials.useMutation({
    onSuccess: () => utils.extensions.kvepis.getCredentials.invalidate(),
  });

  const [validation, setValidation] = useState<{
    valid: boolean;
    issues: Array<{ field: string; severity: string; code: string; message: string }>;
  } | null>(null);

  const handleCreate = () => {
    createMutation.mutate({
      submissionType: newType as never,
      farmIco: form.farmIco || undefined,
      cehzCode: form.cehzCode || undefined,
      earTagNumber: form.earTagNumber || undefined,
      transponderNumber: form.transponderNumber || undefined,
      kvlNumber: form.kvlNumber || undefined,
      animalSpecies: form.animalSpecies || undefined,
      diagnosis: form.diagnosis || undefined,
      medicationName: form.medicationName || undefined,
      meatWithdrawalDays: form.meatWithdrawalDays
        ? Number(form.meatWithdrawalDays)
        : undefined,
      milkWithdrawalDays: form.milkWithdrawalDays
        ? Number(form.milkWithdrawalDays)
        : undefined,
      administeredAt: form.administeredAt || undefined,
      safeUntil: form.safeUntil || undefined,
      incidentDate: form.incidentDate || undefined,
      notes: form.notes || undefined,
    });
  };

  const handleValidate = (id: string) => {
    validateMutation.mutate(
      { submissionId: id },
      {
        onSuccess: (res) => {
          setValidation(res as never);
        },
        ...withPending(id, "validate"),
      }
    );
  };

  const handleDownloadXml = (id: string) => {
    const target = submissions?.items.find((s) => s.id === id);
    if (!target) return;
    validateMutation.mutate(
      { submissionId: id },
      {
        onSuccess: (res) => {
          setValidation(res as never);
          if (res.valid && res.payload) {
            downloadTextFile(`${target.referenceNumber}.xml`, res.payload.xml);
          }
        },
        ...withPending(id, "xml"),
      }
    );
  };

  const handleReceiptFile = async (id: string, file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      receiptMutation.mutate(
        { submissionId: id, receiptPayload: payload },
        withPending(id, "receipt")
      );
    } catch {
      toast.error(
        t(
          "statutory.kvepis.receiptInvalidJson",
          "The receipt must be a valid JSON file from ÚPVS."
        )
      );
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Live 15-digit ISO 11784 display check for the transponder input. */
  const chip = transponderCheck(form.transponderNumber);

  return (
    <div className={cn(pageShellClass, "mx-auto max-w-6xl")}>
      <Link
        href="/statutory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t("statutory.title", "Zákonné registre")}
      </Link>

      <PageHeader
        icon={Landmark}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{t("statutory.kvepis.hubTitle", "KVEPIS Submission Hub")}</span>
            <IntegrationModeBanner module="kvepis" size="sm" />
          </span>
        }
        subtitle={t(
          "statutory.kvepis.hubSubtitle",
          "Riadená príprava zákonných hlásení pre ŠVPS SR cez ÚPVS. Validácia schém, generovanie podpisového XML/JSON balíčka a párovanie doručenky so záznamom pacienta.",
        )}
      />

      {/* ── Prístup kliniky ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("statutory.kvepis.credTitle", "Practice access (IČO · KVL · ÚPVS)")}
          </CardTitle>
          <CardDescription>
            {credentials
              ? [
                  t("statutory.kvepis.credConfiguredIco", "Configured: IČO {ico}", {
                    ico: credentials.ico,
                  }),
                  credentials.kvlId
                    ? t("statutory.kvepis.credKvlShort", "KVL {kvl}", {
                        kvl: credentials.kvlId,
                      })
                    : null,
                  credentials.upvsSchranka
                    ? t("statutory.kvepis.credMailbox", "Mailbox {box}", {
                        box: credentials.upvsSchranka,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t(
                  "statutory.kvepis.credHint",
                  "Enter the practice identification data required to generate submissions."
                )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-1">
            <Label>{t("statutory.kvepis.credIco", "Company ID (IČO)")}</Label>
            <Input value={credIco} onChange={(e) => setCredIco(e.target.value)} placeholder="12345678" maxLength={8} />
          </div>
          <div className="space-y-1">
            <Label>{t("statutory.kvepis.credKvl", "Vet KVL ID")}</Label>
            <Input value={credKvl} onChange={(e) => setCredKvl(e.target.value)} placeholder="LV-0001" />
          </div>
          <div className="space-y-1">
            <Label>{t("statutory.kvepis.credSchranka", "ÚPVS mailbox")}</Label>
            <Input value={credSchranka} onChange={(e) => setCredSchranka(e.target.value)} placeholder="ICO/12345678" />
          </div>
          <div className="space-y-1">
            <Label>{t("statutory.kvepis.credSignMethod", "Signature method (QES)")}</Label>
            <select
              className={cn(filterControlClass, "w-full")}
              value={signMethod}
              onChange={(e) => setSignMethod(e.target.value as never)}
            >
              <option value="DSIGNER">
                {t("statutory.kvepis.signDsigner", "D.Signer / Disig (eID reader)")}
              </option>
              <option value="CLOUD_SEAL">
                {t("statutory.kvepis.signCloudSeal", "Practice cloud seal")}
              </option>
              <option value="HSM">{t("statutory.kvepis.signHsm", "HSM module")}</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() =>
                upsertCreds.mutate({
                  ico: credIco,
                  kvlId: credKvl || undefined,
                  upvsSchranka: credSchranka || undefined,
                  signingPreference: signMethod,
                })
              }
              disabled={credIco.length !== 8}
              className="w-full gap-2"
            >
              <FileSignature className="h-4 w-4" />
              {t("statutory.kvepis.credSave", "Save access")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Nové podanie ────────────────────────────────────────────── */}
      <div ref={newSubmissionRef} id="nove-podanie" className="scroll-mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("statutory.kvepis.newTitle", "New submission")}
          </CardTitle>
          <CardDescription>
            {t(
              "statutory.kvepis.newDesc",
              "The submission type determines the required fields of the ŠVPS SR validation engine."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label>{t("statutory.kvepis.fieldType", "Submission type")}</Label>
              <select
                className={cn(filterControlClass, "w-full")}
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                {Object.keys(SUBMISSION_TYPE_LABEL).map((value) => (
                  <option key={value} value={value}>
                    {submissionTypeLabel(t, value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldFarmIco", "Farm IČO")}</Label>
              <Input value={form.farmIco} onChange={set("farmIco")} placeholder="12345678" maxLength={8} />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldCehz", "CEHZ herd code")}</Label>
              <Input value={form.cehzCode} onChange={set("cehzCode")} placeholder="SK1234567" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldEarTag", "Ear tag number")}</Label>
              <Input value={form.earTagNumber} onChange={set("earTagNumber")} placeholder="SK000123456789" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldTransponder", "Transponder / chip")}</Label>
              <Input
                value={form.transponderNumber}
                onChange={set("transponderNumber")}
                placeholder={t("statutory.kvepis.phTransponder", "15 digits per ISO 11784")}
                maxLength={15}
                inputMode="numeric"
                aria-invalid={
                  chip.state === "invalidLength" ||
                  chip.state === "invalidLuhn"
                    ? true
                    : undefined
                }
              />
              {chip.state === "invalidLength" ? (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {t("statutory.kvepis.chipLength", "The transponder must be exactly 15 digits (ISO 11784).")}
                </p>
              ) : chip.state === "invalidLuhn" ? (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {t("statutory.kvepis.chipLuhn", "Luhn checksum does not match – verify the transponder number.")}
                </p>
              ) : chip.state === "valid" ? (
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {t("statutory.kvepis.chipOk", "Valid 15-digit ISO 11784 transponder.")}
                  {chip.slovak
                    ? ` ${t("statutory.kvepis.chipSlovakPrefix", "Slovak national code prefix 703.")}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldKvl", "Vet KVL number")}</Label>
              <Input value={form.kvlNumber} onChange={set("kvlNumber")} placeholder="LV-0001" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldSpecies", "Animal species")}</Label>
              <Input value={form.animalSpecies} onChange={set("animalSpecies")} placeholder={t("statutory.kvepis.phSpecies", "cattle / dog")} />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldDiagnosis", "Diagnosis")}</Label>
              <Input value={form.diagnosis} onChange={set("diagnosis")} placeholder="Bronchopneumónia" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldMedication", "Medication name")}</Label>
              <Input value={form.medicationName} onChange={set("medicationName")} placeholder="Cobactan 2.5%" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldMeatWithdrawal", "Withdrawal period — meat (days)")}</Label>
              <Input type="number" min={0} value={form.meatWithdrawalDays} onChange={set("meatWithdrawalDays")} placeholder="5" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldMilkWithdrawal", "Withdrawal period — milk (days)")}</Label>
              <Input type="number" min={0} value={form.milkWithdrawalDays} onChange={set("milkWithdrawalDays")} placeholder="1" />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldAdministeredAt", "Administration date")}</Label>
              <Input type="datetime-local" value={form.administeredAt} onChange={set("administeredAt")} />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldSafeUntil", "End of withdrawal period")}</Label>
              <Input type="datetime-local" value={form.safeUntil} onChange={set("safeUntil")} />
            </div>
            <div className="space-y-1">
              <Label>{t("statutory.kvepis.fieldIncidentDate", "Incident date (rabies)")}</Label>
              <Input type="datetime-local" value={form.incidentDate} onChange={set("incidentDate")} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("statutory.kvepis.createBtn", "Vytvoriť podanie")}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* ── Zoznam podaní ───────────────────────────────────────────── */}
      <PageSectionHeader
        title={t("statutory.kvepis.listTitle", "Prepared submissions")}
        subtitle={t("statutory.kvepis.listDesc", "Outpatient book → KVEPIS / ÚPVS.")}
      />

      <PageToolbar className="sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: undefined, label: t("statutory.kvepis.sendStateAll", "Všetky stavy") },
              { id: "sent", label: t("statutory.kvepis.sendStateSent", "Odoslané") },
              { id: "awaiting", label: t("statutory.kvepis.sendStateAwaiting", "Čaká na export") },
              { id: "error", label: t("statutory.kvepis.sendStateError", "Chyba") },
            ] as { id: SendStateFilter; label: string }[]
          ).map((f) => (
            <Button
              key={f.id ?? "all"}
              variant={sendState === f.id ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setSendState(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("statutory.kvepis.listCount", "{count} submissions", {
              count: submissions?.items.length ?? 0,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("statutory.kvepis.listRefresh", "Refresh")}
          </Button>
        </div>
      </PageToolbar>

      <DataTableFrame>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">
              {t("statutory.kvepis.loading", "Načítavam KVEPIS podania...")}
            </span>
          </div>
        ) : !filtered.length ? (
          <EmptyState
            icon={Landmark}
            title={t("statutory.kvepis.emptyTitle", "Žiadne KVEPIS podania")}
            description={t(
              "statutory.kvepis.emptyDesc",
              "Neevidujete žiadne čakajúce ani odoslané podania na ŠVPS SR pre zvolený filter.",
            )}
            action={{
              label: t("statutory.kvepis.emptyCta", "Vytvoriť export KVEPIS"),
              onClick: () =>
                newSubmissionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              icon: Plus,
            }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("statutory.kvepis.colRef", "Ref. číslo")}</TableHead>
                <TableHead>{t("statutory.kvepis.colType", "Typ podania")}</TableHead>
                <TableHead>{t("statutory.kvepis.colPatient", "Pacient & Majiteľ")}</TableHead>
                <TableHead>{t("statutory.kvepis.colSendState", "Stav odoslania")}</TableHead>
                <TableHead>{t("statutory.kvepis.colStatus", "Stav")}</TableHead>
                <TableHead>{t("statutory.kvepis.colReportDate", "Dátum hlásenia")}</TableHead>
                <TableHead className="text-right">{t("statutory.kvepis.colActions", "Akcie")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.DRAFT;
                const isSelected = s.id === selectedId;
                const pending = pendingIds[s.id];
                const failed = s.status === "REJECTED" || Boolean(s.errorCode);
                const toggle = () => {
                  setSelectedId(isSelected ? null : s.id);
                  if (!isSelected) setValidation(null);
                };
                return (
                  <Fragment key={s.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-primary/5 hover:bg-primary/5",
                      )}
                      onClick={toggle}
                    >
                      <TableCell className="px-3 py-2.5 font-mono text-xs font-medium whitespace-nowrap">
                        {s.referenceNumber}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs">
                        {submissionTypeLabel(t, s.submissionType)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="text-xs font-medium text-foreground">
                          {s.patientName || "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {[
                            s.species,
                            s.farmIco
                              ? t("statutory.kvepis.icoLabel", "IČO {ico}", {
                                  ico: s.farmIco,
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {sendStateBadge(t, s.status)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <Badge className={badge.className}>
                          {t(badge.labelKey, badge.labelFallback)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatSubmittedAt(s.submittedAt ?? s.createdAt, locale)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label={t("statutory.kvepis.expandDetail", "Detail")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle();
                          }}
                        >
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isSelected && "rotate-90",
                            )}
                          />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isSelected && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="bg-muted/30 px-3 py-3">
                          <div className="space-y-3">
                            {/* Zlyhané odoslanie — kód chyby + inštrukcia na retry */}
                            {failed && (
                              <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                                        {t("statutory.kvepis.errorTitle", "Transmission failed")}
                                      </span>
                                      {s.errorCode && (
                                        <span className="rounded bg-red-600/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-red-700 dark:text-red-300">
                                          {t("statutory.kvepis.failureCode", "Failure code: {code}", {
                                            code: s.errorCode,
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    {s.errorMessage && (
                                      <p className="text-xs text-red-700/90 dark:text-red-300/90">
                                        {s.errorMessage}
                                      </p>
                                    )}
                                    <p className="text-xs text-red-700/80 dark:text-red-300/80">
                                      {t(
                                        "statutory.kvepis.retryHint",
                                        "Correct the flagged items, re-validate, sign the submission and submit it to ÚPVS again.",
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Akcie — loading indikátory počas tRPC výkonnosti */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleValidate(s.id)}
                                disabled={Boolean(pending)}
                                className="gap-2"
                              >
                                {pending === "validate" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                {t("statutory.kvepis.btnValidate", "Validate")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadXml(s.id)}
                                disabled={Boolean(pending)}
                                className="gap-2"
                              >
                                {pending === "xml" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                                {t("statutory.kvepis.btnDownloadXml", "Download XML (D.Signer)")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  signMutation.mutate(
                                    {
                                      submissionId: s.id,
                                      signatureMethod: signMethod,
                                    },
                                    withPending(s.id, "sign"),
                                  )
                                }
                                disabled={
                                  Boolean(pending) ||
                                  (s.status !== "VALIDATED" && s.status !== "SIGNED")
                                }
                                className="gap-2"
                              >
                                {pending === "sign" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileSignature className="h-4 w-4" />
                                )}
                                {t("statutory.kvepis.btnMarkSigned", "Mark as signed")}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  submitMutation.mutate(
                                    { submissionId: s.id },
                                    withPending(s.id, "submit"),
                                  )
                                }
                                disabled={
                                  Boolean(pending) ||
                                  (s.status !== "SIGNED" && s.status !== "VALIDATED")
                                }
                                className="gap-2"
                              >
                                {pending === "submit" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Landmark className="h-4 w-4" />
                                )}
                                {t("statutory.kvepis.btnSubmitUpvs", "Submit to ÚPVS")}
                              </Button>
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted/50">
                                {pending === "receipt" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                                {t("statutory.kvepis.btnUploadReceipt", "Upload receipt")}
                                <input
                                  type="file"
                                  accept="application/json,.json"
                                  className="hidden"
                                  disabled={Boolean(pending)}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReceiptFile(s.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>

                            {/* Výsledok validácie */}
                            {validation && (
                              <div className="space-y-1.5">
                                {validation.valid ? (
                                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t(
                                      "statutory.kvepis.validationOk",
                                      "The submission is valid and ready for signature.",
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                                    <XCircle className="h-4 w-4" />
                                    {t(
                                      "statutory.kvepis.validationFailed",
                                      "The submission contains errors that prevent submission:",
                                    )}
                                  </div>
                                )}
                                {validation.issues.map((issue, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-start gap-2 rounded-md px-3 py-1.5 text-xs ${
                                      issue.severity === "error"
                                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    }`}
                                  >
                                    {issue.severity === "error" ? (
                                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    ) : (
                                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span>
                                      <span className="font-mono font-semibold">{issue.field}</span> — {issue.message}{" "}
                                      <span className="font-mono text-[10px] opacity-70">[{issue.code}]</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTableFrame>
    </div>
  );
}
