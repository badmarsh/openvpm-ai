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
