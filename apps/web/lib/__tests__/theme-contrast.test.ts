import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_PRESETS } from "@/lib/theme/presets";
import {
  accessibleRingChannels,
  brandThemeVariables,
  contrastRatio,
  hslToRgb,
  parseColorToHsl,
} from "@/lib/theme/contrast";

/** WCAG 2.x thresholds. */
const AA_TEXT = 4.5;
const AA_UI = 3;

type Rgb = { r: number; g: number; b: number };

function rgb(channels: string): Rgb {
  const hsl = parseColorToHsl(channels);
  if (!hsl) throw new Error(`unparseable colour: ${channels}`);
  return hslToRgb(hsl);
}

/** Pairs whose contrast is a WCAG requirement, not a taste decision. */
const REQUIRED_PAIRS: Array<[string, string, number]> = [
  ["--primary", "--primary-foreground", AA_TEXT],
  ["--primary", "--background", AA_TEXT], // `text-primary` links, active tabs
  ["--ring", "--background", AA_UI], // focus indicator (1.4.11)
  ["--success", "--success-foreground", AA_TEXT],
  ["--warning", "--warning-foreground", AA_TEXT],
  ["--info", "--info-foreground", AA_TEXT],
  ["--destructive", "--destructive-foreground", AA_TEXT],
  ["--muted", "--muted-foreground", AA_TEXT],
  ["--sidebar-primary", "--sidebar-primary-foreground", AA_TEXT],
];

function parseCssBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector} block in globals.css`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("\n  }", start));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*([\d.]+ [\d.]+% [\d.]+%);/g)) {
    tokens[match[1]!] = match[2]!;
  }
  return tokens;
}

describe("design token contrast (WCAG 2.x AA)", () => {
  const css = readFileSync("styles/globals.css", "utf8");
  const themes = [
    ["light (:root)", parseCssBlock(css, ":root")],
    ["dark (.dark)", parseCssBlock(css, ".dark")],
  ] as const;

  it.each(themes)("%s meets AA for every foreground/background pair", (_name, tokens) => {
    for (const [foreground, background, minimum] of REQUIRED_PAIRS) {
      const fg = tokens[foreground];
      const bg = tokens[background];
      if (!fg || !bg) continue; // token not defined in this theme
      const ratio = contrastRatio(rgb(fg), rgb(bg));
      expect(
        ratio,
        `${foreground} (${fg}) on ${background} (${bg}) = ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("declares color-scheme for both palettes so native widgets follow the theme", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/s);
    expect(css).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/s);
  });

  it("honours prefers-reduced-motion instead of animating unconditionally", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toMatch(/\.animate-pulse,[\s\S]*?animation: none !important/);
    // Fades stay (they carry state), travel/scale/rotate go.
    expect(css).toContain("--tw-enter-translate-x: 0 !important");
  });
});

describe("GUI theme presets", () => {
  it("every preset meets AA in both modes", () => {
    const failures: string[] = [];
    for (const preset of THEME_PRESETS) {
      for (const mode of ["light", "dark"] as const) {
        const tokens = preset[mode];
        for (const [foreground, background, minimum] of REQUIRED_PAIRS) {
          const fg = tokens[foreground];
          const bg = tokens[background];
          if (!fg || !bg) continue;
          const ratio = contrastRatio(rgb(fg), rgb(bg));
          if (ratio < minimum) {
            failures.push(
              `${preset.id}/${mode}: ${foreground} (${fg}) on ${background} (${bg}) = ${ratio.toFixed(2)}:1 < ${minimum}:1`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("clinic brand colour (runtime input)", () => {
  const cases = [
    ["#39d594", "the bright Supabase emerald"],
    ["#facc15", "a pale yellow"],
    ["#111827", "a near-black navy"],
    ["#f97316", "orange"],
    ["#0d9488", "clinical teal"],
  ] as const;

  it.each(cases)("keeps button text and focus ring readable for %s (%s)", (hex) => {
    const vars = brandThemeVariables(hex);
    expect(vars).not.toBeNull();
    const primary = rgb(vars!["--primary"]!);
    const label = rgb(vars!["--primary-foreground"]!);
    expect(contrastRatio(primary, label)).toBeGreaterThanOrEqual(AA_TEXT);
    // `text-primary` is used as link/tab text on the light surface.
    expect(contrastRatio(primary, rgb("0 0% 100%"))).toBeGreaterThanOrEqual(AA_TEXT);
    const ring = rgb(vars!["--ring"]!);
    expect(contrastRatio(ring, rgb("0 0% 100%"))).toBeGreaterThanOrEqual(AA_UI);
    expect(contrastRatio(ring, rgb("240 10% 3.9%"))).toBeGreaterThanOrEqual(AA_UI);
  });

  it("returns null for unusable input so callers fall back to the defaults", () => {
    expect(brandThemeVariables(null)).toBeNull();
    expect(brandThemeVariables("not-a-colour")).toBeNull();
  });

  it("leaves an already-accessible ring untouched", () => {
    expect(accessibleRingChannels("153 60% 32%")).toBe("153 60% 32%");
  });
});
