import { describe, it, expect } from "vitest";
import { validateKvlCrPassportNumber } from "../kvl-cr";

describe("validateKvlCrPassportNumber", () => {
  it("accepts and normalizes a CZ passport number", () => {
    expect(validateKvlCrPassportNumber("CZ 0123456")).toEqual({
      valid: true,
      normalized: "CZ 0123456",
    });
    expect(validateKvlCrPassportNumber("cz-123456789")).toEqual({
      valid: true,
      normalized: "CZ 123456789",
    });
    expect(validateKvlCrPassportNumber("  CZ 000001  ")).toEqual({
      valid: true,
      normalized: "CZ 000001",
    });
  });

  it("rejects malformed passport numbers", () => {
    expect(validateKvlCrPassportNumber("SK 0123456").valid).toBe(false);
    expect(validateKvlCrPassportNumber("CZ 12").valid).toBe(false);
    expect(validateKvlCrPassportNumber("").valid).toBe(false);
    expect(validateKvlCrPassportNumber("0123456").valid).toBe(false);
  });

  it("returns a helpful error message when invalid", () => {
    const result = validateKvlCrPassportNumber("bad");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("CZ 0123456");
  });
});
