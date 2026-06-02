import { describe, it, expect } from "vitest";
import { buildRequestedSlot } from "../booking";

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("buildRequestedSlot", () => {
  it("builds a slot with end = start + duration", () => {
    const { startTime, endTime } = buildRequestedSlot({
      preferredDate: "2026-07-01",
      preferredTime: "09:00",
      durationMinutes: 45,
      now: NOW,
    });
    expect(endTime.getTime() - startTime.getTime()).toBe(45 * 60_000);
  });

  it("defaults to a 30-minute slot when duration is missing or invalid", () => {
    const a = buildRequestedSlot({ preferredDate: "2026-07-01", preferredTime: "09:00", now: NOW });
    expect(a.endTime.getTime() - a.startTime.getTime()).toBe(30 * 60_000);

    const b = buildRequestedSlot({
      preferredDate: "2026-07-01",
      preferredTime: "09:00",
      durationMinutes: 0,
      now: NOW,
    });
    expect(b.endTime.getTime() - b.startTime.getTime()).toBe(30 * 60_000);
  });

  it("rejects a malformed date", () => {
    expect(() =>
      buildRequestedSlot({ preferredDate: "07/01/2026", preferredTime: "09:00", now: NOW })
    ).toThrow(/YYYY-MM-DD/);
  });

  it("rejects a malformed or out-of-range time", () => {
    expect(() =>
      buildRequestedSlot({ preferredDate: "2026-07-01", preferredTime: "9am", now: NOW })
    ).toThrow(/HH:MM/);
    expect(() =>
      buildRequestedSlot({ preferredDate: "2026-07-01", preferredTime: "25:00", now: NOW })
    ).toThrow(/HH:MM/);
  });

  it("rejects a slot in the past", () => {
    expect(() =>
      buildRequestedSlot({ preferredDate: "2020-01-01", preferredTime: "09:00", now: NOW })
    ).toThrow(/future/);
  });
});
