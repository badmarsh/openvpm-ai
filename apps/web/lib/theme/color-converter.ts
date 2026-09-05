/**
 * Converts colors between OKLCH, HEX, RGB, and HSL strings formatted for Tailwind CSS.
 * e.g. "214.3 31.8% 91.4%"
 */

export function rgbToHslString(r: number, g: number, b: number): string {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360 * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

export function oklchToHslString(L: number, C: number, H: number): string {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = +4.076743409 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (x: number) =>
    x <= 0.0031308
      ? 12.92 * x
      : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;
  const rByte = Math.min(255, Math.max(0, Math.round(gamma(r) * 255)));
  const gByte = Math.min(255, Math.max(0, Math.round(gamma(g) * 255)));
  const bByte = Math.min(255, Math.max(0, Math.round(gamma(b_) * 255)));
  return rgbToHslString(rByte, gByte, bByte);
}

export function hexToHsl(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let full = m[1]!;
  if (full.length === 3) {
    full = full
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return rgbToHslString(r, g, b);
}

/**
 * Normalizes any color string (OKLCH, HEX, RGB, HSL) into the "H S% L%" format
 * expected by Tailwind CSS variables. Returns the normalized string or null if unparseable.
 */
export function normalizeToHslChannels(val: string): string | null {
  const trimmed = val.trim().replace(/;$/, "");

  // 1. Raw HSL channels already (e.g. "214.3 31.8% 91.4%" or "214 32% 91%")
  if (/^[\d.]+\s+[\d.]+%?\s+[\d.]+%?$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    const h = parts[0]!;
    const s = parts[1]!.replace("%", "") + "%";
    const l = parts[2]!.replace("%", "") + "%";
    return `${h} ${s} ${l}`;
  }

  // 2. hsl(...) wrapper
  const hslMatch = /^hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*\)$/i.exec(trimmed);
  if (hslMatch) {
    return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  }

  // 3. oklch(L C H)
  const oklchMatch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(trimmed);
  if (oklchMatch) {
    return oklchToHslString(
      parseFloat(oklchMatch[1]!),
      parseFloat(oklchMatch[2]!),
      parseFloat(oklchMatch[3]!),
    );
  }

  // 4. oklch(L 0 0) or oklch(L 0)
  const oklchMono = /^oklch\(\s*([\d.]+)\s+0(?:\s+0)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(trimmed);
  if (oklchMono) {
    return oklchToHslString(parseFloat(oklchMono[1]!), 0, 0);
  }

  // 5. hex (#fff, #ffffff)
  if (trimmed.startsWith("#")) {
    return hexToHsl(trimmed);
  }

  // 6. rgb(r, g, b)
  const rgbMatch = /^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/i.exec(trimmed);
  if (rgbMatch) {
    return rgbToHslString(
      parseInt(rgbMatch[1]!, 10),
      parseInt(rgbMatch[2]!, 10),
      parseInt(rgbMatch[3]!, 10),
    );
  }

  return null;
}
