import { overlaps } from "./conflicts";

/**
 * Pure open-slot generation. Given a working window, a slot length, and the
 * busy intervals (existing appointments), produce the free slots a new
 * appointment of that length could occupy. No I/O.
 */

export interface BusyInterval {
  startTime: Date;
  endTime: Date;
}

export interface OpenSlot {
  start: Date;
  end: Date;
}

export function findOpenSlots(opts: {
  dayStart: Date;
  dayEnd: Date;
  slotMinutes: number;
  /** Candidate start cadence; defaults to slotMinutes (non-overlapping slots). */
  stepMinutes?: number;
  busy: BusyInterval[];
}): OpenSlot[] {
  const { dayStart, dayEnd, slotMinutes, busy } = opts;
  if (slotMinutes <= 0) throw new Error("slotMinutes must be positive.");
  const step = (opts.stepMinutes && opts.stepMinutes > 0 ? opts.stepMinutes : slotMinutes) * 60_000;
  const slotMs = slotMinutes * 60_000;

  const slots: OpenSlot[] = [];
  for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime(); t += step) {
    const start = new Date(t);
    const end = new Date(t + slotMs);
    const blocked = busy.some((b) => overlaps(start, end, b.startTime, b.endTime));
    if (!blocked) slots.push({ start, end });
  }
  return slots;
}
