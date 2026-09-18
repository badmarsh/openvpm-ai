"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Bot,
  Activity,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Video,
  Image as ImageIcon,
  FileText,
  Mic,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Search,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import type { CachedAiModel, FeatureAiMapping, PracticeAiFeatureMappings } from "@openpims/db";
import {
  DEFAULT_ALIBABA_PRESETS,
  DEFAULT_GEMINI_PRESETS,
  DEFAULT_PRACTICE_FEATURE_MAPPINGS,
} from "@/lib/ai/ai-presets";

export function AiSettingsTab() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data: settings, isLoading, error } = trpc.extensions.aiSettings.getSettings.useQuery();
  const { data: aliHealth, isFetching: checkingAliHealth, refetch: refetchAliHealth } =
    trpc.extensions.aiSettings.checkAliProxyHealth.useQuery(undefined, {
      refetchInterval: 30_000,
    });

  const updateMutation = trpc.extensions.aiSettings.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.extensions.aiSettings.getSettings.invalidate();
      toast.success(t("settings.ai.saveSuccess", "Nastavenia AI boli úspešne uložené."));
    },
    onError: (err) => {
      toast.error(err.message || t("settings.ai.saveError", "Nepodarilo sa uložiť nastavenia AI."));
    },
  });

  const testMutation = trpc.extensions.aiSettings.testConnection.useMutation();
  const fetchModelsMutation = trpc.extensions.aiSettings.fetchModels.useMutation();

  // Form states
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("http://127.0.0.1:8080/v1");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiIsActive, setOpenaiIsActive] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [geminiBaseUrl, setGeminiBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai/");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiIsActive, setGeminiIsActive] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [alibabaMode, setAlibabaMode] = useState("aliproxy_local");
  const [alibabaBaseUrl, setAlibabaBaseUrl] = useState("http://127.0.0.1:8080/v1");
  const [alibabaApiKey, setAlibabaApiKey] = useState("");
  const [alibabaIsActive, setAlibabaIsActive] = useState(false);
  const [showAlibabaKey, setShowAlibabaKey] = useState(false);

  // Cached models lists (from server or fresh fetch, with well-known presets as defaults)
  const [openaiModels, setOpenaiModels] = useState<CachedAiModel[]>([]);
  const [geminiModels, setGeminiModels] = useState<CachedAiModel[]>(DEFAULT_GEMINI_PRESETS);
  const [alibabaModels, setAlibabaModels] = useState<CachedAiModel[]>(DEFAULT_ALIBABA_PRESETS);

  // Feature mappings initialized with requested veterinary & operational defaults
  const [featureMappings, setFeatureMappings] = useState<PracticeAiFeatureMappings>(
    DEFAULT_PRACTICE_FEATURE_MAPPINGS,
  );

  // Action states
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [fetchingProvider, setFetchingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; ok: boolean; message: string } | null>(null);

  // Initialize from query data
  useEffect(() => {
    if (settings) {
      setOpenaiBaseUrl(settings.openai.baseUrl);
      setOpenaiApiKey(settings.openai.maskedKey || "");
      setOpenaiIsActive(settings.openai.isActive);
      setOpenaiModels(settings.openai.cachedModels || []);

      setGeminiBaseUrl(settings.gemini.baseUrl);
      setGeminiApiKey(settings.gemini.maskedKey || "");
      setGeminiIsActive(settings.gemini.isActive);
      setGeminiModels(
        settings.gemini.cachedModels && settings.gemini.cachedModels.length > 0
          ? settings.gemini.cachedModels
          : DEFAULT_GEMINI_PRESETS,
      );

      setAlibabaMode(settings.alibaba.mode);
      setAlibabaBaseUrl(settings.alibaba.baseUrl);
      setAlibabaApiKey(settings.alibaba.maskedKey || "");
      setAlibabaIsActive(settings.alibaba.isActive);
      setAlibabaModels(
        settings.alibaba.cachedModels && settings.alibaba.cachedModels.length > 0
          ? settings.alibaba.cachedModels
          : DEFAULT_ALIBABA_PRESETS,
      );

      if (settings.featureMappings && Object.keys(settings.featureMappings).length > 0) {
        setFeatureMappings({ ...DEFAULT_PRACTICE_FEATURE_MAPPINGS, ...settings.featureMappings });
      } else {
        setFeatureMappings(DEFAULT_PRACTICE_FEATURE_MAPPINGS);
      }
    }
  }, [settings]);

  const handleTestConnection = async (provider: "openai" | "gemini" | "alibaba") => {
    setTestingProvider(provider);
    setTestResult(null);

    let baseUrl = "";
    let apiKey = "";

    if (provider === "openai") {
      baseUrl = openaiBaseUrl;
      apiKey = openaiApiKey;
    } else if (provider === "gemini") {
      baseUrl = geminiBaseUrl;
      apiKey = geminiApiKey;
    } else if (provider === "alibaba") {
      baseUrl = alibabaBaseUrl;
      apiKey = alibabaApiKey;
    }

    try {
      const res = await testMutation.mutateAsync({ provider, baseUrl, apiKey });
      setTestResult({ provider, ok: res.ok, message: res.message });
      if (res.ok) {
        if (provider === "openai" && !openaiIsActive) setOpenaiIsActive(true);
        if (provider === "gemini" && !geminiIsActive) setGeminiIsActive(true);
        if (provider === "alibaba" && !alibabaIsActive) setAlibabaIsActive(true);
        toast.success(t("settings.ai.testSuccess", `Spojenie úspešné: ${res.message}`, { message: res.message }));
      } else {
        toast.error(t("settings.ai.testError", `Spojenie zlyhalo: ${res.message}`, { message: res.message }));
      }
    } catch (err: any) {
      const msg = err?.message || "Chyba pripojenia";
      setTestResult({ provider, ok: false, message: msg });
      toast.error(t("settings.ai.testError", `Spojenie zlyhalo: ${msg}`, { message: msg }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleFetchModels = async (provider: "openai" | "gemini" | "alibaba") => {
    setFetchingProvider(provider);
    let baseUrl = "";
    let apiKey = "";

    if (provider === "openai") {
      baseUrl = openaiBaseUrl;
      apiKey = openaiApiKey;
    } else if (provider === "gemini") {
      baseUrl = geminiBaseUrl;
      apiKey = geminiApiKey;
    } else if (provider === "alibaba") {
      baseUrl = alibabaBaseUrl;
      apiKey = alibabaApiKey;
    }

    try {
      const res = await fetchModelsMutation.mutateAsync({ provider, baseUrl, apiKey });
      if (provider === "openai") {
        setOpenaiModels(res.models);
        if (!openaiIsActive) setOpenaiIsActive(true);
      }
      if (provider === "gemini") {
        setGeminiModels(res.models);
        if (!geminiIsActive) setGeminiIsActive(true);
      }
      if (provider === "alibaba") {
        setAlibabaModels(res.models);
        if (!alibabaIsActive) setAlibabaIsActive(true);
      }

      toast.success(
        t("settings.ai.fetchSuccess", `Úspešne načítaných ${res.count} modelov.`, { count: res.count }),
      );
    } catch (err: any) {
      toast.error(t("settings.ai.fetchError", "Nepodarilo sa načítať modely z endpointu."));
    } finally {
      setFetchingProvider(null);
    }
  };

  const handleApplyAlibabaPreset = (preset: "local" | "intl" | "cn") => {
    if (preset === "local") {
      setAlibabaMode("aliproxy_local");
      setAlibabaBaseUrl("http://127.0.0.1:8080/v1");
    } else if (preset === "intl") {
      setAlibabaMode("dashscope_intl");
      setAlibabaBaseUrl("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
    } else if (preset === "cn") {
      setAlibabaMode("dashscope_cn");
      setAlibabaBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1");
    }
  };

  const handleSaveAll = async () => {
    await updateMutation.mutateAsync({
      openai: {
        baseUrl: openaiBaseUrl,
        apiKey: openaiApiKey,
        isActive: openaiIsActive,
      },
      gemini: {
        baseUrl: geminiBaseUrl,
        apiKey: geminiApiKey,
        isActive: geminiIsActive,
      },
      alibaba: {
        mode: alibabaMode,
        baseUrl: alibabaBaseUrl,
        apiKey: alibabaApiKey,
        isActive: alibabaIsActive,
      },
      featureMappings: featureMappings as any,
    });
  };

  const updateFeature = (
    key: string,
    field: keyof FeatureAiMapping,
    value: string | number,
  ) => {
    setFeatureMappings((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || DEFAULT_PRACTICE_FEATURE_MAPPINGS[key as keyof PracticeAiFeatureMappings] || { provider: "gemini", model: "gemini-3.8-flash" }),
        [field]: value,
      },
    }));
  };

  const isAnyActive = openaiIsActive || geminiIsActive || alibabaIsActive;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        {t("settings.checkingAccess", "Checking settings access...")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("settings.common.loadError", "Nepodarilo sa načítať nastavenia")}</p>
            <p className="mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Status */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("settings.ai.title", "Nastavenia AI")}
            </h2>
            <Badge variant={isAnyActive ? "default" : "secondary"}>
              {isAnyActive
                ? t("settings.ai.operational", "Nakonfigurované a aktívne")
                : t("settings.ai.needsConfig", "Vyžaduje konfiguráciu")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "settings.ai.subtitle",
              "Konfigurácia AI poskytovateľov, vlastných endpointov, načítavanie modelov a mapovanie AI funkcií kliniky.",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAll}
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {updateMutation.isPending
              ? t("settings.ai.actions.saving", "Ukladám nastavenia...")
              : t("settings.ai.actions.save", "Uložiť nastavenia AI")}
          </Button>
        </div>
      </div>

      {/* 2. Provider Connections Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: OpenAI Compatible */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t("settings.ai.providers.openaiTitle", "OpenAI Kompatibilný Gateway")}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {openaiIsActive ? (
                  <Badge variant="default" className="bg-emerald-600 text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.activeBadge", "Aktívny")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.inactiveBadge", "Neaktívny")}
                  </Badge>
                )}
                <Switch
                  checked={openaiIsActive}
                  onCheckedChange={setOpenaiIsActive}
                  aria-label={t("settings.ai.providers.activeLabel", "Povoliť tohto poskytovateľa")}
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              {t(
                "settings.ai.providers.openaiDesc",
                "Pripojenie k lokálnym LLM gatewayom (Ollama, vLLM, LM Studio) alebo cloudovým OpenAI proxy.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div>
              <Label className="text-xs">{t("settings.ai.providers.baseUrl", "Základná URL (Base URL)")}</Label>
              <Input
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080/v1"
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("settings.ai.providers.apiKey", "API kľúč")}</Label>
                {settings?.openai.hasKey && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {t("settings.ai.providers.apiKeyConfigured", "Kľúč je nastavený")}
                  </Badge>
                )}
              </div>
              <div className="relative mt-1">
                <Input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder={t("settings.ai.providers.apiKeyPlaceholder", "Zadajte API kľúč...")}
                  className="font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={testingProvider === "openai"}
                onClick={() => handleTestConnection("openai")}
              >
                {testingProvider === "openai" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.testBtn", "Otestovať spojenie")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={fetchingProvider === "openai"}
                onClick={() => handleFetchModels("openai")}
              >
                {fetchingProvider === "openai" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.fetchBtn", "Načítať modely")}
              </Button>
            </div>

            <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              {openaiModels.length > 0
                ? t("settings.ai.providers.modelsLoaded", `Načítaných ${openaiModels.length} modelov`, {
                    count: openaiModels.length,
                  })
                : t("settings.ai.providers.noModelsYet", "Zatiaľ nie sú načítané modely.")}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Google Gemini */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">
                  {t("settings.ai.providers.geminiTitle", "Google Gemini")}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {geminiIsActive ? (
                  <Badge variant="default" className="bg-emerald-600 text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.activeBadge", "Aktívny")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.inactiveBadge", "Neaktívny")}
                  </Badge>
                )}
                <Switch
                  checked={geminiIsActive}
                  onCheckedChange={setGeminiIsActive}
                  aria-label={t("settings.ai.providers.activeLabel", "Povoliť tohto poskytovateľa")}
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              {t(
                "settings.ai.providers.geminiDesc",
                "Multimodálne modely Google Gemini prostredníctvom API kľúča z Google AI Studio.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div>
              <Label className="text-xs">{t("settings.ai.providers.baseUrl", "Základná URL (Base URL)")}</Label>
              <Input
                value={geminiBaseUrl}
                onChange={(e) => setGeminiBaseUrl(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("settings.ai.providers.apiKey", "API kľúč")}</Label>
                {settings?.gemini.hasKey && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {t("settings.ai.providers.apiKeyConfigured", "Kľúč je nastavený")}
                  </Badge>
                )}
              </div>
              <div className="relative mt-1">
                <Input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={testingProvider === "gemini"}
                onClick={() => handleTestConnection("gemini")}
              >
                {testingProvider === "gemini" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.testBtn", "Otestovať spojenie")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={fetchingProvider === "gemini"}
                onClick={() => handleFetchModels("gemini")}
              >
                {fetchingProvider === "gemini" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.fetchBtn", "Načítať modely")}
              </Button>
            </div>

            <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              {geminiModels.length > 0
                ? t("settings.ai.providers.modelsLoaded", `Načítaných ${geminiModels.length} modelov`, {
                    count: geminiModels.length,
                  })
                : t("settings.ai.providers.noModelsYet", "Zatiaľ nie sú načítané modely.")}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Alibaba Cloud & AliProxy */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-500" />
                <CardTitle className="text-base">
                  {t("settings.ai.providers.alibabaTitle", "Alibaba Cloud & AliProxy")}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {alibabaIsActive ? (
                  <Badge variant="default" className="bg-emerald-600 text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.activeBadge", "Aktívny")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground text-[10px] py-0 px-1.5 h-5">
                    {t("settings.ai.providers.inactiveBadge", "Neaktívny")}
                  </Badge>
                )}
                <Switch
                  checked={alibabaIsActive}
                  onCheckedChange={setAlibabaIsActive}
                  aria-label={t("settings.ai.providers.activeLabel", "Povoliť tohto poskytovateľa")}
                />
              </div>
            </div>
            <CardDescription className="text-xs">
              {t(
                "settings.ai.providers.alibabaDesc",
                "DashScope Cloud alebo lokálna brána AliProxy (Qwen LLM, generovanie obrázkov Wanx a videa WAN).",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Presets */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">
                  {t("settings.ai.providers.presets", "Rýchle predvoľby")}
                </Label>
                {aliHealth && (
                  <div className="flex items-center gap-1 text-[10px]">
                    {aliHealth.online ? (
                      <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                        <Wifi className="mr-0.5 h-3 w-3" />
                        {t("settings.ai.providers.aliProxyOnline", "AliProxy beží na 8080")}
                      </span>
                    ) : (
                      <span className="flex items-center text-muted-foreground">
                        <WifiOff className="mr-0.5 h-3 w-3" />
                        {t("settings.ai.providers.aliProxyOffline", "AliProxy nebol detegovaný")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant={alibabaMode === "aliproxy_local" ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => handleApplyAlibabaPreset("local")}
                >
                  {t("settings.ai.providers.presetLocal", "Lokálny AliProxy")}
                </Button>
                <Button
                  type="button"
                  variant={alibabaMode === "dashscope_intl" ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => handleApplyAlibabaPreset("intl")}
                >
                  {t("settings.ai.providers.presetIntl", "DashScope Intl")}
                </Button>
                <Button
                  type="button"
                  variant={alibabaMode === "dashscope_cn" ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => handleApplyAlibabaPreset("cn")}
                >
                  {t("settings.ai.providers.presetCn", "DashScope CN")}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">{t("settings.ai.providers.baseUrl", "Základná URL (Base URL)")}</Label>
              <Input
                value={alibabaBaseUrl}
                onChange={(e) => setAlibabaBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080/v1"
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("settings.ai.providers.apiKey", "API kľúč")}</Label>
                {settings?.alibaba.hasKey && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {t("settings.ai.providers.apiKeyConfigured", "Kľúč je nastavený")}
                  </Badge>
                )}
              </div>
              <div className="relative mt-1">
                <Input
                  type={showAlibabaKey ? "text" : "password"}
                  value={alibabaApiKey}
                  onChange={(e) => setAlibabaApiKey(e.target.value)}
                  placeholder="sk-aliproxy-..."
                  className="font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowAlibabaKey(!showAlibabaKey)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showAlibabaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={testingProvider === "alibaba"}
                onClick={() => handleTestConnection("alibaba")}
              >
                {testingProvider === "alibaba" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.testBtn", "Otestovať spojenie")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={fetchingProvider === "alibaba"}
                onClick={() => handleFetchModels("alibaba")}
              >
                {fetchingProvider === "alibaba" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("settings.ai.providers.fetchBtn", "Načítať modely")}
              </Button>
            </div>

            <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              {alibabaModels.length > 0
                ? t("settings.ai.providers.modelsLoaded", `Načítaných ${alibabaModels.length} modelov`, {
                    count: alibabaModels.length,
                  })
                : t("settings.ai.providers.noModelsYet", "Zatiaľ nie sú načítané modely.")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Feature Mappings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.ai.features.title", "Mapovanie AI funkcií")}</CardTitle>
          </div>
          <CardDescription>
            {t(
              "settings.ai.features.subtitle",
              "Priraďte konkrétnych poskytovateľov a modely k jednotlivým veterinárnym a prevádzkovým modulom.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[650px] space-y-4 divide-y divide-border">
              {/* Feature 1: Assistant */}
              <FeatureRow
                icon={<Bot className="h-5 w-5 text-blue-500" />}
                title={t("settings.ai.features.assistantTitle", "AI Copilot & Klinický asistent")}
                description={t(
                  "settings.ai.features.assistantDesc",
                  "Klinický asistenčný chat, diferenciálna diagnostika a návrhy vyšetrenia SOAP.",
                )}
                mapping={featureMappings.assistant}
                onChangeProvider={(p) => updateFeature("assistant", "provider", p)}
                onChangeModel={(m) => updateFeature("assistant", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                t={t}
              />

              {/* Feature 2: RTG / Imaging */}
              <FeatureRow
                icon={<Activity className="h-5 w-5 text-teal-500" />}
                title={t("settings.ai.features.imagingTitle", "Analýza RTG a zobrazovacie metódy")}
                description={t(
                  "settings.ai.features.imagingDesc",
                  "Analýza röntgenov, ultrazvukov a klinických fotografií (vyžaduje Vision model).",
                )}
                mapping={featureMappings.imagingRtg}
                onChangeProvider={(p) => updateFeature("imagingRtg", "provider", p)}
                onChangeModel={(m) => updateFeature("imagingRtg", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                filterVisionOnly
                t={t}
              />

              {/* Feature 3: Voice SOAP */}
              <FeatureRow
                icon={<Mic className="h-5 w-5 text-purple-500" />}
                title={t("settings.ai.features.voiceTitle", "Hlasové diktovanie SOAP")}
                description={t(
                  "settings.ai.features.voiceDesc",
                  "Prepis hovoreného slova a extrakcia štruktúrovaného SOAP záznamu.",
                )}
                mapping={featureMappings.voiceSoap}
                onChangeProvider={(p) => updateFeature("voiceSoap", "provider", p)}
                onChangeModel={(m) => updateFeature("voiceSoap", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                t={t}
              />

              {/* Feature 4: Lab Parser */}
              <FeatureRow
                icon={<FileText className="h-5 w-5 text-amber-500" />}
                title={t("settings.ai.features.labTitle", "Parsovanie laboratórnych nálezov")}
                description={t(
                  "settings.ai.features.labDesc",
                  "Automatická extrakcia biomarkerov a hodnôt z PDF laboratórnych správ.",
                )}
                mapping={featureMappings.labParser}
                onChangeProvider={(p) => updateFeature("labParser", "provider", p)}
                onChangeModel={(m) => updateFeature("labParser", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                t={t}
              />

              {/* Feature 5: Image Generation */}
              <FeatureRow
                icon={<ImageIcon className="h-5 w-5 text-pink-500" />}
                title={t("settings.ai.features.imageGenTitle", "Generovanie obrázkov (Letáky & Edukácia)")}
                description={t(
                  "settings.ai.features.imageGenDesc",
                  "Tvorba ilustračných obrázkov pre edukačné letáky a pokyny pre majiteľov.",
                )}
                mapping={featureMappings.imageGeneration}
                onChangeProvider={(p) => updateFeature("imageGeneration", "provider", p)}
                onChangeModel={(m) => updateFeature("imageGeneration", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                filterImageOnly
                t={t}
              />

              {/* Feature 6: Video Generation */}
              <FeatureRow
                icon={<Video className="h-5 w-5 text-indigo-500" />}
                title={t("settings.ai.features.videoGenTitle", "Generovanie videa")}
                description={t(
                  "settings.ai.features.videoGenDesc",
                  "Tvorba krátkych edukačných videí pre sociálne siete a majiteľov (WAN modely).",
                )}
                mapping={featureMappings.videoGeneration}
                onChangeProvider={(p) => updateFeature("videoGeneration", "provider", p)}
                onChangeModel={(m) => updateFeature("videoGeneration", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                filterVideoOnly
                t={t}
              />

              {/* Feature 7: Marketing Copy */}
              <FeatureRow
                icon={<Sparkles className="h-5 w-5 text-orange-500" />}
                title={t("settings.ai.features.marketingTitle", "Marketing & Sociálne siete")}
                description={t(
                  "settings.ai.features.marketingDesc",
                  "Generovanie edukačných príspevkov a textov pre sociálne siete a web.",
                )}
                mapping={featureMappings.marketingCopy}
                onChangeProvider={(p) => updateFeature("marketingCopy", "provider", p)}
                onChangeModel={(m) => updateFeature("marketingCopy", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                t={t}
              />

              {/* Feature 8: Deep Thinking & Clinical Consilium */}
              <FeatureRow
                icon={<Sparkles className="h-5 w-5 text-violet-500" />}
                title={t("settings.ai.features.deepThinkingTitle", "Hĺbková analýza & Konzílium (Deep Thinking)")}
                description={t(
                  "settings.ai.features.deepThinkingDesc",
                  "Rozšírené uvažovanie pre zložité diferenciálne diagnózy, multimodálne RTG rozbory a konziliárne vyšetrenia.",
                )}
                mapping={featureMappings.deepThinking}
                onChangeProvider={(p) => updateFeature("deepThinking", "provider", p)}
                onChangeModel={(m) => updateFeature("deepThinking", "model", m)}
                openaiModels={openaiModels}
                geminiModels={geminiModels}
                alibabaModels={alibabaModels}
                openaiIsActive={openaiIsActive}
                geminiIsActive={geminiIsActive}
                alibabaIsActive={alibabaIsActive}
                t={t}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Slovak Clinical & Statutory Safety Gate */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground">
              {t("settings.ai.compliance.title", "Klinická a legislatívna bezpečnosť")}
            </p>
            <p className="text-muted-foreground">
              {t(
                "settings.ai.compliance.hitl",
                "Zákon č. 39/2007 Z. z. §3: AI slúži výhradne ako asistent. Všetky klinické návrhy ostávajú ako draft a vyžadujú autorizáciu a podpis veterinárneho lekára v ClinicalDiffConfirmModal.",
              )}
            </p>
            <p className="text-muted-foreground">
              {t(
                "settings.ai.compliance.controlled",
                "Zákon č. 139/1998 Z. z.: Prísny zákaz AI prefillu pre omamné a psychotropné látky (opiáty, ketamín). Vyžaduje sa manuálny zápis.",
              )}
            </p>
            <p className="text-muted-foreground">
              {t(
                "settings.ai.compliance.sympathy",
                "Sympathy Gate: Pri úhyne alebo eutanázii pacienta je automaticky potlačená všetka automatizovaná komunikácia.",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component for individual Feature Rows ───────────────────
interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  mapping?: FeatureAiMapping;
  onChangeProvider: (provider: string) => void;
  onChangeModel: (model: string) => void;
  openaiModels: CachedAiModel[];
  geminiModels: CachedAiModel[];
  alibabaModels: CachedAiModel[];
  openaiIsActive?: boolean;
  geminiIsActive?: boolean;
  alibabaIsActive?: boolean;
  filterVisionOnly?: boolean;
  filterImageOnly?: boolean;
  filterVideoOnly?: boolean;
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
}

function FeatureRow({
  icon,
  title,
  description,
  mapping,
  onChangeProvider,
  onChangeModel,
  openaiModels,
  geminiModels,
  alibabaModels,
  openaiIsActive = false,
  geminiIsActive = false,
  alibabaIsActive = false,
  filterVisionOnly,
  filterImageOnly,
  filterVideoOnly,
  t,
}: FeatureRowProps) {
  const provider = mapping?.provider || "default";
  const model = mapping?.model || "";

  const isProviderActive =
    provider === "default" ||
    (provider === "openai" && openaiIsActive) ||
    (provider === "gemini" && geminiIsActive) ||
    (provider === "alibaba" && alibabaIsActive);

  const handleProviderChange = (newProvider: string) => {
    onChangeProvider(newProvider);
    if (newProvider === "gemini") {
      if (filterImageOnly) onChangeModel("imagen-3.0-generate-002");
      else onChangeModel("gemini-3.6-flash");
    } else if (newProvider === "alibaba") {
      if (filterVideoOnly) onChangeModel("wan3.0-video");
      else if (filterImageOnly) onChangeModel("qwen-image-3.0");
      else if (filterVisionOnly) onChangeModel("qwen-vl-max");
      else onChangeModel("qwen-plus");
    } else if (newProvider === "openai") {
      if (openaiModels.length > 0) onChangeModel(openaiModels[0].id);
      else onChangeModel("gpt-4o-mini");
    }
  };

  // Available models for currently selected provider
  const availableModels = useMemo(() => {
    let list: CachedAiModel[] = [];
    if (provider === "openai") list = [...openaiModels];
    else if (provider === "gemini") list = [...geminiModels];
    else if (provider === "alibaba") list = [...alibabaModels];

    let filtered = list;
    if (filterVisionOnly) {
      const visionList = list.filter((m) => m.isVision);
      if (visionList.length > 0) filtered = visionList;
    } else if (filterImageOnly) {
      const imgList = list.filter((m) => m.isImageGeneration);
      if (imgList.length > 0) filtered = imgList;
    } else if (filterVideoOnly) {
      const vidList = list.filter((m) => m.isVideoGeneration);
      if (vidList.length > 0) filtered = vidList;
    }

    if (model && !filtered.some((m) => m.id === model)) {
      return [{ id: model, name: model }, ...filtered];
    }

    return filtered;
  }, [provider, model, openaiModels, geminiModels, alibabaModels, filterVisionOnly, filterImageOnly, filterVideoOnly]);

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 sm:max-w-md">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            {!isProviderActive && (
              <Badge variant="destructive" className="h-4.5 text-[9px] px-1.5 py-0 font-normal">
                {t("settings.ai.features.providerInactive", "Poskytovateľ je neaktívny")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {/* Provider Select */}
        <div className="w-40">
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t("settings.ai.features.provider", "Poskytovateľ")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                {t("settings.ai.features.defaultSystem", "Predvolený systémový")}
              </SelectItem>
              <SelectItem value="alibaba">Alibaba / AliProxy</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI Compatible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Model Select or input */}
        <div className="w-56">
          {availableModels.length > 0 ? (
            <ModelPicker
              model={model}
              onChangeModel={onChangeModel}
              availableModels={availableModels}
              placeholder={t("settings.ai.features.model", "Model")}
              searchPlaceholder={t("settings.ai.features.searchModel", "Hľadať model...")}
              noModelsText={t("settings.ai.features.noModelsFound", "Žiadne modely sa nenašli")}
              useCustomText={(custom) =>
                t("settings.ai.features.useCustomModel", `Použiť model "${custom}"`, { model: custom })
              }
            />
          ) : (
            <Input
              value={model}
              onChange={(e) => onChangeModel(e.target.value)}
              placeholder="Model ID..."
              className="h-8 font-mono text-xs"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Searchable & Scrollable Model Picker Popover ─────────────────
interface ModelPickerProps {
  model: string;
  onChangeModel: (model: string) => void;
  availableModels: CachedAiModel[];
  placeholder: string;
  searchPlaceholder: string;
  noModelsText: string;
  useCustomText: (custom: string) => string;
}

function ModelPicker({
  model,
  onChangeModel,
  availableModels,
  placeholder,
  searchPlaceholder,
  noModelsText,
  useCustomText,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return availableModels;
    const q = search.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.name && m.name.toLowerCase().includes(q)),
    );
  }, [availableModels, search]);

  const selectedItem = availableModels.find((m) => m.id === model);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-56 justify-between px-2 font-mono text-xs font-normal"
        >
          <span className="truncate">
            {selectedItem ? (selectedItem.name || selectedItem.id) : (model || placeholder)}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-lg" align="end">
        <div className="flex flex-col">
          {/* Search Header */}
          <div className="flex items-center border-b px-2.5 py-1.5">
            <Search className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Scrollable Model List */}
          <div className="max-h-64 overflow-y-auto p-1 text-xs">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                <p>{noModelsText}</p>
                {search.trim() && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2 h-7 w-full text-[11px] font-mono"
                    onClick={() => {
                      onChangeModel(search.trim());
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {useCustomText(search.trim())}
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((m) => {
                const isSelected = model === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      onChangeModel(m.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-xs font-mono transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/70 font-medium text-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-primary",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{m.name || m.id}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {m.isVision && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-sans">
                          Vision
                        </Badge>
                      )}
                      {m.isImageGeneration && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1 font-sans text-pink-600 dark:text-pink-400"
                        >
                          Img
                        </Badge>
                      )}
                      {m.isVideoGeneration && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1 font-sans text-indigo-600 dark:text-indigo-400"
                        >
                          Video
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
