import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("command search UI", () => {
  const source = readFileSync("components/common/command-search.tsx", "utf8");
  const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
  const sk = JSON.parse(readFileSync("messages/sk.json", "utf8"));

  it("keeps navigation and quick actions role-aware", () => {
    expect(source).toContain('import { useSession } from "next-auth/react"');
    expect(source).toContain("function isUserRole(role?: string | null): role is UserRole");
    expect(source).toContain("const { data: session, status } = useSession()");
    expect(source).toContain(
      "const role = isUserRole(session?.user?.role) ? session.user.role : undefined"
    );
    expect(source).toContain(
      'status === "authenticated" && role !== undefined'
    );
    expect(source).toContain(
      '{ labelKey: "commandSearch.navSettings", fallbackLabel: "Settings", href: "/settings", Icon: Settings, roles: ["admin"] }'
    );
    expect(source).toContain("const quickActionItems: CommandItemConfig[] =");
    expect(source).toContain(
      'roles: ["admin", "veterinarian", "technician", "front_desk"]'
    );
    expect(source).toContain('roles: ["admin", "front_desk"]');
    expect(source).toContain("const visibleNavigationItems =");
    expect(source).toContain("const visibleQuickActionItems =");
    expect(source).toContain("visibleNavigationItems.length > 0");
    expect(source).toContain("visibleQuickActionItems.length > 0");
    expect(source).toContain("visibleNavigationItems.map");
    expect(source).toContain("visibleQuickActionItems.map");
    expect(source).not.toContain("Quick actions always visible");
  });

  it("surfaces live search failures before showing no-results copy", () => {
    expect(source).toContain("const canUseCommandSearch =");
    expect(source).toContain(
      "{ enabled: open && hasQuery && canUseCommandSearch }"
    );
    expect(source).toContain("const checkingSearchAccess =");
    expect(source).toContain("const searchUnavailable =");
    expect(source).toContain("canUseCommandSearch");
    expect(source).toContain("Boolean(patients.error)");
    expect(source).toContain("Boolean(clients.error)");
    expect(source).toContain("!patients.data");
    expect(source).toContain("!clients.data");
    expect(source).toContain("const searchAccessUnavailable =");
    expect(source).toContain('t("commandSearch.accessUnavailable", "Unable to confirm search access")');
    expect(source).toContain('t("commandSearch.unableToLoad", "Unable to load search results")');
    expect(source).toContain('t("commandSearch.unableToLoadDesc", "Retry before deciding this client or patient is missing.")');
    expect(source).toContain("void patients.refetch();");
    expect(source).toContain("void clients.refetch();");
    expect(source).toContain('t("commandSearch.retrySearch", "Retry search")');
    expect(source.indexOf("{searchUnavailable && (")).toBeLessThan(
      source.indexOf("No patients or clients found.")
    );
    expect(source).toContain(
      "!searchAccessUnavailable &&\n              !searchUnavailable"
    );
    expect(source).toContain(
      "{hasQuery && !searchUnavailable && patientResults.length > 0 && ("
    );
    expect(source).toContain(
      "{hasQuery && !searchUnavailable && clientResults.length > 0 && ("
    );
    expect(source).toContain("patient.clientFirstName || patient.clientLastName");
    expect(source).toContain("Owner:");
    expect(source).not.toContain("const patientResults = patients.data ?? []");
    expect(source).not.toContain("const clientResults = clients.data ?? []");
  });

  it("renders matching actions above DB results when typing and assigns value props", () => {
    expect(source).toContain("const matchingActions = useMemo");
    expect(source).toContain('t("commandSearch.headingMatchedActions", "Actions")');
    expect(source).toContain("searchAliases");
    expect(source.indexOf("headingMatchedActions")).toBeLessThan(
      source.indexOf("headingPatients")
    );
    expect(source).toContain('value={`action-${item.labelKey}-${item.href}`}');
  });

  it("provides context-aware ordering for clients, patients, encounters, and schedule", () => {
    expect(source).toContain("usePathname()");
    expect(source).toContain("ctxNewPatientForClient");
    expect(source).toContain("ctxVoiceDictation");
    expect(source).toContain("ctxNewSoapNote");
    expect(source).toContain("ctxNewInvoice");
    expect(source).toContain('t("commandSearch.headingContextActions", "In Context")');
    expect(source).toContain("/patients/new?clientId=");
    expect(source).toContain("/agent/voice?patientId=");
    expect(source).toContain("/records?tab=soap&new=1&patientId=");
    expect(source).toContain("/billing/new");
    expect(source.indexOf("headingContextActions")).toBeLessThan(
      source.indexOf("headingQuickActions")
    );
  });

  it("implements navigation tiering and places appearance at the end", () => {
    expect(source).toContain("PRIMARY_NAV_KEYS");
    expect(source).toContain("showMoreNav");
    expect(source).toContain("navShowMore");
    expect(source).toContain("navShowLess");
    expect(source.indexOf("headingNavigation")).toBeLessThan(
      source.indexOf("headingAppearance")
    );
  });

  it("maintains 100% key symmetry for all commandSearch keys including new additions", () => {
    const requiredKeys = [
      "headingMatchedActions",
      "headingContextActions",
      "ctxNewPatientForClient",
      "ctxVoiceDictation",
      "ctxNewSoapNote",
      "ctxNewInvoice",
      "navShowMore",
      "navShowLess",
    ];

    for (const key of requiredKeys) {
      expect(en.commandSearch[key], `en.commandSearch.${key}`).toBeDefined();
      expect(sk.commandSearch[key], `sk.commandSearch.${key}`).toBeDefined();
      expect(typeof en.commandSearch[key]).toBe("string");
      expect(typeof sk.commandSearch[key]).toBe("string");
    }

    const enKeys = Object.keys(en.commandSearch).sort();
    const skKeys = Object.keys(sk.commandSearch).sort();
    expect(enKeys).toEqual(skKeys);
  });
});
