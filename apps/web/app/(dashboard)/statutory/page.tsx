"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Syringe,
  Skull,
  ShieldAlert,
  Download,
  Printer,
  Search,
  Loader2,
  FileSignature,
  Calendar,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { CrszPanel } from "@/components/statutory/crsz-panel";

type StatutoryTab = "rabies" | "treatment" | "euthanasia" | "narcotics" | "protocols" | "crsz";

function downloadStatutoryCsv(
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

function getRabiesComplianceStatus(
  administeredAt: Date | string | null | undefined,
  createdAt?: Date | string | null | undefined,
) {
  if (!administeredAt) {
    return {
      status: "unknown",
      label: "Neznáme",
      badgeClass: "bg-muted text-muted-foreground border-border",
    };
  }
  const adminDate = new Date(administeredAt);
  const checkDate = createdAt ? new Date(createdAt) : new Date();
  const diffDays = Math.floor(
    (checkDate.getTime() - adminDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 3) {
    return {
      status: "compliant",
      label: "V lehote (≤ 3 dni)",
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  } else {
    return {
      status: "overdue",
      label: `Po lehote (${diffDays} d.)`,
      badgeClass:
        "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
}

function openInspectionPrintView({
  title,
  statutoryReference,
  subtitle,
  headers,
  rows,
  summaryNotes,
}: {
  title: string;
  statutoryReference: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  summaryNotes?: string;
}) {
  const printWindow = window.open("", "_blank", "width=1100,height=850");
  if (!printWindow) return;

  const todayStr = new Date().toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableRows = rows
    .map((row, idx) => {
      const cells = row
        .map(
          (cell) =>
            `<td style="padding: 5px 6px; border: 1px solid #000; vertical-align: top;">${cell ?? "—"}</td>`,
        )
        .join("");
      return `<tr><td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-weight: bold; width: 30px;">${idx + 1}</td>${cells}</tr>`;
    })
    .join("");

  const headerCells = headers
    .map(
      (h) =>
        `<th style="padding: 6px 6px; border: 1px solid #000; background: #eaeaea; text-align: left; font-size: 9px; text-transform: uppercase;">${h}</th>`,
    )
    .join("");

  printWindow.document.write(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 9.5px; color: #000; margin: 0; padding: 10px; }
    .header-box { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .title-box { text-align: center; flex: 1; }
    h1 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-ref { font-size: 9.5px; font-weight: bold; margin-top: 2px; color: #222; }
    .meta-box { font-size: 8.5px; line-height: 1.3; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    .inspection-footer { margin-top: 20px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sig-block { width: 31%; border: 1px solid #666; border-radius: 4px; padding: 6px; height: 75px; position: relative; font-size: 8px; }
    .sig-line { position: absolute; bottom: 6px; left: 6px; right: 6px; border-top: 1px dotted #000; text-align: center; padding-top: 2px; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="meta-box">
      <strong>VETERINÁRNE PRACOVISKO</strong><br/>
      Komora veterinárnych lekárov SR<br/>
      Štátna veterinárna a potravinová správa SR
    </div>
    <div class="title-box">
      <h1>${title}</h1>
      <div class="stat-ref">${statutoryReference}</div>
      ${subtitle ? `<div style="font-size: 8.5px; color: #444; margin-top: 2px;">${subtitle}</div>` : ""}
    </div>
    <div class="meta-box" style="text-align: right;">
      Vytlačené: <strong>${todayStr}</strong><br/>
      Počet záznamov: <strong>${rows.length}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding: 6px 4px; border: 1px solid #000; background: #eaeaea; width: 30px; text-align: center;">P. č.</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${summaryNotes ? `<div style="margin-top: 8px; font-size: 8.5px; color: #333; font-style: italic;">${summaryNotes}</div>` : ""}

  <div class="inspection-footer">
    <div class="sig-block">
      <strong>Ošetrujúci veterinárny lekár:</strong>
      <div class="sig-line">Meno, podpis a odtlačok pečiatky</div>
    </div>
    <div class="sig-block">
      <strong>Regionálna veterinárna a potravinová správa (RVPS):</strong>
      <div class="sig-line">Záznam o overení knihy / Dátum</div>
    </div>
    <div class="sig-block">
      <strong>Inšpekčný orgán ŠVPS SR:</strong>
      <div class="sig-line">Dátum inšpekcie a podpis inšpektora</div>
    </div>
  </div>
</body>
</html>`);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}

function printRabiesBiteInspectionReport(opts?: {
  patientName?: string;
  species?: string;
  breed?: string;
  microchipNumber?: string;
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  vaccineName?: string;
  lotNumber?: string;
  administeredAt?: string | Date | null;
}) {
  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (!printWindow) return;

  const todayStr = new Date().toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const lastVax = opts?.administeredAt ? formatDate(opts.administeredAt) : "________________";
  const patientDesc = [opts?.species, opts?.breed].filter(Boolean).join(" • ") || "Pes / Mačka";

  printWindow.document.write(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <title>Hlásenie o vyšetrení zvieraťa po poranení človeka - RVPS</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.45; color: #000; margin: 0; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    .org-title { font-size: 11px; font-weight: bold; text-transform: uppercase; }
    h1 { font-size: 13.5px; text-transform: uppercase; margin: 6px 0 2px 0; letter-spacing: 0.5px; }
    .law-ref { font-size: 9.5px; font-style: italic; color: #333; }
    .section-title { font-size: 10.5px; font-weight: bold; text-transform: uppercase; background: #eaeaea; padding: 3px 6px; border: 1px solid #000; margin-top: 10px; margin-bottom: 6px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.data-table td { padding: 4px 6px; border: 1px solid #999; font-size: 10px; }
    table.data-table td.label { font-weight: bold; width: 35%; background: #f9f9f9; }
    .box { border: 1px solid #000; padding: 8px; border-radius: 2px; margin-bottom: 8px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 25px; }
    .sig-box { width: 45%; border-top: 1px dotted #000; text-align: center; font-size: 9.5px; padding-top: 4px; }
    .notice { font-size: 9px; color: #444; border-left: 3px solid #000; padding-left: 6px; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-title">Štátna veterinárna a potravinová správa Slovenskej republiky</div>
    <div style="font-size: 10px; font-weight: bold;">Regionálna veterinárna a potravinová správa (RVPS)</div>
    <h1>Oznámenie a záznam o klinickom vyšetrení zvieraťa, ktoré poranilo človeka</h1>
    <div class="law-ref">V zmysle § 17 ods. 1 písm. b) a § 19 ods. 1 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti</div>
  </div>

  <div class="notice">
    <strong>Zákonná lehota:</strong> Držiteľ je povinný dať zviera vyšetriť veterinárnym lekárom v 1. deň po poranení a opakovane v 5. a 14. deň pozorovania. Výsledok vyšetrenia sa bezodkladne zasiela ošetrujúcemu lekárovi poškodeného a príslušnej RVPS.
  </div>

  <div class="section-title">I. Identifikácia vyšetrovaného zvieraťa</div>
  <table class="data-table">
    <tr><td class="label">Meno zvieraťa:</td><td><strong>${opts?.patientName || "________________"}</strong></td><td class="label">Druh a plemeno:</td><td>${patientDesc}</td></tr>
    <tr><td class="label">Číslo mikročipu:</td><td><strong>${opts?.microchipNumber || "________________"}</strong></td><td class="label">Pohlavie a vek:</td><td>________________</td></tr>
    <tr><td class="label">Číslo PetPassu / známky:</td><td>________________</td><td class="label">Farba:</td><td>________________</td></tr>
  </table>

  <div class="section-title">II. Vlastník / Držiteľ zvieraťa</div>
  <table class="data-table">
    <tr><td class="label">Meno a priezvisko:</td><td><strong>${opts?.clientName || "________________"}</strong></td></tr>
    <tr><td class="label">Trvalé bydlisko:</td><td>${opts?.clientAddress || "________________"}</td></tr>
    <tr><td class="label">Telefónny kontakt:</td><td>${opts?.clientPhone || "________________"}</td></tr>
  </table>

  <div class="section-title">III. Údaje o poranenej osobe a udalosti</div>
  <table class="data-table">
    <tr><td class="label">Meno a priezvisko poranenej osoby:</td><td>________________________________________________</td></tr>
    <tr><td class="label">Bydlisko a kontakt poraneného:</td><td>________________________________________________</td></tr>
    <tr><td class="label">Dátum, čas a miesto poranenia:</td><td>Dátum: ______________ o ______ hod., Miesto: ____________________</td></tr>
    <tr><td class="label">Charakter poranenia / lokalizácia:</td><td>pohryznutie / poškriabanie: ________________________________</td></tr>
    <tr><td class="label">Ošetrujúci lekár (zdravotnícke zariadenie):</td><td>________________________________________________</td></tr>
  </table>

  <div class="section-title">IV. Predchádzajúca vakcinácia zvieraťa proti besnote</div>
  <table class="data-table">
    <tr><td class="label">Dátum posledného očkovania:</td><td><strong>${lastVax}</strong></td><td class="label">Názov vakcíny a šarža:</td><td>${opts?.vaccineName || "________________"} ${opts?.lotNumber ? `(šarža: ${opts.lotNumber})` : ""}</td></tr>
  </table>

  <div class="section-title">V. Protokol o klinickom pozorovaní zvieraťa (14-dňová lehota)</div>
  <table class="data-table">
    <tr>
      <th style="border: 1px solid #999; padding: 4px; background: #f2f2f2; width: 25%;">Etapa vyšetrenia</th>
      <th style="border: 1px solid #999; padding: 4px; background: #f2f2f2; width: 20%;">Dátum vyšetrenia</th>
      <th style="border: 1px solid #999; padding: 4px; background: #f2f2f2; width: 15%;">Teplota (°C)</th>
      <th style="border: 1px solid #999; padding: 4px; background: #f2f2f2; width: 40%;">Klinický nález a správanie</th>
    </tr>
    <tr>
      <td><strong>1. vyšetrenie</strong> (1. deň / nahlásenie)</td>
      <td>${todayStr}</td>
      <td>_____ °C</td>
      <td>Zviera klinicky zdravé, bez príznakov zmeny správania alebo nervových porúch.</td>
    </tr>
    <tr>
      <td><strong>2. vyšetrenie</strong> (5. deň pozorovania)</td>
      <td>________________</td>
      <td>_____ °C</td>
      <td>Zviera klinicky zdravé, normálny príjem potravy a vody, bez slintania či kŕčov.</td>
    </tr>
    <tr>
      <td><strong>3. vyšetrenie</strong> (14. deň – záver)</td>
      <td>________________</td>
      <td>_____ °C</td>
      <td>Ukončenie pozorovania: Zviera živé, zdravé, neprejavuje príznaky besnoty.</td>
    </tr>
  </table>

  <div class="box" style="margin-top: 8px;">
    <strong>ZÁVER VETERINÁRNEHO LEKÁRA:</strong><br/>
    Vyšetrené zviera v čase vyšetrenia <strong>neprejavuje klinické príznaky podozrenia z ochorenia na besnotu</strong>.
    Držiteľovi bolo nariadené domáce izolované pozorovanie zvieraťa s povinnosťou predviesť ho na kontrolné vyšetrenia.
  </div>

  <div class="sig-row">
    <div class="sig-box">
      Vlastník / Držiteľ zvieraťa<br/>(podpis potvrdzujúci prevzatie poučenia)
    </div>
    <div class="sig-box">
      Ošetrujúci veterinárny lekár<br/>(odtlačok úradnej pečiatky a podpis)
    </div>
  </div>

  <div style="margin-top: 20px; font-size: 8.5px; text-align: center; color: #555;">
    Kópia: 1x Vlastník zvieraťa | 1x Zdravotnícke zariadenie ošetrujúceho lekára | 1x Príslušná RVPS SR | 1x Archív veterinárneho lekára
  </div>
</body>
</html>`);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}

export default function StatutoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<StatutoryTab>("rabies");

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = session?.user?.role;
  const isAuthorized = role === "admin" || role === "veterinarian";

  if (!isAuthorized) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("statutory.restrictedTitle", "Prístup obmedzený")}
        description={t(
          "statutory.restrictedDesc",
          "Zákonné knihy a registre sú prístupné len pre veterinárnych lekárov a správcov praxe."
        )}
        action={{
          label: t("statutory.backToDashboard", "Späť na prehľad"),
          onClick: () => router.push("/"),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("statutory.title", "Zákonné knihy a registre")}
            </h1>
            <Badge variant="outline" className="text-xs font-normal border-primary/40 text-primary">
              ŠVPS SR / KVL SR
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "statutory.subtitle",
              "Evidencia v zmysle zákona č. 39/2007 Z. z. o veterinárnej starostlivosti a zákona č. 139/1998 Z. z."
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <Button
          variant={activeTab === "rabies" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("rabies")}
          className="gap-2"
        >
          <Syringe className="h-4 w-4" />
          <span>{t("statutory.tabs.rabies", "Kniha besnoty")}</span>
        </Button>
        <Button
          variant={activeTab === "treatment" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("treatment")}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          <span>{t("statutory.tabs.treatment", "Kniha ošetrení")}</span>
        </Button>
        <Button
          variant={activeTab === "euthanasia" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("euthanasia")}
          className="gap-2"
        >
          <Skull className="h-4 w-4" />
          <span>{t("statutory.tabs.euthanasia", "Register eutanázií")}</span>
        </Button>
        <Button
          variant={activeTab === "narcotics" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("narcotics")}
          className="gap-2"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>{t("statutory.tabs.narcotics", "Kontrolované látky")}</span>
        </Button>
        <Button
          variant={activeTab === "protocols" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("protocols")}
          className="gap-2"
        >
          <FileSignature className="h-4 w-4" />
          <span>{t("statutory.tabs.protocols", "Zákonné protokoly & formuláre")}</span>
        </Button>
        <Button
          variant={activeTab === "crsz" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("crsz")}
          className="gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{t("statutory.tabs.crsz", "CRSZ & Mikročipy / PetPass")}</span>
        </Button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "rabies" && <RabiesRegisterTab />}
        {activeTab === "treatment" && <TreatmentDiaryTab />}
        {activeTab === "euthanasia" && <EuthanasiaRegisterTab />}
        {activeTab === "narcotics" && <NarcoticsTab />}
        {activeTab === "protocols" && <ProtocolsTab />}
        {activeTab === "crsz" && <CrszPanel />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Rabies Register (Kniha besnoty)
// ---------------------------------------------------------------------------
function RabiesRegisterTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "compliant" | "overdue">("all");

  const { data, isLoading } = trpc.reports.rabiesRegister.useQuery({
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 200,
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (complianceFilter === "all") return data.items;
    return data.items.filter((item) => {
      const comp = getRabiesComplianceStatus(item.administeredAt, item.createdAt);
      return comp.status === complianceFilter;
    });
  }, [data?.items, complianceFilter]);

  const handleExportCsv = () => {
    if (!filteredItems.length) return;
    const headers = [
      "Dátum vakcinácie",
      "Pacient",
      "Druh",
      "Plemeno",
      "Číslo mikročipu",
      "Vakcína",
      "Šarža (Lot)",
      "Expirácia vakcíny",
      "Termín revakcinácie",
      "Zvierací pas / Známka",
      "Majiteľ",
      "Adresa majiteľa",
      "Telefón majiteľa",
      "Zákonná lehota RVPS (3 dni)",
    ];
    const rows = filteredItems.map((item) => {
      const comp = getRabiesComplianceStatus(item.administeredAt, item.createdAt);
      return [
        formatDate(item.administeredAt),
        item.patientName,
        item.species,
        item.breed || "—",
        item.microchipNumber || "Nečipovaný",
        item.vaccineName,
        item.lotNumber || "—",
        formatDate(item.productExpirationDate),
        formatDate(item.nextDueDate),
        item.rabiesTagNumber || "—",
        `${item.clientFirstName || ""} ${item.clientLastName}`.trim(),
        `${item.clientAddress || ""}, ${item.clientCity || ""}`.trim(),
        item.clientPhone || "—",
        comp.label,
      ];
    });
    downloadStatutoryCsv(
      `kniha_ockovania_besnota_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintInspection = () => {
    if (!filteredItems.length) return;
    const headers = [
      "Dátum vakcinácie",
      "Meno pacienta",
      "Druh & Plemeno",
      "Číslo mikročipu",
      "Vakcína / Šarža",
      "Revakcinácia",
      "Vlastník zvieraťa",
      "Bydlisko & Telefón",
      "Lehota RVPS (3 dni)",
    ];
    const rows = filteredItems.map((item) => {
      const comp = getRabiesComplianceStatus(item.administeredAt, item.createdAt);
      return [
        formatDate(item.administeredAt),
        item.patientName,
        `${item.species}${item.breed ? ` • ${item.breed}` : ""}`,
        item.microchipNumber || "Nečipovaný",
        `${item.vaccineName}${item.lotNumber ? ` (šarža: ${item.lotNumber})` : ""}`,
        formatDate(item.nextDueDate),
        `${item.clientFirstName || ""} ${item.clientLastName}`.trim(),
        `${item.clientAddress || ""}, ${item.clientCity || ""} (${item.clientPhone || "—"})`.trim(),
        comp.label,
      ];
    });
    openInspectionPrintView({
      title: "Úradná Kniha Očkovania Zvierat Proti Besnote",
      statutoryReference: "Evidencia v zmysle § 19 ods. 1 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti",
      subtitle: "Zákonný výkaz pre inšpekčné kontroly Regionálnej veterinárnej a potravinovej správy (RVPS) a CRSZ",
      headers,
      rows,
      summaryNotes: "Zákonná povinnosť: Veterinárny lekár je povinný nahlásiť vakcináciu proti besnote do CRSZ a RVPS do 3 pracovných dní od aplikácie.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("statutory.rabies.searchPlaceholder", "Hľadať pacienta, čip alebo majiteľa...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
            <span>do</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!filteredItems.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{t("statutory.exportCsv", "Export pre RVPS (CSV)")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintInspection}
            disabled={!filteredItems.length}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Tlačiť úradný výkaz</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              printRabiesBiteInspectionReport(
                filteredItems[0]
                  ? {
                      patientName: filteredItems[0].patientName,
                      species: filteredItems[0].species,
                      breed: filteredItems[0].breed ?? undefined,
                      microchipNumber: filteredItems[0].microchipNumber ?? undefined,
                      clientName: `${filteredItems[0].clientFirstName || ""} ${filteredItems[0].clientLastName}`.trim(),
                      clientAddress: `${filteredItems[0].clientAddress || ""}, ${filteredItems[0].clientCity || ""}`.trim(),
                      clientPhone: filteredItems[0].clientPhone ?? undefined,
                      vaccineName: filteredItems[0].vaccineName,
                      lotNumber: filteredItems[0].lotNumber ?? undefined,
                      administeredAt: filteredItems[0].administeredAt,
                    }
                  : undefined,
              )
            }
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Hlásenie poranenia (RVPS)</span>
          </Button>
        </div>
      </div>

      {/* Compliance Filter Tabs & Info notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={complianceFilter === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => setComplianceFilter("all")}
          >
            Všetky ({data?.items?.length ?? 0})
          </Button>
          <Button
            variant={complianceFilter === "compliant" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => setComplianceFilter("compliant")}
          >
            V lehote (≤ 3 dni)
          </Button>
          <Button
            variant={complianceFilter === "overdue" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => setComplianceFilter("overdue")}
          >
            Po lehote (&gt; 3 dni)
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Zobrazených: <strong>{filteredItems.length}</strong> záznamov
        </div>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
        <strong>Zákonná povinnosť:</strong> Podľa § 17 ods. 1 písm. b) zákona č. 39/2007 Z. z. je vlastník alebo držiteľ vnímavých mäsožravcov povinný zabezpečiť vakcináciu proti besnote. Veterinárny lekár nahlasuje vakcináciu do CRSZ a RVPS do 3 pracovných dní od aplikácie.
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredItems.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenašli sa žiadne záznamy o vakcinácii proti besnote podľa zadaných kritérií.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum</th>
                  <th className="p-3">Pacient</th>
                  <th className="p-3">Číslo mikročipu</th>
                  <th className="p-3">Vakcína / Šarža</th>
                  <th className="p-3">Revakcinácia</th>
                  <th className="p-3">Majiteľ</th>
                  <th className="p-3">Kontakt</th>
                  <th className="p-3">Lehota RVPS (3 dni)</th>
                  <th className="p-3 text-right">RVPS Tlač</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((r) => {
                  const comp = getRabiesComplianceStatus(r.administeredAt, r.createdAt);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">
                        {formatDate(r.administeredAt)}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{r.patientName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.species} {r.breed ? `• ${r.breed}` : ""}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {r.microchipNumber ? (
                          <span className="text-foreground">{r.microchipNumber}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Nečipovaný</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{r.vaccineName}</div>
                        {r.lotNumber && (
                          <div className="text-[11px] text-muted-foreground">
                            Šarža: {r.lotNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {r.nextDueDate ? (
                          <span className="font-medium text-foreground">
                            {formatDate(r.nextDueDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">
                          {r.clientFirstName} {r.clientLastName}
                        </div>
                        {r.clientCity && (
                          <div className="text-[11px] text-muted-foreground">{r.clientCity}</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {r.clientPhone || "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium border", comp.badgeClass)}
                        >
                          {comp.label}
                        </Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Tlačiť Hlásenie o poranení človeka (RVPS)"
                          onClick={() =>
                            printRabiesBiteInspectionReport({
                              patientName: r.patientName,
                              species: r.species,
                              breed: r.breed ?? undefined,
                              microchipNumber: r.microchipNumber ?? undefined,
                              clientName: `${r.clientFirstName || ""} ${r.clientLastName}`.trim(),
                              clientAddress: `${r.clientAddress || ""}, ${r.clientCity || ""}`.trim(),
                              clientPhone: r.clientPhone ?? undefined,
                              vaccineName: r.vaccineName,
                              lotNumber: r.lotNumber ?? undefined,
                              administeredAt: r.administeredAt,
                            })
                          }
                          className="h-7 gap-1 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Printer className="h-3 w-3" />
                          <span>RVPS</span>
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
      <div className="text-right text-xs text-muted-foreground">
        Celkovo záznamov: {filteredItems.length}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Treatment Diary (Kniha ošetrení / Denník ošetrených zvierat)
// ---------------------------------------------------------------------------
function TreatmentDiaryTab() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.reports.treatmentDiary.useQuery({
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 150,
  });

  const handleExportCsv = () => {
    if (!data?.items?.length) return;
    const headers = [
      "Dátum a čas",
      "Pacient",
      "Druh",
      "Plemeno",
      "Číslo čipu",
      "Majiteľ",
      "Telefón",
      "Ošetrujúci lekár",
      "Diagnóza (Assessment)",
      "Terapia a použité lieky (Plan)",
    ];
    const rows = data.items.map((i) => [
      formatDateTime(i.createdAt),
      i.patientName,
      i.species,
      i.breed || "—",
      i.microchipNumber || "—",
      `${i.clientFirstName || ""} ${i.clientLastName}`.trim(),
      i.clientPhone || "—",
      i.authorName || "—",
      i.assessment || "—",
      i.plan || "—",
    ]);
    downloadStatutoryCsv(
      `dennik_osetrenych_zvierat_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintInspection = () => {
    if (!data?.items?.length) return;
    const headers = [
      "Dátum a čas",
      "Meno pacienta",
      "Druh & Číslo čipu",
      "Vlastník zvieraťa & Kontakt",
      "Ošetrujúci lekár",
      "Klinická diagnóza / Nález",
      "Terapia, liečivá & Ochranná lehota",
    ];
    const rows = data.items.map((i) => [
      formatDateTime(i.createdAt),
      i.patientName,
      `${i.species} (čip: ${i.microchipNumber || "—"})`,
      `${i.clientFirstName || ""} ${i.clientLastName} (${i.clientPhone || "—"})`.trim(),
      i.authorName || "Veterinárny lekár",
      i.assessment || "—",
      i.plan || "—",
    ]);
    openInspectionPrintView({
      title: "Klinický Denník Ošetrených Zvierat (Kniha Ošetrení)",
      statutoryReference: "Evidencia v zmysle § 22 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti",
      subtitle: "Zákonný denník veterinárnych úkonov a spotreby humánnych a veterinárnych liečiv",
      headers,
      rows,
      summaryNotes: "Evidencia je vedená chronologicky v zmysle veterinárneho zákona a slúži ako podklad pre inšpekcie ŠVPS SR.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("statutory.treatment.searchPlaceholder", "Hľadať diagnózu, lieky, pacienta alebo lekára...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
            <span>do</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{t("statutory.exportCsv", "Exportovať CSV")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintInspection}
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Tlačiť úradný výkaz</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenašli sa žiadne záznamy v denníku ošetrených zvierat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum / Čas</th>
                  <th className="p-3">Pacient & Majiteľ</th>
                  <th className="p-3">Ošetrujúci lekár</th>
                  <th className="p-3">Diagnóza (Nález)</th>
                  <th className="p-3">Terapia / Použité liečivá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{item.patientName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.clientFirstName} {item.clientLastName} • {item.species}
                      </div>
                    </td>
                    <td className="p-3 font-medium text-foreground whitespace-nowrap">
                      {item.authorName || "Veterinárny lekár"}
                    </td>
                    <td className="p-3 max-w-xs truncate text-muted-foreground" title={item.assessment ?? ""}>
                      {item.assessment || "—"}
                    </td>
                    <td className="p-3 max-w-sm truncate text-muted-foreground" title={item.plan ?? ""}>
                      {item.plan || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        Celkovo ošetrení: {data?.totalCount ?? 0}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Euthanasia Register (Register eutanázií a asanácií)
// ---------------------------------------------------------------------------
function EuthanasiaRegisterTab() {
  const { t } = useI18n();
  const { data, isLoading } = trpc.reports.euthanasiaRegister.useQuery();

  const handleExportCsv = () => {
    if (!data?.items?.length) return;
    const headers = [
      "Dátum úhynu / eutanázie",
      "Pacient",
      "Druh",
      "Plemeno",
      "Číslo mikročipu",
      "Majiteľ",
      "Adresa majiteľa",
      "Telefón",
    ];
    const rows = data.items.map((i) => [
      formatDate(i.updatedAt),
      i.name,
      i.species,
      i.breed || "—",
      i.microchipNumber || "—",
      `${i.clientFirstName || ""} ${i.clientLastName}`.trim(),
      `${i.clientAddress || ""}, ${i.clientCity || ""}`.trim(),
      i.clientPhone || "—",
    ]);
    downloadStatutoryCsv(
      `register_eutanazii_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintInspection = () => {
    if (!data?.items?.length) return;
    const headers = [
      "Dátum",
      "Meno pacienta",
      "Druh & Plemeno",
      "Číslo mikročipu",
      "Vlastník zvieraťa",
      "Bydlisko & Telefón",
      "Evidencia CRSZ / Asanácia",
    ];
    const rows = data.items.map((i) => [
      formatDate(i.updatedAt),
      i.name,
      `${i.species}${i.breed ? ` • ${i.breed}` : ""}`,
      i.microchipNumber || "Nečipovaný",
      `${i.clientFirstName || ""} ${i.clientLastName}`.trim(),
      `${i.clientAddress || ""}, ${i.clientCity || ""} (${i.clientPhone || "—"})`.trim(),
      "Ukončený / Na odhlásenie v CRSZ",
    ]);
    openInspectionPrintView({
      title: "Register Eutanázií a Asanácií Tiel Uhynutých Zvierat",
      statutoryReference: "Evidencia v zmysle § 22 ods. 5 zákona č. 39/2007 Z. z. o veterinárnej starostlivosti",
      subtitle: "Úradný podklad pre odhlásenie z Centrálneho registra spoločenských zvierat (CRSZ) a kontrolu ŠVPS SR",
      headers,
      rows,
      summaryNotes: "Tento výkaz slúži ako úradné potvrdenie o eutanázii a predložení tiel na asanáciu kafilérnej službe.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border border-border bg-card p-4 gap-3">
        <div>
          <h3 className="font-semibold text-sm">Register eutanázií a asanovaných tiel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zákonná evidencia uhynutých a eutanazovaných zvierat pre odhlásenie z CRSZ a evidencie obcí.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{t("statutory.exportCsv", "Exportovať CSV")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintInspection}
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Tlačiť úradný výkaz</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Žiadne záznamy v registri eutanázií.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum</th>
                  <th className="p-3">Pacient</th>
                  <th className="p-3">Číslo mikročipu</th>
                  <th className="p-3">Majiteľ</th>
                  <th className="p-3">Bydlisko / Mesto</th>
                  <th className="p-3">Telefón</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium whitespace-nowrap">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.species} {item.breed ? `• ${item.breed}` : ""}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {item.microchipNumber || "—"}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {item.clientFirstName} {item.clientLastName}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {item.clientCity ? `${item.clientAddress || ""}, ${item.clientCity}` : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {item.clientPhone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Narcotics Tab (Kniha omamných a psychotropných látok)
// ---------------------------------------------------------------------------
const ACTION_LABEL_SK: Record<string, string> = {
  received: "Príjem",
  administered: "Podanie pacientovi",
  wasted: "Likvidácia (odpad)",
  returned: "Vrátenie dodávateľovi",
};

function NarcoticsTab() {
  const { t } = useI18n();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.controlledSubstances.list.useQuery({
    limit: 100,
    offset: 0,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const { data: summary } = trpc.controlledSubstances.summary.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const handlePrintOPK = () => {
    if (!data?.items?.length && !summary?.length) return;
    const todayStr = new Date().toLocaleDateString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) return;

    const summaryRows = summary
      ?.map((row) => {
        const bal = (
          parseFloat(String(row.totalReceived)) -
          parseFloat(String(row.totalAdministered)) -
          parseFloat(String(row.totalWasted)) -
          parseFloat(String(row.totalReturned))
        ).toFixed(3);
        return `<tr>
          <td>${row.drugName}</td><td>${row.unit}</td>
          <td style="text-align:right;font-family:monospace">${row.totalReceived}</td>
          <td style="text-align:right;font-family:monospace">${row.totalAdministered}</td>
          <td style="text-align:right;font-family:monospace">${row.totalWasted}</td>
          <td style="text-align:right;font-family:monospace">${row.totalReturned}</td>
          <td style="text-align:right;font-family:monospace;font-weight:bold">${bal}</td>
        </tr>`;
      })
      .join("") ?? "";

    const ledgerRows = data?.items
      ?.map((item, idx) => `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${formatDate(item.performedAt)}</td>
        <td><strong>${item.drugName}</strong> (Zoz. ${item.deaSchedule})</td>
        <td>${ACTION_LABEL_SK[item.action] ?? item.action}</td>
        <td style="text-align:right;font-family:monospace">${item.quantity} ${item.unit}</td>
        <td>${item.lotNumber || "—"}</td>
        <td>${item.patientName || "—"}</td>
        <td>${item.performerName || "—"}</td>
        <td>${item.witnessName || "—"}</td>
        <td>${item.notes || "—"}</td>
      </tr>`)
      .join("") ?? "";

    printWindow.document.write(`<!DOCTYPE html>
<html lang="sk"><head><meta charset="UTF-8">
<title>OPK – Kniha omamných a psychotropných látok</title>
<style>
@page{size:A4 landscape;margin:10mm}
body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:0;padding:8px}
h1{font-size:12px;text-align:center;text-transform:uppercase;margin:0 0 2px}
.stat-ref{font-size:8.5px;text-align:center;font-weight:bold;margin-bottom:4px}
.meta{display:flex;justify-content:space-between;font-size:8px;margin-bottom:8px;border-bottom:1px solid #000;padding-bottom:4px}
h2{font-size:10px;margin:10px 0 4px;border-left:3px solid #333;padding-left:6px}
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:8.5px}
th{background:#ddd;border:1px solid #666;padding:3px 4px;text-align:left;font-size:7.5px;text-transform:uppercase}
td{border:1px solid #999;padding:3px 4px;vertical-align:top}
.sigs{display:flex;justify-content:space-between;margin-top:16px;gap:8px}
.sig-box{flex:1;border:1px solid #555;border-radius:3px;padding:6px;height:60px;font-size:8px;position:relative}
.sig-line{position:absolute;bottom:5px;left:6px;right:6px;border-top:1px dotted #000;text-align:center;padding-top:2px;font-size:7.5px}
.footer{font-size:7.5px;color:#555;margin-top:6px;font-style:italic;text-align:center}
</style></head><body>
<h1>Kniha Omamných a Psychotropných Látok (OPK)</h1>
<div class="stat-ref">Vedená v zmysle zákona č. 139/1998 Z. z. | ŠÚKL / ŠVPS SR</div>
<div class="meta">
  <span><strong>Veterinárne pracovisko:</strong> ___________________________</span>
  <span><strong>Zodpovedná osoba (IFA):</strong> ___________________________</span>
  <span><strong>Vytlačené:</strong> ${todayStr}</span>
</div>
<h2>I. Súhrnné zostatky (fyzická inventúra)</h2>
<table><thead><tr>
  <th>Liečivo</th><th>J.</th><th style="text-align:right">Príjem</th>
  <th style="text-align:right">Podania</th><th style="text-align:right">Odpad</th>
  <th style="text-align:right">Vrátenie</th><th style="text-align:right">Zostatok</th>
</tr></thead><tbody>${summaryRows || '<tr><td colspan="7" style="text-align:center;padding:8px">Žiadne záznamy</td></tr>'}</tbody></table>
<p style="font-size:8px">Fyzicky preverené dňa: ________________ Zostatok zodpovedá evidencii: ☐ ÁNO &nbsp; ☐ NIE (rozdiel: ______)</p>
<h2>II. Podrobný pohybový denník</h2>
<table><thead><tr>
  <th style="width:24px">P.č.</th><th>Dátum</th><th>Liečivo</th><th>Pohyb</th>
  <th style="text-align:right">Množstvo</th><th>Šarža</th><th>Pacient</th><th>Lekár</th><th>Svedok</th><th>Poznámka</th>
</tr></thead><tbody>${ledgerRows || '<tr><td colspan="10" style="text-align:center;padding:8px">Žiadne záznamy</td></tr>'}</tbody></table>
<div class="sigs">
  <div class="sig-box"><strong>Vedúci pracoviska / IFA:</strong><div class="sig-line">Meno, podpis a dátum overenia</div></div>
  <div class="sig-box"><strong>Inšpektor ŠÚKL / ŠVPS SR:</strong><div class="sig-line">Meno, č. inšpektora, dátum</div></div>
  <div class="sig-box"><strong>Regionálna veterinárna správa (RVPS):</strong><div class="sig-line">Záznam o overení / podpis</div></div>
</div>
<div class="footer">Kópia: 1× Veterinárne pracovisko (archív 5 rokov) | 1× RVPS | 1× ŠÚKL na vyžiadanie</div>
</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-base">Kontrolované látky</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Vedená v zmysle zákona č. 139/1998 Z. z. Každý príjem, podanie pacientovi a likvidácia zvyškov musí byť evidovaná s menom lekára, šaržou a svedkom.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline" size="sm"
              onClick={handlePrintOPK}
              disabled={!data?.items?.length && !summary?.length}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Tlačiť OPK výkaz</span>
            </Button>
            <Link href="/controlled-substances">
              <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <span>Plná evidencia</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {/* Date range filter */}
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
          <span>do</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
      </div>

      {/* Summary balance cards */}
      {summary && summary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((row) => {
            const balance =
              parseFloat(String(row.totalReceived)) -
              parseFloat(String(row.totalAdministered)) -
              parseFloat(String(row.totalWasted)) -
              parseFloat(String(row.totalReturned));
            return (
              <div key={`${row.drugName}-${row.unit}`} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold text-sm">{row.drugName}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Príjem:</span>
                  <span className="text-right font-mono">{row.totalReceived} {row.unit}</span>
                  <span className="text-muted-foreground">Podania:</span>
                  <span className="text-right font-mono">{row.totalAdministered} {row.unit}</span>
                  <span className="text-muted-foreground">Zlikvidované:</span>
                  <span className="text-right font-mono">{row.totalWasted} {row.unit}</span>
                  <span className="text-muted-foreground font-semibold">Zostatok:</span>
                  <span className={cn(
                    "text-right font-mono font-semibold",
                    balance < 0 ? "text-destructive" : "text-foreground"
                  )}>
                    {balance.toFixed(3)} {row.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ledger table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Žiadne záznamy v knihe omamných látok.{" "}
            <Link href="/controlled-substances" className="text-primary underline">Pridať záznam</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3">Dátum</th>
                  <th className="p-3">Liečivo (Zoznam)</th>
                  <th className="p-3">Druh pohybu</th>
                  <th className="p-3 text-right">Množstvo</th>
                  <th className="p-3">Šarža</th>
                  <th className="p-3">Pacient</th>
                  <th className="p-3">Lekár</th>
                  <th className="p-3">Svedok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap font-medium">{formatDate(item.performedAt)}</td>
                    <td className="p-3">
                      <span className="font-semibold">{item.drugName}</span>
                      <span className="ml-1 text-muted-foreground">(Zoz. {item.deaSchedule})</span>
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                        item.action === "received" && "bg-blue-100 text-blue-700",
                        item.action === "administered" && "bg-green-100 text-green-700",
                        item.action === "wasted" && "bg-amber-100 text-amber-700",
                        item.action === "returned" && "bg-gray-100 text-gray-700",
                      )}>
                        {ACTION_LABEL_SK[item.action] ?? item.action}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{item.quantity} {item.unit}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">{item.lotNumber || "—"}</td>
                    <td className="p-3">{item.patientName || "—"}</td>
                    <td className="p-3 whitespace-nowrap">{item.performerName || "—"}</td>
                    <td className="p-3 whitespace-nowrap">{item.witnessName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legal footer cards */}
      <div className="grid gap-4 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="text-muted-foreground">Legislatívny rámec</div>
          <div className="mt-1 font-semibold text-sm">Zákon č. 139/1998 Z. z.</div>
          <div className="mt-1 text-muted-foreground">ŠÚKL &amp; ŠVPS SR</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="text-muted-foreground">Archivačná lehota</div>
          <div className="mt-1 font-semibold text-sm">5 rokov od posledného záznamu</div>
          <div className="mt-1 text-muted-foreground">§ 22 ods. 3 zák. č. 139/1998 Z. z.</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="text-muted-foreground">Likvidácia odpadu</div>
          <div className="mt-1 font-semibold text-sm">Vyžaduje svedka + protokol</div>
          <div className="mt-1 text-muted-foreground">Každý odpad evidovať s dôvodom</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Protocols Tab (Zákonné protokoly & formuláre)
// ---------------------------------------------------------------------------
function ProtocolsTab() {
  const { t } = useI18n();
  const { data: forms, isLoading } = trpc.records.listConsentForms.useQuery();
  const [selectedForm, setSelectedForm] = useState<string | null>(null);

  const activeForm = forms?.find((f) => f.id === selectedForm) ?? forms?.[0];

  const handlePrintProtocol = () => {
    if (!activeForm) return;
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <title>${activeForm.title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; padding: 25mm 20mm; color: #000; }
    h1 { font-size: 16px; text-align: center; text-transform: uppercase; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    .content { white-space: pre-wrap; font-family: inherit; }
    .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
    .sig-box { width: 45%; border-top: 1px solid #000; padding-top: 5px; text-align: center; font-size: 11px; }
    @media print { @page { size: A4; margin: 15mm; } }
  </style>
</head>
<body>
  <h1>${activeForm.title}</h1>
  <div class="content">${activeForm.body}</div>
  <div class="signatures">
    <div class="sig-box">Vlastník / Držiteľ zvieraťa (podpis)</div>
    <div class="sig-box">Ošetrujúci veterinárny lekár (pečiatka a podpis)</div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold text-sm">Slovenské veterinárne protokoly a informované súhlasy</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Oficiálne znenia formulárov podľa štandardov KVL SR pre tlač a podpis klientom.
          </p>
        </div>
        {activeForm && (
          <Button size="sm" onClick={handlePrintProtocol} className="gap-2">
            <Printer className="h-4 w-4" />
            <span>Tlačiť čistý protokol</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !forms?.length ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Žiadne formuláre nie sú k dispozícii.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* List of forms */}
          <div className="space-y-1.5 md:col-span-1">
            {forms.map((f) => {
              const isSelected = activeForm?.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedForm(f.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-medium shadow-xs"
                      : "border-border bg-card hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="font-semibold text-sm line-clamp-1">{f.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                    slug: {f.slug}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form preview */}
          <div className="rounded-lg border border-border bg-card p-5 md:col-span-2">
            {activeForm && (
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <h4 className="font-bold text-base text-foreground">{activeForm.title}</h4>
                  <span className="font-mono text-xs text-muted-foreground">
                    Identifikátor šablóny: {activeForm.slug}
                  </span>
                </div>
                <div className="rounded-md bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto text-foreground/90">
                  {activeForm.body}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
