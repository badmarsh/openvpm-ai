"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  FileText,
  Mic,
  Send,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MockupBanner } from "../mockup-banner";

const VARIANTS = [
  { id: "a", label: "Violet (stav)" },
  { id: "b", label: "Neutrál + značka" },
  { id: "c", label: "Primárny token" },
] as const;

type VariantId = (typeof VARIANTS)[number]["id"];

/**
 * Jedna tokenová trieda používaná naprieč ukážkami — v reálnej implementácii
 * by išlo o CSS premenné (--ai-surface, --ai-surface-foreground, --ai-accent).
 */
const SURFACES: Record<
  VariantId,
  {
    selectedCard: string;
    accentText: string;
    accentIcon: string;
    chip: string;
    chipOutline: string;
    softBg: string;
    composerIcon: string;
    thinkingDot: string;
    tokenName: string;
    tokenSwatch: string;
  }
> = {
  a: {
    selectedCard:
      "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40",
    accentText: "text-violet-600 dark:text-violet-400",
    accentIcon: "text-violet-500",
    chip: "border-violet-400 text-violet-600 dark:text-violet-400",
    chipOutline:
      "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
    softBg: "bg-violet-50 dark:bg-violet-950/30",
    composerIcon: "text-violet-500",
    thinkingDot: "bg-violet-500",
    tokenName: "violet-* (hex odtiene Tailwind palety, mimo design tokenov)",
    tokenSwatch: "bg-violet-500",
  },
  b: {
    selectedCard: "border-border bg-card ring-2 ring-ring",
    accentText: "text-foreground",
    accentIcon: "text-muted-foreground",
    chip: "border-border text-foreground",
    chipOutline: "bg-muted text-foreground hover:bg-muted/70",
    softBg: "bg-muted/50",
    composerIcon: "text-foreground",
    thinkingDot: "bg-foreground",
    tokenName: "background/muted/foreground + ring (žiadna nová farba)",
    tokenSwatch: "bg-foreground",
  },
  c: {
    selectedCard: "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
    accentText: "text-primary",
    accentIcon: "text-primary",
    chip: "border-primary/40 text-primary",
    chipOutline: "bg-primary/10 text-primary hover:bg-primary/15",
    softBg: "bg-primary/5",
    composerIcon: "text-primary",
    thinkingDot: "bg-primary",
    tokenName: "primary token (hsl 153 60% 32%) rozšírený o alpha stavy",
    tokenSwatch: "bg-primary",
  },
};

const FLOURISH = [
  {
    day: "St 8:20",
    text: "Blesk predvčerom odmietla krmivo; dnes krátkodobo horúčka 39,6 °C. Majiteľ hlási pokles nátoka mlieka cca o 15 %.",
  },
  {
    day: "Št 7:55",
    text: "Na kontrole po očkovaní — ataxia zadných končatín ustúpila, dávkový plán pokračuje podľa protokolu.",
  },
] as const;

export function AiSurfaceColorMockup() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant") ?? "b";
  const variant: VariantId = VARIANTS.some((v) => v.id === raw)
    ? (raw as VariantId)
    : "b";
  const s = SURFACES[variant];

  return (
    <div className="min-h-dvh bg-background">
      <MockupBanner
        title="M2 · Farebný jazyk AI plôch"
        finding="Audit 2026-09-28, nález P2‑7: violet/purple/indigo utility celkovo 316× (81× v 26 súboroch mimo tokenov); UIKIT.md:27 pritom vyhradzuje purple pre modalitu USG a indigo pre endoskopiu — AI plocha koliduje s klinickým farebným kontraktom."
        question="Aký tokenový systém má byť jazykom AI: (A) ponechať violet, (B) neutrálne plochy so značkou AI, alebo (C) rozšírenie primárneho brand tokenu?"
        variants={VARIANTS}
        activeVariant={variant}
      />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {/* 1 — SOAP návrh */}
          <SoapSuggestion variant={variant} />

          {/* 2 — Agent chat: thinking + composer */}
          <AgentChat variant={variant} />

          {/* 3 — Výber šablóny (klinické template pattern) */}
          <TemplateSelect variant={variant} />

          {/* 4 — Hub v hustom zozname (badge v kontexte) */}
          <ListContext variant={variant} />

          <div className="hidden justify-end lg:flex">
            <p className={cn("flex items-center gap-1.5 text-2xs font-semibold", s.accentText)}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Všetky 4 plochy v tomto variante pozerajú na jednu tokenovú rodinu.
            </p>
          </div>
        </div>

        {/* Bočný stĺpec: token + verdikt */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tokenová trieda varianta {variant.toUpperCase()}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn("h-8 w-8 rounded-lg border border-border", s.tokenSwatch)}
                aria-hidden="true"
              />
              <p className="text-2xs leading-snug text-foreground">{s.tokenName}</p>
            </div>
          </div>
          <VariantNotes variant={variant} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SoapSuggestion({ variant }: { variant: VariantId }) {
  const s = SURFACES[variant];
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">1 · SOAP karta — AI návrh subjektívu</h2>
        <AiBadge variant={variant} />
      </div>
      <div className="space-y-3 p-4">
        <div className={cn("rounded-lg border p-3", s.softBg, "border-border")}>
          <p className="flex items-center gap-1.5 text-2xs font-semibold">
            <Sparkles className={cn("h-3.5 w-3.5", s.accentIcon)} aria-hidden="true" />
            <span className={s.accentText}>AI navigácia · navrhujem vetu do subjektívu</span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            „Majiteľ hlási od včerajška pokles nátoka mlieka o cca 15 %; krmivo odmieta, peristaltika
            prítomná, bez výkalovej stolice od rána. Teplota pri príchode 39,6 °C."
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-9 gap-1 px-3 text-xs">
              <Check className="h-4 w-4" aria-hidden="true" />
              Vložiť do subjektívu
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1 px-3 text-xs">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Kopírovať
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-3 text-xs">
              Zahodiť
            </Button>
          </div>
        </div>
        <p className="text-2xs text-muted-foreground">
          Plocha návrhu musí byť vizuálne rozpoznateľná od ručne písaného textu — ale obsah
          zostáva čitateľný pri 4,5:1 bez ohľadu na variant.
        </p>
      </div>
    </section>
  );
}

function AgentChat({ variant }: { variant: VariantId }) {
  const s = SURFACES[variant];
  const [deepThinking, setDeepThinking] = useState(true);
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">2 · Agent chat — thinking stav + composer</h2>
        <AiBadge variant={variant} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border",
              s.softBg,
            )}
          >
            <Bot className={cn("h-4 w-4", s.accentIcon)} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
            <p className="flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", s.thinkingDot)}
                />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.thinkingDot)} />
              </span>
              {deepThinking ? (
                <span className={cn("font-semibold", s.accentText)}>Hlboké premýšľanie…</span>
              ) : (
                "Vyhľadávam v protokoloch…"
              )}
            </p>
            <p className="mt-1 text-sm text-foreground">
              Zhrnul som posledné 3 terénne návštevy farmy Bučko, extrahoval závery a navrhujem
              kroky:
            </p>
          </div>
        </div>
        {FLOURISH.map((item) => (
          <div key={item.day} className="ml-9 flex items-start gap-2 text-2xs text-muted-foreground">
            <span className="shrink-0 font-mono tabular-nums">{item.day}</span>
            <span>{item.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2 pl-3">
          <span className="flex-1 truncate text-sm text-muted-foreground">
            Návrh ďalšieho postupu pre Blesk…
          </span>
          <button
            type="button"
            onClick={() => setDeepThinking((v) => !v)}
            aria-pressed={deepThinking}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-md border px-2 text-2xs font-semibold",
              deepThinking ? s.chip : "border-border text-muted-foreground",
            )}
          >
            <Sparkles className={cn("h-3.5 w-3.5", deepThinking && "animate-pulse")} aria-hidden="true" />
            Deep Think
          </button>
          <Button size="icon" className="h-9 w-9" aria-label="Odoslať správu">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function TemplateSelect({ variant }: { variant: VariantId }) {
  const s = SURFACES[variant];
  const [selected, setSelected] = useState("plan-mastitida");
  const templates = [
    { id: "plan-mastitida", title: "Mastitída — dávkový protokol", meta: "6 krokov · všeobecná prax" },
    { id: "plan-postop", title: "Pooperačná kontrola (10 dní)", meta: "3 kroky · chirurgia" },
    { id: "plan-vaccine", title: "Očkovanie dorastu", meta: "2 kroky · preventívne" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">3 · Výber AI šablóny — selected stav</h2>
        <AiBadge variant={variant} />
      </div>
      <ul className="grid gap-2 p-4 sm:grid-cols-3">
        {templates.map((template) => {
          const active = selected === template.id;
          return (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => setSelected(template.id)}
                aria-pressed={active}
                className={cn(
                  "flex h-full w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? s.selectedCard : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-2xs font-semibold text-foreground">{template.title}</span>
                  {active && <Check className={cn("h-4 w-4 shrink-0", s.accentIcon)} aria-hidden="true" />}
                </span>
                <span className="text-3xs text-muted-foreground">{template.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ListContext({ variant }: { variant: VariantId }) {
  const s = SURFACES[variant];
  const rows = [
    { icon: <Stethoscope className="h-4 w-4" aria-hidden="true" />, title: "Ordinačné hodiny", meta: "Denne 8:00–12:00", ai: false },
    { icon: <Mic className="h-4 w-4" aria-hidden="true" />, title: "Hlasový záznam — Scribe", meta: "AI prepis do SOAP", ai: true },
    { icon: <FileText className="h-4 w-4" aria-hidden="true" />, title: "Letáky pre klientov", meta: "AI generátor textov", ai: true },
    { icon: <User className="h-4 w-4" aria-hidden="true" />, title: "Recepcia — front desk", meta: "Manuálne spracovanie", ai: false },
  ] as const;
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">4 · AI značky v hustých zoznamoch</h2>
        <p className="text-2xs text-muted-foreground">
          Keď je polovička riadkov AI, má význam „druhá farba aplikácie“ ešte zmysel?
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.title} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              {row.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
              <p className="truncate text-2xs text-muted-foreground">{row.meta}</p>
            </div>
            {row.ai && (
              <Badge
                variant="outline"
                className={cn("shrink-0 gap-1 text-3xs", s.chipOutline, "border", s.chip)}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                AI
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </section>
  );
}

const BADGE_STYLES: Record<VariantId, string> = {
  a: "border-violet-400 text-violet-600 dark:text-violet-400",
  b: "border-border bg-muted text-foreground",
  c: "border-primary/40 bg-primary/10 text-primary",
};

function AiBadge({ variant }: { variant: VariantId }) {
  return (
    <Badge variant="outline" className={cn("gap-1 text-3xs font-semibold", BADGE_STYLES[variant])}>
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      AI návrh
    </Badge>
  );
}

/* ------------------------------------------------------------------ */

const NOTES: Record<VariantId, { summary: string; pros: readonly string[]; cons: readonly string[] }> = {
  a: {
    summary: "Súčasný stav: violet-* hex odtiene mimo tokenového systému (81 výskytov / 26 súborov).",
    pros: [
      "Nulová migrácia — status quo.",
      "AI plochy sú na prvý pohľad odlišné od zbytku produktu.",
    ],
    cons: [
      "Fialová nie je v brandkite kliník: marketing preberá violet do letákov a TV čakárne, čím AI farba uniká do klientskeho brandu.",
      "81× pevno natvrdo (dark mód riešený per-súbor, nie tokenovo) — každá nová AI plocha kopíruje hex triedy.",
      "text-violet-500 na bielom kontrastuje 3,6:1 — pod prahom 4,5:1 pre textové stavy (agent thinking line).",
      "Violet „vlastní“ aj ne-AI plochy (controlled-substances, schedule) — význam farby sa rozmazáva.",
    ],
  },
  b: {
    summary: "Auditova odporúčaná cesta: AI plocha = bežné tokeny (card/muted/ring), AI identita len cez značku (ikona Sparkles + „AI“ label).",
    pros: [
      "Žiadna nová farba; jedna prístupová matica na contrast/state coverage.",
      "AI značka funguje v každom brandkite kliniky — marketing farby ostávajú čisto klientske.",
      "Selected stav cez ring (focus token) je konzistentný s klávesnicou a ARIA stavmi.",
      "Počet „AI ploch“ v UI rastie; neutrálna podložka škáluje, druhá farba nie.",
    ],
    cons: [
      "AI je menej „magické“ — produktovo treba prijať, že povesť nesie obsah/značka, nie farba.",
      "Vyžaduje disciplínu prestaviť 26 súborov (contains violet) na tokeny.",
    ],
  },
  c: {
    summary: "AI plochy ako rozšírenie primárneho brand tokenu (primary alpha stavy).",
    pros: [
      "Jedna farba na ešte už väčšiu súdržnosť: AI = produkt, produkt = brand.",
      "Tokenovo čisté (primary/5–15% alpha) — funguje v light aj dark cez existujúce premenné.",
    ],
    cons: [
      "One-surface rule: primary je zároveň hlavná akčná farba (CTA) — AI plochy začnú vizuálne súťažiť s tlačidlami a odkazy.",
      "Zelená náplň (úsus/UI stavy, movement potvrdenia) — riziko kolízie so semantikou „OK/vydané“.",
      "Brand rebranding kliniky v marketingu by tiahol aj AI plochy.",
    ],
  },
};

function VariantNotes({ variant }: { variant: VariantId }) {
  const n = NOTES[variant];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-sm font-bold text-foreground">Verdikt {variant.toUpperCase()}</p>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{n.summary}</p>
      <p className="mt-3 text-3xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Pre</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-2xs leading-relaxed text-muted-foreground">
        {n.pros.map((point) => (
          <li key={point.slice(0, 28)}>{point}</li>
        ))}
      </ul>
      <p className="mt-3 text-3xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">Proti</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-2xs leading-relaxed text-muted-foreground">
        {n.cons.map((point) => (
          <li key={point.slice(0, 28)}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
