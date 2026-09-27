import type { Course, Department } from "@/lib/domain/types";
import type { CurriculumCourse } from "./parse";

const DEPARTMENT_NAMES: Record<string, string> = {
  INF: "Information Systems",
  CSS: "Computer Science",
  MAT: "Mathematics",
  PHY: "Physics",
  MDE: "General Education",
  ECO: "Economics",
  ENG: "Foreign Languages",
  KAZ: "Kazakh Language",
};

function levelFromCode(code: string): number {
  const digits = code.split(/\s+/)[1] ?? "";
  const first = Number(digits[0]);
  return Number.isFinite(first) && first > 0 ? first * 100 : 100;
}

/**
 * Turns the student's real curriculum into the app's course catalog. Completed
 * courses are excluded (they live in the transcript); what remains is what the
 * student can still take. Live sections/seats are a later phase, so sections
 * are empty for now — the search and eligibility still work on real courses.
 */
export function curriculumToCatalog(curriculum: CurriculumCourse[]): { courses: Course[]; departments: Department[] } {
  const takeable = curriculum.filter((c) => c.standing !== "done");
  const seenDept = new Map<string, Department>();
  const courses: Course[] = [];

  for (const c of takeable) {
    const dept = c.code.split(/\s+/)[0];
    if (!seenDept.has(dept)) {
      seenDept.set(dept, { code: dept, name: DEPARTMENT_NAMES[dept] ?? dept, faculty: "Suleyman Demirel University" });
    }
    courses.push({
      code: c.code,
      title: c.title,
      description: "",
      credits: c.ects || c.credits || 0,
      departmentCode: dept,
      level: levelFromCode(c.code),
      prerequisites: [],
      sections: [],
    });
  }

  return {
    courses: courses.sort((a, b) => a.code.localeCompare(b.code)),
    departments: [...seenDept.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
}
