import { describe, expect, it } from "vitest";
import {
  CLINICAL_NUMERIC_CLASS,
  PREOPERATIVE_FASTING_HOURS,
  WHITEBOARD_DEPARTMENTS,
  conditionTagsFor,
  departmentForRoomType,
  departmentOfAppointment,
  elapsedSince,
  emptyClinicalSignals,
  fastingWindowForAppointment,
  formatClinicalDuration,
  matchesBoardSearch,
  matchesDepartment,
  shiftDateInput,
  type ClinicalSignals,
} from "../whiteboard/clinical-board";

const PATIENT_ID = "00000000-0000-0000-0000-000000000010";

function signals(overrides: Partial<ClinicalSignals> = {}): ClinicalSignals {
  return { ...emptyClinicalSignals(PATIENT_ID), ...overrides };
}

describe("whiteboard departments", () => {
  it("maps room types onto the three care units", () => {
    expect(departmentForRoomType("exam")).toBe("ambulancia");
    expect(departmentForRoomType("treatment")).toBe("ambulancia");
    expect(departmentForRoomType("surgery")).toBe("chirurgia");
    expect(departmentForRoomType("boarding")).toBe("hospitalizacia");
    expect(departmentForRoomType(null)).toBeNull();
    expect(departmentForRoomType("random")).toBeNull();
  });

  it("prefers the appointment room over the type default and falls back to the clinic", () => {
    expect(
      departmentOfAppointment({ roomType: "surgery", typeDefaultRoomType: "exam" }),
    ).toBe("chirurgia");
    expect(departmentOfAppointment({ typeDefaultRoomType: "boarding" })).toBe(
      "hospitalizacia",
    );
    expect(departmentOfAppointment({})).toBe("ambulancia");
  });

  it("filters by department without dropping other units", () => {
    const appointment = { roomType: "surgery", typeDefaultRoomType: "exam" };
    expect(matchesDepartment(appointment, "all")).toBe(true);
    expect(matchesDepartment(appointment, "chirurgia")).toBe(true);
    expect(matchesDepartment(appointment, "hospitalizacia")).toBe(false);
    expect(WHITEBOARD_DEPARTMENTS).toEqual([
      "ambulancia",
      "chirurgia",
      "hospitalizacia",
    ]);
  });
});

describe("whiteboard search", () => {
  const appointment = {
    patientName: "Bono",
    clientFirstName: "Ada",
    clientLastName: "Lovelace",
    doctorName: "MVDr. Ames",
    roomName: "Ambulancia 1",
    locationName: "Klinika",
  };

  it("matches patient, owner, doctor and room", () => {
    expect(matchesBoardSearch(appointment, "bono")).toBe(true);
    expect(matchesBoardSearch(appointment, "lovelace")).toBe(true);
    expect(matchesBoardSearch(appointment, "ada lovelace")).toBe(true);
    expect(matchesBoardSearch(appointment, "ames")).toBe(true);
    expect(matchesBoardSearch(appointment, "ambulancia 1")).toBe(true);
    expect(matchesBoardSearch(appointment, "")).toBe(true);
  });

  it("does not match across field boundaries", () => {
    // The joined haystack is separated so a query can't span two fields.
    expect(matchesBoardSearch(appointment, "bono ada")).toBe(false);
    expect(matchesBoardSearch(appointment, "nope")).toBe(false);
  });
});

describe("whiteboard condition tags", () => {
  it("requires positive evidence for every tag", () => {
    expect(conditionTagsFor({ status: "checked_in" }, "ambulancia", undefined)).toEqual([]);
    expect(conditionTagsFor({ status: "checked_in" }, "chirurgia", signals())).toEqual([]);
  });

  it("prioritises critical results, then post-op, then discharge state", () => {
    expect(
      conditionTagsFor(
        { status: "in_exam" },
        "hospitalizacia",
        signals({ criticalLabs: 1, procedures: 1, awaitingDischarge: true }),
      ),
    ).toEqual(["critical", "postOp", "awaitingDischarge"]);
  });

  it("marks admitted patients with today's vitals as stabilised", () => {
    expect(
      conditionTagsFor(
        { status: "in_exam" },
        "hospitalizacia",
        signals({ vitalsRecorded: 2 }),
      ),
    ).toEqual(["stable"]);
    // A critical flag always wins over the calm state.
    expect(
      conditionTagsFor(
        { status: "in_exam" },
        "hospitalizacia",
        signals({ vitalsRecorded: 2, criticalLabs: 1 }),
      ),
    ).toEqual(["critical"]);
  });
});

describe("whiteboard clinical times", () => {
  const now = new Date("2026-07-01T14:00:00.000Z");

  it("derives the pre-operative fasting window for surgical cases only", () => {
    const surgery = fastingWindowForAppointment(
      "2026-07-01T18:00:00.000Z",
      "chirurgia",
      now,
    );
    expect(surgery).not.toBeNull();
    expect(surgery!.active).toBe(true);
    expect(PREOPERATIVE_FASTING_HOURS).toBe(12);
    expect(surgery!.elapsedMs).toBe(8 * 60 * 60 * 1000);

    // Before the window opens the caller renders a countdown instead.
    const later = fastingWindowForAppointment(
      "2026-07-02T06:00:00.000Z",
      "chirurgia",
      now,
    );
    expect(later!.active).toBe(false);
    expect(later!.elapsedMs).toBeLessThan(0);

    expect(fastingWindowForAppointment("2026-07-01T18:00:00.000Z", "ambulancia", now)).toBeNull();
    expect(fastingWindowForAppointment("not-a-date", "chirurgia", now)).toBeNull();
  });

  it("formats durations with tabular-friendly digits", () => {
    expect(CLINICAL_NUMERIC_CLASS).toBe("font-mono tabular-nums text-xs");
    expect(formatClinicalDuration(45 * 60 * 1000)).toBe("45 min");
    expect(formatClinicalDuration(5 * 60 * 1000)).toBe("05 min");
    expect(formatClinicalDuration(2 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe("02 h 05 min");
    expect(formatClinicalDuration(-1000)).toBe("--");
    expect(formatClinicalDuration(null)).toBe("--");
  });

  it("reports waiting time without going negative", () => {
    expect(elapsedSince("2026-07-01T13:30:00.000Z", now)).toBe(30 * 60 * 1000);
    expect(elapsedSince("2026-07-01T15:00:00.000Z", now)).toBe(0);
    expect(elapsedSince("nope", now)).toBeNull();
  });

  it("shifts board dates without timezone drift", () => {
    expect(shiftDateInput("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDateInput("2026-07-01", 1)).toBe("2026-07-02");
    expect(shiftDateInput("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateInput("2026-03-01", -1)).toBe("2026-02-28");
  });
});
