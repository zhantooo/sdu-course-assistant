"use client";

import { Check, ChevronDown, GraduationCap, Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Course } from "@/lib/domain/types";
import { recommendCourses } from "@/lib/recommendation/recommend";
import { cn } from "@/lib/utils";

export interface RecProfile {
  fullName: string;
  program: string;
  gpa: number;
  completedCredits: number;
  requiredCredits: number;
  creditLimit: number;
}

interface RecommendationsPanelProps {
  courses: Course[];
  passed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  profile: RecProfile;
  stagedCourseCodes: ReadonlySet<string>;
  onAdd?: (course: Course) => void;
}

export function RecommendationsPanel({ courses, passed, failed, profile, stagedCourseCodes, onAdd }: RecommendationsPanelProps) {
  const { eligible } = useMemo(() => recommendCourses(courses, passed, failed), [courses, passed, failed]);
  const top = useMemo(() => eligible.slice(0, 8), [eligible]);

  // A balanced term: fill up to the credit limit with the top picks.
  const suggestedCredits = useMemo(() => {
    let sum = 0;
    for (const r of top) {
      if (sum + r.course.credits > profile.creditLimit) break;
      sum += r.course.credits;
    }
    return sum;
  }, [top, profile.creditLimit]);

  // Senior students mostly pick electives (300/400-level) for their track —
  // flag it so the copy can point them at the AI advice.
  const electiveHeavy = useMemo(
    () => top.filter((r) => r.course.level >= 300 && !r.retake).length >= 3,
    [top],
  );

  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [collapsed, setCollapsed] = useState(false);
  const [picksCollapsed, setPicksCollapsed] = useState(false);
  const [coursesCollapsed, setCoursesCollapsed] = useState(false);
  // Re-request only when the actual candidate set changes. The ref is the single
  // source of truth for "which set is live", so results are applied by comparing
  // against it — this survives dev StrictMode's mount→cleanup→mount without the
  // in-flight request being orphaned (the old `alive` flag left it stuck loading).
  const candidateKey = top.map((r) => r.course.code).join(",");
  const requestedFor = useRef("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!candidateKey || requestedFor.current === candidateKey) return;
    requestedFor.current = candidateKey;

    // Reuse a cached rationale for the same candidate set to avoid re-calling the
    // model (and burning quota) on every visit to the planner.
    try {
      const cached = sessionStorage.getItem(`rec:${candidateKey}`);
      if (cached) {
        setSummary(cached);
        setStatus("ready");
        return;
      }
    } catch {
      // sessionStorage unavailable — just fetch.
    }

    // Supersede any earlier in-flight request for a stale candidate set.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setSummary(null);
    setStatus("loading");

    // Never leave the banner spinning: if the model is slow or quota is out,
    // fall back to the ranked list (which is always shown) after a hard cap.
    const timer = setTimeout(() => {
      if (requestedFor.current === candidateKey) setStatus("error");
      controller.abort();
    }, 15000);

    (async () => {
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            candidates: top.map((r) => ({
              code: r.course.code,
              title: r.course.title,
              credits: r.course.credits,
              level: r.course.level,
              reasons: r.reasons,
            })),
            recentlyPassed: [...passed].slice(0, 60),
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (requestedFor.current !== candidateKey) return; // a newer set took over
        if (!res.ok || !data.summary) {
          setStatus("error");
        } else {
          setSummary(data.summary as string);
          setStatus("ready");
          try {
            sessionStorage.setItem(`rec:${candidateKey}`, data.summary as string);
          } catch {
            // best-effort cache only
          }
        }
      } catch (err) {
        // Aborted (timeout or superseded) is handled elsewhere; ignore it here.
        if ((err as Error)?.name === "AbortError") return;
        if (requestedFor.current === candidateKey) setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  // The courses the AI actually named in its advice — surfaced as one-tap cards
  // right under the recommendation, so a suggestion can be added without re-reading
  // the prose. Resolved against the live catalog; already-passed ones are dropped.
  const aiPicks = useMemo(() => {
    if (status !== "ready" || !summary) return [];
    const byNorm = new Map(courses.map((c) => [c.code.replace(/\s+/g, "").toUpperCase(), c]));
    const seen = new Set<string>();
    const out: Course[] = [];
    for (const raw of summary.match(/\b[A-Z]{2,4}\s?\d{3}\b/g) ?? []) {
      const key = raw.replace(/\s+/g, "").toUpperCase();
      const course = byNorm.get(key);
      if (course && !passed.has(course.code) && !seen.has(key)) {
        seen.add(key);
        out.push(course);
      }
    }
    return out;
  }, [status, summary, courses, passed]);

  if (top.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50",
          !collapsed && "border-b border-zinc-100",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Sparkles className="size-4 text-accent" aria-hidden /> Recommended this semester
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{eligible.length} eligible</span>
          <ChevronDown
            className={cn("size-4 text-zinc-400 transition-transform", collapsed && "-rotate-90")}
            aria-hidden
          />
        </span>
      </button>
      {!collapsed && (
      <CardContent className="space-y-4">
        <p className="-mt-1 text-[13px] text-zinc-500">
          Ranked from your transcript — these fit your plan right now.
          {suggestedCredits > 0 && (
            <>
              {" "}
              A balanced term is about{" "}
              <span className="tnum font-medium text-zinc-700">
                {suggestedCredits}/{profile.creditLimit} ECTS
              </span>
              . Add any to your plan with the <Plus className="inline size-3 -translate-y-px" aria-hidden /> button.
            </>
          )}
        </p>

        <div className="rounded-lg bg-accent-soft/50 p-3.5 text-[13px] leading-relaxed text-zinc-700">
          {status === "loading" && (
            <span className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Analysing your degree plan…
            </span>
          )}
          {status === "error" && (
            <span className="text-zinc-500">
              Personalised advice is unavailable right now, but the courses below are ranked for you — add the ones you want.
            </span>
          )}
          {status === "ready" && summary && <p className="whitespace-pre-wrap">{summary}</p>}
        </div>

        {aiPicks.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setPicksCollapsed((v) => !v)}
              aria-expanded={!picksCollapsed}
              className="flex w-full items-center gap-2 bg-accent-soft/40 px-3 py-2 text-left transition-colors hover:bg-accent-soft/60"
            >
              <Sparkles className="size-3.5 shrink-0 text-accent" aria-hidden />
              <span className="text-[12px] font-medium text-zinc-700">AI picks · this semester</span>
              <span className="tnum ml-auto rounded-full bg-white px-1.5 text-[10px] font-semibold text-zinc-500">
                {aiPicks.length}
              </span>
              <ChevronDown
                className={cn("size-3.5 shrink-0 text-zinc-400 transition-transform", picksCollapsed && "-rotate-90")}
                aria-hidden
              />
            </button>
            {!picksCollapsed && (
              <ul className="divide-y divide-zinc-100">
                {aiPicks.map((course) => {
                  const staged = stagedCourseCodes.has(course.code);
                  return (
                    <li key={course.code} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="tnum font-mono text-[12px] font-semibold text-zinc-900">{course.code}</span>
                          <span className="tnum text-[10px] text-zinc-400">{course.credits} ECTS</span>
                        </div>
                        <p className="truncate text-[11px] text-zinc-500">{course.title}</p>
                      </div>
                      {onAdd && course.sections.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onAdd(course)}
                          disabled={staged}
                          aria-label={staged ? `${course.code} in plan` : `Add ${course.code} to plan`}
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg border transition-colors",
                            staged
                              ? "border-transparent text-emerald-600"
                              : "border-zinc-200 text-zinc-500 hover:border-accent/40 hover:text-accent",
                          )}
                        >
                          {staged ? <Check className="size-4" /> : <Plus className="size-4" />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {electiveHeavy && (
          <p className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent-soft/40 px-3 py-2 text-[12px] text-accent-fg">
            <GraduationCap className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              You&apos;re mostly choosing electives now. Pick along your track — the advice above helps you build a
              coherent set, or ask the assistant for a second opinion.
            </span>
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={() => setCoursesCollapsed((v) => !v)}
            aria-expanded={!coursesCollapsed}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left"
          >
            <span className="text-[12px] font-semibold text-zinc-700">Courses this semester</span>
            <span className="tnum ml-auto rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500">
              {eligible.length}
            </span>
            <ChevronDown
              className={cn("size-3.5 shrink-0 text-zinc-400 transition-transform", coursesCollapsed && "-rotate-90")}
              aria-hidden
            />
          </button>
          {!coursesCollapsed && (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {top.map(({ course, reasons, retake }) => {
            const staged = stagedCourseCodes.has(course.code);
            return (
              <li
                key={course.code}
                className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="tnum font-mono text-[13px] font-semibold text-zinc-900">{course.code}</span>
                    <span className="tnum text-[11px] text-zinc-400">{course.credits} ECTS</span>
                    {retake && <Badge tone="warning">Retake</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{course.title}</p>
                  {reasons[0] && <p className="mt-0.5 text-[11px] text-accent-fg">{reasons[0]}</p>}
                </div>
                {onAdd && course.sections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onAdd(course)}
                    disabled={staged}
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition-colors",
                      staged
                        ? "border-transparent text-accent"
                        : "border-zinc-200 text-zinc-500 hover:border-accent/40 hover:text-accent",
                    )}
                    aria-label={staged ? `${course.code} in plan` : `Add ${course.code} to plan`}
                  >
                    {staged ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </button>
                )}
              </li>
            );
          })}
          </ul>
          )}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
