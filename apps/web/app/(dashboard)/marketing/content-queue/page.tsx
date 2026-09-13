"use client";

import { useState } from "react";
import {
  CalendarDays,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  Filter,
  Eye,
  Check,
  X,
  Share2,
  Tv,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "facebook") {
    return (
      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1 py-0">
        Facebook
      </Badge>
    );
  }
  if (channel === "instagram") {
    return (
      <Badge variant="outline" className="text-[10px] bg-pink-50 text-pink-700 border-pink-200 gap-1 py-0">
        Instagram
      </Badge>
    );
  }
  if (channel === "google_business") {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 gap-1 py-0">
        Google Business
      </Badge>
    );
  }
  if (channel === "tv") {
    return (
      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-800 border-slate-300 gap-1 py-0">
        <Tv className="w-2.5 h-2.5" />
        Čakáreň TV
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 py-0">
      {channel}
    </Badge>
  );
}

export default function ContentQueuePage() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("review");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBriefText, setNewBriefText] = useState("");
  const [newAudience, setNewAudience] = useState("Všetci majitelia zvierat");
  const [newChannels, setNewChannels] = useState<string[]>(["facebook", "instagram"]);

  const [rejectingBriefId, setRejectingBriefId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const utils = trpc.useUtils();

  const briefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: statusFilter as any,
    limit: 50,
  });

  const pillarsQuery = trpc.extensions.automationContent.listPillars.useQuery();

  const createBriefMutation = trpc.extensions.automationContent.createBrief.useMutation({
    onSuccess: () => {
      setIsAddModalOpen(false);
      setNewBriefText("");
      utils.extensions.automationContent.listBriefs.invalidate();
      toast.success("Návrh obsahu bol zaradený do schvaľovacieho radu.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vytvoriť návrh.");
    },
  });

  const approveMutation = trpc.extensions.automationContent.approveBrief.useMutation({
    onSuccess: () => {
      utils.extensions.automationContent.listBriefs.invalidate();
      toast.success("Obsah bol úspešne schválený veterinárom a pripravený na publikovanie.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa schváliť obsah.");
    },
  });

  const rejectMutation = trpc.extensions.automationContent.rejectBrief.useMutation({
    onSuccess: () => {
      setRejectingBriefId(null);
      setRejectNote("");
      utils.extensions.automationContent.listBriefs.invalidate();
      toast.success("Návrh obsahu bol zamietnutý.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zamietnuť návrh.");
    },
  });

  const briefs = briefsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            {t("marketing.contentQueue.title", "Schvaľovanie obsahu & Content Queue")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t(
              "marketing.contentQueue.description",
              "Fronta AI-generovaných a plánovaných príspevkov na sociálne siete kliniky. Každé klinické tvrdenie vyžaduje pred zverejnením veterinárne schválenie (Zákon 39/2007 Z. z.)."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => briefsQuery.refetch()}
            disabled={briefsQuery.isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${briefsQuery.isFetching ? "animate-spin" : ""}`} />
            {t("common.refresh", "Obnoviť")}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("marketing.contentQueue.addBrief", "Nový návrh príspevku")}
          </Button>
        </div>
      </div>

      {/* Statutory Guardrail Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-900 dark:text-amber-300">
            {t("marketing.contentQueue.statutoryTitle", "Veterinárny dozor nad obsahom (Zákon 39/2007 Z. z.)")}
          </div>
          <p className="text-amber-800/90 dark:text-amber-400 leading-relaxed">
            {t(
              "marketing.contentQueue.statutoryBody",
              "Akékoľvek odporúčania týkajúce sa prevencie, dávkovania liečiv alebo liečebných postupov v sociálnych príspevkoch musia byť explicitne autorizované veterinárnym lekárom s uvedením mena schvaľovateľa."
            )}
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/40 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter("review")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            statusFilter === "review"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold"
              : "text-muted-foreground hover:text-amber-700"
          }`}
        >
          Na schválenie
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            statusFilter === "pending"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Čakajúce na generovanie
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("approved")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            statusFilter === "approved"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
              : "text-muted-foreground hover:text-emerald-700"
          }`}
        >
          Schválené
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("rejected")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            statusFilter === "rejected"
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold"
              : "text-muted-foreground hover:text-rose-700"
          }`}
        >
          Zamietnuté
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            statusFilter === "all"
              ? "bg-background text-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Všetky
        </button>
      </div>

      {/* Briefs Grid / Cards */}
      {briefsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ) : briefs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground space-y-3 bg-card/50">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">
            Žiadne návrhy obsahu v tomto stave.
          </p>
          <p className="text-xs">
            Všetky príspevky boli schválené alebo vygenerované. Môžete pridať nový návrh kliknutím na tlačidlo vyššie.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {briefs.map((brief) => {
            const hasClinicalClaims =
              Array.isArray(brief.clinicalClaims) && brief.clinicalClaims.length > 0;
            const isApproved = brief.status === "approved";
            const isRejected = brief.status === "rejected";

            return (
              <div
                key={brief.id}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-foreground">
                          {brief.pillarTitle ? `Pilier: ${brief.pillarTitle}` : "Všeobecný príspevok"}
                        </span>
                        {brief.status === "review" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                            Vyžaduje schválenie
                          </Badge>
                        )}
                        {isApproved && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                            Schválené
                          </Badge>
                        )}
                        {isRejected && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-[10px]">
                            Zamietnuté
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Cieľ: {brief.targetAudience}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {brief.targetChannels.map((ch) => (
                        <ChannelIcon key={ch} channel={ch} />
                      ))}
                    </div>
                  </div>

                  {/* Brief Instruction */}
                  <div className="text-xs text-foreground/90 bg-muted/20 p-3 rounded-lg border border-border/40 leading-relaxed whitespace-pre-wrap">
                    {brief.briefText}
                  </div>

                  {/* Clinical Claims Alert Box */}
                  {hasClinicalClaims && (
                    <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 rounded-lg p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Klinické tvrdenia (overenie veterinárom):
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-400 text-[11px]">
                        {brief.clinicalClaims.map((claim: any, idx: number) => (
                          <li key={idx}>
                            <span className="font-medium">[{claim.kind}]:</span> "{claim.claim}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Review Audit Details */}
                  {brief.reviewedAt && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Schválil: {brief.reviewerName ?? "Veterinár"} ({new Date(brief.reviewedAt).toLocaleDateString("sk-SK")})
                      {brief.reviewNote && <span className="italic">— "{brief.reviewNote}"</span>}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t flex items-center justify-end gap-2">
                  {brief.status === "review" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingBriefId(brief.id);
                          setRejectNote("");
                        }}
                        className="text-xs h-8 text-rose-700 hover:text-rose-800"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Zamietnuť
                      </Button>
                      <Button
                        size="sm"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ id: brief.id })}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        {approveMutation.isPending && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <Check className="w-3 h-3" />
                        Schváliť publikovanie
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Brief Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Nový návrh príspevku do fronty
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Inštrukcia pre príspevok / AI námet:
                </label>
                <Textarea
                  rows={4}
                  value={newBriefText}
                  onChange={(e) => setNewBriefText(e.target.value)}
                  placeholder="Napr.: Jarné varovanie pred kliešťami a babeziózou. Odporučiť pipety a obojky s ochrannou lehotou..."
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Cieľová skupina:
                </label>
                <Input
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs"
              >
                Zrušiť
              </Button>
              <Button
                size="sm"
                disabled={!newBriefText.trim() || createBriefMutation.isPending}
                onClick={() =>
                  createBriefMutation.mutate({
                    briefText: newBriefText.trim(),
                    targetAudience: newAudience.trim(),
                    targetChannels: newChannels,
                  })
                }
                className="text-xs gap-1"
              >
                {createBriefMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Zaradiť do fronty
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingBriefId && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h2 className="font-bold text-base text-foreground">
              Dôvod zamietnutia návrhu
            </h2>
            <Textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Uveďte dôvod zamietnutia alebo korekciu pre marketing..."
              className="text-xs"
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingBriefId(null)}
                className="text-xs"
              >
                Zrušiť
              </Button>
              <Button
                size="sm"
                disabled={!rejectNote.trim() || rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    id: rejectingBriefId,
                    reviewNote: rejectNote.trim(),
                  })
                }
                className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Potvrdiť zamietnutie
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
