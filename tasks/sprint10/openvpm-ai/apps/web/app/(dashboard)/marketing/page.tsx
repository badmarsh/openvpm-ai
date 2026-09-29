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
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PageSectionHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
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

function CompetitorsTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageSectionHeader
        title={t("marketing.competitors.title", "Konkurencia & Intel")}
        subtitle={t("marketing.competitors.subtitle", "Monitorovanie konkurenčných aktivít a trhový výskum")}
      />
      <EmptyState
        icon={Globe}
        title={t("marketing.competitors.emptyTitle", "Monitorovanie konkurencie nie je pripojené")}
        description={t(
          "marketing.competitors.emptyDescription",
          "Žiadne demo kliniky. Pripojte zdroj trhu, keď bude k dispozícii.",
        )}
      />
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
