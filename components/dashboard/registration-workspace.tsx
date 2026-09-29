"use client";

import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Course, Department, SeatAvailability, Section, StudentProfile, Transcript } from "@/lib/domain/types";
import type { CreditLimit } from "@/lib/registration/credits";
import { evaluateCandidate, summarizeSelection, type SelectionContext } from "@/lib/registration/evaluate";
import { passedCourseCodes } from "@/lib/registration/prerequisites";
import { conflictingSectionIds } from "@/lib/registration/schedule";
import { assignCourseColors } from "./course-colors";
import { CourseSearchSidebar } from "./course-search-sidebar";
import { PlanPanel } from "./plan-panel";
import { RecommendationsPanel } from "./recommendations-panel";
import { StatStrip } from "./stat-strip";
import { useLiveSeats, type SeatChange } from "./use-live-seats";
import { useStagedSections } from "./use-staged-sections";

interface RegistrationWorkspaceProps {
  profile: StudentProfile;
  transcript: Transcript;
  courses: Course[];
  departments: Department[];
  term: { code: string; name: string };
  creditLimit: CreditLimit;
}

const label = (s: Section) => `${s.courseCode} §${s.sectionNumber}`;

function initialSeats(courses: Course[]): Record<string, SeatAvailability> {
  const seats: Record<string, SeatAvailability> = {};
  for (const course of courses) {
    for (const s of course.sections) {
      seats[s.id] = {
        sectionId: s.id,
        availableSeats: s.availableSeats,
        totalCapacity: s.totalCapacity,
        waitlistCount: s.waitlistCount,
      };
    }
  }
  return seats;
}

/**
 * Client-side owner of the planning session: staged sections, live seat
 * counts, and every rule evaluation the sidebar, grid and plan panel render.
 */
export function RegistrationWorkspace({ profile, transcript, courses, departments, term, creditLimit }: RegistrationWorkspaceProps) {
  const { stagedIds, setStagedIds } = useStagedSections(`sdu:plan:${profile.studentId}:${term.code}`);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [seedSeats] = useState(() => initialSeats(courses));
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [confirmRegister, setConfirmRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  // The seat poller calls back asynchronously; read the latest plan through a ref.
  const planRef = useRef<{ staged: ReadonlySet<string>; byId: ReadonlyMap<string, Section> }>({
    staged: new Set(),
    byId: new Map(),
  });
  const onSeatChange = (changes: SeatChange[]) => {
    for (const { sectionId, previous, next } of changes) {
      const section = planRef.current.byId.get(sectionId);
      if (!section || !planRef.current.staged.has(sectionId) || !previous) continue;
      if (previous.availableSeats > 0 && next.availableSeats === 0) {
        toast.error(`${label(section)} just filled up`, {
          description: "It stays in your plan, but you'll need another section or the waitlist.",
        });
      } else if (previous.availableSeats === 0 && next.availableSeats > 0) {
        toast.success(`A seat opened in ${label(section)}`, { description: `${next.availableSeats} available now.` });
      }
    }
  };
  const { seats, status: seatStatus, updatedAt, flashIds } = useLiveSeats(seedSeats, {
    enabled: Object.keys(seedSeats).length > 0,
    onChange: onSeatChange,
  });

  const liveCourses = useMemo(
    () =>
      courses.map((course) => ({
        ...course,
        sections: course.sections.map((s) => {
          const live = seats[s.id];
          return live
            ? { ...s, availableSeats: live.availableSeats, totalCapacity: live.totalCapacity, waitlistCount: live.waitlistCount }
            : s;
        }),
      })),
    [courses, seats],
  );

  const coursesByCode = useMemo(() => new Map(liveCourses.map((c) => [c.code, c])), [liveCourses]);
  const sectionsById = useMemo(
    () => new Map(liveCourses.flatMap((c) => c.sections.map((s) => [s.id, s] as const))),
    [liveCourses],
  );
  const passed = useMemo(() => passedCourseCodes(transcript), [transcript]);
  const failed = useMemo(
    () => new Set(transcript.entries.filter((e) => e.status === "FAILED").map((e) => e.courseCode)),
    [transcript],
  );

  // Ids from storage that no longer exist in the catalog are ignored.
  const selected = useMemo(
    () => stagedIds.map((id) => sectionsById.get(id)).filter((s): s is Section => s !== undefined),
    [stagedIds, sectionsById],
  );
  const stagedSet = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  useEffect(() => {
    planRef.current = { staged: stagedSet, byId: sectionsById };
  }, [stagedSet, sectionsById]);

  const ctx = useMemo<SelectionContext>(
    () => ({ coursesByCode, passed, creditLimit: creditLimit.max, selected }),
    [coursesByCode, passed, creditLimit.max, selected],
  );
  const summary = useMemo(() => summarizeSelection(ctx), [ctx]);
  const conflictIds = useMemo(() => conflictingSectionIds(summary.conflicts), [summary.conflicts]);
  const colors = useMemo(() => assignCourseColors(selected.map((s) => s.courseCode)), [selected]);
  const evaluate = useCallback((section: Section) => evaluateCandidate(section, ctx), [ctx]);

  const remove = useCallback(
    (sectionId: string) => {
      const section = sectionsById.get(sectionId);
      const index = stagedIds.indexOf(sectionId);
      setStagedIds((prev) => prev.filter((id) => id !== sectionId));
      setFocusedId((id) => (id === sectionId ? null : id));
      setRegistered(false);
      if (section) {
        toast(`Removed ${label(section)}`, {
          action: {
            label: "Undo",
            onClick: () =>
              setStagedIds((prev) => {
                if (prev.includes(sectionId)) return prev;
                const next = [...prev];
                next.splice(Math.min(index, next.length), 0, sectionId);
                return next;
              }),
          },
        });
      }
    },
    [sectionsById, stagedIds, setStagedIds],
  );

  // Explicit deletes (timetable ✕, plan trash) ask first so nothing is lost by a stray click.
  const requestRemove = useCallback((sectionId: string) => setPendingRemove(sectionId), []);

  const toggle = useCallback(
    (section: Section) => {
      if (stagedSet.has(section.id)) return remove(section.id);

      const result = evaluateCandidate(section, ctx);
      if (result.blockers.length > 0) {
        toast.error(`Can't add ${label(section)}`, {
          description: result.blockers.map((b) => b.message).join(" "),
        });
        return;
      }

      const replaced = result.replaces;
      setStagedIds((prev) =>
        replaced ? prev.map((id) => (id === replaced.id ? section.id : id)) : [...prev, section.id],
      );
      setFocusedId(section.id);
      setRegistered(false);

      if (result.warnings.length > 0) {
        toast.warning(`${label(section)} added with a time conflict`, { description: result.warnings[0].message });
      } else if (replaced) {
        toast.success(`Switched ${section.courseCode} to §${section.sectionNumber}`, {
          description: `Replaced §${replaced.sectionNumber}.`,
        });
      } else {
        toast.success(`${label(section)} added to your plan`);
      }
    },
    [ctx, remove, setStagedIds, stagedSet],
  );

  const stagedCourseCodes = useMemo(() => new Set(selected.map((s) => s.courseCode)), [selected]);
  const addCourse = useCallback(
    (course: Course) => {
      const section = coursesByCode.get(course.code)?.sections[0];
      if (section) toggle(section);
    },
    [coursesByCode, toggle],
  );

  const submitRegistration = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/registration/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionIds: selected.map((s) => s.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Registration failed", { description: data?.error?.message ?? "Please try again." });
      } else if (data.pending) {
        setRegistered(true);
        toast.success("Plan reserved", { description: data.message });
      } else if (data.committed) {
        setRegistered(true);
        toast.success(`Registered for ${selected.length} ${selected.length === 1 ? "course" : "courses"}`);
      } else {
        const reasons: string[] = (data.results ?? [])
          .filter((r: { outcome: string }) => r.outcome === "REJECTED")
          .map((r: { sectionId: string; message: string }) => {
            const s = sectionsById.get(r.sectionId);
            return `${s ? label(s) : r.sectionId}: ${r.message}`;
          });
        toast.error("Registration rejected", { description: reasons[0] ?? "None of the sections could be registered." });
      }
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
      setConfirmRegister(false);
    }
  }, [selected, sectionsById]);

  const preview = previewId ? (sectionsById.get(previewId) ?? null) : null;
  const hasSections = useMemo(() => liveCourses.some((c) => c.sections.length > 0), [liveCourses]);
  const pendingRemoveSection = pendingRemove ? sectionsById.get(pendingRemove) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{term.name} registration</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">
            Welcome back, {profile.fullName.split(" ")[0]}
          </h1>
        </div>
        {profile.advisor && (
          <p className="text-xs text-zinc-500">
            Advisor: <span className="font-medium text-zinc-800">{profile.advisor.fullName}</span>
          </p>
        )}
      </div>

      <StatStrip profile={profile} summary={summary} seatStatus={seatStatus} seatsUpdatedAt={updatedAt} />

      {!hasSections && courses.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent-soft/50 px-4 py-3 text-[13px] text-accent-fg">
          Showing your real remaining courses from SDU. Live sections, seats and the timetable are the next step — coming soon.
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <CourseSearchSidebar
          courses={liveCourses}
          departments={departments}
          passed={passed}
          failed={failed}
          stagedIds={stagedSet}
          flashIds={flashIds}
          evaluate={evaluate}
          onToggle={toggle}
          onPreview={setPreviewId}
        />

        <div className="min-w-0 space-y-6">
          <RecommendationsPanel
            courses={liveCourses}
            passed={passed}
            failed={failed}
            profile={{
              fullName: profile.fullName,
              program: profile.program.name,
              gpa: profile.gpa,
              completedCredits: profile.completedCredits,
              requiredCredits: profile.requiredCredits,
              creditLimit: creditLimit.max,
            }}
            stagedCourseCodes={stagedCourseCodes}
            onAdd={addCourse}
          />

          <Card className="overflow-hidden">
            <CardHeader className="flex-wrap gap-y-2">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-zinc-400" aria-hidden /> Weekly timetable
              </CardTitle>
              <ul className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500" aria-label="Legend">
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px] border border-dashed border-accent bg-accent-soft" /> Preview
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="conflict-stripes size-3 rounded-[3px] border border-red-400" /> Conflict
                </li>
                <li className="tnum font-mono text-zinc-400">LEC · PRA · LAB</li>
              </ul>
            </CardHeader>
            <TimetableGrid
              sections={selected}
              preview={preview}
              colors={colors}
              focusedId={focusedId}
              onFocus={setFocusedId}
              onRemove={requestRemove}
            />
          </Card>

          <PlanPanel
            sections={selected}
            coursesByCode={coursesByCode}
            colors={colors}
            summary={summary}
            limitReason={creditLimit.reason}
            conflictIds={conflictIds}
            focusedId={focusedId}
            flashIds={flashIds}
            submitting={submitting}
            registered={registered}
            onFocus={setFocusedId}
            onRemove={requestRemove}
            onConfirmRegister={() => setConfirmRegister(true)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        tone="danger"
        title={pendingRemoveSection ? `Remove ${label(pendingRemoveSection)}?` : "Remove this course?"}
        description="It will be taken out of your plan and its reserved seat released."
        confirmLabel="Remove"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) remove(pendingRemove);
          setPendingRemove(null);
        }}
      />

      <ConfirmDialog
        open={confirmRegister}
        title={`Confirm registration for ${selected.length} ${selected.length === 1 ? "course" : "courses"}?`}
        description="Your reserved sections will be submitted for registration."
        confirmLabel="Confirm & submit"
        busy={submitting}
        onCancel={() => !submitting && setConfirmRegister(false)}
        onConfirm={submitRegistration}
      />
    </div>
  );
}
