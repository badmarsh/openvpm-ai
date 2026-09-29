import { describe, expect, it } from "vitest";
import { checkStatutoryWithdrawalFloor } from "../withdrawal";

/**
 * STATUTORY-FAILCLOSED-1 — an unrecognised substance administered to a
 * food-producing animal must never be cleared with a 0-day withdrawal period.
 *
 * Before the fix, `checkStatutoryWithdrawalFloor` only derived floors from the
 * ŠÚKL catalog or an explicit `isCascade` flag. An unknown substance with
 * `isCascade` unset produced `minMeat = 0 / minMilk = 0`, so
 * `statutory.createWithdrawalPeriod` persisted a withdrawal period ending the
 * same day and the animal was immediately cleared for slaughter / milk.
 *
 * Under Nariadenie EÚ 2019/6 Čl. 111/115 an administration with no authorized
 * product for that species falls into the statutory cascade, so the cascade
 * minima (meat 28 d, milk 7 d, eggs 7 d) are the legal floor.
 */
describe("STATUTORY-FAILCLOSED-1: unrecognised substances in food animals", () => {
  it("rejects a 0-day meat withdrawal for an unknown substance in cattle", () => {
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Totally Unknown Compound XYZ",
      targetAnimalType: "bovine",
      meatWithdrawalDays: 0,
      milkWithdrawalDays: 0,
    });

    expect(result.unknownSubstanceForFoodAnimal).toBe(true);
    expect(result.hasViolation).toBe(true);
    expect(result.effectiveMeatDays).toBe(28);
    expect(result.effectiveMilkDays).toBe(7);
    expect(
      result.violations.map((v) => [v.field, v.statutoryMinimumDays]),
    ).toEqual([
      ["meat", 28],
      ["milk", 7],
    ]);
  });

  it("clamps eggs for an unknown substance in poultry but not milk", () => {
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Unknown Substance ABC",
      targetAnimalType: "poultry",
      meatWithdrawalDays: 0,
      milkWithdrawalDays: 0,
      eggWithdrawalDays: 0,
    });

    expect(result.hasViolation).toBe(true);
    expect(result.effectiveMeatDays).toBe(28);
    expect(result.effectiveEggsDays).toBe(7);
    // Poultry do not produce milk — raising a milk floor would be noise.
    expect(result.violations.map((v) => v.field)).not.toContain("milk");
  });

  it("does not clamp pigs' milk, only meat", () => {
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Unknown Substance ABC",
      targetAnimalType: "porcine",
      meatWithdrawalDays: 0,
      milkWithdrawalDays: 0,
    });

    expect(result.violations.map((v) => v.field)).toEqual(["meat"]);
    expect(result.effectiveMeatDays).toBe(28);
  });

  it("leaves explicitly recorded non-zero values to the veterinarian", () => {
    // A vet who writes down a real (if short) period is not silently
    // overridden; the caller still learns the substance is unrecognised.
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Ringer-Laktát inf.",
      targetAnimalType: "bovine",
      meatWithdrawalDays: 3,
      milkWithdrawalDays: 1,
    });

    expect(result.unknownSubstanceForFoodAnimal).toBe(true);
    expect(result.hasViolation).toBe(false);
    expect(result.effectiveMeatDays).toBe(3);
    expect(result.effectiveMilkDays).toBe(1);
  });

  it("keeps catalog drugs on their SPC floors, not the cascade default", () => {
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Cobactan 2.5% inj.",
      targetAnimalType: "bovine",
      meatWithdrawalDays: 5,
      milkWithdrawalDays: 1,
    });

    expect(result.unknownSubstanceForFoodAnimal).toBe(false);
    expect(result.hasViolation).toBe(false);
    expect(result.effectiveMeatDays).toBe(5);
    expect(result.effectiveMilkDays).toBe(1);
  });

  it("still exempts companion animals entirely", () => {
    for (const species of ["companion", "canine", "feline", "pet"]) {
      const result = checkStatutoryWithdrawalFloor({
        medicationName: "Totally Unknown Compound XYZ",
        targetAnimalType: species,
        meatWithdrawalDays: 0,
        milkWithdrawalDays: 0,
      });
      expect(result.hasViolation).toBe(false);
      expect(result.unknownSubstanceForFoodAnimal).toBe(false);
      expect(result.violations).toHaveLength(0);
    }
  });

  it("keeps a genuinely zero-withdrawal catalog product clearable", () => {
    // Duphalyte is registered with 0 days — the catalog match must win over
    // the unknown-substance cascade default.
    const result = checkStatutoryWithdrawalFloor({
      medicationName: "Duphalyte infúzny roztok",
      targetAnimalType: "bovine",
      meatWithdrawalDays: 0,
      milkWithdrawalDays: 0,
    });

    expect(result.statutoryDrug?.id).toBe("duphalyte");
    expect(result.hasViolation).toBe(false);
    expect(result.effectiveMeatDays).toBe(0);
  });
});
