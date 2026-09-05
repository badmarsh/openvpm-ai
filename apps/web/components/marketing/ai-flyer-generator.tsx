"use client";

import { useState } from "react";
import {
  Loader2,
  Sparkles,
  ImageIcon,
  Download,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  Wand2,
  RotateCcw,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * AI Flyer & Illustration Generator
 *
 * Two modes:
 * 1. **Text-to-Image** — generuje úplne nový obrázok z textového promptu (Alibaba Wanx)
 * 2. **Edit Existing** — upraví existujúci obrázok cez AI (budúca funkcia, teraz len text-to-image)
 */
type GenMode = "text2img";

export function AiFlyerGenerator({
  onGenerated,
  species,
  handoutTitle,
}: {
  onGenerated?: (imageUrl: string) => void;
  species?: string[];
  handoutTitle?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenMode>("text2img");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [result, setResult] = useState<{ url: string; prompt: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const utils = trpc.useUtils();

  const genImageMutation = trpc.extensions.marketing.generateImage.useMutation();
  const genIllustrationMutation = trpc.extensions.marketing.generateIllustration.useMutation();

  /** Build a contextual prompt enriched with species & handout title */
  const buildContextualPrompt = (): string => {
    let base = prompt.trim();
    if (handoutTitle && !base.toLowerCase().includes(handoutTitle.toLowerCase())) {
      base = `${handoutTitle} — ${base}`;
    }
    if (species && species.length > 0) {
      const speciesStr = species.join(" & ");
      if (!base.toLowerCase().includes(speciesStr.toLowerCase())) {
        base = `${base} (${speciesStr})`;
      }
    }
    return base;
  };

  const handleGenerate = async () => {
    const contextualPrompt = buildContextualPrompt();
    if (contextualPrompt.length < 4) {
      setMsg({ type: "err", text: "Zadajte popis obrázka (min. 4 znaky)." });
      return;
    }

    setMsg(null);
    setResult(null);
    setIsGenerating(true);

    try {
      // Try Alibaba real image generation first
      const imageResult = await genImageMutation.mutateAsync({
        prompt: contextualPrompt,
        size: "1024*1024",
      });

      if (imageResult?.url) {
        setResult({ url: imageResult.url, prompt: contextualPrompt });
        setMsg({
          type: "ok",
          text: "Obrázok vygenerovaný cez Alibaba AI a pripravený na použitie.",
        });
        utils.extensions.marketing.listMediaAssets.invalidate();
        onGenerated?.(imageResult.url);
        return;
      }
    } catch {
      // Fall through to procedural illustration
    }

    try {
      // Fallback: procedural SVG illustration
      const illResult = await genIllustrationMutation.mutateAsync({
        prompt: contextualPrompt,
      });

      if (illResult.ok && illResult.id) {
        // Fetch the newly created asset to get URL
        const assets = await utils.extensions.marketing.listMediaAssets.fetch();
        const newAsset = assets?.[0];
        if (newAsset?.asset?.url) {
          setResult({ url: newAsset.asset.url, prompt: contextualPrompt });
          setMsg({
            type: "ok",
            text: "Ilustrácia vygenerovaná (SVG) a uložená do knižnice.",
          });
          onGenerated?.(newAsset.asset.url);
          return;
        }
      }
    } catch (err: any) {
      setMsg({
        type: "err",
        text: err?.message || "Generovanie zlyhalo. Skúste to znova.",
      });
    }

    setIsGenerating(false);
  };

  const handleReset = () => {
    setPrompt("");
    setMsg(null);
    setResult(null);
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-2">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground leading-tight">
            AI Generátor letákov & obrázkov
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vytvorte ilustráciu alebo fotografiu pre váš leták pomocou AI.
          </p>
        </div>
      </div>

      {/* Ethics notice */}
      <div className="mx-4 rounded-xl border bg-muted/30 p-3 space-y-1.5">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>M2 Pravidlo:</strong> AI obrázok sa použije len ak neexistuje vhodná fotka pacienta so súhlasom.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Označenie:</strong> Výstup je vždy označený ako "AI generovaný".
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Etický filter:</strong> Prompt prechádza automatickou kontrolou KVL SR etiky.
          </span>
        </div>
      </div>

      {/* Prompt input */}
      <div className="px-4 space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Popis obrázka (prompt)
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              species && species.length > 0
                ? `napr. zdravý ${species[0].toLowerCase()} pri veterinárovi, jasná klinika, profesionálna fotka...`
                : "napr. zdravý pes pri veterinárovi, jasná klinika, profesionálna fotka..."
            }
            rows={3}
            maxLength={500}
            className="rounded-xl bg-background text-sm resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {prompt.length}/500
          </p>
        </div>

        {/* Contextual preview */}
        {handoutTitle && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Kontext letáku:</span>
            <Badge variant="secondary" className="text-[10px]">
              {handoutTitle}
            </Badge>
            {species && species.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {species.join(", ")}
              </Badge>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || prompt.trim().length < 4}
            className="flex-1 h-11 rounded-xl gap-2 font-semibold shadow-sm bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generujem AI obrázok...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generovať obrázok
              </>
            )}
          </Button>

          {(prompt || result) && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              className="h-11 w-11 rounded-xl"
              title="Vyčistiť"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div
          className={cn(
            "mx-4 rounded-xl p-3 text-xs font-medium flex items-start gap-2",
            msg.type === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
              : "bg-red-500/10 border border-red-500/25 text-red-800 dark:text-red-300"
          )}
        >
          {msg.type === "ok" ? (
            <Check className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Generated image preview */}
      {result && (
        <div className="mx-4 space-y-3 pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ImageIcon className="h-4 w-4 text-violet-600" />
            Vygenerovaný obrázok
          </div>

          <div className="rounded-xl overflow-hidden border-2 border-violet-500/30 bg-muted/20">
            <img
              src={result.url}
              alt={result.prompt}
              className="w-full h-auto max-h-96 object-contain bg-white"
            />
          </div>

          <div className="rounded-xl bg-muted/40 border p-2.5 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Použitý prompt
            </p>
            <p className="text-xs text-foreground italic">"{result.prompt}"</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs"
              onClick={() => {
                const link = document.createElement("a");
                link.href = result.url;
                link.download = `flyer-ai-${Date.now()}.png`;
                link.click();
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Stiahnuť
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs"
              onClick={() => window.open(result.url, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Otvoriť
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
