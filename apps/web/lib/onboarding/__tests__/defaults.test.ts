import { describe, it, expect } from "vitest";
import {
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_ROOMS,
  DEFAULT_SERVICES,
} from "../defaults";

const ROOM_TYPES = ["exam", "surgery", "treatment", "boarding"];

describe("default appointment types", () => {
  it("are non-empty and well-formed", () => {
    expect(DEFAULT_APPOINTMENT_TYPES.length).toBeGreaterThan(0);
    for (const t of DEFAULT_APPOINTMENT_TYPES) {
      expect(t.name.trim()).not.toBe("");
      expect(t.durationMinutes).toBeGreaterThan(0);
      expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect([0, 1]).toContain(t.requiresDoctor);
      expect(ROOM_TYPES).toContain(t.defaultRoomType);
    }
  });
});

describe("default rooms", () => {
  it("have valid types and unique names", () => {
    expect(DEFAULT_ROOMS.length).toBeGreaterThan(0);
    const names = DEFAULT_ROOMS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    for (const r of DEFAULT_ROOMS) expect(ROOM_TYPES).toContain(r.type);
  });
});

describe("default services", () => {
  it("have parseable, non-negative prices and names", () => {
    expect(DEFAULT_SERVICES.length).toBeGreaterThan(0);
    for (const s of DEFAULT_SERVICES) {
      expect(s.name.trim()).not.toBe("");
      const price = Number(s.defaultPrice);
      expect(Number.isFinite(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(0);
      expect(s.defaultPrice).toMatch(/^\d+\.\d{2}$/);
      expect(typeof s.taxable).toBe("boolean");
    }
  });
});
