import { describe, expect, it } from "vitest";
import { classifyPostOpText } from "../postoperative";

describe("classifyPostOpText — post-operative care detection", () => {
  it("flags a visit with recorded anesthesia", () => {
    const result = classifyPostOpText({
      procedureTexts: ["Kontrola rany"],
      anesthesiaUsed: true,
    });
    expect(result.isPostOp).toBe(true);
    expect(result.signals).toContain("anesthesia");
  });

  it("flags Slovak surgical procedure names", () => {
    const cases = [
      "Kastrácia psa",
      "Laparotomia – resekcia čreva",
      "Amputácia prednej končatiny",
      "Sterilizácia mačky",
    ];
    for (const name of cases) {
      const result = classifyPostOpText({ procedureTexts: [name] });
      expect(result.isPostOp, name).toBe(true);
      expect(result.signals, name).toContain("surgical_procedure");
    }
  });

  it("flags English surgical procedure names", () => {
    const result = classifyPostOpText({
      procedureTexts: ["Exploratory laparotomy with splenectomy"],
    });
    expect(result.isPostOp).toBe(true);
    expect(result.signals).toContain("surgical_procedure");
  });

  it("flags surgical service catalog codes/categories", () => {
    const result = classifyPostOpText({
      serviceTexts: ["SURG-108 Chirurgia mäkkých tkanív"],
    });
    expect(result.isPostOp).toBe(true);
    expect(result.signals).toContain("surgical_service_code");
  });

  it("flags surgical appointment types", () => {
    const result = classifyPostOpText({ appointmentTypeText: "Operácia – chirurgia" });
    expect(result.isPostOp).toBe(true);
    expect(result.signals).toContain("surgical_appointment_type");
  });

  it("flags post-operative discharge instruction wording (SK + EN)", () => {
    const cases = [
      "Kontrolujte operačnú rannu, stehy stiahneme o 10 dní.",
      "Pooperatívna rekonvalescencia, podávajte analgetiká.",
      "Post-op care: keep the incision clean and dry.",
    ];
    for (const text of cases) {
      const result = classifyPostOpText({ dischargeInstructions: text });
      expect(result.isPostOp, text).toBe(true);
      expect(result.signals, text).toContain("post_op_instructions");
    }
  });

  it("does NOT flag a routine wellness visit", () => {
    const result = classifyPostOpText({
      procedureTexts: ["Klinická prehliadka", "Očkovanie proti besnote"],
      serviceTexts: ["VAC-101 Vakcinácia"],
      appointmentTypeText: "Preventívna prehliadka",
      dischargeInstructions: "Kontrola o rok, kvalitné krmivo, pravidelná odčervovanie.",
    });
    expect(result.isPostOp).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("does NOT flag generic dental cleaning without surgery signals", () => {
    const result = classifyPostOpText({
      procedureTexts: ["Zubný kameň – ultrazvukové čistenie"],
      dischargeInstructions: "Domáca starostlivosť o zuby.",
    });
    expect(result.isPostOp).toBe(false);
  });
});
