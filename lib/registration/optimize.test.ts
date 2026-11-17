import { describe, expect, it } from "vitest";
import type { Course, Meeting, Section, Weekday } from "@/lib/domain/types";
import { optimizeSchedule } from "./optimize";

const meet = (day: Weekday, start: number, end: number): Meeting => ({ day, start, end, kind: "LECTURE", classroom: "A" });

const section = (id: string, courseCode: string, meetings: Meeting[], seats = 30): Section => ({
  id,
  courseCode,
  sectionNumber: id,
  instructorName: "TBA",
  totalCapacity: 30,
  availableSeats: seats,
  waitlistCount: 0,
  meetings,
});

const course = (
  code: string,
  level: number,
  sections: Section[],
  { credits = 5, prerequisites = [] as string[][] } = {},
): Course => ({
  code,
  title: code,
  description: "",
  credits,
  departmentCode: code.split(" ")[0],
  level,
  prerequisites,
  sections,
});

describe("optimizeSchedule", () => {
  it("fills eligible courses without exceeding the credit budget", () => {
    const courses = [
      course("AAA 101", 100, [section("101", "AAA 101", [meet("MON", 600, 650)])], { credits: 10 }),
      course("AAA 102", 100, [section("102", "AAA 102", [meet("TUE", 600, 650)])], { credits: 10 }),
      course("AAA 103", 100, [section("103", "AAA 103", [meet("WED", 600, 650)])], { credits: 10 }),
      course("AAA 104", 100, [section("104", "AAA 104", [meet("THU", 600, 650)])], { credits: 10 }),
    ];
    const result = optimizeSchedule({ courses, passed: new Set(), failed: new Set(), creditLimit: 30 });
    expect(result.added).toHaveLength(3);
    expect(result.credits).toBe(30);
    expect(result.skipped.some((s) => s.courseCode === "AAA 104")).toBe(true);
  });

  it("picks a non-conflicting section around what is already staged", () => {
    const x = section("x1", "AAA 101", [meet("MON", 600, 650)]);
    const courses = [
      course("AAA 101", 100, [x]),
      course("AAA 102", 100, [
        section("y1", "AAA 102", [meet("MON", 600, 650)]), // clashes with x1
        section("y2", "AAA 102", [meet("TUE", 600, 650)]), // free
      ]),
    ];
    const result = optimizeSchedule({ courses, passed: new Set(), failed: new Set(), creditLimit: 30, preselected: [x] });
    expect(result.added.map((s) => s.id)).toEqual(["y2"]);
    expect(result.sections.map((s) => s.id)).toContain("x1"); // preselection kept
  });

  it("skips a course with no open, conflict-free section", () => {
    const x = section("x1", "AAA 101", [meet("MON", 600, 650)]);
    const courses = [
      course("AAA 101", 100, [x]),
      course("AAA 102", 100, [section("y1", "AAA 102", [meet("MON", 600, 650)])]), // only a clashing slot
      course("AAA 103", 100, [section("z1", "AAA 103", [meet("FRI", 600, 650)], 0)]), // only a full section
    ];
    const result = optimizeSchedule({ courses, passed: new Set(), failed: new Set(), creditLimit: 30, preselected: [x] });
    expect(result.added).toHaveLength(0);
    expect(result.skipped.map((s) => s.courseCode)).toEqual(expect.arrayContaining(["AAA 102", "AAA 103"]));
  });

  it("prioritises a retake when the budget only fits one course", () => {
    const courses = [
      course("AAA 101", 100, [section("101", "AAA 101", [meet("MON", 600, 650)])], { credits: 20 }),
      course("AAA 300", 300, [section("300", "AAA 300", [meet("TUE", 600, 650)])], { credits: 20 }),
    ];
    const result = optimizeSchedule({
      courses,
      passed: new Set(),
      failed: new Set(["AAA 300"]), // failed before → retake, ranked first
      creditLimit: 30,
    });
    expect(result.added).toHaveLength(1);
    expect(result.added[0].courseCode).toBe("AAA 300");
  });
});
