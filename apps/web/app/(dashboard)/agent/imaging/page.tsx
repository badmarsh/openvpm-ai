"use client";

import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

export default function ImagingPage() {
  const utils = trpc.useUtils();

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
    clientName: string;
  } | null>(null);

  const patientSearchQ = trpc.patients.search.useQuery(
    { query: patientSearch },
    { enabled: patientSearch.length >= 2 },
  );

  // Analysis config
  const [imageType, setImageType] = useState<ImageType>("xray");
  const [userPrompt, setUserPrompt] = useState("");

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

      // fileId je posledný segment key (uuid)
      const id = json.key?.split("/").pop() ?? null;
      setFileUrl(json.url ?? null);
      setFileId(id);
      toast.success("Snímok nahraný");
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
      toast.success("Analýza dokončená");
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

  // Current analysis from history or mutation result
  const currentAnalysis = analysisId
    ? historyQuery.data?.find((a) => a.id === analysisId)
    : null;

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analýza Snímkov</h1>
          <p className="text-sm text-muted-foreground">
            AI asistovaná analýza röntgenov, CT, MRI, ultrazvuku a klinických fotiek
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Bot className="h-3 w-3" />
          AI-powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — upload + config */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Patient selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pacient</CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedPatient
                      ? `${selectedPatient.name} (${selectedPatient.clientName})`
                      : "Vyhľadať pacienta..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-2" align="start">
                  <Input
                    placeholder="Hľadať pacienta..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="mb-2"
                    autoFocus
                  />
                  <div className="max-h-[240px] overflow-y-auto">
                    {patientSearchQ.isLoading && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {patientSearchQ.data?.length === 0 && patientSearch.length >= 2 && (
                      <p className="text-center py-4 text-sm text-muted-foreground">
                        Žiadni pacienti
                      </p>
                    )}
                    {patientSearchQ.data?.map((p) => (
                      <button
                        key={p.id}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between",
                          selectedPatient?.id === p.id && "bg-accent",
                        )}
                        onClick={() => {
                          setSelectedPatient({
                            id: p.id,
                            name: p.name,
                            species: p.species,
                            clientName: `${p.clientFirstName} ${p.clientLastName}`,
                          });
                          setPatientSearchOpen(false);
                        }}
                      >
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {p.species} — {p.clientFirstName} {p.clientLastName}
                          </span>
                        </div>
                        {selectedPatient?.id === p.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Image upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Snímok</CardTitle>
              <CardDescription>
                Nahrajte röntgen, CT, MRI, ultrazvuk alebo klinickú fotku
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <div
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <ImageIconLucide className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium mb-1">Vyberte súbor</p>
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    JPG, PNG alebo WebP, max 10 MB
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Vybrať súbor
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative rounded-lg overflow-hidden border border-border bg-black/5 dark:bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-[400px] w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-muted-foreground truncate max-w-[60%]">
                      {selectedFile?.name}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Zmeniť
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFile}
                      >
                        <X className="h-3 w-3" />
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

              {selectedPatient && previewUrl && (
                <Button
                  className="w-full mt-4"
                  onClick={handleUpload}
                  disabled={uploading || !!fileUrl}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : fileUrl ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {fileUrl ? "Snímok nahraný" : uploading ? "Nahrávam..." : "Nahrať snímok"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Analysis config */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Konfigurácia analýzy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1.5">Typ snímku</p>
                <div className="grid grid-cols-5 gap-2">
                  {IMAGE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={cn(
                        "px-2 py-2 rounded-lg border text-xs font-medium transition-colors",
                        imageType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => setImageType(t.value as ImageType)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">Otázka pre AI (voliteľné)</p>
                <Textarea
                  placeholder="Napr.: Zameraj sa na pľúca a srdce..."
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAnalyze}
                disabled={!fileId || !selectedPatient || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Scan className="h-4 w-4 mr-2" />
                )}
                {analyzeMutation.isPending ? "Analyzujem..." : "Spustiť AI analýzu"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column — results */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Current analysis result */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Výsledok analýzy</CardTitle>
            </CardHeader>
            <CardContent>
              {analyzeMutation.isPending && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="text-sm">AI analyzuje snímok...</p>
                </div>
              )}

              {currentAnalysis?.status === "COMPLETED" && currentAnalysis.result && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {currentAnalysis.result}
                  </div>
                  {currentAnalysis.completedAt && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Analyzované {new Date(currentAnalysis.completedAt).toLocaleString("sk-SK")}
                    </p>
                  )}
                </div>
              )}

              {currentAnalysis?.status === "FAILED" && (
                <div className="flex flex-col items-center justify-center py-12 text-destructive">
                  <AlertTriangle className="h-8 w-8 mb-3" />
                  <p className="text-sm font-medium">Analýza zlyhala</p>
                  {currentAnalysis.errorMessage && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      {currentAnalysis.errorMessage}
                    </p>
                  )}
                </div>
              )}

              {!currentAnalysis && !analyzeMutation.isPending && !historyQuery.data?.length && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bot className="h-8 w-8 mb-3" />
                  <p className="text-sm">
                    Vyberte pacienta, nahrajte snímok a spustite analýzu
                  </p>
                </div>
              )}

              {!currentAnalysis && !analyzeMutation.isPending && historyQuery.data && historyQuery.data.length > 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Vyberte analýzu z histórie alebo spustite novú
                </p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">História</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPatient && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Vyberte pacienta pre zobrazenie histórie
                </p>
              )}
              {selectedPatient && historyQuery.isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {historyQuery.data?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Žiadne predchádzajúce analýzy
                </p>
              )}
              <div className="max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  {historyQuery.data?.map((a) => (
                    <button
                      key={a.id}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm",
                        analysisId === a.id && "border-primary bg-accent",
                      )}
                      onClick={() => setAnalysisId(a.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          variant={
                            a.status === "COMPLETED"
                              ? "default"
                              : a.status === "FAILED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {a.status === "COMPLETED"
                            ? "Dokončené"
                            : a.status === "FAILED"
                              ? "Zlyhalo"
                              : "Spracúva sa"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString("sk-SK")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {a.imageType} {a.userPrompt ? `— ${a.userPrompt}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}