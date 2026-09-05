"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  Sparkles,
  Loader2,
  Save,
  History,
  X,
  FileText,
  RotateCcw,
  ChevronRight,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Volume2,
  Sliders,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RecordingButton } from "./components/recording-button";
import { AudioPlayer } from "./components/audio-player";
import { ClinicalTemplatesModal } from "./components/clinical-templates";
import { PatientSelector } from "./components/patient-selector";
import { SoapPreview, type SoapSectionsData } from "./components/soap-preview";
import { HistoryList, type Dictation } from "./components/history-list";
import type { SoapStyle } from "@/lib/voice/soap-formatter";

type DictationStatus =
  | "idle"
  | "recording"
  | "processing"
  | "done"
  | "saved"
  | "error";

type ViewMode = "main" | "history" | "results";

export default function VoiceDictationPage() {
  const utils = trpc.useUtils();

  // Patient
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species?: string | null;
    clientName: string;
  } | null>(null);

  // Recording
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Processing state
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [dictationId, setDictationId] = useState<string | null>(null);
  const [rawTranscript, setRawTranscript] = useState("");
  const [soapSections, setSoapSections] = useState<SoapSectionsData>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [activeStyle, setActiveStyle] = useState<SoapStyle>("standard");

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // tRPC mutations
  const uploadAndProcessMutation = trpc.extensions.voice.uploadAndProcess.useMutation();
  const formatTextMutation = trpc.extensions.voice.formatTextToSoap.useMutation();
  const saveMutation = trpc.extensions.voice.saveAsSoapNote.useMutation();

  const historyQuery = trpc.extensions.voice.listByPatient.useQuery(
    { patientId: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient },
  );

  // Create object URL for audio preview
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioBlob]);

  const resetState = useCallback(() => {
    setAudioBlob(null);
    setAudioDuration(0);
    setStatus("idle");
    setDictationId(null);
    setRawTranscript("");
    setSoapSections({ subjective: "", objective: "", assessment: "", plan: "" });
    setSavedNoteId(null);
    setViewMode("main");
  }, []);

  const handleRecordingComplete = useCallback(
    (blob: Blob, durationSeconds: number) => {
      setAudioBlob(blob);
      setAudioDuration(durationSeconds);
      setDictationId(null);
      setRawTranscript("");
      setSoapSections({ subjective: "", objective: "", assessment: "", plan: "" });
      setSavedNoteId(null);
    },
    [],
  );

  // Blob to base64 helper
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleProcess = useCallback(async () => {
    if (!selectedPatient || !audioBlob) return;

    setStatus("processing");
    try {
      const audioBase64 = await blobToBase64(audioBlob);

      const processed = await uploadAndProcessMutation.mutateAsync({
        patientId: selectedPatient.id,
        audioBase64,
        audioMimeType: audioBlob.type || "audio/webm",
        audioDurationSeconds: String(audioDuration),
        language: "sk",
        style: activeStyle,
      });

      setDictationId(processed.id);
      setRawTranscript(processed.rawTranscript ?? "");
      setSoapSections({
        subjective: processed.subjective ?? "",
        objective: processed.objective ?? "",
        assessment: processed.assessment ?? "",
        plan: processed.plan ?? "",
      });

      setStatus("done");
      setViewMode("results");
      toast.success("Transkripcia a SOAP analýza dokončená");

      utils.extensions.voice.listByPatient.invalidate({
        patientId: selectedPatient.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Spracovanie diktovania zlyhalo";
      toast.error(message);
      setStatus("error");
    }
  }, [
    selectedPatient,
    audioBlob,
    audioDuration,
    activeStyle,
    uploadAndProcessMutation,
    utils,
  ]);

  const handleReformat = useCallback(
    async (style: SoapStyle) => {
      if (!rawTranscript) return;
      setActiveStyle(style);
      try {
        const formatted = await formatTextMutation.mutateAsync({
          transcript: rawTranscript,
          patientId: selectedPatient?.id,
          dictationId: dictationId ?? undefined,
          style,
        });

        setSoapSections({
          subjective: formatted.subjective,
          objective: formatted.objective,
          assessment: formatted.assessment,
          plan: formatted.plan,
        });
        toast.success(`SOAP preformátovaný v štýle: ${style === "standard" ? "Štandardný" : style === "detailed" ? "Detailný" : "Stručný"}`);
      } catch (err) {
        toast.error("Preformátovanie zlyhalo");
      }
    },
    [rawTranscript, selectedPatient, dictationId, formatTextMutation],
  );

  const handleSave = useCallback(async () => {
    if (!dictationId || !selectedPatient) return;
    try {
      const note = await saveMutation.mutateAsync({
        dictationId,
        ...soapSections,
      });

      setStatus("saved");
      setSavedNoteId(note.id);
      toast.success("SOAP záznam bol úspešne uložený do kartotéky", {
        action: {
          label: "Zobraziť pacienta",
          onClick: () => {
            window.location.href = `/patients/${selectedPatient.id}`;
          },
        },
      });

      utils.extensions.voice.listByPatient.invalidate({
        patientId: selectedPatient.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uloženie SOAP záznamu zlyhalo";
      toast.error(message);
    }
  }, [dictationId, selectedPatient, soapSections, saveMutation, utils]);

  const handleSelectHistory = useCallback((item: Dictation) => {
    setDictationId(item.id);
    setRawTranscript(item.rawTranscript ?? "");
    setSoapSections({
      subjective: item.subjective ?? "",
      objective: item.objective ?? "",
      assessment: item.assessment ?? "",
      plan: item.plan ?? "",
    });
    setStatus(item.status === "COMPLETED" ? "done" : "idle");
    setViewMode("results");
  }, []);

  const handleSelectTemplate = useCallback(
    async (sampleText: string, templateTitle: string) => {
      setRawTranscript(sampleText);
      setViewMode("results");
      setStatus("processing");

      try {
        const formatted = await formatTextMutation.mutateAsync({
          transcript: sampleText,
          patientId: selectedPatient?.id,
          style: activeStyle,
        });

        setSoapSections({
          subjective: formatted.subjective,
          objective: formatted.objective,
          assessment: formatted.assessment,
          plan: formatted.plan,
        });

        setStatus("done");
        toast.success(`Vzor „${templateTitle}“ bol úspešne spracovaný`);
      } catch {
        setStatus("done");
      }
    },
    [selectedPatient, activeStyle, formatTextMutation],
  );

  const isProcessing = status === "processing";
  const canRecord = selectedPatient && !isProcessing && viewMode === "main";
  const hasRecording = audioBlob && status === "idle";
  const hasResults = status === "done" || status === "saved";

  return (
    <div className="relative flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Mic className="h-5 w-5 text-white" />
            </div>
            {isProcessing && (
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 animate-ping border-2 border-background" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Hlasové Diktovanie
              </h1>
              <Badge variant="secondary" className="gap-1 text-[11px] font-mono">
                <Sparkles className="h-3 w-3 text-violet-500" />
                Gemini STT
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Presná transkripcia hovoreného slova s veterinárnou terminológiou a štruktúrovaním do SOAP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTemplatesOpen(true)}
            className="gap-1.5 text-xs font-medium border-violet-200 dark:border-violet-900/60 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-700 dark:text-violet-300"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Vzory diktátov
          </Button>

          {selectedPatient && (
            <Button
              variant={viewMode === "history" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "history" ? "main" : "history")}
              className="gap-1.5 text-xs"
            >
              <History className="h-3.5 w-3.5" />
              História pacienta
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Main Panel) */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          {/* Patient Selector Card */}
          <div className="bg-card rounded-xl border p-3 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Vyberte pacienta pre klinické diktovanie
              </label>
              <PatientSelector
                value={selectedPatient}
                onChange={(p) => {
                  setSelectedPatient(p);
                  resetState();
                }}
              />
            </div>

            {selectedPatient && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Link href={`/patients/${selectedPatient.id}`} target="_blank">
                    <span>Karta pacienta</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Central Workspace Card */}
          <div
            className={cn(
              "flex-1 bg-card rounded-xl border shadow-sm overflow-hidden transition-all duration-300 flex flex-col",
              canRecord && "hover:border-violet-300 dark:hover:border-violet-800",
              hasRecording && "border-violet-400 dark:border-violet-600 shadow-md",
              isProcessing && "border-amber-400 dark:border-amber-600 shadow-md",
              hasResults && "border-emerald-400 dark:border-emerald-700",
            )}
          >
            {/* 1. Main Recording View */}
            {viewMode === "main" && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <RecordingButton
                  onRecordingComplete={handleRecordingComplete}
                  disabled={!canRecord}
                  size="large"
                />

                {/* Recorded Audio Preview Bar */}
                {hasRecording && audioUrl && (
                  <div className="mt-6 w-full max-w-md space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <AudioPlayer
                      src={audioUrl}
                      title={`Záznam diktátu (${audioDuration} sekúnd)`}
                    />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAudioBlob(null);
                          setAudioDuration(0);
                        }}
                        className="text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Nahrať znova
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleProcess}
                        className="gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md shadow-violet-500/20"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Spracovať cez Gemini AI
                      </Button>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {isProcessing && (
                  <div className="mt-6 flex flex-col items-center gap-2.5 animate-in fade-in duration-300">
                    <div className="relative">
                      <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
                      <div className="absolute inset-0 h-9 w-9 rounded-full bg-amber-500/20 blur-md" />
                    </div>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      AI analyzuje a štruktúruje diktovanie...
                    </span>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Prebieha prepis reči so slovenským veterinárnym názvoslovím a extrakcia sekcií S-O-A-P.
                    </p>
                  </div>
                )}

                {/* Initial Guide */}
                {!selectedPatient && (
                  <div className="mt-6 max-w-sm text-center">
                    <p className="text-sm font-medium text-foreground">
                      Najskôr vyberte pacienta
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Diktát sa automaticky priradí k vybranému pacientovi a umožní okamžité uloženie do jeho karty.
                    </p>
                  </div>
                )}

                {canRecord && !hasRecording && (
                  <div className="mt-6 max-w-sm text-center">
                    <p className="text-sm font-medium text-foreground">
                      Stlačte mikrofón a začnite diktovať
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Povedzte anamnézu, triádu, diagnózu a plán terapie. Pre inšpiráciu kliknite na „Vzory diktátov“.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Results & Review View */}
            {viewMode === "results" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold">
                        Spracovaný SOAP záznam
                      </span>
                      {selectedPatient && (
                        <span className="text-xs text-muted-foreground ml-2">
                          · {selectedPatient.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("main")}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Nový diktát
                    </Button>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Saved Success Notification Banner */}
                  {status === "saved" && (
                    <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 flex items-center justify-between gap-3 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            SOAP záznam bol úspešne zapísaný do klinických záznamov pacienta
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            Záznam nájdete v karte pacienta aj v sekcii Klinické záznamy.
                          </p>
                        </div>
                      </div>

                      {selectedPatient && (
                        <Button
                          type="button"
                          size="sm"
                          asChild
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                          <Link href={`/patients/${selectedPatient.id}`}>
                            Otvoriť kartu
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Audio Player if available */}
                  {audioUrl && (
                    <AudioPlayer
                      src={audioUrl}
                      compact
                      title="Zvukový záznam diktovania"
                    />
                  )}

                  {/* Raw Transcript Accordion/Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Surová transkripcia z diktátu
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {rawTranscript.length} znakov
                      </span>
                    </div>
                    <textarea
                      value={rawTranscript}
                      onChange={(e) => setRawTranscript(e.target.value)}
                      rows={3}
                      placeholder="Sem môžete vložiť alebo upraviť surový text..."
                      className="w-full rounded-xl border bg-muted/30 px-3.5 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none leading-relaxed"
                    />
                  </div>

                  {/* SOAP Sections Form */}
                  <SoapPreview
                    sections={soapSections}
                    editable
                    onChange={setSoapSections}
                    patientName={selectedPatient?.name}
                    onReformat={handleReformat}
                    isReformatting={formatTextMutation.isPending}
                  />

                  {/* Footer Actions */}
                  <div className="pt-3 border-t flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode("main")}
                      className="text-xs"
                    >
                      Späť na mikrofón
                    </Button>

                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saveMutation.isPending || status === "saved"}
                      className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 text-xs h-9 px-4"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {status === "saved" ? "Uložené v kartotéke" : "Uložiť do záznamov pacienta"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (History & Clinical Info) */}
        <div
          className={cn(
            "lg:col-span-4 bg-card rounded-xl border shadow-xs overflow-hidden flex flex-col min-h-0",
            viewMode === "history" || selectedPatient ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 shrink-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-semibold">História diktovaní</span>
            </div>
            {selectedPatient && (
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[130px]">
                {selectedPatient.name}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedPatient ? (
              <HistoryList
                items={historyQuery.data ?? []}
                selectedId={dictationId}
                onSelect={handleSelectHistory}
                onDeleted={() => {
                  if (dictationId) resetState();
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-2.5" />
                <p className="text-xs font-medium text-foreground">
                  Žiadny vybraný pacient
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                  Vyberte pacienta pre zobrazenie histórie jeho predchádzajúcich diktovaní.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Templates Modal */}
      <ClinicalTemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
