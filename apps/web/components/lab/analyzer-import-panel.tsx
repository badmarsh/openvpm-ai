"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";
import type { LabAnalyteResult } from "@/lib/lab/analyzer-parser";

export function AnalyzerImportPanel() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<"UNASSIGNED" | "ATTACHED" | "REVIEWED" | "">("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const reportsQuery = trpc.extensions.labImport.listReports.useQuery({
    status: (statusFilter as any) || undefined,
    limit: 100,
  });

  const reviewMutation = trpc.extensions.labImport.reviewReport.useMutation({
    onSuccess: () => {
      toast.success(t("labImport.toastReviewed", "Laboratórny protokol bol schválený lekárom"));
      utils.extensions.labImport.listReports.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba pri schvaľovaní");
    },
  });

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="">{t("labImport.allStatuses", "Všetky protokoly")}</option>
            <option value="UNASSIGNED">{t("labImport.statusUnassigned", "Nezaradené k pacientovi")}</option>
            <option value="ATTACHED">{t("labImport.statusAttached", "Čaká na schválenie lekárom")}</option>
            <option value="REVIEWED">{t("labImport.statusReviewed", "Schválené a uzavreté")}</option>
          </select>
        </div>

        <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-2">
          <UploadCloud className="h-4 w-4" />
          <span>{t("labImport.btnImport", "Importovať z analyzátora")}</span>
        </Button>
      </div>

      {/* Reports List */}
      {reportsQuery.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !reportsQuery.data || reportsQuery.data.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t("labImport.emptyTitle", "Žiadne naimportované protokoly")}
          description={t(
            "labImport.emptyDesc",
            "Nahrajte CSV alebo textový export z analyzátora IDEXX, Fuji Dri-Chem alebo Mindray."
          )}
          action={{
            label: t("labImport.btnImport", "Importovať z analyzátora"),
            onClick: () => setIsUploadOpen(true),
            icon: UploadCloud,
          }}
        />
      ) : (
        <div className="space-y-3">
          {reportsQuery.data.map((report) => {
            const isExpanded = expandedReportId === report.id;
            const results = (report.parsedResults as LabAnalyteResult[]) || [];

            return (
              <div
                key={report.id}
                className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all hover:border-primary/30"
              >
                {/* Header row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer select-none bg-muted/20 gap-3"
                  onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {report.patient?.name ? report.patient.name : "Nezaradený pacient"}
                        </span>
                        {report.patient?.species && (
                          <span className="text-xs text-muted-foreground">
                            ({report.patient.species} {report.patient.breed ? "• " + report.patient.breed : ""})
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          {report.analyzerType} {report.deviceModel ? "• " + report.deviceModel : ""}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{new Date(report.createdAt).toLocaleString("sk-SK")}</span>
                        {report.fileName && <span>• Súbor: {report.fileName}</span>}
                        {report.client && (
                          <span>• Majiteľ: {report.client.firstName} {report.client.lastName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {report.criticalCount > 0 && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertOctagon className="h-3 w-3" />
                        <span>{report.criticalCount} kritické</span>
                      </Badge>
                    )}
                    {report.abnormalCount > 0 && (
                      <Badge variant="outline" className="border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/40 text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{report.abnormalCount} patologických</span>
                      </Badge>
                    )}
                    {report.abnormalCount === 0 && (
                      <Badge variant="outline" className="border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Fyziologické</span>
                      </Badge>
                    )}

                    <Badge
                      variant="outline"
                      className={
                        report.status === "REVIEWED"
                          ? "border-emerald-500/40 text-emerald-700 bg-emerald-50 text-xs"
                          : report.status === "ATTACHED"
                          ? "border-blue-500/40 text-blue-700 bg-blue-50 text-xs"
                          : "border-gray-500/40 text-gray-700 bg-gray-50 text-xs"
                      }
                    >
                      {report.status === "REVIEWED"
                        ? "Schválené"
                        : report.status === "ATTACHED"
                        ? "Čaká na schválenie"
                        : "Nezaradené"}
                    </Badge>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                            <th className="px-3 py-2">Parameter</th>
                            <th className="px-3 py-2">Názov vyšetrenia</th>
                            <th className="px-3 py-2 text-right">Hodnota</th>
                            <th className="px-3 py-2">Jednotka</th>
                            <th className="px-3 py-2">Referenčný rozsah</th>
                            <th className="px-3 py-2 text-center">Nález</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {results.map((r, idx) => {
                            const isCrit = r.flag === "CRITICAL";
                            const isHigh = r.flag === "HIGH";
                            const isLow = r.flag === "LOW";

                            return (
                              <tr
                                key={idx}
                                className={
                                  isCrit
                                    ? "bg-rose-50/70 dark:bg-rose-950/20 font-medium text-rose-900 dark:text-rose-200"
                                    : isHigh || isLow
                                    ? "bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                                    : "hover:bg-muted/30"
                                }
                              >
                                <td className="px-3 py-2 font-mono font-semibold">{r.code}</td>
                                <td className="px-3 py-2 text-muted-foreground">{r.name}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold">{r.value}</td>
                                <td className="px-3 py-2 font-mono text-muted-foreground">{r.unit}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {r.refLow != null && r.refHigh != null
                                    ? r.refLow + " - " + r.refHigh
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isCrit ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                      KRITICKÁ
                                    </Badge>
                                  ) : isHigh ? (
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px] px-1.5 py-0">
                                      ZVÝŠENÉ (▲)
                                    </Badge>
                                  ) : isLow ? (
                                    <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50 text-[10px] px-1.5 py-0">
                                      ZNÍŽENÉ (▼)
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0">
                                      Norma
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-muted-foreground">
                        {report.reviewer && (
                          <span>Schválil: {report.reviewer.name} dňa {new Date(report.reviewedAt!).toLocaleDateString("sk-SK")}</span>
                        )}
                      </div>
                      {report.status !== "REVIEWED" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1.5 text-xs"
                          onClick={() => reviewMutation.mutate({ id: report.id })}
                          disabled={reviewMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Potvrdiť a schváliť nález</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* IMPORT MODAL */}
      {isUploadOpen && (
        <AnalyzerUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            utils.extensions.labImport.listReports.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analyzer Upload Modal
// ---------------------------------------------------------------------------
function AnalyzerUploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [species, setSpecies] = useState<"canine" | "feline" | "other">("canine");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const [parsedPreview, setParsedPreview] = useState<{
    analyzerType: "IDEXX" | "FUJI_DRI_CHEM" | "MINDRAY" | "GENERIC_CSV";
    deviceModel?: string;
    results: LabAnalyteResult[];
    abnormalCount: number;
    criticalCount: number;
  } | null>(null);

  const patientsQuery = trpc.patients.list.useQuery(
    { search: patientSearch, limit: 10 },
    { enabled: patientSearch.length >= 2 }
  );

  const parseMutation = trpc.extensions.labImport.parseFile.useMutation({
    onSuccess: (data) => {
      setParsedPreview(data);
      toast.success(
        "Analyzované: " + data.results.length + " parametrov (" + data.analyzerType + (data.deviceModel ? " - " + data.deviceModel : "") + ")"
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba pri analýze súboru");
    },
  });

  const saveMutation = trpc.extensions.labImport.saveReport.useMutation({
    onSuccess: () => {
      toast.success(t("labImport.saveSuccess", "Laboratórny protokol bol úspešne uložený"));
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Chyba pri ukladaní protokolu");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        parseMutation.mutate({
          content,
          fileName: file.name,
          species,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleParseManual = () => {
    if (!rawText.trim()) {
      toast.error("Vložte text alebo vyberte súbor");
      return;
    }
    parseMutation.mutate({
      content: rawText,
      fileName: fileName || "manual_export.csv",
      species,
    });
  };

  const handleSave = () => {
    if (!parsedPreview || parsedPreview.results.length === 0) {
      toast.error("Žiadne načítané parametre na uloženie");
      return;
    }

    saveMutation.mutate({
      patientId: selectedPatientId || undefined,
      analyzerType: parsedPreview.analyzerType,
      deviceModel: parsedPreview.deviceModel,
      species,
      fileName: fileName || "lab_export.csv",
      rawContent: rawText,
      parsedResults: parsedPreview.results,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Import z veterinárneho analyzátora
              </h2>
              <p className="text-xs text-muted-foreground">
                Podpora IDEXX Catalyst/ProCyte, Fuji Dri-Chem NX, Mindray BC-Vet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Top Options: Species and File Select */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1">Druh pacienta (pre referenčné rozsahy)</label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="canine">Pes (Canine)</option>
                <option value="feline">Mačka (Feline)</option>
                <option value="other">Iné zviera</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Priradiť pacientovi (voliteľné)</label>
              <Input
                placeholder="Hľadať pacienta podľa mena..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="text-xs h-9"
              />
              {patientsQuery.data?.items && patientsQuery.data.items.length > 0 && (
                <div className="absolute z-10 max-h-36 overflow-y-auto rounded-md border border-border bg-card shadow-lg p-1 space-y-1 w-64">
                  {patientsQuery.data.items.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setPatientSearch(p.name + " (" + p.species + ")");
                        if (p.species?.toLowerCase().includes("mač") || p.species?.toLowerCase().includes("cat")) {
                          setSpecies("feline");
                        } else if (p.species?.toLowerCase().includes("ps") || p.species?.toLowerCase().includes("dog")) {
                          setSpecies("canine");
                        }
                      }}
                      className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-primary/10"
                    >
                      {p.name} — {p.species} {p.breed ? "(" + p.breed + ")" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.dat"
              onChange={handleFileUpload}
              className="hidden"
            />
            <FileSpreadsheet className="mx-auto h-8 w-8 text-primary mb-2" />
            <div className="text-sm font-medium">
              {fileName ? fileName : "Kliknite pre výber CSV/TXT súboru z analyzátora"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Podporuje súbory z USB alebo sieťového priečinka analyzátora
            </p>
          </div>

          {/* Manual paste toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Alebo vložte surový text / CSV:</label>
              {rawText && !parsedPreview && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleParseManual}>
                  Analyzovať text
                </Button>
              )}
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="ALT, 45, U/L, 10, 100&#10;CREA, 180, µmol/L, 44, 159..."
              className="w-full h-24 rounded-md border border-input bg-background p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* PARSED PREVIEW TABLE */}
          {parsedPreview && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {parsedPreview.analyzerType} {parsedPreview.deviceModel ? "• " + parsedPreview.deviceModel : ""}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({parsedPreview.results.length} nájdených parametrov)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {parsedPreview.criticalCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {parsedPreview.criticalCount} kritické
                    </Badge>
                  )}
                  {parsedPreview.abnormalCount > 0 && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 text-[10px] px-1.5 py-0">
                      {parsedPreview.abnormalCount} patologických
                    </Badge>
                  )}
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-1.5">Kód</th>
                      <th className="px-3 py-1.5">Názov</th>
                      <th className="px-3 py-1.5 text-right">Hodnota</th>
                      <th className="px-3 py-1.5">Jednotka</th>
                      <th className="px-3 py-1.5">Referenčný rozsah</th>
                      <th className="px-3 py-1.5 text-center">Nález</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedPreview.results.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-1 font-mono font-medium">{r.code}</td>
                        <td className="px-3 py-1 text-muted-foreground">{r.name}</td>
                        <td className="px-3 py-1 text-right font-mono font-semibold">{r.value}</td>
                        <td className="px-3 py-1 text-muted-foreground">{r.unit}</td>
                        <td className="px-3 py-1 text-muted-foreground">
                          {r.refLow != null && r.refHigh != null ? r.refLow + " - " + r.refHigh : "—"}
                        </td>
                        <td className="px-3 py-1 text-center">
                          {r.flag === "CRITICAL" ? (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">Kritické</Badge>
                          ) : r.flag === "HIGH" ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-700 text-[9px] px-1 py-0">Zvýšené</Badge>
                          ) : r.flag === "LOW" ? (
                            <Badge variant="outline" className="border-blue-500 text-blue-700 text-[9px] px-1 py-0">Znížené</Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-700 text-[9px] px-1 py-0">Norma</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saveMutation.isPending}>
            Zrušiť
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || !parsedPreview || parsedPreview.results.length === 0}
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Uložiť nález
          </Button>
        </div>
      </div>
    </div>
  );
}
