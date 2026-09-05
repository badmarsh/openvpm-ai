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
  sourceNameKey: string;
  titleKey: string;
  category: "alert" | "regulation" | "drug" | "advisory";
  date: string;
  summaryKey: string;
  badgeKey: string;
  badgeVariant: "destructive" | "default" | "secondary" | "outline";
  officialUrl?: string;
  actRef?: string;
}

const INTEL_ITEMS: IntelItem[] = [
  {
    id: "1",
    source: "SVPS_SR",
    sourceNameKey: "vetIntel.svpsPortal",
    titleKey: "vetIntel.item1.title",
    category: "alert",
    date: "2026-09-01",
    summaryKey: "vetIntel.item1.summary",
    badgeKey: "vetIntel.item1.badge",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
    actRef: "Zákon 39/2007 Z. z.",
  },
  {
    id: "2",
    source: "SVPS_SR",
    sourceNameKey: "vetIntel.svpsPortal",
    titleKey: "vetIntel.item2.title",
    category: "alert",
    date: "2026-08-28",
    summaryKey: "vetIntel.item2.summary",
    badgeKey: "vetIntel.item2.badge",
    badgeVariant: "destructive",
    officialUrl: "https://www.svps.sk",
  },
  {
    id: "3",
    source: "KVL_SR",
    sourceNameKey: "vetIntel.kvlPortal",
    titleKey: "vetIntel.item3.title",
    category: "regulation",
    date: "2026-08-15",
    summaryKey: "vetIntel.item3.summary",
    badgeKey: "vetIntel.item3.badge",
    badgeVariant: "default",
    officialUrl: "https://www.kvlsr.sk",
    actRef: "Zákon 139/1998 Z. z.",
  },
  {
    id: "4",
    source: "SUKL",
    sourceNameKey: "vetIntel.kvlPortal",
    titleKey: "vetIntel.item4.title",
    category: "drug",
    date: "2026-08-10",
    summaryKey: "vetIntel.item4.summary",
    badgeKey: "vetIntel.item4.badge",
    badgeVariant: "secondary",
  },
  {
    id: "5",
    source: "CLINICAL",
    sourceNameKey: "vetIntel.categoryAdvisory",
    titleKey: "vetIntel.item5.title",
    category: "advisory",
    date: "2026-08-01",
    summaryKey: "vetIntel.item5.summary",
    badgeKey: "vetIntel.item5.badge",
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
    const searchLower = search.toLowerCase();
    const matchesSearch =
      search.trim() === "" ||
      t(item.titleKey).toLowerCase().includes(searchLower) ||
      t(item.summaryKey).toLowerCase().includes(searchLower) ||
      t(item.sourceNameKey).toLowerCase().includes(searchLower);
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
                {t("vetIntel.subtitle", "Official bulletins of SVPS SR, KVL SR regulations, drug registration and epizootological surveillance")}
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
              {t("vetIntel.svpsPortal", "SVPS SR Portal")}
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
              {t("vetIntel.kvlPortal", "KVL SR Portal")}
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
            placeholder={t("vetIntel.searchPlaceholder", "Search bulletins, laws and reports...")}
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
            {t("vetIntel.allCategories", "All")}
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "alert" ? "default" : "outline"}
            onClick={() => setSelectedCategory("alert")}
          >
            {t("vetIntel.categoryAlert", "Epizootology & Alerts")}
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "regulation" ? "default" : "outline"}
            onClick={() => setSelectedCategory("regulation")}
          >
            {t("vetIntel.categoryRegulation", "Legislation & KVL")}
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "drug" ? "default" : "outline"}
            onClick={() => setSelectedCategory("drug")}
          >
            {t("vetIntel.categoryDrug", "Drugs & SUKL")}
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "advisory" ? "default" : "outline"}
            onClick={() => setSelectedCategory("advisory")}
          >
            {t("vetIntel.categoryAdvisory", "Clinical Protocols")}
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
                      {t(item.badgeKey)}
                    </Badge>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t(item.sourceNameKey)}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {item.date}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold leading-snug">
                    {t(item.titleKey)}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(item.summaryKey)}
              </p>
              {item.actRef && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Info className="h-3.5 w-3.5" />
                  <span>{t("vetIntel.reference", "Reference:")} {item.actRef}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
