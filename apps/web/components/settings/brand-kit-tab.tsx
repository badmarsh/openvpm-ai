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

const SECONDARY_PRESETS = [
  { hex: "#f5f5f4", label: "Piesok" },
  { hex: "#fafaf9", label: "Krémová" },
  { hex: "#f0fdf4", label: "Mäta" },
  { hex: "#eff6ff", label: "Ľadová" },
  { hex: "#fef3c7", label: "Medová" },
  { hex: "#fdf2f8", label: "Ružová" },
  { hex: "#1f2937", label: "Uhlíková" },
  { hex: "#374151", label: "Grafit" },
];

const TONE_PRESETS = [
  {
    label: "Fear-Free",
    value: "Fear-Free, empatický, profesionálny",
    icon: "🛡️",
  },
  {
    label: "Priateľský",
    value: "Priateľský, teplý, komunitne orientovaný",
    icon: "😊",
  },
  {
    label: "Náučný",
    value: "Náučný, jasný, založený na dôkazoch",
    icon: "🎓",
  },
  {
    label: "Hravý",
    value: "Hravý, ľahký, s humorom a emojis",
    icon: "🎨",
  },
];

export function BrandKitTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.getBrandKit.useQuery();
  const mutation = trpc.settings.updateBrandKit.useMutation({
    onSuccess: () => {
      utils.settings.getBrandKit.invalidate();
      utils.settings.getBranding.invalidate();
      toast.success("Brand Kit uložený");
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
          {saved ? "Uložené" : "Uložiť Brand Kit"}
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
                  <CardTitle className="text-base">Farebná paleta</CardTitle>
                  <CardDescription className="text-xs">
                    Primárna a sekundárna farba kliniky
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Primárna
                </label>
                <AccentColorPicker
                  value={brandColor}
                  onChange={setBrandColor}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sekundárna
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
                        title={p.label}
                      >
                        <span
                          className={cn(
                            "h-6 w-6 rounded-md border transition-transform",
                            active ? "scale-110" : "group-hover:scale-105",
                          )}
                          style={{ backgroundColor: p.hex }}
                        />
                        <span className="text-[9px] text-muted-foreground">
                          {p.label}
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
                      Vlastná
                    </span>
                  </label>
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
                  <CardTitle className="text-base">Tón komunikácie</CardTitle>
                  <CardDescription className="text-xs">
                    Ako značka hovorí s klientmi a na sociálnych sieťach
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tone presets */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rýchle predvoľby
                </label>
                <div className="flex flex-wrap gap-2">
                  {TONE_PRESETS.map((p) => {
                    const active = toneOfVoice === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setToneOfVoice(p.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                          active
                            ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-950/30 dark:text-violet-300"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Popis tónu</label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {toneOfVoice.length}/500
                  </span>
                </div>
                <textarea
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Napr. Súcitný, jasný, upokojujúci, komunitne orientovaný."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Pokyny pre AI generátor
                  </label>
                  <Badge variant="outline" className="text-[9px]">
                    Voliteľné
                  </Badge>
                </div>
                <textarea
                  value={brandVoiceInstructions}
                  onChange={(e) =>
                    setBrandVoiceInstructions(e.target.value)
                  }
                  maxLength={2000}
                  rows={4}
                  placeholder="Detailné inštrukcie pre AI. Napr. 'Nikdy nepoužívaj lekárske termíny bez vysvetlenia. Vždy pridaj CTA na objednanie. Vyhni sa slovu lacný.'"
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
                  <CardTitle className="text-base">Disclaimer</CardTitle>
                  <CardDescription className="text-xs">
                    Automaticky sa pridáva na edukačné príspevky
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
                placeholder="Len pre všeobecné informácie o zdraví zvierat."
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
                  <CardTitle className="text-base">Sociálne siete</CardTitle>
                  <CardDescription className="text-xs">
                    Profily kliniky na sociálnych platformách
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
                    Predvolené hashtagy
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {defaultHashtags.length}/20 · Pridávajú sa k AI
                    príspevkom
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
                    placeholder="pridať hashtag"
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
                  Pridať
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
                    <span className="font-semibold">Náhľad príspevku</span>
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
                      Vaše zvieratko si zaslúži najlepšiu starostlivosť.
                      Objednajte sa ešte dnes!
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
                  <p className="text-[10px] font-medium">Primárna</p>
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
                  <p className="text-[10px] font-medium">Sekundárna</p>
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
