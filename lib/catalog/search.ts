import type { Course, Section, Weekday } from "@/lib/domain/types";

export type TimeOfDay = "ANY" | "MORNING" | "AFTERNOON" | "EVENING";

export const TIME_OF_DAY_RANGES: Record<Exclude<TimeOfDay, "ANY">, { from: number; to: number; label: string }> = {
  MORNING: { from: 0, to: 12 * 60, label: "Morning (before 12:00)" },
  AFTERNOON: { from: 12 * 60, to: 17 * 60, label: "Afternoon (12:00–17:00)" },
  EVENING: { from: 17 * 60, to: 24 * 60, label: "Evening (after 17:00)" },
};

export interface CatalogFilters {
  /** Matches course code (spacing-insensitive), title, or instructor. */
  query: string;
  department: string | null;
  instructor: string | null;
  /** Section must meet on at least one of these days (empty = any day). */
  days: Weekday[];
  /** A meeting on a selected day must start within this window. */
  timeOfDay: TimeOfDay;
  openOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  department: null,
  instructor: null,
  days: [],
  timeOfDay: "ANY",
  openOnly: false,
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");

function sectionMatches(section: Section, filters: CatalogFilters): boolean {
  if (filters.instructor && section.instructorName !== filters.instructor) return false;
  if (filters.openOnly && section.availableSeats <= 0) return false;

  if (filters.days.length > 0 || filters.timeOfDay !== "ANY") {
    const window = filters.timeOfDay === "ANY" ? null : TIME_OF_DAY_RANGES[filters.timeOfDay];
    const hit = section.meetings.some(
      (m) =>
        (filters.days.length === 0 || filters.days.includes(m.day)) &&
        (!window || (m.start >= window.from && m.start < window.to)),
    );
    if (!hit) return false;
  }
  return true;
}

/**
 * Returns matching courses with their sections narrowed to those that pass
 * the section-level filters. Courses with no remaining sections are dropped.
 * Shared by the /api/courses route and the client-side sidebar.
 */
export function searchCatalog(courses: Course[], filters: CatalogFilters): Course[] {
  const q = normalize(filters.query);
  const results: Course[] = [];

  for (const course of courses) {
    if (filters.department && course.departmentCode !== filters.department) continue;

    const courseTextHit = !q || normalize(course.code).includes(q) || normalize(course.title).includes(q);
    const sections = course.sections.filter(
      (s) => sectionMatches(s, filters) && (courseTextHit || normalize(s.instructorName).includes(q)),
    );
    if (sections.length > 0) results.push({ ...course, sections });
  }

  return results.sort((a, b) => a.code.localeCompare(b.code));
}

export function listInstructors(courses: Course[]): string[] {
  const names = new Set(courses.flatMap((c) => c.sections.map((s) => s.instructorName)));
  // Sort by surname-ish (last token) so "Dr." / "Prof." prefixes don't dominate.
  const surname = (name: string) => name.split(" ").at(-1) ?? name;
  return [...names].sort((a, b) => surname(a).localeCompare(surname(b)));
}
