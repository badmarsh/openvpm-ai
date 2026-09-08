"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  Skull,
  Plus,
  Printer,
  Download,
  Loader2,
  Search,
  CheckCircle2,
  Calendar,
  X,
  Building2,
  Scale,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

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

function downloadCarcassCsv(
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

export function CarcassDisposalPanel() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Form states
  const [patientId, setPatientId] = useState("");
  const [euthanasiaDate, setEuthanasiaDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [medicationUsed, setMedicationUsed] = useState("T61 / Pentobarbital");
  const [doseAdministered, setDoseAdministered] = useState("");
  const [veterinarianName, setVeterinarianName] = useState(
    session?.user?.name ? `MVDr. ${session.user.name}` : "MVDr."
  );
  const [renderingPlant, setRenderingPlant] = useState("VAS s.r.o. Mojšova Lúčka");
  const [disposalDocumentNumber, setDisposalDocumentNumber] = useState("");
  const [storageLocation, setStorageLocation] = useState("Mraziaci box č. 1");
  const [clientConsentSigned, setClientConsentSigned] = useState(true);
  const [notes, setNotes] = useState("");

  const { data, isLoading, refetch } = trpc.extensions.statutory.listCarcassDisposals.useQuery({
    limit: 100,
  });

  const { data: patientList } = trpc.patients.list.useQuery(
    { limit: 50 },
    { enabled: isNewModalOpen }
  );

  const createMutation = trpc.extensions.statutory.recordCarcassDisposal.useMutation({
    onSuccess: () => {
      toast.success("Záznam o eutanázii a odovzdaní do kafilérie bol úspešne uložený. Pacient bol označený ako uhynutý a bola aktivovaná ochrana Sympathy Gate.");
      setIsNewModalOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(`Chyba pri ukladaní: ${err.message}`);
    },
  });

  const resetForm = () => {
    setPatientId("");
    setEuthanasiaDate(new Date().toISOString().slice(0, 10));
    setReason("");
    setWeightKg("");
    setMedicationUsed("T61 / Pentobarbital");
    setDoseAdministered("");
    setDisposalDocumentNumber("");
    setStorageLocation("Mraziaci box č. 1");
    setClientConsentSigned(true);
    setNotes("");
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const q = search.toLowerCase();
    return data.items.filter(
      (i) =>
        i.patientName.toLowerCase().includes(q) ||
        (i.species && i.species.toLowerCase().includes(q)) ||
        (i.clientLastName && i.clientLastName.toLowerCase().includes(q)) ||
        (i.microchipNumber && i.microchipNumber.toLowerCase().includes(q)) ||
        (i.disposalDocumentNumber && i.disposalDocumentNumber.toLowerCase().includes(q)) ||
        (i.renderingPlant && i.renderingPlant.toLowerCase().includes(q))
    );
  }, [data?.items, search]);

  const handleExportCsv = () => {
    if (!filteredItems.length) return;
    const headers = [
      "Dátum eutanázie / úhynu",
      "Pacient",
      "Druh & Plemeno",
      "Číslo mikročipu",
      "Hmotnosť (kg)",
      "Majiteľ",
      "Telefón majiteľa",
      "Indikácia / Dôvod",
      "Použité liečivo & Dávka",
      "Veterinárny lekár",
      "Kafiléria / Asanačný podnik",
      "Číslo sprievodného dokladu",
      "Skladovanie",
      "Súhlas majiteľa",
    ];
    const rows = filteredItems.map((i) => [
      formatDate(i.euthanasiaDate),
      i.patientName,
      `${i.species || ""} ${i.breed ? `(${i.breed})` : ""}`.trim(),
      i.microchipNumber || "Nečipovaný",
      i.weightKg,
      `${i.clientFirstName || ""} ${i.clientLastName || ""}`.trim(),
      i.clientPhone || "—",
      i.reason,
      `${i.medicationUsed} ${i.doseAdministered ? `(${i.doseAdministered})` : ""}`.trim(),
      i.veterinarianName,
      i.renderingPlant,
      i.disposalDocumentNumber || "—",
      i.storageLocation || "—",
      i.clientConsentSigned ? "ÁNO (podpísaný)" : "NIE",
    ]);
    downloadCarcassCsv(
      `evidencia_kafileria_kadavre_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintDisposalSlip = (record: any) => {
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    printWindow.document.write(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <title>Sprievodný doklad na prepravu vedľajších živočíšnych produktov - kadáverov</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #000; padding: 12mm; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { font-size: 13px; text-transform: uppercase; margin: 4px 0; }
    .law-ref { font-size: 9.5px; color: #333; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10.5px; }
    th, td { border: 1px solid #777; padding: 5px 8px; text-align: left; }
    th { background: #f0f0f0; width: 35%; font-weight: bold; }
    .box { border: 1px solid #000; padding: 8px; margin: 10px 0; border-radius: 2px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 30px; }
    .sig-box { width: 45%; border-top: 1px dotted #000; text-align: center; font-size: 9.5px; padding-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <strong>ŠTÁTNA VETERINÁRNA A POTRAVINOVÁ SPRÁVA SLOVENSKEJ REPUBLIKY</strong><br/>
    <h1>Záznam o eutanázii a odovzdaní kadáveru do spracovateľského závodu (Kafilérie)</h1>
    <div class="law-ref">V zmysle § 29 a § 39 zákona č. 39/2007 Z. z. a Nariadenia (ES) č. 1069/2009 (Materiál Kategórie 1)</div>
  </div>

  <table>
    <tr><th>Dátum eutanázie / úhynu:</th><td><strong>${formatDate(record.euthanasiaDate)}</strong></td></tr>
    <tr><th>Meno pacienta & Druh:</th><td><strong>${record.patientName}</strong> (${record.species} ${record.breed ? `• ${record.breed}` : ""})</td></tr>
    <tr><th>Číslo mikročipu:</th><td><strong>${record.microchipNumber || "Nečipovaný"}</strong></td></tr>
    <tr><th>Hmotnosť tela (kadáveru):</th><td><strong>${record.weightKg} kg</strong></td></tr>
    <tr><th>Majiteľ / Držiteľ:</th><td>${record.clientFirstName || ""} ${record.clientLastName || ""} (${record.clientPhone || "—"})</td></tr>
    <tr><th>Indikácia eutanázie:</th><td>${record.reason}</td></tr>
    <tr><th>Použité liečivo:</th><td>${record.medicationUsed} ${record.doseAdministered ? `(${record.doseAdministered})` : ""}</td></tr>
    <tr><th>Ošetrujúci veterinárny lekár:</th><td><strong>${record.veterinarianName}</strong></td></tr>
    <tr><th>Spracovateľský závod (Kafiléria):</th><td><strong>${record.renderingPlant}</strong></td></tr>
    <tr><th>Číslo sprievodného / zberného listu:</th><td>${record.disposalDocumentNumber || "______________________"}</td></tr>
    <tr><th>Spôsob dočasného uloženia:</th><td>${record.storageLocation || "Kafilérny mraziaci box"}</td></tr>
    <tr><th>Písomný súhlas majiteľa:</th><td>${record.clientConsentSigned ? "Áno - podpísaný a archivovaný" : "Záznam bez podpisu"}</td></tr>
  </table>

  <div class="box">
    <strong>Vyhlásenie veterinárneho lekára:</strong><br/>
    Potvrdzujem, že uvedené zviera bolo utratené z humánnych/zdravotných dôvodov a jeho telo bolo v súlade so zákonom č. 39/2007 Z. z. zaradené ako vedľajší živočíšny produkt Kategórie 1 určený na bezpečné zneškodnenie v asanačnom zariadení.
  </div>

  <div class="sig-row">
    <div class="sig-box">
      Vlastník / Držiteľ zvieraťa<br/>(podpis potvrdzujúci súhlas s eutanáziou a asanáciou)
    </div>
    <div class="sig-box">
      MVDr. / Veterinárny lekár<br/>(podpis a odtlačok úradnej pečiatky)
    </div>
  </div>

  <div style="margin-top: 30px; font-size: 8.5px; text-align: center; color: #666;">
    Vytlačené dňa: ${todayStr} • OpenVPM Slovenská Veterinárna Compliance
  </div>
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleOpenNewModal = () => {
    if (session?.user?.name) {
      setVeterinarianName(`MVDr. ${session.user.name}`);
    }
    setIsNewModalOpen(true);
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error("Prosím vyberte pacienta.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Prosím uveďte indikáciu/dôvod eutanázie.");
      return;
    }
    if (!weightKg.trim()) {
      toast.error("Prosím zadajte hmotnosť v kg.");
      return;
    }

    createMutation.mutate({
      patientId,
      euthanasiaDate,
      reason,
      weightKg,
      medicationUsed,
      doseAdministered: doseAdministered || undefined,
      veterinarianName,
      renderingPlant,
      disposalDocumentNumber: disposalDocumentNumber || undefined,
      storageLocation: storageLocation || undefined,
      clientConsentSigned,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              Evidencia kadáverov a zber kafilériou (§ 29 zákona č. 39/2007 Z. z.)
            </h3>
            <Badge variant="outline" className="text-[10px] border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              Kafiléria & Asanácia
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zákonná evidencia tiel uhynutých a utratených zvierat (vedľajšie živočíšne produkty Kat. 1) odovzdaných na neškodné odstránenie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!filteredItems.length}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNewModal}
            className="gap-1.5 text-xs bg-rose-700 hover:bg-rose-800 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Zaevidovať eutanáziu / kadáver</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa zvieraťa, čipu, majiteľa, čísla zberného listu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Celkom záznamov: <strong>{filteredItems.length}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredItems.length ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            Žiadne záznamy o eutanáziách a kadáveroch neboli nájdené.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum eutanázie</th>
                  <th className="p-3">Zviera & Druh</th>
                  <th className="p-3">Čip</th>
                  <th className="p-3">Hmotnosť</th>
                  <th className="p-3">Majiteľ</th>
                  <th className="p-3">Dôvod / Indikácia</th>
                  <th className="p-3">Liečivo</th>
                  <th className="p-3">Kafiléria & Zberný list</th>
                  <th className="p-3">Skladovanie</th>
                  <th className="p-3 text-right">Tlač dokladu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium whitespace-nowrap">
                      {formatDate(r.euthanasiaDate)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Skull className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.patientName}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.species} {r.breed ? `• ${r.breed}` : ""}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {r.microchipNumber || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-foreground">
                      {r.weightKg} kg
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        {r.clientFirstName} {r.clientLastName}
                      </div>
                      {r.clientPhone && (
                        <div className="text-[11px] text-muted-foreground">{r.clientPhone}</div>
                      )}
                    </td>
                    <td className="p-3 max-w-[200px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.medicationUsed}</div>
                      {r.doseAdministered && (
                        <div className="text-[11px] text-muted-foreground">Dávka: {r.doseAdministered}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{r.renderingPlant}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.disposalDocumentNumber ? `List: ${r.disposalDocumentNumber}` : "Čaká na odvoz"}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground text-[11px]">
                      {r.storageLocation || "Mraziaci box"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintDisposalSlip(r)}
                        className="h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/10"
                        title="Vytlačiť sprievodný doklad pre kafilériu a RVPS"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Tlačiť</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Carcass Disposal Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Skull className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-base">Záznam o eutanázii a odovzdaní kadáveru</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsNewModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmitNew} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200">
                <strong>Upozornenie (Clinical Sympathy Gate):</strong> Uložením tohto záznamu bude pacient trvalo označený ako uhynutý, automaticky sa zrušia všetky preventívne pripomienky a aktivuje sa ochrana pred marketingovou komunikáciou voči majiteľovi.
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Výber pacienta *
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Vyberte pacienta --</option>
                  {patientList?.items?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species} {p.breed ? `• ${p.breed}` : ""}) {p.microchipNumber ? `• Čip: ${p.microchipNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Dátum eutanázie *</label>
                  <Input
                    type="date"
                    className="mt-1 text-xs"
                    value={euthanasiaDate}
                    onChange={(e) => setEuthanasiaDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Hmotnosť tela (kg) *</label>
                  <Input
                    type="text"
                    placeholder="napr. 14.50"
                    className="mt-1 text-xs"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Indikácia / Zdravotný dôvod utratenia *</label>
                <Input
                  placeholder="napr. Terminálne zlyhanie obličiek, polytrauma nezlučiteľná so životom"
                  className="mt-1 text-xs"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Použité letálne liečivo</label>
                  <Input
                    className="mt-1 text-xs"
                    value={medicationUsed}
                    onChange={(e) => setMedicationUsed(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Podaná dávka</label>
                  <Input
                    placeholder="napr. 12 ml i.v."
                    className="mt-1 text-xs"
                    value={doseAdministered}
                    onChange={(e) => setDoseAdministered(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Veterinárny lekár *</label>
                  <Input
                    className="mt-1 text-xs"
                    value={veterinarianName}
                    onChange={(e) => setVeterinarianName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Asanačný podnik (Kafiléria)</label>
                  <Input
                    className="mt-1 text-xs"
                    value={renderingPlant}
                    onChange={(e) => setRenderingPlant(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Číslo zberného dokladu</label>
                  <Input
                    placeholder="napr. KAF-2026/0412"
                    className="mt-1 text-xs"
                    value={disposalDocumentNumber}
                    onChange={(e) => setDisposalDocumentNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Miesto uloženia do odvozu</label>
                  <Input
                    placeholder="napr. Kafilérny mraziaci box #1"
                    className="mt-1 text-xs"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clientConsent"
                  checked={clientConsentSigned}
                  onChange={(e) => setClientConsentSigned(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="clientConsent" className="text-xs text-foreground font-medium">
                  Majiteľ podpísal informovaný písomný súhlas s eutanáziou a odovzdaním tela
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Poznámka / Doplňujúce záznamy</label>
                <Input
                  placeholder="Voliteľná poznámka..."
                  className="mt-1 text-xs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewModalOpen(false)}
                >
                  Zrušiť
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending}
                  className="gap-1.5 bg-rose-700 hover:bg-rose-800 text-white"
                >
                  {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Uložiť záznam a aktivovať Sympathy Gate</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
