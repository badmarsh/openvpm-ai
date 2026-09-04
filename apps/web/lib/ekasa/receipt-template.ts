import { generateQrCodeData } from "./service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ReceiptConfig {
  clinicName: string;
  address?: string | null;
  phone?: string | null;
  dic: string;
  icDph?: string | null;
  pokladnicaId: string;
}

export interface ReceiptData {
  receiptNumber: string;
  uid?: string | null;
  okp?: string | null;
  pkp?: string | null;
  amountBase: string;
  amountVat: string;
  amountTotal: string;
  vatRate: string;
  paymentMethod: string;
  status: string;
  issuedAt: Date | string;
  items?: Array<{
    name: string;
    qty: number;
    unitPrice: string;
    vatRate: string;
  }>;
}

const VAT_RATE_LABEL: Record<string, string> = {
  ZERO: "0 %",
  REDUCED: "10 %",
  STANDARD: "20 %",
  REDUCED_5: "5 %",
  REDUCED_19: "19 %",
  STANDARD_23: "23 %",
};

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Hotovosť",
  CARD: "Platobná karta",
  TRANSFER: "Bankový prevod",
};

function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAmount(a: string | number): string {
  return Number(a).toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Main function — generates a complete HTML string for 80mm thermal printing
// ---------------------------------------------------------------------------
export function generateReceiptHtml(
  receipt: ReceiptData,
  config: ReceiptConfig
): string {
  const qrData = generateQrCodeData({
    uid: receipt.uid,
    dic: config.dic,
    amountTotal: receipt.amountTotal,
    receiptNumber: receipt.receiptNumber,
  });

  // OKP/PKP — zobrazíme len prvých 8 znakov (legislatívna požiadavka)
  const okpShort = receipt.okp ? receipt.okp.slice(0, 8) + "..." : "—";
  const pkpShort = receipt.pkp ? receipt.pkp.slice(0, 8) + "..." : "—";

  const vatLabel = VAT_RATE_LABEL[receipt.vatRate] ?? receipt.vatRate;
  const paymentLabel = PAYMENT_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod;
  const issuedAtStr = formatDate(receipt.issuedAt);

  const itemsHtml =
    receipt.items && receipt.items.length > 0
      ? receipt.items
          .map(
            (item) => `
        <tr>
          <td class="item-name">${item.name}</td>
          <td class="item-qty">${item.qty}x</td>
          <td class="item-price">${formatAmount(item.unitPrice)} €</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="3" class="center">Veterinárne služby</td></tr>`;

  const isConfirmed = receipt.status === "CONFIRMED";
  const statusNote = isConfirmed
    ? ""
    : `<div class="offline-note">⚠ DOKLAD NIE JE OVERENÝ v systéme FR SR (${receipt.status})</div>`;

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>e-Kasa Doklad ${receipt.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 80mm;
      max-width: 80mm;
      padding: 4mm 3mm;
    }

    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .small  { font-size: 10px; }
    .large  { font-size: 15px; }

    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 4px 0;
    }

    .clinic-header { text-align: center; margin-bottom: 6px; }
    .clinic-name   { font-size: 14px; font-weight: bold; text-transform: uppercase; }
    .clinic-info   { font-size: 10px; margin-top: 2px; }

    .tax-info { font-size: 10px; margin: 4px 0; }
    .tax-info td { padding: 1px 0; }
    .tax-info td:first-child { width: 45%; }

    .receipt-number {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      margin: 6px 0;
      padding: 3px;
      border: 1px solid #000;
    }

    .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .items-table .item-name { width: 50%; }
    .items-table .item-qty  { width: 15%; text-align: center; }
    .items-table .item-price { width: 35%; text-align: right; }

    .totals-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .totals-table td { padding: 1px 0; }
    .totals-table td:last-child { text-align: right; }
    .total-row td { font-size: 14px; font-weight: bold; }

    .crypto-section { font-size: 9px; margin: 4px 0; word-break: break-all; }
    .crypto-label   { font-weight: bold; }

    .qr-section { text-align: center; margin: 6px 0; }
    .qr-url     { font-size: 8px; word-break: break-all; margin-top: 3px; }

    .offline-note {
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 3px;
      margin: 4px 0;
    }

    .footer { text-align: center; font-size: 9px; margin-top: 6px; }

    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        width: 80mm;
        padding: 2mm;
      }
      .no-print { display: none !important; }
    }

    @media screen {
      body {
        margin: 20px auto;
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        border: 1px solid #ddd;
      }
    }
  </style>
</head>
<body>

  <div class="no-print center" style="margin-bottom:8px;">
    <button onclick="window.print()" style="padding:6px 16px;cursor:pointer;">🖨 Vytlačiť doklad</button>
  </div>

  <div class="clinic-header">
    <div class="clinic-name">${config.clinicName}</div>
    ${config.address ? `<div class="clinic-info">${config.address}</div>` : ""}
    ${config.phone ? `<div class="clinic-info">Tel: ${config.phone}</div>` : ""}
  </div>

  <hr class="divider">

  <table class="tax-info">
    <tr><td>DIČ:</td><td class="bold">${config.dic}</td></tr>
    ${config.icDph ? `<tr><td>IČ DPH:</td><td class="bold">${config.icDph}</td></tr>` : ""}
    <tr><td>ID pokladnice:</td><td>${config.pokladnicaId}</td></tr>
  </table>

  <hr class="divider">

  <div class="receipt-number">DOKLAD č. ${receipt.receiptNumber}</div>
  <div class="center small">${issuedAtStr}</div>

  <hr class="divider">

  <table class="items-table">
    <thead>
      <tr>
        <th class="item-name">Položka</th>
        <th class="item-qty">Ks</th>
        <th class="item-price">Cena</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <hr class="divider">

  <table class="totals-table">
    <tr>
      <td>Základ DPH (${vatLabel}):</td>
      <td>${formatAmount(receipt.amountBase)} €</td>
    </tr>
    <tr>
      <td>DPH (${vatLabel}):</td>
      <td>${formatAmount(receipt.amountVat)} €</td>
    </tr>
    <tr class="total-row">
      <td class="bold large">SPOLU:</td>
      <td class="bold large">${formatAmount(receipt.amountTotal)} €</td>
    </tr>
    <tr>
      <td>Platba:</td>
      <td>${paymentLabel}</td>
    </tr>
  </table>

  <hr class="divider">

  <div class="crypto-section">
    <div><span class="crypto-label">OKP:</span> ${okpShort}</div>
    <div><span class="crypto-label">PKP:</span> ${pkpShort}</div>
    ${receipt.uid ? `<div><span class="crypto-label">UID:</span> ${receipt.uid}</div>` : ""}
  </div>

  <hr class="divider">

  <div class="qr-section">
    <div class="small bold">Overenie dokladu na portáli FR SR:</div>
    <div class="qr-url">${qrData}</div>
  </div>

  ${statusNote}

  <hr class="divider">

  <div class="footer">
    <div>Ďakujeme za Vašu návštevu!</div>
    <div style="margin-top:3px;">Doklad vydaný cez systém OpenVPM</div>
    <div>Zákon č. 289/2008 Z. z. / 384/2025 Z. z.</div>
  </div>

</body>
</html>`;
}
