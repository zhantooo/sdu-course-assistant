import type { Meeting, Section, Weekday } from "@/lib/domain/types";

export interface ScheduledMeeting {
  sectionId: string;
  courseCode: string;
  meeting: Meeting;
}

export interface ScheduleConflict {
  day: Weekday;
  a: ScheduledMeeting;
  b: ScheduledMeeting;
  /** Overlap window in minutes since midnight. */
  overlapStart: number;
  overlapEnd: number;
}

export function flattenMeetings(sections: Section[]): ScheduledMeeting[] {
  return sections.flatMap((section) =>
    section.meetings.map((meeting) => ({
      sectionId: section.id,
      courseCode: section.courseCode,
      meeting,
    })),
  );
}

/**
 * Sweep-line conflict detection. Meetings are grouped by day and sorted by
 * start; each meeting only needs comparing against meetings still "open"
 * when it starts. End times are exclusive, so 10:00–10:50 and 10:50–11:40
 * do not clash. Meetings of the same section never conflict with each other.
 */
export function findConflicts(sections: Section[]): ScheduleConflict[] {
  const byDay = new Map<Weekday, ScheduledMeeting[]>();
  for (const item of flattenMeetings(sections)) {
    const list = byDay.get(item.meeting.day) ?? [];
    list.push(item);
    byDay.set(item.meeting.day, list);
  }

  const conflicts: ScheduleConflict[] = [];
  for (const [day, items] of byDay) {
    items.sort((x, y) => x.meeting.start - y.meeting.start || x.meeting.end - y.meeting.end);
    const open: ScheduledMeeting[] = [];
    for (const current of items) {
      // Drop meetings that ended at or before this one starts.
      for (let i = open.length - 1; i >= 0; i--) {
        if (open[i].meeting.end <= current.meeting.start) open.splice(i, 1);
      }
      for (const other of open) {
        if (other.sectionId === current.sectionId) continue;
        conflicts.push({
          day,
          a: other,
          b: current,
          overlapStart: current.meeting.start,
          overlapEnd: Math.min(other.meeting.end, current.meeting.end),
        });
      }
      open.push(current);
    }
  }
  return conflicts;
}

/** Conflicts introduced by adding `candidate` to an existing selection. */
export function conflictsWith(candidate: Section, selected: Section[]): ScheduleConflict[] {
  const others = selected.filter((s) => s.id !== candidate.id);
  return findConflicts([...others, candidate]).filter(
    (c) => c.a.sectionId === candidate.id || c.b.sectionId === candidate.id,
  );
}

/** Section ids that participate in at least one conflict. */
export function conflictingSectionIds(conflicts: ScheduleConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.a.sectionId);
    ids.add(c.b.sectionId);
  }
  return ids;
}

export interface LaidOutBlock<T> {
  item: T;
  /** 0-based column within its overlap cluster. */
  lane: number;
  /** Number of columns in its overlap cluster. */
  lanes: number;
}

/**
 * Calendar-style layout for one day: overlapping blocks are placed side by
 * side. Blocks are clustered by transitive overlap and greedily assigned to
 * the first free lane, so non-overlapping blocks keep full width.
 */
export function layoutDay<T>(items: T[], range: (item: T) => { start: number; end: number }): LaidOutBlock<T>[] {
  const sorted = [...items].sort((x, y) => range(x).start - range(y).start || range(y).end - range(x).end);
  const result: LaidOutBlock<T>[] = [];

  let cluster: LaidOutBlock<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const block of cluster) block.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    const { start, end } = range(item);
    if (start >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ item, lane, lanes: 0 });
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) flush();
  return result;
}
