import { describe, expect, it } from "vitest";
import { formatDateYmdToDisplay } from "../date-display";

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
