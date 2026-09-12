import { describe, it, expect } from "vitest";
import { isTypingTarget, normalizeBarcode } from "../use-barcode-scanner";

describe("isTypingTarget", () => {
  it("returns true for form fields that should own keystrokes", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
  });

  it("returns true for contenteditable elements", () => {
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("returns false for non-input targets and null/undefined", () => {
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget({})).toBe(false);
  });
});

describe("normalizeBarcode", () => {
  it("trims whitespace and strips control characters", () => {
    expect(normalizeBarcode("\n8594001234567\r")).toBe("8594001234567");
    expect(normalizeBarcode("  ABC-123 ")).toBe("ABC-123");
  });
});
