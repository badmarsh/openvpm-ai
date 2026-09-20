"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Zap, ShieldCheck, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { ClientAutomationsView } from "@/components/automations/client-automations-view";
import { ClinicalAutomationsView } from "@/components/automations/clinical-automations-view";
import { PageHeader } from "@/components/layout/page-header";

function AutomationsContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "clinical" ? "clinical" : "client";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t("automations.pageTitle", "Automatizácie a pravidlá kliniky")}
        subtitle={t(
          "automations.pageSubtitle",
          "Manažment klientskych marketingových automatizácií, interného Klinického strážcu a zákonných lehôt.",
        )}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="client" className="gap-2">
            <Zap className="h-4 w-4" />
            <span>{t("automations.tabClient", "Klientske automatizácie")}</span>
          </TabsTrigger>
          <TabsTrigger value="clinical" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>{t("automations.tabClinical", "Klinický strážca & Pravidlá")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="space-y-4">
          <ClientAutomationsView />
        </TabsContent>

        <TabsContent value="clinical" className="space-y-4">
          <ClinicalAutomationsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AutomationsContent />
    </Suspense>
  );
}
