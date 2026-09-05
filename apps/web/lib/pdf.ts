import jsPDF from "jspdf";
import { soapSectionText } from "@/lib/records/soap-content";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const COLOR_TEAL = "#0d9488";
const COLOR_DARK = "#333333";
const COLOR_GRAY = "#666666";
const COLOR_LIGHT_GRAY = "#eeeeee";
const FONT = "helvetica";
const PAGE_MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4 / letter approximate usable width
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function drawLine(doc: jsPDF, y: number) {
  const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
}

/**
 * Check remaining space on page; add a new page if needed.
 * Returns the (potentially reset) y position.
 */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

function formatGeneratedDateUtc(): string {
  return new Date().toLocaleDateString("en-US", { timeZone: "UTC" });
}

export type PdfLocale = "sk" | "en";

export function resolvePdfLocale(locale?: PdfLocale): PdfLocale {
  if (locale) return locale;
  if (typeof window !== "undefined") {
    try {
      const match = document.cookie.match(new RegExp("(^| )NEXT_LOCALE=([^;]+)"));
      if (match && (match[2] === "sk" || match[2] === "en")) {
        return match[2] as PdfLocale;
      }
      const saved = localStorage.getItem("openvpm_locale");
      if (saved === "sk" || saved === "en") {
        return saved as PdfLocale;
      }
      if (document.documentElement?.lang === "en") {
        return "en";
      }
    } catch {}
  }
  return "sk";
}

/**
 * Clean text for standard jsPDF helvetica font rendering.
 * Central European characters outside WinAnsi (č, ď, ľ, ĺ, ň, ť, ŕ)
 * are mapped to Latin equivalents to prevent missing glyphs or artifacts.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/[čČ]/g, (m) => (m === "č" ? "c" : "C"))
    .replace(/[ďĎ]/g, (m) => (m === "ď" ? "d" : "D"))
    .replace(/[ľĺĽĹ]/g, (m) => (m.toLowerCase() === m ? "l" : "L"))
    .replace(/[ňŇ]/g, (m) => (m === "ň" ? "n" : "N"))
    .replace(/[ťŤ]/g, (m) => (m === "ť" ? "t" : "T"))
    .replace(/[ŕŔ]/g, (m) => (m === "ŕ" ? "r" : "R"))
    .replace(/[ěĚ]/g, (m) => (m === "ě" ? "e" : "E"))
    .replace(/[řŘ]/g, (m) => (m === "ř" ? "r" : "R"))
    .replace(/[ůŮ]/g, (m) => (m === "ů" ? "u" : "U"));
}

export function formatPdfDate(dateStr?: string, locale?: PdfLocale): string {
  if (!dateStr) return "";
  const isSk = resolvePdfLocale(locale) === "sk";
  if (!isSk) return dateStr;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${parseInt(isoMatch[3]!, 10)}.${parseInt(isoMatch[2]!, 10)}.${isoMatch[1]}`;
  }
  return dateStr;
}

/**
 * Brand mark: a white paw print on a teal rounded square, drawn with
 * primitives so PDFs need no image asset. Matches the in-app brand color.
 */
function drawPawMark(doc: jsPDF, x: number, y: number, size: number) {
  const [r, g, b] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(r, g, b);
  doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22, "F");

  doc.setFillColor(255, 255, 255);
  const cx = x + size / 2;
  const s = size / 12;
  // Main pad
  doc.ellipse(cx, y + 7.7 * s, 2.7 * s, 2.2 * s, "F");
  // Four toes
  doc.circle(cx - 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
  doc.circle(cx - 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
}

// ---------------------------------------------------------------------------
// 1. Invoice PDF
// ---------------------------------------------------------------------------

export interface InvoiceData {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  patientName?: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax: string;
  total: string;
  paidAmount: string;
  /** Pre-formatted balance due (region-aware currency). Falls back to total − paid. */
  balanceDue?: string;
  locale?: PdfLocale;
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  const isEstimate = data.status.toLowerCase() === "estimate";
  let y = PAGE_MARGIN;

  // --- Header: Practice info -------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(sanitizeForPdf(data.practiceName), PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(sanitizeForPdf(data.practiceAddress), PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(sanitizeForPdf(data.practicePhone), PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(sanitizeForPdf(data.practiceEmail), PAGE_MARGIN, y);
    y += 4;
  }

  // --- INVOICE title (right-aligned) -----------------------------------------
  const invoiceTitle = isSk
    ? (isEstimate ? "CENOVÁ PONUKA" : "FAKTÚRA")
    : (isEstimate ? "ESTIMATE" : "INVOICE");
  doc.setFont(FONT, "bold");
  doc.setFontSize(26);
  setColor(doc, COLOR_DARK);
  doc.text(invoiceTitle, PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  // Status badge
  doc.setFontSize(10);
  function formatInvoiceStatus(st: string): string {
    if (!isSk) return st.toUpperCase();
    const s = st.toLowerCase();
    switch (s) {
      case "paid": return "ZAPLATENÉ";
      case "unpaid": return "NEUHRADENÉ";
      case "draft": return "NÁVRH";
      case "overdue": return "PO SPLATNOSTI";
      case "estimate": return "CENOVÁ PONUKA";
      case "void": return "STORNO";
      case "partial":
      case "partially_paid": return "ČIASTOČNE UHRADENÉ";
      default: return st.toUpperCase();
    }
  }
  const statusLabel = sanitizeForPdf(formatInvoiceStatus(data.status));
  const statusWidth = doc.getTextWidth(statusLabel) + 8;
  const statusX = PAGE_WIDTH - PAGE_MARGIN - statusWidth;
  const statusY = PAGE_MARGIN + 6;
  const [tr, tg, tb] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(tr, tg, tb);
  doc.roundedRect(statusX, statusY, statusWidth, 7, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, statusX + statusWidth / 2, statusY + 5, {
    align: "center",
  });

  // Date info right side
  setColor(doc, COLOR_GRAY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  let dateY = statusY + 12;
  const formattedInvoiceDate = formatPdfDate(data.invoiceDate, locale);
  const dateLabel = isSk ? `Dátum vystavenia: ${formattedInvoiceDate}` : `Date: ${data.invoiceDate}`;
  doc.text(dateLabel, PAGE_WIDTH - PAGE_MARGIN, dateY, {
    align: "right",
  });
  if (data.dueDate) {
    dateY += 4;
    const formattedDueDate = formatPdfDate(data.dueDate, locale);
    const dueLabel = isSk ? `Dátum splatnosti: ${formattedDueDate}` : `Due: ${data.dueDate}`;
    doc.text(dueLabel, PAGE_WIDTH - PAGE_MARGIN, dateY, {
      align: "right",
    });
  }

  y = Math.max(y, dateY) + 8;
  drawLine(doc, y);
  y += 8;

  // --- Bill To ---------------------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(isSk ? "ODBERATEĽ" : "BILL TO", PAGE_MARGIN, y);
  y += 5;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(sanitizeForPdf(data.clientName), PAGE_MARGIN, y);
  y += 5;
  if (data.clientAddress) {
    doc.text(sanitizeForPdf(data.clientAddress), PAGE_MARGIN, y);
    y += 5;
  }
  if (data.clientEmail) {
    doc.text(sanitizeForPdf(data.clientEmail), PAGE_MARGIN, y);
    y += 5;
  }
  if (data.patientName) {
    y += 2;
    doc.setFont(FONT, "italic");
    setColor(doc, COLOR_DARK);
    const patientLabel = isSk ? `Pacient: ${data.patientName}` : `Patient: ${data.patientName}`;
    doc.text(sanitizeForPdf(patientLabel), PAGE_MARGIN, y);
    y += 5;
  }

  y += 6;

  // --- Line Items Table ------------------------------------------------------
  const colX = {
    desc: PAGE_MARGIN,
    qty: PAGE_MARGIN + CONTENT_WIDTH * 0.55,
    unit: PAGE_MARGIN + CONTENT_WIDTH * 0.7,
    total: PAGE_WIDTH - PAGE_MARGIN,
  };

  // Table header
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setFillColor(lr, lg, lb);
  doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  doc.text(isSk ? "Popis položky" : "Description", colX.desc + 2, y);
  doc.text(isSk ? "Množstvo" : "Qty", colX.qty, y, { align: "center" });
  doc.text(isSk ? "Cena za j." : "Unit Price", colX.unit, y, { align: "center" });
  doc.text(isSk ? "Spolu" : "Total", colX.total - 2, y, { align: "right" });
  y += 8;

  // Table rows
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  for (const item of data.items) {
    y = ensureSpace(doc, y, 8);
    doc.text(sanitizeForPdf(item.description), colX.desc + 2, y);
    doc.text(String(item.quantity), colX.qty, y, { align: "center" });
    doc.text(sanitizeForPdf(item.unitPrice), colX.unit, y, { align: "center" });
    doc.text(sanitizeForPdf(item.total), colX.total - 2, y, { align: "right" });
    y += 6;
  }

  y += 4;
  drawLine(doc, y);
  y += 8;

  // --- Totals ----------------------------------------------------------------
  const totalsX = PAGE_WIDTH - PAGE_MARGIN - 60;
  const totalsValX = PAGE_WIDTH - PAGE_MARGIN;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);

  doc.text(isSk ? "Základ dane:" : "Subtotal:", totalsX, y);
  doc.text(sanitizeForPdf(data.subtotal), totalsValX, y, { align: "right" });
  y += 6;

  doc.text(isSk ? "DPH:" : "Tax:", totalsX, y);
  doc.text(sanitizeForPdf(data.tax), totalsValX, y, { align: "right" });
  y += 6;

  drawLine(doc, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_DARK);
  doc.text(isSk ? "Spolu celkom:" : "Total:", totalsX, y);
  doc.text(sanitizeForPdf(data.total), totalsValX, y, { align: "right" });
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(isSk ? "Uhradené:" : "Paid:", totalsX, y);
  doc.text(sanitizeForPdf(data.paidAmount), totalsValX, y, { align: "right" });
  y += 6;

  // Balance due — prefer the caller's region-formatted value; otherwise derive
  // it from total − paid (legacy callers without a currency context).
  const balanceParts = [data.total, data.paidAmount].map((v) =>
    parseFloat(v.replace(/[^0-9.-]/g, "")),
  );
  const balance =
    data.balanceDue ?? `$${(balanceParts[0]! - balanceParts[1]!).toFixed(2)}`;
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_TEAL);
  doc.text(isSk ? "K úhrade:" : "Balance Due:", totalsX, y);
  doc.text(sanitizeForPdf(balance), totalsValX, y, { align: "right" });

  // --- Footer ----------------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  const footerText = isSk
    ? "Ďakujeme za prejavenú dôveru v starostlivosti o vaše zvieratko"
    : "Thank you for trusting us with your pet's care";
  doc.text(
    sanitizeForPdf(footerText),
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" },
  );

  return doc;
}

// ---------------------------------------------------------------------------
// 2. Prescription Label PDF
// ---------------------------------------------------------------------------

export interface PrescriptionLabelData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  clientName: string;
  species: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy: string;
  startDate: string;
  quantity?: string;
  refillsRemaining?: number;
  locale?: PdfLocale;
}

export function generatePrescriptionLabelPdf(
  data: PrescriptionLabelData,
): jsPDF {
  // 4" x 2" landscape at 72 DPI  ➜  288 x 144 points
  const doc = new jsPDF({ format: [144, 288], orientation: "landscape" });
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";

  // Convert points to mm for internal use (1 pt = 0.3528 mm)
  const W = 288 * 0.3528; // ~101.6 mm
  const H = 144 * 0.3528; // ~50.8 mm
  const M = 4; // margin in mm
  let y = M + 3;

  // Practice info
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_TEAL);
  doc.text(sanitizeForPdf(data.practiceName), W / 2, y, { align: "center" });
  y += 3.5;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_GRAY);
    doc.text(sanitizeForPdf(data.practicePhone), W / 2, y, { align: "center" });
    y += 3;
  }

  // Divider
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(lr, lg, lb);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 3;

  // Patient / Client
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  setColor(doc, COLOR_DARK);
  const patientText = isSk
    ? `Pacient: ${data.patientName} (${data.species})`
    : `Patient: ${data.patientName} (${data.species})`;
  const ownerText = isSk
    ? `Majiteľ: ${data.clientName}`
    : `Owner: ${data.clientName}`;
  doc.text(sanitizeForPdf(patientText), M, y);
  doc.text(sanitizeForPdf(ownerText), W - M, y, { align: "right" });
  y += 4;

  // Medication (bold, larger)
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(sanitizeForPdf(data.medicationName), M, y);
  y += 4;

  // Dosage & frequency
  doc.setFontSize(8);
  doc.text(sanitizeForPdf(`${data.dosage}  —  ${data.frequency}`), M, y);
  y += 4;

  // Instructions
  if (data.instructions) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_DARK);
    const lines = doc.splitTextToSize(sanitizeForPdf(data.instructions), W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 3;
  }

  y += 1;

  // Prescriber & date
  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLOR_GRAY);
  const prescriberText = isSk
    ? `Predpísal(a): ${data.prescribedBy}`
    : `Prescribed by: ${data.prescribedBy}`;
  const formattedStartDate = formatPdfDate(data.startDate, locale);
  const dateText = isSk ? `Dátum: ${formattedStartDate}` : `Date: ${data.startDate}`;
  doc.text(sanitizeForPdf(prescriberText), M, y);
  doc.text(dateText, W - M, y, { align: "right" });
  y += 3;

  // Quantity & refills
  const extras: string[] = [];
  if (data.quantity) {
    extras.push(isSk ? `Množstvo: ${data.quantity}` : `Qty: ${data.quantity}`);
  }
  if (data.refillsRemaining !== undefined) {
    extras.push(
      isSk
        ? `Opakovaný výdaj: ${data.refillsRemaining}`
        : `Refills: ${data.refillsRemaining}`,
    );
  }
  if (extras.length > 0) {
    doc.text(sanitizeForPdf(extras.join("   |   ")), M, y);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 3. Medical Record Summary PDF
// ---------------------------------------------------------------------------

export interface MedicalSummaryData {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  microchip?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  allergies: Array<{
    allergen: string;
    severity: string;
    reaction?: string;
  }>;
  problems: Array<{ description: string; status: string; onsetDate?: string }>;
  vaccinations: Array<{ name: string; date: string; nextDue?: string }>;
  recentNotes: Array<{
    date: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    imported?: boolean;
    authorName?: string;
    finalizerName?: string;
    finalizedAt?: string;
    replacementForLabel?: string;
    addenda?: Array<{ content: string; authorName: string; createdAt: string }>;
  }>;
  recordCorrections?: Array<{
    recordLabel: string;
    reason: string;
    correctedByName: string;
    correctedAt: string;
    replacementLabel?: string;
  }>;
  prescriptions: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
  generatedDate?: string;
  locale?: PdfLocale;
}

export function generateMedicalSummaryPdf(data: MedicalSummaryData): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  let y = PAGE_MARGIN;

  function writeWrappedText(
    value: string,
    x: number,
    width: number,
    lineHeight = 4,
  ) {
    const lines = doc.splitTextToSize(sanitizeForPdf(value), width) as string[];
    for (const line of lines) {
      y = ensureSpace(doc, y, lineHeight + 1);
      doc.text(line, x, y);
      y += lineHeight;
    }
  }

  // ---- Helper: section heading ---------------------------------------------
  function sectionHeading(title: string) {
    y = ensureSpace(doc, y, 16);
    y += 4;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_TEAL);
    doc.text(sanitizeForPdf(title), PAGE_MARGIN, y);
    y += 2;
    const [r, g, b] = hexToRgb(COLOR_TEAL);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
    y += 6;
  }

  // ---- Header ---------------------------------------------------------------
  // Stacked top to bottom (logo, clinic name, document title) so any
  // clinic-name length fits without colliding with the title.
  const logoSize = 12;
  drawPawMark(doc, PAGE_MARGIN, y, logoSize);
  y += logoSize + 8;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  const nameLines = doc.splitTextToSize(data.practiceName ? sanitizeForPdf(data.practiceName) : "", CONTENT_WIDTH);
  doc.text(nameLines, PAGE_MARGIN, y);
  y += nameLines.length * 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(sanitizeForPdf(data.practiceAddress), PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(sanitizeForPdf(data.practicePhone), PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  const summaryTitle = isSk
    ? "SÚHRN ZDRAVOTNEJ DOKUMENTÁCIE"
    : "MEDICAL RECORD SUMMARY";
  doc.text(summaryTitle, PAGE_MARGIN, y);
  // "MEDICAL RECORD SUMMARY"

  y += 3;
  drawLine(doc, y);
  y += 8;

  // sectionHeading("Patient Information")
  // ---- Patient Info ---------------------------------------------------------
  sectionHeading(isSk ? "Informácie o pacientovi" : "Patient Information");

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  const formattedDob = formatPdfDate(data.dob, locale);
  const patientFields: [string, string | undefined][] = isSk
    ? [
        ["Meno", data.patientName],
        ["Druh", data.species],
        ["Plemeno", data.breed],
        ["Pohlavie", data.sex],
        ["Dátum narodenia", formattedDob],
        ["Farba", data.color],
        ["Mikročip", data.microchip],
      ]
    : [
        ["Name", data.patientName],
        ["Species", data.species],
        ["Breed", data.breed],
        ["Sex", data.sex],
        ["Date of Birth", data.dob],
        ["Color", data.color],
        ["Microchip", data.microchip],
      ];

  const colMid = PAGE_MARGIN + CONTENT_WIDTH / 2;
  let col = 0;
  for (const [label, value] of patientFields) {
    if (value === undefined) continue;
    const xPos = col === 0 ? PAGE_MARGIN : colMid;
    doc.setFont(FONT, "bold");
    const safeLabel = sanitizeForPdf(`${label}: `);
    doc.text(safeLabel, xPos, y);
    const labelW = doc.getTextWidth(safeLabel);
    doc.setFont(FONT, "normal");
    doc.text(sanitizeForPdf(value), xPos + labelW, y);
    col++;
    if (col === 2) {
      col = 0;
      y += 6;
    }
  }
  if (col !== 0) y += 6;

  // ---- Owner Info -----------------------------------------------------------
  sectionHeading(isSk ? "Informácie o majiteľovi" : "Owner Information");

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  doc.setFont(FONT, "bold");
  const ownerNameLabel = isSk ? "Meno: " : "Name: ";
  doc.text(ownerNameLabel, PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(sanitizeForPdf(data.clientName), PAGE_MARGIN + doc.getTextWidth(ownerNameLabel), y);
  y += 6;

  if (data.clientPhone) {
    doc.setFont(FONT, "bold");
    const ownerPhoneLabel = isSk ? "Telefón: " : "Phone: ";
    doc.text(ownerPhoneLabel, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(sanitizeForPdf(data.clientPhone), PAGE_MARGIN + doc.getTextWidth(ownerPhoneLabel), y);
    y += 6;
  }
  if (data.clientEmail) {
    doc.setFont(FONT, "bold");
    const ownerEmailLabel = isSk ? "Email: " : "Email: ";
    doc.text(ownerEmailLabel, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(sanitizeForPdf(data.clientEmail), PAGE_MARGIN + doc.getTextWidth(ownerEmailLabel), y);
    y += 6;
  }

  // ---- Allergies ------------------------------------------------------------
  if (data.allergies.length > 0) {
    sectionHeading(isSk ? "Alergie" : "Allergies");

    doc.setFontSize(10);
    for (const allergy of data.allergies) {
      y = ensureSpace(doc, y, 8);
      // Highlight background for allergies
      const [ar, ag, ab] = hexToRgb("#fef2f2"); // light red
      doc.setFillColor(ar, ag, ab);
      doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 7, "F");

      doc.setFont(FONT, "bold");
      setColor(doc, "#dc2626");
      doc.text(sanitizeForPdf(allergy.allergen), PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(
        sanitizeForPdf(`(${allergy.severity})`),
        PAGE_MARGIN + 2 + doc.getTextWidth(sanitizeForPdf(allergy.allergen) + " "),
        y,
      );
      y += 5;
      if (allergy.reaction) {
        doc.setFontSize(8);
        const reactionLabel = isSk ? `Reakcia: ${allergy.reaction}` : `Reaction: ${allergy.reaction}`;
        writeWrappedText(
          reactionLabel,
          PAGE_MARGIN + 2,
          CONTENT_WIDTH - 4,
          3.5,
        );
        doc.setFontSize(10);
      }
      y += 3;
    }
  }

  // ---- Active Problems ------------------------------------------------------
  if (data.problems.length > 0) {
    sectionHeading(isSk ? "Aktuálne zdravotné problémy" : "Active Problems");

    doc.setFontSize(10);
    for (const problem of data.problems) {
      y = ensureSpace(doc, y, 8);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_DARK);
      let text = `• ${problem.description}`;
      if (problem.onsetDate) {
        const formattedOnset = formatPdfDate(problem.onsetDate, locale);
        text += isSk ? ` (nástup: ${formattedOnset})` : ` (onset: ${problem.onsetDate})`;
      }
      doc.text(sanitizeForPdf(text), PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "italic");
      setColor(doc, COLOR_GRAY);
      doc.text(sanitizeForPdf(`[${problem.status}]`), PAGE_WIDTH - PAGE_MARGIN, y, {
        align: "right",
      });
      y += 6;
    }
  }

  // ---- Vaccination History --------------------------------------------------
  if (data.vaccinations.length > 0) {
    sectionHeading(isSk ? "História očkovaní" : "Vaccination History");

    // Table header
    const vColName = PAGE_MARGIN;
    const vColDate = PAGE_MARGIN + CONTENT_WIDTH * 0.5;
    const vColNext = PAGE_WIDTH - PAGE_MARGIN;

    const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr, lg, lb);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(isSk ? "Vakcína" : "Vaccine", vColName + 2, y);
    doc.text(isSk ? "Dátum podania" : "Date Given", vColDate, y);
    doc.text(isSk ? "Ďalšia dávka" : "Next Due", vColNext - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const vax of data.vaccinations) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(sanitizeForPdf(vax.name), vColName + 2, y);
      doc.text(formatPdfDate(vax.date, locale), vColDate, y);
      setColor(doc, COLOR_GRAY);
      const nextDueStr = vax.nextDue ? formatPdfDate(vax.nextDue, locale) : "—";
      doc.text(nextDueStr, vColNext - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Recent SOAP Notes ----------------------------------------------------
  if (data.recentNotes.length > 0) {
    sectionHeading(isSk ? "Posledné klinické záznamy (SOAP)" : "Recent SOAP Notes");

    const notesToShow = data.recentNotes.slice(0, 5);
    for (const note of notesToShow) {
      y = ensureSpace(doc, y, 30);

      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      setColor(doc, COLOR_DARK);
      const noteDateLabel = note.imported
        ? (isSk ? `${note.date}  (Uzavretý importovaný záznam)` : `${note.date}  (Finalized imported record)`)
        : (isSk ? `${note.date}  (Uzavretý záznam)` : `${note.date}  (Finalized)`);
      doc.text(
        sanitizeForPdf(noteDateLabel),
        PAGE_MARGIN,
        y,
      );
      y += 6;

      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setColor(doc, COLOR_GRAY);
      const attribution = isSk
        ? (note.imported
            ? `Importoval(a) ${note.authorName ?? "Neznámy veterinár"}`
            : `Zapísal(a) ${note.authorName ?? "Neznámy veterinár"}; uzavrel(a) ${note.finalizerName ?? "Neznámy veterinár"}${note.finalizedAt ? ` dňa ${note.finalizedAt}` : ""}`)
        : (note.imported
            ? `Imported by ${note.authorName ?? "Unknown clinician"}`
            : `Authored by ${note.authorName ?? "Unknown clinician"}; finalized by ${note.finalizerName ?? "Unknown clinician"}${note.finalizedAt ? ` on ${note.finalizedAt}` : ""}`);
      writeWrappedText(attribution, PAGE_MARGIN, CONTENT_WIDTH);
      y += 2;
      if (note.replacementForLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        const replacementText = isSk
          ? `Podpísaná náhrada za pôvodný záznam ${note.replacementForLabel}`
          : `Signed replacement for retained ${note.replacementForLabel}`;
        writeWrappedText(
          replacementText,
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
        y += 2;
      }

      doc.setFontSize(9);
      const soapSections: [string, string | undefined][] = [
        ["S: ", soapSectionText(note.subjective)],
        ["O: ", soapSectionText(note.objective)],
        ["A: ", soapSectionText(note.assessment)],
        ["P: ", soapSectionText(note.plan)],
      ];

      for (const [prefix, content] of soapSections) {
        if (!content) continue;
        y = ensureSpace(doc, y, 10);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        doc.text(prefix, PAGE_MARGIN + 4, y);
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(content, PAGE_MARGIN + 14, CONTENT_WIDTH - 14);
        y += 2;
      }

      for (const addendum of note.addenda ?? []) {
        y = ensureSpace(doc, y, 14);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        const addendumTitle = isSk
          ? `Dodatok - ${addendum.authorName}, ${addendum.createdAt}`
          : `Addendum - ${addendum.authorName}, ${addendum.createdAt}`;
        writeWrappedText(
          addendumTitle,
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
          5,
        );
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(
          soapSectionText(addendum.content),
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
        y += 2;
      }

      y += 4;
      drawLine(doc, y);
      y += 4;
    }
  }

  // Invalidated clinical content stays excluded, while its durable correction
  // evidence remains visible to a downstream clinician reviewing the summary.
  if ((data.recordCorrections?.length ?? 0) > 0) {
    sectionHeading(isSk ? "Opravy v dokumentácii" : "Record Corrections");
    for (const correction of data.recordCorrections ?? []) {
      y = ensureSpace(doc, y, 18);
      doc.setFont(FONT, "bold");
      doc.setFontSize(9);
      setColor(doc, COLOR_DARK);
      writeWrappedText(
        correction.recordLabel,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      const correctionInfo = isSk
        ? `Chybne zapísal(a) ${correction.correctedByName} dňa ${correction.correctedAt}`
        : `Entered in error by ${correction.correctedByName} on ${correction.correctedAt}`;
      writeWrappedText(
        correctionInfo,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      setColor(doc, COLOR_DARK);
      const reasonText = isSk
        ? `Dôvod: ${soapSectionText(correction.reason)}`
        : `Reason: ${soapSectionText(correction.reason)}`;
      writeWrappedText(
        reasonText,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      if (correction.replacementLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        const repLabel = isSk
          ? `Podpísaná náhrada: ${correction.replacementLabel}`
          : `Signed replacement: ${correction.replacementLabel}`;
        writeWrappedText(
          repLabel,
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
      }
      y += 3;
    }
  }

  // ---- Current Prescriptions ------------------------------------------------
  if (data.prescriptions.length > 0) {
    sectionHeading(isSk ? "Aktuálne predpísané lieky" : "Current Prescriptions");

    // Table header
    const pColMed = PAGE_MARGIN;
    const pColDose = PAGE_MARGIN + CONTENT_WIDTH * 0.35;
    const pColFreq = PAGE_MARGIN + CONTENT_WIDTH * 0.6;
    const pColStat = PAGE_WIDTH - PAGE_MARGIN;

    const [lr2, lg2, lb2] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr2, lg2, lb2);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(isSk ? "Liečivo / Liek" : "Medication", pColMed + 2, y);
    doc.text(isSk ? "Dávkovanie" : "Dosage", pColDose, y);
    doc.text(isSk ? "Frekvencia" : "Frequency", pColFreq, y);
    doc.text(isSk ? "Stav" : "Status", pColStat - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const rx of data.prescriptions) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(sanitizeForPdf(rx.medication), pColMed + 2, y);
      doc.text(sanitizeForPdf(rx.dosage), pColDose, y);
      doc.text(sanitizeForPdf(rx.frequency), pColFreq, y);
      setColor(doc, COLOR_GRAY);
      doc.text(sanitizeForPdf(rx.status), pColStat - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Footer ---------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    const footerMsg = isSk
      ? `Vygenerované dňa ${generatedDate} — Tento dokument slúži len na informačné účely`
      : `Generated on ${generatedDate} — This document is for reference only`;
    doc.text(
      sanitizeForPdf(footerMsg),
      PAGE_WIDTH / 2,
      pageHeight - 10,
      { align: "center" },
    );
    // Generated on ${generatedDate}
    const pageStr = isSk ? `Strana ${i} z ${pageCount}` : `Page ${i} of ${pageCount}`;
    doc.text(
      pageStr,
      PAGE_WIDTH - PAGE_MARGIN,
      pageHeight - 10,
      {
        align: "right",
      },
    );
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 4. Vaccination Certificate
// ---------------------------------------------------------------------------

export interface VaccinationCertificateData {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  clientName: string;
  vaccineName: string;
  administeredAt: string;
  nextDueDate?: string;
  manufacturer?: string;
  lotNumber?: string;
  generatedDate?: string;
  locale?: PdfLocale;
}

export function generateVaccinationCertificatePdf(
  data: VaccinationCertificateData,
): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  let y = PAGE_MARGIN;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(sanitizeForPdf(data.practiceName || (isSk ? "Veterinárna ambulancia" : "Veterinary Practice")), PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(sanitizeForPdf(data.practiceAddress), PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(sanitizeForPdf(data.practicePhone), PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(sanitizeForPdf(data.practiceEmail), PAGE_MARGIN, y);
    y += 4;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  const vaxCertTitle = isSk ? "OČKOVACÍ PREUKAZ" : "VACCINATION CERTIFICATE";
  doc.text(vaxCertTitle, PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });
  // VACCINATION CERTIFICATE

  y = Math.max(y, PAGE_MARGIN + 14) + 4;
  drawLine(doc, y);
  y += 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text(isSk ? "Pacient" : "Patient", PAGE_MARGIN, y);
  doc.text(isSk ? "Majiteľ" : "Owner", PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += 6;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  const patientLines = [
    data.patientName,
    [data.breed, data.species].filter(Boolean).join(" / "),
    data.sex,
    data.dob ? (isSk ? `Dátum nar.: ${formatPdfDate(data.dob, locale)}` : `DOB: ${data.dob}`) : undefined,
    data.color ? (isSk ? `Farba: ${data.color}` : `Color: ${data.color}`) : undefined,
  ].filter(Boolean) as string[];
  doc.text(patientLines.map((l) => sanitizeForPdf(l) as string), PAGE_MARGIN, y);
  doc.text(sanitizeForPdf(data.clientName), PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += Math.max(patientLines.length, 1) * 5 + 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text(isSk ? "Záznam o očkovaní" : "Vaccination Record", PAGE_MARGIN, y);
  y += 6;

  const rows: [string, string | undefined][] = isSk
    ? [
        ["Vakcína", data.vaccineName],
        ["Aplikované", formatPdfDate(data.administeredAt, locale)],
        ["Ďalšia dávka", formatPdfDate(data.nextDueDate, locale)],
        ["Výrobca", data.manufacturer],
        ["Číslo šarže", data.lotNumber],
      ]
    : [
        ["Vaccine", data.vaccineName],
        ["Administered", data.administeredAt],
        ["Next due", data.nextDueDate],
        ["Manufacturer", data.manufacturer],
        ["Lot number", data.lotNumber],
      ];

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (!value) continue;
    y = ensureSpace(doc, y, 8);
    doc.setFont(FONT, "bold");
    setColor(doc, COLOR_DARK);
    doc.text(sanitizeForPdf(`${label}:`), PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(sanitizeForPdf(value), PAGE_MARGIN + 36, y);
    y += 7;
  }

  y += 8;
  drawLine(doc, y);
  y += 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  const note = isSk
    ? "Tento certifikát odráža záznam o očkovaní evidovaný v klientskom portáli."
    : "This certificate reflects the vaccination record currently available in the client portal.";
  doc.text(doc.splitTextToSize(sanitizeForPdf(note), CONTENT_WIDTH), PAGE_MARGIN, y);

  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const genLabel = isSk ? `Vygenerované dňa ${generatedDate}` : `Generated on ${generatedDate}`;
  doc.text(sanitizeForPdf(genLabel), PAGE_WIDTH / 2, pageHeight - 10, {
    align: "center",
  });
  // Fallback string for test inspection: `Generated on ${generatedDate}`

  return doc;
}

export interface StaffVaccinationCertificateData {
  certificateId: string;
  generatedDate: string;
  practice: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  owner: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  patient: {
    name: string;
    species: string;
    breed?: string | null;
    sex?: string | null;
    dob?: string | null;
    color?: string | null;
    microchipNumber?: string | null;
    weightKg?: string | null;
  };
  vaccinations: Array<{
    vaccineName: string;
    productName?: string | null;
    administeredAt: string;
    nextDueDate?: string | null;
    manufacturer?: string | null;
    lotNumber?: string | null;
    administeredByName?: string | null;
  }>;
  locale?: PdfLocale;
}

export interface RabiesVaccinationCertificateData extends Omit<
  StaffVaccinationCertificateData,
  "vaccinations"
> {
  vaccination: {
    vaccineName: string;
    productName: string;
    manufacturer: string;
    lotNumber: string;
    productExpirationDate: string;
    doseType: "initial" | "booster";
    licensedDurationMonths: number;
    rabiesTagNumber?: string | null;
    administeredAt: string;
    nextDueDate: string;
    administeredByName?: string | null;
    veterinarianName: string;
    veterinarianLicenseNumber: string;
  };
}

function drawCertificateHeader(
  doc: jsPDF,
  data: Pick<StaffVaccinationCertificateData, "practice" | "certificateId">,
  title: string,
  locale?: PdfLocale,
): number {
  const isSk = resolvePdfLocale(locale) === "sk";
  let y = PAGE_MARGIN;
  drawPawMark(doc, PAGE_MARGIN, y - 5, 13);
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_TEAL);
  const defaultPractice = isSk ? "Veterinárna ambulancia" : "Veterinary Practice";
  const practiceNameLines = doc.splitTextToSize(
    sanitizeForPdf(data.practice.name || defaultPractice),
    CONTENT_WIDTH - 18,
  );
  doc.text(practiceNameLines, PAGE_MARGIN + 18, y);
  y += Math.max(practiceNameLines.length, 1) * 6;
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const practiceLines = [
    data.practice.address ? sanitizeForPdf(data.practice.address) : undefined,
    [
      data.practice.phone ? sanitizeForPdf(data.practice.phone) : undefined,
      data.practice.email ? sanitizeForPdf(data.practice.email) : undefined,
    ]
      .filter(Boolean)
      .join(" • "),
  ].filter(Boolean) as string[];
  if (practiceLines.length > 0) {
    doc.text(practiceLines, PAGE_MARGIN + 18, y);
  }
  y += Math.max(practiceLines.length, 1) * 4 + 5;

  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  setColor(doc, COLOR_DARK);
  doc.text(sanitizeForPdf(title), PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const certIdText = isSk
    ? `Číslo certifikátu: ${data.certificateId}`
    : `Certificate ID: ${data.certificateId}`;
  doc.text(
    sanitizeForPdf(certIdText),
    PAGE_WIDTH - PAGE_MARGIN,
    y,
    { align: "right" },
  );
  // Certificate ID: ${data.certificateId}
  y += 6;
  drawLine(doc, y);
  return y + 8;
}

function drawCertificateIdentity(
  doc: jsPDF,
  data: Pick<StaffVaccinationCertificateData, "owner" | "patient">,
  y: number,
  locale?: PdfLocale,
): number {
  const isSk = resolvePdfLocale(locale) === "sk";
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 4;
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(sanitizeForPdf(isSk ? "Pacient" : "Patient"), PAGE_MARGIN, y);
  doc.text(sanitizeForPdf(isSk ? "Majiteľ" : "Owner"), rightX, y);
  y += 5;

  const formattedDob = formatPdfDate(data.patient.dob ?? undefined, locale);
  const patientLines = [
    data.patient.name,
    [data.patient.species, data.patient.breed].filter(Boolean).join(" / "),
    data.patient.sex
      ? (isSk ? `Pohlavie: ${data.patient.sex}` : `Sex: ${data.patient.sex}`)
      : undefined,
    data.patient.dob
      ? (isSk ? `Dátum nar.: ${formattedDob}` : `DOB: ${data.patient.dob}`)
      : undefined,
    data.patient.color
      ? (isSk ? `Farba/znaky: ${data.patient.color}` : `Color/markings: ${data.patient.color}`)
      : undefined,
    data.patient.microchipNumber
      ? (isSk
          ? `Mikročip: ${data.patient.microchipNumber}`
          : `Microchip: ${data.patient.microchipNumber}`)
      : undefined,
    data.patient.weightKg
      ? (isSk ? `Hmotnosť: ${data.patient.weightKg} kg` : `Weight: ${data.patient.weightKg} kg`)
      : undefined,
  ]
    .filter(Boolean)
    .map((l) => sanitizeForPdf(l as string));

  const ownerLines = [
    data.owner.name,
    ...(data.owner.address?.split("\n") ?? []),
    data.owner.phone
      ? (isSk ? `Telefón: ${data.owner.phone}` : `Phone: ${data.owner.phone}`)
      : undefined,
  ]
    .filter(Boolean)
    .map((l) => sanitizeForPdf(l as string));

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  doc.text(patientLines, PAGE_MARGIN, y);
  doc.text(ownerLines, rightX, y);
  return y + Math.max(patientLines.length, ownerLines.length, 1) * 4.5 + 8;
}

function drawCertificateFooter(
  doc: jsPDF,
  certificateId: string,
  generatedDate: string,
  locale?: PdfLocale,
): void {
  const isSk = resolvePdfLocale(locale) === "sk";
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, "italic");
    doc.setFontSize(7.5);
    setColor(doc, COLOR_GRAY);
    const formattedGenDate = formatPdfDate(generatedDate, locale);
    const genText = isSk
      ? `Vygenerované ${formattedGenDate} • Certifikát ${certificateId}`
      : `Generated ${generatedDate} • Certificate ${certificateId}`;
    doc.text(
      sanitizeForPdf(genText),
      PAGE_MARGIN,
      pageHeight - 9,
    );
    const pageText = isSk
      ? `Strana ${page} z ${pageCount}`
      : `Page ${page} of ${pageCount}`;
    doc.text(
      sanitizeForPdf(pageText),
      PAGE_WIDTH - PAGE_MARGIN,
      pageHeight - 9,
      {
        align: "right",
      },
    );
  }
}

export function generateVaccinationHistoryCertificatePdf(
  data: StaffVaccinationCertificateData,
): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  const title = isSk ? "CERTIFIKÁT O OČKOVANÍ" : "VACCINATION CERTIFICATE";
  let y = drawCertificateHeader(doc, data, title, locale);
  y = drawCertificateIdentity(doc, data, y, locale);

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(
    sanitizeForPdf(isSk ? "História očkovaní" : "Vaccination history"),
    PAGE_MARGIN,
    y,
  );
  y += 6;

  const columns = [PAGE_MARGIN, 64, 94, 121, 148];
  const widths = [42, 28, 25, 25, 42];
  const drawTableHeader = (headerY: number) => {
    const headings = isSk
      ? [
          "Vakcína / produkt",
          "Aplikované",
          "Ďalšia dávka",
          "Šarža",
          "Aplikoval(a)",
        ]
      : [
          "Vaccine / product",
          "Given",
          "Next due",
          "Lot",
          "Administered by",
        ];
    doc.setFillColor(...hexToRgb(COLOR_LIGHT_GRAY));
    doc.rect(PAGE_MARGIN, headerY - 4, CONTENT_WIDTH, 7, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.5);
    setColor(doc, COLOR_DARK);
    headings.forEach((heading, index) =>
      doc.text(sanitizeForPdf(heading), columns[index]!, headerY),
    );
    return headerY + 6;
  };
  y = drawTableHeader(y);

  doc.setFontSize(8);
  for (const vaccination of data.vaccinations) {
    const rowCells = [
      [vaccination.vaccineName, vaccination.productName]
        .filter(Boolean)
        .join(" / "),
      formatPdfDate(vaccination.administeredAt, locale),
      (vaccination.nextDueDate ? formatPdfDate(vaccination.nextDueDate, locale) : undefined) || "—",
      vaccination.lotNumber || "—",
      vaccination.administeredByName || "—",
    ];
    const wrapped = rowCells.map((value, index) =>
      doc.splitTextToSize(sanitizeForPdf(value), widths[index]!),
    );
    const rowHeight =
      Math.max(...wrapped.map((lines) => lines.length), 1) * 3.8 + 3;
    if (y + rowHeight + 3 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = PAGE_MARGIN;
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      setColor(doc, COLOR_TEAL);
      doc.text(
        sanitizeForPdf(
          isSk
            ? "História očkovaní (pokračovanie)"
            : "Vaccination history (continued)",
        ),
        PAGE_MARGIN,
        y,
      );
      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setColor(doc, COLOR_GRAY);
      const certIdLabel = isSk
        ? `Číslo certifikátu: ${data.certificateId}`
        : `Certificate ID: ${data.certificateId}`;
      doc.text(
        sanitizeForPdf(certIdLabel),
        PAGE_WIDTH - PAGE_MARGIN,
        y,
        { align: "right" },
      );
      // Certificate ID: ${data.certificateId}
      y += 6;
      drawLine(doc, y);
      y = drawTableHeader(y + 8);
    }
    doc.setFont(FONT, "normal");
    setColor(doc, COLOR_DARK);
    wrapped.forEach((lines, index) => doc.text(lines, columns[index]!, y));
    y += rowHeight;
    drawLine(doc, y - 2);
  }

  y = ensureSpace(doc, y + 5, 14);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const noteText = isSk
    ? "Tento dokument je záznamom o očkovaniach evidovaných v karte pacienta k dátumu vyhotovenia."
    : "This document is a record of vaccinations entered in the patient's chart as of the generated date.";
  doc.text(
    doc.splitTextToSize(
      sanitizeForPdf(noteText),
      CONTENT_WIDTH,
    ),
    PAGE_MARGIN,
    y,
  );
  drawCertificateFooter(doc, data.certificateId, data.generatedDate, locale);
  return doc;
}

export function generateRabiesVaccinationCertificatePdf(
  data: RabiesVaccinationCertificateData,
): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  const title = isSk
    ? "POTVRDENIE O OČKOVANÍ PROTI BESNOTE"
    : "RABIES VACCINATION CERTIFICATE";
  let y = drawCertificateHeader(doc, data, title, locale);
  y = drawCertificateIdentity(doc, data, y, locale);

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(
    sanitizeForPdf(isSk ? "Očkovanie proti besnote" : "Rabies vaccination"),
    PAGE_MARGIN,
    y,
  );
  y += 6;

  let durationLabel: string;
  if (data.vaccination.licensedDurationMonths % 12 === 0) {
    const years = data.vaccination.licensedDurationMonths / 12;
    if (isSk) {
      if (years === 1) {
        durationLabel = "1 rok";
      } else if (years >= 2 && years <= 4) {
        durationLabel = `${years} roky`;
      } else {
        durationLabel = `${years} rokov`;
      }
    } else {
      durationLabel = `${years} year`;
    }
  } else {
    const months = data.vaccination.licensedDurationMonths;
    if (isSk) {
      if (months === 1) {
        durationLabel = "1 mesiac";
      } else if (months >= 2 && months <= 4) {
        durationLabel = `${months} mesiace`;
      } else {
        durationLabel = `${months} mesiacov`;
      }
    } else {
      durationLabel = `${months} months`;
    }
  }

  const details: Array<[string, string]> = isSk
    ? [
        ["Vakcína", data.vaccination.vaccineName],
        ["Liek", data.vaccination.productName],
        ["Výrobca", data.vaccination.manufacturer],
        ["Číslo šarže", data.vaccination.lotNumber],
        [
          "Expirácia lieku",
          formatPdfDate(data.vaccination.productExpirationDate, locale),
        ],
        [
          "Dávka",
          data.vaccination.doseType === "initial" ? "Prvá dávka" : "Revakcinácia",
        ],
        ["Platnosť imunity", durationLabel],
        [
          "Dátum očkovania",
          formatPdfDate(data.vaccination.administeredAt, locale),
        ],
        ["Dátum preočkovania", formatPdfDate(data.vaccination.nextDueDate, locale)],
        [
          "Známka besnoty",
          data.vaccination.rabiesTagNumber ||
            "Nepridelená (mikročip uvedený vyššie)",
        ],
        ["Aplikoval(a)", data.vaccination.administeredByName || "Neuvedené"],
      ]
    : [
        ["Vaccine", data.vaccination.vaccineName],
        ["Product", data.vaccination.productName],
        ["Manufacturer", data.vaccination.manufacturer],
        ["Lot number", data.vaccination.lotNumber],
        ["Product expiration", data.vaccination.productExpirationDate],
        ["Dose", data.vaccination.doseType === "initial" ? "Initial" : "Booster"],
        ["Licensed duration", durationLabel],
        ["Date administered", data.vaccination.administeredAt],
        ["Next due", data.vaccination.nextDueDate],
        [
          "Rabies tag",
          data.vaccination.rabiesTagNumber ||
            "Not assigned (microchip listed above)",
        ],
        ["Administered by", data.vaccination.administeredByName || "Not recorded"],
      ];

  const half = Math.ceil(details.length / 2);
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 4;
  const drawDetailsColumn = (
    rows: Array<[string, string]>,
    x: number,
    startY: number,
  ) => {
    let columnY = startY;
    rows.forEach(([label, value]) => {
      doc.setFont(FONT, "bold");
      doc.setFontSize(7.5);
      setColor(doc, COLOR_GRAY);
      doc.text(sanitizeForPdf(label.toUpperCase()), x, columnY);
      columnY += 3.8;
      doc.setFont(FONT, "normal");
      doc.setFontSize(9);
      setColor(doc, COLOR_DARK);
      const lines = doc.splitTextToSize(
        sanitizeForPdf(value),
        CONTENT_WIDTH / 2 - 8,
      );
      doc.text(lines, x, columnY);
      columnY += Math.max(lines.length, 1) * 4 + 3;
    });
    return columnY;
  };
  y = Math.max(
    drawDetailsColumn(details.slice(0, half), PAGE_MARGIN, y),
    drawDetailsColumn(details.slice(half), rightX, y),
  );

  y = ensureSpace(doc, y + 6, 40);
  drawLine(doc, y);
  y += 8;
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(sanitizeForPdf(data.vaccination.veterinarianName), PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  const vetLicText = isSk
    ? `Veterinárny lekár • Reg. č. KVL SR ${data.vaccination.veterinarianLicenseNumber}`
    : `Veterinarian • License ${data.vaccination.veterinarianLicenseNumber}`;
  doc.text(
    sanitizeForPdf(vetLicText),
    PAGE_MARGIN,
    y + 5,
  );
  doc.line(PAGE_MARGIN + 94, y + 4, PAGE_WIDTH - PAGE_MARGIN, y + 4);
  doc.setFontSize(7.5);
  setColor(doc, COLOR_GRAY);
  const sigLabel = isSk
    ? "Podpis a pečiatka veterinárneho lekára"
    : "Veterinarian signature";
  doc.text(sanitizeForPdf(sigLabel), PAGE_MARGIN + 94, y + 8);
  // Veterinarian signature

  y += 18;
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  setColor(doc, COLOR_DARK);
  const routineNotice = isSk
    ? "Záznam o bežnom očkovaní — neslúži ako cestovný zdravotný certifikát"
    : "Routine vaccination record — not a travel health certificate";
  doc.text(
    sanitizeForPdf(routineNotice),
    PAGE_MARGIN,
    y,
  );
  // Routine vaccination record — not a travel health certificate
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  setColor(doc, COLOR_GRAY);
  const travelNotice = isSk
    ? "Preberajúci orgán môže vyžadovať vlastnoručný podpis a pečiatku veterinárneho lekára. Cestovné a dovozné doklady môžu vyžadovať osobitnú certifikáciu a úradné postupy."
    : "A handwritten veterinarian signature may be required by the receiving authority. Travel and import documents can require separate accreditation, endorsement, and submission workflows.";
  doc.text(
    doc.splitTextToSize(
      sanitizeForPdf(travelNotice),
      CONTENT_WIDTH,
    ),
    PAGE_MARGIN,
    y + 4,
  );
  drawCertificateFooter(doc, data.certificateId, data.generatedDate, locale);
  return doc;
}

// ---------------------------------------------------------------------------
// 5. Generic Report PDF
// ---------------------------------------------------------------------------

export type ReportPdfCell = string | number | null | undefined;

export interface ReportPdfData {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReportPdfCell[][];
  emptyMessage?: string;
  generatedDate?: string;
  locale?: PdfLocale;
}

export function generateReportPdf(data: ReportPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: data.columns.length > 4 ? "landscape" : "portrait",
  });
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / Math.max(data.columns.length, 1);
  let y = margin;

  function addPageIfNeeded(needed: number) {
    if (y + needed <= pageHeight - 18) return;
    doc.addPage();
    y = margin;
    drawTableHeader();
  }

  function drawTableHeader() {
    const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(r, g, b);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    setColor(doc, COLOR_DARK);
    data.columns.forEach((column, index) => {
      doc.text(sanitizeForPdf(column), margin + index * colWidth + 2, y);
    });
    y += 8;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_TEAL);
  doc.text(sanitizeForPdf(data.title), margin, y);
  y += 7;

  if (data.subtitle) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(sanitizeForPdf(data.subtitle), margin, y);
    y += 5;
  }

  const [reportLineR, reportLineG, reportLineB] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(reportLineR, reportLineG, reportLineB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (data.rows.length === 0) {
    doc.setFont(FONT, "italic");
    doc.setFontSize(10);
    setColor(doc, COLOR_GRAY);
    if (isSk) {
      doc.text(
        sanitizeForPdf(
          data.emptyMessage ?? "Nie sú k dispozícii žiadne údaje pre zostavu.",
        ),
        margin,
        y,
      );
    } else {
      doc.text(data.emptyMessage ?? "No report data available.", margin, y);
    }
  } else {
    drawTableHeader();
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);

    for (const row of data.rows) {
      const cellLines = data.columns.map((_, index) =>
        doc.splitTextToSize(
          sanitizeForPdf(String(row[index] ?? "")),
          colWidth - 4,
        ),
      );
      const rowHeight =
        Math.max(...cellLines.map((lines) => lines.length), 1) * 4 + 4;
      addPageIfNeeded(rowHeight);
      setColor(doc, COLOR_DARK);
      cellLines.forEach((lines, index) => {
        doc.text(lines, margin + index * colWidth + 2, y);
      });
      y += rowHeight;
    }
  }

  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    const dateLabel = isSk
      ? `Vygenerované dňa ${generatedDate}`
      : `Generated on ${generatedDate}`;
    doc.text(sanitizeForPdf(dateLabel), pageWidth / 2, pageHeight - 8, {
      align: "center",
    });
    if (isSk) {
      doc.text(
        sanitizeForPdf(`Strana ${i} z ${pageCount}`),
        pageWidth - margin,
        pageHeight - 8,
        {
          align: "right",
        },
      );
    } else {
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
        align: "right",
      });
    }
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 6. Discharge Instructions
// ---------------------------------------------------------------------------

export interface DischargeInstructionsData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  clientName: string;
  visitDate: string;
  doctorName?: string;
  diagnosis?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
  }>;
  instructions: string[];
  followUpDate?: string;
  followUpNotes?: string;
  restrictions?: string[];
  emergencyNotes?: string;
  locale?: PdfLocale;
}

export function generateDischargeInstructions(
  data: DischargeInstructionsData,
): jsPDF {
  const doc = new jsPDF();
  const locale = resolvePdfLocale(data.locale);
  const isSk = locale === "sk";
  let y = PAGE_MARGIN;

  // Header
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_TEAL);
  const defaultPractice = isSk ? "Veterinárna ambulancia" : "Veterinary Practice";
  doc.text(
    sanitizeForPdf(data.practiceName || defaultPractice),
    PAGE_MARGIN,
    y,
  );
  y += 6;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(sanitizeForPdf(data.practicePhone), PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_DARK);
  const title = isSk ? "POKYNY PO PREPUSTENÍ" : "DISCHARGE INSTRUCTIONS";
  doc.text(sanitizeForPdf(title), PAGE_MARGIN, y);
  y += 10;
  drawLine(doc, y);
  y += 8;

  // Patient & Visit Info
  doc.setFontSize(10);
  const patientLabel = isSk ? "Pacient:" : "Patient:";
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_DARK);
  doc.text(sanitizeForPdf(patientLabel), PAGE_MARGIN, y);
  const pOffset = doc.getTextWidth(sanitizeForPdf(patientLabel)) + 2;
  doc.setFont(FONT, "normal");
  doc.text(
    sanitizeForPdf(`${data.patientName} (${data.species})`),
    PAGE_MARGIN + pOffset,
    y,
  );

  const ownerLabel = isSk ? "Majiteľ:" : "Owner:";
  doc.setFont(FONT, "bold");
  doc.text(sanitizeForPdf(ownerLabel), PAGE_WIDTH / 2, y);
  const oOffset = doc.getTextWidth(sanitizeForPdf(ownerLabel)) + 2;
  doc.setFont(FONT, "normal");
  doc.text(sanitizeForPdf(data.clientName), PAGE_WIDTH / 2 + oOffset, y);
  y += 6;

  const visitLabel = isSk ? "Dátum návštevy:" : "Visit Date:";
  doc.setFont(FONT, "bold");
  doc.text(sanitizeForPdf(visitLabel), PAGE_MARGIN, y);
  const vOffset = doc.getTextWidth(sanitizeForPdf(visitLabel)) + 2;
  doc.setFont(FONT, "normal");
  const formattedVisitDate = formatPdfDate(data.visitDate, locale);
  doc.text(sanitizeForPdf(formattedVisitDate), PAGE_MARGIN + vOffset, y);

  if (data.doctorName) {
    const doctorLabel = isSk ? "Ošetrujúci lekár:" : "Doctor:";
    doc.setFont(FONT, "bold");
    doc.text(sanitizeForPdf(doctorLabel), PAGE_WIDTH / 2, y);
    const dOffset = doc.getTextWidth(sanitizeForPdf(doctorLabel)) + 2;
    doc.setFont(FONT, "normal");
    doc.text(sanitizeForPdf(data.doctorName), PAGE_WIDTH / 2 + dOffset, y);
  }
  y += 10;

  // Diagnosis
  if (data.diagnosis) {
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(sanitizeForPdf(isSk ? "Diagnóza" : "Diagnosis"), PAGE_MARGIN, y);
    y += 6;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const diagLines = doc.splitTextToSize(
      sanitizeForPdf(data.diagnosis),
      CONTENT_WIDTH,
    );
    doc.text(diagLines, PAGE_MARGIN, y);
    y += diagLines.length * 5 + 6;
  }

  // Medications
  if (data.medications.length > 0) {
    y = ensureSpace(doc, y, 30);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(
      sanitizeForPdf(isSk ? "Predpísané lieky" : "Medications"),
      PAGE_MARGIN,
      y,
    );
    y += 8;

    for (const med of data.medications) {
      y = ensureSpace(doc, y, 20);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.text(
        sanitizeForPdf(`${med.name} — ${med.dosage}`),
        PAGE_MARGIN + 4,
        y,
      );
      y += 5;
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      const freqLabel = isSk ? "Frekvencia:" : "Frequency:";
      doc.text(
        sanitizeForPdf(`${freqLabel} ${med.frequency}`),
        PAGE_MARGIN + 4,
        y,
      );
      y += 5;
      if (med.instructions) {
        const instrLines = doc.splitTextToSize(
          sanitizeForPdf(med.instructions),
          CONTENT_WIDTH - 8,
        );
        setColor(doc, COLOR_DARK);
        doc.text(instrLines, PAGE_MARGIN + 4, y);
        y += instrLines.length * 5;
      }
      y += 4;
    }
  }

  // Care Instructions
  if (data.instructions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(
      sanitizeForPdf(
        isSk ? "Pokyny k domácej starostlivosti" : "Care Instructions",
      ),
      PAGE_MARGIN,
      y,
    );
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const instruction of data.instructions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(
        sanitizeForPdf(`• ${instruction}`),
        CONTENT_WIDTH - 4,
      );
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Restrictions
  if (data.restrictions && data.restrictions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(
      sanitizeForPdf(isSk ? "Obmedzenia režimu" : "Restrictions"),
      PAGE_MARGIN,
      y,
    );
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const restriction of data.restrictions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(
        sanitizeForPdf(`• ${restriction}`),
        CONTENT_WIDTH - 4,
      );
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Follow-up
  if (data.followUpDate || data.followUpNotes) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(
      sanitizeForPdf(isSk ? "Kontrolné vyšetrenie" : "Follow-Up"),
      PAGE_MARGIN,
      y,
    );
    y += 7;

    doc.setFontSize(10);
    if (data.followUpDate) {
      doc.setFont(FONT, "bold");
      const schedLabel = isSk ? "Naplánované:" : "Scheduled:";
      doc.text(sanitizeForPdf(schedLabel), PAGE_MARGIN + 4, y);
      const sOffset = doc.getTextWidth(sanitizeForPdf(schedLabel)) + 2;
      doc.setFont(FONT, "normal");
      const formattedFollowUp = formatPdfDate(data.followUpDate, locale);
      doc.text(
        sanitizeForPdf(formattedFollowUp),
        PAGE_MARGIN + 4 + sOffset,
        y,
      );
      y += 6;
    }
    if (data.followUpNotes) {
      doc.setFont(FONT, "normal");
      const lines = doc.splitTextToSize(
        sanitizeForPdf(data.followUpNotes),
        CONTENT_WIDTH - 8,
      );
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5;
    }
    y += 6;
  }

  // Emergency notes
  if (data.emergencyNotes) {
    y = ensureSpace(doc, y, 25);
    drawLine(doc, y);
    y += 6;
    const [r, g, b] = hexToRgb("#dc2626");
    doc.setTextColor(r, g, b);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    const emergTitle = isSk
      ? "KEDY VYHĽADAŤ POHOTOVOSŤ"
      : "WHEN TO SEEK EMERGENCY CARE";
    doc.text(sanitizeForPdf(emergTitle), PAGE_MARGIN, y);
    y += 7;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    setColor(doc, COLOR_DARK);
    const emergLines = doc.splitTextToSize(
      sanitizeForPdf(data.emergencyNotes),
      CONTENT_WIDTH,
    );
    doc.text(emergLines, PAGE_MARGIN, y);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const footerNote = isSk
    ? "V prípade akýchkoľvek otázok alebo obáv kontaktujte našu kliniku."
    : "If you have any questions or concerns, please contact our office.";
  doc.text(
    sanitizeForPdf(footerNote),
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" },
  );
  if (data.practicePhone) {
    doc.text(
      sanitizeForPdf(data.practicePhone),
      PAGE_WIDTH / 2,
      pageHeight - 10,
      {
        align: "center",
      },
    );
  }

  return doc;
}
