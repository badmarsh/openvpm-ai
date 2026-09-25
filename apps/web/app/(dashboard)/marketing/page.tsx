"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Megaphone,
  Calendar,
  FileText,
  Globe,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  pageShellClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingStudioContent } from "./_marketing-studio";
import { CompetitorsSummary } from "@/components/marketing/competitors-summary";
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
    <div className={pageShellClass}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="w-full"
      >
        <TabsList className={underlineTabsListClass}>
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={underlineTabsTriggerClass}
            >
              <tab.icon className="h-4 w-4" />
              <span>{t(tab.labelKey, tab.labelFallback)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
      {activeTab === "competitors" && <CompetitorsSummary />}
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
