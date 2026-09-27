"use client";

import { AlertTriangle, CalendarPlus, X } from "lucide-react";
import { useMemo } from "react";
import { PREVIEW_COLOR, type CourseColor } from "@/components/dashboard/course-colors";
import { formatClock, MEETING_KIND_ABBR, WEEKDAY_LABELS } from "@/lib/domain/time";
import type { Meeting, Section, Weekday } from "@/lib/domain/types";
import { findConflicts, layoutDay } from "@/lib/registration/schedule";
import { cn } from "@/lib/utils";

const HOUR_PX = 64;
const BASE_DAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 19 * 60;

interface Block {
  key: string;
  section: Section;
  meeting: Meeting;
  preview: boolean;
}

interface TimetableGridProps {
  sections: Section[];
  preview: Section | null;
  colors: ReadonlyMap<string, CourseColor>;
  focusedId: string | null;
  onFocus: (sectionId: string) => void;
  onRemove: (sectionId: string) => void;
}

export function TimetableGrid({ sections, preview, colors, focusedId, onFocus, onRemove }: TimetableGridProps) {
  const showPreview = preview !== null && !sections.some((s) => s.id === preview.id);

  const blocks = useMemo<Block[]>(() => {
    const staged = sections.flatMap((section) =>
      section.meetings.map((meeting, i) => ({ key: `${section.id}:${i}`, section, meeting, preview: false })),
    );
    const ghost =
      showPreview && preview
        ? preview.meetings.map((meeting, i) => ({ key: `preview:${preview.id}:${i}`, section: preview, meeting, preview: true }))
        : [];
    return [...staged, ...ghost];
  }, [sections, preview, showPreview]);

  // Stripe only the meetings that actually overlap, not every meeting of a clashing section.
  const conflictMeetings = useMemo(() => {
    const set = new Set<Meeting>(findConflicts(sections).flatMap((c) => [c.a.meeting, c.b.meeting]));
    if (showPreview && preview) {
      // Hovered section vs. the plan; another section of the same course would be a swap, not a clash.
      const others = sections.filter((s) => s.courseCode !== preview.courseCode);
      for (const c of findConflicts([...others, preview])) {
        if (c.a.sectionId === preview.id) set.add(c.a.meeting);
        if (c.b.sectionId === preview.id) set.add(c.b.meeting);
      }
    }
    return set;
  }, [sections, preview, showPreview]);

  const days = useMemo(() => {
    const hasSaturday = blocks.some((b) => b.meeting.day === "SAT");
    return hasSaturday ? [...BASE_DAYS, "SAT" as const] : BASE_DAYS;
  }, [blocks]);

  const [dayStart, dayEnd] = useMemo(() => {
    const starts = blocks.map((b) => b.meeting.start);
    const ends = blocks.map((b) => b.meeting.end);
    const start = Math.min(DEFAULT_START, ...starts.map((m) => Math.floor(m / 60) * 60));
    const end = Math.max(DEFAULT_END, ...ends.map((m) => Math.ceil(m / 60) * 60));
    return [start, end];
  }, [blocks]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = dayStart; m < dayEnd; m += 60) list.push(m);
    return list;
  }, [dayStart, dayEnd]);

  const laidOut = useMemo(() => {
    const byDay = new Map<Weekday, ReturnType<typeof layoutDay<Block>>>();
    for (const day of days) {
      byDay.set(
        day,
        layoutDay(
          blocks.filter((b) => b.meeting.day === day),
          (b) => ({ start: b.meeting.start, end: b.meeting.end }),
        ),
      );
    }
    return byDay;
  }, [blocks, days]);

  const gridColumns = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };
  const bodyHeight = ((dayEnd - dayStart) / 60) * HOUR_PX;

  return (
    <div className="relative overflow-x-auto scrollbar-thin">
      <div className="min-w-[720px]">
        <div className="sticky top-0 z-10 grid border-b border-zinc-200 bg-zinc-50/80 backdrop-blur-sm" style={gridColumns}>
          <div />
          {days.map((day) => (
            <div key={day} className="border-l border-zinc-100 px-2 py-2.5 text-center">
              <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{WEEKDAY_LABELS[day].short}</span>
            </div>
          ))}
        </div>

        <div className="relative grid" style={{ ...gridColumns, height: bodyHeight }}>
          <div className="relative" aria-hidden>
            {hours.map((m) => (
              <span
                key={m}
                className="tnum absolute right-2 -translate-y-1/2 font-mono text-[10px] text-zinc-300 first:translate-y-0.5"
                style={{ top: ((m - dayStart) / 60) * HOUR_PX }}
              >
                {formatClock(m)}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              className="relative border-l border-zinc-100"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, rgb(24 24 27 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(24 24 27 / 0.035) 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
              }}
            >
              {laidOut.get(day)?.map(({ item, lane, lanes }) => (
                <TimetableBlock
                  key={item.key}
                  block={item}
                  top={((item.meeting.start - dayStart) / 60) * HOUR_PX}
                  height={((item.meeting.end - item.meeting.start) / 60) * HOUR_PX}
                  lane={lane}
                  lanes={lanes}
                  color={item.preview ? PREVIEW_COLOR : (colors.get(item.section.courseCode) ?? PREVIEW_COLOR)}
                  conflict={conflictMeetings.has(item.meeting)}
                  focused={!item.preview && focusedId === item.section.id}
                  onFocus={onFocus}
                  onRemove={onRemove}
                />
              ))}
            </div>
          ))}

          {blocks.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <div className="max-w-xs rounded-xl border border-dashed border-zinc-200 bg-white/90 px-5 py-4 text-center">
                <CalendarPlus className="mx-auto mb-2 size-6 text-zinc-300" aria-hidden />
                <p className="text-[13px] font-medium text-zinc-700">Your week is empty</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Hover a section in the search panel to preview it here, then add it to your plan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TimetableBlockProps {
  block: Block;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  color: CourseColor;
  conflict: boolean;
  focused: boolean;
  onFocus: (sectionId: string) => void;
  onRemove: (sectionId: string) => void;
}

function TimetableBlock({ block, top, height, lane, lanes, color, conflict, focused, onFocus, onRemove }: TimetableBlockProps) {
  const { section, meeting, preview } = block;
  const time = `${formatClock(meeting.start)}–${formatClock(meeting.end)}`;
  const label = `${section.courseCode} section ${section.sectionNumber}, ${meeting.kind.toLowerCase()}, ${WEEKDAY_LABELS[meeting.day].long} ${time}, room ${meeting.classroom}${conflict ? ", time conflict" : ""}`;

  return (
    <div
      className={cn(
        "group absolute rounded-lg border transition-[box-shadow,opacity] duration-150",
        preview ? "pointer-events-none border-dashed animate-in fade-in-0 duration-150" : "shadow-xs",
        conflict && "conflict-stripes",
        focused && "z-10 ring-2 ring-accent ring-offset-1",
      )}
      style={
        {
          top: top + 1,
          height: height - 2,
          left: `calc(${(lane / lanes) * 100}% + 3px)`,
          width: `calc(${100 / lanes}% - 6px)`,
          backgroundColor: color.bg,
          borderColor: conflict ? "var(--color-red-400)" : color.border,
          color: color.text,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        tabIndex={preview ? -1 : 0}
        aria-label={preview ? undefined : label}
        aria-hidden={preview || undefined}
        onClick={() => onFocus(section.id)}
        className="absolute inset-0 overflow-hidden px-1.5 py-1 text-left focus-visible:outline-none"
      >
        <span className="flex items-center gap-1">
          <span className="tnum truncate font-mono text-[11px] leading-tight font-semibold">{section.courseCode}</span>
          {lanes === 1 && (
            <span className="shrink-0 rounded-[3px] bg-white/50 px-1 text-[8px] leading-tight font-semibold opacity-80">
              {preview ? "PREVIEW" : MEETING_KIND_ABBR[meeting.kind]}
            </span>
          )}
        </span>
        {height >= 44 && <span className="tnum block truncate font-mono text-[10px] leading-tight opacity-75">{time}</span>}
        {height >= 60 && (
          <span className="block truncate text-[10px] leading-tight opacity-80">
            {meeting.classroom} · §{section.sectionNumber}
          </span>
        )}
      </button>

      {conflict && (
        <AlertTriangle
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 size-3.5 fill-white text-red-500"
        />
      )}

      {!preview && (
        <button
          type="button"
          onClick={() => onRemove(section.id)}
          aria-label={`Remove ${section.courseCode} from plan`}
          className={cn(
            "absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-[3px] border border-current bg-white/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            focused && "opacity-100", // touch devices have no hover: tap the block first
          )}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
