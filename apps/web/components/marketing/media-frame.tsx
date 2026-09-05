"use client";

import { PawPrint } from "lucide-react";

export interface FrameBrand {
  name: string;
  logoInitials: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface FrameAsset {
  url: string | null;
  kind: string;
  source?: string;
  altText?: string | null;
  patientName?: string | null;
  subjectsPresent?: boolean;
  meta?: { edit?: { preset?: string; crop?: string; overlay?: string } } | any | null;
}

// Deterministické edity (CSS ekvivalent presetov; v produkcii render cez sharp).
export const EDIT_FILTERS: Record<string, string> = {
  none: "",
  enhance: "contrast(1.08) saturate(1.12) brightness(1.03)",
  warm: "sepia(0.18) saturate(1.15) hue-rotate(-8deg) brightness(1.02)",
  bw: "grayscale(1) contrast(1.1)",
  soft: "saturate(0.92) brightness(1.05) blur(0.2px)",
};

export const CROP_ASPECTS: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

export function LogoChip({ brand, light }: { brand: FrameBrand; light?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 backdrop-blur-md shadow-sm border border-white/20"
      style={{ background: light ? "rgba(255, 255, 255, 0.9)" : brand.primaryColor }}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center shadow-xs"
        style={{
          background: light ? brand.primaryColor : "rgba(255, 255, 255, 0.25)",
          color: "#fff",
        }}
      >
        <PawPrint size={10} />
      </span>
      <span
        className="text-[10px] font-bold tracking-wide"
        style={{ color: light ? brand.primaryColor : "#fff" }}
      >
        {brand.logoInitials}
      </span>
    </span>
  );
}

export function IllustrationBadge() {
  return (
    <span className="absolute top-2 right-2 rounded-full bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 tracking-wide shadow-md border border-white/20">
      Ilustrácia
    </span>
  );
}

export function MediaFrame({
  asset,
  brand,
  headline,
  subline,
  aspect = "aspect-[4/5]",
  tv = false,
}: {
  asset: FrameAsset | null;
  brand: FrameBrand;
  headline: string;
  subline?: string;
  aspect?: string;
  tv?: boolean;
}) {
  const edit = asset?.meta?.edit;
  const filter = edit?.preset ? EDIT_FILTERS[edit.preset] ?? "" : "";
  const effAspect = edit?.crop ? CROP_ASPECTS[edit.crop] ?? aspect : aspect;

  // 1) Fotka s brand rámikom
  if (asset?.url && asset.kind === "photo") {
    return (
      <figure className={`relative overflow-hidden rounded-xl ${effAspect} bg-stone-100 dark:bg-stone-900 select-none`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.altText || "Fotografia"}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300"
          style={filter ? { filter } : undefined}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/marketing/postop-care.svg";
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 3px rgba(255, 255, 255, 0.55), inset 0 -70px 90px -40px rgba(0, 0, 0, 0.65)`,
          }}
          aria-hidden
        />
        <div className="absolute top-2 left-2 z-10">
          <LogoChip brand={brand} />
        </div>
        {edit?.overlay ? (
          <p className="absolute left-3 right-3 top-1/2 -translate-y-1/2 text-center text-lg font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] z-10 px-2">
            {edit.overlay}
          </p>
        ) : null}
        <figcaption className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2 z-10">
          <span className="text-white text-[11px] font-semibold leading-tight drop-shadow truncate">
            {asset.patientName ?? brand.name}
          </span>
          <span
            className="h-1.5 w-10 rounded-full shrink-0 shadow-sm"
            style={{ background: brand.secondaryColor }}
            aria-hidden
          />
        </figcaption>
      </figure>
    );
  }

  // 2) Video klip z telefónu – náhľad s brand intro/outro
  if (asset?.url && asset.kind === "video") {
    return (
      <figure className={`relative overflow-hidden rounded-xl ${aspect} bg-stone-950 select-none`}>
        <video
          src={asset.url}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          controls={false}
          autoPlay
        />
        <div className="absolute left-2 top-2 flex items-center gap-2 z-10">
          <LogoChip brand={brand} />
          <span className="rounded-full bg-amber-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-stone-950 tracking-wide shadow-sm">
            REEL 9:16
          </span>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 p-3 z-10"
          style={{ background: "linear-gradient(transparent, rgba(0, 0, 0, 0.75))" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/85">
            intro 2 s → klip personálu → outro s rezerváciou
          </p>
          {asset.altText ? (
            <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mt-0.5">
              {asset.altText}
            </p>
          ) : null}
        </div>
      </figure>
    );
  }

  // 3) Generovaná ilustrácia (vždy označená)
  if (asset?.url && asset.kind === "illustration") {
    return (
      <figure className={`relative overflow-hidden rounded-xl ${aspect} bg-stone-100 dark:bg-stone-900 select-none`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.altText || "Ilustrácia"}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <IllustrationBadge />
        <div className="absolute bottom-2 left-2 z-10">
          <LogoChip brand={brand} light />
        </div>
      </figure>
    );
  }

  // 4) Brandovaná textová grafika (deterministická, hlavný vizuál bez fotky)
  return (
    <figure
      className={`relative overflow-hidden rounded-xl ${aspect} select-none`}
      style={{
        background: `linear-gradient(150deg, ${brand.primaryColor} 0%, #064e3b 75%)`,
      }}
    >
      <svg
        className="absolute -right-8 -top-10 opacity-[0.15]"
        width="220"
        height="220"
        viewBox="0 0 24 24"
        fill="#fff"
        aria-hidden
      >
        <path d="M12 13.5c3.6 0 7 2.6 7 5.6 0 1.7-1.3 2.9-3 2.9-1.3 0-1.9-.8-4-.8s-2.7.8-4 .8c-1.7 0-3-1.2-3-2.9 0-3 3.4-5.6 7-5.6zM6.2 6.5c1.1 0 2 1.2 2 2.6S7.3 11.7 6.2 11.7s-2-1.2-2-2.6.9-2.6 2-2.6zm11.6 0c1.1 0 2 1.2 2 2.6s-.9 2.6-2 2.6-2-1.2-2-2.6.9-2.6 2-2.6zM9.4 2c1.2 0 2.1 1.3 2.1 2.9S10.6 7.8 9.4 7.8 7.3 6.5 7.3 4.9 8.2 2 9.4 2zm5.2 0c1.2 0 2.1 1.3 2.1 2.9s-.9 2.9-2.1 2.9-2.1-1.3-2.1-2.9S13.4 2 14.6 2z" />
      </svg>
      <div
        className="absolute left-0 top-[22%] h-14 w-1.5 rounded-r shadow-sm"
        style={{ background: brand.secondaryColor }}
        aria-hidden
      />
      <figcaption className={`relative flex h-full flex-col justify-between ${tv ? "p-8" : "p-4"}`}>
        <LogoChip brand={brand} />
        <div className="mt-auto space-y-2 pb-1">
          <p
            className={`font-serif font-bold leading-[1.1] text-white drop-shadow-sm ${
              tv ? "text-5xl max-w-3xl" : "text-xl sm:text-2xl"
            }`}
          >
            {headline}
          </p>
          {subline ? (
            <p className={`text-white/85 leading-snug ${tv ? "text-xl max-w-2xl" : "text-xs line-clamp-2"}`}>
              {subline}
            </p>
          ) : null}
          <p
            className={`font-bold ${tv ? "text-lg" : "text-[10px]"} tracking-[0.18em] uppercase`}
            style={{ color: brand.secondaryColor }}
          >
            {brand.name}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

export function headlineFromBody(body: string): string {
  const first = body.split(/\n/)[0]?.trim() ?? "";
  const cut = first.split(/(?<=[.!?…])\s/)[0] ?? first;
  return cut.length > 90 ? `${cut.slice(0, 87)}…` : cut;
}
