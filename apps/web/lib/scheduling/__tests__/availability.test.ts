import { describe, it, expect } from "vitest";
import { findOpenSlots } from "../availability";

const d = (iso: string) => new Date(iso);

describe("findOpenSlots", () => {
  it("fills an empty day with non-overlapping slots", () => {
    const slots = findOpenSlots({
      dayStart: d("2026-06-02T09:00:00Z"),
      dayEnd: d("2026-06-02T12:00:00Z"),
      slotMinutes: 30,
      busy: [],
    });
    expect(slots).toHaveLength(6); // 3 hours / 30 min
    expect(slots[0]!.start.toISOString()).toBe("2026-06-02T09:00:00.000Z");
    expect(slots[5]!.end.toISOString()).toBe("2026-06-02T12:00:00.000Z");
  });

  it("removes slots that overlap a busy interval but keeps adjacent ones", () => {
    const slots = findOpenSlots({
      dayStart: d("2026-06-02T09:00:00Z"),
      dayEnd: d("2026-06-02T11:00:00Z"),
      slotMinutes: 30,
      busy: [{ startTime: d("2026-06-02T09:30:00Z"), endTime: d("2026-06-02T10:00:00Z") }],
    });
    const starts = slots.map((s) => s.start.toISOString());
    // 09:00 ok, 09:30 blocked, 10:00 ok (back-to-back), 10:30 ok
    expect(starts).toEqual([
      "2026-06-02T09:00:00.000Z",
      "2026-06-02T10:00:00.000Z",
      "2026-06-02T10:30:00.000Z",
    ]);
  });

  it("does not return a slot that would run past dayEnd", () => {
    const slots = findOpenSlots({
      dayStart: d("2026-06-02T09:00:00Z"),
      dayEnd: d("2026-06-02T09:45:00Z"),
      slotMinutes: 30,
      busy: [],
    });
    // Only 09:00-09:30 fits; 09:30-10:00 would exceed dayEnd.
    expect(slots).toHaveLength(1);
  });

  it("supports a finer step than the slot length", () => {
    const slots = findOpenSlots({
      dayStart: d("2026-06-02T09:00:00Z"),
      dayEnd: d("2026-06-02T10:00:00Z"),
      slotMinutes: 30,
      stepMinutes: 15,
      busy: [],
    });
    // starts at :00, :15, :30 (last that still fits a 30-min slot before 10:00)
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-06-02T09:00:00.000Z",
      "2026-06-02T09:15:00.000Z",
      "2026-06-02T09:30:00.000Z",
    ]);
  });

  it("throws on a non-positive slot length", () => {
    expect(() =>
      findOpenSlots({ dayStart: d("2026-06-02T09:00:00Z"), dayEnd: d("2026-06-02T10:00:00Z"), slotMinutes: 0, busy: [] })
    ).toThrow(/positive/);
  });
});
