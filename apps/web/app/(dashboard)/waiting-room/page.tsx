"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { useI18n } from "@/lib/i18n";

export default function WaitingRoomPage() {
  const { t, locale } = useI18n();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to fullscreen changes
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
  } = trpc.whiteboard.getActive.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const appointments = activeAppointments ?? [];

  // Categorize
  const inExam = appointments.filter(
    (a) => a.status === "in_exam"
  );
  const checkedIn = appointments.filter(
    (a) => a.status === "checked_in"
  );
  const upcoming = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "scheduled"
  );

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

  const getEmoji = (species: string | null | undefined) => {
    if (!species) return "🐾";
    return (PATIENT_SPECIES_EMOJI as Record<string, string>)[species.toLowerCase()] || "🐾";
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6 text-slate-100"
          : "space-y-6 p-6"
      }
    >
      {/* Top Header Bar */}
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
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-mono text-base font-bold tabular-nums">
            <Clock className="h-4 w-4 text-primary" />
            <span>{formatTime(currentTime)}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Vypnúť zvuk" : "Zapnúť zvukové upozornenia"}
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
                <span className="hidden sm:inline">Ukončiť TV mód</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Celá obrazovka (TV)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main TV Board Grid */}
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
                Práve v ordinácii
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
                Ordinácia je pripravená na ďalšieho pacienta
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
                          {apt.patientName || "Pacient"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.clientLastName
                            ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                            : "Klient"}
                        </p>
                      </div>
                    </div>
                    {apt.roomName && (
                      <Badge variant="outline" className="text-xs font-semibold">
                        {apt.roomName}
                      </Badge>
                    )}
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

        {/* Column 2: PRIPRAVTE SA / NA RADe (CHECKED IN) */}
        <Card className="border-2 border-amber-500/40 bg-card shadow-sm">
          <CardHeader className="bg-amber-500/10 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                Pripravte sa / V čakárni
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
                Žiadni pacienti momentálne nečakajú v čakárni
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
                        {apt.patientName || "Pacient"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.clientLastName
                          ? `${apt.clientLastName} (${apt.clientFirstName?.[0] || ""}.)`
                          : "Klient"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {apt.typeName || "Vyšetrenie"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Column 3: CLINIC ANNOUNCEMENTS & HEALTH TIPS */}
        <div className="space-y-4">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                Oznamy kliniky & Zdravotné tipy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs text-muted-foreground">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Kliešťová sezóna je v plnom prúde
                </div>
                <p className="mt-1 leading-relaxed">
                  Nezabudnite na účinnú ochranu proti kliešťom a blchám (pipety, obojky, tablety). Chráňte svojich miláčikov pred boreliózou a anaplazmózou.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <HeartPulse className="h-4 w-4 text-rose-500" />
                  Zubná hygiena & prevencia
                </div>
                <p className="mt-1 leading-relaxed">
                  Zápach z tlamy zvieraťa často signalizuje zubný kameň alebo zápal ďasien. Spýtajte sa lekára na bezplatnú kontrolu chrupu.
                </p>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-primary">
                <p className="font-semibold">Pohotovosť a objednávanie:</p>
                <p className="mt-0.5 text-[11px] text-foreground/80">
                  Pre objednanie termínu využite klientsky portál alebo kontaktujte recepciu.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming next visits preview */}
          {upcoming.length > 0 && (
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Plánované termíny dnes ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-1">
                {upcoming.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {getEmoji(apt.patientSpecies)} {apt.patientName}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(apt.startTime).toLocaleTimeString(locale === "sk" ? "sk-SK" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
