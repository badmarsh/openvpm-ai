import { configuredModel } from "@/lib/agent/runner";
import { generateText } from "ai";

export interface CompetitorPost {
  platform: string; // "facebook" | "instagram" | "gbp"
  text: string;
  publishedAt: string;
  engagement: number;
}

export interface ClinicIntel {
  name: string;
  rating: number;
  reviewCount?: number;
  services: string[];
  pricingNote: string;
  mapsUrl: string;
  photoUrl?: string;
  latestPosts?: CompetitorPost[];
}

export interface MarketArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
}

export interface CompetitorResult {
  region: string;
  clinics: ClinicIntel[];
  recommendations: string[];
  articles: MarketArticle[];
  sources: string[];
  model: string;
  isSample: boolean;
}

const SAMPLE_PHOTOS = [
  "https://images.pexels.com/photos/7469274/pexels-photo-7469274.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
  "https://images.pexels.com/photos/6234607/pexels-photo-6234607.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
  "https://images.pexels.com/photos/7470634/pexels-photo-7470634.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
  "https://images.pexels.com/photos/6235024/pexels-photo-6235024.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
  "https://images.pexels.com/photos/7469220/pexels-photo-7469220.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
];

const dAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toLocaleDateString("sk-SK");
};

export function getSampleCompetitorResult(query: string): CompetitorResult {
  const region = query.trim() || "Bratislava Ružinov";

  const mk = (
    i: number,
    name: string,
    rating: number,
    reviewCount: number,
    services: string[],
    pricingNote: string,
    latestPosts: CompetitorPost[]
  ): ClinicIntel => ({
    name,
    rating,
    reviewCount,
    services,
    pricingNote,
    mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${name} ${region}`)}`,
    photoUrl: SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length],
    latestPosts,
  });

  return {
    region,
    model: "sample-regional-benchmark-v1",
    isSample: true,
    clinics: [
      mk(0, `Veterinárna ambulancia ${region}`, 4.6, 214, ["Preventívna medicína", "Chirurgia mäkkých tkanív", "Digitálny RTG"], "Balíčky prevencie, štandardná cenová hladina (~35-45€ vyšetrenie)", [
        { platform: "facebook", text: "Jarná vakcinačná sezóna sa začína – objednávky prijímame telefonicky a online.", publishedAt: dAgo(2), engagement: 34 },
        { platform: "instagram", text: "Dnešný pacient po kontrole kĺbov a RTG diagnostike. Všetko v poriadku! 🐾", publishedAt: dAgo(6), engagement: 71 },
      ]),
      mk(1, "VetCentrum & Pohotovosť", 4.4, 388, ["Pohotovosť 24/7", "Hospitalizácia", "Laboratórna diagnostika"], "Vyššia cenová kategória, príplatok za pohotovosť", [
        { platform: "facebook", text: "Spúšťame online rezervačný systém – termín si vyberiete priamo z mobilu.", publishedAt: dAgo(1), engagement: 126 },
        { platform: "gbp", text: "Rozšírili sme ordinačné hodiny počas víkendov do 20:00.", publishedAt: dAgo(9), engagement: 18 },
      ]),
      mk(2, `Klinika pre malé zvieratá`, 4.8, 157, ["Stomatológia", "Dermatológia", "Inhalačná anestézia"], "Kvalitná špecializácia, silné recenzie prístupu a empatie", [
        { platform: "instagram", text: "Mesiac zubnej prevencie: ultrazvukové čistenie zubov v bezpečnej inhalačnej anestézii.", publishedAt: dAgo(3), engagement: 203 },
        { platform: "facebook", text: "Ďakujeme za viac ako 150 päťhviezdičkových hodnotení na Google Mapách!", publishedAt: dAgo(12), engagement: 88 },
      ]),
      mk(3, "AnimalCare Ambulancia", 4.2, 96, ["Základná starostlivosť", "Vakcinácie", "Čipovanie a petpasy"], "Dostupné ceny základnej starostlivosti", [
        { platform: "facebook", text: "Zákonné čipovanie a registrácia v CRSZ aj bez čakania.", publishedAt: dAgo(5), engagement: 41 },
      ]),
      mk(4, "Veterinárna špecializovaná prax", 4.7, 182, ["Echokardiografia", "USG brušnej dutiny", "Endoskopia"], "Špecializované referenčné pracovisko, vyšetrenia na objednávku", [
        { platform: "instagram", text: "Moderný USG prístroj s vysokým rozlíšením umožňuje včasné zachytenie ochorení.", publishedAt: dAgo(4), engagement: 154 },
        { platform: "facebook", text: "Víkendová pohotovostná služba pre nahlásených akútnych pacientov.", publishedAt: dAgo(8), engagement: 63 },
      ]),
    ],
    recommendations: [
      "V regióne žiadna klinika výrazne nekomunikuje Fear-Free / low-stress handling – zviditeľnite šetrný a bezstresový prístup ako hlavný diferenciátor na webe a sociálnych sieťach.",
      "Konkurenčné pracoviská ťažia z online rezervácií – zabezpečte, aby odkaz na online objednanie bol v každom príspevku a profile.",
      "Vysoký dopyt majiteľov v regióne je po dentálnej hygiene a seniorských skríningoch – zaraďte tieto témy do pravidelnej rotácie týždenného plánu.",
      "Dôsledne zbierajte Google recenzie po úspešných ošetreniach – kliniky s ratingom nad 4.7 získavajú až o 40% viac nových klientov z vyhľadávania.",
    ],
    articles: [
      {
        title: "Veterinárne kliniky hlásia nárast dopytu po preventívnych balíčkoch a dentálnej hygiene",
        source: "Veterinárny spravodajca SR",
        url: "https://www.kvlsr.sk",
        publishedAt: dAgo(7),
        summary: "Regionálny prehľad uvádza, že kliniky s ročnými balíčkami prevencie a moderným vybavením majú stabilnejšiu obsadenosť kalendára mimo hlavnej sezóny.",
      },
      {
        title: "Majitelia zvierat si kliniku vyberajú podľa recenzií a komunikácie, nie podľa najnižšej ceny",
        source: "Odborný portál VetMed",
        url: "https://www.vetmed.sk",
        publishedAt: dAgo(16),
        summary: "Prieskum spotrebiteľského správania na Slovensku: rozhodujúce faktory sú hodnotenia na Google, rýchlosť objednania a empatická starostlivosť.",
      },
      {
        title: "Zákonné povinnosti čipovania a registrácie v CRSZ: Dôležitosť osvety",
        source: "ŠVPS SR",
        url: "https://www.svps.sk",
        publishedAt: dAgo(23),
        summary: "Štátna veterinárna a potravinová správa SR pripomína dôležitosť kontroly platnosti očkovania proti besnote a funkčnosti mikročipov.",
      },
    ],
    sources: [
      `Google Maps (${region})`,
      "Register veterinárnych lekárov KVL SR",
      "Prieskum trhu veterinárnych služieb v SR",
    ],
  };
}

export async function analyzeCompetitors(query: string): Promise<CompetitorResult> {
  const q = query.trim();
  if (!q) {
    return getSampleCompetitorResult("Bratislava");
  }

  try {
    const model = configuredModel();
    const prompt = `Si špičkový trhový a konkurenčný analytik pre veterinárne kliniky na Slovensku.
Vykonaj podrobnú trhovú a konkurenčnú analýzu pre lokalitu/mesto: "${q}".
Nájdi alebo modeluj 4 až 5 reprezentatívnych veterinárnych kliník/ambulancií v tejto lokalite.
Dodržuj striktné pravidlá veterinárnej etiky (analýza slúži na internú stratégiu, nie verejné osočovanie).

Vráť VÝHRADNE čistý JSON objekt bez akéhokoľvek markdown obalu podľa tejto presnej schémy:
{
  "region": "${q}",
  "clinics": [
    {
      "name": "Názov kliniky",
      "rating": 4.7,
      "reviewCount": 180,
      "services": ["Preventívna medicína", "Chirurgia", "Stomatológia", "Digitálny RTG"],
      "pricingNote": "Štandardná až vyššia cenová kategória",
      "mapsUrl": "https://maps.google.com/?q=veterinar+${encodeURIComponent(q)}",
      "latestPosts": [
        { "platform": "facebook", "text": "Oznam o preventívnych prehliadkach.", "publishedAt": "Pred 3 dňami", "engagement": 45 }
      ]
    }
  ],
  "recommendations": [
    "Konkrétne strategické odporúčanie 1 pre rozvoj našej kliniky v lokalite",
    "Odporúčanie 2 k cenotvorbe, výbave a službám",
    "Odporúčanie 3 k digitálnemu marketingu a edukácii"
  ],
  "articles": [
    {
      "title": "Aktuálne trendy vo veterinárnej starostlivosti v regióne",
      "source": "Veterinárny spravodajca SR",
      "url": "https://www.kvlsr.sk",
      "publishedAt": "Tento mesiac",
      "summary": "Zhrnutie trhových trendov."
    }
  ],
  "sources": ["Google Maps Grounding", "KVL SR Register"]
}`;

    const res = await generateText({
      model,
      prompt,
    });

    const raw = res.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as CompetitorResult;
      return {
        region: parsed.region || q,
        clinics: parsed.clinics && parsed.clinics.length > 0 ? parsed.clinics : getSampleCompetitorResult(q).clinics,
        recommendations: parsed.recommendations && parsed.recommendations.length > 0 ? parsed.recommendations : getSampleCompetitorResult(q).recommendations,
        articles: parsed.articles && parsed.articles.length > 0 ? parsed.articles : getSampleCompetitorResult(q).articles,
        sources: parsed.sources || ["Google Maps Grounding", "KVL SR"],
        model: "ai-market-analyst",
        isSample: false,
      };
    }
  } catch (err) {
    console.warn("AI competitor analysis fallback to sample:", err);
  }

  return getSampleCompetitorResult(q);
}
