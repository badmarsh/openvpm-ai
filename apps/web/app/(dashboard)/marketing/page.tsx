"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Megaphone,
  Calendar,
  FileText,
  Globe,
  Loader2,
  Building2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PageSectionHeader } from "@/components/layout/page-header";
import { MarketingStudioContent } from "./_marketing-studio";
import { ContentCalendarTab } from "@/components/marketing/content-calendar-tab";
import { SocialApprovalQueueTab } from "@/components/marketing/social-approval-queue-tab";

type TabId = "overview" | "calendar" | "queue" | "competitors";

const TABS: { id: TabId; labelKey: string; labelFallback: string; icon: React.ElementType }[] = [
  { id: "overview", labelKey: "marketing.tabOverview", labelFallback: "Prehľad & Generátor", icon: Megaphone },
  { id: "calendar", labelKey: "marketing.tabCalendar", labelFallback: "Kalendár obsahu", icon: Calendar },
  { id: "queue", labelKey: "marketing.tabQueue", labelFallback: "Schvaľovací proces", icon: FileText },
  { id: "competitors", labelKey: "marketing.tabCompetitors", labelFallback: "Konkurencia & Intel", icon: Globe },
];

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// 2B: static color map — dynamic `bg-${color}-100` classes are purged by Tailwind
const competitorColorMap: Record<string, string> = {
  blue: "bg-blue-100 dark:bg-blue-900/30",
  green: "bg-green-100 dark:bg-green-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
};

function CompetitorsTab() {
  const { t } = useI18n();
  const competitors = [
    { initials: "VK", name: "Vet Klinika Bratislava", typeKey: "marketing.competitors.typeClinic", typeFallback: "Veterinárna klinika", posts: 24, engagement: "3.2%", growth: "+12%", growthPositive: true, color: "blue" },
    { initials: "PV", name: "Pet Vets Košice", typeKey: "marketing.competitors.typeAmbulance", typeFallback: "Veterinárna ambulancia", posts: 18, engagement: "2.8%", growth: "+8%", growthPositive: true, color: "green" },
    { initials: "AC", name: "Animal Care B. Bystrica", typeKey: "marketing.competitors.typePractice", typeFallback: "Veterinárna prax", posts: 15, engagement: "4.1%", growth: "-2%", growthPositive: false, color: "purple" },
  ];
  return (
    <div className="space-y-6">
      <PageSectionHeader
        title={t("marketing.competitors.title", "Konkurencia & Intel")}
        subtitle={t("marketing.competitors.subtitle", "Monitorovanie konkurenčných aktivít a trhový výskum")}
        actions={
          <Button className="text-xs gap-1.5" variant="outline" size="sm">
            <Globe className="h-3.5 w-3.5" />
            <span>{t("marketing.competitors.startMonitoring", "Spustiť monitorovanie")}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitors.map((competitor) => (
          <div key={competitor.initials} className="rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", competitorColorMap[competitor.color] ?? "bg-muted")}>
                <span className="text-xs font-bold">{competitor.initials}</span>
              </div>
              <div>
                <div className="font-medium text-sm">{competitor.name}</div>
                <div className="text-xs text-muted-foreground">{t(competitor.typeKey, competitor.typeFallback)}</div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("marketing.competitors.posts30d", "Publikácie (30 dní)")}</span>
                <span className="font-medium">{competitor.posts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("marketing.competitors.engagement", "Zapojenie")}</span>
                <span className="font-medium">{competitor.engagement}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("marketing.competitors.followerGrowth", "Rast sledujúcich")}</span>
                <span className={cn("font-medium", competitor.growthPositive ? "text-emerald-600" : "text-red-600")}>{competitor.growth}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <h3 className="font-medium text-sm mb-3">{t("marketing.competitors.recentDiscoveries", "Nedávne objavy")}</h3>
        <div className="space-y-3">
          <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium">{t("marketing.competitors.newCampaign", "Nová akcia konkurencie")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("marketing.competitors.discoveryCampaignDetail", "Vet Klinika Bratislava spustila výhodnú ponuku preventívnych prehliadok", { name: "Vet Klinika Bratislava" })}</div>
              </div>
            </div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium">{t("marketing.competitors.teamChange", "Zmena v tíme")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("marketing.competitors.discoveryTeamDetail", "Pet Vets Košice zamestnali nového veterinára so špecializáciou na ortopédiu", { name: "Pet Vets Košice" })}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketingStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "overview"
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    router.replace(`/marketing?${params.toString()}`, { scroll: false });
  }, [activeTab, router]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {t(tab.labelKey, tab.labelFallback)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <Suspense fallback={<TabLoadingFallback />}>
          <MarketingStudioContent />
        </Suspense>
      )}
      {activeTab === "calendar" && (
        <Suspense fallback={<TabLoadingFallback />}>
          <ContentCalendarTab />
        </Suspense>
      )}
      {activeTab === "queue" && (
        <Suspense fallback={<TabLoadingFallback />}>
          <SocialApprovalQueueTab />
        </Suspense>
      )}
      {activeTab === "competitors" && <CompetitorsTab />}
    </div>
  );
}

export default function MarketingStudioPage() {
  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <MarketingStudioInner />
    </Suspense>
  );
}
