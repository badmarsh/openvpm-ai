"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Mic,
  Navigation,
  Plus,
  Printer,
  ScanBarcode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MockupBanner } from "../mockup-banner";
import {
  ACTIVE_WITHDRAWAL_COUNT,
  FARMS,
  TODAY_AGENDA,
  TODAY_LOG,
  WITHDRAWAL_WATCH,
  type WithdrawalFixture,
} from "./fixtures";

const VARIANTS = [
  { id: "a", label: "Karty" },
  { id: "b", label: "Kompakt + expand" },
  { id: "c", label: "Denná agenda" },
] as const;

export function FieldVisitsMobileMockup() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant") ?? "a";
  const variant = VARIANTS.some((v) => v.id === raw) ? raw : "a";

  return (
    <div className="min-h-dvh bg-muted/30">
      <MockupBanner
        title="M1 · Terénne návštevy — mobilný layout"
        finding="Audit 2026-09-28, nález P2-4: stránka /field-visits je desktopová tabuľka (min-w-[620–860 px], scroll v scrolle), akcie majú 32–36 px ciele."
        question="Ktorý mobilný model zvolíme pre log podaní a Ochranné lehoty — karty (A), kompaktný zoznam s expanderom (B), alebo dennú agendu (C)?"
        variants={VARIANTS}
        activeVariant={variant}
      />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,430px)_minmax(260px,1fr)]">
        {/* Telefónny canvas */}
        <div className="mx-auto w-full max-w-[430px] lg:mx-0">
          <div className="flex min-h-dvh flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl lg:min-h-[720px]">
            <CanvasChrome />
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {variant === "a" && <VariantCards />}
              {variant === "b" && <VariantCompactExpand />}
              {variant === "c" && <VariantAgenda />}
            </div>
            <CanvasBottomBar />
          </div>
        </div>

        {/* Anotácie k návrhu */}
        <div className="space-y-4">
          <Annotations variant={variant} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spoločný „chrome“ plátna                                            */
/* ------------------------------------------------------------------ */

function CanvasChrome() {
  const farm = FARMS[0];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      {/* Horná stavová lišta cielená na terén: kontext farmy + offline indikátor */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Späť na prehľad"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-foreground">
            Terénne návštevy
          </p>
          <p className="flex items-center gap-1 truncate text-2xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            {farm.name}
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <WifiOff className="h-3 w-3" aria-hidden="true" />
          Offline · synchronizuje sa
        </Badge>
      </div>

      {/* Rýchly CEHZ sken — primárny vstup v teréne, 44 px+ ciele */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground">
          <ScanBarcode className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">SK ___ ___ ___ ___ (naskenovať známku)</span>
        </div>
        <Button size="icon" className="h-12 w-12 shrink-0" aria-label="Naskenovať ušnú známku">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label="Diktovať číslo známky"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}

function CanvasBottomBar() {
  return (
    <div className="sticky bottom-0 border-t border-border bg-card/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3">
        <Button className="h-12 flex-1 gap-2 text-sm font-semibold">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nový výjazd
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12"
          aria-label="Hromadná akcia (šarža)"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12"
          aria-label="Navigovať na ďalšiu farmu"
        >
          <Navigation className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zdieľané stavové prvky (rovnaké tokeny/triedy ako produkcia)        */
/* ------------------------------------------------------------------ */

function MilkMeatChips({ w }: { w: WithdrawalFixture }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {w.milk.active ? (
        <Badge className="border-red-700 bg-red-600 text-white tabular-nums hover:bg-red-600">
          Mlieko {w.milk.remainingDays} d · do {w.milk.safeUntil}
        </Badge>
      ) : w.milk.days > 0 ? (
        <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
          Mlieko — lehota vypršala
        </Badge>
      ) : null}
      {w.meat.active ? (
        <Badge className="border-red-800 bg-red-700 text-white tabular-nums hover:bg-red-700">
          Mäso {w.meat.remainingDays} d
        </Badge>
      ) : w.meat.days > 0 ? (
        <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground">
          Mäso — lehota vypršala
        </Badge>
      ) : null}
    </div>
  );
}

function WithdrawalWarningText({ w }: { w: WithdrawalFixture }) {
  if (!w.overallSafeUntil) return null;
  return (
    <p className="text-2xs font-medium text-red-700 dark:text-red-400">
      Zákaz dodávky mlieka a porážky na ľudský konzum — lehota plynie do{" "}
      {w.overallSafeUntil} (podané {w.administeredAt}).
    </p>
  );
}

function SectionHeading({
  icon,
  tone,
  title,
  count,
}: {
  icon: React.ReactNode;
  tone: "danger" | "ok";
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={tone === "danger" ? "text-red-600" : "text-emerald-600"}>{icon}</span>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANT A — karty                                                    */
/* ------------------------------------------------------------------ */

function VariantCards() {
  return (
    <div className="space-y-5 px-3 py-4">
      <section className="space-y-2" aria-labelledby="m1a-watch">
        <SectionHeading
          icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          tone="danger"
          title="Ochranné lehoty — Withdrawal Watch"
          count={ACTIVE_WITHDRAWAL_COUNT}
        />
        <ul className="space-y-2.5" id="m1a-watch">
          {WITHDRAWAL_WATCH.map((w) => (
            <li
              key={w.id}
              className={cn(
                "rounded-xl border bg-card p-3 shadow-xs",
                w.overallSafeUntil
                  ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Badge variant="outline" className="shrink-0 font-mono text-3xs tabular-nums">
                    {w.earTag}
                  </Badge>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {w.patientName}
                  </span>
                </div>
                <span className="shrink-0 text-2xs text-muted-foreground">{w.farmName}</span>
              </div>
              <p className="mt-1.5 text-2xs font-medium text-foreground">{w.medicationName}</p>
              <p className="text-2xs text-muted-foreground">
                Podané <span className="font-mono tabular-nums">{w.administeredAt}</span>
              </p>
              <div className="mt-2">
                <MilkMeatChips w={w} />
              </div>
              <div className="mt-1.5">
                <WithdrawalWarningText w={w} />
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-border/60 pt-2">
                <Button variant="ghost" size="sm" className="h-11 gap-1 px-3 text-xs">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Detail
                </Button>
                <Button variant="outline" size="sm" className="h-11 gap-1 px-3 text-xs">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Pre farmára
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="m1a-log">
        <SectionHeading
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          tone="ok"
          title="Dnešný log podaní"
          count={TODAY_LOG.length}
        />
        <ul className="space-y-2.5" id="m1a-log">
          {TODAY_LOG.map((v) => (
            <li key={v.id} className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-2 font-mono text-muted-foreground tabular-nums">{v.time}</span>
                  {v.farmName}
                </p>
                {v.signed ? (
                  <Badge variant="outline" className="shrink-0 gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Podpísané
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="shrink-0">
                    Nepodpísané
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {v.actions.map((action) => (
                  <Badge key={action} variant="secondary" className="text-3xs font-medium">
                    {action}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-2xs text-muted-foreground">
                <span>
                  {v.vetName} · {v.animals} zvierat
                </span>
                {v.invoice ? (
                  <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300">
                    {v.invoice.amountEur} € (nevyúčtované)
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANT B — kompaktný zoznam s expanderom                            */
/* ------------------------------------------------------------------ */

function VariantCompactExpand() {
  const [openId, setOpenId] = useState<string | null>(WITHDRAWAL_WATCH[0]?.id ?? null);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="space-y-4 px-3 py-4">
      {/* Hromadná akcia — v teréne často „všetkým v boxe podať“ */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 pl-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            aria-label="Vybrať všetky riadky"
            checked={selected.length === WITHDRAWAL_WATCH.length}
            onChange={(event) =>
              setSelected(event.target.checked ? WITHDRAWAL_WATCH.map((w) => w.id) : [])
            }
            className="h-5 w-5 rounded border-input text-primary"
          />
          Vybrať ({selected.length}/{WITHDRAWAL_WATCH.length})
        </label>
        <Button size="sm" className="h-11 px-3 text-xs" disabled={selected.length === 0}>
          Hromadná akcia
        </Button>
      </div>

      <section aria-labelledby="m1b-watch" className="space-y-1.5">
        <SectionHeading
          icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          tone="danger"
          title="Ochranné lehoty"
          count={ACTIVE_WITHDRAWAL_COUNT}
        />
        <ul id="m1b-watch" className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {WITHDRAWAL_WATCH.map((w, index) => {
            const open = openId === w.id;
            const active = Boolean(w.overallSafeUntil);
            return (
              <li
                key={w.id}
                className={cn(index > 0 && "border-t border-border", active && "bg-red-50/40 dark:bg-red-950/20")}
              >
                <div className="flex items-center gap-2 py-1 pl-2 pr-1">
                  <input
                    type="checkbox"
                    aria-label={`Vybrať ${w.patientName}`}
                    checked={selected.includes(w.id)}
                    onChange={() => toggleSelect(w.id)}
                    className="h-5 w-5 rounded border-input text-primary"
                  />
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`m1b-row-${w.id}`}
                    onClick={() => setOpenId(open ? null : w.id)}
                    className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        active ? "bg-red-600" : "bg-emerald-600",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {w.patientName}
                        <span className="ml-2 font-mono text-3xs font-normal text-muted-foreground tabular-nums">
                          {w.earTag}
                        </span>
                      </span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {active
                          ? `Mlieko ${w.milk.remainingDays} d · Mäso ${w.meat.remainingDays} d`
                          : "Lehoty vypršali"}
                      </span>
                    </span>
                    {active ? (
                      <Badge className="shrink-0 border-red-700 bg-red-600 text-white tabular-nums hover:bg-red-600">
                        OL do {w.overallSafeUntil}
                      </Badge>
                    ) : (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Vhodné na dodávku" />
                    )}
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                {open && (
                  <div id={`m1b-row-${w.id}`} className="space-y-2 px-3 pb-3 pl-11">
                    <p className="text-2xs font-medium text-foreground">{w.medicationName}</p>
                    <p className="text-2xs text-muted-foreground">
                      Podané <span className="font-mono tabular-nums">{w.administeredAt}</span> · {w.farmName}
                    </p>
                    <MilkMeatChips w={w} />
                    <WithdrawalWarningText w={w} />
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="outline" size="sm" className="h-11 gap-1 px-3 text-xs">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Detail
                      </Button>
                      <Button variant="outline" size="sm" className="h-11 gap-1 px-3 text-xs">
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Pre farmára
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="m1b-log" className="space-y-1.5">
        <SectionHeading
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          tone="ok"
          title="Dnešný log podaní"
          count={TODAY_LOG.length}
        />
        <ul id="m1b-log" className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {TODAY_LOG.map((v, index) => (
            <li
              key={v.id}
              className={cn("flex min-h-11 items-center gap-2 px-3 py-2", index > 0 && "border-t border-border")}
            >
              <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{v.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{v.farmName}</p>
                <p className="truncate text-2xs text-muted-foreground">
                  {v.actions.join(" · ")}
                </p>
              </div>
              {v.signed ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Podpísané" />
              ) : (
                <Badge variant="destructive" className="shrink-0 text-4xs">
                  Nepodpísané
                </Badge>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANT C — denná agenda                                             */
/* ------------------------------------------------------------------ */

function VariantAgenda() {
  const doneCount = TODAY_AGENDA.filter((s) => s.state === "done").length;
  return (
    <div className="space-y-4 px-3 py-4">
      {/* Sumár dňa */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-2.5 text-center shadow-xs">
          <p className="text-lg font-bold text-foreground tabular-nums">{TODAY_AGENDA.length}</p>
          <p className="text-3xs text-muted-foreground">zastávok</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5 text-center shadow-xs">
          <p className="text-lg font-bold text-foreground tabular-nums">
            {doneCount}/{TODAY_AGENDA.length}
          </p>
          <p className="text-3xs text-muted-foreground">hotovo</p>
        </div>
        <div className="rounded-xl border border-red-300 bg-red-50/60 p-2.5 text-center shadow-xs dark:border-red-900 dark:bg-red-950/20">
          <p className="text-lg font-bold text-red-700 tabular-nums dark:text-red-400">
            {ACTIVE_WITHDRAWAL_COUNT}
          </p>
          <p className="text-3xs text-red-700/80 dark:text-red-400/80">v OL</p>
        </div>
      </div>

      {/* Časová os zastávok */}
      <ol className="relative space-y-3 border-l-2 border-border pl-4" aria-label="Dnešná agenda výjazdov">
        {TODAY_AGENDA.map((stop) => (
          <li key={stop.id} className="relative">
            <span
              className={cn(
                "absolute -left-[23px] top-3 h-3.5 w-3.5 rounded-full border-2 border-background",
                stop.state === "done" && "bg-emerald-600",
                stop.state === "enroute" && "bg-primary",
                stop.state === "planned" && "bg-muted-foreground/40",
              )}
              aria-hidden="true"
            />
            <article
              className={cn(
                "rounded-xl border p-3 shadow-xs",
                stop.state === "enroute"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card",
                stop.state === "done" && "opacity-90",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-foreground tabular-nums">
                  {stop.timeWindow}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    stop.state === "done" &&
                      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                    stop.state === "enroute" && "border-primary/40 bg-primary/10 text-primary",
                    stop.state === "planned" && "text-muted-foreground",
                  )}
                >
                  {stop.state === "done" ? "Hotovo" : stop.state === "enroute" ? "Na ceste" : "Plánované"}
                </Badge>
              </div>
              <h3 className="mt-1 text-sm font-bold text-foreground">{stop.farmName}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Navigation className="h-3 w-3" aria-hidden="true" />
                {stop.distanceKm} · {stop.animals} zvierat
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {stop.plannedActions.map((action) => (
                  <Badge key={action} variant="secondary" className="text-3xs font-medium">
                    {action}
                  </Badge>
                ))}
              </div>
              {stop.withdrawalAlert && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50/60 px-2 py-1.5 text-2xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Na farme sú zvieratá v ochrannej lehote — podania zapisuj podľa OL sledovania.
                </p>
              )}
              {stop.state !== "done" && (
                <div className="mt-2.5 flex items-center gap-2">
                  <Button size="sm" className="h-11 flex-1 gap-1 text-xs">
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    {stop.state === "enroute" ? "Začať výjazd" : "Navigovať"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-11 gap-1 px-3 text-xs">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Pohyb
                  </Button>
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>

      {/* Súhrnná OL karta namiesto zoznamu */}
      <div className="rounded-xl border border-red-300 bg-red-50/40 p-3 shadow-xs dark:border-red-900 dark:bg-red-950/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-bold text-foreground">Withdrawal Watch</p>
          </div>
          <Badge className="border-red-700 bg-red-600 text-white tabular-nums hover:bg-red-600">
            {ACTIVE_WITHDRAWAL_COUNT} aktívne
          </Badge>
        </div>
        <p className="mt-1 text-2xs text-muted-foreground">
          Blesk (do 17. 10.) · Muška (do 8. 11.) — ťapnutím otvoríte detail a akcie.
        </p>
        <Button variant="outline" size="sm" className="mt-2 h-11 w-full gap-1 text-xs">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Otvoriť Withdrawal Watch
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Anotácie — čo variant rieši                                          */
/* ------------------------------------------------------------------ */

const ANNOTATIONS: Record<
  string,
  { title: string; points: readonly string[]; tradeoff: string }
> = {
  a: {
    title: "Variant A · Karty",
    points: [
      "Každý záznam (OL sledovanie, log podaní) je samostatná karta — žiadna vodorovná tabuľka, žiadne min-w-[620–860 px] a scroll v scrolle (nález P2-4).",
      "Všetky ciele sú ≥ 44 px (iOS HIG): riadky akcií h-11, primárne ovládanie h-12; horná lišta drží kontext farmy a offline stav.",
      "Spodná akčná lišta je sticky s pb-[env(safe-area-inset-bottom)] — Nový výjazd je vždy dosiahnuteľný palcom.",
      "Obsah karty kopíruje produkčné stĺpce 1:1 (CEHZ známka, liečivo, dátumy, mliečne/mäsové čipy, varovanie), takže návrh overuje iba layout, nie obsah.",
    ],
    tradeoff: "Pri 50+ záznamoch dlhá stránka — rieši sa serverovým stránkovaním (limit 20 + „Načítať ďalšie“), nie scrollom tabuľky.",
  },
  b: {
    title: "Variant B · Kompaktný zoznam + expander + hromadné akcie",
    points: [
      "Riadok = súhrn (zviera, známka, OL čip); detail sa rozbalí inline cez aria-expanded — hustota blízka tabuľke bez horizontálneho scrollu.",
      "Checkboxy (24 px vo výplni 12 px → 44 px+) + „Vybrať všetky“ umožňujú šaržové podania, ktoré sú v teréne denný chlieb.",
      "Log podaní ostáva jednoliaty zoznam s podpisovým stavom.",
    ],
    tradeoff: "Dva interakčné prvky v jednom riadku (checkbox vs. expander) — vyžaduje presné oddelenie hit-zón; pre senior vet používateľov menej zrejmé než karty.",
  },
  c: {
    title: "Variant C · Denná agenda (časová os)",
    points: [
      "Primárny model je deň: zastávky na časovej osi so stavmi (hotovo / na ceste / plánované), navigáciou a plánovanými akciami — zodpovedá tomu, ako sa terén reálne používa (ráno plán, cez deň podania).",
      "Withdrawal Watch degraduje na súhrnnú alert kartu + 1-tap detail — menej prehľadný zoznam, ale aktívny OL alert priamo pri zastávke.",
      "OL upozornenie sa derie aj do kontextu zastávky („na farme sú zvieratá v OL“) — preventívna bezpečnostná vrstva, ktorú tabuľka nedáva.",
    ],
    tradeoff: "Najväčšia zmena mentálneho modelu; OL zoznam je skrytejší. Kombinovateľné s A: agenda ako default tab, karty ako druhý tab.",
  },
};

function Annotations({ variant }: { variant: string }) {
  const notes = ANNOTATIONS[variant] ?? ANNOTATIONS.a;
  return (
    <div className="space-y-3 lg:sticky lg:top-24">
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="text-sm font-bold text-foreground">{notes.title}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-2xs leading-relaxed text-muted-foreground">
          {notes.points.map((point) => (
            <li key={point.slice(0, 32)}>{point}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 p-2.5 text-2xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Kompromis: {notes.tradeoff}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-2xs leading-relaxed text-muted-foreground shadow-xs">
        <p className="font-semibold text-foreground">Kontrakt návrhu (platí pre všetky varianty)</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>min-h-dvh namiesto h-screen (mobilné adresné lišty).</li>
          <li>touch-manipulation cez body (D4) + ciele ≥ 44 px na terénnej ploche.</li>
          <li>Žiadny table-scroll pod md; od md sa môže vracať hustá tabuľka (responsive hybrid).</li>
          <li>Stavové tokeny z produkcie (red-600/700 OL čipy, emerald podpisy), žiadne nové farby.</li>
        </ul>
      </div>
    </div>
  );
}
