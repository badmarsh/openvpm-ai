import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { customNavItems } from "../custom-nav";

/**
 * Regression guard for I18N-COLLISION-1: when a custom-nav item carries an
 * i18nKey that is missing from a dictionary, the i18n helper silently falls
 * back to the hardcoded Slovak `label`, showing Slovak to every user
 * regardless of their language setting. Every referenced key must exist in
 * both sk.json and en.json.
 */
const messagesDir = join(__dirname, "..", "..", "messages");

function loadDictionary(file: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(messagesDir, file), "utf-8"),
  ) as Record<string, unknown>;
}

function resolveKey(dict: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

describe("custom-nav i18n keys (I18N-COLLISION-1)", () => {
  const sk = loadDictionary("sk.json");
  const en = loadDictionary("en.json");

  it("every nav i18nKey resolves to a string in both dictionaries", () => {
    const keys = customNavItems
      .map((item) => item.i18nKey)
      .filter((key): key is string => Boolean(key));

    expect(keys.length).toBeGreaterThan(10);
    const missingSk: string[] = [];
    const missingEn: string[] = [];

    for (const key of keys) {
      if (typeof resolveKey(sk, key) !== "string") missingSk.push(key);
      if (typeof resolveKey(en, key) !== "string") missingEn.push(key);
    }

    expect(missingSk).toEqual([]);
    expect(missingEn).toEqual([]);
  });

  it("provides translated collapse/expand aria labels", () => {
    for (const dict of [sk, en]) {
      expect(resolveKey(dict, "nav.collapseMenu")).toEqual(expect.any(String));
      expect(resolveKey(dict, "nav.expandMenu")).toEqual(expect.any(String));
    }
  });

  it("the 12 previously-missing nav keys are localized (not Slovak-fallback)", () => {
    const required = [
      "nav.marketingPlan",
      "nav.marketingHandouts",
      "nav.marketingMessages",
      "nav.marketingWebsite",
      "nav.waitingRoomTv",
      "nav.marketingAutomations",
      "nav.marketingConsents",
      "nav.marketingWellness",
      "nav.remoteSupport",
      "nav.adminSupport",
      "nav.collapseMenu",
      "nav.expandMenu",
    ];
    for (const key of required) {
      expect(typeof resolveKey(sk, key), `${key} in sk`).toBe("string");
      expect(typeof resolveKey(en, key), `${key} in en`).toBe("string");
    }
    // English must not leak the Slovak fallback labels.
    expect(resolveKey(en, "nav.marketingPlan")).toBe("Content Plan");
    expect(resolveKey(en, "nav.waitingRoomTv")).toBe("Waiting Room TV");
  });
});
