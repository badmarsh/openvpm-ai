"use client";

import { useState } from "react";
import { Loader2, Palette, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AiCanvas({ onGenerated }: { onGenerated?: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [report, setReport] = useState<any | null>(null);

  const utils = trpc.useUtils();

  const generateMutation = trpc.extensions.marketing.generateIllustration.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        setMsg({
          type: "ok",
          text: "Ilustrácia vygenerovaná a bezpečne uložená do knižnice (označená ako generovaná).",
        });
        setPrompt("");
        setReport(null);
        utils.extensions.marketing.listMediaAssets.invalidate();
        onGenerated?.();
      } else {
        setMsg({
          type: "err",
          text: data.error ?? "Generovanie zlyhalo.",
        });
        setReport(data.report ?? null);
      }
    },
    onError: (err) => {
      setMsg({
        type: "err",
        text: err.message || "Generovanie zlyhalo.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 4) return;
    setMsg(null);
    setReport(null);
    generateMutation.mutate({ prompt: prompt.trim() });
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground leading-tight">
            AI Canvas – generovaná ilustrácia
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministická brandová ilustrácia s prísnym veterinárnym etickým filtrom.
          </p>
        </div>
      </div>

      <ul className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Pravidlo M2:</strong> Používa sa len vtedy, keď neexistuje vhodná skutočná fotka pacienta so súhlasom majiteľa.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Etické označenie:</strong> Výstup je VŽDY označený visačkou „Ilustrácia“ – v UI aj v alt texte pre prístupnosť. Nikdy sa negeneruje realistické zviera vyzerajúce ako skutočný pacient kliniky.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Zákonná zhoda:</strong> Prompt prechádza automatickým validátorom slovenskej veterinárnej etiky (žiadne názvy Rx liečiv, garancie vyliečenia ani porovnávanie).
          </span>
        </li>
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="napr. letná hydratácia psa – abstraktný plagát, dentálna hygiena mačky..."
            maxLength={200}
            className="pl-9 h-11 rounded-xl bg-background text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={generateMutation.isPending || prompt.trim().length < 4}
          className="w-full sm:w-auto h-11 px-6 rounded-xl gap-2 font-semibold shadow-sm"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generujem...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generovať ilustráciu
            </>
          )}
        </Button>
      </form>

      {msg && (
        <div
          className={`rounded-xl p-3 text-xs font-medium ${
            msg.type === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
              : "bg-red-500/10 border border-red-500/25 text-red-800 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {report && report.findings && report.findings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Nálezy veterinárneho validátora etiky:
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
            {report.findings.map((f: any, i: number) => (
              <li key={i}>
                <span className="font-semibold uppercase text-[10px] bg-amber-200 dark:bg-amber-900 px-1 py-0.5 rounded mr-1">
                  {f.severity || f.type}
                </span>
                {f.message || f.rule}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
