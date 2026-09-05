"use client";

import { useState } from "react";
import {
  Copy,
  Plus,
  FileText,
  Check,
  Globe,
  Lock,
  ExternalLink,
  Printer,
  Eye,
  QrCode,
  AlertTriangle,
  PawPrint,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getHandoutThematicImage } from "@/lib/marketing/handout-themes";
import { FlyerPreviewModal } from "@/components/marketing/flyer-preview-modal";
import { AiFlyerGenerator } from "@/components/marketing/ai-flyer-generator";

export default function HandoutsPage() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [species, setSpecies] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewHandout, setPreviewHandout] = useState<any | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listHandouts.useQuery();
  const brandQuery = trpc.extensions.marketing.getBrandInfo.useQuery();

  const createMutation = trpc.extensions.marketing.createHandout.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      setShowAiGenerator(false);
      setAiImageUrl(null);
      utils.extensions.marketing.listHandouts.invalidate();
      setSlug("");
      setTitle("");
      setBody("");
      setSpecies([]);
      setIsPublic(true);
      toast.success("Nový edukačný leták bol vytvorený");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vytvoriť leták");
    },
  });

  const toggleSpecies = (s: string) => {
    setSpecies((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const copyUrl = (handoutSlug: string) => {
    const url = `${window.location.origin}/h/${handoutSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(handoutSlug);
    toast.success("Odkaz na leták skopírovaný");
    setTimeout(() => setCopied(null), 2000);
  };

  const extractChecklist = (handoutBody?: string | null) => {
    if (!handoutBody) return [];
    const lines = handoutBody.split("\n").map((l) => l.trim()).filter(Boolean);
    const bullets = lines
      .filter((l) => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l))
      .map((l) => l.replace(/^[-*•\d.]+\s+/, "").replace(/[*_#`]/g, ""));

    if (bullets.length >= 2) {
      return bullets.slice(0, 3);
    }

    return [
      "Kľudový režim a zamedzenie nadmerného pohybu",
      "Pravidelná kontrola stavu a prípadnej rany 2x denne",
      "Zamedzenie olizovaniu a presné podávanie liekov",
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            {t("marketing.handouts.title", "Edukačné letáky")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.handouts.description",
              "Knižnica opakovateľných letákov s QR kódmi pre klientov – pripravené na tlač (A5) aj do mobilu."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("marketing.handouts.newHandout", "Nový leták")}
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-violet-50/50 dark:bg-violet-950/20 border-violet-300 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30"
            onClick={() => {
              setShowAiGenerator(true);
              setIsDialogOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            {t("marketing.handouts.aiGenerate", "AI Generátor")}
          </Button>
        </div>
      </div>

      {/* Creation Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed z-50 grid w-full max-w-xl gap-4 border bg-background p-6 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col space-y-1.5 text-left border-b pb-3">
              <h2 className="text-lg font-bold leading-none tracking-tight">
                {t("marketing.handouts.newHandout", "Nový leták")}
              </h2>
              <p className="text-xs text-muted-foreground">
                Vytvorte nový leták s pokynmi pre majiteľov, ktorý si môžu vytlačiť alebo naskenovať cez QR kód.
              </p>
            </div>

            {/* Toggle AI Generator */}
            <div className="flex items-center gap-2 pb-2">
              <Button
                variant={showAiGenerator ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setShowAiGenerator(!showAiGenerator)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {showAiGenerator ? "Skryť AI Generátor" : "Otvoriť AI Generátor"}
              </Button>
              {aiImageUrl && (
                <Badge variant="secondary" className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                  ✓ AI obrázok vygenerovaný
                </Badge>
              )}
            </div>

            {/* AI Flyer Generator Panel */}
            {showAiGenerator && (
              <div className="space-y-3 pb-3 border-b">
                <AiFlyerGenerator
                  species={species.length > 0 ? species : undefined}
                  handoutTitle={title || undefined}
                  onGenerated={(url) => {
                    setAiImageUrl(url);
                    toast.success("AI obrázok pripravený — môžete ho použiť ako ilustračnú fotku letáku.");
                  }}
                />
              </div>
            )}

            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold">Názov letáku</label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slug) {
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                      );
                    }
                  }}
                  placeholder="Napr. Starostlivosť po kastrácii"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">URL Slug letáku (/h/slug)</label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="starostlivost-po-kastraci"
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">Len malé písmená bez diakritiky, čísla a pomlčky.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">Obsah letáku (Markdown pokyny pre klienta)</label>
                <Textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Sem napíšte obsah letáku: zásady kľudového režimu, kontrola rany, kedy volať lekára..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">Cieľové zvieratá</label>
                <div className="flex items-center gap-6">
                  {["Pes", "Mačka", "Iné"].map((s) => (
                    <div key={s} className="flex items-center space-x-2">
                      <Checkbox
                        id={`species-${s}`}
                        checked={species.includes(s)}
                        onChange={() => toggleSpecies(s)}
                      />
                      <label htmlFor={`species-${s}`} className="text-xs font-medium cursor-pointer">
                        {s === "Pes" ? "🐶 Pes" : s === "Mačka" ? "🐱 Mačka" : s}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="public-toggle"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="public-toggle" className="text-xs font-medium cursor-pointer">
                  Verejný leták (dostupný pre klientov a online náhľad)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => {
                  setIsDialogOpen(false);
                  setShowAiGenerator(false);
                  setAiImageUrl(null);
                }}>
                  Zrušiť
                </Button>
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate({ slug, title, body, species, isPublic })}
                  disabled={!slug || !title || !body || createMutation.isPending}
                >
                  {createMutation.isPending ? "Ukladám..." : "Vytvoriť leták"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Handout List - Physical Leaflet / Flyer Mockup View */}
      {listQuery.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-[520px] w-full animate-pulse rounded-2xl bg-muted/30 border" />
          <div className="h-[520px] w-full animate-pulse rounded-2xl bg-muted/30 border" />
          <div className="h-[520px] w-full animate-pulse rounded-2xl bg-muted/30 border" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          {t("marketing.handouts.noHandouts", "Žiadne letáky.")}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((handout: any) => {
            const theme = getHandoutThematicImage(handout);
            const checklist = extractChecklist(handout.body);
            const clinicName = brandQuery.data?.name || "Veterinárna klinika";

            return (
              <div
                key={handout.id}
                className="group relative bg-[#fffdfa] dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden ring-1 ring-stone-950/5 dark:ring-white/5"
              >
                {/* 1. Flyer Top Header Strip */}
                <div className="bg-teal-800 dark:bg-teal-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-teal-900/30">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center shrink-0">
                      <PawPrint className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest truncate">
                      {clinicName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/90 uppercase tracking-wide">
                      EDUKAČNÝ LETÁK
                    </span>
                    {handout.isPublic ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white">
                        <Globe className="h-2.5 w-2.5" />
                        Verejný
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full bg-stone-700 text-stone-200">
                        <Lock className="h-2.5 w-2.5" />
                        Interný
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Flyer Thematic Inset Illustration */}
                <div className="p-3.5 pb-0">
                  <div className="relative h-44 w-full overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-950 border border-stone-200/70 dark:border-stone-800 shadow-inner">
                    <img
                      src={theme.src}
                      alt={theme.alt}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent" />

                    {/* Category Stamp on bottom-left */}
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-stone-900 backdrop-blur-md shadow-sm border border-stone-200">
                        {theme.category}
                      </span>
                    </div>

                    {/* Species Badges on top-right */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1">
                      {handout.species?.map((s: string) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-900/80 text-white backdrop-blur-md shadow-xs"
                        >
                          {s.toLowerCase() === "canine" || s.toLowerCase() === "pes"
                            ? "🐶 Pes"
                            : s.toLowerCase() === "feline" || s.toLowerCase() === "macka"
                            ? "🐱 Mačka"
                            : s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Flyer Body & Leaflet Checklist */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {handout.title}
                    </h3>

                    {/* Structured Flyer Checklist (Čo robiť / Zásady) */}
                    <div className="rounded-xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200/70 dark:border-stone-800/80 p-2.5 space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Hlavné zásady starostlivosti:
                      </p>
                      <ul className="space-y-1">
                        {checklist.map((item, idx) => (
                          <li key={idx} className="text-[11px] leading-tight text-stone-700 dark:text-stone-300 flex items-start gap-1.5">
                            <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0">✓</span>
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Warning Callout */}
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        <strong>Kedy volať lekára:</strong> Apatia, zvracanie, krvácanie z rany alebo teplota.
                      </span>
                    </div>
                  </div>

                  {/* 4. Flyer Tear-Off Perforation & QR Code */}
                  <div className="pt-2 border-t-2 border-dashed border-stone-300 dark:border-stone-700 space-y-2.5">
                    <div className="flex items-center justify-between bg-stone-100/80 dark:bg-stone-800/50 rounded-xl p-2 border border-stone-200/60 dark:border-stone-700/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 flex items-center justify-center p-1 shrink-0 shadow-xs">
                          <QrCode className="w-6 h-6 text-stone-900 dark:text-stone-100" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-stone-800 dark:text-stone-200">
                            <Smartphone className="w-3 h-3 text-teal-600" />
                            Naskenujte do mobilu
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">
                            /h/{handout.slug}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2.5 text-[11px] gap-1 shrink-0 font-semibold"
                        onClick={() => setPreviewHandout(handout)}
                        title="Zobraziť plný leták pripravený na tlač"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        Náhľad letáku
                      </Button>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1 text-[11px] h-8 px-1.5"
                        onClick={() => copyUrl(handout.slug)}
                      >
                        {copied === handout.slug ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Hotovo</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Kopírovať</span>
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1 text-[11px] h-8 px-1.5"
                        onClick={() => window.open(`/h/${handout.slug}`, "_blank")}
                        title="Vytlačiť leták"
                      >
                        <Printer className="h-3 w-3 text-teal-700" />
                        <span>Tlačiť</span>
                      </Button>

                      <a
                        href={`/h/${handout.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 text-[11px] font-medium border rounded-md px-1.5 h-8 bg-background hover:bg-muted/80 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Otvoriť</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Screen Flyer Printable Preview Modal */}
      {previewHandout && (
        <FlyerPreviewModal
          handout={previewHandout}
          practice={brandQuery.data}
          onClose={() => setPreviewHandout(null)}
        />
      )}
    </div>
  );
}
