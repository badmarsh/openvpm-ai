"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Mic,
  Bot,
  Loader2,
  Save,
  History,
  X,
  FileText,
  Sparkles,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  fetchWithClientTimeout,
} from "@/lib/client-fetch";
import { RecordingButton } from "./components/recording-button";
import { PatientSelector } from "./components/patient-selector";
import { SoapPreview, type SoapSectionsData } from "./components/soap-preview";
import { HistoryList, type Dictation } from "./components/history-list";

type DictationStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "processing"
  | "done"
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
  const uploadAttemptRef = useRef<ReturnType<typeof selectManagedUploadFile> | null>(null);

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

  // UI
  const [viewMode, setViewMode] = useState<ViewMode>("main");

  // tRPC
  const startMutation = trpc.extensions.voice.start.useMutation();
  const processMutation = trpc.extensions.voice.process.useMutation();
  const saveMutation = trpc.extensions.voice.saveAsSoapNote.useMutation({
    onSuccess: () => {
      toast.success("SOAP záznam uložený");
      resetState();
    },
  });

  const historyQuery = trpc.extensions.voice.listByPatient.useQuery(
    { patientId: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient },
  );

  const resetState = useCallback(() => {
    setAudioBlob(null);
    setAudioDuration(0);
    setStatus("idle");
    setDictationId(null);
    setRawTranscript("");
    setSoapSections({ subjective: "", objective: "", assessment: "", plan: "" });
    setViewMode("main");
  }, []);

  const handleRecordingComplete = useCallback(
    (blob: Blob, durationSeconds: number) => {
      const file = new File([blob], `dictation-${Date.now()}.webm`, {
        type: blob.type,
      });
      setAudioBlob(blob);
      setAudioDuration(durationSeconds);
      uploadAttemptRef.current = selectManagedUploadFile(
        uploadAttemptRef.current,
        file,
      );
      setDictationId(null);
      setRawTranscript("");
      setSoapSections({ subjective: "", objective: "", assessment: "", plan: "" });
    },
    [],
  );

  const handleProcess = useCallback(async () => {
    if (!selectedPatient || !audioBlob || !uploadAttemptRef.current) return;

    const file = new File(
      [audioBlob],
      `dictation-${Date.now()}.webm`,
      { type: audioBlob.type },
    );

    setStatus("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "patient-photos");
      formData.append("patientId", selectedPatient.id);

      const res = await fetchWithClientTimeout(
        "/api/upload",
        {
          method: "POST",
          body: formData,
          headers: {
            "Idempotency-Key": uploadAttemptRef.current.idempotencyKey,
          },
        },
        CLIENT_UPLOAD_TIMEOUT_MS,
      );

      const json = (await res.json().catch(() => ({}))) as {
        key?: string;
        error?: string;
      };
      if (!res.ok || !json.key) {
        uploadAttemptRef.current = settleManagedUploadAttempt(
          uploadAttemptRef.current,
          { kind: "response", status: res.status },
        );
        throw new Error(json.error ?? "Nahrávanie zlyhalo");
      }

      uploadAttemptRef.current = settleManagedUploadAttempt(
        uploadAttemptRef.current,
        { kind: "success" },
      );

      const audioFileKey = json.key;

      setStatus("processing");
      const dictation = await startMutation.mutateAsync({
        patientId: selectedPatient.id,
        audioFileKey,
        audioMimeType: audioBlob.type || "audio/webm",
        audioDurationSeconds: String(audioDuration),
        language: "sk",
      });

      setDictationId(dictation.id);

      const processed = await processMutation.mutateAsync({
        dictationId: dictation.id,
      });

      setRawTranscript(processed.rawTranscript ?? "");
      setSoapSections({
        subjective: processed.subjective ?? "",
        objective: processed.objective ?? "",
        assessment: processed.assessment ?? "",
        plan: processed.plan ?? "",
      });
      setStatus("done");
      setViewMode("results");
      toast.success("Transkripcia dokončená");

      utils.extensions.voice.listByPatient.invalidate({
        patientId: selectedPatient.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Spracovanie zlyhalo";
      toast.error(message);
      setStatus("error");
    }
  }, [
    selectedPatient,
    audioBlob,
    audioDuration,
    startMutation,
    processMutation,
    utils,
  ]);

  const handleSave = useCallback(async () => {
    if (!dictationId) return;
    await saveMutation.mutateAsync({
      dictationId,
      ...soapSections,
    });
  }, [dictationId, soapSections, saveMutation]);

  const handleSelectHistory = useCallback(
    (item: Dictation) => {
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
    },
    [],
  );

  const isProcessing = status === "uploading" || status === "processing";
  const canRecord = selectedPatient && !isProcessing && viewMode === "main";
  const hasRecording = audioBlob && status === "idle";
  const hasResults = status === "done";

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Mic className="h-5 w-5 text-white" />
            </div>
            {isProcessing && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse border-2 border-background" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Hlasové Diktovanie
            </h1>
            <p className="text-sm text-muted-foreground">
              AI transkripcia a SOAP formátovanie
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            Gemini
          </Badge>
          {selectedPatient && (
            <Button
              variant={viewMode === "history" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "history" ? "main" : "history")}
              className="gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              História
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel — Patient + Recording */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          {/* Patient selector — compact */}
          <div className="bg-card rounded-lg border p-3 shadow-sm">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Pacient
            </label>
            <PatientSelector
              value={selectedPatient}
              onChange={(p) => {
                setSelectedPatient(p);
                resetState();
              }}
            />
          </div>

          {/* Recording widget — the main floating element */}
          <div
            className={cn(
              "flex-1 bg-card rounded-xl border shadow-lg overflow-hidden transition-all duration-300",
              "flex flex-col items-center justify-center",
              canRecord && "hover:border-violet-300 hover:shadow-violet-500/10",
              hasRecording && "border-violet-400 shadow-violet-500/20",
              isProcessing && "border-amber-400 shadow-amber-500/20",
              hasResults && "border-green-400 shadow-green-500/20",
            )}
          >
            {viewMode === "main" && (
              <>
                <RecordingButton
                  onRecordingComplete={handleRecordingComplete}
                  disabled={!canRecord}
                  size="large"
                />

                {hasRecording && (
                  <div className="mt-4 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">
                      <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                      <span className="text-sm font-medium">
                        {audioDuration}s · {(audioBlob.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAudioBlob(null);
                          setAudioDuration(0);
                        }}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Zrušiť
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleProcess}
                        className="gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Spracovať
                      </Button>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-300">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                      <div className="absolute inset-0 h-8 w-8 rounded-full bg-amber-500/20 blur-md" />
                    </div>
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {status === "uploading" ? "Nahrávam..." : "Transkribujem a formátujem..."}
                    </span>
                    <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                      AI spracováva vaše diktovanie do štruktúrovaného SOAP záznamu
                    </p>
                  </div>
                )}

                {status === "error" && (
                  <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-300">
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                      <X className="h-5 w-5 text-red-500" />
                    </div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Spracovanie zlyhalo
                    </span>
                    <Button variant="outline" size="sm" onClick={handleProcess}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Skúsiť znova
                    </Button>
                  </div>
                )}

                {canRecord && !hasRecording && (
                  <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-sm text-muted-foreground">
                      Stlačte mikrofón a začnite diktovať
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      AI automaticky vytvorí SOAP záznam
                    </p>
                  </div>
                )}
              </>
            )}

            {viewMode === "results" && (
              <div className="w-full h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium">Výsledok spracovania</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("main")}
                    className="h-7 px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Transcript */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Surová transkripcia
                    </label>
                    <textarea
                      value={rawTranscript}
                      onChange={(e) => setRawTranscript(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                    />
                  </div>

                  {/* SOAP sections */}
                  <SoapPreview
                    sections={soapSections}
                    editable
                    onChange={setSoapSections}
                    compact
                  />

                  {/* Save button */}
                  <div className="pt-2 border-t flex justify-end">
                    <Button
                      onClick={handleSave}
                      className="gap-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <Save className="h-4 w-4" />
                      Uložiť do záznamov
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — History (collapsible on mobile, fixed on desktop) */}
        <div
          className={cn(
            "bg-card rounded-xl border shadow-lg overflow-hidden transition-all duration-300",
            viewMode === "history" || selectedPatient ? "block" : "hidden lg:block",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-muted/50 to-muted/30">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">História</span>
            </div>
            {selectedPatient && (
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {selectedPatient.name}
              </span>
            )}
          </div>
          <div className="h-[calc(100%-49px)] overflow-y-auto">
            {selectedPatient ? (
              <HistoryList
                items={historyQuery.data ?? []}
                selectedId={dictationId}
                onSelect={handleSelectHistory}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Vyberte pacienta pre zobrazenie histórie
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating action hint — bottom right */}
      {canRecord && !hasRecording && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full bg-muted/80 backdrop-blur-sm border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Začnite diktovať kliknutím na mikrofón
          </span>
        </div>
      )}
    </div>
  );
}
