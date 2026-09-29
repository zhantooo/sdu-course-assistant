"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, ListChecks, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import type { Course, Section } from "@/lib/domain/types";
import { describeConflict, type SelectionSummary } from "@/lib/registration/evaluate";
import { cn } from "@/lib/utils";
import type { CourseColor } from "./course-colors";
import { SeatBadge } from "./seat-badge";

interface PlanPanelProps {
  sections: Section[];
  coursesByCode: ReadonlyMap<string, Course>;
  colors: ReadonlyMap<string, CourseColor>;
  summary: SelectionSummary;
  limitReason: string;
  conflictIds: ReadonlySet<string>;
  focusedId: string | null;
  flashIds: ReadonlySet<string>;
  submitting: boolean;
  registered: boolean;
  onFocus: (sectionId: string) => void;
  onRemove: (sectionId: string) => void;
  onConfirmRegister: () => void;
}

export function PlanPanel({
  sections,
  coursesByCode,
  colors,
  summary,
  limitReason,
  conflictIds,
  focusedId,
  flashIds,
  submitting,
  registered,
  onFocus,
  onRemove,
  onConfirmRegister,
}: PlanPanelProps) {
  const fullStaged = sections.filter((s) => s.availableSeats <= 0);
  const blocked = summary.conflicts.length > 0 || summary.overLimit || fullStaged.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-zinc-400" aria-hidden /> Your plan
        </CardTitle>
        <span className="tnum text-xs text-zinc-400">
          {sections.length} {sections.length === 1 ? "section" : "sections"}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-[13px]">
            <span className="font-medium text-zinc-700">Credit load</span>
            <span className="tnum font-mono">
              <span className={cn("font-semibold", summary.overLimit ? "text-red-600" : "text-zinc-900")}>
                {summary.credits}
              </span>
              <span className="text-zinc-400"> / {summary.creditLimit} ECTS</span>
            </span>
          </div>
          <Meter value={summary.credits} max={summary.creditLimit} label="Credits staged against semester limit" />
          <p className="mt-1.5 text-[11px] text-zinc-400">{limitReason}</p>
        </div>

        {(summary.conflicts.length > 0 || fullStaged.length > 0) && (
          <ul className="space-y-1.5" aria-label="Plan issues">
            {summary.conflicts.map((conflict, i) => (
              <li
                key={`c${i}`}
                className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>{describeConflict(conflict)}</span>
              </li>
            ))}
            {fullStaged.map((s) => (
              <li
                key={`f${s.id}`}
                className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                <CircleSlash className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  {s.courseCode} §{s.sectionNumber} filled up after you added it. Pick another section.
                </span>
              </li>
            ))}
          </ul>
        )}

        {sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-8 text-center text-xs text-zinc-400">
            Nothing staged yet. Sections you add from the search panel appear here.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
            {sections.map((section) => {
              const course = coursesByCode.get(section.courseCode);
              const color = colors.get(section.courseCode);
              const conflicted = conflictIds.has(section.id);
              return (
                <li
                  key={section.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    focusedId === section.id ? "bg-accent-soft/60" : "hover:bg-zinc-50",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color?.dot }}
                  />
                  <button
                    type="button"
                    onClick={() => onFocus(section.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Highlight ${section.courseCode} on the timetable`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="tnum font-mono text-[13px] font-semibold text-zinc-900">{section.courseCode}</span>
                      <span className="tnum font-mono text-[11px] text-zinc-400">§{section.sectionNumber}</span>
                      {conflicted && (
                        <Badge tone="danger">
                          <AlertTriangle aria-hidden /> Clash
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {course?.title} · {section.instructorName}
                    </span>
                  </button>
                  <SeatBadge
                    available={section.availableSeats}
                    total={section.totalCapacity}
                    waitlist={section.waitlistCount}
                    reserved
                    flash={flashIds.has(section.id)}
                    className="hidden sm:inline-flex"
                  />
                  <span className="tnum w-12 text-right font-mono text-xs text-zinc-500">{course?.credits ?? "–"} cr</span>
                  <button
                    type="button"
                    onClick={() => onRemove(section.id)}
                    aria-label={`Remove ${section.courseCode} from plan`}
                    className="grid size-7 place-items-center rounded-lg text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {sections.length > 0 &&
          (registered ? (
            <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] font-medium text-accent-fg">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Registration submitted for {sections.length}{" "}
              {sections.length === 1 ? "course" : "courses"}.
            </div>
          ) : (
            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <p className="text-[11px] text-zinc-400">
                Your picks are held as reservations. Confirm to submit them for registration.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={blocked || submitting}
                aria-disabled={blocked || undefined}
                title={
                  summary.conflicts.length > 0
                    ? "Resolve the time conflict first"
                    : summary.overLimit
                      ? "You are over the credit limit"
                      : fullStaged.length > 0
                        ? "A reserved section is full"
                        : undefined
                }
                onClick={onConfirmRegister}
              >
                {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                {submitting ? "Submitting…" : `Confirm registration · ${sections.length}`}
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
