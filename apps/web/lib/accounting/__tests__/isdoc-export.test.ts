import { describe, it, expect } from "vitest";
import { buildIsdocXml, type IsdocInvoiceInput } from "../isdoc-export";

const input: IsdocInvoiceInput = {
  invoiceNumber: "VF-20260001",
  issueDate: "2026-03-01",
  dueDate: "2026-03-15",
  supplierIco: "12345678",
  supplierName: "Veterinárna ambulancia s.r.o.",
  supplierAddress: "Hlavná 12, Bratislava",
  supplierVatId: "SK2021234567",
  customerIco: "87654321",
  customerName: "Ján Novák",
  customerAddress: "Námestie 5, Košice",
  items: [
    {
      description: "Vakcinácia Nobivac DHPPI",
      quantity: 1,
      unitPrice: 100,
      vatRate: 23,
      totalWithoutVat: 100,
      totalWithVat: 123,
    },
  ],
  totalWithoutVat: 100,
  totalVat: 23,
  totalWithVat: 123,
  currencyCode: "EUR",
  note: "Test faktúra",
};

describe("buildIsdocXml", () => {
  it("emits a valid ISDOC 6.0.2 root with the correct namespace", () => {
    const xml = buildIsdocXml(input);
    expect(xml).toContain('xmlns="http://isdoc.cz/namespace/2013"');
    expect(xml).toContain('version="6.0.2"');
    expect(xml).toContain("<Invoice ");
    expect(xml).toContain("</Invoice>");
  });

  it("includes supplier and customer identification", () => {
    const xml = buildIsdocXml(input);
    expect(xml).toContain("<ID>12345678</ID>");
    expect(xml).toContain("<VATNumber>SK2021234567</VATNumber>");
    expect(xml).toContain("<Name>Ján Novák</Name>");
  });

  it("escapes XML special characters", () => {
    const withSpecials: IsdocInvoiceInput = {
      ...input,
      customerName: "Ján <Nový> & Synovia",
      note: 'text "quoted" & more',
    };
    const xml = buildIsdocXml(withSpecials);
    expect(xml).toContain("Ján &lt;Nový&gt; &amp; Synovia");
    expect(xml).not.toContain("<Nový>");
  });

  it("groups tax totals by VAT rate", () => {
    const multi: IsdocInvoiceInput = {
      ...input,
      items: [
        { description: "A", quantity: 1, unitPrice: 100, vatRate: 23, totalWithoutVat: 100, totalWithVat: 123 },
        { description: "B", quantity: 2, unitPrice: 10, vatRate: 5, totalWithoutVat: 20, totalWithVat: 21 },
      ],
      totalWithoutVat: 120,
      totalVat: 24,
      totalWithVat: 144,
    };
    const xml = buildIsdocXml(multi);
    expect(xml.match(/<TaxSubTotal>/g)?.length).toBe(2);
    expect(xml).toContain("<Percent>23</Percent>");
    expect(xml).toContain("<Percent>5</Percent>");
  });

  it("includes legal monetary totals", () => {
    const xml = buildIsdocXml(input);
    expect(xml).toContain("<TaxExclusiveAmount>100.00</TaxExclusiveAmount>");
    expect(xml).toContain("<PayableAmount>123.00</PayableAmount>");
  });
});
