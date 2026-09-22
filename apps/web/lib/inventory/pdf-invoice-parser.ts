/**
 * AI-powered PDF invoice text parser for Slovak veterinary suppliers.
 * Uses OpenCodex Gemini proxy to extract structured invoice data from PDF text.
 * Falls back to rule-based wholesaler-import.ts parser when AI is unavailable.
 */

import {
  parseWholesalerDeliveryNote,
  detectWholesaler,
  type WholesalerDeliveryNote,
} from "@/lib/inventory/wholesaler-import";

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  "C:\\Users\\marek\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const AI_BASE_URL =
  process.env.OPENAI_BASE_URL || "http://127.0.0.1:10100/v1";
const AI_MODEL =
  process.env.INVOICE_PARSE_MODEL || "google-antigravity/gemini-3.1-flash-image";

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
  // Import pdfjs-dist directly. Setting workerSrc to "" disables the fake-worker
  // mechanism that tries to load pdf.worker.mjs, absent in Next.js standalone builds.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    // Locate the worker file. In Next.js standalone builds the worker is included
  // via outputFileTracingIncludes and available at its npm path.
  const workerPath = require.resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = "file://" + workerPath;
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const doc = await loadingTask.promise;
  const textParts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ");
    textParts.push(pageText);
    page.cleanup();
  }
  await doc.destroy();
  return textParts.join("\n");
}

export async function parsePdfInvoice(pdfBuffer: Buffer): Promise<PdfInvoiceExtraction> {
  let rawText = "";

  try {
    rawText = await extractPdfText(pdfBuffer);
  } catch (err) {
    console.error("[pdf-invoice-parser] PDF text extraction failed:", err);
    return buildFallbackResult(rawText);
  }

  try {
    const aiResult = await parseWithGemini(rawText);
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

async function parseWithGemini(text: string): Promise<PdfInvoiceExtraction | null> {
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

  const response = await fetch(AI_BASE_URL + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
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
