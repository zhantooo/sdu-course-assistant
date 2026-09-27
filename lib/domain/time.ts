import type { Weekday } from "./types";

/** "10:30" → 630 */
export function parseClock(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid clock time: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid clock time: ${value}`);
  return hours * 60 + minutes;
}

/** 630 → "10:30" */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  MON: { short: "Mon", long: "Monday" },
  TUE: { short: "Tue", long: "Tuesday" },
  WED: { short: "Wed", long: "Wednesday" },
  THU: { short: "Thu", long: "Thursday" },
  FRI: { short: "Fri", long: "Friday" },
  SAT: { short: "Sat", long: "Saturday" },
};

export const MEETING_KIND_ABBR = { LECTURE: "LEC", PRACTICE: "PRA", LAB: "LAB" } as const;

/** { day: "MON", start: 600, end: 710 } → "Mon 10:00–11:50" */
export function formatMeeting(meeting: { day: Weekday; start: number; end: number }): string {
  return `${WEEKDAY_LABELS[meeting.day].short} ${formatClock(meeting.start)}–${formatClock(meeting.end)}`;
}
