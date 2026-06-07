import { describe, it, expect } from "vitest";
import { backupKey } from "../export";

describe("backupKey", () => {
  it("namespaces backups per practice and date", () => {
    expect(backupKey("prac-1", "2026-06-07")).toBe("backups/prac-1/2026-06-07.json");
  });
  it("keeps the practice id segment isolated", () => {
    const a = backupKey("a", "2026-06-07");
    const b = backupKey("b", "2026-06-07");
    expect(a).not.toBe(b);
    expect(a.startsWith("backups/a/")).toBe(true);
  });
});
