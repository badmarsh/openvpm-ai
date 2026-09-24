import { describe, expect, it } from "vitest";
import { formatDateYmdToDisplay, formatTimeToDisplay } from "../date-display";

describe("formatDateYmdToDisplay", () => {
  it("formats YYYY-MM-DD as dd.mm.yyyy", () => {
    expect(formatDateYmdToDisplay("2026-09-05")).toBe("05.09.2026");
  });

  it("handles single-digit day and month", () => {
    expect(formatDateYmdToDisplay("2026-01-02")).toBe("02.01.2026");
  });

  it("returns empty string for empty or null values", () => {
    expect(formatDateYmdToDisplay("")).toBe("");
    expect(formatDateYmdToDisplay(null)).toBe("");
    expect(formatDateYmdToDisplay(undefined)).toBe("");
  });

  it("returns the original value when not in YYYY-MM-DD format", () => {
    expect(formatDateYmdToDisplay("not-a-date")).toBe("not-a-date");
  });
});

describe("formatTimeToDisplay", () => {
  const afternoon = new Date(2026, 8, 24, 14, 5, 0);

  it("formats HH:mm for the sk locale", () => {
    expect(formatTimeToDisplay(afternoon, "sk")).toBe("14:05");
  });

  it("formats HH:mm for the en locale (24-hour, never browser default)", () => {
    expect(formatTimeToDisplay(afternoon, "en")).toBe("14:05");
  });

  it("accepts ISO date-time strings", () => {
    expect(formatTimeToDisplay("2026-09-24T08:30:00.000Z", "en")).toMatch(
      /^\d{2}:\d{2}$/,
    );
  });

  it("returns an em dash for missing or invalid values", () => {
    expect(formatTimeToDisplay(null, "sk")).toBe("—");
    expect(formatTimeToDisplay(undefined, "en")).toBe("—");
    expect(formatTimeToDisplay("", "sk")).toBe("—");
    expect(formatTimeToDisplay("not-a-date", "en")).toBe("—");
  });
});
