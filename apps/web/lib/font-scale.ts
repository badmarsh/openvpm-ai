/**
 * Dashboard font-scale preference (per-device UI setting).
 *
 * The scale is applied as `data-font-scale` on <html> and takes effect via
 * `apps/web/styles/globals.css`, which bumps the root font-size. Tailwind
 * utilities are rem-based, so the whole dashboard scales proportionally.
 * Pixel-anchored chrome (borders, 1px hairlines) is intentionally unaffected.
 */

export type FontScale = "standard" | "large" | "xl";

export const FONT_SCALE_STORAGE_KEY = "openvpm_font_scale";

export const FONT_SCALES: FontScale[] = ["standard", "large", "xl"];

export function readFontScale(): FontScale {
  if (typeof window === "undefined") return "standard";
  try {
    const raw = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (raw === "large" || raw === "xl" || raw === "standard") return raw;
  } catch {
    // Private browsing / disabled storage — fall through to default.
  }
  return "standard";
}

export function applyFontScale(scale: FontScale): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (scale === "standard") {
    root.removeAttribute("data-font-scale");
  } else {
    root.setAttribute("data-font-scale", scale);
  }
  try {
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  } catch {
    // Non-fatal: the scale still applies for this session.
  }
}
