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
  MessageSquare,
  Mail,
  Phone,
  Inbox,
  UserCheck,
  Clock,
  HeartPulse,
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
  const [activeTab, setActiveTab] = useState<"builder" | "inquiries">("builder");
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>("all");
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

  const inquiriesQuery = trpc.extensions.marketing.listWebsiteInquiries.useQuery(
    inquiryStatusFilter === "all" ? undefined : { status: inquiryStatusFilter as any }
  );

  const updateInquiryStatusMutation = trpc.extensions.marketing.updateWebsiteInquiryStatus.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listWebsiteInquiries.invalidate();
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      toast.success(t("marketing.website.inquiries.statusUpdated", "Stav dopytu bol úspešne aktualizovaný."));
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa aktualizovať stav dopytu.");
    },
  });

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("marketing.website.kpi.pageStatus", "Stav stránky")}
            </span>
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.published
              ? t("marketing.website.kpi.pageStatusActive", "Aktívna online")
              : t("marketing.website.kpi.pageStatusDraft", "V príprave")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config?.published
              ? t("marketing.website.kpi.pageStatusActiveDesc", "Prístupná pre chovateľov a Google")
              : t("marketing.website.kpi.pageStatusDraftDesc", "Zatiaľ skrytá pred verejnosťou")}
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("inquiries")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab("inquiries"); }}
          className={`rounded-xl border p-4 shadow-xs cursor-pointer transition-all hover:border-primary/50 ${
            activeTab === "inquiries" ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("marketing.website.kpi.inquiries", "Dopyty z webu")}
            </span>
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.inquiriesCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("marketing.website.kpi.inquiriesDesc", "Nové dopyty cez kontaktný formulár")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("marketing.website.kpi.activePatients", "Aktívni pacienti")}
            </span>
            <HeartPulse className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.liveStats?.patientCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("marketing.website.kpi.activePatientsDesc", "V starostlivosti veterinárnej kliniky")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("marketing.website.kpi.team", "Lekári a personál")}
            </span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.teamCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("marketing.website.kpi.teamDesc", "Zverejnení na webstránke")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {t("marketing.website.kpi.reviews", "Overené recenzie")}
            </span>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {config?.reviewsCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("marketing.website.kpi.reviewsDesc", "5★ hodnotení Google a Facebook")}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <Button
          variant={activeTab === "builder" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("builder")}
          className="gap-2 font-semibold"
        >
          <Globe className="h-4 w-4" />
          {t("marketing.website.tabEditor", "Editor stránky")}
        </Button>
        <Button
          variant={activeTab === "inquiries" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("inquiries")}
          className="gap-2 font-semibold"
        >
          <MessageSquare className="h-4 w-4" />
          {t("marketing.website.tabInquiries", "Dopyty z webu")}
          {(config?.inquiriesCount ?? 0) > 0 && (
            <Badge
              variant={activeTab === "inquiries" ? "secondary" : "default"}
              className="ml-1 px-1.5 py-0 text-[10px] font-bold"
            >
              {config?.inquiriesCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Tab 1: Drag-and-Drop Builder Workspace */}
      {activeTab === "builder" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
          {/* Workspace Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border bg-muted/30 gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("marketing.website.tabEditor", "Editor webstránky kliniky")}
              </span>
              <Badge variant="outline" className="text-[11px] font-medium ml-2">
                {sections.length} {t("marketing.website.sectionsCount", "sekcií na stránke")}
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
                  {t("marketing.website.deviceDesktop", "Desktop")}
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
                  {t("marketing.website.deviceMobile", "Mobil")}
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
      )}

      {/* Tab 2: Website Inquiries View */}
      {activeTab === "inquiries" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t("marketing.website.inquiries.title", "Dopyty a správy z webu")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "marketing.website.inquiries.subtitle",
                  "Prehľad doručených správ od návštevníkov webstránky a záujemcov o ošetrenie."
                )}
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border text-xs flex-wrap">
              {[
                { id: "all", label: t("marketing.website.inquiries.filterAll", "Všetky") },
                { id: "new", label: t("marketing.website.inquiries.filterNew", "Nové") },
                { id: "in_progress", label: t("marketing.website.inquiries.filterInProgress", "V riešení") },
                { id: "resolved", label: t("marketing.website.inquiries.filterResolved", "Vybavené") },
                { id: "archived", label: t("marketing.website.inquiries.filterArchived", "Archivované") },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInquiryStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    inquiryStatusFilter === f.id
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {inquiriesQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mb-2 text-primary" />
              <p className="text-xs">Načítavam dopyty...</p>
            </div>
          ) : !inquiriesQuery.data || inquiriesQuery.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl bg-muted/10">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("marketing.website.inquiries.emptyTitle", "Žiadne dopyty z webu")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {t(
                  "marketing.website.inquiries.emptyDesc",
                  "Keď návštevníci vyplnia kontaktný formulár na vašej stránke, správy sa zobrazia tu."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inquiriesQuery.data.map((inq) => {
                const statusBadgeMap: Record<string, { label: string; className: string }> = {
                  new: {
                    label: t("marketing.website.inquiries.statusNew", "Nový"),
                    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                  },
                  in_progress: {
                    label: t("marketing.website.inquiries.statusInProgress", "V riešení"),
                    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  },
                  resolved: {
                    label: t("marketing.website.inquiries.statusResolved", "Vybavený"),
                    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  },
                  archived: {
                    label: t("marketing.website.inquiries.statusArchived", "Archivovaný"),
                    className: "bg-muted text-muted-foreground border-border",
                  },
                };
                const badgeInfo = statusBadgeMap[inq.status] ?? statusBadgeMap.new;

                return (
                  <div
                    key={inq.id}
                    className="rounded-xl border border-border p-4 bg-background shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm text-foreground">{inq.name}</span>
                        <Badge className={`text-[11px] font-medium border ${badgeInfo.className}`}>
                          {badgeInfo.label}
                        </Badge>
                        {inq.clientId && (
                          <Link href={`/clients/${inq.clientId}`}>
                            <Badge variant="outline" className="text-[11px] gap-1 hover:bg-muted cursor-pointer">
                              <UserCheck className="h-3 w-3 text-primary" />
                              {t("marketing.website.inquiries.clientBadge", "Klient v databáze")}
                            </Badge>
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(inq.createdAt).toLocaleString("sk-SK")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {inq.email && (
                        <a
                          href={`mailto:${inq.email}`}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          <span>{inq.email}</span>
                        </a>
                      )}
                      {inq.phone && (
                        <a
                          href={`tel:${inq.phone}`}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <span>{inq.phone}</span>
                        </a>
                      )}
                    </div>

                    <p className="text-xs bg-muted/40 p-3 rounded-lg border border-border/60 text-foreground whitespace-pre-wrap leading-relaxed">
                      {inq.message}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                      {inq.status !== "in_progress" && inq.status !== "resolved" && inq.status !== "archived" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateInquiryStatusMutation.isPending}
                          onClick={() =>
                            updateInquiryStatusMutation.mutate({ id: inq.id, status: "in_progress" })
                          }
                          className="text-xs h-7 gap-1"
                        >
                          {t("marketing.website.inquiries.markInProgress", "Vziať do riešenia")}
                        </Button>
                      )}
                      {inq.status !== "resolved" && inq.status !== "archived" && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={updateInquiryStatusMutation.isPending}
                          onClick={() =>
                            updateInquiryStatusMutation.mutate({ id: inq.id, status: "resolved" })
                          }
                          className="text-xs h-7 gap-1"
                        >
                          {t("marketing.website.inquiries.markResolved", "Označiť ako vybavené")}
                        </Button>
                      )}
                      {inq.status !== "archived" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateInquiryStatusMutation.isPending}
                          onClick={() =>
                            updateInquiryStatusMutation.mutate({ id: inq.id, status: "archived" })
                          }
                          className="text-xs h-7 text-muted-foreground"
                        >
                          {t("marketing.website.inquiries.markArchived", "Archivovať")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateInquiryStatusMutation.isPending}
                          onClick={() =>
                            updateInquiryStatusMutation.mutate({ id: inq.id, status: "new" })
                          }
                          className="text-xs h-7 gap-1"
                        >
                          {t("marketing.website.inquiries.reopen", "Znovu otvoriť")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
