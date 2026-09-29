"use client";

import { AlertTriangle, Check, CheckCircle2, CircleSlash, Gauge, Lock, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMeeting, MEETING_KIND_ABBR } from "@/lib/domain/time";
import type { Course, Section } from "@/lib/domain/types";
import type { CandidateEvaluation, IssueCode } from "@/lib/registration/evaluate";
import { cn } from "@/lib/utils";
import { SeatBadge } from "./seat-badge";

export type CourseStanding = "completed" | "retake" | "locked" | "available";

interface CourseResultCardProps {
  course: Course;
  departmentName: string;
  standing: CourseStanding;
  passed: ReadonlySet<string>;
  stagedIds: ReadonlySet<string>;
  flashIds: ReadonlySet<string>;
  evaluate: (section: Section) => CandidateEvaluation;
  onToggle: (section: Section) => void;
  onPreview: (sectionId: string | null) => void;
}

const BLOCKED_LABEL: Record<Exclude<IssueCode, "TIME_CONFLICT">, { label: string; icon: typeof Lock }> = {
  ALREADY_PASSED: { label: "Passed", icon: CheckCircle2 },
  PREREQUISITES_MISSING: { label: "Locked", icon: Lock },
  CREDIT_LIMIT: { label: "Limit", icon: Gauge },
  SECTION_FULL: { label: "Full", icon: CircleSlash },
};

const STANDING_BADGE = {
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  retake: { tone: "warning", icon: RotateCcw, label: "Retake" },
  locked: { tone: "neutral", icon: Lock, label: "Prereqs" },
} as const;

export function CourseResultCard(props: CourseResultCardProps) {
  const { course, departmentName, standing, passed } = props;
  const inPlan = course.sections.some((s) => props.stagedIds.has(s.id));
  const badge = standing === "available" ? null : STANDING_BADGE[standing];

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-xs transition-colors",
        inPlan ? "border-accent/40 ring-1 ring-accent/10" : "border-zinc-200",
        standing === "completed" && "opacity-80",
      )}
    >
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="tnum font-mono text-[13px] font-semibold text-zinc-900">{course.code}</span>
              <span className="tnum text-[11px] text-zinc-400">{course.credits} ECTS</span>
            </div>
            <h3 className="mt-0.5 text-[13px] leading-snug font-medium text-zinc-800">{course.title}</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {departmentName} · {course.level}-level
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {inPlan && (
              <Badge tone="info">
                <Check aria-hidden /> In plan
              </Badge>
            )}
            {badge && (
              <Badge tone={badge.tone}>
                <badge.icon aria-hidden /> {badge.label}
              </Badge>
            )}
          </div>
        </div>

        {course.prerequisites.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-zinc-400">Requires</span>
            {course.prerequisites.map((group, i) => {
              const met = group.some((code) => passed.has(code));
              return (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-zinc-300">+</span>}
                  <span
                    className={cn(
                      "tnum inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono",
                      met ? "bg-accent-soft text-accent-fg" : "bg-red-50 text-red-600",
                    )}
                    title={met ? "Satisfied" : "Not yet passed"}
                  >
                    {met ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                    {group.join(" / ")}
                    <span className="sr-only">{met ? " (satisfied)" : " (missing)"}</span>
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        {course.sections.map((section) => (
          <SectionRow key={section.id} section={section} {...props} />
        ))}
      </ul>
    </article>
  );
}

function SectionRow({
  section,
  stagedIds,
  flashIds,
  evaluate,
  onToggle,
  onPreview,
}: CourseResultCardProps & { section: Section }) {
  const staged = stagedIds.has(section.id);
  const evaluation = evaluate(section);
  const blocked = !staged && evaluation.blockers.length > 0;
  const clash = !staged && !blocked && evaluation.warnings.some((w) => w.code === "TIME_CONFLICT");
  const firstBlocker = evaluation.blockers[0]?.code as keyof typeof BLOCKED_LABEL | undefined;
  const blockedAs = blocked && firstBlocker ? BLOCKED_LABEL[firstBlocker] : null;
  const reason = blocked ? evaluation.blockers.map((b) => b.message).join(" ") : clash ? evaluation.warnings[0].message : undefined;

  return (
    <li
      className={cn("px-3.5 py-2.5 transition-colors hover:bg-zinc-50", staged && "bg-accent-soft/60")}
      onMouseEnter={() => onPreview(section.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(section.id)}
      onBlur={() => onPreview(null)}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="tnum font-mono font-semibold text-zinc-700">§{section.sectionNumber}</span>
            <span className="truncate text-zinc-500">{section.instructorName}</span>
          </div>
          <div className="tnum mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[11px] text-zinc-500">
            {section.meetings.map((m, i) => (
              <span key={i}>
                {formatMeeting(m)} <span className="text-zinc-300">{MEETING_KIND_ABBR[m.kind]}</span>
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <SeatBadge
              available={section.availableSeats}
              total={section.totalCapacity}
              waitlist={section.waitlistCount}
              reserved={staged}
              flash={flashIds.has(section.id)}
            />
            {clash && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600" title={reason}>
                <AlertTriangle className="size-3" aria-hidden /> Time clash
              </span>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant={staged ? "success" : blocked ? "ghost" : evaluation.replaces ? "outline" : "primary"}
          aria-pressed={staged}
          aria-disabled={blocked || undefined}
          title={reason}
          onClick={() => onToggle(section)}
          className={cn("mt-0.5 w-[76px]", blocked && "text-zinc-400")}
        >
          {staged ? (
            <>
              <Check aria-hidden /> Added
            </>
          ) : blockedAs ? (
            <>
              <blockedAs.icon aria-hidden /> {blockedAs.label}
            </>
          ) : evaluation.replaces ? (
            <>
              <RefreshCw aria-hidden /> Switch
            </>
          ) : (
            <>
              <Plus aria-hidden /> Add
            </>
          )}
          <span className="sr-only">
            {` ${section.courseCode} section ${section.sectionNumber}`}
            {reason ? `. ${reason}` : ""}
          </span>
        </Button>
      </div>
    </li>
  );
}
