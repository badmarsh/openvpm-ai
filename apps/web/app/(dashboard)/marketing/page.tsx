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
  ImageIcon,
  Video,
  Play,
  RefreshCw,
  Tv,
  HeartHandshake,
  Mail,
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

  // Alibaba Proxy media generation state
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoStatusText, setVideoStatusText] = useState<string | null>(null);

  // tRPC queries & mutations
  const utils = trpc.useUtils();
  const templatesQuery = trpc.extensions.marketing.listTemplates.useQuery();
  const generatePostMutation = trpc.extensions.marketing.generatePost.useMutation();
  const brandKitQuery = trpc.settings.getBrandKit.useQuery();
  const aliStatusQuery = trpc.extensions.marketing.getAlibabaProxyStatus.useQuery();
  const generateImageMutation = trpc.extensions.marketing.generateImage.useMutation();
  const submitVideoMutation = trpc.extensions.marketing.submitVideo.useMutation();
  const createTvSlideMutation = trpc.extensions.marketing.createTvSlide.useMutation({
    onSuccess: () => {
      toast.success("Kampaň bola pridaná na TV obrazovku v čakárni!");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa vytvoriť TV slajd");
    },
  });

  const staffTasksQuery = trpc.extensions.marketing.listStaffTasks.useQuery({ status: "open" });
  const resolveTaskMutation = trpc.extensions.marketing.resolveStaffTask.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listStaffTasks.invalidate();
      toast.success("Úloha bola označená ako vybavená.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa aktualizovať úlohu.");
    },
  });
  const sendCondolenceMutation = trpc.extensions.marketing.sendCondolenceCard.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listStaffTasks.invalidate();
      toast.success("Kondolenčná správa bola zaradená a odoslaná.");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa odoslať kondolenciu.");
    },
  });

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

  const handleGenerateImage = async () => {
    if (!selectedTopic.trim()) {
      toast.warning("Zadajte tému pre vizuál");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const prompt = `Veterinary clinic social media visual: ${selectedTopic}. Clean, professional veterinary photography, healthy animal, fear-free clinic, soft warm lighting, high quality.`;
      const res = await generateImageMutation.mutateAsync({
        prompt,
        model: "wanx2.1-t2i-turbo",
      });
      if (res.url) {
        setGeneratedImageUrl(res.url);
        setGeneratedVideoUrl(null);
        toast.success("Obrázok bol vygenerovaný cez Alibaba Wanx 2.1 (Qwen 3 Pro)!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Chyba pri generovaní obrázka cez Alibaba proxy.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedTopic.trim()) {
      toast.warning("Zadajte tému pre video");
      return;
    }
    setIsVideoLoading(true);
    setVideoStatusText("Odosielam požiadavku na Wan 2.1...");
    try {
      const prompt = `Cinematic veterinary video: ${selectedTopic}. High quality, smooth movement, clean bright clinic.`;
      const submitRes = await submitVideoMutation.mutateAsync({
        prompt,
        model: "wan2.1-t2v-turbo",
      });

      setVideoStatusText("Spracovávam na GPU...");
      toast.info("Úloha generovania videa bola zaradená do fronty.");

      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await utils.extensions.marketing.pollVideo.fetch({ taskId: submitRes.taskId });
          if (pollRes.status === "SUCCEEDED" && pollRes.videoUrl) {
            clearInterval(pollInterval);
            setGeneratedVideoUrl(pollRes.videoUrl);
            setGeneratedImageUrl(null);
            setIsVideoLoading(false);
            setVideoStatusText(null);
            toast.success("Video bolo úspešne vygenerované cez Alibaba Wan 2.1 (Wan 30)!");
          } else if (pollRes.status === "FAILED" || pollRes.status === "CANCELED") {
            clearInterval(pollInterval);
            setIsVideoLoading(false);
            setVideoStatusText(null);
            toast.error(pollRes.error || "Generovanie videa zlyhalo.");
          } else {
            setVideoStatusText(`Spracovanie videa (${pollRes.status.toLowerCase()})...`);
          }
        } catch {
          // ignore transient errors
        }

        if (Date.now() - startTime > 120_000) {
          clearInterval(pollInterval);
          setIsVideoLoading(false);
          setVideoStatusText(null);
          toast.warning("Generovanie videa trvá dlhšie ako zvyčajne. Skontrolujte neskôr.");
        }
      }, 3500);
    } catch (err: any) {
      setIsVideoLoading(false);
      setVideoStatusText(null);
      toast.error(err?.message || "Chyba pri odoslaní videa na Alibaba proxy");
    }
  };

  const handleSendToTv = () => {
    if (!selectedTopic.trim()) {
      toast.warning("Zadajte tému kampane");
      return;
    }
    createTvSlideMutation.mutate({
      title: selectedTopic,
      body: posts.facebook || posts.instagram || "Veterinárna starostlivosť a prevencia",
      durationSeconds: 15,
      sortOrder: 0,
    });
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">
                  Marketing Studio & Kampane
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono gap-1 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                  <Sparkles className="h-2.5 w-2.5" /> Gemini Copywriter
                </Badge>
                {aliStatusQuery.data?.isConfigured && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono gap-1",
                      aliStatusQuery.data.online
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                    )}
                    title={`Alibaba Proxy (${aliStatusQuery.data.baseUrl}): ${aliStatusQuery.data.online ? "Online" : aliStatusQuery.data.error || "Offline"}`}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        aliStatusQuery.data.online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      )}
                    />
                    AliProxy (Wanx 2.1 & Wan 2.1): {aliStatusQuery.data.online ? "Online" : "Offline"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tvorba edukačných a sezónnych príspevkov na sociálne siete, SMS a newslettery pre majiteľov zvierat.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/marketing/brand-kit">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
            >
              <Palette className="h-3.5 w-3.5 text-rose-500" />
              <span>Brand Kit kliniky</span>
            </Button>
          </Link>
          <Link href="/marketing/tv">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-purple-200 dark:border-purple-900/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
            >
              <Tv className="h-3.5 w-3.5 text-purple-500" />
              <span>TV Čakáreň</span>
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

      {/* Staff Tasks Banner: Sympathy Gate Condolences & Post-Op Concerns */}
      {staffTasksQuery.data && staffTasksQuery.data.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <HeartHandshake className="w-4 h-4" />
              <span>Úlohy pre personál – Sympathy Flow a Post-Op eskalácie ({staffTasksQuery.data.length})</span>
            </div>
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
              Vyžaduje manuálnu starostlivosť
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Podľa etického kódexu veterinára systém automaticky zablokoval všetky marketingové správy pre zosnulých pacientov. Prevezmite komunikáciu osobne alebo odošlite kondolenčnú kartu.
          </p>
          <div className="divide-y divide-border/60">
            {staffTasksQuery.data.map((task) => (
              <div key={task.id} className="pt-2.5 pb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    {task.title}
                  </div>
                  <div className="text-muted-foreground pl-3.5">{task.detail}</div>
                </div>
                <div className="flex items-center gap-2 pl-3.5 sm:pl-0 shrink-0">
                  {task.kind === "condolence" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1"
                      onClick={() => sendCondolenceMutation.mutate({ taskId: task.id })}
                      disabled={sendCondolenceMutation.isPending}
                    >
                      <Mail className="w-3 h-3" />
                      Odoslať kondolenciu
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => resolveTaskMutation.mutate({ id: task.id })}
                    disabled={resolveTaskMutation.isPending}
                  >
                    <Check className="w-3 h-3" />
                    Vybavené
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

              {/* Media Controls Bar */}
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 border text-xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                  AI Vizuál (Alibaba):
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || isVideoLoading}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-3 w-3 animate-spin text-rose-500" />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-rose-500" />
                    )}
                    <span>Obrázok (Wanx 2.1)</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 border-purple-200 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingImage || isVideoLoading}
                  >
                    {isVideoLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                    ) : (
                      <Video className="h-3 w-3 text-purple-500" />
                    )}
                    <span>Video (Wan 2.1)</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 hover:bg-sky-50 dark:hover:bg-sky-950/30 border-sky-200 dark:border-sky-900/50"
                    onClick={handleSendToTv}
                    disabled={createTvSlideMutation.isPending}
                    title="Pridať túto kampaň ako slajd na TV do čakárne"
                  >
                    {createTvSlideMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                    ) : (
                      <Tv className="h-3 w-3 text-sky-500" />
                    )}
                    <span>Na TV</span>
                  </Button>

                  {(generatedImageUrl || generatedVideoUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setGeneratedImageUrl(null);
                        setGeneratedVideoUrl(null);
                      }}
                      title="Resetovať vizuál"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Media Display Area */}
              {isVideoLoading ? (
                <div className="aspect-square w-full rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 shadow-sm">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-semibold text-xs text-foreground">
                      {videoStatusText || "Spracovávam Wan 2.1 video..."}
                    </h5>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      Alibaba Wan 2.1 generuje plynulé video pre tému „{selectedTopic}“.
                    </p>
                  </div>
                </div>
              ) : isGeneratingImage ? (
                <div className="aspect-square w-full rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 shadow-sm">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-semibold text-xs text-foreground">
                      Generujem Wanx 2.1 vizuál...
                    </h5>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      Alibaba Wanx 2.1 (Qwen 3 Pro) vykresľuje fotorealistický obrázok pre sociálne siete.
                    </p>
                  </div>
                </div>
              ) : generatedVideoUrl ? (
                <div className="relative aspect-square w-full rounded-xl overflow-hidden border bg-black group">
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 pointer-events-none">
                    <Badge className="bg-black/70 backdrop-blur-sm text-white text-[10px] gap-1 border-white/20">
                      <Video className="h-3 w-3 text-purple-400" /> Wan 2.1 AI Video
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <a
                      href={generatedVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      download="wan_video.mp4"
                      className="h-7 w-7 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm flex items-center justify-center transition-colors shadow-sm"
                      title="Stiahnuť video súbor"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ) : generatedImageUrl ? (
                <div className="relative aspect-square w-full rounded-xl overflow-hidden border bg-black group">
                  <img
                    src={generatedImageUrl}
                    alt={selectedTopic}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 pointer-events-none">
                    <Badge className="bg-black/70 backdrop-blur-sm text-white text-[10px] gap-1 border-white/20">
                      <ImageIcon className="h-3 w-3 text-emerald-400" /> Wanx 2.1 / Qwen 3 Pro
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <a
                      href={generatedImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      download="wanx_image.png"
                      className="h-7 w-7 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm flex items-center justify-center transition-colors shadow-sm"
                      title="Stiahnuť obrázok"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                /* Mock Image Placeholder */
                <div className="aspect-square w-full rounded-xl bg-gradient-to-tr from-rose-100 via-purple-100 to-sky-100 dark:from-rose-950/40 dark:via-purple-950/40 dark:to-sky-950/40 flex flex-col items-center justify-center text-center p-6 border relative group">
                  <div className="h-16 w-16 rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center text-3xl shadow-sm mb-3">
                    🐾
                  </div>
                  <h4 className="font-bold text-sm text-foreground max-w-xs leading-snug">
                    {selectedTopic}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Veterinárna starostlivosť a prevencia
                  </p>
                  <div className="mt-4 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 shadow-xs"
                      onClick={handleGenerateImage}
                    >
                      <ImageIcon className="h-3 w-3 text-rose-500" />
                      Vygenerovať obrázok
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1 shadow-xs"
                      onClick={handleGenerateVideo}
                    >
                      <Video className="h-3 w-3 text-purple-500" />
                      Vygenerovať video
                    </Button>
                  </div>
                </div>
              )}

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

              {/* Generated Media in Facebook */}
              {generatedVideoUrl ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black">
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : generatedImageUrl ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black">
                  <img
                    src={generatedImageUrl}
                    alt={selectedTopic}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                /* Mock Banner */
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
              )}

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
