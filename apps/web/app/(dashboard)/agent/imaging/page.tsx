"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const IMAGE_TYPES = [
  { value: "xray", label: "Röntgen" },
  { value: "ct", label: "CT" },
  { value: "mri", label: "MRI" },
  { value: "ultrasound", label: "Ultrazvuk" },
  { value: "photo", label: "Klinická fotka" },
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

  // History
  const historyQuery = trpc.extensions.imaging.listByPatient.useQuery(
    { patientId: selectedPatient?.id ?? "" },
    { enabled: !!selectedPatient },
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageUploadFileValid(file)) {
      toast.error(IMAGE_UPLOAD_POLICY_MESSAGE);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFileUrl(null);
    setFileId(null);
    setAnalysisId(null);
    uploadAttemptRef.current = selectManagedUploadFile(
      uploadAttemptRef.current,
      file,
    );
  }, []);

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
      toast.success("Snímok úspešne nahraný");
    } catch (err) {
      if (uploadAttemptRef.current) {
        uploadAttemptRef.current = settleManagedUploadAttempt(uploadAttemptRef.current, {
          kind: "ambiguous",
        });
      }
      const message = err instanceof Error ? err.message : "Nahrávanie zlyhalo";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedPatient]);

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
      toast.success("AI analýza snímku dokončená");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analýza zlyhala";
      toast.error(message);
    }
  }, [fileId, selectedPatient, imageType, userPrompt, analyzeMutation]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileUrl(null);
    setFileId(null);
    setAnalysisId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleApplyPreset = (preset: ImagingPreset) => {
    setImageType(preset.imageType);
    setUserPrompt(preset.prompt);
    toast.info(`Šablóna „${preset.name}“ aplikovaná`);
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
      "Klient";
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
    toast.success("Nález skopírovaný do schránky");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = useCallback(() => {
    if (!currentAnalysis?.result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Vyskakovacie okno bolo zablokované");
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
  }, [currentAnalysis, selectedPatient, imageType]);

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Analýza Snímkov
            </h1>
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" />
              AI Röntgen & Diagnostika
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            AI asistovaná analýza röntgenov, CT, MRI, ultrazvuku a klinických fotografií.
          </p>
        </div>

        {/* Mode / Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-[280px]">
            <TabsTrigger value="editor" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              Nová analýza
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              História snímkov
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
              História vyšetrení snímkov
            </CardTitle>
            <CardDescription>
              {selectedPatient
                ? `Zoznam predchádzajúcich analýz pre pacienta ${selectedPatient.name}.`
                : "Vyberte pacienta v editore pre zobrazenie jeho histórie snímkov."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nie je vybraný žiadny pacient</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vráťte sa do editora a vyberte pacienta, ktorého snímky si prajete zobraziť.
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
                <p className="text-sm">Pre pacienta {selectedPatient.name} zatiaľ neboli zaznamenané žiadne analýzy.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {historyQuery.data.map((item) => (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold uppercase">
                          {item.imageType} Snímok
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
                            ? "Vyhodnotené"
                            : item.status === "FAILED"
                              ? "Zlyhalo"
                              : "Prebieha"}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs mt-1">
                        {item.userPrompt || "Štandardná diagnostická analýza"}
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
                          toast.info("Analýza načítaná do náhľadu");
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Načítať nález
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
                    Vybrať pacienta pre vyšetrenie *
                  </span>
                  {selectedPatient && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPatient}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Zrušiť výber
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
                          Vyhľadať pacienta podľa mena...
                        </span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] sm:w-[420px] p-2" align="start">
                    <Input
                      placeholder="Hľadať pacienta..."
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
                          Žiadni pacienti sa nenašli
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
                      <strong className="font-semibold block mb-0.5">Upozornenie na status pacienta</strong>
                      Tento pacient je evidovaný ako uhynutý. Záznam vyšetrenia bude priradený do archivovanej karty.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clinical Presets (matching discharge layout) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Rýchle diagnostické zamerania:
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
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Image Upload Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Nahratie snímku *
                </CardTitle>
                <CardDescription className="text-xs">
                  Podporované formáty: JPG, PNG, WebP do 10 MB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!previewUrl ? (
                  <div
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                      <ImageIconLucide className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium mb-1">Kliknite pre výber snímku</p>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Röntgen, CT, MRI, ultrazvuk alebo makroskopická fotka
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
                      Vybrať súbor
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 dark:bg-white/5 flex items-center justify-center max-h-[320px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Náhľad snímku"
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
                          Zmeniť
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
                  accept="image/jpeg,image/png,image/webp"
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
                        Nahrávam snímok na zabezpečené úložisko...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Nahrať snímok k pacientovi
                      </>
                    )}
                  </Button>
                )}

                {fileUrl && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Snímok je bezpečne pripravený na AI analýzu</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis Configuration Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Konfigurácia analýzy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Typ zobrazovacieho vyšetrenia
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {IMAGE_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={cn(
                          "px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors text-center",
                          imageType === t.value
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                        onClick={() => setImageType(t.value as ImageType)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Klinické zameranie / Otázka pre AI (voliteľné)
                  </label>
                  <Textarea
                    placeholder="Napr.: Zameraj sa na pľúcne polia, podozrenie na edém alebo cudzie teleso v žalúdku..."
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
                      Spracúvam rádiologickú analýzu...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4" />
                      Spustiť AI analýzu snímku
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
                    Výsledok AI analýzy
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
                      Kopírovať
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Tlačiť / PDF
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
                      Multimodálny model spracováva snímok...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Vyhodnocujem rádiologické štruktúry, hustotu tkanív a formulujem klinické posúdenie.
                    </p>
                  </div>
                ) : currentAnalysis?.status === "COMPLETED" && currentAnalysis.result ? (
                  <div className="flex flex-col h-full space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <Sparkles className="h-4 w-4" />
                        <span>Analýza pre: {selectedPatient?.name} ({imageType.toUpperCase()})</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {currentAnalysis.completedAt
                          ? new Date(currentAnalysis.completedAt).toLocaleString("sk-SK")
                          : ""}
                      </span>
                    </div>

                    <div className="flex-1 rounded-xl border border-border/80 bg-muted/20 p-5 overflow-y-auto">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentAnalysis.result}
                        </ReactMarkdown>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t">
                      * Upozornenie: AI analýza zobrazovacích metód má výhradne podporný a odporúčací charakter. Konečné stanovenie diagnózy patrí vždy ošetrujúcemu veterinárnemu lekárovi.
                    </p>
                  </div>
                ) : currentAnalysis?.status === "FAILED" ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 text-destructive text-center">
                    <AlertTriangle className="h-10 w-10 mb-3" />
                    <p className="text-sm font-semibold">Analýza snímku zlyhala</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {currentAnalysis.errorMessage || "Došlo k neočakávanej chybe pri spracovaní snímku."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground text-center">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-foreground">
                      Zatiaľ nebol vyhodnotený žiadny snímok
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Vyberte pacienta, nahrajte snímok v ľavom paneli a kliknite na tlačidlo spustenia analýzy.
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