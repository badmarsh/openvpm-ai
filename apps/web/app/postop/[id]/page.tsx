"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  PawPrint,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Send,
  Loader2,
  Phone,
  HeartHandshake,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type OutcomeType = "ok" | "question" | "concern";

export default function PublicPostopCheckinPage() {
  const params = useParams();
  const id = (params.id as string) ?? "";

  const [outcome, setOutcome] = useState<OutcomeType | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitMutation = trpc.extensions.marketing.submitPostopResponse.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setErrorMessage(null);
    },
    onError: (err) => {
      setErrorMessage(
        err.message || "Nepodarilo sa odoslať odpoveď. Skontrolujte prosím internetové pripojenie."
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) return;

    setErrorMessage(null);

    // If id is a valid uuid, pass messageLogId, otherwise pass as token
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    submitMutation.mutate({
      messageLogId: isUuid ? id : undefined,
      token: !isUuid ? id : undefined,
      outcome,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-lg w-full bg-card border rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <header className="p-6 border-b bg-muted/40 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-sm">
            <PawPrint className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Pooperačná kontrola stavu</h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Záleží nám na rýchlej a bezpečnej rekonvalescencii vášho miláčika. Vyplnenie zaberie len
            niekoľko sekúnd.
          </p>
        </header>

        {/* Form or Confirmation */}
        <div className="p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <HeartHandshake className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">Ďakujeme za vašu odpoveď!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Informáciu sme bezpečne zaznamenali do zdravotného záznamu.
                  {outcome === "concern" || outcome === "question"
                    ? " Náš veterinárny personál si vašu správu prečíta a v prípade potreby vás bude telefonicky kontaktovať."
                    : " Tešíme sa, že sa pacientovi darí dobre!"}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">
                  Ako sa má váš pacient po zákroku?
                </label>

                <div className="grid grid-cols-1 gap-3">
                  {/* OK option */}
                  <button
                    type="button"
                    onClick={() => setOutcome("ok")}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      outcome === "ok"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 shadow-sm"
                        : "border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-6 h-6 shrink-0 ${
                        outcome === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm">Darí sa dobre / Bez ťažkostí</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Normálne pije, prijíma potravu, rana je čistá a pokojná.
                      </div>
                    </div>
                  </button>

                  {/* Question option */}
                  <button
                    type="button"
                    onClick={() => setOutcome("question")}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      outcome === "question"
                        ? "border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-200 shadow-sm"
                        : "border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <HelpCircle
                      className={`w-6 h-6 shrink-0 ${
                        outcome === "question" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm">Mám doplňujúcu otázku</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Potrebujem poradiť ohľadom liekov, kŕmenia alebo režimu.
                      </div>
                    </div>
                  </button>

                  {/* Concern option */}
                  <button
                    type="button"
                    onClick={() => setOutcome("concern")}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      outcome === "concern"
                        ? "border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200 shadow-sm"
                        : "border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-6 h-6 shrink-0 ${
                        outcome === "concern" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm">Niečo nie je v poriadku / Mám obavy</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Zviera je apatické, odmieta piť, rana opúcha alebo bolí.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Textarea for details if question or concern */}
              {(outcome === "question" || outcome === "concern") && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-foreground block">
                    {outcome === "concern" ? "Popíšte prosím, čo pozorujete:" : "Vaša otázka pre veterinára:"}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Napr. pacient nechce piť, rana mierne mokvá, liek odmieta prehltnúť..."
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{note.length} / 1000</p>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!outcome || submitMutation.isPending}
                className="w-full h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Odosielam...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Odoslať odpoveď klinike
                  </>
                )}
              </button>
            </form>
          )}

          {/* Emergency Warning */}
          <div className="mt-8 pt-6 border-t space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Akútne ohrozenie života pacienta</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              V prípade krvácania, kolapsu, pretrvávajúceho zvracania alebo dusenia nečakajte na
              vyhodnotenie formulára a okamžite volajte pohotovosť kliniky!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
