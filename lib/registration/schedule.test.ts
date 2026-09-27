import { describe, expect, it } from "vitest";
import type { Meeting, Section } from "@/lib/domain/types";
import { conflictsWith, findConflicts, layoutDay } from "./schedule";

const meeting = (day: Meeting["day"], start: string, end: string): Meeting => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return { day, start: toMin(start), end: toMin(end), kind: "LECTURE", classroom: "A-101" };
};

const section = (id: string, courseCode: string, meetings: Meeting[]): Section => ({
  id,
  courseCode,
  sectionNumber: "01",
  instructorName: "Dr. Test",
  totalCapacity: 30,
  availableSeats: 10,
  waitlistCount: 0,
  meetings,
});

describe("findConflicts", () => {
  it("reports overlapping meetings on the same day with the overlap window", () => {
    const a = section("a", "CSS 342", [meeting("MON", "14:00", "15:50")]);
    const b = section("b", "CSS 358", [meeting("MON", "15:00", "16:50")]);
    const [conflict, ...rest] = findConflicts([a, b]);
    expect(rest).toHaveLength(0);
    expect(conflict.day).toBe("MON");
    expect([conflict.a.sectionId, conflict.b.sectionId].sort()).toEqual(["a", "b"]);
    expect(conflict.overlapStart).toBe(15 * 60);
    expect(conflict.overlapEnd).toBe(15 * 60 + 50);
  });

  it("treats end times as exclusive (back-to-back is fine)", () => {
    const a = section("a", "X 1", [meeting("TUE", "10:00", "10:50")]);
    const b = section("b", "X 2", [meeting("TUE", "10:50", "11:40")]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("ignores same-time meetings on different days", () => {
    const a = section("a", "X 1", [meeting("MON", "10:00", "11:50")]);
    const b = section("b", "X 2", [meeting("WED", "10:00", "11:50")]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("never flags a section against itself", () => {
    const a = section("a", "X 1", [meeting("MON", "10:00", "11:50"), meeting("MON", "11:00", "11:50")]);
    expect(findConflicts([a])).toEqual([]);
  });

  it("finds every pair when a long block spans several short ones", () => {
    const long = section("long", "L 1", [meeting("THU", "09:00", "12:50")]);
    const s1 = section("s1", "S 1", [meeting("THU", "09:00", "09:50")]);
    const s2 = section("s2", "S 2", [meeting("THU", "11:00", "11:50")]);
    const pairs = findConflicts([long, s1, s2]).map((c) => [c.a.sectionId, c.b.sectionId].sort().join("-"));
    expect(pairs.sort()).toEqual(["long-s1", "long-s2"]);
  });
});

describe("conflictsWith", () => {
  it("only returns conflicts involving the candidate", () => {
    const x = section("x", "X 1", [meeting("MON", "09:00", "10:50")]);
    const y = section("y", "Y 1", [meeting("MON", "10:00", "11:50")]); // x/y already clash
    const candidate = section("c", "C 1", [meeting("FRI", "09:00", "09:50")]);
    expect(conflictsWith(candidate, [x, y])).toEqual([]);
  });
});

describe("layoutDay", () => {
  const range = (r: { start: number; end: number }) => r;

  it("gives non-overlapping blocks full width", () => {
    const out = layoutDay([{ start: 0, end: 50 }, { start: 60, end: 110 }], range);
    expect(out.map((b) => [b.lane, b.lanes])).toEqual([[0, 1], [0, 1]]);
  });

  it("splits a cluster of overlapping blocks into lanes and reuses freed lanes", () => {
    const out = layoutDay(
      [
        { start: 0, end: 100 }, // A
        { start: 10, end: 40 }, // B overlaps A
        { start: 50, end: 90 }, // C overlaps A, can reuse B's lane
      ],
      range,
    );
    expect(out.map((b) => [b.item.start, b.lane, b.lanes])).toEqual([
      [0, 0, 2],
      [10, 1, 2],
      [50, 1, 2],
    ]);
  });
});
