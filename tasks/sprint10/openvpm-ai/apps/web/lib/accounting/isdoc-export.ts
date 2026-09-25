/**
 * ISDOC 6.0.2 XML builder (Slovak / Czech electronic invoice standard).
 *
 * Compatible with: STORMWARE POHODA, KROS OMEGA, Money S3, ABRA.
 * The minimal schema follows the ISDOC 6.0.2 namespace published at
 * http://isdoc.cz/namespace/2013.
 */

export interface IsdocInvoiceInput {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;
  supplierIco: string;
  supplierName: string;
  supplierAddress: string;
  supplierVatId?: string; // IČ DPH / DIČ
  customerIco?: string;
  customerName: string;
  customerAddress: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // bez DPH
    vatRate: number; // 0, 5, 10, 20
    totalWithoutVat: number;
    totalWithVat: number;
  }>;
  totalWithoutVat: number;
  totalVat: number;
  totalWithVat: number;
  currencyCode: "EUR" | "CZK";
  note?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2);
}

/**
 * Generuje ISDOC 6.0.2 XML string podľa českej/slovenskej normy.
 * Kompatibilné s: POHODA, OMEGA, Money S3, ABRA.
 */
export function buildIsdocXml(input: IsdocInvoiceInput): string {
  const parts: string[] = [];

  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<Invoice xmlns="http://isdoc.cz/namespace/2013" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://isdoc.cz/namespace/2013 isdoc-6.0.2.xsd" version="6.0.2">`
  );

  // DocumentType: 1 = faktúra
  parts.push(`  <DocumentType>1</DocumentType>`);
  parts.push(`  <ID>${escapeXml(input.invoiceNumber)}</ID>`);
  parts.push(`  <IssueDate>${escapeXml(input.issueDate)}</IssueDate>`);
  parts.push(`  <TaxPointDate>${escapeXml(input.issueDate)}</TaxPointDate>`);
  parts.push(`  <DueDate>${escapeXml(input.dueDate)}</DueDate>`);
  parts.push(`  <LocalCurrencyCode>${escapeXml(input.currencyCode)}</LocalCurrencyCode>`);
  if (input.note) {
    parts.push(`  <Note>${escapeXml(input.note)}</Note>`);
  }

  // --- AccountingSupplierParty ---
  parts.push(`  <AccountingSupplierParty>`);
  parts.push(`    <Party>`);
  parts.push(`      <PartyIdentification>`);
  parts.push(`        <ID>${escapeXml(input.supplierIco)}</ID>`);
  parts.push(`      </PartyIdentification>`);
  parts.push(`      <PartyName>`);
  parts.push(`        <Name>${escapeXml(input.supplierName)}</Name>`);
  parts.push(`      </PartyName>`);
  parts.push(`      <PostalAddress>`);
  parts.push(`        <Address>${escapeXml(input.supplierAddress)}</Address>`);
  parts.push(`      </PostalAddress>`);
  if (input.supplierVatId) {
    parts.push(`      <ClassifiedTaxCategory>`);
    parts.push(`        <VATNumber>${escapeXml(input.supplierVatId)}</VATNumber>`);
    parts.push(`      </ClassifiedTaxCategory>`);
  }
  parts.push(`    </Party>`);
  parts.push(`  </AccountingSupplierParty>`);

  // --- AccountingCustomerParty ---
  parts.push(`  <AccountingCustomerParty>`);
  parts.push(`    <Party>`);
  if (input.customerIco) {
    parts.push(`      <PartyIdentification>`);
    parts.push(`        <ID>${escapeXml(input.customerIco)}</ID>`);
    parts.push(`      </PartyIdentification>`);
  }
  parts.push(`      <PartyName>`);
  parts.push(`        <Name>${escapeXml(input.customerName)}</Name>`);
  parts.push(`      </PartyName>`);
  parts.push(`      <PostalAddress>`);
  parts.push(`        <Address>${escapeXml(input.customerAddress)}</Address>`);
  parts.push(`      </PostalAddress>`);
  parts.push(`    </Party>`);
  parts.push(`  </AccountingCustomerParty>`);

  // --- InvoiceLines ---
  parts.push(`  <InvoiceLines>`);
  input.items.forEach((item, index) => {
    parts.push(`    <InvoiceLine>`);
    parts.push(`      <ID>${index + 1}</ID>`);
    parts.push(`      <InvoicedQuantity unitCode="KS">${escapeXml(String(item.quantity))}</InvoicedQuantity>`);
    parts.push(`      <LineExtensionAmount>${fmt(item.totalWithoutVat)}</LineExtensionAmount>`);
    parts.push(`      <LineExtensionAmountTaxInclusive>${fmt(item.totalWithVat)}</LineExtensionAmountTaxInclusive>`);
    parts.push(`      <LineExtensionTaxAmount>${fmt(item.totalWithVat - item.totalWithoutVat)}</LineExtensionTaxAmount>`);
    parts.push(`      <Item>`);
    parts.push(`        <Description>${escapeXml(item.description)}</Description>`);
    parts.push(`      </Item>`);
    parts.push(`      <ClassifiedTaxCategory>`);
    parts.push(`        <Percent>${escapeXml(String(item.vatRate))}</Percent>`);
    parts.push(`        <VATRate>${escapeXml(String(item.vatRate))}</VATRate>`);
    parts.push(`        <TaxForDocuments>${fmt(item.totalWithVat - item.totalWithoutVat)}</TaxForDocuments>`);
    parts.push(`      </ClassifiedTaxCategory>`);
    parts.push(`    </InvoiceLine>`);
  });
  parts.push(`  </InvoiceLines>`);

  // --- TaxTotal (grouped by VAT rate) ---
  const groups = new Map<number, { base: number; vat: number }>();
  for (const item of input.items) {
    const existing = groups.get(item.vatRate) ?? { base: 0, vat: 0 };
    existing.base += item.totalWithoutVat;
    existing.vat += item.totalWithVat - item.totalWithoutVat;
    groups.set(item.vatRate, existing);
  }
  parts.push(`  <TaxTotal>`);
  for (const [rate, totals] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    parts.push(`    <TaxSubTotal>`);
    parts.push(`      <TaxableAmount>${fmt(totals.base)}</TaxableAmount>`);
    parts.push(`      <TaxAmount>${fmt(totals.vat)}</TaxAmount>`);
    parts.push(`      <TaxCategory>`);
    parts.push(`        <Percent>${escapeXml(String(rate))}</Percent>`);
    parts.push(`        <VATRate>${escapeXml(String(rate))}</VATRate>`);
    parts.push(`      </TaxCategory>`);
    parts.push(`    </TaxSubTotal>`);
  }
  parts.push(`  </TaxTotal>`);

  // --- LegalMonetaryTotal ---
  parts.push(`  <LegalMonetaryTotal>`);
  parts.push(`    <TaxExclusiveAmount>${fmt(input.totalWithoutVat)}</TaxExclusiveAmount>`);
  parts.push(`    <TaxInclusiveAmount>${fmt(input.totalWithVat)}</TaxInclusiveAmount>`);
  parts.push(`    <PayableAmount>${fmt(input.totalWithVat)}</PayableAmount>`);
  parts.push(`  </LegalMonetaryTotal>`);

  parts.push(`</Invoice>`);

  return parts.join("\n");
}
