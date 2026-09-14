"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  LayoutTemplate,
  Users,
  Star,
  Clock,
  CalendarCheck2,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Mail,
  Video,
  Share2,
  FileCode,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { SectionType } from "@/lib/marketing/website-builder-types";

export interface TemplateDefinition {
  type: SectionType;
  name: string;
  description: string;
  category: "hero_about" | "services_team" | "trust_social" | "booking_contact" | "media_content";
  icon: React.ComponentType<{ className?: string }>;
}

export const SECTION_TEMPLATES: TemplateDefinition[] = [
  {
    type: "hero",
    name: "Hero Banner",
    description: "Hlavný uvítací blok s nadpisom, tlačidlami a kontaktnou kartou.",
    category: "hero_about",
    icon: LayoutTemplate,
  },
  {
    type: "about",
    name: "O klinike & Príbeh",
    description: "Predstavenie kliniky s formátovaným textom, fotkou a číslami.",
    category: "hero_about",
    icon: Sparkles,
  },
  {
    type: "stats",
    name: "Štatistiky v číslach",
    description: "Pôsobivý pás 4 kľúčových čísiel o vašej praxi a skúsenostiach.",
    category: "hero_about",
    icon: TrendingUp,
  },
  {
    type: "services",
    name: "Prehľad služieb",
    description: "Karty odborných veterinárnych zákrokov s ikonami a cenami.",
    category: "services_team",
    icon: ShieldCheck,
  },
  {
    type: "team",
    name: "Veterinárny tím",
    description: "Zoznam lekárov a sestier chránený GDPR súhlasom.",
    category: "services_team",
    icon: Users,
  },
  {
    type: "trust_badges",
    name: "Certifikáty & Garancie",
    description: "Odznaky Fear-Free, členstvo v KVL SR a GDPR bezpečnosť.",
    category: "services_team",
    icon: ShieldCheck,
  },
  {
    type: "wellness",
    name: "Wellness & Plány",
    description: "Členské preventívne balíky starostlivosti pre stálych klientov.",
    category: "services_team",
    icon: Sparkles,
  },
  {
    type: "reviews",
    name: "Recenzie klientov",
    description: "Overené hodnotenia Google/Facebook v mriežke alebo karuseli.",
    category: "trust_social",
    icon: Star,
  },
  {
    type: "social_proof",
    name: "Sociálne siete",
    description: "Odkazy na Instagram, Facebook a TikTok profil z Brand Kitu.",
    category: "trust_social",
    icon: Share2,
  },
  {
    type: "handouts",
    name: "Edukačné letáky",
    description: "Dynamické medicínske rady pre chovateľov priamo z OpenVPM.",
    category: "trust_social",
    icon: FileText,
  },
  {
    type: "booking_cta",
    name: "Online rezervácia CTA",
    description: "Výzva k akcii pre okamžitú rezerváciu termínu vyšetrenia.",
    category: "booking_contact",
    icon: CalendarCheck2,
  },
  {
    type: "emergency_banner",
    name: "Pohotovostný banner",
    description: "Výrazné núdzové upozornenie s okamžitým volaním pri akútnych stavoch.",
    category: "booking_contact",
    icon: AlertTriangle,
  },
  {
    type: "contact_form",
    name: "Kontaktný formulár",
    description: "Jednoduchý formulár na otázky majiteľov zvierat.",
    category: "booking_contact",
    icon: Mail,
  },
  {
    type: "hours_location",
    name: "Ordinačné hodiny & Mapa",
    description: "Prehľadná tabuľka otváracích hodín a interaktívna mapa.",
    category: "booking_contact",
    icon: Clock,
  },
  {
    type: "gallery",
    name: "Fotogaléria",
    description: "Fotografie ambulancie, vybavenia a pacientov z mediálnej knižnice.",
    category: "media_content",
    icon: ImageIcon,
  },
  {
    type: "video_embed",
    name: "Video prezentácia",
    description: "Responzívne vložené video z YouTube alebo Vimeo.",
    category: "media_content",
    icon: Video,
  },
  {
    type: "faq",
    name: "Časté otázky (FAQ)",
    description: "Rozbaľovacie odpovede na najčastejšie otázky pred návštevou.",
    category: "media_content",
    icon: FileText,
  },
  {
    type: "custom_rich_text",
    name: "Vlastný textový blok",
    description: "Bezpečný formátovaný text pre dôležité oznamy a pokyny.",
    category: "media_content",
    icon: FileCode,
  },
];

interface WebsiteEditorPaletteProps {
  onAddSection: (type: SectionType) => void;
}

export function WebsiteEditorPalette({ onAddSection }: WebsiteEditorPaletteProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = SECTION_TEMPLATES.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "all" || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <aside className="w-80 shrink-0 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Knižnica sekcií</h2>
          <Badge variant="secondary" className="text-[10px]">
            17 šablón
          </Badge>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Hľadať sekciu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Všetky
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("hero_about")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              activeCategory === "hero_about"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Úvod
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("services_team")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              activeCategory === "services_team"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Služby & Tím
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("booking_contact")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              activeCategory === "booking_contact"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Kontakt & Rezervácia
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("media_content")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              activeCategory === "media_content"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Médiá & FAQ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Žiadna sekcia nevyhovuje filtru.
          </div>
        ) : (
          filtered.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.type}
                className="group rounded-xl border border-border bg-background p-3 hover:border-primary/50 hover:shadow-xs transition-all flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {t.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onAddSection(t.type)}
                  className="h-7 w-7 shrink-0 text-primary hover:bg-primary/10"
                  title="Pridať na stránku"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
