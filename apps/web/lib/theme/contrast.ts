/**
 * WCAG 2.x contrast maths for the design tokens.
 *
 * Why this exists: `--primary`, `--ring` and `--primary-foreground` are set in
 * three different places (globals.css, the GUI theme presets and the clinic's
 * own brand colour at runtime), and two of those could produce white-on-brand
 * green at 1,89 : 1 — below the 4,5 : 1 AA floor for button text and below the
 * 3 : 1 floor for focus indicators (WCAG 1.4.3 / 1.4.11).
 *
 * These helpers are pure so they can be unit-tested and reused by the runtime
 * brand appliers (`BrandTheme`, portal shell) as well as by the preset audit.
 */

import { normalizeToHslChannels, rgbToHslString } from "./color-converter";

/** sRGB triplet in 0..255. */
export type Rgb = { r: number; g: number; b: number };

/** Light-theme app background (`--background: 0 0% 100%` → white). */
export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
/** Dark-theme app background (`--background: 240 10% 3.9%`). */
export const DARK_BACKGROUND: Rgb = { r: 9, g: 9, b: 11 };
/** Near-black text used on light accents. */
export const INK: Rgb = { r: 12, g: 16, b: 14 };

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA for normal-size text and for UI components/large text (1.4.3 / 1.4.11). */
export function meetsAA(foreground: Rgb, background: Rgb, largeOrUi = false) {
  return contrastRatio(foreground, background) >= (largeOrUi ? 3 : 4.5);
}

export type Hsl = { h: number; s: number; l: number };

/** Parses `"154.9 65% 53%"`, `"hsl(...)"`, oklch, hex or `rgb()` → HSL. */
export function parseColorToHsl(value: string): Hsl | null {
  const channels = normalizeToHslChannels(value);
  if (!channels) return null;
  const m = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(channels.trim());
  if (!m) return null;
  return { h: parseFloat(m[1]!), s: parseFloat(m[2]!), l: parseFloat(m[3]!) };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  return parseColorToHsl(rgbToHslString(r, g, b)) ?? { h: 0, s: 0, l: 0 };
}

/** Back to the `"H S% L%"` channel string the CSS variables expect. */
export function hslToChannels({ h, s, l }: Hsl): string {
  const round = (n: number) => Math.round(n * 10) / 10;
  return `${round(h)} ${round(s)}% ${round(l)}%`;
}

/**
 * Moves only the lightness of `color` until it reaches `target` against
 * `background`. Hue and saturation — the brand identity — are preserved.
 * Returns the original colour when it already passes.
 */
export function withAccessibleLightness(
  color: string,
  background: Rgb,
  target = 4.5,
): string {
  const hsl = parseColorToHsl(color);
  if (!hsl) return color;
  if (contrastRatio(hslToRgb(hsl), background) >= target) return color;

  // Darken when the surface behind it is light, lighten when it is dark.
  const direction = relativeLuminance(background) > 0.5 ? -1 : 1;
  const step = 0.5;
  let best = hsl;
  let bestRatio = contrastRatio(hslToRgb(hsl), background);
  for (let l = hsl.l + direction * step; l >= 0 && l <= 100; l += direction * step) {
    const candidate = { ...hsl, l };
    const ratio = contrastRatio(hslToRgb(candidate), background);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= target) return hslToChannels(candidate);
  }
  return hslToChannels(best);
}

/**
 * A foreground (text/icon colour) that passes AA on `background`: near-black on
 * light fills, near-white on dark fills.
 */
export function readableForeground(background: Rgb): Rgb {
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background)
    ? WHITE
    : INK;
}

/**
 * `--ring` is drawn on both the light and the dark surface (the runtime brand
 * applier sets one value for both), so it needs ≥ 3 : 1 against each
 * (WCAG 1.4.11 non-text contrast for focus indicators).
 */
export function accessibleRingChannels(color: string): string {
  const hsl = parseColorToHsl(color);
  if (!hsl) return color;
  if (
    contrastRatio(hslToRgb(hsl), WHITE) >= 3 &&
    contrastRatio(hslToRgb(hsl), DARK_BACKGROUND) >= 3
  ) {
    return color;
  }
  // Feasible window: luminance between ~0.10 (3 : 1 on near-black) and ~0.30
  // (3 : 1 on white). A pale brand colour has to come down into it, a near-black
  // one has to go up — so search outwards from the current lightness and take
  // the nearest value that satisfies both, keeping the hue the clinic picked.
  for (let delta = 0.5; delta <= 100; delta += 0.5) {
    for (const l of [hsl.l - delta, hsl.l + delta]) {
      if (l < 0 || l > 100) continue;
      const candidate = { ...hsl, l };
      const rgb = hslToRgb(candidate);
      if (
        contrastRatio(rgb, WHITE) >= 3 &&
        contrastRatio(rgb, DARK_BACKGROUND) >= 3
      ) {
        return hslToChannels(candidate);
      }
    }
  }
  return color;
}

/**
 * The CSS variables a practice's brand colour expands to. Keeps the clinic's
 * hue, but guarantees the button label and the focus ring stay readable.
 */
export function brandThemeVariables(hex: string | null | undefined): Record<string, string> | null {
  const hsl = hex ? normalizeToHslChannels(hex) : null;
  if (!hsl) return null;
  const accent = parseColorToHsl(hsl);
  if (!accent) return null;
  // The accent must also work as text on the light surface (`text-primary`
  // links, active tabs) — 4,5 : 1 on white.
  const primaryChannels = withAccessibleLightness(hsl, WHITE, 4.5);
  const primary = parseColorToHsl(primaryChannels) ?? accent;
  return {
    "--primary": primaryChannels,
    "--primary-foreground": hslToChannels(
      rgbToHsl(readableForeground(hslToRgb(primary))),
    ),
    "--ring": accessibleRingChannels(primaryChannels),
  };
}
