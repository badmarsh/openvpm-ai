"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Info,
  Mail,
  Package,
  Users,
  XCircle,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "openvpm_ai_agents_enabled";

interface AgentModule {
  id: string;
  icon: React.ReactNode;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  moduleKey: string;
  category: "inbox" | "inventory";
  alwaysOn?: boolean;
  subItems?: { label: string; status: "active" | "partial" | "inactive" }[];
}

const AGENT_MODULES: AgentModule[] = [
  {
    id: "suggest-client-action",
    icon: null,
    titleKey: "automations.aiAgents.suggestClientTitle",
    titleFallback: "Inbox: AI Navrhy klientov",
    descKey: "automations.aiAgents.suggestClientDesc",
    descFallback:
      "Automaticky navrhuje vytvorenie alebo priradenie klienta pri kazdom novom prichodom emaili.",
    moduleKey: "suggestClientAction",
    category: "inbox",
  },
  {
    id: "parse-attachment-invoice",
    icon: null,
    titleKey: "automations.aiAgents.parseInvoiceTitle",
    titleFallback: "Inbox: Import faktur z PDF",
    descKey: "automations.aiAgents.parseInvoiceDesc",
    descFallback:
      "Zobrazuje tlacidlo Sklad pri PDF prilohach od dodavatelov. Extrahuje polozky faktury cez AI.",
    moduleKey: "parseAttachmentAsInvoice",
    category: "inbox",
  },
  {
    id: "sender-grouping",
    icon: null,
    titleKey: "automations.aiAgents.senderGroupingTitle",
    titleFallback: "Inbox: Parovanie odosielatelov",
    descKey: "automations.aiAgents.senderGroupingDesc",
    descFallback:
      "Zoskupuje spravy od rovnakeho odosielatea do jedneho vlakna. Identifikuje klientov podla e-mailovej adresy.",
    moduleKey: "senderGroupKey",
    category: "inbox",
    alwaysOn: true,
  },
  {
    id: "wholesale-parsers",
    icon: null,
    titleKey: "automations.aiAgents.wholesaleTitle",
    titleFallback: "Sklad: Wholesale parsery",
    descKey: "automations.aiAgents.wholesaleDesc",
    descFallback:
      "Aktivni dodavatelia s podporou automatickeho parsovania faktur a cennikov.",
    moduleKey: "wholesaleParsers",
    category: "inventory",
    alwaysOn: true,
    subItems: [
      { label: "CYMEDICA", status: "active" },
      { label: "PHARMACOPOLA", status: "active" },
      { label: "PHARMOS", status: "partial" },
    ],
  },
];

function loadEnabledState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveEnabledState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

type TFn = (key: string, fallback: string, params?: Record<string, unknown>) => string;

function getIcon(id: string) {
  switch (id) {
    case "suggest-client-action":
      return <Sparkles className="h-5 w-5" />;
    case "parse-attachment-invoice":
      return <Package className="h-5 w-5" />;
    case "sender-grouping":
      return <Users className="h-5 w-5" />;
    case "wholesale-parsers":
      return <Package className="h-5 w-5" />;
    default:
      return <Mail className="h-5 w-5" />;
  }
}

export function AiAgentsView() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = loadEnabledState();
    const defaults: Record<string, boolean> = {};
    for (const mod of AGENT_MODULES) {
      defaults[mod.id] = stored[mod.id] ?? true;
    }
    setEnabled(defaults);
  }, []);

  function handleToggle(id: string, value: boolean) {
    const next = { ...enabled, [id]: value };
    setEnabled(next);
    saveEnabledState(next);
  }

  const inboxModules = AGENT_MODULES.filter((m) => m.category === "inbox");
  const inventoryModules = AGENT_MODULES.filter((m) => m.category === "inventory");

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t(
            "automations.aiAgents.infoBanner",
            "AI moduly su softverove komponenty integrovane priamo do OpenVPM AI. Prepinanie ulozi preferenciu lokalne — pre globalne nastavenia kliniky kontaktujte spravcu.",
          )}
        </span>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("automations.aiAgents.sectionInbox", "Inbox")}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {inboxModules.map((mod) => (
            <AgentCard
              key={mod.id}
              module={mod}
              isEnabled={enabled[mod.id] ?? true}
              onToggle={(v) => handleToggle(mod.id, v)}
              t={t}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("automations.aiAgents.sectionInventory", "Sklad a Zasoby")}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {inventoryModules.map((mod) => (
            <AgentCard
              key={mod.id}
              module={mod}
              isEnabled={enabled[mod.id] ?? true}
              onToggle={(v) => handleToggle(mod.id, v)}
              t={t}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface AgentCardProps {
  module: AgentModule;
  isEnabled: boolean;
  onToggle: (value: boolean) => void;
  t: TFn;
}

function AgentCard({ module: mod, isEnabled, onToggle, t }: AgentCardProps) {
  const isOn = mod.alwaysOn ? true : isEnabled;
  const icon = getIcon(mod.id);

  return (
    <Card className={cn("transition-opacity", !isOn && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isOn ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-snug">
                {t(mod.titleKey, mod.titleFallback)}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {mod.moduleKey}
                </code>
                {mod.alwaysOn && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {t("automations.aiAgents.alwaysOn", "vzdy aktivne")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Switch
            checked={isOn}
            onCheckedChange={mod.alwaysOn ? undefined : onToggle}
            disabled={mod.alwaysOn}
            aria-label={t(mod.titleKey, mod.titleFallback)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-xs leading-relaxed">
          {t(mod.descKey, mod.descFallback)}
        </CardDescription>

        <div className="flex items-center gap-1.5 text-xs">
          {isOn ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-700 dark:text-green-400">
                {t("automations.aiAgents.statusActive", "Aktivny")}
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t("automations.aiAgents.statusDisabled", "Vypnuty")}
              </span>
            </>
          )}
        </div>

        {mod.subItems && mod.subItems.length > 0 && (
          <div className="space-y-1 border-t pt-1">
            {mod.subItems.map((sub) => (
              <div key={sub.label} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{sub.label}</span>
                <Badge
                  variant={
                    sub.status === "active"
                      ? "default"
                      : sub.status === "partial"
                        ? "secondary"
                        : "outline"
                  }
                  className="h-4 px-1.5 text-[10px]"
                >
                  {sub.status === "active"
                    ? t("automations.aiAgents.parserActive", "aktivny")
                    : sub.status === "partial"
                      ? t("automations.aiAgents.parserPartial", "ciastocny")
                      : t("automations.aiAgents.parserInactive", "neaktivny")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
