import { describe, it, expect } from "vitest";
import { parseWholesalerDeliveryNote } from "../wholesaler-import";

describe("Slovak Wholesaler Import Parser", () => {
  it("should parse Cymedica SK veterinary delivery note with batch and expiry", () => {
    const cymedicaCsv = `
# Dodací list: 202610048
# Dodávateľ: CYMEDICA SK s.r.o.
Kod;Nazov;Sarza;Expiracia;Mnozstvo;MJ;CenaBezDPH;DPH;SpoluBezDPH
CYM-101;SYNULOX 50mg tbl;A1098;31.12.2027;10;bal;8,50;10;85,00
CYM-202;CANINSULIN 40IU/ml 10x2.5ml;B4412;15.06.2026;2;bal;42,00;10;84,00
CYM-303;METACAM 1.5mg/ml 100ml;C9901;20.08.2027;5;ks;26,00;10;130,00
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: cymedicaCsv,
      filename: "CYMEDICA_DL_202610048.csv",
    });

    expect(note.wholesaler).toBe("CYMEDICA");
    expect(note.supplierName).toContain("CYMEDICA SK");
    expect(note.deliveryNoteNumber).toBe("202610048");
    expect(note.items).toHaveLength(3);

    expect(note.items[0].name).toBe("SYNULOX 50mg tbl");
    expect(note.items[0].batchNumber).toBe("A1098");
    expect(note.items[0].expirationDate).toBe("2027-12-31");
    expect(note.items[0].quantity).toBe(10);
    expect(note.items[0].unitPriceWithoutVat).toBe(8.5);
    expect(note.items[0].vatRate).toBe(10);
    expect(note.items[0].totalWithoutVat).toBe(85);

    expect(note.totalWithoutVat).toBe(299);
  });

  it("should parse Pharmos a.s. pharmaceutical delivery note", () => {
    const pharmosCsv = `
Kod;Nazov;Sarza;Expiracia;Mnozstvo;CenaBezDPH;DPH
98765;AMOKSIKLAV 1g tbl 14;54321;30.09.2026;15;6,20;10
45612;DIAZEPAM SLOVAKOFARMA 5mg;99112;15.04.2027;5;3,10;10
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: pharmosCsv,
      wholesaler: "PHARMOS",
    });

    expect(note.wholesaler).toBe("PHARMOS");
    expect(note.supplierIco).toBe("35974871");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].name).toBe("AMOKSIKLAV 1g tbl 14");
    expect(note.items[0].quantity).toBe(15);
    expect(note.items[1].batchNumber).toBe("99112");
  });

  it("should parse Samohýl SK delivery note with EAN barcodes", () => {
    const samohylCsv = `
EAN;Nazov;Mnozstvo;CenaBezDPH
8594001234567;Calibra Dog Gastrointestinal 2kg;8;14,50
8594007654321;Alavis Triple Blend Extra Silný 700g;4;38,00
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: samohylCsv,
      filename: "samohyl-faktura.csv",
    });

    expect(note.wholesaler).toBe("SAMOHYL");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].ean).toBe("8594001234567");
    expect(note.items[0].totalWithoutVat).toBe(116);
    expect(note.items[1].name).toContain("Alavis Triple Blend");
  });

  it("should parse BIOPHARM CSV delivery note", () => {
    const csv = `
Kod;Nazov;Sarza;Expiracia;Ks;JCena;DPH
BIO-001;VITAMIN B12 1000mcg inj;A110;31.12.2027;10;5,50;10
BIO-002;CANIKUR Pro tbl;A220;15.06.2026;20;4,20;10
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: csv,
      filename: "BIOPHARM_DL.csv",
    });

    expect(note.wholesaler).toBe("BIOPHARM");
    expect(note.supplierName).toContain("BIOPHARM");
    expect(note.supplierIco).toBe("");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].name).toBe("VITAMIN B12 1000mcg inj");
    expect(note.items[0].quantity).toBe(10);
    expect(note.items[0].unitPriceWithoutVat).toBe(5.5);
    expect(note.deliveryNoteNumber).toMatch(/^BIO-/);
  });

  it("should parse KOMVET tab-delimited TXT delivery note without header", () => {
    const txt = [
      "KOM-101\tMELOXICAM 1.5mg/ml\tB771\t2027-11-30\t5\t12,40\t5",
      "KOM-102\tAMOXICILLIN 250mg tbl\tC882\t2026-08-15\t30\t3,10\t10",
    ].join("\n");

    const note = parseWholesalerDeliveryNote({
      content: txt,
      filename: "komvet_dodaci_list.txt",
    });

    expect(note.wholesaler).toBe("KOMVET");
    expect(note.supplierIco).toBe("");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].sku).toBe("KOM-101");
    expect(note.items[0].expirationDate).toBe("2027-11-30");
    expect(note.items[1].vatRate).toBe(10);
  });

  it("should parse SG-Vet XML delivery note with <item> elements", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<delivery>
  <supplier>SG-VET s.r.o.</supplier>
  <deliveryNoteNumber>2026090421</deliveryNoteNumber>
  <item>
    <sku>SGV-2001</sku>
    <name>Bravecto 250mg tbl</name>
    <batch>X771</batch>
    <expiration>2027-12-31</expiration>
    <qty>6</qty>
    <price>18,90</price>
    <vat>10</vat>
  </item>
  <item>
    <sku>SGV-2002</sku>
    <name>NexGard 28mg tbl</name>
    <batch>Y882</batch>
    <expiration>2026-07-31</expiration>
    <qty>12</qty>
    <price>15,20</price>
    <vat>10</vat>
  </item>
</delivery>`;

    const note = parseWholesalerDeliveryNote({
      content: xml,
      filename: "sgvet_export.xml",
    });

    expect(note.wholesaler).toBe("SG_VET");
    expect(note.deliveryNoteNumber).toBe("2026090421");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].name).toBe("Bravecto 250mg tbl");
    expect(note.items[0].quantity).toBe(6);
    expect(note.items[0].unitPriceWithoutVat).toBe(18.9);
    expect(note.items[1].sku).toBe("SGV-2002");
  });

  it("should parse SANVET CSV delivery note", () => {
    const csv = `
SKU;Nazov;Sarza;Expiracia;Ks;JCena;DPH
SAN-301;KALI PHOS inj;B331;2027-05-31;4;9,90;10
SAN-302;ROMPUN 2% inj;B442;2026-10-31;2;22,50;10
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: csv,
      filename: "sanvet_faktura.csv",
    });

    expect(note.wholesaler).toBe("SANVET");
    expect(note.supplierIco).toBe("");
    expect(note.items).toHaveLength(2);
    expect(note.items[1].name).toBe("ROMPUN 2% inj");
    expect(note.items[1].unitPriceWithoutVat).toBe(22.5);
  });

  it("should parse PHRAMED CSV delivery note", () => {
    const csv = `
Kod;Nazov;Sarza;Expiracia;Mnozstvo;JCena;DPH
PHM-401;RONAXAN 20mg tbl;A554;2027-09-30;8;6,80;10
PHM-402;CLAVASEPTIN 250mg;B665;2026-12-31;16;7,40;10
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: csv,
      filename: "phramed_dodaci_list.csv",
    });

    expect(note.wholesaler).toBe("PHRAMED");
    expect(note.supplierName).toContain("PHRAMED");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].batchNumber).toBe("A554");
    expect(note.items[1].quantity).toBe(16);
  });
});
