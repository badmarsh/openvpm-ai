import { describe, expect, it } from "vitest";
import { adaptShepherdCareReminders } from "../shepherd-care-reminder-adapter";

describe("Shepherd care reminder adapter", () => {
  it("imports only open reminders and preserves source identities", () => {
    const result = adaptShepherdCareReminders({
      patient_status: [{ ID: "active", Name: "Active" }],
      patient: [{ ID: "pet-1", StatusID: "active" }],
      reminder_setting: [
        { ID: "setting-1", Name: "Wellness follow-up", IsActive: "true" },
      ],
      reminder: [
        {
          ID: "reminder-1",
          PatientID: "pet-1",
          ReminderSettingID: "setting-1",
          IsCompleted: "false",
          DateDue: "2026-09-03",
        },
        {
          ID: "reminder-2",
          PatientID: "pet-1",
          ReminderSettingID: "setting-1",
          IsCompleted: "true",
          DateDue: "2025-09-03",
        },
      ],
    });

    expect(result.reminders).toEqual([
      {
        externalReminderId: "reminder-1",
        externalPatientId: "pet-1",
        title: "Wellness follow-up",
        dueDate: "2026-09-03",
      },
    ]);
    expect(result.coverage).toEqual({
      sourceRows: 2,
      plannedRows: 1,
      deferredRows: 0,
      excludedRows: 1,
      errorRows: 0,
    });
    expect(result.issues).toEqual([
      {
        rowIndex: 1,
        code: "completed_reminder_excluded",
        severity: "warning",
      },
    ]);
  });

  it("fails closed when a patient, setting, or due date cannot be proven", () => {
    const result = adaptShepherdCareReminders({
      patient_status: [{ ID: "active", Name: "Active" }],
      patient: [{ ID: "pet-1", StatusID: "active" }],
      reminder_setting: [
        { ID: "setting-1", Name: "Follow-up", IsActive: "true" },
      ],
      reminder: [
        {
          ID: "reminder-1",
          PatientID: "missing",
          ReminderSettingID: "setting-1",
          IsCompleted: "false",
          DateDue: "2026-09-03",
        },
        {
          ID: "reminder-2",
          PatientID: "pet-1",
          ReminderSettingID: "missing",
          IsCompleted: "false",
          DateDue: "2026-09-03",
        },
        {
          ID: "reminder-3",
          PatientID: "pet-1",
          ReminderSettingID: "setting-1",
          IsCompleted: "false",
          DateDue: "not-a-date",
        },
      ],
    });

    expect(result.reminders).toEqual([]);
    expect(result.coverage.errorRows).toBe(3);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "missing_patient_link",
      "missing_reminder_setting",
      "invalid_reminder_due_date",
    ]);
  });
});
