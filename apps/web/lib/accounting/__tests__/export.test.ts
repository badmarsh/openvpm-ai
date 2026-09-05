import { describe, it, expect } from "vitest";
import {
  generatePohodaXml,
  generateKrosCsv,
  type AccountingInvoiceItem,
  type AccountingEkasaItem,
} from "../export";

describe("Accounting Export", () => {
  const mockInvoices: AccountingInvoiceItem[] = [
    {
      id: "inv-1",
      invoiceNumber: "VF20260001",
      issueDate: "2026-03-01",
      taxDate: "2026-03-01",
      dueDate: "2026-03-15",
      clientName: "Ján Novák",
      clientAddress: "Hlavná 12",
      clientCity: "Bratislava",
      clientZip: "81101",
      subtotal: 100.0,
      tax: 23.0,
      total: 123.0,
      vatRate: 23,
      status: "PAID",
      items: [
        {
          description: "Vakcinácia Nobivac DHPPI",
          quantity: 1,
          unitPrice: 100.0,
          total: 100.0,
        },
      ],
    },
  ];

  const mockReceipts: AccountingEkasaItem[] = [
    {
      id: "rc-1",
      receiptNumber: "EK-20260301-001",
      issuedAt: "2026-03-01T10:30:00.000Z",
      amountBase: 50.0,
      amountVat: 11.5,
      amountTotal: 61.5,
      vatRate: "STANDARD_23",
      paymentMethod: "CARD",
      okp: "abcdef123456",
      uid: "O-1234567890",
    },
    {
      id: "rc-2",
      receiptNumber: "EK-20260301-002",
      issuedAt: "2026-03-01T11:00:00.000Z",
      amountBase: 10.0,
      amountVat: 0.5,
      amountTotal: 10.5,
      vatRate: "REDUCED_5",
      paymentMethod: "CASH",
    },
  ];

  describe("STORMWARE Pohoda XML Export", () => {
    it("should generate valid Pohoda XML with invoices and vouchers", () => {
      const xml = generatePohodaXml({
        practiceIco: "12345678",
        clinicName: "Veterinárna klinika s.r.o.",
        invoices: mockInvoices,
        ekasaReceipts: mockReceipts,
      });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<dat:dataPack');
      expect(xml).toContain('ico="12345678"');
      expect(xml).toContain('<inv:invoice version="2.0">');
      expect(xml).toContain('<typ:numberRequested>VF20260001</typ:numberRequested>');
      expect(xml).toContain('<typ:name>Ján Novák</typ:name>');
      expect(xml).toContain('<typ:city>Bratislava</typ:city>');
      expect(xml).toContain('<typ:zip>81101</typ:zip>');
      expect(xml).toContain('<typ:priceHigh>100.00</typ:priceHigh>');
      expect(xml).toContain('<typ:priceHighVAT>23.00</typ:priceHighVAT>');
      expect(xml).toContain('<inv:text>Vakcinácia Nobivac DHPPI</inv:text>');

      // Vouchers (e-Kasa)
      expect(xml).toContain('<vch:voucher version="2.0">');
      expect(xml).toContain('<vch:voucherType>receipt</vch:voucherType>');
      expect(xml).toContain('EK-20260301-001');
    });

    it("should handle empty lists gracefully", () => {
      const xml = generatePohodaXml({
        practiceIco: "87654321",
        clinicName: "Prázdna klinika",
        invoices: [],
        ekasaReceipts: [],
      });

      expect(xml).toContain('<dat:dataPack');
      expect(xml).not.toContain('<inv:invoice');
      expect(xml).not.toContain('<vch:voucher');
    });
  });

  describe("KROS Omega CSV Export", () => {
    it("should generate standard KROS CSV with header and records", () => {
      const csv = generateKrosCsv({
        invoices: mockInvoices,
        ekasaReceipts: mockReceipts,
      });

      const lines = csv.split("\r\n");
      expect(lines[0]).toContain("Druh;CisloDokladu;Datum;Partner;Text;Zaklad_23;DPH_23;Zaklad_19;DPH_19;Zaklad_5;DPH_5;Oslobodene_0;Spolu");
      
      // Check invoice row
      expect(csv).toContain('FA;VF20260001;2026-03-01;"Ján Novák";"Veterinárne služby";100.00;23.00;0.00;0.00;0.00;0.00;0.00;123.00');

      // Check e-kasa rows
      expect(csv).toContain('PD;EK-20260301-001;2026-03-01;"Pultový predaj";"e-Kasa tržba (CARD)";50.00;11.50;0.00;0.00;0.00;0.00;0.00;61.50');
      expect(csv).toContain('PD;EK-20260301-002;2026-03-01;"Pultový predaj";"e-Kasa tržba (CASH)";0.00;0.00;0.00;0.00;10.00;0.50;0.00;10.50');
    });
  });
});
