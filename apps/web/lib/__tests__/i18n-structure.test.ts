import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = path.join(__dirname, "../../messages");

function load(name: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, name), "utf8"));
}

/** All resolvable leaf keys (nested walk). */
function leafKeys(obj: Record<string, any>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const kp = prefix ? `${prefix}.${k}` : k;
    if (v === null || typeof v !== "object") out.add(kp);
    else for (const sub of leafKeys(v, kp)) out.add(sub);
  }
  return out;
}

/**
 * Root-level keys that are flat dotted strings (e.g. "nav.item").
 * AGENTS.md requires nested JSON only; a flat key is allowed to remain ONLY
 * when nesting is structurally impossible because its parent path is itself
 * a string leaf (e.g. "records.labResults" is a string value, so
 * "records.labResults.addResult" cannot be nested underneath it without
 * changing what "records.labResults" resolves to).
 */
function flatRootKeys(dict: Record<string, any>): string[] {
  return Object.keys(dict).filter(
    (k) => k.includes(".") && typeof dict[k] === "string",
  );
}

/**
 * Nesting a flat key "a.b.c.d" requires EVERY prefix ("a", "a.b", "a.b.c")
 * to be an object. If any prefix is a string leaf (e.g. "records.labResults"
 * is the value "Lab Results"), the flat key cannot be nested without
 * changing what that prefix resolves to.
 */
function hasStringLeafPrefix(
  dict: Record<string, any>,
  flatKey: string,
): boolean {
  const parts = flatKey.split(".");
  let node: unknown = dict;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node === undefined || node === null) break; // object can be created
    if (typeof node !== "object") return true;
    node = (node as Record<string, unknown>)[parts[i]];
    if (typeof node === "string") return true;
  }
  return false;
}

describe("i18n dictionary structure", () => {
  const en = load("en.json");
  const sk = load("sk.json");

  it("keeps 100% en/sk key symmetry", () => {
    const enKeys = leafKeys(en);
    const skKeys = leafKeys(sk);
    const missingInSk = [...enKeys].filter((k) => !skKeys.has(k));
    const missingInEn = [...skKeys].filter((k) => !enKeys.has(k));
    expect(missingInSk).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("keeps every remaining flat dotted root key structurally unavoidable", () => {
    for (const dict of [en, sk]) {
      for (const key of flatRootKeys(dict)) {
        expect(
          hasStringLeafPrefix(dict, key),
          `flat dotted root key "${key}" must be nested (AGENTS.md) — ` +
            "it is only allowed when a prefix of the key is a string leaf",
        ).toBe(true);
      }
    }
  });

  it("does not reintroduce root dotted keys that have a nested parent object", () => {
    for (const dict of [en, sk]) {
      const avoidable = flatRootKeys(dict).filter(
        (key) => !hasStringLeafPrefix(dict, key),
      );
      expect(avoidable).toEqual([]);
    }
  });
});
