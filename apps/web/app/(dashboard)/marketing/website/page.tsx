"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Users,
  FileText,
  Star,
  RefreshCw,
  Eye,
  ShieldCheck,
  CalendarCheck2,
  Smartphone,
  Monitor,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function MarketingWebsitePage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const configQuery = trpc.extensions.marketing.getWebsiteConfig.useQuery();
  const toggleMutation = trpc.extensions.marketing.toggleWebsite.useMutation({
    onSuccess: (data) => {
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      if (data.published) {
        toast.success("Webstránka kliniky bola úspešne publikovaná a je dostupná online!");
      } else {
        toast.info("Webstránka kliniky bola prepnutá do režimu konceptu (nepublikovaná).");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmeniť stav publikovania webstránky.");
    },
  });

  const config = configQuery.data;
  const publicUrl = typeof window !== "undefined" && config?.clinicId
    ? `${window.location.origin}/web/${config.clinicId}`
    : `/web/${config?.clinicId ?? ""}`;

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Odkaz na verejnú webstránku bol skopírovaný do schránky!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nepodarilo sa skopírovať odkaz.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("marketing.website.title", "Webstránka kliniky")}
            </h1>
            <Badge variant={config?.published ? "default" : "secondary"}>
              {config?.published
                ? t("marketing.website.statusPublished", "Online / Publikovaná")
                : t("marketing.website.statusDraft", "Príprava (Koncept)")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "marketing.website.subtitle",
              "Verejná reprezentatívna stránka generovaná priamo z údajov kliniky, ordinačných hodín a recenzií."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {config?.published && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1.5"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Skopírované" : "Kopírovať link"}
              </Button>
              <Link href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Otvoriť live
                </Button>
              </Link>
            </>
          )}

          <Button
            variant={config?.published ? "destructive" : "default"}
            size="sm"
            disabled={toggleMutation.isPending || configQuery.isLoading}
            onClick={() => toggleMutation.mutate()}
            className="gap-2"
          >
            {toggleMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            {config?.published ? "Skryť webstránku" : "Publikovať webstránku"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Stav stránky</span>
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.published ? "Aktívna" : "V príprave"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config?.published
              ? "Prístupná pre chovateľov a Google"
              : "Zatiaľ skrytá pred verejnosťou"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lekári a personál</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.teamCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            so súhlasom pre zverejnenie na webe
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Edukačné letáky</span>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.handoutsCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            verejne dostupných medicínskych návodov
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Overené recenzie</span>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.reviewsCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            5★ hodnotení Google a Facebook
          </p>
        </div>
      </div>

      {/* Feature Highlights Card */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-base font-bold text-foreground">
              Prečo mať webstránku generovanú priamo z OpenVPM?
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nemusíte platiť za externý redakčný systém (WordPress, Wix) ani platiť programátorom za každú úpravu.
              Akékoľvek zmeny ordinačných hodín, služieb, lekárskeho tímu, nových letákov či recenzií sa na vašom webe aktualizujú okamžite bez vášho zásahu.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <CalendarCheck2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Online rezervácia termínov s UTM trackingom</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>GDPR súlad: zverejnenie personálu len so súhlasom</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Smartphone className="h-4 w-4 text-blue-500 shrink-0" />
                <span>Optimalizované pre mobily a rýchle načítanie</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Container */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Interaktívny náhľad webstránky
            </span>
          </div>

          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                previewMode === "desktop"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                previewMode === "mobile"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobil
            </button>
          </div>
        </div>

        <div className="p-4 bg-muted/10 flex justify-center items-center min-h-[500px]">
          {config?.clinicId ? (
            <div
              className={`transition-all duration-300 rounded-xl overflow-hidden border border-border bg-background shadow-md ${
                previewMode === "mobile" ? "w-[390px] h-[680px]" : "w-full h-[620px]"
              }`}
            >
              <iframe
                src={`/web/${config.clinicId}`}
                title="Náhľad verejnej webstránky"
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Načítavam náhľad...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
