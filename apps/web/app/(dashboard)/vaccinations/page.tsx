"use client";

import { formatDateToDisplay } from "@/lib/date-display";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Syringe,
  BellRing,
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  Plus,
  PawPrint,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";

const MAX_BATCH_SIZE = 100;

function canOperateRecalls(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "front_desk";
}



export default function VaccinationsPage() {
  const { t } = useI18n();
  const { data: session, status: sessionStatus } = useSession();
  const canOperate = canOperateRecalls(session?.user?.role);
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"recalls" | "rabies" | "search">("recalls");

  // --- Recalls state ---
  const preview = trpc.notifications.getVaccinationRecallPreview.useQuery(
    undefined,
    { enabled: sessionStatus === "authenticated" && canOperate },
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const eligibleRecipients = useMemo(
    () =>
      preview.data?.recipients.filter(
        (recipient) => recipient.status === "eligible",
      ) ?? [],
    [preview.data],
  );

  const selectedEligibleIds = eligibleRecipients
    .map((recipient) => recipient.patientId)
    .filter((patientId) => selected.has(patientId))
    .slice(0, MAX_BATCH_SIZE);

  const allEligibleSelected =
    eligibleRecipients.length > 0 &&
    eligibleRecipients
      .slice(0, MAX_BATCH_SIZE)
      .every((recipient) => selected.has(recipient.patientId));

  const sendReminders = trpc.notifications.sendVaccinationReminders.useMutation({
    onSuccess: async (result) => {
      setSelected(new Set());
      await utils.notifications.getVaccinationRecallPreview.invalidate();
      const summary = [
        t("recalls.sentSummary", "{count} odoslaných", { count: result.sent }),
        result.deduped
          ? t("recalls.dedupedSummary", "{count} už spracovaných", {
              count: result.deduped,
            })
          : null,
        result.blocked
          ? t("recalls.blockedSummary", "{count} zablokovaných", {
              count: result.blocked,
            })
          : null,
        result.failed
          ? t("recalls.failedSummary", "{count} zlyhaných", {
              count: result.failed,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (result.failed > 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (err) => {
      toast.error(err.message || t("common.errorOccurred", "Vyskytla sa chyba"));
    },
  });

  // --- Rabies register state ---
  const [rabiesSearch, setRabiesSearch] = useState("");
  const rabiesQuery = trpc.reports.rabiesRegister.useQuery(
    {
      search: rabiesSearch || undefined,
      limit: 100,
    },
    { enabled: activeTab === "rabies" },
  );

  // --- Patient search state ---
  const [patientQueryText, setPatientQueryText] = useState("");
  const patientSearch = trpc.patients.search.useQuery(
    { query: patientQueryText },
    { enabled: patientQueryText.trim().length >= 2 && activeTab === "search" },
  );

  const handleToggleAll = () => {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(
          eligibleRecipients
            .slice(0, MAX_BATCH_SIZE)
            .map((r) => r.patientId),
        ),
      );
    }
  };

  const handleToggleOne = (patientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Syringe className="w-7 h-7 text-primary" />
            {t("nav.vaccinations", "Očkovania & Imunizácia")}
          </span>
        }
        subtitle={t(
          "vaccinations.subtitle",
          "Kompletný register očkovaní, automatický výpočet revakcinácií, zákaznícke SMS pripomienky a zákonná evidencia besnoty (Zákon č. 39/2007 Z. z.).",
        )}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/statutory?tab=rabies">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span>{t("vaccinations.statutoryRabies", "Kniha besnoty (ŠVPS)")}</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href="/records?tab=vaccinations&new=1">
                <Plus className="h-4 w-4" />
                <span>{t("vaccinations.recordNew", "Nové očkovanie")}</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "recalls" | "rabies" | "search")}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="recalls" className="gap-2 text-xs">
            <BellRing className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.recalls", "Revakcinácie")}</span>
            {eligibleRecipients.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {eligibleRecipients.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rabies" className="gap-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.rabies", "Register besnoty")}</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2 text-xs">
            <Search className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.search", "Preukaz pacienta")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Recalls / Revakcinácie */}
        <TabsContent value="recalls" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("vaccinations.recallsTitle", "Pripomienky termínov revakcinácie")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    "vaccinations.recallsDesc",
                    "Pacienti s exspirovaným alebo blížiacim sa termínom revakcinácie pripravení na odoslanie SMS alebo e-mailu.",
                  )}
                </CardDescription>
              </div>
              {selectedEligibleIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() =>
                    sendReminders.mutate({ patientIds: selectedEligibleIds })
                  }
                  disabled={sendReminders.isPending}
                  className="gap-2"
                >
                  {sendReminders.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {t(
                      "recalls.sendSelected",
                      "Odoslať pripomienky ({count})",
                      { count: selectedEligibleIds.length },
                    )}
                  </span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {preview.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !preview.data?.recipients.length ? (
                <EmptyState
                  icon={CheckCircle2}
                  title={t("vaccinations.recallsEmptyTitle", "Všetky očkovania sú aktuálne")}
                  description={t(
                    "vaccinations.recallsEmptyDesc",
                    "Žiadny pacient nemá exspirované očkovanie vyžadujúce zaslanie pripomienky.",
                  )}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 text-xs text-muted-foreground">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <Checkbox
                        checked={allEligibleSelected}
                        onChange={handleToggleAll}
                      />
                      <span>
                        {t("vaccinations.selectAllEligible", "Vybrať všetkých oprávnených ({count})", {
                          count: eligibleRecipients.length,
                        })}
                      </span>
                    </label>
                    <span>
                      {t("vaccinations.totalRecipients", "Celkovo {total} záznamov", {
                        total: preview.data.recipients.length,
                      })}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b text-muted-foreground bg-muted/30">
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5 font-semibold">Pacient</th>
                          <th className="p-2.5 font-semibold">Majiteľ</th>
                          <th className="p-2.5 font-semibold">Vakcína & Dátum</th>
                          <th className="p-2.5 font-semibold">Kanál</th>
                          <th className="p-2.5 font-semibold">Stav</th>
                          <th className="p-2.5 text-right font-semibold">Akcia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {preview.data.recipients.map((r) => {
                          const isEligible = r.status === "eligible";
                          const isChecked = selected.has(r.patientId);
                          const firstVaccine = r.vaccines[0];

                          return (
                            <tr
                              key={r.patientId}
                              className="hover:bg-accent/40 transition-colors"
                            >
                              <td className="p-2.5">
                                <Checkbox
                                  checked={isChecked}
                                  disabled={!isEligible}
                                  onChange={() => handleToggleOne(r.patientId)}
                                />
                              </td>
                              <td className="p-2.5 font-medium text-foreground">
                                <Link
                                  href={`/patients/${r.patientId}`}
                                  className="hover:underline flex items-center gap-1.5"
                                >
                                  <PawPrint className="h-3 w-3 text-primary/70" />
                                  <span>{r.patientName}</span>
                                </Link>
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {r.clientName}
                              </td>
                              <td className="p-2.5">
                                <span className="font-medium text-foreground">
                                  {firstVaccine?.vaccineName ?? "Vakcína"}
                                </span>
                                <span className="block text-[10px] text-muted-foreground">
                                  Expirácia: {formatDateToDisplay(firstVaccine?.nextDueDate)}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  {r.channel === "sms" ? (
                                    <MessageSquare className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Mail className="h-3 w-3 text-blue-600" />
                                  )}
                                  <span className="uppercase text-[10px] font-semibold">
                                    {r.channel ?? "—"}
                                  </span>
                                </span>
                              </td>
                              <td className="p-2.5">
                                <Badge
                                  variant={
                                    r.status === "eligible"
                                      ? "default"
                                      : r.status === "already_sent"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                  className="text-[10px] px-1.5 py-0 capitalize"
                                >
                                  {r.status === "eligible"
                                    ? "Pripravené"
                                    : r.status === "already_sent"
                                      ? "Už odoslané"
                                      : "Blokované"}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right">
                                <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                                  <Link href={`/records?patientId=${r.patientId}&tab=vaccinations`}>
                                    <span>Záznam</span>
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Rabies statutory register */}
        <TabsContent value="rabies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("vaccinations.rabiesTitle", "Zákonná evidencia očkovania proti besnote")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t(
                    "vaccinations.rabiesDesc",
                    "Povinný register vakcinácie mäsožravcov proti besnote podľa Zákona č. 39/2007 Z. z. s 3-dňovou lehotou hlásenia na RVPS.",
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t("common.search", "Hľadať pacienta, čip...")}
                  value={rabiesSearch}
                  onChange={(e) => setRabiesSearch(e.target.value)}
                  className="w-48 h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {rabiesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !rabiesQuery.data?.items?.length ? (
                <EmptyState
                  icon={ShieldCheck}
                  title={t("vaccinations.rabiesEmptyTitle", "Žiadne záznamy o besnote")}
                  description={t(
                    "vaccinations.rabiesEmptyDesc",
                    "Neboli nájdené žiadne záznamy o aplikovanom očkovaní proti besnote.",
                  )}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground bg-muted/30">
                        <th className="p-2.5 font-semibold">Dátum</th>
                        <th className="p-2.5 font-semibold">Pacient</th>
                        <th className="p-2.5 font-semibold">Číslo mikročipu</th>
                        <th className="p-2.5 font-semibold">Vakcína & Šarža</th>
                        <th className="p-2.5 font-semibold">Revakcinácia</th>
                        <th className="p-2.5 font-semibold">Majiteľ</th>
                        <th className="p-2.5 text-right font-semibold">Záznam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {rabiesQuery.data.items.map((r) => (
                        <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                          <td className="p-2.5 whitespace-nowrap text-muted-foreground">
                            {formatDateToDisplay(r.administeredAt)}
                          </td>
                          <td className="p-2.5 font-medium text-foreground">
                            <Link href={`/patients/${r.patientId}`} className="hover:underline">
                              {r.patientName}
                            </Link>
                            <span className="block text-[10px] text-muted-foreground capitalize">
                              {r.species} {r.breed ? `· ${r.breed}` : ""}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-foreground">
                            {r.microchipNumber || "Nečipovaný"}
                          </td>
                          <td className="p-2.5">
                            <span className="font-medium text-foreground">{r.vaccineName}</span>
                            {r.lotNumber && (
                              <span className="block text-[10px] text-muted-foreground">
                                Šarža: {r.lotNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-foreground font-medium">
                            {formatDateToDisplay(r.nextDueDate)}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {`${r.clientFirstName || ""} ${r.clientLastName}`.trim()}
                          </td>
                          <td className="p-2.5 text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                              <Link href={`/records?patientId=${r.patientId}&tab=vaccinations`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Patient search for vaccination card */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {t("vaccinations.searchTitle", "Vyhľadať digitálny očkovací preukaz")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "vaccinations.searchDesc",
                  "Zadajte meno pacienta, číslo mikročipu alebo majiteľa pre zobrazenie celej histórie vakcinácií a vytlačenie digitálneho preukazu.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("patients.searchPlaceholder", "Meno pacienta, mikročip, majiteľ...")}
                  value={patientQueryText}
                  onChange={(e) => setPatientQueryText(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {patientSearch.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : patientQueryText.trim().length >= 2 && !patientSearch.data?.length ? (
                <EmptyState
                  icon={Search}
                  title={t("patients.noResults", "Pacient nebol nájdený")}
                  description={t("patients.noResultsDesc", "Skontrolujte správnosť zadaného mena alebo mikročipu.")}
                />
              ) : patientSearch.data && patientSearch.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground bg-muted/30">
                        <th className="p-2.5 font-semibold">Pacient</th>
                        <th className="p-2.5 font-semibold">Druh & Plemeno</th>
                        <th className="p-2.5 font-semibold">Mikročip</th>
                        <th className="p-2.5 font-semibold">Majiteľ</th>
                        <th className="p-2.5 text-right font-semibold">Akcia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {patientSearch.data.map((p) => (
                        <tr key={p.id} className="hover:bg-accent/40 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground">
                            <Link href={`/patients/${p.id}`} className="hover:underline">
                              {p.name}
                            </Link>
                          </td>
                          <td className="p-2.5 text-muted-foreground capitalize">
                            {p.species} {p.breed ? `· ${p.breed}` : ""}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                            {p.microchipNumber || "—"}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ")}
                          </td>
                          <td className="p-2.5 text-right">
                            <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Link href={`/records?patientId=${p.id}&tab=vaccinations`}>
                                <Syringe className="h-3 w-3 text-primary" />
                                <span>Otvoriť očkovania</span>
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
