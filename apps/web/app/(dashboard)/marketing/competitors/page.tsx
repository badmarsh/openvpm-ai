"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  Star,
  ExternalLink,
  Lightbulb,
  Newspaper,
  TrendingUp,
  MailPlus,
  Loader2,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Share2,
  Calendar,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface CompetitorPost {
  platform: string;
  text: string;
  publishedAt: string;
  engagement: number;
}

interface ClinicIntel {
  name: string;
  rating: number;
  reviewCount?: number;
  services: string[];
  pricingNote: string;
  mapsUrl: string;
  photoUrl?: string;
  latestPosts?: CompetitorPost[];
}

interface MarketArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
}

const REGION_PRESETS = [
  "Bratislava Ružinov",
  "Bratislava Petržalka",
  "Košice Staré Mesto",
  "Banská Bystrica",
  "Žilina",
  "Nitra",
  "Trnava",
  "Prešov",
];

export default function CompetitorsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("Bratislava Ružinov");
  const [digestEmail, setDigestEmail] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);

  const utils = trpc.useUtils();

  const snapshotsQuery = trpc.extensions.marketing.listCompetitorSnapshots.useQuery();

  const runAnalysisMutation = trpc.extensions.marketing.runCompetitorAnalysis.useMutation({
    onSuccess: () => {
      toast.success("Konkurenčná analýza bola úspešne dokončená");
      utils.extensions.marketing.listCompetitorSnapshots.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa spustiť analýzu trhu");
    },
  });

  const toggleDigestMutation = trpc.extensions.marketing.toggleCompetitorDigest.useMutation({
    onSuccess: (data) => {
      setDigestEnabled(data.enabled);
      toast.success(data.enabled ? "Týždenný digest bol zapnutý" : "Týždenný digest bol vypnutý");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa aktualizovať nastavenie digestu");
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) {
      toast.error("Zadajte aspoň 2 znaky lokality");
      return;
    }
    runAnalysisMutation.mutate({ query: query.trim() });
  };

  const snapshots = snapshotsQuery.data ?? [];
  const latest = snapshots[0];

  const clinics = (latest?.clinics as ClinicIntel[]) ?? [];
  const recommendations = (latest?.recommendations as string[]) ?? [];
  const articles = (latest?.articles as MarketArticle[]) ?? [];
  const sources = (latest?.sources as string[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          {t("marketing.competitors.title", "Konkurencia a trhová inteligencia")}
        </h1>
        <p className="text-muted-foreground">
          {t(
            "marketing.competitors.description",
            "Sledovanie konkurenčných veterinárnych pracovísk, benchmarking služieb, ratingov a trhových trendov."
          )}
        </p>
      </div>

      {/* Slovak Veterinary Compliance Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200">
        <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold">
            Legislatívna a etická ochrana KVL SR (Zákon č. 39/2007 Z. z. a Zákon o reklame)
          </p>
          <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
            Výstupy konkurenčnej analýzy slúžia výhradne pre interné strategické rozhodovanie a optimalizáciu služieb vašej kliniky.
            Priame menovité porovnávanie s inými ambulanciami alebo znevažovanie kolegov vo verejnej komunikácii je v rozpore s Etickým kódexom KVL SR a je automaticky blokované naším marketingovým validátorom.
          </p>
        </div>
      </div>

      {/* Search & Location Bar */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10"
                placeholder="Zadajte mesto, mestskú časť alebo PSČ (napr. Bratislava Ružinov, Žilina...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={runAnalysisMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={runAnalysisMutation.isPending || query.trim().length < 2}
              className="gap-2 h-10 px-5 shrink-0"
            >
              {runAnalysisMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t("marketing.competitors.analyzeAction", "Analyzovať trh")}
            </Button>
          </form>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Rýchly výber:</span>
            {REGION_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full"
                onClick={() => {
                  setQuery(preset);
                  runAnalysisMutation.mutate({ query: preset });
                }}
                disabled={runAnalysisMutation.isPending}
              >
                {preset}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Digest Setting Banner */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <MailPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Týždenný monitorovací digest na e-mail</p>
              <p className="text-xs text-muted-foreground">
                Každý pondelok ráno prebehne kontrola zmien v regióne (nové kliniky, zmeny hodnotení, recenzie) a zašle súhrn personálu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-medium cursor-pointer">
              {digestEnabled ? "Zapnuté" : "Vypnuté"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={digestEnabled}
              disabled={toggleDigestMutation.isPending}
              onClick={() => {
                toggleDigestMutation.mutate({ enabled: !digestEnabled });
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                digestEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                  digestEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Content Results */}
      {snapshotsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="h-40 rounded-xl border animate-pulse bg-muted/20" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 rounded-xl border animate-pulse bg-muted/20" />
            <div className="h-64 rounded-xl border animate-pulse bg-muted/20" />
          </div>
        </div>
      ) : !latest ? (
        <div className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">Zatiaľ žiadna konkurenčná analýza</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            Zadajte mesto alebo lokalitu vo formulári vyššie a kliknite na tlačidlo Analyzovať trh.
          </p>
          <Button
            onClick={() => runAnalysisMutation.mutate({ query: "Bratislava Ružinov" })}
            disabled={runAnalysisMutation.isPending}
            className="gap-2"
          >
            {runAnalysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Spustiť ukážkovú analýzu
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Snapshot Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Región:</span>
              <Badge variant="secondary">{latest.region}</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Vyhotovené: {new Date(latest.createdAt).toLocaleDateString("sk-SK")}</span>
            </div>

            <div className="flex items-center gap-2">
              {latest.isSample ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Referenčný benchmark
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white">
                  Live Google Maps Grounding
                </Badge>
              )}
            </div>
          </div>

          {/* Recommendations Card */}
          {recommendations.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Lightbulb className="h-5 w-5" />
                  Strategické odporúčania pre vašu kliniku
                </CardTitle>
                <CardDescription>
                  Odporúčané kroky na odlíšenie sa a získanie nových stabilných klientov v tejto lokalite.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Clinics Benchmarking Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Veterinárne pracoviská v regióne ({clinics.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clinics.map((clinic, idx) => (
                <Card key={idx} className="flex flex-col justify-between overflow-hidden hover:shadow-md transition-shadow">
                  <div>
                    {clinic.photoUrl && (
                      <div className="h-32 w-full bg-muted/40 overflow-hidden relative">
                        <img
                          src={clinic.photoUrl}
                          alt={clinic.name}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{clinic.name}</CardTitle>
                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-semibold shrink-0">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          <span>{clinic.rating.toFixed(1)}</span>
                          {clinic.reviewCount && (
                            <span className="text-[10px] text-muted-foreground">({clinic.reviewCount})</span>
                          )}
                        </div>
                      </div>

                      {clinic.pricingNote && (
                        <p className="text-xs text-muted-foreground italic pt-1">
                          Cenotvorba: {clinic.pricingNote}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      {/* Services badges */}
                      {clinic.services && clinic.services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {clinic.services.map((service, sIdx) => (
                            <Badge key={sIdx} variant="secondary" className="text-[11px] font-normal">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Recent Social Post */}
                      {clinic.latestPosts && clinic.latestPosts.length > 0 && (
                        <div className="rounded-lg p-2.5 bg-muted/30 border text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                            <span className="uppercase">{clinic.latestPosts[0].platform}</span>
                            <span>{clinic.latestPosts[0].publishedAt}</span>
                          </div>
                          <p className="line-clamp-2 text-muted-foreground">
                            „{clinic.latestPosts[0].text}“
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="p-4 pt-0">
                    <a
                      href={clinic.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                        Otvoriť v Google Mapách
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Market Articles & Trends */}
          {articles.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-muted-foreground" />
                Trhové trendy a odborné správy
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {articles.map((art, aIdx) => (
                  <Card key={aIdx} className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <Badge variant="outline" className="text-[10px]">{art.source}</Badge>
                        <span>{art.publishedAt}</span>
                      </div>
                      <CardTitle className="text-sm font-semibold leading-snug">{art.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {art.summary}
                      </p>
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                      >
                        Čítať viac
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Analysis History */}
          {snapshots.length > 1 && (
            <Card className="pt-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  História predchádzajúcich analýz
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y text-xs">
                  {snapshots.slice(1).map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{s.region}</span>
                        <span className="text-muted-foreground">({s.query})</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("sk-SK")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
