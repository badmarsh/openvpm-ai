"use client";

import { useEffect, useState } from "react";
import { PawPrint, Phone, Clock, Calendar, Sparkles } from "lucide-react";

export interface TvSlideItem {
  id: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  badge?: string | null;
  durationSeconds?: number | null;
}

export function TvPlayer({
  slides,
  practiceName,
  practicePhone,
}: {
  slides: TvSlideItem[];
  practiceName: string;
  practicePhone?: string | null;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Register service worker for offline TV cache
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/tv-sw.js").catch(() => {});
    }
  }, []);

  const activeSlides = slides.length > 0 ? slides : [
    {
      id: "default-1",
      title: "Vitajte v našej veterinárnej ambulancii",
      body: "Pre bezpečný priebeh vyšetrenia majte prosím psíkov na vôdzke a mačičky v prepravke. V prípade akútneho zhoršenia stavu bezodkladne informujte recepciu.",
      badge: "Informačný oznam",
      durationSeconds: 12,
    },
    {
      id: "default-2",
      title: "Sezónna ochrana pred parazitmi",
      body: "Kliešte a blchy sú aktívne počas celého teplého obdobia. Zastavte sa na recepcii pre originálne veterinárne žuvacie tablety alebo spot-on pipety.",
      badge: "Prevencia",
      durationSeconds: 12,
    },
    {
      id: "default-3",
      title: "Preventívna prehliadka a dentálna hygiena",
      body: "Pravidelná kontrola chrupu a ultrazvukové odstránenie zubného kameňa chráni srdce a obličky vášho miláčika.",
      badge: "Zdravie zubov",
      durationSeconds: 12,
    },
  ];

  const currentSlide = activeSlides[currentIndex % activeSlides.length];
  const slideDuration = (currentSlide.durationSeconds || 10) * 1000;

  // Slide rotation
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, slideDuration);
    return () => clearTimeout(timer);
  }, [currentIndex, activeSlides.length, slideDuration]);

  return (
    <div className="fixed inset-0 bg-[#090d0b] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Bar */}
      <header className="px-8 sm:px-12 pt-8 pb-4 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <PawPrint className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {practiceName}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-400 font-medium">
              Informačný panel pre čakáreň
            </p>
          </div>
        </div>

        <div className="text-right flex items-center gap-6">
          <div className="hidden sm:block">
            <div className="text-xs text-white/60 capitalize flex items-center justify-end gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {currentTime.toLocaleDateString("sk-SK", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
              {currentTime.toLocaleTimeString("sk-SK", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Slide Presentation */}
      <main className="flex-1 px-8 sm:px-16 py-8 flex items-center justify-center">
        <div
          key={currentSlide.id}
          className="w-full max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 sm:p-14 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-500 flex flex-col md:flex-row items-center gap-8"
        >
          {currentSlide.imageUrl && (
            <div className="w-full md:w-1/2 aspect-video md:aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-lg shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-5 flex-1 text-center md:text-left">
            {currentSlide.badge && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {currentSlide.badge}
              </span>
            )}

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {currentSlide.title}
            </h2>

            {currentSlide.body && (
              <p className="text-lg sm:text-2xl text-white/80 leading-relaxed font-light">
                {currentSlide.body}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer & Progress Indicators */}
      <footer className="px-8 sm:px-12 py-6 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {activeSlides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === currentIndex % activeSlides.length
                  ? "w-8 bg-emerald-400"
                  : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        {practicePhone && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Pohotovosť a objednávky: <strong className="text-white">{practicePhone}</strong></span>
          </div>
        )}
      </footer>
    </div>
  );
}
