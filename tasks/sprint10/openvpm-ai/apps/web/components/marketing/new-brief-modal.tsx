"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  ShieldAlert,
  Loader2,
  Calendar as CalendarIcon,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";

export interface PillarOption {
  id: string;
  pillarKey: string;
  title: string;
  description: string;
  voiceGuidance: string;
}

interface NewBriefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pillars: PillarOption[];
  defaultScheduledDate?: string;
  onSuccess?: () => void;
}

type ClaimKind =
  | "dosage"
  | "diagnosis"
  | "prognosis"
  | "lab_interpretation"
  | "prevention_efficacy"
  | "other";

interface ClinicalClaimDraft {
  claim: string;
  kind: ClaimKind;
  sourceRef: string;
}

const AVAILABLE_CHANNELS = [
  { id: "google_business", label: "Google Business Profile" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

export function NewBriefModal({
  open,
  onOpenChange,
  pillars,
  defaultScheduledDate,
  onSuccess,
}: NewBriefModalProps) {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [selectedPillarId, setSelectedPillarId] = useState<string>(
    pillars[0]?.id || ""
  );
  const [briefText, setBriefText] = useState("");
  const [targetAudience, setTargetAudience] = useState(
    "Všetci majitelia psov a mačiek"
  );
  const [scheduledDate, setScheduledDate] = useState<string>(
    defaultScheduledDate || new Date().toISOString().slice(0, 10)
  );
  const [targetChannels, setTargetChannels] = useState<string[]>([
    "facebook",
    "instagram",
  ]);
  const [clinicalClaims, setClinicalClaims] = useState<ClinicalClaimDraft[]>([]);

  const createBriefMutation =
    trpc.extensions.automationContent.createBrief.useMutation({
      onSuccess: () => {
        toast.success(
          t(
            "marketing.briefModal.successToast",
            "Návrh obsahu bol úspešne vytvorený."
          )
        );
        utils.extensions.automationContent.listBriefs.invalidate();
        handleClose();
        if (onSuccess) onSuccess();
      },
      onError: (err) => {
        toast.error(
          err.message ||
            t(
              "marketing.briefModal.errorToast",
              "Nepodarilo sa vytvoriť návrh obsahu."
            )
        );
      },
    });

  const handleClose = () => {
    setBriefText("");
    setClinicalClaims([]);
    onOpenChange(false);
  };

  const handleToggleChannel = (channelId: string) => {
    setTargetChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleAddClaim = () => {
    setClinicalClaims((prev) => [
      ...prev,
      { claim: "", kind: "dosage", sourceRef: "" },
    ]);
  };

  const handleRemoveClaim = (index: number) => {
    setClinicalClaims((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateClaim = (
    index: number,
    field: keyof ClinicalClaimDraft,
    value: string
  ) => {
    setClinicalClaims((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (briefText.trim().length < 5) return;

    // Filter out completely blank claims
    const validClaims = clinicalClaims
      .filter((c) => c.claim.trim().length > 0)
      .map((c) => ({
        claim: c.claim.trim(),
        kind: c.kind,
        sourceRef: c.sourceRef.trim() || undefined,
      }));

    createBriefMutation.mutate({
      pillarId: selectedPillarId || undefined,
      briefText: briefText.trim(),
      targetChannels: targetChannels.length > 0 ? targetChannels : ["facebook"],
      targetAudience: targetAudience.trim() || "Všetci majitelia zvierat",
      scheduledDate: scheduledDate || undefined,
      clinicalClaims: validClaims,
    });
  };

  const hasClaims = clinicalClaims.some((c) => c.claim.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {t("marketing.briefModal.title", "Nový návrh obsahu")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t(
              "marketing.briefModal.description",
              "Vytvorte návrh príspevku pre sociálne siete. Ak príspevok obsahuje klinické tvrdenia (dávkovanie, indikácie, prevenciu), bude vyžadovať schválenie veterinárnym lekárom."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Pillar Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="pillar-select" className="text-xs font-semibold">
              {t("marketing.briefModal.pillarLabel", "Strategický pilier")}
            </Label>
            <Select
              value={selectedPillarId}
              onValueChange={(val) => setSelectedPillarId(val)}
            >
              <SelectTrigger id="pillar-select" className="text-xs">
                <SelectValue
                  placeholder={t(
                    "marketing.briefModal.selectPillarPlaceholder",
                    "Vyberte pilier obsahu…"
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {pillars.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{p.title}</span>
                      {p.description && (
                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                          {p.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brief Text / Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="brief-text" className="text-xs font-semibold">
                {t(
                  "marketing.briefModal.briefTextLabel",
                  "Text príspevku / inštrukcia"
                )}
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {briefText.length}/2000
              </span>
            </div>
            <Textarea
              id="brief-text"
              rows={4}
              maxLength={2000}
              placeholder={t(
                "marketing.briefModal.briefTextPlaceholder",
                "Napr. 'Sezóna kliešťov vrcholí! Pripravili sme pre vás prehľad najúčinnejších antiparazitík na mieru pre vášho psa…'"
              )}
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              className="text-xs resize-y"
              required
            />
          </div>

          {/* Target Channels & Scheduled Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {t(
                  "marketing.briefModal.targetChannelsLabel",
                  "Cieľové kanály"
                )}
              </Label>
              <div className="space-y-2">
                {AVAILABLE_CHANNELS.map((ch) => (
                  <div key={ch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`channel-${ch.id}`}
                      checked={targetChannels.includes(ch.id)}
                      onChange={() => handleToggleChannel(ch.id)}
                    />
                    <label
                      htmlFor={`channel-${ch.id}`}
                      className="text-xs cursor-pointer select-none"
                    >
                      {ch.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="scheduled-date" className="text-xs font-semibold">
                  {t(
                    "marketing.briefModal.scheduledDateLabel",
                    "Plánovaný dátum zverejnenia"
                  )}
                </Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target-audience" className="text-xs font-semibold">
                  {t(
                    "marketing.briefModal.targetAudienceLabel",
                    "Cieľová skupina"
                  )}
                </Label>
                <Input
                  id="target-audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder={t(
                    "marketing.briefModal.targetAudiencePlaceholder",
                    "Napr. Majitelia psov a mačiek"
                  )}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Clinical Claims Tagging Section */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold tracking-tight">
                  {t(
                    "marketing.briefModal.clinicalClaimsTitle",
                    "Klinické tvrdenia a indikácie (Zákon 39/2007 Z. z.)"
                  )}
                </h4>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddClaim}
                className="h-7 text-[11px] gap-1"
              >
                <Plus className="h-3 w-3" />
                {t(
                  "marketing.briefModal.addClaimButton",
                  "Pridať klinické tvrdenie"
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t(
                "marketing.briefModal.clinicalClaimsDesc",
                "Označte konkrétne tvrdenia o liečivách, dávkovaní alebo prevencii, ktoré musí lekár autorizovať."
              )}
            </p>

            {clinicalClaims.length > 0 && (
              <div className="space-y-2.5 pt-1">
                {clinicalClaims.map((claimDraft, idx) => (
                  <div
                    key={idx}
                    className="border rounded-md p-2.5 bg-background space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          {t(
                            "marketing.briefModal.claimTextLabel",
                            "Presné znenie tvrdenia"
                          )}
                        </Label>
                        <Input
                          value={claimDraft.claim}
                          onChange={(e) =>
                            handleUpdateClaim(idx, "claim", e.target.value)
                          }
                          placeholder={t(
                            "marketing.briefModal.claimTextPlaceholder",
                            "Napr. 'Dávkovanie Bravecto žuvacích tabliet každých 12 týždňov podľa hmotnosti…'"
                          )}
                          className="text-xs h-7"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveClaim(idx)}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                        title={t(
                          "marketing.briefModal.removeClaimButton",
                          "Odstrániť tvrdenie"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          {t(
                            "marketing.briefModal.claimKindLabel",
                            "Kategória tvrdenia"
                          )}
                        </Label>
                        <Select
                          value={claimDraft.kind}
                          onValueChange={(val) =>
                            handleUpdateClaim(idx, "kind", val as ClaimKind)
                          }
                        >
                          <SelectTrigger className="text-xs h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dosage" className="text-xs">
                              {t("marketing.claimsKinds.dosage", "Dávkovanie liečiva")}
                            </SelectItem>
                            <SelectItem value="diagnosis" className="text-xs">
                              {t(
                                "marketing.claimsKinds.diagnosis",
                                "Diagnostika & symptómy"
                              )}
                            </SelectItem>
                            <SelectItem value="prognosis" className="text-xs">
                              {t(
                                "marketing.claimsKinds.prognosis",
                                "Prognóza ochorenia"
                              )}
                            </SelectItem>
                            <SelectItem
                              value="lab_interpretation"
                              className="text-xs"
                            >
                              {t(
                                "marketing.claimsKinds.lab_interpretation",
                                "Interpretácia laboratórnych testov"
                              )}
                            </SelectItem>
                            <SelectItem
                              value="prevention_efficacy"
                              className="text-xs"
                            >
                              {t(
                                "marketing.claimsKinds.prevention_efficacy",
                                "Účinnosť prevencie"
                              )}
                            </SelectItem>
                            <SelectItem value="other" className="text-xs">
                              {t(
                                "marketing.claimsKinds.other",
                                "Iné klinické odporúčanie"
                              )}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          {t(
                            "marketing.briefModal.sourceRefLabel",
                            "Odborný zdroj / referencia (nepovinné)"
                          )}
                        </Label>
                        <Input
                          value={claimDraft.sourceRef}
                          onChange={(e) =>
                            handleUpdateClaim(idx, "sourceRef", e.target.value)
                          }
                          placeholder={t(
                            "marketing.briefModal.sourceRefPlaceholder",
                            "Napr. SPC lieku, ESCCAP smernica…"
                          )}
                          className="text-xs h-7"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasClaims && (
              <Alert className="border-amber-400 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 py-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <AlertDescription className="text-[11px] leading-relaxed">
                  {t(
                    "marketing.briefModal.statutoryWarning",
                    "Príspevok obsahuje klinické tvrdenia. V súlade so Zákonom 39/2007 Z. z. a Etickým kódexom KVL SR bude zaradený do schvaľovacieho procesu pre veterinárneho lekára."
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={createBriefMutation.isPending}
              className="text-xs"
            >
              {t("marketing.briefModal.cancel", "Zrušiť")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createBriefMutation.isPending || briefText.trim().length < 5}
              className="text-xs"
            >
              {createBriefMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {hasClaims
                ? t(
                    "marketing.briefModal.submitWithClaimsButton",
                    "Vytvoriť a odoslať na schválenie lekárom"
                  )
                : t(
                    "marketing.briefModal.submitButton",
                    "Vytvoriť návrh obsahu"
                  )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
