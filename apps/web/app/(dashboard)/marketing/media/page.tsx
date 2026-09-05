"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  ImagePlus,
  Video,
  Palette,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Plus,
  Filter,
  Loader2,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MediaKind = "photo" | "brand_graphic" | "video" | "illustration" | "all";
type ConsentFilter = "all" | "valid" | "missing" | "not_required";

export default function MediaLibraryPage() {
  const { t } = useI18n();
  const [kindFilter, setKindFilter] = useState<MediaKind>("all");
  const [consentFilter, setConsentFilter] = useState<ConsentFilter>("all");

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"photo" | "brand_graphic" | "video" | "illustration">("photo");
  const [caption, setCaption] = useState("");
  const [patientName, setPatientName] = useState("");
  const [subjectsPresent, setSubjectsPresent] = useState(false);
  const [consentId, setConsentId] = useState<string | undefined>(undefined);
  const [tagsInput, setTagsInput] = useState("");
  const [altText, setAltText] = useState("");
  const [isGeneratingAlt, setIsGeneratingAlt] = useState(false);

  const utils = trpc.useUtils();

  const mediaQuery = trpc.extensions.marketing.listMediaAssets.useQuery({
    kind: kindFilter,
    hasConsent: consentFilter,
  });

  const consentsQuery = trpc.extensions.marketing.listConsentCandidates.useQuery();

  const createMutation = trpc.extensions.marketing.createMediaAsset.useMutation({
    onSuccess: () => {
      toast.success("Médium bolo úspešne pridané");
      setIsUploadOpen(false);
      resetForm();
      utils.extensions.marketing.listMediaAssets.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa pridať médium");
    },
  });

  const deleteMutation = trpc.extensions.marketing.deleteMediaAsset.useMutation({
    onSuccess: () => {
      toast.success("Médium bolo zmazané");
      utils.extensions.marketing.listMediaAssets.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmazať médium");
    },
  });

  const suggestAltMutation = trpc.extensions.marketing.suggestMediaAltText.useMutation({
    onSuccess: (data) => {
      setAltText(data.altText);
      setIsGeneratingAlt(false);
      toast.success("Alt text bol vygenerovaný");
    },
    onError: (err) => {
      setIsGeneratingAlt(false);
      toast.error(err.message || "Nepodarilo sa navrhnúť alt text");
    },
  });

  const resetForm = () => {
    setUrl("");
    setKind("photo");
    setCaption("");
    setPatientName("");
    setSubjectsPresent(false);
    setConsentId(undefined);
    setTagsInput("");
    setAltText("");
  };

  const handleGenerateAlt = () => {
    setIsGeneratingAlt(true);
    suggestAltMutation.mutate({
      kind,
      caption: caption.trim() || undefined,
      patientName: patientName.trim() || undefined,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Zadajte URL adresu média");
      return;
    }
    if (subjectsPresent && !consentId) {
      toast.error("Pre médium s pacientom/majiteľom je povinné vybrať platný GDPR súhlas");
      return;
    }

    createMutation.mutate({
      url: url.trim(),
      kind,
      caption: caption.trim() || undefined,
      altText: altText.trim() || undefined,
      patientName: patientName.trim() || undefined,
      subjectsPresent,
      consentId: subjectsPresent ? consentId : undefined,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  const assets = mediaQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            {t("marketing.media.title", "Knižnica médií a grafiky")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(
              "marketing.media.description",
              "Správa fotografií, videí a vizuálnych podkladov s prísnou kontrolou GDPR súhlasov."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/marketing/consents">
            <Button variant="outline" size="sm" className="gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {t("marketing.media.manageConsents", "Spravovať GDPR súhlasy")}
            </Button>
          </Link>

          <Button size="sm" className="gap-2" onClick={() => setIsUploadOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("marketing.media.addMedia", "Pridať médium")}
          </Button>
        </div>
      </div>

      {/* Upload Modal Dialog */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b">
              <div>
                <h3 className="font-bold text-lg">{t("marketing.media.newAssetTitle", "Pridať nové médium do knižnice")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    "marketing.media.newAssetDesc",
                    "Zadajte odkaz na fotografiu alebo grafiku. Ak médium zobrazuje pacienta, prepojte ho s GDPR súhlasom."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 py-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">{t("marketing.media.fieldKind", "Typ média")}</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="photo">Fotografia z ambulancie</option>
                  <option value="brand_graphic">Brandová grafika kliniky</option>
                  <option value="video">Krátke video / Reel</option>
                  <option value="illustration">Ilustrácia k prevencii</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="media-url" className="text-xs font-semibold">{t("marketing.media.fieldUrl", "URL adresa média (obrázok / video)")}</label>
                <Input
                  id="media-url"
                  placeholder="https://... napr. odkaz na cloudové úložisko"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                {url && (
                  <div className="mt-2 rounded-lg border overflow-hidden max-h-40 flex items-center justify-center bg-muted/30">
                    <img
                      src={url}
                      alt="Náhľad"
                      className="object-cover max-h-40 w-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="media-caption" className="text-xs font-semibold">{t("marketing.media.fieldCaption", "Popis / Pracovný názov")}</label>
                <Input
                  id="media-caption"
                  placeholder="Napr. Pes po stomatologickom zákroku"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>

              {/* GDPR Consent Switch */}
              <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-sm">
                      {t("marketing.media.fieldSubjectsPresent", "Zobrazuje pacienta alebo majiteľa")}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t("marketing.media.subjectsHelp", "Zákon a GDPR vyžadujú písomný súhlas pre verejné publikovanie.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={subjectsPresent}
                    onClick={() => setSubjectsPresent(!subjectsPresent)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      subjectsPresent ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                        subjectsPresent ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {subjectsPresent && (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="space-y-1.5">
                      <label htmlFor="patient-name" className="text-xs font-semibold">Meno pacienta / zvieratka</label>
                      <Input
                        id="patient-name"
                        placeholder="Napr. Blesk"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Prepojený GDPR súhlas</label>
                      <select
                        value={consentId ?? ""}
                        onChange={(e) => setConsentId(e.target.value || undefined)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">-- Vyberte platný súhlas klienta --</option>
                        {(consentsQuery.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.clientName} ({c.patientName}) – {c.scope}
                          </option>
                        ))}
                      </select>
                      {(consentsQuery.data ?? []).length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Žiadne aktívne súhlasy. Vytvorte súhlas v sekcii <Link href="/marketing/consents" className="underline font-semibold">Súhlasy (GDPR)</Link>.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="media-tags" className="text-xs font-semibold">{t("marketing.media.fieldTags", "Značky (oddelené čiarkou)")}</label>
                <Input
                  id="media-tags"
                  placeholder="pes, stomatologia, prevencia, jar"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="media-alt" className="text-xs font-semibold">{t("marketing.media.fieldAlt", "Alt text (pre prístupnosť a SEO)")}</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={handleGenerateAlt}
                    disabled={isGeneratingAlt}
                  >
                    {isGeneratingAlt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {t("marketing.media.suggestAlt", "Navrhnúť AI")}
                  </Button>
                </div>
                <Textarea
                  id="media-alt"
                  rows={2}
                  placeholder="Popis obrázka pre nevidiacich a vyhľadávače..."
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  {t("common.cancel", "Zrušiť")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("marketing.media.saveAsset", "Uložiť médium")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border bg-card">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-2">
          <Filter className="h-3.5 w-3.5" />
          Filtrovať:
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              ["all", "Všetky formáty"],
              ["photo", "Fotografie"],
              ["brand_graphic", "Grafika"],
              ["video", "Videá"],
              ["illustration", "Ilustrácie"],
            ] as [MediaKind, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={kindFilter === val ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs rounded-full"
              onClick={() => setKindFilter(val)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1 hidden md:block" />

        <div className="flex items-center gap-1">
          {(
            [
              ["all", "Všetky stavy súhlasu"],
              ["valid", "Súhlas overený"],
              ["missing", "Chýba súhlas"],
              ["not_required", "Všeobecné"],
            ] as [ConsentFilter, string][]
          ).map(([val, label]) => (
            <Button
              key={val}
              variant={consentFilter === val ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-full"
              onClick={() => setConsentFilter(val)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {mediaQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 h-64 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <ImagePlus className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">{t("marketing.media.noMediaTitle", "Žiadne médiá v knižnici")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t(
              "marketing.media.noMediaDesc",
              "V knižnici zatiaľ nemáte žiadne fotografie ani grafiku. Pridajte prvé médium a bezpečne ho používajte v príspevkoch."
            )}
          </p>
          <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("marketing.media.addFirstMedia", "Nahrať prvé médium")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {assets.map(({ asset, consent }) => {
            const hasConsentValid = consent && !consent.revokedAt;
            const needsConsent = asset.subjectsPresent;

            return (
              <div
                key={asset.id}
                className="group relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Media Image Thumbnail */}
                <div className="relative aspect-video w-full bg-muted/40 overflow-hidden flex items-center justify-center">
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={asset.altText || asset.caption || "Médium"}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                  )}

                  {/* Kind badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs bg-background/90 backdrop-blur-sm shadow-sm capitalize">
                      {asset.kind === "photo" && <ImageIcon className="h-3 w-3 mr-1" />}
                      {asset.kind === "video" && <Video className="h-3 w-3 mr-1" />}
                      {asset.kind === "brand_graphic" && <Palette className="h-3 w-3 mr-1" />}
                      {asset.kind === "illustration" && <Sparkles className="h-3 w-3 mr-1" />}
                      {asset.kind === "photo" ? "Foto" : asset.kind === "video" ? "Video" : asset.kind === "brand_graphic" ? "Grafika" : "Ilustrácia"}
                    </Badge>
                  </div>

                  {/* GDPR Badge */}
                  <div className="absolute top-2 right-2">
                    {needsConsent && hasConsentValid ? (
                      <Badge className="bg-emerald-600/90 text-white text-xs gap-1 shadow-sm backdrop-blur-sm">
                        <ShieldCheck className="h-3 w-3" />
                        GDPR Súhlas
                      </Badge>
                    ) : needsConsent && !hasConsentValid ? (
                      <Badge variant="destructive" className="text-xs gap-1 shadow-sm backdrop-blur-sm">
                        <ShieldAlert className="h-3 w-3" />
                        Chýba súhlas
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur-sm">
                        Všeobecné
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-sm line-clamp-1">
                      {asset.caption || (asset.patientName ? `Pacient: ${asset.patientName}` : "Bez popisu")}
                    </h4>

                    {asset.altText && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        „{asset.altText}“
                      </p>
                    )}

                    {/* Tags */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(asset.createdAt).toLocaleDateString("sk-SK")}
                    </span>

                    <div className="flex items-center gap-1">
                      <Link href={`/marketing/plan?mediaId=${asset.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 text-primary hover:text-primary"
                          title="Použiť v príspevku"
                        >
                          Použiť
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Naozaj chcete odstrániť toto médium z knižnice?")) {
                            deleteMutation.mutate({ id: asset.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
