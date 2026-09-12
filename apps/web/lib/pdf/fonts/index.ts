import type jsPDF from "jspdf";
import { ROBOTO_REGULAR_TTF_BASE64 } from "./roboto-regular";
import { ROBOTO_BOLD_TTF_BASE64 } from "./roboto-bold";
import { ROBOTO_ITALIC_TTF_BASE64 } from "./roboto-italic";
import { ROBOTO_BOLD_ITALIC_TTF_BASE64 } from "./roboto-bold-italic";

/**
 * Embedded Roboto (Google Fonts, SIL OFL 1.1 — see ./LICENSE-FONT.txt).
 *
 * The standard PDF 14 fonts (Helvetica family) only carry WinAnsiEncoding,
 * which lacks several Slovak letters (č, ď, ľ, ĺ, ň, ť, ŕ and capitals).
 * Roboto contains the full Latin + Latin Extended-A glyph set so exported
 * PDFs keep their diacritics. All four static instances are registered so
 * bold / italic / bold-italic markup renders with real glyphs too.
 *
 * jsPDF's virtual file system (`doc.internal.vFS`) is PER DOCUMENT INSTANCE,
 * so the fonts must be added to every jsPDF document after construction.
 * A variable font (e.g. Roboto Flex) cannot be used here: jsPDF embeds one
 * static TTF per (family, style) and ignores variation (`fvar/gvar`)
 * tables, so the four static instances above are what PDF consumers need.
 */
export const PDF_FONT_FAMILY = "Roboto";

interface EmbeddedFont {
  vfsFileName: string;
  data: string;
  style: string;
}

const FONTS: EmbeddedFont[] = [
  {
    vfsFileName: "Roboto-Regular.ttf",
    data: ROBOTO_REGULAR_TTF_BASE64,
    style: "normal",
  },
  {
    vfsFileName: "Roboto-Bold.ttf",
    data: ROBOTO_BOLD_TTF_BASE64,
    style: "bold",
  },
  {
    vfsFileName: "Roboto-Italic.ttf",
    data: ROBOTO_ITALIC_TTF_BASE64,
    style: "italic",
  },
  {
    vfsFileName: "Roboto-BoldItalic.ttf",
    data: ROBOTO_BOLD_ITALIC_TTF_BASE64,
    style: "bolditalic",
  },
];

/**
 * Register the Unicode Roboto family on a freshly created jsPDF document
 * and select the regular style as the default. Call once per `new jsPDF()`.
 *
 * Do NOT pass addFont's 4th `fontWeight` argument: jsPDF 4.x concatenates it
 * onto the style key (producing e.g. "boldbold"), which breaks the
 * setFont("Roboto", "bold") lookup and silently falls back to Times.
 */
export function registerUnicodeFonts(doc: jsPDF): jsPDF {
  for (const font of FONTS) {
    doc.addFileToVFS(font.vfsFileName, font.data);
    doc.addFont(font.vfsFileName, PDF_FONT_FAMILY, font.style);
  }
  doc.setFont(PDF_FONT_FAMILY, "normal");
  return doc;
}

/**
 * All Slovak-relevant code points the embedded family must cover. Used by
 * the font smoke test so a future font swap cannot silently regress
 * diacritics.
 */
export const SLOVAK_REQUIRED_CODE_POINTS: number[] = [
  // á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž
  ...["á", "ä", "č", "ď", "é", "í", "ĺ", "ľ", "ň", "ó", "ô", "ŕ", "š", "ť", "ú", "ý", "ž"].map(
    (ch) => ch.codePointAt(0)!,
  ),
  // Á Ä Č Ď É Í Ĺ Ľ Ň Ó Ô Ŕ Š Ť Ú Ý Ž
  ...["Á", "Ä", "Č", "Ď", "É", "Í", "Ĺ", "Ľ", "Ň", "Ó", "Ô", "Ŕ", "Š", "Ť", "Ú", "Ý", "Ž"].map(
    (ch) => ch.codePointAt(0)!,
  ),
  // Common Central European neighbours seen in SK data (Czech/German names).
  ...["ě", "Ě", "ř", "Ř", "ů", "Ů", "ü", "Ü", "ö", "Ö", "ő", "ű"].map(
    (ch) => ch.codePointAt(0)!,
  ),
];
