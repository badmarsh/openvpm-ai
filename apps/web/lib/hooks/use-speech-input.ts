"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type SpeechState = "idle" | "listening" | "unsupported";

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
    if (!supported) return;
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
    rec.onerror = () => {
      setState("idle");
      setInterim("");
      recRef.current = null;
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
    (rec as any).start();
  }, [supported, lang, append, getValue, setValue]);

  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else start();
  }, [state, start, stop]);

  return { state, interim, toggle, supported };
}
