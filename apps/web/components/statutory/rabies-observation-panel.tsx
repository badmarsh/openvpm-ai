"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Plus,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

export function RabiesObservationPanel() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [checkpointModalObs, setCheckpointModalObs] = useState<any | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<"day1" | "day5" | "day14">("day1");

  // New Observation Form State
  const [newPatientId, setNewPatientId] = useState("");
  const [newBiteDate, setNewBiteDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInjuredPersonName, setNewInjuredPersonName] = useState("");
  const [newInjuredPersonContact, setNewInjuredPersonContact] = useState("");
  const [newIncidentLocation, setNewIncidentLocation] = useState("");
  const [newIncidentDescription, setNewIncidentDescription] = useState("");

  // Checkpoint Record State
  const [examinedBy, setExaminedBy] = useState("");
  const [examFindings, setExamFindings] = useState(() =>
    t(
      "statutory.rabies.defaultFindings",
      "Animal afebril, no behavioral changes, no hypersalivation or neurological symptoms."
    )
  );
  const [examPassed, setExamPassed] = useState(true);

  const { data, isLoading, refetch } = trpc.extensions.statutory.listRabiesObservations.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    limit: 100,
  });

  const { data: patientList } = trpc.patients.list.useQuery(
    { limit: 50 },
    { enabled: isNewModalOpen }
  );

  const createMutation = trpc.extensions.statutory.createRabiesObservation.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "statutory.rabies.toastCreated",
          "New bite incident and 14-day observation recorded successfully."
        )
      );
      setIsNewModalOpen(false);
      resetNewForm();
      refetch();
    },
    onError: (err) => {
      toast.error(
        t("statutory.rabies.errorSave", "Error saving: {message}", {
          message: err.message,
        })
      );
    },
  });

  const checkpointMutation = trpc.extensions.statutory.recordRabiesCheckpoint.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "statutory.rabies.toastCheckpointSaved",
          "Clinical examination recorded successfully."
        )
      );
      setCheckpointModalObs(null);
      refetch();
    },
    onError: (err) => {
      toast.error(
        t("statutory.rabies.errorRecord", "Error recording: {message}", {
          message: err.message,
        })
      );
    },
  });

  const resetNewForm = () => {
    setNewPatientId("");
    setNewBiteDate(new Date().toISOString().slice(0, 10));
    setNewInjuredPersonName("");
    setNewInjuredPersonContact("");
    setNewIncidentLocation("");
    setNewIncidentDescription("");
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const q = search.toLowerCase();
    return data.items.filter(
      (i) =>
        i.patientName.toLowerCase().includes(q) ||
        i.injuredPersonName.toLowerCase().includes(q) ||
        (i.species && i.species.toLowerCase().includes(q)) ||
        (i.clientLastName && i.clientLastName.toLowerCase().includes(q)) ||
        (i.microchipNumber && i.microchipNumber.toLowerCase().includes(q))
    );
  }, [data?.items, search]);

  const handlePrintCertificate = (obs: any) => {
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
  <title>Veterinárne potvrdenie o klinickom vyšetrení psa / zvieraťa</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.5; padding: 25mm 20mm; color: #000; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 17px; text-transform: uppercase; margin: 0 0 6px 0; }
    .header h2 { font-size: 14px; font-weight: normal; margin: 0; }
    .meta-box { border: 1px solid #000; padding: 10px; margin: 16px 0; background: #fafafa; font-size: 12px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .section-title { font-weight: bold; text-decoration: underline; margin: 16px 0 6px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { background: #eee; }
    .cert-box { border: 2px solid #000; padding: 12px; margin: 20px 0; text-align: center; font-size: 14px; font-weight: bold; background: #f0fdf4; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; width: 220px; text-align: center; font-size: 11px; padding-top: 4px; margin-top: 50px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>POTVRDENIE O VYŠETRENÍ ZVIERAŤA, KTORÉ PORANILO ČLOVEKA</h1>
    <h2>V zmysle § 19 ods. 2 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti</h2>
    <p style="font-size: 11px; margin: 4px 0 0 0;">Číslo potvrdenia: <strong>${obs.certificateNumber || "BES-" + new Date().getFullYear() + "-001"}</strong></p>
  </div>

  <div class="meta-box">
    <div class="meta-row"><span><strong>Poranená osoba:</strong> ${obs.injuredPersonName}</span><span><strong>Kontakt:</strong> ${obs.injuredPersonContact || "—"}</span></div>
    <div class="meta-row"><span><strong>Dátum incidentu:</strong> ${formatDate(obs.biteDate)}</span><span><strong>Miesto:</strong> ${obs.incidentLocation || "—"}</span></div>
    <div><strong>Okolnosti poranenia:</strong> ${obs.incidentDescription || "Pohryznutie človeka"}</div>
  </div>

  <div class="meta-box">
    <div class="meta-row"><span><strong>Vyšetrené zviera:</strong> ${obs.patientName} (${obs.species} - ${obs.breed || "kríženec"})</span><span><strong>Číslo čipu:</strong> ${obs.microchipNumber || "Nečipovaný"}</span></div>
    <div class="meta-row"><span><strong>Majiteľ zvieraťa:</strong> ${obs.clientFirstName || ""} ${obs.clientLastName || ""}</span><span><strong>Telefón:</strong> ${obs.clientPhone || "—"}</span></div>
  </div>

  <div class="section-title">Záznam o vykonaných povinných klinických vyšetreniach:</div>
  <table>
    <thead>
      <tr>
        <th>Fáza vyšetrenia</th>
        <th>Dátum & Čas</th>
        <th>Vyšetrujúci veterinárny lekár</th>
        <th>Klinický nález</th>
        <th>Výsledok</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. vyšetrenie (1. deň)</strong></td>
        <td>${formatDateTime(obs.day1ExaminedAt)}</td>
        <td>${obs.day1ExaminedBy || "—"}</td>
        <td>${obs.day1Findings || "—"}</td>
        <td><strong>${obs.day1Passed ? "Bez príznakov" : "Podozrivé"}</strong></td>
      </tr>
      <tr>
        <td><strong>2. vyšetrenie (5. deň)</strong></td>
        <td>${formatDateTime(obs.day5ExaminedAt)}</td>
        <td>${obs.day5ExaminedBy || "—"}</td>
        <td>${obs.day5Findings || "—"}</td>
        <td><strong>${obs.day5Passed ? "Bez príznakov" : "Podozrivé"}</strong></td>
      </tr>
      <tr>
        <td><strong>3. vyšetrenie (14. deň)</strong></td>
        <td>${formatDateTime(obs.day14ExaminedAt)}</td>
        <td>${obs.day14ExaminedBy || "—"}</td>
        <td>${obs.day14Findings || "—"}</td>
        <td><strong>${obs.day14Passed ? "Bez príznakov" : "Podozrivé"}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="cert-box">
    ZÁVER: ZVIERA NEPREJAVUJE ŽIADNE ZNÁMKY BESNOTY.<br/>
    <span style="font-size: 12px; font-weight: normal;">Po ukončení 14-dňového klinického pozorovania sa vylučuje prenos vírusu besnoty v čase poranenia.</span>
  </div>

  <div class="footer">
    <div>Dátum vystavenia: <strong>${todayStr}</strong></div>
    <div class="sig-line">Pečiatka a podpis veterinárneho lekára</div>
  </div>
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("statutory.rabies.title", "14-Day Clinical Rabies Observation")}
            </h2>
            <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30 text-xs">
              {t("statutory.rabies.statute", "§ 19 of Act No. 39/2007 Coll.")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "statutory.rabies.subtitle",
              "Mandatory three-stage examination (day 1, 5, and 14) of an animal that injured a human to rule out rabies."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {t("statutory.rabies.btnRecordBite", "Record Animal Bite")}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t(
                "statutory.rabies.searchPlaceholder",
                "Search patient, injured person, microchip..."
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { key: "all", label: t("statutory.rabies.filterAll", "All") },
              {
                key: "IN_PROGRESS",
                label: t("statutory.rabies.filterInProgress", "In Observation"),
              },
              {
                key: "COMPLETED_HEALTHY",
                label: t("statutory.rabies.filterCompleted", "Rabies Ruled Out"),
              },
              {
                key: "SUSPICIOUS",
                label: t("statutory.rabies.filterSuspicious", "Suspicious"),
              },
            ].map((st) => (
              <Button
                key={st.key}
                variant={statusFilter === st.key ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setStatusFilter(st.key)}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {t("statutory.rabies.totalCases", "Total cases: {count}", {
            count: filteredItems.length,
          })}
        </div>
      </div>

      {/* Observations Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredItems.length ? (
          <div className="p-12 text-center text-muted-foreground text-sm space-y-2">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">
              {t(
                "statutory.rabies.emptyTitle",
                "No active rabies observation cases"
              )}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t(
                "statutory.rabies.emptySubtitle",
                "All cases of animal bite injury to humans are recorded pursuant to § 19 of Act No. 39/2007 Coll."
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">{t("statutory.rabies.colIncidentDate", "Incident Date")}</th>
                  <th className="p-3">{t("statutory.rabies.colAnimalOwner", "Animal & Owner")}</th>
                  <th className="p-3">{t("statutory.rabies.colInjuredPerson", "Injured Person")}</th>
                  <th className="p-3 text-center">{t("statutory.rabies.colDay1", "Day 1")}</th>
                  <th className="p-3 text-center">{t("statutory.rabies.colDay5", "Day 5")}</th>
                  <th className="p-3 text-center">{t("statutory.rabies.colDay14", "Day 14")}</th>
                  <th className="p-3">{t("statutory.rabies.colStatus", "Status")}</th>
                  <th className="p-3 text-right">{t("statutory.rabies.colActions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((obs) => {
                  const isCompleted = obs.status === "COMPLETED_HEALTHY";
                  const isSuspicious = obs.status === "SUSPICIOUS";

                  return (
                    <tr key={obs.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">
                        {formatDate(obs.biteDate)}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{obs.patientName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {obs.species} • {obs.breed || t("statutory.rabies.mixedBreed", "Mixed breed")}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/80">
                          {obs.microchipNumber || t("statutory.rabies.noChip", "Unchipped")}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{obs.injuredPersonName}</div>
                        <div className="text-[11px] text-muted-foreground">{obs.injuredPersonContact || "—"}</div>
                      </td>

                      {/* Checkpoint Day 1 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {obs.day1ExaminedAt ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {formatDate(obs.day1ExaminedAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            {t("statutory.rabies.badgeWaiting", "Pending")}
                          </Badge>
                        )}
                      </td>

                      {/* Checkpoint Day 5 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {obs.day5ExaminedAt ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {formatDate(obs.day5ExaminedAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                            —
                          </Badge>
                        )}
                      </td>

                      {/* Checkpoint Day 14 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {obs.day14ExaminedAt ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {formatDate(obs.day14ExaminedAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                            —
                          </Badge>
                        )}
                      </td>

                      {/* Overall Status */}
                      <td className="p-3 whitespace-nowrap">
                        {isCompleted ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                            {t("statutory.rabies.statusRuledOut", "Rabies Ruled Out")}
                          </Badge>
                        ) : isSuspicious ? (
                          <Badge variant="destructive" className="text-[10px] font-semibold gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t("statutory.rabies.statusSuspiciousRvps", "Suspicious (RVPS)")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px] font-semibold">
                            {t("statutory.rabies.statusInObservation", "In Observation")}
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCompleted && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => {
                                setCheckpointModalObs(obs);
                                setSelectedCheckpoint(
                                  !obs.day1ExaminedAt ? "day1" : !obs.day5ExaminedAt ? "day5" : "day14"
                                );
                              }}
                            >
                              {t("statutory.rabies.btnRecordExam", "Record Check")}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => handlePrintCertificate(obs)}
                            title={t("statutory.rabies.btnPrintTitle", "Print veterinary certificate")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            {t("statutory.rabies.btnCertificate", "Certificate")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Nový prípad pohryznutia */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="fixed inset-0" onClick={() => setIsNewModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-base text-foreground">
                  {t("statutory.rabies.modalNewTitle", "New Animal Bite Injury Case")}
                </h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-foreground">
                  {t("statutory.rabies.fieldSelectPatient", "Select animal (patient) *")}
                </label>
                <select
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs"
                >
                  <option value="">{t("statutory.rabies.optionSelectPatient", "-- Select patient --")}</option>
                  {patientList?.items?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species} • {p.microchipNumber || t("statutory.rabies.noChip", "Unchipped")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-foreground">
                    {t("statutory.rabies.fieldBiteDate", "Injury / bite date *")}
                  </label>
                  <DatePicker
                    value={newBiteDate}
                    onChange={(val) => setNewBiteDate(val)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">
                    {t("statutory.rabies.fieldInjuredName", "Injured person name *")}
                  </label>
                  <Input
                    placeholder={t("statutory.rabies.placeholderInjuredName", "Full name")}
                    value={newInjuredPersonName}
                    onChange={(e) => setNewInjuredPersonName(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-foreground">
                    {t("statutory.rabies.fieldInjuredContact", "Phone / address of injured person")}
                  </label>
                  <Input
                    placeholder={t("statutory.rabies.placeholderInjuredContact", "+421 9...")}
                    value={newInjuredPersonContact}
                    onChange={(e) => setNewInjuredPersonContact(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">
                    {t("statutory.rabies.fieldIncidentLocation", "Incident location")}
                  </label>
                  <Input
                    placeholder={t("statutory.rabies.placeholderLocation", "e.g. Park, street, backyard...")}
                    value={newIncidentLocation}
                    onChange={(e) => setNewIncidentLocation(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">
                  {t("statutory.rabies.fieldIncidentDesc", "Bite circumstances")}
                </label>
                <Input
                  placeholder={t(
                    "statutory.rabies.placeholderDesc",
                    "Provoked / unprovoked, interaction with other animals..."
                  )}
                  value={newIncidentDescription}
                  onChange={(e) => setNewIncidentDescription(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsNewModalOpen(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!newPatientId || !newInjuredPersonName.trim() || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    patientId: newPatientId,
                    biteDate: newBiteDate,
                    injuredPersonName: newInjuredPersonName.trim(),
                    injuredPersonContact: newInjuredPersonContact.trim() || undefined,
                    incidentLocation: newIncidentLocation.trim() || undefined,
                    incidentDescription: newIncidentDescription.trim() || undefined,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {t("statutory.rabies.btnStartObservation", "Record & Start 14-Day Observation")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Zápis kontrolného vyšetrenia (1., 5. alebo 14. deň) */}
      {checkpointModalObs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="fixed inset-0" onClick={() => setCheckpointModalObs(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-base text-foreground">
                  {t("statutory.rabies.modalCheckpointTitle", "Record Rabies Clinical Examination")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pacient: <strong>{checkpointModalObs.patientName}</strong>
                </p>
              </div>
              <button onClick={() => setCheckpointModalObs(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-foreground">
                  {t("statutory.rabies.fieldLegislationExam", "Examination stage by law")}
                </label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <Button
                    type="button"
                    variant={selectedCheckpoint === "day1" ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedCheckpoint("day1")}
                  >
                    {t("statutory.rabies.stageDay1", "Day 1")}
                  </Button>
                  <Button
                    type="button"
                    variant={selectedCheckpoint === "day5" ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedCheckpoint("day5")}
                  >
                    {t("statutory.rabies.stageDay5", "Day 5")}
                  </Button>
                  <Button
                    type="button"
                    variant={selectedCheckpoint === "day14" ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedCheckpoint("day14")}
                  >
                    {t("statutory.rabies.stageDay14", "Day 14 (Conclusion)")}
                  </Button>
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">
                  {t("statutory.rabies.fieldVetName", "Examining veterinarian name *")}
                </label>
                <Input
                  placeholder={t("statutory.rabies.placeholderVet", "MVDr. ...")}
                  value={examinedBy}
                  onChange={(e) => setExaminedBy(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">
                  {t("statutory.rabies.fieldFindings", "Clinical findings *")}
                </label>
                <textarea
                  value={examFindings}
                  onChange={(e) => setExamFindings(e.target.value)}
                  rows={3}
                  className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <input
                  type="checkbox"
                  id="examPassed"
                  checked={examPassed}
                  onChange={(e) => setExamPassed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="examPassed" className="text-xs cursor-pointer font-medium text-foreground">
                  {t("statutory.rabies.checkboxHealthy", "Animal is clinically healthy without signs of rabies")}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setCheckpointModalObs(null)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!examinedBy.trim() || !examFindings.trim() || checkpointMutation.isPending}
                onClick={() =>
                  checkpointMutation.mutate({
                    observationId: checkpointModalObs.id,
                    checkpoint: selectedCheckpoint,
                    examinedAt: new Date().toISOString(),
                    examinedBy: examinedBy.trim(),
                    findings: examFindings.trim(),
                    passed: examPassed,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {checkpointMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {t("statutory.rabies.btnRecordCheckpoint", "Record Examination")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
