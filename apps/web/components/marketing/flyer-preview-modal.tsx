"use client";

import { useState } from "react";
import {
  PawPrint,
  Printer,
  X,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  QrCode,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHandoutThematicImage } from "@/lib/marketing/handout-themes";
import { toast } from "sonner";

interface FlyerModalProps {
  handout: {
    id: string;
    slug: string;
    title: string;
    body?: string | null;
    species?: string[] | null;
    tags?: string[] | null;
    isPublic?: boolean;
    createdAt?: string | Date;
  };
  practice?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  onClose: () => void;
}

export function FlyerPreviewModal({ handout, practice, onClose }: FlyerModalProps) {
  const [copied, setCopied] = useState(false);
  const theme = getHandoutThematicImage(handout);
  const clinicName = practice?.name || "Veterinárna klinika";
  const clinicPhone = practice?.phone || "+421 2 1234 5678";
  const clinicEmail = practice?.email || "recepcia@klinika.sk";
  const clinicAddress = practice?.address || "Bratislava, Slovensko";

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/h/${handout.slug}`
    : `/h/${handout.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Odkaz na leták skopírovaný");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Parse markdown bullets or sentences into checklist items
  const rawLines = (handout.body || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const checklistItems = rawLines
    .filter((l) => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^[-*•\d.]+\s+/, "").replace(/[*_#`]/g, ""));

  const fallbackChecklist = [
    "Dodržiavajte kľudový režim a zamedzte behaniu, skákaniu a námahe.",
    "Kontrolujte zdravotný stav a prípadnú operačnú ranu minimálne 2x denne.",
    "Zabráňte olizovaniu a škriabaniu (použite ochranný golier alebo košieľku).",
    "Podávajte iba predpísané lieky presne podľa pokynov lekára.",
    "Zabezpečte trvalý prístup k čerstvej pitnej vode a ľahko stráviteľnú stravu.",
  ];

  const displayChecklist = checklistItems.length >= 3 ? checklistItems.slice(0, 6) : fallbackChecklist;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-3xl my-auto bg-stone-100 dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:rounded-none">
        {/* Modal Top Bar (hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-background border-b print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-sm">Náhľad tlače: A5 Edukačný leták pre klienta</span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Skopírované" : "Kopírovať odkaz"}
            </Button>

            <Button size="sm" className="gap-1.5 text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Tlačiť leták (PDF)
            </Button>

            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Flyer Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex justify-center print:p-0 print:overflow-visible">
          {/* Authentic Physical Leaflet Sheet */}
          <div className="w-full max-w-[595px] bg-[#fffefb] text-stone-900 shadow-xl border border-stone-200/80 rounded-2xl overflow-hidden print:border-none print:shadow-none print:rounded-none flex flex-col justify-between min-h-[820px] p-6 sm:p-8 relative">
            {/* Top Clinic Ribbon / Letterhead */}
            <div className="border-b-2 border-stone-900/10 pb-4 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-md">
                    <PawPrint className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="font-serif font-extrabold text-xl text-stone-900 tracking-tight leading-tight uppercase">
                      {clinicName}
                    </h2>
                    <p className="text-[11px] font-semibold text-teal-850 tracking-wider uppercase text-teal-800">
                      Veterinárna starostlivosť a chirurgia malých zvierat
                    </p>
                  </div>
                </div>

                <div className="text-right text-[10px] text-stone-600 font-medium space-y-0.5 hidden sm:block">
                  <p className="flex items-center justify-end gap-1 font-bold text-stone-800">
                    <Phone className="w-3 h-3 text-teal-700" /> {clinicPhone}
                  </p>
                  <p className="flex items-center justify-end gap-1">
                    <Mail className="w-3 h-3 text-teal-700" /> {clinicEmail}
                  </p>
                  <p className="flex items-center justify-end gap-1">
                    <MapPin className="w-3 h-3 text-teal-700" /> {clinicAddress}
                  </p>
                </div>
              </div>

              {/* Leaflet Subheader Ribbon */}
              <div className="mt-3.5 pt-2 border-t border-dashed border-stone-250 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 font-bold tracking-wide uppercase text-[10px]">
                  {theme.category}
                </span>
                <span className="text-stone-500 font-medium">
                  EDUKAČNÝ POKYN PRE DOMÁCU STAROSTLIVOSŤ
                </span>
              </div>
            </div>

            {/* Flyer Hero Banner */}
            <div className="relative rounded-xl overflow-hidden border border-stone-200 shadow-inner h-44 sm:h-48 mb-4 bg-stone-100">
              <img
                src={theme.src}
                alt={theme.alt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="flex items-center gap-1.5 mb-1">
                  {handout.species?.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-md">
                      {s.toLowerCase().includes("pes") || s.toLowerCase().includes("canine") ? "🐶 Pes" : s.toLowerCase().includes("macka") || s.toLowerCase().includes("feline") ? "🐱 Mačka" : s}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/80 backdrop-blur-md">
                    Klinický protokol
                  </span>
                </div>
                <h1 className="font-serif font-extrabold text-xl sm:text-2xl text-white leading-tight drop-shadow-md">
                  {handout.title}
                </h1>
              </div>
            </div>

            {/* Structured Guidelines Section */}
            <div className="space-y-3.5 my-2 flex-1">
              <div className="border-b border-stone-200 pb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-700" />
                  Kľúčové zásady a postup domácej starostlivosti:
                </h3>
              </div>

              <div className="space-y-2">
                {displayChecklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-stone-800">
                    <span className="w-4 h-4 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      ✓
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Emergency Callout Box */}
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-amber-950 space-y-1 my-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  KEDY BEZODKLADNE KONTAKTOVAŤ VETERINÁRA:
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90 pl-5">
                  Ak spozorujete pretrvávajúcu apatiu, odmietanie vody viac ako 12 hodín, opakované zvracanie,
                  krvácanie z rany, opuch alebo teplotu nad 39.3 °C, ihneď volajte pohotovosť: <strong>{clinicPhone}</strong>.
                </p>
              </div>
            </div>

            {/* Authentic Leaflet Tear-off / QR Mobile Sync Strip */}
            <div className="mt-4 pt-3 border-t-2 border-dashed border-stone-300 relative">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Visual QR Code Box */}
                  <div className="w-16 h-16 rounded-xl border border-stone-300 bg-white p-1.5 flex flex-col items-center justify-center shadow-xs shrink-0">
                    <QrCode className="w-9 h-9 text-stone-900" />
                    <span className="text-[8px] font-bold text-stone-600 uppercase tracking-tighter mt-0.5">SCAN ME</span>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-stone-900">
                      Vezmite si leták do smartfónu
                    </p>
                    <p className="text-[10px] text-stone-600 leading-tight">
                      Namierte fotoaparát telefónu na QR kód pre interaktívny návod a dávkovanie.
                    </p>
                    <p className="text-[10px] font-mono text-teal-800 font-semibold truncate max-w-[280px]">
                      {publicUrl}
                    </p>
                  </div>
                </div>

                {/* Doctor's Signature Block */}
                <div className="text-right border-l border-stone-200 pl-4 shrink-0 hidden sm:block">
                  <p className="text-[9px] text-stone-500 uppercase font-semibold">Ošetrujúci veterinárny lekár:</p>
                  <p className="text-xs font-serif italic text-stone-800 mt-2">MVDr. .................................</p>
                  <p className="text-[9px] text-stone-400 mt-1">Dátum vydania: {handout.createdAt ? new Date(handout.createdAt).toLocaleDateString("sk-SK") : "—"}</p>
                </div>
              </div>

              {/* Bottom Copyright */}
              <div className="mt-3 text-center text-[9px] text-stone-400 border-t border-stone-100 pt-2">
                © {new Date().getFullYear()} {clinicName} · Vytlačené z OpenVPM AI · Tento leták je duševným vlastníctvom kliniky
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
