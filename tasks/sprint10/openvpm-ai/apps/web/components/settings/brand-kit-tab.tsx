"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  MessageSquareText,
  ShieldAlert,
  Share2,
  Hash,
  Save,
  Check,
  Loader2,
  Sparkles,
  X,
  Plus,
  Instagram,
  Download,
  FileJson,
  FileText,
  Copy,
  Eye,
  Wand2,
  TrendingUp,
  Type,
  Image as ImageIcon,
  Video,
  Facebook,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccentColorPicker } from "@/components/brand/accent-color-picker";
import { BrandMockupPreview } from "@/components/marketing/brand-mockup-preview";
import { BrandBanner3D, BrandHeroCard3D } from "@/components/marketing/brand-banner-3d";
import { cn, initials } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

const SECONDARY_PRESETS = [
  { hex: "#f5f5f4", i18nKey: "brandKit.colorSand" },
  { hex: "#fafaf9", i18nKey: "brandKit.colorCream" },
  { hex: "#f0fdf4", i18nKey: "brandKit.colorMint" },
  { hex: "#eff6ff", i18nKey: "brandKit.colorIce" },
  { hex: "#fef3c7", i18nKey: "brandKit.colorHoney" },
  { hex: "#fdf2f8", i18nKey: "brandKit.colorRose" },
  { hex: "#1f2937", i18nKey: "brandKit.colorCarbon" },
  { hex: "#374151", i18nKey: "brandKit.colorGraphite" },
];

const THEME_PRESETS = [
  { name: "Vercel", primary: "#000000", secondary: "#fafafa", description: "Monochrome" },
  { name: "Supabase", primary: "#3ecf8e", secondary: "#1c1c1c", description: "Green & Dark" },
  { name: "Linear", primary: "#5e6ad2", secondary: "#f8f9fc", description: "Indigo" },
  { name: "Stripe", primary: "#635bff", secondary: "#f6f9fc", description: "Violet" },
  { name: "Notion", primary: "#2383e2", secondary: "#f7f7f5", description: "Blue & Warm" },
  { name: "Railway", primary: "#8a4baf", secondary: "#f5f0fa", description: "Purple" },
  { name: "VET.IS", primary: "#0d9488", secondary: "#f5f5f4", description: "Teal & Sand" },
  { name: "Rose Gold", primary: "#8b2635", secondary: "#fdf2f8", description: "Maroon & Blush" },
];

const TONE_PRESETS = [
  { i18nKey: "brandKit.toneFearFree", value: "brandKit.toneFearFreeValue", icon: "🛡️" },
  { i18nKey: "brandKit.toneFriendly", value: "brandKit.toneFriendlyValue", icon: "😊" },
  { i18nKey: "brandKit.toneEducational", value: "brandKit.toneEducationalValue", icon: "🎓" },
  { i18nKey: "brandKit.tonePlayful", value: "brandKit.tonePlayfulValue", icon: "🎨" },
];

const HASHTAG_SUGGESTIONS = [
  "#veterinar", "#zdraviezvierat", "#prevenzia", "#ockovanie",
  "#starostlivost", "#milujemzvierata", "#zdravypes", "#zdravamacka",
  "#veterinarnastarostlivost", "#petcare", "#vetlife", "#animalhealth",
];

export function BrandKitTab() {
  const utils = trpc.useUtils();
  const { t } = useI18n();
  const { data, isLoading } = trpc.settings.getBrandKit.useQuery();
  const mutation = trpc.settings.updateBrandKit.useMutation({
    onSuccess: () => {
      utils.settings.getBrandKit.invalidate();
      utils.settings.getBranding.invalidate();
      toast.success(t("brandKit.saved", "Brand Kit saved"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => toast.error(err.message),
  });

  const [saved, setSaved] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState("post");

  const [brandColor, setBrandColor] = useState("#0d9488");
  const [secondaryColor, setSecondaryColor] = useState("#f5f5f4");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [brandVoiceInstructions, setBrandVoiceInstructions] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [defaultHashtags, setDefaultHashtags] = useState<string[]>([]);
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");

  useEffect(() => {
    if (!data) return;
    setBrandColor(data.brandColor);
    setSecondaryColor(data.secondaryColor);
    setToneOfVoice(data.toneOfVoice);
    setBrandVoiceInstructions(data.brandVoiceInstructions);
    setDisclaimer(data.disclaimer);
    setDefaultHashtags(data.defaultHashtags);
    setSocialInstagram(data.socialHandles.instagram);
    setSocialFacebook(data.socialHandles.facebook);
    setSocialTiktok(data.socialHandles.tiktok);
  }, [data]);

  function handleSave() {
    mutation.mutate({
      brandColor,
      secondaryColor,
      toneOfVoice,
      brandVoiceInstructions,
      disclaimer,
      defaultHashtags,
      socialHandles: {
        instagram: socialInstagram,
        facebook: socialFacebook,
        tiktok: socialTiktok,
      },
    });
  }

  function addHashtag() {
    const tag = newHashtag.trim().replace(/^#/, "");
    if (!tag || defaultHashtags.length >= 20) return;
    if (defaultHashtags.some((t) => t.toLowerCase() === `#${tag.toLowerCase()}`)) return;
    setDefaultHashtags([...defaultHashtags, `#${tag}`]);
    setNewHashtag("");
  }

  function removeHashtag(index: number) {
    setDefaultHashtags(defaultHashtags.filter((_, i) => i !== index));
  }

  function addSuggestedHashtag(tag: string) {
    if (defaultHashtags.includes(tag) || defaultHashtags.length >= 20) return;
    setDefaultHashtags([...defaultHashtags, tag]);
  }

  function handleExport(format: "json" | "pdf") {
    if (!data) return;
    const brandKit = {
      clinicName: data.clinicName,
      brandColor,
      secondaryColor,
      toneOfVoice,
      brandVoiceInstructions,
      disclaimer,
      defaultHashtags,
      socialHandles: { instagram: socialInstagram, facebook: socialFacebook, tiktok: socialTiktok },
      exportedAt: new Date().toISOString(),
    };

    if (format === "json") {
      const blob = new Blob([JSON.stringify(brandKit, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brand-kit-${data.clinicName.toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("brandKit.exportedJson", "Brand Kit exported as JSON"));
    } else {
      toast.info(t("brandKit.pdfComingSoon", "PDF export coming soon"));
    }
    setShowExportDialog(false);
  }

  function copyBrandGuidelines() {
    if (!data) return;
    const guidelines = `${data.clinicName} - Brand Guidelines

BRAND COLORS
Primary: ${brandColor}
Secondary: ${secondaryColor}

TONE OF VOICE
${toneOfVoice || "Not specified"}

AI INSTRUCTIONS
${brandVoiceInstructions || "Not specified"}

DISCLAIMER
${disclaimer || "Not specified"}

SOCIAL MEDIA
Instagram: ${socialInstagram || "Not set"}
Facebook: ${socialFacebook || "Not set"}
TikTok: ${socialTiktok || "Not set"}

DEFAULT HASHTAGS
${defaultHashtags.join(", ")}

Generated on ${new Date().toLocaleDateString()}`;

    navigator.clipboard.writeText(guidelines);
    toast.success(t("brandKit.guidelinesCopied", "Brand guidelines copied to clipboard"));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const clinicInitials = initials(data.clinicName || "V");

  return (
    <div className="space-y-6">
      {/* Enhanced Sticky save bar with export */}
      <div className="flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-sm py-4 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{t("brandKit.autoSave", "Auto-save enabled")}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                {t("brandKit.export", "Export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileJson className="h-4 w-4 mr-2" />
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="h-4 w-4 mr-2" />
                PDF {t("brandKit.soon", "(soon)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyBrandGuidelines}>
                <Copy className="h-4 w-4 mr-2" />
                {t("brandKit.copyGuidelines", "Copy Guidelines")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
            className={cn(saved && "bg-emerald-600 hover:bg-emerald-700 text-white")}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? t("brandKit.savedLabel", "Saved") : t("brandKit.save", "Save Brand Kit")}
          </Button>
        </div>
      </div>

      {/* Hero section with 3D banner */}
      <div className="relative">
        <BrandBanner3D
          clinicName={data.clinicName}
          brandColor={brandColor}
          accentColor={secondaryColor}
          instagram={socialInstagram || undefined}
          facebook={socialFacebook || undefined}
          tiktok={socialTiktok || undefined}
        />
        <div className="absolute -bottom-3 right-6">
          <Badge variant="secondary" className="shadow-lg">
            <Sparkles className="h-3 w-3 mr-1" />
            {t("brandKit.livePreview", "Live Preview")}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t("brandKit.colors", "Colors")}</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <MessageSquareText className="h-4 w-4" />
            <span className="hidden sm:inline">{t("brandKit.voice", "Voice")}</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("brandKit.social", "Social")}</span>
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t("brandKit.guidelines", "Guidelines")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
                        <Palette className="h-4.5 w-4.5" style={{ color: brandColor }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{t("brandKit.colorPalette", "Color Palette")}</CardTitle>
                        <CardDescription className="text-xs">{t("brandKit.colorPaletteDesc", "Primary and secondary clinic colors")}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("brandKit.primary", "Primary")}
                    </label>
                    <AccentColorPicker value={brandColor} onChange={setBrandColor} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("brandKit.secondary", "Secondary")}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {SECONDARY_PRESETS.map((p) => {
                        const active = secondaryColor === p.hex;
                        return (
                          <button
                            key={p.hex}
                            type="button"
                            onClick={() => setSecondaryColor(p.hex)}
                            className={cn(
                              "group flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 transition-all",
                              active ? "border-foreground shadow-sm" : "border-transparent hover:border-border hover:shadow-xs"
                            )}
                            title={t(p.i18nKey)}
                          >
                            <span className={cn("h-6 w-6 rounded-md border transition-transform", active ? "scale-110" : "group-hover:scale-105")} style={{ backgroundColor: p.hex }} />
                            <span className="text-[9px] text-muted-foreground">{t(p.i18nKey)}</span>
                          </button>
                        );
                      })}
                      <label className="flex flex-col items-center gap-1 cursor-pointer rounded-lg border border-dashed border-border px-2 py-1.5 transition-all hover:border-foreground/30">
                        <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded-md border-0 p-0" />
                        <span className="text-[9px] text-muted-foreground">{t("brandKit.custom", "Custom")}</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {t("brandKit.themes", "Themes")}
                      </label>
                      <Badge variant="outline" className="text-[9px]">{t("brandKit.oneClick", "One-click")}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {THEME_PRESETS.map((theme) => {
                        const isActive = brandColor === theme.primary && secondaryColor === theme.secondary;
                        return (
                          <button
                            key={theme.name}
                            type="button"
                            onClick={() => { setBrandColor(theme.primary); setSecondaryColor(theme.secondary); }}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all hover:shadow-md",
                              isActive ? "border-foreground shadow-sm ring-1 ring-foreground/20" : "border-border hover:border-foreground/30"
                            )}
                          >
                            <div className="flex shrink-0 -space-x-1">
                              <div className="h-5 w-5 rounded-full border-2 border-card" style={{ backgroundColor: theme.primary }} />
                              <div className="h-5 w-5 rounded-full border-2 border-card" style={{ backgroundColor: theme.secondary }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold truncate">{theme.name}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{theme.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-gradient-to-br from-muted/50 to-muted/30 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-16 w-16 rounded-lg shadow-lg" style={{ backgroundColor: brandColor }} />
                      <div className="h-12 w-12 rounded-lg border border-border shadow-md" style={{ backgroundColor: secondaryColor }} />
                      <div className="flex-1">
                        <div className="h-8 w-full rounded-md shadow-inner" style={{ background: `linear-gradient(135deg, ${brandColor}, ${secondaryColor})` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">{brandColor} · {secondaryColor}</span>
                      <Badge variant="outline" className="text-[9px]">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {t("brandKit.contrast", "Contrast check")}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="sticky top-24 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("brandKit.preview", "Preview")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <BrandHeroCard3D clinicName={data.clinicName} brandColor={brandColor} accentColor={secondaryColor} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                        <div className="h-8 w-8 rounded-md shadow-sm" style={{ backgroundColor: brandColor }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium">{t("brandKit.primary", "Primary")}</p>
                          <p className="truncate font-mono text-[9px] text-muted-foreground">{brandColor}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                        <div className="h-8 w-8 rounded-md border border-border shadow-sm" style={{ backgroundColor: secondaryColor }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium">{t("brandKit.secondary", "Secondary")}</p>
                          <p className="truncate font-mono text-[9px] text-muted-foreground">{secondaryColor}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium mb-2">{t("brandKit.usageExamples", "Usage Examples")}</p>
                      <div className="space-y-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} />
                          <span>{t("brandKit.usagePrimary", "Buttons, links, icons")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                          <span>{t("brandKit.usageSecondary", "Backgrounds, cards")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
                      <MessageSquareText className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("brandKit.toneOfVoice", "Tone of Voice")}</CardTitle>
                      <CardDescription className="text-xs">{t("brandKit.toneOfVoiceDesc", "How the brand speaks to clients and on social media")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("brandKit.quickPresets", "Quick presets")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TONE_PRESETS.map((p) => {
                        const active = toneOfVoice === t(p.value);
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setToneOfVoice(t(p.value))}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all hover:shadow-md",
                              active
                                ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-950/30 dark:text-violet-300"
                                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <span>{p.icon}</span>
                            <span>{t(p.i18nKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{t("brandKit.toneDescription", "Tone description")}</label>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{toneOfVoice.length}/500</span>
                    </div>
                    <textarea
                      value={toneOfVoice}
                      onChange={(e) => setToneOfVoice(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder={t("brandKit.tonePlaceholder", "e.g. Compassionate, clear, calming, community-oriented.")}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{t("brandKit.aiInstructions", "AI Generator Instructions")}</label>
                      <Badge variant="outline" className="text-[9px]">{t("brandKit.optional", "Optional")}</Badge>
                    </div>
                    <textarea
                      value={brandVoiceInstructions}
                      onChange={(e) => setBrandVoiceInstructions(e.target.value)}
                      maxLength={2000}
                      rows={5}
                      placeholder={t("brandKit.aiInstructionsPlaceholder", "Detailed instructions for AI. e.g. 'Never use medical terms without explanation. Always add a booking CTA. Avoid the word cheap.'")}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                    <div className="flex justify-end">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{brandVoiceInstructions.length}/2000</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <ShieldAlert className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("brandKit.disclaimer", "Disclaimer")}</CardTitle>
                      <CardDescription className="text-xs">{t("brandKit.disclaimerDesc", "Automatically added to educational posts")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={disclaimer}
                    onChange={(e) => setDisclaimer(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={t("brandKit.disclaimerPlaceholder", "For general animal health information only.")}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="sticky top-24 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("brandKit.voicePreview", "Voice Preview")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5" style={{ color: brandColor }} />
                            <span className="text-xs font-semibold">{t("brandKit.samplePost", "Sample Post")}</span>
                          </div>
                          <Badge variant="outline" className="text-[9px]">Instagram</Badge>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: brandColor }}>
                            {clinicInitials}
                          </div>
                          <span className="text-[10px] font-semibold">{socialInstagram || data.clinicName}</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-foreground/80">
                          {toneOfVoice || t("brandKit.previewText", "Your pet deserves the best care.")} {t("brandKit.previewCta", "Book an appointment today!")}
                        </p>
                        {defaultHashtags.length > 0 && (
                          <p className="text-[9px] font-medium" style={{ color: brandColor }}>{defaultHashtags.slice(0, 3).join(" ")}</p>
                        )}
                      </div>
                    </div>
                    {disclaimer && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2.5">
                        <p className="text-[9px] leading-snug text-amber-800 dark:text-amber-200 italic">
                          <ShieldAlert className="h-2.5 w-2.5 inline mr-1" />
                          {disclaimer}
                        </p>
                      </div>
                    )}
                    {toneOfVoice && (
                      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5">
                        <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{toneOfVoice}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Social Tab */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <Share2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("brandKit.socialMedia", "Social Media")}</CardTitle>
                      <CardDescription className="text-xs">{t("brandKit.socialMediaDesc", "Clinic profiles on social platforms")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                          <Instagram className="h-3 w-3 text-white" />
                        </span>
                        <span className="text-xs font-medium">Instagram</span>
                      </div>
                      <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="@vasklinika" maxLength={100} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600">
                          <Facebook className="h-3 w-3 text-white" />
                        </span>
                        <span className="text-xs font-medium">Facebook</span>
                      </div>
                      <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="facebook.com/vasklinika" maxLength={100} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-black dark:bg-white">
                          <svg className="h-3 w-3 text-white dark:text-black" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
                          </svg>
                        </span>
                        <span className="text-xs font-medium">TikTok</span>
                      </div>
                      <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} placeholder="@vasklinika" maxLength={100} className="h-9 text-sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Hash className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("brandKit.defaultHashtags", "Default hashtags")}</CardTitle>
                      <CardDescription className="text-xs">
                        {t("brandKit.hashtagsCount", "{count}/20 · Added to AI posts", { count: defaultHashtags.length })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {defaultHashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {defaultHashtags.map((tag, idx) => (
                        <span key={idx} className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs transition-colors hover:border-destructive/30 hover:bg-destructive/5">
                          <span className="text-foreground">{tag}</span>
                          <button type="button" onClick={() => removeHashtag(idx)} className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive hover:text-white">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      {t("brandKit.noHashtags", "No hashtags yet. Add some or use suggestions below.")}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={newHashtag}
                        onChange={(e) => setNewHashtag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }}
                        placeholder={t("brandKit.addHashtag", "Add hashtag")}
                        maxLength={64}
                        className="h-9 pl-8 font-mono text-sm"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addHashtag} disabled={!newHashtag.trim()} className="h-9 gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      {t("brandKit.add", "Add")}
                    </Button>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2">{t("brandKit.suggestedHashtags", "Suggested hashtags")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {HASHTAG_SUGGESTIONS.filter((tag) => !defaultHashtags.includes(tag)).slice(0, 8).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addSuggestedHashtag(tag)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        >
                          <Plus className="h-2.5 w-2.5 text-muted-foreground" />
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="sticky top-24 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("brandKit.socialPreview", "Social Preview")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Tabs value={activePreviewTab} onValueChange={setActivePreviewTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="post" className="text-[10px]">
                          <ImageIcon className="h-3 w-3 mr-1" />
                          {t("brandKit.post", "Post")}
                        </TabsTrigger>
                        <TabsTrigger value="profile" className="text-[10px]">
                          <Share2 className="h-3 w-3 mr-1" />
                          {t("brandKit.profile", "Profile")}
                        </TabsTrigger>
                        <TabsTrigger value="story" className="text-[10px]">
                          <Video className="h-3 w-3 mr-1" />
                          {t("brandKit.story", "Story")}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="post" className="space-y-3 mt-3">
                        <div className="overflow-hidden rounded-lg border border-border">
                          <div className="flex items-center gap-2 p-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: brandColor }}>
                              {clinicInitials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10px] font-semibold">{socialInstagram || data.clinicName}</p>
                            </div>
                          </div>
                          <div className="flex h-28 items-center justify-center" style={{ background: `linear-gradient(160deg, ${brandColor}18, ${secondaryColor}60, ${brandColor}08)` }}>
                            <div className="text-center">
                              <p className="text-lg font-bold" style={{ color: brandColor }}>🐾</p>
                              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: brandColor }}>{data.clinicName}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5 p-2.5">
                            <p className="text-[10px] leading-relaxed text-foreground/80">
                              {t("brandKit.previewText", "Your pet deserves the best care.")} {t("brandKit.previewCta", "Book an appointment today!")}
                            </p>
                            {defaultHashtags.length > 0 && (
                              <p className="text-[9px] font-medium" style={{ color: brandColor }}>{defaultHashtags.slice(0, 5).join(" ")}</p>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="profile" className="space-y-3 mt-3">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-16 w-16 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: brandColor }}>
                              {clinicInitials}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold">{data.clinicName}</p>
                              <p className="text-[10px] text-muted-foreground">{socialInstagram || "@veterinarna_klinika"}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-sm font-bold">1.2K</p>
                              <p className="text-[9px] text-muted-foreground">Posts</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">856</p>
                              <p className="text-[9px] text-muted-foreground">Followers</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">124</p>
                              <p className="text-[9px] text-muted-foreground">Following</p>
                            </div>
                          </div>
                          <div className="rounded-md border border-border bg-muted/30 p-2">
                            <p className="text-[10px]">{toneOfVoice || t("brandKit.tonePlaceholder", "Veterinary clinic dedicated to your pet's health.")}</p>
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="story" className="space-y-3 mt-3">
                        <div className="aspect-[9/16] rounded-lg border border-border overflow-hidden relative" style={{ background: `linear-gradient(180deg, ${brandColor}, ${secondaryColor})` }}>
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            <div className="h-20 w-20 rounded-full border-4 border-white/30 flex items-center justify-center text-3xl font-bold text-white mb-4">
                              {clinicInitials}
                            </div>
                            <p className="text-lg font-bold text-white mb-2">{data.clinicName}</p>
                            <p className="text-sm text-white/90">{t("brandKit.previewCta", "Book an appointment today!")}</p>
                          </div>
                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden">
                              <div className="h-full w-3/4 bg-white rounded-full" />
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Guidelines Tab */}
        <TabsContent value="guidelines" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t("brandKit.brandGuidelines", "Brand Guidelines")}</CardTitle>
                    <CardDescription className="text-xs">{t("brandKit.guidelinesDesc", "Complete reference for your clinic's brand identity")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">{t("brandKit.colorUsage", "Color Usage")}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md shadow-sm" style={{ backgroundColor: brandColor }} />
                          <div>
                            <p className="text-sm font-medium">{t("brandKit.primary", "Primary")}</p>
                            <p className="text-xs font-mono text-muted-foreground">{brandColor}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px]">Buttons, Links, CTAs</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md border border-border shadow-sm" style={{ backgroundColor: secondaryColor }} />
                          <div>
                            <p className="text-sm font-medium">{t("brandKit.secondary", "Secondary")}</p>
                            <p className="text-xs font-mono text-muted-foreground">{secondaryColor}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px]">Backgrounds, Cards</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">{t("brandKit.typography", "Typography")}</h3>
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-baseline gap-2">
                        <Type className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">System Font Stack</span>
                      </div>
                      <p className="text-sm">Inter, system-ui, -apple-system, sans-serif</p>
                      <div className="pt-2 border-t">
                        <p className="text-lg font-bold" style={{ color: brandColor }}>Bold Headings</p>
                        <p className="text-sm font-medium">Medium Subheadings</p>
                        <p className="text-xs text-muted-foreground">Regular body text</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("brandKit.toneGuidelines", "Tone Guidelines")}</h3>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <MessageSquareText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{toneOfVoice || t("brandKit.notSet", "Not set")}</p>
                      </div>
                    </div>
                    {brandVoiceInstructions && (
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">AI Instructions:</p>
                        <p className="text-sm font-mono">{brandVoiceInstructions}</p>
                      </div>
                    )}
                  </div>
                </div>

                {disclaimer && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">{t("brandKit.legalDisclaimer", "Legal Disclaimer")}</h3>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <p className="text-sm text-amber-900 dark:text-amber-200">{disclaimer}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("brandKit.hashtagStrategy", "Hashtag Strategy")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {defaultHashtags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("brandKit.socialProfiles", "Social Profiles")}</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {socialInstagram && (
                      <div className="flex items-center gap-2 rounded-lg border p-2.5">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        <span className="text-sm">{socialInstagram}</span>
                      </div>
                    )}
                    {socialFacebook && (
                      <div className="flex items-center gap-2 rounded-lg border p-2.5">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{socialFacebook}</span>
                      </div>
                    )}
                    {socialTiktok && (
                      <div className="flex items-center gap-2 rounded-lg border p-2.5">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
                        </svg>
                        <span className="text-sm">{socialTiktok}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="flex items-center justify-between w-full">
                  <Button variant="outline" size="sm" onClick={copyBrandGuidelines} className="gap-2">
                    <Copy className="h-3.5 w-3.5" />
                    {t("brandKit.copyAll", "Copy All")}
                  </Button>
                  <Button size="sm" onClick={() => handleExport("json")} className="gap-2">
                    <Download className="h-3.5 w-3.5" />
                    {t("brandKit.exportJson", "Export JSON")}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
