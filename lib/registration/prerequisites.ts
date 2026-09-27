import type { PrerequisiteRule, Transcript } from "@/lib/domain/types";

/** Course codes that count toward prerequisites (passed or transferred in). */
export function passedCourseCodes(transcript: Transcript): Set<string> {
  return new Set(
    transcript.entries
      .filter((e) => e.status === "PASSED" || e.status === "TRANSFERRED")
      .map((e) => e.courseCode),
  );
}

export interface PrerequisiteResult {
  satisfied: boolean;
  /** Groups not yet satisfied; each needs any one of its codes. */
  missing: string[][];
}

/**
 * Evaluates a CNF rule: all groups must hold, a group holds when any of its
 * codes is passed. `waived` holds course codes whose requirement an advisor
 * has overridden for this student (Sprint 7).
 */
export function evaluatePrerequisites(
  rule: PrerequisiteRule,
  passed: ReadonlySet<string>,
  waived: ReadonlySet<string> = new Set(),
): PrerequisiteResult {
  const missing = rule.filter((group) => !group.some((code) => passed.has(code) || waived.has(code)));
  return { satisfied: missing.length === 0, missing };
}

/** `[["CSS 225"], ["MAT 201", "MAT 250"]]` → "CSS 225 and (MAT 201 or MAT 250)" */
export function describeRule(rule: PrerequisiteRule): string {
  return rule
    .map((group) => (group.length > 1 ? `(${group.join(" or ")})` : group[0]))
    .join(" and ");
}
