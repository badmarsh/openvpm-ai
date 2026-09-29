import { describe, it, expect } from "vitest";
import { normalizeE164 } from "../phone";

describe("normalizeE164", () => {
  it("passes through a valid E.164 number", () => {
    expect(normalizeE164("+15555550123")).toBe("+15555550123");
  });

  it("normalises a formatted 10-digit US number", () => {
    expect(normalizeE164("(555) 555-0123")).toBe("+15555550123");
  });

  it("normalises a bare 10-digit US number", () => {
    expect(normalizeE164("5555550123")).toBe("+15555550123");
  });

  it("normalises an 11-digit US number with leading 1", () => {
    expect(normalizeE164("1 555 555 0123")).toBe("+15555550123");
  });

  it("keeps a valid international number", () => {
    expect(normalizeE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("normalises Slovak 10-digit national numbers (09xx xxx xxx)", () => {
    expect(normalizeE164("0905 123 456")).toBe("+421905123456");
    expect(normalizeE164("0911234567")).toBe("+421911234567");
    expect(normalizeE164("02 1234 5678")).toBe("+421212345678");
  });

  it("normalises Slovak numbers with 00421 prefix", () => {
    expect(normalizeE164("00421 905 123 456")).toBe("+421905123456");
  });

  it("normalises Slovak 9-digit mobile numbers without leading zero", () => {
    expect(normalizeE164("905 123 456")).toBe("+421905123456");
    expect(normalizeE164("948111222")).toBe("+421948111222");
  });

  it("rejects plus-prefixed numbers with an invalid zero country code", () => {
    expect(normalizeE164("+05555550123")).toBeNull();
    expect(normalizeE164("+0 555 555 0123")).toBeNull();
  });

  it("returns null for empty / nullish input", () => {
    expect(normalizeE164("")).toBeNull();
    expect(normalizeE164(null)).toBeNull();
    expect(normalizeE164(undefined)).toBeNull();
  });

  it("returns null for ambiguous short numbers without a country code", () => {
    expect(normalizeE164("12345")).toBeNull();
  });
});
