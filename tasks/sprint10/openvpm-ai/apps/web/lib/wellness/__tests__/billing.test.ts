import { describe, it, expect } from "vitest";
import { computeNextBillingDate, enrollmentsDueOn } from "../billing";

describe("computeNextBillingDate — monthly", () => {
  it("advances one month", () => {
    expect(computeNextBillingDate("2026-06-15", "monthly")).toBe("2026-07-15");
  });
  it("rolls over the year", () => {
    expect(computeNextBillingDate("2026-12-15", "monthly")).toBe("2027-01-15");
  });
  it("clamps to the last day of a shorter month", () => {
    expect(computeNextBillingDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });
  it("clamps into a leap February", () => {
    expect(computeNextBillingDate("2024-01-31", "monthly")).toBe("2024-02-29");
  });
});

describe("computeNextBillingDate — annual", () => {
  it("advances one year", () => {
    expect(computeNextBillingDate("2026-03-10", "annual")).toBe("2027-03-10");
  });
  it("clamps Feb 29 to Feb 28 on a non-leap year", () => {
    expect(computeNextBillingDate("2024-02-29", "annual")).toBe("2025-02-28");
  });
  it("rejects a malformed date", () => {
    expect(() => computeNextBillingDate("2026/03/10", "annual")).toThrow();
  });
});

describe("enrollmentsDueOn", () => {
  const enrollments = [
    { id: "due-past", status: "active" as const, nextBillingDate: "2026-05-01" },
    { id: "due-today", status: "active" as const, nextBillingDate: "2026-06-01" },
    { id: "future", status: "active" as const, nextBillingDate: "2026-07-01" },
    { id: "cancelled", status: "cancelled" as const, nextBillingDate: "2026-05-01" },
    { id: "no-date", status: "active" as const, nextBillingDate: null },
  ];

  it("returns active enrollments due on or before asOf, excluding others", () => {
    expect(enrollmentsDueOn(enrollments, "2026-06-01").sort()).toEqual([
      "due-past",
      "due-today",
    ]);
  });

  it("returns nothing when none are due yet", () => {
    expect(enrollmentsDueOn(enrollments, "2026-04-01")).toEqual([]);
  });
});
