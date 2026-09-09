"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Upload,
  ImageIcon,
  Loader2,
  Search,
  Check,
  Image as ImageIconLucide,
  X,
  Bot,
  AlertTriangle,
  Scan,
  History,
  RotateCcw,
  Copy,
  Printer,
  Sparkles,
  Stethoscope,
  FileText,
  Heart,
  Activity,
  Megaphone,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  Share2,
} from "lucide-react";
import { calculateVhs, type VhsResult } from "@/lib/imaging/vhs-calculator";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// react-markdown + remark-gfm are heavy; the analysis text only exists after
// the first AI run, so the renderer loads lazily and never blocks page paint.
const MarkdownView = dynamic(
  () =>
    import("@/components/common/markdown-view").then(
      (mod) => mod.MarkdownView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-2" aria-hidden="true">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    ),
  },
);
import {
  isImageUploadFileValid,
  IMAGE_UPLOAD_POLICY_MESSAGE,
} from "@/lib/upload-policy";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  fetchWithClientTimeout,
} from "@/lib/client-fetch";
import { DicomViewer } from "@/components/imaging/dicom-viewer";

const IMAGE_TYPES = [
  { value: "xray", labelKey: "imaging.types.xray", label: "Röntgen" },
  { value: "ct", labelKey: "imaging.types.ct", label: "CT" },
  { value: "mri", labelKey: "imaging.types.mri", label: "MRI" },
  { value: "ultrasound", labelKey: "imaging.types.ultrasound", label: "Ultrazvuk" },
  { value: "photo", labelKey: "imaging.types.photo", label: "Klinická fotka" },
] as const;

type ImageType = (typeof IMAGE_TYPES)[number]["value"];

interface ImagingPreset {
  key: string;
  name: string;
  imageType: ImageType;
  prompt: string;
}

const PRESETS_IMAGING: ImagingPreset[] = [
  {
    key: "presetThorax",
    name: "Thorax / Srdce & Pľúca",
    imageType: "xray",
    prompt: "Zameraj sa na posúdenie kardiovertebrálneho indexu (VHS), veľkosť srdcovej siluety, pľúcny vzor (bronchiálny, intersticiálny, alveolárny) a prítomnosť voľnej tekutiny.",
  },
  {
    key: "presetAbdomen",
    name: "Abdomen / Cudzie teleso",
    imageType: "xray",
    prompt: "Posúď distribúciu plynu v črevných kľučkách, prítomnosť nepriechodnosti (ileus), rádiokontrastné cudzie telesá, obličky, pečeň a močový mechúr.",
  },
  {
    key: "presetExtremity",
    name: "Končatiny / Fraktúra",
    imageType: "xray",
    prompt: "Skontroluj integritu kortikalis, hľadaj línie fraktúry, dislokácie fragmentov, subluxácie kĺbov a známky periostálnej reakcie či artrózy.",
  },
  {
    key: "presetDental",
    name: "Dentálny RTG",
    imageType: "xray",
    prompt: "Posúď alveolárnu kosť, periodontálnu štrbinu, zubné korene, prítomnosť resorpčných lézií (TR/FORL) a periapikálne rádiolucencie.",
  },
  {
    key: "presetSkin",
    name: "Dermatológia / Koža",
    imageType: "photo",
    prompt: "Posúď charakter kožnej lézie, stupeň erytému, alopécie, krustóznych zmien a navrhni diferenciálne diagnózy (alergia, infekcia, novotvar).",
  },
];

export default function ImagingPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dicomFile, setDicomFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAttemptRef = useRef<ReturnType<typeof selectManagedUploadFile> | null>(null);

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
    { enabled: patientSearch.length >= 2 },
  );

  const patientDetailQ = trpc.patients.getById.useQuery(
    { id: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient?.id },
  );

  const isDeceased = patientDetailQ.data?.status === "deceased";

  // Analysis config
  const [imageType, setImageType] = useState<ImageType>("xray");
  const [userPrompt, setUserPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  // Analysis state
  const analyzeMutation = trpc.extensions.imaging.analyze.useMutation({
    onSuccess: () => {
      if (selectedPatient) {
        utils.extensions.imaging.listByPatient.invalidate({ patientId: selectedPatient.id });
      }
    },
  });
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // Advanced AI pillars: VHS Calculator & Marketing Quiz
  const [showVhsCalc, setShowVhsCalc] = useState(false);
  const [vhsLongAxisMm, setVhsLongAxisMm] = useState("75");
  const [vhsShortAxisMm, setVhsShortAxisMm] = useState("65");
  const [vhsT4Mm, setVhsT4Mm] = useState("15");
  const [vhsSpecies, setVhsSpecies] = useState<"canine" | "feline">("canine");
  const [vhsResult, setVhsResult] = useState<VhsResult | null>(null);

  const [showMarketingQuiz, setShowMarketingQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState("Čo odhalila táto rádiologická snímka z našej ambulancie?");
  const [quizCorrectAnswer, setQuizCorrectAnswer] = useState("");
  const [quizWrong1, setQuizWrong1] = useState("Fyziologický nález (v norme)");
  const [quizWrong2, setQuizWrong2] = useState("Závažná kardiovaskulárna dekompenzácia");
  const [quizChannel, setQuizChannel] = useState<"instagram" | "facebook" | "google_business">("instagram");
  const [quizCreatedPost, setQuizCreatedPost] = useState<any | null>(null);

  const createQuizMutation = trpc.extensions.imaging.createMarketingQuizFromImaging.useMutation();

  // History
  const historyQuery = trpc.extensions.imaging.listByPatient.useQuery(
    { patientId: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient },
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDcm =
      file.name.toLowerCase().endsWith(".dcm") ||
      file.name.toLowerCase().endsWith(".dicom") ||
      file.type === "application/dicom";

    if (isDcm) {
      setDicomFile(file);
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileUrl(null);
      setFileId(null);
      setAnalysisId(null);
      setImageType("xray");
      toast.info(t("imaging.toast.dicomLoaded", "Načítaný DICOM súbor. Prebieha dekódovanie snímky."));
      return;
    }

    if (!isImageUploadFileValid(file)) {
      toast.error(IMAGE_UPLOAD_POLICY_MESSAGE);
      return;
    }

    setDicomFile(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFileUrl(null);
    setFileId(null);
    setAnalysisId(null);
    uploadAttemptRef.current = selectManagedUploadFile(
      uploadAttemptRef.current,
      file,
    );
  }, [t]);

  const handleDicomPrepared = useCallback((blob: Blob, dataUrl: string) => {
    if (!dicomFile) return;
    const pngName = dicomFile.name.replace(/\.(dcm|dicom)$/i, "") + ".png";
    const convertedFile = new File([blob], pngName, { type: "image/png" });
    setSelectedFile(convertedFile);
    setPreviewUrl(dataUrl);
    uploadAttemptRef.current = selectManagedUploadFile(
      uploadAttemptRef.current,
      convertedFile,
    );
    toast.success(t("imaging.toast.dicomReady", "Snímka bola spracovaná a je pripravená na nahrávanie a AI analýzu."));
  }, [dicomFile, t]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !selectedPatient || !uploadAttemptRef.current) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", "imaging");
    formData.append("patientId", selectedPatient.id);

    setUploading(true);
    try {
      const res = await fetchWithClientTimeout(
        "/api/upload",
        {
          method: "POST",
          body: formData,
          headers: { "Idempotency-Key": uploadAttemptRef.current.idempotencyKey },
        },
        CLIENT_UPLOAD_TIMEOUT_MS,
      );

      const json = (await res.json().catch(() => ({}))) as { url?: string; key?: string; error?: string };
      if (!res.ok) {
        uploadAttemptRef.current = settleManagedUploadAttempt(uploadAttemptRef.current, {
          kind: "response",
          status: res.status,
        });
        throw new Error(json.error ?? "Upload failed");
      }

      uploadAttemptRef.current = settleManagedUploadAttempt(uploadAttemptRef.current, {
        kind: "success",
      });

      // fileId is the last segment of key (uuid)
      const id = json.key?.split("/").pop() ?? null;
      setFileUrl(json.url ?? null);
      setFileId(id);
      toast.success(t("imaging.toast.uploaded", "Snímok úspešne nahraný"));
    } catch (err) {
      if (uploadAttemptRef.current) {
        uploadAttemptRef.current = settleManagedUploadAttempt(uploadAttemptRef.current, {
          kind: "ambiguous",
        });
      }
      const message = err instanceof Error ? err.message : t("imaging.toast.uploadFailed", "Nahrávanie zlyhalo");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedPatient, t]);

  const handleAnalyze = useCallback(async () => {
    if (!fileId || !selectedPatient) return;

    setAnalysisId(null);
    try {
      const result = await analyzeMutation.mutateAsync({
        fileId,
        patientId: selectedPatient.id,
        imageType,
        userPrompt: userPrompt || undefined,
      });
      setAnalysisId(result.id);
      toast.success(t("imaging.toast.analysisDone", "AI analýza snímku dokončená"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("imaging.toast.analysisFailed", "Analýza zlyhala");
      toast.error(message);
    }
  }, [fileId, selectedPatient, imageType, userPrompt, analyzeMutation, t]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setDicomFile(null);
    setPreviewUrl(null);
    setFileUrl(null);
    setFileId(null);
    setAnalysisId(null);
    setVhsResult(null);
    setQuizCreatedPost(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleCalculateVhs = () => {
    const l = parseFloat(vhsLongAxisMm);
    const s = parseFloat(vhsShortAxisMm);
    const t4 = parseFloat(vhsT4Mm);
    if (!l || !s || !t4 || l <= 0 || s <= 0 || t4 <= 0) {
      toast.error(t("imaging.vhs.invalidInput", "Zadajte platné kladné rozmery v milimetroch"));
      return;
    }
    try {
      const res = calculateVhs({
        longAxisMm: l,
        shortAxisMm: s,
        t4VertebraLengthMm: t4,
        species: vhsSpecies,
      });
      setVhsResult(res);
      toast.success(t("imaging.vhs.scoreToast", "VHS skóre: {score} v ({status})", { score: res.vhsScore, status: res.statusLabelSk }));
    } catch (err) {
      toast.error(t("imaging.vhs.calcError", "Chyba pri výpočte VHS"));
    }
  };

  const handleCreateQuiz = async () => {
    if (!currentAnalysis?.id) {
      toast.error(t("imaging.quiz.needAnalysis", "Najprv spustite alebo vyberte AI analýzu snímku"));
      return;
    }
    if (!quizCorrectAnswer.trim()) {
      toast.error(t("imaging.quiz.needCorrectAnswer", "Zadajte správnu odpoveď na kvíz"));
      return;
    }
    try {
      const res = await createQuizMutation.mutateAsync({
        analysisId: currentAnalysis.id,
        question: quizQuestion.trim() || undefined,
        correctAnswer: quizCorrectAnswer.trim(),
        wrongAnswers: [
          quizWrong1.trim() || t("imaging.quiz.optionB", "Možnosť B"),
          quizWrong2.trim() || t("imaging.quiz.optionC", "Možnosť C"),
        ],
        channel: quizChannel,
      });
      setQuizCreatedPost(res);
      toast.success(t("imaging.quiz.created", "Rádiologický kvíz bol zaradený do marketingového plánu!"));
    } catch (err) {
      toast.error(t("imaging.quiz.createFailed", "Nepodarilo sa vytvoriť príspevok."));
    }
  };

  const handleApplyPreset = (preset: ImagingPreset) => {
    setImageType(preset.imageType);
    setUserPrompt(preset.prompt);
    toast.info(t("imaging.toast.presetApplied", "Šablóna „{name}“ aplikovaná", { name: t(`imaging.presets.${preset.key}`, preset.name) }));
  };

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
      t("imaging.defaultClientName", "Klient");
    setSelectedPatient({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      clientName,
    });
    setPatientSearchOpen(false);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    clearFile();
  };

  // Current analysis from history or mutation result
  const currentAnalysis = analysisId
    ? historyQuery.data?.find((a) => a.id === analysisId)
    : null;

  const handleCopy = () => {
    if (!currentAnalysis?.result) return;
    navigator.clipboard.writeText(currentAnalysis.result);
    setCopied(true);
    toast.success(t("imaging.toast.copied", "Nález skopírovaný do schránky"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = useCallback(() => {
    if (!currentAnalysis?.result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error(t("imaging.toast.popupBlocked", "Vyskakovacie okno bolo zablokované"));
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Veterinárna Rádiologická Správa - ${selectedPatient?.name || "Pacient"}</title>
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
            .meta { font-size: 0.9em; color: #475569; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h2 style="margin: 0; color: #1e3a8a;">Veterinárna klinika — Diagnostická zobrazovacia správa</h2>
            <small style="color: #64748b;">AI asistovaná rádiologická a vizuálna diagnostika</small>
          </div>
          <div class="meta">
            <strong>Pacient:</strong> ${selectedPatient?.name || "Neuvedený"} (${selectedPatient?.species || "zviera"}) |
            <strong>Typ snímku:</strong> ${imageType.toUpperCase()} |
            <strong>Dátum vyšetrenia:</strong> ${new Date().toLocaleDateString("sk-SK")}
          </div>
          <div class="content" style="white-space: pre-wrap;">${currentAnalysis.result}</div>
          <hr />
          <p style="font-size: 0.8em; color: #64748b;">
            Upozornenie: Táto správa bola vygenerovaná veterinárnym multimodálnym AI modelom a slúži výhradne ako pomocný diagnostický nástroj ošetrujúceho veterinárneho lekára.
          </p>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [currentAnalysis, selectedPatient, imageType, t]);

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("imaging.title", "Analýza snímkov")}
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              {t("imaging.badge", "AI Röntgen & Diagnostika")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("imaging.subtitle", "AI asistovaná analýza röntgenov, CT, MRI, ultrazvuku a klinických fotografií.")}
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="editor" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              {t("imaging.tabs.editor", "Nová analýza")}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              {t("imaging.tabs.history", "História snímkov")}
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
              {t("imaging.history.title", "História vyšetrení snímkov")}
            </CardTitle>
            <CardDescription>
              {selectedPatient
                ? t("imaging.history.forPatient", "Zoznam predchádzajúcich analýz pre pacienta {name}.", { name: selectedPatient.name })
                : t("imaging.history.selectPatientHint", "Vyberte pacienta v editore pre zobrazenie jeho histórie snímkov.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{t("imaging.history.noPatient", "Nie je vybraný žiadny pacient")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("imaging.history.noPatientHint", "Vráťte sa do editora a vyberte pacienta, ktorého snímky si prajete zobraziť.")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("editor")}
                  className="mt-4 text-xs"
                >
                  {t("imaging.history.goToEditor", "Prejsť do editora")}
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
                  {t("imaging.history.empty", "Pre pacienta {name} zatiaľ neboli zaznamenané žiadne analýzy.", { name: selectedPatient.name })}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {historyQuery.data.map((item) => (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold uppercase">
                          {t("imaging.history.itemTitle", "{type} snímok", { type: item.imageType })}
                        </CardTitle>
                        <Badge
                          variant={
                            item.status === "COMPLETED"
                              ? "default"
                              : item.status === "FAILED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {item.status === "COMPLETED"
                            ? t("imaging.status.completed", "Vyhodnotené")
                            : item.status === "FAILED"
                              ? t("imaging.status.failed", "Zlyhalo")
                              : t("imaging.status.inProgress", "Prebieha")}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs mt-1">
                        {item.userPrompt || t("imaging.history.defaultPrompt", "Štandardná diagnostická analýza")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("sk-SK")}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setAnalysisId(item.id);
                          setActiveTab("editor");
                          toast.info(t("imaging.toast.loadedToPreview", "Analýza načítaná do náhľadu"));
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("imaging.history.loadResult", "Načítať nález")}
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
          {/* Left Column: Patient, Upload & Config */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Patient Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    {t("imaging.patient.selectTitle", "Vybrať pacienta pre vyšetrenie *")}
                  </span>
                  {selectedPatient && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPatient}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t("imaging.patient.clearSelection", "Zrušiť výber")}
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
                          {t("imaging.patient.searchPlaceholder", "Vyhľadať pacienta podľa mena...")}
                        </span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] sm:w-[420px] p-2" align="start">
                    <Input
                      placeholder={t("imaging.patient.searchInputPlaceholder", "Hľadať pacienta...")}
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
                          {t("imaging.patient.noneFound", "Žiadni pacienti sa nenašli")}
                        </p>
                      )}
                      {patientSearchQ.data?.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between transition-colors",
                            selectedPatient?.id === p.id && "bg-accent font-medium",
                          )}
                          onClick={() => handleSelectPatient(p)}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {p.species || t("imaging.patient.defaultSpecies", "zviera")} — {p.clientFirstName} {p.clientLastName}
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
                      <strong className="font-semibold block mb-0.5">{t("imaging.deceased.title", "Upozornenie na status pacienta")}</strong>
                      {t("imaging.deceased.desc", "Tento pacient je evidovaný ako uhynutý. Záznam vyšetrenia bude priradený do archivovanej karty.")}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clinical Presets (matching discharge layout) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("imaging.presets.label", "Rýchle diagnostické zamerania")}:
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESETS_IMAGING.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {t(`imaging.presets.${preset.key}`, preset.name)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Image Upload Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  {t("imaging.upload.title", "Nahratie snímku *")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("imaging.upload.formats", "Podporované formáty: JPG, PNG, WebP a medicínsky DICOM (.dcm) do 10 MB")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dicomFile ? (
                  <div className="space-y-3">
                    <DicomViewer
                      file={dicomFile}
                      onPreparedForAi={handleDicomPrepared}
                    />
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground truncate max-w-[60%]">
                        {dicomFile.name} ({t("imaging.upload.dicomFormat", "DICOM formát")})
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={clearFile}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        {t("imaging.upload.close", "Zatvoriť")}
                      </Button>
                    </div>
                  </div>
                ) : !previewUrl ? (
                  <div
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                      <ImageIconLucide className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium mb-1">{t("imaging.upload.clickToSelect", "Kliknite pre výber snímku")}</p>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      {t("imaging.upload.hint", "Röntgen (.dcm), CT, MRI, ultrazvuk alebo makroskopická fotka")}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {t("imaging.upload.chooseFile", "Vybrať súbor")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 dark:bg-white/5 flex items-center justify-center max-h-[320px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={t("imaging.upload.previewAlt", "Náhľad snímku")}
                        className="max-h-[320px] w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground truncate max-w-[60%]">
                        {selectedFile?.name}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-3 w-3" />
                          {t("imaging.upload.change", "Zmeniť")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={clearFile}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.dcm,.dicom,application/dicom"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {selectedPatient && previewUrl && !fileUrl && (
                  <Button
                    className="w-full gap-2 py-4 text-xs font-semibold shadow-xs"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("imaging.upload.uploading", "Nahrávam snímok na zabezpečené úložisko...")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {t("imaging.upload.uploadButton", "Nahrať snímok k pacientovi")}
                      </>
                    )}
                  </Button>
                )}

                {fileUrl && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{t("imaging.upload.ready", "Snímok je bezpečne pripravený na AI analýzu")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis Configuration Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {t("imaging.config.title", "Konfigurácia analýzy")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("imaging.config.imageType", "Typ zobrazovacieho vyšetrenia")}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {IMAGE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={cn(
                          "px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors text-center",
                          imageType === type.value
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                        onClick={() => setImageType(type.value as ImageType)}
                      >
                        {t(type.labelKey, type.label)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("imaging.config.promptLabel", "Klinické zameranie / Otázka pre AI (voliteľné)")}
                  </label>
                  <Textarea
                    placeholder={t("imaging.config.promptPlaceholder", "Napr.: Zameraj sa na pľúcne polia, podozrenie na edém alebo cudzie teleso v žalúdku...")}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Submit Action */}
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!fileId || !selectedPatient || analyzeMutation.isPending}
                  className="w-full gap-2 py-5 text-sm font-semibold shadow-sm"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("imaging.config.analyzing", "Spracúvam rádiologickú analýzu...")}
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4" />
                      {t("imaging.config.analyzeButton", "Spustiť AI analýzu snímku")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Analysis Results */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <Card className="flex flex-col h-full min-h-[550px] shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    {t("imaging.result.title", "Výsledok AI analýzy")}
                  </CardTitle>
                </div>

                {currentAnalysis?.result && (
                  <div className="flex items-center gap-1.5">
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
                      {t("imaging.result.copy", "Kopírovať")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t("imaging.result.print", "Tlačiť / PDF")}
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-6">
                {analyzeMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground text-center">
                    <div className="relative mb-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/10 blur-sm" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("imaging.result.processing", "Multimodálny model spracováva snímok...")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {t("imaging.result.processingHint", "Vyhodnocujem rádiologické štruktúry, hustotu tkanív a formulujem klinické posúdenie.")}
                    </p>
                  </div>
                ) : currentAnalysis?.status === "COMPLETED" && currentAnalysis.result ? (
                  <div className="flex flex-col h-full space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <Sparkles className="h-4 w-4" />
                        <span>{t("imaging.result.analysisFor", "Analýza pre")}: {selectedPatient?.name} ({imageType.toUpperCase()})</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {currentAnalysis.completedAt
                          ? new Date(currentAnalysis.completedAt).toLocaleString("sk-SK")
                          : ""}
                      </span>
                    </div>

                    <div className="flex-1 rounded-xl border border-border/80 bg-muted/20 p-5 overflow-y-auto">
                      <MarkdownView className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                        {currentAnalysis.result}
                      </MarkdownView>
                    </div>

                    {/* Advanced Diagnostic & Marketing Toolbars */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                      <Button
                        type="button"
                        variant={showVhsCalc ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setShowVhsCalc(!showVhsCalc)}
                      >
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        {t("imaging.vhs.button", "VHS kalkulačka srdca")}
                      </Button>

                      <Button
                        type="button"
                        variant={showMarketingQuiz ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setShowMarketingQuiz(!showMarketingQuiz)}
                      >
                        <Megaphone className="h-3.5 w-3.5 text-amber-500" />
                        {t("imaging.quiz.button", "Edukačný RTG kvíz (KVL SR)")}
                      </Button>
                    </div>

                    {/* VHS Calculator Panel */}
                    {showVhsCalc && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                            <Heart className="h-4 w-4 text-rose-500" />
                            <span>{t("imaging.vhs.title", "Vertebral Heart Score (VHS) – Buchananova metóda")}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {vhsSpecies === "feline"
                              ? t("imaging.vhs.normFeline", "Mačka: norma < 8.0 v")
                              : t("imaging.vhs.normCanine", "Pes: norma 8.5–10.5 v")}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.vhs.longAxis", "Dlhá os L (mm)")}
                            </label>
                            <Input
                              value={vhsLongAxisMm}
                              onChange={(e) => setVhsLongAxisMm(e.target.value)}
                              placeholder="75"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.vhs.shortAxis", "Krátka os S (mm)")}
                            </label>
                            <Input
                              value={vhsShortAxisMm}
                              onChange={(e) => setVhsShortAxisMm(e.target.value)}
                              placeholder="65"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.vhs.t4", "Stavec T4 (mm)")}
                            </label>
                            <Input
                              value={vhsT4Mm}
                              onChange={(e) => setVhsT4Mm(e.target.value)}
                              placeholder="15"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.vhs.species", "Druh pacienta")}
                            </label>
                            <select
                              value={vhsSpecies}
                              onChange={(e) => setVhsSpecies(e.target.value as any)}
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="canine">{t("imaging.vhs.speciesCanine", "Pes (canine)")}</option>
                              <option value="feline">{t("imaging.vhs.speciesFeline", "Mačka (feline)")}</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCalculateVhs}
                            className="h-8 text-xs gap-1 bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            <Activity className="h-3.5 w-3.5" />
                            {t("imaging.vhs.calculate", "Vypočítať VHS")}
                          </Button>

                          {vhsResult && (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  vhsResult.status === "normal"
                                    ? "secondary"
                                    : vhsResult.status === "borderline"
                                      ? "outline"
                                      : "destructive"
                                }
                                className="text-xs font-bold font-mono px-2 py-0.5"
                              >
                                VHS: {vhsResult.vhsScore} v
                              </Badge>
                              <Badge
                                className={
                                  vhsResult.status === "normal"
                                    ? "bg-emerald-600 text-white text-[11px]"
                                    : vhsResult.status === "borderline"
                                      ? "bg-amber-600 text-white text-[11px]"
                                      : "bg-rose-600 text-white text-[11px]"
                                }
                              >
                                {vhsResult.statusLabelSk}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {vhsResult && (
                          <div className="rounded-lg bg-background p-3 text-xs text-foreground border space-y-1">
                            <p className="font-semibold text-primary">{t("imaging.vhs.interpretation", "Klinické posúdenie nálezu")}:</p>
                            <p className="text-muted-foreground leading-relaxed">
                              {vhsResult.clinicalInterpretationSk}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Social Media Quiz Panel */}
                    {showMarketingQuiz && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                            <Megaphone className="h-4 w-4 text-amber-500" />
                            <span>{t("imaging.quiz.title", "Kvíz týždňa zo snímky pre sociálne siete (KVL SR)")}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {t("imaging.quiz.anonymizedBadge", "Anonymizovaný edukačný príspevok")}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            {t("imaging.quiz.questionLabel", "Otázka kvízu pre verejnosť")}
                          </label>
                          <Input
                            value={quizQuestion}
                            onChange={(e) => setQuizQuestion(e.target.value)}
                            placeholder={t("imaging.quiz.questionPlaceholder", "Čo odhalila táto rádiologická snímka?")}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 font-semibold">
                              {t("imaging.quiz.correctAnswer", "Správna odpoveď (A)")}
                            </label>
                            <Input
                              value={quizCorrectAnswer}
                              onChange={(e) => setQuizCorrectAnswer(e.target.value)}
                              placeholder={t("imaging.quiz.correctPlaceholder", "napr. Cudzie teleso v žalúdku")}
                              className="h-8 text-xs border-emerald-500/50"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.quiz.wrongB", "Nesprávna možnosť (B)")}
                            </label>
                            <Input
                              value={quizWrong1}
                              onChange={(e) => setQuizWrong1(e.target.value)}
                              placeholder={t("imaging.quiz.wrongBPlaceholder", "napr. Fyziologický nález")}
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {t("imaging.quiz.wrongC", "Nesprávna možnosť (C)")}
                            </label>
                            <Input
                              value={quizWrong2}
                              onChange={(e) => setQuizWrong2(e.target.value)}
                              placeholder={t("imaging.quiz.wrongCPlaceholder", "napr. Torzia žalúdka")}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{t("imaging.quiz.channel", "Kanál")}:</span>
                            {(["instagram", "facebook", "google_business"] as const).map((ch) => (
                              <Button
                                key={ch}
                                type="button"
                                variant={quizChannel === ch ? "default" : "outline"}
                                size="sm"
                                className="h-7 text-xs capitalize"
                                onClick={() => setQuizChannel(ch)}
                              >
                                {ch === "google_business" ? t("imaging.quiz.channelGoogle", "Google Profil") : ch}
                              </Button>
                            ))}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateQuiz}
                            disabled={createQuizMutation.isPending || !quizCorrectAnswer.trim()}
                            className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            {createQuizMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {t("imaging.quiz.createButton", "Vytvoriť kvíz do plánu obsahu")}
                          </Button>
                        </div>

                        {quizCreatedPost && (
                          <div className="rounded-lg bg-background p-3 text-xs border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                {quizCreatedPost.item.title}
                              </span>
                              <Badge
                                variant={
                                  quizCreatedPost.validationReport?.verdict === "pass"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  quizCreatedPost.validationReport?.verdict === "pass"
                                    ? "bg-emerald-600 text-white text-[10px]"
                                    : "bg-amber-600 text-white text-[10px]"
                                }
                              >
                                KVL SR: {quizCreatedPost.validationReport?.verdict?.toUpperCase() ?? "PASS"}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {quizCreatedPost.item.body}
                            </p>
                            <div className="flex items-center justify-end pt-1">
                              <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
                                <Link href="/marketing/plan">
                                  {t("imaging.quiz.viewInPlan", "Zobraziť v pláne obsahu")}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t">
                      * {t("imaging.result.disclaimer", "Upozornenie: AI analýza zobrazovacích metód má výhradne podporný a odporúčací charakter. Konečné stanovenie diagnózy patrí vždy ošetrujúcemu veterinárnemu lekárovi.")}
                    </p>
                  </div>
                ) : currentAnalysis?.status === "FAILED" ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 text-destructive text-center">
                    <AlertTriangle className="h-10 w-10 mb-3" />
                    <p className="text-sm font-semibold">{t("imaging.result.failed", "Analýza snímku zlyhala")}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {currentAnalysis.errorMessage || t("imaging.result.failedDefault", "Došlo k neočakávanej chybe pri spracovaní snímku.")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground text-center">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-foreground">
                      {t("imaging.result.empty", "Zatiaľ nebol vyhodnotený žiadny snímok")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      {t("imaging.result.emptyHint", "Vyberte pacienta, nahrajte snímok v ľavom paneli a kliknite na tlačidlo spustenia analýzy.")}
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