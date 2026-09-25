import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Anti-Hardcode Linter: components/demo i18n compliance", () => {
  const barSource = readFileSync(
    join(__dirname, "..", "demo", "demo-conversion-bar.tsx"),
    "utf8",
  );
  const switcherSource = readFileSync(
    join(__dirname, "..", "demo", "demo-role-switcher.tsx"),
    "utf8",
  );

  const messagesDir = join(__dirname, "..", "..", "messages");
  const sk = JSON.parse(readFileSync(join(messagesDir, "sk.json"), "utf8"));
  const en = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8"));

  function resolveKey(dict: Record<string, unknown>, dotted: string): unknown {
    return dotted.split(".").reduce<unknown>((node, part) => {
      if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, dict);
  }

  it("ensures components/demo files import and use useI18n()", () => {
    expect(barSource).toContain('from "@/lib/i18n"');
    expect(barSource).toContain("useI18n()");
    expect(switcherSource).toContain('from "@/lib/i18n"');
    expect(switcherSource).toContain("useI18n()");
  });

  it("ensures no raw English string literals exist in demo-conversion-bar.tsx", () => {
    const forbidden = [
      "Like this workflow?",
      "Start a free Cloud trial with your own clinic data.",
      ">Start my clinic<",
      '"Start my clinic"',
      "'Start my clinic'",
    ];
    for (const phrase of forbidden) {
      expect(barSource).not.toContain(phrase);
    }
    expect(barSource).toContain('"demo.banner.title"');
    expect(barSource).toContain('"demo.banner.subtitle"');
    expect(barSource).toContain('"demo.banner.startClinic"');
  });

  it("ensures no raw English string literals exist in demo-role-switcher.tsx", () => {
    const forbidden = [
      ">Explore as<",
      '"Explore as"',
      "'Explore as'",
      "Current role: ${currentLabel}",
      "`Viewing demo as ${currentLabel}`",
      "`Switching to ${demoRoleLabel(pendingRole)}`",
      "We couldn't switch roles. Your current role is unchanged. Try again.",
      "Role changed. Refresh this page to finish switching views.",
      ">Practice Admin<",
      ">Veterinarian<",
      ">Technician<",
      ">Front Desk<",
    ];
    for (const phrase of forbidden) {
      expect(switcherSource).not.toContain(phrase);
    }
    expect(switcherSource).toContain('"demo.roleSwitcher.label"');
    expect(switcherSource).toContain('"demo.roleSwitcher.ariaLabel"');
    expect(switcherSource).toContain('"demo.roleSwitcher.viewingAs"');
    expect(switcherSource).toContain('"demo.roleSwitcher.switchingTo"');
    expect(switcherSource).toContain('"demo.roleSwitcher.switchError"');
    expect(switcherSource).toContain('"demo.roleSwitcher.refreshNotice"');
  });

  it("verifies all demo translation keys resolve symmetrically in sk.json and en.json", () => {
    const requiredKeys = [
      "demo.banner.title",
      "demo.banner.subtitle",
      "demo.banner.startClinic",
      "demo.roleSwitcher.label",
      "demo.roleSwitcher.ariaLabel",
      "demo.roleSwitcher.viewingAs",
      "demo.roleSwitcher.switchingTo",
      "demo.roleSwitcher.switchError",
      "demo.roleSwitcher.refreshNotice",
      "demo.roles.admin",
      "demo.roles.veterinarian",
      "demo.roles.technician",
      "demo.roles.front_desk",
    ];

    for (const key of requiredKeys) {
      expect(typeof resolveKey(sk, key), `missing ${key} in sk.json`).toBe("string");
      expect(typeof resolveKey(en, key), `missing ${key} in en.json`).toBe("string");
    }
  });

  it("verifies standardized Slovak role nomenclature in sk.json", () => {
    expect(resolveKey(sk, "demo.roles.admin")).toBe("Správca praxe");
    expect(resolveKey(sk, "demo.roles.veterinarian")).toBe("Veterinárny lekár");
    expect(resolveKey(sk, "demo.roles.technician")).toBe("Veterinárny asistent / technik");
    expect(resolveKey(sk, "demo.roles.front_desk")).toBe("Recepcia");
  });

  it("verifies layout banners, onboarding, and auth components use useI18n()", () => {
    const files = [
      join(__dirname, "..", "layout", "verify-email-banner.tsx"),
      join(__dirname, "..", "layout", "recovery-review-banner.tsx"),
      join(__dirname, "..", "layout", "trial-badge.tsx"),
      join(__dirname, "..", "onboarding", "migration-help-request.tsx"),
      join(__dirname, "..", "onboarding", "first-day-recommendations.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "login", "page.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "register", "page.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "forgot-password", "page.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "reset-password", "page.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "verify-email", "page.tsx"),
      join(__dirname, "..", "..", "app", "(auth)", "accept-invite", "page.tsx"),
    ];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, `Expected ${file} to import useI18n`).toContain("useI18n");
      expect(content, `Expected ${file} to call useI18n()`).toContain("useI18n()");
    }
  });

  it("verifies 100% dictionary symmetry between sk.json and en.json", () => {
    function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      let keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getAllKeys(v as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    const skKeys = getAllKeys(sk);
    const enKeys = getAllKeys(en);

    const missingInEn = skKeys.filter((k) => !enKeys.includes(k));
    const missingInSk = enKeys.filter((k) => !skKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInSk).toEqual([]);
    expect(skKeys.length).toBeGreaterThan(5000);
  });
});
