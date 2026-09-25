"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Users,
  Heart,
  Syringe,
  FileText,
  Camera,
  ReceiptEuro,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/page-header";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  pageShellClass,
  PageToolbar,
  SearchField,
  DataTableFrame,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";

// CSV parsing helpers that handle Windows-1250 / UTF-8 encoding differences without crashing
function decodeBufferSafely(buffer: ArrayBuffer): string {
  try {
    // Try strict UTF-8 first
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    try {
      // Fallback to Windows-1250 for legacy Vetis/WinVet exports
      const winDecoder = new TextDecoder("windows-1250");
      return winDecoder.decode(buffer);
    } catch {
      // Last resort: lenient UTF-8 to never crash
      try {
        const fallback = new TextDecoder("utf-8", { fatal: false });
        return fallback.decode(buffer);
      } catch {
        // If even TextDecoder fails, return empty safely
        return "";
      }
    }
  }
}

function parseCsvSafely(text: string): { headers: string[]; rows: string[][]; error?: string } {
  try {
    if (!text.trim()) {
      return { headers: [], rows: [], error: "Empty file" };
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { headers: [], rows: [], error: "No data rows" };
    }
    // Simple CSV split handling quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "CSV parsing failed";
    return { headers: [], rows: [], error: message };
  }
}

export default function V2ImportPage() {
  const { t } = useI18n();
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = trpc.extensions.v2Import.getSourceStats.useQuery();

  const {
    data: preview,
    isLoading: isPreviewLoading,
  } = trpc.extensions.v2Import.getImportPreview.useQuery();

  const [options, setOptions] = useState({
    importClients: true,
    importPatients: true,
    importVaccinations: true,
    importSoapNotes: true,
    importFinancials: true,
    importAttachments: true,
  });

  const [activePreviewTab, setActivePreviewTab] = useState<
    "clients" | "patients" | "vaccinations" | "visits"
  >("patients");

  const [migrationReport, setMigrationReport] = useState<any | null>(null);

  const [previewSearchInput, setPreviewSearchInput] = useState("");
  const [debouncedPreviewSearch, setDebouncedPreviewSearch] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Prevent search input debounce lag: keep input responsive, debounce filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPreviewSearch(previewSearchInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [previewSearchInput]);

  const runMutation = trpc.extensions.v2Import.runMigration.useMutation({
    onSuccess: (data) => {
      setMigrationReport(data);
    },
  });

  const handleStartMigration = () => {
    setMigrationReport(null);
    runMutation.mutate(options);
  };

  const handleCsvFile = (file: File) => {
    setCsvFileName(file.name);
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const decoded = decodeBufferSafely(buffer);
        const parsed = parseCsvSafely(decoded);
        if (parsed.error) {
          setCsvError(parsed.error);
          setCsvHeaders([]);
          setCsvRows([]);
        } else {
          setCsvHeaders(parsed.headers);
          setCsvRows(parsed.rows.slice(0, 50));
          setCsvError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to read CSV";
        setCsvError(msg);
        setCsvHeaders([]);
        setCsvRows([]);
      }
    };
    reader.onerror = () => {
      setCsvError("Failed to read file");
      setCsvHeaders([]);
      setCsvRows([]);
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredPreview = useMemo(() => {
    if (!preview) return null;
    const q = debouncedPreviewSearch.toLowerCase().trim();
    if (!q) return preview;
    return {
      clients: preview.clients.filter((c) => `${c.name} ${c.address} ${c.phone} ${c.email}`.toLowerCase().includes(q)),
      patients: preview.patients.filter((p) => `${p.name} ${p.species} ${p.breed} ${p.microchip}`.toLowerCase().includes(q)),
      vaccinations: preview.vaccinations.filter((v) => `${v.vaccine} ${v.patientId}`.toLowerCase().includes(q)),
      visits: preview.visits.filter((vis) => `${vis.doctor} ${vis.patientId}`.toLowerCase().includes(q)),
    };
  }, [preview, debouncedPreviewSearch]);

  return (
    <div className={cn(pageShellClass, "mx-auto max-w-5xl")}>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span>1-Click V2 Data Migrácia</span>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 py-1 px-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI Peer-Reviewed
            </Badge>
          </span>
        }
        subtitle="Automatizovaný prevod celej 15-ročnej histórie praxe (MVDr. Sýkora / MVDr. Drotár, Rimavská Sobota) z VetSoftware V2 do OpenVPM AI."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchStats()}
              disabled={isStatsLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isStatsLoading ? "animate-spin" : ""}`} />
              Obnoviť stav
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                Späť do nastavení
              </Button>
            </Link>
          </div>
        }
        className="border-b pb-6"
      />

      {/* Stav spojenia s databázou */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${stats?.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                Zdrojová databáza: Firebird 2.5 (V2DATA.FDB)
                {stats?.connected ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Online & Pripravené</Badge>
                ) : (
                  <Badge variant="destructive">Odpojené</Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cesta k databáze: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{stats?.databasePath || "/firebird/data/V2DATA.FDB"}</code> (Kódovanie textov: WIN1250)
              </p>
            </div>
          </div>
        </div>

        {stats?.error && (
          <div className="mt-4 p-3.5 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Chyba pripojenia k Firebird 2.5: {stats.error}</span>
          </div>
        )}
      </div>

      {/* Dátový audit - Prehľad kariet */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Dátový audit (Nájdené záznamy na migráciu)
          </h2>
          <span className="text-xs text-muted-foreground">
            100% Zero-Conflict & Idempotentný import
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {/* Majitelia */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Majitelia</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.clientsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adresy, mestá, PSČ, mobily, pevné linky
            </p>
          </div>

          {/* Pacienti */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Živí pacienti</span>
              <Heart className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.activePatientsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Psy, mačky, hlodavce, druhy, plemená, čipy
            </p>
          </div>

          {/* Sympathy Gate */}
          <div className="border rounded-xl p-4 bg-emerald-500/5 border-emerald-500/20 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sympathy Gate
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-800">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.deceasedPatientsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-emerald-700/80">
              Uhynutí pacienti zablokovaní pred SMS
            </p>
          </div>

          {/* Očkovania */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Očkovania</span>
              <Syringe className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.vaccinationsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dátumy podania, šarže a platnosť do
            </p>
          </div>

          {/* Klinické karty */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Klinické karty</span>
              <FileText className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.soapNotesCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anamnézy, nálezy, diagnózy a liečivá (SOAP)
            </p>
          </div>

          {/* Obrazové prílohy */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">RTG & Prílohy</span>
              <Camera className="w-4 h-4 text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.attachmentsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Binárne snímky z databázy v plnej kvalite
            </p>
          </div>

          {/* Faktúry a účty */}
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-2 col-span-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Faktúry a pokladničné účty</span>
              <ReceiptEuro className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.financialDocsCount.toLocaleString() ?? "–"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Historické účty s DPH v EUR (uložené v archíve, oddelené od novej e-Kasy)
            </p>
          </div>
        </div>
      </div>

      {/* Živý náhľad vzorky dát (Preview) */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t("settings.importV2.preview.title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("settings.importV2.preview.subtitle")}
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Preview sections"
          className={cn(underlineTabsListClass, "w-full")}
        >
          <button
            role="tab"
            aria-selected={activePreviewTab === "patients"}
            onClick={() => setActivePreviewTab("patients")}
            className={cn(
              underlineTabsTriggerClass,
              activePreviewTab === "patients" ? "border-primary text-primary" : "text-muted-foreground"
            )}
          >
            {t("settings.importV2.preview.tabPatients")}
          </button>
          <button
            role="tab"
            aria-selected={activePreviewTab === "clients"}
            onClick={() => setActivePreviewTab("clients")}
            className={cn(
              underlineTabsTriggerClass,
              activePreviewTab === "clients" ? "border-primary text-primary" : "text-muted-foreground"
            )}
          >
            {t("settings.importV2.preview.tabClients")}
          </button>
          <button
            role="tab"
            aria-selected={activePreviewTab === "vaccinations"}
            onClick={() => setActivePreviewTab("vaccinations")}
            className={cn(
              underlineTabsTriggerClass,
              activePreviewTab === "vaccinations" ? "border-primary text-primary" : "text-muted-foreground"
            )}
          >
            {t("settings.importV2.preview.tabVaccinations")}
          </button>
          <button
            role="tab"
            aria-selected={activePreviewTab === "visits"}
            onClick={() => setActivePreviewTab("visits")}
            className={cn(
              underlineTabsTriggerClass,
              activePreviewTab === "visits" ? "border-primary text-primary" : "text-muted-foreground"
            )}
          >
            {t("settings.importV2.preview.tabVisits")}
          </button>
        </div>

        <PageToolbar>
          <SearchField
            value={previewSearchInput}
            onChange={setPreviewSearchInput}
            placeholder={t("settings.importV2.csv.searchPlaceholder", "Search preview records")}
          />
          <span className="text-xs text-muted-foreground">
            {filteredPreview ? `${filteredPreview[activePreviewTab].length} shown` : ""}
          </span>
        </PageToolbar>

        {isPreviewLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTableFrame>
            <div className="text-xs">
              {activePreviewTab === "patients" && (
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-3 py-2">{t("settings.importV2.preview.id")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.name")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.species")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.breed")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.sex")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.chip")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPreview?.patients.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-muted-foreground">#{p.id}</td>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 capitalize">{p.species}</td>
                        <td className="px-3 py-2">{p.breed}</td>
                        <td className="px-3 py-2 capitalize">{p.sex}</td>
                        <td className="px-3 py-2 font-mono">{p.microchip}</td>
                        <td className="px-3 py-2">
                          {p.status === "deceased" ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              {t("settings.importV2.preview.statusDeceased")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500 text-emerald-600 bg-emerald-50">
                              {t("settings.importV2.preview.statusActive")}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activePreviewTab === "clients" && (
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-3 py-2">{t("settings.importV2.preview.id")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.clientName")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.address")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.phone")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.email")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPreview?.clients.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-muted-foreground">#{c.id}</td>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2">{c.address}</td>
                        <td className="px-3 py-2">{c.phone}</td>
                        <td className="px-3 py-2">{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activePreviewTab === "vaccinations" && (
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-3 py-2">{t("settings.importV2.preview.id")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.patientId")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.vaccine")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.administeredDate")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.revaccinationDue")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPreview?.vaccinations.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-muted-foreground">#{v.id}</td>
                        <td className="px-3 py-2 font-mono">#{v.patientId}</td>
                        <td className="px-3 py-2 font-medium">{v.vaccine}</td>
                        <td className="px-3 py-2">{new Date(v.administeredAt).toLocaleDateString("sk-SK")}</td>
                        <td className="px-3 py-2">{v.nextDue !== "–" ? new Date(v.nextDue).toLocaleDateString("sk-SK") : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activePreviewTab === "visits" && (
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-3 py-2">{t("settings.importV2.preview.visitId")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.patientId")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.date")}</th>
                      <th className="px-3 py-2">{t("settings.importV2.preview.doctor")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPreview?.visits.map((vis) => (
                      <tr key={vis.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-muted-foreground">#{vis.id}</td>
                        <td className="px-3 py-2 font-mono">#{vis.patientId}</td>
                        <td className="px-3 py-2">{new Date(vis.date).toLocaleDateString("sk-SK")}</td>
                        <td className="px-3 py-2 font-medium">{vis.doctor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DataTableFrame>
        )}
      </div>

      {/* CSV import with Windows-1250 / UTF-8 handling */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {t("settings.importV2.csv.title", "CSV Import — Encoding Safe (UTF-8 / Windows-1250)")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.importV2.csv.description", "Upload a legacy CSV export. The parser detects Windows-1250 vs UTF-8 and never crashes on invalid bytes — it falls back safely.")}
        </p>
        <PageToolbar>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvFile(file);
              e.currentTarget.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {t("settings.importV2.csv.chooseFile", "Choose CSV file")}
          </Button>
          {csvFileName && <span className="text-xs text-muted-foreground">{csvFileName}</span>}
          {csvError && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {csvError}
            </span>
          )}
        </PageToolbar>
        {csvHeaders.length > 0 && (
          <DataTableFrame>
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  {csvHeaders.map((h, i) => (
                    <th key={`${h}-${i}`} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {csvRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-muted/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        )}
      </div>

      {/* Nastavenie importu (Voľba sekcií) */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-foreground">
          Rozsah migrácie
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importClients}
              onChange={(e) => setOptions((o) => ({ ...o, importClients: e.target.checked }))}
            />
            <div>
              <div className="font-medium">Majitelia (TAB005)</div>
              <div className="text-xs text-muted-foreground">Kontakty a adresy</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importPatients}
              onChange={(e) => setOptions((o) => ({ ...o, importPatients: e.target.checked }))}
            />
            <div>
              <div className="font-medium">Pacienti (TAB006)</div>
              <div className="text-xs text-muted-foreground">Zvieratá + Sympathy Gate</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importVaccinations}
              onChange={(e) => setOptions((o) => ({ ...o, importVaccinations: e.target.checked }))}
            />
            <div>
              <div className="font-medium">Očkovania (TAB018)</div>
              <div className="text-xs text-muted-foreground">Vakcinačné protokoly</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importSoapNotes}
              onChange={(e) => setOptions((o) => ({ ...o, importSoapNotes: e.target.checked }))}
            />
            <div>
              <div className="font-medium">Vyšetrenia (TAB010)</div>
              <div className="text-xs text-muted-foreground">SOAP poznámky a liečba</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importFinancials}
              onChange={(e) => setOptions((o) => ({ ...o, importFinancials: e.target.checked }))}
            />
            <div>
              <div className="font-medium">Faktúry a účty (TAB060)</div>
              <div className="text-xs text-muted-foreground">Historické tržby v EUR</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-sm p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={options.importAttachments}
              onChange={(e) => setOptions((o) => ({ ...o, importAttachments: e.target.checked }))}
            />
            <div>
              <div className="font-medium">RTG a dokumenty (TAB058)</div>
              <div className="text-xs text-muted-foreground">Snímky priamo do súborov</div>
            </div>
          </label>
        </div>
      </div>

      {/* Akčné tlačidlo spustenia */}
      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card shadow-sm space-y-4 text-center">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Pripravené na spustenie 1-Click migrácie
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mt-1">
            Všetky záznamy sa prenesú v dávkach do PostgreSQL. Idempotencia chráni pred duplicitiou.
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleStartMigration}
          disabled={!stats?.connected || runMutation.isPending}
          className="px-8 py-6 text-base font-semibold shadow-md flex items-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {runMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Prebieha migrácia dát (čakajte prosím)...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Spustiť kompletnú 1-Click migráciu
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>

      {/* Výsledný report migrácie */}
      {migrationReport && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold">
                Migrácia úspešne dokončená!
              </h3>
              <p className="text-xs text-emerald-700">
                Celkový čas: {(migrationReport.durationMs / 1000).toFixed(1)} sekúnd. Všetky dáta sú integrované v OpenVPM.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">Majitelia</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.clients.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                preskočené: {migrationReport.clients.skipped}
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">Pacienti</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.patients.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                uhynutí: {migrationReport.patients.deceased}
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">Očkovania</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.vaccinations.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                preskočené: {migrationReport.vaccinations.skipped}
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">Vyšetrenia</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.soapNotes.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                preskočené: {migrationReport.soapNotes.skipped}
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">Faktúry</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.financials.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                preskočené: {migrationReport.financials.skipped}
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="text-muted-foreground">RTG / Prílohy</div>
              <div className="text-lg font-bold text-foreground mt-1">
                {migrationReport.attachments.inserted}
              </div>
              <div className="text-[10px] text-muted-foreground">
                preskočené: {migrationReport.attachments.skipped}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/patients">
              <Button size="sm" className="flex items-center gap-2">
                Zobraziť pacientov
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/clients">
              <Button size="sm" variant="outline">
                Zobraziť majiteľov
              </Button>
            </Link>
            <Link href="/billing">
              <Button size="sm" variant="outline">
                Zobraziť fakturáciu
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
