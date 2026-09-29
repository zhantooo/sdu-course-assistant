import { describe, expect, it } from "vitest";
import type { CurriculumCourse } from "./parse";
import { curriculumToCatalog } from "./map";

const c = (code: string, standing: CurriculumCourse["standing"], ects = 5): CurriculumCourse => ({
  code,
  title: `${code} title`,
  credits: 3,
  ects,
  standing,
  grade: standing === "done" ? "B" : null,
});

const curriculum = [
  c("CSS 105", "done"),
  c("INF 313", "in_progress"),
  c("MDE 172", "available"),
  c("CSS 410", "available"),
  c("INF 420", "planned", 10),
];

describe("curriculumToCatalog", () => {
  const { courses, departments } = curriculumToCatalog(curriculum);
  const codes = courses.map((x) => x.code);

  it("excludes completed courses (they belong to the transcript)", () => {
    expect(codes).not.toContain("CSS 105");
    expect(codes).toEqual(["CSS 410", "INF 313", "INF 420", "MDE 172"]); // sorted, done removed
  });

  it("maps ECTS to credits and derives level from the course number", () => {
    const byCode = Object.fromEntries(courses.map((x) => [x.code, x]));
    expect(byCode["INF 420"].credits).toBe(10);
    expect(byCode["CSS 410"].level).toBe(400);
    expect(byCode["INF 313"].level).toBe(300);
    expect(byCode["MDE 172"].level).toBe(100);
    expect(byCode["MDE 172"].sections).toEqual([]); // live sections are a later phase
  });

  it("derives departments from course prefixes with friendly names", () => {
    expect(departments.map((d) => d.code)).toEqual(["CSS", "INF", "MDE"]);
    expect(departments.find((d) => d.code === "INF")?.name).toBe("Information Systems");
  });
});
