"use client";

import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { NewBriefModal, type PillarOption } from "./new-brief-modal";
import {
  VeterinarianReviewModal,
  type ReviewBriefData,
} from "./veterinarian-review-modal";

const PILLAR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  preventive_care: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  dental_health: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  parasite_seasonal: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  senior_wellness: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  clinic_stories: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-slate-50 dark:bg-slate-900/40",
  text: "text-slate-700 dark:text-slate-300",
  border: "border-slate-200 dark:border-slate-800",
};

export function ContentCalendarTab() {
  const { t } = useI18n();

  // Queries
  const pillarsQuery = trpc.extensions.automationContent.listPillars.useQuery();
  const briefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: "all",
    limit: 100,
  });

  // State
  const [selectedPillarFilter, setSelectedPillarFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [newBriefModalOpen, setNewBriefModalOpen] = useState(false);
  const [modalScheduledDate, setModalScheduledDate] = useState<string>("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState<ReviewBriefData | null>(null);

  const pillars = (pillarsQuery.data || []) as PillarOption[];
  const briefs = (briefsQuery.data || []) as ReviewBriefData[];

  // Week days calculation (Monday to Sunday)
  const currentWeekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday
    // Calculate Monday
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const days: { date: Date; dateStr: string; dayIndex: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: d, dateStr, dayIndex: i });
    }
    return days;
  }, [currentDate]);

  // Filtered briefs
  const filteredBriefs = useMemo(() => {
    if (selectedPillarFilter === "all") return briefs;
    return briefs.filter(
      (b) => b.pillarKey === selectedPillarFilter || b.pillarId === selectedPillarFilter
    );
  }, [briefs, selectedPillarFilter]);

  // Briefs grouped by date
  const briefsByDate = useMemo(() => {
    const map = new Map<string, ReviewBriefData[]>();
    for (const b of filteredBriefs) {
      const source = (b as any).source as { scheduledDate?: string } | undefined;
      let dateKey = source?.scheduledDate;
      if (!dateKey && b.createdAt) {
        dateKey = new Date(b.createdAt).toISOString().slice(0, 10);
      }
      if (dateKey) {
        const existing = map.get(dateKey) || [];
        existing.push(b);
        map.set(dateKey, existing);
      }
    }
    return map;
  }, [filteredBriefs]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOpenNewBriefForDate = (dateStr: string) => {
    setModalScheduledDate(dateStr);
    setNewBriefModalOpen(true);
  };

  const handleOpenReview = (brief: ReviewBriefData) => {
    setSelectedBrief(brief);
    setReviewModalOpen(true);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const dayHeadersShort = [
    t("marketing.calendar.dayNamesShort.0", "Po"),
    t("marketing.calendar.dayNamesShort.1", "Ut"),
    t("marketing.calendar.dayNamesShort.2", "St"),
    t("marketing.calendar.dayNamesShort.3", "Št"),
    t("marketing.calendar.dayNamesShort.4", "Pi"),
    t("marketing.calendar.dayNamesShort.5", "So"),
    t("marketing.calendar.dayNamesShort.6", "Ne"),
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {t("marketing.calendar.pageTitle", "Kalendár obsahu")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t(
              "marketing.calendar.pageSubtitle",
              "Plánovanie a správa príspevkov pre sociálne siete podľa strategických pilierov"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setModalScheduledDate(todayStr);
              setNewBriefModalOpen(true);
            }}
            className="text-xs gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("marketing.calendar.newBriefButton", "Nový návrh obsahu")}</span>
          </Button>
        </div>
      </div>

      {/* Strategy Pillars Summary Chips */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {t("marketing.calendar.pillarsTitle", "Strategické piliere kliniky")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t("marketing.calendar.postsCount", `${filteredBriefs.length} príspevkov`, {
              count: filteredBriefs.length,
            })}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedPillarFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              selectedPillarFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
            )}
          >
            {t("marketing.calendar.allPillars", "Všetky piliere")} ({briefs.length})
          </button>
          {pillars.map((pillar) => {
            const count = briefs.filter(
              (b) => b.pillarKey === pillar.pillarKey || b.pillarId === pillar.id
            ).length;
            const color = PILLAR_COLORS[pillar.pillarKey] || DEFAULT_COLOR;
            const isSelected = selectedPillarFilter === pillar.pillarKey;

            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() =>
                  setSelectedPillarFilter(isSelected ? "all" : pillar.pillarKey)
                }
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : cn(color.bg, color.text, color.border, "hover:opacity-80")
                )}
              >
                <span>{pillar.title}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Calendar Controls & Grid */}
      <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
        {/* Calendar Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">
              {currentDate.toLocaleDateString("sk-SK", {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden bg-background">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-8 px-2.5 text-xs rounded-none"
                title={t("marketing.calendar.prev", "Predchádzajúci")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-8 px-3 text-xs rounded-none border-x font-medium"
              >
                {t("marketing.calendar.today", "Dnes")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                className="h-8 px-2.5 text-xs rounded-none"
                title={t("marketing.calendar.next", "Ďalší")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {briefsQuery.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* Week Grid (7 columns) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {currentWeekDays.map(({ date, dateStr, dayIndex }) => {
              const isToday = dateStr === todayStr;
              const dayBriefs = briefsByDate.get(dateStr) || [];

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "group relative border rounded-xl p-3 flex flex-col min-h-[190px] transition-all bg-card/60",
                    isToday && "ring-2 ring-primary/60 border-primary bg-primary/5"
                  )}
                >
                  {/* Day Cell Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {dayHeadersShort[dayIndex]}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenNewBriefForDate(dateStr)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-muted"
                      title={t(
                        "marketing.calendar.scheduleForDate",
                        `Naplánovať na ${dateStr}`,
                        { date: dateStr }
                      )}
                    >
                      <Plus className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  </div>

                  {/* Briefs on this day */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[220px]">
                    {dayBriefs.map((brief) => {
                      const color =
                        (brief.pillarKey && PILLAR_COLORS[brief.pillarKey]) ||
                        DEFAULT_COLOR;
                      const hasClaims = (brief.clinicalClaims?.length || 0) > 0;

                      return (
                        <div
                          key={brief.id}
                          onClick={() => handleOpenReview(brief)}
                          className={cn(
                            "cursor-pointer border rounded-lg p-2 text-left transition-all hover:shadow-xs space-y-1",
                            color.bg,
                            color.border
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "text-[10px] font-bold truncate",
                                color.text
                              )}
                            >
                              {brief.pillarTitle || "Obsah"}
                            </span>
                            {brief.status === "review" && (
                              <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 h-4">
                                {t("marketing.calendar.statusReview", "Čaká na lekára")}
                              </Badge>
                            )}
                            {brief.status === "approved" && (
                              <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 h-4">
                                {t("marketing.calendar.statusApproved", "Schválené")}
                              </Badge>
                            )}
                            {brief.status === "rejected" && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                {t("marketing.calendar.statusRejected", "Vrátené")}
                              </Badge>
                            )}
                            {brief.status === "pending" && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background">
                                {t("marketing.calendar.statusScheduled", "Plán")}
                              </Badge>
                            )}
                          </div>

                          <p className="text-[11px] font-medium line-clamp-2 leading-snug">
                            {brief.briefText}
                          </p>

                          <div className="flex items-center justify-between pt-0.5">
                            <div className="flex items-center gap-1">
                              {hasClaims && (
                                <span
                                  className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300"
                                  title={t(
                                    "marketing.calendar.claimsBadge",
                                    "Klinické tvrdenia"
                                  )}
                                >
                                  <Stethoscope className="h-3 w-3" />
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground uppercase">
                              {brief.targetChannels?.slice(0, 2).map((ch) => (
                                <span key={ch} className="px-1 py-0.2 rounded bg-background border">
                                  {ch === "google_business"
                                    ? "GBP"
                                    : ch === "facebook"
                                    ? "FB"
                                    : ch === "instagram"
                                    ? "IG"
                                    : ch}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {dayBriefs.length === 0 && (
                      <div className="h-full flex items-center justify-center py-6 text-[10px] text-muted-foreground/60 border border-dashed rounded-lg">
                        —
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Brief Modal */}
      <NewBriefModal
        open={newBriefModalOpen}
        onOpenChange={setNewBriefModalOpen}
        pillars={pillars}
        defaultScheduledDate={modalScheduledDate}
      />

      {/* Veterinarian Review Modal */}
      <VeterinarianReviewModal
        brief={selectedBrief}
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
      />
    </div>
  );
}
