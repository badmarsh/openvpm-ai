"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Send,
  Loader2,
  Bot,
  Sparkles,
  Copy,
  Check,
  Printer,
  Save,
  Edit3,
  Eye,
  AlertTriangle,
  Search,
  X,
  History,
  RotateCcw,
  Stethoscope,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ClinicalPreset {
  key: string;
  name: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
}

const PRESETS_SK: ClinicalPreset[] = [
  {
    key: "scenarioGastro",
    name: "Gastroenteritída",
    diagnosis: "Akútna gastroenteritída sekundárne k diétnej chybe, mierna dehydratácia (cca 5%).",
    treatment: "Subkutánna rehydratácia (Ringer-laktát 250ml), Maropitant (Cerenia) 1mg/kg s.c. proti zvracaniu. Domáca medikácia: Omeprazol 10mg 1x denne ráno nalačno, probiotická pasta 2x denne.",
    followUp: "Prísna gastrointestinálna diéta (varené kuracie mäso s rozvarenou ryžou alebo veterinárna diéta Gastrointestinal) po malých dávkach 4-5x denne počas 5 dní. Kontrola o 2-3 dni alebo ihneď pri pretrvávaní zvracania.",
  },
  {
    key: "scenarioSurgery",
    name: "Kastrácia / Rana",
    diagnosis: "Stav po plánovanom chirurgickom zákroku (orchiektómia / ovariohysterektómia) v celkovej anestézii. Operačná rana pokojná, bez známok krvácania.",
    treatment: "Pooperačná analgézia: Meloxicam 0.2mg/kg s.c. Domáca liečba: Meloxicam perorálna suspenzia 1x denne s krmivom počas 3 dní.",
    followUp: "Prísny kľudový režim 10 dní (zákaz behania, skákania a venčenia na voľno). Ochranný pooperačný golier / košieľka nepretržite. Kontrola operačnej rany a vybratie stehov o 10-12 dní.",
  },
  {
    key: "scenarioDental",
    name: "Dentálna hygiena",
    diagnosis: "Periodontálne ochorenie II. stupňa, generalizovaný zubný kameň a mierna gingivitída. Zákrok vykonaný v inhalačnej anestézii.",
    treatment: "Ultrazvukové odstránenie zubného kameňa, subgingiválny kuretáž, leštenie zubov (polishing), lokálna aplikácia chlórhexidínového dentálneho gélu.",
    followUp: "Mäkká strava počas nasledujúcich 3-4 dní. Začať domácu dentálnu prevenciu (enzymatická zubná pasta pre zvieratá, špeciálne dentálne pamlsky) po 5 dňoch. Preventívna kontrola chrupu o 6 mesiacov.",
  },
  {
    key: "scenarioOtitis",
    name: "Otitída",
    diagnosis: "Akútna obojstranná otitis externa (erytematózno-ceruminózny zápal zvukovodov s kvasinkovou a bakteriálnou flórou).",
    treatment: "Mechanický výplach a toaleta oboch zvukovodov. Aplikácia kombinovaných ušných kvapiek (antibiotikum + antimykotikum + protizápalová zložka).",
    followUp: "Aplikovať predpísané ušné kvapky 2x denne po dobu 7 dní. Pred aplikáciou uši očistiť čističom zvukovodov, nepoužívať vatové tyčinky hlboko do ucha. Kontrolné vyšetrenie a kontrolná cytológia o 7-10 dní.",
  },
];

export default function DischargePage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  // Patient selection
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species?: string | null;
    breed?: string | null;
    clientName: string;
  } | null>(null);

  const patientSearchQ = trpc.patients.search.useQuery(
    { query: patientSearch },
    { enabled: patientSearch.length >= 2 }
  );

  const patientDetailQ = trpc.patients.getById.useQuery(
    { id: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient?.id }
  );

  const isDeceased = patientDetailQ.data?.status === "deceased";

  // Clinical inputs
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [language, setLanguage] = useState<"sk" | "en">("sk");
  const [tone, setTone] = useState<"empathetic" | "standard" | "formal">("empathetic");

  // Output & UI state
  const [result, setResult] = useState("");
  const [usedAi, setUsedAi] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");

  // Mutations
  const generateMutation = trpc.extensions.discharge.generate.useMutation();
  const saveMutation = trpc.extensions.discharge.save.useMutation();

  // History query
  const historyQuery = trpc.extensions.discharge.listRecent.useQuery(undefined, {
    enabled: activeTab === "history",
  });

  // Handle patient select
  const handleSelectPatient = (p: {
    id: string;
    name: string;
    species?: string | null;
    breed?: string | null;
    clientFirstName?: string | null;
    clientLastName?: string | null;
  }) => {
    const clientName =
      [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ").trim() ||
      "Klient";
    setSelectedPatient({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      clientName,
    });
    setPetName(p.name);
    if (p.species) {
      setSpecies(p.breed ? `${p.species} (${p.breed})` : p.species);
    }
    setPatientSearchOpen(false);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setPetName("");
    setSpecies("");
  };

  // Apply preset
  const handleApplyPreset = (preset: ClinicalPreset) => {
    setDiagnosis(preset.diagnosis);
    setTreatment(preset.treatment);
    setFollowUp(preset.followUp);
    toast.info(`${preset.name} aplikované`);
  };

  // Generate report
  const handleGenerate = async () => {
    if (!petName.trim() || !diagnosis.trim()) {
      toast.error(
        t(
          "discharge.validationError",
          "Please enter at least the pet name and diagnosis."
        )
      );
      return;
    }

    try {
      const res = await generateMutation.mutateAsync({
        patientId: selectedPatient?.id,
        petName: petName.trim(),
        species: species.trim() || undefined,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim() || undefined,
        followUp: followUp.trim() || undefined,
        language,
        tone,
      });

      if (res?.text) {
        setResult(res.text);
        setUsedAi(res.usedAi);
        setViewMode("preview");
        toast.success(
          res.usedAi
            ? t("discharge.aiBadge", "AI Generated")
            : t("discharge.templateBadge", "Clinical Template")
        );
      }
    } catch (error) {
      console.error("Discharge report generation failed:", error);
      toast.error(
        t("discharge.generationFailed", "Failed to generate report.")
      );
    }
  };

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success(t("discharge.copied", "Copied to clipboard"));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  }, [result, t]);

  // Print report — render Markdown as styled HTML
  const handlePrint = useCallback(() => {
    if (!result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    // Render the ReactMarkdown preview div content via the DOM
    const previewEl = document.querySelector("[data-discharge-preview]");
    const renderedHtml = previewEl?.innerHTML ?? "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Prepúšťacia správa - ${petName || "Pacient"}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20mm; font-size: 11pt; color: #000; }
              @page { size: A4; margin: 15mm; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1a202c;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
            }
            .header-bar {
              border-bottom: 2px solid #2563eb;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            h1 { font-size: 1.5em; margin-top: 1.5em; }
            h2 { font-size: 1.3em; margin-top: 1.3em; }
            h3 { font-size: 1.15em; margin-top: 1.15em; color: #1e3a8a; }
            ul, ol { padding-left: 1.5em; }
            li { margin-bottom: 0.3em; }
            strong { color: #1e3a8a; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5em 0; }
            p { margin-bottom: 0.6em; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h2 style="margin: 0; color: #1e3a8a;">Veterinárna ambulancia & klinika</h2>
            <small style="color: #64748b;">Záverečná prepúšťacia správa pre majiteľa zvieraťa</small>
          </div>
          <div class="markdown-body">${renderedHtml}</div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [result, petName]);

  // Save to database
  const handleSave = async () => {
    if (!result.trim() || !petName.trim() || !diagnosis.trim()) return;

    try {
      await saveMutation.mutateAsync({
        patientId: selectedPatient?.id,
        petName: petName.trim(),
        species: species.trim() || undefined,
        diagnosis: diagnosis.trim(),
        treatment: treatment.trim() || undefined,
        followUp: followUp.trim() || undefined,
        reportText: result,
        language,
        status: "finalized",
      });
      toast.success(
        t("discharge.saved", "Report successfully saved to database")
      );
      utils.extensions.discharge.listRecent.invalidate();
    } catch (err) {
      toast.error(t("discharge.saveFailed", "Failed to save report"));
    }
  };

  // Load from history
  const handleLoadHistory = (item: {
    petName: string;
    species: string | null;
    diagnosis: string;
    treatment: string | null;
    followUp: string | null;
    reportText: string;
  }) => {
    setPetName(item.petName);
    setSpecies(item.species || "");
    setDiagnosis(item.diagnosis);
    setTreatment(item.treatment || "");
    setFollowUp(item.followUp || "");
    setResult(item.reportText);
    setActiveTab("editor");
    setViewMode("preview");
    toast.info(t("discharge.loadReport", "Load into editor"));
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("discharge.title", "Discharge Report Generator")}
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              {t("discharge.badge", "Clinical AI Assistant")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "discharge.subtitle",
              "AI assistant for generating clear, empathetic home care instructions for pet owners."
            )}
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="editor" className="gap-1.5">
              <FileText className="h-4 w-4" />
              {t("discharge.editorTab", "Report Editor")}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              {t("discharge.historyTab", "Report History")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "history" ? (
        /* History View */
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t("discharge.historyTab", "Report History")}
            </CardTitle>
            <CardDescription>
              {t("discharge.formSubtitle", "Select a patient or enter details manually to generate the discharge instructions.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>{t("discharge.noHistory", "No saved reports yet")}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {historyQuery.data.map((item) => (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          {item.petName}
                          {item.species && (
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              ({item.species})
                            </span>
                          )}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs">
                        {item.diagnosis}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLoadHistory(item)}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("discharge.loadReport", "Load into editor")}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Main 2-Column Editor Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Clinical Inputs */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Patient Search & Deceased Warning */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    {t("discharge.patientSearch", "Assign patient (optional)")}
                  </span>
                  {selectedPatient && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPatient}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t("discharge.clearPatient", "Clear selection")}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientSearchOpen}
                      className="w-full justify-between text-left font-normal"
                    >
                      {selectedPatient ? (
                        <span className="font-medium text-foreground">
                          {selectedPatient.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({selectedPatient.clientName})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("discharge.patientSelectPlaceholder", "Search patient by name...")}
                        </span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] sm:w-[420px] p-2" align="start">
                    <Input
                      placeholder={t("discharge.patientSelectPlaceholder", "Search patient by name...")}
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="mb-2"
                      autoFocus
                    />
                    <div className="max-h-[220px] overflow-y-auto">
                      {patientSearchQ.isLoading && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {patientSearchQ.data?.length === 0 && patientSearch.length >= 2 && (
                        <p className="text-center py-4 text-xs text-muted-foreground">
                          {t("discharge.noPatientsFound", "No patients found")}
                        </p>
                      )}
                      {patientSearchQ.data?.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between transition-colors",
                            selectedPatient?.id === p.id && "bg-accent font-medium"
                          )}
                          onClick={() => handleSelectPatient(p)}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {p.species || "zviera"} — {p.clientFirstName} {p.clientLastName}
                            </span>
                          </div>
                          {selectedPatient?.id === p.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sympathy Flow Warning Banner */}
                {isDeceased && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Sympathy Flow</strong>
                      {t(
                        "discharge.deceasedWarning",
                        "Notice: This patient is marked as deceased. The generated message will automatically be formatted as a condolence note."
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clinical Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("discharge.quickScenarios", "Quick Clinical Presets")}:
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESETS_SK.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {t(`discharge.${preset.key}`, preset.name)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clinical Details Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {t("discharge.formTitle", "Clinical Report Inputs")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.petNameLabel", "Pet Name *")}
                    </label>
                    <Input
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder={t("discharge.petNamePlaceholder", "e.g. Bella")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.speciesLabel", "Species / Breed")}
                    </label>
                    <Input
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      placeholder={t("discharge.speciesPlaceholder", "e.g. Dog, Golden Retriever")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("discharge.diagnosisLabel", "Diagnosis & Clinical Finding *")}
                  </label>
                  <Textarea
                    rows={3}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder={t(
                      "discharge.diagnosisPlaceholder",
                      "e.g. Acute gastroenteritis secondary to dietary indiscretion, mild dehydration"
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("discharge.treatmentLabel", "Administered Treatment & Medications")}
                  </label>
                  <Textarea
                    rows={3}
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    placeholder={t(
                      "discharge.treatmentPlaceholder",
                      "e.g. Subcutaneous fluids (LRS 250ml), Maropitant 1mg/kg SC. Discharge meds: Omeprazole 10mg once daily before meals."
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("discharge.followUpLabel", "Follow-up & Home Care")}
                  </label>
                  <Textarea
                    rows={3}
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder={t(
                      "discharge.followUpPlaceholder",
                      "e.g. Bland diet (boiled chicken & rice) for 5 days. Recheck in 3 days or sooner if vomiting resumes."
                    )}
                  />
                </div>

                {/* Tone and Language Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.tone", "Communication Tone")}
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="empathetic">
                        {t("discharge.toneEmpathetic", "Empathetic & Warm")}
                      </option>
                      <option value="standard">
                        {t("discharge.toneStandard", "Standard Professional")}
                      </option>
                      <option value="formal">
                        {t("discharge.toneFormal", "Concise Medical")}
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("discharge.language", "Report Language")}
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="sk">Slovenčina (SK)</option>
                      <option value="en">English (EN)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Action */}
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!petName.trim() || !diagnosis.trim() || generateMutation.isPending}
                  className="w-full gap-2 py-5 text-sm font-semibold shadow-sm"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("discharge.generatingButton", "Generating client report...")}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {t("discharge.generateButton", "Generate Discharge Report")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Generated Report Preview & Actions */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <Card className="flex flex-col h-full min-h-[550px] shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("discharge.resultTitle", "Final Discharge Report")}
                  </CardTitle>
                </div>

                {result && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode(viewMode === "preview" ? "edit" : "preview")}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      {viewMode === "preview" ? (
                        <>
                          <Edit3 className="h-3.5 w-3.5" />
                          {t("discharge.editMode", "Edit")}
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          {t("discharge.previewMode", "Preview")}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied
                        ? t("discharge.copied", "Copied to clipboard")
                        : t("discharge.copy", "Copy")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t("discharge.print", "Print / PDF")}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="h-8 px-3 text-xs gap-1 bg-primary text-primary-foreground"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {saveMutation.isPending
                        ? t("discharge.saving", "Saving...")
                        : t("discharge.save", "Save to Chart")}
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 p-4 flex flex-col min-h-0">
                {generateMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center p-8 text-muted-foreground gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      {t("discharge.generatingNotice", "AI is translating clinical jargon into practical home care instructions...")}
                    </p>
                  </div>
                ) : result ? (
                  viewMode === "preview" ? (
                    <div className="flex-1 overflow-y-auto p-6 rounded-lg bg-muted/40 border border-border" data-discharge-preview>
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-hr:border-border">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                        >
                          {result}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="flex-1 min-h-[400px] font-mono text-xs leading-relaxed resize-none"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center p-8 text-muted-foreground gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-xs max-w-sm">
                      {t(
                        "discharge.emptyPrompt",
                        "Fill in clinical details on the left and click 'Generate Discharge Report' to create clear instructions for the pet owner."
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
