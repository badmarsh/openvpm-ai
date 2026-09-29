"use client";

import React from "react";
import Link from "next/link";
import {
  FlaskConical,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Users,
  ShieldCheck,
  PlayCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ClinicalSimulationAdminCard() {
  const { t } = useI18n();

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold font-heading">
                {t("admin.simulation.title", "Klinická simulácia & Journey Discovery")}
              </h3>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 text-[11px] font-semibold">
                {t("admin.simulation.badgePilot", "PILOT-READY (v0.6)")}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
              {t(
                "admin.simulation.subtitle",
                "Interaktívna end-to-end simulácia 30 veterinárnych workflowov (J1–J30), 5 reálnych klinických prípadov, časovej osi dňa (08:00–17:30), slovenskej legislatívy, Clinical Guardianu a gap analýzy."
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings?tab=simulation">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <FlaskConical className="h-3.5 w-3.5 text-primary" />
              {t("admin.simulation.openInSettings", "Otvoriť v Nastaveniach")}
            </Button>
          </Link>
          <Link href="/admin/simulation">
            <Button size="sm" className="gap-1.5 text-xs">
              <PlayCircle className="h-3.5 w-3.5" />
              {t("admin.simulation.launch", "Spustiť simuláciu")}
            </Button>
          </Link>
          <a
            href="/simulation.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("admin.simulation.openNewTab", "Otvoriť v novom okne")}
            </Button>
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium">{t("admin.simulation.badgeWorkflows", "30 tokov (J1–J30)")}</span>
          </div>
          <p className="text-sm font-bold text-foreground">100% Pokrytie</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium">{t("admin.simulation.badgeCases", "5 prípadov")}</span>
          </div>
          <p className="text-sm font-bold text-emerald-600">Reálna ambulancia</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-medium">6 Persón</span>
          </div>
          <p className="text-sm font-bold text-foreground">P1–P6 profily</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium">4 858 Testov</span>
          </div>
          <p className="text-sm font-bold text-foreground">100% Pass</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] font-medium">6 Gaps (C-01..06)</span>
          </div>
          <p className="text-sm font-bold text-amber-600">Roadmapa v0.7</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium">Legislatíva SR</span>
          </div>
          <p className="text-sm font-bold text-emerald-600">Z39 / Z139 / e-Kasa</p>
        </div>
      </div>
    </div>
  );
}

