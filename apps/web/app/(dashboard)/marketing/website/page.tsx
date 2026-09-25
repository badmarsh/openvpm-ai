"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CircleQuestionMark,
  Clock,
  Copy,
  Eye,
  ExternalLink,
  FileCode,
  FileText,
  Globe,
  HeartPulse,
  Image as ImageIcon,
  Inbox,
  Layers,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Monitor,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  SearchX,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDateTime, localeTagForLanguage } from "@/lib/locale/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebsiteEditorPalette } from "@/components/marketing/website-editor-palette";
import { WebsiteEditorCanvas } from "@/components/marketing/website-editor-canvas";
import { WebsiteEditorSheet } from "@/components/marketing/website-editor-sheet";
import { createDefaultSection } from "@/lib/marketing/website-seed";
import type {
  SectionType,
  WebsiteSection,
} from "@/lib/marketing/website-builder-types";
import {
  DataTableFrame,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageToolbar,
  SearchField,
  TableSkeleton,
  filterControlClass,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";

type Translate = ReturnType<typeof useI18n>["t"];

type WebsiteTab = "builder" | "sections" | "inquiries";
type SaveStatus = "saved" | "saving" | "unsaved";
type InquiryStatusFilter = "all" | "new" | "in_progress" | "resolved" | "archived";

/** Row shape consumed by the inquiries queue (subset of ext_marketing_website_inquiries). */
interface InquiryRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  clientId: string | null;
  createdAt: Date | null;
}

const INQUIRY_SEARCH_MAX_LENGTH = 100;
const SECTION_SEARCH_MAX_LENGTH = 60;
const SECTION_COLUMNS = 5;
const INQUIRY_COLUMNS = 6;
const AUTOSAVE_DEBOUNCE_MS = 1000;

const SECTION_TYPE_ICONS: Record<SectionType, LucideIcon> = {
  hero: LayoutTemplate,
  about: Sparkles,
  services: Stethoscope,
  team: Users,
  reviews: Star,
  faq: CircleQuestionMark,
  hours_location: Clock,
  booking_cta: CalendarCheck2,
  gallery: ImageIcon,
  handouts: FileText,
  trust_badges: ShieldCheck,
  stats: TrendingUp,
  emergency_banner: AlertTriangle,
  contact_form: Mail,
  video_embed: Video,
  social_proof: Share2,
  custom_rich_text: FileCode,
  wellness: HeartPulse,
};

/** Content fields that hold the human-visible heading of a section. */
const PREVIEW_CONTENT_KEYS = ["title", "headline", "heading", "badge", "label"] as const;

/** Case- and diacritics-insensitive matching ("kovac" finds "Kováčová"). */
function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/** Headline of a section's content — whatever the section schema calls it. */
function sectionPreviewText(section: WebsiteSection): string | null {
  const content = (section.content ?? {}) as Record<string, unknown>;
  for (const key of PREVIEW_CONTENT_KEYS) {
    const value = content[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Number of repeatable items inside a section (services, FAQs, stats, …). */
function sectionItemCount(section: WebsiteSection): number | null {
  const content = (section.content ?? {}) as Record<string, unknown>;
  for (const value of Object.values(content)) {
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

function sectionTypeLabel(type: SectionType, t: Translate): string {
  switch (type) {
    case "hero":
      return t("marketing.website.sections.types.hero", "Hero banner");
    case "about":
      return t("marketing.website.sections.types.about", "O klinike & príbeh");
    case "services":
      return t("marketing.website.sections.types.services", "Prehľad služieb");
    case "team":
      return t("marketing.website.sections.types.team", "Tím kliniky");
    case "reviews":
      return t("marketing.website.sections.types.reviews", "Recenzie");
    case "faq":
      return t("marketing.website.sections.types.faq", "Časté otázky");
    case "hours_location":
      return t("marketing.website.sections.types.hours_location", "Ordinačné hodiny & miesto");
    case "booking_cta":
      return t("marketing.website.sections.types.booking_cta", "Objednávacia výzva");
    case "gallery":
      return t("marketing.website.sections.types.gallery", "Galéria");
    case "handouts":
      return t("marketing.website.sections.types.handouts", "Edukačné letáky");
    case "trust_badges":
      return t("marketing.website.sections.types.trust_badges", "Certifikáty & garancie");
    case "stats":
      return t("marketing.website.sections.types.stats", "Štatistiky v číslach");
    case "emergency_banner":
      return t("marketing.website.sections.types.emergency_banner", "Pohotovostný banner");
    case "contact_form":
      return t("marketing.website.sections.types.contact_form", "Kontaktný formulár");
    case "video_embed":
      return t("marketing.website.sections.types.video_embed", "Video");
    case "social_proof":
      return t("marketing.website.sections.types.social_proof", "Sociálne siete");
    case "custom_rich_text":
      return t("marketing.website.sections.types.custom_rich_text", "Vlastný text");
    case "wellness":
      return t("marketing.website.sections.types.wellness", "Wellness programy");
    default:
      return t("marketing.website.sections.typeUnknown", "Neznáma sekcia");
  }
}

/** Slovak plural forms: 1 sekcia · 2–4 sekcie · 0 / 5+ sekcií. */
function sectionCountLabel(count: number, t: Translate): string {
  if (count === 1) {
    return t("marketing.website.sections.countOne", "{count} sekcia", { count });
  }
  if ([2, 3, 4].includes(count)) {
    return t("marketing.website.sections.countFew", "{count} sekcie", { count });
  }
  return t("marketing.website.sections.countOther", "{count} sekcií", { count });
}

/** Slovak plural forms: 1 dopyt · 2–4 dopyty · 0 / 5+ dopytov. */
function inquiryCountLabel(count: number, t: Translate): string {
  if (count === 1) {
    return t("marketing.website.inquiries.countOne", "{count} dopyt", { count });
  }
  if ([2, 3, 4].includes(count)) {
    return t("marketing.website.inquiries.countFew", "{count} dopyty", { count });
  }
  return t("marketing.website.inquiries.countOther", "{count} dopytov", { count });
}

/** Query failure: never let an error masquerade as an empty list. */
function QueryErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert">
      <EmptyState
        icon={AlertTriangle}
        title={title}
        className="border-destructive/30 bg-destructive/5 p-6"
        action={{ label: t("marketing.website.retry", "Skúsiť znova"), onClick: onRetry }}
      />
    </div>
  );
}

export default function MarketingWebsitePage() {
  const { t, locale } = useI18n();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<WebsiteTab>("builder");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [activeEditingSection, setActiveEditingSection] = useState<WebsiteSection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [copied, setCopied] = useState(false);

  const [sectionSearch, setSectionSearch] = useState("");
  const [sectionVisibility, setSectionVisibility] = useState<"all" | "visible" | "hidden">("all");

  const [inquirySearch, setInquirySearch] = useState("");
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<InquiryStatusFilter>("all");

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  const configQuery = trpc.extensions.marketing.getWebsiteConfig.useQuery();
  const publicDataQuery = trpc.extensions.marketing.getPublicWebsiteData.useQuery(
    { clinicId: configQuery.data?.clinicId ?? "" },
    { enabled: !!configQuery.data?.clinicId },
  );

  const inquiriesQuery = trpc.extensions.marketing.listWebsiteInquiries.useQuery(
    inquiryStatusFilter === "all" ? undefined : { status: inquiryStatusFilter },
  );

  const updateInquiryStatusMutation =
    trpc.extensions.marketing.updateWebsiteInquiryStatus.useMutation({
      onSuccess: () => {
        utils.extensions.marketing.listWebsiteInquiries.invalidate();
        utils.extensions.marketing.getWebsiteConfig.invalidate();
        toast.success(
          t(
            "marketing.website.inquiries.statusUpdated",
            "Stav dopytu bol úspešne aktualizovaný.",
          ),
        );
      },
      onError: (err) => {
        toast.error(
          t("marketing.website.toast.inquiryError", "Nepodarilo sa aktualizovať stav dopytu."),
          { description: err.message || undefined },
        );
      },
    });

  const saveMutation = trpc.extensions.marketing.updateWebsiteSections.useMutation({
    onSuccess: (data) => {
      setSaveStatus("saved");
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      if (data?.published) {
        utils.extensions.marketing.getPublicWebsiteData.invalidate();
        toast.success(
          t(
            "marketing.website.publishedSuccess",
            "Webstránka bola úspešne publikovaná a je dostupná online!",
          ),
        );
      } else {
        toast.success(
          t("marketing.website.draftSaved", "Koncept webstránky bol úspešne uložený."),
        );
      }
    },
    onError: (err) => {
      setSaveStatus("unsaved");
      toast.error(t("marketing.website.toast.saveError", "Nepodarilo sa uložiť zmeny sekcií."), {
        description: err.message || undefined,
      });
    },
  });

  const publishMutation = trpc.extensions.marketing.publishWebsite.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      utils.extensions.marketing.getPublicWebsiteData.invalidate();
      toast.success(
        t(
          "marketing.website.publishedSuccess",
          "Webstránka bola úspešne publikovaná a je dostupná online!",
        ),
      );
    },
    onError: (err) => {
      setSaveStatus("unsaved");
      toast.error(t("marketing.website.toast.publishError", "Nepodarilo sa publikovať webstránku."), {
        description: err.message || undefined,
      });
    },
  });

  const toggleMutation = trpc.extensions.marketing.toggleWebsite.useMutation({
    onSuccess: (data) => {
      utils.extensions.marketing.getWebsiteConfig.invalidate();
      utils.extensions.marketing.getPublicWebsiteData.invalidate();
      if (data.published) {
        toast.success(
          t(
            "marketing.website.publishedSuccess",
            "Webstránka bola úspešne publikovaná a je dostupná online!",
          ),
        );
      } else {
        toast.info(
          t(
            "marketing.website.unpublishSuccess",
            "Webstránka kliniky bola prepnutá do režimu konceptu (nepublikovaná).",
          ),
        );
      }
    },
    onError: (err) => {
      toast.error(
        t(
          "marketing.website.toast.toggleError",
          "Nepodarilo sa zmeniť stav publikovania webstránky.",
        ),
        { description: err.message || undefined },
      );
    },
  });

  // Warn before navigating away if there are unsaved/pending changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const triggerAutosave = useCallback(
    (nextSections: WebsiteSection[]) => {
      setSaveStatus("saving");
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        saveMutation.mutate({ sections: nextSections });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [saveMutation],
  );

  // Explicit instant save actions
  const handleManualSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus("saving");
    saveMutation.mutate({ sections, publishLive: false });
  }, [saveMutation, sections]);

  const handlePublish = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus("saving");
    publishMutation.mutate({ sections });
  }, [publishMutation, sections]);

  const handleUnpublish = useCallback(() => {
    toggleMutation.mutate({ published: false, sections });
  }, [toggleMutation, sections]);

  // Initialize draft sections from query once loaded
  useEffect(() => {
    if (configQuery.data?.sectionsDraft && !hasInitializedRef.current) {
      setSections(configQuery.data.sectionsDraft as WebsiteSection[]);
      hasInitializedRef.current = true;
    }
  }, [configQuery.data]);

  // Section management actions
  const handleAddSection = (type: SectionType) => {
    const newSection = createDefaultSection(type, sections.length);
    const updated = [...sections, newSection];
    setSections(updated);
    triggerAutosave(updated);
    toast.success(t("marketing.website.toast.sectionAdded", "Sekcia bola pridaná na koniec stránky."));
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
    toast.success(
      t("marketing.website.toast.sectionUpdated", "Zmeny v sekcii boli použité."),
    );
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
    toast.success(t("marketing.website.toast.sectionDuplicated", "Sekcia bola duplikovaná."));
  };

  const handleToggleVisibility = (sectionId: string) => {
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, visible: !s.visible } : s,
    );
    setSections(updated);
    triggerAutosave(updated);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast.warning(
        t(
          "marketing.website.toast.sectionKeptAtLeastOne",
          "Stránka musí obsahovať aspoň jednu sekciu.",
        ),
      );
      return;
    }
    const updated = sections
      .filter((s) => s.id !== sectionId)
      .map((s, idx) => ({ ...s, order: idx }));
    setSections(updated);
    triggerAutosave(updated);
    toast.info(t("marketing.website.toast.sectionRemoved", "Sekcia bola odstránená z konceptu."));
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
      toast.success(
        t(
          "marketing.website.toast.copyLinkSuccess",
          "Odkaz na verejnú webstránku bol skopírovaný do schránky!",
        ),
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("marketing.website.toast.copyLinkError", "Nepodarilo sa skopírovať odkaz."));
    }
  };

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections],
  );

  const visibleSections = useMemo(() => {
    const needle = foldForSearch(sectionSearch.trim());
    return orderedSections.filter((section) => {
      if (sectionVisibility === "visible" && !section.visible) return false;
      if (sectionVisibility === "hidden" && section.visible) return false;
      if (!needle) return true;
      return foldForSearch(
        [sectionTypeLabel(section.type, t), sectionPreviewText(section)]
          .filter(Boolean)
          .join(" "),
      ).includes(needle);
    });
  }, [orderedSections, sectionVisibility, sectionSearch, t]);

  const inquiries = useMemo<InquiryRow[]>(
    () => (inquiriesQuery.data ?? []) as InquiryRow[],
    [inquiriesQuery.data],
  );

  const filteredInquiries = useMemo(() => {
    const needle = foldForSearch(inquirySearch.trim());
    if (!needle) return inquiries;
    return inquiries.filter((inquiry) =>
      foldForSearch(
        [inquiry.name, inquiry.email, inquiry.phone, inquiry.message].filter(Boolean).join(" "),
      ).includes(needle),
    );
  }, [inquiries, inquirySearch]);

  const inquiryStatusBadge = (status: string): { label: string; variant: "success" | "warning" | "info" | "secondary" } => {
    if (status === "in_progress") {
      return {
        label: t("marketing.website.inquiries.statusInProgress", "V riešení"),
        variant: "warning",
      };
    }
    if (status === "resolved") {
      return {
        label: t("marketing.website.inquiries.statusResolved", "Vybavený"),
        variant: "info",
      };
    }
    if (status === "archived") {
      return {
        label: t("marketing.website.inquiries.statusArchived", "Archivovaný"),
        variant: "secondary",
      };
    }
    return { label: t("marketing.website.inquiries.statusNew", "Nový"), variant: "success" };
  };

  const localeTag = localeTagForLanguage(locale);
  const formatCount = (value: number) =>
    new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(value);

  const kpiValue = (value: React.ReactNode) =>
    configQuery.isError ? (
      "—"
    ) : configQuery.isLoading ? (
      <span
        className="inline-block h-6 w-10 animate-pulse rounded bg-muted/60"
        aria-hidden="true"
      />
    ) : (
      value
    );

  const saveDraftButton = (className?: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={saveMutation.isPending || configQuery.isLoading}
      onClick={handleManualSave}
      className={cn("gap-1.5", className)}
      title={t("marketing.website.saveDraftTooltip", "Uložiť aktuálny koncept stránky")}
    >
      {saveMutation.isPending ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <Save className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      )}
      {t("marketing.website.saveDraft", "Uložiť koncept")}
    </Button>
  );

  const publishButton = (className?: string) => (
    <Button
      type="button"
      size="sm"
      disabled={
        (config?.published && saveMutation.isPending) ||
        publishMutation.isPending ||
        configQuery.isLoading
      }
      onClick={handlePublish}
      className={cn("gap-1.5 font-semibold", className)}
      title={
        config?.published
          ? t("marketing.website.publishChangesTooltip", "Publikovať zmeny na live web")
          : t("marketing.website.publishWebsiteTooltip", "Publikovať webstránku online")
      }
    >
      {publishMutation.isPending ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : config?.published ? (
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {config?.published
        ? t("marketing.website.publishChanges", "Publikovať zmeny na web")
        : t("marketing.website.publishWebsite", "Publikovať webstránku")}
    </Button>
  );

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Globe}
        title={t("marketing.website.title", "Webstránka kliniky")}
        subtitle={t(
          "marketing.website.subtitle",
          "Verejná reprezentatívna stránka generovaná priamo z údajov kliniky, ordinačných hodín a recenzií.",
        )}
        actions={
          <>
            {config?.published ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied
                    ? t("marketing.website.copied", "Skopírované")
                    : t("marketing.website.copyLink", "Kopírovať link")}
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("marketing.website.openLive", "Otvoriť live")}
                  </Link>
                </Button>
              </>
            ) : null}
            {saveDraftButton()}
            {publishButton()}
            {config?.published ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={toggleMutation.isPending}
                onClick={handleUnpublish}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                title={t(
                  "marketing.website.hideWebsiteTooltip",
                  "Skryť webstránku pred verejnosťou",
                )}
              >
                {toggleMutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {t("marketing.website.hideWebsite", "Skryť webstránku")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={config?.published ? "success" : "secondary"} className="text-[11px]">
            {config?.published
              ? t("marketing.website.statusPublished", "Online / Publikovaná")
              : t("marketing.website.statusDraft", "Príprava (Koncept)")}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveStatus === "saving" ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                {t("marketing.website.autosaveSaving", "Ukladám zmeny...")}
              </>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t("marketing.website.autosaveSaved", "Všetky zmeny uložené v koncepte")}
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                {t("marketing.website.autosaveUnsaved", "Neuložené zmeny")}
              </>
            )}
          </span>
        </div>
      </PageHeader>

      <KpiGrid className="sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label={t("marketing.website.kpi.pageStatus", "Stav stránky")}
          icon={Globe}
          tone={config?.published ? "primary" : undefined}
          value={kpiValue(
            config?.published
              ? t("marketing.website.kpi.pageStatusActive", "Aktívna online")
              : t("marketing.website.kpi.pageStatusDraft", "V príprave"),
          )}
        />
        <KpiCard
          label={t("marketing.website.kpi.sections", "Sekcie stránky")}
          icon={Layers}
          value={kpiValue(formatCount(sections.length))}
          active={activeTab === "sections"}
          onClick={() => setActiveTab("sections")}
        />
        <KpiCard
          label={t("marketing.website.kpi.inquiries", "Dopyty z webu")}
          icon={MessageSquare}
          tone={(config?.inquiriesCount ?? 0) > 0 ? "primary" : undefined}
          value={kpiValue(formatCount(config?.inquiriesCount ?? 0))}
          active={activeTab === "inquiries"}
          onClick={() => setActiveTab("inquiries")}
        />
        <KpiCard
          label={t("marketing.website.kpi.activePatients", "Aktívni pacienti")}
          icon={HeartPulse}
          value={kpiValue(formatCount(config?.liveStats?.patientCount ?? 0))}
        />
        <KpiCard
          label={t("marketing.website.kpi.reviews", "Overené recenzie")}
          icon={Star}
          value={kpiValue(formatCount(config?.reviewsCount ?? 0))}
        />
      </KpiGrid>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WebsiteTab)}>
        <TabsList
          aria-label={t("marketing.website.tabsAria", "Sekcie správy webstránky")}
          className={underlineTabsListClass}
        >
          <TabsTrigger value="builder" className={underlineTabsTriggerClass}>
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            {t("marketing.website.tabEditor", "Editor stránky")}
          </TabsTrigger>
          <TabsTrigger value="sections" className={underlineTabsTriggerClass}>
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("marketing.website.tabSections", "Sekcie stránky")}
          </TabsTrigger>
          <TabsTrigger value="inquiries" className={underlineTabsTriggerClass}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {t("marketing.website.tabInquiries", "Dopyty z webu")}
            {(config?.inquiriesCount ?? 0) > 0 ? (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {config?.inquiriesCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Editor */}
        <TabsContent value="builder" className="mt-0 space-y-3 pt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">
                  {t("marketing.website.editor.heading", "Editor webstránky kliniky")}
                </span>
                <Badge variant="outline" className="text-[11px] font-medium">
                  {sectionCountLabel(sections.length, t)}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {saveDraftButton("h-8 text-xs")}
                {publishButton("h-8 text-xs")}
                <div
                  role="group"
                  aria-label={t("marketing.website.editor.viewportLabel", "Náhľad zariadenia")}
                  className="flex items-center gap-1 rounded-md border border-border bg-muted/60 p-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={previewMode === "desktop" ? "secondary" : "ghost"}
                    className="h-7 gap-1 px-2 text-xs"
                    aria-pressed={previewMode === "desktop"}
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("marketing.website.deviceDesktop", "Desktop")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={previewMode === "mobile" ? "secondary" : "ghost"}
                    className="h-7 gap-1 px-2 text-xs"
                    aria-pressed={previewMode === "mobile"}
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("marketing.website.deviceMobile", "Mobil")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex min-h-[720px] flex-col items-stretch md:flex-row">
              <WebsiteEditorPalette onAddSection={handleAddSection} />

              <div className="flex flex-1 items-start justify-center overflow-y-auto bg-muted/15 p-4">
                {configQuery.isError ? (
                  <QueryErrorState
                    title={t(
                      "marketing.website.editor.loadError",
                      "Editor stránky sa nepodarilo načítať.",
                    )}
                    onRetry={() => configQuery.refetch()}
                  />
                ) : configQuery.isLoading ? (
                  <div
                    role="status"
                    className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground"
                    aria-label={t("marketing.website.editor.loading", "Načítavam editor stránky...")}
                  >
                    <RefreshCw className="mb-2 h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-xs">
                      {t("marketing.website.editor.loading", "Načítavam editor stránky...")}
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-full transition-all duration-300",
                      previewMode === "mobile" &&
                        "mx-auto max-w-[390px] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-background p-2 shadow-2xl",
                    )}
                  >
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
        </TabsContent>

        {/* Page sections CMS */}
        <TabsContent value="sections" className="mt-0 space-y-3 pt-4">
          <PageToolbar>
            <label htmlFor="marketing-website-section-search" className="sr-only">
              {t("marketing.website.sections.searchLabel", "Hľadať v sekciách stránky")}
            </label>
            <SearchField
              id="marketing-website-section-search"
              value={sectionSearch}
              maxLength={SECTION_SEARCH_MAX_LENGTH}
              placeholder={t(
                "marketing.website.sections.searchPlaceholder",
                "Hľadať sekciu podľa názvu alebo nadpisu…",
              )}
              onChange={setSectionSearch}
            />
            <select
              value={sectionVisibility}
              onChange={(e) =>
                setSectionVisibility(e.target.value as "all" | "visible" | "hidden")
              }
              className={filterControlClass}
              aria-label={t(
                "marketing.website.sections.visibilityLabel",
                "Filtrovať podľa viditeľnosti",
              )}
            >
              <option value="all">
                {t("marketing.website.sections.visibilityAll", "Všetky sekcie")}
              </option>
              <option value="visible">
                {t("marketing.website.sections.visibilityVisible", "Zobrazené na webe")}
              </option>
              <option value="hidden">
                {t("marketing.website.sections.visibilityHidden", "Skryté")}
              </option>
            </select>
            <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {sectionCountLabel(visibleSections.length, t)}
            </p>
          </PageToolbar>

          {configQuery.isError ? (
            <QueryErrorState
              title={t("marketing.website.sections.loadError", "Sekcie sa nepodarilo načítať.")}
              onRetry={() => configQuery.refetch()}
            />
          ) : configQuery.isLoading ? (
            <div
              role="status"
              aria-label={t("marketing.website.sections.loading", "Načítavam sekcie stránky...")}
            >
              <TableSkeleton rows={5} cols={SECTION_COLUMNS} />
            </div>
          ) : orderedSections.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={t("marketing.website.sections.emptyTitle", "Stránka zatiaľ nemá sekcie")}
              description={t(
                "marketing.website.sections.emptyDesc",
                "Pridajte prvú sekciu v editore stránky — napríklad hero banner alebo prehľad služieb.",
              )}
              action={{
                label: t("marketing.website.tabEditor", "Editor stránky"),
                onClick: () => setActiveTab("builder"),
              }}
            />
          ) : visibleSections.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t(
                "marketing.website.sections.emptyFilteredTitle",
                "Filtrom nevyhovuje žiadna sekcia",
              )}
              description={t(
                "marketing.website.sections.emptyFilteredDesc",
                "Upravte vyhľadávanie alebo filter viditeľnosti.",
              )}
            />
          ) : (
            <DataTableFrame>
              <table
                aria-label={t("marketing.website.sections.tableAria", "Sekcie webstránky kliniky")}
                className="w-full text-xs"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={cn(tableHeadClass, "w-16")}>
                      {t("marketing.website.sections.colOrder", "Poradie")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.sections.colSection", "Sekcia")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.sections.colPreview", "Náhľad obsahu")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.sections.colVisibility", "Viditeľnosť")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      <span className="sr-only">
                        {t("marketing.website.sections.colActions", "Akcie")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSections.map((section) => {
                    const Icon = SECTION_TYPE_ICONS[section.type] ?? Layers;
                    const preview = sectionPreviewText(section);
                    const itemCount = sectionItemCount(section);
                    const previewLabel = preview ?? sectionTypeLabel(section.type, t);

                    return (
                      <tr
                        key={section.id}
                        onClick={() => handleEditSection(section)}
                        className={cn(tableRowClass, "cursor-pointer")}
                      >
                        <td className={cn(tableCellClass, "font-mono tabular-nums text-muted-foreground")}>
                          {section.order + 1}
                        </td>
                        <td className={tableCellClass}>
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            {sectionTypeLabel(section.type, t)}
                          </span>
                          {itemCount !== null ? (
                            <span className="mt-0.5 block text-muted-foreground">
                              {t("marketing.website.sections.itemCount", "{count} položiek", {
                                count: itemCount,
                              })}
                            </span>
                          ) : null}
                        </td>
                        <td className={tableCellClass}>
                          <Badge
                            variant="outline"
                            className="max-w-[18rem] gap-1 truncate text-[11px] font-normal"
                            title={t(
                              "marketing.website.sections.previewChipTitle",
                              "Náhľad obsahu sekcie: {preview}",
                              { preview: previewLabel },
                            )}
                          >
                            <Eye className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">{previewLabel}</span>
                          </Badge>
                        </td>
                        <td className={tableCellClass}>
                          <Badge
                            variant={section.visible ? "success" : "secondary"}
                            className="text-[11px] font-medium"
                          >
                            {section.visible
                              ? t("marketing.website.sections.visible", "Zobrazená")
                              : t("marketing.website.sections.hidden", "Skrytá")}
                          </Badge>
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveTab("builder");
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("marketing.website.sections.openInEditor", "Otvoriť v editore")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={t("marketing.website.moveSection", "Presunúť")}
                              title={t(
                                "marketing.website.moveSectionTooltip",
                                "Kliknite a potiahnite pre presun sekcie",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveTab("builder");
                              }}
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={t("marketing.website.sections.duplicate", "Duplikovať sekciu")}
                              title={t(
                                "marketing.website.duplicateSectionTooltip",
                                "Duplikovať sekciu",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDuplicateSection(section.id);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={
                                section.visible
                                  ? t("marketing.website.hideSection", "Skryť sekciu")
                                  : t("marketing.website.showSection", "Zobraziť sekciu")
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleVisibility(section.id);
                              }}
                            >
                              {section.visible ? (
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={t("marketing.website.sections.edit", "Upraviť sekciu")}
                              title={t("marketing.website.sections.edit", "Upraviť sekciu")}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleEditSection(section);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              aria-label={t("marketing.website.sections.delete", "Odstrániť sekciu")}
                              title={t(
                                "marketing.website.deleteSectionTooltip",
                                "Odstrániť sekciu",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteSection(section.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>

        {/* Inquiries */}
        <TabsContent value="inquiries" className="mt-0 space-y-3 pt-4">
          <PageToolbar>
            <label htmlFor="marketing-website-inquiry-search" className="sr-only">
              {t("marketing.website.inquiries.searchLabel", "Hľadať v dopytoch z webu")}
            </label>
            <SearchField
              id="marketing-website-inquiry-search"
              value={inquirySearch}
              maxLength={INQUIRY_SEARCH_MAX_LENGTH}
              placeholder={t(
                "marketing.website.inquiries.searchPlaceholder",
                "Hľadať meno, e-mail alebo správu…",
              )}
              onChange={setInquirySearch}
            />
            <select
              value={inquiryStatusFilter}
              onChange={(e) => setInquiryStatusFilter(e.target.value as InquiryStatusFilter)}
              className={filterControlClass}
              aria-label={t("marketing.website.inquiries.statusLabel", "Filtrovať podľa stavu dopytu")}
            >
              <option value="all">{t("marketing.website.inquiries.filterAll", "Všetky")}</option>
              <option value="new">{t("marketing.website.inquiries.filterNew", "Nové")}</option>
              <option value="in_progress">
                {t("marketing.website.inquiries.filterInProgress", "V riešení")}
              </option>
              <option value="resolved">
                {t("marketing.website.inquiries.filterResolved", "Vybavené")}
              </option>
              <option value="archived">
                {t("marketing.website.inquiries.filterArchived", "Archivované")}
              </option>
            </select>
            <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {inquiryCountLabel(filteredInquiries.length, t)}
            </p>
          </PageToolbar>

          {inquiriesQuery.isError ? (
            <QueryErrorState
              title={t(
                "marketing.website.inquiries.loadError",
                "Dopyty z webu sa nepodarilo načítať.",
              )}
              onRetry={() => inquiriesQuery.refetch()}
            />
          ) : inquiriesQuery.isLoading ? (
            <div
              role="status"
              aria-label={t("marketing.website.inquiries.loading", "Načítavam dopyty...")}
            >
              <TableSkeleton rows={5} cols={INQUIRY_COLUMNS} />
            </div>
          ) : inquiries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("marketing.website.inquiries.emptyTitle", "Žiadne dopyty z webu")}
              description={t(
                "marketing.website.inquiries.emptyDesc",
                "Keď návštevníci vyplnia kontaktný formulár na vašej stránke, správy sa zobrazia tu.",
              )}
            />
          ) : filteredInquiries.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t(
                "marketing.website.inquiries.emptyFilteredTitle",
                "Filtrom nevyhovuje žiadny dopyt",
              )}
              description={t(
                "marketing.website.inquiries.emptyFilteredDesc",
                "Upravte vyhľadávanie alebo filter stavu.",
              )}
            />
          ) : (
            <DataTableFrame>
              <table
                aria-label={t("marketing.website.inquiries.tableAria", "Dopyty a správy z webu")}
                className="w-full text-xs"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>
                      {t("marketing.website.inquiries.tableName", "Meno záujemcu")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.inquiries.tableContact", "Kontaktné údaje")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.inquiries.tableMessage", "Správa / Otázka")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.inquiries.tableStatus", "Stav")}
                    </th>
                    <th className={tableHeadClass}>
                      {t("marketing.website.inquiries.tableDate", "Dátum")}
                    </th>
                    <th className={cn(tableHeadClass, "text-right")}>
                      <span className="sr-only">
                        {t("marketing.website.inquiries.tableActions", "Akcie")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.map((inquiry) => {
                    const badge = inquiryStatusBadge(inquiry.status);
                    return (
                      <tr key={inquiry.id} className={tableRowClass}>
                        <td className={tableCellClass}>
                          <div className="font-semibold text-foreground">
                            {inquiry.name ??
                              t("marketing.website.inquiries.anonymous", "Anonymný návštevník")}
                          </div>
                          {inquiry.clientId ? (
                            <Button
                              asChild
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-6 gap-1 px-0 text-[11px]"
                            >
                              <Link href={`/clients/${inquiry.clientId}`}>
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                {t("marketing.website.inquiries.clientBadge", "Klient v databáze")}
                              </Link>
                            </Button>
                          ) : null}
                        </td>
                        <td className={tableCellClass}>
                          <div className="flex flex-col gap-0.5">
                            {inquiry.email ? (
                              <a
                                href={`mailto:${inquiry.email}`}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{inquiry.email}</span>
                              </a>
                            ) : null}
                            {inquiry.phone ? (
                              <a
                                href={`tel:${inquiry.phone}`}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span>{inquiry.phone}</span>
                              </a>
                            ) : null}
                            {!inquiry.email && !inquiry.phone ? (
                              <span className="text-muted-foreground">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className={tableCellClass}>
                          <p className="line-clamp-3 max-w-md whitespace-pre-wrap text-foreground/90">
                            {inquiry.message}
                          </p>
                        </td>
                        <td className={tableCellClass}>
                          <Badge variant={badge.variant} className="text-[11px] font-medium">
                            {badge.label}
                          </Badge>
                        </td>
                        <td className={cn(tableCellClass, "font-mono tabular-nums text-muted-foreground")}>
                          {inquiry.createdAt ? formatDateTime(inquiry.createdAt, { language: locale }) : "—"}
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          <div className="flex items-center justify-end gap-1">
                            {inquiry.status !== "in_progress" &&
                            inquiry.status !== "resolved" &&
                            inquiry.status !== "archived" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateInquiryStatusMutation.isPending}
                                onClick={() =>
                                  updateInquiryStatusMutation.mutate({
                                    id: inquiry.id,
                                    status: "in_progress",
                                  })
                                }
                              >
                                {t("marketing.website.inquiries.markInProgress", "Vziať do riešenia")}
                              </Button>
                            ) : null}
                            {inquiry.status !== "resolved" && inquiry.status !== "archived" ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateInquiryStatusMutation.isPending}
                                onClick={() =>
                                  updateInquiryStatusMutation.mutate({
                                    id: inquiry.id,
                                    status: "resolved",
                                  })
                                }
                              >
                                {t(
                                  "marketing.website.inquiries.markResolved",
                                  "Označiť ako vybavené",
                                )}
                              </Button>
                            ) : null}
                            {inquiry.status !== "archived" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                disabled={updateInquiryStatusMutation.isPending}
                                onClick={() =>
                                  updateInquiryStatusMutation.mutate({
                                    id: inquiry.id,
                                    status: "archived",
                                  })
                                }
                              >
                                {t("marketing.website.inquiries.markArchived", "Archivovať")}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updateInquiryStatusMutation.isPending}
                                onClick={() =>
                                  updateInquiryStatusMutation.mutate({
                                    id: inquiry.id,
                                    status: "new",
                                  })
                                }
                              >
                                {t("marketing.website.inquiries.reopen", "Znovu otvoriť")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>
      </Tabs>

      <WebsiteEditorSheet
        section={activeEditingSection}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={handleSaveSection}
      />
    </div>
  );
}
