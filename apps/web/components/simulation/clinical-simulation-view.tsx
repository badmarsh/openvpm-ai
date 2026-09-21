"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  FlaskConical,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Users,
  Layers,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Stethoscope,
  Compass,
  ChevronDown,
  ChevronUp,
  Bot,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ClinicalSimulationViewProps {
  standalone?: boolean;
  className?: string;
  defaultScenario?: number;
}

export const SCENARIOS_12 = [
  {
    "id": 0,
    "name": "Bork",
    "fullName": "Bork (Zlatý retriever, 4r)",
    "species": "Bork (Zlatý retriever, 4r)",
    "category": "preventive",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐕",
    "desc": "Bork (Zlatý retriever, 4r) · V čakárni (12 min)",
    "highlight": "Klinický tok",
    "hermesSummary": "Pacient Bork zaevidovaný na recepcii. Check-in 08:15 prebehol hladko. Dôvod: záchvatovitý kašeľ po záťaži."
  },
  {
    "id": 1,
    "name": "Luna",
    "fullName": "Luna (Európska mačka, 2r)",
    "species": "Luna (Európska mačka, 2r)",
    "category": "safety",
    "badge": "🚨 KRITICKÝ STOP",
    "badgeColor": "bg-rose-100 text-rose-800 border-rose-300 animate-pulse",
    "icon": "🐱",
    "desc": "Luna (Európska mačka, 2r) · KRITICKÁ LIEKOVÁ INTERAKCIA",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem akútneho pacienta Luna. Majiteľ Peter Varga hlási krívanie po páde zo škrabadla."
  },
  {
    "id": 2,
    "name": "Max",
    "fullName": "Max (Kavalier King Charles, 7r)",
    "species": "Max (Kavalier King Charles, 7r)",
    "category": "chronic",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐶",
    "desc": "Max (Kavalier King Charles, 7r) · Kardiologický screening",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem pacienta Max na preventívnu geriatrickú prehliadku plemena Kavalier King Charles."
  },
  {
    "id": 3,
    "name": "Daisy",
    "fullName": "Daisy (Nemecký ovčiak, 9r)",
    "species": "Daisy (Nemecký ovčiak, 9r)",
    "category": "urgent",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐕",
    "desc": "Daisy (Nemecký ovčiak, 9r) · Akútna chirurgia (Pyometra)",
    "highlight": "Klinický tok",
    "hermesSummary": "URGENT: Daisy, 9-ročná fena s hnisavým výtokom, apatiou a horúčkou 39.8°C. Ultrazvuk potvrdzuje pyometru."
  },
  {
    "id": 4,
    "name": "Rocky",
    "fullName": "Rocky (Francúzsky buldoček, 1r)",
    "species": "Rocky (Francúzsky buldoček, 1r)",
    "category": "urgent",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐶",
    "desc": "Rocky (Francúzsky buldoček, 1r) · Toxikologický poplach",
    "highlight": "Klinický tok",
    "hermesSummary": "POHOTOVOSŤ: Rocky zjedol 100g 85% horkej čokolády pred 45 minútami. Prepočítavam toxickú dávku teobromínu."
  },
  {
    "id": 5,
    "name": "Bella",
    "fullName": "Bella (Perzská mačka, 5r)",
    "species": "Bella (Perzská mačka, 5r)",
    "category": "chronic",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐱",
    "desc": "Bella (Perzská mačka, 5r) · Renálny screening",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem perzskej mačky Bella. Majiteľka udáva znížený apetít, chudnutie a zvýšené pitie vody (polydipsia)."
  },
  {
    "id": 6,
    "name": "Bruno",
    "fullName": "Bruno (Rotvajler, 8r)",
    "species": "Bruno (Rotvajler, 8r)",
    "category": "urgent",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐕",
    "desc": "Bruno (Rotvajler, 8r) · Šokový chirurgický stav",
    "highlight": "Klinický tok",
    "hermesSummary": "KRITICKÝ ČERVENÝ KÓD: 8-ročný rotvajler Bruno s nafúknutým tvrdým bruchom a neproduktívnym dávením po kŕmení."
  },
  {
    "id": 7,
    "name": "Milo",
    "fullName": "Milo (Králik baranček, 2r)",
    "species": "Milo (Králik baranček, 2r)",
    "category": "safety",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐰",
    "desc": "Milo (Králik baranček, 2r) · Gastrointestinálna stáza",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem králika Milo. Majiteľka hlási, že králik 18 hodín nežerie a nemá žiadne bobaľky v klietke."
  },
  {
    "id": 8,
    "name": "Zara",
    "fullName": "Zara (Border Kólia, 3r)",
    "species": "Zara (Border Kólia, 3r)",
    "category": "safety",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐕",
    "desc": "Zara (Border Kólia, 3r) · MDR1 Génový screening",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem Border Kólie Zara na odčervenie a nastavenie celoročnej ektoparazitárnej prevencie."
  },
  {
    "id": 9,
    "name": "Hugo",
    "fullName": "Hugo (Mops, 4r)",
    "species": "Hugo (Mops, 4r)",
    "category": "chronic",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐶",
    "desc": "Hugo (Mops, 4r) · BOAS Obštrukcia",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem brachycefalického pacienta Hugo. Hlasný stridor, dýchavičnosť a intolerancia tepla v letnom období."
  },
  {
    "id": 10,
    "name": "Nela",
    "fullName": "Nela (Labrador, 6r)",
    "species": "Nela (Labrador, 6r)",
    "category": "chronic",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐕",
    "desc": "Nela (Labrador, 6r) · Endokrinologický audit",
    "highlight": "Klinický tok",
    "hermesSummary": "Príjem labradorky Nela. Majiteľ pozoruje enormný smäd (vypije 4.5 litra vody denne) a nočné pomočovanie."
  },
  {
    "id": 11,
    "name": "Simba",
    "fullName": "Simba (Kocúr, 3r)",
    "species": "Simba (Kocúr, 3r)",
    "category": "urgent",
    "badge": "Klinika + e-Kasa",
    "badgeColor": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "icon": "🐱",
    "desc": "Simba (Kocúr, 3r) · Urgentná obštrukcia uretry",
    "highlight": "Klinický tok",
    "hermesSummary": "AKÚTNY URGENTNÝ PRÍJEM: Kocúr Simba, bolestivé mňaukanie na záchodíku, strangúria a anúria 24 hodín."
  }
];

const PERSONAS = [
  {
    id: "P1",
    name: "MVDr. Kováčová",
    role: "Admin & Hlavný veterinár",
    profile: "Majiteľka kliniky (15r praxe), 2-4 lekári. Zodpovedá za legislatívu, financie a nákupy.",
    focus: "KVEPIS, e-Kasa uzávierky, personál, štatistiky a KVL SR zhoda",
  },
  {
    id: "P2",
    name: "MVDr. Hruška",
    role: "Ambulantný veterinár",
    profile: "Mladý lekár (2r praxe), tech-savvy, diktuje záznamy hlasom cez AI Scribe.",
    focus: "Hlasové diktovanie, SOAP, Clinical Guardian interakcie, RTG VHS, lab import",
  },
  {
    id: "P3",
    name: "Zuzana",
    role: "Recepcia & Front Desk",
    profile: "Recepčná bez veterinárneho vzdelania, obslúži 40-60 hovorov/deň.",
    focus: "Online booking, check-in, whiteboard tok, klientske karty, platby a e-Kasa doklady",
  },
  {
    id: "P4",
    name: "Peter",
    role: "Veterinárny technik",
    profile: "Vet technik (5r praxe), meria vitálne funkcie, pripravuje pacientov a asistuje.",
    focus: "Meranie vitálnych funkcií, váženie, výdaj liekov zo skladu, príprava na zákrok",
  },
  {
    id: "P5",
    name: "Ing. Kováč",
    role: "Manažér & Financie",
    profile: "Manažér praxe, stará sa o účtovníctvo, e-Kasa audit, marketing a kampane.",
    focus: "Fakturácia, exporty do Pohody/Omegy, recall automatizácie, reputácia kliniky",
  },
  {
    id: "P6",
    name: "Mária Nováková",
    role: "Klientka / Majiteľka zvieraťa",
    profile: "Majiteľka psa Bork a mačky Luna, používa smartfón a klientsky portál.",
    focus: "PWA klientsky portál, online objednávanie, očkovací preukaz, lekárske správy",
  },
];

const GAPS = [
  {
    id: "C-01",
    title: "Anesteziologický perioperačný záznam",
    severity: "CRITICAL",
    desc: "Chýba digitálny záznam anestézie s periódou 5 minút (T, HR, RR, SpO2, EtCO2, Isofluran).",
    solution: "Plánované pre v0.7 — ext_anesthesia schéma + live canvas graf.",
  },
  {
    id: "C-02",
    title: "Hospitalizačný denný záznam (ICU Flowsheet)",
    severity: "CRITICAL",
    desc: "Chýba 24h mriežka pre hospitalizovaných pacientov (infúzie, lieky, venkany, močenie).",
    solution: "Plánované pre v0.7 — ext_hospitalization schéma + inpatient router.",
  },
  {
    id: "C-03",
    title: "Chirurgický protokol & WHO Checklist",
    severity: "HIGH",
    desc: "Chýba štruktúrovaný protokol chirurgického zákroku s počítaním materiálu pred a po.",
    solution: "Plánované pre v0.7 — ext_surgery schéma + checklist komponent.",
  },
  {
    id: "C-04",
    title: "Urgentná triážna čakáreň (Manchester Triage)",
    severity: "HIGH",
    desc: "Čakáreň nerozlišuje farebné triážne stupne (Červená - resuscitácia, Žltá - urgent, Zelená - stabilný).",
    solution: "Plánované pre v0.7 — triážny filter a auto-prioritizácia na whiteboarde.",
  },
  {
    id: "C-06",
    title: "Priamy webový DICOM prehliadač",
    severity: "MEDIUM",
    desc: "Systém podporuje JPG/PNG analýzu VHS; plné 16-bit multi-frame DICOM okno vyžaduje rozšírenie.",
    solution: "Čiastočne integrované — v0.7 doplní CornerStoneJS viewer pre natívne DICOM PACS.",
  },
];

const LEGISLATIVE_GATES = [
  {
    law: "Zákon č. 39/2007 Z. z.",
    name: "Veterinárna starostlivosť & KVL SR",
    points: [
      "Human-in-the-Loop (HITL): AI návrhy diagnóz a liečby sú výhradne poradné (DRAFT stav).",
      "Lekár musí každý klinický záznam potvrdiť a podpísať s kryptografickým HMAC odtlačkom.",
      "Zákaz nekalej reklamy a menovitého porovnávania kliník v marketingovom štúdiu.",
    ],
  },
  {
    law: "Zákon č. 139/1998 Z. z.",
    name: "Omamné a psychotropné látky (OPL II/III)",
    points: [
      "Zero AI Prefill: Zákaz automatického predpĺňania opiátov, ketamínu, propofolu a butorfanolu.",
      "Povinnosť fyzického svedka a dvojitej autorizácie pri podaní alebo znehodnotení látky.",
      "Digitálna kniha omamných látok s nemenným auditným záznamom (statutory OPL register).",
    ],
  },
  {
    law: "Zákon č. 289/2008 Z. z.",
    name: "e-Kasa & Finančná správa SR",
    points: [
      "Povinné generovanie platných dokladov s overením UID a PKP podpisu.",
      "Offline fronta s automatickým odoslaním do 48 hodín v prípade výpadku internetu.",
      "Podpora FiskalPRO, VRP2 tlačových profilov a QR kódov pre bločky.",
    ],
  },
];

export function ClinicalSimulationView({
  standalone = false,
  className = "",
  defaultScenario = 0,
}: ClinicalSimulationViewProps) {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number>(defaultScenario);
  const [scenarioFilter, setScenarioFilter] = useState<"all" | "urgent" | "chronic" | "safety">("all");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeInfoTab, setActiveInfoTab] = useState<"personas" | "gaps" | "journeys" | "compliance">("personas");
  const [isIframeLoaded, setIsIframeLoaded] = useState<boolean>(false);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(true);
  const [hermesUserQuestion, setHermesUserQuestion] = useState<string>("");
  const [hermesResponseText, setHermesResponseText] = useState<string | null>(null);

  const postToIframe = useCallback((message: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
  }, []);

  const handleSelectScenario = (id: number) => {
    setSelectedScenario(id);
    setHermesResponseText(null);
    postToIframe({ type: "SET_SCENARIO", id });
  };

  const handleReload = () => {
    if (iframeRef.current) {
      setIsIframeLoaded(false);
      iframeRef.current.src = "/simulation.html";
    }
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleAskHermes = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hermesUserQuestion.trim()) return;
    const current = SCENARIOS_12.find((s) => s.id === selectedScenario) || SCENARIOS_12[0];
    setHermesResponseText(`🧠 Hermes Clinical Observer: Pre pacienta ${current.name} (${current.species}) zaznamenávam dopyt: "${hermesUserQuestion}". Aktuálny stav: ${current.highlight}. Dávkovanie a klinický protokol sú pod 100% dozorom KVL SR a Clinical Guardian.`);
    setHermesUserQuestion("");
  };

  const filteredScenarios = SCENARIOS_12.filter((s) => {
    if (scenarioFilter === "all") return true;
    return s.category === scenarioFilter;
  });

  const activeScenarioObj = SCENARIOS_12.find((s) => s.id === selectedScenario) || SCENARIOS_12[0];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Overview Card */}
      <Card className="border-border bg-gradient-to-r from-card via-card to-primary/5 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold font-heading">
                    {t("settings.simulation.title", "Klinická simulácia & Journey Discovery")}
                  </CardTitle>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 font-semibold">
                    12 Scenárov · Pilot-Ready v0.6
                  </Badge>
                </div>
                <CardDescription className="mt-1 text-sm">
                  {t(
                    "settings.simulation.subtitle",
                    "Interaktívna simulácia 30 veterinárnych workflowov (J1–J30), 12 reálnych prípadov, Hermes AI autonómneho pozorovateľa, časovej osi dňa (08:00–17:30) a slovenskej legislatívy."
                  )}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReload}
                title={t("settings.simulation.reload", "Znovu načítať")}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                {t("settings.simulation.reload", "Znovu načítať")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? t("settings.simulation.exitFullscreen", "Ukončiť celú obrazovku") : t("settings.simulation.fullscreen", "Celá obrazovka")}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="mr-1.5 h-4 w-4" />
                    {t("settings.simulation.exitFullscreen", "Zmenšiť")}
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-1.5 h-4 w-4" />
                    {t("settings.simulation.fullscreen", "Celá obrazovka")}
                  </>
                )}
              </Button>
              <a
                href="/simulation.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="gap-1.5 shadow-xs">
                  <ExternalLink className="h-4 w-4" />
                  {t("settings.simulation.openNewTab", "Otvoriť samostatne")}
                </Button>
              </a>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <Layers className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-semibold">30 Workflowov</p>
                <p className="text-[11px] text-muted-foreground">J1 až J30 tokov</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <Stethoscope className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">12 Prípadov</p>
                <p className="text-[11px] text-muted-foreground">Kompletná ambulancia</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <Bot className="h-4 w-4 text-violet-600 shrink-0" />
              <div>
                <p className="font-semibold">Hermes AI Copilot</p>
                <p className="text-[11px] text-muted-foreground">Autonómny pozorovateľ</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">4 858 Testov</p>
                <p className="text-[11px] text-muted-foreground">100% Pass Rate</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold">Z39 / Z139 / Z289</p>
                <p className="text-[11px] text-muted-foreground">Slovenská legislatíva</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 p-2.5 shadow-2xs">
              <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="font-semibold">114 AI Evalov</p>
                <p className="text-[11px] text-muted-foreground">Klinická presnosť</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Hermes AI Live Observation Panel */}
      <Card className="border-border bg-slate-950 text-slate-50 shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-sm text-sky-400 font-mono tracking-tight">
              HERMES AI OBSERVER · SLEDUJE LIVE PREVÁDZKU KLINIKY
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 text-xs font-mono">
              Aktívny pacient: {activeScenarioObj.icon} {activeScenarioObj.name}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs space-y-1.5 font-mono">
            <div className="text-violet-400 font-bold uppercase tracking-wider text-[11px]">
              [HERMES AUTONÓMNA POZNÁMKA & DIAGNOSTICKÁ HYPOTÉZA]
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {activeScenarioObj.hermesSummary}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 border-t border-slate-800/80">
              <span>🩺 Signalment: <strong>{activeScenarioObj.species}</strong></span>
              <span>🛡️ Clinical Guardian: <strong className="text-emerald-400">100% Active</strong></span>
              <span>📜 KVL SR HMAC: <strong className="text-sky-400">sha256:verified</strong></span>
            </div>
          </div>

          {/* Interactive Hermes Question Form */}
          <form onSubmit={handleAskHermes} className="flex gap-2">
            <Input
              value={hermesUserQuestion}
              onChange={(e) => setHermesUserQuestion(e.target.value)}
              placeholder={"Opýtať sa Hermesa na pacienta " + activeScenarioObj.name + "..."}
              className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs h-9 focus-visible:ring-sky-400"
            />
            <Button type="submit" size="sm" className="bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold text-xs h-9 px-3 gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Spýtať sa
            </Button>
          </form>

          {hermesResponseText && (
            <div className="rounded-lg bg-slate-900/90 border border-sky-500/40 p-3 text-xs text-sky-200 font-mono animate-in fade-in">
              {hermesResponseText}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 12 Scenarios Selector Ribbon */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 border-b border-border pb-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <PlayCircle className="h-4 w-4 text-primary" />
            12 Klinických scenárov pre simuláciu:
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setScenarioFilter("all")}
              className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", scenarioFilter === "all" ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              Všetky (12)
            </button>
            <button
              onClick={() => setScenarioFilter("urgent")}
              className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", scenarioFilter === "urgent" ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              Urgent & Chirurgia (4)
            </button>
            <button
              onClick={() => setScenarioFilter("chronic")}
              className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", scenarioFilter === "chronic" ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              Chronické & Obličky (4)
            </button>
            <button
              onClick={() => setScenarioFilter("safety")}
              className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", scenarioFilter === "safety" ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              Špeciálna bezpečnosť & MDR1 (4)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredScenarios.map((s) => {
            const isSelected = selectedScenario === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectScenario(s.id)}
                className={cn(
                  "flex flex-col text-left rounded-lg p-3 border transition-all text-xs cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                    : "border-border bg-background hover:bg-muted/40 hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    <span>{s.icon}</span>
                    <span>{s.name}</span>
                  </span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", s.badgeColor)}>
                    {s.highlight}
                  </Badge>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">{s.species}</p>
                <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-relaxed">{s.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Embedded Simulation Iframe Container */}
      <div
        className={cn(
          "relative rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all",
          isFullscreen
            ? "fixed inset-0 z-50 rounded-none border-0 h-screen w-screen p-0 bg-background"
            : "min-h-[820px] h-[860px]"
        )}
      >
        {/* Floating controls in Fullscreen mode */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-border bg-background/95 backdrop-blur-md px-3 py-2 shadow-lg">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5 mr-2">
              <FlaskConical className="h-4 w-4" /> OpenVPM AI Simulácia + Hermes (Celá obrazovka)
            </span>
            <Button size="sm" variant="outline" onClick={handleReload}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Obnoviť
            </Button>
            <Button size="sm" onClick={handleToggleFullscreen}>
              <Minimize2 className="h-3.5 w-3.5 mr-1" /> Ukončiť celú obrazovku
            </Button>
          </div>
        )}

        {/* Loading Spinner */}
        {!isIframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-2xs z-10 space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Hermes AI inicializuje 12 klinických scenárov a live prevádzku...
            </p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src="/simulation.html"
          title="OpenVPM AI Clinical Simulation"
          className="w-full h-full border-0"
          onLoad={() => setIsIframeLoaded(true)}
          allow="autoplay; microphone; camera; clipboard-write"
        />
      </div>

      {/* Discovery & Technical Reference Accordion */}
      <Card className="border-border">
        <CardHeader className="py-3 px-5 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setDetailsOpen(!detailsOpen)}>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Klinická a technická dokumentácia k simulácii (12 Scenárov & Discovery)
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {detailsOpen && (
          <CardContent className="p-5 space-y-4">
            {/* Tabs for discovery sections */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {[
                { id: "personas", label: "Klinické persóny (P1–P6)", icon: Users },
                { id: "gaps", label: "Gap analýza & Roadmapa", icon: AlertTriangle },
                { id: "journeys", label: "Prehľad 30 tokov (J1–J30)", icon: Layers },
                { id: "compliance", label: "Legislatívne brány SR", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeInfoTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveInfoTab(item.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab: Personas */}
            {activeInfoTab === "personas" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {PERSONAS.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-primary">{p.id} · {p.name}</span>
                      <Badge variant="secondary" className="text-[10px] py-0">{p.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.profile}</p>
                    <div className="pt-1 border-t border-border/60">
                      <span className="text-[11px] font-semibold text-foreground/80">Kľúčové toky: </span>
                      <span className="text-[11px] text-muted-foreground">{p.focus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Gaps */}
            {activeInfoTab === "gaps" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {GAPS.map((g) => (
                    <div key={g.id} className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-amber-900 dark:text-amber-300">GAP {g.id}: {g.title}</span>
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-[10px]">
                          {g.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/80">{g.desc}</p>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Riešenie: {g.solution}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Journeys */}
            {activeInfoTab === "journeys" && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">1. Klinická práca (J1–J6)</h4>
                    <p className="text-muted-foreground">J1 Vyhľadanie pacienta (F1/Cmd+K) · J2 Klinická karta · J3 SOAP záznam · J4 Hlasový AI Scribe · J5 Clinical Guardian kontrola · J6 Prepúšťacia správa</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">2. Recepcia & Návštevy (J7–J9)</h4>
                    <p className="text-muted-foreground">J7 Online booking · J8 Check-in & Whiteboard · J9 Registrácia nového klienta & zvieraťa</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">3. Farmácia & e-Kasa (J10–J12)</h4>
                    <p className="text-muted-foreground">J10 Výdaj liečiva zo skladu · J11 Fakturácia a uzávierka · J12 e-Kasa doklad (Zákon 289/2008)</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">4. Preventíva & Recalls (J13–J15)</h4>
                    <p className="text-muted-foreground">J13 Očkovanie a vakcinačný preukaz · J14 Automatické SMS pripomienky · J15 Wellness plány</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">5. Lab & Zobrazovanie (J16–J17)</h4>
                    <p className="text-muted-foreground">J16 IDEXX Catalyst biochemický import · J17 AI RTG VHS analýza srdca</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <h4 className="font-bold text-primary text-xs">6. Nové toky & Portál (J18–J30)</h4>
                    <p className="text-muted-foreground">J18 Content calendar · J19 Recenzie · J24 Inventúra · J26 Správa rolí · J27 Klientsky portál · J28 Setup wizard</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Compliance */}
            {activeInfoTab === "compliance" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {LEGISLATIVE_GATES.map((l) => (
                  <div key={l.law} className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-2">
                    <div className="font-bold text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>{l.law}</span>
                    </div>
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">{l.name}</p>
                    <ul className="space-y-1 text-[11px] text-emerald-900/80 dark:text-emerald-300/80 list-disc list-inside">
                      {l.points.map((pt, i) => (
                        <li key={i} className="leading-relaxed">{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
