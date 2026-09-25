import { describe, it, expect } from "vitest";
import {
  checkStatutoryWithdrawalFloor,
  calculateStatutoryWithdrawal,
  calculateWithdrawalSafeUntil,
} from "../withdrawal";

describe("checkStatutoryWithdrawalFloor — Statutory Withdrawal Periods (Zákon č. 39/2007 Z. z. & EU 2019/6)", () => {
  describe("Catalog drug statutory minimums (ŠÚKL / SPC)", () => {
    it("enforces Draxxin (Tulatromycín) minimum 22 days meat for bovine", () => {
      // Sub-statutory attempt (0 days)
      const violatedZero = checkStatutoryWithdrawalFloor({
        medicationName: "Draxxin 100 mg/ml inj.",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
      });
      expect(violatedZero.hasViolation).toBe(true);
      expect(violatedZero.violations).toHaveLength(1);
      expect(violatedZero.violations[0]).toMatchObject({
        field: "meat",
        recordedDays: 0,
        statutoryMinimumDays: 22,
      });
      expect(violatedZero.effectiveMeatDays).toBe(22);

      // Sub-statutory attempt (15 days < 22 days)
      const violated15 = checkStatutoryWithdrawalFloor({
        medicationName: "Draxxin",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 15,
        milkWithdrawalDays: 0,
      });
      expect(violated15.hasViolation).toBe(true);
      expect(violated15.effectiveMeatDays).toBe(22);

      // Compliant entry (22 days and 30 days)
      const compliant22 = checkStatutoryWithdrawalFloor({
        medicationName: "Draxxin",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 22,
        milkWithdrawalDays: 0,
      });
      expect(compliant22.hasViolation).toBe(false);
      expect(compliant22.violations).toHaveLength(0);

      const compliant30 = checkStatutoryWithdrawalFloor({
        medicationName: "Draxxin",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 30,
        milkWithdrawalDays: 0,
      });
      expect(compliant30.hasViolation).toBe(false);
      expect(compliant30.effectiveMeatDays).toBe(30);
    });

    it("enforces Cobactan (Cefchinóm) meat (5d) and milk (1d) minimums", () => {
      const violated = checkStatutoryWithdrawalFloor({
        medicationName: "Cobactan 2.5% inj.",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 2,
        milkWithdrawalDays: 0,
      });
      expect(violated.hasViolation).toBe(true);
      expect(violated.violations).toHaveLength(2);
      expect(violated.violations.map((v) => v.field)).toEqual(["meat", "milk"]);
      expect(violated.effectiveMeatDays).toBe(5);
      expect(violated.effectiveMilkDays).toBe(1);

      const compliant = checkStatutoryWithdrawalFloor({
        medicationName: "Cobactan",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 5,
        milkWithdrawalDays: 1,
      });
      expect(compliant.hasViolation).toBe(false);
    });

    it("enforces Shotapen (Penicilín) meat (30d) and milk (10d) floors", () => {
      const violated = checkStatutoryWithdrawalFloor({
        medicationName: "Shotapen L.A.",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 14,
        milkWithdrawalDays: 5,
      });
      expect(violated.hasViolation).toBe(true);
      expect(violated.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "meat", statutoryMinimumDays: 30 }),
          expect.objectContaining({ field: "milk", statutoryMinimumDays: 10 }),
        ]),
      );
      expect(violated.effectiveMeatDays).toBe(30);
      expect(violated.effectiveMilkDays).toBe(10);
    });

    it("enforces Noroclav (Amoxicilín + kys. klavulánová) meat (42d) and milk (3d) floors", () => {
      const violated = checkStatutoryWithdrawalFloor({
        medicationName: "Noroclav RTU inj.",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 28,
        milkWithdrawalDays: 1,
      });
      expect(violated.hasViolation).toBe(true);
      expect(violated.violations).toHaveLength(2);
      expect(violated.effectiveMeatDays).toBe(42);
      expect(violated.effectiveMilkDays).toBe(3);
    });

    it("enforces Baytril (Enrofloxacín) meat (14d) and milk (4d) floors", () => {
      const violated = checkStatutoryWithdrawalFloor({
        medicationName: "Baytril 10%",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 10,
        milkWithdrawalDays: 2,
      });
      expect(violated.hasViolation).toBe(true);
      expect(violated.effectiveMeatDays).toBe(14);
      expect(violated.effectiveMilkDays).toBe(4);
    });

    it("enforces Melovem (Meloxikam) meat (15d) and milk (5d) floors", () => {
      const violated = checkStatutoryWithdrawalFloor({
        medicationName: "Melovem 20 mg/ml",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 7,
        milkWithdrawalDays: 2,
      });
      expect(violated.hasViolation).toBe(true);
      expect(violated.effectiveMeatDays).toBe(15);
      expect(violated.effectiveMilkDays).toBe(5);
    });
  });

  describe("EU Regulation 2019/6 Art. 115 Cascade statutory minimums", () => {
    it("enforces statutory minimums (meat 28d, milk 7d, eggs 7d) when cascade is true", () => {
      const cascadeViolated = checkStatutoryWithdrawalFloor({
        medicationName: "Generic Compound Unregistered",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 7,
        milkWithdrawalDays: 2,
        eggWithdrawalDays: 0,
        isCascade: true,
      });
      expect(cascadeViolated.hasViolation).toBe(true);
      expect(cascadeViolated.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "meat",
            recordedDays: 7,
            statutoryMinimumDays: 28,
            citation: expect.stringContaining("Čl. 115"),
          }),
          expect.objectContaining({
            field: "milk",
            recordedDays: 2,
            statutoryMinimumDays: 7,
            citation: expect.stringContaining("Čl. 115"),
          }),
          expect.objectContaining({
            field: "eggs",
            recordedDays: 0,
            statutoryMinimumDays: 7,
            citation: expect.stringContaining("Čl. 115"),
          }),
        ]),
      );
      expect(cascadeViolated.effectiveMeatDays).toBe(28);
      expect(cascadeViolated.effectiveMilkDays).toBe(7);
      expect(cascadeViolated.effectiveEggsDays).toBe(7);
    });

    it("allows higher days when cascade is true", () => {
      const cascadeCompliant = checkStatutoryWithdrawalFloor({
        medicationName: "Generic Compound",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 35,
        milkWithdrawalDays: 10,
        eggWithdrawalDays: 14,
        isCascade: true,
      });
      expect(cascadeCompliant.hasViolation).toBe(false);
      expect(cascadeCompliant.violations).toHaveLength(0);
      expect(cascadeCompliant.effectiveMeatDays).toBe(35);
      expect(cascadeCompliant.effectiveMilkDays).toBe(10);
      expect(cascadeCompliant.effectiveEggsDays).toBe(14);
    });

    it("respects catalog floor if catalog requires more than cascade minimum", () => {
      // Noroclav meat floor is 42d, which is > cascade 28d
      const result = checkStatutoryWithdrawalFloor({
        medicationName: "Noroclav",
        targetAnimalType: "bovine",
        meatWithdrawalDays: 30, // > 28d cascade, but < 42d catalog
        milkWithdrawalDays: 7,
        isCascade: true,
      });
      expect(result.hasViolation).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.field).toBe("meat");
      expect(result.violations[0]!.statutoryMinimumDays).toBe(42);
      expect(result.effectiveMeatDays).toBe(42);
    });
  });

  describe("Companion animal exemption", () => {
    it("exempts companion / pet animals from statutory food withdrawal floors", () => {
      const dog = checkStatutoryWithdrawalFloor({
        medicationName: "Draxxin",
        targetAnimalType: "companion",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
      });
      expect(dog.hasViolation).toBe(false);
      expect(dog.violations).toHaveLength(0);

      const canine = checkStatutoryWithdrawalFloor({
        medicationName: "Melovem",
        targetAnimalType: "canine",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
      });
      expect(canine.hasViolation).toBe(false);

      const feline = checkStatutoryWithdrawalFloor({
        medicationName: "Baytril",
        targetAnimalType: "feline",
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
      });
      expect(feline.hasViolation).toBe(false);
    });
  });

  describe("Date calculation & End-of-day boundary (23:59:59.999)", () => {
    it("pins safeUntil to 23:59:59.999 of the final withdrawal day", () => {
      const adminDate = new Date("2026-06-01T09:30:00.000Z");
      const res = calculateWithdrawalSafeUntil(adminDate, 5, 0);

      expect(res.safeUntil.getHours()).toBe(23);
      expect(res.safeUntil.getMinutes()).toBe(59);
      expect(res.safeUntil.getSeconds()).toBe(59);
      expect(res.safeUntil.getMilliseconds()).toBe(999);
      expect(res.maxDays).toBe(5);
    });

    it("calculates multi-substance statutory withdrawal with cascade", () => {
      const adminDate = new Date("2026-06-01T00:00:00.000Z");
      const statutory = calculateStatutoryWithdrawal(
        adminDate,
        { meat: 10, milk: 2 },
        true, // isCascade -> meat 28d, milk 7d
        new Date("2026-06-10T00:00:00.000Z"),
      );

      expect(statutory.isCascadeApplied).toBe(true);
      expect(statutory.effectiveMeatDays).toBe(28);
      expect(statutory.effectiveMilkDays).toBe(7);
      expect(statutory.maxDays).toBe(28);
      expect(statutory.isActive).toBe(true);
    });
  });
});
