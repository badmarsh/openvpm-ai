"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicalSimulationView } from "@/components/simulation/clinical-simulation-view";

export default function AdminSimulationPage() {
  const { t } = useI18n();

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-hidden">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <FlaskConical className="h-5 w-5" />
            </span>
            <span>{t("admin.simulation.title", "Klinická simulácia & Journey Discovery")}</span>
          </span>
        }
        subtitle={t(
          "admin.simulation.subtitle",
          "Interaktívna end-to-end simulácia 30 veterinárnych workflowov (J1–J30), 5 reálnych klinických prípadov, časovej osi dňa (08:00–17:30), slovenskej legislatívy, Clinical Guardianu a gap analýzy."
        )}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back", "Späť do Platform Admin")}
              </Button>
            </Link>
            <a
              href="/simulation.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                {t("settings.simulation.openNewTab", "Otvoriť samostatne")}
              </Button>
            </a>
          </div>
        }
      />

      <ClinicalSimulationView standalone />
    </div>
  );
}

