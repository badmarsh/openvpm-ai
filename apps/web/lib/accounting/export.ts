/**
 * Účtovný export faktúr a e-Kasa pokladničných dokladov
 * pre STORMWARE Pohoda (XML) a KROS Omega (CSV).
 * Zodpovedá sadzbám DPH v SR (23%, 19%, 5%, 0%).
 */

export interface AccountingInvoiceItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  taxDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string | null;
  clientCity?: string | null;
  clientZip?: string | null;
  clientIco?: string | null;
  clientDic?: string | null;
  total: number;
  subtotal: number;
  tax: number;
  vatRate: number; // 23, 19, 5, 0
  status: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface AccountingEkasaItem {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  amountBase: number;
  amountVat: number;
  amountTotal: number;
  vatRate: string; // STANDARD_23, REDUCED_19, REDUCED_5, ZERO
  paymentMethod: string; // CASH, CARD
  okp?: string | null;
  uid?: string | null;
}

/**
 * Generuje STORMWARE Pohoda XML (verzia 2.0).
 * Obsahuje vydané faktúry (<inv:invoice>) aj pokladničné doklady (<vch:voucher>).
 */
export function generatePohodaXml(params: {
  practiceIco: string;
  clinicName: string;
  invoices: AccountingInvoiceItem[];
  ekasaReceipts: AccountingEkasaItem[];
}): string {
  const ico = params.practiceIco || "00000000";
  const nowStr = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack
  version="2.0"
  id="OPENVPM-${Date.now()}"
  ico="${ico}"
  application="OpenVPM AI"
  note="Export fakturacie a e-Kasa trzieb"
  xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"
  xmlns:vch="http://www.stormware.cz/schema/version_2/voucher.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">
`;

  let itemId = 1;

  // 1. Vydané faktúry
  for (const inv of params.invoices) {
    xml += `  <dat:dataPackItem id="INV-${itemId++}" version="2.0">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>issuedInvoice</inv:invoiceType>
        <inv:number>
          <typ:numberRequested>${inv.invoiceNumber}</typ:numberRequested>
        </inv:number>
        <inv:date>${inv.issueDate}</inv:date>
        <inv:dateTax>${inv.taxDate}</inv:dateTax>
        <inv:dateDue>${inv.dueDate}</inv:dateDue>
        <inv:text>Veterinárne služby a liečivá</inv:text>
        <inv:partnerIdentity>
          <typ:address>
            <typ:name>${escapeXml(inv.clientName)}</typ:name>
            <typ:street>${escapeXml(inv.clientAddress || "")}</typ:street>
            <typ:city>${escapeXml(inv.clientCity || "")}</typ:city>
            <typ:zip>${escapeXml(inv.clientZip || "")}</typ:zip>
            ${inv.clientIco ? `<typ:ico>${inv.clientIco}</typ:ico>` : ""}
            ${inv.clientDic ? `<typ:dic>${inv.clientDic}</typ:dic>` : ""}
          </typ:address>
        </inv:partnerIdentity>
        <inv:paymentType>
          <typ:ids>draft</typ:ids>
        </inv:paymentType>
      </inv:invoiceHeader>
      <inv:invoiceDetail>
`;

    for (const line of inv.items) {
      xml += `        <inv:invoiceItem>
          <inv:text>${escapeXml(line.description)}</inv:text>
          <inv:quantity>${line.quantity}</inv:quantity>
          <inv:unitPrice>${line.unitPrice.toFixed(2)}</inv:unitPrice>
          <inv:payVAT>true</inv:payVAT>
          <inv:rateVAT>high</inv:rateVAT>
          <inv:homeCurrency>
            <typ:unitPrice>${line.unitPrice.toFixed(2)}</typ:unitPrice>
            <typ:price>${line.total.toFixed(2)}</typ:price>
          </inv:homeCurrency>
        </inv:invoiceItem>
`;
    }

    xml += `      </inv:invoiceDetail>
      <inv:invoiceSummary>
        <inv:homeCurrency>
          <typ:priceNone>0</typ:priceNone>
          <typ:priceLow>0</typ:priceLow>
          <typ:priceHigh>${inv.subtotal.toFixed(2)}</typ:priceHigh>
          <typ:priceHighVAT>${inv.tax.toFixed(2)}</typ:priceHighVAT>
          <typ:round>
            <typ:priceRound>0</typ:priceRound>
          </typ:round>
        </inv:homeCurrency>
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>
`;
  }

  // 2. Pokladničné doklady e-Kasa
  for (const rc of params.ekasaReceipts) {
    const dateOnly = rc.issuedAt.slice(0, 10);
    const isCard = rc.paymentMethod === "CARD";

    const is23 = rc.vatRate === "STANDARD_23" || (rc.vatRate as any) === 23;
    const is19 = rc.vatRate === "REDUCED_19" || (rc.vatRate as any) === 19;
    const is5 = rc.vatRate === "REDUCED_5" || (rc.vatRate as any) === 5;
    const is0 = rc.vatRate === "ZERO" || (rc.vatRate as any) === 0;

    let voucherVatXml = "";
    if (is23) {
      voucherVatXml = `          <typ:priceHigh>${rc.amountBase.toFixed(2)}</typ:priceHigh>
          <typ:priceHighVAT>${rc.amountVat.toFixed(2)}</typ:priceHighVAT>`;
    } else if (is19 || is5) {
      voucherVatXml = `          <typ:priceLow>${rc.amountBase.toFixed(2)}</typ:priceLow>
          <typ:priceLowVAT>${rc.amountVat.toFixed(2)}</typ:priceLowVAT>`;
    } else {
      voucherVatXml = `          <typ:priceNone>${rc.amountTotal.toFixed(2)}</typ:priceNone>`;
    }

    xml += `  <dat:dataPackItem id="VCH-${itemId++}" version="2.0">
    <vch:voucher version="2.0">
      <vch:voucherHeader>
        <vch:voucherType>receipt</vch:voucherType>
        <vch:number>
          <typ:numberRequested>${rc.receiptNumber}</typ:numberRequested>
        </vch:number>
        <vch:date>${dateOnly}</vch:date>
        <vch:dateTax>${dateOnly}</vch:dateTax>
        <vch:text>Tržba e-Kasa (${isCard ? "Platobná karta" : "Hotovosť"})${rc.uid ? " - UID: " + rc.uid.slice(0, 8) : ""}</vch:text>
      </vch:voucherHeader>
      <vch:voucherSummary>
        <vch:homeCurrency>
${voucherVatXml}
        </vch:homeCurrency>
      </vch:voucherSummary>
    </vch:voucher>
  </dat:dataPackItem>
`;
  }

  xml += `</dat:dataPack>`;
  return xml;
}

/**
 * Generuje formát KROS Omega / Alfa CSV.
 */
export function generateKrosCsv(params: {
  invoices: AccountingInvoiceItem[];
  ekasaReceipts: AccountingEkasaItem[];
}): string {
  const rows: string[] = [
    "Druh;CisloDokladu;Datum;Partner;Text;Zaklad_23;DPH_23;Zaklad_19;DPH_19;Zaklad_5;DPH_5;Oslobodene_0;Spolu",
  ];

  for (const inv of params.invoices) {
    const base23 = inv.vatRate === 23 ? inv.subtotal.toFixed(2) : "0.00";
    const vat23 = inv.vatRate === 23 ? inv.tax.toFixed(2) : "0.00";
    const base19 = inv.vatRate === 19 ? inv.subtotal.toFixed(2) : "0.00";
    const vat19 = inv.vatRate === 19 ? inv.tax.toFixed(2) : "0.00";
    const base5 = inv.vatRate === 5 ? inv.subtotal.toFixed(2) : "0.00";
    const vat5 = inv.vatRate === 5 ? inv.tax.toFixed(2) : "0.00";
    const zero = inv.vatRate === 0 ? inv.total.toFixed(2) : "0.00";

    rows.push(
      `FA;${inv.invoiceNumber};${inv.issueDate};"${escapeCsv(inv.clientName)}";"Veterinárne služby";${base23};${vat23};${base19};${vat19};${base5};${vat5};${zero};${inv.total.toFixed(2)}`
    );
  }

  for (const rc of params.ekasaReceipts) {
    const dateOnly = rc.issuedAt.slice(0, 10);
    const is23 = rc.vatRate === "STANDARD_23" || (rc.vatRate as any) === 23;
    const is19 = rc.vatRate === "REDUCED_19" || (rc.vatRate as any) === 19;
    const is5 = rc.vatRate === "REDUCED_5" || (rc.vatRate as any) === 5;
    const is0 = rc.vatRate === "ZERO" || (rc.vatRate as any) === 0;

    const base23 = is23 ? rc.amountBase.toFixed(2) : "0.00";
    const vat23 = is23 ? rc.amountVat.toFixed(2) : "0.00";
    const base19 = is19 ? rc.amountBase.toFixed(2) : "0.00";
    const vat19 = is19 ? rc.amountVat.toFixed(2) : "0.00";
    const base5 = is5 ? rc.amountBase.toFixed(2) : "0.00";
    const vat5 = is5 ? rc.amountVat.toFixed(2) : "0.00";
    const zero = is0 ? rc.amountTotal.toFixed(2) : "0.00";

    rows.push(
      `PD;${rc.receiptNumber};${dateOnly};"Pultový predaj";"e-Kasa tržba (${rc.paymentMethod})";${base23};${vat23};${base19};${vat19};${base5};${vat5};${zero};${rc.amountTotal.toFixed(2)}`
    );
  }

  return "\uFEFF" + rows.join("\r\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsv(str: string): string {
  return str.replace(/"/g, '""');
}
