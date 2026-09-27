import type { Course } from "@/lib/domain/types";
import { evaluatePrerequisites } from "@/lib/registration/prerequisites";

export interface CourseRecommendation {
  course: Course;
  /** Prerequisites satisfied and not yet passed → can be taken now. */
  eligible: boolean;
  /** How many not-yet-taken courses list this one as a prerequisite (unlock value). */
  unlocks: number;
  /** Failed before, so retaking should be prioritised. */
  retake: boolean;
  reasons: string[];
}

/**
 * Ranks the remaining (not-completed) catalogue into what the student can take
 * next. Deterministic and dependency-aware; the AI layer adds a rationale on
 * top of this list but never invents courses.
 *
 * Ranking of eligible courses: retakes first, then lower level (earlier in the
 * plan), then courses that unlock the most further courses, then fewer credits.
 */
export function recommendCourses(
  courses: Course[],
  passed: ReadonlySet<string>,
  failed: ReadonlySet<string>,
  waived: ReadonlySet<string> = new Set(),
): { eligible: CourseRecommendation[]; locked: CourseRecommendation[] } {
  // How often each course is required by another not-yet-passed course.
  const unlockCount = new Map<string, number>();
  for (const course of courses) {
    for (const group of course.prerequisites) {
      for (const code of group) unlockCount.set(code, (unlockCount.get(code) ?? 0) + 1);
    }
  }

  const eligible: CourseRecommendation[] = [];
  const locked: CourseRecommendation[] = [];

  for (const course of courses) {
    if (passed.has(course.code)) continue;
    const prereq = evaluatePrerequisites(course.prerequisites, passed, waived);
    const unlocks = unlockCount.get(course.code) ?? 0;
    const retake = failed.has(course.code);

    const reasons: string[] = [];
    if (retake) reasons.push("Retake — you didn't pass this yet");
    if (unlocks > 0) reasons.push(`Unlocks ${unlocks} later course${unlocks === 1 ? "" : "s"}`);
    if (course.level <= 200) reasons.push("Foundational for your program");

    const rec: CourseRecommendation = { course, eligible: prereq.satisfied, unlocks, retake, reasons };
    if (prereq.satisfied) eligible.push(rec);
    else {
      rec.reasons = [`Needs ${prereq.missing.map((g) => g.join(" / ")).join(" + ")} first`];
      locked.push(rec);
    }
  }

  eligible.sort(
    (a, b) =>
      Number(b.retake) - Number(a.retake) ||
      a.course.level - b.course.level ||
      b.unlocks - a.unlocks ||
      a.course.credits - b.course.credits ||
      a.course.code.localeCompare(b.course.code),
  );
  locked.sort((a, b) => a.course.level - b.course.level || a.course.code.localeCompare(b.course.code));

  return { eligible, locked };
}
