"use client";

import { useState, useCallback, useRef } from "react";
import { Mic, Bot, Loader2, Save, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { TranscriptView } from "./components/transcript-view";
import { SoapPreview, type SoapSectionsData } from "./components/soap-preview";
import { HistoryList } from "./components/history-list";

type DictationStatus = "idle" | "uploading" | "processing" | "done" | "error";

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
  const [showHistory, setShowHistory] = useState(false);

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
      // Reset previous results
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
      // 1. Upload audio
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

      // 2. Start dictation record
      setStatus("processing");
      const dictation = await startMutation.mutateAsync({
        patientId: selectedPatient.id,
        audioFileKey,
        audioMimeType: audioBlob.type || "audio/webm",
        audioDurationSeconds: String(audioDuration),
        language: "sk",
      });

      setDictationId(dictation.id);

      // 3. Process (transcribe + format)
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
      toast.success("Transkripcia a formátovanie dokončené");

      // Invalidate history
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
    (item: {
      id: string;
      rawTranscript?: string | null;
      subjective?: string | null;
      objective?: string | null;
      assessment?: string | null;
      plan?: string | null;
      status: string;
    }) => {
      setDictationId(item.id);
      setRawTranscript(item.rawTranscript ?? "");
      setSoapSections({
        subjective: item.subjective ?? "",
        objective: item.objective ?? "",
        assessment: item.assessment ?? "",
        plan: item.plan ?? "",
      });
      setStatus(item.status === "COMPLETED" ? "done" : "idle");
    },
    [],
  );

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hlasové Diktovanie</h1>
          <p className="text-sm text-muted-foreground">
            Nadiktujte klinické poznámky — AI ich transkribuje a naformátuje do
            SOAP záznamu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Bot className="h-3 w-3" />
            AI-powered
          </Badge>
          <Button
            variant={showHistory ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            disabled={!selectedPatient}
          >
            <History className="mr-1 h-4 w-4" />
            História
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — recording + processing */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Patient selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pacient</CardTitle>
            </CardHeader>
            <CardContent>
              <PatientSelector
                value={selectedPatient}
                onChange={(p) => {
                  setSelectedPatient(p);
                  resetState();
                }}
              />
            </CardContent>
          </Card>

          {/* Recording */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Nahrávanie</CardTitle>
              <CardDescription>
                Stlačte mikrofón a začnite diktovať klinické poznámky
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <RecordingButton
                onRecordingComplete={handleRecordingComplete}
                disabled={!selectedPatient || isProcessing}
              />
              {audioBlob && status === "idle" && (
                <p className="text-sm text-muted-foreground">
                  Nahrávka pripravená ({audioDuration}s,{" "}
                  {(audioBlob.size / 1024).toFixed(0)} KB)
                </p>
              )}
              {audioBlob && status === "idle" && (
                <Button onClick={handleProcess} className="gap-2">
                  <Mic className="h-4 w-4" />
                  Spracovať diktovanie
                </Button>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status === "uploading"
                    ? "Nahrávam audio..."
                    : "Transkribujem a formátujem..."}
                </div>
              )}
              {status === "error" && (
                <Button variant="outline" onClick={handleProcess}>
                  Skúsiť znova
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {status === "done" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Výsledok spracovania
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TranscriptView
                  transcript={rawTranscript}
                  editable
                  onChange={setRawTranscript}
                />
                <SoapPreview
                  sections={soapSections}
                  editable
                  onChange={setSoapSections}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2">
                    <Save className="h-4 w-4" />
                    Uložiť do záznamov
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — history */}
        {showHistory && selectedPatient && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  História diktovaní
                </CardTitle>
                <CardDescription>
                  {selectedPatient.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HistoryList
                  items={historyQuery.data ?? []}
                  selectedId={dictationId}
                  onSelect={handleSelectHistory}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
