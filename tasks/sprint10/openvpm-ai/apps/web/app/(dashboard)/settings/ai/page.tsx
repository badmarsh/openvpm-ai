"use client";

import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { AiSettingsTab } from "@/components/settings/ai-settings-tab";

export default function AiSettingsDedicatedPage() {
  const { t } = useI18n();

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-hidden">
      <PageHeader
        title={t("settings.ai.title", "Nastavenia AI")}
        subtitle={t(
          "settings.ai.subtitle",
          "Konfigurácia AI poskytovateľov, vlastných endpointov, načítavanie modelov a mapovanie AI funkcií kliniky.",
        )}
        actions={
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back", "Späť")}
            </Button>
          </Link>
        }
      />

      <AiSettingsTab />
    </div>
  );
}
