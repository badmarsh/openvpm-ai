"use client";

import { useState } from "react";
import {
  Newspaper,
  ShieldAlert,
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Building2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface IntelItem {
  id: string;
  source: "SVPS_SR" | "KVL_SR" | "SUKL" | "CLINICAL";
  sourceName: string;
  title: string;
  category: "alert" | "regulation" | "drug" | "advisory";
  date: string;
  summary: string;
  badge: string;
  badgeVariant: "destructive" | "default" | "secondary" | "outline";
  officialUrl?: string;
  actRef?: string;
}

const INTEL_ITEMS: IntelItem[] = [
  {
    id: "1",
    source: "SVPS_SR",
    sourceName: "ŠVPS SR",
    title: "Mimoriadne núdzové opatrenia: Besnota a vakcinácia mäsožravcov",
    category: "alert",
    date: "2026-09-01",
    summary:
      "Povinná antirabická vakcinácia psov, mačiek a fretiek podľa § 17 zákona č. 39/2007 Z. z. Hlásenie každého podozrenia a pohryznutia človeka príslušnej RVPS do 3 pracovných dní.",
    badge: "Zákonná povinnosť",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
    actRef: "Zákon 39/2007 Z. z.",
  },
  {
    id: "2",
    source: "SVPS_SR",
    sourceName: "ŠVPS SR",
    title: "Africký mor ošípaných (AMO) – Aktualizácia reštrikčných pásiem",
    category: "alert",
    date: "2026-08-28",
    summary:
      "Aktualizácia ochranných pásiem a pásiem dohľadu na východnom a južnom Slovensku. Zákaz presunu vnímavých zvierat bez veterinárneho sprievodného dokladu.",
    badge: "Epizootológia",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
  },
  {
    id: "3",
    source: "KVL_SR",
    sourceName: "KVL SR",
    title: "Smernica o vedení knihy narkotík a psychotropných látok v ambulancii",
    category: "regulation",
    date: "2026-08-15",
    summary:
      "Metodické usmernenie pre evidenciu omamných látok II. a III. skupiny v súlade so zákonom č. 139/1998 Z. z. Archivácia záznamov minimálne 5 rokov.",
    badge: "Legislatíva",
    badgeVariant: "default",
    officialUrl: "https://www.kvlsr.sk",
    actRef: "Zákon 139/1998 Z. z.",
  },
  {
    id: "4",
    source: "SUKL",
    sourceName: "ÚSKVBL / ŠÚKL",
    title: "Bezpečnostné upozornenie: Ochranné lehoty pri potravinových zvieratách",
    category: "drug",
    date: "2026-08-10",
    summary:
      "Dôsledné dodržiavanie a zaznamenávanie ochranných lehôt (mäso, mlieko) pri aplikácii registrovaných VLP. Povinný zápis do Denníka veterinárnych úkonov.",
    badge: "Ochranné lehoty",
    badgeVariant: "secondary",
  },
  {
    id: "5",
    source: "CLINICAL",
    sourceName: "Klinický protokol",
    title: "Sezónny výskyt Babesiózy a kliešťovej encefalitídy na západe a juhu SR",
    category: "advisory",
    date: "2026-08-01",
    summary:
      "Zvýšený záchyt Babesia canis prenášanej pijakom lužným (Dermacentor reticulatus). Odporúčané skoré vyšetrenie krvného náteru a PCR diagnostika pri hypertermii a splenomegálii.",
    badge: "Klinická prax",
    badgeVariant: "outline",
  },
];

export default function VetIntelPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered = INTEL_ITEMS.filter((item) => {
    const matchesCat =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      search.trim() === "" ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.summary.toLowerCase().includes(search.toLowerCase()) ||
      item.sourceName.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {t("nav.vetIntel", "Vet Intelligence")}
              </h1>
              <p className="text-sm text-muted-foreground">
                Úradné vestníky ŠVPS SR, nariadenia KVL SR, registrácia liečiv a epizootologický dohľad
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.svps.sk"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5"
            >
              <Building2 className="h-4 w-4" />
              ŠVPS SR Portál
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.kvlsr.sk"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5"
            >
              <FileCheck2 className="h-4 w-4" />
              KVL SR Portál
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať v obežníkoch, zákonoch a správach..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
          >
            Všetky
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "alert" ? "default" : "outline"}
            onClick={() => setSelectedCategory("alert")}
          >
            Epizootológia & Výstrahy
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "regulation" ? "default" : "outline"}
            onClick={() => setSelectedCategory("regulation")}
          >
            Legislatíva & KVL
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "drug" ? "default" : "outline"}
            onClick={() => setSelectedCategory("drug")}
          >
            Liečivá & ŠÚKL
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "advisory" ? "default" : "outline"}
            onClick={() => setSelectedCategory("advisory")}
          >
            Klinické protokoly
          </Button>
        </div>
      </div>

      {/* Intel Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <Card key={item.id} className="border border-border bg-card shadow-sm hover:border-primary/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.badgeVariant} className="text-[10px]">
                      {item.badge}
                    </Badge>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {item.sourceName}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {item.date}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold leading-snug">
                    {item.title}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
              {item.actRef && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Info className="h-3.5 w-3.5" />
                  <span>Referencia: {item.actRef}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
