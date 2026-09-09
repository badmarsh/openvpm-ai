"use client";

import { Stethoscope, Calendar, Pill, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export function AgentCapabilitiesView({
  onPickQuery,
  onActivateWriteMode,
}: {
  onPickQuery: (query: string) => void;
  onActivateWriteMode: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("agent.capabilitiesTitle", "Klinické a administratívne schopnosti asistenta")}
        </CardTitle>
        <CardDescription>
          {t(
            "agent.capabilitiesSubtitle",
            "Prehľad nástrojov a automatizácií, ktoré má OpenVPM AI asistent k dispozícii v reálnom čase.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("agent.capabilities.recordsSearch.title", "Vyhľadávanie v kartotéke")}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t("agent.capabilities.badgeRead", "Čítanie")}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {t(
                  "agent.capabilities.recordsSearch.desc",
                  "Okamžitý prístup k záznamom pacientov, histórii liečby, preočkovaniam a laboratórnym nálezom.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  onPickQuery(
                    t("agent.capabilities.recordsSearch.query", "Ktorí pacienti majú expirované očkovania?"),
                  )
                }
              >
                {t("agent.capabilities.tryQuery", "Vyskúšať dopyt")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("agent.capabilities.appointments.title", "Manažment termínov")}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t("agent.capabilities.badgeReadWrite", "Čítanie & Zápis")}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {t(
                  "agent.capabilities.appointments.desc",
                  "Prehľad dnešných návštev, kapacitné vyťaženie ordinácie a plánovanie nových kontrol v režime zápisu.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  onPickQuery(
                    t("agent.capabilities.appointments.query", "Zhrň dnešné termíny a objednaných pacientov."),
                  )
                }
              >
                {t("agent.capabilities.tryQuery", "Vyskúšať dopyt")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("agent.capabilities.pharmacology.title", "Veterinárna farmakológia")}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t("agent.capabilities.badgeCalculator", "Kalkulátor")}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {t(
                  "agent.capabilities.pharmacology.desc",
                  "Výpočet dávkovania liečiv (napr. NSAID, antibiotiká, anestetiká) podľa hmotnosti a druhu zvieraťa.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  onPickQuery(
                    t("agent.capabilities.pharmacology.query", "Aká je dávka karprofénu pre 12 kg psa?"),
                  )
                }
              >
                {t("agent.capabilities.tryQuery", "Vyskúšať dopyt")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("agent.capabilities.safeWrite.title", "Bezpečný režim zápisu")}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400">
                  {t("agent.capabilities.badgeDataProtection", "Ochrana dát")}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                {t(
                  "agent.capabilities.safeWrite.desc",
                  "Možnosť vytvárať rezervácie alebo zaznamenať vitálne funkcie len s vaším explicitným jednorazovým súhlasom.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onActivateWriteMode}
              >
                {t("agent.capabilities.safeWrite.activate", "Aktivovať režim zápisu")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
