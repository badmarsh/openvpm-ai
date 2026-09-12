import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public capability claims", () => {
  it("keeps the README aligned with clinic-pilot boundaries", () => {
    const source = readFileSync("../../README.md", "utf8");
    const pilotDoc = readFileSync(
      "../../docs/clinic-pilot-readiness.md",
      "utf8",
    );

    expect(source).toContain("GAP_ANALYSIS_POST_PILOT_READY.md");
    expect(source).toContain("PILOT-READY (v0.6)");
    expect(source).toContain("simulovaného tienoveho behu");
    expect(source).toContain("Next.js 15");
    expect(source).toContain("React 19");
    expect(pilotDoc).toContain(
      "OpenVPM is ready for a controlled, connected-mode clinic pilot",
    );
    expect(source).not.toContain("plná legislatívna konformita");
    expect(source).not.toContain(
      "point an existing integration at OpenVPM with zero changes",
    );
    expect(source).not.toContain("Costs go to zero");
    expect(source).not.toContain("apps/www");
  });

  it("separates shipped workflows from configured and pilot services", () => {
    const source = readFileSync("../../ROADMAP.md", "utf8");

    expect(source).toContain('UPOZORNENIE: "Pilot-ready" != "battle-tested"');
    expect(source).toContain("GAP_ANALYSIS_POST_PILOT_READY.md");
    expect(source).toContain("0/10");
    expect(source).toContain("Ziadna produkcna klinika nie je aktualne aktivna");
    expect(source).toContain("register technickeho dlhu");
    expect(source).not.toContain("client portal, real-time whiteboard");
    expect(source).not.toContain(
      "Payments (Stripe) — online invoice payment + wellness-plan charge capture",
    );
    expect(source).not.toContain(
      "SMS / email delivery (Twilio / Resend) for reminders and two-way client comms",
    );
  });
});

