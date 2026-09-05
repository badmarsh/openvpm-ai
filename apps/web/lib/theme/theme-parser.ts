import { normalizeToHslChannels } from "./color-converter";

export interface ParsedThemeSet {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Parses raw CSS text copied from tweakcn.com (or shadcn themes) and extracts
 * the light and dark mode CSS variables, converting colors into Tailwind v3 HSL values.
 */
export function parseTweakcnCss(cssText: string): ParsedThemeSet {
  const result: ParsedThemeSet = {
    light: {},
    dark: {},
  };

  // Find blocks for :root and .dark
  // e.g. :root { ... } and .dark { ... }
  const rootBlockMatch = /:root\s*\{([^}]+)\}/i.exec(cssText);
  const darkBlockMatch = /\.dark\s*\{([^}]+)\}/i.exec(cssText);

  function parseBlock(blockText: string, target: Record<string, string>) {
    const lines = blockText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("--")) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      const varName = trimmed.slice(0, colonIdx).trim();
      const rawVal = trimmed.slice(colonIdx + 1).replace(/;$/, "").trim();

      // Normalize color variables
      const hsl = normalizeToHslChannels(rawVal);
      if (hsl) {
        target[varName] = hsl;
      } else if (
        varName === "--radius" ||
        varName.startsWith("--shadow") ||
        varName.startsWith("--font-")
      ) {
        target[varName] = rawVal;
      }
    }
  }

  if (rootBlockMatch && rootBlockMatch[1]) {
    parseBlock(rootBlockMatch[1], result.light);
  }

  if (darkBlockMatch && darkBlockMatch[1]) {
    parseBlock(darkBlockMatch[1], result.dark);
  }

  // If no :root was found but lines with --variable exist, parse them into light
  if (Object.keys(result.light).length === 0 && !rootBlockMatch) {
    parseBlock(cssText, result.light);
  }

  return result;
}
