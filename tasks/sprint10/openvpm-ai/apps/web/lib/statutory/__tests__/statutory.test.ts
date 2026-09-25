import { describe, it, expect } from "vitest";

function calculateObservationMilestones(biteDateStr: string) {
  const bite = new Date(biteDateStr);
  const day1 = new Date(bite.getTime() + 1 * 24 * 60 * 60 * 1000);
  const day5 = new Date(bite.getTime() + 5 * 24 * 60 * 60 * 1000);
  const day14 = new Date(bite.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    day1: day1.toISOString().slice(0, 10),
    day5: day5.toISOString().slice(0, 10),
    day14: day14.toISOString().slice(0, 10),
  };
}

function getRabiesComplianceStatus(
  administeredAt: Date | string | null | undefined,
  checkDate: Date = new Date()
) {
  if (!administeredAt) {
    return { status: "unknown" };
  }
  const adminDate = new Date(administeredAt);
  const diffDays = Math.floor(
    (checkDate.getTime() - adminDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 3) {
    return { status: "compliant", diffDays };
  }
  return { status: "overdue", diffDays };
}

describe("Slovak Statutory Compliance Logic (§ 19 and § 29 Law 39/2007 Z. z.)", () => {
  it("calculates accurate 14-day rabies observation checkpoints (Day 1, Day 5, Day 14)", () => {
    const biteDate = "2026-05-01";
    const milestones = calculateObservationMilestones(biteDate);

    expect(milestones.day1).toBe("2026-05-02");
    expect(milestones.day5).toBe("2026-05-06");
    expect(milestones.day14).toBe("2026-05-15");
  });

  it("evaluates rabies vaccination notification compliance within 3-day statutory window", () => {
    const vaxDate = new Date("2026-05-10T10:00:00Z");
    const sameDay = new Date("2026-05-10T14:00:00Z");
    const twoDaysLater = new Date("2026-05-12T10:00:00Z");
    const fourDaysLater = new Date("2026-05-14T11:00:00Z");

    expect(getRabiesComplianceStatus(vaxDate, sameDay).status).toBe("compliant");
    expect(getRabiesComplianceStatus(vaxDate, twoDaysLater).status).toBe("compliant");
    expect(getRabiesComplianceStatus(vaxDate, fourDaysLater).status).toBe("overdue");
  });

  it("flags missing rabies administration date as unknown", () => {
    expect(getRabiesComplianceStatus(null).status).toBe("unknown");
    expect(getRabiesComplianceStatus(undefined).status).toBe("unknown");
  });
});

describe("Slovak & EU Statutory Withdrawal Calculations (Zákon č. 39/2007 Z. z. & Nariadenie EÚ 2019/6)", () => {
  it("calculates independent end-of-day timestamps for meat, milk, and eggs", async () => {
    const { calculateStatutoryWithdrawal } = await import("../withdrawal");
    const treatmentDate = new Date("2026-06-01T10:30:00Z");
    const result = calculateStatutoryWithdrawal(
      treatmentDate,
      { meat: 10, milk: 3, eggs: 5 },
      false,
      new Date("2026-06-02T00:00:00Z")
    );

    expect(result.effectiveMeatDays).toBe(10);
    expect(result.effectiveMilkDays).toBe(3);
    expect(result.effectiveEggsDays).toBe(5);
    expect(result.maxDays).toBe(10);

    // End-of-day check: hours 23, minutes 59, seconds 59, ms 999
    expect(result.meatSafeUntil?.getHours()).toBe(23);
    expect(result.meatSafeUntil?.getMinutes()).toBe(59);
    expect(result.meatSafeUntil?.getSeconds()).toBe(59);
    expect(result.meatSafeUntil?.getMilliseconds()).toBe(999);

    expect(result.milkSafeUntil?.getHours()).toBe(23);
    expect(result.milkSafeUntil?.getMinutes()).toBe(59);

    expect(result.eggsSafeUntil?.getHours()).toBe(23);
    expect(result.eggsSafeUntil?.getMinutes()).toBe(59);

    // Milk safe date should precede meat safe date
    expect(result.milkSafeUntil!.getTime()).toBeLessThan(result.meatSafeUntil!.getTime());
  });

  it("applies statutory cascade minimums under EU 2019/6 (meat 28d, milk 7d, eggs 7d)", async () => {
    const { calculateStatutoryWithdrawal } = await import("../withdrawal");
    const treatmentDate = new Date("2026-06-01T12:00:00Z");
    // Drug has registered withdrawal of only 5 days meat and 2 days milk, but used off-label / cascade
    const cascadeResult = calculateStatutoryWithdrawal(
      treatmentDate,
      { meat: 5, milk: 2, eggs: 0 },
      true, // isCascade = true
      new Date("2026-06-01T12:00:00Z")
    );

    expect(cascadeResult.isCascadeApplied).toBe(true);
    expect(cascadeResult.effectiveMeatDays).toBe(28); // minimum 28 days
    expect(cascadeResult.effectiveMilkDays).toBe(7);  // minimum 7 days
    expect(cascadeResult.effectiveEggsDays).toBe(7);  // minimum 7 days
    expect(cascadeResult.maxDays).toBe(28);
  });
});

