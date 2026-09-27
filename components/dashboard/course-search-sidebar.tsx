"use client";

import { Search, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EMPTY_FILTERS, listInstructors, searchCatalog, type CatalogFilters } from "@/lib/catalog/search";
import type { Course, Department, Section } from "@/lib/domain/types";
import type { CandidateEvaluation } from "@/lib/registration/evaluate";
import { evaluatePrerequisites } from "@/lib/registration/prerequisites";
import { CourseResultCard, type CourseStanding } from "./course-result-card";

interface CourseSearchSidebarProps {
  courses: Course[];
  departments: Department[];
  passed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  stagedIds: ReadonlySet<string>;
  flashIds: ReadonlySet<string>;
  evaluate: (section: Section) => CandidateEvaluation;
  onToggle: (section: Section) => void;
  onPreview: (sectionId: string | null) => void;
}

export function CourseSearchSidebar(props: CourseSearchSidebarProps) {
  const { courses, departments, passed, failed } = props;
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const deferredFilters = useDeferredValue(filters);

  const instructors = useMemo(() => listInstructors(courses), [courses]);
  const departmentNames = useMemo(() => new Map(departments.map((d) => [d.code, d.name])), [departments]);

  const standingOf = useMemo(() => {
    const cache = new Map<string, CourseStanding>();
    for (const course of courses) {
      let standing: CourseStanding = "available";
      if (passed.has(course.code)) standing = "completed";
      else if (!evaluatePrerequisites(course.prerequisites, passed).satisfied) standing = "locked";
      else if (failed.has(course.code)) standing = "retake";
      cache.set(course.code, standing);
    }
    return cache;
  }, [courses, passed, failed]);

  // Search is for courses the student still needs — hide ones already completed.
  const results = useMemo(
    () => searchCatalog(courses, deferredFilters).filter((c) => standingOf.get(c.code) !== "completed"),
    [courses, deferredFilters, standingOf],
  );
  const sectionCount = results.reduce((n, c) => n + c.sections.length, 0);
  const patch = (next: Partial<CatalogFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  return (
    <aside
      aria-label="Course search"
      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:sticky lg:top-[76px] lg:h-[calc(100dvh-100px)]"
    >
      <div className="space-y-3 border-b border-zinc-100 p-4">
        <h2 className="text-[13px] font-semibold text-zinc-900">Upcoming courses</h2>

        <label className="relative block">
          <span className="sr-only">Search by course code, title or instructor</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Course code, title, instructor…"
            className="pl-9"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-zinc-400">Department</span>
            <NativeSelect value={filters.department ?? ""} onChange={(e) => patch({ department: e.target.value || null })}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-zinc-400">Instructor</span>
            <NativeSelect value={filters.instructor ?? ""} onChange={(e) => patch({ instructor: e.target.value || null })}>
              <option value="">Anyone</option>
              {instructors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
        <span aria-live="polite" className="tnum">
          <span className="font-medium text-zinc-700">{results.length}</span> courses
          {sectionCount > 0 && (
            <>
              {" · "}
              <span className="font-medium text-zinc-700">{sectionCount}</span> sections
            </>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 scrollbar-thin max-lg:max-h-[70vh]">
        {results.length === 0 ? (
          <div className="grid place-items-center px-4 py-14 text-center">
            <SearchX className="mb-2 size-6 text-zinc-300" aria-hidden />
            <p className="text-[13px] font-medium text-zinc-700">No courses match</p>
            <p className="mt-1 text-xs text-zinc-400">Try a different search.</p>
          </div>
        ) : (
          results.map((course) => (
            <CourseResultCard
              key={course.code}
              course={course}
              departmentName={departmentNames.get(course.departmentCode) ?? course.departmentCode}
              standing={standingOf.get(course.code) ?? "available"}
              passed={passed}
              stagedIds={props.stagedIds}
              flashIds={props.flashIds}
              evaluate={props.evaluate}
              onToggle={props.onToggle}
              onPreview={props.onPreview}
            />
          ))
        )}
      </div>
    </aside>
  );
}
