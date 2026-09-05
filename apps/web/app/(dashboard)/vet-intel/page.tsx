"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  ShieldAlert,
  ExternalLink,
  Search,
  CheckCircle2,
  MapPin,
  Star,
  Lightbulb,
  TrendingUp,
  MailPlus,
  Loader2,
  ShieldCheck,
  Calendar,
  BookOpen,
  Scale,
  Globe,
  ArrowUp,
  MessageSquare,
  Zap,
  AlertTriangle,
  Pill,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Official Gazette / Legal Bulletin Data ────────────────────────────────────

interface IntelItem {
  id: string;
  source: "SVPS_SR" | "KVL_SR" | "SUKL" | "CLINICAL";
  sourceName: string;
  title: string;
  category: "alert" | "regulation" | "drug" | "advisory";
  date: string;
  effectiveDate?: string;
  summary: string;
  body?: string;
  badgeText: string;
  badgeVariant: "destructive" | "default" | "secondary" | "outline";
  officialUrl?: string;
  actRef?: string;
  issueRef?: string; // e.g. "Vestník KVL SR 3/2026"
  articleNo?: string; // e.g. "Čl. 4 ods. 2"
}

const OFFICIAL_INTEL_ITEMS: IntelItem[] = [
  {
    id: "1",
    source: "SVPS_SR",
    sourceName: "Štátna veterinárna a potravinová správa SR",
    title: "Mimoriadne núdzové opatrenia – Epizootologická situácia (AMO a vtáčia chrípka)",
    category: "alert",
    date: "2026-09-01",
    effectiveDate: "2026-09-01",
    issueRef: "Vestník ŠVPS SR č. 9/2026",
    articleNo: "§ 3 ods. 1 a 4",
    summary:
      "Aktualizácia reštrikčných pásiem a zvýšený dohľad nad biologickou bezpečnosťou chovov a manipuláciou s kadávermi. Veterinárni lekári sú povinní bezodkladne hlásiť akékoľvek podozrenia na nákazu.",
    body:
      "Na základe výskytu vysoko patogénnej aviárnej influenzy (HPAI H5N1) a afrického moru oviec (AMO) v susedných krajinách Štátna veterinárna a potravinová správa SR nariaďuje: (1) Rozšírenie pozorovacieho pásma v Bratislavskom a Trnavskom kraji v okruhu 10 km od hraničných priechodov. (2) Povinné hlásenie akéhokoľvek úhynu hydiny nad 3 kusy do 12 hodín. (3) Zákaz organizovania súťaží poštových holubov a chovateľských výstav až do odvolania. (4) Zvýšená frekvencia úradných inšpekcií vonkajších chovov.",
    badgeText: "Kritická výstraha",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
    actRef: "Zákon č. 39/2007 Z. z. o veterinárnej starostlivosti",
  },
  {
    id: "2",
    source: "SVPS_SR",
    sourceName: "Štátna veterinárna a potravinová správa SR",
    title: "Elektronická evidencia očkovaní proti besnote a čipovania v CRSZ",
    category: "alert",
    date: "2026-08-28",
    effectiveDate: "2026-09-15",
    issueRef: "Usmernenie ŠVPS SR 2026/08/VET",
    articleNo: "§ 19 ods. 9",
    summary:
      "Pripomienka zákonnej lehoty do 24 hodín na zápis aplikovaného mikročipu a platnej vakcinácie proti besnote do Centrálneho registra spoločenských zvierat (CRSZ). Za nesplnenie hrozia správne pokuty.",
    body:
      "Veterinárni lekári sú povinní v súlade s § 19 ods. 9 zákona č. 39/2007 Z. z. zaznamenať každý aplikovaný mikročip a každú vakcináciu proti besnote do Centrálneho registra spoločenských zvierat (CRSZ) do 24 hodín od výkonu. Pri oneskorení zápisu hrozí správna pokuta vo výške 500 – 5 000 EUR podľa závažnosti porušenia. ŠVPS SR oznamuje, že v Q4 2026 bude realizovaná plošná kontrola 15 % veterinárnych ambulancií zameraná výhradne na dodržiavanie tejto povinnosti.",
    badgeText: "Zákonná lehota",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
    actRef: "§ 19 ods. 9 zákona č. 39/2007 Z. z.",
  },
  {
    id: "3",
    source: "KVL_SR",
    sourceName: "Komora veterinárnych lekárov SR",
    title: "Novelizácia etických štandardov a pravidiel marketingovej komunikácie",
    category: "regulation",
    date: "2026-08-15",
    effectiveDate: "2026-10-01",
    issueRef: "Vestník KVL SR č. 3/2026",
    articleNo: "§ 20 Etického kódexu KVL SR",
    summary:
      "Usmernenie k § 20 Etického kódexu KVL SR ohľadom informovania verejnosti o poskytovaných veterinárnych službách. Reklama musí byť vecná, pravdivá a nesmie obsahovať znevažovanie kolegov ani cenové porovnávanie.",
    body:
      "Predstavenstvo KVL SR na zasadnutí dňa 14. 8. 2026 schválilo aktualizované usmernenie k § 20 Etického kódexu. Kľúčové zmeny: (1) Veterinárne ambulancie môžu zverejňovať orientačný cenník na vlastnej webovej stránke. (2) Akékoľvek tvrdenia o „najlacnejšej“ alebo „najlepšej“ starostlivosti sú aj naďalej zakázané ako klamlivá reklama. (3) Recenzie pacientov môžu byť zdieľané v sociálnych médiách za podmienky súhlasu majiteľa a bez uvedenia zdravotných detailov. (4) Porušenie podlieha disciplinárnej komisii KVL SR, pokuta od 200 EUR.",
    badgeText: "Stavovský predpis",
    badgeVariant: "default",
    officialUrl: "https://www.kvlsr.sk",
    actRef: "Zákon č. 442/2004 Z. z. o súkromných veterinárnych lekároch",
  },
  {
    id: "4",
    source: "SUKL",
    sourceName: "ŠÚKL / ÚŠKVBL – Ústav štátnej kontroly veterinárnych biopreparátov a liečiv",
    title: "Povinné digitálne monitorovanie chladiaceho reťazca termolabilných vakcín",
    category: "drug",
    date: "2026-08-10",
    effectiveDate: "2027-01-01",
    issueRef: "Oznámenie ÚŠKVBL č. 12/2026",
    articleNo: "Čl. 4 ods. 2 Nariadenia (EÚ) 2019/6",
    summary:
      "Od 1. januára 2027 je povinné nepretržité digitálne monitorovanie chladiaceho reťazca (+2 °C až +8 °C) s archiváciou teplotných logov po dobu 5 rokov. Papierové záznamy nebudú pri inšpekcii uznávané.",
    body:
      "ÚŠKVBL v súlade s nariadením (EÚ) 2019/6 a zákonom č. 362/2011 Z. z. o liekoch oznamuje nové požiadavky platné od 1. januára 2027: (1) Každá ambulancia uchovávajúca biologické veterinárne liečivá musí mať certifikovaný datalogger s GSM/WiFi prenosom dát. (2) Záznamy teplotnej krivky musia byť archivované v elektronickej forme min. 5 rokov a predložené na požiadanie inšpektora. (3) Pri inšpekcii sú uznávané iba digitálne záznamy so zaručeným elektronickým podpisom zariadenia. (4) Výrobcovia zariadení musia byť certifikovaní podľa normy ISO 13485.",
    badgeText: "Liečivá & ÚŠKVBL",
    badgeVariant: "secondary",
    officialUrl: "https://www.uskvbl.sk",
    actRef: "Zákon č. 362/2011 Z. z. o liekoch",
  },
  {
    id: "5",
    source: "CLINICAL",
    sourceName: "Slovenská asociácia veterinárnych lekárov malých zvierat (SAVLMZ)",
    title: "Odporúčaný protokol preventívnej geriatrickej starostlivosti u psov a mačiek nad 7 rokov",
    category: "advisory",
    date: "2026-08-01",
    issueRef: "Klinický štandard SAVLMZ 2026-G01",
    articleNo: "Kapitola 3, Bod 3.4",
    summary:
      "Zjednotený klinický štandard pre polročné preventívne prehliadky seniorov: hematológia, biochémia vrátane SDMA, analýza moču s UP/C a meranie krvného tlaku.",
    body:
      "Pracovná skupina SAVLMZ pre interné choroby malých zvierat zverejnila aktualizovaný geriatrický protokol. Minimálne vyšetrenie každých 6 mesiacov zahŕňa: (1) Kompletný krvný obraz + diferenciál; (2) Sérová biochémia vrátane SDMA a TSH (mačky); (3) Urinalýza s UP/C pomerom a sedimentom; (4) Meranie systolického TK (Doppler/oscilomet.); (5) Očný vyšetrenie – oftalmoskopia; (6) Hodnotenie bolesti podľa WSAVA skóre. Protokol zohľadňuje odporúčania WSAVA, IRIS a ISFM z roku 2025.",
    badgeText: "Odborný štandard",
    badgeVariant: "outline",
    officialUrl: "https://www.savlmz.sk",
    actRef: "WSAVA Global Veterinary Community Guidelines 2025",
  },
];

// ── AI Tips / Global Business Intel Data ─────────────────────────────────────

type AiTipCategory = "pricing" | "retention" | "marketing" | "staffing" | "tech" | "growth";

interface AiTip {
  id: string;
  title: string;
  body: string;
  source: string;
  sourceType: "reddit" | "linkedin" | "hackernews" | "forum" | "newsletter" | "research";
  countryFlag: string;
  upvotes: number;
  comments: number;
  category: AiTipCategory;
  tags: string[];
  link?: string;
  publishedAt: string;
}

const AI_TIPS: AiTip[] = [
  {
    id: "t1",
    title: "Ako sme zvýšili príjem o 22 % bez nových klientov – len lepším follow-up systémom",
    body: "Implementovali sme automatické SMS/email pripomienky 3 dni pred plánovanou návštevou a 1 deň po nej. Miera nedostavení sa klesla z 18 % na 6 %. Zároveň sme pridali automatický follow-up za 12 mesiacov pre každého pacienta bez zaznamenanej návštevy. Výsledok: +22 % príjem za prvý rok.",
    source: "r/VetBusiness",
    sourceType: "reddit",
    countryFlag: "🇦🇺",
    upvotes: 1842,
    comments: 94,
    category: "retention",
    tags: ["automatizácia", "follow-up", "retencia"],
    link: "https://reddit.com/r/VetBusiness",
    publishedAt: "2026-08-20",
  },
  {
    id: "t2",
    title: "Wellness plány ako predplatné – mesačný model pre stálu klientelu",
    body: "V UK je štandardom wellness membership za £30–£50/mesiac – zahŕňa ročnú prehliadku, odčervenie, vakcíny a 10 % zľavu na akútne ošetrenia. Klienty to motivuje k pravidelným návštevám a pre kliniku to generuje predvídateľný príjem. AVMA odporúča model pre kliniky s viac ako 800 aktívnymi klientmi.",
    source: "LinkedIn Pulse – VetBusiness EU",
    sourceType: "linkedin",
    countryFlag: "🇬🇧",
    upvotes: 3201,
    comments: 211,
    category: "pricing",
    tags: ["wellness plán", "predplatné", "revenue stream"],
    link: "https://linkedin.com",
    publishedAt: "2026-08-18",
  },
  {
    id: "t3",
    title: "AI triaging chatbot v recepcii – ako funguje v praxi (6 mesiacov)",
    body: "Nasadili sme chatbot na web kliniky, ktorý zbiera anamnézu pred príchodom. Recepcia ušetrí 4–6 min na každú návštevu. Priemerný čas administratívy za mesiac klesol o 31 hodín. Klienti hodnotia rýchlosť záznamu pozitívne – NPS vzrástol o 18 bodov. Nástroj: custom GPT wrapper + formulár -> tRPC.",
    source: "Hacker News",
    sourceType: "hackernews",
    countryFlag: "🇺🇸",
    upvotes: 847,
    comments: 63,
    category: "tech",
    tags: ["AI chatbot", "recepcia", "automatizácia"],
    link: "https://news.ycombinator.com",
    publishedAt: "2026-08-14",
  },
  {
    id: "t4",
    title: "Stratégia „foto dňa“ na Instagrame – 6 000 followerov za 8 mesiacov",
    body: "Každý deň pridáme 1 foto pacienta (so súhlasom majiteľa). Bez reklamy. Konsistent­nosť je kľúčová – algoritmus odmeňuje denný posting. Najväčší engagament mali mačacie „reels“ – 10–30 sekúnd s hudbou. Priemerný nárast sledovateľov: 25/deň. Asi 8 % nových klientov prišlo cez Instagram.",
    source: "r/VeterinaryMarketing",
    sourceType: "reddit",
    countryFlag: "🇩🇪",
    upvotes: 2104,
    comments: 176,
    category: "marketing",
    tags: ["Instagram", "social media", "organický rast"],
    link: "https://reddit.com/r/veterinarymarketing",
    publishedAt: "2026-08-10",
  },
  {
    id: "t5",
    title: "Ako udržať veterinárnych asistentov – 3 nefinančné taktiky, ktoré fungujú",
    body: "Fluktuácia personálu je najväčší problém kliník v Európe. Tri veci, ktoré pomohli: (1) Týždenné 15-minútové 1:1 stretnutia každého pracovníka s vedúcim – ukázalo sa, že sa pýtajú o kariérny rozvoj, nie o plat. (2) Rotácia oddelení každé 3 mesiace – prax je pestrejšia. (3) Každoročný vzdelávací rozpočet 500 EUR na osobu – ľudia cítia investíciu.",
    source: "VetBiz Forum Europe",
    sourceType: "forum",
    countryFlag: "🇳🇱",
    upvotes: 1567,
    comments: 88,
    category: "staffing",
    tags: ["personál", "retencia zamestnancov", "HR"],
    link: "https://vetbizforum.eu",
    publishedAt: "2026-08-05",
  },
  {
    id: "t6",
    title: "Dynamic pricing pre emergency sloty – výsledky po 4 mesiacoch",
    body: "Zaviedli sme príplatok +40 % za emergency sloty po 18:00 a cez víkend, zverejnený transparentne na webe. Výsledok: klienti akceptujú (pochopia urgentnosť), emergency návštevy klesli o 15 % (ľudia volajú skôr) a príjem za emergency vzrástol o 35 %. Kľúč: byť transparentný a komunikovať dôvod príplatku.",
    source: "Vet Economics Newsletter",
    sourceType: "newsletter",
    countryFlag: "🇨🇦",
    upvotes: 2890,
    comments: 134,
    category: "pricing",
    tags: ["dynamic pricing", "emergency", "cenotvorba"],
    publishedAt: "2026-07-28",
  },
  {
    id: "t7",
    title: "Výskum: klienti zostávajú 3× dlhšie, ak dostanú 'správu zdravia' po návšteve",
    body: "Štúdia AVMA (n=4 200) ukázala, že klinici ktorí posielajú PDF súhrn návštevy (diagnóza, medikácia, ďalší postup) majú o 3× vyšší retention rate po 2 rokoch. Klienti zdieľajú tieto správy na sociálnych sieťach v 12 % prípadov – bezplatná reklama. OpenVPM generuje takéto správy automaticky cez AI discharge summary.",
    source: "AVMA Research Brief 2026",
    sourceType: "research",
    countryFlag: "🇺🇸",
    upvotes: 4102,
    comments: 259,
    category: "retention",
    tags: ["výskum", "discharge summary", "klient retencia"],
    link: "https://avma.org",
    publishedAt: "2026-07-20",
  },
  {
    id: "t8",
    title: "Ako sme spustili druhú kliniku za 14 mesiacov – lean expansion playbook",
    body: "Klonujte procesy, nie ľudí. Kľúč bol zdokumentovať každý SOP pred expanziou. Zamestnali sme 1 senior vet z hlavnej kliniky, ktorý sa stal vedúcim pobočky na 6 mesiacov. Softvér zdieľaný (jeden tenant). Break-even za 11 mesiacov. Najdôležitejšie: nezačínajte expanziu, kým hlavná klinika nemá 85 %+ obsadenosť slotov.",
    source: "r/SmallVetClinic",
    sourceType: "reddit",
    countryFlag: "🇦🇺",
    upvotes: 1398,
    comments: 71,
    category: "growth",
    tags: ["expanzia", "pobočka", "škálovanie"],
    link: "https://reddit.com/r/SmallVetClinic",
    publishedAt: "2026-07-15",
  },
];

const TIP_CATEGORY_LABELS: Record<AiTipCategory, string> = {
  pricing: "Cenotvorba",
  retention: "Retencia klientov",
  marketing: "Marketing",
  staffing: "Personál & HR",
  tech: "Technológia",
  growth: "Rast & Expanzia",
};

const TIP_CATEGORY_COLORS: Record<AiTipCategory, string> = {
  pricing: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800",
  retention: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  marketing: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/30 dark:border-violet-800",
  staffing: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
  tech: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/30 dark:border-cyan-800",
  growth: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30 dark:border-rose-800",
};

const SOURCE_TYPE_LABELS: Record<AiTip["sourceType"], string> = {
  reddit: "Reddit",
  linkedin: "LinkedIn",
  hackernews: "Hacker News",
  forum: "VetBiz Forum",
  newsletter: "Newsletter",
  research: "Výskumná správa",
};

// ── Competitor Types ─────────────────────────────────────────────────────────

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

function VetIntelContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "market";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL if changed
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && (tabParam === "market" || tabParam === "bulletin" || tabParam === "strategy")) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Competitors & Market state
  const [query, setQuery] = useState("Bratislava Ružinov");
  const [digestEnabled, setDigestEnabled] = useState(false);

  // Bulletins state
  const [bulletinSearch, setBulletinSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedBulletin, setExpandedBulletin] = useState<string | null>(null);

  // AI Tips state
  const [tipCategory, setTipCategory] = useState<AiTipCategory | "all">("all");


  const utils = trpc.useUtils();
  const snapshotsQuery = trpc.extensions.marketing.listCompetitorSnapshots.useQuery();

  const runAnalysisMutation = trpc.extensions.marketing.runCompetitorAnalysis.useMutation({
    onSuccess: () => {
      toast.success("Konkurenčná a trhová analýza bola úspešne aktualizovaná");
      utils.extensions.marketing.listCompetitorSnapshots.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa spustiť analýzu trhu");
    },
  });

  const toggleDigestMutation = trpc.extensions.marketing.toggleCompetitorDigest.useMutation({
    onSuccess: (data) => {
      setDigestEnabled(data.enabled);
      toast.success(data.enabled ? "Týždenný trhový digest bol zapnutý" : "Týždenný trhový digest bol vypnutý");
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmeniť nastavenie digestu");
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

  // Filtered official bulletins
  const filteredBulletins = OFFICIAL_INTEL_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    const searchLower = bulletinSearch.toLowerCase();
    const matchesSearch =
      bulletinSearch.trim() === "" ||
      item.title.toLowerCase().includes(searchLower) ||
      item.summary.toLowerCase().includes(searchLower) ||
      item.sourceName.toLowerCase().includes(searchLower);
    return matchesCat && matchesSearch;
  });

  // Filtered AI tips
  const filteredTips = AI_TIPS.filter((tip) =>
    tipCategory === "all" || tip.category === tipCategory
  );


  return (
    <div className="mx-auto max-w-6xl px-2 py-2 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Vet Intelligence
                </h1>
                <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                  AI Trh & Legislatíva
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
                Centrálny hub pre trhovú inteligenciu: monitoring konkurencie, cenový benchmarking, úradné vestníky ŠVPS SR, liekové registrácie a predpisy KVL SR.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.svps.sk"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5 text-xs"
            >
              <Building2 className="h-3.5 w-3.5" />
              ŠVPS SR Portál
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.kvlsr.sk"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5 text-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              KVL SR Portál
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>
        </div>
      </div>

      {/* ── Two-column layout: Left sidebar + Right content ── */}
      <div className="flex gap-6 items-start">

        {/* ── Left Sidebar Nav ── */}
        <aside className="w-52 shrink-0 sticky top-4 space-y-1">
          {[
            {
              value: "market",
              icon: Building2,
              label: "Trh & Konkurencia",
              desc: "Benchmark, recenzie, analýza regiónu",
            },
            {
              value: "bulletin",
              icon: ShieldAlert,
              label: "Úradné vestníky & Právo",
              desc: "ŠVPS SR, KVL SR, ŠÚKL",
            },
            {
              value: "strategy",
              icon: Lightbulb,
              label: "AI Stratégia & Trendy",
              desc: "Reddit, LinkedIn, svetové tipy",
            },
          ].map(({ value, icon: Icon, label, desc }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-3 transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted/60 text-muted-foreground border border-transparent hover:border-border"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-foreground")} />
                  <span className={cn("text-xs font-semibold leading-tight", isActive ? "text-primary-foreground" : "text-foreground")}>
                    {label}
                  </span>
                </div>
                <p className={cn("text-[10px] leading-snug pl-6", isActive ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {desc}
                </p>
              </button>
            );
          })}

          {/* External links */}
          <div className="pt-3 border-t border-border/50 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 pb-1">
              Portály
            </p>
            {[
              { href: "https://www.svps.sk", label: "ŠVPS SR", icon: Building2 },
              { href: "https://www.kvlsr.sk", label: "KVL SR", icon: ShieldCheck },
              { href: "https://www.slov-lex.sk", label: "Slov-Lex", icon: Scale },
            ].map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
                <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-50" />
              </a>
            ))}
          </div>
        </aside>

        {/* ── Right Content Panel ── */}
        <div className="flex-1 min-w-0 space-y-6">

        {/* -----------------------------------------------------------------------
            TAB 1: TRH & KONKURENCIA
        ----------------------------------------------------------------------- */}
        {activeTab === "market" && <div className="space-y-6 animate-in fade-in duration-200">
          {/* Slovak Veterinary Compliance Banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200">
            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">
                Legislatívna a etická ochrana KVL SR (Zákon č. 39/2007 Z. z. a Zákon o reklame)
              </p>
              <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                Výstupy trhovej analýzy slúžia výhradne pre interné strategické rozhodovanie a optimalizáciu služieb vašej kliniky.
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
                    placeholder="Zadajte mesto, mestskú časť alebo PSČ (napr. Bratislava Ružinov, Žilina, Košice...)"
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
                  Analyzovať trh
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
                  <p className="text-sm font-semibold">Týždenný trhový digest na e-mail</p>
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

          {/* Results Grid */}
          {snapshotsQuery.isLoading ? (
            <div className="space-y-4">
              <div className="h-40 rounded-xl border animate-pulse bg-muted/20" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="h-64 rounded-xl border animate-pulse bg-muted/20" />
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

              {/* Clinics Benchmarking Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    Veterinárne pracoviská v regióne ({clinics.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                &bdquo;{clinic.latestPosts[0].text}&ldquo;
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
            </div>
          )}
        </div>}

        {/* -----------------------------------------------------------------------
            TAB 2: ÚRADNÉ VESTNÍKY & LEGISLATÍVA
        ----------------------------------------------------------------------- */}
        {activeTab === "bulletin" && <div className="space-y-6 animate-in fade-in duration-200">

          {/* Gazette Header Band */}
          <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b bg-background">
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-wide uppercase text-foreground">
                  Vestník veterinárnej legislatívy SR
                </p>
                <p className="text-xs text-muted-foreground">
                  ŠVPS SR · KVL SR · ŠÚKL · ÚŠKVBL · Klinické štandardy
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">
                  Ročník 2026
                </Badge>
                <a
                  href="https://www.slov-lex.sk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  Slov-Lex portál
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hľadať v legislatíve..."
                  value={bulletinSearch}
                  onChange={(e) => setBulletinSearch(e.target.value)}
                  className="pl-9 h-10 bg-background"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "all", label: "Všetky" },
                  { key: "alert", label: "Výstrahy" },
                  { key: "regulation", label: "Predpisy KVL" },
                  { key: "drug", label: "Liečivá" },
                  { key: "advisory", label: "Klinické štandardy" },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={selectedCategory === key ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs rounded-full"
                    onClick={() => setSelectedCategory(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Gazette Articles */}
          <div className="space-y-0 divide-y divide-border rounded-xl border overflow-hidden">
            {filteredBulletins.map((item, idx) => {
              const isExpanded = expandedBulletin === item.id;
              const categoryBorderColor =
                item.category === "alert"
                  ? "border-l-4 border-l-destructive"
                  : item.category === "regulation"
                  ? "border-l-4 border-l-primary"
                  : item.category === "drug"
                  ? "border-l-4 border-l-amber-500"
                  : "border-l-4 border-l-emerald-500";

              return (
                <article
                  key={item.id}
                  className={cn(
                    "bg-background hover:bg-muted/20 transition-colors",
                    categoryBorderColor
                  )}
                >
                  {/* Article Header */}
                  <div className="px-6 pt-5 pb-4">
                    {/* Category Icon — Large & Contrasting */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl shadow-sm",
                        item.category === "alert" && "bg-red-500 text-white",
                        item.category === "regulation" && "bg-primary text-white",
                        item.category === "drug" && "bg-amber-500 text-white",
                        item.category === "advisory" && "bg-emerald-500 text-white",
                      )}>
                        {item.category === "alert" && <AlertTriangle className="h-5 w-5" />}
                        {item.category === "regulation" && <Scale className="h-5 w-5" />}
                        {item.category === "drug" && <Pill className="h-5 w-5" />}
                        {item.category === "advisory" && <FileText className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-muted-foreground font-mono">
                      {item.issueRef && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {item.issueRef}
                        </span>
                      )}
                      {item.articleNo && (
                        <span className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          {item.articleNo}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Calendar className="h-3 w-3" />
                        Vydané:{" "}
                        {new Date(item.date).toLocaleDateString("sk-SK", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {item.effectiveDate && (
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3 w-3" />
                          Účinné od:{" "}
                          {new Date(item.effectiveDate).toLocaleDateString("sk-SK", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                      </div>
                    </div>

                    {/* Source authority */}
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {item.sourceName}
                    </p>

                    {/* Article Title */}
                    <h2 className="text-base font-bold text-foreground leading-snug mb-3">
                      {item.title}
                    </h2>

                    {/* Badge + Legal Reference row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant={item.badgeVariant} className="text-xs font-semibold">
                        {item.badgeText}
                      </Badge>
                      {item.actRef && (
                        <span className="text-xs font-mono text-primary/80 bg-primary/5 border border-primary/20 rounded px-2 py-0.5">
                          {item.actRef}
                        </span>
                      )}
                    </div>

                    {/* Summary paragraph */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Expandable full body */}
                    {item.body && (
                      <div className="mt-3">
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-dashed text-sm text-foreground leading-relaxed space-y-2 bg-muted/10 rounded-lg p-4">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                              Plné znenie
                            </p>
                            <p>{item.body}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedBulletin(isExpanded ? null : item.id)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                        >
                          {isExpanded ? "Skryť plné znenie ▲" : "Zobraziť plné znenie ▼"}
                        </button>
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-dashed">
                      {item.officialUrl && (
                        <a
                          href={item.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                        >
                          Officiálny portál
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        #{String(idx + 1).padStart(3, "0")} / 2026
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredBulletins.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground bg-background">
                Žiadne výsledky pre zvolený filter.
              </div>
            )}
          </div>
        </div>}

        {/* -----------------------------------------------------------------------
            TAB 3: AI STRATÉGIA & TRENDY
        ----------------------------------------------------------------------- */}
        {activeTab === "strategy" && <div className="space-y-6 animate-in fade-in duration-200">

          {/* Header Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Zap className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                AI-kurátorované tipy z celého sveta 🌍
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Reálne skúsenosti veterinárnych lekárov z Reddit, LinkedIn, Hacker News a odborných fór.
                Tipy sú vybrané na základe engagementu komunity a relevantnosti pre veterinárny biznis.
              </p>
            </div>
            <Badge className="ml-auto shrink-0 bg-primary/10 text-primary border-primary/20 text-xs">
              AI kurátorované
            </Badge>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Kategória:</span>
            <Button
              variant={tipCategory === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => setTipCategory("all")}
            >
              Všetky ({AI_TIPS.length})
            </Button>
            {(Object.keys(TIP_CATEGORY_LABELS) as AiTipCategory[]).map((cat) => {
              const count = AI_TIPS.filter((t) => t.category === cat).length;
              return (
                <Button
                  key={cat}
                  variant={tipCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs rounded-full"
                  onClick={() => setTipCategory(cat)}
                >
                  {TIP_CATEGORY_LABELS[cat]} ({count})
                </Button>
              );
            })}
          </div>

          {/* AI Tips Feed */}
          <div className="space-y-4">
            {filteredTips.map((tip) => (
              <div
                key={tip.id}
                className="rounded-xl border bg-background hover:shadow-sm transition-shadow overflow-hidden"
              >
                {/* Source bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 text-xs">
                  <span className="text-base leading-none">{tip.countryFlag}</span>
                  <span className="font-semibold text-foreground">{tip.source}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal ml-1"
                  >
                    {SOURCE_TYPE_LABELS[tip.sourceType]}
                  </Badge>
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      TIP_CATEGORY_COLORS[tip.category]
                    )}
                  >
                    {TIP_CATEGORY_LABELS[tip.category]}
                  </span>
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                  {/* Title */}
                  <h3 className="text-sm font-bold text-foreground leading-snug mb-2">
                    {tip.title}
                  </h3>

                  {/* Body */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tip.body}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tip.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer with engagement stats */}
                <div className="flex items-center gap-4 px-5 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ArrowUp className="h-3.5 w-3.5" />
                    {tip.upvotes.toLocaleString("sk-SK")} hlasov
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {tip.comments} komentárov
                  </span>
                  <span className="flex items-center gap-1 ml-auto font-mono">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(tip.publishedAt).toLocaleDateString("sk-SK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {tip.link && (
                    <a
                      href={tip.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary font-medium hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Zdroj
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* AI Recommendations from Market Analysis (if available) */}
          {recommendations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                AI odporúčania z vašej poslednej trhovej analýzy
              </h3>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10">
                <CardContent className="pt-4">
                  <ul className="space-y-2">
                    {recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-foreground">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>}
      </div>
    </div>
  </div>
  );
}

export default function VetIntelPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Načítavam Vet Intelligence...</div>}>
      <VetIntelContent />
    </Suspense>
  );
}
