"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "error" | "unsupported";

interface UseSpeechInputOptions {
  /** Jazyk rozpoznávania, predvolene sk-SK */
  lang?: string;
  /** Ak true, nový text sa pripíše za existujúci */
  append?: boolean;
}

/**
 * useSpeechInput — ľahký hook pre inline hlasový vstup do formulárového poľa.
 * Používa Web Speech API priamo v prehliadači, žiadny backend, funguje offline.
 */
export function useSpeechInput(
  setValue: (v: string) => void,
  getValue: () => string,
  options: UseSpeechInputOptions = {}
) {
  const { lang = "sk-SK", append = true } = options;
  const [state, setState] = useState<SpeechState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<unknown>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!supported) setState("unsupported");
  }, [supported]);

  const stop = useCallback(() => {
    (recRef.current as any)?.stop();
    recRef.current = null;
    setInterim("");
    setState("idle");
  }, []);

  const start = useCallback(() => {
    if (!supported || state === "processing") return;
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setState("listening");
    rec.onend = () => {
      setState("idle");
      setInterim("");
      recRef.current = null;
    };
    rec.onerror = (event: { error?: string }) => {
      // Permission/network errors are expected on farm visits. Keep the field
      // usable and expose a short-lived, actionable state instead of throwing.
      setError(event.error === "not-allowed" ? "microphone-denied" : "microphone-unavailable");
      setState("error");
      setInterim("");
      recRef.current = null;
      window.setTimeout(() => setState("idle"), 2500);
    };

    rec.onresult = (ev: unknown) => {
      let finalText = "";
      let interimText = "";
      const e = ev as any; for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interimText += e.results[i][0].transcript;
        }
      }
      setInterim(interimText);
      if (finalText) {
        const cleaned = finalText.trim();
        const formatted =
          cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        const current = getValue();
        setValue(append && current ? current + " " + formatted : formatted);
        setInterim("");
      }
    };

    recRef.current = rec as unknown;
    try {
      (rec as any).start();
      setState("processing");
    } catch {
      setError("microphone-unavailable");
      setState("error");
      recRef.current = null;
    }
  }, [supported, state, lang, append, getValue, setValue]);

  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else start();
  }, [state, start, stop]);

  return { state, interim, error, toggle, supported };
}
