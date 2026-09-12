import { describe, expect, it } from "vitest";
import { HELP_CONTENT, getHelpContent } from "../help-content";

describe("HELP_CONTENT comprehensive coverage and quality audit", () => {
  const routes = Object.keys(HELP_CONTENT);

  it("covers all primary dashboard and extension routes (at least 35 routes)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(35);

    // Essential routes must exist
    const essentialRoutes = [
      "/",
      "/schedule",
      "/patients",
      "/patients/duplicates",
      "/clients",
      "/records",
      "/encounters",
      "/billing",
      "/billing/ekasa",
      "/billing/pos",
      "/care-reminders",
      "/inventory",
      "/lab-results",
      "/statutory",
      "/statutory/kvepis",
      "/controlled-substances",
      "/waiting-room",
      "/whiteboard",
      "/recalls",
      "/agent",
      "/agent/voice",
      "/agent/imaging",
      "/agent/discharge",
      "/vet-intel",
      "/admin",
      "/migration-archive",
      "/onboarding",
      "/settings",
      "/settings/ekasa",
      "/settings/import-v2",
      "/inbox",
      "/support",
      "/marketing",
      "/marketing/handouts",
      "/marketing/brand-kit",
      "/marketing/reviews",
      "/marketing/messages",
      "/marketing/automations",
      "/marketing/consents",
      "/marketing/media",
      "/marketing/plan",
      "/marketing/website",
      "/marketing/tv",
      "/marketing/wellness",
      "/marketing/competitors",
      "/reports",
    ];

    for (const route of essentialRoutes) {
      expect(HELP_CONTENT[route], `Route ${route} should exist in HELP_CONTENT`).toBeDefined();
    }
  });

  it("every route provides rich, actionable clinical help content with practical examples", () => {
    for (const [route, content] of Object.entries(HELP_CONTENT)) {
      // Title
      expect(content.title, `Route ${route} has title`).toBeTruthy();
      expect(content.title.length, `Route ${route} title length`).toBeGreaterThanOrEqual(3);

      // Intro
      expect(content.intro, `Route ${route} has intro`).toBeTruthy();
      expect(content.intro.length, `Route ${route} intro length`).toBeGreaterThanOrEqual(50);

      // Steps
      expect(content.steps.length, `Route ${route} has at least 3 steps`).toBeGreaterThanOrEqual(3);
      for (const step of content.steps) {
        expect(step.icon, `Step in ${route} has icon`).toBeTruthy();
        expect(step.title, `Step in ${route} has title`).toBeTruthy();
        expect(step.description, `Step in ${route} has description`).toBeTruthy();
        expect(step.description.length, `Step description length in ${route}`).toBeGreaterThanOrEqual(15);
      }

      // Tips
      expect(content.tips, `Route ${route} has tips array`).toBeDefined();
      expect(content.tips!.length, `Route ${route} has at least 2 tips`).toBeGreaterThanOrEqual(2);
      for (const tip of content.tips!) {
        expect(tip.length, `Tip length in ${route}`).toBeGreaterThanOrEqual(10);
      }

      // Practical Example
      expect(content.practicalExample, `Route ${route} has practicalExample`).toBeDefined();
      expect(content.practicalExample!.title, `Example title in ${route}`).toBeTruthy();
      expect(content.practicalExample!.scenario, `Example scenario in ${route}`).toBeTruthy();
      expect(content.practicalExample!.scenario.length, `Example scenario length in ${route}`).toBeGreaterThanOrEqual(20);
      expect(content.practicalExample!.solution, `Example solution in ${route}`).toBeTruthy();
      expect(content.practicalExample!.solution.length, `Example solution length in ${route}`).toBeGreaterThanOrEqual(25);
    }
  });

  it("getHelpContent correctly resolves root, deep paths and longest prefixes", () => {
    // Root
    const root = getHelpContent("/");
    expect(root).toBeDefined();
    expect(root?.title).toContain("Hlavný prehľad");

    // Exact match
    const kvepis = getHelpContent("/statutory/kvepis");
    expect(kvepis?.title).toContain("KVEPIS");

    // Longest-prefix matching: /statutory/kvepis must win over /statutory
    const deepKvepis = getHelpContent("/statutory/kvepis/sub-action");
    expect(deepKvepis?.title).toContain("KVEPIS");

    // Standard prefix matching: /patients/123-uuid should resolve to /patients
    const patientDetail = getHelpContent("/patients/00000000-0000-0000-0000-000000000001");
    expect(patientDetail?.title).toMatch(/pacient/i);

    // Duplicates should match /patients/duplicates
    const duplicates = getHelpContent("/patients/duplicates");
    expect(duplicates?.title).toContain("duplicít");

    // Billing ekasa vs billing
    const ekasa = getHelpContent("/billing/ekasa");
    expect(ekasa?.title).toContain("e-Kasa");

    const billing = getHelpContent("/billing");
    expect(billing?.title).toContain("Fakturácia");

    // Discharge
    const discharge = getHelpContent("/agent/discharge");
    expect(discharge?.title).toContain("prepúšťacie správy");
  });

  it("all relatedModules links point to valid existing routes in HELP_CONTENT", () => {
    for (const [route] of Object.entries(HELP_CONTENT)) {
      const content = getHelpContent(route);
      if (content?.relatedModules) {
        for (const mod of content.relatedModules) {
          expect(
            HELP_CONTENT[mod.href],
            `Related module href "${mod.href}" referenced in "${route}" should exist in HELP_CONTENT`
          ).toBeDefined();
        }
      }
    }
  });
});
