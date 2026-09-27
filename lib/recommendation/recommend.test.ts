import { describe, expect, it } from "vitest";
import type { Course } from "@/lib/domain/types";
import { recommendCourses } from "./recommend";

const course = (code: string, level: number, prerequisites: string[][] = [], credits = 5): Course => ({
  code,
  title: code,
  description: "",
  credits,
  departmentCode: code.split(" ")[0],
  level,
  prerequisites,
  sections: [],
});

const catalog = [
  course("CSS 106", 100, [["CSS 105"]]),
  course("CSS 225", 200, [["CSS 106"]]),
  course("CSS 311", 300, [["CSS 225"]]),
  course("MAT 201", 200),
  course("CSS 322", 300, [["CSS 225"]]),
];

describe("recommendCourses", () => {
  it("marks courses whose prerequisites are met as eligible, others as locked", () => {
    const passed = new Set(["CSS 105"]);
    const { eligible, locked } = recommendCourses(catalog, passed, new Set());
    const eligibleCodes = eligible.map((r) => r.course.code);
    expect(eligibleCodes).toContain("CSS 106"); // CSS 105 passed
    expect(eligibleCodes).toContain("MAT 201"); // no prereqs
    expect(locked.map((r) => r.course.code)).toEqual(expect.arrayContaining(["CSS 225", "CSS 311", "CSS 322"]));
  });

  it("excludes already-passed courses", () => {
    const passed = new Set(["CSS 105", "CSS 106", "MAT 201"]);
    const { eligible } = recommendCourses(catalog, passed, new Set());
    expect(eligible.map((r) => r.course.code)).not.toContain("CSS 106");
    expect(eligible.map((r) => r.course.code)).toContain("CSS 225");
  });

  it("ranks retakes first, then by level, then by unlock value", () => {
    const passed = new Set(["CSS 105", "CSS 106"]);
    const failed = new Set(["MAT 201"]);
    const { eligible } = recommendCourses(catalog, passed, failed);
    expect(eligible[0].course.code).toBe("MAT 201"); // retake wins
    expect(eligible[0].retake).toBe(true);
    // CSS 225 unlocks CSS 311 + CSS 322, so it ranks above a leaf course of the same level.
    const dsa = eligible.find((r) => r.course.code === "CSS 225");
    expect(dsa?.unlocks).toBe(2);
  });

  it("counts how many courses each one unlocks", () => {
    const { eligible, locked } = recommendCourses(catalog, new Set(["CSS 105", "CSS 106"]), new Set());
    const all = [...eligible, ...locked];
    expect(all.find((r) => r.course.code === "CSS 225")?.unlocks).toBe(2);
  });
});
