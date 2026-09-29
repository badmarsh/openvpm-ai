"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HeartHandshake,
  Layers,
  MapPin,
  RefreshCw,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { formatDateInputLocal } from "@/lib/date-input";
import {
  formatDateYmdToDisplay,
  formatTimeToDisplay,
} from "@/lib/date-display";
import {
  PATIENT_SPECIES_EMOJI,
  type PatientSpecies,
} from "@/lib/patients/species";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPulseBadge } from "@/components/ui/status-pulse-badge";
import { TableSkeleton } from "@/components/common/loading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageToolbar,
  SearchField,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";

type TabKey = "today" | "active" | "followUps" | "all";

export default function EncountersPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
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

  const appointments = useMemo(
    () => appointmentsQuery.data ?? [],
    [appointmentsQuery.data]
  );
  const followUps = useMemo(() => followUpsQuery.data ?? [], [followUpsQuery.data]);
  const doctors = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);

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

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    doctorFilter !== "all" ||
    (activeTab === "all" && (statusFilter !== "all" || selectedDate !== todayStr));

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDoctorFilter("all");
    setSelectedDate(todayStr);
  };

  const formatTime = (timeVal: string | Date | null | undefined) =>
    formatTimeToDisplay(timeVal, locale);

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
        // Terminal statuses use the static Badge pattern — no live pulse.
        return (
          <Badge variant="success" className="text-xs">
            {t("dashboard.upcoming.status.completed", "Dokončené")}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {t("dashboard.upcoming.status.cancelled", "Zrušené")}
          </Badge>
        );
      case "no_show":
        return (
          <Badge variant="warning" className="text-xs">
            {t("dashboard.upcoming.status.no_show", "Nedostavil sa")}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const countChipClass =
    "ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground";

  return (
    <div className={pageShellClass}>
      {/* Header */}
      <PageHeader
        icon={Stethoscope}
        title={t("encounters.hub.title", "Vyšetrenia")}
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

      {/* Underline tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabKey)}
      >
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="today" className={underlineTabsTriggerClass}>
            <Calendar className="h-3.5 w-3.5" />
            <span>{t("encounters.hub.tabToday", "Dnešné vyšetrenia")}</span>
            <span className={countChipClass}>{todayAppointments.length}</span>
          </TabsTrigger>
          <TabsTrigger value="active" className={underlineTabsTriggerClass}>
            <Activity className="h-3.5 w-3.5" />
            <span>{t("encounters.hub.tabActive", "V ambulancii a čakárni")}</span>
            {inClinicCount > 0 && (
              <span className="ml-1 animate-pulse rounded-full bg-success px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-success-foreground">
                {inClinicCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="followUps" className={underlineTabsTriggerClass}>
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>{t("encounters.hub.tabFollowUps", "Čakajúce kontroly")}</span>
            {followUps.length > 0 && (
              <span className="ml-1 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-warning-foreground">
                {followUps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className={underlineTabsTriggerClass}>
            <FileText className="h-3.5 w-3.5" />
            <span>{t("encounters.hub.tabAll", "Všetky vyšetrenia")}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* One toolbar: search + filters + count */}
      <PageToolbar>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t(
            "encounters.hub.searchPlaceholder",
            "Hľadať podľa mena pacienta, majiteľa, čipu alebo lekára..."
          )}
        />
        {activeTab === "all" ? (
          <>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label={t("encounters.hub.dateLabel", "Dátum")}
              className={cn(filterControlClass, "w-40")}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={filterControlClass}
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
          </>
        ) : null}

        {doctors.length > 0 ? (
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className={filterControlClass}
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
        ) : null}

        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            {t("encounters.hub.clearFilters", "Zrušiť filtre")}
          </Button>
        ) : null}

        <span className="text-xs text-muted-foreground sm:ml-auto">
          {activeTab === "followUps"
            ? t("encounters.hub.resultCount", "{count} výsledkov", {
                count: filteredFollowUps.length,
              })
            : t("encounters.hub.resultCount", "{count} výsledkov", {
                count: filteredAppointments.length,
              })}
        </span>
      </PageToolbar>

      {/* KPI row */}
      <KpiGrid>
        <KpiCard
          label={t("encounters.hub.kpiToday", "Dnes celkovo")}
          value={
            <span
              className={
                todayAppointments.length > 0
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              }
            >
              {todayAppointments.length}
            </span>
          }
          icon={<Calendar className="h-4 w-4 text-primary/70" />}
        />
        <KpiCard
          label={t("encounters.hub.kpiInClinic", "V ambulancii / čakárni")}
          value={
            <span className={inClinicCount > 0 ? "text-success" : "text-muted-foreground/60"}>
              {inClinicCount}
            </span>
          }
          icon={
            <Activity
              className={cn(
                "h-4 w-4",
                inClinicCount > 0 ? "text-success" : "text-muted-foreground"
              )}
            />
          }
          active={activeTab === "active"}
          onClick={() => setActiveTab("active")}
        />
        <KpiCard
          label={t("encounters.hub.kpiFollowUps", "Čakajúce kontroly")}
          value={
            <span className={followUps.length > 0 ? "text-warning" : "text-muted-foreground/60"}>
              {followUps.length}
            </span>
          }
          icon={
            <HeartHandshake
              className={cn(
                "h-4 w-4",
                followUps.length > 0 ? "text-warning" : "text-muted-foreground"
              )}
            />
          }
          active={activeTab === "followUps"}
          onClick={() => setActiveTab("followUps")}
        />
        <KpiCard
          label={t("encounters.hub.kpiCompleted", "Ukončené dnes")}
          value={
            <span
              className={
                completedTodayCount > 0
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              }
            >
              {completedTodayCount}
            </span>
          }
          icon={<CheckCircle2 className="h-4 w-4 text-primary/70" />}
        />
      </KpiGrid>

      {/* Main content */}
      {activeTab === "followUps" ? (
        <DataTableFrame>
          {followUpsQuery.isLoading ? (
            <TableSkeleton
              rows={4}
              cols={5}
              className="rounded-none border-0 shadow-none"
            />
          ) : filteredFollowUps.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                className="rounded-none border-0"
                icon={HeartHandshake}
                title={t(
                  "encounters.hub.emptyFilteredTitle",
                  "Žiadne výsledky pre zvolené filtre"
                )}
                description={t(
                  "encounters.hub.emptyFilteredDesc",
                  "Upravte alebo zrušte filtre a zobrazíte ďalšie vyšetrenia."
                )}
                action={{
                  label: t("encounters.hub.clearFilters", "Zrušiť filtre"),
                  onClick: clearFilters,
                  icon: X,
                }}
              />
            ) : (
              <EmptyState
                className="rounded-none border-0"
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
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableDueDate", "Dátum kontroly")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tablePatient", "Pacient")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableClient", "Majiteľ")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableAssignee", "Zodpovedný riešiteľ")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableNotes", "Poznámky")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("encounters.hub.tableActions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFollowUps.map((item) => {
                    const isOverdue = Boolean(item.dueDate && item.dueDate < todayStr);
                    const isDueToday = item.dueDate === todayStr;
  
                    return (
                      <tr
                        key={item.closeoutId}
                        className={cn(tableRowClass, "cursor-pointer")}
                        onClick={() =>
                          router.push(`/encounters/${item.appointmentId}#visit-closeout`)
                        }
                      >
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          <div className="flex items-center gap-1.5">
                            <Clock
                              className={cn(
                                "h-3.5 w-3.5",
                                isOverdue
                                  ? "text-destructive"
                                  : isDueToday
                                    ? "text-warning"
                                    : "text-muted-foreground"
                              )}
                            />
                            <span
                              className={cn(
                                "font-mono tabular-nums text-xs",
                                isOverdue
                                  ? "font-semibold text-destructive"
                                  : "font-medium text-foreground"
                              )}
                            >
                              {item.dueDate
                                ? formatDateYmdToDisplay(item.dueDate)
                                : "—"}
                            </span>
                          </div>
                          {isOverdue ? (
                            <Badge
                              variant="outline"
                              className="mt-1 border-destructive/30 bg-destructive/10 text-destructive"
                            >
                              {t("encounters.hub.overdue", "Omeškané")}
                            </Badge>
                          ) : isDueToday ? (
                            <Badge variant="warning" className="mt-1">
                              {t("encounters.hub.dueToday", "Dnes")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          <div className="flex items-center gap-1.5">
                            {item.patientId ? (
                              <Link
                                href={`/patients/${item.patientId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-foreground transition-colors hover:text-primary"
                              >
                                <span>{item.patientName || "—"}</span>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {item.patientName || "—"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn(tableCellClass, "whitespace-nowrap text-muted-foreground")}>
                          <div className="min-w-0 max-w-[12rem] truncate">
                            {item.clientFirstName} {item.clientLastName}
                          </div>
                        </td>
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span className="max-w-[10rem] truncate">
                              {item.assigneeName || "—"}
                            </span>
                          </span>
                        </td>
                        <td className={cn(tableCellClass, "max-w-xs")}>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.followUpNotes || "—"}
                          </div>
                        </td>
                        <td className={cn(tableCellClass, "whitespace-nowrap text-right")}>
                          <Button size="sm" asChild className="gap-1.5">
                            <Link
                              href={`/encounters/${item.appointmentId}#visit-closeout`}
                              onClick={(e) => e.stopPropagation()}
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
        </DataTableFrame>
      ) : (
        <DataTableFrame>
          {appointmentsQuery.isLoading ? (
            <TableSkeleton
              rows={5}
              cols={6}
              className="rounded-none border-0 shadow-none"
            />
          ) : filteredAppointments.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                className="rounded-none border-0"
                icon={Stethoscope}
                title={t(
                  "encounters.hub.emptyFilteredTitle",
                  "Žiadne výsledky pre zvolené filtre"
                )}
                description={t(
                  "encounters.hub.emptyFilteredDesc",
                  "Upravte alebo zrušte filtre a zobrazíte ďalšie vyšetrenia."
                )}
                action={{
                  label: t("encounters.hub.clearFilters", "Zrušiť filtre"),
                  onClick: clearFilters,
                  icon: X,
                }}
              />
            ) : (
              <EmptyState
                className="rounded-none border-0"
                icon={Stethoscope}
                title={t("encounters.hub.emptyTitle", "Žiadne vyšetrenia")}
                description={t(
                  "encounters.hub.emptyDescription",
                  "Žiadne vyšetrenia na tomto výhľade. Nové vyšetrenie vytvoríte v rozvrhu."
                )}
                action={{
                  label: t("encounters.hub.newEncounter", "Nové vyšetrenie"),
                  onClick: () => {
                    router.push("/schedule");
                  },
                  icon: CalendarPlus,
                }}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableTime", "Čas")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tablePatient", "Pacient")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableClient", "Majiteľ")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableType", "Typ úkonu")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableDoctor", "Lekár")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableLocation", "Miestnosť / Pobočka")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("encounters.hub.tableStatus", "Stav")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      {t("encounters.hub.tableActions", "Akcie")}
                    </th>
                  </tr>
                </thead>
                <tbody>
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
                          tableRowClass,
                          "cursor-pointer",
                          isInExam && "bg-success/5",
                          isCheckedIn && "bg-warning/5"
                        )}
                        onClick={() => router.push(`/encounters/${apt.id}`)}
                      >
                        <td
                          className={cn(
                            tableCellClass,
                            "whitespace-nowrap font-mono tabular-nums text-xs"
                          )}
                        >
                          <div className="font-semibold text-foreground">
                            {formatTime(apt.startTime)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {t("encounters.hub.until", "do {time}", {
                              time: formatTime(apt.endTime),
                            })}
                          </div>
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base" aria-hidden="true">
                              {emoji}
                            </span>
                            {apt.patientId ? (
                              <Link
                                href={`/patients/${apt.patientId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
                              >
                                <span>
                                  {apt.patientName ||
                                    t("dashboard.upcoming.unknownPatient", "Neznámy")}
                                </span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {apt.patientName ||
                                  t("dashboard.upcoming.unknownPatient", "Neznámy")}
                              </span>
                            )}
                          </div>
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          <div className="min-w-0 max-w-[12rem] truncate font-medium text-foreground">
                            {apt.clientFirstName} {apt.clientLastName}
                          </div>
                          {apt.clientPhone ? (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {apt.clientPhone}
                            </div>
                          ) : null}
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
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
  
                        <td className={cn(tableCellClass, "whitespace-nowrap text-xs text-foreground")}>
                          {apt.doctorName ? (
                            <div className="flex min-w-0 items-center gap-1">
                              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="max-w-[9rem] truncate">
                                {apt.doctorName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap text-xs text-muted-foreground")}>
                          <div className="flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span className="max-w-[9rem] truncate">
                              {apt.roomName ||
                                apt.locationName ||
                                t("encounters.hub.examRoomFallback", "Ambulancia")}
                            </span>
                          </div>
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap")}>
                          {getStatusBadge(apt.status)}
                        </td>
  
                        <td className={cn(tableCellClass, "whitespace-nowrap text-right")}>
                          {isInExam || isCheckedIn ? (
                            <Button size="sm" asChild className="gap-1.5 shadow-xs">
                              <Link
                                href={`/encounters/${apt.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Stethoscope className="h-3.5 w-3.5" />
                                {t("encounters.hub.enterRoom", "Otvoriť vyšetrenie")}
                              </Link>
                            </Button>
                          ) : isCheckedOut ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="gap-1.5"
                            >
                              <Link
                                href={`/encounters/${apt.id}#visit-closeout`}
                                onClick={(e) => e.stopPropagation()}
                              >
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
                              <Link
                                href={`/encounters/${apt.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
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
        </DataTableFrame>
      )}
    </div>
  );
}
