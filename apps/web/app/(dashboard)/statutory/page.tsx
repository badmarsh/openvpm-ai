"use client";

import { useState } from "react";
import Link from "next/link";
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
          <span>{t("statutory.tabs.narcotics", "Kniha omamných látok (Opiáty)")}</span>
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

  const { data, isLoading } = trpc.reports.rabiesRegister.useQuery({
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 200,
  });

  const handleExportCsv = () => {
    if (!data?.items?.length) return;
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
    ];
    const rows = data.items.map((item) => [
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
    ]);
    downloadStatutoryCsv(
      `kniha_ockovania_besnota_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrint = () => {
    window.print();
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
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{t("statutory.exportCsv", "Export pre RVPS (CSV)")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            <span>{t("statutory.print", "Tlačiť")}</span>
          </Button>
        </div>
      </div>

      {/* Info notice */}
      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
        <strong>Zákonná povinnosť:</strong> Podľa § 17 ods. 1 písm. b) zákona č. 39/2007 Z. z. je vlastník alebo držiteľ vnímavých mäsožravcov povinný zabezpečiť vakcináciu proti besnote. Tento register slúži ako úradný výkaz pre kontroly Regionálnej veterinárnej a potravinovej správy (RVPS).
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items?.length ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((r) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        Celkovo záznamov: {data?.totalCount ?? 0}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold text-sm">Register eutanázií a asanovaných tiel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zákonná evidencia uhynutých a eutanazovaných zvierat pre odhlásenie z CRSZ a evidencie obcí.
          </p>
        </div>
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
function NarcoticsTab() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-lg">
                Kniha omamných a psychotropných látok (Opiáty)
              </h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Vedená v zmysle zákona č. 139/1998 Z. z. o omamných látkach, psychotropných látkach a prípravkoch v znení neskorších predpisov. Každý príjem, podanie pacientovi (anestézia, analgézia) a likvidácia zvyškov (odpad) musí byť evidovaný s menom lekára, šaržou a svedkom.
            </p>
          </div>
          <Link href="/controlled-substances">
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
              <span>Otvoriť knihu omamných látok</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Legislatívny rámec</div>
            <div className="mt-1 font-semibold text-sm">Zákon č. 139/1998 Z. z.</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Štátny ústav pre kontrolu liečiv (ŠÚKL) & ŠVPS SR
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Najčastejšie substancie</div>
            <div className="mt-1 font-semibold text-sm">Ketamín, Butorfanol, Metadón</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Zoznam II a III omamných látok
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-xs text-muted-foreground">Povinnosti pri kontrole</div>
            <div className="mt-1 font-semibold text-sm">Fyzická inventúra & Zostatky</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Kontrola súladu fyzického stavu v trezore
            </div>
          </div>
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
