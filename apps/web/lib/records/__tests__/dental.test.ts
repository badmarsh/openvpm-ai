import { describe, it, expect } from "vitest";
import { normalizeToothCode, isValidToothCode } from "../dental";

describe("normalizeToothCode", () => {
  it("trims and uppercases the tooth code", () => {
    expect(normalizeToothCode("  104m ")).toBe("104M");
    expect(normalizeToothCode(" 47 ")).toBe("47");
  });
});

describe("isValidToothCode", () => {
  it("accepts FDI notation tooth codes", () => {
    expect(isValidToothCode("104")).toBe(true);
    expect(isValidToothCode("47")).toBe(true);
    expect(isValidToothCode("8")).toBe(true);
    expect(isValidToothCode("104M")).toBe(true);
    expect(isValidToothCode("M104")).toBe(true);
  });

  it("rejects empty or malformed tooth codes", () => {
    expect(isValidToothCode("")).toBe(false);
    expect(isValidToothCode("   ")).toBe(false);
    expect(isValidToothCode("tooth")).toBe(false);
    expect(isValidToothCode("10-4")).toBe(false);
  });
});
