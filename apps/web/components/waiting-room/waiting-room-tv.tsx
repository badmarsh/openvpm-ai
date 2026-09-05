"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Tv,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  PawPrint,
  ShieldAlert,
  CalendarCheck,
  HeartPulse,
  Users,
  CheckCircle2,
  RefreshCw,
  ListOrdered,
  Timer,
  Sun,
  Snowflake,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Audio chime — plays a short notification tone when a patient checks in
// ---------------------------------------------------------------------------
function playCheckInChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Web Audio not available — silent fallback
  }
}

// ---------------------------------------------------------------------------
// Context-aware & Seasonal Health-tip announcements
// ---------------------------------------------------------------------------
export interface AnnouncementItem {
  icon: React.ReactNode;
  titleKey: string;
  bodyKey: string;
  category: "spring" | "summer" | "autumn" | "winter" | "feline" | "puppy" | "general";
}

const ALL_HEALTH_ANNOUNCEMENTS: AnnouncementItem[] = [
  // Jarné
  {
    icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
    titleKey: "waitingRoom.announcement.tickTitle",
    bodyKey: "waitingRoom.announcement.tickBody",
    category: "spring",
  },
  {
    icon: <ShieldAlert className="h-4 w-4 text-orange-500" />,
    titleKey: "waitingRoom.announcement.parasiteTitle",
    bodyKey: "waitingRoom.announcement.parasiteBody",
    category: "spring",
  },
  // Letné
  {
    icon: <Sun className="h-4 w-4 text-amber-500" />,
    titleKey: "waitingRoom.announcement.heatTitle",
    bodyKey: "waitingRoom.announcement.heatBody",
    category: "summer",
  },
  // Zimné
  {
    icon: <Snowflake className="h-4 w-4 text-cyan-500" />,
    titleKey: "waitingRoom.announcement.winterTitle",
    bodyKey: "waitingRoom.announcement.winterBody",
    category: "winter",
  },
  // Mačacie
  {
    icon: <HeartPulse className="h-4 w-4 text-pink-500" />,
    titleKey: "waitingRoom.announcement.felineStressTitle",
    bodyKey: "waitingRoom.announcement.felineStressBody",
    category: "feline",
  },
  // Šteňacie
  {
    icon: <PawPrint className="h-4 w-4 text-emerald-500" />,
    titleKey: "waitingRoom.announcement.puppySocialTitle",
    bodyKey: "waitingRoom.announcement.puppySocialBody",
    category: "puppy",
  },
  // Celoročné základné
  {
    icon: <HeartPulse className="h-4 w-4 text-rose-500" />,
    titleKey: "waitingRoom.announcement.dentalTitle",
    bodyKey: "waitingRoom.announcement.dentalBody",
    category: "general",
  },
  {
    icon: <PawPrint className="h-4 w-4 text-blue-500" />,
    titleKey: "waitingRoom.announcement.vaccineTitle",
    bodyKey: "waitingRoom.announcement.vaccineBody",
    category: "general",
  },
  {
    icon: <HeartPulse className="h-4 w-4 text-violet-500" />,
    titleKey: "waitingRoom.announcement.seniorTitle",
    bodyKey: "waitingRoom.announcement.seniorBody",
    category: "general",
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TvSlide {
  id: string;
  title: string;
  body: string | null;
  durationSeconds: number;
  isActive: boolean;
  mediaAssetId: string | null;
}

interface WaitingRoomTvProps {
  /** When true, renders in embedded mode (no page-level padding, controlled externally) */
  embedded?: boolean;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function WaitingRoomTv({ embedded = false }: WaitingRoomTvProps) {
  const { t, locale } = useI18n();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const prevCheckedInCountRef = useRef(0);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const { data: branding } = trpc.settings.getBranding.useQuery();

  const {
    data: activeAppointments,
    isLoading,
    dataUpdatedAt,
  } = trpc.whiteboard.getActive.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const { data: waitlistData } = trpc.waitlist.list.useQuery(
    { status: "waiting" },
    { refetchInterval: 30000 },
  );

  // Fetch custom marketing TV slides
  const { data: tvSlides } = trpc.extensions.marketing.listTvSlides.useQuery();

  const waitlistEntries = waitlistData ?? [];

  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const appointments = activeAppointments ?? [];

  // Dynamic context-aware announcement list (Seasonal + Live patient mix)
  const dynamicAnnouncements = useMemo(() => {
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    let currentSeason: "spring" | "summer" | "autumn" | "winter";
    if (month >= 2 && month <= 4) currentSeason = "spring";
    else if (month >= 5 && month <= 7) currentSeason = "summer";
    else if (month >= 8 && month <= 9) currentSeason = "autumn";
    else currentSeason = "winter";

    const hasFelinePresent = appointments.some((a) => {
      const sp = (a.patientSpecies || "").toLowerCase();
      return (a.status === "checked_in" || a.status === "in_exam") && (sp.includes("fel") || sp.includes("cat") || sp.includes("mačk"));
    });

    const hasPuppyPresent = appointments.some((a) => {
      const name = (a.patientName || "").toLowerCase();
      const notes = (a.notes || "").toLowerCase();
      const type = (a.typeName || "").toLowerCase();
      return (
        (a.status === "checked_in" || a.status === "in_exam") &&
        (name.includes("šteňa") || name.includes("puppy") || notes.includes("šteňa") || notes.includes("puppy") || type.includes("očkov") || type.includes("vaccin"))
      );
    });

    const list: AnnouncementItem[] = [];

    // 1. Live patient context (highest priority when relevant)
    if (hasFelinePresent) {
      list.push(...ALL_HEALTH_ANNOUNCEMENTS.filter((a) => a.category === "feline"));
    }
    if (hasPuppyPresent) {
      list.push(...ALL_HEALTH_ANNOUNCEMENTS.filter((a) => a.category === "puppy"));
    }

    // 2. Current season announcements
    list.push(...ALL_HEALTH_ANNOUNCEMENTS.filter((a) => a.category === currentSeason));

    // 3. General baseline
    list.push(...ALL_HEALTH_ANNOUNCEMENTS.filter((a) => a.category === "general"));

    return list.length > 0 ? list : ALL_HEALTH_ANNOUNCEMENTS;
  }, [appointments]);

  // Build rotation items: custom slides if any, otherwise fallback announcements
  const activeSlides = (tvSlides as TvSlide[] | undefined)?.filter(
    (s) => s.isActive,
  ) ?? [];
  const hasCustomSlides = activeSlides.length > 0;

  // Rotation interval — use each slide's durationSeconds, or 12s for fallback
  useEffect(() => {
    const ms = hasCustomSlides
      ? (activeSlides[slideIndex % activeSlides.length]?.durationSeconds ?? 12) * 1000
      : 12000;
    const totalItems = hasCustomSlides ? activeSlides.length : dynamicAnnouncements.length;
    const interval = setInterval(
      () => setSlideIndex((i) => (i + 1) % totalItems),
      ms,
    );
    return () => clearInterval(interval);
  }, [hasCustomSlides, activeSlides, slideIndex, dynamicAnnouncements.length]);

  // Categorize
  const inExam = appointments.filter((a) => a.status === "in_exam");
  const checkedIn = appointments.filter((a) => a.status === "checked_in");
  const upcoming = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "scheduled",
  );
  const completedToday = appointments.filter((a) => a.status === "checked_out");

  // Sound notification
  useEffect(() => {
    if (!soundEnabled) return;
    if (checkedIn.length > prevCheckedInCountRef.current && prevCheckedInCountRef.current >= 0) {
      playCheckInChime();
    }
    prevCheckedInCountRef.current = checkedIn.length;
  }, [checkedIn.length, soundEnabled]);

  const formatTime = (d: Date | null) => {
    if (!d) return "--:--:--";
    return d.toLocaleTimeString(locale === "sk" ? "sk-SK" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString(locale === "sk" ? "sk-SK" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatShortTime = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleTimeString(locale === "sk" ? "sk-SK" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getEmoji = (species: string | null | undefined) => {
    if (!species) return "🐾";
    return (PATIENT_SPECIES_EMOJI as Record<string, string>)[species.toLowerCase()] || "🐾";
  };

  // Current rotation pair (2 visible at a time)
  const totalItems = hasCustomSlides ? activeSlides.length : dynamicAnnouncements.length;
  const firstIdx = slideIndex % totalItems;
  const secondIdx = (slideIndex + 1) % totalItems;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6 text-slate-100"
          : embedded
            ? "space-y-6"
            : "space-y-6 p-6"
      }
    >
      {/* ─── Top Header Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
              <Tv className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight">
                {branding?.name || "OpenVPM"}
              </h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold uppercase">
                {t("nav.waitingRoomTv", "Čakáreň TV")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <RefreshCw className="h-3 w-3" />
              <span>
                {t("waitingRoom.updated", "Updated")}{" "}
                {formatShortTime(lastRefreshed)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-mono text-base font-bold tabular-nums">
            <Clock className="h-4 w-4 text-primary" />
            <span>{formatTime(currentTime)}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled((v) => !v)}
            title={
              soundEnabled
                ? t("waitingRoom.muteSound", "Mute sound notifications")
                : t("waitingRoom.enableSound", "Enable sound notifications")
            }
            className="h-9 w-9 p-0"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-primary" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={toggleFullscreen}
            className="gap-1.5"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("waitingRoom.exitTvMode", "Exit TV Mode")}
                </span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("waitingRoom.fullscreenTv", "Fullscreen (TV)")}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Summary Stats Bar ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip
          icon={<PawPrint className="h-4 w-4 text-emerald-500" />}
          label={t("waitingRoom.inExam", "In Exam")}
          value={inExam.length}
          color="emerald"
        />
        <StatChip
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label={t("waitingRoom.waiting", "Waiting")}
          value={checkedIn.length}
          color="amber"
        />
        <StatChip
          icon={<Timer className="h-4 w-4 text-blue-500" />}
          label={t("waitingRoom.upcoming", "Upcoming")}
          value={upcoming.length}
          color="blue"
        />
        <StatChip
          icon={<CheckCircle2 className="h-4 w-4 text-slate-400" />}
          label={t("waitingRoom.done", "Done")}
          value={completedToday.length}
          color="slate"
        />
      </div>

      {/* ─── Main TV Board Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1: IN EXAM */}
        <Card className="border-2 border-emerald-500/40 bg-card shadow-sm">
          <CardHeader className="bg-emerald-500/10 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </span>
                {t("waitingRoom.nowInExam", "Now in Exam")}
              </CardTitle>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                {inExam.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {inExam.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <PawPrint className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t("waitingRoom.examRoomReady", "Exam room ready for next patient")}
              </div>
            ) : (
              inExam.map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3.5 dark:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{getEmoji(apt.patientSpecies)}</span>
                      <div>
                        <p className="text-base font-bold text-foreground">
                          {apt.patientName || t("waitingRoom.patient", "Patient")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.clientLastName
                            ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                            : t("waitingRoom.client", "Client")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {apt.roomName && (
                        <Badge variant="outline" className="text-xs font-semibold">
                          {apt.roomName}
                        </Badge>
                      )}
                      {apt.typeName && (
                        <span className="text-[10px] text-muted-foreground">
                          {apt.typeName}
                        </span>
                      )}
                    </div>
                  </div>
                  {apt.doctorName && (
                    <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      👨‍⚕️ {apt.doctorName}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Column 2: WAITING / CHECKED IN */}
        <Card className="border-2 border-amber-500/40 bg-card shadow-sm">
          <CardHeader className="bg-amber-500/10 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                {t("waitingRoom.getReadyWaiting", "Get Ready / Waiting")}
              </CardTitle>
              <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs">
                {checkedIn.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {checkedIn.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CalendarCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t("waitingRoom.noPatientsWaiting", "No patients currently waiting")}
              </div>
            ) : (
              checkedIn.map((apt, idx) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50/50 p-3.5 dark:bg-amber-950/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-200">
                      #{idx + 1}
                    </span>
                    <span className="text-2xl">{getEmoji(apt.patientSpecies)}</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {apt.patientName || t("waitingRoom.patient", "Patient")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.clientLastName
                          ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                          : t("waitingRoom.client", "Client")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {apt.typeName || t("waitingRoom.exam", "Exam")}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatShortTime(apt.startTime)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Column 3: SLIDES / ANNOUNCEMENTS + WAITLIST + UPCOMING */}
        <div className="space-y-4">
          {/* Rotating Custom Slides or Fallback Announcements */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                {hasCustomSlides
                  ? t("marketing.tv.title", "Čakáreň TV – Slajdy")
                  : t("waitingRoom.announcementsTitle", "Clinic Announcements & Health Tips")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs text-muted-foreground">
              {hasCustomSlides ? (
                // Custom marketing slides rotation
                <>
                  {[firstIdx, secondIdx].map((idx, i) => {
                    const slide = activeSlides[idx];
                    if (!slide) return null;
                    return (
                      <div
                        key={`${slideIndex}-${i}`}
                        className="rounded-lg border border-border bg-muted/40 p-3 transition-all duration-500"
                      >
                        <div className="font-semibold text-foreground">
                          {slide.title}
                        </div>
                        {slide.body && (
                          <p className="mt-1 leading-relaxed">{slide.body}</p>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                // Dynamic contextual & seasonal announcements
                <>
                  {[dynamicAnnouncements[firstIdx], dynamicAnnouncements[secondIdx]].filter(Boolean).map(
                    (a, i) => (
                      <div
                        key={`${slideIndex}-${i}`}
                        className="rounded-lg border border-border bg-muted/40 p-3 transition-all duration-500"
                      >
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          {a.icon}
                          {t(a.titleKey)}
                        </div>
                        <p className="mt-1 leading-relaxed">{t(a.bodyKey)}</p>
                      </div>
                    ),
                  )}
                </>
              )}

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-primary">
                <p className="font-semibold">
                  {t("waitingRoom.urgentCareBooking", "Urgent care & booking:")}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/80">
                  {t("waitingRoom.bookingHelp", "Book appointments via the client portal or contact reception.")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Waitlist Section */}
          {waitlistEntries.length > 0 && (
            <Card className="border border-violet-500/30 bg-card shadow-sm">
              <CardHeader className="bg-violet-500/5 pb-2 pt-3">
                <CardTitle className="flex items-center justify-between text-xs font-bold text-violet-700 dark:text-violet-400">
                  <span className="flex items-center gap-2">
                    <ListOrdered className="h-3.5 w-3.5" />
                    {t("waitingRoom.waitlist", "Waitlist")}
                  </span>
                  <Badge className="bg-violet-600 text-white text-[10px]">
                    {waitlistEntries.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                {waitlistEntries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-violet-500/10 bg-violet-50/30 p-2.5 text-xs dark:bg-violet-950/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {getEmoji((entry as any).patient?.species)}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          {(entry as any).patient?.name || t("waitingRoom.patient", "Patient")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(entry as any).client
                            ? `${(entry as any).client.lastName} (${(entry as any).client.firstName?.[0] || ""}.)`
                            : ""}
                        </p>
                      </div>
                    </div>
                    {(entry as any).type && (
                      <Badge variant="outline" className="text-[10px]">
                        {(entry as any).type.name}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming next visits preview */}
          {upcoming.length > 0 && (
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  {t("waitingRoom.scheduledToday", "Scheduled today ({count})", { count: upcoming.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-1">
                {upcoming.slice(0, 6).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {getEmoji(apt.patientSpecies)} {apt.patientName}
                    </span>
                    <div className="flex items-center gap-2">
                      {apt.typeName && (
                        <span className="text-[10px] text-muted-foreground">
                          {apt.typeName}
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatShortTime(apt.startTime)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Completed Today Footer ─── */}
      {completedToday.length > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            {t("waitingRoom.completedToday", "Completed today: {count}", { count: completedToday.length })}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Chip
// ---------------------------------------------------------------------------
function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "emerald" | "amber" | "blue" | "slate";
}) {
  const bgMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    amber: "bg-amber-500/10 border-amber-500/20",
    blue: "bg-blue-500/10 border-blue-500/20",
    slate: "bg-slate-500/10 border-slate-500/20",
  };
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${bgMap[color]}`}
    >
      {icon}
      <div>
        <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}
