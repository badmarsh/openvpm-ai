"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Stethoscope,
  Globe,
  Share2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  UserCheck,
  AlertCircle,
  Loader2,
  HeartHandshake,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import {
  formatDateToDisplay,
  formatDateTimeToDisplay,
} from "@/lib/date-display";
import {
  VeterinarianReviewModal,
  type ReviewBriefData,
} from "./veterinarian-review-modal";

type QueueStatusFilter = "all" | "review" | "approved" | "rejected" | "pending";

export function SocialApprovalQueueTab() {
  const { t } = useI18n();

  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("review");
  const [selectedBrief, setSelectedBrief] = useState<ReviewBriefData | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const briefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: statusFilter,
    limit: 50,
  });

  // Query all briefs to get accurate tab badge counters
  const allBriefsQuery = trpc.extensions.automationContent.listBriefs.useQuery({
    status: "all",
    limit: 100,
  });

  const channelsQuery = trpc.extensions.automationChannels.list.useQuery();
  const brandKitQuery = trpc.settings.getBrandKit.useQuery();
  const clinicName = brandKitQuery.data?.clinicName || "";
  const hashtagLine = (brandKitQuery.data?.defaultHashtags ?? []).join(" ");

  const briefs = (briefsQuery.data || []) as ReviewBriefData[];
  const allBriefs = (allBriefsQuery.data || []) as ReviewBriefData[];
  const channels = channelsQuery.data || [];

  const pendingReviewCount = allBriefs.filter(
    (b) => b.status === "review"
  ).length;

  const handleOpenReview = (brief: ReviewBriefData) => {
    setSelectedBrief(brief);
    setReviewModalOpen(true);
  };

  const handleCopyChannelText = (
    brief: ReviewBriefData,
    channel: "facebook" | "instagram" | "google_business"
  ) => {
    let formattedText = brief.briefText;

    if (channel === "instagram") {
      formattedText = hashtagLine
        ? `${brief.briefText}\n\n.\n.\n🐾 ${hashtagLine}`
        : brief.briefText;
    } else if (channel === "facebook") {
      formattedText = clinicName
        ? `${brief.briefText}\n\n📍 ${clinicName}`
        : brief.briefText;
    } else if (channel === "google_business") {
      formattedText = `${brief.briefText}\n\n📞 ${t(
        "marketing.queue.copyGoogleCta",
        "Rezervácie a informácie na našej klinike."
      )}`;
    }

    navigator.clipboard.writeText(formattedText);
    setCopiedId(`${brief.id}-${channel}`);
    toast.success(
      t(
        "marketing.queue.copiedToast",
        "Text príspevku bol skopírovaný do schránky."
      )
    );

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const getClaimKindLabel = (kind: string) => {
    const map: Record<string, string> = {
      dosage: t("marketing.claimsKinds.dosage", "Dávkovanie liečiva"),
      diagnosis: t("marketing.claimsKinds.diagnosis", "Diagnostika & symptómy"),
      prognosis: t("marketing.claimsKinds.prognosis", "Prognóza ochorenia"),
      lab_interpretation: t(
        "marketing.claimsKinds.lab_interpretation",
        "Interpretácia laboratórnych testov"
      ),
      prevention_efficacy: t(
        "marketing.claimsKinds.prevention_efficacy",
        "Účinnosť prevencie"
      ),
      other: t("marketing.claimsKinds.other", "Iné klinické odporúčanie"),
    };
    return map[kind] || kind;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              {t("marketing.queue.pageTitle", "Schvaľovací proces obsahu")}
            </h1>
            <Badge variant="outline" className="text-[11px] gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
              <ShieldCheck className="h-3 w-3" />
              {t("marketing.queue.statutoryBadge", "KVL SR Overenie")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "marketing.queue.pageSubtitle",
              "Zákonná autorizácia a podpis veterinárneho lekára (Zákon 39/2007 Z. z. §3)"
            )}
          </p>
        </div>

        {/* Sympathy Gate Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 border rounded-lg px-3 py-1.5">
          <HeartHandshake className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          <span className="hidden sm:inline">
            {t(
              "marketing.queue.sympathyGateActive",
              "Protokol súcitu (Sympathy Gate) aktívny — marketing je izolovaný od zosnulých pacientov."
            )}
          </span>
          <span className="sm:hidden">{t("marketing.queue.sympathyGateShort", "Sympathy Gate aktívny")}</span>
        </div>
      </div>

      {/* Connected Channels Status Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            {t(
              "marketing.queue.connectedChannelsTitle",
              "Pripojené publikačné kanály"
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              {t(
                "marketing.queue.connectedChannelsDesc",
                "Aktívne OAuth prepojenia na sociálne siete kliniky"
              )}
            </span>
            <Link href="/marketing/automations?tab=channels">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <ExternalLink className="h-3 w-3" />
                {t("marketing.queue.manageChannelsShort", "Spravovať")}
              </Button>
            </Link>
          </div>
        </div>

        {channels.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <p className="text-xs text-muted-foreground">
              {t(
                "marketing.queue.noChannelsDesc",
                "Zatiaľ nie je pripojený žiadny publikačný kanál. Pripojte Facebook, Instagram alebo Google profil, aby ste mohli publikovať schválený obsah."
              )}
            </p>
            <Link href="/marketing/automations?tab=channels" className="shrink-0">
              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                {t("marketing.queue.manageChannels", "Pripojiť kanály")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {channels.map((channel) => {
            const isConnected = channel.status === "connected";
            const providerName =
              channel.provider === "google_business"
                ? t("marketing.queue.providerGoogle", "Google Firemný Profil")
                : channel.provider === "facebook"
                  ? t("marketing.queue.providerFacebook", "Facebook Stránka")
                  : channel.provider === "instagram"
                    ? t("marketing.queue.providerInstagram", "Instagram Feed")
                    : channel.provider;

            return (
              <div
                key={channel.id}
                className="border rounded-lg p-2.5 flex items-center justify-between gap-2 bg-background"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{providerName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {channel.displayName}
                  </p>
                </div>
                <Badge
                  variant={isConnected ? "default" : "outline"}
                  className={cn(
                    "text-[10px] shrink-0",
                    isConnected
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                      : "text-muted-foreground"
                  )}
                >
                  {isConnected
                    ? t("marketing.queue.channelConnected", "Pripojené")
                    : t("marketing.queue.channelDisconnected", "Odpojené")}
                </Badge>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="space-y-4">
        <div className="border-b pb-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter("review")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === "review"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{t("marketing.queue.tabReview", "Na schválenie lekárom")}</span>
            {pendingReviewCount > 0 && (
              <span className={cn(
                "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                statusFilter === "review" ? "bg-white text-amber-700" : "bg-amber-100 text-amber-800"
              )}>
                {pendingReviewCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <span>{t("marketing.queue.tabAll", "Všetky")}</span>
            <span className="text-[10px] opacity-75">({allBriefs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === "approved"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t("marketing.queue.tabApproved", "Schválené")}</span>
            <span className="text-[10px] opacity-75">
              ({allBriefs.filter((b) => b.status === "approved").length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === "rejected"
                ? "bg-destructive text-destructive-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>{t("marketing.queue.tabRejected", "Zamietnuté")}</span>
            <span className="text-[10px] opacity-75">
              ({allBriefs.filter((b) => b.status === "rejected").length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              statusFilter === "pending"
                ? "bg-secondary text-secondary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <span>{t("marketing.queue.tabPending", "Koncepty")}</span>
            <span className="text-[10px] opacity-75">
              ({allBriefs.filter((b) => b.status === "pending").length})
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {briefsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : briefs.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl border border-dashed bg-card p-12 text-center space-y-2">
            <ShieldCheck className="h-9 w-9 text-emerald-600/50 mx-auto" />
            <h3 className="font-semibold text-sm">
              {statusFilter === "review"
                ? t(
                    "marketing.queue.emptyReview",
                    "Žiadne návrhy nečakajú na schválenie. Všetok klinický obsah je skontrolovaný."
                  )
                : statusFilter === "approved"
                ? t(
                    "marketing.queue.emptyApproved",
                    "Zatiaľ žiadne schválené príspevky."
                  )
                : statusFilter === "rejected"
                ? t(
                    "marketing.queue.emptyRejected",
                    "Žiadne zamietnuté príspevky."
                  )
                : t(
                    "marketing.queue.emptyAll",
                    "Zatiaľ neboli vytvorené žiadne návrhy obsahu."
                  )}
            </h3>
          </div>
        ) : (
          /* Briefs Queue Cards */
          <div className="space-y-4">
            {briefs.map((brief) => {
              const claims = brief.clinicalClaims || [];
              const hasClaims = claims.length > 0;
              const isApproved = brief.status === "approved";
              const isRejected = brief.status === "rejected";
              const isPending = brief.status === "review" || brief.status === "pending";

              return (
                <div
                  key={brief.id}
                  className={cn(
                    "rounded-xl border bg-card p-5 shadow-xs transition-all space-y-4",
                    hasClaims && isPending && "border-amber-400 bg-amber-50/15 dark:bg-amber-950/10"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {brief.pillarTitle || "Všeobecný pilier"}
                      </Badge>

                      {brief.targetChannels?.map((ch) => (
                        <Badge
                          key={ch}
                          variant="secondary"
                          className="text-[10px] uppercase font-mono"
                        >
                          {ch === "google_business"
                            ? "Google Profil"
                            : ch === "facebook"
                            ? "Facebook"
                            : ch === "instagram"
                            ? "Instagram"
                            : ch}
                        </Badge>
                      ))}

                      {hasClaims && (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 text-[10px]">
                          <Stethoscope className="h-3 w-3 mr-1" />
                          {claims.length} {t("marketing.calendar.claimsBadge", "Klinické tvrdenia")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {brief.status === "review" && (
                        <Badge className="bg-amber-500 text-white text-xs">
                          {t("marketing.calendar.statusReview", "Čaká na lekára")}
                        </Badge>
                      )}
                      {brief.status === "approved" && (
                        <Badge className="bg-emerald-600 text-white text-xs">
                          {t("marketing.calendar.statusApproved", "Schválené")}
                        </Badge>
                      )}
                      {brief.status === "rejected" && (
                        <Badge variant="destructive" className="text-xs">
                          {t("marketing.calendar.statusRejected", "Vrátené")}
                        </Badge>
                      )}
                      {brief.status === "pending" && (
                        <Badge variant="outline" className="text-xs">
                          {t("marketing.calendar.statusScheduled", "Plán")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Brief Content Preview */}
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {brief.briefText}
                    </p>
                  </div>

                  {/* Highlighted Clinical Claims Box (Zákon 39/2007 Z. z.) */}
                  {hasClaims && (
                    <div className="border border-amber-300 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                        <Stethoscope className="h-3.5 w-3.5 text-amber-600" />
                        <span>
                          {t(
                            "marketing.queue.clinicalClaimsAlert",
                            "Obsahuje klinické tvrdenia vyžadujúce podpis veterinára (Zákon 39/2007 Z. z. §3)"
                          )}
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-5 border-l-2 border-amber-400">
                        {claims.map((claim, idx) => (
                          <div key={idx} className="text-xs space-y-0.5">
                            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                              [{getClaimKindLabel(claim.kind)}]
                            </span>{" "}
                            <span className="italic font-medium text-foreground">
                              „{claim.claim}“
                            </span>
                            {claim.sourceRef && (
                              <span className="text-[10px] text-muted-foreground ml-1.5">
                                ({claim.sourceRef})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Audit Record (if already reviewed) */}
                  {(brief.reviewedBy || brief.reviewNote) && (
                    <div className="border rounded-lg p-2.5 text-xs bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-emerald-600" />
                          {t("marketing.queue.reviewedByLabel", "Posúdil")}:{" "}
                          <strong className="text-foreground">
                            {brief.reviewerName || "Veterinárny lekár"}
                          </strong>
                        </span>
                        {brief.reviewedAt && (
                          <span className="tabular-nums">
                            {formatDateTimeToDisplay(brief.reviewedAt)}
                          </span>
                        )}
                      </div>
                      {brief.reviewNote && (
                        <p className="text-xs text-foreground italic pl-4 border-l-2 border-primary/40">
                          „{brief.reviewNote}“
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatDateToDisplay(brief.createdAt)}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* One-Click Review Button */}
                      <Button
                        size="sm"
                        onClick={() => handleOpenReview(brief)}
                        className={cn(
                          "text-xs gap-1.5",
                          isPending && "bg-primary text-primary-foreground"
                        )}
                        variant={isPending ? "default" : "outline"}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>
                          {isPending
                            ? t("marketing.queue.actionReview", "Posúdiť a autorizovať")
                            : t("marketing.queue.actionView", "Zobraziť detail")}
                        </span>
                      </Button>

                      {/* Quick Publishing Dropdown (if approved) */}
                      {isApproved && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="text-xs gap-1.5">
                              <Share2 className="h-3.5 w-3.5" />
                              <span>
                                {t("marketing.queue.actionPublish", "Rýchle publikovanie")}
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 text-xs">
                            <DropdownMenuLabel className="text-xs">
                              {t("marketing.queue.copyChannelTitle", "Kopírovať text pre kanál")}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCopyChannelText(brief, "facebook")}
                              className="text-xs cursor-pointer gap-2"
                            >
                              {copiedId === `${brief.id}-facebook` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {t("marketing.queue.copyFacebook", "Kopírovať pre Facebook")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopyChannelText(brief, "instagram")}
                              className="text-xs cursor-pointer gap-2"
                            >
                              {copiedId === `${brief.id}-instagram` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {t("marketing.queue.copyInstagram", "Kopírovať pre Instagram")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleCopyChannelText(brief, "google_business")
                              }
                              className="text-xs cursor-pointer gap-2"
                            >
                              {copiedId === `${brief.id}-google_business` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {t(
                                "marketing.queue.copyGoogle",
                                "Kopírovať pre Google Profil"
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Veterinarian Review Modal */}
      <VeterinarianReviewModal
        brief={selectedBrief}
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
      />
    </div>
  );
}
