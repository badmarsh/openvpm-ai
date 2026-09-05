"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecordingButtonProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onInterimText?: (text: string) => void;
  onCommandDetected?: (actionKey: string, phrase: string) => void;
  disabled?: boolean;
  size?: "default" | "large";
}

export function RecordingButton({
  onRecordingComplete,
  onInterimText,
  onCommandDetected,
  disabled = false,
  size = "default",
}: RecordingButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(5));
  const [interimTranscript, setInterimTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web Audio API for visualizer
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Web Speech API for real-time interim transcription
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognizerRef = useRef<any>(null);
  const stopRecordingRef = useRef<() => void>(() => {});

  const isLarge = size === "large";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (speechRecognizerRef.current) {
        try {
          speechRecognizerRef.current.stop();
        } catch {}
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample 16 discrete bars from frequencies
    const barsCount = 16;
    const step = Math.floor(bufferLength / barsCount);
    const newLevels: number[] = [];

    for (let i = 0; i < barsCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] ?? 0;
      }
      const avg = sum / step;
      // Scale between 4px and 32px height
      const height = Math.max(4, Math.min(36, Math.round((avg / 255) * 36)));
      newLevels.push(height);
    }

    setAudioLevels(newLevels);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 1. Audio Context for Visualizer
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      } catch (err) {
        console.warn("Web Audio Visualizer initialization failed:", err);
      }

      // 2. Real-time Web Speech API Preview (if available)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const recognizer = new SpeechRec();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.lang = "sk-SK";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognizer.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res && res[0]) {
                interim += res[0].transcript;
              }
            }
            if (interim) {
              setInterimTranscript(interim);
              onInterimText?.(interim);

              // Live voice commands detection
              const norm = interim.toLowerCase().trim();
              if (
                norm.includes("ukončiť poznámku") ||
                norm.includes("ukoncit poznamku") ||
                norm.includes("zastaviť nahrávanie") ||
                norm.includes("zastavit nahravanie")
              ) {
                onCommandDetected?.("end_note", "Ukončiť poznámku");
                stopRecordingRef.current();
              } else if (
                norm.includes("nový odsek") ||
                norm.includes("novy odsek")
              ) {
                onCommandDetected?.("new_paragraph", "Nový odsek");
              } else if (
                norm.includes("odrážka") ||
                norm.includes("odrazka")
              ) {
                onCommandDetected?.("bullet_point", "Odrážka");
              } else if (
                norm.includes("číslovaný zoznam") ||
                norm.includes("cislovany zoznam")
              ) {
                onCommandDetected?.("numbered_list", "Číslovaný zoznam");
              } else if (
                norm.includes("tučný text") ||
                norm.includes("tucny text")
              ) {
                onCommandDetected?.("bold_text", "Tučný text");
              } else if (
                norm.includes("uložiť dokument") ||
                norm.includes("ulozit dokument")
              ) {
                onCommandDetected?.("save_document", "Uložiť dokument");
              }
            }
          };

          recognizer.onerror = () => {};
          recognizer.start();
          speechRecognizerRef.current = recognizer;
        }
      } catch {
        // Web Speech recognition is an optional enhancement
      }

      // 3. MediaRecorder for authoritative audio file
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        stream.getTracks().forEach((t) => t.stop());
        onRecordingComplete(blob, duration);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);
      setInterimTranscript("");

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch {
      alert(
        "Nepodarilo sa získať prístup k mikrofónu. Skontrolujte povolenia prehliadača.",
      );
    }
  }, [onRecordingComplete, onInterimText, updateVisualizer]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch {}
      speechRecognizerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  stopRecordingRef.current = stopRecording;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const buttonSize = isLarge ? "h-24 w-24" : "h-20 w-20";
  const iconSize = isLarge ? "h-10 w-10" : "h-8 w-8";

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {/* Audio Wave Visualizer Bars during recording */}
      {isRecording && (
        <div className="flex items-center justify-center gap-1 h-10 px-4 py-1.5 rounded-full bg-red-50/80 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/40 animate-in fade-in duration-300">
          <Volume2 className="h-3.5 w-3.5 text-red-500 mr-1 shrink-0 animate-pulse" />
          <div className="flex items-center gap-1 h-8">
            {audioLevels.map((height, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-red-500 to-pink-500 transition-all duration-75 ease-out"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Action Button with Rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        {isRecording && (
          <>
            <div
              className={cn(
                "absolute rounded-full bg-red-500/20",
                isLarge ? "-inset-4" : "-inset-3",
              )}
              style={{
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <div
              className={cn(
                "absolute rounded-full bg-red-500/30",
                isLarge ? "-inset-2" : "-inset-1.5",
              )}
              style={{
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          </>
        )}

        <Button
          type="button"
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className={cn(
            "relative rounded-full transition-all duration-300 z-10",
            buttonSize,
            isRecording && "shadow-xl shadow-red-500/50 bg-red-600 hover:bg-red-700",
            !isRecording &&
              !disabled &&
              "bg-gradient-to-tr from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105",
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
        >
          {isRecording ? (
            <Square className={cn(iconSize, "relative z-10 fill-current")} />
          ) : (
            <Mic className={cn(iconSize, "relative z-10")} />
          )}
        </Button>
      </div>

      {/* Status & Timer */}
      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            "font-mono tabular-nums text-sm font-semibold transition-colors",
            isRecording ? "text-red-500 text-base" : "text-muted-foreground",
          )}
        >
          {isRecording ? formatTime(elapsed) : "0:00"}
        </span>

        {isRecording && (
          <span className="text-xs text-red-500 font-medium animate-pulse mt-0.5">
            Diktujte klinický nález...
          </span>
        )}
      </div>

      {/* Real-time speech preview ticker */}
      {isRecording && interimTranscript && (
        <div className="w-full text-center px-3 py-2 rounded-lg bg-muted/70 backdrop-blur-sm border text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300 max-h-16 overflow-y-auto">
          <span className="italic text-foreground">„{interimTranscript}“</span>
        </div>
      )}
    </div>
  );
}
