/**
 * AI-powered PDF invoice text parser for Slovak veterinary suppliers.
 * AI endpoint is resolved from practice AI settings (Nastavenia → AI),
 * not from .env. Falls back to rule-based wholesaler-import.ts parser
 * when AI is unavailable.
 */

import {
  parseWholesalerDeliveryNote,
  detectWholesaler,
  type WholesalerDeliveryNote,
} from "@/lib/inventory/wholesaler-import";

/** AI connection config resolved from practice settings by the caller. */
export interface InvoiceParserAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PdfInvoiceItem {
  sku?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number;
  totalWithoutVat: number;
  totalWithVat: number;
}

export interface PdfInvoiceExtraction {
  supplierName: string;
  supplierIco?: string;
  invoiceNumber: string;
  issueDate: string;
  items: PdfInvoiceItem[];
  totalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  rawText?: string;
  parseMethod: "ai" | "rule-based" | "fallback";
}

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Import pdfjs-dist directly. When bundled by Next.js (not serverExternal),
  // the DOMMatrix polyfill in instrumentation.register() has already run and the
  // pdfjs-dist fake-worker handles text extraction in-process without needing a worker file.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const doc = await loadingTask.promise;
  const textParts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();

    // pdfjs-dist splits combining diacritical marks (á, č, ž, ň, ď, ľ, ť, š)
    // into separate text items. Use transform positions to join items that belong
    // to the same word without inserting a space. Items on the same baseline within
    // ~1.5× the font size are concatenated directly; otherwise a space or newline
    // separates them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>;
    let pageText = "";
    let prevY = -Infinity;
    let prevEnd = -Infinity;
    let prevFontHeight = 12;
    for (const item of items) {
      const s = item.str ?? "";
      if (!s) continue;
      const tx = item.transform;
      const x = tx ? tx[4] : prevEnd;
      const y = tx ? tx[5] : prevY;
      const fontHeight = tx ? Math.abs(tx[3] || tx[0] || 12) : prevFontHeight;
      const gap = x - prevEnd;
      const verticalShift = Math.abs(y - prevY);
      if (pageText.length === 0) {
       // first item
      } else if (verticalShift > fontHeight * 0.5) {
       pageText += "\n";
      } else if (gap > fontHeight * 0.3) {
       pageText += " ";
      }
      // else: no separator — items touching or overlapping (diacritics)
      pageText += s;
      prevY = y;
      prevEnd = x + (item.width ?? s.length * fontHeight * 0.5);
      prevFontHeight = fontHeight;
    }
    textParts.push(pageText);
    page.cleanup();
  }
  await doc.destroy();
  return textParts.join("\n");
}

export async function parsePdfInvoice(
  pdfBuffer: Buffer,
  aiConfig?: InvoiceParserAiConfig,
): Promise<PdfInvoiceExtraction> {
  let rawText = "";

  try {
    rawText = await extractPdfText(pdfBuffer);
  } catch (err) {
    console.error("[pdf-invoice-parser] PDF text extraction failed:", err);
    return buildFallbackResult(rawText);
  }

  try {
    const aiResult = aiConfig ? await parseWithAi(rawText, aiConfig) : null;
    if (aiResult && aiResult.items.length > 0) {
      return { ...aiResult, rawText, parseMethod: "ai" };
    }
  } catch (err) {
    console.warn("[pdf-invoice-parser] AI parsing failed, falling back:", err);
  }

  try {
    const wholesalerType = detectWholesaler(rawText);
    const parsed = parseWholesalerDeliveryNote({ content: rawText, wholesaler: wholesalerType });
    return wholesalerNoteToExtraction(parsed, rawText, "rule-based");
  } catch (err) {
    console.error("[pdf-invoice-parser] Rule-based parsing failed:", err);
    return buildFallbackResult(rawText);
  }
}

async function parseWithAi(
  text: string,
  config: InvoiceParserAiConfig,
): Promise<PdfInvoiceExtraction | null> {
  const prompt = [
    "Extrahujes data z faktury slovenskeho veterinarneho dodavatela.",
    "Vrat VYLUCNE validny JSON bez markdown, bez vysvetlenia.",
    "",
    "Schema:",
    "{",
    '  "supplierName": "string",',
    '  "supplierIco": "string alebo null",',
    '  "invoiceNumber": "string",',
    '  "issueDate": "YYYY-MM-DD",',
    '  "items": [',
    "    {",
    '      "sku": "string alebo null",',
    '      "name": "string - kompletny obchodny nazov produktu",',
    '      "quantity": number,',
    '      "unit": "string (ks, bal, ml, g, l, kg)",',
    '      "unitPriceWithoutVat": number,',
    '      "vatRate": number,',
    '      "totalWithoutVat": number,',
    '      "totalWithVat": number',
    "    }",
    "  ],",
    '  "totalWithoutVat": number,',
    '  "totalVat": number,',
    '  "totalWithVat": number',
    "}",
    "",
    "Pravidla:",
    "- Zaporne mnozstva su dobropisy - ponechaj ich zaporne.",
    "- Dopravne/expresne poplatky vynechaj.",
    "- Cisla s desatinnou ciarkou prevadzaj na desatinnu bodku.",
    "- issueDate: datum vystavenia faktury vo formate YYYY-MM-DD.",
    "",
    "Text faktury:",
    text.substring(0, 8000),
  ].join("\n");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = "Bearer " + config.apiKey;
  }
  const cleanBase = config.baseUrl.replace(/\/+$/, "");
  const response = await fetch(cleanBase + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error("AI API error " + response.status + ": " + (await response.text()));
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = (data.choices?.[0]?.message?.content ?? "").trim();

  // Strip markdown code fences if the model returns them
  let jsonStr = raw;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(jsonStr) as {
    supplierName: string;
    supplierIco?: string;
    invoiceNumber: string;
    issueDate: string;
    items: PdfInvoiceItem[];
    totalWithoutVat: number;
    totalVat: number;
    totalWithVat: number;
  };

  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;

  return {
    supplierName: parsed.supplierName || "Neznamy dodavatel",
    supplierIco: parsed.supplierIco || undefined,
    invoiceNumber: parsed.invoiceNumber || "INV-" + Date.now(),
    issueDate: parsed.issueDate || new Date().toISOString().slice(0, 10),
    items: parsed.items.map((it) => ({
      sku: it.sku || undefined,
      name: it.name,
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "ks",
      unitPriceWithoutVat: Number(it.unitPriceWithoutVat) || 0,
      vatRate: Number(it.vatRate) || 10,
      totalWithoutVat: Number(it.totalWithoutVat) || 0,
      totalWithVat: Number(it.totalWithVat) || 0,
    })),
    totalWithoutVat: Number(parsed.totalWithoutVat) || 0,
    totalVat: Number(parsed.totalVat) || 0,
    totalWithVat: Number(parsed.totalWithVat) || 0,
    parseMethod: "ai",
  };
}

function wholesalerNoteToExtraction(
  note: WholesalerDeliveryNote,
  rawText: string,
  method: "rule-based" | "fallback"
): PdfInvoiceExtraction {
  return {
    supplierName: note.supplierName,
    supplierIco: note.supplierIco,
    invoiceNumber: note.deliveryNoteNumber,
    issueDate: note.issueDate,
    items: note.items.map((it) => ({
      sku: it.sku,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPriceWithoutVat: it.unitPriceWithoutVat,
      vatRate: it.vatRate,
      totalWithoutVat: it.totalWithoutVat,
      totalWithVat: it.totalWithVat,
    })),
    totalWithoutVat: note.totalWithoutVat,
    totalVat: note.totalVat,
    totalWithVat: note.totalWithVat,
    rawText,
    parseMethod: method,
  };
}

function buildFallbackResult(rawText: string): PdfInvoiceExtraction {
  return {
    supplierName: "Neznamy dodavatel",
    invoiceNumber: "INV-" + Date.now().toString().slice(-6),
    issueDate: new Date().toISOString().slice(0, 10),
    items: [],
    totalWithoutVat: 0,
    totalVat: 0,
    totalWithVat: 0,
    rawText,
    parseMethod: "fallback",
  };
}
