import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("whiteboard appointment workflow UI", () => {
  it("does not offer status transitions that the appointment lifecycle rejects", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain("Review closeout");
    expect(source).toContain("`/encounters/${appointment.id}#visit-closeout`");
    expect(source).toContain("`/encounters/${appointment.id}`");
    expect(source).not.toContain('label: "Check Out"');
    expect(source).not.toContain("generateDischargeInstructions");
    expect(source).not.toContain("Back to Exam");
    expect(source).not.toContain(
      'statusActions.push({ label: "Back to Exam", status: "in_exam"'
    );
    expect(source).toContain("const missingClinicalTarget");
    expect(source).toContain(
      'action.status === "in_exam" && missingClinicalTarget'
    );
    expect(source).toContain(
      "Open the visit and attach an active patient before starting the exam."
    );
  });

  it("keeps status updates hidden for read-only viewer access", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain('import { useSession } from "next-auth/react"');
    expect(source).toContain("function canUpdateWhiteboardStatusRole");
    expect(source).toContain('role === "admin"');
    expect(source).toContain('role === "veterinarian"');
    expect(source).toContain('role === "technician"');
    expect(source).toContain('role === "front_desk"');
    expect(source).toContain(
      "const canUpdateStatus = canUpdateWhiteboardStatusRole(session?.user?.role)"
    );
    expect(source).toContain("canUpdateStatus={canUpdateStatus}");
    expect(source).toContain(
      "const visibleStatusActions = canUpdateStatus ? statusActions : []"
    );
    expect(source).toContain("visibleStatusActions.map");
  });

  it("renders whiteboard times in the practice timezone", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain("function formatCurrentTime(date: Date, timeZone?: string | null)");
    expect(source).toContain("function formatCurrentDate(date: Date, timeZone?: string | null)");
    expect(source).toContain("function formatAppointmentTime(date: Date, timeZone?: string | null)");
    expect(source).toContain("trpc.whiteboard.settings.useQuery");
    expect(source).toContain("const settingsQuery = trpc.whiteboard.settings.useQuery()");
    expect(source).toContain("const practiceSettings = settingsQuery.data");
    expect(source).toContain("const pageError = error ?? settingsQuery.error");
    expect(source).toContain("const isPageLoading = isLoading || settingsQuery.isLoading");
    expect(source).toContain("const pageMissing = activeAppointmentsMissing || settingsMissing");
    expect(source).toContain("const verifiedActiveAppointments =");
    expect(source).toContain("const verifiedPracticeSettings =");
    expect(source).toContain("const pageReady =");
    expect(source).toContain(
      "Boolean(verifiedActiveAppointments && verifiedPracticeSettings)"
    );
    expect(source).toContain("const practiceClockReady =");
    expect(source).toContain("const selectedAppointmentFromList =");
    expect(source).toContain("const selectedAppointmentStillActive = Boolean(selectedAppointmentFromList)");
    expect(source).toContain("const selectedAppointmentStillActive = Boolean(");
    expect(source).toContain("if (!selectedAppointment) return;");
    expect(source).toContain("if (pageError || pageMissing)");
    expect(source).toContain("setSelectedAppointment(null);");
    expect(source).toContain("verifiedActiveAppointments && !selectedAppointmentStillActive");
    expect(source).toContain("verifiedActiveAppointments ?? []");
    expect(source).toContain("{pageError || pageMissing ? (");
    expect(source).toContain(
      'pageError?.message ?? t("whiteboard.errorFallback", "Unable to load whiteboard. Please retry.")'
    );
    expect(source).toContain(") : isPageLoading ? (");
    expect(source).toContain("practiceClockReady && currentTime && verifiedPracticeSettings");
    expect(source).toContain("formatCurrentTime(currentTime, verifiedPracticeSettings.timezone)");
    expect(source).toContain("formatCurrentDate(currentTime, verifiedPracticeSettings.timezone)");
    expect(source).toContain("appointment={selectedAppointmentFromList}");
    expect(source).toContain("timeZone={verifiedPracticeSettings.timezone}");
    expect(source).toContain("pageReady &&");
    expect(source).toContain("selectedAppointmentStillActive &&");
    expect(source).toContain("formatAppointmentTime(start, timeZone)");
    expect(source).not.toContain("settingsQuery.data?.timezone");
    expect(source).not.toContain("settingsQuery.data?.name");
    expect(source).not.toContain("settingsQuery.data?.phone");
    expect(source).not.toContain("Boolean(activeAppointments && practiceSettings)");
    expect(source).not.toContain("practiceClockReady && currentTime && practiceSettings");
    expect(source).not.toContain("timeZone={practiceSettings.timezone}");
    expect(source).not.toContain('practiceName: ""');
    expect(source).not.toContain("start.toLocaleTimeString");
    expect(source).not.toContain("new Date(appointment.startTime).toLocaleDateString()");
  });

  it("uses the dashboard UI kit for the header, toolbar and card frames", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain('from "@/components/layout/page-kit"');
    expect(source).toContain("pageShellClass");
    expect(source).toContain("PageToolbar");
    expect(source).toContain("SearchField");
    expect(source).toContain("filterControlClass");
    expect(source).toContain("icon={ClipboardList}");
    // Active patient count badge + date navigation live in the header.
    expect(source).toContain("const totalBoardPatients = verifiedActiveAppointments?.length ?? 0");
    expect(source).toContain('t("whiteboard.activeCount", "{count} active"');
    expect(source).toContain("shiftDateInput(boardDateInput, -1)");
    expect(source).toContain("shiftDateInput(boardDateInput, 1)");
    expect(source).toContain('t("whiteboard.date.today", "Today")');
    // Department filter for the three care units.
    expect(source).toContain("WHITEBOARD_DEPARTMENTS.map");
    expect(source).toContain('t("whiteboard.toolbar.departmentFilter", "Department")');
    // Tokenized card frames.
    expect(source).toContain("rounded-lg border border-border bg-card");
    expect(source).not.toContain("border-border/70");
  });

  it("tags diagnostic modalities and evidence-based condition states", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain('from "@/components/imaging/modality-badge"');
    expect(source).toContain("ModalityBadgeRow");
    expect(source).toContain("signals?.imagingModalities ?? []");
    expect(source).toContain("conditionTagsFor(appointment, department, signals)");
    expect(source).toContain("ConditionTag");
    expect(source).toContain("departmentOfAppointment(appointment)");
    expect(source).toContain("trpc.whiteboard.clinicalSignals.useQuery(");
    // Modality tag contract: RTG = info, USG = purple, CT = amber, LAB = teal.
    const badge = readFileSync("components/imaging/modality-badge.tsx", "utf8");
    expect(badge).toContain("bg-info-muted text-info-muted-foreground");
    expect(badge).toContain("bg-purple-500/15");
    expect(badge).toContain("bg-amber-500/15");
    expect(badge).toContain("bg-teal-500/15");
  });

  it("renders clinical times with the monospaced tabular token", () => {
    const source = readFileSync("app/(dashboard)/whiteboard/page.tsx", "utf8");

    expect(source).toContain("CLINICAL_NUMERIC_CLASS");
    expect(source).toContain('t("whiteboard.times.checkIn", "Check-in")');
    expect(source).toContain('t("whiteboard.times.fasting", "Fasting")');
    expect(source).toContain('t("whiteboard.times.procedure", "Procedure")');
    expect(source).toContain("formatClinicalDuration(fasting.elapsedMs)");
    const board = readFileSync("lib/whiteboard/clinical-board.ts", "utf8");
    expect(board).toContain(
      'export const CLINICAL_NUMERIC_CLASS = "font-mono tabular-nums text-xs"'
    );
  });
});
