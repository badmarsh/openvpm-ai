"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  SunMedium,
  SlidersHorizontal,
  FileCheck2,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type DicomMetadata,
  DICOM_WINDOW_PRESETS,
  parseDicomMetadata,
  renderDicomToCanvas,
} from "@/lib/imaging/dicom-parser";

interface DicomViewerProps {
  file: File;
  onPreparedForAi?: (imageBlob: Blob, dataUrl: string) => void;
  className?: string;
}

export function DicomViewer({
  file,
  onPreparedForAi,
  className = "",
}: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [metadata, setMetadata] = useState<DicomMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // W/L state
  const [windowWidth, setWindowWidth] = useState<number>(400);
  const [windowCenter, setWindowCenter] = useState<number>(40);
  const [inverted, setInverted] = useState(false);

  // Transform state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load and parse file
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (cancelled) return;
      const buf = e.target?.result as ArrayBuffer;
      if (!buf) {
        setError("Nepodarilo sa načítať súbor");
        setLoading(false);
        return;
      }

      try {
        const meta = parseDicomMetadata(buf);
        if (!meta.isDicom) {
          setError("Súbor nemá platnú hlavičku DICOM (DICM Part 10).");
          setLoading(false);
          return;
        }

        setBuffer(buf);
        setMetadata(meta);
        setWindowWidth(meta.windowWidth || 400);
        setWindowCenter(meta.windowCenter || 40);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Chyba pri parsovaní DICOM");
        setLoading(false);
      }
    };

    reader.onerror = () => {
      if (!cancelled) {
        setError("Chyba čítania súboru");
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render canvas when W/L or invert changes
  const renderFrame = useCallback(() => {
    if (!canvasRef.current || !buffer || !metadata) return;
    renderDicomToCanvas(canvasRef.current, buffer, metadata, {
      windowCenter,
      windowWidth,
      invert: inverted,
    });
  }, [buffer, metadata, windowCenter, windowWidth, inverted]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Export current frame to AI
  const handleExportForAi = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onPreparedForAi) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL("image/png");
        onPreparedForAi(blob, dataUrl);
      },
      "image/png",
      0.95
    );
  }, [onPreparedForAi]);

  // Preset switch
  const applyPreset = (preset: (typeof DICOM_WINDOW_PRESETS)[number]) => {
    setWindowWidth(preset.windowWidth);
    setWindowCenter(preset.windowCenter);
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    if (metadata) {
      setWindowWidth(metadata.windowWidth || 400);
      setWindowCenter(metadata.windowCenter || 40);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Dekódovanie DICOM snímky (16-bit dáta)...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-lg border border-border bg-black text-white overflow-hidden ${className}`}>
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 p-2.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-zinc-900 border-zinc-700 text-zinc-300 font-mono text-[10px]">
            {metadata?.modality || "RTG"} • {metadata?.cols}x{metadata?.rows} • {metadata?.bitsAllocated}b
          </Badge>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1">
            {DICOM_WINDOW_PRESETS.slice(0, 4).map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                size="sm"
                onClick={() => applyPreset(p)}
                className="h-6 px-2 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInverted(!inverted)}
            className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Invertovať čiernu a bielu"
          >
            Invert
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Otočiť o 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Priblížiť"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Oddialiť"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetView}
            className="h-7 px-2 text-xs text-zinc-300 hover:bg-zinc-800"
            title="Resetovať zobrazenie"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative flex h-[480px] w-full items-center justify-center overflow-hidden bg-black cursor-grab active:cursor-grabbing select-none"
      >
        {/* Corner HUD Overlays */}
        <div className="pointer-events-none absolute left-3 top-3 text-[11px] font-mono text-zinc-400 drop-shadow">
          <div>{metadata?.patientName || "Pacient"}</div>
          <div className="text-[10px] text-zinc-500">ID: {metadata?.patientId || "—"}</div>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 text-right text-[11px] font-mono text-zinc-400 drop-shadow">
          <div>{metadata?.studyDate || "Dátum štúdie"}</div>
          <div className="text-[10px] text-zinc-500">{metadata?.manufacturer || ""}</div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 text-[11px] font-mono text-zinc-400 drop-shadow">
          <div>WL: {Math.round(windowCenter)} WW: {Math.round(windowWidth)}</div>
          <div className="text-[10px] text-zinc-500">Zoom: {Math.round(zoom * 100)}%</div>
        </div>

        {/* Canvas Element */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="max-h-full max-w-full"
        >
          <canvas ref={canvasRef} className="max-h-[460px] object-contain shadow-2xl" />
        </div>
      </div>

      {/* Bottom Slider & AI Prep Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950 p-2.5 text-xs">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Window Center (Jas) */}
          <div className="flex items-center gap-2 flex-1 sm:w-48">
            <span className="text-[10px] font-mono text-zinc-400">WL:</span>
            <input
              type="range"
              min={-1000}
              max={2000}
              step={10}
              value={windowCenter}
              onChange={(e) => setWindowCenter(parseFloat(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-zinc-800 accent-teal-500"
            />
          </div>

          {/* Window Width (Kontrast) */}
          <div className="flex items-center gap-2 flex-1 sm:w-48">
            <span className="text-[10px] font-mono text-zinc-400">WW:</span>
            <input
              type="range"
              min={1}
              max={3000}
              step={10}
              value={windowWidth}
              onChange={(e) => setWindowWidth(parseFloat(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-zinc-800 accent-teal-500"
            />
          </div>
        </div>

        {onPreparedForAi && (
          <Button
            size="sm"
            onClick={handleExportForAi}
            className="w-full sm:w-auto gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Pripraviť snímku pre AI analýzu</span>
          </Button>
        )}
      </div>
    </div>
  );
}
