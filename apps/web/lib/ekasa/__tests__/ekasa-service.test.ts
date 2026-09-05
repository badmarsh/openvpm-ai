import { describe, it, expect } from "vitest";
import {
  calculateVatAmounts,
  generateOkp,
  generateQrCodeData,
} from "../service";
import { generateReceiptHtml } from "../receipt-template";

describe("e-Kasa Service & Calculations", () => {
  describe("calculateVatAmounts", () => {
    it("correctly computes 23% Slovak standard VAT (applicable from 2025)", () => {
      // 123.00 EUR at 23% => Base = 100.00 EUR, VAT = 23.00 EUR
      const result = calculateVatAmounts(123, "STANDARD_23");
      expect(result.base).toBe("100.00");
      expect(result.vat).toBe("23.00");
    });

    it("correctly computes 19% reduced VAT", () => {
      // 119.00 EUR at 19% => Base = 100.00 EUR, VAT = 19.00 EUR
      const result = calculateVatAmounts(119, "REDUCED_19");
      expect(result.base).toBe("100.00");
      expect(result.vat).toBe("19.00");
    });

    it("correctly computes 5% reduced VAT for medications", () => {
      // 105.00 EUR at 5% => Base = 100.00 EUR, VAT = 5.00 EUR
      const result = calculateVatAmounts(105, "REDUCED_5");
      expect(result.base).toBe("100.00");
      expect(result.vat).toBe("5.00");
    });

    it("correctly handles 0% exempt VAT", () => {
      const result = calculateVatAmounts(50, "ZERO");
      expect(result.base).toBe("50.00");
      expect(result.vat).toBe("0.00");
    });
  });

  describe("generateOkp", () => {
    it("generates uppercase SHA-1 hash for receipt parameters", () => {
      const okp = generateOkp({
        dic: "2020293057",
        pokladnicaId: "88812345678900001",
        receiptNumber: "20260904-0001",
        issuedAt: new Date("2026-09-04T12:00:00.000Z"),
        amountTotal: "45.00",
      });

      expect(okp).toBeDefined();
      expect(okp).toMatch(/^[0-9A-F]{40}$/);
    });
  });

  describe("generateQrCodeData", () => {
    it("generates official verification URL with UID when present", () => {
      const qr = generateQrCodeData({
        uid: "O-ABC123XYZ",
        dic: "2020293057",
        amountTotal: "45.00",
        receiptNumber: "20260904-0001",
      });

      expect(qr).toContain("https://ekasa.financnasprava.sk/mdu/verifikacia?uid=O-ABC123XYZ");
    });

    it("does not impersonate FR SR verification when UID is missing", () => {
      const qr = generateQrCodeData({
        dic: "2020293057",
        amountTotal: "45.00",
        receiptNumber: "20260904-0001",
      });

      expect(qr).toBe("");
    });
  });

  describe("generateReceiptHtml", () => {
    it("renders valid 80mm thermal receipt HTML with clinic header and OKP", () => {
      const html = generateReceiptHtml(
        {
          receiptNumber: "20260904-0001",
          uid: "O-TEST-UID-12345",
          okp: "A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2",
          pkp: "MOCK_PKP_SIGNATURE_BASE64",
          amountBase: "36.59",
          amountVat: "8.41",
          amountTotal: "45.00",
          vatRate: "STANDARD_23",
          paymentMethod: "CASH",
          status: "CONFIRMED",
          issuedAt: new Date("2026-09-04T14:30:00.000Z"),
        },
        {
          clinicName: "Súkromná veterinárna klinika MVDr. Martin Sýkora",
          address: "Hlavná 12, 979 01 Rimavská Sobota",
          phone: "+421 905 123 456",
          dic: "2020293057",
          icDph: "SK2020293057",
          pokladnicaId: "88812345678900001",
        }
      );

      expect(html).toContain("Súkromná veterinárna klinika MVDr. Martin Sýkora");
      expect(html).toContain("2020293057");
      expect(html).toContain("45,00 €");
      expect(html).toContain("Hotovosť");
      expect(html).toContain("20260904-0001");
      expect(html).toContain("max-width: 80mm");
    });

    it("renders valid 58mm thermal receipt HTML with custom paper width", () => {
      const html = generateReceiptHtml(
        {
          receiptNumber: "20260904-0002",
          amountBase: "10.00",
          amountVat: "2.30",
          amountTotal: "12.30",
          vatRate: "STANDARD_23",
          paymentMethod: "CARD",
          status: "CONFIRMED",
          issuedAt: new Date("2026-09-04T15:00:00.000Z"),
        },
        {
          clinicName: "Ambulancia MVDr. Novák",
          dic: "2020293057",
          pokladnicaId: "88812345678900001",
          paperWidth: "58mm",
        }
      );

      expect(html).toContain("max-width: 58mm");
      expect(html).toContain("size: 58mm auto");
      expect(html).toContain("font-size: 10px");
      expect(html).toContain("12,30 €");
      expect(html).toContain("Platobná karta");
    });
  });
});
