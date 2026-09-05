"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ImagePlus,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wand2,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MediaFrame, type FrameBrand } from "@/components/marketing/media-frame";
import { AiCanvas } from "@/components/marketing/ai-canvas";

type Filter = "all" | "valid" | "expiring" | "illustration";

function consentHealth(asset: any, consent: any): "ok" | "expiring" | "bad" | "none" {
  if (!asset.subjectsPresent) return "none";
  if (!consent || consent.revoked || consent.revokedAt) return "bad";
  const until = consent.validUntil
    ? new Date(consent.validUntil).getTime()
    : new Date(consent.grantedAt).getTime() + 365 * 86400_000;
  if (until < Date.now()) return "bad";
  if (until - Date.now() < 30 * 86400_000) return "expiring";
  return "ok";
}

export default function MediaPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"library" | "canvas">("library");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const mediaQuery = trpc.extensions.marketing.listMediaAssets.useQuery({
    kind: "all",
    hasConsent: "all",
  });
  const brandQuery = trpc.extensions.marketing.getBrandInfo.useQuery();
  const clientsQuery = trpc.extensions.marketing.listClientsForMedia.useQuery();

  const brandColors: FrameBrand = useMemo(() => {
    if (brandQuery.data) {
      return {
        name: brandQuery.data.name,
        logoInitials: brandQuery.data.logoInitials,
        primaryColor: brandQuery.data.primaryColor,
        secondaryColor: brandQuery.data.secondaryColor,
      };
    }
    return {
      name: "Veterinárna klinika",
      logoInitials: "VK",
      primaryColor: "#0e5e4a",
      secondaryColor: "#e8a33d",
    };
  }, [brandQuery.data]);

  const rawAssets = mediaQuery.data ?? [];

  const shown = useMemo(() => {
    return rawAssets.filter(({ asset, consent }) => {
      const h = consentHealth(asset, consent);
      if (filter === "valid") return h === "ok";
      if (filter === "expiring") return h === "expiring" || h === "bad";
      if (filter === "illustration") return asset.kind === "illustration";
      return true;
    });
  }, [rawAssets, filter]);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {t("marketing.media.title", "Knižnica médií a grafiky")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.media.description",
              "Deterministický render vizuálu, brandové rámiky a AI Canvas s kontrolou GDPR súhlasov."
            )}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-full border border-border bg-muted/40 p-1 w-fit">
          <button
            onClick={() => setTab("library")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              tab === "library"
                ? "bg-teal-800 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Knižnica médií
          </button>
          <button
            onClick={() => setTab("canvas")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              tab === "canvas"
                ? "bg-teal-800 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Canvas
          </button>
        </div>
      </div>

      {tab === "canvas" ? (
        <AiCanvas onGenerated={() => setTab("library")} />
      ) : (
        <>
          {/* Filter Pills & Add Button */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Všetky"],
                ["valid", "Súhlas platný"],
                ["expiring", "Vyprší / problém"],
                ["illustration", "Ilustrácie"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                  filter === k
                    ? "bg-teal-800 text-white border-teal-800 shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}

            <span className="flex-1" />

            <Link href="/marketing/consents">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                GDPR Súhlasy
              </Button>
            </Link>

            <Button
              size="sm"
              className="gap-1.5 text-xs h-9 bg-teal-800 hover:bg-teal-900 text-white"
              onClick={() => setUploading(true)}
            >
              <Camera size={14} /> Fotka na sociálne siete
            </Button>
          </div>

          {notice && (
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/10 px-4 py-2.5 text-xs font-medium text-teal-900 dark:text-teal-200">
              {notice}
            </div>
          )}

          {/* Upload Panel */}
          {uploading && (
            <UploadPanel
              owners={clientsQuery.data ?? []}
              onClose={(msg) => {
                setUploading(false);
                if (msg) {
                  setNotice(msg);
                  toast.success(msg);
                }
              }}
            />
          )}

          {/* Media Grid */}
          {mediaQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-2xl border p-4 h-72 animate-pulse bg-muted/20" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <ImagePlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Žiadne médiá podľa vybraného filtra</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Nahrajte novú fotografiu pacienta so súhlasom alebo vygenerujte ilustráciu cez AI Canvas.
                </p>
              </div>
              <Button size="sm" onClick={() => setUploading(true)} className="gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Nahrať fotku
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {shown.map(({ asset, consent }) => {
                const h = consentHealth(asset, consent);
                const consentUntilDate = consent?.validUntil
                  ? new Date(consent.validUntil)
                  : consent?.grantedAt
                  ? new Date(new Date(consent.grantedAt).getTime() + 365 * 86400_000)
                  : null;

                return (
                  <div
                    key={asset.id}
                    className="group rounded-2xl border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* MediaFrame Component */}
                    <MediaFrame
                      asset={asset}
                      brand={brandColors}
                      headline={asset.caption || asset.altText || brandColors.name}
                      aspect="aspect-square"
                    />

                    {/* Card Content & Meta */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-foreground truncate">
                          {asset.patientName ??
                            (asset.kind === "illustration"
                              ? "Ilustrácia"
                              : asset.kind === "video"
                              ? "Video klip"
                              : "Brandová grafika")}
                        </p>

                        {/* Status chips */}
                        <div className="flex flex-wrap gap-1">
                          {h === "ok" && consentUntilDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                              <ShieldCheck size={11} /> súhlas do {consentUntilDate.toLocaleDateString("sk-SK")}
                            </span>
                          )}
                          {h === "expiring" && consentUntilDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">
                              <ShieldAlert size={11} /> vyprší {consentUntilDate.toLocaleDateString("sk-SK")}
                            </span>
                          )}
                          {h === "bad" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-800 dark:text-red-300">
                              <ShieldAlert size={11} /> súhlas chýba/odvolaný
                            </span>
                          )}
                          {asset.kind === "illustration" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                              generované
                            </span>
                          )}
                          {(asset.meta as any)?.edit?.preset && (asset.meta as any).edit.preset !== "none" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-800 dark:text-teal-300">
                              edit: {(asset.meta as any).edit.preset}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        {asset.tags && asset.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {asset.tags.slice(0, 3).map((t: string) => (
                              <span
                                key={t}
                                className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Inline Media Editor */}
                      <MediaEditor asset={asset} onDone={setNotice} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground border-t pt-3">
            Pravidlo: bez platného súhlasu (scope photo_social) sa fotka s pacientom uloží len do klinickej karty v PMS,
            do media_asset sa fyzicky nedostane (CHECK constraint v DB).
          </p>
        </>
      )}
    </div>
  );
}

const PRESETS: { key: "none" | "enhance" | "warm" | "bw" | "soft"; label: string }[] = [
  { key: "enhance", label: "Auto-vylepšenie" },
  { key: "warm", label: "Teplé tóny" },
  { key: "bw", label: "Čiernobiele" },
  { key: "soft", label: "Jemné" },
  { key: "none", label: "Bez editu" },
];

const CROPS: ("1:1" | "4:5" | "9:16" | "16:9")[] = ["1:1", "4:5", "9:16", "16:9"];

function MediaEditor({ asset, onDone }: { asset: any; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [overlay, setOverlay] = useState((asset.meta as any)?.edit?.overlay ?? "");
  const edit = (asset.meta as any)?.edit ?? {};

  const utils = trpc.useUtils();

  const editMutation = trpc.extensions.marketing.applyMediaEdit.useMutation({
    onSuccess: () => {
      onDone("Edit aplikovaný (deterministicky – CSS / Sharp render).");
      utils.extensions.marketing.listMediaAssets.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Aplikovanie zlyhalo");
    },
  });

  const deleteMutation = trpc.extensions.marketing.deleteMediaAsset.useMutation({
    onSuccess: () => {
      onDone("Médium bolo zmazané.");
      toast.success("Médium zmazané");
      utils.extensions.marketing.listMediaAssets.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmazať médium");
    },
  });

  const suggestAltMutation = trpc.extensions.marketing.suggestMediaAltText.useMutation({
    onSuccess: (data) => {
      onDone(`Navrhnutý alt text: „${data.altText}“`);
      toast.success("Alt text bol vygenerovaný");
      utils.extensions.marketing.listMediaAssets.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Generovanie zlyhalo");
    },
  });

  const apply = (patch: Record<string, unknown>) => {
    editMutation.mutate({
      id: asset.id,
      edit: { ...edit, ...patch },
    });
  };

  if (!open) {
    return (
      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex gap-1.5">
          <button
            onClick={() => setOpen(true)}
            className="flex-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 px-2 py-1.5 text-[11px] font-bold text-teal-850 dark:text-teal-300 hover:bg-teal-100 transition cursor-pointer inline-flex items-center justify-center gap-1 border border-teal-200/50 dark:border-teal-800/40"
          >
            <Wand2 size={11} /> AI edit
          </button>
          <button
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm("Naozaj chcete zmazať toto médium z knižnice?")) {
                deleteMutation.mutate({ id: asset.id });
              }
            }}
            className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-red-600 hover:border-red-300 transition cursor-pointer"
            title="Zmazať médium"
          >
            <Trash2 size={11} />
          </button>
        </div>

        <Link
          href={`/marketing/plan?mediaId=${asset.id}`}
          className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary py-0.5"
        >
          <span>Použiť v príspevku</span>
          <ExternalLink size={10} />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-500/30 bg-card p-2.5 space-y-2 pt-2 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-teal-800 dark:text-teal-300 font-bold text-[10px] uppercase tracking-wide">
          <Wand2 size={11} /> AI edit
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <X size={12} />
        </button>
      </div>

      {/* Preset filters */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            disabled={editMutation.isPending}
            onClick={() => apply({ preset: p.key })}
            className={`rounded-md px-1.5 py-1 text-[10px] font-semibold cursor-pointer transition-colors ${
              (edit.preset ?? "none") === p.key
                ? "bg-teal-800 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Crop ratios */}
      <div className="flex flex-wrap gap-1">
        {CROPS.map((c) => (
          <button
            key={c}
            disabled={editMutation.isPending}
            onClick={() => apply({ crop: c })}
            className={`rounded-md px-1.5 py-1 text-[10px] font-bold cursor-pointer transition-colors ${
              edit.crop === c
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Text overlay input */}
      <div className="flex gap-1">
        <input
          value={overlay}
          onChange={(e) => setOverlay(e.target.value)}
          placeholder="Text do grafiky…"
          maxLength={60}
          className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-teal-600"
        />
        <button
          disabled={editMutation.isPending}
          onClick={() => apply({ overlay })}
          className="rounded-md bg-teal-800 px-2.5 text-[10px] font-bold text-white cursor-pointer disabled:opacity-50"
        >
          {editMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "OK"}
        </button>
      </div>

      {/* Alt text suggestion */}
      <button
        disabled={suggestAltMutation.isPending}
        onClick={() =>
          suggestAltMutation.mutate({
            kind: asset.kind,
            caption: asset.caption ?? undefined,
            patientName: asset.patientName ?? undefined,
            tags: asset.tags ?? [],
          })
        }
        className="w-full rounded-md border border-border bg-background py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        {suggestAltMutation.isPending ? "Generujem..." : "Navrhnúť alt text (prístupnosť)"}
      </button>
    </div>
  );
}

function UploadPanel({
  owners,
  onClose,
}: {
  owners: { id: string; name: string; validConsentId: string | null }[];
  onClose: (msg?: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [patientName, setPatientName] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<"photo" | "video">("photo");
  const [error, setError] = useState<string | null>(null);
  const [grantedId, setGrantedId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const owner = owners.find((o) => o.id === ownerId);
  const consentId = owner?.validConsentId ?? grantedId;

  const grantMutation = trpc.extensions.marketing.grantConsent.useMutation({
    onSuccess: (data) => {
      setGrantedId(data.consent.id);
      setError(null);
      toast.success("Súhlas photo_social bol úspešne zaznamenaný (podpis na recepcii)");
      utils.extensions.marketing.listClientsForMedia.invalidate();
    },
    onError: (err) => {
      setError(err.message || "Nepodarilo sa zaznamenať súhlas");
    },
  });

  const createMutation = trpc.extensions.marketing.createMediaAsset.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listMediaAssets.invalidate();
      onClose(
        fileKind === "video"
          ? "Klip bol uložený s platným súhlasom – šablóny ho teraz ponúknu v plánovači."
          : "Fotka bola uložená s platným súhlasom a zaradená do marketingovej knižnice."
      );
    },
    onError: (err) => {
      setError(err.message || "Chyba pri ukladaní média");
    },
  });

  const onFile = (f: File) => {
    if (f.type.startsWith("video/")) {
      if (f.size > 15 * 1024 * 1024) {
        setError("Klip je väčší ako 15 MB. Pre demo nahrajte kratší klip.");
        return;
      }
      setFileKind("video");
      const reader = new FileReader();
      reader.onload = () => setDataUrl(String(reader.result));
      reader.readAsDataURL(f);
      return;
    }

    setFileKind("photo");
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setDataUrl(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    if (!dataUrl) {
      setError("Vyberte fotografiu alebo video.");
      return;
    }
    if (!consentId) {
      setError("Najprv získajte súhlas pre tohto klienta kliknutím na tlačidlo nižšie.");
      return;
    }

    createMutation.mutate({
      url: dataUrl,
      kind: fileKind,
      patientName: patientName.trim() || undefined,
      subjectsPresent: true,
      consentId,
      tags: ["upload", fileKind === "video" ? "reel" : "sociálne-siete"],
      altText: patientName
        ? `${fileKind === "video" ? "Video" : "Pacient"} ${patientName} na veterinárnej klinike`
        : fileKind === "video"
        ? "Klip z veterinárnej ambulancie"
        : "Pacient na veterinárnej klinike",
      caption: patientName ? `Pacient ${patientName}` : undefined,
    });
  };

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-card p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b pb-2.5">
        <div className="flex items-center gap-2">
          <ImagePlus size={18} className="text-teal-700" />
          <h3 className="text-sm font-bold text-foreground">
            Nová fotka alebo video klip pacienta so súhlasom
          </h3>
        </div>
        <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div>
          <label className="text-xs font-semibold block mb-1">Súbor (foto / video)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-teal-50 file:text-teal-800"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Majiteľ / Klient kliniky</label>
          <select
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              setGrantedId(null);
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
          >
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} {o.validConsentId ? "✓ (má súhlas)" : "⚠ (bez súhlasu)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Meno pacienta (nepovinné)</label>
          <Input
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Napr. Blesk, Rexo, Luna"
            className="h-9 text-xs rounded-xl"
          />
        </div>
      </div>

      {dataUrl && (
        <div className="rounded-xl overflow-hidden border bg-muted/20 p-2 flex items-center gap-3">
          {fileKind === "video" ? (
            <video
              src={dataUrl}
              className="h-20 w-20 rounded-lg object-cover border"
              muted
              playsInline
              autoPlay
              loop
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Náhľad" className="h-20 w-20 rounded-lg object-cover border" />
          )}
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Náhľad pripravený</p>
            <p>Formát: {fileKind === "video" ? "Krátky klip (Reel)" : "Fotografia pacienta"}</p>
          </div>
        </div>
      )}

      {/* Consent Missing Warning + Quick Reception Grant */}
      {!consentId && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <span>Pre tohto klienta zatiaľ neexistuje aktívny súhlas <strong>photo_social</strong>.</span>
          </div>

          <Button
            size="sm"
            disabled={grantMutation.isPending || !ownerId}
            className="text-xs h-8 bg-amber-700 hover:bg-amber-800 text-white"
            onClick={() => grantMutation.mutate({ clientId: ownerId, scope: "photo_social" })}
          >
            {grantMutation.isPending ? "Ukladám súhlas..." : "Získať súhlas na recepcii (podpis)"}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={() => onClose()}>
          Zrušiť
        </Button>
        <Button
          size="sm"
          disabled={createMutation.isPending || !dataUrl || !consentId}
          className="gap-1.5 bg-teal-800 hover:bg-teal-900 text-white"
          onClick={handleSave}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Ukladám...
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              Uložiť so súhlasom
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Bez súhlasu sa fotka uloží len do klinickej karty v PMS (tá ju používa výhradne klinicky, nie marketingovo).
      </p>
    </div>
  );
}
