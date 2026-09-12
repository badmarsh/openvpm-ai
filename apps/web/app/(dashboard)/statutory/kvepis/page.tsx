"use client";

import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/empty-state";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rozpracované", className: "bg-muted text-muted-foreground border-border" },
  VALIDATED: { label: "Validované", className: "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300" },
  SIGNED: { label: "Podpísané", className: "bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300" },
  SUBMITTED: { label: "Odoslané", className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" },
  ACKNOWLEDGED: { label: "Doručenka prijatá", className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" },
  REJECTED: { label: "Zamietnuté", className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300" },
};

const SUBMISSION_TYPE_LABEL: Record<string, string> = {
  rabies_notification: "Besnota — hlásenie",
  treatment_diary_batch: "Ambulantná kniha ošetrení",
  animal_movement: "Premiestnenie zvieraťa",
  infectious_disease_alert: "Podozrenie na nebezpečnú nákazu",
};

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

function formatDate(val: Date | string | null | undefined): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(val);
  }
}

export default function KvepisPage() {
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
      window.alert("Doručenka musí byť platný JSON súbor z ÚPVS.");
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
            <ChevronLeft className="h-4 w-4" /> Zákonné registre
          </Link>
        </div>
        <Landmark className="h-6 w-6 text-muted-foreground" />
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">KVEPIS Submission Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Riadená príprava zákonných hlásení pre ŠVPS SR cez ÚPVS. Validácia schém,
          generovanie podpisového XML/JSON balíčka a párovanie doručenky so záznamom
          pacienta.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Právny rámec: Zákon č. 39/2007 Z. z. (veterinárna starostlivosť) · Zákon
          č. 139/1998 Z. z. (omamné látky) · portál{" "}
          <span className="font-mono">svps.sk/kvepis</span>
        </p>
      </div>

      {/* ── Prístup kliniky ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prístup kliniky (IČO · KVL · ÚPVS)</CardTitle>
          <CardDescription>
            {credentials
              ? `Nakonfigurované: IČO ${credentials.ico}${credentials.kvlId ? ` · KVL ${credentials.kvlId}` : ""}${credentials.upvsSchranka ? ` · Schránka ${credentials.upvsSchranka}` : ""}`
              : "Zadajte identifikačné údaje kliniky pre generovanie podaní."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-1">
            <Label>IČO</Label>
            <Input value={credIco} onChange={(e) => setCredIco(e.target.value)} placeholder="12345678" maxLength={8} />
          </div>
          <div className="space-y-1">
            <Label>KVL ID lekára</Label>
            <Input value={credKvl} onChange={(e) => setCredKvl(e.target.value)} placeholder="LV-0001" />
          </div>
          <div className="space-y-1">
            <Label>ÚPVS schránka</Label>
            <Input value={credSchranka} onChange={(e) => setCredSchranka(e.target.value)} placeholder="ICO/12345678" />
          </div>
          <div className="space-y-1">
            <Label>Spôsob podpisu (KEP)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={signMethod}
              onChange={(e) => setSignMethod(e.target.value as never)}
            >
              <option value="DSIGNER">D.Signer / Disig (eID čítačka)</option>
              <option value="CLOUD_SEAL">Cloudová pečať ambulancie</option>
              <option value="HSM">HSM modul</option>
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
              <FileSignature className="h-4 w-4" /> Uložiť prístup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Nové podanie ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nové podanie</CardTitle>
          <CardDescription>
            Typ podania určuje povinné polia validačného enginu ŠVPS SR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label>Typ podania</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                {Object.entries(SUBMISSION_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>IČO farmy</Label>
              <Input value={form.farmIco} onChange={set("farmIco")} placeholder="12345678" maxLength={8} />
            </div>
            <div className="space-y-1">
              <Label>CEHZ kód chovu</Label>
              <Input value={form.cehzCode} onChange={set("cehzCode")} placeholder="SK1234567" />
            </div>
            <div className="space-y-1">
              <Label>Číslo ušnej známky</Label>
              <Input value={form.earTagNumber} onChange={set("earTagNumber")} placeholder="SK000123456789" />
            </div>
            <div className="space-y-1">
              <Label>Transpondér / čip</Label>
              <Input value={form.transponderNumber} onChange={set("transponderNumber")} placeholder="15 číslic ISO 11784" />
            </div>
            <div className="space-y-1">
              <Label>KVL číslo lekára</Label>
              <Input value={form.kvlNumber} onChange={set("kvlNumber")} placeholder="LV-0001" />
            </div>
            <div className="space-y-1">
              <Label>Druh zvieraťa</Label>
              <Input value={form.animalSpecies} onChange={set("animalSpecies")} placeholder="hovädzí dobytok / pes" />
            </div>
            <div className="space-y-1">
              <Label>Diagnóza</Label>
              <Input value={form.diagnosis} onChange={set("diagnosis")} placeholder="Bronchopneumónia" />
            </div>
            <div className="space-y-1">
              <Label>Názov liečiva</Label>
              <Input value={form.medicationName} onChange={set("medicationName")} placeholder="Cobactan 2.5%" />
            </div>
            <div className="space-y-1">
              <Label>Ochranná lehota — mäso (dni)</Label>
              <Input type="number" min={0} value={form.meatWithdrawalDays} onChange={set("meatWithdrawalDays")} placeholder="5" />
            </div>
            <div className="space-y-1">
              <Label>Ochranná lehota — mlieko (dni)</Label>
              <Input type="number" min={0} value={form.milkWithdrawalDays} onChange={set("milkWithdrawalDays")} placeholder="1" />
            </div>
            <div className="space-y-1">
              <Label>Dátum podania</Label>
              <Input type="datetime-local" value={form.administeredAt} onChange={set("administeredAt")} />
            </div>
            <div className="space-y-1">
              <Label>Koniec ochrannej lehoty</Label>
              <Input type="datetime-local" value={form.safeUntil} onChange={set("safeUntil")} />
            </div>
            <div className="space-y-1">
              <Label>Dátum incidentu (besnota)</Label>
              <Input type="datetime-local" value={form.incidentDate} onChange={set("incidentDate")} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Vytvoriť podanie
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Zoznam podaní ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Pripravené podania</CardTitle>
            <CardDescription>Ambulantná kniha → KVEPIS / ÚPVS.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Obnoviť
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
              title="Žiadne podania"
              description="Vytvorte prvé KVEPIS podanie z ambulantnej knihy."
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
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {SUBMISSION_TYPE_LABEL[s.submissionType] ?? s.submissionType}
                          {s.patientName ? ` · ${s.patientName}${s.species ? ` (${s.species})` : ""}` : ""}
                          {s.farmIco ? ` · IČO ${s.farmIco}` : ""}
                        </div>
                        {s.errorCode && (
                          <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                            Chyba ŠVPS: {s.errorCode} {s.errorMessage ? `— ${s.errorMessage}` : ""}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                    </button>

                    {isSelected && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {/* Validácia */}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleValidate(s.id)} className="gap-2">
                            <ShieldCheck className="h-4 w-4" /> Validovať
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDownloadXml} className="gap-2">
                            <Download className="h-4 w-4" /> Stiahnuť XML (D.Signer)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => signMutation.mutate({ submissionId: s.id, signatureMethod: signMethod })}
                            disabled={s.status !== "VALIDATED" && s.status !== "SIGNED"}
                            className="gap-2"
                          >
                            <FileSignature className="h-4 w-4" /> Označiť podpísané
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => submitMutation.mutate({ submissionId: s.id })}
                            disabled={s.status !== "SIGNED" && s.status !== "VALIDATED"}
                            className="gap-2"
                          >
                            <Landmark className="h-4 w-4" /> Odoslať do ÚPVS
                          </Button>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted/50">
                            <Upload className="h-4 w-4" /> Nahrať doručenku
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
                                <CheckCircle2 className="h-4 w-4" /> Podanie je validné a pripravené na podpis.
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                                <XCircle className="h-4 w-4" /> Podanie obsahuje chyby, ktoré bránia odoslaniu:
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
