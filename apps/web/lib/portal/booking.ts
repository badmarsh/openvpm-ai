/**
 * Pure helpers for client-portal self-service booking. No I/O — the portal
 * router validates ownership and persists; this just turns a requested
 * date + time + duration into a concrete slot and guards the inputs.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_DURATION_MIN = 30;

export interface SlotInput {
  /** "YYYY-MM-DD" */
  preferredDate: string;
  /** 24h "HH:MM" */
  preferredTime: string;
  durationMinutes?: number;
  /** Injected for testability; defaults to now in the router. */
  now?: Date;
}

export interface Slot {
  startTime: Date;
  endTime: Date;
}

export function buildRequestedSlot(input: SlotInput): Slot {
  if (!DATE_RE.test(input.preferredDate)) {
    throw new Error("preferredDate must be in YYYY-MM-DD format.");
  }
  if (!TIME_RE.test(input.preferredTime)) {
    throw new Error("preferredTime must be in 24-hour HH:MM format.");
  }

  const startTime = new Date(`${input.preferredDate}T${input.preferredTime}:00`);
  if (Number.isNaN(startTime.getTime())) {
    throw new Error("Could not parse the requested date and time.");
  }

  const now = input.now ?? new Date();
  if (startTime.getTime() <= now.getTime()) {
    throw new Error("Please choose a date and time in the future.");
  }

  const duration =
    input.durationMinutes && input.durationMinutes > 0
      ? input.durationMinutes
      : DEFAULT_DURATION_MIN;
  const endTime = new Date(startTime.getTime() + duration * 60_000);

  return { startTime, endTime };
}
