import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readDashboardPage = (name: string) =>
  readFileSync(`app/(dashboard)/${name}/page.tsx`, "utf8");

describe("mobile clinic-day UI", () => {
  it("uses a touch-friendly phone agenda while preserving the full schedule at larger viewports", () => {
    const source = readDashboardPage("schedule");

    expect(source).toContain("function PhoneAgenda({");
    expect(source).toMatch(
      /aria-label=(?:\{`\$\{rangeLabel\} appointment agenda`\}|\{t\("schedule\.agendaAria")/,
    );
    expect(source).toContain(
      'className="mt-4 max-w-full space-y-4 overflow-hidden sm:hidden"'
    );
    expect(source).toContain('className="hidden sm:block"');
    expect(source).toMatch(
      /aria-label=(?:\{`Open \$\{patientName\} appointment at|\{t\("schedule\.openAppointmentAria")/,
    );
    expect(source).toContain(
      'className="min-h-11 w-full overflow-hidden rounded-lg border border-border bg-card p-3'
    );
    expect(source).toContain('className="h-11 w-full sm:h-9 sm:w-auto"');
    expect(source).toContain(
      'className="flex w-full min-w-0 flex-wrap items-center gap-2'
    );
  });

  it("renders clients as full-width phone cards and keeps the desktop table", () => {
    const source = readDashboardPage("clients");

    expect(source).toMatch(/(?:className="(?:mt-6 )?space-y-3 sm:hidden")/);
    expect(source).toMatch(
      /aria-label=(?:\{`Open client \$\{fullName\}`\}|\{t\("clients\.openClient")/,
    );
    expect(source).toContain(
      'className="min-h-11 w-full min-w-0 overflow-hidden rounded-lg border'
    );
    expect(source).toMatch(
      /(?:className="mt-6 hidden overflow-x-auto rounded-lg border border-border sm:block"|<DataTableShell className="mt-6 hidden sm:block">|<DataTableFrame className="hidden sm:block">)/,
    );
    expect(source).toMatch(/(?:className="h-11 pl-9 sm:h-10"|SearchField)/);
  });

  it("renders patients as full-width phone cards with owner and status context", () => {
    const source = readDashboardPage("patients");

    expect(source).toMatch(/(?:className="(?:mt-6 )?space-y-3 sm:hidden")/);
    expect(source).toMatch(
      /aria-label=(?:\{`Open patient \$\{patient\.name\}`\}|\{t\("patients\.list\.openPatientAria")/,
    );
    expect(source).toMatch(
      /(?:Owner: \{ownerName\}|\{t\([^)]*owner"[^)]*\)\}:\s*\{ownerName\})/,
    );
    expect(source).toMatch(
      /(?:className="mt-6 hidden overflow-x-auto rounded-lg border border-border sm:block"|<DataTableShell className="mt-6 hidden sm:block">|<DataTableFrame className="hidden sm:block">)/,
    );
    expect(source).toMatch(
      /(?:className="h-11 w-full rounded-md border border-input|SearchField)/
    );
  });

  it("keeps record tabs reachable and clinical forms single-column on phones", () => {
    const source = readDashboardPage("records");

    // Mobile reachability contract: the tab bar keeps its top spacing
    // (mt-6 on the Tabs root after the patient-card section split, or the
    // page-kit pageShellClass rhythm after Sprint 22), the scrolling
    // container keeps overflow-x-auto, tabs never shrink/wrap off-screen,
    // and triggers keep a 44px (min-h-11) touch target on phones.
    expect(source).toMatch(
      /(?:className="mt-6"|<div className=\{pageShellClass\}>)/
    );
    expect(source).toMatch(
      /(?:className="max-w-full overflow-x-auto border-b border-border"|<div className="max-w-full overflow-x-auto">\s*<TabsList[\s\S]{0,160}?className=\{underlineTabsListClass\})/
    );
    expect(source).toMatch(
      /(?:w-auto min-w-max gap-0|cn\(underlineTabsTriggerClass, "min-h-11 shrink-0)/
    );
    expect(source).toMatch(
      /(?:"relative flex min-h-11 shrink-0 items-center gap-2|"min-h-11 shrink-0 sm:min-h-0")/
    );
    expect(source).toContain(
      'className="grid grid-cols-1 gap-4 sm:grid-cols-2"'
    );
    expect(source).toContain(
      'className="grid grid-cols-1 gap-4 sm:grid-cols-3"'
    );
    expect(source).not.toContain('className="grid grid-cols-2 gap-4"');
  });
});
