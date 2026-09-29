"use client";

import { memo } from "react";
import {
  Smartphone,
  FileText,
  CreditCard,
  Tv,
  Instagram,
  PawPrint,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BrandMockupPreviewProps {
  clinicName: string;
  brandColor: string;
  accentColor: string;
  phone: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

/**
 * Brand Kit Mockup Preview — live preview of brand colors on marketing products
 */
export const BrandMockupPreview = memo(function BrandMockupPreview({
  clinicName,
  brandColor,
  accentColor,
  phone,
  instagram,
  facebook,
  tiktok,
}: BrandMockupPreviewProps) {
  const words = clinicName.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (clinicName.slice(0, 2) || "V").toUpperCase();

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <PawPrint className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Live Mockup Preview</h3>
          <p className="text-[10px] text-muted-foreground">
            Jak bude vyzerať váš branding na rôznych materiáloch
          </p>
        </div>
      </div>

      {/* ── 1. Business Card ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <CreditCard className="h-3 w-3" />
          Vizitka
        </div>
        <div
          className="rounded-xl border-2 overflow-hidden shadow-md transition-all duration-300"
          style={{ borderColor: brandColor }}
        >
          {/* Card Front */}
          <div className="bg-white dark:bg-stone-900 p-3 space-y-2">
            {/* Logo area */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm"
                style={{ backgroundColor: brandColor }}
              >
                {initials}
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">
                  {clinicName}
                </p>
                <p className="text-[9px] text-muted-foreground">Veterinárna klinika</p>
              </div>
            </div>
            {/* Contact line */}
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground pt-1 border-t">
              <span>📞 {phone}</span>
              {instagram && <span>📷 {instagram}</span>}
            </div>
          </div>
          {/* Color strip */}
          <div
            className="h-2.5"
            style={{
              background: `linear-gradient(90deg, ${brandColor}, ${accentColor})`,
            }}
          />
        </div>
      </div>

      {/* ── 2. Social Media Post (Instagram) ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Instagram className="h-3 w-3" />
          Instagram príspevok
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden shadow-md transition-all duration-300 bg-white dark:bg-stone-900">
          {/* Post image placeholder */}
          <div
            className="h-32 w-full flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, ${brandColor}20, ${accentColor}30, ${brandColor}10)`,
            }}
          >
            <div className="text-center space-y-1">
              <div
                className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg"
                style={{ backgroundColor: brandColor }}
              >
                <PawPrint className="h-7 w-7" />
              </div>
              <p className="text-[10px] font-bold text-stone-700 dark:text-stone-300">
                {clinicName}
              </p>
            </div>
            {/* Brand watermark */}
            <div className="absolute bottom-2 right-2">
              <Badge
                className="text-[8px] font-bold px-1.5 py-0 rounded-md"
                style={{ backgroundColor: brandColor, color: "#fff" }}
              >
                AI ILLUSTRÁCIA
              </Badge>
            </div>
          </div>
          {/* Post text */}
          <div className="p-2.5 space-y-1">
            <p className="text-[10px] font-semibold text-stone-900 dark:text-stone-100 leading-tight">
              ⭐ Vaše zdravie je našou prioritou
            </p>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Moderná veterinárna starostlivosť s láskou k zvieratám.
            </p>
            {/* Hashtags */}
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                #veterinárnaStarostlivosť
              </span>
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                #zvieratá
              </span>
              <span className="text-[8px] px-1 py-0.5 rounded-full" style={{
                backgroundColor: `${brandColor}20`,
                color: brandColor,
              }}>
                #{clinicName.replace(/\s+/g, "")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Educational Flyer (A5) ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3 w-3" />
          Edukačný leták (A5)
        </div>
        <div className="bg-[#fffdfa] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-md transition-all duration-300">
          {/* Flyer header */}
          <div
            className="text-white px-2.5 py-1.5 flex items-center justify-between text-[9px]"
            style={{ backgroundColor: brandColor }}
          >
            <div className="flex items-center gap-1">
              <span className="font-bold uppercase tracking-wider">{clinicName}</span>
            </div>
            <Badge className="text-[7px] px-1 py-0 rounded-full bg-white/20 text-white font-bold">
              EDUKAČNÝ LETÁK
            </Badge>
          </div>
          {/* Flyer body */}
          <div className="p-2.5 space-y-2">
            {/* Thematic area */}
            <div
              className="h-16 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${brandColor}15, ${accentColor}25)`,
              }}
            >
              <div className="text-center">
                <div
                  className="h-8 w-8 rounded-lg mx-auto flex items-center justify-center text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  <PawPrint className="h-4 w-4" />
                </div>
                <p className="text-[8px] font-bold mt-0.5 text-stone-700 dark:text-stone-300">
                  Starostlivosť po kastrácii
                </p>
              </div>
            </div>
            {/* Checklist */}
            <div className="space-y-0.5">
              {["Kľudový režim 7 dní", "Kontrola rany 2x denne", "Zamedzenie olizovania"].map(
                (item, i) => (
                  <div key={i} className="flex items-center gap-1 text-[9px]">
                    <Check className="h-2.5 w-2.5 shrink-0" style={{ color: brandColor }} />
                    <span className="text-stone-700 dark:text-stone-300">{item}</span>
                  </div>
                )
              )}
            </div>
            {/* QR placeholder */}
            <div className="flex items-center gap-1.5 pt-1 border-t">
              <div className="h-6 w-6 rounded bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
                <Smartphone className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-[8px] text-muted-foreground font-mono">/h/starostlivost</span>
            </div>
          </div>
          {/* Footer */}
          <div
            className="h-2"
            style={{ background: `linear-gradient(90deg, ${brandColor}, ${accentColor})` }}
          />
        </div>
      </div>

      {/* ── 4. Waiting Room TV Slide ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Tv className="h-3 w-3" />
          TV slajd čakáreň
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden shadow-md transition-all duration-300 bg-black">
          {/* TV slide */}
          <div
            className="h-24 w-full flex flex-col items-center justify-center relative px-3"
            style={{
              background: `linear-gradient(180deg, ${brandColor}30 0%, ${accentColor}20 50%, ${brandColor}10 100%)`,
            }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white mb-1"
              style={{ backgroundColor: brandColor }}
            >
              <PawPrint className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold text-white drop-shadow">
              {clinicName}
            </p>
            <p className="text-[8px] text-white/70">
              Ďakujeme za trpezlivosť • Vaša ordinácia beží podľa času
            </p>
          </div>
          {/* TV bottom bar */}
          <div
            className="h-2 flex items-center justify-center text-[7px] text-white/60 gap-2 px-2"
            style={{ backgroundColor: `${brandColor}dd` }}
          >
            <span>📞 {phone}</span>
            {instagram && <span>📷 {instagram}</span>}
          </div>
        </div>
      </div>

      {/* ── Color Summary ── */}
      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brand farby
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {brandColor} · {accentColor}
          </span>
        </div>
        <div className="flex gap-1">
          <div
            className="flex-1 h-8 rounded-lg border transition-colors duration-300"
            style={{ backgroundColor: brandColor }}
          />
          <div
            className="flex-1 h-8 rounded-lg border transition-colors duration-300"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
    </div>
  );
});
