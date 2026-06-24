"use client";

import { useEffect, useState } from "react";

/** Find the element marked with the given `data-tour` value. */
export function findTourAnchor(anchor: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
}

/**
 * Resolve (and keep updated) the viewport rect of a `data-tour` anchor. Polls
 * briefly for the element (it may mount after a route change) and tracks scroll
 * + resize. Returns null when there is no anchor or it never appears, so the
 * caller can fall back to a centered card instead of deadlocking.
 */
export function useAnchorRect(anchor: string | undefined, dep: unknown): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    let raf = 0;
    let tries = 0;
    let active = true;

    const update = (): boolean => {
      const el = findTourAnchor(anchor);
      if (el) {
        setRect(el.getBoundingClientRect());
        return true;
      }
      return false;
    };

    const poll = () => {
      if (!active) return;
      if (update()) return;
      if (tries++ < 90) raf = requestAnimationFrame(poll); // ~1.5s @ 60fps
    };
    poll();

    const onChange = () => {
      if (active) update();
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [anchor, dep]);

  return rect;
}
