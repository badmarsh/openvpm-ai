import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import {
  PDF_FONT_FAMILY,
  SLOVAK_REQUIRED_CODE_POINTS,
  registerUnicodeFonts,
} from "../fonts";
import { ROBOTO_REGULAR_TTF_BASE64 } from "../fonts/roboto-regular";
import { ROBOTO_BOLD_TTF_BASE64 } from "../fonts/roboto-bold";
import { ROBOTO_ITALIC_TTF_BASE64 } from "../fonts/roboto-italic";
import { ROBOTO_BOLD_ITALIC_TTF_BASE64 } from "../fonts/roboto-bold-italic";
import { generateDischargeInstructions, sanitizeForPdf } from "../../pdf";

const SLOVAK_SAMPLE =
  "č, š, ž, ý, á, í, ä, ú, ô, ľ, ĺ, ŕ, ń, ď, ť, ň, Č, Š, Ž, Ý, Á, Í, Ľ, Ĺ, Ŕ, Ń, Ď, Ť";

/**
 * Parse every ToUnicode CMap embedded in a PDF and return the set of
 * Unicode code points it maps glyphs back to. Handles both bfchar pairs
 * and bfrange spans (jsPDF may emit either).
 */
function toUnicodeCodePoints(pdf: ArrayBuffer): Set<number> {
  const raw = Buffer.from(pdf).toString("latin1");
  const points = new Set<number>();

  for (const block of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1]!.matchAll(/<([0-9a-fA-F]{4,6})>\s*<([0-9a-fA-F]{4,6})>/g)) {
      points.add(parseInt(pair[2]!, 16));
    }
  }
  for (const block of raw.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1]!.matchAll(
      /<([0-9a-fA-F]{4,6})>\s*<([0-9a-fA-F]{4,6})>\s*<([0-9a-fA-F]{4,6})>/g,
    )) {
      const span = parseInt(range[2]!, 16) - parseInt(range[1]!, 16);
      const start = parseInt(range[3]!, 16);
      for (let i = 0; i <= span; i++) points.add(start + i);
    }
  }
  return points;
}

describe("embedded Unicode Roboto fonts (I18N-COLLISION-5)", () => {
  it("ships four static TTF instances (regular, bold, italic, bold italic)", () => {
    for (const data of [
      ROBOTO_REGULAR_TTF_BASE64,
      ROBOTO_BOLD_TTF_BASE64,
      ROBOTO_ITALIC_TTF_BASE64,
      ROBOTO_BOLD_ITALIC_TTF_BASE64,
    ]) {
      expect(data).toMatch(/^[A-Za-z0-9+/=]+$/);
      const bytes = Buffer.from(data, "base64");
      // sfnt version: 0x00010000 (TTF), 'true', or 'OTTO'.
      expect([0x00010000, 0x74727565, 0x4f54544f]).toContain(
        bytes.readUInt32BE(0),
      );
      expect(bytes.length).toBeGreaterThan(50_000);
    }
  });

  it("registers all four styles so setFont never falls back to Times", () => {
    const doc = registerUnicodeFonts(new jsPDF()) as unknown as {
      setFont: (family: string, style: string) => unknown;
      getFont: () => {
        fontName: string;
        fontStyle: string;
        postScriptName: string;
      };
      getFontList: () => Record<string, string[]>;
    };

    const styles = doc.getFontList()[PDF_FONT_FAMILY]!;
    expect(styles).toEqual(
      expect.arrayContaining(["normal", "bold", "italic", "bolditalic"]),
    );

    const expected: Record<string, string> = {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Bold.ttf",
      italic: "Roboto-Italic.ttf",
      bolditalic: "Roboto-BoldItalic.ttf",
    };
    for (const [style, postScriptName] of Object.entries(expected)) {
      doc.setFont(PDF_FONT_FAMILY, style);
      const active = doc.getFont();
      expect(active.fontName).toBe(PDF_FONT_FAMILY);
      expect(active.fontStyle).toBe(style);
      expect(active.postScriptName).toBe(postScriptName);
    }
  });

  it("every registered style has glyphs for all Slovak code points", () => {
    const doc = registerUnicodeFonts(new jsPDF()) as unknown as {
      setFont: (family: string, style: string) => unknown;
      getFont: () => {
        fontStyle: string;
        metadata: {
          cmap: { unicode: { codeMap: Record<number, unknown> } };
        };
      };
    };

    for (const style of ["normal", "bold", "italic", "bolditalic"]) {
      doc.setFont(PDF_FONT_FAMILY, style);
      const codeMap = doc.getFont().metadata.cmap.unicode.codeMap;
      const missing = SLOVAK_REQUIRED_CODE_POINTS.filter(
        (cp) => !(codeMap[cp] as number | undefined),
      );
      expect(
        missing.map((cp) => String.fromCodePoint(cp)),
        `${style} missing glyphs`,
      ).toEqual([]);
    }
  });

  it("embeds one TrueType program per style (four total) with Identity-H", () => {
    const doc = registerUnicodeFonts(new jsPDF());
    const styleY: Record<string, number> = {
      normal: 20,
      bold: 35,
      italic: 50,
      bolditalic: 65,
    };
    for (const style of ["normal", "bold", "italic", "bolditalic"]) {
      doc.setFont(PDF_FONT_FAMILY, style);
      doc.setFontSize(12);
      doc.text(`${SLOVAK_SAMPLE} ${style}`, 10, styleY[style]!);
    }
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");

    expect(raw).toContain("/BaseFont /Roboto");
    expect(raw).toContain("/Identity-H");
    expect(raw).toContain("/ToUnicode");
    // Four subset font programs: regular, bold, italic, bold italic.
    expect((raw.match(/\/FontFile2\b/g) ?? []).length).toBe(4);
    expect((raw.match(/\/ToUnicode\s+\d+\s+0\s+R/g) ?? []).length).toBe(4);
  });

  it("maps every used Slovak character back through ToUnicode", () => {
    const doc = registerUnicodeFonts(new jsPDF());
    doc.setFont(PDF_FONT_FAMILY, "normal");
    doc.text(SLOVAK_SAMPLE, 10, 10);

    const covered = toUnicodeCodePoints(doc.output("arraybuffer"));
    const required = new Set(
      SLOVAK_SAMPLE.replace(/,\s*/g, "").split("").map((ch) => ch.codePointAt(0)!),
    );
    const missing = [...required]
      .filter((cp) => !covered.has(cp))
      .map((cp) => String.fromCodePoint(cp));
    expect(missing).toEqual([]);
  });

  it("production generators embed Roboto and no longer strip diacritics", () => {
    // sanitizeForPdf is now a pass-through because Roboto covers the glyphs.
    expect(sanitizeForPdf("č, š, ž, ý, á, í, ä, ú, ô, ľ, ĺ, ŕ, ń, ď, ť")).toBe(
      "č, š, ž, ý, á, í, ä, ú, ô, ľ, ĺ, ŕ, ń, ď, ť",
    );

    const doc = generateDischargeInstructions({
      practiceName: "Veterinárna klinika MVDr. Ján Kováč",
      practicePhone: "+421 905 111 222",
      patientName: "Dunčo",
      species: "Pes",
      clientName: "Ján Novák",
      visitDate: "2026-08-24",
      doctorName: "MVDr. Peter Kováč",
      diagnosis: "Gastroenteritída s hnačkou",
      medications: [
        {
          name: "Amoksiklav 500mg",
          dosage: "1 tableta",
          frequency: "každých 12 hodín",
          instructions: "Podávať s jedlom.",
        },
      ],
      instructions: ["Diéta: varená ryža s kuracím mäsom."],
      emergencyNotes: "Pri opakovanom vracaní vyhľadajte pohotovosť.",
      locale: "sk",
    });
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    expect(raw).toContain("/BaseFont /Roboto");
    expect(raw).toContain("/Identity-H");

    // Every Slovak-specific glyph actually used in the document must be
    // mapped through ToUnicode (subset embeds only used glyphs).
    const used = new Set(
      [
        ..."Veterinárna klinika Ján Kováč Dunčo Novák Gastroenteritída " +
          "hnačkou Amoksiklav kaž hodín Podávať jedlom Diéta varená ryža " +
          "kuracím mäsom opakovanom vracaní vyhľadajte pohotovosť Pes",
      ]
        .join("")
        .split("")
        .map((ch) => ch.codePointAt(0)!),
    );
    const covered = toUnicodeCodePoints(doc.output("arraybuffer"));
    const missing = [...used]
      .filter((cp) => cp > 127 && !covered.has(cp))
      .map((cp) => String.fromCodePoint(cp));
    expect(missing).toEqual([]);
  });

  it("renders bold and italic variants visibly different from regular", () => {
    const widths: Record<string, number> = {};
    for (const style of ["normal", "bold", "italic", "bolditalic"]) {
      const doc = registerUnicodeFonts(new jsPDF());
      doc.setFont(PDF_FONT_FAMILY, style);
      doc.setFontSize(12);
      widths[style] = doc.getTextWidth("Slovenská veterinárna klinika");
    }
    expect(widths.bold).not.toBe(widths.normal);
    expect(widths.italic).not.toBe(widths.normal);
    expect(widths.bolditalic).not.toBe(widths.normal);
  });
});
