"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Smartphone,
  Monitor,
  Sparkles,
  Save,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WebsiteEditorPalette } from "@/components/marketing/website-editor-palette";
import { WebsiteEditorCanvas } from "@/components/marketing/website-editor-canvas";
import { WebsiteEditorSheet } from "@/components/marketing/website-editor-sheet";
import { createDefaultSection } from "@/lib/marketing/website-seed";
import type { WebsiteSection, SectionType } from "@/lib/marketing/website-builder-types";

export default function MarketingWebsitePage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [activeEditingSection, setActiveEditingSection] = useState<WebsiteSection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  const configQuery = trpc.extensions.marketing.getWebsiteConfig.useQuery();
  const publicDataQuery = trpc.extensions.marketing.getPublicWebsiteData.useQuery(
    { clinicId: configQuery.data?.clinicId ?? "" },
    { enabled: !!configQuery.data?.clinicId }
  );

  const saveMutation = trpc.extensions.marketing.updateWebsiteSections.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      utils.extensions.marketing.getWebsiteConfig.invalidate();
    },
    onError: (err) => {
      setSaveStatus("unsaved");
      toast.error(err.message || "Nepodarilo sa uložiť zmeny sekcií.");
    },
  });

  const toggleMutation = trpc.extensions.marketing.toggleWebsite.useMutation({
    onSuccess: (data) => {
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      utils.extensions.marketing.getPublicWebsiteData.invalidate();
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

  // Initialize draft sections from query once loaded
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (configQuery.data?.sectionsDraft && !hasInitializedRef.current) {
      setSections(configQuery.data.sectionsDraft as WebsiteSection[]);
      hasInitializedRef.current = true;
    }
  }, [configQuery.data]);

  // Debounced autosave
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAutosave = useCallback(
    (newSections: WebsiteSection[]) => {
      setSaveStatus("saving");
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        saveMutation.mutate({ sections: newSections });
      }, 1000);
    },
    [saveMutation]
  );

  // Section Management Actions
  const handleAddSection = (type: SectionType) => {
    const newSection = createDefaultSection(type, sections.length);
    const updated = [...sections, newSection];
    setSections(updated);
    triggerAutosave(updated);
    toast.success(`Sekcia bola pridaná na koniec stránky.`);
  };

  const handleReorder = (reorderedSections: WebsiteSection[]) => {
    setSections(reorderedSections);
    triggerAutosave(reorderedSections);
  };

  const handleEditSection = (section: WebsiteSection) => {
    setActiveEditingSection(section);
    setSheetOpen(true);
  };

  const handleSaveSection = (updatedSection: WebsiteSection) => {
    const updated = sections.map((s) => (s.id === updatedSection.id ? updatedSection : s));
    setSections(updated);
    triggerAutosave(updated);
    toast.success("Zmeny v sekcii boli použité.");
  };

  const handleDuplicateSection = (sectionId: string) => {
    const targetIdx = sections.findIndex((s) => s.id === sectionId);
    if (targetIdx === -1) return;

    const original = sections[targetIdx];
    const duplicate: WebsiteSection = {
      ...JSON.parse(JSON.stringify(original)),
      id: `sec-${original.type}-${Date.now()}`,
      order: targetIdx + 1,
    };

    const updated = [...sections];
    updated.splice(targetIdx + 1, 0, duplicate);
    const reindexed = updated.map((s, idx) => ({ ...s, order: idx }));
    setSections(reindexed);
    triggerAutosave(reindexed);
    toast.success("Sekcia bola duplikovaná.");
  };

  const handleToggleVisibility = (sectionId: string) => {
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, visible: !s.visible } : s
    );
    setSections(updated);
    triggerAutosave(updated);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast.warning("Stránka musí obsahovať aspoň jednu sekciu.");
      return;
    }
    const updated = sections
      .filter((s) => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx }));
    setSections(updated);
    triggerAutosave(updated);
    toast.info("Sekcia bola odstránená z konceptu.");
  };

  const config = configQuery.data;
  const publicUrl =
    typeof window !== "undefined" && config?.clinicId
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
    <div className="w-full px-4 sm:px-6 py-4 flex flex-col gap-6">
      {/* Top Header */}
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

            {/* Autosave Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground ml-3 border-l border-border pl-3">
              {saveStatus === "saving" ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Ukladám zmeny...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Všetky zmeny uložené v koncepte</span>
                </>
              ) : (
                <span className="text-amber-500">Neuložené zmeny</span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "marketing.website.subtitle",
              "Interaktívny drag-and-drop editor reprezentatívnej webstránky prepojenej s Brand Kitom a údajmi kliniky."
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
            onClick={() => toggleMutation.mutate({ published: !config?.published })}
            className="gap-2 font-bold shadow-xs"
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
            {config?.published ? "Aktívna online" : "V príprave"}
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

      {/* Main Drag-and-Drop Builder Workspace */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
        {/* Workspace Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border bg-muted/30 gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Editor webstránky kliniky
            </span>
            <Badge variant="outline" className="text-[11px] font-medium ml-2">
              {sections.length} sekcií na stránke
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport switcher */}
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
        </div>

        {/* Builder Body: Left Rail (Palette) + Center (Canvas) */}
        <div className="flex flex-col md:flex-row min-h-[750px] items-stretch">
          {/* Left Rail: Section Palette */}
          <WebsiteEditorPalette onAddSection={handleAddSection} />

          {/* Center Canvas */}
          <div className="flex-1 p-6 bg-muted/15 flex justify-center items-start overflow-y-auto">
            {configQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mb-2 text-primary" />
                <p className="text-sm">Načítavam editor stránky...</p>
              </div>
            ) : (
              <div
                className={`transition-all duration-300 w-full ${
                  previewMode === "mobile"
                    ? "max-w-[390px] border-4 border-stone-800 rounded-[2.5rem] shadow-2xl p-2 bg-background overflow-hidden mx-auto"
                    : "w-full"
                }`}
              >
                {/* Brand Kit CSS Variables Injector for Canvas */}
                <div
                  className="website-builder-canvas-root"
                  style={
                    {
                      "--wb-primary": config?.brandKit?.brandColor || "#0d9488",
                      "--wb-secondary": config?.brandKit?.secondaryColor || "#f5f5f4",
                    } as React.CSSProperties
                  }
                >
                  <WebsiteEditorCanvas
                    sections={sections}
                    brandKit={config?.brandKit}
                    contextData={publicDataQuery.data}
                    onReorder={handleReorder}
                    onEditSection={handleEditSection}
                    onDuplicateSection={handleDuplicateSection}
                    onToggleVisibility={handleToggleVisibility}
                    onDeleteSection={handleDeleteSection}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Properties Sheet */}
      <WebsiteEditorSheet
        section={activeEditingSection}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSaveSection}
      />
    </div>
  );
}
