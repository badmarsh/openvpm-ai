"use client";

import { useEffect, useRef } from "react";

/**
 * USB barcode scanner support.
 *
 * USB scanners behave like a keyboard: they type the scanned code rapidly and
 * terminate it with Enter. This hook buffers printable keystrokes while the
 * user is NOT focused on an input/textarea/select and invokes `onScan` when the
 * terminator key arrives. Rapid input (> ~50ms between keys is treated as
 * human typing) resets the buffer so manual keyboard use never fires scans.
 */

export interface BarcodeScannerOptions {
  /** Enable/disable listening (e.g. when a modal is open). */
  enabled?: boolean;
  /** Minimum length for a code to be accepted. */
  minLength?: number;
  /** Key that terminates a scan. */
  terminator?: string;
  onScan: (code: string) => void;
}

/**
 * True when the event target is a form field that should own the keystrokes.
 * Accepts a structural element shape so it stays testable without a DOM.
 */
export function isTypingTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined
): boolean {
  if (!target || typeof target.tagName !== "string") return false;
  const tag = target.tagName.toUpperCase();
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable === true
  );
}

/** Normalizes a raw scanned code (trims whitespace/control chars). */
export function normalizeBarcode(raw: string): string {
  // Strip non-printing characters, keep digits/letters/punctuation of a code.
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

const SCAN_RESET_MS = 50;

export function useBarcodeScanner({
  enabled = true,
  minLength = 3,
  terminator = "Enter",
  onScan,
}: BarcodeScannerOptions): void {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (isTypingTarget(target ? { tagName: target.tagName, isContentEditable: target.isContentEditable } : null)) {
        return;
      }

      if (event.key === terminator) {
        event.preventDefault();
        const code = normalizeBarcode(bufferRef.current);
        bufferRef.current = "";
        clearTimer();
        if (code.length >= minLength) onScanRef.current(code);
        return;
      }

      // Printable single characters only (no modifier combos).
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        bufferRef.current += event.key;
        clearTimer();
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, SCAN_RESET_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimer();
    };
  }, [enabled, minLength, terminator]);
}
