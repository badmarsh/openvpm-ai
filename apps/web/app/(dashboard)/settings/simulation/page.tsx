"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { pageShellClass } from "@/components/layout/page-kit";
import { SimulationTab } from "@/components/settings/simulation-tab";

export default function SettingsSimulationPage() {
  const { t } = useI18n();

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={FlaskConical}
        title={t("settings.simulation.title", "Klinická simulácia & Journey Discovery")}
        subtitle={t(
          "settings.simulation.subtitle",
          "Interaktívna simulácia 30 veterinárnych workflowov (J1–J30), 5 reálnych prípadov, časovej osi dňa (08:00–17:30), slovenskej legislatívy, Clinical Guardianu a gap analýzy.",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back", "Späť do Nastavení")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="gap-1.5">
              <a href="/simulation.html" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("settings.simulation.openNewTab", "Otvoriť samostatne")}
              </a>
            </Button>
          </div>
        }
      />

      <SimulationTab />
    </div>
  );
}
