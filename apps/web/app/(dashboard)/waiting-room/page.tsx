"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
// Main Page
// ---------------------------------------------------------------------------
export default function WaitingRoomPage() {
  const { t, locale } = useI18n();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  // Track previous checked-in count to detect new arrivals
  const prevCheckedInCountRef = useRef(0);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate announcements every 12 seconds
  useEffect(() => {
    const interval = setInterval(
      () => setAnnouncementIndex((i) => (i + 1) % ANNOUNCEMENTS.length),
      12000,
    );
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

  // Waitlist data
  const { data: waitlistData } = trpc.waitlist.list.useQuery(
    { status: "waiting" },
    { refetchInterval: 30000 },
  );

  const waitlistEntries = waitlistData ?? [];

  // Track refresh time
  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const appointments = activeAppointments ?? [];

  // Categorize
  const inExam = appointments.filter((a) => a.status === "in_exam");
  const checkedIn = appointments.filter((a) => a.status === "checked_in");
  const upcoming = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "scheduled",
  );
  const completedToday = appointments.filter((a) => a.status === "checked_out");

  // Sound notification: play chime when a new patient checks in
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

  // Current announcement pair (2 visible at a time)
  const visibleAnnouncements = [
    ANNOUNCEMENTS[announcementIndex % ANNOUNCEMENTS.length],
    ANNOUNCEMENTS[(announcementIndex + 1) % ANNOUNCEMENTS.length],
  ];

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6 text-slate-100"
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
                {t("nav.waitingRoom", "Čakáreň TV")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>

        {/* Live Clock & Controls */}
        <div className="flex items-center gap-3">
          {/* Last refreshed indicator */}
          {lastRefreshed && (
            <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <RefreshCw className="h-3 w-3" />
              <span>
                {locale === "sk" ? "Aktualizované" : "Updated"}{" "}
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
                ? locale === "sk"
                  ? "Vypnúť zvukové upozornenia"
                  : "Mute sound notifications"
                : locale === "sk"
                  ? "Zapnúť zvukové upozornenia"
                  : "Enable sound notifications"
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
                  {locale === "sk" ? "Ukončiť TV mód" : "Exit TV Mode"}
                </span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {locale === "sk" ? "Celá obrazovka (TV)" : "Fullscreen (TV)"}
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
          label={locale === "sk" ? "V ordinácii" : "In Exam"}
          value={inExam.length}
          color="emerald"
        />
        <StatChip
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label={locale === "sk" ? "V čakárni" : "Waiting"}
          value={checkedIn.length}
          color="amber"
        />
        <StatChip
          icon={<Timer className="h-4 w-4 text-blue-500" />}
          label={locale === "sk" ? "Naplánované" : "Upcoming"}
          value={upcoming.length}
          color="blue"
        />
        <StatChip
          icon={<CheckCircle2 className="h-4 w-4 text-slate-400" />}
          label={locale === "sk" ? "Dokončené" : "Done"}
          value={completedToday.length}
          color="slate"
        />
      </div>

      {/* ─── Main TV Board Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1: PRÁVE V ORDINÁCII (IN EXAM) */}
        <Card className="border-2 border-emerald-500/40 bg-card shadow-sm">
          <CardHeader className="bg-emerald-500/10 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </span>
                {locale === "sk" ? "Práve v ordinácii" : "Now in Exam"}
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
                {locale === "sk"
                  ? "Ordinácia je pripravená na ďalšieho pacienta"
                  : "Exam room ready for next patient"}
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
                          {apt.patientName || (locale === "sk" ? "Pacient" : "Patient")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.clientLastName
                            ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                            : locale === "sk"
                              ? "Klient"
                              : "Client"}
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

        {/* Column 2: PRIPRAVTE SA / NA RADE (CHECKED IN) */}
        <Card className="border-2 border-amber-500/40 bg-card shadow-sm">
          <CardHeader className="bg-amber-500/10 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                {locale === "sk" ? "Pripravte sa / V čakárni" : "Get Ready / Waiting"}
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
                {locale === "sk"
                  ? "Žiadni pacienti momentálne nečakajú v čakárni"
                  : "No patients currently waiting"}
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
                        {apt.patientName || (locale === "sk" ? "Pacient" : "Patient")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.clientLastName
                          ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                          : locale === "sk"
                            ? "Klient"
                            : "Client"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {apt.typeName || (locale === "sk" ? "Vyšetrenie" : "Exam")}
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

        {/* Column 3: ANNOUNCEMENTS + WAITLIST + UPCOMING */}
        <div className="space-y-4">
          {/* Rotating Announcements */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                {locale === "sk" ? "Oznamy kliniky & Zdravotné tipy" : "Clinic Announcements & Health Tips"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs text-muted-foreground">
              {visibleAnnouncements.map((a, i) => (
                <div
                  key={`${announcementIndex}-${i}`}
                  className="rounded-lg border border-border bg-muted/40 p-3 transition-all duration-500"
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    {a.icon}
                    {a.title}
                  </div>
                  <p className="mt-1 leading-relaxed">{a.body}</p>
                </div>
              ))}

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-primary">
                <p className="font-semibold">
                  {locale === "sk" ? "Pohotovosť a objednávanie:" : "Urgent care & booking:"}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/80">
                  {locale === "sk"
                    ? "Pre objednanie termínu využite klientsky portál alebo kontaktujte recepciu."
                    : "Book appointments via the client portal or contact reception."}
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
                    {locale === "sk" ? "Poradovník" : "Waitlist"}
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
                          {(entry as any).patient?.name || (locale === "sk" ? "Pacient" : "Patient")}
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
                  {locale === "sk"
                    ? `Plánované termíny dnes (${upcoming.length})`
                    : `Scheduled today (${upcoming.length})`}
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
            {locale === "sk"
              ? `Dnes dokončených vyšetrení: ${completedToday.length}`
              : `Completed today: ${completedToday.length}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Chip — small summary card for the stats bar
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

// ---------------------------------------------------------------------------
// Announcement data
// ---------------------------------------------------------------------------
const ANNOUNCEMENTS: Array<{ icon: React.ReactNode; title: string; body: string }> = [
  {
    icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
    title: "Kliešťová sezóna je v plnom prúde",
    body: "Nezabudnite na účinnú ochranu proti kliešťom a blchám (pipety, obojky, tablety). Chráňte svojich miláčikov pred boreliózou a anaplazmózou.",
  },
  {
    icon: <HeartPulse className="h-4 w-4 text-rose-500" />,
    title: "Zubná hygiena & prevencia",
    body: "Zápach z tlamy zvieraťa často signalizuje zubný kameň alebo zápal ďasien. Spýtajte sa lekára na bezplatnú kontrolu chrupu.",
  },
  {
    icon: <PawPrint className="h-4 w-4 text-blue-500" />,
    title: "Pravidelné očkovanie",
    body: "Očkovanie proti besnote je zákonná povinnosť. Skontrolujte si platnosť očkovania vášho psíka alebo mačky v očkovacom preukaze.",
  },
  {
    icon: <HeartPulse className="h-4 w-4 text-violet-500" />,
    title: "Seniorsky skríning (7+ rokov)",
    body: "Starší psi a mačky profitujú z preventívneho krvného rozboru a kontroly obličiek a pečene. Včasné odhalenie predlžuje život.",
  },
  {
    icon: <ShieldAlert className="h-4 w-4 text-orange-500" />,
    title: "Antiparazitiká celoročne",
    body: "Odčervovanie a antiparazitárna prevencia nie sú len letnou záležitosťou. Poradíme vám s vhodným programom na mieru.",
  },
];
