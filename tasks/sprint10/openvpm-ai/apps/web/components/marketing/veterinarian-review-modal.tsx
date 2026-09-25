"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Stethoscope,
  Globe,
  Users,
  FileText,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";

export interface ReviewBriefData {
  id: string;
  pillarId?: string | null;
  pillarTitle?: string | null;
  pillarKey?: string | null;
  briefText: string;
  targetChannels: string[];
  targetAudience: string;
  clinicalClaims: Array<{
    claim: string;
    kind: string;
    sourceRef?: string;
    verdict?: string;
    reviewerNote?: string;
  }>;
  status: string;
  generatedBy?: string | null;
  generatedAt?: Date | string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewedAt?: Date | string | null;
  reviewNote?: string | null;
  createdAt?: Date | string | null;
}

interface VeterinarianReviewModalProps {
  brief: ReviewBriefData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VeterinarianReviewModal({
  brief,
  open,
  onOpenChange,
  onSuccess,
}: VeterinarianReviewModalProps) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const [reviewNote, setReviewNote] = useState("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    if (brief?.reviewNote) {
      setReviewNote(brief.reviewNote);
    } else {
      setReviewNote("");
    }
    setNoteError("");
  }, [brief]);

  const isDoctor =
    session?.user?.role === "veterinarian" || session?.user?.role === "admin";

  const approveMutation =
    trpc.extensions.automationContent.approveBrief.useMutation({
      onSuccess: () => {
        toast.success(
          t(
            "marketing.reviewDrawer.approvedSuccessToast",
            "Príspevok bol úspešne schválený veterinárnym lekárom."
          )
        );
        utils.extensions.automationContent.listBriefs.invalidate();
        onOpenChange(false);
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const rejectMutation =
    trpc.extensions.automationContent.rejectBrief.useMutation({
      onSuccess: () => {
        toast.success(
          t(
            "marketing.reviewDrawer.rejectedSuccessToast",
            "Príspevok bol vrátený na úpravu so zadaným odôvodnením."
          )
        );
        utils.extensions.automationContent.listBriefs.invalidate();
        onOpenChange(false);
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  if (!brief) return null;

  const handleApprove = () => {
    approveMutation.mutate({
      id: brief.id,
      reviewNote: reviewNote.trim() || undefined,
    });
  };

  const handleReject = () => {
    if (reviewNote.trim().length < 3) {
      setNoteError(
        t(
          "marketing.reviewDrawer.rejectNoteRequiredError",
          "Pri zamietnutí je povinné uviesť odôvodnenie (minimálne 3 znaky)."
        )
      );
      return;
    }
    setNoteError("");
    rejectMutation.mutate({
      id: brief.id,
      reviewNote: reviewNote.trim(),
    });
  };

  const claimsCount = brief.clinicalClaims?.length || 0;
  const isPendingReview = brief.status === "review" || brief.status === "pending";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-1 text-left border-b pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <SheetTitle className="text-base font-bold">
              {t(
                "marketing.reviewDrawer.title",
                "Autorizácia klinického obsahu (KVL SR §3)"
              )}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {t(
              "marketing.reviewDrawer.subtitle",
              "Posúdenie súladu so správnou veterinárnou praxou a legislatívou SR"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Status & Pillar Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {brief.pillarTitle || t("marketing.calendar.allPillars", "Pilier")}
              </Badge>
              {claimsCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 text-xs">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  {t("marketing.reviewDrawer.claimsCount", `Klinické tvrdenia: ${claimsCount}`, {
                    count: claimsCount,
                  })}
                </Badge>
              )}
            </div>

            <div>
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
                <Badge variant="secondary" className="text-xs">
                  {t("marketing.calendar.statusScheduled", "Naplánované")}
                </Badge>
              )}
            </div>
          </div>

          {/* Full Brief Text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t("marketing.reviewDrawer.contentLabel", "Znenie príspevku")}
            </Label>
            <div className="p-3.5 rounded-lg border bg-muted/30 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {brief.briefText}
            </div>
          </div>

          {/* Target Channels & Audience */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border rounded-lg p-2.5 space-y-1 bg-background">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {t("marketing.reviewDrawer.channelsLabel", "Cieľové kanály")}
              </span>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {brief.targetChannels?.map((ch) => (
                  <Badge key={ch} variant="secondary" className="text-[10px]">
                    {ch.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-2.5 space-y-1 bg-background">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t("marketing.reviewDrawer.audienceLabel", "Cieľová skupina")}
              </span>
              <p className="text-xs font-medium truncate pt-0.5">
                {brief.targetAudience || "Všetci majitelia"}
              </p>
            </div>
          </div>

          {/* Clinical Claims Highlight Box */}
          {claimsCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-amber-600" />
                <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t(
                    "marketing.briefModal.clinicalClaimsTitle",
                    "Klinické tvrdenia a indikácie (Zákon 39/2007 Z. z.)"
                  )}
                </Label>
              </div>
              <div className="space-y-2">
                {brief.clinicalClaims.map((claimItem, i) => (
                  <div
                    key={i}
                    className="border-l-4 border-l-amber-500 border rounded-r-lg p-3 bg-amber-50/40 dark:bg-amber-950/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] bg-background">
                        {getClaimKindLabel(claimItem.kind)}
                      </Badge>
                      {claimItem.sourceRef && (
                        <span className="text-[10px] text-muted-foreground italic">
                          Zdroj: {claimItem.sourceRef}
                        </span>
                      )}
                    </div>
                    <blockquote className="text-xs font-medium italic text-foreground">
                      „{claimItem.claim}“
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statutory KVL SR Declaration */}
          <Alert className="border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 py-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <AlertDescription className="text-[11px] leading-relaxed">
              {t(
                "marketing.reviewDrawer.statutoryDeclaration",
                "Potvrdzujem ako veterinárny lekár, že obsah spĺňa etické a odborné požiadavky Komory veterinárnych lekárov SR a Zákona 39/2007 Z. z. o veterinárnej starostlivosti."
              )}
            </AlertDescription>
          </Alert>

          {/* Doctor Review Note Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="review-note" className="text-xs font-semibold">
                {t(
                  "marketing.reviewDrawer.reviewNoteLabel",
                  "Poznámka lekára (povinná pri zamietnutí)"
                )}
              </Label>
              {brief.reviewerName && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-emerald-600" />
                  {brief.reviewerName}
                </span>
              )}
            </div>
            <Textarea
              id="review-note"
              rows={3}
              value={reviewNote}
              onChange={(e) => {
                setReviewNote(e.target.value);
                if (noteError) setNoteError("");
              }}
              placeholder={
                isPendingReview
                  ? t(
                      "marketing.reviewDrawer.rejectNotePlaceholder",
                      "Dôvod zamietnutia a pokyny pre úpravu textu (povinné minimálne 3 znaky)…"
                    )
                  : ""
              }
              className="text-xs resize-y"
              disabled={!isDoctor}
            />
            {noteError && (
              <p className="text-[11px] text-destructive font-medium">{noteError}</p>
            )}
          </div>

          {/* Role restriction advisory if not vet or admin */}
          {!isDoctor && (
            <Alert className="border-rose-300 bg-rose-50/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 py-2">
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5" />
              <AlertDescription className="text-[11px]">
                {t(
                  "marketing.reviewDrawer.roleRestricted",
                  "Schválenie a zamietnutie klinického obsahu smie vykonať iba registrovaný veterinárny lekár alebo správca kliniky."
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="border-t pt-4 gap-2 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            {t("marketing.reviewDrawer.close", "Zatvoriť")}
          </Button>

          {isDoctor && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={rejectMutation.isPending || approveMutation.isPending}
                className="text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                )}
                {t(
                  "marketing.reviewDrawer.rejectButton",
                  "Zamietnuť / Vrátiť na úpravu"
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleApprove}
                disabled={rejectMutation.isPending || approveMutation.isPending}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                {t(
                  "marketing.reviewDrawer.approveButton",
                  "Schváliť ako veterinár"
                )}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
