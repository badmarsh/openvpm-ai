"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  HeartHandshake,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatDateInputLocal } from "@/lib/date-input";
import { PATIENT_SPECIES_EMOJI, type PatientSpecies } from "@/lib/patients/species";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPulseBadge, type StatusPulseVariant } from "@/components/ui/status-pulse-badge";
import { cn } from "@/lib/utils";

type TabKey = "today" | "active" | "followUps" | "all";

export default function EncountersPage() {
  const { t } = useI18n();
  const todayStr = useMemo(() => formatDateInputLocal(), []);

  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");

  const effectiveStartDate = activeTab === "all" ? selectedDate : todayStr;
  const effectiveEndDate = activeTab === "all" ? selectedDate : todayStr;

  const appointmentsQuery = trpc.appointments.list.useQuery(
    {
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      doctorId: doctorFilter !== "all" ? doctorFilter : undefined,
    },
    { refetchInterval: 15_000 }
  );

  const followUpsQuery = trpc.encounters.listPendingFollowUps.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const doctorsQuery = trpc.appointments.listDoctors.useQuery();

  const appointments = appointmentsQuery.data ?? [];
  const followUps = followUpsQuery.data ?? [];
  const doctors = doctorsQuery.data ?? [];

  // KPI Calculations
  const todayAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const aptDate = apt.startTime
        ? formatDateInputLocal(new Date(apt.startTime))
        : "";
      return aptDate === todayStr;
    });
  }, [appointments, todayStr]);

  const inClinicCount = useMemo(() => {
    return todayAppointments.filter(
      (apt) => apt.status === "checked_in" || apt.status === "in_exam"
    ).length;
  }, [todayAppointments]);

  const completedTodayCount = useMemo(() => {
    return todayAppointments.filter((apt) => apt.status === "checked_out").length;
  }, [todayAppointments]);

  // Tab Filtering
  const filteredAppointments = useMemo(() => {
    let list = appointments;

    if (activeTab === "today") {
      list = todayAppointments;
    } else if (activeTab === "active") {
      list = todayAppointments.filter(
        (apt) => apt.status === "checked_in" || apt.status === "in_exam"
      );
    }

    if (statusFilter !== "all" && activeTab === "all") {
      list = list.filter((apt) => apt.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((apt) => {
        const patientMatch = apt.patientName?.toLowerCase().includes(q);
        const clientMatch =
          apt.clientFirstName?.toLowerCase().includes(q) ||
          apt.clientLastName?.toLowerCase().includes(q);
        const doctorMatch = apt.doctorName?.toLowerCase().includes(q);
        const typeMatch = apt.typeName?.toLowerCase().includes(q);
        const notesMatch = apt.notes?.toLowerCase().includes(q);
        return patientMatch || clientMatch || doctorMatch || typeMatch || notesMatch;
      });
    }

    return list;
  }, [appointments, activeTab, todayAppointments, statusFilter, searchQuery]);

  // Filtered Follow-ups
  const filteredFollowUps = useMemo(() => {
    if (!searchQuery.trim()) return followUps;
    const q = searchQuery.toLowerCase().trim();
    return followUps.filter((f) => {
      const patientMatch = f.patientName?.toLowerCase().includes(q);
      const clientMatch =
        f.clientFirstName?.toLowerCase().includes(q) ||
        f.clientLastName?.toLowerCase().includes(q);
      const assigneeMatch = f.assigneeName?.toLowerCase().includes(q);
      const notesMatch = f.followUpNotes?.toLowerCase().includes(q);
      return patientMatch || clientMatch || assigneeMatch || notesMatch;
    });
  }, [followUps, searchQuery]);

  const formatTime = (timeVal: string | Date | null | undefined) => {
    if (!timeVal) return "—";
    try {
      const d = new Date(timeVal);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_exam":
        return (
          <StatusPulseBadge
            variant="in_exam"
            pulse
            label={t("dashboard.upcoming.status.in_exam", "Vyšetruje sa")}
          />
        );
      case "checked_in":
        return (
          <StatusPulseBadge
            variant="waiting"
            pulse
            label={t("dashboard.upcoming.status.checked_in", "Príchod")}
          />
        );
      case "confirmed":
        return (
          <StatusPulseBadge
            variant="confirmed"
            label={t("dashboard.upcoming.status.confirmed", "Potvrdené")}
          />
        );
      case "scheduled":
        return (
          <StatusPulseBadge
            variant="neutral"
            label={t("dashboard.upcoming.status.scheduled", "Naplánované")}
          />
        );
      case "checked_out":
        return (
          <StatusPulseBadge
            variant="finished"
            label={t("dashboard.upcoming.status.completed", "Dokončené")}
          />
        );
      case "cancelled":
        return (
          <StatusPulseBadge
            variant="failed"
            label={t("dashboard.upcoming.status.cancelled", "Zrušené")}
          />
        );
      case "no_show":
        return (
          <StatusPulseBadge
            variant="offline"
            label={t("dashboard.upcoming.status.no_show", "Nedostavil sa")}
          />
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t("encounters.hub.title", "Vyšetrenia a klinické návštevy")}
        subtitle={t(
          "encounters.hub.subtitle",
          "Klinické vyšetrenia, príjem pacientov a následná starostlivosť"
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void appointmentsQuery.refetch();
                void followUpsQuery.refetch();
              }}
              disabled={appointmentsQuery.isFetching || followUpsQuery.isFetching}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (appointmentsQuery.isFetching || followUpsQuery.isFetching) &&
                    "animate-spin"
                )}
              />
              <span className="hidden sm:inline">
                {t("common.retry", "Obnoviť")}
              </span>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/whiteboard">
                <Layers className="h-4 w-4 text-primary" />
                {t("encounters.hub.whiteboard", "Vizuálna čakáreň")}
              </Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link href="/schedule">
                <CalendarPlus className="h-4 w-4" />
                {t("encounters.hub.newAppointment", "Objednať vyšetrenie")}
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("encounters.hub.kpiToday", "Dnes celkovo")}
              </span>
              <Calendar className="h-4 w-4 text-primary/70" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {todayAppointments.length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("encounters.hub.kpiInClinic", "V ambulancii / čakárni")}
              </span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {inClinicCount}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("encounters.hub.kpiFollowUps", "Čakajúce kontroly")}
              </span>
              <HeartHandshake className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {followUps.length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("encounters.hub.kpiCompleted", "Ukončené dnes")}
              </span>
              <CheckCircle2 className="h-4 w-4 text-primary/70" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {completedTodayCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "today"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {t("encounters.hub.tabToday", "Dnešné vyšetrenia")}
              <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px]">
                {todayAppointments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "active"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              {t("encounters.hub.tabActive", "V ambulancii a čakárni")}
              {inClinicCount > 0 && (
                <span className="ml-1 rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[10px] font-bold animate-pulse">
                  {inClinicCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("followUps")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "followUps"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              {t("encounters.hub.tabFollowUps", "Čakajúce kontroly")}
              {followUps.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {followUps.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              {t("encounters.hub.tabAll", "Všetky vyšetrenia")}
            </button>
          </div>

          {/* Quick Date Control for "all" tab */}
          {activeTab === "all" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">
                {t("encounters.hub.dateLabel", "Dátum")}:
              </span>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          )}
        </div>

        {/* Filter and Search row */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t(
                "encounters.hub.searchPlaceholder",
                "Hľadať podľa mena pacienta, majiteľa, čipu alebo lekára..."
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {activeTab === "all" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                aria-label={t("encounters.hub.allStatuses", "Všetky stavy")}
              >
                <option value="all">
                  {t("encounters.hub.allStatuses", "Všetky stavy")}
                </option>
                <option value="scheduled">
                  {t("dashboard.upcoming.status.scheduled", "Naplánované")}
                </option>
                <option value="confirmed">
                  {t("dashboard.upcoming.status.confirmed", "Potvrdené")}
                </option>
                <option value="checked_in">
                  {t("dashboard.upcoming.status.checked_in", "Príchod")}
                </option>
                <option value="in_exam">
                  {t("dashboard.upcoming.status.in_exam", "Vyšetruje sa")}
                </option>
                <option value="checked_out">
                  {t("dashboard.upcoming.status.completed", "Dokončené")}
                </option>
                <option value="cancelled">
                  {t("dashboard.upcoming.status.cancelled", "Zrušené")}
                </option>
                <option value="no_show">
                  {t("dashboard.upcoming.status.no_show", "Nedostavil sa")}
                </option>
              </select>
            )}

            {doctors.length > 0 && (
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                aria-label={t("encounters.hub.allDoctors", "Všetci lekári")}
              >
                <option value="all">
                  {t("encounters.hub.allDoctors", "Všetci lekári")}
                </option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "followUps" ? (
        /* Follow-ups Queue View */
        <div className="rounded-xl border border-border bg-card shadow-xs">
          {followUpsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={HeartHandshake}
                title={t(
                  "encounters.hub.emptyFollowUpsTitle",
                  "Žiadne čakajúce kontroly"
                )}
                description={t(
                  "encounters.hub.emptyFollowUpsDescription",
                  "Všetky pooperačné kontroly a následná starostlivosť sú aktuálne vybavené."
                )}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableDueDate", "Termín kontroly")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tablePatient", "Pacient")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableClient", "Majiteľ")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableAssignee", "Zodpovedný riešiteľ")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableNotes", "Poznámky")}
                    </th>
                    <th className="py-3 px-4 text-right">
                      {t("encounters.hub.tableActions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFollowUps.map((item) => {
                    const isOverdue =
                      item.dueDate &&
                      new Date(item.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                    return (
                      <tr
                        key={item.closeoutId}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock
                              className={cn(
                                "h-4 w-4",
                                isOverdue ? "text-destructive" : "text-amber-500"
                              )}
                            />
                            <span className={cn(isOverdue && "text-destructive font-bold")}>
                              {item.dueDate || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.patientId ? (
                            <Link
                              href={`/patients/${item.patientId}`}
                              className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                            >
                              <span>{item.patientName || "—"}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {item.patientName || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                          {item.clientFirstName} {item.clientLastName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            {item.assigneeName || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                          {item.followUpNotes || "—"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button size="sm" asChild className="gap-1.5">
                            <Link
                              href={`/encounters/${item.appointmentId}#visit-closeout`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("encounters.hub.resolveFollowUp", "Vyriešiť kontrolu")}
                            </Link>
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
      ) : (
        /* Encounters & Visits Table View */
        <div className="rounded-xl border border-border bg-card shadow-xs">
          {appointmentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Stethoscope}
                title={t("encounters.hub.emptyTitle", "Žiadne vyšetrenia")}
                description={t(
                  "encounters.hub.emptyDescription",
                  "Pre zvolené filtre sa nenašli žiadne klinické záznamy ani objednávky."
                )}
                action={{
                  label: t("encounters.hub.newAppointment", "Objednať vyšetrenie"),
                  onClick: () => {
                    window.location.assign("/schedule");
                  },
                  icon: CalendarPlus,
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableTime", "Čas")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tablePatient", "Pacient")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableClient", "Majiteľ")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableType", "Typ úkonu")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableDoctor", "Lekár")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableLocation", "Miestnosť / Pobočka")}
                    </th>
                    <th className="py-3 px-4">
                      {t("encounters.hub.tableStatus", "Stav")}
                    </th>
                    <th className="py-3 px-4 text-right">
                      {t("encounters.hub.tableActions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAppointments.map((apt) => {
                    const species = (apt.patientSpecies ?? "other") as PatientSpecies;
                    const emoji = PATIENT_SPECIES_EMOJI[species] || "🐾";
                    const isInExam = apt.status === "in_exam";
                    const isCheckedIn = apt.status === "checked_in";
                    const isCheckedOut = apt.status === "checked_out";

                    return (
                      <tr
                        key={apt.id}
                        className={cn(
                          "transition-colors hover:bg-muted/40",
                          isInExam && "bg-emerald-500/5",
                          isCheckedIn && "bg-amber-500/5"
                        )}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-foreground">
                            {formatTime(apt.startTime)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            do {formatTime(apt.endTime)}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base" aria-hidden="true">
                              {emoji}
                            </span>
                            {apt.patientId ? (
                              <Link
                                href={`/patients/${apt.patientId}`}
                                className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <span>{apt.patientName || t("dashboard.upcoming.unknownPatient", "Neznámy")}</span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {apt.patientName || t("dashboard.upcoming.unknownPatient", "Neznámy")}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-foreground text-xs">
                            {apt.clientFirstName} {apt.clientLastName}
                          </div>
                          {apt.clientPhone && (
                            <div className="text-[11px] text-muted-foreground">
                              {apt.clientPhone}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {apt.typeName ? (
                            <span
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: apt.typeColor
                                  ? `${apt.typeColor}20`
                                  : "var(--muted)",
                                color: apt.typeColor || "inherit",
                                borderColor: apt.typeColor
                                  ? `${apt.typeColor}40`
                                  : "transparent",
                                borderWidth: 1,
                              }}
                            >
                              {apt.typeName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-xs text-foreground">
                          {apt.doctorName ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{apt.doctorName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground/60" />
                            <span>
                              {apt.roomName || apt.locationName || "Ambulancia"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(apt.status)}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isInExam || isCheckedIn ? (
                            <Button size="sm" asChild className="gap-1.5 shadow-xs">
                              <Link href={`/encounters/${apt.id}`}>
                                <Stethoscope className="h-3.5 w-3.5" />
                                {t("encounters.hub.enterRoom", "Vstúpiť do ambulancie")}
                              </Link>
                            </Button>
                          ) : isCheckedOut ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="gap-1.5"
                            >
                              <Link href={`/encounters/${apt.id}#visit-closeout`}>
                                <FileText className="h-3.5 w-3.5" />
                                {t("encounters.hub.viewRecord", "Zobraziť protokol")}
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="gap-1.5"
                            >
                              <Link href={`/encounters/${apt.id}`}>
                                <Stethoscope className="h-3.5 w-3.5" />
                                {t("encounters.hub.openEncounter", "Otvoriť vyšetrenie")}
                              </Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
