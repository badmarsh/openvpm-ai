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
  Instagram,
  Facebook,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccentColorPicker } from "@/components/brand/accent-color-picker";
import { toast } from "sonner";

const SECONDARY_PRESETS = [
  "#f5f5f4",
  "#fafaf9",
  "#f0fdf4",
  "#eff6ff",
  "#fef3c7",
  "#fdf2f8",
  "#1f2937",
  "#374151",
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
    if (defaultHashtags.some((t) => t.toLowerCase() === `#${tag.toLowerCase()}`))
      return;
    setDefaultHashtags([...defaultHashtags, `#${tag}`]);
    setNewHashtag("");
  }

  function removeHashtag(index: number) {
    setDefaultHashtags(defaultHashtags.filter((_, i) => i !== index));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Brand Kit</h3>
          <p className="text-xs text-muted-foreground">
            Identita kliniky, tón komunikácie a vizuálny štýl pre AI generovanie
            obsahu.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saved ? "Uložené" : "Uložiť Brand Kit"}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Color Palette */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Farebná paleta</h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Primárna farba</span>
                <AccentColorPicker
                  value={brandColor}
                  onChange={setBrandColor}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Sekundárna farba</span>
                <div className="flex items-center gap-2">
                  {SECONDARY_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSecondaryColor(c)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform ${
                        secondaryColor === c
                          ? "scale-110 border-foreground"
                          : "border-border hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {secondaryColor === c && (
                        <Check className="h-3 w-3 text-foreground" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                  <div className="relative ml-1">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded-full border border-border p-0.5"
                      title="Vlastná farba"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
                <div
                  className="h-10 w-10 rounded-lg border border-border"
                  style={{ backgroundColor: brandColor }}
                />
                <div
                  className="h-10 w-10 rounded-lg border border-border"
                  style={{ backgroundColor: secondaryColor }}
                />
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{brandColor}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{secondaryColor}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Tone of Voice */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Tón komunikácie</h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">
                  Krátky popis tónu
                </span>
                <textarea
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Napr. Súcitný, jasný, upokojujúci, komunitne orientovaný."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  {toneOfVoice.length}/500 znakov
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">
                  Pokyny pre AI (voliteľné)
                </span>
                <textarea
                  value={brandVoiceInstructions}
                  onChange={(e) => setBrandVoiceInstructions(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Detailné inštrukcie pre AI generovanie obsahu. Napr. 'Nikdy nepoužívaj lekárske termíny bez vysvetlenia. Vždy pridaj CTA na objednanie.'"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  {brandVoiceInstructions.length}/2000 znakov
                </p>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">
                Povinný disclaimer
              </h4>
            </div>
            <textarea
              value={disclaimer}
              onChange={(e) => setDisclaimer(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Len pre všeobecné informácie o zdraví zvierat."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Pridáva sa automaticky na edukačné príspevky.
            </p>
          </section>

          {/* Social Handles */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Sociálne siete</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                  Instagram
                </span>
                <Input
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="@vasklinika"
                  maxLength={100}
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Facebook className="h-3.5 w-3.5 text-muted-foreground" />
                  Facebook
                </span>
                <Input
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  placeholder="facebook.com/vasklinika"
                  maxLength={100}
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <svg
                    className="h-3.5 w-3.5 text-muted-foreground"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
                  </svg>
                  TikTok
                </span>
                <Input
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="@vasklinika"
                  maxLength={100}
                />
              </label>
            </div>
          </section>

          {/* Default Hashtags */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Predvolené hashtagy</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {defaultHashtags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(idx)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHashtag();
                  }
                }}
                placeholder="Pridať hashtag..."
                maxLength={64}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHashtag}
                disabled={!newHashtag.trim()}
              >
                Pridať
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {defaultHashtags.length}/20 hashtagov. Používajú sa pri AI
              generovaní príspevkov.
            </p>
          </section>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 border-b border-border pb-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">
                Náhľad brand karty
              </span>
            </div>

            {/* Mock social post */}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-3 bg-card p-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {data.clinicName?.charAt(0) ?? "V"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {data.clinicName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {socialInstagram || "vaša klinika"}
                  </p>
                </div>
              </div>

              <div
                className="flex h-32 items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}22, ${secondaryColor})`,
                }}
              >
                <div className="text-center">
                  <div
                    className="mx-auto mb-2 h-8 w-8 rounded-full"
                    style={{ backgroundColor: brandColor }}
                  />
                  <p
                    className="text-xs font-bold"
                    style={{ color: brandColor }}
                  >
                    {data.clinicName}
                  </p>
                </div>
              </div>

              <div className="space-y-2 bg-card p-3">
                <p className="text-[11px] leading-relaxed text-foreground">
                  Vaše zvieratko si zaslúži tú najlepšiu starostlivosť.
                  Objednajte sa na preventívnu prehliadku ešte dnes! 🐾
                </p>
                <div className="flex flex-wrap gap-1">
                  {defaultHashtags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium"
                      style={{ color: brandColor }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-[9px] italic text-muted-foreground">
                    {disclaimer || "Disclaimer sa zobrazí tu..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Color swatch summary */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2 rounded-md border border-border p-2">
                <div
                  className="h-5 w-5 rounded"
                  style={{ backgroundColor: brandColor }}
                />
                <div>
                  <p className="font-medium">Primárna</p>
                  <p className="font-mono text-muted-foreground">
                    {brandColor}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border p-2">
                <div
                  className="h-5 w-5 rounded border"
                  style={{ backgroundColor: secondaryColor }}
                />
                <div>
                  <p className="font-medium">Sekundárna</p>
                  <p className="font-mono text-muted-foreground">
                    {secondaryColor}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/50 p-2">
              <p className="text-[10px] font-medium text-muted-foreground">
                Tón: {toneOfVoice || "Nenastavený"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
