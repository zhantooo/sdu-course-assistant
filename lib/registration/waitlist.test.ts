import { describe, expect, it } from "vitest";
import type { Course, Section } from "@/lib/domain/types";
import { canAutoEnroll } from "./waitlist";

const mk = (id: string, code: string, day: "MON" | "TUE", start: number, seats: number): Section => ({
  id,
  courseCode: code,
  sectionNumber: id.slice(-2),
  instructorName: "Dr. Test",
  totalCapacity: 30,
  availableSeats: seats,
  waitlistCount: 0,
  meetings: [{ day, start, end: start + 110, kind: "LECTURE", classroom: "A" }],
});

const course = (code: string, credits: number, prerequisites: string[][] = []): Course => ({
  code,
  title: code,
  description: "",
  credits,
  departmentCode: code.split(" ")[0],
  level: 300,
  prerequisites,
  sections: [],
});

const coursesByCode = new Map(
  [course("CSS 311", 6, [["CSS 225"]]), course("CSS 342", 5)].map((c) => [c.code, c]),
);
const base = { coursesByCode, passed: new Set(["CSS 225"]), creditLimit: 12 };

describe("canAutoEnroll", () => {
  it("enrolls when a seat is open and the section fits the schedule", () => {
    const ctx = { ...base, selected: [] };
    expect(canAutoEnroll(mk("s-311-01", "CSS 311", "MON", 600, 5), ctx)).toBe(true);
  });

  it("does not enroll a still-full section", () => {
    const ctx = { ...base, selected: [] };
    expect(canAutoEnroll(mk("s-311-01", "CSS 311", "MON", 600, 0), ctx)).toBe(false);
  });

  it("does not enroll when it would clash with an enrolled course", () => {
    const ctx = { ...base, creditLimit: 30, selected: [mk("s-342-01", "CSS 342", "MON", 600, 5)] };
    expect(canAutoEnroll(mk("s-311-01", "CSS 311", "MON", 660, 5), ctx)).toBe(false);
  });

  it("does not enroll when it would exceed the credit limit", () => {
    const ctx = { ...base, creditLimit: 8, selected: [mk("s-342-01", "CSS 342", "TUE", 600, 5)] }; // 5 + 6 > 8
    expect(canAutoEnroll(mk("s-311-01", "CSS 311", "MON", 600, 5), ctx)).toBe(false);
  });
});
