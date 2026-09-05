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
} from "@/components/ui/card";
import { AccentColorPicker } from "@/components/brand/accent-color-picker";
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
  {
    name: "Vercel",
    primary: "#000000",
    secondary: "#fafafa",
    description: "Monochrome",
  },
  {
    name: "Supabase",
    primary: "#3ecf8e",
    secondary: "#1c1c1c",
    description: "Green & Dark",
  },
  {
    name: "Linear",
    primary: "#5e6ad2",
    secondary: "#f8f9fc",
    description: "Indigo",
  },
  {
    name: "Stripe",
    primary: "#635bff",
    secondary: "#f6f9fc",
    description: "Violet",
  },
  {
    name: "Notion",
    primary: "#2383e2",
    secondary: "#f7f7f5",
    description: "Blue & Warm",
  },
  {
    name: "Railway",
    primary: "#8a4baf",
    secondary: "#f5f0fa",
    description: "Purple",
  },
  {
    name: "OpenVPM",
    primary: "#0d9488",
    secondary: "#f5f5f4",
    description: "Teal & Sand",
  },
  {
    name: "Rose Gold",
    primary: "#8b2635",
    secondary: "#fdf2f8",
    description: "Maroon & Blush",
  },
];

const TONE_PRESETS = [
  {
    i18nKey: "brandKit.toneFearFree",
    value: "brandKit.toneFearFreeValue",
    icon: "🛡️",
  },
  {
    i18nKey: "brandKit.toneFriendly",
    value: "brandKit.toneFriendlyValue",
    icon: "😊",
  },
  {
    i18nKey: "brandKit.toneEducational",
    value: "brandKit.toneEducationalValue",
    icon: "🎓",
  },
  {
    i18nKey: "brandKit.tonePlayful",
    value: "brandKit.tonePlayfulValue",
    icon: "🎨",
  },
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
    if (
      defaultHashtags.some((t) => t.toLowerCase() === `#${tag.toLowerCase()}`)
    )
      return;
    setDefaultHashtags([...defaultHashtags, `#${tag}`]);
    setNewHashtag("");
  }

  function removeHashtag(index: number) {
    setDefaultHashtags(defaultHashtags.filter((_, i) => i !== index));
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
      {/* Sticky save bar */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={mutation.isPending}
          className={cn(
            "gap-2 transition-all",
            saved && "bg-emerald-600 hover:bg-emerald-700 text-white",
          )}
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

      {/* Brand color banner */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{
          background: `linear-gradient(90deg, ${brandColor}, ${secondaryColor})`,
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ── Left: Form sections ── */}
        <div className="space-y-6">
          {/* Color Palette */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${brandColor}15` }}
                >
                  <Palette className="h-4.5 w-4.5" style={{ color: brandColor }} />
                </div>
                <div>
                  <CardTitle className="text-base">{t("brandKit.colorPalette", "Color Palette")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("brandKit.colorPaletteDesc", "Primary and secondary clinic colors")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("brandKit.primary", "Primary")}
                </label>
                <AccentColorPicker
                  value={brandColor}
                  onChange={setBrandColor}
                />
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
                          active
                            ? "border-foreground shadow-sm"
                            : "border-transparent hover:border-border hover:shadow-xs",
                        )}
                        title={t(p.i18nKey)}
                      >
                        <span
                          className={cn(
                            "h-6 w-6 rounded-md border transition-transform",
                            active ? "scale-110" : "group-hover:scale-105",
                          )}
                          style={{ backgroundColor: p.hex }}
                        />
                        <span className="text-[9px] text-muted-foreground">
                          {t(p.i18nKey)}
                        </span>
                      </button>
                    );
                  })}
                  <label className="flex flex-col items-center gap-1 cursor-pointer rounded-lg border border-dashed border-border px-2 py-1.5 transition-all hover:border-foreground/30">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded-md border-0 p-0"
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {t("brandKit.custom", "Custom")}
                    </span>
                  </label>
                </div>
              </div>

              {/* Theme Presets */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("brandKit.themes", "Themes")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEME_PRESETS.map((theme) => {
                    const isActive =
                      brandColor === theme.primary &&
                      secondaryColor === theme.secondary;
                    return (
                      <button
                        key={theme.name}
                        type="button"
                        onClick={() => {
                          setBrandColor(theme.primary);
                          setSecondaryColor(theme.secondary);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                          isActive
                            ? "border-foreground shadow-sm ring-1 ring-foreground/20"
                            : "border-border hover:border-foreground/30 hover:shadow-xs",
                        )}
                      >
                        <div className="flex shrink-0 -space-x-1">
                          <div
                            className="h-5 w-5 rounded-full border-2 border-card"
                            style={{ backgroundColor: theme.primary }}
                          />
                          <div
                            className="h-5 w-5 rounded-full border-2 border-card"
                            style={{ backgroundColor: theme.secondary }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold truncate">
                            {theme.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground truncate">
                            {theme.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color strip preview */}
              <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex gap-2">
                  <div
                    className="h-12 w-12 rounded-lg shadow-inner"
                    style={{ backgroundColor: brandColor }}
                  />
                  <div
                    className="h-12 w-12 rounded-lg border border-border shadow-inner"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>
                <div className="flex flex-col justify-center gap-0.5 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {brandColor} · {secondaryColor}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    Gradient preview
                  </span>
                </div>
                <div className="ml-auto flex items-end">
                  <div
                    className="h-4 w-24 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${brandColor}, ${secondaryColor})`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tone of Voice */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
                  <MessageSquareText className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("brandKit.toneOfVoice", "Tone of Voice")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("brandKit.toneOfVoiceDesc", "How the brand speaks to clients and on social media")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tone presets */}
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
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                          active
                            ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-950/30 dark:text-violet-300"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {toneOfVoice.length}/500
                  </span>
                </div>
                <textarea
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder={t("brandKit.tonePlaceholder", "e.g. Compassionate, clear, calming, community-oriented.")}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {t("brandKit.aiInstructions", "AI Generator Instructions")}
                  </label>
                  <Badge variant="outline" className="text-[9px]">
                    {t("brandKit.optional", "Optional")}
                  </Badge>
                </div>
                <textarea
                  value={brandVoiceInstructions}
                  onChange={(e) =>
                    setBrandVoiceInstructions(e.target.value)
                  }
                  maxLength={2000}
                  rows={4}
                  placeholder={t("brandKit.aiInstructionsPlaceholder", "Detailed instructions for AI. e.g. 'Never use medical terms without explanation. Always add a booking CTA. Avoid the word cheap.'")}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <div className="flex justify-end">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {brandVoiceInstructions.length}/2000
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("brandKit.disclaimer", "Disclaimer")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("brandKit.disclaimerDesc", "Automatically added to educational posts")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                value={disclaimer}
                onChange={(e) => setDisclaimer(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={t("brandKit.disclaimerPlaceholder", "For general animal health information only.")}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </CardContent>
          </Card>

          {/* Social Handles */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <Share2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("brandKit.socialMedia", "Social Media")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("brandKit.socialMediaDesc", "Clinic profiles on social platforms")}
                  </CardDescription>
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
                  <Input
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="@vasklinika"
                    maxLength={100}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600">
                      <svg
                        className="h-3 w-3 text-white"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </span>
                    <span className="text-xs font-medium">Facebook</span>
                  </div>
                  <Input
                    value={socialFacebook}
                    onChange={(e) => setSocialFacebook(e.target.value)}
                    placeholder="facebook.com/vasklinika"
                    maxLength={100}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-black dark:bg-white">
                      <svg
                        className="h-3 w-3 text-white dark:text-black"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
                      </svg>
                    </span>
                    <span className="text-xs font-medium">TikTok</span>
                  </div>
                  <Input
                    value={socialTiktok}
                    onChange={(e) => setSocialTiktok(e.target.value)}
                    placeholder="@vasklinika"
                    maxLength={100}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Hashtags */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <Hash className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {t("brandKit.defaultHashtags", "Default hashtags")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("brandKit.hashtagsCount", "{count}/20 · Added to AI posts", { count: defaultHashtags.length })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {defaultHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {defaultHashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs transition-colors hover:border-destructive/30 hover:bg-destructive/5"
                    >
                      <span className="text-foreground">{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeHashtag(idx)}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                    placeholder={t("brandKit.addHashtag", "Add hashtag")}
                    maxLength={64}
                    className="h-9 pl-8 font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHashtag}
                  disabled={!newHashtag.trim()}
                  className="h-9 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("brandKit.add", "Add")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="space-y-4">
          <div className="sticky top-24 space-y-4">
            {/* Preview card */}
            <Card className="overflow-hidden">
              {/* Brand banner */}
              <div
                className="relative h-20"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc, ${secondaryColor})`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
                      {clinicInitials}
                    </div>
                    <span className="text-sm font-bold text-white drop-shadow-sm">
                      {data.clinicName}
                    </span>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Sparkles
                      className="h-3.5 w-3.5"
                      style={{ color: brandColor }}
                    />
                    <span className="font-semibold">{t("brandKit.postPreview", "Post Preview")}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    Instagram
                  </Badge>
                </div>

                {/* Mock post */}
                <div className="overflow-hidden rounded-lg border border-border">
                  {/* Post header */}
                  <div className="flex items-center gap-2 p-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: brandColor }}
                    >
                      {clinicInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold">
                        {socialInstagram || data.clinicName}
                      </p>
                    </div>
                  </div>

                  {/* Post image area */}
                  <div
                    className="flex h-28 items-center justify-center"
                    style={{
                      background: `linear-gradient(160deg, ${brandColor}18, ${secondaryColor}60, ${brandColor}08)`,
                    }}
                  >
                    <div className="text-center">
                      <p
                        className="text-lg font-bold"
                        style={{ color: brandColor }}
                      >
                        🐾
                      </p>
                      <p
                        className="mt-0.5 text-[10px] font-semibold"
                        style={{ color: brandColor }}
                      >
                        {data.clinicName}
                      </p>
                    </div>
                  </div>

                  {/* Post caption */}
                  <div className="space-y-1.5 p-2.5">
                    <p className="text-[10px] leading-relaxed text-foreground/80">
                      {t("brandKit.previewText", "Your pet deserves the best care.")}
                      {" "}
                      {t("brandKit.previewCta", "Book an appointment today!")}
                    </p>
                    {defaultHashtags.length > 0 && (
                      <p className="text-[9px] font-medium" style={{ color: brandColor }}>
                        {defaultHashtags.slice(0, 5).join(" ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Disclaimer preview */}
                {disclaimer && (
                  <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                    <p className="text-[9px] leading-snug italic text-muted-foreground">
                      {disclaimer}
                    </p>
                  </div>
                )}

                {/* Tone badge */}
                {toneOfVoice && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {toneOfVoice}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick color reference */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                <div
                  className="h-6 w-6 rounded-md shadow-sm"
                  style={{ backgroundColor: brandColor }}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium">{t("brandKit.primary", "Primary")}</p>
                  <p className="truncate font-mono text-[9px] text-muted-foreground">
                    {brandColor}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
                <div
                  className="h-6 w-6 rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: secondaryColor }}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium">{t("brandKit.secondary", "Secondary")}</p>
                  <p className="truncate font-mono text-[9px] text-muted-foreground">
                    {secondaryColor}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
