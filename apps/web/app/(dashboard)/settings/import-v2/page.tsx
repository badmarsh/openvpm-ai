"use client";

import { useState } from "react";
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
  Receipt,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function V2ImportPage() {
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

  const runMutation = trpc.extensions.v2Import.runMigration.useMutation({
    onSuccess: (data) => {
      setMigrationReport(data);
    },
  });

  const handleStartMigration = () => {
    setMigrationReport(null);
    runMutation.mutate(options);
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 space-y-8">
      {/* Hlavička */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              1-Click V2 Data Migrácia
            </h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 py-1 px-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI Peer-Reviewed
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Automatizovaný prevod celej 15-ročnej histórie praxe (MVDr. Sýkora / MVDr. Drotár, Rimavská Sobota) z VetSoftware V2 do OpenVPM AI.
          </p>
        </div>

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
      </div>

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
              <Receipt className="w-4 h-4 text-indigo-500" />
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Náhľad reálnych dát z ambulancie (Overenie kódovania a polí)
            </h3>
            <p className="text-xs text-muted-foreground">
              Overte správnosť slovenskej diakritiky a Sympathy Gate pred spustením.
            </p>
          </div>

          <div className="flex gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActivePreviewTab("patients")}
              className={`px-3 py-1 rounded-md transition-all ${
                activePreviewTab === "patients"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pacienti
            </button>
            <button
              onClick={() => setActivePreviewTab("clients")}
              className={`px-3 py-1 rounded-md transition-all ${
                activePreviewTab === "clients"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Majitelia
            </button>
            <button
              onClick={() => setActivePreviewTab("vaccinations")}
              className={`px-3 py-1 rounded-md transition-all ${
                activePreviewTab === "vaccinations"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Očkovania
            </button>
            <button
              onClick={() => setActivePreviewTab("visits")}
              className={`px-3 py-1 rounded-md transition-all ${
                activePreviewTab === "visits"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Návštevy
            </button>
          </div>
        </div>

        {isPreviewLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden text-xs">
            {activePreviewTab === "patients" && (
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Meno</th>
                    <th className="p-2.5">Druh</th>
                    <th className="p-2.5">Plemeno</th>
                    <th className="p-2.5">Pohlavie</th>
                    <th className="p-2.5">Čip</th>
                    <th className="p-2.5">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview?.patients.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="p-2.5 font-mono text-muted-foreground">#{p.id}</td>
                      <td className="p-2.5 font-medium">{p.name}</td>
                      <td className="p-2.5 capitalize">{p.species}</td>
                      <td className="p-2.5">{p.breed}</td>
                      <td className="p-2.5 capitalize">{p.sex}</td>
                      <td className="p-2.5 font-mono">{p.microchip}</td>
                      <td className="p-2.5">
                        {p.status === "deceased" ? (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                            Uhynuté (Chránené)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500 text-emerald-600 bg-emerald-50">
                            Aktívne
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
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Meno a Priezvisko</th>
                    <th className="p-2.5">Adresa</th>
                    <th className="p-2.5">Telefón / Mobil</th>
                    <th className="p-2.5">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview?.clients.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="p-2.5 font-mono text-muted-foreground">#{c.id}</td>
                      <td className="p-2.5 font-medium">{c.name}</td>
                      <td className="p-2.5">{c.address}</td>
                      <td className="p-2.5">{c.phone}</td>
                      <td className="p-2.5">{c.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activePreviewTab === "vaccinations" && (
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">ID Pacienta</th>
                    <th className="p-2.5">Vakcína</th>
                    <th className="p-2.5">Podané dňa</th>
                    <th className="p-2.5">Preočkovanie do</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview?.vaccinations.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/50">
                      <td className="p-2.5 font-mono text-muted-foreground">#{v.id}</td>
                      <td className="p-2.5 font-mono">#{v.patientId}</td>
                      <td className="p-2.5 font-medium">{v.vaccine}</td>
                      <td className="p-2.5">{new Date(v.administeredAt).toLocaleDateString("sk-SK")}</td>
                      <td className="p-2.5">{v.nextDue !== "–" ? new Date(v.nextDue).toLocaleDateString("sk-SK") : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activePreviewTab === "visits" && (
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-2.5">ID Návštevy</th>
                    <th className="p-2.5">ID Pacienta</th>
                    <th className="p-2.5">Dátum</th>
                    <th className="p-2.5">Lekár</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview?.visits.map((vis) => (
                    <tr key={vis.id} className="hover:bg-muted/50">
                      <td className="p-2.5 font-mono text-muted-foreground">#{vis.id}</td>
                      <td className="p-2.5 font-mono">#{vis.patientId}</td>
                      <td className="p-2.5">{new Date(vis.date).toLocaleDateString("sk-SK")}</td>
                      <td className="p-2.5 font-medium">{vis.doctor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
