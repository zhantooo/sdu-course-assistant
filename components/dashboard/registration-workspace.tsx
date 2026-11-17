"use client";

import { CalendarDays, Hourglass, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Course, Department, SeatAvailability, Section, StudentProfile, Transcript } from "@/lib/domain/types";
import type { CreditLimit } from "@/lib/registration/credits";
import { evaluateCandidate, suggestAlternativeSection, summarizeSelection, type SelectionContext } from "@/lib/registration/evaluate";
import { optimizeSchedule } from "@/lib/registration/optimize";
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
  const { stagedIds, setStagedIds, hydrated: planHydrated } = useStagedSections(`sdu:plan:${profile.studentId}:${term.code}`);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [seedSeats] = useState(() => initialSeats(courses));
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [confirmRegister, setConfirmRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waitlist, setWaitlist] = useState<Array<{ sectionId: string; position: number; course: string }>>([]);
  const hasWaitlistRef = useRef(false);
  // Sections just claimed from the waitlist — the seat poller must not warn that
  // they "filled up" (the student is the one who just took the seat).
  const justEnrolledRef = useRef<Set<string>>(new Set());
  // joinWaitlist is defined further down (it needs processWaitlist); toggle calls
  // it through this ref so the two don't have to be declared in dependency order.
  const joinWaitlistRef = useRef<(section: Section) => void>(() => {});

  // "Registered" is persisted per student + term so a confirmed plan still reads
  // as submitted after a refresh (it resets whenever the plan is edited below).
  const registeredKey = `sdu:registered:${profile.studentId}:${term.code}`;
  const [registered, setRegisteredState] = useState(false);
  useEffect(() => {
    try {
      setRegisteredState(window.localStorage.getItem(registeredKey) === "1");
    } catch {
      // storage unavailable — treat as not yet registered
    }
  }, [registeredKey]);
  const setRegistered = useCallback(
    (value: boolean) => {
      setRegisteredState(value);
      try {
        window.localStorage.setItem(registeredKey, value ? "1" : "0");
      } catch {
        // non-fatal: still reflected for this session
      }
    },
    [registeredKey],
  );

  // Any edit to the plan un-confirms it — including one made outside this
  // component (the AI assistant adds courses straight to the shared plan). The
  // first settled value after hydration is the baseline, so a reload of an
  // already-submitted plan is not treated as an edit.
  const planBaseline = useRef<string | null>(null);
  useEffect(() => {
    if (!planHydrated) return;
    const signature = [...stagedIds].sort().join(",");
    if (planBaseline.current !== null && planBaseline.current !== signature) setRegistered(false);
    planBaseline.current = signature;
  }, [stagedIds, planHydrated, setRegistered]);

  // Mirror the cart into the database (staged_selections) so the plan is visible
  // there, not only in the browser. Debounced and best-effort — a failure here
  // never blocks planning.
  useEffect(() => {
    if (!planHydrated) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionIds: stagedIds }),
        signal: controller.signal,
      }).catch(() => {});
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [stagedIds, planHydrated]);

  // The seat poller calls back asynchronously; read the latest plan through a ref.
  const planRef = useRef<{ staged: ReadonlySet<string>; byId: ReadonlyMap<string, Section> }>({
    staged: new Set(),
    byId: new Map(),
  });
  const onSeatChange = (changes: SeatChange[]) => {
    for (const { sectionId, previous, next } of changes) {
      const section = planRef.current.byId.get(sectionId);
      if (!section || !planRef.current.staged.has(sectionId) || !previous) continue;
      if (justEnrolledRef.current.has(sectionId)) continue; // we just claimed this seat
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
  const suggestAlt = useCallback((section: Section) => suggestAlternativeSection(section, ctx), [ctx]);

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
        // Smart help: a full section offers its best open, conflict-free sibling
        // (or the waitlist if none fits).
        const onlyFull = result.blockers.length === 1 && result.blockers[0].code === "SECTION_FULL";
        const alt = onlyFull ? suggestAlternativeSection(section, ctx) : null;
        toast.error(`Can't add ${label(section)}`, {
          description: result.blockers.map((b) => b.message).join(" "),
          action: alt
            ? { label: `Add §${alt.sectionNumber} instead`, onClick: () => toggle(alt) }
            : onlyFull
              ? { label: "Join waitlist", onClick: () => joinWaitlistRef.current(section) }
              : undefined,
        });
        return;
      }

      const replaced = result.replaces;
      setStagedIds((prev) =>
        replaced ? prev.map((id) => (id === replaced.id ? section.id : id)) : [...prev, section.id],
      );
      setFocusedId(section.id);
      setRegistered(false);
      // Taking any section of this course clears its waitlist — the server does
      // the same in /api/plan; this just updates the panel immediately.
      setWaitlist((prev) => {
        const next = prev.filter((w) => w.course.split(" §")[0] !== section.courseCode);
        if (next.length !== prev.length) hasWaitlistRef.current = next.length > 0;
        return next;
      });

      if (result.warnings.length > 0) {
        // Added with a clash — offer the best clash-free section of the same course.
        const alt = suggestAlternativeSection(section, ctx);
        toast.warning(`${label(section)} added with a time conflict`, {
          description: result.warnings[0].message,
          action: alt ? { label: `Switch to §${alt.sectionNumber}`, onClick: () => toggle(alt) } : undefined,
        });
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

  // Smart Schedule Optimizer: auto-fill the plan with the best conflict-free,
  // prerequisite-aware set of courses that fits the student's advised load.
  const optimize = useCallback(() => {
    const result = optimizeSchedule({
      courses: liveCourses,
      passed,
      failed,
      creditLimit: creditLimit.max,
      target: creditLimit.recommended,
      preselected: selected,
    });
    if (result.added.length === 0) {
      toast("Your schedule is already optimal", {
        description: "No conflict-free course fits your remaining credit budget.",
      });
      return;
    }
    const addedIds = result.added.map((s) => s.id);
    setStagedIds((prev) => [...prev, ...addedIds.filter((id) => !prev.includes(id))]);
    setFocusedId(addedIds[0] ?? null);
    setRegistered(false);
    const n = result.added.length;
    toast.success(`Optimized · added ${n} ${n === 1 ? "course" : "courses"} (${result.credits} ECTS total)`, {
      description: "A conflict-free, balanced plan within your advised load.",
    });
  }, [liveCourses, passed, failed, creditLimit.max, creditLimit.recommended, selected, setStagedIds, setRegistered]);

  // ── Smart waitlist ──────────────────────────────────────────────────────
  // Ask the server to claim any freed seats we're waitlisted for that still fit
  // the schedule, and refresh the list of what we're still waiting on.
  const processWaitlist = useCallback(async () => {
    try {
      const res = await fetch("/api/waitlist/process", { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as {
        enrolled: Array<{ sectionId: string; course: string }>;
        entries: Array<{ sectionId: string; position: number; course: string }>;
      } | null;
      if (!data) return;
      setWaitlist(data.entries ?? []);
      hasWaitlistRef.current = (data.entries?.length ?? 0) > 0;
      if (data.enrolled?.length) {
        const ids = data.enrolled.map((e) => e.sectionId);
        // Taking the last seat would otherwise trip the "filled up" warning below.
        ids.forEach((id) => justEnrolledRef.current.add(id));
        setTimeout(() => ids.forEach((id) => justEnrolledRef.current.delete(id)), 20_000);
        setStagedIds((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
        toast.success(`Auto-enrolled from the waitlist: ${data.enrolled.map((e) => e.course).join(", ")}`, {
          description: "A seat opened and it still fit your schedule, so we claimed it for you.",
        });
      }
    } catch {
      // best-effort — the waitlist never blocks the UI
    }
  }, [setStagedIds]);

  const joinWaitlist = useCallback(
    async (section: Section) => {
      try {
        const res = await fetch("/api/waitlist/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: section.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error("Couldn't join the waitlist", { description: data?.error?.message ?? "Please try again." });
          return;
        }
        toast.success(`On the waitlist · ${data.course}`, {
          description: `Position ${data.position}. We'll auto-enroll you when a seat opens and it fits.`,
        });
        hasWaitlistRef.current = true;
        processWaitlist();
      } catch {
        toast.error("Couldn't reach the server.");
      }
    },
    [processWaitlist],
  );
  joinWaitlistRef.current = joinWaitlist;

  const leaveWaitlist = useCallback(async (sectionId: string) => {
    setWaitlist((prev) => {
      const next = prev.filter((w) => w.sectionId !== sectionId);
      hasWaitlistRef.current = next.length > 0;
      return next;
    });
    try {
      await fetch("/api/waitlist/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });
      toast("Left the waitlist");
    } catch {
      // best-effort — the panel is already updated
    }
  }, []);

  // Run the smart waitlist pass on load, then again whenever seats change — so a
  // freed seat is claimed within one poll if it still fits the schedule.
  useEffect(() => {
    if (planHydrated) processWaitlist();
  }, [planHydrated, processWaitlist]);
  useEffect(() => {
    if (updatedAt && hasWaitlistRef.current) processWaitlist();
  }, [updatedAt, processWaitlist]);

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

      <StatStrip profile={profile} summary={summary} creditLimit={creditLimit} seatStatus={seatStatus} seatsUpdatedAt={updatedAt} />

      {selected.length === 0 && hasSections && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-accent-fg">
            <Sparkles className="size-4 shrink-0" aria-hidden />
            New term — not sure where to start? Build a balanced, conflict-free semester within your credit limit in one click.
          </p>
          <Button variant="primary" size="sm" onClick={optimize} className="shrink-0 gap-1.5">
            <Sparkles aria-hidden /> Optimize my semester
          </Button>
        </div>
      )}

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
          suggestAlternative={suggestAlt}
          onToggle={toggle}
          onWaitlist={joinWaitlist}
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
              <div className="flex flex-wrap items-center gap-3">
                <ul className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500" aria-label="Legend">
                  <li className="flex items-center gap-1.5">
                    <span className="size-3 rounded-[3px] border border-dashed border-accent bg-accent-soft" /> Preview
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="conflict-stripes size-3 rounded-[3px] border border-red-400" /> Conflict
                  </li>
                  <li className="tnum font-mono text-zinc-400">LEC · PRA · LAB</li>
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={optimize}
                  disabled={!hasSections}
                  className="gap-1.5"
                  title="Auto-build a conflict-free, balanced plan within your advised credit load"
                >
                  <Sparkles aria-hidden /> Optimize
                </Button>
              </div>
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

          {waitlist.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hourglass className="size-4 text-zinc-400" aria-hidden /> Waitlist
                </CardTitle>
                <span className="tnum text-xs text-zinc-400">{waitlist.length}</span>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
                  {waitlist.map((w) => (
                    <li key={w.sectionId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                      <span className="tnum font-mono font-semibold text-zinc-900">{w.course}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="text-xs text-zinc-500">position {w.position}</span>
                        <button
                          type="button"
                          onClick={() => leaveWaitlist(w.sectionId)}
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                          aria-label={`Leave the ${w.course} waitlist`}
                        >
                          Leave
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-zinc-400">
                  We'll enroll you automatically when a seat opens and it still fits your schedule and credit limit.
                </p>
              </CardContent>
            </Card>
          )}
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
