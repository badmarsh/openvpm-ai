import { describe, it, expect } from "vitest";
import { matchWaitlist, type WaitlistEntry } from "../waitlist";

function entry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: "w1",
    status: "waiting",
    typeId: null,
    preferredFrom: null,
    preferredTo: null,
    createdAt: new Date("2026-06-01T09:00:00Z"),
    ...over,
  };
}

describe("matchWaitlist", () => {
  it("matches a waiting, type-agnostic, window-open entry", () => {
    const r = matchWaitlist([entry()], { date: "2026-06-10", typeId: "t1" });
    expect(r.map((e) => e.id)).toEqual(["w1"]);
  });

  it("excludes non-waiting entries", () => {
    const r = matchWaitlist(
      [entry({ status: "scheduled" }), entry({ id: "w2", status: "cancelled" })],
      { date: "2026-06-10" }
    );
    expect(r).toHaveLength(0);
  });

  it("respects a type preference", () => {
    const entries = [
      entry({ id: "wellness", typeId: "wellness" }),
      entry({ id: "dental", typeId: "dental" }),
    ];
    const r = matchWaitlist(entries, { date: "2026-06-10", typeId: "dental" });
    expect(r.map((e) => e.id)).toEqual(["dental"]);
  });

  it("matches a typed slot to entries with no type preference", () => {
    const r = matchWaitlist([entry({ typeId: null })], { date: "2026-06-10", typeId: "dental" });
    expect(r).toHaveLength(1);
  });

  it("respects the preferred date window", () => {
    const entries = [
      entry({ id: "tooearly", preferredFrom: "2026-06-15" }),
      entry({ id: "toolate", preferredTo: "2026-06-05" }),
      entry({ id: "inwindow", preferredFrom: "2026-06-01", preferredTo: "2026-06-30" }),
    ];
    const r = matchWaitlist(entries, { date: "2026-06-10" });
    expect(r.map((e) => e.id)).toEqual(["inwindow"]);
  });

  it("returns matches oldest-first (FIFO fairness)", () => {
    const entries = [
      entry({ id: "newer", createdAt: new Date("2026-06-02T09:00:00Z") }),
      entry({ id: "older", createdAt: new Date("2026-06-01T09:00:00Z") }),
    ];
    const r = matchWaitlist(entries, { date: "2026-06-10" });
    expect(r.map((e) => e.id)).toEqual(["older", "newer"]);
  });
});
