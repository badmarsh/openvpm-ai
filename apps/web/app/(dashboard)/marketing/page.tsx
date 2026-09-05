"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Sparkles,
  Copy,
  Check,
  Download,
  Share2,
  Heart,
  MessageCircle,
  ThumbsUp,
  Sliders,
  Calendar,
  Send,
  Loader2,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Info,
  Palette,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChannelType = "instagram" | "facebook" | "sms" | "email";
type ToneType = "friendly" | "educational" | "professional" | "urgent";

export default function MarketingStudioPage() {
  const [selectedTopic, setSelectedTopic] = useState("Kliešte a blchy na Slovensku, prevencia babeziózy");
  const [selectedTone, setSelectedTone] = useState<ToneType>("friendly");
  const [targetAudience, setTargetAudience] = useState("Všetci majitelia psov a mačiek");
  const [activeChannel, setActiveChannel] = useState<ChannelType>("instagram");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  // tRPC queries & mutations
  const templatesQuery = trpc.extensions.marketing.listTemplates.useQuery();
  const generatePostMutation = trpc.extensions.marketing.generatePost.useMutation();
  const brandKitQuery = trpc.settings.getBrandKit.useQuery();

  const clinicName = brandKitQuery.data?.clinicName || "Veterinárna Klinika";
  const igHandle = brandKitQuery.data?.socialHandles?.instagram
    ? brandKitQuery.data.socialHandles.instagram.replace(/^@/, "")
    : "veterinarna_klinika_sr";
  const clinicInitials = clinicName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "VET";

  // Generated content state
  const [posts, setPosts] = useState<{
    instagram: string;
    facebook: string;
    sms: string;
    emailSubject: string;
    emailBody: string;
    usedAi?: boolean;
  }>({
    instagram: `🌲 Pozor na kliešte a blchy! 🐾\n\nVedeli ste, že kliešte na Slovensku prenášajú nebezpečnú babeziózu? Ochrana vášho chlpáča je teraz dôležitejšia než kedykoľvek predtým.\n\n🛡️ Odporúčame:\n• Ochutené žuvacie tablety\n• Kvalitné pipety (spot-on)\n• Antiparazitárne obojky\n\nZastavte sa u nás na klinike pre bezpečný výber na mieru pre vášho psíka či mačičku! 🐶🐱\n\n#veterinar #kliestie #zdraviezvierat #ochranapsa #babezoza`,
    facebook: `🌲 Kliešte sú späť – chráňte svojich miláčikov včas!\n\nS oteplením začína hlavná sezóna vonkajších ektoparazitov. Po každej prechádzke v tráve alebo lese dôkladne skontrolujte slabiny, uši a medziprstie vášho psa.\n\nV našej veterinárnej ambulancii máme k dispozícii kompletný sortiment certifikovaných veterinárnych antiparazitík s overenou účinnosťou.\n\n📞 Objednajte sa alebo sa zastavte osobne. Radi vám pomôžeme s výberom bezpečnej ochrany.`,
    sms: `Veterinárna klinika: Začala sezóna kliešťov! Nezabudnite na antiparazitárnu ochranu pre vášho psíka/mačku. Zastavte sa u nás pre vhodné tablety či pipety.`,
    emailSubject: `Kliešte sú späť: Ako ochrániť vášho miláčika pred babeziózou?`,
    emailBody: `Vážení majitelia zvieratiek,\n\ns príchodom teplejších dní stúpa aktivita kliešťov na celom území Slovenska. Kliešte prenášajú závažné ochorenia ako babezióza, anaplazmóza a lymská borelióza.\n\nV našej klinike vám ponúkame odbornú konzultáciu a výber antiparazitika podľa životného štýlu vášho zvieraťa.\n\nTešíme sa na vašu návštevu!`,
  });

  const handleSelectTemplate = (templateId: string) => {
    const t = templatesQuery.data?.find((tpl) => tpl.id === templateId);
    if (!t) return;
    setSelectedTopic(t.defaultTopic);
    setTargetAudience(t.targetAudience);
    setPosts({
      instagram: t.sampleInstagram,
      facebook: t.sampleFacebook,
      sms: t.sampleSms,
      emailSubject: t.sampleEmailSubject,
      emailBody: t.sampleEmailBody,
      usedAi: false,
    });
    toast.success(`Kampaň „${t.title}“ bola načítaná`);
  };

  const handleGenerate = async () => {
    if (!selectedTopic.trim()) {
      toast.warning("Zadajte tému alebo kľúčové slová pre príspevok");
      return;
    }

    try {
      const result = await generatePostMutation.mutateAsync({
        topic: selectedTopic,
        channel: "all",
        tone: selectedTone,
        targetAudience: targetAudience || undefined,
        clinicName: brandKitQuery.data?.clinicName || undefined,
      });

      setPosts({
        instagram: result.instagram || "",
        facebook: result.facebook || "",
        sms: result.sms || "",
        emailSubject: result.emailSubject || "",
        emailBody: result.emailBody || "",
        usedAi: result.usedAi,
      });

      toast.success(
        result.usedAi
          ? "Príspevky boli úspešne vygenerované pomocou Gemini AI"
          : "Príspevky boli pripravené z klinickej šablóny"
      );
    } catch (err) {
      toast.error("Nepodarilo sa vygenerovať príspevok. Skúste znova.");
    }
  };

  const handleCopyText = (channel: ChannelType) => {
    let textToCopy = "";
    if (channel === "instagram") textToCopy = posts.instagram;
    else if (channel === "facebook") textToCopy = posts.facebook;
    else if (channel === "sms") textToCopy = posts.sms;
    else if (channel === "email") {
      textToCopy = `Predmet: ${posts.emailSubject}\n\n${posts.emailBody}`;
    }

    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedChannel(channel);
    toast.success("Text príspevku bol skopírovaný do schránky");
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  const handleDownloadTxt = () => {
    const fullContent = `=== INSTAGRAM ===\n${posts.instagram}\n\n=== FACEBOOK ===\n${posts.facebook}\n\n=== SMS ===\n${posts.sms}\n\n=== EMAIL ===\nPredmet: ${posts.emailSubject}\n\n${posts.emailBody}`;
    const blob = new Blob([fullContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `veterinarna_kampan_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Kampaň bola stiahnutá ako textový súbor");
  };

  const isGenerating = generatePostMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Marketing Studio & Kampane
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono gap-1 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                  <Sparkles className="h-2.5 w-2.5" /> Gemini Copywriter
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Tvorba edukačných a sezónnych príspevkov na sociálne siete, SMS a newslettery pre majiteľov zvierat.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
            >
              <Palette className="h-3.5 w-3.5 text-rose-500" />
              <span>Brand Kit kliniky</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTxt}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Stiahnuť kampaň (.txt)</span>
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Presets & Controls) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Preset Clinical Campaigns */}
          <div className="rounded-xl border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" />
                <span>Odporúčané klinické kampane</span>
              </h3>
              <span className="text-[11px] text-muted-foreground">Kliknite pre výber</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templatesQuery.data?.map((tpl) => {
                const isSelected = selectedTopic === tpl.defaultTopic;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5",
                      isSelected
                        ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 shadow-xs"
                        : "border-border bg-card hover:bg-muted/40 text-foreground"
                    )}
                  >
                    <div>
                      <span className="font-semibold text-xs line-clamp-1 block">
                        {tpl.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {tpl.category} • {tpl.season}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {tpl.targetAudience}
                      </Badge>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Generator Settings */}
          <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sliders className="h-4 w-4 text-violet-500" />
                <span>Nastavenia generátora</span>
              </h3>
              <Badge variant="outline" className="text-[10px]">
                Slovenčina (SK)
              </Badge>
            </div>

            {/* Topic input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Téma príspevku alebo vlastné zadanie
              </label>
              <textarea
                rows={3}
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                placeholder="Napr. Prečo nepodávať psovi čokoládu cez sviatky..."
                className="w-full rounded-xl border bg-muted/20 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none leading-relaxed"
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Cieľová skupina majiteľov
              </label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Napr. Majitelia mačiek, psíkov seniorov..."
                className="h-8 text-xs"
              />
            </div>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Tón komunikácie
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "friendly", label: "Priateľský & Empatický" },
                  { id: "educational", label: "Náučný & Vzdelávací" },
                  { id: "professional", label: "Odborný & Medicínsky" },
                  { id: "urgent", label: "Naliehavý & Varovný" },
                ].map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant={selectedTone === t.id ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs justify-center",
                      selectedTone === t.id && "bg-rose-600 hover:bg-rose-700 text-white"
                    )}
                    onClick={() => setSelectedTone(t.id as ToneType)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-md shadow-rose-500/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gemini generuje príspevky...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Vygenerovať multikanálovú kampaň</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column (Channel Previews) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Channel Tabs */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5">
              {[
                { id: "instagram", label: "Instagram", icon: "📸" },
                { id: "facebook", label: "Facebook", icon: "📘" },
                { id: "sms", label: "SMS", icon: "💬" },
                { id: "email", label: "Email Newsletter", icon: "✉️" },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeChannel === tab.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs gap-1.5 rounded-lg",
                    activeChannel === tab.id && "bg-rose-600 text-white hover:bg-rose-700"
                  )}
                  onClick={() => setActiveChannel(tab.id as ChannelType)}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => handleCopyText(activeChannel)}
            >
              {copiedChannel === activeChannel ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Skopírované</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Kopírovať text</span>
                </>
              )}
            </Button>
          </div>

          {/* 1. Instagram Preview Card */}
          {activeChannel === "instagram" && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm max-w-lg mx-auto space-y-3">
              {/* Profile Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[2px]">
                    <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-[10px] font-bold">
                      {clinicInitials}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-foreground block">
                      {igHandle}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{clinicName}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Instagram Feed
                </Badge>
              </div>

              {/* Mock Image Placeholder */}
              <div className="aspect-square w-full rounded-xl bg-gradient-to-tr from-rose-100 via-purple-100 to-sky-100 dark:from-rose-950/40 dark:via-purple-950/40 dark:to-sky-950/40 flex flex-col items-center justify-center text-center p-6 border">
                <div className="h-16 w-16 rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center text-3xl shadow-sm mb-3">
                  🐾
                </div>
                <h4 className="font-bold text-sm text-foreground max-w-xs leading-snug">
                  {selectedTopic}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Veterinárna starostlivosť a prevencia
                </p>
              </div>

              {/* Actions Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-rose-500 fill-rose-500 cursor-pointer" />
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  <Send className="h-4 w-4 text-muted-foreground" />
                </div>
                <Bookmark className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Text Caption */}
              <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pt-1 font-sans">
                <span className="font-semibold mr-1">{igHandle}</span>
                {posts.instagram}
              </div>
            </div>
          )}

          {/* 2. Facebook Preview Card */}
          {activeChannel === "facebook" && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm max-w-lg mx-auto space-y-3">
              {/* Profile Header */}
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {clinicInitials}
                </div>
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    {clinicName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Práve teraz • 🌍 Verejné</span>
                </div>
              </div>

              {/* Post Content */}
              <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {posts.facebook}
              </div>

              {/* Mock Banner */}
              <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">
                    Objednanie termínu online
                  </span>
                  <h5 className="font-semibold text-xs text-foreground">
                    Preventívna prehliadka v našej ambulancii
                  </h5>
                </div>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  Rezervovať
                </Button>
              </div>

              {/* Engagement Bar */}
              <div className="flex items-center justify-around border-t pt-2 text-muted-foreground text-xs">
                <button className="flex items-center gap-1.5 hover:text-blue-600">
                  <ThumbsUp className="h-4 w-4" />
                  <span>Páči sa mi to</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span>Komentovať</span>
                </button>
                <button className="flex items-center gap-1.5 hover:text-foreground">
                  <Share2 className="h-4 w-4" />
                  <span>Zdieľať</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. SMS Preview Card */}
          {activeChannel === "sms" && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                <span>Náhľad SMS notifikácie</span>
                <span>{posts.sms.length} / 160 znakov</span>
              </div>

              {/* Mobile Phone Message Bubble */}
              <div className="rounded-2xl bg-muted/40 p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-xs space-y-2">
                  <div className="text-center text-[10px] text-muted-foreground">
                    Dnes 14:30
                  </div>
                  <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-xs p-3.5 text-xs leading-relaxed shadow-sm">
                    {posts.sms}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-blue-500 shrink-0" />
                <span>
                  SMS správu môžete odoslať v sekcii <strong>Pripomienky & Notifikácie</strong> vybraným klientom.
                </span>
              </div>
            </div>
          )}

          {/* 4. Email Newsletter Preview */}
          {activeChannel === "email" && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
              <div className="border-b pb-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-muted-foreground w-16">Predmet:</span>
                  <span className="font-semibold text-foreground text-sm">
                    {posts.emailSubject}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold w-16">Odosielateľ:</span>
                  <span>{clinicName} &lt;info@veterina.sk&gt;</span>
                </div>
              </div>

              {/* Email Body */}
              <div className="rounded-xl border bg-muted/20 p-5 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                {posts.emailBody}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Pripravené pre hromadný emailový newsletter</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCopyText("email")}>
                  Skopírovať email
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
