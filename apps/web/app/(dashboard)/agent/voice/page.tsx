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
  Receipt,
  CreditCard,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
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
    key: "preventive",
    name: "Preventívna prehliadka",
    text: "Preventívna prehliadka psa. Celkový stav pokojný, výživný stav optimálny. Sliznice ružové a vlhké, CRT do 2 sekúnd. Auskultačne srdce a pľúca bez patologických šelestov. Palpácia brucha nebolestivá. Aplikované kombinované očkovanie DHPPiL a odčervenie tabletou. Odporúčaná kontrola o 1 rok.",
  },
  {
    key: "gastro",
    name: "Gastroenteritída",
    text: "Pes predvedený pre akútne zvracanie a hnačku od včerajšieho večera po konzumácii zvyškov jedla. Teplota 38.6 °C, mierna dehydratácia cca 4%. Brucho mierne citlivé v epigastriu. Aplikovaný Maropitant 1mg/kg s.c. a Ringer-laktát 200ml s.c. Nasadená diéta varené kuracie s ryžou a probiotická pasta. Kontrola o 2 dni.",
  },
  {
    key: "postOp",
    name: "Kontrola po operácii",
    text: "Kontrola po plánovanej ovariohysterektómii. Operačná rana v linea alba je čistá, kľudná, bez výtoku, dehiscencie a známok infekcie. Pacientka prijíma krmivo a vodu bez ťažkostí. Odstránenie stehov plánované o 4 dni. Pokračovať v nosení ochranného goliera.",
  },
];

function VoiceDictationContent() {
  const { t } = useI18n();
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
        name: p.name ?? t("voice.page.unknownPatient", "Neznámy pacient"),
        species: p.species ?? null,
        clientName: clientFullName,
      });
      toast.success(t("voice.page.patientSelected", "Pacient „{name}“ bol vybraný", { name: p.name ?? "" }));
    }
  }, [patientQuery.data, selectedPatient, t]);

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

  // AI Billing extraction states
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

  const extractItemsMutation = trpc.extensions.voice.extractBillableItems.useMutation({
    onSuccess: (data) => {
      setExtractedItems(data.items);
      setIsBillingModalOpen(true);
      toast.success(t("voice.billing.itemsRecognized", "Rozpoznaných {count} položiek na vyúčtovanie.", { count: data.items.length }));
    },
    onError: (err) => {
      toast.error(t("voice.billing.extractFailed", "Extrakcia položiek zlyhala: {message}", { message: err.message }));
    },
  });

  const createInvoiceMutation = trpc.extensions.voice.createBillFromExtractedItems.useMutation({
    onSuccess: (data) => {
      toast.success(t("voice.billing.invoiceCreated", "Koncept faktúry ({total} €) bol vytvorený v systéme.", { total: data.total.toFixed(2) }));
      setIsBillingModalOpen(false);
    },
    onError: (err) => {
      toast.error(t("voice.billing.invoiceFailed", "Chyba pri vytváraní účtu: {message}", { message: err.message }));
    },
  });

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
        clientSummary: (processed as any).clientSummary ?? "",
      });

      setStatus("done");
      toast.success(t("voice.page.processingDone", "Transkripcia a SOAP analýza dokončená"));

      utils.extensions.voice.listByPatient.invalidate({
        patientId: selectedPatient.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("voice.page.processingFailed", "Spracovanie diktovania zlyhalo");
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
    t,
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
          clientSummary: (formatted as any).clientSummary ?? "",
        });
        const styleLabel =
          style === "standard"
            ? t("voice.soap.styleStandard", "Štandardný")
            : style === "detailed"
              ? t("voice.soap.styleDetailed", "Detailný")
              : t("voice.soap.styleConcise", "Stručný");
        toast.success(t("voice.page.reformatted", "SOAP preformátovaný v štýle: {style}", { style: styleLabel }));
      } catch {
        toast.error(t("voice.page.reformatFailed", "Preformátovanie zlyhalo"));
      }
    },
    [rawTranscript, selectedPatient, dictationId, formatTextMutation, t],
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
          ? t("voice.page.savedFinalized", "SOAP záznam bol potvrdený a uložený do kartotéky")
          : t("voice.page.savedDraft", "SOAP záznam bol uložený ako koncept – finalizujte ho v kartotéke"),
        {
        action: {
          label: t("voice.page.viewPatient", "Zobraziť pacienta"),
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
      const message = err instanceof Error ? err.message : t("voice.page.saveFailed", "Uloženie SOAP záznamu zlyhalo");
      toast.error(message);
    }
  }, [dictationId, selectedPatient, soapSections, saveMutation, utils, clinicianConfirmed, t]);

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
    toast.info(t("voice.page.loadedToEditor", "Diktát načítaný do editora"));
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
        toast.success(t("voice.page.templateProcessed", "Vzor „{title}“ bol úspešne spracovaný", { title: templateTitle }));
      } catch {
        setStatus("done");
      }
    },
    [selectedPatient, activeStyle, formatTextMutation, t],
  );

  const handleExecuteVoiceCommand = useCallback(
    (actionKey: string, phrase: string) => {
      switch (actionKey) {
        case "new_note":
          resetState();
          toast.success(t("voice.commands.newNoteReady", "Pripravená nová poznámka pacienta"));
          break;
        case "start_consultation":
          if (!selectedPatient) {
            toast.warning(t("voice.commands.selectPatientFirst", "Najprv vyberte pacienta pre začatie konzultácie"));
          } else {
            toast.info(t("voice.commands.pressMic", "Stlačte tlačidlo mikrofónu pre začatie diktovania"));
          }
          break;
        case "end_note":
          if (audioBlob) {
            handleProcess();
          } else {
            toast.info(t("voice.commands.readyToProcess", "Záznam pripravený na spracovanie"));
          }
          break;
        case "save_document":
          if (dictationId && selectedPatient) {
            handleSave();
          } else {
            toast.warning(t("voice.commands.noSoapYet", "Zatiaľ nie je k dispozícii žiadny vygenerovaný SOAP záznam"));
          }
          break;
        case "new_paragraph":
          setRawTranscript((prev) => (prev ? `${prev}\n\n` : "\n\n"));
          toast.success(t("voice.commands.paragraphInserted", "Vložený nový odsek"));
          break;
        case "bullet_point":
          setRawTranscript((prev) => (prev ? `${prev}\n• ` : "• "));
          toast.success(t("voice.commands.bulletInserted", "Vložená odrážka"));
          break;
        case "numbered_list":
          setRawTranscript((prev) => (prev ? `${prev}\n1. ` : "1. "));
          toast.success(t("voice.commands.numberedInserted", "Vložený číslovaný zoznam"));
          break;
        case "bold_text":
          setRawTranscript((prev) => (prev ? `${prev} **Dôležité:** ` : "**Dôležité:** "));
          toast.success(t("voice.commands.boldInserted", "Vložený formát pre tučný text"));
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
          toast.info(t("voice.commands.recognized", "Rozpoznaný príkaz: {phrase}", { phrase }));
      }
    },
    [resetState, selectedPatient, audioBlob, handleProcess, dictationId, handleSave, router, t],
  );

  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleLoadDemo = useCallback(async () => {
    setLoadingDemo(true);
    try {
      if (!selectedPatient) {
        let pCandidate = null;
        try {
          const bonoResults = await utils.patients.search.fetch({ query: "Bono" });
          if (bonoResults && bonoResults.length > 0) {
            pCandidate = bonoResults[0];
          }
        } catch {}

        if (!pCandidate) {
          try {
            const listResults = await utils.patients.list.fetch({ limit: 1 });
            if (listResults?.items && listResults.items.length > 0) {
              pCandidate = listResults.items[0];
            }
          } catch {}
        }

        if (pCandidate) {
          const clientFullName = [pCandidate.clientFirstName, pCandidate.clientLastName].filter(Boolean).join(" ");
          setSelectedPatient({
            id: pCandidate.id,
            name: pCandidate.name ?? t("voice.demo.defaultPatientName", "Bono"),
            species: pCandidate.species ?? "canine",
            clientName: clientFullName || t("voice.demo.defaultClientName", "Majiteľ"),
          });
        }
      }

      const res = await fetch("/demo/voice-demo.webm");
      if (!res.ok) throw new Error(t("voice.demo.notFound", "Demo nahrávka nebola nájdená"));
      const blob = await res.blob();
      // Pre istotu získame reálnu dĺžku z Audio elementu
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error(t("voice.demo.loadError", "Nepodarilo sa načítať demo audio"))), { once: true });
      });
      const duration = Math.round(audio.duration || 36);
      URL.revokeObjectURL(url);
      handleRecordingComplete(blob, duration);
      toast.success(t("voice.demo.loaded", "Demo nahrávka bola načítaná"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("voice.demo.failed", "Načítanie demo nahrávky zlyhalo"));
    } finally {
      setLoadingDemo(false);
    }
  }, [handleRecordingComplete, selectedPatient, utils, t]);

  const handleCopySoap = () => {
    const text = `${t("voice.soap.subjective", "Subjektívne (S)")}:\n${soapSections.subjective}\n\n${t("voice.soap.objective", "Objektívne (O)")}:\n${soapSections.objective}\n\n${t("voice.soap.assessment", "Hodnotenie (A)")}:\n${soapSections.assessment}\n\n${t("voice.soap.plan", "Plán (P)")}:\n${soapSections.plan}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t("voice.page.soapCopied", "SOAP záznam skopírovaný do schránky"));
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
              {t("voice.page.title", "Hlasové diktovanie")}
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              {t("voice.page.badge", "Klinický AI prepis")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("voice.page.subtitle", "Presná transkripcia hovoreného slova s veterinárnou terminológiou a automatickým štruktúrovaním do SOAP.")}
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="editor" className="gap-1.5">
              <Mic className="h-4 w-4" />
              {t("voice.page.tabEditor", "Diktovanie")}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              {t("voice.page.tabHistory", "História diktátov")}
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
              {t("voice.history.title", "História hlasových diktovaní")}
            </CardTitle>
            <CardDescription>
              {selectedPatient
                ? t("voice.history.forPatient", "Zoznam predchádzajúcich diktovaní pre pacienta {name}.", { name: selectedPatient.name })
                : t("voice.history.selectPatientHint", "Vyberte pacienta v editore pre zobrazenie histórie jeho diktovaní.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{t("voice.history.noPatient", "Nie je vybraný žiadny pacient")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("voice.history.noPatientHint", "Vráťte sa do editora a vyberte pacienta, ktorého históriu si prajete zobraziť.")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("editor")}
                  className="mt-4 text-xs"
                >
                  {t("voice.history.goToEditor", "Prejsť do editora")}
                </Button>
              </div>
            ) : historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !historyQuery.data || historyQuery.data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {t("voice.history.empty", "Pre pacienta {name} zatiaľ neboli zaznamenané žiadne diktáty.", { name: selectedPatient.name })}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {historyQuery.data.map((item: any) => (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          {t("voice.history.itemTitle", "Diktát")} — {new Date(item.createdAt).toLocaleDateString("sk-SK")}
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
                            ? t("voice.history.statusCompleted", "Spracované")
                            : item.status === "SAVED"
                              ? t("voice.history.statusSaved", "Uložené v karte")
                              : t("voice.history.statusDraft", "Koncept")}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs mt-1">
                        {item.assessment || item.rawTranscript || t("voice.history.noDescription", "Bez popisu nálezu")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {item.audioDurationSeconds
                          ? t("voice.history.audioSeconds", "{seconds} s audia", { seconds: item.audioDurationSeconds })
                          : t("voice.history.itemTitle", "Diktát")}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectHistoryItem(item)}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("voice.history.loadToEditor", "Načítať do editora")}
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
                    {t("voice.patient.selectTitle", "Vybrať pacienta pre diktovanie *")}
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
                          <span>{t("voice.patient.chart", "Karta pacienta")}</span>
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
                        {t("voice.patient.clear", "Zrušiť")}
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
                      <strong className="font-semibold block mb-0.5">{t("voice.deceased.title", "Upozornenie na status pacienta")}</strong>
                      {t("voice.deceased.desc", "Tento pacient je evidovaný ako uhynutý/eutanazovaný. Záznam bude uložený do archívu.")}
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
                  {t("voice.templates.label", "Rýchle vzory & pomôcky")}:
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
                    {t("voice.templates.voiceCommands", "Hlasové príkazy")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTemplatesOpen(true)}
                    className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                  >
                    <BookOpen className="h-3 w-3" />
                    {t("voice.templates.allTemplates", "Všetky vzory")}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tpl) => {
                  const tplName = t(`voice.templates.quick.${tpl.key}`, tpl.name);
                  return (
                    <Button
                      key={tpl.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      onClick={() => handleSelectTemplate(tpl.text, tplName)}
                    >
                      {tplName}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Recording Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-primary" />
                    {t("voice.recording.title", "Hlasový záznam vyšetrenia")}
                  </span>
                  {audioDuration > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {t("voice.recording.seconds", "{seconds} sekúnd", { seconds: audioDuration })}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedPatient
                    ? t("voice.recording.hintReady", "Stlačte mikrofón a diktujte anamnézu, klinický nález a medikáciu.")
                    : t("voice.recording.hintSelectPatient", "Najprv zvoľte pacienta vyššie pre aktiváciu nahrávania.")}
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
                  disabled={loadingDemo || isProcessing}
                  className="text-xs gap-1.5"
                >
                  {loadingDemo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {t("voice.demo.load", "Načítať demo nahrávku")}
                </Button>

                {/* Recorded Audio Preview */}
                {hasRecording && audioUrl && (
                  <div className="w-full space-y-3 pt-2">
                    <AudioPlayer
                      src={audioUrl}
                      title={t("voice.recording.playerTitle", "Záznam diktátu ({seconds} sekúnd)", { seconds: audioDuration })}
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
                        {t("voice.recording.recordAgain", "Nahrať znova")}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleProcess}
                        className="gap-2 py-4 text-xs font-semibold shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("voice.recording.process", "Spracovať cez Gemini AI")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {isProcessing && (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      {t("voice.recording.processing", "AI analyzuje a štruktúruje veterinárne diktovanie...")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("voice.recording.processingHint", "Prebieha prevod audia na text a kategorizácia do SOAP štruktúry.")}
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
                      {t("voice.transcript.title", "Surový prepis diktátu")}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {t("voice.transcript.charCount", "{count} znakov", { count: rawTranscript.length })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <textarea
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    rows={3}
                    placeholder={t("voice.transcript.placeholder", "Sem môžete vložiť alebo upraviť surový text...")}
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
                      {t("voice.transcript.reformat", "Preformátovať do SOAP")}
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
                    {t("voice.soapCard.title", "Klinický SOAP záznam")}
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
                      {t("voice.soap.copy", "Kopírovať")}
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
                          aria-label={t("voice.save.confirmAria", "Potvrdzujem, že som skontroloval(a) AI prepis a finalizujem záznam")}
                          data-testid="voice-clinician-confirm"
                        />
                        <span>
                          {t(
                            "voice.save.confirmLabel",
                            "Potvrdzujem, že som AI prepis skontroloval(a) a záznam finalizujem pod svojím menom. Bez potvrdenia sa uloží iba ako koncept.",
                          )}
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
                            {t("voice.save.saving", "Ukladám SOAP do karty pacienta...")}
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {status === "saved"
                              ? t("voice.save.saved", "Uložené v kartotéke pacienta")
                              : clinicianConfirmed
                                ? t("voice.save.confirmAndFinalize", "Potvrdiť a finalizovať SOAP záznam")
                                : t("voice.save.saveDraft", "Uložiť ako koncept do záznamov pacienta")}
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          extractItemsMutation.mutate({
                            plan: soapSections.plan,
                            assessment: soapSections.assessment,
                            transcript: rawTranscript,
                            dictationId: dictationId ?? undefined,
                          })
                        }
                        disabled={extractItemsMutation.isPending || !soapSections.plan}
                        className="w-full gap-2 py-4 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                      >
                        {extractItemsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("voice.billing.extracting", "Extrahujem položky pre vyúčtovanie...")}
                          </>
                        ) : (
                          <>
                            <Receipt className="h-4 w-4" />
                            {t("voice.billing.extractButton", "Extrahovať lieky a úkony do účtu / pokladne")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground text-center">
                    <Mic className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-foreground">
                      {t("voice.soapCard.empty", "Žiadny vygenerovaný SOAP záznam")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      {t("voice.soapCard.emptyHint", "Vyberte pacienta, nahrajte hlasový záznam alebo zvoľte klinický vzor z ponuky vľavo.")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Owner-friendly Client Summary Card */}
      {soapSections.clientSummary && (
        <Card className="shadow-sm border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20">
          <CardHeader className="pb-2 border-b border-sky-100 dark:border-sky-800 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <CardTitle className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                {t("voice.clientSummary.title", "Majiteľský súhrn")}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300">
                {t("voice.clientSummary.badge", "Pre majiteľa")}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-sky-700 hover:text-sky-900 hover:bg-sky-100 dark:text-sky-300"
              onClick={() => {
                navigator.clipboard.writeText(soapSections.clientSummary ?? "");
                toast.success(t("voice.clientSummary.copied", "Súhrn skopírovaný pre majiteľa"));
              }}
            >
              <Copy className="h-3 w-3" />
              {t("voice.clientSummary.copy", "Kopírovať")}
            </Button>
          </CardHeader>
          <CardContent className="pt-3 pb-4 px-4">
            <p className="text-xs text-muted-foreground mb-2">
              {t("voice.clientSummary.description", "Empatický text bez latinčiny – vhodný na odovzdanie majiteľovi alebo zaslanie správy.")}
            </p>
            <div className="rounded-lg bg-white dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {soapSections.clientSummary}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Billing Items Modal */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-base">{t("voice.billing.modalTitle", "Položky na vyúčtovanie z hlasového záznamu")}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsBillingModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                {t("voice.billing.modalHint", "Tieto položky a aplikované liečivá boli automaticky rozpoznané z plánu terapie. Môžete upraviť množstvá alebo ceny pred vystavením účtu.")}
              </p>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-2.5">{t("voice.billing.colItem", "Položka / Liečivo")}</th>
                      <th className="p-2.5">{t("voice.billing.colCategory", "Kategória")}</th>
                      <th className="p-2.5 w-20">{t("voice.billing.colQuantity", "Množstvo")}</th>
                      <th className="p-2.5 w-24">{t("voice.billing.colUnitPrice", "Cena/j (€)")}</th>
                      <th className="p-2.5 w-24">{t("voice.billing.colTotal", "Spolu (€)")}</th>
                      <th className="p-2.5 w-12 text-center">{t("voice.billing.colAction", "Akcia")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {extractedItems.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...extractedItems];
                              updated[idx].name = e.target.value;
                              setExtractedItems(updated);
                            }}
                            className="w-full bg-transparent text-xs font-medium focus:outline-none focus:underline"
                          />
                          {item.dosageOrRoute && (
                            <span className="text-[10px] text-muted-foreground block">
                              {t("voice.billing.dose", "Dávka")}: {item.dosageOrRoute}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {item.category === "medication"
                              ? t("voice.billing.categoryMedication", "Liek")
                              : t("voice.billing.categoryService", "Úkon")}
                          </Badge>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...extractedItems];
                                const q = parseFloat(e.target.value) || 0;
                                updated[idx].quantity = q;
                                updated[idx].totalPrice = Math.round(q * updated[idx].unitPrice * 100) / 100;
                                setExtractedItems(updated);
                              }}
                              className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right"
                            />
                            <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                          </div>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const updated = [...extractedItems];
                              const p = parseFloat(e.target.value) || 0;
                              updated[idx].unitPrice = p;
                              updated[idx].totalPrice = Math.round(updated[idx].quantity * p * 100) / 100;
                              setExtractedItems(updated);
                            }}
                            className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right"
                          />
                        </td>
                        <td className="p-2.5 font-semibold">
                          {item.totalPrice.toFixed(2)} €
                        </td>
                        <td className="p-2.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExtractedItems(extractedItems.filter((_, i) => i !== idx));
                            }}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-xs font-semibold">
                <span>{t("voice.billing.totalWithVat", "Celková suma za položky s DPH")}:</span>
                <span className="text-base font-bold text-foreground">
                  {extractedItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0).toFixed(2)} €
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBillingModalOpen(false)}
              >
                {t("voice.billing.cancel", "Zrušiť")}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!selectedPatient) {
                    toast.error(t("voice.billing.noPatient", "Nie je vybraný pacient."));
                    return;
                  }
                  createInvoiceMutation.mutate({
                    patientId: selectedPatient.id,
                    items: extractedItems.map((i) => ({
                      name: i.name,
                      category: i.category,
                      quantity: i.quantity,
                      unitPrice: i.unitPrice,
                      totalPrice: i.totalPrice,
                      vatRate: i.vatRate,
                    })),
                  });
                }}
                disabled={createInvoiceMutation.isPending || extractedItems.length === 0}
                className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {createInvoiceMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" />
                )}
                <span>{t("voice.billing.createInvoice", "Vytvoriť koncept faktúry")}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  router.push("/billing/ekasa");
                }}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>{t("voice.billing.goToEkasa", "Prejsť do e-Kasa pokladne")}</span>
              </Button>
            </div>
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
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              {t("voice.page.loading", "Načítavam hlasové diktovanie...")}
            </span>
          </div>
        </div>
      }
    >
      <VoiceDictationContent />
    </Suspense>
  );
}
