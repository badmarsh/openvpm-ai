"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  Sparkles,
  Loader2,
  Save,
  History,
  X,
  FileText,
  RotateCcw,
  BookOpen,
  ExternalLink,
  MessageSquare,
  Stethoscope,
  Copy,
  Check,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordingButton } from "./components/recording-button";
import { AudioPlayer } from "./components/audio-player";
import { ClinicalTemplatesModal } from "./components/clinical-templates";
import { VoiceCommandsModal } from "./components/voice-commands";
import { PatientSelector } from "./components/patient-selector";
import { SoapPreview, type SoapSectionsData } from "./components/soap-preview";
import type { SoapStyle } from "@/lib/voice/soap-formatter";

type DictationStatus =
  | "idle"
  | "recording"
  | "processing"
  | "done"
  | "saved"
  | "error";

const QUICK_TEMPLATES = [
  {
    name: "Preventívna prehliadka",
    text: "Preventívna prehliadka psa. Celkový stav pokojný, výživný stav optimálny. Sliznice ružové a vlhké, CRT do 2 sekúnd. Auskultačne srdce a pľúca bez patologických šelestov. Palpácia brucha nebolestivá. Aplikované kombinované očkovanie DHPPiL a odčervenie tabletou. Odporúčaná kontrola o 1 rok.",
  },
  {
    name: "Gastroenteritída",
    text: "Pes predvedený pre akútne zvracanie a hnačku od včerajšieho večera po konzumácii zvyškov jedla. Teplota 38.6 °C, mierna dehydratácia cca 4%. Brucho mierne citlivé v epigastriu. Aplikovaný Maropitant 1mg/kg s.c. a Ringer-laktát 200ml s.c. Nasadená diéta varené kuracie s ryžou a probiotická pasta. Kontrola o 2 dni.",
  },
  {
    name: "Kontrola po operácii",
    text: "Kontrola po plánovanej ovariohysterektómii. Operačná rana v linea alba je čistá, kľudná, bez výtoku, dehiscencie a známok infekcie. Pacientka prijíma krmivo a vodu bez ťažkostí. Odstránenie stehov plánované o 4 dni. Pokračovať v nosení ochranného goliera.",
  },
];

function VoiceDictationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId");
  const utils = trpc.useUtils();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");

  // Patient
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species?: string | null;
    clientName: string;
  } | null>(null);

  // Auto-select patient from query param
  const isValidUuid = (val: string | null): val is string => {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  };
  const isParamValidUuid = isValidUuid(patientIdParam);

  const patientQuery = trpc.patients.getById.useQuery(
    { id: patientIdParam! },
    { enabled: isParamValidUuid && !selectedPatient },
  );

  useEffect(() => {
    if (patientQuery.data && !selectedPatient) {
      const p = patientQuery.data;
      const clientFullName = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ");
      setSelectedPatient({
        id: p.id,
        name: p.name ?? "Neznámy pacient",
        species: p.species ?? null,
        clientName: clientFullName,
      });
      toast.success(`Pacient „${p.name}“ bol vybraný`);
    }
  }, [patientQuery.data, selectedPatient]);

  const patientDetailQ = trpc.patients.getById.useQuery(
    { id: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient?.id },
  );
  const isDeceased = patientDetailQ.data?.status === "deceased";

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
  const [copied, setCopied] = useState(false);

  // UI modals
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  // Human-in-the-loop: AI transcription is saved as a draft unless the
  // clinician explicitly confirms the content for finalization.
  const [clinicianConfirmed, setClinicianConfirmed] = useState(false);

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
      } catch {
        toast.error("Preformátovanie zlyhalo");
      }
    },
    [rawTranscript, selectedPatient, dictationId, formatTextMutation],
  );

  const handleSave = useCallback(async () => {
    if (!dictationId || !selectedPatient) return;
    try {
      // Human-in-the-loop: the clinician must tick the confirmation to
      // finalize; otherwise the note is saved as an editable chart draft.
      const note = await saveMutation.mutateAsync({
        dictationId,
        ...soapSections,
        clinicianConfirmed: clinicianConfirmed ? true : undefined,
      });

      setStatus("saved");
      setSavedNoteId(note.id);
      toast.success(
        note.status === "finalized"
          ? "SOAP záznam bol potvrdený a uložený do kartotéky"
          : "SOAP záznam bol uložený ako koncept – finalizujte ho v kartotéke",
        {
        action: {
          label: "Zobraziť pacienta",
          onClick: () => {
            window.location.href = `/patients/${selectedPatient.id}`;
          },
        },
      },
      );

      utils.extensions.voice.listByPatient.invalidate({
        patientId: selectedPatient.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uloženie SOAP záznamu zlyhalo";
      toast.error(message);
    }
  }, [dictationId, selectedPatient, soapSections, saveMutation, utils, clinicianConfirmed]);

  const handleSelectHistoryItem = (item: any) => {
    setDictationId(item.id);
    setRawTranscript(item.rawTranscript ?? "");
    setSoapSections({
      subjective: item.subjective ?? "",
      objective: item.objective ?? "",
      assessment: item.assessment ?? "",
      plan: item.plan ?? "",
    });
    setStatus(item.status === "COMPLETED" ? "done" : "idle");
    setActiveTab("editor");
    toast.info("Diktát načítaný do editora");
  };

  const handleSelectTemplate = useCallback(
    async (sampleText: string, templateTitle: string) => {
      setRawTranscript(sampleText);
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

  const handleExecuteVoiceCommand = useCallback(
    (actionKey: string, phrase: string) => {
      switch (actionKey) {
        case "new_note":
          resetState();
          toast.success("Pripravená nová poznámka pacienta");
          break;
        case "start_consultation":
          if (!selectedPatient) {
            toast.warning("Najprv vyberte pacienta pre začatie konzultácie");
          } else {
            toast.info("Stlačte tlačidlo mikrofónu pre začatie diktovania");
          }
          break;
        case "end_note":
          if (audioBlob) {
            handleProcess();
          } else {
            toast.info("Záznam pripravený na spracovanie");
          }
          break;
        case "save_document":
          if (dictationId && selectedPatient) {
            handleSave();
          } else {
            toast.warning("Zatiaľ nie je k dispozícii žiadny vygenerovaný SOAP záznam");
          }
          break;
        case "new_paragraph":
          setRawTranscript((prev) => (prev ? `${prev}\n\n` : "\n\n"));
          toast.success("Vložený nový odsek");
          break;
        case "bullet_point":
          setRawTranscript((prev) => (prev ? `${prev}\n• ` : "• "));
          toast.success("Vložená odrážka");
          break;
        case "numbered_list":
          setRawTranscript((prev) => (prev ? `${prev}\n1. ` : "1. "));
          toast.success("Vložený číslovaný zoznam");
          break;
        case "bold_text":
          setRawTranscript((prev) => (prev ? `${prev} **Dôležité:** ` : "**Dôležité:** "));
          toast.success("Vložený formát pre tučný text");
          break;
        case "go_to_patients":
          router.push("/patients");
          break;
        case "open_appointments":
          router.push("/appointments");
          break;
        case "show_dashboard":
          router.push("/dashboard");
          break;
        case "search_records":
          router.push("/records");
          break;
        default:
          toast.info(`Rozpoznaný príkaz: ${phrase}`);
      }
    },
    [resetState, selectedPatient, audioBlob, handleProcess, dictationId, handleSave, router],
  );

  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleLoadDemo = useCallback(async () => {
    setLoadingDemo(true);
    try {
      const res = await fetch("/demo/voice-demo.webm");
      if (!res.ok) throw new Error("Demo nahrávka nebola nájdená");
      const blob = await res.blob();
      // Pre istotu získame reálnu dĺžku z Audio elementu
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Nepodarilo sa načítať demo audio")), { once: true });
      });
      const duration = Math.round(audio.duration || 5);
      URL.revokeObjectURL(url);
      handleRecordingComplete(blob, duration);
      toast.success("Demo nahrávka bola načítaná");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Načítanie demo nahrávky zlyhalo");
    } finally {
      setLoadingDemo(false);
    }
  }, [handleRecordingComplete]);

  const handleCopySoap = () => {
    const text = `S (Subjektívne):\n${soapSections.subjective}\n\nO (Objektívne):\n${soapSections.objective}\n\nA (Posúdenie):\n${soapSections.assessment}\n\nP (Plán):\n${soapSections.plan}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("SOAP záznam skopírovaný do schránky");
    setTimeout(() => setCopied(false), 2000);
  };

  const isProcessing = status === "processing";
  const canRecord = !!selectedPatient && !isProcessing;
  const hasRecording = !!audioBlob && status === "idle";
  const hasSoapContent = Boolean(
    soapSections.subjective ||
    soapSections.objective ||
    soapSections.assessment ||
    soapSections.plan,
  );

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Hlasové Diktovanie
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              Klinický AI Prepis
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Presná transkripcia hovoreného slova s veterinárnou terminológiou a automatickým štruktúrovaním do SOAP.
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="editor" className="gap-1.5">
              <Mic className="h-4 w-4" />
              Diktovanie
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              História diktátov
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
              História hlasových diktovaní
            </CardTitle>
            <CardDescription>
              {selectedPatient
                ? `Zoznam predchádzajúcich diktovaní pre pacienta ${selectedPatient.name}.`
                : "Vyberte pacienta v editore pre zobrazenie histórie jeho diktovaní."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nie je vybraný žiadny pacient</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vráťte sa do editora a vyberte pacienta, ktorého históriu si prajete zobraziť.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("editor")}
                  className="mt-4 text-xs"
                >
                  Prejsť do editora
                </Button>
              </div>
            ) : historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Pre pacienta {selectedPatient.name} zatiaľ neboli zaznamenané žiadne diktáty.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {historyQuery.data.map((item: any) => (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          Diktát — {new Date(item.createdAt).toLocaleDateString("sk-SK")}
                        </CardTitle>
                        <Badge
                          variant={
                            item.status === "COMPLETED"
                              ? "default"
                              : item.status === "SAVED"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {item.status === "COMPLETED"
                            ? "Spracované"
                            : item.status === "SAVED"
                              ? "Uložené v karte"
                              : "Koncept"}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs mt-1">
                        {item.assessment || item.rawTranscript || "Bez popisu nálezu"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {item.audioDurationSeconds ? `${item.audioDurationSeconds} s audia` : "Diktát"}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectHistoryItem(item)}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Načítať do editora
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
          {/* Left Column: Patient, Presets & Recording */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Patient Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Vybrať pacienta pre diktovanie *
                  </span>
                  {selectedPatient && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Link href={`/patients/${selectedPatient.id}`} target="_blank">
                          <span>Karta pacienta</span>
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPatient(null);
                          resetState();
                        }}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Zrušiť
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PatientSelector
                  value={selectedPatient}
                  onChange={(p) => {
                    setSelectedPatient(p);
                    resetState();
                  }}
                />

                {/* Sympathy Flow Warning Banner */}
                {isDeceased && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Upozornenie na status pacienta</strong>
                      Tento pacient je evidovaný ako uhynutý/eutanazovaný. Záznam bude uložený do archívu.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions & Presets (matching discharge style) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Rýchle vzory & pomôcky:
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCommandsOpen(true)}
                    className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Hlasové príkazy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTemplatesOpen(true)}
                    className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                  >
                    <BookOpen className="h-3 w-3" />
                    Všetky vzory
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    onClick={() => handleSelectTemplate(tpl.text, tpl.name)}
                  >
                    {tpl.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recording Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-primary" />
                    Hlasový záznam vyšetrenia
                  </span>
                  {audioDuration > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {audioDuration} sekúnd
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedPatient
                    ? "Stlačte mikrofón a diktujte anamnézu, klinický nález a medikáciu."
                    : "Najprv zvoľte pacienta vyššie pre aktiváciu nahrávania."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                <RecordingButton
                  onRecordingComplete={handleRecordingComplete}
                  onCommandDetected={(actionKey, phrase) => {
                    handleExecuteVoiceCommand(actionKey, phrase);
                  }}
                  disabled={!canRecord}
                  size="large"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDemo}
                  disabled={loadingDemo || !canRecord}
                  className="text-xs gap-1.5"
                >
                  {loadingDemo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  Načítať demo nahrávku
                </Button>

                {/* Recorded Audio Preview */}
                {hasRecording && audioUrl && (
                  <div className="w-full space-y-3 pt-2">
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
                        className="text-xs gap-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Nahrať znova
                      </Button>

                      <Button
                        type="button"
                        onClick={handleProcess}
                        className="gap-2 py-4 text-xs font-semibold shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Spracovať cez Gemini AI
                      </Button>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {isProcessing && (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      AI analyzuje a štruktúruje veterinárne diktovanie...
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Prebieha prevod audia na text a kategorizácia do SOAP štruktúry.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw Transcript Card */}
            {(rawTranscript || hasSoapContent) && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      Surový prepis diktátu
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {rawTranscript.length} znakov
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <textarea
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    rows={3}
                    placeholder="Sem môžete vložiť alebo upraviť surový text..."
                    className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleReformat(activeStyle)}
                      disabled={formatTextMutation.isPending || !rawTranscript}
                      className="text-xs gap-1.5 h-7"
                    >
                      {formatTextMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Preformátovať do SOAP
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: SOAP Preview & Actions */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <Card className="flex flex-col h-full min-h-[550px] shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Klinický SOAP záznam
                  </CardTitle>
                </div>

                {hasSoapContent && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopySoap}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Kopírovať
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-4 space-y-4">
                {hasSoapContent ? (
                  <div className="flex-1 flex flex-col space-y-4">
                    <SoapPreview
                      sections={soapSections}
                      editable
                      onChange={setSoapSections}
                      patientName={selectedPatient?.name}
                      onReformat={handleReformat}
                      isReformatting={formatTextMutation.isPending}
                    />

                    {/* Footer Save CTA */}
                    <div className="pt-3 border-t space-y-3">
                      <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-input"
                          checked={clinicianConfirmed}
                          onChange={(e) => setClinicianConfirmed(e.target.checked)}
                          aria-label="Potvrdzujem, že som skontroloval(a) AI prepis a finalizujem záznam"
                          data-testid="voice-clinician-confirm"
                        />
                        <span>
                          Potvrdzujem, že som AI prepis skontroloval(a) a záznam
                          finalizujem pod svojím menom. Bez potvrdenia sa uloží
                          iba ako koncept.
                        </span>
                      </label>
                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saveMutation.isPending || status === "saved" || !dictationId}
                        className="w-full gap-2 py-5 text-sm font-semibold shadow-sm"
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Ukladám SOAP do karty pacienta...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {status === "saved"
                              ? "Uložené v kartotéke pacienta"
                              : clinicianConfirmed
                                ? "Potvrdiť a finalizovať SOAP záznam"
                                : "Uložiť ako koncept do záznamov pacienta"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground text-center">
                    <Mic className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-foreground">
                      Žiadny vygenerovaný SOAP záznam
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Vyberte pacienta, nahrajte hlasový záznam alebo zvoľte klinický vzor z ponuky vľavo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Voice Commands Modal */}
      <VoiceCommandsModal
        open={commandsOpen}
        onOpenChange={setCommandsOpen}
        onExecuteCommand={handleExecuteVoiceCommand}
      />

      {/* Clinical Templates Modal */}
      <ClinicalTemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}

export default function VoiceDictationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Načítavam hlasové diktovanie...</span>
          </div>
        </div>
      }
    >
      <VoiceDictationContent />
    </Suspense>
  );
}
