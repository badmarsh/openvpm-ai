import { describe, it, expect } from "vitest";
import { parseWholesalerDeliveryNote, parseDate } from "../wholesaler-import";

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

  it("should assign BEZ-SARZE fallback when batch is missing or blank", () => {
    const csv = `
Kod;Nazov;Sarza;Expiracia;Mnozstvo;MJ;CenaBezDPH;DPH;SpoluBezDPH
CYM-999;Parafínový olej 1000ml;;31.12.2028;2;ks;5,00;20;10,00
    `.trim();

    const note = parseWholesalerDeliveryNote({
      content: csv,
      filename: "CYMEDICA_DL_TEST.csv",
    });

    expect(note.items[0].batchNumber).toBe("BEZ-SARZE");
  });

  it("should flexibly parse Slovak wholesaler date formats", () => {
    expect(parseDate("2026-12-31")).toBe("2026-12-31");
    expect(parseDate("15.06.2027")).toBe("2027-06-15");
    expect(parseDate("15/06/2027")).toBe("2027-06-15");
    expect(parseDate("15-06-2027")).toBe("2027-06-15");
    expect(parseDate("15.06.27")).toBe("2027-06-15");
    expect(parseDate("12/2026")).toBe("2026-12-31");
    expect(parseDate("02/2024")).toBe("2024-02-29"); // leap year
    expect(parseDate("12/26")).toBe("2026-12-31");
    expect(parseDate("2026-10")).toBe("2026-10-31");
    expect(parseDate("2026-12-31T14:30:00Z")).toBe("2026-12-31");
    expect(parseDate("")).toBeUndefined();
    expect(parseDate(undefined)).toBeUndefined();
  });

  it("should detect all 5 distributors via filename aliases", () => {
    const emptyContent = "sku;name;batch;exp;qty;price;vat\n1;Item;B1;2027-01-01;1;10;10";
    expect(parseWholesalerDeliveryNote({ content: emptyContent, filename: "BFARM_export.csv" }).wholesaler).toBe("BIOPHARM");
    expect(parseWholesalerDeliveryNote({ content: emptyContent, filename: "kom_vet_delivery.txt" }).wholesaler).toBe("KOMVET");
    expect(parseWholesalerDeliveryNote({ content: "<item><name>Test</name></item>", filename: "sg_vet_inbound.xml" }).wholesaler).toBe("SG_VET");
    expect(parseWholesalerDeliveryNote({ content: emptyContent, filename: "san-vet-2026.csv" }).wholesaler).toBe("SANVET");
    expect(parseWholesalerDeliveryNote({ content: emptyContent, filename: "pharmed_invoices.csv" }).wholesaler).toBe("PHRAMED");
  });

  it("should parse KOMVET tab-delimited file safely even when names contain semicolons", () => {
    const txt = "KOM-999\tAMOXICILLIN; KYSELINA KLAVULÁNOVÁ 500mg\tBATCH-XYZ\t2027-10-31\t10\t18,50\t10";
    const note = parseWholesalerDeliveryNote({
      content: txt,
      filename: "komvet_order.txt",
    });

    expect(note.wholesaler).toBe("KOMVET");
    expect(note.items).toHaveLength(1);
    expect(note.items[0].sku).toBe("KOM-999");
    expect(note.items[0].name).toBe("AMOXICILLIN; KYSELINA KLAVULÁNOVÁ 500mg");
    expect(note.items[0].batchNumber).toBe("BATCH-XYZ");
    expect(note.items[0].quantity).toBe(10);
    expect(note.items[0].unitPriceWithoutVat).toBe(18.5);
  });

  it("should parse SG-Vet XML with Slovak <polozka> and tag aliases", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<doklad>
  <cislo_dokladu>SGV-889900</cislo_dokladu>
  <polozka>
    <kod_tovaru>SGV-3301</kod_tovaru>
    <nazov_tovaru>Ketamidor 100mg/ml 10ml</nazov_tovaru>
    <sarza>LOT-KET-1</sarza>
    <expiracia>2027-08-31</expiracia>
    <mnozstvo>5</mnozstvo>
    <cena_bez_dph>16,40</cena_bez_dph>
    <sadzba_dph>10</sadzba_dph>
  </polozka>
  <polozka>
    <kod_tovaru>SGV-3302</kod_tovaru>
    <nazov_tovaru>Marbocyl 2% inj 20ml</nazov_tovaru>
    <sarza>LOT-MAR-2</sarza>
    <expiracia>2026-11-30</expiracia>
    <mnozstvo>2</mnozstvo>
    <cena_bez_dph>24,00</cena_bez_dph>
    <sadzba_dph>10</sadzba_dph>
  </polozka>
</doklad>`;

    const note = parseWholesalerDeliveryNote({
      content: xml,
      filename: "sgvet_slovak_export.xml",
    });

    expect(note.wholesaler).toBe("SG_VET");
    expect(note.deliveryNoteNumber).toBe("SGV-889900");
    expect(note.items).toHaveLength(2);
    expect(note.items[0].sku).toBe("SGV-3301");
    expect(note.items[0].name).toBe("Ketamidor 100mg/ml 10ml");
    expect(note.items[0].isControlledSubstance).toBe(true);
    expect(note.items[1].name).toBe("Marbocyl 2% inj 20ml");
    expect(note.items[1].isControlledSubstance).toBe(false);
  });

  it("should correctly flag controlled substances (Act 139/1998 Coll.) across wholesalers", () => {
    const csv = [
      "Kod;Nazov;Sarza;Expiracia;Ks;JCena;DPH",
      "BIO-K1;Narkamon 100mg/ml inj 50ml;SAR-1;2027-12-31;2;15,00;10",
      "BIO-B1;Torbugesic 10mg/ml 10ml;SAR-2;2027-11-30;1;45,00;10",
      "BIO-A1;Synulox RTU 100ml;SAR-3;2027-09-30;5;22,00;10",
    ].join("\n");

    const note = parseWholesalerDeliveryNote({
      content: csv,
      wholesaler: "BIOPHARM",
    });

    expect(note.items[0].isControlledSubstance).toBe(true); // Narkamon (ketamine)
    expect(note.items[1].isControlledSubstance).toBe(true); // Torbugesic (butorphanol)
    expect(note.items[2].isControlledSubstance).toBe(false); // Synulox (amoxicillin)
  });
});
