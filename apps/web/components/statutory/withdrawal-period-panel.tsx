"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  Clock,
  Plus,
  Printer,
  Download,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
  Building2,
  FileCheck,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  COMMON_VETERINARY_DRUGS,
  calculateWithdrawalSafeUntil,
  formatWithdrawalCertificateHtml,
} from "@/lib/statutory/withdrawal";

function formatDate(val: Date | string | null | undefined): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function formatDateTime(val: Date | string | null | undefined): string {
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

function downloadWithdrawalCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const escapeCell = (val: unknown) => {
    const text = val == null ? "" : String(val);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csvContent =
    "\uFEFF" +
    [
      headers.map(escapeCell).join(";"),
      ...rows.map((row) => row.map(escapeCell).join(";")),
    ].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const TARGET_ANIMAL_LABELS: Record<string, string> = {
  bovine: "Hovädzí dobytok",
  porcine: "Ošípané",
  ovine: "Ovce a kozy",
  equine: "Kone",
  poultry: "Hydina",
  companion: "Spoločenské zviera",
};

export function WithdrawalPeriodPanel() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "cleared">("all");
  const [animalFilter, setAnimalFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [targetAnimalType, setTargetAnimalType] = useState<
    "bovine" | "porcine" | "ovine" | "equine" | "poultry" | "companion"
  >("bovine");
  const [medicationName, setMedicationName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [meatWithdrawalDays, setMeatWithdrawalDays] = useState(0);
  const [milkWithdrawalDays, setMilkWithdrawalDays] = useState(0);
  const [administeredAt, setAdministeredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data, isLoading } = trpc.extensions.statutory.listWithdrawalPeriods.useQuery({
    activeOnly: activeFilter === "active",
    targetAnimalType: animalFilter !== "all" ? animalFilter : undefined,
    limit: 100,
  });

  const { data: patientsData } = trpc.patients.list.useQuery(
    { search: patientSearch, limit: 10 },
    { enabled: patientSearch.length >= 2 && isNewDialogOpen }
  );

  const createMutation = trpc.extensions.statutory.createWithdrawalPeriod.useMutation({
    onSuccess: (created) => {
      toast.success(
        `Ochranná lehota bola zaevidovaná (koniec: ${formatDate(created.safeUntil)})`
      );
      utils.extensions.statutory.listWithdrawalPeriods.invalidate();
      setIsNewDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Chyba pri ukladaní: ${err.message}`);
    },
  });

  const resetForm = () => {
    setSelectedPatientId("");
    setPatientSearch("");
    setTargetAnimalType("bovine");
    setMedicationName("");
    setBatchNumber("");
    setMeatWithdrawalDays(0);
    setMilkWithdrawalDays(0);
    setAdministeredAt(new Date().toISOString().slice(0, 16));
    setNotes("");
    setSelectedTemplateId("");
  };

  const handleApplyDrugTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = COMMON_VETERINARY_DRUGS.find((d) => d.id === templateId);
    if (!found) return;
    setMedicationName(found.name);
    setTargetAnimalType(found.defaultAnimalType);
    setMeatWithdrawalDays(found.meatWithdrawalDays);
    setMilkWithdrawalDays(found.milkWithdrawalDays);
    if (found.description) {
      setNotes(found.description);
    }
  };

  const calculatedSafeUntil = useMemo(() => {
    const adminDate = administeredAt ? new Date(administeredAt) : new Date();
    return calculateWithdrawalSafeUntil(adminDate, meatWithdrawalDays, milkWithdrawalDays);
  }, [administeredAt, meatWithdrawalDays, milkWithdrawalDays]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items as any[];

    if (activeFilter === "cleared") {
      const now = new Date();
      items = items.filter((i) => new Date(i.safeUntil) <= now);
    }

    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.patientName?.toLowerCase().includes(q) ||
        i.species?.toLowerCase().includes(q) ||
        i.medicationName?.toLowerCase().includes(q) ||
        i.batchNumber?.toLowerCase().includes(q) ||
        i.microchipNumber?.toLowerCase().includes(q) ||
        i.clientLastName?.toLowerCase().includes(q)
    );
  }, [data?.items, activeFilter, search]);

  const activeCount = useMemo(() => {
    if (!data?.items) return 0;
    const now = new Date();
    return (data.items as any[]).filter((i) => new Date(i.safeUntil) > now).length;
  }, [data?.items]);

  const handlePrintCertificate = (item: any) => {
    const html = formatWithdrawalCertificateHtml({
      clinicName: session?.user?.name ? `Veterinárna ambulancia – ${session.user.name}` : "Veterinárna klinika VET.IS",
      vetName: session?.user?.name ?? "Ošetrujúci veterinárny lekár",
      patientName: item.patientName,
      species: item.species,
      breed: item.breed ?? undefined,
      earTagOrChip: item.microchipNumber ?? undefined,
      targetAnimalType: item.targetAnimalType,
      clientName: `${item.clientFirstName || ""} ${item.clientLastName || ""}`.trim() || "Chovateľ",
      clientPhone: item.clientPhone ?? undefined,
      medicationName: item.medicationName,
      batchNumber: item.batchNumber ?? undefined,
      meatWithdrawalDays: item.meatWithdrawalDays ?? 0,
      milkWithdrawalDays: item.milkWithdrawalDays ?? 0,
      administeredAt: item.administeredAt,
      safeUntil: item.safeUntil,
      notes: item.notes ?? undefined,
    });

    const printWin = window.open("", "_blank", "width=850,height=950");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => printWin.print(), 350);
    }
  };

  const handlePrintInspectionTable = () => {
    if (!filteredItems.length) return;
    const printWin = window.open("", "_blank", "width=950,height=1000");
    if (!printWin) return;

    const now = new Date();
    const rowsHtml = filteredItems
      .map((i: any, idx: number) => {
        const isRunning = new Date(i.safeUntil) > now;
        return `<tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${formatDate(i.administeredAt)}</td>
          <td><strong>${i.patientName}</strong> (${i.species})</td>
          <td>${TARGET_ANIMAL_LABELS[i.targetAnimalType] || i.targetAnimalType}</td>
          <td>${i.microchipNumber || "—"}</td>
          <td>${i.clientFirstName || ""} ${i.clientLastName || ""} (${i.clientPhone || "—"})</td>
          <td><strong>${i.medicationName}</strong> (šarža: ${i.batchNumber || "—"})</td>
          <td style="text-align:center">${i.meatWithdrawalDays ?? 0} d</td>
          <td style="text-align:center">${i.milkWithdrawalDays ?? 0} d</td>
          <td style="font-weight:bold;color:${isRunning ? "#b71c1c" : "#2e7d32"}">${formatDate(i.safeUntil)}</td>
          <td style="font-weight:bold;color:${isRunning ? "#b71c1c" : "#2e7d32"}">
            ${isRunning ? "V OCHRANNEJ LEHOTE" : "Uplynula"}
          </td>
        </tr>`;
      })
      .join("");

    printWin.document.write(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <title>Kniha ochranných lehôt – Úradná zostava RVPS</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 0; padding: 6px; }
    h1 { font-size: 13px; text-transform: uppercase; text-align: center; margin: 0 0 4px; }
    .stat-ref { font-size: 8.5px; text-align: center; font-weight: bold; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5px; }
    th { background: #eee; border: 1px solid #777; padding: 4px 5px; text-align: left; text-transform: uppercase; font-size: 7.5px; }
    td { border: 1px solid #999; padding: 4px 5px; vertical-align: top; }
  </style>
</head>
<body>
  <h1>KNIHA OCHRANNÝCH LEHÔT HOSPODÁRSKYCH A POTRAVINOVÝCH ZVIERAT</h1>
  <div class="stat-ref">Úradná evidencia v zmysle § 22 zákona č. 39/2007 Z. z. a zákona č. 139/1998 Z. z. | Generované: ${new Date().toLocaleDateString("sk-SK")}</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Dátum podania</th>
        <th>Zviera / Druh</th>
        <th>Kategória</th>
        <th>Ušné číslo / Čip</th>
        <th>Chovateľ</th>
        <th>Liečivo & Šarža</th>
        <th>OL Mäso</th>
        <th>OL Mlieko</th>
        <th>Koniec lehoty</th>
        <th>Stav</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 350);
  };

  const handleExportCsv = () => {
    if (!filteredItems.length) return;
    const now = new Date();
    const headers = [
      "Dátum podania",
      "Zviera",
      "Druh",
      "Kategória",
      "Ušné číslo / Čip",
      "Chovateľ",
      "Telefón",
      "Liečivo",
      "Šarža",
      "OL Mäso (dní)",
      "OL Mlieko (dní)",
      "Koniec lehoty (bezpečné od)",
      "Aktuálny stav",
      "Poznámka",
    ];
    const rows = filteredItems.map((i: any) => {
      const isRunning = new Date(i.safeUntil) > now;
      return [
        formatDateTime(i.administeredAt),
        i.patientName,
        i.species,
        TARGET_ANIMAL_LABELS[i.targetAnimalType] || i.targetAnimalType,
        i.microchipNumber || "—",
        `${i.clientFirstName || ""} ${i.clientLastName || ""}`.trim(),
        i.clientPhone || "—",
        i.medicationName,
        i.batchNumber || "—",
        i.meatWithdrawalDays ?? 0,
        i.milkWithdrawalDays ?? 0,
        formatDate(i.safeUntil),
        isRunning ? "V OCHRANNEJ LEHOTE (ZÁKAZ PORÁŽKY/DOJENIA)" : "Uplynula (bezpečné)",
        i.notes || "—",
      ];
    });

    downloadWithdrawalCsv(
      `kniha_ochrannych_lehot_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-4">
      {/* Active banner indicator */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">
                Aktívne ochranné lehoty: {activeCount} {activeCount === 1 ? "zviera" : activeCount < 5 ? "zvieratá" : "zvierat"}
              </span>
              <span className="ml-1.5 opacity-90">
                Platí prísny zákaz dodávky mäsa na porážku alebo mlieka do mliekarní v zmysle § 22 zák. č. 39/2007 Z. z.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveFilter("active")}
            className="h-7 text-xs border-amber-400 bg-white/60 dark:bg-transparent hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            Filtrovať aktívne
          </Button>
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať zviera, liečivo, šaržu, ušné číslo, chovateľa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              variant={activeFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              className="h-7 text-xs px-2.5"
            >
              Všetky
            </Button>
            <Button
              variant={activeFilter === "active" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("active")}
              className="h-7 text-xs px-2.5 gap-1 text-amber-700 dark:text-amber-400"
            >
              <Clock className="h-3.5 w-3.5" />
              Aktívne ({activeCount})
            </Button>
            <Button
              variant={activeFilter === "cleared" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("cleared")}
              className="h-7 text-xs px-2.5"
            >
              Uplynuté
            </Button>
          </div>

          <select
            value={animalFilter}
            onChange={(e) => setAnimalFilter(e.target.value)}
            aria-label="Filtrovať podľa kategórie zvieraťa"
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          >
            <option value="all">Všetky kategórie</option>
            <option value="bovine">Hovädzí dobytok</option>
            <option value="porcine">Ošípané</option>
            <option value="ovine">Ovce a kozy</option>
            <option value="equine">Kone</option>
            <option value="poultry">Hydina</option>
            <option value="companion">Spoločenské zvieratá</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsNewDialogOpen(true)}
            className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Zaevidovať ochrannú lehotu</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintInspectionTable}
            disabled={!filteredItems.length}
            className="h-9 gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Úradná zostava</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!filteredItems.length}
            className="h-9 gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredItems.length ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            Neboli nájdené žiadne záznamy o ochranných lehotách zodpovedajúce filtru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum aplikácie</th>
                  <th className="p-3">Zviera & Kategória</th>
                  <th className="p-3">Ušné číslo / Čip</th>
                  <th className="p-3">Chovateľ</th>
                  <th className="p-3">Liečivo & Šarža</th>
                  <th className="p-3">OL Mäso / Mlieko</th>
                  <th className="p-3">Koniec lehoty</th>
                  <th className="p-3">Stav</th>
                  <th className="p-3 text-right">Potvrdenie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item: any) => {
                  const now = new Date();
                  const isRunning = new Date(item.safeUntil) > now;
                  const diffDays = Math.max(
                    0,
                    Math.ceil((new Date(item.safeUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  );

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">
                        {formatDate(item.administeredAt)}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{item.patientName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.species} {item.breed ? `• ${item.breed}` : ""}
                          <span className="ml-1 text-primary/80">
                            ({TARGET_ANIMAL_LABELS[item.targetAnimalType] || item.targetAnimalType})
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {item.microchipNumber || "—"}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">
                          {item.clientFirstName} {item.clientLastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{item.clientPhone || "—"}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{item.medicationName}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          Šarža: {item.batchNumber || "neuvedená"}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-medium text-foreground">Mäso: {item.meatWithdrawalDays ?? 0} d</span>
                        <span className="text-muted-foreground mx-1">|</span>
                        <span className="font-medium text-foreground">Mlieko: {item.milkWithdrawalDays ?? 0} d</span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium font-mono">
                        {formatDate(item.safeUntil)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isRunning ? (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900 text-[10px] font-semibold"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Aktívna ({diffDays} d)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Uplynula
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintCertificate(item)}
                          title="Vytlačiť úradné potvrdenie pre chovateľa"
                          className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 px-2"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Pre chovateľa</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Zaevidovať ochrannú lehotu */}
      {isNewDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsNewDialogOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5">
              <h2 className="text-base font-bold text-foreground">
                Zaevidovanie ochrannej lehoty liečiva (§ 22 zákona č. 39/2007 Z. z.)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Aplikácia veterinárneho lieku potravinovému zvieraťu so stanovením ochrannej lehoty na mäso a mlieko.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Patient search / selection */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Pacient / Hospodárske zviera <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    placeholder="Vyhľadajte zviera (meno, ušné číslo, čip)..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      if (selectedPatientId) setSelectedPatientId("");
                    }}
                    className="h-9 text-xs"
                  />
                  {patientsData?.items && patientsData.items.length > 0 && !selectedPatientId && (
                    <div className="absolute top-10 left-0 right-0 z-20 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto p-1">
                      {patientsData.items.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatientId(p.id);
                            setPatientSearch(`${p.name} (${p.species}${p.breed ? ` • ${p.breed}` : ""})`);
                          }}
                          className="w-full text-left p-2 rounded text-xs hover:bg-muted/70 transition-colors flex justify-between"
                        >
                          <div>
                            <span className="font-semibold">{p.name}</span>
                            <span className="ml-1 text-muted-foreground">({p.species})</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {p.clientLastName ? `${p.clientFirstName || ""} ${p.clientLastName}` : p.breed || "—"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatientId && (
                  <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Pacient vybraný
                  </div>
                )}
              </div>

              {/* Drug template selector */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Rýchly výber bežného liečiva (ŠVPS SR katalóg)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyDrugTemplate(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Vyberte registrované liečivo alebo zadajte manuálne --</option>
                  {COMMON_VETERINARY_DRUGS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.activeSubstance}) — mäso: {d.meatWithdrawalDays} d | mlieko: {d.milkWithdrawalDays} d
                    </option>
                  ))}
                </select>
              </div>

              {/* Animal category & Medication */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Kategória zvieraťa
                  </label>
                  <select
                    value={targetAnimalType}
                    onChange={(e) => setTargetAnimalType(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="bovine">Hovädzí dobytok (bovinný)</option>
                    <option value="porcine">Ošípané (porcínny)</option>
                    <option value="ovine">Ovce a kozy (ovinný)</option>
                    <option value="equine">Kone (ekvinný)</option>
                    <option value="poultry">Hydina</option>
                    <option value="companion">Spoločenské zviera</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Výrobná šarža liečiva (Lot No.)
                  </label>
                  <Input
                    placeholder="napr. LOT-2026-44"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Presný názov podaného liečiva <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="napr. Draxxin 100 mg/ml inj."
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Days & Administered date */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    OL Mäso (v dňoch)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={meatWithdrawalDays}
                    onChange={(e) => setMeatWithdrawalDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    OL Mlieko (v dňoch)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={milkWithdrawalDays}
                    onChange={(e) => setMilkWithdrawalDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Dátum aplikácie
                  </label>
                  <Input
                    type="datetime-local"
                    value={administeredAt}
                    onChange={(e) => setAdministeredAt(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Real-time calculated box */}
              <div className="rounded-lg border border-amber-300 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                    Vypočítaný koniec ochrannej lehoty (Safe Until):
                  </div>
                  <div className="text-sm font-bold text-amber-800 dark:text-amber-300 font-mono mt-0.5">
                    {calculatedSafeUntil.safeUntilFormatted} ({calculatedSafeUntil.maxDays} dní)
                  </div>
                </div>
                <Badge variant="outline" className="bg-white/80 dark:bg-transparent text-amber-800 border-amber-400">
                  {calculatedSafeUntil.maxDays > 0 ? "Ochranná lehota platná" : "Bez ochrannej lehoty"}
                </Badge>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Poznámky / Dávkovanie / Dôvod podania
                </label>
                <Input
                  placeholder="napr. Aplikované 15 ml i.m. do krčnej svaloviny"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewDialogOpen(false)}
                className="h-9 text-xs"
              >
                Zrušiť
              </Button>
              <Button
                size="sm"
                disabled={!selectedPatientId || !medicationName.trim() || createMutation.isPending}
                onClick={() => {
                  createMutation.mutate({
                    patientId: selectedPatientId,
                    medicationName: medicationName.trim(),
                    batchNumber: batchNumber.trim() || undefined,
                    targetAnimalType,
                    meatWithdrawalDays,
                    milkWithdrawalDays,
                    administeredAt: new Date(administeredAt).toISOString(),
                    notes: notes.trim() || undefined,
                  });
                }}
                className="h-9 text-xs font-semibold gap-1.5"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Uložiť a stanoviť lehotu</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
