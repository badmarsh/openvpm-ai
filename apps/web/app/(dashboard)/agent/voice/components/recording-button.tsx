"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Mic, Square, Volume2, VolumeX, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  createSimulatedMicStream,
  type SimulatedMicController,
  DEFAULT_DEMO_AUDIO_URL,
} from "@/lib/voice/mic-simulation";

export interface RecordingButtonHandle {
  start: (simulated?: boolean) => Promise<void>;
  stop: () => void;
  isRecording: () => boolean;
}

export interface RecordingButtonProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onInterimText?: (text: string) => void;
  onCommandDetected?: (actionKey: string, phrase: string) => void;
  disabled?: boolean;
  size?: "default" | "large";
  initialSimulated?: boolean;
  simulatedAudioUrl?: string;
  onSimulationModeChange?: (simulated: boolean) => void;
}

export const RecordingButton = forwardRef<
  RecordingButtonHandle,
  RecordingButtonProps
>(function RecordingButton(
  {
    onRecordingComplete,
    onInterimText,
    onCommandDetected,
    disabled = false,
    size = "default",
    initialSimulated = false,
    simulatedAudioUrl = DEFAULT_DEMO_AUDIO_URL,
    onSimulationModeChange,
  },
  ref,
) {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(5));
  const [interimTranscript, setInterimTranscript] = useState("");

  // Mode: hardware microphone vs simulated microphone stream
  const [isSimulatedMode, setIsSimulatedMode] = useState(initialSimulated);
  const [isActivelySimulating, setIsActivelySimulating] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatedControllerRef = useRef<SimulatedMicController | null>(null);

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
      if (simulatedControllerRef.current) {
        simulatedControllerRef.current.stop();
        simulatedControllerRef.current = null;
      }
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
        mediaRecorderRef.current.stream.getTracks().forEach((trk) => trk.stop());
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
      // Scale between 4px and 36px height
      const height = Math.max(4, Math.min(36, Math.round((avg / 255) * 36)));
      newLevels.push(height);
    }

    setAudioLevels(newLevels);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

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
    if (simulatedControllerRef.current) {
      simulatedControllerRef.current.stop();
      simulatedControllerRef.current = null;
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
    setIsActivelySimulating(false);
  }, []);

  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(
    async (options?: { simulated?: boolean }) => {
      const isSim = options?.simulated ?? isSimulatedMode;

      try {
        let stream: MediaStream;

        if (isSim) {
          // Genuine Web Audio API simulation: stream PCM frames from the demo audio
          const controller = await createSimulatedMicStream({
            audioUrl: simulatedAudioUrl,
            playThroughSpeakers: !isSpeakerMuted,
            onEnded: () => {
              // Auto-stop when audio finishes playing
              stopRecordingRef.current();
            },
          });
          simulatedControllerRef.current = controller;
          stream = controller.stream;
          setIsActivelySimulating(true);
        } else {
          // Hardware microphone
          setIsActivelySimulating(false);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }

        // 1. Audio Context for Visualizer
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
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

        // 2. Real-time Web Speech API Preview (if available and using hardware mic)
        if (!isSim) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const SpeechRec =
              (window as any).SpeechRecognition ||
              (window as any).webkitSpeechRecognition;
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
          const duration = Math.max(
            1,
            Math.round((Date.now() - startTimeRef.current) / 1000),
          );
          stream.getTracks().forEach((trk) => trk.stop());
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
      } catch (err) {
        console.error("Microphone access error:", err);
        let msg = t(
          "voice.recording.micGenericError",
          "Nepodarilo sa získať prístup k mikrofónu. Skontrolujte povolenia prehliadača.",
        );

        if (
          typeof window !== "undefined" &&
          (!navigator?.mediaDevices || !navigator.mediaDevices.getUserMedia)
        ) {
          msg = t(
            "voice.recording.micSecureRequired",
            "Prístup k mikrofónu vyžaduje zabezpečené pripojenie (HTTPS alebo localhost).",
          );
        } else if (err instanceof DOMException) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            msg = t(
              "voice.recording.micPermissionDenied",
              "Prístup k mikrofónu bol zamietnutý. Ak ste mikrofón práve povolili, obnovte stránku (F5 / Reload), alebo skontrolujte povolenia v Nastaveniach Windows.",
            );
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            msg = t(
              "voice.recording.micNotFound",
              "Nebol nájdený žiadny mikrofón. Skontrolujte pripojenie mikrofónu a skúste znova.",
            );
          } else if (
            err.name === "NotReadableError" ||
            err.name === "TrackStartError"
          ) {
            msg = t(
              "voice.recording.micBusy",
              "Mikrofón je obsadený inou aplikáciou.",
            );
          }
        }

        // Show toast with quick fallback to simulated mic for easy testing
        toast.error(msg, {
          action: {
            label: t("voice.demo.fallbackToSim", "Spustiť simuláciu mikrofónu"),
            onClick: () => {
              setIsSimulatedMode(true);
              onSimulationModeChange?.(true);
              startRecording({ simulated: true });
            },
          },
        });
      }
    },
    [
      isSimulatedMode,
      simulatedAudioUrl,
      isSpeakerMuted,
      onRecordingComplete,
      onInterimText,
      onCommandDetected,
      updateVisualizer,
      onSimulationModeChange,
      t,
    ],
  );

  // Expose imperative handle for external triggers
  useImperativeHandle(
    ref,
    () => ({
      start: async (simulated?: boolean) => {
        if (simulated !== undefined) {
          setIsSimulatedMode(simulated);
          onSimulationModeChange?.(simulated);
        }
        await startRecording({ simulated });
      },
      stop: () => {
        stopRecording();
      },
      isRecording: () => isRecording,
    }),
    [startRecording, stopRecording, isRecording, onSimulationModeChange],
  );

  const toggleSpeakerMute = () => {
    const nextMuted = !isSpeakerMuted;
    setIsSpeakerMuted(nextMuted);
    simulatedControllerRef.current?.setMuted(nextMuted);
  };

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
      {/* Mode Switcher Pill (Hardware Mic vs Simulated Mic) */}
      {!isRecording && (
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-full border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => {
              setIsSimulatedMode(false);
              onSimulationModeChange?.(false);
            }}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 font-medium",
              !isSimulatedMode
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Mic className="h-3 w-3" />
            <span>{t("voice.demo.switchToHardware", "Fyzický mikrofón")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSimulatedMode(true);
              onSimulationModeChange?.(true);
            }}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 font-medium",
              isSimulatedMode
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>{t("voice.demo.switchToSimulation", "Simulovaný mikrofón")}</span>
          </button>
        </div>
      )}

      {/* Audio Wave Visualizer Bars during recording */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 h-10 px-4 py-1.5 rounded-full bg-red-50/80 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/40 animate-in fade-in duration-300">
          <Volume2 className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
          <div className="flex items-center gap-1 h-8">
            {audioLevels.map((height, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-all duration-75 ease-out",
                  isActivelySimulating
                    ? "bg-gradient-to-t from-violet-500 to-pink-500"
                    : "bg-gradient-to-t from-red-500 to-pink-500",
                )}
                style={{ height: `${height}px` }}
              />
            ))}
          </div>

          {/* Speaker monitor mute toggle during simulation */}
          {isActivelySimulating && (
            <button
              type="button"
              onClick={toggleSpeakerMute}
              title={
                isSpeakerMuted
                  ? t("voice.demo.unmuteSpeaker", "Zapnúť odposluch")
                  : t("voice.demo.muteSpeaker", "Stlmiť odposluch")
              }
              className="ml-1 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {isSpeakerMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Main Action Button with Rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        {isRecording && (
          <>
            <div
              className={cn(
                "absolute rounded-full",
                isActivelySimulating ? "bg-violet-500/20" : "bg-red-500/20",
                isLarge ? "-inset-4" : "-inset-3",
              )}
              style={{
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <div
              className={cn(
                "absolute rounded-full",
                isActivelySimulating ? "bg-violet-500/30" : "bg-red-500/30",
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
            isRecording &&
              !isActivelySimulating &&
              "shadow-xl shadow-red-500/50 bg-red-600 hover:bg-red-700",
            isRecording &&
              isActivelySimulating &&
              "shadow-xl shadow-violet-500/50 bg-violet-600 hover:bg-violet-700",
            !isRecording &&
              !disabled &&
              !isSimulatedMode &&
              "bg-gradient-to-tr from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105",
            !isRecording &&
              !disabled &&
              isSimulatedMode &&
              "bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 border-2 border-primary/30",
          )}
          onClick={
            isRecording
              ? stopRecording
              : () => startRecording({ simulated: isSimulatedMode })
          }
          disabled={disabled}
        >
          {isRecording ? (
            <Square className={cn(iconSize, "relative z-10 fill-current")} />
          ) : isSimulatedMode ? (
            <div className="relative flex items-center justify-center">
              <Mic className={cn(iconSize, "relative z-10")} />
              <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-yellow-300 z-20" />
            </div>
          ) : (
            <Mic className={cn(iconSize, "relative z-10")} />
          )}
        </Button>
      </div>

      {/* Status, Simulation Badge & Timer */}
      <div className="flex flex-col items-center text-center gap-1">
        {isActivelySimulating && (
          <Badge
            variant="outline"
            className="gap-1 border-violet-300 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[11px]"
          >
            <Sparkles className="h-3 w-3 text-violet-500" />
            {t("voice.demo.simulationBadge", "Simulovaný mikrofón (Demo)")}
          </Badge>
        )}

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
            {isActivelySimulating
              ? t(
                  "voice.demo.simulationRunning",
                  "Prebieha simulácia mikrofónu z demo nahrávky...",
                )
              : t("voice.recording.dictatePrompt", "Diktujte klinický nález...")}
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
});
