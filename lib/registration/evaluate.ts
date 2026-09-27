import type { Course, Section } from "@/lib/domain/types";
import { formatClock, WEEKDAY_LABELS } from "@/lib/domain/time";
import { evaluatePrerequisites, describeRule } from "./prerequisites";
import { conflictsWith, findConflicts, type ScheduleConflict } from "./schedule";

export type IssueCode =
  | "ALREADY_PASSED"
  | "PREREQUISITES_MISSING"
  | "CREDIT_LIMIT"
  | "SECTION_FULL"
  | "TIME_CONFLICT";

export interface Issue {
  code: IssueCode;
  message: string;
}

export interface SelectionContext {
  coursesByCode: ReadonlyMap<string, Course>;
  passed: ReadonlySet<string>;
  waived?: ReadonlySet<string>;
  creditLimit: number;
  selected: Section[];
}

export interface CandidateEvaluation {
  /** Hard stops: the section cannot be staged. */
  blockers: Issue[];
  /** Soft stops: stageable, but the student should know. */
  warnings: Issue[];
  /** Another section of the same course that staging this one would replace. */
  replaces: Section | null;
  conflicts: ScheduleConflict[];
}

export function creditsOf(sections: Section[], coursesByCode: ReadonlyMap<string, Course>): number {
  return sections.reduce((sum, s) => sum + (coursesByCode.get(s.courseCode)?.credits ?? 0), 0);
}

/**
 * Rules applied when a student tries to stage a section:
 *  - passed course            → block
 *  - prerequisites missing    → block (Sprint 3)
 *  - credit limit exceeded    → block (Sprint 2)
 *  - section full             → block (waitlist arrives in Sprint 5)
 *  - timetable overlap        → warn  (Sprint 3)
 * Picking a different section of an already-staged course is a swap.
 */
export function evaluateCandidate(section: Section, ctx: SelectionContext): CandidateEvaluation {
  const course = ctx.coursesByCode.get(section.courseCode);
  const blockers: Issue[] = [];
  const warnings: Issue[] = [];

  const replaces = ctx.selected.find((s) => s.courseCode === section.courseCode && s.id !== section.id) ?? null;
  const remaining = ctx.selected.filter((s) => s.id !== replaces?.id && s.id !== section.id);

  if (ctx.passed.has(section.courseCode)) {
    blockers.push({ code: "ALREADY_PASSED", message: `You have already passed ${section.courseCode}.` });
  }

  if (course) {
    const prereq = evaluatePrerequisites(course.prerequisites, ctx.passed, ctx.waived);
    if (!prereq.satisfied) {
      blockers.push({
        code: "PREREQUISITES_MISSING",
        message: `Requires ${describeRule(prereq.missing)}.`,
      });
    }

    const projected = creditsOf(remaining, ctx.coursesByCode) + course.credits;
    if (projected > ctx.creditLimit) {
      blockers.push({
        code: "CREDIT_LIMIT",
        message: `Would bring you to ${projected} credits (limit ${ctx.creditLimit}).`,
      });
    }
  }

  if (section.availableSeats <= 0) {
    blockers.push({ code: "SECTION_FULL", message: "This section is full." });
  }

  const conflicts = conflictsWith(section, remaining);
  if (conflicts.length > 0) {
    warnings.push({ code: "TIME_CONFLICT", message: describeConflict(conflicts[0], section.id) });
  }

  return { blockers, warnings, replaces, conflicts };
}

/** With a perspective section: "Overlaps X on …"; without: "X and Y overlap on …". */
export function describeConflict(conflict: ScheduleConflict, perspectiveSectionId?: string): string {
  const when = `${WEEKDAY_LABELS[conflict.day].long} ${formatClock(conflict.overlapStart)}–${formatClock(conflict.overlapEnd)}`;
  if (!perspectiveSectionId) {
    return `${conflict.a.courseCode} and ${conflict.b.courseCode} overlap on ${when}.`;
  }
  const other = conflict.a.sectionId === perspectiveSectionId ? conflict.b : conflict.a;
  return `Overlaps ${other.courseCode} on ${when}.`;
}

export interface SelectionSummary {
  credits: number;
  creditLimit: number;
  conflicts: ScheduleConflict[];
  overLimit: boolean;
}

export function summarizeSelection(ctx: SelectionContext): SelectionSummary {
  const credits = creditsOf(ctx.selected, ctx.coursesByCode);
  return {
    credits,
    creditLimit: ctx.creditLimit,
    conflicts: findConflicts(ctx.selected),
    overLimit: credits > ctx.creditLimit,
  };
}
