"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
import { PageHeader } from "@/components/layout/page-header";
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

  const utils = trpc.useUtils();
  const { data: submissions, isLoading, refetch } = trpc.extensions.kvepis.listSubmissions.useQuery({ limit: 100 });
  const { data: credentials } = trpc.extensions.kvepis.getCredentials.useQuery();

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

  const selected = submissions?.items.find((s) => s.id === selectedId) ?? null;
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
      }
    );
  };

  const handleDownloadXml = () => {
    if (!selected) return;
    validateMutation.mutate(
      { submissionId: selected.id },
      {
        onSuccess: (res) => {
          setValidation(res as never);
          if (res.valid && res.payload) {
            downloadTextFile(
              `${selected.referenceNumber}.xml`,
              res.payload.xml
            );
          }
        },
      }
    );
  };

  const handleReceiptFile = async (file: File) => {
    if (!selected) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      receiptMutation.mutate({ submissionId: selected.id, receiptPayload: payload });
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/statutory"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> {t("statutory.title", "Zákonné registre")}
          </Link>
        </div>
        <Landmark className="h-6 w-6 text-muted-foreground" />
      </div>

      <PageHeader
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
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
              <Input value={form.transponderNumber} onChange={set("transponderNumber")} placeholder={t("statutory.kvepis.phTransponder", "15 digits per ISO 11784")} />
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
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              {t("statutory.kvepis.listTitle", "Prepared submissions")}
            </CardTitle>
            <CardDescription>
              {t("statutory.kvepis.listDesc", "Outpatient book → KVEPIS / ÚPVS.")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("statutory.kvepis.listRefresh", "Refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !submissions?.items.length ? (
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
            <div className="space-y-2">
              {submissions.items.map((s) => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.DRAFT;
                const isSelected = s.id === selectedId;
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <button
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => {
                        setSelectedId(s.id);
                        setValidation(null);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{s.referenceNumber}</span>
                          <Badge className={badge.className}>
                            {t(badge.labelKey, badge.labelFallback)}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {submissionTypeLabel(t, s.submissionType)}
                          {s.patientName ? ` · ${s.patientName}${s.species ? ` (${s.species})` : ""}` : ""}
                          {s.farmIco ? ` · IČO ${s.farmIco}` : ""}
                        </div>
                        {s.errorCode && (
                          <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {t("statutory.kvepis.errSvpsPrefix", "ŠVPS error:")}{" "}
                            {s.errorCode} {s.errorMessage ? `— ${s.errorMessage}` : ""}
                          </div>
                        )}
                      </div>
                      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                          {formatSubmittedAt(s.createdAt, locale)}
                        </span>
                    </button>

                    {isSelected && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {/* Validácia */}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleValidate(s.id)} className="gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            {t("statutory.kvepis.btnValidate", "Validate")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDownloadXml} className="gap-2">
                            <Download className="h-4 w-4" />
                            {t("statutory.kvepis.btnDownloadXml", "Download XML (D.Signer)")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => signMutation.mutate({ submissionId: s.id, signatureMethod: signMethod })}
                            disabled={s.status !== "VALIDATED" && s.status !== "SIGNED"}
                            className="gap-2"
                          >
                            <FileSignature className="h-4 w-4" />
                            {t("statutory.kvepis.btnMarkSigned", "Mark as signed")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => submitMutation.mutate({ submissionId: s.id })}
                            disabled={s.status !== "SIGNED" && s.status !== "VALIDATED"}
                            className="gap-2"
                          >
                            <Landmark className="h-4 w-4" />
                            {t("statutory.kvepis.btnSubmitUpvs", "Submit to ÚPVS")}
                          </Button>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted/50">
                            <Upload className="h-4 w-4" />
                            {t("statutory.kvepis.btnUploadReceipt", "Upload receipt")}
                            <input
                              type="file"
                              accept="application/json,.json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReceiptFile(file);
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
                                  "The submission is valid and ready for signature."
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                                <XCircle className="h-4 w-4" />
                                {t(
                                  "statutory.kvepis.validationFailed",
                                  "The submission contains errors that prevent submission:"
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
