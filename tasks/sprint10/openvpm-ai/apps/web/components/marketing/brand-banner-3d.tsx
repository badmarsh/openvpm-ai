"use client";

import { memo, useMemo } from "react";
import { PawPrint, MapPin, Phone, Mail, ExternalLink, Instagram, Facebook, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandBanner3DProps {
  clinicName: string;
  brandColor: string;
  accentColor: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  bookingUrl?: string;
}

/**
 * Auto-generated brand banner with isometric / 3D perspective
 * Dynamically creates a visual banner using the clinic's brand colors
 */
export const BrandBanner3D = memo(function BrandBanner3D({
  clinicName,
  brandColor,
  accentColor,
  phone,
  instagram,
  facebook,
  tiktok,
  bookingUrl,
}: BrandBanner3DProps) {
  const words = clinicName.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (clinicName.slice(0, 2) || "V").toUpperCase();

  // Generate random-ish but deterministic decoration positions from clinic name
  const decorations = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < clinicName.length; i++) {
      seed = (seed * 31 + clinicName.charCodeAt(i)) | 0;
    }
    const abs = Math.abs(seed);

    const circles = Array.from({ length: 6 }, (_, i) => ({
      cx: 15 + ((abs >> (i * 4)) % 70),
      cy: 20 + ((abs >> (i * 3 + 2)) % 50),
      r: 8 + ((abs >> (i * 2 + 1)) % 25),
      opacity: 0.06 + ((abs >> (i + 3)) % 8) * 0.02,
    }));

    const paws = Array.from({ length: 3 }, (_, i) => ({
      x: 10 + ((abs >> (i * 5)) % 80),
      y: 30 + ((abs >> (i * 4 + 1)) % 40),
      rot: ((abs >> (i * 2)) % 60) - 30,
      scale: 0.6 + ((abs >> (i * 3)) % 4) * 0.2,
    }));

    return { circles, paws };
  }, [clinicName]);

  // Determine if we need light or dark text on brand color
  const getLuminance = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const brandLuminance = getLuminance(brandColor);
  const isBrandDark = brandLuminance < 128;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/50 shadow-2xl bg-white dark:bg-stone-900">
      {/* ── Banner Background with Isometric Pattern ── */}
      <div className="relative h-48 sm:h-56 md:h-64">
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 35%, ${accentColor}80 65%, ${accentColor}40 100%)`,
          }}
        />

        {/* Isometric geometric pattern overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id={`iso-pattern-${initials}`}
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
              patternTransform="skewX(-20) skewY(-10)"
            >
              <path
                d="M40 0 L80 20 L80 60 L40 80 L0 60 L0 20 Z"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
                opacity="0.4"
              />
              <path
                d="M40 10 L70 25 L70 55 L40 70 L10 55 L10 25 Z"
                fill="none"
                stroke="white"
                strokeWidth="0.3"
                opacity="0.2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#iso-pattern-${initials})`} />
        </svg>

        {/* Decorative circles */}
        {decorations.circles.map((c, i) => (
          <div
            key={`circle-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${c.cx}%`,
              top: `${c.cy}%`,
              width: `${c.r * 4}px`,
              height: `${c.r * 4}px`,
              backgroundColor: "white",
              opacity: c.opacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Paw print decorations */}
        {decorations.paws.map((p, i) => (
          <div
            key={`paw-${i}`}
            className="absolute text-white/30"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale})`,
            }}
          >
            <PawPrint className="h-8 w-8" />
          </div>
        ))}

        {/* Isometric shadow / depth effect */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: `linear-gradient(to top, ${brandColor}40, transparent)`,
          }}
        />

        {/* ── Foreground Content ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-8">
          {/* Top row — Clinic name + logo */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Logo badge */}
            <div
              className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-xl text-xl sm:text-2xl font-bold backdrop-blur-md border transition-transform duration-300 hover:scale-105"
              style={{
                backgroundColor: isBrandDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                borderColor: "rgba(255,255,255,0.3)",
                color: "#fff",
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {initials}
              {/* Shine effect */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
                }}
              />
            </div>

            {/* Clinic name */}
            <div>
              <h2
                className="text-xl sm:text-2xl font-bold tracking-tight drop-shadow-lg leading-tight"
                style={{ color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {clinicName}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5 drop-shadow-sm font-medium">
                Veterinárna klinika & ordinácia
              </p>
            </div>
          </div>

          {/* Bottom row — Contact info bar */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
            {phone && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#fff",
                }}
              >
                <Phone className="h-3 w-3" />
                <span>{phone}</span>
              </div>
            )}

            {instagram && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#fff",
                }}
              >
                <Instagram className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{instagram}</span>
              </div>
            )}

            {facebook && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#fff",
                }}
              >
                <Facebook className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{facebook}</span>
              </div>
            )}

            {tiktok && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#fff",
                }}
              >
                <Video className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{tiktok}</span>
              </div>
            )}

            {bookingUrl && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border transition-all hover:scale-105 bg-white/25"
                style={{
                  backgroundColor: "rgba(255,255,255,0.25)",
                  borderColor: "rgba(255,255,255,0.4)",
                  color: "#fff",
                }}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="max-w-[140px] truncate">Objednať sa</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom color strip ── */}
      <div
        className="h-2.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${brandColor}, ${accentColor}, ${brandColor})`,
        }}
      />
    </div>
  );
});

/**
 * Compact hero card with isometric tilt — for inline use in settings
 */
export const BrandHeroCard3D = memo(function BrandHeroCard3D({
  clinicName,
  brandColor,
  accentColor,
}: Pick<BrandBanner3DProps, "clinicName" | "brandColor" | "accentColor">) {
  const words = clinicName.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (clinicName.slice(0, 2) || "V").toUpperCase();

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/50 shadow-xl">
      {/* Isometric tilted background */}
      <div
        className="relative h-28 overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${brandColor} 0%, ${brandColor}bb 40%, ${accentColor}60 70%, ${accentColor}30 100%)`,
        }}
      >
        {/* Subtle isometric grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`hero-iso-${initials}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(-25) skewY(-12)">
              <path d="M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z" fill="none" stroke="white" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#hero-iso-${initials})`} />
        </svg>

        {/* Floating paw */}
        <div className="absolute top-3 right-4 text-white/20">
          <PawPrint className="h-12 w-12" style={{ transform: "rotate(-15deg)" }} />
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex items-center gap-3 px-5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-lg backdrop-blur-sm border"
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderColor: "rgba(255,255,255,0.3)",
              color: "#fff",
            }}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-bold text-white drop-shadow-sm">{clinicName}</p>
            <p className="text-[10px] text-white/70">Veterinárna klinika</p>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, ${brandColor}, ${accentColor})` }}
      />
    </div>
  );
});
