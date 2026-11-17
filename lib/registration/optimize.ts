import type { Course, Section } from "@/lib/domain/types";
import { recommendCourses } from "@/lib/recommendation/recommend";
import { conflictsWith } from "./schedule";

export interface OptimizeInput {
  courses: Course[];
  passed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  /** Hard cap — the plan never exceeds this. */
  creditLimit: number;
  /** Advisory target to fill up to; defaults to the hard cap. */
  target?: number;
  /** Sections the student has already staged and wants to keep. */
  preselected?: Section[];
  waived?: ReadonlySet<string>;
}

export interface OptimizeResult {
  /** The full proposed plan: preselected sections plus the ones we added. */
  sections: Section[];
  /** Only the sections the optimizer added on top of the preselection. */
  added: Section[];
  /** Total ECTS of the proposed plan. */
  credits: number;
  /** Eligible courses we could not fit, with the reason. */
  skipped: Array<{ courseCode: string; reason: string }>;
}

/**
 * Builds a strong term plan automatically. Starting from whatever the student
 * has already staged, it walks the deterministic recommendation ranking
 * (retakes → foundational → prerequisite-unlocking) and greedily adds each
 * course's earliest section that has an open seat and clashes with nothing
 * already chosen, until the advised credit budget is reached.
 *
 * Deterministic: the ranking and section order are stable, so the same inputs
 * always yield the same plan — which keeps it unit-testable and predictable
 * to demo.
 */
export function optimizeSchedule(input: OptimizeInput): OptimizeResult {
  const { courses, passed, failed, creditLimit, preselected = [], waived } = input;
  const budget = Math.min(input.target ?? creditLimit, creditLimit);

  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const creditsOf = (section: Section) => courseByCode.get(section.courseCode)?.credits ?? 0;

  const chosen: Section[] = [...preselected];
  const chosenCodes = new Set(chosen.map((s) => s.courseCode));
  let credits = chosen.reduce((sum, s) => sum + creditsOf(s), 0);

  const { eligible } = recommendCourses(courses, passed, failed, waived);
  const skipped: OptimizeResult["skipped"] = [];
  const added: Section[] = [];

  for (const { course } of eligible) {
    if (chosenCodes.has(course.code)) continue;
    if (credits + course.credits > budget) {
      skipped.push({ courseCode: course.code, reason: "would exceed the advised credit budget" });
      continue;
    }
    // Earliest section with an open seat and no clash against the plan so far.
    const section = course.sections.find((s) => s.availableSeats > 0 && conflictsWith(s, chosen).length === 0);
    if (!section) {
      skipped.push({ courseCode: course.code, reason: "no conflict-free section with an open seat" });
      continue;
    }
    chosen.push(section);
    added.push(section);
    chosenCodes.add(course.code);
    credits += course.credits;
  }

  return { sections: chosen, added, credits, skipped };
}
