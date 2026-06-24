"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { StepHandle } from "../journey-types";

// The four accent swatches the brand uses elsewhere.
const ACCENTS = ["#0d9488", "#16a34a", "#f97316", "#db2777"];

/**
 * Step 2: optional logo upload and accent color. Both save right away through
 * updatePractice, so Continue has nothing extra to do.
 */
export function BrandingStep({ register }: { register: (h: StepHandle) => void }) {
  const { data: practice } = trpc.settings.getPractice.useQuery();
  const utils = trpc.useUtils();
  const updatePractice = trpc.settings.updatePractice.useMutation({
    onSuccess: () => {
      utils.settings.getPractice.invalidate();
      utils.settings.getBranding.invalidate();
    },
  });

  const savedColor =
    (practice?.settings as { brandColor?: string } | null)?.brandColor ?? null;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentLogo = logoUrl ?? practice?.logoUrl ?? null;

  useEffect(() => {
    // Both pickers save on click, so Continue is a no-op here.
    register({ onContinue: async () => true });
  }, [register]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("category", "branding");
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setLogoUrl(json.url);
      await updatePractice.mutateAsync({ logoUrl: json.url });
      toast.success("Logo saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function pickColor(color: string) {
    updatePractice.mutate(
      { brandColor: color },
      { onSuccess: () => toast.success("Color saved") }
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-slate-600">
        Add your logo and pick a color. This is just for looks, so feel free to
        skip it and come back later.
      </p>

      {/* Logo */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Your logo</span>
        <div className="flex items-center gap-4">
          {currentLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentLogo}
              alt="Practice logo"
              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {currentLogo ? "Replace logo" : "Upload logo"}
            </Button>
            <p className="mt-1.5 text-xs text-slate-500">
              PNG, JPG, or WebP. Square images look best.
            </p>
          </div>
        </div>
      </div>

      {/* Accent color */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Accent color</span>
        <div className="flex gap-2.5">
          {ACCENTS.map((c) => {
            const active = (savedColor ?? "").toLowerCase() === c;
            return (
              <button
                key={c}
                type="button"
                aria-label={`Use accent color ${c}`}
                disabled={updatePractice.isPending}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform disabled:opacity-60",
                  active ? "scale-110 border-slate-900" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                onClick={() => pickColor(c)}
              >
                {active ? <Check className="h-4 w-4 text-white" /> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Or paste a hex code</span>
          <input
            type="text"
            defaultValue={savedColor ?? "#0d9488"}
            placeholder="#0d9488"
            maxLength={7}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v)) pickColor(v);
            }}
            className="h-9 w-28 rounded-md border border-input bg-white px-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}
